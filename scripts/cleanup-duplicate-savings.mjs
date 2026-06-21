import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.split('\n').find(line => line.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^"|"$/g, '');
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  const isApply = process.argv.includes('--apply');
  console.log(isApply ? "Running in APPLY mode: Deleting records..." : "Running in PREVIEW mode: Dry run only...");

  try {
    // 1. Fetch duplicate groups
    const query = `
      SELECT 
        member_id, year, month, type, holder,
        json_agg(
          json_build_object(
            'id', id, 
            'created_at', created_at, 
            'amount', amount
          ) ORDER BY created_at ASC
        ) as records
      FROM savings_records
      WHERE type = 'monthly'
      GROUP BY member_id, year, month, type, holder
      HAVING count(*) > 1
    `;

    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log("No duplicates found.");
      return;
    }

    let totalDeleted = 0;

    for (const group of result.rows) {
      console.log(`\nDuplicate Group found: Month ${group.month}/${group.year}, Holder: ${group.holder}, Type: ${group.type}`);
      const records = group.records;
      
      // The first one is the oldest (due to ORDER BY created_at ASC in json_agg)
      const keepRecord = records[0];
      const deleteRecords = records.slice(1);

      console.log(`[KEEP] ID: ${keepRecord.id} | Created: ${keepRecord.created_at} | Amount: ${keepRecord.amount}`);
      
      for (const rec of deleteRecords) {
        console.log(`[DELETE] ID: ${rec.id} | Created: ${rec.created_at} | Amount: ${rec.amount}`);
      }

      if (isApply) {
        const deleteIds = deleteRecords.map(r => r.id);
        const deleteQuery = `DELETE FROM savings_records WHERE id = ANY($1::uuid[])`;
        const deleteResult = await pool.query(deleteQuery, [deleteIds]);
        console.log(`=> Deleted ${deleteResult.rowCount} records for this group.`);
        totalDeleted += deleteResult.rowCount;
      }
    }

    if (isApply) {
      console.log(`\nCleanup complete. Total records deleted: ${totalDeleted}`);
    } else {
      console.log(`\nPreview complete. To apply changes, run with --apply.`);
    }

    // Print remaining savings records for 06/2026
    const countQuery = `SELECT count(*) FROM savings_records WHERE month = 6 AND year = 2026 AND type = 'monthly'`;
    const countResult = await pool.query(countQuery);
    console.log(`Current remaining monthly savings records for 06/2026: ${countResult.rows[0].count}`);

  } catch(e) {
    console.error("Error during cleanup:", e);
  } finally {
    pool.end();
  }
}

cleanup();
