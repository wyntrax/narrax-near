import { ftMetadata, hasDeployedCode, NearRpcError, type NearRpc } from '@narra/near';

export type ContractStatus = 'CONTRACT' | 'NOT_CONTRACT' | 'NOT_FOUND';

export interface ContractSafety {
  status: ContractStatus;
  /** Null means the key list could not be read; it is not zero. */
  fullAccessKeys: number | null;
  functionCallKeys: number | null;
  /** Verified via read-only `ft_metadata`. False means deployed code failed NEP-141 validation; null means RPC failed. */
  nep141?: boolean | null;
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

function rpcErrorText(error: NearRpcError): string {
  const data = error.data;
  const named = data && typeof data === 'object'
    ? data as { name?: unknown; cause?: { name?: unknown } }
    : null;
  let serialized = '';
  if (typeof data === 'string') serialized = data;
  else if (data != null) {
    try { serialized = JSON.stringify(data); } catch { serialized = ''; }
  }
  return [
    error.message,
    serialized,
    typeof named?.name === 'string' ? named.name : '',
    typeof named?.cause?.name === 'string' ? named.cause.name : '',
  ].join(' ');
}

function asNearRpcError(error: unknown): NearRpcError | null {
  if (error instanceof NearRpcError) return error;
  if (error instanceof Error && error.name === 'NearRpcError') return error as NearRpcError;
  return null;
}

function isMissingAccount(error: NearRpcError): boolean {
  // NEAR RPC puts the useful text in error.data ("account ... does not exist while viewing")
  // while the top-level message is often just "Server error".
  return /does not exist|unknown[ _]account/i.test(rpcErrorText(error));
}

function isNonNep141Error(error: unknown): boolean {
  const rpcError = asNearRpcError(error);
  if (!rpcError) return false;
  if (rpcError.code === 'INVALID_METADATA' || rpcError.code === 'INVALID_ACCOUNT') return true;
  if (rpcError.code === 'INVALID_RESPONSE' && /view call/i.test(rpcError.message)) return true;
  return /ContractExecutionError|CONTRACT_EXECUTION_ERROR|MethodNotFound|MethodResolveError|ExecutionError|WasmTrap|HostError|CompilationError|wasm execution failed/i.test(rpcErrorText(rpcError));
}

/**
 * Read-only contract safety facts for the agent risk gate. It never signs, transfers or deploys.
 * A failed RPC call is cached briefly as null and surfaced as UNKNOWN by the caller.
 */
export function createContractSafety(
  rpc: Pick<NearRpc, 'viewAccount' | 'viewAccessKeyList'> & Partial<Pick<NearRpc, 'callFunction'>>,
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
          const checkKeys = async (): Promise<{ fullAccessKeys: number | null; functionCallKeys: number | null }> => {
            try {
              const list = await rpc.viewAccessKeyList(mint);
              let fullAccessKeys = 0, functionCallKeys = 0;
              for (const key of list.keys) {
                if (key.access_key.permission === 'FullAccess') fullAccessKeys++;
                else functionCallKeys++;
              }
              return { fullAccessKeys, functionCallKeys };
            } catch {
              return { fullAccessKeys: null, functionCallKeys: null };
            }
          };

          const checkNep141 = async (): Promise<boolean | null | undefined> => {
            if (typeof rpc.callFunction !== 'function') return undefined;
            try {
              await ftMetadata(rpc as NearRpc, mint);
              return true;
            } catch (error) {
              return isNonNep141Error(error) ? false : null;
            }
          };

          const keys = await checkKeys();
          const nep141 = await checkNep141();
          value = {
            status: 'CONTRACT',
            fullAccessKeys: keys.fullAccessKeys,
            functionCallKeys: keys.functionCallKeys,
            ...(nep141 !== undefined ? { nep141 } : {}),
          };
        }
      } catch (error) {
        const rpcError = asNearRpcError(error);
        if (rpcError && isMissingAccount(rpcError)) {
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
