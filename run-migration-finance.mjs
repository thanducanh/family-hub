import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Starting finance_settings migration...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS finance_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tracking_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        opening_cash_balance NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    
    // Check if empty, insert default
    const count = await client.query(`SELECT COUNT(*) FROM finance_settings`);
    if (parseInt(count.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO finance_settings (tracking_start_date, opening_cash_balance)
        VALUES ('2024-01-01', 0)
      `);
      console.log("Inserted default finance_settings.");
    }

    console.log("Migration successful!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    client.release();
    pool.end();
  }
}

main();
