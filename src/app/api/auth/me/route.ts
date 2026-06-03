import { NextResponse } from "next/server";
import { getSessionUser, refreshedSessionCookie } from "@/lib/auth";
import { pool } from "@/lib/db";
import { memberProfileFields, toMemberProfile } from "@/lib/member-profile";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, user: null }, { status: 401 });
    const result = user.memberId
      ? await pool.query(`SELECT ${memberProfileFields} FROM members WHERE id = $1 AND deleted_at IS NULL`, [user.memberId])
      : { rows: [] };
    const member = result.rows[0] ? toMemberProfile(result.rows[0]) : null;
    const mergedUser = {
      ...user,
      displayName: member?.nickname || member?.name || user.displayName,
      avatar: member?.avatar || user.avatar,
      memberId: member?.id || user.memberId || "",
    };
    const response = NextResponse.json({ ok: true, user: mergedUser, member });
    response.cookies.set(await refreshedSessionCookie(mergedUser));
    return response;
  } catch (error) {
    console.error("[GET /api/auth/me]", error);
    return NextResponse.json({ ok: false, user: null, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
