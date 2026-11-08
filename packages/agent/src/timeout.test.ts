import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '@narra/ai';
import { FALLBACK } from './constants';
import { runAgent } from './loop';
import type { AgentPorts } from './ports';

const ports: AgentPorts = {
  listNarratives: async () => [],
  getNarrative: async () => null,
  listOpportunities: async () => [],
  getToken: async () => null,
  recentDecisions: async () => [],
  myAlerts: async () => [],
};

describe('agent turn deadline', () => {
  it('returns a fixed timeout message instead of waiting forever', async () => {
    const llm: LlmProvider = { complete: () => new Promise(() => {}) };
    const result = await runAgent({
      llm, model: 'test', temperature: 0, maxTokens: 100, ports,
      ctx: { userId: 'u', now: new Date(), conversationId: null },
      userMessage: 'What changed?', history: [], timeoutMs: 20,
    });
    expect(result.stopReason).toBe('timeout');
    expect(result.text).toBe(FALLBACK.timeout);
    expect(result.toolsUsed).toEqual([]);
  });
});
