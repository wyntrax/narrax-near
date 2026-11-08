import {describe,it,expect} from 'vitest';
import {OverviewSchema,TokenSchema,AnalysisSchema,OpportunitiesSchema,AlertsSchema,ChatReplySchema,OutcomesSchema,SettingsSchema,SummarySchema} from './contracts';
import {pagePath} from './api';
describe('research data boundaries',()=>{
 it('accepts unlinked opportunities without discarding the overview or weakening narrative validation',()=>{
  const opportunity={id:'o',createdAt:'2026-10-15T12:00:00Z',score:42,scores:{narrative:0,liquidity:20,momentum:10,og:0,risk:30},attentionGrowth:null,priceGrowth:null,token:{mint:'token.near',symbol:'TOKEN',name:'Token',priceUsd:null,marketCapUsd:null,liquidityUsd:null},narrative:null,decision:null};
  expect(OpportunitiesSchema.parse({items:[opportunity],nextCursor:null}).items[0]?.narrative).toBeNull();
  const overview={at:opportunity.createdAt,bar:{nearUsd:null,narrativeHeat:65,counts:{activeNarratives:1,acceleratingNarratives:1,opportunities24h:0}},locked:{overview:false,narratives:false,rotation:false,opportunities:false},strip:{topNarratives:[],hottestOpportunity:opportunity},rotation:null,brief:{generated:'rules',points:[]},me:{unreadAlerts:0}};
  const parsed=OverviewSchema.parse(overview);expect(parsed.bar?.narrativeHeat).toBe(65);expect(parsed.strip.hottestOpportunity?.narrative).toBeNull();
  for(const narrative of [undefined,{}, {name:'Broken',slug:'broken',stage:'INVALID'}])expect(()=>OpportunitiesSchema.parse({items:[{...opportunity,narrative}],nextCursor:null})).toThrow();
  expect(()=>OverviewSchema.parse({...overview,strip:{...overview.strip,hottestOpportunity:{...opportunity,narrative:{name:'Missing slug'}}}})).toThrow();
 });
 it('preserves unavailable data separately from a real zero',()=>{
  const result=TokenSchema.parse({mint:'token.near',symbol:'ZERO',name:'Zero',blacklisted:false,createdOnChainAt:null,metrics:{priceUsd:0,marketCapUsd:null,liquidityUsd:0,volume24hUsd:null,at:'2026-10-12T12:00:00Z'},holders:null,risk:null,narratives:[],secret:'must not leak'});
  expect(result.metrics?.priceUsd).toBe(0);expect(result.metrics?.marketCapUsd).toBeNull();expect(result).not.toHaveProperty('secret');
  expect(()=>TokenSchema.parse({...result,metrics:{...result.metrics,priceUsd:'0'}})).toThrow();
 });
 it('accepts server-filtered overview for NONE without inventing shared research',()=>{
  const value=OverviewSchema.parse({at:'2026-10-12T12:00:00Z',bar:null,locked:{overview:true,narratives:true,rotation:true,opportunities:true},strip:{topNarratives:[],hottestOpportunity:null},rotation:null,brief:{generated:'rules',points:[]},me:{unreadAlerts:3}});
  expect(value.bar).toBeNull();expect(value.me.unreadAlerts).toBe(3);
 });
 it('validates the real structured bull/bear/risk shapes',()=>{
  const value={opportunityId:'o',analyzedAt:'2026-10-12T12:00:00Z',model:'test',bull:{arguments:['evidence'],strength:.6,keyUncertainties:['limited sample']},bear:null,risk:{risks:[{code:'LOW_LIQUIDITY',description:'Thin market',severity:'HIGH'}],maxLossScenario:'Unknown'},decision:{action:'WATCH',confidence:.5,summary:'Wait for evidence'},guardrails:[]};
  expect(AnalysisSchema.parse(value).risk?.risks[0]?.severity).toBe('HIGH');
  expect(()=>AnalysisSchema.parse({...value,decision:{...value.decision,confidence:85}})).toThrow();
 });
 it('encodes filters and opaque cursors without injecting query parameters',()=>{const url=new URL(pagePath('tokens',{q:'A&B #?x=1'},'opaque+/='),'https://example.test/');expect(url.searchParams.get('q')).toBe('A&B #?x=1');expect(url.searchParams.get('cursor')).toBe('opaque+/=');expect(url.searchParams.has('x')).toBe(false);});
});
const described={n:3,distinctTokens:2,mean:1.5,median:1,p10:-2,p90:4,meanCi:null,winRate:0.6,winRateCi:[0.2,0.9],sufficient:false,note:'INSUFFICIENT DATA: 3 events, need at least 30'};
describe('alerts, analytics, settings and chat contracts',()=>{
 it('accepts alerts and rejects an unknown priority or a bad date',()=>{
  const row={id:'n1',alertId:'a1',readAt:null,createdAt:'2026-10-14T10:00:00.000Z',kind:'NEW_NARRATIVE',priority:'WATCH',title:'t',body:'b',refType:null,refId:null};
  expect(AlertsSchema.safeParse({items:[row],nextCursor:null,unreadCount:1}).success).toBe(true);
  expect(AlertsSchema.safeParse({items:[{...row,priority:'URGENT'}],nextCursor:null,unreadCount:1}).success).toBe(false);
  expect(AlertsSchema.safeParse({items:[{...row,createdAt:'yesterday'}],nextCursor:null,unreadCount:1}).success).toBe(false);
  expect(AlertsSchema.safeParse({items:[],nextCursor:null,unreadCount:-1}).success).toBe(false);
 });
 it('accepts an analytics summary that says its evidence is thin',()=>{
  expect(SummarySchema.safeParse({range:{days:30},costPct:2,decisions:{total:6,awaitingMeasurement:1,read:5,independent:3,pending:1,final:2,known:2,unknown:0,unknownRate:0,truncated:false},labels:{WIN:1,LOSS:1,FLAT:0},returns:described,medianLeadTimeSeconds:null,byConfidence:[{label:'0.6 to 0.7',described}],caveats:['Past results do not predict future results.']}).success).toBe(true);
  expect(SummarySchema.safeParse({range:{days:30},costPct:2,returns:described}).success).toBe(false);
 });
 it('accepts outcomes with unmeasured fields as null',()=>{
  expect(OutcomesSchema.safeParse({items:[{decisionId:'d1',action:'BUY',confidence:0.8,decidedAt:'2026-10-14T10:00:00.000Z',token:{mint:'token.near',symbol:'ABC'},label:'UNKNOWN',return1hPct:null,return24hPct:null,maxGainPct:null,maxDrawdownPct:null,leadTimeSeconds:null,isFinal:false,unknownReason:'NO_PRICE'}],nextCursor:null}).success).toBe(true);
 });
 it('accepts settings and rejects an unknown theme',()=>{
  const settings={profile:{displayName:null,timezone:'Asia/Jakarta'},appearance:{theme:'DARK',density:'COMPACT',reducedMotion:false},notifications:{minPriority:'WATCH',mutedKinds:[],mutableKinds:['NEW_NARRATIVE'],alwaysDelivered:['CRITICAL']}};
  expect(SettingsSchema.safeParse(settings).success).toBe(true);
  expect(SettingsSchema.safeParse({...settings,appearance:{...settings.appearance,theme:'NEON'}}).success).toBe(false);
 });
 it('accepts a chat reply without trading proposals',()=>{
  expect(ChatReplySchema.safeParse({conversationId:'c1',reply:{text:'hello',format:'text'},toolsUsed:['list_narratives'],stopReason:'final'}).success).toBe(true);
  expect(ChatReplySchema.safeParse({conversationId:'c1',reply:{},toolsUsed:[],stopReason:'final'}).success).toBe(false);
 });
});
