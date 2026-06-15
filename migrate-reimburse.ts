import { pool } from "./src/lib/db";

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN DEFAULT false;`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursement_person TEXT;`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursement_status TEXT DEFAULT 'none';`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursed_amount NUMERIC DEFAULT 0;`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursed_at DATE;`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counts_for_personal_expense BOOLEAN DEFAULT true;`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counts_for_card_spending BOOLEAN DEFAULT true;`);
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed', err);
  } finally {
    client.release();
  }
}
migrate();
