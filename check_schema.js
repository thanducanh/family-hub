const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/family_hub' });
async function run() {
  const tables = ['transactions', 'income_records', 'savings_records', 'investment_transactions', 'tasks', 'events', 'notes', 'members'];
  for (const t of tables) {
    const res = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [t]);
    console.log(t + ':', res.rows.map(r => r.column_name).join(', '));
  }
  pool.end();
}
run();
