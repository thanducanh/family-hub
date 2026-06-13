import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkMemberSimRenewals, ensureMemberSimsTable } from "@/lib/member-sims";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();
    const result = await checkMemberSimRenewals();
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("[api/member-sims/check-renewals] POST failed", error);
    return NextResponse.json({ ok: false, error: "Không thể kiểm tra gia hạn SIM/Data." }, { status: 500 });
  }
}
