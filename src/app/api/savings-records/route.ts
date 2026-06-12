import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  
  const yearStr = request.nextUrl.searchParams.get("year");
  let query = "SELECT id, member_id, year, month, amount, type, holder, description, note, created_at, updated_at FROM savings_records";
  const params: any[] = [];
  
  if (yearStr) {
    query += " WHERE year = $1";
    params.push(Number(yearStr));
  }
  
  query += " ORDER BY month DESC, created_at DESC";
  
  const result = await pool.query(query, params);
  
  const mapped = result.rows.map(r => ({
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
  }));
  
  return NextResponse.json({ data: mapped });
}

export async function POST(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  
  const item = await request.json();
  const id = item.id || crypto.randomUUID();
  
  const fields = ["id", "member_id", "year", "month", "amount", "type", "holder", "description", "note"];
  const values = [
    id,
    item.memberId || null,
    item.year,
    item.month,
    item.amount || 0,
    item.type || 'monthly',
    item.holder || 'Ngân hàng',
    item.description || '',
    item.note || ''
  ];
  
  const params = fields.map((_, i) => `$${i + 1}`).join(", ");
  const updates = fields.filter(f => f !== "id").map(f => `${f} = EXCLUDED.${f}`).join(", ");
  
  const result = await pool.query(
    `INSERT INTO savings_records (${fields.join(", ")}) VALUES (${params}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING *`,
    values
  );
  
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
  }, { status: 201 });
}
