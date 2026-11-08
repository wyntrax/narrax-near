'use client';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldCheck, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Card, ConfirmDialog } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';
import { errorKey, ApiError } from '@/lib/api';
import { busyStates, type AccessState } from './machine';

export interface AccessActions { login: () => void; retry: () => void; join: () => void; leave: () => void; logout: () => void }
export function AccessView({ state, actions }: { state: AccessState; actions: AccessActions }) {
  const t = useTranslations('flow'), c = useTranslations('common'), d = useTranslations('design'), errors = useTranslations('errors'), locale = useLocale();
  const busy = busyStates.includes(state.name), disabled = busy || !!state.retryAt && Date.now() < state.retryAt;
  const name = state.name === 'signedOut' && state.status ? (!state.status.enabled ? 'disabled' : state.status.inviteRequired ? 'inviteOnly' : state.status.seatsLeft === 0 ? 'full' : state.name) : state.name;
  return <Card className="access-card" data-access-state={name}><div className="status-icon" aria-hidden>{busy ? <span className="spinner" /> : name === 'active' ? <Check /> : name === 'error' ? <svg viewBox="0 0 40 40"><path d="M7 29 20 6l13 23ZM20 15v6m0 3v2" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg> : <ShieldCheck />}</div>
    <div aria-live="polite" aria-atomic="true"><h2>{name === 'checking' ? c('checking') : t(`states.${name}.title`)}</h2><p className="status-description">{t(`states.${name}.body`)}</p></div>
    {state.error && <div role="alert" className="error-note">{errors(errorKey(new ApiError(state.error)))}{state.requiredTier && <Badge>{state.requiredTier.replace('_', ' ')}</Badge>}{state.retryAt && <p>{t('rateWait')}</p>}</div>}
    {state.name === 'signedOut' && <Button onClick={actions.login}>{d('continue')}<span aria-hidden>→</span></Button>}
    {state.name === 'signedOut' && name !== 'signedOut' && <p className="small-note">{t('existingMember')}</p>}
    {state.name === 'inactive' && <div className="actions centered community-join"><Button disabled={disabled} onClick={actions.join}>{t('join')}</Button></div>}
    {state.name === 'active' && state.data && <><div className="tier-result"><Badge>{state.data.effectiveTier.replace('_', ' ')}</Badge><p>{state.data.nextExpiry ? t('nextExpiry', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.data.nextExpiry)) }) : t('noExpiry')}</p></div><Link className="button button-primary" href="/app">{t('openNarra')} →</Link></>}
    {state.name === 'error' && <Button disabled={disabled} onClick={actions.retry}>{c('retry')}</Button>}
    {state.data?.grants.some(g => g.source === 'EARLY_ACCESS' && g.status === 'ACTIVE') && <ConfirmDialog trigger={t('leave')} title={t('leaveTitle')} description={t('leaveBody')} disabled={disabled} onConfirm={actions.leave} />}
    {!busy && state.name !== 'signedOut' && <div className="session-actions"><button onClick={actions.retry}>{t('refresh')}</button><button onClick={actions.logout}>{t('signOut')}</button></div>}
  </Card>;
}
