/**
 * Bridged assets are reference/quote assets, not narrative research candidates.
 * They use the Omni bridge (`*.omft.near`, `*.omdep.near`) or a native bridge
 * (`*.bridge.near`) and should not be linked to NEAR narrative research.
 */
const BRIDGED_ASSET_RE = /(?:^|\.)(?:omft|omdep|bridge)\.(?:near|testnet)$/i;

export function isBridgedAsset(mint: string): boolean {
  return BRIDGED_ASSET_RE.test(mint.trim());
}
