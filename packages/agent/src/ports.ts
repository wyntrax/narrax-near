/**
 * Everything the research agent can read goes through these functions, and every personal query takes the user id
 * from the signed-in session. The model never supplies a user id, and no tool schema has a field for one.
 * There is nothing here that signs, sends, swaps, withdraws, creates an order or touches a wallet.
 */
export interface OpportunityView {
  mint: string; symbol: string; name: string; score: number; narrativeScore: number;
  liquidityScore: number; momentumScore: number; riskScore: number; createdAt: Date;
}
export interface TokenView {
  mint: string; symbol: string; name: string; blacklisted: boolean;
  metric: { priceUsd: number; liquidityUsd: number; volume24hUsd: number; marketCapUsd: number; at: Date } | null;
  opportunity: { score: number; narrativeScore: number; liquidityScore: number; momentumScore: number; riskScore: number; createdAt: Date } | null;
}
export interface NarrativeView {
  slug: string; name: string; stage: string; score: number; velocity: number;
  acceleration: number; organicScore: number; saturationRisk: number;
  summary: string | null; updatedAt: Date;
}
export interface DecisionView {
  id: string; action: string; confidence: number; reasonCodes: string[]; summary: string;
  createdAt: Date; outcome: { label: string; returnPct24h: number | null; isFinal: boolean } | null;
}
export interface AlertView { id: string; kind: string; priority: string; title: string; body: string; createdAt: Date }

export interface AgentPorts {
  listNarratives(limit: number): Promise<NarrativeView[]>;
  getNarrative(slug: string): Promise<NarrativeView | null>;
  listOpportunities(limit: number): Promise<OpportunityView[]>;
  getToken(mint: string): Promise<TokenView | null>;
  recentDecisions(mint: string, limit: number): Promise<DecisionView[]>;
  myAlerts(userId: string, limit: number): Promise<AlertView[]>;
}
