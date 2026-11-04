import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { z } from 'zod';
export const PERSONAL_RESEARCH_QUEUE = 'personal-research';
export const PersonalResearchJobSchema = z.object({ userId: z.string().min(1).max(128).optional() }).strict();
export function createPersonalResearchQueue(connection: Redis) {
  const queue = new Queue(PERSONAL_RESEARCH_QUEUE, { connection });
  return { queue, request: (userId: string, now = Date.now()) => {
    // BullMQ custom ids cannot contain ':' and Privy user ids do (did:privy:...).
    const userKey = createHash('sha256').update(userId).digest('hex').slice(0, 24);
    return queue.add('user', PersonalResearchJobSchema.parse({ userId }), {
      jobId: `personal-${userKey}-${Math.floor(now / 60_000)}`, attempts: 1, removeOnComplete: { age: 300, count: 1000 }, removeOnFail: { age: 86400, count: 1000 },
    });
  } };
}
