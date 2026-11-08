'use client';
import { createContext, useContext } from 'react';

export interface AuthAdapter {
  ready: boolean;
  authenticated: boolean;
  userId: string | null;
  login: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  /** Privy identity token, when the SDK exposes one. Used only so the API can read a verified email. */
  getIdentityToken?: () => Promise<string | null>;
}
export const AuthContext = createContext<AuthAdapter | null>(null);
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('Auth provider missing'); return value; }
