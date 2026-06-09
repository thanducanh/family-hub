import pg from "pg";
const { Pool } = pg;
import crypto from "crypto";

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_U9aErsglFnb0@ep-withered-math-ao4nmhdn-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
});

async function test() {
  const client = await pool.connect();
  try {
    const memberRes = await client.query("SELECT id FROM members LIMIT 1");
    const memberId = memberRes.rows[0]?.id;
    if (!memberId) throw new Error("No member found");

    const query = `INSERT INTO income_records (id, source_id, member_id, job_id, work_id, received_date, income_date, year, month, category, name, amount, status, note, work_source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()) RETURNING *`;
    const params = [
      crypto.randomUUID(),
      null,
      memberId,
      null,
      "2026-06-09",
      2026,
      6,
      "Lương",
      "Test",
      1000,
      "Đã nhận",
      "",
      null
    ];
    
    console.log("Executing query with params:", params);
    await client.query(query, params);
    console.log("Success INSERT!");
  } catch (err) {
    console.error("SQL Error:", err);
  } finally {
    client.release();
    pool.end();
  }
}
test();
