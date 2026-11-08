'use client';
import { PrivyProvider, usePrivy, useIdentityToken } from '@privy-io/react-auth';
import { useMemo, type ReactNode } from 'react';
import { AuthContext } from './context';

function Bridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();
  const value = useMemo(() => ({
    ready, authenticated, userId: user?.id ?? null, login, logout, getAccessToken,
    // Privy signs this token; the API verifies the signature before trusting any email in it. Null when unavailable.
    getIdentityToken: async () => identityToken ?? null,
  }), [ready, authenticated, user?.id, login, logout, getAccessToken, identityToken]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** NEAR-only research build: sign-in is email or Google. No browser wallet connection is requested or stored. */
export default function AuthProvider({ children, appId }: { children: ReactNode; appId: string }) {
  return <PrivyProvider appId={appId} config={{ loginMethods: ['google', 'email'] }}><Bridge>{children}</Bridge></PrivyProvider>;
}
