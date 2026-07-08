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
    host: url.hostname,
    port: url.port || "(default)",
    database: url.pathname.replace(/^\//, ""),
    isLanHost: /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(url.hostname),
  };
}

const dbInfo = safeDatabaseInfo(databaseUrl);
console.log("DATABASE_URL safe info:", dbInfo);
if (dbInfo.isLanHost) {
  console.warn("WARNING: production on Vercel cannot reach a private LAN database host.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID,
    bank_name TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL DEFAULT '',
    display_name TEXT,
    card_type TEXT DEFAULT 'debit',
    account_type TEXT DEFAULT 'debit',
    status TEXT NOT NULL DEFAULT 'active',
    credit_limit NUMERIC DEFAULT 0,
    statement_day TEXT,
    due_day TEXT,
    opened_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS member_id UUID",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS display_name TEXT",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS card_type TEXT DEFAULT 'debit'",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'debit'",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS statement_day TEXT",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS due_day TEXT",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opened_at DATE",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
  `CREATE TABLE IF NOT EXISTS card_pending_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID,
    bank_account_id UUID,
    title TEXT NOT NULL DEFAULT '',
    amount NUMERIC NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL DEFAULT 'Khac',
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_transaction_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS member_id UUID",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Khac'",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS note TEXT",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS payment_transaction_id UUID",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
  `CREATE TABLE IF NOT EXISTS finance_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  "ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()",
  "ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()",
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query("COMMIT");
    console.log("Safe schema migration completed. No data was deleted or reset.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error("Safe schema migration failed:", error instanceof Error ? { message: error.message, stack: error.stack } : error);
  process.exitCode = 1;
});
