import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@narra/database';
import { isNearAccountId } from '@narra/shared';
import { z } from 'zod';
import type { ContractSafety, ContractSafetySource } from './contractSafety';

/** A public, read-only safety verdict for agents that are about to spend. It never holds keys or signs. */
export type AgentRiskVerdict = 'PASS' | 'BLOCK' | 'UNKNOWN';

export const AGENT_RISK_POLICY = {
  /** Matches the research pipeline's own critical-risk threshold. */
  maxRiskScore: 80,
  /** A price older than this is stale, matching the rest of the research surface. */
  metricMaxAgeMs: 15 * 60_000,
  /** Holder and risk rows are refreshed less often than prices. */
  evidenceMaxAgeMs: 60 * 60_000,
} as const;

export const AGENT_RISK_DISCLAIMER =
  'PASS means the latest observation did not cross the critical risk policy; it is not a safety guarantee. Flags and warnings may still be present. UNKNOWN and BLOCK must be treated as blocked by the caller.';

export interface AgentRiskToken {
  mint: string;
  symbol: string;
  name: string;
  blacklisted: boolean;
}

export interface AgentRiskMetric {
  priceUsd: unknown;
  marketCapUsd: unknown;
  liquidityUsd: unknown;
  volume24hUsd: unknown;
  at: Date;
}

export interface AgentRiskHolders {
  holders: number;
  top10Pct: number;
  at: Date;
}

export interface AgentRiskRow {
  riskScore: unknown;
  flags: string[];
  at: Date;
}

export interface AgentRiskInput {
  /** The requested account id, even when no token row exists. */
  mint: string;
  token: AgentRiskToken | null;
  metric: AgentRiskMetric | null;
  holders: AgentRiskHolders | null;
  risk: AgentRiskRow | null;
  /** Undefined means no contract source is configured; null means the check failed. */
  contract?: ContractSafety | null;
  now: Date;
}

export interface AgentRiskResponse {
  mint: string;
  symbol: string | null;
  name: string | null;
  blacklisted: boolean;
  verdict: AgentRiskVerdict;
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
  warnings: string[];
  contract: {
    status: 'CONTRACT' | 'NOT_CONTRACT' | 'NOT_FOUND' | 'UNKNOWN';
    fullAccessKeys: number | null;
    functionCallKeys: number | null;
  } | null;
  policy: {
    maxRiskScore: number;
    metricMaxAgeMs: number;
    evidenceMaxAgeMs: number;
  };
  disclaimer: string;
}

const num = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number((value as { toString(): string }).toString());
  return Number.isFinite(parsed) ? parsed : null;
};

const iso = (at: Date | null | undefined): string | null =>
  at && Number.isFinite(+at) ? at.toISOString() : null;

const fresh = (at: Date | null | undefined, now: Date, maxAgeMs: number): boolean =>
  !!at && Number.isFinite(+at) && +at <= +now && +now - +at <= maxAgeMs;

/**
 * Fail closed: only fresh market, holder and risk evidence can produce PASS. Missing data is UNKNOWN,
 * never a low-risk default. A blacklist is always BLOCK.
 */
