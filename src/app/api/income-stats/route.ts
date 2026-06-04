import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { fetchIncomeData, normalizeYear } from "@/lib/incomes";

export async function GET(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const year = normalizeYear(new URL(request.url).searchParams.get("year"));
  const { stats } = await fetchIncomeData(year);
  return NextResponse.json({ ok: true, data: stats });
}
