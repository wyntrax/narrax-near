'use client';
import {useMemo,useRef,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import {useLocale,useTranslations} from 'next-intl';
import {useAuth} from '@/components/auth/context';
import {ApiError} from '@/lib/api';
import {Link} from '@/i18n/navigation';
import {useResearch,useResearchQuery} from '@/features/research/session';
import {Loading,PageHeading,ResourceError} from '@/features/research/ui';
import {createAdminApi,type AdminApi} from './api';
import {effectiveStatus,shortId,toPayload,toSettings,toWindowForm,parseWindowForm,MeSchema,type AdminGrant,type AdminSettings,type AdminStats,type WindowForm} from './contracts';
import {RuntimeCard} from './runtime-card';
import {DataHealthCard} from './data-health-card';
import {FeaturesCard} from './features-card';

const ERROR_KEYS = {
  FORBIDDEN: 'adminErrForbidden', EARLY_ACCESS_DISABLED: 'adminErrDisabled', EARLY_ACCESS_FULL: 'adminErrFull',
  INVALID_INPUT: 'adminErrInvalid', EARLY_ACCESS_CLOSED: 'adminErrClosed', UNAUTHORIZED: 'adminErrSession', RATE_LIMITED: 'adminErrRate',
} as const;
const DAYS = [7, 30, 90, 365];

function useAdmin() {
  const auth = useAuth(), {userId} = useResearch(), token = useRef(auth.getAccessToken), identity = useRef(auth.getIdentityToken);
  token.current = auth.getAccessToken; identity.current = auth.getIdentityToken;
  const api = useMemo(() => createAdminApi(() => token.current(), undefined, undefined, () => identity.current?.() ?? Promise.resolve(null)), []);
  return {api, userId, key: (name: string) => ['admin', userId, name] as const};
}
function useErrorText() {
  const t = useTranslations('workspace');
  return (error: unknown) => {
    const code = error instanceof ApiError ? (error.status === 403 ? 'FORBIDDEN' : error.code) : 'UNKNOWN';
    return code in ERROR_KEYS ? t(ERROR_KEYS[code as keyof typeof ERROR_KEYS]) : `${t('adminErrUnknown')} (${code})`;
  };
}
function useWhen() {
  const locale = useLocale();
  return (iso: string | null) => iso ? new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(iso)) : null;
}

export function AdminPage() {
  const t = useTranslations('workspace'), {api, key} = useAdmin();
  const me = useResearchQuery('me', MeSchema);
  const isAdmin = me.data?.isAdmin === true;
  const settings = useQuery({queryKey: key('settings'), queryFn: () => api.settings(), retry: false, gcTime: 0, enabled: isAdmin});
  const stats = useQuery({queryKey: key('stats'), queryFn: () => api.stats(), retry: false, gcTime: 0, enabled: settings.isSuccess});
  const heading = <PageHeading title={t('adminTitle')} body={t('adminBody')}/>;
  if (me.isPending) return <>{heading}<Loading/></>;
  if (me.isError) return <>{heading}<ResourceError error={me.error} retry={() => void me.refetch()}/></>;
  if (!isAdmin) return <>{heading}<AdminRestricted me={me.data}/></>;
  if (settings.isPending) return <>{heading}<Loading/></>;
  if (settings.isError) {
    if (settings.error instanceof ApiError && settings.error.status === 403) return <>{heading}<AdminRestricted me={me.data}/></>;
    return <>{heading}<ResourceError error={settings.error} retry={() => void settings.refetch()}/></>;
  }
  const current = toSettings(settings.data.items);
  return <div className="admin-page">{heading}
    <AdminOverview settings={current} stats={stats.data}/>
    <Tabs.Root defaultValue="access" className="admin-tabs">
      <Tabs.List className="admin-tab-list" aria-label={t('adminTitle')}>
        <Tabs.Trigger className="admin-tab" value="access">{t('adminTabAccess')}</Tabs.Trigger>
        <Tabs.Trigger className="admin-tab" value="research">{t('adminTabResearch')}</Tabs.Trigger>
        <Tabs.Trigger className="admin-tab" value="runtime">{t('adminTabRuntime')}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content className="admin-tab-panel" value="access">
        <div className="admin-grid">
          <SettingsCard api={api} initial={current} stats={stats.data}/>
          <WindowCard api={api} initial={toWindowForm(settings.data.items)}/>
          <WhitelistCard api={api}/>
        </div>
        <GrantsCard api={api}/>
      </Tabs.Content>
      <Tabs.Content className="admin-tab-panel" value="research">
        <FeaturesCard api={api} items={settings.data.items}/>
        <DataHealthCard api={api} queryKey={key('data-health')}/>
      </Tabs.Content>
      <Tabs.Content className="admin-tab-panel" value="runtime">
        <RuntimeCard api={api} queryKey={key('runtime')}/>
      </Tabs.Content>
    </Tabs.Root>
  </div>;
}

