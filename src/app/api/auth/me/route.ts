import { NextResponse } from "next/server";
import { getSessionUser, refreshedSessionCookie } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureMemberAvatarUrlColumn, memberProfileFields, toMemberProfile } from "@/lib/member-profile";
import { ensureUserAvatarUrlColumn } from "@/lib/user-admin";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized", user: null }, { status: 401 });
    await ensureUserAvatarUrlColumn();
    let account;
    try {
      const accountResult = await pool.query("SELECT email, display_name, avatar, avatar_url, cover_url FROM users WHERE id = $1", [user.id]);
      account = accountResult.rows[0];
    } catch(err) {
      const accountResult = await pool.query("SELECT email, display_name, avatar FROM users WHERE id = $1", [user.id]);
      account = { ...accountResult.rows[0], avatar_url: null, cover_url: null };
    }
    if (user.memberId) await ensureMemberAvatarUrlColumn();
    const result = user.memberId
      ? await pool.query(`SELECT ${memberProfileFields} FROM members WHERE id = $1 AND deleted_at IS NULL`, [user.memberId])
      : { rows: [] };
    const member = result.rows[0] ? toMemberProfile(result.rows[0]) : null;
    const validUrl = (url: any) => typeof url === 'string' && !url.startsWith('data:image') && url ? url : null;
    const avatarUrl = validUrl(member?.avatarUrl) || validUrl(account?.avatar_url) || validUrl(member?.avatar) || validUrl(account?.avatar) || "";
    const coverUrl = validUrl(member?.coverUrl) || validUrl(account?.cover_url) || "";
    
    const mergedUser = {
      id: user.id,
      username: user.username,
      displayName: member?.name || account?.display_name || user.displayName,
      memberName: member?.name || "",
      avatarUrl,
      coverUrl,
      role: user.role,
      memberId: member?.id || user.memberId || "",
      permissions: member?.permissions || {},
    };
    const response = NextResponse.json({ ok: true, user: mergedUser, member });
    response.cookies.set(await refreshedSessionCookie({ ...user, avatar: avatarUrl, coverUrl }));
    return response;
  } catch (error) {
    console.error("[GET /api/auth/me]", error);
    return NextResponse.json({ ok: false, user: null, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
