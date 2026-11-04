/** Minimal JSON-RPC client for the NEAR RPC. No chain SDK, no signing, no side effects. */

export interface NearRpcOptions {
  /** For example https://rpc.testnet.near.org */
  url: string;
  /** Injected in tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface NearRpcErrorBody {
  code?: number | string;
  message?: string;
  data?: unknown;
}

export class NearRpcError extends Error {
  readonly code?: number | string;
  readonly data?: unknown;

  constructor(message: string, code?: number | string, data?: unknown) {
    super(message);
    this.name = 'NearRpcError';
    this.code = code;
    this.data = data;
  }
}

export interface NearViewAccount {
  amount: string;
  locked: string;
  code_hash: string;
  storage_usage: number;
  storage_paid_at?: number;
  block_height: number;
  block_hash: string;
}

export interface NearBlock {
  height: number;
  hash: string;
  timestamp?: number;
}

export interface NearCallResult<T> {
  value: T;
  logs: string[];
  blockHeight: number;
  blockHash: string;
}

interface Envelope<T> {
  jsonrpc?: string;
  id?: unknown;
  result?: T;
  error?: NearRpcErrorBody;
}

interface CallFunctionResponse {
  result: number[];
  logs: string[];
  block_height: number;
  block_hash: string;
}

export class NearRpc {
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;

  constructor(options: NearRpcOptions) {
    if (!/^https?:\/\//.test(options.url)) throw new NearRpcError('NEAR_RPC_URL must be an http:// or https:// URL', 'INVALID_URL');
    this.url = options.url;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.headers = options.headers ?? {};
  }

  /** Send one JSON-RPC request. Errors from the node and transport errors both become NearRpcError. */
  async call<T>(method: string, params: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.headers },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'narrax', method, params }),
        signal: this.timeoutMs > 0 ? AbortSignal.timeout(this.timeoutMs) : undefined,
      });
    } catch (error) {
      throw new NearRpcError(`NEAR RPC request failed: ${error instanceof Error ? error.message : 'unknown error'}`, 'TRANSPORT');
    }

    if (!response.ok) throw new NearRpcError(`NEAR RPC returned HTTP ${response.status}`, response.status);

    let body: Envelope<T>;
    try {
      body = (await response.json()) as Envelope<T>;
    } catch {
      throw new NearRpcError('NEAR RPC returned a non-JSON response', 'INVALID_RESPONSE');
    }

    if (body.error) throw new NearRpcError(body.error.message ?? 'NEAR RPC error', body.error.code, body.error.data);
    if (!('result' in body) || body.result === undefined) throw new NearRpcError('NEAR RPC response has no result', 'INVALID_RESPONSE');
    return body.result;
  }

  /** Latest final block. Useful as a cheap connectivity and freshness probe. */
  async latestBlock(): Promise<NearBlock> {
    const block = await this.call<{ header: { height: number; hash: string; timestamp?: number } }>('block', { finality: 'final' });
    return { height: block.header.height, hash: block.header.hash, timestamp: block.header.timestamp };
  }

  /** Native NEAR balance and storage facts for an account. Amounts are yoctoNEAR strings. */
  async viewAccount(accountId: string): Promise<NearViewAccount> {
    return this.call<NearViewAccount>('query', { request_type: 'view_account', finality: 'final', account_id: accountId });
  }

  /**
   * Call a read-only contract method through `query`. The node returns the method result as raw
   * bytes; NEAR contracts conventionally encode JSON there, which is decoded for the caller.
   */
  async callFunction<T>(contractId: string, methodName: string, args: unknown = {}): Promise<NearCallResult<T>> {
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');
    const response = await this.call<CallFunctionResponse>('query', {
      request_type: 'call_function',
      finality: 'final',
      account_id: contractId,
      method_name: methodName,
      args_base64: argsBase64,
    });
    return {
      value: decodeCallResult<T>(response.result),
      logs: response.logs ?? [],
      blockHeight: response.block_height,
      blockHash: response.block_hash,
    };
  }
}

/** Decode the JSON bytes returned by a view call. Throws instead of returning half-parsed data. */
export function decodeCallResult<T>(bytes: unknown): T {
  if (!Array.isArray(bytes) || bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) {
    throw new NearRpcError('NEAR view call returned malformed bytes', 'INVALID_RESPONSE');
  }
  const text = Buffer.from(bytes as number[]).toString('utf8');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new NearRpcError('NEAR view call returned invalid JSON', 'INVALID_RESPONSE');
  }
}
