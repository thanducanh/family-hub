const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const result = await pool.query(`
    UPDATE transactions
    SET date = '2026-06-23'
    WHERE id = 'e65caa25-27dd-432b-8bad-76511bae4ab2';
  `);
  console.log("Updated", result.rowCount, "rows");
}

main().catch(console.error).finally(() => pool.end());
