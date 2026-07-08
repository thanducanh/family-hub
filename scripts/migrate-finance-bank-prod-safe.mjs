import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), '.env') });
if (!process.env.DATABASE_URL) dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Connected to DB for migration.");

    // Safe Table Creation
    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        bank_name VARCHAR(100),
        account_number VARCHAR(100),
        card_type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        display_name VARCHAR(255),
        product_name VARCHAR(255),
        account_type VARCHAR(50),
        credit_limit DECIMAL(15,2),
        due_day INTEGER,
        statement_day INTEGER
      );
    `);
    console.log("Ensured bank_accounts table exists.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS card_pending_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
        member_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        date DATE,
        category VARCHAR(100),
        note TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Ensured card_pending_transactions table exists.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS finance_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID NOT NULL,
        start_month INTEGER NOT NULL,
        start_year INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Ensured finance_settings table exists.");

    // Safe Column Addition
    await client.query(`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opened_at DATE;`);
    console.log("Added opened_at to bank_accounts.");

    await client.query(`ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;`);
    console.log("Added payment_transaction_id to card_pending_transactions.");

    await client.query(`ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_amount DECIMAL(15,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_debit_amount DECIMAL(15,2) DEFAULT 0;`);
    await client.query(`ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_wallet_amount DECIMAL(15,2) DEFAULT 0;`);
    console.log("Added opening_*_amount columns to finance_settings.");

    console.log("Migration completed safely.");

  } catch (err) {
    console.error("Migration failed:", err.message, err.stack);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
