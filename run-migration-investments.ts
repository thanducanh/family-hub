import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function main() {
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
