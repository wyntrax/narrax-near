import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  NEP413_TAG,
  createNep413Nonce,
  decodeBase58,
  encodeBase58,
  nep413PayloadBytes,
  nep413Signable,
  verifyNep413Signature,
} from './nep413';

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
  const raw = Buffer.from(jwk.x, 'base64url');
  const publicKeyBase58 = encodeBase58(new Uint8Array(raw));
  return { privateKey, raw, publicKeyBase58 };
}

function signed(overrides: Partial<{ message: string; recipient: string; callbackUrl: string }> = {}) {
  const { privateKey, publicKeyBase58 } = keypair();
  const payload = {
    message: overrides.message ?? 'Sign in to NARRAX',
    nonce: createNep413Nonce(),
    recipient: overrides.recipient ?? 'near.narrax.xyz',
    ...(overrides.callbackUrl === undefined ? {} : { callbackUrl: overrides.callbackUrl }),
  };
  const signature = sign(null, nep413Signable(payload), privateKey).toString('base64');
  return { payload, signature, publicKey: publicKeyBase58 };
}

describe('base58', () => {
  it('round-trips bytes and preserves leading zeros', () => {
    expect(encodeBase58(new Uint8Array(32))).toBe('1'.repeat(32));
    expect([...decodeBase58('1'.repeat(32))]).toEqual(new Array(32).fill(0));
    const bytes = Uint8Array.from([0, 1, 2, 3, 254, 255]);
    expect([...decodeBase58(encodeBase58(bytes))]).toEqual([...bytes]);
  });

  it('rejects invalid characters and empty input', () => {
    for (const value of ['', '0', 'O', 'I', 'l', 'abc def']) expect(() => decodeBase58(value)).toThrow(TypeError);
  });
});

describe('NEP-413 payload', () => {
  it('prefixes the payload with the little-endian tag and length-prefixed strings', () => {
    const payload = { message: 'hi', nonce: new Uint8Array(32), recipient: 'a.near' };
    const bytes = nep413PayloadBytes(payload);
    expect([...bytes.slice(0, 4)]).toEqual([0x9d, 0x01, 0x00, 0x80]); // 2^31 + 413
    expect(NEP413_TAG).toBe(2_147_484_061);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(4, true)).toBe(2);
    expect(new TextDecoder().decode(bytes.slice(8, 10))).toBe('hi');
    expect(view.getUint32(42, true)).toBe(6);
    expect(new TextDecoder().decode(bytes.slice(46, 52))).toBe('a.near');
    expect(bytes[52]).toBe(0);
    expect(bytes.length).toBe(53);
  });

  it('encodes callbackUrl as a Borsh Option', () => {
    const base = { message: 'hi', nonce: new Uint8Array(32), recipient: 'a.near' };
    const withCallback = nep413PayloadBytes({ ...base, callbackUrl: 'https://x' });
    expect(withCallback[52]).toBe(1);
    expect(withCallback.length).toBe(nep413PayloadBytes(base).length - 1 + 1 + 4 + 9);
  });

  it('refuses a nonce that is not 32 bytes', () => {
    expect(() => nep413PayloadBytes({ message: 'hi', nonce: new Uint8Array(31), recipient: 'a.near' })).toThrow(TypeError);
  });

  it('generates distinct 32-byte nonces', () => {
    const a = createNep413Nonce();
    const b = createNep413Nonce();
    expect(a.length).toBe(32);
    expect([...a]).not.toEqual([...b]);
  });
});

describe('verifyNep413Signature', () => {
  it('accepts a signature made by the matching key', () => {
    const { payload, signature, publicKey } = signed();
    expect(verifyNep413Signature({ payload, signature, publicKey, expectedRecipient: 'near.narrax.xyz' })).toBe(true);
  });

  it('accepts an ed25519-prefixed key and a base64url signature', () => {
    const { payload, signature, publicKey } = signed();
    const urlSafe = signature.replace(/\+/g, '-').replace(/\//g, '_');
    expect(verifyNep413Signature({ payload, signature: urlSafe, publicKey: `ed25519:${publicKey}` })).toBe(true);
  });

  it('rejects a different message, recipient, nonce or key', () => {
    const { payload, signature, publicKey } = signed();
    expect(verifyNep413Signature({ payload: { ...payload, message: 'Send 100 NEAR' }, signature, publicKey })).toBe(false);
    expect(verifyNep413Signature({ payload: { ...payload, recipient: 'evil.example' }, signature, publicKey })).toBe(false);
    expect(verifyNep413Signature({ payload: { ...payload, nonce: createNep413Nonce() }, signature, publicKey })).toBe(false);
    expect(verifyNep413Signature({ payload, signature, publicKey: encodeBase58(new Uint8Array(32)) })).toBe(false);
  });

  it('enforces the expected recipient', () => {
    const { payload, signature, publicKey } = signed({ recipient: 'near.narrax.xyz' });
    expect(verifyNep413Signature({ payload, signature, publicKey, expectedRecipient: 'narrax.xyz' })).toBe(false);
  });

  it('fails closed on malformed input', () => {
    const { payload, publicKey } = signed();
    expect(verifyNep413Signature({ payload, signature: '', publicKey })).toBe(false);
    expect(verifyNep413Signature({ payload, signature: 'not base64!', publicKey })).toBe(false);
    expect(verifyNep413Signature({ payload, signature: 'AAAA', publicKey })).toBe(false);
    expect(verifyNep413Signature({ payload, signature: 'A'.repeat(88), publicKey: 'not-a-key' })).toBe(false);
    expect(verifyNep413Signature({ payload: { ...payload, nonce: new Uint8Array(1) }, signature: 'A'.repeat(88), publicKey })).toBe(false);
  });
});
