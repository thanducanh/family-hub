import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { requireMemberSimAccess, listSimPlanHistory } from "@/lib/member-sims";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    
    const resolvedParams = await params;
    const access = await requireMemberSimAccess(user, resolvedParams.id);
    if (access.error) return access.error;

    const history = await listSimPlanHistory(resolvedParams.id);
    return NextResponse.json({ ok: true, data: history });
  } catch (error) {
    console.error("[api/member-sims/history] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ." }, { status: 500 });
  }
}
