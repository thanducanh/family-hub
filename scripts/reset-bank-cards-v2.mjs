import { Client } from 'pg';

const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');

if (!isDryRun && !isApply) {
  console.error("Please specify --dry-run or --apply");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://family_user:FamilyHubDB2026_local@192.168.1.107:5432/family_hub';

const client = new Client({
  connectionString: DATABASE_URL,
});

async function main() {
  try {
    await client.connect();
    console.log(`Connected to database. Mode: ${isDryRun ? 'DRY-RUN' : 'APPLY'}`);
    
    // Check if foreign keys exist
    const fkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema='public' 
        AND table_name='transactions' 
        AND column_name IN ('bank_account_id', 'payment_account_id', 'payment_card_id', 'payment_source_id')
    `);
    
    const fkCols = fkRes.rows.map(r => r.column_name);
    
    if (fkCols.length > 0) {
      console.log(`Setting NULL for transactions columns: ${fkCols.join(', ')}`);
      if (isApply) {
        const sets = fkCols.map(c => `"${c}" = NULL`).join(', ');
        const res = await client.query(`UPDATE transactions SET ${sets}`);
        console.log(`Updated ${res.rowCount} rows in transactions.`);
      } else {
        console.log(`[DRY-RUN] Would set NULL for columns ${fkCols.join(', ')} in transactions.`);
      }
    } else {
      console.log(`No foreign key columns linking transactions to bank_accounts found.`);
    }

    const tablesToDelete = [
      'card_pending_transactions',
      'bank_card_benefits',
      'bank_card_rewards',
      'bank_raw_notes',
      'card_rewards',
      'bank_accounts'
    ];

    for (const table of tablesToDelete) {
      const existsRes = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [table]);
      if (existsRes.rows.length > 0) {
        const countRes = await client.query(`SELECT COUNT(*) FROM "${table}"`);
        const count = countRes.rows[0].count;
        console.log(`Table ${table} has ${count} rows.`);
        
        if (isApply) {
          await client.query(`DELETE FROM "${table}"`);
          console.log(`Deleted all rows from ${table}.`);
        } else {
          console.log(`[DRY-RUN] Would delete ${count} rows from ${table}.`);
        }
      } else {
        console.log(`Table ${table} does not exist. Skipping.`);
      }
    }
    
    console.log('--- Reset Module Bank Cards v2 Done ---');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