function AdminRestricted({me}: {me?: {isAdmin?: boolean; admin?: {configured: boolean; privyUserId: string; email: string | null}} | undefined}) {
  const t = useTranslations('workspace');
  const value = (input?: string | null) => input && input.length ? input : t('adminNotSet');
  return <div className="research-state" role="alert">
    <h2>{t('adminForbidden')}</h2>
    <p>{t('adminForbiddenHelp')}</p>
    <dl className="admin-identity">
      <div><dt>{t('adminYourId')}</dt><dd className="admin-code" title={me?.admin?.privyUserId}>{value(me?.admin?.privyUserId)}</dd></div>
      <div><dt>{t('adminYourEmail')}</dt><dd className="admin-code" title={me?.admin?.email ?? undefined}>{value(me?.admin?.email)}</dd></div>
    </dl>
    <p className="admin-hint">{t('adminEnvHint')}</p>
    <Link className="research-control" href="/app">{t('adminBack')}</Link>
  </div>;
}

function AdminOverview({settings, stats}: {settings: AdminSettings; stats?: AdminStats}) {
  const t = useTranslations('workspace'), open = settings.enabled;
  const value = (n?: number) => n === undefined ? '—' : n;
  return <section className="admin-overview" aria-label={t('adminOverview')}>
    <div className={`admin-overview-state ${open ? 'is-open' : 'is-closed'}`}>
      <span className="admin-overview-dot" aria-hidden="true"/>
      <div><b>{open ? t('adminStateOpen') : t('adminStateClosed')}</b><small>{open ? t('adminStateOpenHelp') : t('adminStateClosedHelp')}</small></div>
    </div>
    <dl className="admin-metrics">
      <div><dt>{t('adminMetricUsed')}</dt><dd>{value(stats?.occupied)}</dd></div>
      <div><dt>{t('adminMetricAvailable')}</dt><dd>{value(stats?.available)}</dd></div>
      <div><dt>{t('adminMetricCap')}</dt><dd>{value(stats?.cap)}</dd></div>
      <div><dt>{t('adminMetricActive')}</dt><dd>{value(stats?.active)}</dd></div>
    </dl>
  </section>;
}

function SettingsCard({api, initial, stats}: {api: AdminApi; initial: AdminSettings; stats?: AdminStats}) {
  const t = useTranslations('workspace'), text = useErrorText(), client = useQueryClient(), {key} = useAdmin();
  const [form, setForm] = useState({...initial, cap: String(initial.cap)}), [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => api.save(toPayload({...form, cap: Number(form.cap)}), reason.trim()),
    onSuccess: async () => {await client.invalidateQueries({queryKey: key('stats')});},
  });
  const valid = /^\d{1,9}$/.test(form.cap) && reason.trim().length > 0;
  const set = <K extends keyof typeof form>(name: K, value: (typeof form)[K]) => {save.reset(); setForm(current => ({...current, [name]: value}));};
  return <section className="admin-card" aria-labelledby="admin-settings">
    <h2 id="admin-settings">{t('adminSettings')}</h2>
    {stats && <p className="admin-stat" role="status">{t('adminSeats', {occupied: stats.occupied, cap: stats.cap, available: stats.available})}</p>}
    <form onSubmit={event => {event.preventDefault(); if (valid) save.mutate();}} className="admin-form">
      <label className="admin-check"><input type="checkbox" checked={form.enabled} onChange={event => set('enabled', event.target.checked)}/><span><b>{t('adminOpen')}</b><small>{t('adminOpenHelp')}</small></span></label>
      <div className="admin-field"><label htmlFor="admin-cap">{t('adminCap')}</label><input id="admin-cap" inputMode="numeric" value={form.cap} onChange={event => set('cap', event.target.value.trim())} aria-invalid={!/^\d{1,9}$/.test(form.cap)}/></div>
      <p className="admin-hint">{t('featureAccess.enforcement')}</p>
      <label className="admin-check"><input type="checkbox" checked={form.shadow} onChange={event => set('shadow', event.target.checked)}/><span><b>{t('featureAccess.logging')}</b></span></label>
      <div className="admin-field"><label htmlFor="admin-reason">{t('adminReason')}</label><input id="admin-reason" maxLength={300} value={reason} onChange={event => {save.reset(); setReason(event.target.value);}}/></div>
      <div className="admin-actions"><button type="submit" className="research-control admin-primary" disabled={!valid || save.isPending}>{t('adminSave')}</button></div>
      {!valid && <p className="admin-hint" role="status">{!reason.trim() ? t('adminHintReason') : t('adminHintCap')}</p>}
      {save.isSuccess && <p role="status" className="admin-ok">{t('adminSaved')}</p>}
      {save.isError && <p role="alert" className="admin-bad">{text(save.error)}</p>}
    </form>
  </section>;
}

