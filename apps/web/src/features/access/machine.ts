import type { Entitlements, PublicStatus } from '@/lib/schemas';
export const STATES = ['signedOut', 'checking', 'inactive', 'joining', 'active', 'disabled', 'full', 'inviteOnly', 'leaving', 'error'] as const;
export type StateName = typeof STATES[number];
export interface AccessState { name: StateName; data?: Entitlements; status?: PublicStatus; error?: string; retryAt?: number; requiredTier?: string }
export type Event =
  | { type: 'SIGN_OUT' } | { type: 'CHECK' }
  | { type: 'LOADED'; data: Entitlements; status?: PublicStatus }
  | { type: 'PUBLIC'; status: PublicStatus }
  | { type: 'JOIN' } | { type: 'JOINED'; data: Entitlements }
  | { type: 'LEAVE' } | { type: 'LEFT'; data: Entitlements }
  | { type: 'FAIL'; error: string; retryAt?: number; requiredTier?: string };

export const TRANSITIONS: Record<Event['type'], readonly StateName[]> = {
  SIGN_OUT: STATES, PUBLIC: STATES, CHECK: STATES, FAIL: STATES,
  LOADED: ['checking', 'leaving'],
  JOIN: ['inactive', 'full', 'inviteOnly', 'error'],
  JOINED: ['joining'],
  LEAVE: ['active'],
  LEFT: ['leaving'],
};

export function resolvedName(data: Entitlements, status?: PublicStatus): StateName {
  if (data.effectiveTier !== 'NONE') return 'active';
  if (status && !status.enabled) return 'disabled';
  if (status?.inviteRequired) return 'inviteOnly';
  if (status?.seatsLeft === 0) return 'full';
  return 'inactive';
}

export function transition(state: AccessState, event: Event): AccessState {
  if (!TRANSITIONS[event.type].includes(state.name)) return state;
  switch (event.type) {
    case 'SIGN_OUT': return { name: 'signedOut', status: state.status };
    case 'PUBLIC': return { ...state, status: event.status };
    case 'CHECK': return { ...state, name: 'checking', error: undefined };
    case 'LOADED': return { name: resolvedName(event.data, event.status ?? state.status), data: event.data, status: event.status ?? state.status };
    case 'JOIN': return { ...state, name: 'joining', error: undefined };
    case 'JOINED': return { ...state, name: resolvedName(event.data, state.status), data: event.data };
    case 'LEAVE': return { ...state, name: 'leaving', error: undefined };
    case 'LEFT': return { ...state, name: resolvedName(event.data, state.status), data: event.data };
    case 'FAIL': return {
      ...state,
      name: event.error === 'EARLY_ACCESS_DISABLED' || event.error === 'EARLY_ACCESS_CLOSED' ? 'disabled' : event.error === 'EARLY_ACCESS_FULL' ? 'full' : event.error === 'INVITES_UNAVAILABLE' ? 'inviteOnly' : 'error',
      error: event.error, retryAt: event.retryAt, requiredTier: event.requiredTier,
    };
  }
}
export const busyStates: readonly StateName[] = ['checking', 'joining', 'leaving'];
