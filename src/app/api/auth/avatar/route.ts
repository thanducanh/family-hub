import { NextResponse } from "next/server";
import { getSessionUser, refreshedSessionCookie } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureMemberAvatarUrlColumn } from "@/lib/member-profile";
import { ensureUserAvatarUrlColumn } from "@/lib/user-admin";

export async function DELETE() {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });

    if (session.memberId) {
      await ensureMemberAvatarUrlColumn();
      await pool.query("UPDATE members SET avatar='', avatar_url='' WHERE id=$1 AND deleted_at IS NULL", [session.memberId]);
    } else {
      await ensureUserAvatarUrlColumn();
      await pool.query("UPDATE users SET avatar='', avatar_url='', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id]);
    }

    // Return the updated session with no avatar
    const updatedUser = { ...session, avatar: "" };
    const response = NextResponse.json({ ok: true });
    response.cookies.set(await refreshedSessionCookie(updatedUser));
    return response;
  } catch (error) {
    console.error("[DELETE /api/auth/avatar]", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
