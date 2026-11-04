import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {NextIntlClientProvider} from 'next-intl';
import {afterEach,it,expect,vi} from 'vitest';
import type {ReactNode} from 'react';
import messages from '../../../messages/research/en.json';
import {DataHealthCard} from './data-health-card';
import {DataHealthSchema,type DataHealth} from './contracts';
import type {AdminApi} from './api';
import {ApiError} from '@/lib/api';
vi.mock('@/i18n/navigation',()=>({useRouter:()=>({push:vi.fn()}),Link:({href,children}:{href:string;children:ReactNode})=><a href={href}>{children}</a>}));
vi.mock('@/components/auth/context',()=>({useAuth:()=>({logout:vi.fn()})}));
const at='2026-10-18T12:00:00.000Z';
const fixture:DataHealth={checkedAt:at,issues:['NO_DELIVERY_EVIDENCE','INSUFFICIENT_WALLET_HISTORY'],queues:[{name:'wallet-events',state:'UNKNOWN',counts:null,lastCompletedAt:null,lastFailedAt:null,lastRun:null}],webhook:{configured:true,lastReceipt:null,sync:{at,action:'in_sync',active:true,desired:10,hasError:false}},wallets:{tracked:10,profiles:3,withoutProfile:7,trades30d:1338,lastTradeAt:at,lastComputedAt:at,scanned:10,capped:false,missingComputations:0,staleComputations:0,historyCapped:3},market:{scanned:20,total:20,capped:false,fresh:10,stale:5,unverified:5,lastAt:at,enabled:true,unknownNames:0},analysis:{enabled:true,providerConfigured:true,fastModel:'model-fast',reasoningModel:'model-reason',usedToday:100,budget:1000,recentCandidates:3,recentBelowThreshold:5,olderUnanalyzed:100}};
afterEach(cleanup);
it('shows placeholder-model guidance and the configured model names',async()=>{
 mount(vi.fn(async()=>({...fixture,issues:['AI_MODEL_PLACEHOLDER'],analysis:{...fixture.analysis,fastModel:'gpt-6-luna',reasoningModel:'gpt-6-sol'}})));
 expect(await screen.findByText(/will be rejected by the provider/,{},{timeout:5000})).toHaveTextContent('Admin AI settings');
 expect(screen.getByText('gpt-6-luna / gpt-6-sol')).toBeVisible();
});
function mount(dataHealth:ReturnType<typeof vi.fn>){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});return render(<NextIntlClientProvider locale="en" messages={{workspace:messages}}><QueryClientProvider client={client}><DataHealthCard api={{dataHealth} as unknown as AdminApi} queryKey={['test-health']}/></QueryClientProvider></NextIntlClientProvider>);}
it('shows unknown delivery and partial histories without claiming the webhook is healthy',async()=>{
 expect(DataHealthSchema.safeParse(fixture).success).toBe(true);mount(vi.fn(async()=>fixture));
 expect(await screen.findByRole('heading',{name:'Wallet webhook'},{timeout:5000})).toBeVisible();
 expect(screen.getByText(/No non-empty authenticated webhook delivery/)).toBeVisible();
 expect(screen.getByText(/3 wallets reached their historical scan limit/)).toBeVisible();
 expect(screen.getByText(/Empty probes do not count/)).toBeVisible();
 expect(screen.getByText('wallet-events').closest('tr')).not.toHaveAttribute('tabindex');
});
it('refreshes manually and keeps the last snapshot visibly marked after a failed refresh',async()=>{
 const call=vi.fn().mockResolvedValueOnce(fixture).mockRejectedValueOnce(new ApiError('NETWORK'));mount(call);
 await screen.findByRole('heading',{name:'Wallet webhook'},{timeout:5000});
 fireEvent.click(screen.getByRole('button',{name:'Refresh'}));
 await waitFor(()=>expect(call).toHaveBeenCalledTimes(2));
 expect(await screen.findByText(/Showing the last successful snapshot/,{},{timeout:5000})).toBeVisible();
 expect(screen.getByRole('heading',{name:'Wallet intelligence'})).toBeVisible();
});
