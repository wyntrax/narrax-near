export type EnvRole = 'api' | 'worker';

export interface EnvReport {
  /** Problems that stop the process from starting. */
  errors: string[];
  /** Things that are off or risky but do not stop it. Each names a feature that will not work. */
  warnings: string[];
}

type Env = Record<string, string | undefined>;

/**
 * Checks the environment before anything connects to anything. Messages name variables and say what is wrong, and NEVER
 * contain a value: a malformed DATABASE_URL or key would otherwise be printed into logs. An empty value counts as unset,
 * because .env.example ships with empty entries.
 */
export function checkEnv(env: Env, role: EnvRole, options: { runtimeAuth?: boolean } = {}): EnvReport {
  const errors: string[] = [], warnings: string[] = [];
  const get = (k: string) => { const v = env[k]; return v === undefined || v.trim() === '' ? undefined : v.trim(); };
  const prod = get('NODE_ENV') === 'production';
  const parse = (v: string) => { try { return new URL(v); } catch { return null; } };

  const needUrl = (name: string, protocols: string[], required: boolean, label: string) => {
    const v = get(name);
    if (!v) { if (required) errors.push(`${name} is required.`); return null; }
    const u = parse(v);
    if (!u || !protocols.includes(u.protocol)) { errors.push(`${name} must be a ${label} URL.`); return null; }
    return u;
  };
  const bool = (name: string) => { const v = get(name); if (v !== undefined && v !== 'true' && v !== 'false') errors.push(`${name} must be "true" or "false".`); return v === 'true'; };

  needUrl('DATABASE_URL', ['postgres:', 'postgresql:'], true, 'postgres:// or postgresql://');
  needUrl('REDIS_URL', ['redis:', 'rediss:'], true, 'redis:// or rediss://');
  const market = get('MARKET_DATA_ENABLED');
  if (market !== undefined && market !== 'true' && market !== 'false') errors.push('MARKET_DATA_ENABLED must be "true" or "false".');
  for (const n of ['DEXSCREENER_BASE_URL', 'GECKOTERMINAL_BASE_URL', 'AI_BASE_URL', 'NEAR_RPC_URL', 'NEAR_EXPLORER_URL', 'PRIVY_JWKS_URL']) needUrl(n, ['http:', 'https:'], false, 'http:// or https://');

  const nearNetwork = get('NEAR_NETWORK');
  if (nearNetwork !== undefined && !['mainnet', 'testnet'].includes(nearNetwork)) errors.push('NEAR_NETWORK must be "mainnet" or "testnet".');
  const nearRpc = parse(get('NEAR_RPC_URL') ?? '');
  if (nearRpc?.protocol === 'http:' && prod) warnings.push('NEAR_RPC_URL is not https. Chain reads would travel unencrypted.');

  if (!get('AI_PROVIDER_API_KEY')) warnings.push('AI_PROVIDER_API_KEY is not set: opportunity analysis and chat are off.');
  if (role === 'worker' && market === 'false') warnings.push('MARKET_DATA_ENABLED is false: no new prices or holder rows are stored, so research screens will go stale.');

  if (role === 'api') {
    if (!get('PRIVY_APP_ID') && !options.runtimeAuth) errors.push('PRIVY_APP_ID is required.');
    const key = get('PRIVY_VERIFICATION_KEY');
    if (!key && !options.runtimeAuth) errors.push('PRIVY_VERIFICATION_KEY is required.');
    else if (key && !key.includes('PUBLIC KEY')) errors.push('PRIVY_VERIFICATION_KEY must be a PEM public key.');
    const port = get('API_PORT');
    if (port !== undefined && !(/^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) errors.push('API_PORT must be a port number from 1 to 65535.');
    bool('TRUST_PROXY');
    const hsts = bool('HSTS');
    if (prod && !hsts) warnings.push('HSTS is not enabled in production. Set HSTS=true when the API is served over HTTPS.');
    const stream = get('REALTIME_STREAM_KEY');
    if (stream !== undefined && !/^[A-Za-z0-9:_-]{1,100}$/.test(stream)) errors.push('REALTIME_STREAM_KEY may only contain letters, digits, ":", "_" and "-".');

    const origins = get('CORS_ORIGINS');
    if (origins) {
      for (const o of origins.split(',').map((x) => x.trim()).filter(Boolean)) {
        const u = o === '*' ? null : parse(o);
        if (o.includes('*')) errors.push('CORS_ORIGINS may not contain a wildcard. List exact origins.');
        else if (!u || !['http:', 'https:'].includes(u.protocol) || u.origin !== o) errors.push('CORS_ORIGINS entries must be exact origins like https://app.example.com, with no path or trailing slash.');
        else if (prod && u.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(u.hostname)) warnings.push('CORS_ORIGINS lists an http:// origin in production.');
      }
    } else if (prod) warnings.push('CORS_ORIGINS is empty: browsers on other origins are refused. That is right only if the frontend is served from the same origin.');
  }
  return { errors, warnings };
}

/** Runs the checks, prints warnings, and exits with code 1 on any error. Call it first, before any connection is opened. */
export function assertEnv(role: EnvRole, env: Env = process.env, out: Pick<Console, 'error' | 'warn'> = console, exit: (code: number) => never = (c) => process.exit(c), options: { runtimeAuth?: boolean } = {}): void {
  const { errors, warnings } = checkEnv(env, role, options);
  for (const w of warnings) out.warn(`env warning: ${w}`);
  if (errors.length) {
    for (const e of errors) out.error(`env error: ${e}`);
    out.error(`Not starting the ${role}: fix the ${errors.length} problem(s) above. See .env.example.`);
    exit(1);
  }
}
