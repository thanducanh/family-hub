import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import type { IncomeCategory } from "@/types";

const categories = new Set(["Lương", "Thưởng", "Khác"]);

function text(value: unknown) {
  return String(value || "").trim();
}

function moneyValue(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function normalizeYearlyPayload(item: Record<string, unknown>) {
  const category = categories.has(text(item.category)) ? text(item.category) as IncomeCategory : "Khác";
  return {
    id: text(item.id) || crypto.randomUUID(),
    year: Number(item.year) || new Date().getFullYear(),
    category,
    name: text(item.name) || category,
    amount: moneyValue(item.amount),
    note: text(item.note),
  };
}

export async function POST(request: NextRequest) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const body = await request.json() as Record<string, unknown> | Record<string, unknown>[];
  const rows = (Array.isArray(body) ? body : Array.isArray(body.rows) ? body.rows as Record<string, unknown>[] : [body]).map(normalizeYearlyPayload);
  if (!rows.length || rows.some(row => !row.name)) return NextResponse.json({ ok: false, error: "Thiếu tên khoản thu." }, { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const saved = [];
    for (const row of rows) {
      const result = await client.query(`INSERT INTO income_yearly_summaries
        (id, member_id, year, category, name, amount, note)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *`, [row.id, actor.memberId || null, row.year, row.category, row.name, row.amount, row.note]);
      saved.push(result.rows[0]);
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, data: saved }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[POST /api/incomes-yearly]", error);
    return NextResponse.json({ ok: false, error: "Không thể lưu tổng thu năm." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(request: NextRequest) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const row = normalizeYearlyPayload({ ...(await request.json() as Record<string, unknown>), id });
  if (!row.id || !row.name) return NextResponse.json({ ok: false, error: "Thiếu id hoặc tên khoản thu." }, { status: 400 });
  const result = await pool.query(`UPDATE income_yearly_summaries SET
    member_id=$2, year=$3, category=$4, name=$5, amount=$6, note=$7, updated_at=CURRENT_TIMESTAMP
    WHERE id=$1 RETURNING *`, [row.id, actor.memberId || null, row.year, row.category, row.name, row.amount, row.note]);
  if (!result.rows[0]) return NextResponse.json({ ok: false, error: "Không tìm thấy dòng thu nhập." }, { status: 404 });
  return NextResponse.json({ ok: true, data: result.rows[0] });
}

export async function DELETE(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Thiếu id." }, { status: 400 });
  await pool.query("DELETE FROM income_yearly_summaries WHERE id = $1", [id]);
  return NextResponse.json({ ok: true, data: { deleted: true } });
}
