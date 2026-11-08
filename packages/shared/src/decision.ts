import { z } from 'zod';
import { DecisionAction, FastClassification } from './enums';

const shortText = (max: number) => z.string().max(max);
const codes = z.array(z.string().regex(/^[A-Z0-9_]{2,48}$/)).max(24);

/** Output of the fast screening model. Always validate before use. */
export const FastAgentOutputSchema = z.object({
  classification: FastClassification,
  score: z.number().min(0).max(100),
  reasonCodes: codes,
  summary: shortText(500),
});
export type FastAgentOutput = z.infer<typeof FastAgentOutputSchema>;

/** Final structured research decision from the deep analysis pipeline. Never trusted until it passes this schema and the deterministic guardrails. */
export const AgentDecisionSchema = z.object({
  action: DecisionAction,
  confidence: z.number().min(0).max(1),
  reasonCodes: codes,
  positiveSignals: z.array(shortText(280)).max(12),
  negativeSignals: z.array(shortText(280)).max(12),
  risks: z.array(shortText(280)).max(12),
  invalidationConditions: z.array(shortText(280)).max(12),
  summary: shortText(1000),
});
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;
