import { Client } from "pg";
import * as fs from "fs";

async function test() {
  let dbUrl = "";
  try {
    const env = fs.readFileSync(".env.local", "utf8");
    const line = env.split("\n").find(l => l.startsWith("DATABASE_URL="));
    if (line) {
      dbUrl = line.slice(line.indexOf("=") + 1).replace(/"/g, "").trim();
    }
  } catch (e) {
    console.error("Could not read .env.local", e);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    
    console.log("Q1");
    await client.query("SELECT id, name FROM members WHERE deleted_at IS NULL ORDER BY name");
    console.log("Q2");
    await client.query(`SELECT s.*, m.name AS member_name
      FROM income_sources s
      JOIN members m ON m.id = s.member_id
      WHERE m.deleted_at IS NULL
      ORDER BY s.active DESC, m.name, s.name`);
    console.log("Q3");
    await client.query(`SELECT r.*, COALESCE(r.job_id, r.work_id) AS job_id, COALESCE(m.name, '') AS member_name, COALESCE(j.title || ' · ' || j.company, '') AS job_name
      FROM income_records r
      LEFT JOIN members m ON m.id = r.member_id AND m.deleted_at IS NULL
      LEFT JOIN member_jobs j ON j.id = COALESCE(r.job_id, r.work_id)
      WHERE COALESCE(r.year, CAST(EXTRACT(YEAR FROM COALESCE(r.income_date, r.received_date)) AS INTEGER)) = $1
      ORDER BY r.income_date ASC, r.created_at ASC`, [2026]);
    console.log("Q4");
    await client.query(`SELECT * FROM income_yearly_summaries ORDER BY year DESC, created_at ASC`);
    console.log("Q5");
    await client.query(`SELECT COALESCE(year, CAST(EXTRACT(YEAR FROM COALESCE(income_date, received_date)) AS INTEGER)) as year, SUM(amount) as total FROM income_records WHERE status='Đã nhận' GROUP BY COALESCE(year, CAST(EXTRACT(YEAR FROM COALESCE(income_date, received_date)) AS INTEGER))`);
    console.log("Q6");
    await client.query(`SELECT id, member_id, title, company, start_year, end_year, status, note, created_at, updated_at FROM member_jobs ORDER BY start_year DESC NULLS LAST, created_at DESC`);
    
    console.log("ALL QUERIES PASSED!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

test();
