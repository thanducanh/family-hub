import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import { loadDatabaseUrl } from "./env.mjs";

const { Pool } = pg;
const tables = ["members", "tasks", "transactions", "events", "notes"];
const pool = new Pool({ connectionString: await loadDatabaseUrl() });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = new URL(`./backups/family-management-${timestamp}.json`, import.meta.url);

try {
  const data = {};
  for (const table of tables) {
    const result = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
    data[table] = result.rows;
  }
  await mkdir(new URL("./backups/", import.meta.url), { recursive: true });
  await writeFile(output, JSON.stringify({ exportedAt: new Date().toISOString(), database: "family_management", tables: data }, null, 2), "utf8");
  console.log(`Đã tạo backup: ${decodeURIComponent(output.pathname)}`);
} finally {
  await pool.end();
}
