# NARRAX evidence snapshot

Generated: 2026-11-11T06:11:28.221Z
Window: 2026-11-04T06:11:28.221Z to 2026-11-11T06:11:28.221Z (7 days)

This is a generated snapshot of the local research database, not a backtest and not a price prediction. No value is hardcoded; missing data stays unknown.

![NARRAX evidence snapshot](./THESIS_EVIDENCE.svg)

## Research universe

| Metric | Value |
| --- | ---: |
| Active narratives | 2 |
| All narratives | 2 |
| Narrative mentions in window | 12 |
| Tokens observed | 28 |
| Tokens with a fresh price | 7 |
| Tokens with fresh holder evidence | 3 |
| Tokens with a fresh risk row | 7 |
| Narrative-token links | 22 |
| Opportunities in window | 3 |
| Early Radar alerts in window | 0 |

## Narrative-to-token conversion

Floors: liquidity >= $20,000 and holders >= 50.

Excluded 19 bridged-asset tokens (*.omft.near, *.omdep.near, *.bridge.near) from this cohort.

| Cohort | Tokens | Share of linked |
| --- | ---: | ---: |
| Linked to a narrative | 2 | 100.0% |
| …with a non-suspicious relation | 2 | 100.0% |
| …with liquidity >= $20,000 | 1 | 50.0% |
| …with >= 50 holders | 1 | 50.0% |
| …with both floors (confirmed) | 1 | 50.0% |
| …confirmed with fresh evidence | 1 | 50.0% |
| …with an opportunity | 1 | 50.0% |
| …with an Early Radar alert | 0 | 0.0% |

Fresh price rows: 1; fresh holder evidence: 1; both fresh: 1.
Median top-10 concentration among linked tokens with holder evidence: 19.1%.

## Early Radar outcomes

No Early Radar alerts in this window. This is a real zero-count, not a missing value.

## Smart money observations

| Metric | Value |
| --- | ---: |
| Wallets observed | 97 |
| Eligible profiles | 0 |
| Trades in window | 1,170 |
| Observed volume in window | $247,827.4 |
| Observation starts | 2026-11-07T21:23:48.000Z |
| Observation ends | 2026-11-11T06:01:54.000Z |

Smart-money history starts when collection starts. The provider feed is a recent window, not a complete archive.

## Collection quality (current snapshot)

Checked: 2026-11-11T06:11:28.221Z. Active narrative links or recent social handoff: 21/21.
Source-backed fresh prices: 2; missing: 19; stale: 0; future: 0; unverified: 0.
Holders: 2 fresh, 19 missing, 0 stale, 0 future. Fresh price + holders: 2.
Risk: 2 fresh, 19 missing, 0 stale, 0 future. Freshness is not a safety verdict.
Published calls in trailing 24h: 0; unknown frozen entry: 0; horizon states: {}.

Counters are repeated scan attempts, not unique tokens or missed calls. Daily totals cover recorded successful runs today (UTC), possibly a partial day. No telemetry means UNKNOWN. This snapshot is not historical attribution or proof of edge.

- market: recent; last 2026-11-11T06:07:19.814Z; UTC-day runs 7; counters {"errors":7,"nearUsd":25.52,"infoCalls":7,"launchesSeen":112,"tokensCreated":6,"metricsWritten":49,"infoUnavailable":4,"riskRowsWritten":7,"tokensWithPrice":49,"tokensConsidered":179,"holderRowsWritten":3,"tokensWithoutData":130,"fdvUsedAsMarketCap":0,"holderFallbackRows":3,"priceCoverage.runs":7,"holderFallbackCalls":7,"price.social.failed":0,"priceOmissions.runs":7,"price.general.failed":0,"price.social.written":0,"price.general.written":25,"price.launches.failed":0,"price.outcomes.failed":0,"price.social.selected":0,"price.unpriced.failed":0,"price.general.selected":25,"price.launches.written":24,"price.outcomes.written":0,"price.unpriced.written":0,"price.launches.selected":27,"price.outcomes.selected":0,"price.unpriced.selected":127,"price.social.unavailable":0,"price.general.unavailable":0,"price.social.notRequested":0,"price.general.notRequested":0,"price.launches.unavailable":3,"price.outcomes.unavailable":0,"price.unpriced.unavailable":127,"price.launches.notRequested":0,"price.outcomes.notRequested":0,"price.unpriced.notRequested":0,"omission.launches.NO_MATCHING_PAIR":3,"omission.unpriced.NO_MATCHING_PAIR":127}
- social: STALE / UNKNOWN; last unknown; UTC-day runs unknown; counters unknown
- narrative: STALE / UNKNOWN; last unknown; UTC-day runs unknown; counters unknown

### Coverage by group (disjoint scanned sample)

| Group | Scanned | Fresh price | Stale price | Missing price | Unverified price | Future price | Fresh price + holders |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| recentSocial | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| narrativeOnly | 21 | 2 | 0 | 19 | 0 | 0 | 2 |

Recent social is the unexpired collector handoff; narrative-only means an active narrative link outside that handoff, not proof of current qualification. Holder/risk freshness measures row age, not completeness or safety. Capped samples are not population estimates.

### Latest market price requests

Run: 2026-11-11T06:07:19.814Z (recent). Excludes the separate NEAR reference-price request.

| Selection group | Selected | Written | No usable snapshot | Request failed | Not requested |
| --- | ---: | ---: | ---: | ---: | ---: |
| outcomes | 0 | 0 | 0 | 0 | 0 |
| social | 0 | 0 | 0 | 0 | 0 |
| launches | 6 | 6 | 0 | 0 | 0 |
| unpriced | 19 | 0 | 19 | 0 | 0 |
| general | 1 | 1 | 0 | 0 | 0 |

Instrumented UTC-day runs: 7 / 7 recorded runs. Partial instrumentation is not full-day coverage. No usable snapshot means a completed request returned none; it does not establish why the provider omitted it.

### Latest omission reasons

- unpriced.NO_MATCHING_PAIR: 19

Reason-instrumented UTC-day runs: 7 / 7. One first blocking reason per omitted token attempt, not every missing field or proof a token does not trade. NO_MATCHING_PAIR means no validated NEAR base-token pair matched; UNSPECIFIED means the source supplied no reason. Failed/unrequested batches have no omission reason.

## Caveats

- Market evidence is mainnet NEAR only; there is no testnet market feed.
- Holder data may come from the NearBlocks fallback. Tokens NearBlocks has not indexed stay unknown.
- Counts are current database rows, not a complete market census.
- Early Radar returns are gross observed price returns, not executable PnL. The analytics report caveats apply in full.
- A missing value is reported as unknown, never as zero.
