import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {NextIntlClientProvider} from 'next-intl';
import messages from '../../../messages/research/en.json';
import site from '../../../messages/en.json';
import {SmartMoneyPage,SmartMoneyWalletPage} from './smart-money';

afterEach(cleanup);
const at='2026-11-08T20:50:05.000Z';
const wallet={address:'alice.near',firstSeenAt:at,lastTradeAt:at,observedFrom:at,observedTo:at,updatedAt:at,tradeCount:12,buyCount:7,sellCount:5,volumeUsd:1250.5,totalBoughtUsd:700,realizedPnlUsd:42.25,closedTrades:5,closedTokens:2,winningTrades:3,losingTrades:2,winRate:0.6,medianRoi:0.12,profitFactor:1.8,maxDrawdown:0.04,score:67.2,status:'QUALIFIED',eligible:true,reasons:[],unmatchedSells:0,excessSellUnits:0};
const wallets={asOf:at,items:[wallet],nextCursor:null,summary:{trackedWallets:1,eligibleWallets:1,observedTrades:12,volumeUsd:1250.5,lastTradeAt:at}};
const flows={asOf:at,window:'24h',items:[{mint:'token.near',symbol:'TKN',name:'Token',buys:5,sells:3,tradeCount:8,buyVolumeUsd:800,sellVolumeUsd:450,netFlowUsd:350,walletCount:1,lastTradeAt:at}],nextCursor:null,coverage:{trades:8,wallets:1,from:'2026-11-07T20:50:05.000Z',to:at,truncated:false,observedSince:at}};
const detail={address:'alice.near',firstSeenAt:at,lastTradeAt:at,profile:wallet,tokenBreakdown:[{mint:'token.near',symbol:'TKN',name:'Token',buyCount:5,sellCount:3,buyVolumeUsd:800,sellVolumeUsd:450,netFlowUsd:350,tradeCount:8,lastTradeAt:at}],trades:[{id:'trade-1',at,side:'BUY',token:{mint:'token.near',symbol:'TKN',name:'Token'},tokenAmount:10,priceUsd:0.5,valueUsd:5,poolAddress:'pool.near',txHash:'tx-1',source:'geckoterminal'}],coverage:{tradesRead:1,tokenRowsRead:1,tokenRowsCapped:false}};

vi.mock('./session',()=>({
  useResearch:()=>({access:{admin:false,features:{'research.smart_money':{requiredTier:'EARLY_ACCESS',allowed:true}}}}),
  hasFeature:(access:{features:Record<string,{allowed:boolean}>},key:string)=>access.features[key]?.allowed===true,
  useResearchQuery:(path:string)=>({data:path.startsWith('smart-money/wallets/')?detail:path.startsWith('smart-money/wallets')?wallets:flows,isError:false,isPending:false,refetch:vi.fn()}),
}));
vi.mock('@/i18n/navigation',()=>({Link:({href,children,...props}:{href:string;children:React.ReactNode})=><a href={href} {...props}>{children}</a>,useRouter:()=>({push:vi.fn()})}));

it('renders observed wallet leaders and token flows without inventing qualified status',()=>{
  render(<NextIntlClientProvider locale="en" messages={{workspace:messages,...site}}><SmartMoneyPage/></NextIntlClientProvider>);
  expect(screen.getByRole('heading',{name:messages.smartMoney})).toBeVisible();
  expect(screen.getByText('alice.near')).toBeVisible();
  expect(screen.getByText(messages.smartMoneyStatusLabel.QUALIFIED)).toBeVisible();
  expect(screen.getByText('TKN')).toBeVisible();
  expect(screen.getByText(messages.smartMoneyMethod)).toBeVisible();
});

it('renders wallet detail with cost-basis and observed trade evidence',()=>{
  render(<NextIntlClientProvider locale="en" messages={{workspace:messages,...site}}><SmartMoneyWalletPage address="alice.near"/></NextIntlClientProvider>);
  expect(screen.getByText(messages.smartMoneyStatusBody.QUALIFIED)).toBeVisible();
  expect(screen.getByRole('heading',{name:messages.smartMoneyTokenBreakdown})).toBeVisible();
  expect(screen.getByRole('heading',{name:messages.smartMoneyRecentTrades})).toBeVisible();
  expect(screen.getByRole('link',{name:/NearBlocks/})).toBeVisible();
});
