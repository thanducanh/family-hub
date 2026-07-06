import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  console.log("Running migration for cards pending transactions...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Create card_pending_transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS card_pending_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        date DATE NOT NULL,
        category VARCHAR(128) NOT NULL DEFAULT 'Khác',
        note TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        payment_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Attempt to add paid_at if table already exists (for idempotency)
    await client.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE card_pending_transactions ADD COLUMN paid_at TIMESTAMPTZ;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END;
      END $$;
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_card_pending_tx_member_id ON card_pending_transactions(member_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_card_pending_tx_bank_account_id ON card_pending_transactions(bank_account_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_card_pending_tx_status ON card_pending_transactions(status)`);
    
    await client.query("COMMIT");
    console.log("Migration successful!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
