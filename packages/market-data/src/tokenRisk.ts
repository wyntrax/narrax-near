export interface TokenRiskInputs {
  liquidityUsd: number;
  holders: number | null;
  top10Pct: number | null;
  pairAgeMinutes: number | null;
}

export interface TokenRisk {
  /** 0 to 100, higher is worse. */
  riskScore: number;
  flags: string[];
}

/** Starting values, not validated against outcomes. Each is a named constant so it can be tuned or moved to settings. */
export const RISK_WEIGHTS = {
  top10Over60: 30,
  top10Over40: 15,
  thinLiquidity: 20,
  fewHolders: 15,
  holdersUnknown: 5,
  veryNew: 10,
} as const;
export const RISK_THRESHOLDS = { thinLiquidityUsd: 20_000, fewHolders: 50, veryNewMinutes: 30 } as const;

/**
 * Deterministic risk flags from facts only. Unknown inputs add a flag but never lower the score.
 * A low score means "no known problem", never "safe".
 */
export function tokenRisk(i: TokenRiskInputs): TokenRisk {
  const flags: string[] = [];
  let score = 0;
  const add = (flag: string, points: number) => { flags.push(flag); score += points; };

  if (i.top10Pct != null && i.top10Pct >= 60) add('TOP10_OVER_60', RISK_WEIGHTS.top10Over60);
  else if (i.top10Pct != null && i.top10Pct >= 40) add('TOP10_OVER_40', RISK_WEIGHTS.top10Over40);
  if (i.liquidityUsd < RISK_THRESHOLDS.thinLiquidityUsd) add('THIN_LIQUIDITY', RISK_WEIGHTS.thinLiquidity);
  if (i.holders == null) add('HOLDERS_UNKNOWN', RISK_WEIGHTS.holdersUnknown);
  else if (i.holders < RISK_THRESHOLDS.fewHolders) add('FEW_HOLDERS', RISK_WEIGHTS.fewHolders);
  if (i.pairAgeMinutes != null && i.pairAgeMinutes < RISK_THRESHOLDS.veryNewMinutes) add('VERY_NEW', RISK_WEIGHTS.veryNew);
  if (i.top10Pct == null) flags.push('CONCENTRATION_UNKNOWN');

  return { riskScore: Math.min(100, score), flags };
}
