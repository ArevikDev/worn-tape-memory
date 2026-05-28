import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Module-level pool — shared across the process lifetime.
// ConfigService isn't available here at import time, so we read
// the env var directly. NestJS loads .env via ConfigModule before
// any module initializes, so DATABASE_URL will always be present.
export function createDrizzleClient(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;
