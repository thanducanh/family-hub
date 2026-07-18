import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Không có ID nào được chọn" }, { status: 400 });
    }

    // Xóa an toàn: Dùng ANY($1) và check đúng member_id
    await pool.query(
      `DELETE FROM transactions WHERE id = ANY($1) AND member_id = $2`, 
      [ids, user.id]
    );

    return NextResponse.json({ ok: true, message: "Đã xóa thành công" });
  } catch (error) {
    console.error("[POST /api/transactions/bulk-delete]", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi xóa" }, { status: 500 });
  }
}