import pg from "pg";
import { loadDatabaseUrl } from "./database/env.mjs";

const { Pool } = pg;

async function main() {
  let connectionString = await loadDatabaseUrl();
  connectionString = connectionString.replace(/^"/, "").replace(/"$/, "");
  const pool = new Pool({ connectionString });
  console.log("Creating investment_transactions table...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS investment_transactions (
      id UUID PRIMARY KEY,
      member_id UUID,
      trade_date DATE NOT NULL,
      stock_code TEXT NOT NULL,
      action TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      price NUMERIC NOT NULL,
      fee NUMERIC DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log("Table investment_transactions created successfully.");
  process.exit(0);
}

main().catch(console.error);
