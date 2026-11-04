/** Public chain metadata and a read-only freshness probe. No auth, no wallet data, no writes. */
import type { FastifyInstance } from 'fastify';
import type { NearNetwork } from '@narra/near';

export interface ChainInfo {
  id: 'near';
  label: string;
  network: NearNetwork;
  explorerBase: string;
}

export type ChainProbe = () => Promise<{ height: number }>;

export function registerChainRoutes(app: FastifyInstance, info: ChainInfo, probe?: ChainProbe): void {
  app.get('/v1/chain', async () => ({
    chain: info.id,
    label: info.label,
    network: info.network,
    explorer: info.explorerBase,
  }));

  app.get('/v1/chain/status', async (_request, reply) => {
    if (!probe) return reply.code(503).send({ error: 'CHAIN_PROBE_UNAVAILABLE', chain: info.id, network: info.network });
    const started = Date.now();
    try {
      const { height } = await probe();
      return { chain: info.id, network: info.network, height, latencyMs: Date.now() - started };
    } catch {
      // Never leak RPC URLs or upstream error text to an unauthenticated caller.
      return reply.code(503).send({ error: 'CHAIN_UNAVAILABLE', chain: info.id, network: info.network });
    }
  });
}
