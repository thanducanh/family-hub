import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessBankMember } from "@/lib/bank-accounts";
import { ensureMemberSimsTable, requireMemberSimAccess, topUpMemberSim } from "@/lib/member-sims";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();
    const body = await request.json();
    const simId = String(body.simId || body.sim_id || "");
    const existing = await requireMemberSimAccess(user, simId);
    if (existing.error) return existing.error;
    if (!await canAccessBankMember(user, existing.sim.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const saved = await topUpMemberSim({
      simId,
      amount: Number(body.amount || 0),
      transactionDate: String(body.transactionDate || body.transaction_date || ""),
      note: String(body.note || ""),
    });
    return NextResponse.json({ ok: true, data: saved });
  } catch (error) {
    console.error("[api/member-sims/topup] POST failed", error);
    return NextResponse.json({ ok: false, error: "Không thể nạp tiền SIM/Data." }, { status: 500 });
  }
}
