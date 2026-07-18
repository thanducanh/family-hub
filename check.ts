import { config } from 'dotenv';
config({ path: '.env.local' });

import { pool } from './src/lib/db';
import { bankAccountsFromRows } from './src/lib/bank-accounts';

async function test() {
  const result = await pool.query("SELECT * FROM bank_accounts WHERE bank_name = 'BIDV'");
  console.log("RAW ROW:", result.rows[0]);
  
  const accounts = await bankAccountsFromRows(result.rows);
  console.log("NORMALIZED ACCOUNT:", accounts[0]);
  
  process.exit(0);
}
test().catch(console.error);
