import { describe, expect, it } from 'vitest';
import type { AgentPorts } from './ports';
import { findTool, TOOL_NAMES } from './tools';

const ports: AgentPorts = {
  listNarratives: async () => [],
  getNarrative: async () => null,
  listOpportunities: async () => [],
  getToken: async (mint) => ({
    mint,
    symbol: '<script>alert(1)</script>',
    name: 'Untrusted <b>token</b>',
    blacklisted: false,
    metric: null,
    opportunity: null,
  }),
  recentDecisions: async () => [],
  myAlerts: async () => [],
};
const ctx = { userId: 'user-1', now: new Date('2026-11-11T00:00:00Z'), conversationId: null };

describe('research agent tools', () => {
  it('exposes only read-only research tools', () => {
    expect(new Set(TOOL_NAMES)).toEqual(new Set([
      'list_narratives', 'get_narrative', 'list_opportunities', 'get_token', 'get_recent_decisions', 'get_my_alerts',
    ]));
    expect(TOOL_NAMES.some(name => /trade|sign|send|order|wallet|swap|withdraw/i.test(name))).toBe(false);
  });

  it('rejects extra identity and action fields', () => {
    expect(findTool('list_narratives')!.schema.safeParse({ limit: 5, userId: 'attacker' }).success).toBe(false);
    expect(findTool('get_my_alerts')!.schema.safeParse({ userId: 'attacker' }).success).toBe(false);
    expect(findTool('get_token')!.schema.safeParse({ mint: 'not an account' }).success).toBe(false);
    expect(findTool('get_token')!.schema.safeParse({ mint: 'token.near', action: 'BUY' }).success).toBe(false);
  });

  it('keeps token-controlled text out of facts', async () => {
    const out = await findTool('get_token')!.run(ports, ctx, { mint: 'token.near' });
    expect(JSON.stringify(out.facts)).not.toContain('script');
    expect(JSON.stringify(out.facts)).not.toContain('Untrusted');
    expect(out.untrusted).toEqual([
      { untrusted: true, source: 'token.symbol', text: '<script>alert(1)</script>' },
      { untrusted: true, source: 'token.name', text: 'Untrusted <b>token</b>' },
    ]);
  });
});