function WindowCard({api, initial}: {api: AdminApi; initial: WindowForm}) {
  const t = useTranslations('workspace'), text = useErrorText();
  const [form, setForm] = useState(initial), [reason, setReason] = useState('');
  const parsed = parseWindowForm(form);
  const save = useMutation({mutationFn: () => {if (!parsed.ok) throw new ApiError('INVALID_INPUT', 400); return api.save(parsed.payload, reason.trim());}});
  const valid = parsed.ok && reason.trim().length > 0;
  const set = <K extends keyof WindowForm>(name: K, value: WindowForm[K]) => {save.reset(); setForm(current => ({...current, [name]: value}));};
  return <section className="admin-card" aria-labelledby="admin-window">
    <h2 id="admin-window">{t('adminWindowTitle')}</h2>
    <p>{t('adminWindowHelp')}</p>
    <form className="admin-form" onSubmit={event => {event.preventDefault(); if (valid) save.mutate();}}>
      <div className="admin-field"><label htmlFor="tier-closes">{t('adminClosesAt')}</label><div className="admin-inline"><input id="tier-closes" type="datetime-local" value={form.closesAt} onChange={event => set('closesAt', event.target.value)}/><button type="button" className="research-control" onClick={() => set('closesAt', '')}>{t('adminNever')}</button></div><small>{t('adminClosesHelp')}</small></div>
      <div className="admin-field"><label htmlFor="tier-days">{t('adminAccessDays')}</label><input id="tier-days" inputMode="numeric" value={form.accessDays} onChange={event => set('accessDays', event.target.value.trim())}/><small>{t('adminAccessDaysHelp')}</small></div>
      <div className="admin-field"><label htmlFor="tier-reason">{t('adminReason')}</label><input id="tier-reason" maxLength={300} value={reason} onChange={event => {save.reset(); setReason(event.target.value);}}/></div>
      <div className="admin-actions"><button type="submit" className="research-control admin-primary" disabled={!valid || save.isPending}>{t('adminSave')}</button></div>
      {save.isSuccess && <p role="status" className="admin-ok">{t('adminSaved')}</p>}
      {save.isError && <p role="alert" className="admin-bad">{text(save.error)}</p>}
    </form>
  </section>;
}

function WhitelistCard({api}: {api: AdminApi}) {
  const t = useTranslations('workspace'), [q, setQ] = useState('');
  const lookup = useMutation({mutationFn: (value: string) => api.lookup(value)}), text = useErrorText();
  return <section className="admin-card" aria-labelledby="admin-whitelist">
    <h2 id="admin-whitelist">{t('adminWhitelist')}</h2>
    <p>{t('adminWhitelistHelp')}</p>
    <form onSubmit={event => {event.preventDefault(); if (q) lookup.mutate(q);}} className="admin-inline">
      <label className="sr-only" htmlFor="admin-find">{t('adminSearch')}</label>
      <input id="admin-find" value={q} placeholder={t('adminSearch')} maxLength={100} onChange={event => setQ(event.target.value.trim())}/>
      <button type="submit" className="research-control" disabled={!q || lookup.isPending}>{t('adminFind')}</button>
    </form>
    {lookup.isError && <p role="alert" className="admin-bad">{text(lookup.error)}</p>}
    {lookup.data && !lookup.data.items.length && <p role="status">{t('adminNoUser')}</p>}
    {lookup.data?.items.map(user => <UserResult key={user.id} api={api} user={user}/>)}
  </section>;
}

