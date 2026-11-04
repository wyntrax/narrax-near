import {it,expect,vi} from 'vitest';
import type {PrismaClient} from '@narra/database';
import {dataHealth} from './dataHealth';
import {DataHealthSchema} from '../../web/src/features/admin/contracts';
const config=vi.hoisted(()=>({tokenBudget:1000,fastModel:'model-fast',reasoningModel:'model-reason'}));
vi.mock('@narra/worker-pipeline',()=>({aiEnabled:async()=>true,loadAiConfig:async()=>config,tokensUsedToday:async()=>1000}));
const now=new Date('2026-10-18T12:00:00Z'),iso=now.toISOString();
it.each(['gpt-6-luna','gpt-6-sol','','   '])('flags placeholder or empty model %j read-only',async model=>{
 for(const field of ['fastModel','reasoningModel'] as const){
  const previous=config[field];config[field]=model;
  try{const result=await dataHealth(database().db,{},now);expect(result.issues).toContain('AI_MODEL_PLACEHOLDER');expect(result.analysis[field]).toBe(model);}finally{config[field]=previous;}
 }
});
it('does not flag real configured model names',async()=>{expect((await dataHealth(database().db,{},now)).issues).not.toContain('AI_MODEL_PLACEHOLDER');});
function database(){
 const rows=[{key:'health.walletWebhook.receipt',value:{at:iso,items:5,parsed:0,queued:0,skipped:5}},{key:'wallets.syncStatus',value:{at:iso,action:'skipped',desired:2,webhookActive:true,error:'secret-key-and-provider-url'}},{key:'wallet.intelligence.w1',value:{checkedAt:iso,closedTrades:5,observedTrades:10,status:'READY'}},{key:'wallet.history.w1',value:{capped:true}},{key:'research.market.t1',value:{metricId:'m1',at:iso,source:'dexscreener',marketCapIsFdv:false,priceChange1hPct:null,pairAddress:'pool',dexId:null,pairCreatedAt:null}}];
 const db={systemSetting:{findMany:async(q:{where:{key:{in:string[]}}})=>rows.filter(r=>q.where.key.in.includes(r.key))},trackedWallet:{count:async()=>2,findMany:async()=>[{id:'w1'},{id:'w2'}]},walletProfile:{count:async()=>1},walletTrade:{findFirst:async()=>({at:now}),count:async()=>10},token:{count:async(q:{where:{OR?:unknown}})=>q.where.OR?1:2,findMany:async()=>[{id:'t1',mint:'mint1',symbol:'ONE',metrics:[{id:'m1'}]},{id:'t2',mint:'mint2',symbol:'UNKNOWN',metrics:[{id:'m2'}]}]},opportunity:{count:async()=>3}};
 return {db:db as unknown as PrismaClient,rows};
}
it('distinguishes missing computation, unsupported delivery and source-linked price coverage without leaking errors',async()=>{
 const {db}=database();
 const result=await dataHealth(db,{queueCounts:async()=>({'wallet-events':{waiting:1,active:0,failed:0,delayed:0,consumers:0}})},now);
 expect(DataHealthSchema.safeParse(result).success).toBe(true);
 expect(result.issues).toEqual(expect.arrayContaining(['WORKER_MISSING','DELIVERY_UNPARSED','WALLET_COMPUTATION_GAPS','INSUFFICIENT_WALLET_HISTORY','ANALYSIS_BUDGET_EXHAUSTED']));
 expect(result.market).toMatchObject({fresh:1,unverified:1});expect(result.wallets).toMatchObject({profiles:1,withoutProfile:1,missingComputations:1,historyCapped:1});
 expect(JSON.stringify(result)).not.toContain('secret-key');
});
it('reports unavailable queue diagnostics and unknown delivery rather than inventing health',async()=>{
 const {db,rows}=database();rows.splice(0,1);
 const result=await dataHealth(db,{queueCounts:async()=>{throw new Error('secret');}},now);
 expect(result.webhook.lastReceipt).toBeNull();expect(result.queues.every(q=>q.state==='UNKNOWN')).toBe(true);
 expect(result.issues).toContain('QUEUES_UNAVAILABLE');expect(result.issues).toContain('NO_DELIVERY_EVIDENCE');
});
it('separates intentionally disabled pipelines from absent workers',async()=>{
 const {db}=database();const result=await dataHealth(db,{webhookConfigured:false,marketDataEnabled:false,aiProviderConfigured:false},now);
 expect(result.queues.find(q=>q.name==='ai-analysis')?.state).toBe('DISABLED');
 expect(result.queues.find(q=>q.name==='market-data')?.state).toBe('DISABLED');
 expect(result.issues).not.toContain('MARKET_COVERAGE_GAPS');expect(result.issues).toContain('AI_NOT_CONFIGURED');
});
it('flags stale delivery even when webhook sync and scoring are fresh',async()=>{
 const {db,rows}=database();
 Object.assign(rows[0]!.value,{at:new Date(+now-2*3600000).toISOString(),parsed:5,queued:5});
 const result=await dataHealth(db,{},now);
 expect(result.issues).toContain('DELIVERY_STALE');
 expect(result.webhook.lastReceipt?.at).toBe(new Date(+now-2*3600000).toISOString());
 expect((await dataHealth(database().db,{},now)).issues).not.toContain('DELIVERY_STALE');
});
