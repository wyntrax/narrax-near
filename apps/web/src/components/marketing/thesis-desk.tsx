'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { ThesisDeskCopy } from '@/content/thesis-desk';

interface PublicThesisNarrative {
  slug: string;
  name: string;
  stage: string;
  score: number;
  velocity: number;
  observedAt: string | null;
  fresh: boolean;
  organicScore: number | null;
  manipulationRisk: number | null;
  linkedTokenCount: number;
}

interface PublicThesisTokenLink {
  slug: string;
  name: string;
  stage: string;
  relation: string;
  ogScore: number;
  matchScore: number;
}

interface PublicThesisToken {
  mint: string;
  symbol: string;
  name: string;
  liquidityUsd: number | null;
  holders: number | null;
  top10Pct: number | null;
  riskScore: number | null;
  flags: string[];
  passesFloors: boolean;
  marketAt: string | null;
  holdersAt: string | null;
  riskAt: string | null;
  marketFresh: boolean;
  holdersFresh: boolean;
  riskFresh: boolean;
  freshness: 'FRESH' | 'STALE' | 'MISSING';
  links: PublicThesisTokenLink[];
}

interface PublicThesisDeskData {
  at: string;
  funnel: {
    activeNarratives: number;
    catalogTokens: number;
    bridgedExcluded: number;
    nativeTokens: number;
    narrativeLinkedTokens: number;
    holderCoveredTokens: number;
    floorPassingTokens: number;
    opportunities24h: number;
  };
  policy: {
    minLiquidityUsd: number;
    minHolders: number;
    maxRiskScore: number;
  };
  narratives: PublicThesisNarrative[];
  tokens: PublicThesisToken[];
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const money = (value: number | null, fallback: string): string => value == null ? fallback : `$${compact.format(value)}`;
const num = (value: number | null, fallback: string): string => value == null ? fallback : Math.round(value).toLocaleString();
const utcDate = (at: string): string => `${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(at))} UTC`;

export function ThesisDeskPanel({ copy }: { copy: ThesisDeskCopy }) {
  const [data, setData] = useState<PublicThesisDeskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`${api}/v1/public-thesis-desk`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json() as PublicThesisDeskData;
      if (!json || !json.funnel || !Array.isArray(json.tokens)) throw new Error('invalid shape');
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="thesis-status" role="status">{copy.loading}</p>;
  }

  if (error || !data) {
    return (
      <div className="thesis-status" role="alert">
        <p>{copy.unavailable}</p>
        <button type="button" className="button button-ghost" onClick={() => void load()}>{copy.retry}</button>
      </div>
    );
  }

  const funnelItems = [
    { label: copy.funnelSteps.activeNarratives, value: data.funnel.activeNarratives },
    { label: copy.funnelSteps.nativeTokens, value: data.funnel.nativeTokens },
    { label: copy.funnelSteps.linked, value: data.funnel.narrativeLinkedTokens },
    { label: copy.funnelSteps.holders, value: data.funnel.holderCoveredTokens },
    { label: copy.funnelSteps.floors, value: data.funnel.floorPassingTokens },
    { label: copy.funnelSteps.opps24h, value: data.funnel.opportunities24h },
  ];

