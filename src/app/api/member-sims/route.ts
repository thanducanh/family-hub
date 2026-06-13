import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessBankMember } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";
import { ensureMemberSimsTable, memberSimFields, memberSimFromRow, normalizeMemberSimBody, upsertMemberSim, validateMemberSimAccess } from "@/lib/member-sims";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();
    const memberId = request.nextUrl.searchParams.get("memberId");
    if (memberId) {
      if (!await canAccessBankMember(user, memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
      const result = await pool.query(`SELECT ${memberSimFields} FROM member_sims WHERE member_id = $1 ORDER BY created_at DESC`, [memberId]);
      return NextResponse.json({ ok: true, data: result.rows.map(memberSimFromRow) });
    }
    const result = user.role === "full_access"
      ? await pool.query(`SELECT ${memberSimFields} FROM member_sims ORDER BY created_at DESC`)
      : await pool.query(`SELECT ${memberSimFields} FROM member_sims WHERE member_id = $1 ORDER BY created_at DESC`, [user.memberId || "00000000-0000-0000-0000-000000000000"]);
    return NextResponse.json({ ok: true, data: result.rows.map(memberSimFromRow) });
  } catch (error) {
    console.error("[api/member-sims] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();
    const sim = normalizeMemberSimBody(await request.json());
    const accessError = await validateMemberSimAccess(user, sim);
    if (accessError) return accessError;
    const saved = await upsertMemberSim(sim);
    return NextResponse.json({ ok: true, data: saved }, { status: 201 });
  } catch (error) {
    console.error("[api/member-sims] POST failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
