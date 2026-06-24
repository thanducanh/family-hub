import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    await pool.query(`DELETE FROM finance_adjustments WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/finance-adjustments]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}
