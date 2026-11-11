import { hasDeployedCode, NearRpcError, type NearRpc } from '@narra/near';

export type ContractStatus = 'CONTRACT' | 'NOT_CONTRACT' | 'NOT_FOUND';

export interface ContractSafety {
  status: ContractStatus;
  /** Null means the key list could not be read; it is not zero. */
  fullAccessKeys: number | null;
  functionCallKeys: number | null;
}

export interface ContractSafetySource {
  inspect(mint: string): Promise<ContractSafety | null>;
}

export interface ContractSafetyOptions {
  now?: () => number;
  ttlMs?: number;
  /** Failures are cached for less time than facts, so a transient RPC error clears quickly. */
  errorTtlMs?: number;
}

function isMissingAccount(error: NearRpcError): boolean {
  const data = error.data;
  const named = data && typeof data === 'object'
    ? data as { name?: unknown; cause?: { name?: unknown } }
    : null;
  const text = [
    error.message,
    typeof data === 'string' ? data : '',
    typeof named?.name === 'string' ? named.name : '',
    typeof named?.cause?.name === 'string' ? named.cause.name : '',
  ].join(' ');
  // NEAR RPC puts the useful text in error.data ("account ... does not exist while viewing")
  // while the top-level message is often just "Server error".
  return /does not exist|unknown[ _]account/i.test(text);
}

/**
 * Read-only contract safety facts for the agent risk gate. It never signs, transfers or deploys.
 * A failed RPC call is cached briefly as null and surfaced as UNKNOWN by the caller.
 */
export function createContractSafety(
  rpc: Pick<NearRpc, 'viewAccount' | 'viewAccessKeyList'>,
  opts: ContractSafetyOptions = {},
): ContractSafetySource {
  const now = opts.now ?? (() => Date.now());
  const ttlMs = opts.ttlMs ?? 5 * 60_000;
  const errorTtlMs = opts.errorTtlMs ?? 30_000;
  const cache = new Map<string, { at: number; value: ContractSafety | null }>();

  return {
    async inspect(mint) {
      const cached = cache.get(mint);
      if (cached && now() - cached.at < (cached.value === null ? errorTtlMs : ttlMs)) return cached.value;

      let value: ContractSafety | null = null;
      try {
        const account = await rpc.viewAccount(mint);
        if (!hasDeployedCode(account)) {
          value = { status: 'NOT_CONTRACT', fullAccessKeys: null, functionCallKeys: null };
        } else {
          try {
            const list = await rpc.viewAccessKeyList(mint);
            let fullAccessKeys = 0, functionCallKeys = 0;
            for (const key of list.keys) {
              if (key.access_key.permission === 'FullAccess') fullAccessKeys++;
              else functionCallKeys++;
            }
            value = { status: 'CONTRACT', fullAccessKeys, functionCallKeys };
          } catch {
            value = { status: 'CONTRACT', fullAccessKeys: null, functionCallKeys: null };
          }
        }
      } catch (error) {
        if (error instanceof NearRpcError && isMissingAccount(error)) {
          value = { status: 'NOT_FOUND', fullAccessKeys: null, functionCallKeys: null };
        } else {
          value = null;
        }
      }
      cache.set(mint, { at: now(), value });
      return value;
    },
  };
}
