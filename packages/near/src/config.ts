/** Environment-backed NEAR configuration. Testnet is the safe default; mainnet requires an explicit opt-in. */
import { nearExplorerBase } from './explorer';
import { defaultNearRpcUrl, parseNearNetwork, type NearNetwork } from './network';

export interface NearConfig {
  network: NearNetwork;
  rpcUrl: string;
  explorerBase: string;
}

export function nearConfigFromEnv(env: Record<string, string | undefined> = process.env): NearConfig {
  const network = parseNearNetwork(env.NEAR_NETWORK);
  const rpcUrl = env.NEAR_RPC_URL?.trim() || defaultNearRpcUrl(network);
  if (!/^https?:\/\//.test(rpcUrl)) throw new Error('NEAR_RPC_URL must be an http:// or https:// URL');
  const explorerBase = env.NEAR_EXPLORER_URL?.trim() || nearExplorerBase(network);
  if (!/^https?:\/\//.test(explorerBase)) throw new Error('NEAR_EXPLORER_URL must be an http:// or https:// URL');
  return { network, rpcUrl, explorerBase };
}
