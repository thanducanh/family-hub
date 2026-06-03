import { Pool } from "pg";

const globalForDb = globalThis as unknown as { familyPool?: Pool };

export const pool = globalForDb.familyPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
});

if (process.env.NODE_ENV !== "production") globalForDb.familyPool = pool;
