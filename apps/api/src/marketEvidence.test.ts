import {describe,it,expect} from 'vitest';
import {observation,marketEvidence} from './marketEvidence';
import type {PrismaClient} from '@narra/database';
const at=new Date('2026-10-16T00:00:00Z');
const value={metricId:'real-row',source:'dexscreener' as const,at:at.toISOString(),marketCapIsFdv:true,priceChange1hPct:0,pairAddress:'pool',dexId:'raydium',pairCreatedAt:null};
describe('market evidence boundary',()=>{
 it('never attributes a legacy or different metric to a newer provider observation',()=>{expect(observation(undefined,'real-row',at)).toBeNull();expect(observation(value,'fixture-row',at)).toBeNull();expect(observation(value,'real-row',at)).toMatchObject({stale:false,priceChange1hPct:0,marketCapIsFdv:true});});
 it('marks old and future observations stale',()=>{expect(observation(value,'real-row',new Date(+at+16*60000))?.stale).toBe(true);expect(observation(value,'real-row',new Date(+at-1))?.stale).toBe(true);});
 it('rejects unaudited source names and malformed provider metadata',async()=>{
  const db={systemSetting:{findMany:async()=>[{key:'research.market.good',value},{key:'research.market.bad',value:{...value,source:'fixture'}},{key:'research.market.broken',value:{...value,at:'yesterday'}}]}} as unknown as PrismaClient;
  expect([...await marketEvidence(db,['good','bad','broken'])].map(([key])=>key)).toEqual(['good']);
 });
});
