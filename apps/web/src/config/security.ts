export function contentSecurityPolicy(nonce: string, api: string | undefined, development = false) {
  const origins: string[] = [];
  if (api) { try { const u = new URL(api); if (['http:', 'https:'].includes(u.protocol)) { origins.push(u.origin); u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'; origins.push(u.origin); } } catch { /* Invalid configuration is shown by the client. */ } }
  return ["default-src 'self'", `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    'frame-src https://auth.privy.io https://challenges.cloudflare.com',
    `connect-src 'self' ${origins.join(' ')} https://auth.privy.io https://api.privy.io ${development ? ' ws://localhost:4010' : ''}`,
    "worker-src 'self' blob:", "manifest-src 'self'"].join('; ');
}
