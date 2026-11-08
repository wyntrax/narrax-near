import { createRemoteJWKSet, importSPKI, jwtVerify, type JWTVerifyGetKey, type KeyLike } from 'jose';
import type { RuntimeSettingsResolver } from './runtime-settings';

/** A verified identity token. The email is null when the token carries none; a missing email never grants access. */
export interface VerifiedIdentity { privyUserId: string; email: string | null }

export interface AuthVerifier {
  /** Resolves to the Privy user id or throws. Callers must not reveal why verification failed. */
  verify(token: string): Promise<{ privyUserId: string }>;
  /** Like verify, and also says when the token expires (ms since the epoch, null when it carries no expiry). Long-lived connections need it. */
  verifyWithExpiry?(token: string): Promise<{ privyUserId: string; expiresAtMs: number | null }>;
  /** Verifies a Privy identity token and returns its linked email when present. Optional: a verifier may not support it. */
  verifyIdentity?(token: string): Promise<VerifiedIdentity>;
}

/**
 * Reads the linked email from a verified Privy identity token. Privy signs this token the same way it signs the access
 * token, so once the signature checks out the address is trusted. The exact claim shape is not guaranteed, so this reads
 * it defensively and returns null when it cannot: an email that cannot be read simply never matches, it is never guessed.
 */
export function linkedEmail(payload: Record<string, unknown>): string | null {
  const clean = (value: unknown) => (typeof value === 'string' && value.includes('@') ? value.trim().toLowerCase() : null);
  const direct = clean(payload.email);
  if (direct) return direct;
  const raw = payload.linked_accounts;
  let accounts: unknown = raw;
  if (typeof raw === 'string') { try { accounts = JSON.parse(raw); } catch { return null; } }
  if (!Array.isArray(accounts)) return null;
  for (const entry of accounts) {
    if (!entry || typeof entry !== 'object') continue;
    const { type, address } = entry as { type?: unknown; address?: unknown };
    if (type === 'email') { const found = clean(address); if (found) return found; }
  }
  return null;
}

/** Privy publishes the app's current verification keys here. The path is documented and is not built from token claims. */
export function privyJwksUrl(appId: string): string {
  return `https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/jwks.json`;
}

/**
 * Verifies a Privy access token locally with the app's verification key. If the configured PEM is stale (Privy rotated
 * it), the verifier retries against Privy's app-specific JWKS endpoint. Only a signature-key failure triggers the
 * fallback: a wrong audience, issuer or expiry is rejected immediately and never causes a network request.
 *
 * Privy access tokens are ES256 JWTs with issuer "privy.io", the app id as audience and the user's DID as subject.
 */
