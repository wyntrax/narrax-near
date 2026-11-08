import {z} from 'zod';

// Mirrors apps/api/src/{overview,read,alerts,analytics,settings,chat}.ts. Unknown fields are stripped at the boundary.
const number=z.number().finite(),nullable=number.nullable(),date=z.string().datetime({offset:true});
const text=z.string().max(20000);
export const stages=['SEED','EMERGING','ACCELERATING','MAINSTREAM','SATURATED','DECAYING','DEAD'] as const;
export const Stage=z.enum(stages);
const NarrativeRef=z.object({slug:text,name:text,stage:Stage});
export const NarrativeSchema=NarrativeRef.extend({id:text,score:number,velocity:number,acceleration:number,organicScore:number,saturationRisk:number,firstDetectedAt:date,updatedAt:date,tokenCount:z.number().int().nonnegative()});
export type Narrative=z.infer<typeof NarrativeSchema>;
export const TokenRef=z.object({mint:text,symbol:text,name:text});
export const MarketObservation=z.object({source:z.literal('dexscreener'),at:date,stale:z.boolean(),marketCapIsFdv:z.boolean(),priceChange1hPct:nullable,pairAddress:text,dexId:text.nullable(),pairCreatedAt:date.nullable()});
const TokenSummary=TokenRef.extend({priceUsd:nullable,marketCapUsd:nullable,liquidityUsd:nullable,volume24hUsd:nullable.optional(),createdOnChainAt:date.nullable().optional(),observation:MarketObservation.nullish()});
export function pageOf<T extends z.ZodTypeAny>(item:T){return z.object({items:z.array(item),nextCursor:z.string().nullable()});}
export const NarrativesSchema=pageOf(NarrativeSchema);
export const TokensSchema=pageOf(TokenSummary);
export const NarrativeDetailSchema=NarrativeSchema.omit({tokenCount:true}).extend({
 summary:text.nullable(),
 latestMetric:z.object({at:date,mentionVelocity:number,creatorVelocity:number,engagementVelocity:number,manipulationRisk:number}).nullable(),
 creators:z.array(z.object({platform:text,handle:text,role:text})),
 tokens:z.array(TokenRef.extend({relation:text,ogScore:number,confidence:number,marketCapUsd:nullable,liquidityUsd:nullable}))
});
export const OpportunitySchema=z.object({
 id:text,createdAt:date,score:number,
 scores:z.object({narrative:number,liquidity:number,momentum:number,og:number,risk:number}),
 attentionGrowth:nullable,priceGrowth:nullable,token:TokenSummary,narrative:NarrativeRef.nullable(),
 decision:z.object({action:z.enum(['BUY','WATCH','NO_TRADE','REDUCE','SELL','HOLD']),confidence:number.min(0).max(1)}).nullable()
});
export type Opportunity=z.infer<typeof OpportunitySchema>;
export const OpportunitiesSchema=pageOf(OpportunitySchema);
const RotationItem=NarrativeRef.extend({id:text,from:number,to:number,delta:number});
const Rotation=z.object({detected:z.boolean(),window:z.enum(['1h','6h','24h','7d']),falling:z.array(RotationItem),rising:z.array(RotationItem),unknown:z.number().int().nonnegative()});
export const RotationSchema=Rotation.extend({asOf:date,rules:z.object({minDeltaPoints:number,minScoreEitherEnd:number}),note:text});
export const BarSchema=z.object({
 nearUsd:z.object({priceUsd:number.positive(),at:date,stale:z.boolean()}).nullable(),
 narrativeHeat:nullable,
 counts:z.object({activeNarratives:number,acceleratingNarratives:number,opportunities24h:number})
});
export const MarketPreviewSchema=z.object({
 at:date,nearUsd:z.object({priceUsd:number.positive(),at:date,stale:z.boolean()}).nullable(),
 narrativeHeat:number.nullable(),opportunities24h:z.number().int().nonnegative(),
});
export const OverviewSchema=z.object({
 at:date,bar:BarSchema.nullable(),
 locked:z.object({overview:z.boolean(),narratives:z.boolean(),rotation:z.boolean(),opportunities:z.boolean()}),
 strip:z.object({topNarratives:z.array(NarrativeRef.extend({id:text,score:number,velocity:number})),hottestOpportunity:z.object({id:text,createdAt:date,score:number,token:z.object({mint:text,symbol:text,priceUsd:nullable,marketCapUsd:nullable}),narrative:z.object({name:text,slug:text}).nullable()}).nullable()}),
 rotation:Rotation.nullable(),brief:z.object({generated:z.literal('rules'),points:z.array(text)}),
 me:z.object({unreadAlerts:number})
});
// Structured arguments are deliberately narrowed; arbitrary nested model JSON is never rendered as HTML.
const Argument=z.object({arguments:z.array(text),strength:number.min(0).max(1),keyUncertainties:z.array(text)}).nullable();
export const AnalysisSchema=z.object({
 opportunityId:text,analyzedAt:date,model:text,bull:Argument,bear:Argument,risk:z.object({risks:z.array(z.object({code:text,description:text,severity:z.enum(['LOW','MEDIUM','HIGH'])})),maxLossScenario:text}).nullable(),
 decision:z.object({action:text,confidence:number.min(0).max(1),summary:text,positiveSignals:z.array(text).optional(),negativeSignals:z.array(text).optional(),risks:z.array(text).optional(),invalidationConditions:z.array(text).optional()}),
 guardrails:z.array(text)
});
export const TokenSchema=TokenRef.extend({
 observation:MarketObservation.nullish(),
 blacklisted:z.boolean(),createdOnChainAt:date.nullable(),
 metrics:z.object({priceUsd:nullable,marketCapUsd:nullable,liquidityUsd:nullable,volume24hUsd:nullable,at:date}).nullable(),
 holders:z.object({holders:number,top10Pct:number,at:date}).nullable(),
 risk:z.object({riskScore:number,flags:z.array(text),at:date}).nullable(),
 narratives:z.array(NarrativeRef.extend({relation:text,ogScore:number}))
});
export type Token=z.infer<typeof TokenSchema>;
export const TokenHistorySchema=z.object({window:z.enum(['1h','24h','7d']),asOf:date,points:z.array(z.object({at:date,priceUsd:number.positive(),source:z.literal('dexscreener'),pairAddress:text})),truncated:z.boolean(),excludedUnverified:z.number().int().nonnegative()});
export type PricePoint=z.infer<typeof TokenHistorySchema>['points'][number];

