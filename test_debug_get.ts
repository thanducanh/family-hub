import { config } from "dotenv";
config({ path: ".env.local" });
import { pool } from "./src/lib/db.ts";

async function test() {
  try {
    const dbUrl = process.env.DATABASE_URL || "";
    // Mask password
    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":***@");
    console.log("1. Kết nối tới DB:", maskedUrl);

    console.log("2. Đang kiểm tra dữ liệu bảng income_records...");
    const rawCount = await pool.query("SELECT COUNT(*) FROM income_records");
    console.log("Tổng số dòng trong income_records:", rawCount.rows[0].count);

    const year = 2026;
    console.log("3. Chạy câu query SELECT (mô phỏng fetchIncomeData)...");
    const sql = `SELECT r.*, COALESCE(r.job_id, r.work_id) AS job_id, COALESCE(m.name, '') AS member_name, COALESCE(j.title || ' · ' || j.company, '') AS job_name
      FROM income_records r
      LEFT JOIN members m ON m.id = r.member_id AND m.deleted_at IS NULL
      LEFT JOIN member_jobs j ON j.id = COALESCE(r.job_id, r.work_id)
      WHERE COALESCE(r.year, CAST(EXTRACT(YEAR FROM COALESCE(r.income_date, r.received_date)) AS INTEGER)) = $1
      ORDER BY r.income_date ASC, r.created_at ASC`;
    console.log("Query:", sql);
    console.log("Params:", [year]);

    const result = await pool.query(sql, [year]);
    console.log("Số dòng DB trả về cho năm 2026:", result.rows.length);

    if (result.rows.length > 0) {
      console.log("3 dòng đầu tiên sau khi query:");
      console.log(JSON.stringify(result.rows.slice(0, 3), null, 2));
    } else {
      console.log("Kiểm tra raw data trong DB (không điều kiện):");
      const allRows = await pool.query("SELECT * FROM income_records LIMIT 5");
      console.log(JSON.stringify(allRows.rows, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
