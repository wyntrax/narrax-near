import type {Prisma,PrismaClient} from '@narra/database';
type TokenMetric=Prisma.TokenMetricGetPayload<Record<string,never>>;
import {EARLY_OUTCOME_RULES,radarEntry,measureEarlyHorizon,summarizeEarlyRadar,type RadarPoint} from '@narra/analytics';

const HOUR=3600000;
export const EARLY_TRACKING_LIMITS={batch:200,legacyBatch:50,reportRows:5000} as const;
const num=(value:{toString():string}|null|undefined)=>value==null?null:Number(value.toString());
async function point(db:Pick<Prisma.TransactionClient,'systemSetting'>,metric:TokenMetric|null):Promise<RadarPoint|null>{
  if(!metric)return null;
  const metadata=(await db.systemSetting.findUnique({where:{key:`research.market.${metric.tokenId}`}}))?.value as {metricId?:unknown;source?:unknown;marketCapIsFdv?:unknown}|null;
  const exact=metadata?.metricId===metric.id;
  return {id:metric.id,at:metric.at,priceUsd:num(metric.priceUsd),marketCapUsd:num(metric.marketCapUsd),marketCapIsFdv:exact&&typeof metadata?.marketCapIsFdv==='boolean'?metadata.marketCapIsFdv:null,source:exact&&metadata?.source==='dexscreener'?'dexscreener':null};
}
const horizons=(at:Date)=>EARLY_OUTCOME_RULES.horizonsHours.map(horizonHours=>({horizonHours,targetAt:new Date(+at+horizonHours*HOUR),nextCheckAt:new Date(+at+horizonHours*HOUR)}));
type RadarAlertInput={tokenId:string;mint:string;alertedAt:Date;profile:'trencher'|'holder';tier:'WATCH'|'STRONG';route:'NARRATIVE'|'SOCIAL';matchKind:'NAME'|'CONTRACT'|'TICKER_ONLY';score:number;metricId:string;title:string;body:string};

/** Atomically freezes attribution/entry with the alert. No opportunity, decision or trading writes. */
export async function createEarlyRadarAlert(db:PrismaClient,input:RadarAlertInput):Promise<boolean>{
  const kind=input.profile==='trencher'?'EARLY_RADAR_TRENCHER':'EARLY_RADAR_HOLDER';
  return db.$transaction(async tx=>{
    // Serialize both discovery routes for this token/profile, including concurrent workers.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`${kind}:${input.tokenId}`}))`;
    if(await tx.alert.count({where:{kind,refId:input.tokenId,createdAt:{gte:new Date(+input.alertedAt-6*HOUR),lte:input.alertedAt}}}))return false;
    const metric=await tx.tokenMetric.findFirst({where:{id:input.metricId,tokenId:input.tokenId}});
    const entry=radarEntry(await point(tx,metric),input.alertedAt);
    await tx.alert.create({data:{kind,priority:input.tier==='STRONG'?'IMPORTANT':'WATCH',refType:'TOKEN',refId:input.tokenId,title:input.title,body:input.body,createdAt:input.alertedAt,
      earlyRadarOutcome:{create:{tokenId:input.tokenId,mint:input.mint,alertedAt:input.alertedAt,profile:input.profile,tier:input.tier,route:input.route,matchKind:input.matchKind,score:input.score,...entry,measurements:{create:horizons(input.alertedAt)}}},
    }});
    return true;
  });
}

