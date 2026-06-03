import { readFile } from "node:fs/promises";
import pg from "pg";
import { loadDatabaseUrl } from "./env.mjs";

const { Pool } = pg;
const tables = ["members", "tasks", "transactions", "events", "notes"];
const file = process.argv.find((argument) => argument.endsWith(".json"));
const confirmed = process.argv.includes("--confirm");

if (!file || !confirmed) {
  console.error("Restore chưa được chạy. Dùng: npm run db:restore -- database/backups/<file>.json --confirm");
  process.exit(1);
}

const backup = JSON.parse(await readFile(file, "utf8"));
if (!backup.tables || !tables.every((table) => Array.isArray(backup.tables[table]))) {
  throw new Error("File backup không đúng định dạng.");
}

const pool = new Pool({ connectionString: await loadDatabaseUrl() });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  for (const table of tables) {
    for (const row of backup.tables[table]) {
      const fields = Object.keys(row);
      const values = Object.values(row);
      const params = fields.map((_, index) => `$${index + 1}`).join(", ");
      const updates = fields.filter((field) => field !== "id").map((field) => `${field} = EXCLUDED.${field}`).join(", ");
      await client.query(`INSERT INTO ${table} (${fields.join(", ")}) VALUES (${params}) ON CONFLICT (id) DO UPDATE SET ${updates}`, values);
    }
  }
  await client.query("COMMIT");
  console.log("Restore hoàn tất. Dữ liệu trong file đã được upsert vào PostgreSQL NAS.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
