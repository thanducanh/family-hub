import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET() {
  if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const result = await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM members) AS members,
      (SELECT COUNT(*)::int FROM tasks) AS tasks,
      (SELECT COUNT(*)::int FROM transactions) AS transactions,
      (SELECT COUNT(*)::int FROM events) AS events,
      (SELECT COUNT(*)::int FROM notes) AS notes,
      NOW() AS database_time`);
    const { database_time, ...counts } = result.rows[0];
    return NextResponse.json({ ok: true, database: "PostgreSQL NAS", databaseTime: database_time, counts });
  } catch {
    return NextResponse.json({ ok: false, error: "Không thể kết nối PostgreSQL NAS." }, { status: 503 });
  }
}