/** Stored observations only. Immutable terminal measurements; missing windows stay explicitly unknown. */
export async function trackEarlyRadarOutcomes(db:PrismaClient,deps:{now?:()=>Date;batch?:number;only?:string[]}={}){
  const now=(deps.now??(()=>new Date()))();
  const summary={legacyRegistered:0,measured:0,observed:0,unknown:0,pending:0};
  const legacy=await db.alert.findMany({where:{kind:{in:['EARLY_RADAR_TRENCHER','EARLY_RADAR_HOLDER']},refType:'TOKEN',refId:{not:null},createdAt:{lte:now},earlyRadarOutcome:null,...(deps.only?{id:{in:deps.only}}:{})},orderBy:[{createdAt:'asc'},{id:'asc'}],take:EARLY_TRACKING_LIMITS.legacyBatch});
  for(const alert of legacy){
    // Never reconstruct route, tier or entry by parsing free text or borrowing today's price.
    await db.earlyRadarOutcome.upsert({where:{alertId:alert.id},update:{},create:{alertId:alert.id,tokenId:alert.refId!,alertedAt:alert.createdAt,profile:alert.kind==='EARLY_RADAR_TRENCHER'?'trencher':'holder',tier:'UNKNOWN',route:'UNKNOWN',matchKind:'UNKNOWN',entryUnknownReason:'LEGACY_NO_SNAPSHOT',measurements:{create:horizons(alert.createdAt)}}});
    summary.legacyRegistered++;
  }
  const due=await db.earlyRadarMeasurement.findMany({where:{status:'PENDING',nextCheckAt:{lte:now},...(deps.only?{outcome:{alertId:{in:deps.only}}}:{})},orderBy:[{nextCheckAt:'asc'},{id:'asc'}],take:Math.min(deps.batch??EARLY_TRACKING_LIMITS.batch,EARLY_TRACKING_LIMITS.batch),include:{outcome:true}});
  for(const row of due){
    const metric=await db.tokenMetric.findFirst({where:{tokenId:row.outcome.tokenId,at:{gte:row.targetAt,lte:new Date(Math.min(+now,+row.targetAt+EARLY_OUTCOME_RULES.horizonToleranceMs))},priceUsd:{gt:0}},orderBy:[{at:'asc'},{id:'asc'}]});
    const measurement=measureEarlyHorizon(row.outcome.entryPriceUsd,row.targetAt,await point(db,metric),now);
    const updated=await db.earlyRadarMeasurement.updateMany({where:{id:row.id,status:'PENDING'},data:{...measurement,measuredAt:now,nextCheckAt:new Date(+now+EARLY_OUTCOME_RULES.recheckMs)}});
    if(!updated.count)continue;
    summary.measured++;
    if(measurement.status==='OBSERVED')summary.observed++;else if(measurement.status==='UNKNOWN')summary.unknown++;else summary.pending++;
  }
  return summary;
}

export async function earlyRadarReport(db:PrismaClient,from:Date,to:Date){
  if(!Number.isFinite(+from)||!Number.isFinite(+to)||+from>+to)throw Error('Invalid report range');
  const where={alertedAt:{gte:from,lte:to}};
  const [total,rows]=await Promise.all([db.earlyRadarOutcome.count({where}),db.earlyRadarOutcome.findMany({where,orderBy:[{alertedAt:'asc'},{id:'asc'}],take:EARLY_TRACKING_LIMITS.reportRows,include:{measurements:true}})]);
  const groups=summarizeEarlyRadar(rows),truncated=total>rows.length;
  if(truncated)for(const group of groups)for(const h of group.horizons){h.returns.sufficient=false;h.returns.note='INSUFFICIENT DATA: report row limit reached; narrow the date range';}
  return {from,to,total,read:rows.length,truncated,groups,caveats:[
    'Gross observed price returns, not executable trades or PnL; fees, liquidity and price impact are not modeled.',
    'Missing prices are unknown, not zero. Delisted and failed tokens may be disproportionately missing (survivorship bias).',
    'Overlapping events are removed within each cohort using the respective 1h, 24h or 7d horizon. Cohorts can still share tokens and are not independent experiments.',
    'Evidence gates require 30 independent known returns across 15 tokens; these unvalidated minimums do not establish predictive power.',
    'Legacy alerts have UNKNOWN attribution and no reconstructed entry. Market cap can be FDV or have unknown basis; inspect frozen measurements.',
  ]};
}
