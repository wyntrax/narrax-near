/**
 * NEP-413 message signing support.
 *
 * The wallet signs `sha256(u32_le(2147484061) || borsh(Payload))` with its ed25519 key.
 * The server verifies that signature and, separately, that the nonce has never been used
 * before (nonce storage belongs to the API, not to this pure module).
 */
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';

/** NEP-413 domain-separation tag: 2^31 + 413. */
export const NEP413_TAG = 2_147_484_061;

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP = new Map([...BASE58_ALPHABET].map((character, index) => [character, BigInt(index)]));
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export interface Nep413Payload {
  message: string;
  /** Exactly 32 bytes. Wallets usually generate this; never reuse a nonce. */
  nonce: Uint8Array;
  /** The host that asked for the signature, e.g. `near.narrax.xyz`. */
  recipient: string;
  callbackUrl?: string;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function u32(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError('u32 out of range');
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function borshString(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  return concat([u32(bytes.length), bytes]);
}

/** The tagged, Borsh-serialized payload. Hashing this produces the bytes the wallet signs. */
export function nep413PayloadBytes(payload: Nep413Payload): Uint8Array {
  if (payload.nonce.length !== 32) throw new TypeError('NEP-413 nonce must be exactly 32 bytes');
  if (typeof payload.recipient !== 'string' || payload.recipient.length === 0) throw new TypeError('NEP-413 recipient is required');
  const parts: Uint8Array[] = [u32(NEP413_TAG), borshString(payload.message), payload.nonce, borshString(payload.recipient)];
  if (payload.callbackUrl === undefined) parts.push(Uint8Array.of(0));
  else parts.push(Uint8Array.of(1), borshString(payload.callbackUrl));
  return concat(parts);
}

/** SHA-256 of the tagged payload. This is the message an ed25519 signature covers. */
export function nep413Signable(payload: Nep413Payload): Uint8Array {
  return createHash('sha256').update(nep413PayloadBytes(payload)).digest();
}

/** A fresh 32-byte nonce. Store it server-side and reject any reuse. */
export function createNep413Nonce(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

export function decodeBase58(text: string): Uint8Array {
  if (typeof text !== 'string' || text.length === 0) throw new TypeError('base58 input must be a non-empty string');
  let value = 0n;
  let leadingZeros = 0;
  let counting = true;
  for (const character of text) {
    const digit = BASE58_MAP.get(character);
    if (digit === undefined) throw new TypeError('invalid base58 character');
    if (counting && character === '1') leadingZeros++;
    else counting = false;
    value = value * 58n + digit;
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  bytes.reverse();
  return Uint8Array.from([...new Uint8Array(leadingZeros), ...bytes]);
}

export function encodeBase58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let output = '';
  while (value > 0n) {
    output = BASE58_ALPHABET.charAt(Number(value % 58n)) + output;
    value /= 58n;
  }
  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros++;
  return '1'.repeat(leadingZeros) + output;
}

export interface Nep413VerificationInput {
  payload: Nep413Payload;
  /** Base64 or base64url signature returned by the wallet. */
  signature: string;
  /** Base58 ed25519 public key, optionally prefixed with `ed25519:`. */
  publicKey: string;
  /** When set, the payload recipient must match exactly. */
  expectedRecipient?: string;
}

/**
 * Verify a NEP-413 signature. Returns false for every malformed or mismatched input;
 * it never throws, because an authentication check must fail closed rather than crash a request.
 */
export function verifyNep413Signature(input: Nep413VerificationInput): boolean {
  try {
    const { payload, signature, publicKey, expectedRecipient } = input;
    if (!payload || typeof payload.message !== 'string' || payload.nonce.length !== 32) return false;
    if (typeof payload.recipient !== 'string' || payload.recipient.length === 0) return false;
    if (expectedRecipient !== undefined && payload.recipient !== expectedRecipient) return false;

    const keyText = publicKey.startsWith('ed25519:') ? publicKey.slice('ed25519:'.length) : publicKey;
    const rawKey = decodeBase58(keyText);
    if (rawKey.length !== 32) return false;

    const normalized = signature.replace(/-/g, '+').replace(/_/g, '/');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) return false;
    const signatureBytes = Buffer.from(normalized, 'base64');
    if (signatureBytes.length !== 64) return false;

    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(rawKey)]),
      format: 'der',
      type: 'spki',
    });
    return verifySignature(null, nep413Signable(payload), key, signatureBytes);
  } catch {
    return false;
  }
}
