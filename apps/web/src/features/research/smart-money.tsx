'use client';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {mainnetAccountExplorerUrl,mainnetTransactionExplorerUrl} from '@/lib/explorer';
import {useResearch,useResearchQuery,hasFeature} from './session';
import {SmartMoneyWalletsSchema,SmartMoneyFlowsSchema,SmartMoneyWalletDetailSchema,type SmartMoneyWallet} from './contracts';
import {PageHeading,Section,Metrics,DataTable,Loading,ResourceError,Locked,Empty,Stamp,useFormat} from './ui';

const reasonKeys = new Set([
  'TOO_FEW_CLOSED_TRADES','TOO_FEW_CLOSED_TOKENS','SHORT_OBSERVATION','VOLUME_BELOW_MINIMUM',
  'INCOMPLETE_COST_BASIS','NO_SCORE','SCORE_BELOW_MINIMUM','NEGATIVE_PNL','NEGATIVE_MEDIAN_ROI',
]);
const shortAddress = (address: string) => address.length > 22 ? `${address.slice(0, 10)}...${address.slice(-8)}` : address;

export function SmartMoneyPage(){
  const t=useTranslations('workspace'),{access}=useResearch(),allowed=hasFeature(access,'research.smart_money');
  if(!allowed)return <><PageHeading title={t('smartMoney')} body={t('smartMoneyBody')}/><Locked tier={access.features['research.smart_money']?.requiredTier}/></>;
  return <><PageHeading title={t('smartMoney')} body={t('smartMoneyBody')}/><SmartMoneyOverview/></>;
}

function SmartMoneyOverview(){
  const t=useTranslations('workspace'),f=useFormat(),allowed=hasFeature(useResearch().access,'research.smart_money');
  const wallets=useResearchQuery('smart-money/wallets?limit=25',SmartMoneyWalletsSchema,allowed,60000);
  const flows=useResearchQuery('smart-money/flows?window=24h&limit=25',SmartMoneyFlowsSchema,allowed,60000);
  return <>
    <p className="research-notice">{t('smartMoneyNotice')}</p>
    <details className="research-history"><summary>{t('smartMoneyMethod')}</summary><p>{t('smartMoneyMethodBody')}</p><p>{t('smartMoneyMethodCost')}</p><p>{t('smartMoneyMethodEntities')}</p><p>{t('smartMoneyMethodSource')}</p></details>
    {wallets.isError?<ResourceError error={wallets.error} retry={()=>void wallets.refetch()}/>:wallets.isPending?<Loading/>:<>
      <Metrics items={[
        {label:t('smartMoneyTrackedWallets'),value:f.number(wallets.data.summary.trackedWallets,0)},
        {label:t('smartMoneyEligibleWallets'),value:f.number(wallets.data.summary.eligibleWallets,0)},
        {label:t('smartMoneyObservedTrades'),value:f.number(wallets.data.summary.observedTrades,0)},
        {label:t('smartMoneyVolume'),value:f.usd(wallets.data.summary.volumeUsd)},
        {label:t('smartMoneyLastTrade'),value:f.date(wallets.data.summary.lastTradeAt)},
      ]}/>
      <Section title={t('smartMoneyLeaderboard')}>
        {!wallets.data.items.length?<Empty body={t('smartMoneyEmpty')}/>:<DataTable rowHref={address=>`/app/smart-money/${encodeURIComponent(address)}`} caption={t('smartMoneyLeaderboard')} headers={[t('smartMoneyWallet'),t('smartMoneyStatus'),t('smartMoneyScore'),t('smartMoneyPnl'),t('smartMoneyWinRate'),t('smartMoneyClosedTrades'),t('smartMoneyVolume'),t('smartMoneyLastTrade')]} rows={wallets.data.items.map(wallet=>walletRow(wallet,t,f))}/>}
        <p className="research-note">{t('smartMoneyLeaderboardNote')}</p>
      </Section>
    </>}
    <Section title={t('smartMoneyFlows')}>
      {flows.isError?<ResourceError error={flows.error} retry={()=>void flows.refetch()}/>:flows.isPending?<Loading/>:!flows.data.items.length?<Empty body={t('smartMoneyNoFlows')}/>:<><DataTable caption={t('smartMoneyFlows')} headers={[t('smartMoneyToken'),t('smartMoneyNetFlow'),t('smartMoneyBuyVolume'),t('smartMoneySellVolume'),t('smartMoneyBuysSells'),t('smartMoneyWallets'),t('smartMoneyLastTrade')]} rows={flows.data.items.map(flow=>({key:flow.mint,cells:[<Link key="token" href={`/app/tokens/${encodeURIComponent(flow.mint)}`}>{flow.symbol}<small>{flow.name}</small></Link>,f.usd(flow.netFlowUsd),f.usd(flow.buyVolumeUsd),f.usd(flow.sellVolumeUsd),`${flow.buys} / ${flow.sells}`,f.number(flow.walletCount,0),f.date(flow.lastTradeAt)]}))}/><p className="research-note">{t('smartMoneyFlowNote',{from:f.date(flows.data.coverage.observedSince),to:f.date(flows.data.coverage.to)})}{flows.data.coverage.truncated?` ${t('smartMoneyTruncated')}`:''}</p></>}
    </Section>
  </>;
}

function walletRow(wallet:SmartMoneyWallet,t:ReturnType<typeof useTranslations>,f:ReturnType<typeof useFormat>){
  return {key:wallet.address,cells:[
    <Link key="wallet" href={`/app/smart-money/${encodeURIComponent(wallet.address)}`}><code>{shortAddress(wallet.address)}</code><small>{wallet.reasons.length?reasonLabel(wallet.reasons[0]!,t):t('smartMoneyObserved')}</small></Link>,
    statusLabel(wallet.status,t),f.number(wallet.score),f.usd(wallet.realizedPnlUsd),f.percent(wallet.winRate),f.number(wallet.closedTrades,0),f.usd(wallet.volumeUsd),f.date(wallet.lastTradeAt),
  ]};
}

