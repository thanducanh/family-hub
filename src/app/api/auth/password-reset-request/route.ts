import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { usernameOrEmail } = await request.json() as { usernameOrEmail?: string };
    const value = usernameOrEmail?.trim();
    if (!value) return NextResponse.json({ ok: false, error: "Vui lòng nhập username hoặc email." }, { status: 400 });
    const user = await pool.query("SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)", [value]);
    if (user.rows[0]) {
      await pool.query(
        `INSERT INTO password_reset_requests (user_id, username_or_email)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM password_reset_requests WHERE user_id = $1 AND status = 'pending'
         )`,
        [user.rows[0].id, value],
      );
    }
    return NextResponse.json({ ok: true, message: "Yêu cầu đã được gửi đến quản trị viên." });
  } catch (error) {
    console.error("[api/auth/password-reset-request] POST failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
