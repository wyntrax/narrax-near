/** NEP-141 token metadata and balance helpers, plus NEAR amount formatting. */
import { z } from 'zod';
import { NearRpcError, type NearRpc } from './rpc';
import { isNearAccountId } from './account';

export interface FtMetadata {
  spec?: string;
  name: string;
  symbol: string;
  decimals: number;
  icon?: string | null;
  reference?: string | null;
  reference_hash?: string | null;
}

const metadataSchema = z.object({
  spec: z.string().optional(),
  name: z.string().min(1),
  symbol: z.string().min(1),
  decimals: z.number().int().min(0).max(38),
  icon: z.string().nullish(),
  reference: z.string().nullish(),
  reference_hash: z.string().nullish(),
});

/** Validate an `ft_metadata` response. Unknown fields are dropped. */
export function parseFtMetadata(value: unknown): FtMetadata {
  const parsed = metadataSchema.safeParse(value);
  if (!parsed.success) throw new NearRpcError('Contract returned invalid NEP-141 metadata', 'INVALID_METADATA');
  return parsed.data;
}

/** Read NEP-141 metadata from a token contract. */
export async function ftMetadata(client: NearRpc, token: string): Promise<FtMetadata> {
  if (!isNearAccountId(token)) throw new NearRpcError(`Invalid NEAR token contract: ${token}`, 'INVALID_ACCOUNT');
  const { value } = await client.callFunction<unknown>(token, 'ft_metadata');
  return parseFtMetadata(value);
}

/** Parse an `ft_balance_of` result. The contract returns a decimal string. */
export function parseFtBalance(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new NearRpcError('Contract returned an invalid NEP-141 balance', 'INVALID_BALANCE');
  }
  return BigInt(value);
}

/** Read a NEP-141 balance in the token's smallest unit. */
export async function ftBalanceOf(client: NearRpc, token: string, account: string): Promise<bigint> {
  if (!isNearAccountId(token)) throw new NearRpcError(`Invalid NEAR token contract: ${token}`, 'INVALID_ACCOUNT');
  if (!isNearAccountId(account)) throw new NearRpcError(`Invalid NEAR account: ${account}`, 'INVALID_ACCOUNT');
  const { value } = await client.callFunction<unknown>(token, 'ft_balance_of', { account_id: account });
  return parseFtBalance(value);
}

/**
 * Format a smallest-unit integer for display without floating point loss.
 * Trailing zeros are trimmed, so 1_000_000 at 6 decimals is "1", not "1.000000".
 */
export function formatTokenAmount(value: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38) throw new RangeError('decimals must be an integer from 0 to 38');
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = absolute % base;
  const raw = decimals === 0 ? '' : fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${raw ? `.${raw}` : ''}`;
}
