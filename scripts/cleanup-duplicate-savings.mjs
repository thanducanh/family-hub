import pg from 'pg';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = env.split('\n').find(line => line.startsWith('DATABASE_URL='));
if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}
const dbUrl = dbUrlMatch.split('=')[1].trim().replace(/^"|"$/g, '');
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const applyMode = process.argv.includes('--apply');

async function run() {
  try {
    console.log(`Starting cleanup... Mode: ${applyMode ? 'APPLY' : 'PREVIEW'}`);

    // Query to find duplicate records
    const duplicateQuery = `
      SELECT 
        member_id, year, month, amount, type, holder, description, 
        array_agg(id ORDER BY created_at ASC, id ASC) as ids,
        count(*) as count
      FROM savings_records
      WHERE amount = 5000000 
        AND description = 'Tiết kiệm'
        AND holder = 'Mẹ giữ'
        AND type = 'monthly'
      GROUP BY member_id, year, month, amount, type, holder, description
      HAVING count(*) > 1
    `;

    const res = await pool.query(duplicateQuery);
    const groups = res.rows;

    if (groups.length === 0) {
      console.log('No duplicates found.');
      return;
    }

    let totalDeleted = 0;

    for (const group of groups) {
      const allIds = group.ids;
      const idToKeep = allIds[0];
      const idsToDelete = allIds.slice(1);

      console.log(`\nGroup (Month: ${group.month}/${group.year}):`);
      console.log(`- Keep ID: ${idToKeep}`);
      console.log(`- Will Delete IDs: ${idsToDelete.join(', ')}`);

      if (applyMode) {
        // Also fix any transactions that point to the deleted savings_records
        for (const badId of idsToDelete) {
          await pool.query(
            "UPDATE transactions SET linked_savings_id = $1 WHERE linked_savings_id = $2",
            [idToKeep, badId]
          );
        }

        const deleteQuery = `
          DELETE FROM savings_records 
          WHERE id = ANY($1::uuid[])
        `;
        const delRes = await pool.query(deleteQuery, [idsToDelete]);
        totalDeleted += delRes.rowCount;
      }
    }

    if (applyMode) {
      console.log(`\nSuccessfully deleted ${totalDeleted} duplicate records.`);
    } else {
      console.log(`\nPreview complete. Run with --apply to delete.`);
    }

    // Verify 6/2026 count
    const verifyRes = await pool.query(`
      SELECT count(*) as count 
      FROM savings_records 
      WHERE month = 6 AND year = 2026 AND amount = 5000000 AND description = 'Tiết kiệm' AND holder = 'Mẹ giữ'
    `);
    console.log(`Remaining records for 6/2026: ${verifyRes.rows[0].count}`);

  } catch(e) {
    console.error('Error during cleanup:', e);
  } finally {
    pool.end();
  }
}

run();
