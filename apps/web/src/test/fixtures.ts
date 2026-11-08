import {FEATURE_TIERS} from '@narra/shared';
import type {Entitlements} from '@/lib/schemas';
export const ADDRESS='example.near';
export const status={enabled:true,seatsLeft:12,inviteRequired:false};
export const empty:Entitlements={effectiveTier:'NONE',sources:[],nextExpiry:null,researchPageLimit:0,features:Object.fromEntries(Object.entries(FEATURE_TIERS).map(([key,requiredTier])=>[key,{requiredTier,allowed:false,min_entitlement_age_hours:0}])),rollout:{enforced:true,shadow_log:true},grants:[]};
export const linked:Entitlements={...empty};
export const active:Entitlements={...empty,effectiveTier:'EARLY_ACCESS',researchPageLimit:20,sources:[{source:'EARLY_ACCESS',id:'fixture-grant',tier:'EARLY_ACCESS',validUntil:null}],grants:[{id:'fixture-grant',userId:'fixture-user',source:'EARLY_ACCESS',tier:'EARLY_ACCESS',status:'ACTIVE',validUntil:null,eligible:true,reasonCode:'ACTIVE'}]};
