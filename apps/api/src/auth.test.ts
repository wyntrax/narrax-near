import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { exportJWK, exportSPKI, generateKeyPair, SignJWT, type KeyLike } from 'jose';
import { createPrivyVerifier, describeAuthFailure } from './auth';

const sign = (key: KeyLike, claims: { aud: string; iss?: string; exp?: string }) =>
  new SignJWT({}).setProtectedHeader({ alg: 'ES256' }).setSubject('did:privy:abc').setIssuer(claims.iss ?? 'privy.io').setAudience(claims.aud).setExpirationTime(claims.exp ?? '5m').sign(key);

async function setup() {
  const mine = await generateKeyPair('ES256'), other = await generateKeyPair('ES256');
  const verifier = createPrivyVerifier({ appId: 'app-1', verificationKey: await exportSPKI(mine.publicKey) });
  return { mine, other, verifier };
}
const reason = async (work: Promise<unknown>) => { try { await work; return 'accepted'; } catch (e) { return describeAuthFailure(e); } };

describe('describeAuthFailure', () => {
  it('accepts a good token', async () => {
    const { mine, verifier } = await setup();
    expect(await verifier.verify(await sign(mine.privateKey, { aud: 'app-1' }))).toEqual({ privyUserId: 'did:privy:abc' });
  });
  it('names an audience mismatch', async () => {
    const { mine, verifier } = await setup();
    expect(await reason(verifier.verify(await sign(mine.privateKey, { aud: 'other-app' })))).toMatch(/audience mismatch/);
  });
  it('names a signature mismatch', async () => {
    const { other, verifier } = await setup();
    expect(await reason(verifier.verify(await sign(other.privateKey, { aud: 'app-1' })))).toMatch(/signature mismatch/);
  });
  it('names a wrong issuer and an expired token', async () => {
    const { mine, verifier } = await setup();
    expect(await reason(verifier.verify(await sign(mine.privateKey, { aud: 'app-1', iss: 'evil.example' })))).toMatch(/issuer mismatch/);
    expect(await reason(verifier.verify(await sign(mine.privateKey, { aud: 'app-1', exp: '-1m' })))).toMatch(/expired/);
  });
  it('names an unreadable key and a malformed token', async () => {
    const bad = createPrivyVerifier({ appId: 'app-1', verificationKey: '-----BEGIN PUBLIC KEY-----\nnot a key\n-----END PUBLIC KEY-----' });
    expect(await reason(bad.verify('a.b.c'))).toMatch(/could not be read|not a Privy access token/);
    const { verifier } = await setup();
    expect(await reason(verifier.verify('garbage'))).toMatch(/not a Privy access token/);
  });
  it('falls back to the current JWKS key when the configured PEM was rotated', async () => {
    const mine = await generateKeyPair('ES256'), rotated = await generateKeyPair('ES256');
    const jwk = await exportJWK(rotated.publicKey);
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [{ ...jwk, kid: 'rotated-key', alg: 'ES256', use: 'sig' }] }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const verifier = createPrivyVerifier({
        appId: 'app-1',
        verificationKey: await exportSPKI(mine.publicKey),
        jwksUrl: `http://127.0.0.1:${port}/jwks.json`,
      });
      const token = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: 'rotated-key' })
        .setSubject('did:privy:rotated').setIssuer('privy.io').setAudience('app-1').setExpirationTime('5m').sign(rotated.privateKey);
      expect(await verifier.verify(token)).toEqual({ privyUserId: 'did:privy:rotated' });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
  it('never includes the token, key or app id', async () => {
    const { mine, verifier } = await setup();
    const token = await sign(mine.privateKey, { aud: 'other-app' });
    const text = await reason(verifier.verify(token));
    expect(text).not.toContain(token); expect(text).not.toContain('app-1'); expect(text).not.toContain('other-app');
  });
});