export function SmartMoneyWalletPage({address}:{address:string}){
  const t=useTranslations('workspace'),f=useFormat(),{access}=useResearch(),allowed=hasFeature(access,'research.smart_money');
  const query=useResearchQuery(`smart-money/wallets/${encodeURIComponent(address)}`,SmartMoneyWalletDetailSchema,allowed,60000);
  if(!allowed)return <><PageHeading title={t('smartMoneyWalletPage')} body={t('smartMoneyWalletBody',{address})}/><Locked tier={access.features['research.smart_money']?.requiredTier}/></>;
  if(query.isError)return <ResourceError error={query.error} retry={()=>void query.refetch()}/>;
  if(query.isPending)return <Loading/>;
  const data=query.data,wallet=data.profile,explorer=mainnetAccountExplorerUrl(data.address);
  return <>
    <Link className="research-back" href="/app/smart-money">← {t('smartMoney')}</Link>
    <PageHeading title={shortAddress(data.address)} body={t('smartMoneyWalletBody',{address:data.address})}/>
    <p className="token-address"><span>{t('smartMoneyWalletAddress')}</span> <code>{data.address}</code>{explorer&&<a href={explorer} target="_blank" rel="noopener noreferrer">NearBlocks ↗</a>}</p>
    <p className="research-notice">{t(`smartMoneyStatusBody.${wallet.status}`)}{wallet.reasons.length?` ${t('smartMoneyReasonsLabel')}: ${wallet.reasons.map(reason=>reasonLabel(reason,t)).join(', ')}.`:''}</p>
    <Metrics items={[
      {label:t('smartMoneyStatus'),value:statusLabel(wallet.status,t)},
      {label:t('smartMoneyScore'),value:f.number(wallet.score)},
      {label:t('smartMoneyPnl'),value:f.usd(wallet.realizedPnlUsd)},
      {label:t('smartMoneyWinRate'),value:f.percent(wallet.winRate)},
      {label:t('smartMoneyClosedTrades'),value:f.number(wallet.closedTrades,0)},
      {label:t('smartMoneyVolume'),value:f.usd(wallet.volumeUsd)},
    ]}/>
    <p className="research-note">{t('smartMoneyPeriod',{from:f.date(wallet.observedFrom),to:f.date(wallet.observedTo)})}</p>
    <p className="research-note">{t('smartMoneyCostBasisNote')}</p>
    <details className="research-history"><summary>{t('smartMoneyMethod')}</summary><p>{t('smartMoneyMethodBody')}</p><p>{t('smartMoneyMethodCost')}</p><p>{t('smartMoneyMethodEntities')}</p></details>
    <Section title={t('smartMoneyTokenBreakdown')}>
      {!data.tokenBreakdown.length?<Empty body={t('smartMoneyNoTrades')}/>:<DataTable caption={t('smartMoneyTokenBreakdown')} headers={[t('smartMoneyToken'),t('smartMoneyBuysSells'),t('smartMoneyBuyVolume'),t('smartMoneySellVolume'),t('smartMoneyNetFlow'),t('smartMoneyLastTrade')]} rows={data.tokenBreakdown.map(row=>({key:row.mint,cells:[<Link key="token" href={`/app/tokens/${encodeURIComponent(row.mint)}`}>{row.symbol}<small>{row.name}</small></Link>,`${row.buyCount} / ${row.sellCount}`,f.usd(row.buyVolumeUsd),f.usd(row.sellVolumeUsd),f.usd(row.netFlowUsd),f.date(row.lastTradeAt)]}))}/>}
      {data.coverage.tokenRowsCapped&&<p className="research-note">{t('smartMoneyTokenRowsCapped')}</p>}
    </Section>
    <Section title={t('smartMoneyRecentTrades')}>
      {!data.trades.length?<Empty body={t('smartMoneyNoTrades')}/>:<DataTable caption={t('smartMoneyRecentTrades')} headers={[t('smartMoneyTime'),t('smartMoneySide'),t('smartMoneyToken'),t('smartMoneyAmount'),t('smartMoneyValue'),t('smartMoneyTransaction')]} rows={data.trades.map(trade=>{const tx=mainnetTransactionExplorerUrl(trade.txHash,data.address);return {key:trade.id,cells:[f.date(trade.at),trade.side==='BUY'?t('smartMoneyBuy'):t('smartMoneySell'),<Link key="token" href={`/app/tokens/${encodeURIComponent(trade.token.mint)}`}>{trade.token.symbol}<small>{trade.token.name}</small></Link>,f.number(trade.tokenAmount,4),f.usd(trade.valueUsd),tx?<a key="tx" href={tx} target="_blank" rel="noopener noreferrer">{t('smartMoneyViewTransaction')} ↗</a>:t('unknown')]};})}/>}
      <p className="research-note">{t('smartMoneyTradesNote')}</p>
    </Section>
    <Stamp at={wallet.updatedAt}/>
  </>;
}

function statusLabel(status:SmartMoneyWallet['status'],t:ReturnType<typeof useTranslations>){
  return t(`smartMoneyStatusLabel.${status}`);
}
function reasonLabel(reason:string,t:ReturnType<typeof useTranslations>){
  return t(`smartMoneyReasons.${reasonKeys.has(reason)?reason:'UNKNOWN'}`);
}
