import { z } from 'zod';

const point = z.string().min(1).max(280);

/** Output of the bull and bear roles. */
export const ArgumentSchema = z.object({
  arguments: z.array(point).min(1).max(6),
  strength: z.number().min(0).max(1),
  keyUncertainties: z.array(point).max(4),
});
export type ArgumentOutput = z.infer<typeof ArgumentSchema>;

export const RiskAgentSchema = z.object({
  risks: z.array(z.object({ code: z.string().regex(/^[A-Z0-9_]{2,48}$/), description: point, severity: z.enum(['LOW', 'MEDIUM', 'HIGH']) })).min(1).max(8),
  maxLossScenario: point,
});
export type RiskOutput = z.infer<typeof RiskAgentSchema>;

export const JudgeSchema = z.object({
  agree: z.boolean(),
  concerns: z.array(point).max(4),
  adjustedConfidence: z.number().min(0).max(1).nullable(),
});
export type JudgeOutput = z.infer<typeof JudgeSchema>;
