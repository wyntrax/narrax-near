/**
 * Query the public agent risk gate. Read-only: it never signs, spends or holds a key.
 *
 *   npm run agent:risk -- token.near
 *
 * Exit codes: 0 = PASS, 2 = BLOCK or UNKNOWN, 1 = request/configuration failure.
 */
const api = (process.env.NARRAX_API_URL || 'http://localhost:4000').replace(/\/$/, '');

async function main() {
  const mint = process.argv[2]?.trim();
  if (!mint) throw new Error('usage: npm run agent:risk -- <near-account-id>');

  const response = await fetch(`${api}/v1/agent/risk/${encodeURIComponent(mint)}`);
  const body = await response.json() as { verdict?: string; fresh?: boolean; reasons?: string[] };
  console.log(JSON.stringify({ httpStatus: response.status, ...body }, null, 2));

  if (!response.ok) process.exitCode = 1;
  else if (body.verdict !== 'PASS' || body.fresh !== true) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
