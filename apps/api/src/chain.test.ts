import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerChainRoutes } from './chain';

const info = { id: 'near' as const, label: 'NEAR', network: 'testnet' as const, explorerBase: 'https://testnet.nearblocks.io' };

describe('chain routes', () => {
  it('publishes chain metadata without exposing the RPC URL', async () => {
    const app = Fastify();
    registerChainRoutes(app, info);
    const response = await app.inject({ method: 'GET', url: '/v1/chain' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ chain: 'near', label: 'NEAR', network: 'testnet', explorer: 'https://testnet.nearblocks.io' });
    expect(response.body).not.toContain('rpc');
    await app.close();
  });

  it('reports the final block height and a measured latency', async () => {
    const app = Fastify();
    registerChainRoutes(app, info, async () => ({ height: 42 }));
    const response = await app.inject({ method: 'GET', url: '/v1/chain/status' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ chain: 'near', network: 'testnet', height: 42 });
    expect(typeof body.latencyMs).toBe('number');
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
    await app.close();
  });

  it('fails closed when no probe is configured', async () => {
    const app = Fastify();
    registerChainRoutes(app, info);
    const response = await app.inject({ method: 'GET', url: '/v1/chain/status' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'CHAIN_PROBE_UNAVAILABLE', chain: 'near', network: 'testnet' });
    await app.close();
  });

  it('fails closed without leaking upstream errors', async () => {
    const app = Fastify();
    registerChainRoutes(app, info, async () => {
      throw new Error('https://secret-rpc.example key=abc');
    });
    const response = await app.inject({ method: 'GET', url: '/v1/chain/status' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'CHAIN_UNAVAILABLE', chain: 'near', network: 'testnet' });
    expect(response.body).not.toContain('secret');
    await app.close();
  });
});
