import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, type UserRole } from "@/lib/auth";
import { pool } from "@/lib/db";
import { canManage, toPublicUser } from "@/lib/user-admin";

const select = "id, username, email, display_name, avatar, role, active, must_change_password, is_system, member_id, created_at, updated_at";

function serverError(action: string, error: unknown) {
  console.error(`[api/users] ${action} failed`, error);
  return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
}

async function memberAssignmentError(memberId: string | undefined, userId = "") {
  if (!memberId) return "";
  const member = await pool.query("SELECT id FROM members WHERE id = $1 AND deleted_at IS NULL", [memberId]);
  if (!member.rows[0]) return "Không tìm thấy thành viên để liên kết.";
  const assigned = userId
    ? await pool.query("SELECT id FROM users WHERE member_id = $1 AND id <> $2", [memberId, userId])
    : await pool.query("SELECT id FROM users WHERE member_id = $1", [memberId]);
  return assigned.rows[0] ? "Thành viên này đã được liên kết với tài khoản khác." : "";
}

export async function GET() {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    if (actor.role === "full_access") {
      const result = await pool.query(`SELECT id, username, email, display_name, avatar, role, active, must_change_password, is_system, member_id, password_plain, created_at, updated_at FROM users ORDER BY is_system DESC, created_at`);
      return NextResponse.json({
        ok: true,
        users: result.rows.map(row => ({
          ...toPublicUser(row),
          passwordPlain: row.password_plain ? String(row.password_plain) : null
        }))
      });
    } else {
      const result = await pool.query(`SELECT id, username, email, display_name, avatar, role, active, must_change_password, is_system, member_id, password_plain, created_at, updated_at FROM users WHERE id = $1`, [actor.id]);
      return NextResponse.json({
        ok: true,
        users: result.rows.map(row => ({
          ...toPublicUser(row),
          passwordPlain: row.password_plain ? String(row.password_plain) : null
        }))
      });
    }
  } catch (error) {
    return serverError("GET", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor || actor.role !== "full_access") return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const body = await request.json() as { username?: string; email?: string; displayName?: string; avatar?: string; role?: UserRole; password?: string; memberId?: string };
    const role = body.role ?? "self_only";
    if (!body.username || !body.displayName || !body.password || !canManage(actor, role)) return NextResponse.json({ ok: false, error: "Dữ liệu hoặc quyền không hợp lệ." }, { status: 400 });
    const assignmentError = await memberAssignmentError(body.memberId);
    if (assignmentError) return NextResponse.json({ ok: false, error: assignmentError }, { status: 409 });
    
    const hash = await bcrypt.hash(body.password, 12);
    const result = await pool.query(`INSERT INTO users (username, email, display_name, avatar, role, password_hash, password_plain, active, must_change_password, is_system, member_id) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,TRUE,FALSE,$8) RETURNING ${select}`, [body.username.trim(), body.email?.trim() || null, body.displayName.trim(), body.avatar || "", role, hash, body.password, body.memberId || null]);
    const user = toPublicUser(result.rows[0]);
    return NextResponse.json({ ok: true, data: user, user }, { status: 201 });
  } catch (error) {
    console.error("[api/users] POST failed", error);
    return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
      ? NextResponse.json({ ok: false, error: "Username hoặc email đã tồn tại." }, { status: 409 })
      : NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor || actor.role !== "full_access") return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const body = await request.json() as { id?: string; username?: string; email?: string; displayName?: string; avatar?: string; role?: UserRole; active?: boolean; memberId?: string; password?: string };
    const existing = await pool.query("SELECT id, role, is_system, member_id FROM users WHERE id = $1", [body.id]);
    const target = existing.rows[0];
    if (!body.username?.trim() || !body.displayName || !body.role || typeof body.active !== "boolean" || !canManage(actor, body.role)) return NextResponse.json({ ok: false, error: "Dữ liệu hoặc quyền không hợp lệ." }, { status: 400 });
    if (!target || !canManage(actor, target.role)) return NextResponse.json({ ok: false, error: "Không có quyền sửa user này." }, { status: 403 });
    if (target.is_system) {
      if (body.username.trim() !== "admin" || body.role !== "full_access" || body.active === false) return NextResponse.json({ ok: false, error: "Không thể đổi username, hạ quyền hoặc vô hiệu hóa admin hệ thống." }, { status: 400 });
      if (target.member_id && !body.memberId) return NextResponse.json({ ok: false, error: "Không thể bỏ liên kết hồ sơ thành viên của admin hệ thống." }, { status: 400 });
    }
    const assignmentError = await memberAssignmentError(body.memberId, body.id);
    if (assignmentError) return NextResponse.json({ ok: false, error: assignmentError }, { status: 409 });
    if (body.password && body.password.length < 6) return NextResponse.json({ ok: false, error: "Mật khẩu mới cần ít nhất 6 ký tự." }, { status: 400 });
    
    let result;
    if (body.password) {
      const hash = await bcrypt.hash(body.password, 12);
      const values = [body.id, body.username.trim(), body.email?.trim() || null, body.displayName, body.avatar || "", body.role, body.active, body.memberId || null, hash, body.password];
      result = await pool.query(`UPDATE users SET username=$2, email=$3, display_name=$4, avatar=$5, role=$6, active=$7, member_id=$8, password_hash=$9, password_plain=$10, must_change_password=TRUE, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING ${select}`, values);
    } else {
      const values = [body.id, body.username.trim(), body.email?.trim() || null, body.displayName, body.avatar || "", body.role, body.active, body.memberId || null];
      result = await pool.query(`UPDATE users SET username=$2, email=$3, display_name=$4, avatar=$5, role=$6, active=$7, member_id=$8, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING ${select}`, values);
    }
    const user = toPublicUser(result.rows[0]);
    return NextResponse.json({ ok: true, data: user, user });
  } catch (error) {
    console.error("[api/users] PUT failed", error);
    return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
      ? NextResponse.json({ ok: false, error: "Username đã tồn tại hoặc thành viên đã được liên kết." }, { status: 409 })
      : NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor || actor.role !== "full_access") return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const id = new URL(request.url).searchParams.get("id");
    const existing = await pool.query("SELECT role, is_system FROM users WHERE id = $1", [id]);
    const target = existing.rows[0];
    if (!target || target.is_system || !canManage(actor, target.role)) return NextResponse.json({ ok: false, error: "Không thể xóa user này." }, { status: 403 });
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("DELETE", error);
  }
}
