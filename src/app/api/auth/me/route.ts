import { NextResponse } from "next/server";
import { getSessionUser, refreshedSessionCookie } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureMemberAvatarUrlColumn, memberProfileFields, toMemberProfile } from "@/lib/member-profile";

async function ensureUserCoverUrlColumn() {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT`);
  } catch (err: any) {
    console.error("[ensureUserCoverUrlColumn]", err.message);
  }
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized", user: null }, { status: 401 });
    await ensureUserCoverUrlColumn();
    let account;
    try {
      const accountResult = await pool.query("SELECT email, display_name, avatar, cover_url FROM users WHERE id = $1", [user.id]);
      account = accountResult.rows[0];
    } catch(err) {
      const accountResult = await pool.query("SELECT email, display_name, avatar FROM users WHERE id = $1", [user.id]);
      account = { ...accountResult.rows[0], cover_url: null };
    }
    if (user.memberId) await ensureMemberAvatarUrlColumn();
    const result = user.memberId
      ? await pool.query(`SELECT ${memberProfileFields} FROM members WHERE id = $1 AND deleted_at IS NULL`, [user.memberId])
      : { rows: [] };
    const member = result.rows[0] ? toMemberProfile(result.rows[0]) : null;
    const mergedUser = {
      id: user.id,
      username: user.username,
      displayName: member?.name || account?.display_name || user.displayName,
      avatar: member?.avatarUrl || (typeof account?.avatar === 'string' && account.avatar.startsWith('data:image') ? '' : account?.avatar) || (typeof user.avatar === 'string' && user.avatar.startsWith('data:image') ? '' : user.avatar) || "",
      coverUrl: member?.coverUrl || (typeof account?.cover_url === 'string' && account.cover_url.startsWith('data:image') ? '' : account?.cover_url) || (typeof user.coverUrl === 'string' && user.coverUrl.startsWith('data:image') ? '' : user.coverUrl) || "",
      email: account?.email || "",
      role: user.role,
      memberId: member?.id || user.memberId || "",
      permissions: member?.permissions || {},
    };
    const response = NextResponse.json({ ok: true, user: mergedUser });
    response.cookies.set(await refreshedSessionCookie(user));
    return response;
  } catch (error) {
    console.error("[GET /api/auth/me]", error);
    return NextResponse.json({ ok: false, user: null, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
