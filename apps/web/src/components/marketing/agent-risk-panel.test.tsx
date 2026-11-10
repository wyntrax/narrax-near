import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {agentRiskCopy} from '@/content/agent-risk';
import {AgentRiskPanel} from './agent-risk-panel';

const pass = {
  mint: 'nearly-993927.nearlytrade.near',
  symbol: 'NEARLY',
  name: 'NEARLY',
  blacklisted: false,
  verdict: 'PASS',
  riskScore: 0,
  flags: [],
  metrics: {
    priceUsd: 0.0006026, marketCapUsd: 602611, liquidityUsd: 103050.68,
    volume24hUsd: 22445.39, at: '2026-11-10T16:31:01.342Z',
  },
  holders: {count: 2680, top10Pct: 19.11, at: '2026-11-10T16:31:01.342Z'},
  fresh: true,
  observedAt: '2026-11-10T16:31:01.342Z',
  riskAt: '2026-11-10T16:31:01.342Z',
  reasons: [],
  policy: {maxRiskScore: 80, metricMaxAgeMs: 900_000, evidenceMaxAgeMs: 3_600_000},
  disclaimer: 'PASS is not a safety guarantee.',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('agent risk panel', () => {
  it('renders a PASS verdict with holder evidence', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(pass), {
      status: 200, headers: {'content-type': 'application/json'},
    }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AgentRiskPanel copy={agentRiskCopy.en}/>);

    await user.type(screen.getByLabelText('NEAR token account id'), pass.mint);
    await user.click(screen.getByRole('button', {name: 'Check token'}));

    await waitFor(() => expect(screen.getByText('PASS')).toBeVisible());
    expect(screen.getByText(/2[,.]?680/)).toBeVisible();
    expect(screen.getByText('19.1%')).toBeVisible();
    expect(screen.getByText('Fresh', {exact: false})).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/agent/risk/nearly-993927.nearlytrade.near'),
      expect.objectContaining({headers: {accept: 'application/json'}}),
    );
  });

  it('rejects an invalid account id without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AgentRiskPanel copy={agentRiskCopy.en}/>);

    await user.type(screen.getByLabelText('NEAR token account id'), 'not an account');
    await user.click(screen.getByRole('button', {name: 'Check token'}));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid NEAR account id.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an UNKNOWN verdict as blocked', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ...pass,
      verdict: 'UNKNOWN',
      riskScore: null,
      flags: [],
      holders: null,
      metrics: null,
      fresh: false,
      observedAt: null,
      riskAt: null,
      reasons: ['TOKEN_NOT_FOUND'],
    }), {status: 200, headers: {'content-type': 'application/json'}})));
    const user = userEvent.setup();
    render(<AgentRiskPanel copy={agentRiskCopy.en}/>);

    await user.type(screen.getByLabelText('NEAR token account id'), 'unknown.near');
    await user.click(screen.getByRole('button', {name: 'Check token'}));

    await waitFor(() => expect(screen.getByText('UNKNOWN')).toBeVisible());
    expect(screen.getByText('Treat as blocked: evidence is missing or stale.')).toBeVisible();
    expect(screen.getByText('TOKEN_NOT_FOUND')).toBeVisible();
  });
});
