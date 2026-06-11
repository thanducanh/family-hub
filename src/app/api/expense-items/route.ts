import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { pool } from "@/lib/db";

function toItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    expenseId: String(row.expense_id),
    itemName: String(row.item_name || ""),
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unit_price || 0),
    amount: Number(row.amount || 0),
  };
}

export async function GET(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const expenseId = new URL(request.url).searchParams.get("expenseId");
  const result = expenseId
    ? await pool.query("SELECT * FROM expense_items WHERE expense_id = $1 ORDER BY created_at ASC, id ASC", [expenseId])
    : await pool.query("SELECT * FROM expense_items ORDER BY created_at ASC, id ASC");
  return NextResponse.json({ ok: true, data: result.rows.map(toItem) });
}

export async function PUT(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const body = await request.json();
  const expenseId = String(body.expenseId || "");
  const items = Array.isArray(body.items) ? body.items : [];
  if (!expenseId) return NextResponse.json({ error: "Thiếu expenseId" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM expense_items WHERE expense_id = $1", [expenseId]);
    for (const raw of items) {
      const itemName = String(raw.itemName || "").trim();
      const quantity = Number(raw.quantity || 0);
      const unitPrice = Number(raw.unitPrice || 0);
      const amount = Number(raw.amount || quantity * unitPrice || 0);
      if (!itemName || amount <= 0) continue;
      await client.query(
        `INSERT INTO expense_items (id, expense_id, item_name, quantity, unit_price, amount, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [raw.id || crypto.randomUUID(), expenseId, itemName, quantity || 1, unitPrice, amount]
      );
    }
    await client.query("COMMIT");
    const result = await pool.query("SELECT * FROM expense_items WHERE expense_id = $1 ORDER BY created_at ASC, id ASC", [expenseId]);
    return NextResponse.json({ ok: true, data: result.rows.map(toItem) });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Không thể lưu chi tiết hóa đơn", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    client.release();
  }
}
