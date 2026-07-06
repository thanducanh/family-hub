import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const backupDir = path.join(rootDir, "database", "backups");

const markerPattern = /(Ã|Â|Ä|á»|áº|Æ|Ä‘|�|[\u0080-\u009f])/;
const vietnamesePattern = /[À-ỹĐđ]/;
const cp1252Reverse = new Map([
  ["€", 0x80], ["‚", 0x82], ["ƒ", 0x83], ["„", 0x84], ["…", 0x85], ["†", 0x86], ["‡", 0x87],
  ["ˆ", 0x88], ["‰", 0x89], ["Š", 0x8a], ["‹", 0x8b], ["Œ", 0x8c], ["Ž", 0x8e],
  ["‘", 0x91], ["’", 0x92], ["“", 0x93], ["”", 0x94], ["•", 0x95], ["–", 0x96], ["—", 0x97],
  ["˜", 0x98], ["™", 0x99], ["š", 0x9a], ["›", 0x9b], ["œ", 0x9c], ["ž", 0x9e], ["Ÿ", 0x9f],
]);

const targets = [
  { table: "users", id: "id", columns: ["display_name", "avatar"] },
  { table: "members", id: "id", columns: ["name", "nickname", "phone", "gender", "notes", "avatar", "avatar_url", "cover_url"] },
  { table: "tasks", id: "id", columns: ["title", "assignee", "priority", "status"] },
  { table: "transactions", id: "id", columns: ["title", "category", "subcategory", "note", "payment_method", "reimbursement_person", "reimbursement_status", "savings_holder"] },
  { table: "events", id: "id", columns: ["title", "type", "color", "description", "location", "note", "repeat_rule", "status", "label_color", "visibility", "allowed_member_ids", "related_member_ids"] },
  { table: "notes", id: "id", columns: ["title", "kind", "tag", "content"] },
  { table: "notifications", id: "id", columns: ["title", "message", "created_by_name", "source_type", "source_id", "metadata"] },
  { table: "calendars", id: "id", columns: ["name", "color", "type"] },
  { table: "bank_accounts", id: "id", columns: ["bank_name", "account_holder", "card_type", "account_type", "card_network", "product_name", "annual_fee_waiver_type", "annual_fee_cycle", "status", "note"] },
  { table: "bank_raw_notes", id: "id", columns: ["title", "bank_name", "content_type", "raw_text", "note"] },
  { table: "bank_card_rewards", id: "id", columns: ["reward_type", "title", "note"] },
  { table: "income_records", id: "id", columns: ["name", "category", "status", "note"] },
  { table: "income_sources", id: "id", columns: ["name", "type", "frequency", "note"] },
  { table: "savings_records", id: "id", columns: ["type", "holder", "description", "note"] },
];

function score(value) {
  return (value.match(markerPattern) ? 3 : 0) + (value.match(/(?:Ã|Â|Ä|á»|áº|Æ|Ä‘|[\u0080-\u009f])/g)?.length || 0);
}

function bytesFromMojibake(value) {
  const bytes = [];
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }
    const mapped = cp1252Reverse.get(char);
    if (mapped === undefined) return null;
    bytes.push(mapped);
  }
  return Buffer.from(bytes);
}

function fixString(value) {
  if (!markerPattern.test(value)) return value;
  let current = value;
  for (let i = 0; i < 2; i += 1) {
    const bytes = bytesFromMojibake(current);
    if (!bytes) break;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!decoded || decoded === current) break;
    const decodedScore = score(decoded);
    if (decodedScore < score(current) || (decodedScore === 0 && vietnamesePattern.test(decoded))) current = decoded;
    else break;
  }
  return current;
}

function fixValue(value) {
  if (typeof value === "string") return fixString(value);
  if (Array.isArray(value)) return value.map(fixValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fixValue(item)]));
}

async function tableExists(pool, table) {
  const result = await pool.query("SELECT to_regclass($1) AS name", [`public.${table}`]);
  return Boolean(result.rows[0]?.name);
}

async function existingColumns(pool, table, columns) {
  const result = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name = ANY($2)",
    [table, columns]
  );
  return new Set(result.rows.map(row => row.column_name));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const backup = { createdAt: new Date().toISOString(), tables: {} };
  const changes = [];

  try {
    for (const target of targets) {
      if (!await tableExists(pool, target.table)) continue;
      const available = await existingColumns(pool, target.table, [target.id, ...target.columns]);
      if (!available.has(target.id)) continue;
      const columns = target.columns.filter(column => available.has(column));
      if (!columns.length) continue;
      const selectList = [target.id, ...columns].map(column => `"${column}"`).join(", ");
      const result = await pool.query(`SELECT ${selectList} FROM "${target.table}"`);
      backup.tables[target.table] = result.rows;
    }

    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `before-fix-vietnamese-mojibake-${stamp}.json`);
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), "utf8");
    console.log(`Backup written: ${path.relative(rootDir, backupPath)}`);

    await pool.query("BEGIN");
    for (const target of targets) {
      const rows = backup.tables[target.table] || [];
      for (const row of rows) {
        const updates = [];
        const params = [];
        for (const column of target.columns) {
          if (!(column in row) || row[column] == null) continue;
          const fixed = fixValue(row[column]);
          const before = typeof row[column] === "object" ? JSON.stringify(row[column]) : row[column];
          const after = typeof fixed === "object" ? JSON.stringify(fixed) : fixed;
          if (after === before) continue;
          params.push(fixed);
          updates.push(`"${column}" = $${params.length}`);
        }
        if (!updates.length) continue;
        params.push(row[target.id]);
        await pool.query(`UPDATE "${target.table}" SET ${updates.join(", ")} WHERE "${target.id}" = $${params.length}`, params);
        changes.push({ table: target.table, id: row[target.id], columns: updates.map(item => item.split(" ")[0].replaceAll('"', "")) });
      }
    }
    await pool.query("COMMIT");
    console.log(`Updated rows: ${changes.length}`);
    if (changes.length) console.table(changes.slice(0, 50));
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
