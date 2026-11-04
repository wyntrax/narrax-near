/** NEAR account id validation (named accounts and 64-character implicit accounts). */

// NIP: 2-64 characters, lowercase a-z, 0-9, and the separators - _ .
// A segment may not start or end with a separator, and separators may not repeat.
const ACCOUNT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

/** True only for a string that NEAR could accept as an account id. Format only: it says nothing about existence. */
export function isNearAccountId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length < 2 || value.length > 64) return false;
  return ACCOUNT_RE.test(value);
}

/** A 64-character hex account id is an implicit account (a public key without a named account). */
export function isImplicitNearAccount(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
