import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser, buildDataFilter, requireSession } from "@/lib/auth";

async function ensureSavingsCompatibility() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS savings_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID REFERENCES members(id) ON DELETE SET NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'monthly',
      holder TEXT NOT NULL DEFAULT 'Ngân hàng',
      description TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_savings_id UUID");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS savings_holder TEXT");
}

function mapSavingsRow(r: any) {
  return {
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
    updatedAt: r.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  await ensureSavingsCompatibility();
  const yearStr = request.nextUrl.searchParams.get("year");
  const year = yearStr ? Number(yearStr) : null;

  const filter = buildDataFilter(user, '', 1, 'member_id');

  const savingsQuery = year
    ? `SELECT id, member_id, year, month, amount, type, holder, description, note, created_at, updated_at FROM savings_records WHERE ${filter.where} AND year = $${filter.params.length + 1} ORDER BY month DESC, created_at DESC`
    : `SELECT id, member_id, year, month, amount, type, holder, description, note, created_at, updated_at FROM savings_records WHERE ${filter.where} ORDER BY month DESC, created_at DESC`;
  const savingsParams = year ? [...filter.params, year] : filter.params;
  const savingsResult = await pool.query(savingsQuery, savingsParams);

  const transactionSavingsQuery = `
    SELECT ('transaction-' || id::text) as id,
           member_id,
           EXTRACT(YEAR FROM COALESCE(date, created_at))::integer as year,
           EXTRACT(MONTH FROM COALESCE(date, created_at))::integer as month,
           amount,
           'monthly' as type,
           COALESCE(savings_holder, subcategory, 'Khác') as holder,
           COALESCE(NULLIF(title, ''), 'Tiết kiệm') as description,
           COALESCE(note, '') as note,
           created_at,
           created_at as updated_at
    FROM transactions
    WHERE type = 'expense'
      AND category = 'Tiết kiệm'
      AND linked_savings_id IS NULL
      AND ${filter.where}
      ${year ? `AND EXTRACT(YEAR FROM COALESCE(date, created_at)) = $${filter.params.length + 1}` : ""}
    ORDER BY EXTRACT(MONTH FROM COALESCE(date, created_at)) DESC, created_at DESC
  `;
  const transactionSavingsParams = year ? [...filter.params, year] : filter.params;
  const transactionSavingsResult = await pool.query(transactionSavingsQuery, transactionSavingsParams);

  return NextResponse.json({ data: [...savingsResult.rows, ...transactionSavingsResult.rows].map(mapSavingsRow) });
}

export async function POST(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  await ensureSavingsCompatibility();
  const item = await request.json();
  
  if (!item.id && item.type === "monthly") {
    const existingResult = await pool.query(
      `SELECT id FROM savings_records WHERE member_id IS NOT DISTINCT FROM $1 AND year = $2 AND month = $3 AND type = 'monthly' AND holder = $4`,
      [item.memberId || null, item.year, item.month, item.holder || "Ngân hàng"]
    );
    if (existingResult.rows.length > 0) {
      item.id = existingResult.rows[0].id;
    }
  }

  const id = item.id || crypto.randomUUID();

  const fields = ["id", "member_id", "year", "month", "amount", "type", "holder", "description", "note"];
  const values = [
    id,
    item.memberId || null,
    item.year,
    item.month,
    item.amount || 0,
    item.type || "monthly",
    item.holder || "Ngân hàng",
    item.description || "",
    item.note || "",
  ];

  const params = fields.map((_, i) => `$${i + 1}`).join(", ");
  const updates = fields.filter(f => f !== "id").map(f => `${f} = EXCLUDED.${f}`).join(", ");

  const result = await pool.query(
    `INSERT INTO savings_records (${fields.join(", ")}) VALUES (${params}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING *`,
    values
  );

  return NextResponse.json({ data: mapSavingsRow(result.rows[0]) }, { status: 201 });
}
