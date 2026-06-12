import { NextResponse } from "next/server";
import { getSessionUser, refreshedSessionCookie } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureMemberAvatarUrlColumn, memberProfileFields, toMemberProfile } from "@/lib/member-profile";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, user: null }, { status: 401 });
    const accountResult = await pool.query("SELECT email, display_name, avatar FROM users WHERE id = $1", [user.id]);
    const account = accountResult.rows[0];
    if (user.memberId) await ensureMemberAvatarUrlColumn();
    const result = user.memberId
      ? await pool.query(`SELECT ${memberProfileFields} FROM members WHERE id = $1 AND deleted_at IS NULL`, [user.memberId])
      : { rows: [] };
    const member = result.rows[0] ? toMemberProfile(result.rows[0]) : null;
    const mergedUser = {
      ...user,
      displayName: member?.name || account?.display_name || user.displayName,
      avatar: member?.avatarUrl || member?.avatar || account?.avatar || user.avatar,
      email: account?.email || "",
      memberId: member?.id || user.memberId || "",
      member: member ?? undefined,
    };
    const response = NextResponse.json({ ok: true, user: mergedUser, member });
    response.cookies.set(await refreshedSessionCookie(mergedUser));
    return response;
  } catch (error) {
    console.error("[GET /api/auth/me]", error);
    return NextResponse.json({ ok: false, user: null, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
