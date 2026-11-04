import {Queue,Worker} from 'bullmq';
import {createPrisma} from '@narra/database';
import {createRedis,QUEUE_NAMES} from '@narra/queue';
import {DexScreenerSource,GeckoTerminalSource} from '@narra/market-data';
import {refreshMarketData} from './marketData';
import {resolveTokens} from './tokenResolution';
import {attributeNarrativeMentions} from './narrativeTokens';
import {scanSocialTokens} from './socialTokens';
import {SolanaRpc} from '@narra/solana';
import {makeDeveloperHoldingSource} from './developerHoldings';
import {heliusMetadataSource} from './tokenMetadata';

/** Market observations and the research that reads them. No wallet recomputation, fan-out or execution consumers. */
async function main(){
 if(!process.env.DATABASE_URL||!process.env.REDIS_URL)throw Error('Database and Redis configuration required');
 if(process.env.MARKET_DATA_ENABLED==='false')throw Error('Market data is disabled');
 const db=createPrisma(),connection=createRedis(),queue=new Queue(QUEUE_NAMES.marketData,{connection});
 const gecko=new GeckoTerminalSource({baseUrl:process.env.GECKOTERMINAL_BASE_URL});
   const deps={metadata:process.env.HELIUS_RPC_URL?heliusMetadataSource(process.env.HELIUS_RPC_URL):null,developerHoldings:process.env.HELIUS_RPC_URL?makeDeveloperHoldingSource(db,new SolanaRpc({url:process.env.HELIUS_RPC_URL,timeoutMs:15000})):null,quotes:new DexScreenerSource({baseUrl:process.env.DEXSCREENER_BASE_URL}),info:gecko,launches:{name:gecko.name,getNewPools:async()=>{
  const results=await Promise.allSettled([gecko.getNewPools(),gecko.getTrendingPools()]);
  if(results.every(r=>r.status==='rejected'))throw Error('Pool discovery unavailable');
  for(const r of results)if(r.status==='rejected')console.error('One pool discovery source is unavailable');
  return [...new Map(results.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(pool=>[pool.mint,pool])).values()];
 }}};
 let worker:Worker|undefined;
 const close=async()=>{await worker?.close();await queue.close();connection.disconnect();await db.$disconnect();};
 try{
  await db.$connect();await queue.waitUntilReady();
  if((await queue.getWorkers()).length)throw Error('Market consumer already running');
  // Refresh first, then keep narrative-token links current: name matching plus the tokens the narrative's own posts
  // named. Research only; the social scan can create a token row, but only after a market source confirms the mint
  // trades. Nothing here touches orders, positions or execution.
  worker=new Worker(QUEUE_NAMES.marketData,async()=>{const summary=await refreshMarketData(db,deps);let research:unknown='skipped';
    try{research={mentions:await attributeNarrativeMentions(db),tokens:await resolveTokens(db),social:await scanSocialTokens(db,{quotes:deps.quotes})};}
    catch(error){console.error(JSON.stringify({msg:'research_refresh_failed',err:error instanceof Error?error.message:String(error)}));}
    console.log(JSON.stringify({msg:'market_refresh_complete',...summary}));return {summary,research};},{connection,concurrency:1});
  worker.on('error',()=>console.error('Market worker connection error'));worker.on('failed',()=>console.error('Market refresh failed'));
  await worker.waitUntilReady();await queue.upsertJobScheduler('refresh',{every:300000},{name:'refresh',data:{},opts:{attempts:1,removeOnComplete:{count:20},removeOnFail:{count:20}}});
  console.log(JSON.stringify({msg:'market_worker_ready',intervalMs:300000}));
  let stopping=false;const stop=()=>{if(stopping)return;stopping=true;void close().then(()=>process.exit(0));};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 }catch(error){await close();throw error;}
}
main().catch(()=>{console.error('Market worker startup failed; check configuration and existing consumers');process.exitCode=1;});
