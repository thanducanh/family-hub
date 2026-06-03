import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, normalizeUserRole, sessionCookie, type SessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { memberProfileFields, toMemberProfile } from "@/lib/member-profile";

export async function POST(request: NextRequest) {
  const { username, password, remember = false } = await request.json() as { username?: string; password?: string; remember?: boolean };
  if (!username || !password) return NextResponse.json({ ok: false, error: "Vui lòng nhập tài khoản hoặc email và mật khẩu." }, { status: 400 });
  try {
    const result = await pool.query("SELECT id, username, display_name, avatar, password_hash, role, active, must_change_password, member_id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)", [username.trim()]);
    const row = result.rows[0];
    if (!row || !await bcrypt.compare(password, row.password_hash)) return NextResponse.json({ ok: false, error: "Tài khoản hoặc mật khẩu không đúng." }, { status: 401 });
    if (!row.active) return NextResponse.json({ ok: false, error: "Tài khoản đã bị vô hiệu hóa." }, { status: 403 });
    const memberResult = row.member_id ? await pool.query(`SELECT ${memberProfileFields} FROM members WHERE id = $1 AND deleted_at IS NULL`, [row.member_id]) : { rows: [] };
    const member = memberResult.rows[0] ? toMemberProfile(memberResult.rows[0]) : null;
    const user: SessionUser = { id: row.id, username: row.username, displayName: member?.nickname || member?.name || row.display_name, avatar: member?.avatar || row.avatar, role: normalizeUserRole(String(row.role)), mustChangePassword: row.must_change_password, memberId: member?.id || row.member_id || "" };
    const response = NextResponse.json({ ok: true, user, member });
    response.cookies.set(sessionCookie(createSessionToken(user, remember), remember));
    return response;
  } catch (error) {
    console.error("[api/auth/login] POST failed", error);
    return NextResponse.json({ ok: false, error: "Không thể kết nối hệ thống đăng nhập. Vui lòng thử lại sau." }, { status: 503 });
  }
}
