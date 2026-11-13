'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { isNearAccountId } from '@narra/shared';
import type { AgentRiskCopy } from '@/content/agent-risk';

type Verdict = 'PASS' | 'BLOCK' | 'UNKNOWN';

interface AgentRisk {
  mint: string;
  symbol: string | null;
  name: string | null;
  blacklisted: boolean;
  verdict: Verdict;
  riskScore: number | null;
  flags: string[];
  metrics: {
    priceUsd: number | null;
    marketCapUsd: number | null;
    liquidityUsd: number | null;
    volume24hUsd: number | null;
    at: string;
  } | null;
  holders: { count: number; top10Pct: number; at: string } | null;
  fresh: boolean;
  observedAt: string | null;
  riskAt: string | null;
  reasons: string[];
  warnings?: string[];
  contract: {
    status: 'CONTRACT' | 'NOT_CONTRACT' | 'NOT_FOUND' | 'UNKNOWN';
    fullAccessKeys: number | null;
    functionCallKeys: number | null;
    nep141?: boolean | null;
  } | null;
  policy: { maxRiskScore: number; metricMaxAgeMs: number; evidenceMaxAgeMs: number };
  disclaimer: string;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const money = (value: number | null): string => value == null ? '—' : `$${compact.format(value)}`;
const date = (value: string | null): string =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

const nep141Label = (value: boolean | null | undefined, copy: AgentRiskCopy): string => {
  if (value === true) return copy.nep141Status.verified;
  if (value === false) return copy.nep141Status.invalid;
  if (value === null) return copy.nep141Status.unavailable;
  return copy.nep141Status.na;
};

export function AgentRiskPanel({ copy }: { copy: AgentRiskCopy }) {
  const [mint, setMint] = useState('');
  const [result, setResult] = useState<AgentRisk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('mint')?.trim() ?? '';
    if (param && isNearAccountId(param)) {
      setMint(param);
      void check(param);
    }
    // Check ?mint= once on mount when linked from the public thesis desk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(value: string) {
    const trimmed = value.trim();
    if (!isNearAccountId(trimmed)) {
      setError(copy.invalid);
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${api}/v1/agent/risk/${encodeURIComponent(trimmed)}`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as AgentRisk;
      if (!body || !['PASS', 'BLOCK', 'UNKNOWN'].includes(body.verdict)) throw new Error('invalid response');
      setResult(body);
    } catch {
      setError(copy.unavailable);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void check(mint);
  }

  function useExample() {
    setMint(copy.exampleMint);
    void check(copy.exampleMint);
  }

  function runPreset(presetMint: string) {
    setMint(presetMint);
    void check(presetMint);
  }

  const icon = result?.verdict === 'PASS' ? '✓' : result?.verdict === 'BLOCK' ? '✕' : '?';

  return <div className="agent-risk-panel">
    <form className="agent-risk-form" onSubmit={submit}>
      <label htmlFor="agent-risk-mint">{copy.label}</label>
      <div className="agent-risk-row">
        <input
          id="agent-risk-mint"
          name="mint"
          value={mint}
          onChange={event => setMint(event.target.value)}
          placeholder={copy.placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="button button-primary" type="submit" disabled={loading}>
          {loading ? copy.checking : copy.submit}
        </button>
      </div>
      <div className="agent-risk-actions">
        <button className="agent-risk-example" type="button" onClick={useExample} disabled={loading}>
          {copy.example}
        </button>
        <div className="agent-risk-presets" role="group" aria-label={copy.presetsLabel}>
          <span className="agent-risk-presets-label">{copy.presetsLabel}</span>
          {copy.presets.map(preset => (
            <button
              key={preset.id}
              className="agent-risk-preset"
              type="button"
              data-preset={preset.id}
              onClick={() => runPreset(preset.mint)}
              disabled={loading}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <p className="agent-risk-example-note">{copy.exampleNote}</p>
    </form>

    {error && <p className="error-note" role="alert">{error}</p>}

    {result && <section className="agent-risk-verdict" data-verdict={result.verdict} aria-live="polite">
      <div className="agent-risk-verdict-head">
        <span className="agent-risk-verdict-icon" aria-hidden="true">{icon}</span>
        <div>
          <p className="eyebrow">{copy.verdictTitle}</p>
          <h2>{result.verdict}</h2>
        </div>
        <span className="badge">{result.symbol ?? result.mint}</span>
      </div>
      <p>{copy.meaning[result.verdict]}</p>

      <dl className="agent-risk-facts">
        <div><dt>{copy.riskScore}</dt><dd>{result.riskScore ?? copy.none}</dd></div>
        <div><dt>{copy.holders}</dt><dd>{result.holders ? result.holders.count.toLocaleString() : copy.none}</dd></div>
        <div><dt>{copy.top10}</dt><dd>{result.holders ? `${result.holders.top10Pct.toFixed(1)}%` : copy.none}</dd></div>
        <div><dt>{copy.liquidity}</dt><dd>{result.metrics ? money(result.metrics.liquidityUsd) : copy.none}</dd></div>
        <div><dt>{copy.contract}</dt><dd>{result.contract ? copy.contractStatus[result.contract.status] : copy.none}</dd></div>
        <div><dt>{copy.fullAccess}</dt><dd>{result.contract?.fullAccessKeys ?? copy.none}</dd></div>
        <div><dt>{copy.nep141}</dt><dd>{nep141Label(result.contract?.nep141, copy)}</dd></div>
      </dl>

      <div className="agent-risk-flags">
        <h3>{copy.flags}</h3>
        {result.flags.length
          ? <ul>{result.flags.map(flag => <li key={flag}>{flag}</li>)}</ul>
          : <p>{copy.noFlags}</p>}
      </div>

      {(result.warnings?.length ?? 0) > 0 && <div className="agent-risk-flags">
        <h3>{copy.warnings}</h3>
        <ul>{result.warnings?.map(warning => <li key={warning}>{warning}</li>)}</ul>
      </div>}

      {result.reasons.length > 0 && <div className="agent-risk-flags">
        <h3>{copy.reasons}</h3>
        <ul>{result.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      </div>}

      <p className="agent-risk-meta">
        {result.fresh ? copy.fresh : copy.stale} · {copy.observed}: {date(result.observedAt)} · {copy.riskObserved}: {date(result.riskAt)}
      </p>

      <details className="agent-risk-policy">
        <summary>{copy.policy}</summary>
        <dl>
          <div><dt>{copy.maxRisk}</dt><dd>{result.policy.maxRiskScore}</dd></div>
          <div><dt>{copy.priceMaxAge}</dt><dd>{Math.round(result.policy.metricMaxAgeMs / 60_000)} {copy.minutes}</dd></div>
          <div><dt>{copy.evidenceMaxAge}</dt><dd>{Math.round(result.policy.evidenceMaxAgeMs / 60_000)} {copy.minutes}</dd></div>
        </dl>
      </details>

      <p className="agent-risk-disclaimer">{copy.disclaimer}</p>
    </section>}
  </div>;
}
