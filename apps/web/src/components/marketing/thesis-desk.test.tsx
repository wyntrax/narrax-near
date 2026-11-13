import {render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ReactNode} from 'react';
import {thesisDeskCopy} from '@/content/thesis-desk';
import {ThesisDeskPanel} from './thesis-desk';

vi.mock('@/i18n/navigation', () => ({
  Link: ({href, children, className}: {href: string; children: ReactNode; className?: string}) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('public thesis desk panel', () => {
  it('renders conversion funnel, narratives, and links to the agent risk gate', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      at: '2026-11-11T12:00:00.000Z',
      funnel: {
        activeNarratives: 2,
        catalogTokens: 29,
        bridgedExcluded: 21,
        nativeTokens: 8,
        narrativeLinkedTokens: 2,
        holderCoveredTokens: 1,
        floorPassingTokens: 1,
        opportunities24h: 1,
      },
      policy: {minLiquidityUsd: 20000, minHolders: 50, maxRiskScore: 80},
      narratives: [
        {
          slug: 'near',
          name: 'Near',
          stage: 'EMERGING',
          score: 72,
          velocity: 4.5,
          observedAt: '2026-11-11T11:30:00.000Z',
          fresh: true,
          organicScore: 81,
          manipulationRisk: 14,
          linkedTokenCount: 2,
        },
      ],
      tokens: [
        {
          mint: 'nearly-993927.nearlytrade.near',
          symbol: 'NEARLY',
          name: 'NEARLY',
          liquidityUsd: 116510,
          holders: 2680,
          top10Pct: 19.1,
          riskScore: 0,
          flags: [],
          passesFloors: true,
          marketAt: '2026-11-11T12:00:00.000Z',
          holdersAt: '2026-11-11T11:30:00.000Z',
          riskAt: '2026-11-11T11:30:00.000Z',
          marketFresh: true,
          holdersFresh: true,
          riskFresh: true,
          freshness: 'FRESH',
          links: [{slug: 'near', name: 'Near', stage: 'EMERGING', relation: 'OG', ogScore: 84, matchScore: 95}],
        },
        {
          mint: 'stale.near',
          symbol: 'STALE',
          name: 'Stale Token',
          liquidityUsd: 100000,
          holders: 100,
          top10Pct: 10,
          riskScore: 10,
          flags: [],
          passesFloors: false,
          marketAt: '2026-11-10T12:00:00.000Z',
          holdersAt: '2026-11-10T12:00:00.000Z',
          riskAt: '2026-11-10T12:00:00.000Z',
          marketFresh: false,
          holdersFresh: false,
          riskFresh: false,
          freshness: 'STALE',
          links: [],
        },
      ],
    }), {status: 200, headers: {'content-type': 'application/json'}})));

    render(<ThesisDeskPanel copy={thesisDeskCopy.en}/>);

    await waitFor(() => expect(screen.getByText('NEARLY')).toBeVisible());
    expect(screen.getByText('21 Bridged assets excluded')).toBeVisible();
    expect(screen.getByText('Meets floors')).toBeVisible();
    expect(screen.getByText('Fresh', {exact: true})).toBeVisible();
    expect(screen.getByText('Stale', {exact: true})).toBeVisible();
    const gateLinks = screen.getAllByRole('link', {name: 'Run risk gate →'});
    expect(gateLinks[0]).toHaveAttribute(
      'href',
      '/agent-risk?mint=nearly-993927.nearlytrade.near',
    );
  });

  it('shows a retry alert when the thesis API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', {status: 503})));
    render(<ThesisDeskPanel copy={thesisDeskCopy.en}/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Thesis desk data is temporarily unavailable');
  });
});
