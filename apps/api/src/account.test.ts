import pg from 'pg';
import { SignJWT, exportSPKI, generateKeyPair } from 'jose';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrisma } from '@narra/database';
import { buildApp } from './app';
import { createPrivyVerifier } from './auth';

const APP_ID = 'test-app-id';
const { publicKey, privateKey } = await generateKeyPair('ES256');
const other = await generateKeyPair('ES256');
const verifier = createPrivyVerifier({ appId: APP_ID, verificationKey: await exportSPKI(publicKey) });

const sign = (sub: string, o: { key?: typeof privateKey; aud?: string; iss?: string; exp?: string } = {}) =>
  new SignJWT({}).setProtectedHeader({ alg: 'ES256' }).setSubject(sub).setIssuer(o.iss ?? 'privy.io').setAudience(o.aud ?? APP_ID)
    .setIssuedAt().setExpirationTime(o.exp ?? '5m').sign(o.key ?? privateKey);

describe('privy verifier', () => {
  it('accepts a valid token and returns the subject', async () => {
    expect(await verifier.verify(await sign('did:privy:abc'))).toEqual({ privyUserId: 'did:privy:abc' });
  });
  it('rejects wrong key, audience, issuer, expired and garbage tokens', async () => {
    for (const t of [await sign('u', { key: other.privateKey }), await sign('u', { aud: 'other-app' }), await sign('u', { iss: 'evil.io' }), await sign('u', { exp: '-1m' }), 'garbage']) {
      await expect(verifier.verify(t)).rejects.toThrow();
    }
  });
});

const url = process.env.DATABASE_URL ?? 'postgresql://narra:narra@localhost:5432/narra';
async function dbUp() {
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 800 });
  try { await c.connect(); await c.query('select 1 from "User" limit 1'); return true; } catch { return false; } finally { await c.end().catch(() => {}); }
}
const up = await dbUp();

describe.skipIf(!up)('account routes (needs Postgres)', () => {
  const db = createPrisma(url);
  afterAll(async () => { await db.$disconnect(); });
  const tag = `a${Date.now()}`;

  const call = async (method: 'GET' | 'PUT' | 'POST', path: string, sub: string | null, payload?: unknown) => {
    const app = await buildApp({ account: { db, verifier } });
    try {
      const res = await app.inject({ method, url: path, payload: payload as object, headers: sub ? { authorization: `Bearer ${await sign(sub)}` } : {} });
      return { status: res.statusCode, body: res.json() };
    } finally { await app.close(); }
  };
  const alice = `did:privy:alice-${tag}`;
  const bob = `did:privy:bob-${tag}`;

  it('requires a valid token', async () => {
    expect((await call('GET', '/v1/me', null)).status).toBe(401);
    const app = await buildApp({ account: { db, verifier } });
    try { expect((await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: 'Bearer nope' } })).statusCode).toBe(401); } finally { await app.close(); }
  });

  it('creates the user on first sign-in with safe defaults', async () => {
    const r = await call('GET', '/v1/me', alice);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ isAdmin: false, admin: { configured: false } });
    expect((await call('GET', '/v1/me', alice)).body.id).toBe(r.body.id); // same user, not a new one
  });

  it('keeps users and their audit events separate', async () => {
    const mine = (await call('GET', '/v1/me', alice)).body;
    await call('POST', '/v1/me/audit', alice, { action: 'test.event', detail: { ok: true } });
    const actions = (await db.auditLog.findMany({ where: { userId: mine.id } })).map((a) => a.action);
    expect(actions).toContain('test.event');
    expect((await call('GET', '/v1/me', bob)).body.id).not.toBe(mine.id);
  });

  it('treats a trading route as removed', async () => {
    expect((await call('PUT', '/v1/mode', alice, { mode: 'AUTO' })).status).toBe(404);
  });
});