// ---- Alerts, analytics, settings and chat. ----
export const UnreadAlertsSchema=z.object({unread:z.number().int().nonnegative(),capped:z.boolean()});
export const alertPriorities=['INFO','WATCH','IMPORTANT','CRITICAL'] as const;
export const AlertPriority=z.enum(alertPriorities);
export const AlertSchema=z.object({id:text,alertId:text,readAt:date.nullable(),createdAt:date,kind:text,priority:AlertPriority,title:text,body:text,refType:text.nullable(),refId:text.nullable()});
export type AlertItem=z.infer<typeof AlertSchema>;
export const AlertsSchema=pageOf(AlertSchema).extend({unreadCount:z.number().int().nonnegative()});
export const MarkedSchema=z.object({marked:z.number().int().nonnegative()});
const range=z.tuple([number,number]).nullable();
export const DescribedSchema=z.object({n:number,distinctTokens:number,mean:nullable,median:nullable,p10:nullable,p90:nullable,meanCi:range,winRate:nullable,winRateCi:range,sufficient:z.boolean(),note:text.nullable()});
export type Described=z.infer<typeof DescribedSchema>;
const Bucket=z.object({label:text,described:DescribedSchema});
export const SummarySchema=z.object({
 range:z.object({days:number}),costPct:number,
 decisions:z.object({total:number,awaitingMeasurement:number,read:number,independent:number,pending:number,final:number,known:number,unknown:number,unknownRate:nullable,truncated:z.boolean()}),
 labels:z.object({WIN:number,LOSS:number,FLAT:number}),returns:DescribedSchema,medianLeadTimeSeconds:nullable,
 byConfidence:z.array(Bucket),caveats:z.array(text)
});
export const SignalsSchema=z.object({action:text.optional(),costPct:number,truncated:z.boolean(),byReasonCode:z.array(Bucket),caveats:z.array(text)});
export const OutcomesSchema=pageOf(z.object({decisionId:text,action:text,confidence:number,decidedAt:date,token:TokenRef.pick({mint:true,symbol:true}),label:text,return1hPct:nullable,return24hPct:nullable,maxGainPct:nullable,maxDrawdownPct:nullable,leadTimeSeconds:nullable,isFinal:z.boolean(),unknownReason:text.nullable()}));
export const themes=['DARK','LIGHT','SYSTEM'] as const,densities=['COMFORTABLE','COMPACT'] as const;
export const SettingsSchema=z.object({
 profile:z.object({displayName:text.nullable(),timezone:text.nullable()}),
 appearance:z.object({theme:z.enum(themes),density:z.enum(densities),reducedMotion:z.boolean()}),
 notifications:z.object({minPriority:AlertPriority,mutedKinds:z.array(text),mutableKinds:z.array(text),alwaysDelivered:z.array(text)})
});
export type UserSettings=z.infer<typeof SettingsSchema>;
export const ChatReplySchema=z.object({conversationId:text,reply:z.object({text:z.string().max(50000)}),toolsUsed:z.array(text),stopReason:text});
export const ChatHistorySchema=z.object({id:text,messages:z.array(z.object({id:text,role:z.enum(['USER','ASSISTANT']),text:text,format:z.literal('text'),createdAt:date}))});
