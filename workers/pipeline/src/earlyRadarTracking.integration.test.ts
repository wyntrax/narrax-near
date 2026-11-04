import {randomUUID} from 'node:crypto';
import {afterAll,describe,expect,it} from 'vitest';
import {createPrisma} from '@narra/database';
import {assertTestDatabase} from '../../../scripts/test-database';
import {createEarlyRadarAlert,trackEarlyRadarOutcomes,earlyRadarReport} from './earlyRadarTracking';
import {resolveTokens} from './tokenResolution';
import {FixtureMarketData,WSOL_MINT,snapshot} from '@narra/market-data';
import {refreshMarketData} from './marketData';

const url=new URL(process.env.DATABASE_URL??'invalid:');assertTestDatabase(url);
const db=createPrisma(url.toString()),tag=`radar-${randomUUID()}`,at=new Date('2026-10-16T00:00:00Z'),H=3600000;
const tokens:string[]=[],narratives:string[]=[];
async function fixture(){
  const token=await db.token.create({data:{mint:`${tag}-${tokens.length}`,symbol:'RADAR',name:'Radar test',createdOnChainAt:new Date(+at-24*H)}});tokens.push(token.id);
  const metric=await db.tokenMetric.create({data:{tokenId:token.id,priceUsd:1,marketCapUsd:40000,liquidityUsd:12000,volume24hUsd:50000,at}});
  await db.systemSetting.create({data:{key:`research.market.${token.id}`,value:{metricId:metric.id,source:'dexscreener',marketCapIsFdv:false}}});
  return {token,metric,input:{tokenId:token.id,mint:token.mint,alertedAt:at,profile:'trencher' as const,tier:'WATCH' as const,route:'SOCIAL' as const,matchKind:'MINT' as const,score:60,metricId:metric.id,title:'Research alert',body:'Research only'}};
}
async function metrics(tokenId:string,hours:number,priceUsd:number){return db.tokenMetric.create({data:{tokenId,at:new Date(+at+hours*H),priceUsd,marketCapUsd:priceUsd*40000,liquidityUsd:12000,volume24hUsd:50000}});}
afterAll(async()=>{
  await db.alert.deleteMany({where:{refId:{in:[...tokens,...narratives]}}});
  await db.narrative.deleteMany({where:{id:{in:narratives}}});
  await db.token.deleteMany({where:{id:{in:tokens}}});
  await db.systemSetting.deleteMany({where:{key:{in:tokens.map(id=>`research.market.${id}`)}}});
  await db.$disconnect();
});
describe('early radar frozen outcomes on isolated PostgreSQL',()=>{
  it('atomically captures one alert and three horizons across concurrent discovery routes',async()=>{
    const {token,metric,input}=await fixture();
    const results=await Promise.all([createEarlyRadarAlert(db,input),createEarlyRadarAlert(db,{...input,route:'NARRATIVE',matchKind:'NAME'})]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const alerts=await db.alert.findMany({where:{refId:token.id},include:{earlyRadarOutcome:{include:{measurements:true}}}});
    expect(alerts).toHaveLength(1);const o=alerts[0]!.earlyRadarOutcome!;
    expect(o).toMatchObject({entryMetricId:metric.id,entryAt:at,entryPriceUsd:1,entryMarketCapUsd:40000,entryMarketCapIsFdv:false,entrySource:'dexscreener',score:60});
    expect(o.measurements.map(m=>m.horizonHours).sort((a,b)=>a-b)).toEqual([1,24,168]);
    await metrics(token.id,.1,9);
    expect((await db.earlyRadarOutcome.findUniqueOrThrow({where:{id:o.id}})).entryPriceUsd).toBe(1);
  });
  it('measures 1h, 24h and 7d prices/caps without lookahead and leaves terminal results immutable',async()=>{
    const {token,input}=await fixture();await createEarlyRadarAlert(db,input);
    const alert=await db.alert.findFirstOrThrow({where:{refId:token.id}}),only=[alert.id];
    const p1=await metrics(token.id,1,2);await metrics(token.id,24,3);await metrics(token.id,168,.5);
    expect((await trackEarlyRadarOutcomes(db,{only,now:()=>new Date(+at+H-1)})).measured).toBe(0);
    expect((await trackEarlyRadarOutcomes(db,{only,now:()=>new Date(+at+H)})).observed).toBe(1);
    await db.tokenMetric.update({where:{id:p1.id},data:{priceUsd:99}});
    expect((await trackEarlyRadarOutcomes(db,{only,now:()=>new Date(+at+168*H)})).observed).toBe(2);
    const result=await db.earlyRadarOutcome.findUniqueOrThrow({where:{alertId:alert.id},include:{measurements:{orderBy:{horizonHours:'asc'}}}});
    expect(result.measurements.map(m=>[m.horizonHours,m.returnPct,m.marketCapUsd])).toEqual([[1,100,80000],[24,200,120000],[168,-50,20000]]);
    expect((await trackEarlyRadarOutcomes(db,{only,now:()=>new Date(+at+169*H)})).measured).toBe(0);
    expect(await db.opportunity.count({where:{tokenId:token.id}})).toBe(0);
    expect(await db.order.count({where:{tokenId:token.id}})).toBe(0);
    expect(await db.position.count({where:{tokenId:token.id}})).toBe(0);
  });
  it('finalizes unavailable windows as unknown and does not backfill winners later',async()=>{
    const {token,input}=await fixture();await createEarlyRadarAlert(db,{...input,matchKind:'TICKER_ONLY'});
    const alert=await db.alert.findFirstOrThrow({where:{refId:token.id}}),only=[alert.id];
    expect((await trackEarlyRadarOutcomes(db,{only,now:()=>new Date(+at+169*H)})).unknown).toBe(3);
    await metrics(token.id,1,5);await trackEarlyRadarOutcomes(db,{only,now:()=>new Date(+at+170*H)});
    const row=await db.earlyRadarOutcome.findUniqueOrThrow({where:{alertId:alert.id},include:{measurements:true}});
    expect(row.measurements.every(m=>m.returnPct===null&&m.status==='UNKNOWN'&&m.unknownReason==='NO_HORIZON_PRICE')).toBe(true);
    const report=await earlyRadarReport(db,at,at);
    const group=report.groups.find(g=>g.matchKind==='TICKER_ONLY')!;
    expect(group.horizons[0]).toMatchObject({unknown:1,known:0,returns:{sufficient:false,mean:null}});
  });
  it('retains legacy alerts without inventing their original entry, tier or route',async()=>{
    const {token}=await fixture();
    const alert=await db.alert.create({data:{kind:'EARLY_RADAR_HOLDER',priority:'IMPORTANT',title:'old from social buzz',body:'STRONG score 99',refType:'TOKEN',refId:token.id,createdAt:at}});
    await metrics(token.id,1,2);
    await trackEarlyRadarOutcomes(db,{only:[alert.id],now:()=>new Date(+at+2*H)});
    const outcome=await db.earlyRadarOutcome.findUniqueOrThrow({where:{alertId:alert.id},include:{measurements:true}});
    expect(outcome).toMatchObject({profile:'holder',tier:'UNKNOWN',route:'UNKNOWN',entryPriceUsd:null,entryUnknownReason:'LEGACY_NO_SNAPSHOT'});
    expect(outcome.measurements.find(m=>m.horizonHours===1)).toMatchObject({priceUsd:2,marketCapUsd:80000,returnPct:null,status:'UNKNOWN',unknownReason:'NO_ENTRY_PRICE'});
  });
  it('captures narrative-found candidates below the main floors without creating an opportunity',async()=>{
    const {token}=await fixture();const word=`radar${randomUUID().replace(/[^a-z]/g,'')}`;
    await db.token.update({where:{id:token.id},data:{symbol:word.toUpperCase(),name:word}});
    await db.tokenHolderMetric.create({data:{tokenId:token.id,holders:500,top10Pct:20,devHoldingPct:2,smartWalletHolders:5,at}});
    const narrative=await db.narrative.create({data:{name:word,slug:word,stage:'ACCELERATING',score:95,velocity:500,organicScore:95,firstDetectedAt:new Date(+at-24*H)}});narratives.push(narrative.id);
    await resolveTokens(db,at);
    const outcomes=await db.earlyRadarOutcome.findMany({where:{tokenId:token.id}});
    expect(outcomes.length).toBeGreaterThan(0);
    expect(outcomes.every(o=>o.route==='NARRATIVE'&&o.matchKind==='NAME'&&o.entryPriceUsd===1)).toBe(true);
    expect(await db.opportunity.count({where:{tokenId:token.id}})).toBe(0);
  });

  it('keeps pricing a token with an open measurement even when the per-run cap would starve it',async()=>{
    // Two older, plain tokens fill a cap of 2 first (the refresh set is id-ordered). The radar token is created last, so it has the highest id.
    const fillers:{mint:string}[]=[];
    for(let i=0;i<2;i++){
      const t=await db.token.create({data:{mint:`${tag}-fill-${i}`,symbol:'FILL',name:'Filler'}});tokens.push(t.id);fillers.push(t);
      await db.tokenMetric.create({data:{tokenId:t.id,priceUsd:1,marketCapUsd:40000,liquidityUsd:12000,volume24hUsd:50000,at}});
    }
    const {token,input}=await fixture();
    expect(await createEarlyRadarAlert(db,input)).toBe(true);
    // A shared test database keeps older PENDING measurements from earlier runs, and the priority step takes the nearest-due
    // first. Clear them so this token's open measurement is the only one competing, which is what this case is about.
    const outcome=await db.earlyRadarOutcome.findFirstOrThrow({where:{tokenId:token.id}});
    await db.earlyRadarMeasurement.deleteMany({where:{status:'PENDING',outcomeId:{not:outcome.id}}});
    const now=new Date(+at+2*H);
    const quotes=new FixtureMarketData({snapshots:[snapshot(WSOL_MINT,{symbol:'SOL',name:'Wrapped SOL',priceUsd:150}),snapshot(token.mint,{symbol:'RADAR',priceUsd:2,marketCapUsd:80000}),...fillers.map(f=>snapshot(f.mint,{symbol:'FILL',priceUsd:1}))]});
    const summary=await refreshMarketData(db,{quotes,info:null,launches:null},now,{maxTokens:2});
    expect(summary.tokensConsidered).toBeLessThanOrEqual(2);
    // Newly priced at `now`: the open 24h/7d measurements will have a stored price to read.
    expect(await db.tokenMetric.count({where:{tokenId:token.id,at:now}})).toBe(1);
  });
});
