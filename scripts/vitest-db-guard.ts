// Vitest setup file: runs in every test file before it loads. See test-isolation.ts for the rules.
import { clearTestAdminEnv, clearTestAiEnv, resolveTestEnv } from './test-isolation';

const decision = resolveTestEnv(process.env);
clearTestAiEnv(process.env);
clearTestAdminEnv(process.env);
process.env.DATABASE_URL = decision.databaseUrl;
process.env.REDIS_URL = decision.redisUrl;
