import {render,screen,waitFor} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {NextIntlClientProvider} from 'next-intl';
import messages from '../../../messages/research/en.json';
import {ResearchSnapshot} from './research-snapshot';

vi.mock('@/lib/api', () => ({
  createTransport: () => async () => ({
    at: '2026-11-08T12:00:00.000Z',
    narrativeHeat: 70,
    narrativeSampleSize: 2,
    narrativeAsOf: '2026-11-08T10:00:00.000Z',
    activeNarratives: 7,
    tokensObserved: 42,
    opportunities24h: 9,
    earlyRadar24h: 3,
  }),
}));

describe('landing research snapshot', () => {
  it('renders aggregate counts with source timestamps and no wallet metrics', async () => {
    render(<NextIntlClientProvider locale="en" messages={{workspace: messages, common: {}}}><ResearchSnapshot/></NextIntlClientProvider>);
    await waitFor(() => expect(screen.getByText('42')).toBeVisible());
    expect(screen.getByText('70')).toBeVisible();
    expect(screen.getByText('9')).toBeVisible();
    expect(screen.getByText('7')).toBeVisible();
    expect(screen.getByText(/Oldest observation among the heat sample/)).toBeVisible();
    expect(screen.queryByText(/Tracked wallets/i)).toBeNull();
  });
});