function UserResult({api, user}: {api: AdminApi; user: {id: string; email: string | null}}) {
  const t = useTranslations('workspace'), text = useErrorText(), client = useQueryClient(), {key} = useAdmin();
  const [days, setDays] = useState(30), [reason, setReason] = useState('Whitelisted by admin');
  const grant = useMutation({
    mutationFn: () => api.grant(user.id, new Date(Date.now() + days * 86400000).toISOString(), reason.trim()),
    onSuccess: async () => {await client.invalidateQueries({queryKey: key('grants')}); await client.invalidateQueries({queryKey: key('stats')});},
  });
  return <div className="admin-user">
    <p className="admin-mono" title={user.id}>{user.email ?? shortId(user.id)}</p>
    <p className="admin-mono" title={user.id}>{shortId(user.id)}</p>
    <div className="admin-inline">
      <label className="sr-only" htmlFor={`days-${user.id}`}>{t('adminDuration')}</label>
      <select id={`days-${user.id}`} value={days} onChange={event => {grant.reset(); setDays(Number(event.target.value));}}>{DAYS.map(value => <option key={value} value={value}>{t('adminDays', {days: value})}</option>)}</select>
      <button type="button" className="research-control admin-primary" disabled={!reason.trim() || grant.isPending} onClick={() => grant.mutate()}>{t('adminGrant')}</button>
    </div>
    <div className="admin-field"><label htmlFor={`reason-${user.id}`}>{t('adminReason')}</label><input id={`reason-${user.id}`} maxLength={300} value={reason} onChange={event => {grant.reset(); setReason(event.target.value);}}/></div>
    {grant.isSuccess && <p role="status" className="admin-ok">{t('adminGranted')}</p>}
    {grant.isError && <p role="alert" className="admin-bad">{text(grant.error)}</p>}
  </div>;
}

function GrantsCard({api}: {api: AdminApi}) {
  const t = useTranslations('workspace'), when = useWhen(), text = useErrorText(), client = useQueryClient(), {key} = useAdmin();
  const grants = useQuery({queryKey: key('grants'), queryFn: () => api.grants(), retry: false, gcTime: 0});
  const revoke = useMutation({
    mutationFn: (grant: AdminGrant) => api.revoke(grant.userId, grant.id, 'Revoked from the admin page'),
    onSuccess: async () => {await client.invalidateQueries({queryKey: key('grants')}); await client.invalidateQueries({queryKey: key('stats')});},
  });
  return <section className="admin-card admin-wide" aria-labelledby="admin-grants">
    <h2 id="admin-grants">{t('adminGrants')}</h2>
    {grants.isPending && <Loading/>}
    {grants.isError && <ResourceError error={grants.error} retry={() => void grants.refetch()}/>}
    {grants.data && !grants.data.items.length && <p role="status">{t('adminNoGrants')}</p>}
    {grants.data && grants.data.items.length > 0 && <div className="admin-scroll"><table className="admin-table">
      <thead><tr><th scope="col">{t('adminColUser')}</th><th scope="col">{t('adminColSource')}</th><th scope="col">{t('adminColStatus')}</th><th scope="col">{t('adminColUntil')}</th><th scope="col"><span className="sr-only">{t('adminRevoke')}</span></th></tr></thead>
      <tbody>{grants.data.items.map(grant => {const status = effectiveStatus(grant); return <tr key={grant.id}>
        <td className="admin-mono" title={grant.userId}>{grant.email ?? shortId(grant.userId)}</td>
        <td>{grant.source === 'ADMIN' ? t('adminSourceAdmin') : t('adminSourceSelf')}</td>
        <td><span className={`admin-badge admin-${status.toLowerCase()}`}>{status}</span></td>
        <td>{when(grant.validUntil) ?? t('adminNever')}</td>
        <td>{status === 'ACTIVE' && <button type="button" className="research-control" disabled={revoke.isPending} onClick={() => revoke.mutate(grant)}>{t('adminRevoke')}</button>}</td>
      </tr>;})}</tbody>
    </table></div>}
    {revoke.isError && <p role="alert" className="admin-bad">{text(revoke.error)}</p>}
  </section>;
}
