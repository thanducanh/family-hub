import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Try to load .env.production first, then .env, then .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), '.env') });
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log("Checking DB URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function check() {
  const client = await pool.connect();
  try {
    console.log("Connected to DB successfully.");

    const checkTable = async (table) => {
      const res = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      console.log(`Table ${table} exists:`, res.rows[0].exists);
      return res.rows[0].exists;
    };

    const checkColumn = async (table, column) => {
      const res = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          AND column_name = $2
        );
      `, [table, column]);
      console.log(`Column ${table}.${column} exists:`, res.rows[0].exists);
    };

    const tables = ['bank_accounts', 'card_pending_transactions', 'finance_settings'];
    for (const t of tables) {
      const exists = await checkTable(t);
      if (exists && t === 'bank_accounts') {
        await checkColumn(t, 'opened_at');
      }
      if (exists && t === 'card_pending_transactions') {
        await checkColumn(t, 'payment_transaction_id');
      }
      if (exists && t === 'finance_settings') {
        await checkColumn(t, 'opening_cash_amount');
        await checkColumn(t, 'opening_debit_amount');
        await checkColumn(t, 'opening_wallet_amount');
      }
    }
    
    console.log("Done checking schema.");

  } catch (err) {
    console.error("DB Check failed:", err.message, err.stack);
  } finally {
    client.release();
    pool.end();
  }
}

check();
