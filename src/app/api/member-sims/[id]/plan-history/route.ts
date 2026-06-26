import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { changeMemberSimPlan, ensureMemberSimsTable, listSimPlanHistory, requireMemberSimAccess } from "@/lib/member-sims";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();
    const { id } = await props.params;
    const existing = await requireMemberSimAccess(user, id);
    if (existing.error) return existing.error;
    const history = await listSimPlanHistory(id);
    return NextResponse.json({ ok: true, data: history });
  } catch (error) {
    console.error("[api/member-sims/:id/plan-history] GET failed", error);
    return NextResponse.json({ ok: false, error: "Không thể tải lịch sử SIM/Data." }, { status: 500 });
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
    const saved = await changeMemberSimPlan({
      simId: id,
      newPlanName: body.newPlanName || body.new_plan_name,
      newPlanPrice: Number(body.newPlanPrice ?? body.new_plan_price ?? 0),
      newBillingCycleType: body.newBillingCycleType || body.new_billing_cycle_type,
      newRenewalMonths: Number(body.newRenewalMonths ?? body.new_renewal_months ?? 1),
      newRenewDay: body.newRenewDay ?? body.new_renew_day ?? null,
      effectiveMonth: Number(body.effectiveMonth ?? body.effective_month ?? new Date().getMonth() + 1),
      effectiveYear: Number(body.effectiveYear ?? body.effective_year ?? new Date().getFullYear()),
      effectiveDate: body.effectiveDate || body.effective_date,
      note: body.note || body.reason || "",
      actorName: user.displayName || user.username || "Family Hub",
    });
    return NextResponse.json({ ok: true, data: saved });
  } catch (error) {
    console.error("[api/member-sims/:id/plan-history] POST failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể đổi gói SIM/Data." }, { status: 500 });
  }
}
