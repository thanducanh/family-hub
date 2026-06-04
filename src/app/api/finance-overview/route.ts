import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });

  try {
    const [incomeRecordsResult, yearlySummariesResult, expensesResult] = await Promise.all([
      pool.query(`SELECT year, SUM(amount) as total FROM income_records WHERE status = 'Đã nhận' GROUP BY year`),
      pool.query(`SELECT year, SUM(amount) as total FROM income_yearly_summaries GROUP BY year`),
      pool.query(`SELECT EXTRACT(YEAR FROM date) as year, SUM(amount) as total FROM transactions WHERE type = 'expense' GROUP BY EXTRACT(YEAR FROM date)`)
    ]);

    const dataMap: Record<number, { income: number; expense: number }> = {};

    const addData = (yearRaw: string | number, type: "income" | "expense", amount: number) => {
      const year = Number(yearRaw);
      if (!year) return;
      if (!dataMap[year]) dataMap[year] = { income: 0, expense: 0 };
      dataMap[year][type] += amount;
    };

    for (const row of incomeRecordsResult.rows) addData(row.year, "income", Number(row.total || 0));
    for (const row of yearlySummariesResult.rows) addData(row.year, "income", Number(row.total || 0));
    for (const row of expensesResult.rows) addData(row.year, "expense", Number(row.total || 0));

    const result = Object.entries(dataMap)
      .map(([y, d]) => ({ year: Number(y), income: d.income, expense: d.expense }))
      .sort((a, b) => b.year - a.year); // Sort descending

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("[GET /api/finance-overview]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}
