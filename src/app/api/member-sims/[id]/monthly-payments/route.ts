import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureMemberSimsTable, listSimMonthlyPayments, requireMemberSimAccess, upsertSimMonthlyPayment } from "@/lib/member-sims";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();
    const { id } = await props.params;
    const existing = await requireMemberSimAccess(user, id);
    if (existing.error) return existing.error;
    const yearParam = Number(request.nextUrl.searchParams.get("year") || 0);
    const data = await listSimMonthlyPayments(id, yearParam || undefined);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[api/member-sims/:id/monthly-payments] GET failed", error);
    return NextResponse.json({ ok: false, error: "Không thể tải thanh toán tháng." }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();
    const { id } = await props.params;
    const existing = await requireMemberSimAccess(user, id);
    if (existing.error) return existing.error;
    const body = await request.json();
    const saved = await upsertSimMonthlyPayment({
      simId: id,
      month: Number(body.month),
      year: Number(body.year),
      planName: body.planName || body.plan_name || "",
      amount: Number(body.amount || 0),
      paidDate: body.paidDate || body.paid_date,
      status: body.status || "paid",
      note: body.note || "",
    });
    return NextResponse.json({ ok: true, data: saved });
  } catch (error) {
    console.error("[api/member-sims/:id/monthly-payments] POST failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể lưu thanh toán tháng." }, { status: 500 });
  }
}
