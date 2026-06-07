import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import type { MemberJob, MemberJobStatus } from "@/types";

const fields = "id, member_id, title, company, position, start_date, end_date, status, monthly_salary, salary_by_month, note, created_at, updated_at";
const statuses = new Set(["active", "ended"]);

function text(value: unknown) {
  return String(value || "").trim();
}

function dateText(value: unknown) {
  const valueText = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(valueText) ? valueText : "";
}

function moneyValue(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function salaryMap(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key)).map(([key, amount]) => [key, moneyValue(amount)]));
}

function toMemberJob(row: Record<string, unknown>): MemberJob {
  const salary = row.salary_by_month;
  return {
    id: String(row.id),
    memberId: String(row.member_id || ""),
    title: String(row.title || ""),
    company: String(row.company || ""),
    position: String(row.position || ""),
    startDate: row.start_date instanceof Date ? row.start_date.toISOString().slice(0, 10) : String(row.start_date || "").slice(0, 10),
    endDate: row.end_date instanceof Date ? row.end_date.toISOString().slice(0, 10) : String(row.end_date || "").slice(0, 10),
    status: statuses.has(String(row.status)) ? String(row.status) as MemberJobStatus : "active",
    monthlySalary: Number(row.monthly_salary || 0),
    salaryByMonth: salary && typeof salary === "object" ? salaryMap(salary) : {},
    note: String(row.note || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

async function canAccessMember(memberId: string, userId: string, role: string, sessionMemberId?: string) {
  if (!memberId) return false;
  if (role === "full_access") return Boolean((await pool.query("SELECT id FROM members WHERE id=$1 AND deleted_at IS NULL", [memberId])).rows[0]);
  const linked = sessionMemberId || (await pool.query("SELECT member_id FROM users WHERE id=$1", [userId])).rows[0]?.member_id;
  return linked === memberId;
}

function payload(body: Record<string, unknown>) {
  const status = statuses.has(text(body.status)) ? text(body.status) as MemberJobStatus : "active";
  return {
    memberId: text(body.memberId || body.member_id),
    title: text(body.title),
    company: text(body.company),
    position: text(body.position),
    startDate: dateText(body.startDate || body.start_date),
    endDate: dateText(body.endDate || body.end_date),
    status,
    monthlySalary: moneyValue(body.monthlySalary ?? body.monthly_salary),
    salaryByMonth: salaryMap(body.salaryByMonth || body.salary_by_month),
    note: text(body.note),
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const result = await pool.query(`SELECT ${fields} FROM member_jobs WHERE id=$1`, [id]);
      const row = result.rows[0];
      if (!row) return NextResponse.json({ ok: false, error: "Không tìm thấy công việc." }, { status: 404 });
      if (!await canAccessMember(String(row.member_id), actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
      return NextResponse.json({ ok: true, data: toMemberJob(row) });
    }
    const memberId = request.nextUrl.searchParams.get("memberId") || actor.memberId || "";
    if (!await canAccessMember(memberId, actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const result = await pool.query(`SELECT ${fields} FROM member_jobs WHERE member_id=$1 ORDER BY start_date DESC, created_at DESC`, [memberId]);
    return NextResponse.json({ ok: true, data: result.rows.map(toMemberJob) });
  } catch (error) {
    console.error("[api/member-jobs] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const body = payload(await request.json() as Record<string, unknown>);
    if (!body.memberId || !body.title || !body.company || !body.position || !body.startDate) return NextResponse.json({ ok: false, error: "Vui lòng nhập đủ công việc, công ty, chức vụ và ngày bắt đầu." }, { status: 400 });
    if (!await canAccessMember(body.memberId, actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const result = await pool.query(
      `INSERT INTO member_jobs (member_id, title, company, position, start_date, end_date, status, monthly_salary, salary_by_month, note, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,NOW(),NOW()) RETURNING ${fields}`,
      [body.memberId, body.title, body.company, body.position, body.startDate, body.endDate || null, body.status, body.monthlySalary, JSON.stringify(body.salaryByMonth), body.note]
    );
    return NextResponse.json({ ok: true, data: toMemberJob(result.rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("[api/member-jobs] POST failed", error);
    return NextResponse.json({ ok: false, error: "Không thể lưu công việc." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id") || text((await request.clone().json() as Record<string, unknown>).id);
    if (!id) return NextResponse.json({ ok: false, error: "Thiếu id công việc." }, { status: 400 });
    const current = await pool.query("SELECT member_id FROM member_jobs WHERE id=$1", [id]);
    if (!current.rows[0]) return NextResponse.json({ ok: false, error: "Không tìm thấy công việc." }, { status: 404 });
    if (!await canAccessMember(String(current.rows[0].member_id), actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const body = payload(await request.json() as Record<string, unknown>);
    if (!body.title || !body.company || !body.position || !body.startDate) return NextResponse.json({ ok: false, error: "Vui lòng nhập đủ công việc, công ty, chức vụ và ngày bắt đầu." }, { status: 400 });
    const result = await pool.query(
      `UPDATE member_jobs SET title=$2, company=$3, position=$4, start_date=$5, end_date=$6, status=$7, monthly_salary=$8, salary_by_month=$9::jsonb, note=$10, updated_at=NOW()
       WHERE id=$1 RETURNING ${fields}`,
      [id, body.title, body.company, body.position, body.startDate, body.endDate || null, body.status, body.monthlySalary, JSON.stringify(body.salaryByMonth), body.note]
    );
    return NextResponse.json({ ok: true, data: toMemberJob(result.rows[0]) });
  } catch (error) {
    console.error("[api/member-jobs] PATCH failed", error);
    return NextResponse.json({ ok: false, error: "Không thể cập nhật công việc." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Thiếu id công việc." }, { status: 400 });
    const current = await pool.query("SELECT member_id FROM member_jobs WHERE id=$1", [id]);
    if (!current.rows[0]) return NextResponse.json({ ok: false, error: "Không tìm thấy công việc." }, { status: 404 });
    if (!await canAccessMember(String(current.rows[0].member_id), actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    await pool.query("DELETE FROM member_jobs WHERE id=$1", [id]);
    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    console.error("[api/member-jobs] DELETE failed", error);
    return NextResponse.json({ ok: false, error: "Không thể xóa công việc." }, { status: 500 });
  }
}
