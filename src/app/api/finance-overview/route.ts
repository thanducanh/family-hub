import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });

  const yearStr = req.nextUrl.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();

  try {
    const [incomeRecordsResult, expensesResult] = await Promise.all([
      pool.query(`SELECT month, SUM(amount) as total FROM income_records WHERE status = 'Đã nhận' AND year = $1 GROUP BY month`, [year]),
      pool.query(`SELECT EXTRACT(MONTH FROM date) as month, SUM(amount) as total FROM transactions WHERE type = 'expense' AND EXTRACT(YEAR FROM date) = $1 GROUP BY EXTRACT(MONTH FROM date)`, [year])
    ]);

    const dataMap: Record<number, { month: number; income: number; expense: number }> = {};
    for (let i = 1; i <= 12; i++) {
      dataMap[i] = { month: i, income: 0, expense: 0 };
    }

    for (const row of incomeRecordsResult.rows) {
      const m = Number(row.month);
      if (dataMap[m]) dataMap[m].income += Number(row.total || 0);
    }

    for (const row of expensesResult.rows) {
      const m = Number(row.month);
      if (dataMap[m]) dataMap[m].expense += Number(row.total || 0);
    }

    const result = Object.values(dataMap).sort((a, b) => a.month - b.month);

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("[GET /api/finance-overview]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}
