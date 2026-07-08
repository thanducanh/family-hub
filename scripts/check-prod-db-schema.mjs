import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.production") });
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), ".env") });
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

function safeDatabaseInfo(rawUrl) {
  const url = new URL(rawUrl);
  return {
    protocol: url.protocol,
    host: url.hostname,
    port: url.port || "(default)",
    database: url.pathname.replace(/^\//, ""),
    isLanHost: /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(url.hostname),
  };
}

const dbInfo = safeDatabaseInfo(databaseUrl);
console.log("DATABASE_URL safe info:", dbInfo);
if (dbInfo.isLanHost) {
  console.warn("WARNING: DATABASE_URL points to a private LAN host. Vercel cannot reach 192.168.x.x / private network databases.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

const required = {
  bank_accounts: [
    "id",
    "member_id",
    "bank_name",
    "product_name",
    "display_name",
    "card_type",
    "status",
    "credit_limit",
    "statement_day",
    "due_day",
    "opened_at",
    "created_at",
    "updated_at",
  ],
  card_pending_transactions: [
    "id",
    "member_id",
    "bank_account_id",
    "title",
    "amount",
    "date",
    "category",
    "note",
    "status",
    "payment_transaction_id",
    "created_at",
    "updated_at",
  ],
  finance_settings: ["id", "created_at", "updated_at"],
};

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnsFor(client, tableName) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return new Set(result.rows.map(row => row.column_name));
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("DB connection: ok");

    for (const [tableName, columns] of Object.entries(required)) {
      const exists = await tableExists(client, tableName);
      console.log(`Table ${tableName}:`, exists ? "exists" : "missing");
      if (!exists) continue;

      const actual = await columnsFor(client, tableName);
      const missing = columns.filter(column => !actual.has(column));
      console.log(`Missing columns ${tableName}:`, missing.length ? missing : []);
    }

    const cards = await client.query(
      `SELECT id,
              member_id,
              bank_name,
              product_name,
              display_name,
              card_type,
              status,
              due_day
       FROM bank_accounts
       ORDER BY created_at DESC`
    );
    console.log("Production bank_accounts:", cards.rows);

    const pending = await client.query(
      `SELECT cpt.id,
              cpt.member_id,
              cpt.bank_account_id,
              cpt.title,
              cpt.amount,
              cpt.status,
              ba.bank_name,
              ba.product_name,
              ba.display_name,
              ba.card_type,
              ba.status AS card_status
       FROM card_pending_transactions cpt
       LEFT JOIN bank_accounts ba ON ba.id = cpt.bank_account_id
       WHERE cpt.status = 'pending'
       ORDER BY cpt.created_at DESC`
    );
    console.log("Production pending card transactions:", pending.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error("DB check failed:", error instanceof Error ? { message: error.message, stack: error.stack } : error);
  process.exitCode = 1;
});
