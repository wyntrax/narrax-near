'use client';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, type AuthAdapter } from '@/components/auth/context';
import { ApiError, createApi, errorKey } from '@/lib/api';
import { accessKey, usePublicStatus } from '@/lib/queries';
import { busyStates, transition, type Event } from './machine';
import { AccessView } from './view';

export function AccessFlow() {
  const auth = useAuth();
  // Remount before rendering another identity: snapshots are private to this session.
  return <AccessController key={JSON.stringify([auth.ready, auth.authenticated, auth.userId])} auth={auth} />;
}

function AccessController({ auth }: { auth: AuthAdapter }) {
  const client = useQueryClient(), authRef = useRef(auth); authRef.current = auth;
  // A stable per-mount object makes cleanup ownership explicit, including Strict Mode's setup/cleanup replay.
  const [scope] = useState(() => ({ epoch: 0, pending: false, active: true }));
  const api = useMemo(() => createApi(process.env.NEXT_PUBLIC_API_URL ?? '', () => authRef.current.getAccessToken()), []);
  const publicQuery = usePublicStatus(api);
  const [state, dispatch] = useReducer(transition, { name: 'checking' });
  const stateRef = useRef(state); stateRef.current = state;
  function invalidate() { scope.epoch++; scope.pending = false; }
  function fail(e: unknown) { const error = errorKey(e); dispatch({ type: 'FAIL', error, retryAt: e instanceof ApiError && e.retryAfter ? Date.now() + e.retryAfter * 1000 : undefined, requiredTier: e instanceof ApiError ? e.requiredTier : undefined }); }
  async function run(work: (send: (event: Event) => void, current: () => boolean) => Promise<void>) {
    if (scope.pending || !scope.active) return;
    scope.pending = true;
    const own = scope.epoch, current = () => scope.active && own === scope.epoch;
    const send = (event: Event) => { if (current()) dispatch(event); };
    try { await work(send, current); } catch (e) { if (current()) fail(e); } finally { if (current()) scope.pending = false; }
  }
  async function load(current: () => boolean) {
    if (!current()) return;
    const userId = authRef.current.userId, data = await api.entitlements();
    if (!current()) return;
    if (userId) client.setQueryData(accessKey(userId), data);
    return data;
  }
  function retry() {
    invalidate();
    if (!authRef.current.authenticated) { dispatch({ type: 'SIGN_OUT' }); return; }
    void run(async (send, current) => { send({ type: 'CHECK' }); const [data, status] = await Promise.all([load(current), api.status()]); if (data) send({ type: 'LOADED', data, status }); });
  }
  useEffect(() => { if (publicQuery.data) dispatch({ type: 'PUBLIC', status: publicQuery.data }); }, [publicQuery.data]);
  useLayoutEffect(() => {
    scope.active = true;
    client.removeQueries({ queryKey: ['entitlements'] });
    if (!auth.ready) dispatch({ type: 'CHECK' });
    else if (!auth.authenticated) dispatch({ type: 'SIGN_OUT' });
    else retry();
    return () => { scope.active = false; scope.epoch++; scope.pending = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, scope]);
  useEffect(() => {
    if (!busyStates.includes(state.name)) return;
    const own = scope.epoch;
    const timer = setTimeout(() => { if (scope.active && own === scope.epoch) { scope.epoch++; scope.pending = false; dispatch({ type: 'FAIL', error: 'TIMEOUT' }); } }, state.name === 'checking' ? 10000 : 60000);
    return () => clearTimeout(timer);
  }, [state.name, scope]);
  useEffect(() => { if (!state.retryAt) return; const timer = setTimeout(() => dispatch({ type: 'FAIL', error: state.error ?? 'RATE_LIMITED' }), Math.max(0, state.retryAt - Date.now())); return () => clearTimeout(timer); }, [state.retryAt, state.error]);
  const actions = {
    login: () => auth.login(), retry,
    join: () => { void run(async (send, current) => { send({ type: 'JOIN' }); await api.join(); const data = await load(current); if (!data) return; send({ type: 'JOINED', data }); if (current()) await client.invalidateQueries({ queryKey: ['early-access-status'] }); }); },
    leave: () => { void run(async (send, current) => { send({ type: 'LEAVE' }); await api.leave(); const data = await load(current); if (!data) return; send({ type: 'LEFT', data }); if (current()) await client.invalidateQueries({ queryKey: ['early-access-status'] }); }); },
    logout: () => { invalidate(); const own = scope.epoch; client.removeQueries({ queryKey: ['entitlements'] }); dispatch({ type: 'SIGN_OUT' }); void auth.logout().catch(() => { if (scope.active && own === scope.epoch) fail(new ApiError('NETWORK')); }); },
  };
  return <AccessView state={state} actions={actions} />;
}
