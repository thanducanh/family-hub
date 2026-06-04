import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { canManage } from "@/lib/user-admin";

export async function POST(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor || actor.role !== "full_access") return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const { id, password } = await request.json() as { id?: string; password?: string };
    if (!id || !password || password.length < 6) return NextResponse.json({ ok: false, error: "Mật khẩu mới cần ít nhất 6 ký tự." }, { status: 400 });
    const existing = await pool.query("SELECT role FROM users WHERE id = $1", [id]);
    const target = existing.rows[0];
    if (!target || !canManage(actor, target.role)) return NextResponse.json({ ok: false, error: "Không thể reset user này." }, { status: 403 });
    const hash = await bcrypt.hash(password, 12);
    await pool.query("UPDATE users SET password_hash=$2, password_plain=$3, must_change_password=TRUE, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [id, hash, password]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/users/reset-password] POST failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
