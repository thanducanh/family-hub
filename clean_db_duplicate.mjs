import pg from 'pg';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.split('\n').find(line => line.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^"|"$/g, '');
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function clean() {
  try {
    const res = await pool.query(`
      WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER(PARTITION BY member_id, bank_name, last4, account_type, card_network ORDER BY created_at DESC) as row_num
        FROM bank_accounts
      )
      DELETE FROM bank_accounts
      WHERE id IN (
        SELECT id FROM duplicates WHERE row_num > 1
      )
      RETURNING id;
    `);
    console.log('Deleted duplicate records:', res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

clean();
