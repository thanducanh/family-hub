import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, normalizeUserRole, type SessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { initDatabase } from "@/lib/init-database";
import { ensureMemberAvatarUrlColumn, memberProfileFields, toMemberProfile } from "@/lib/member-profile";

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string; };
    if (!email || !password) return NextResponse.json({ ok: false, error: "Vui lòng nhập tài khoản/email và mật khẩu." }, { status: 400, headers: corsHeaders() });
    
    await initDatabase();
    const result = await pool.query("SELECT id, username, display_name, avatar, password_hash, role, active, must_change_password, member_id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)", [email.trim()]);
    const row = result.rows[0];
    const passwordMatches = row && (password === row.password_hash || (row.password_hash.startsWith("$2") && await bcrypt.compare(password, row.password_hash)));
    
    if (!row || !passwordMatches) return NextResponse.json({ ok: false, error: "Tài khoản hoặc mật khẩu không đúng." }, { status: 401, headers: corsHeaders() });
    if (!row.active) return NextResponse.json({ ok: false, error: "Tài khoản đã bị vô hiệu hóa." }, { status: 403, headers: corsHeaders() });
    
    if (row.member_id) await ensureMemberAvatarUrlColumn();
    const memberResult = row.member_id ? await pool.query(`SELECT ${memberProfileFields} FROM members WHERE id = $1 AND deleted_at IS NULL`, [row.member_id]) : { rows: [] };
    const member = memberResult.rows[0] ? toMemberProfile(memberResult.rows[0]) : null;
    
    const user: SessionUser = { id: row.id, username: row.username, displayName: member?.nickname || member?.name || row.display_name, avatar: member?.avatarUrl || member?.avatar || row.avatar, role: normalizeUserRole(String(row.role)), mustChangePassword: row.must_change_password, memberId: member?.id || row.member_id || "" };
    
    // Create token that lasts a long time for mobile
    const token = createSessionToken(user, true);
    
    return NextResponse.json({ ok: true, token, user, member }, { headers: corsHeaders() });
  } catch (error) {
    console.error("[api/auth/mobile-login] POST failed", error);
    return NextResponse.json({ ok: false, error: "Không thể kết nối hệ thống đăng nhập. Vui lòng thử lại sau." }, { status: 503, headers: corsHeaders() });
  }
}
