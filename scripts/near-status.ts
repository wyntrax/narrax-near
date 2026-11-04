/**
 * Read-only NEAR connectivity probe.
 *
 *   npm run near:status
 *   npm run near:status -- alice.testnet
 *
 * It never signs or sends anything. Defaults to testnet; set NEAR_NETWORK=mainnet and
 * NEAR_RPC_URL explicitly to read mainnet.
 */
import { NearRpc, formatTokenAmount, isNearAccountId, nearConfigFromEnv } from '@narra/near';

async function main(): Promise<void> {
  const config = nearConfigFromEnv();
  const rpc = new NearRpc({ url: config.rpcUrl });
  const started = Date.now();
  const block = await rpc.latestBlock();
  console.log(`network   ${config.network}`);
  console.log(`rpc       ${config.rpcUrl} (${Date.now() - started} ms)`);
  console.log(`block     ${block.height} ${block.hash}`);

  const account = process.argv[2];
  if (!account) return;
  if (!isNearAccountId(account)) throw new Error(`Not a NEAR account id: ${account}`);
  const view = await rpc.viewAccount(account);
  console.log(`account   ${account}`);
  console.log(`balance   ${formatTokenAmount(BigInt(view.amount), 24)} NEAR`);
  console.log(`locked    ${formatTokenAmount(BigInt(view.locked), 24)} NEAR`);
  console.log(`explorer  ${config.explorerBase}/address/${encodeURIComponent(account)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
