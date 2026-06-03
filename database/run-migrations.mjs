import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const directory = new URL("./migrations/", import.meta.url);
  const migrations = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const migration of migrations) {
    await pool.query(await readFile(new URL(migration, directory), "utf8"));
    console.log(`Migration ${migration} completed.`);
  }
} finally {
  await pool.end();
}
