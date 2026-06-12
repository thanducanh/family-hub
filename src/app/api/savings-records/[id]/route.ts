import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  
  const { id } = await params;
  const item = await request.json();
  
  const fields = ["member_id", "year", "month", "amount", "type", "holder", "description", "note"];
  const values = [
    item.memberId || null,
    item.year,
    item.month,
    item.amount || 0,
    item.type || 'monthly',
    item.holder || 'Ngân hàng',
    item.description || '',
    item.note || '',
    id
  ];
  
  const updates = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
  
  const result = await pool.query(
    `UPDATE savings_records SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = $${fields.length + 1} RETURNING *`,
    values
  );
  
  if (result.rowCount === 0) return NextResponse.json({ error: "Không tìm thấy dữ liệu" }, { status: 404 });
  
  const r = result.rows[0];
  return NextResponse.json({
    data: {
      id: r.id,
      memberId: r.member_id,
      year: r.year,
      month: r.month,
      amount: Number(r.amount),
      type: r.type,
      holder: r.holder,
      description: r.description,
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  
  const { id } = await params;
  await pool.query("DELETE FROM savings_records WHERE id = $1", [id]);
  
  return NextResponse.json({ ok: true });
}
