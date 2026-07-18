const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
pool.query("SELECT * FROM bank_accounts WHERE bank_name = 'BIDV'").then(res => {
  console.log('DB Row:', res.rows[0]);
  process.exit(0);
});
