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

  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":***@");
  console.log("1. DATABASE_URL đang kết nối tới DB nào:");
  console.log("->", maskedUrl);

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();

    console.log("\n2. Kiểm tra GET có đang đọc đúng bảng income_records không:");
    const countRes = await client.query("SELECT COUNT(*) FROM income_records");
    console.log("-> Tổng số record trong bảng income_records:", countRes.rows[0].count);

    console.log("\n3. SQL SELECT đang chạy (như trong fetchIncomeData):");
    const sql = `SELECT r.*, COALESCE(r.job_id, r.work_id) AS job_id, COALESCE(m.name, '') AS member_name, COALESCE(j.title || ' · ' || j.company, '') AS job_name
      FROM income_records r
      LEFT JOIN members m ON m.id = r.member_id AND m.deleted_at IS NULL
      LEFT JOIN member_jobs j ON j.id = COALESCE(r.job_id, r.work_id)
      WHERE COALESCE(r.year, CAST(EXTRACT(YEAR FROM COALESCE(r.income_date, r.received_date)) AS INTEGER)) = $1
      ORDER BY r.income_date ASC, r.created_at ASC`;
    const params = [2026];
    console.log("-> SQL:", sql);
    console.log("-> Params:", params);

    const result = await client.query(sql, params);
    console.log("\n-> Số dòng DB trả về:", result.rows.length);

    console.log("\n4. 3 dòng đầu tiên sau khi query:");
    console.log(JSON.stringify(result.rows.slice(0, 3), null, 2));

    console.log("\n5. Kiểm tra record thật trong DB xem parse bị sai không:");
    const rawRes = await client.query("SELECT id, member_id, amount, received_date, income_date, year, month FROM income_records ORDER BY created_at DESC LIMIT 5");
    console.log("-> 5 record mới nhất:", JSON.stringify(rawRes.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

test();