export function createPrivyVerifier(opts: { appId: string; verificationKey: string; jwksUrl?: string | null }): AuthVerifier {
  let staticKey: Promise<KeyLike | null> | undefined;
  const getStaticKey = () => (staticKey ??= importSPKI(opts.verificationKey.replace(/\\n/g, '\n'), 'ES256').catch(() => null));
  let remote: JWTVerifyGetKey | undefined;
  const getRemote = () => {
    if (!opts.jwksUrl) return undefined;
    return (remote ??= createRemoteJWKSet(new URL(opts.jwksUrl), {
      cacheMaxAge: 60 * 60_000,
      cooldownDuration: 10 * 60_000,
      timeoutDuration: 5_000,
    }));
  };
  const verifyWith = (token: string, key: KeyLike | JWTVerifyGetKey) => {
    const options = { issuer: 'privy.io', audience: opts.appId, algorithms: ['ES256'] };
    return typeof key === 'function' ? jwtVerify(token, key, options) : jwtVerify(token, key, options);
  };
  const isSignatureKeyFailure = (e: unknown) => {
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as Record<string, unknown>).code) : '';
    return code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
  };
  const check = async (token: string) => {
    let keyFailure: unknown;
    const key = await getStaticKey();
    if (key) {
      try {
        const { payload } = await verifyWith(token, key);
        if (!payload.sub) throw new Error('Token has no subject');
        return { privyUserId: payload.sub, expiresAtMs: typeof payload.exp === 'number' ? payload.exp * 1000 : null };
      } catch (e) {
        if (!isSignatureKeyFailure(e)) throw e;
        keyFailure = e;
      }
    }
    const keys = getRemote();
    if (!keys) throw keyFailure ?? new Error('PRIVY_VERIFICATION_KEY could not be read');
    const { payload } = await verifyWith(token, keys);
    if (!payload.sub) throw new Error('Token has no subject');
    return { privyUserId: payload.sub, expiresAtMs: typeof payload.exp === 'number' ? payload.exp * 1000 : null };
  };
  return {
    async verify(token) { return { privyUserId: (await check(token)).privyUserId }; },
    verifyWithExpiry: check,
    // The identity token carries the same subject and the linked accounts. It is only ever used to learn a verified email.
    async verifyIdentity(token) {
      let keyFailure: unknown;
      const key = await getStaticKey();
      if (key) {
        try {
          const { payload } = await verifyWith(token, key);
          if (!payload.sub) throw new Error('Token has no subject');
          return { privyUserId: payload.sub, email: linkedEmail(payload as Record<string, unknown>) };
        } catch (e) {
          if (!isSignatureKeyFailure(e)) throw e;
          keyFailure = e;
        }
      }
      const keys = getRemote();
      if (!keys) throw keyFailure ?? new Error('PRIVY_VERIFICATION_KEY could not be read');
      const { payload } = await verifyWith(token, keys);
      if (!payload.sub) throw new Error('Token has no subject');
      return { privyUserId: payload.sub, email: linkedEmail(payload as Record<string, unknown>) };
    },
  };
}

/** Share the runtime cache with public config and origin checks. Only the active key is retained. */
export function createRuntimePrivyVerifier(settings: RuntimeSettingsResolver): AuthVerifier {
  let active: { appId: string; key: string; verifier: AuthVerifier } | undefined;
  const current = async () => {
    const config = await settings.read(), appId = config.privyAppId.value, key = config.privyVerificationKey.value;
    if (!active || active.appId !== appId || active.key !== key) {
      const jwksUrl = process.env.PRIVY_JWKS_URL?.trim() || privyJwksUrl(appId);
      active = { appId, key, verifier: createPrivyVerifier({ appId, verificationKey: key, jwksUrl }) };
    }
    return active.verifier;
  };
  const check = async (token: string) => (await current()).verifyWithExpiry!(token);
  return {
    verify: async token => ({ privyUserId: (await check(token)).privyUserId }),
    verifyWithExpiry: check,
    verifyIdentity: async token => (await current()).verifyIdentity!(token),
  };
}

/**
 * A short reason a token was rejected, for the server log only. It never contains a token, key or app id, and clients
 * still receive a bare 401. This turns "401 and no idea why" into one actionable line.
 */
export function describeAuthFailure(e: unknown): string {
  const read = (key: string) => (typeof e === 'object' && e !== null && key in e ? String((e as Record<string, unknown>)[key]) : '');
  const code = read('code'), claim = read('claim'), message = e instanceof Error ? e.message : '';
  if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
    if (claim === 'aud') return 'audience mismatch: the token was issued for a different Privy app than PRIVY_APP_ID';
    if (claim === 'iss') return 'issuer mismatch: the token was not issued by privy.io';
    return `claim check failed (${claim || 'unknown claim'})`;
  }
  if (code === 'ERR_JWT_EXPIRED') return 'token expired: sign in again, and check the machine clock if it keeps happening';
  if (code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return 'signature mismatch: PRIVY_VERIFICATION_KEY belongs to a different Privy app than the one that issued the token';
  if (code === 'ERR_JWS_INVALID' || code === 'ERR_JWT_INVALID') return 'not a Privy access token (malformed or the wrong kind of token)';
  if (code === 'ERR_JOSE_ALG_NOT_ALLOWED') return 'token is not signed with ES256';
  if (/spki|pem|key/i.test(message) || e instanceof TypeError) return 'PRIVY_VERIFICATION_KEY could not be read: it must be the full PEM public key from the Privy dashboard';
  return 'token rejected';
}
