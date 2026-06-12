import { config } from 'dotenv';
config({ path: '.env.local' });
import { pool } from './src/lib/db';
pool.query(`
  DELETE FROM bank_accounts 
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY member_id, bank_name, last4, account_type, card_network 
        ORDER BY created_at ASC
      ) as rnum 
      FROM bank_accounts
    ) t 
    WHERE t.rnum > 1
  )
`).then(res => {
  console.log('Deleted rows:', res.rowCount);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