  return (
    <div className="thesis-desk">
      <section className="thesis-block" aria-labelledby="thesis-funnel-title">
        <div className="thesis-block-head">
          <div>
            <h2 id="thesis-funnel-title">{copy.funnelTitle}</h2>
            <p>{copy.funnelIntro}</p>
          </div>
          <span className="badge">{data.funnel.bridgedExcluded} {copy.funnelSteps.bridgedExcluded}</span>
        </div>
        <dl className="thesis-funnel-grid">
          {funnelItems.map(item => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="thesis-block" aria-labelledby="thesis-narratives-title">
        <h2 id="thesis-narratives-title">{copy.narrativesTitle}</h2>
        {data.narratives.length === 0 ? (
          <p className="thesis-empty">{copy.narrativesEmpty}</p>
        ) : (
          <div className="thesis-narratives-grid">
            {data.narratives.map(n => (
              <article className="thesis-narrative-card" key={n.slug}>
                <div className="thesis-narrative-head">
                  <h3>{n.name}</h3>
                  <span className="badge">{n.stage}</span>
                </div>
                <dl className="thesis-narrative-stats">
                  <div><dt>{copy.score}</dt><dd>{num(n.score, copy.unknown)}</dd></div>
                  <div><dt>{copy.velocity}</dt><dd>{n.velocity.toFixed(1)}</dd></div>
                  <div><dt>{copy.organic}</dt><dd>{num(n.organicScore, copy.unknown)}</dd></div>
                  <div><dt>{copy.manipulation}</dt><dd>{num(n.manipulationRisk, copy.unknown)}</dd></div>
                  <div><dt>{copy.linkedCount}</dt><dd>{n.linkedTokenCount}</dd></div>
                </dl>
                <p className="thesis-narrative-observed">
                  {copy.observed}: {n.observedAt ? utcDate(n.observedAt) : copy.unknown}
                  {!n.fresh && ` · ${copy.stale}`}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="thesis-block" aria-labelledby="thesis-tokens-title">
        <div className="thesis-block-head">
          <div>
            <h2 id="thesis-tokens-title">{copy.tokensTitle}</h2>
            <p>{copy.tokensIntro}</p>
          </div>
          <button type="button" className="button button-ghost" onClick={() => void load()} disabled={loading}>
            {copy.refresh}
          </button>
        </div>

        {data.tokens.length === 0 ? (
          <p className="thesis-empty">{copy.tokensEmpty}</p>
        ) : (
          <div className="thesis-table-wrap">
            <table className="thesis-table">
              <thead>
                <tr>
                  <th>{copy.cols.token}</th>
                  <th>{copy.cols.liquidity}</th>
                  <th>{copy.cols.holders}</th>
                  <th>{copy.cols.top10}</th>
                  <th>{copy.cols.risk}</th>
                  <th>{copy.cols.freshness}</th>
                  <th>{copy.cols.status}</th>
                  <th>{copy.cols.action}</th>
                </tr>
              </thead>
              <tbody>
                {data.tokens.map(token => {
                  const floorText = token.passesFloors
                    ? copy.passFloor
                    : token.holders == null || token.liquidityUsd == null
                      ? copy.missingFloor
                      : copy.belowFloor;
                  const freshnessText = token.freshness === 'FRESH'
                    ? copy.fresh
                    : token.freshness === 'STALE' ? copy.stale : copy.missing;
                  const freshnessTitle = [
                    `Market: ${token.marketAt ? utcDate(token.marketAt) : copy.unknown}`,
                    `Holders: ${token.holdersAt ? utcDate(token.holdersAt) : copy.unknown}`,
                    `Risk: ${token.riskAt ? utcDate(token.riskAt) : copy.unknown}`,
                  ].join(' · ');
                  return (
                    <tr key={token.mint}>
                      <td>
                        <strong>{token.symbol}</strong>
                        <code className="thesis-mint">{token.mint}</code>
                        {token.links.length > 0 && (
                          <span className="thesis-token-rel">
                            {token.links[0]!.name} · {token.links[0]!.relation}
                          </span>
                        )}
                      </td>
                      <td>{money(token.liquidityUsd, copy.unknown)}</td>
                      <td>{token.holders == null ? copy.unknown : token.holders.toLocaleString()}</td>
                      <td>{token.top10Pct == null ? copy.unknown : `${token.top10Pct.toFixed(1)}%`}</td>
                      <td>
                        <span className="thesis-risk-score">{token.riskScore ?? copy.unknown}</span>
                        <span className="thesis-risk-flags">
                          {token.flags.length ? token.flags.join(', ') : copy.noFlags}
                        </span>
                      </td>
                      <td>
                        <span className="thesis-freshness" data-fresh={token.freshness.toLowerCase()} title={freshnessTitle}>
                          {freshnessText}
                        </span>
                        <small className="thesis-freshness-at">
                          {token.marketAt ? utcDate(token.marketAt) : copy.missing}
                        </small>
                      </td>
                      <td>
                        <span className="thesis-floor-pill" data-pass={token.passesFloors ? 'true' : 'false'}>
                          {floorText}
                        </span>
                      </td>
                      <td>
                        <Link className="thesis-gate-link" href={`/agent-risk?mint=${encodeURIComponent(token.mint)}`}>
                          {copy.checkGate}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="thesis-evidence-note">{copy.evidenceNote}</p>
          </div>
        )}
      </section>

      <p className="thesis-fetched">
        {copy.fetchedAt}: <time dateTime={data.at}>{utcDate(data.at)}</time>
      </p>
    </div>
  );
}
