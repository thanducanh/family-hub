import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, refreshedSessionCookie } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const { currentPassword, newPassword } = await request.json() as { currentPassword?: string; newPassword?: string };
    if (!newPassword || newPassword.length < 6) return NextResponse.json({ ok: false, error: "Mật khẩu mới cần ít nhất 6 ký tự." }, { status: 400 });
    if (currentPassword) {
      if (currentPassword === newPassword) return NextResponse.json({ ok: false, error: "Mật khẩu mới không được trùng mật khẩu hiện tại." }, { status: 400 });
      const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
      if (!result.rows[0] || !await bcrypt.compare(currentPassword, result.rows[0].password_hash)) return NextResponse.json({ ok: false, error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
    }
    await pool.query("UPDATE users SET password_hash=$2, must_change_password=FALSE, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [user.id, await bcrypt.hash(newPassword, 12)]);
    const nextUser = { ...user, mustChangePassword: false };
    const response = NextResponse.json({ ok: true, data: nextUser, user: nextUser });
    response.cookies.set(await refreshedSessionCookie(nextUser));
    return response;
  } catch (error) {
    console.error("[api/auth/change-password] POST failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