export function evaluateAgentRisk(input: AgentRiskInput): AgentRiskResponse {
  const { mint, token, metric, holders, risk, now } = input;
  const contract = input.contract;
  const riskScore = num(risk?.riskScore);
  const flags = risk?.flags ?? [];
  const metricFresh = fresh(metric?.at, now, AGENT_RISK_POLICY.metricMaxAgeMs);
  const evidenceFresh = fresh(risk?.at, now, AGENT_RISK_POLICY.evidenceMaxAgeMs);
  const holderFresh = fresh(holders?.at, now, AGENT_RISK_POLICY.evidenceMaxAgeMs);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let verdict: AgentRiskVerdict = 'PASS';

  if (!token) {
    reasons.push('TOKEN_NOT_FOUND');
    verdict = 'UNKNOWN';
  } else if (token.blacklisted) {
    reasons.push('BLACKLISTED');
    verdict = 'BLOCK';
  } else {
    if (!metric) { reasons.push('MARKET_DATA_UNAVAILABLE'); verdict = 'UNKNOWN'; }
    else if (!metricFresh) { reasons.push('STALE_MARKET_DATA'); verdict = 'UNKNOWN'; }

    if (!risk) { reasons.push('RISK_DATA_UNAVAILABLE'); verdict = 'UNKNOWN'; }
    else if (!evidenceFresh) { reasons.push('STALE_RISK_DATA'); verdict = 'UNKNOWN'; }

    if (!holders) { reasons.push('HOLDER_DATA_UNAVAILABLE'); verdict = 'UNKNOWN'; }
    else if (!holderFresh) { reasons.push('STALE_HOLDER_DATA'); verdict = 'UNKNOWN'; }

    if (contract === null) {
      reasons.push('CONTRACT_CHECK_UNAVAILABLE');
      verdict = 'UNKNOWN';
    } else if (contract?.status === 'NOT_FOUND') {
      reasons.push('TOKEN_CONTRACT_NOT_FOUND');
      verdict = 'BLOCK';
    } else if (contract?.status === 'NOT_CONTRACT') {
      reasons.push('NOT_A_CONTRACT');
      verdict = 'BLOCK';
    } else if (contract?.status === 'CONTRACT') {
      if (contract.fullAccessKeys == null) warnings.push('KEY_LIST_UNAVAILABLE');
      else if (contract.fullAccessKeys > 0) warnings.push('FULL_ACCESS_KEYS');
    }

    if (verdict === 'PASS' && riskScore == null) {
      reasons.push('RISK_SCORE_UNAVAILABLE');
      verdict = 'UNKNOWN';
    }
    if (verdict === 'PASS' && riskScore != null && riskScore >= AGENT_RISK_POLICY.maxRiskScore) {
      reasons.push(`RISK_SCORE_ABOVE_${AGENT_RISK_POLICY.maxRiskScore}`);
      verdict = 'BLOCK';
    }
  }

  return {
    mint: token?.mint ?? mint,
    symbol: token?.symbol ?? null,
    name: token?.name ?? null,
    blacklisted: token?.blacklisted ?? false,
    verdict,
    riskScore,
    flags,
    metrics: metric ? {
      priceUsd: num(metric.priceUsd),
      marketCapUsd: num(metric.marketCapUsd),
      liquidityUsd: num(metric.liquidityUsd),
      volume24hUsd: num(metric.volume24hUsd),
      at: iso(metric.at)!,
    } : null,
    holders: holders ? { count: holders.holders, top10Pct: holders.top10Pct, at: iso(holders.at)! } : null,
    fresh: metricFresh && evidenceFresh && holderFresh,
    observedAt: iso(metric?.at),
    riskAt: iso(risk?.at),
    reasons,
    warnings,
    contract: contract === undefined ? null : contract ?? { status: 'UNKNOWN', fullAccessKeys: null, functionCallKeys: null },
    policy: { ...AGENT_RISK_POLICY },
    disclaimer: AGENT_RISK_DISCLAIMER,
  };
}

/**
 * Public agent risk gate. It reads the same stored observations as the research surface and returns only
 * token-level safety facts: no narratives, wallets, users or private research. Rate-limited and read-only.
 */
export function registerAgentRiskRoutes(
  app: FastifyInstance,
  deps: { db: PrismaClient; contracts?: ContractSafetySource; now?: () => Date },
): void {
  const now = deps.now ?? (() => new Date());
  app.get('/v1/agent/risk/:mint', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const params = z.object({ mint: z.string().min(2).max(64) }).safeParse(request.params);
    if (!params.success || !isNearAccountId(params.data.mint)) {
      return reply.code(400).send({ error: 'INVALID_MINT' });
    }

    const at = now();
    const mint = params.data.mint;
    const token = await deps.db.token.findUnique({
      where: { mint },
      select: {
        mint: true, symbol: true, name: true, blacklisted: true,
        metrics: {
          where: { at: { lte: at } }, orderBy: { at: 'desc' }, take: 1,
          select: { priceUsd: true, marketCapUsd: true, liquidityUsd: true, volume24hUsd: true, at: true },
        },
        holders: {
          where: { at: { lte: at } }, orderBy: { at: 'desc' }, take: 1,
          select: { holders: true, top10Pct: true, at: true },
        },
        risk: {
          where: { at: { lte: at } }, orderBy: { at: 'desc' }, take: 1,
          select: { riskScore: true, flags: true, at: true },
        },
      },
    });

    let contract: ContractSafety | null | undefined;
    if (token && deps.contracts) {
      try {
        contract = await deps.contracts.inspect(mint);
      } catch {
        contract = null;
      }
    }

    reply.header('cache-control', 'no-store');
    return evaluateAgentRisk({
      mint,
      token: token ? { mint: token.mint, symbol: token.symbol, name: token.name, blacklisted: token.blacklisted } : null,
      metric: token?.metrics[0] ?? null,
      holders: token?.holders[0] ?? null,
      risk: token?.risk[0] ?? null,
      contract,
      now: at,
    });
  });
}
