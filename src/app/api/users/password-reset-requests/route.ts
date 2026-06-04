import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { canManage } from "@/lib/user-admin";

async function handleGet() {
  const actor = await getSessionUser();
  if (!actor || actor.role !== "full_access") return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const result = await pool.query(
    `SELECT request.id, request.user_id, request.username_or_email, request.status, request.requested_at,
            users.username, users.display_name, users.role
     FROM password_reset_requests request
     JOIN users ON users.id = request.user_id
     WHERE request.status = 'pending'
     ORDER BY request.requested_at DESC`,
  );
  return NextResponse.json({ requests: result.rows.filter(row => canManage(actor, row.role)).map(row => ({
    id: row.id, userId: row.user_id, usernameOrEmail: row.username_or_email, status: row.status,
    requestedAt: row.requested_at, username: row.username, displayName: row.display_name, role: row.role,
  })) });
}

async function handlePost(request: NextRequest) {
  const actor = await getSessionUser();
  if (!actor || actor.role !== "full_access") return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const { id, password } = await request.json() as { id?: string; password?: string };
  if (!id || !password || password.length < 6) return NextResponse.json({ error: "Mật khẩu tạm cần ít nhất 6 ký tự." }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT request.user_id, users.role
       FROM password_reset_requests request
       JOIN users ON users.id = request.user_id
       WHERE request.id = $1 AND request.status = 'pending'
       FOR UPDATE`,
      [id],
    );
    const target = result.rows[0];
    if (!target || !canManage(actor, target.role)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Không thể xử lý yêu cầu này." }, { status: 403 });
    }
    const hash = await bcrypt.hash(password, 12);
    await client.query("UPDATE users SET password_hash=$2, password_plain=$3, must_change_password=TRUE, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [target.user_id, hash, password]);
    await client.query("UPDATE password_reset_requests SET status='completed', handled_by=$2, handled_at=CURRENT_TIMESTAMP WHERE id=$1", [id, actor.id]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[api/users/password-reset-requests] POST failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET() {
  try { return await handleGet(); }
  catch (error) {
    console.error("[api/users/password-reset-requests] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try { return await handlePost(request); }
  catch (error) {
    console.error("[api/users/password-reset-requests] POST failed before transaction", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
