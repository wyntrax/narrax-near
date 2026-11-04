import {z} from 'zod';
import type {PrismaClient} from '@narra/database';
export const evidence=z.object({metricId:z.string(),at:z.string().datetime(),source:z.literal('dexscreener'),marketCapIsFdv:z.boolean(),priceChange1hPct:z.number().finite().nullable(),pairAddress:z.string(),dexId:z.string().nullable(),pairCreatedAt:z.string().datetime().nullable()});
export async function marketEvidence(db:PrismaClient,ids:string[]){
 const rows=ids.length?await db.systemSetting.findMany({where:{key:{in:ids.map(id=>`research.market.${id}`)}}}):[];
 return new Map(rows.flatMap(row=>{const parsed=evidence.safeParse(row.value);return parsed.success?[[row.key.slice('research.market.'.length),parsed.data] as const]:[];}));
}
export function observation(value:z.infer<typeof evidence>|undefined,metricId:string|undefined,now:Date){
 if(!value||value.metricId!==metricId)return null;
 return {...value,stale:Date.parse(value.at)>+now||+now-Date.parse(value.at)>15*60000};
}
