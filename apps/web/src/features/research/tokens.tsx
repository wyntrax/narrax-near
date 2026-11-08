'use client';
import {useState} from 'react';
import dynamic from 'next/dynamic';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {useResearch,useResearchQuery,hasFeature} from './session';
import {TokensSchema,TokenSchema} from './contracts';
import {pagePath} from './api';
import {usePagination} from './pagination';
import {PageHeading,Section,Metrics,Facts,DataTable,Loading,ResourceError,Locked,Empty,Pager,Stamp,useFormat} from './ui';
import {MarketWatch} from './market-watch';
import {accountExplorerUrl} from '@/lib/explorer';
const TokenPricePanel=dynamic(()=>import('./token-chart'),{loading:Loading});
export function TokensPage(){const t=useTranslations('workspace'),[input,setInput]=useState(''),[search,setSearch]=useState(''),[history,setHistory]=useState(false);return <><PageHeading title={t('tokens')} body={t('trench.tokensBody')}/><form className="research-search" onSubmit={e=>{e.preventDefault();setSearch(input.trim());}}><label htmlFor="token-search">{t('search')}</label><div><input id="token-search" type="search" maxLength={64} value={input} onChange={e=>setInput(e.target.value)}/><button className="research-control" type="submit">{t('searchButton')}</button>{search&&<button className="research-control" type="button" onClick={()=>{setInput('');setSearch('');}}>{t('clear')}</button>}</div></form><MarketWatch search={search}/><button className="research-control" aria-expanded={history} onClick={()=>setHistory(!history)}>{t('trench.history')}</button>{history&&<><p className="research-notice">{t('trench.historyNote')}</p><TokenResults key={search} search={search}/></>}</>;}
function TokenResults({search}:{search:string}){
 const t=useTranslations('workspace'),f=useFormat(),{access}=useResearch(),allowed=hasFeature(access,'research.tokens'),paging=usePagination();
 const query=useResearchQuery(pagePath('tokens',search?{q:search}:{},paging.cursor),TokensSchema,allowed);
 if(!allowed)return <Locked tier={access.features['research.tokens']?.requiredTier}/>;
 if(query.isError)return <ResourceError error={query.error} retry={()=>void query.refetch()}/>;
 if(query.isPending)return <Loading/>;
  return <>{query.data.items.length?<DataTable rowHref={mint=>`/app/tokens/${encodeURIComponent(mint)}`} caption={t('tokens')} headers={[t('token'),t('price'),t('marketCap'),t('liquidity')]} rows={query.data.items.map(token=>({key:token.mint,cells:[<Link key="token" href={`/app/tokens/${encodeURIComponent(token.mint)}`}>{token.symbol}<small>{token.name}</small></Link>,f.usd(token.priceUsd),f.usd(token.marketCapUsd),f.usd(token.liquidityUsd)]}))}/>:<Empty/>}<Pager page={paging.page} previous={paging.previous} next={()=>paging.next(query.data.nextCursor)} canNext={!!query.data.nextCursor}/></>;
}
export function TokenPage({mint}:{mint:string}){
 const t=useTranslations('workspace'),f=useFormat(),{access}=useResearch(),allowed=hasFeature(access,'research.tokens');
  const query=useResearchQuery(`tokens/${encodeURIComponent(mint)}`,TokenSchema,allowed,60000);
 if(!allowed)return <Locked tier={access.features['research.tokens']?.requiredTier}/>;
 if(query.isError)return <ResourceError error={query.error} retry={()=>void query.refetch()}/>;
 if(query.isPending)return <Loading/>;
  const token=query.data,m=token.observation&&!token.observation.stale?token.metrics:null,h=token.holders,r=token.risk;
 const explorer=accountExplorerUrl(token.mint);
 return <><Link className="research-back" href="/app/tokens">← {t('tokens')}</Link><PageHeading title={`${token.symbol} / ${token.name}`}/><p className="token-address"><span>{t('mint')}</span> <code>{token.mint}</code></p><Stamp at={m?.at}/>{token.blacklisted&&<div className="research-notice" role="status"><strong>{t('blacklisted')}</strong><p>{t('blacklistBody')}</p></div>}
  <p className="research-notice">{token.observation?t('trench.sourceDetail',{source:token.observation.source,at:f.date(token.observation.at)}):t('trench.historyNote')}{token.observation?.stale&&` · ${t('trench.stale')}`}</p>
  <Metrics items={[{label:t('price'),value:f.usd(m?.priceUsd)},{label:t(token.observation?.marketCapIsFdv?'trench.fdv':'marketCap'),value:f.usd(m?.marketCapUsd)},{label:t('liquidity'),value:f.usd(m?.liquidityUsd)},{label:t('volume'),value:f.usd(m?.volume24hUsd)}]}/>
  <div className="market-links"><a className="research-control" href={`https://dexscreener.com/near/${encodeURIComponent(token.observation?.pairAddress??token.mint)}`} target="_blank" rel="noopener noreferrer">DEX Screener ↗</a>{explorer&&<a className="research-control" href={explorer} target="_blank" rel="noopener noreferrer">NearBlocks ↗</a>}</div>
  <Section title={t('priceEvents')}><TokenPricePanel token={token}/></Section>
  <details className="research-history"><summary>{t('trench.historicalModels')}</summary><p className="research-notice">{t('trench.historyNote')}</p><div className="research-columns"><Section title={t('holders')}><Facts items={[{label:t('holders'),value:f.number(h?.holders,0)},{label:t('top10'),value:f.number(h?.top10Pct)}]}/><Stamp at={h?.at}/></Section>
 <Section title={t('riskFlags')}><Facts items={[{label:t('risk'),value:f.number(r?.riskScore)}]}/>{!r?<p>{t('unavailable')}</p>:r.flags.length?<ul>{r.flags.map((flag,i)=><li key={i}>{flag}</li>)}</ul>:<p>{t('noFlags')}</p>}<Stamp at={r?.at}/></Section></div>
  </details><Section title={t('relatedNarratives')}>{token.narratives.length?<DataTable caption={t('relatedNarratives')} headers={[t('name'),t('stage'),t('relation'),t('og')]} rows={token.narratives.map(n=>({key:n.slug,cells:[<Link key="name" href={`/app/narratives/${encodeURIComponent(n.slug)}`}>{n.name}</Link>,t(`stages.${n.stage}`),n.relation,f.number(n.ogScore)]}))}/>:<Empty/>}<p className="research-note">{t('ogNote')}</p></Section></>;
}
