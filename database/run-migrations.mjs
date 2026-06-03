import { readFile } from "node:fs/promises";
import pg from "pg";
import { loadDatabaseUrl } from "./env.mjs";

const { Pool } = pg;

async function main() {
  const connectionString = await loadDatabaseUrl();
  console.log("Connecting to PostgreSQL...");
  const pool = new Pool({ connectionString });

  try {
    const consolidatedSqlPath = new URL("./migrations/consolidated_schema.sql", import.meta.url);
    const sql = await readFile(consolidatedSqlPath, "utf8");
    console.log("Executing consolidated migrations...");
    await pool.query(sql);
    console.log("Migrations successfully completed on PostgreSQL!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
