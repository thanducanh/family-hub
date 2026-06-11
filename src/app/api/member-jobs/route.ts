import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import type { MemberJob, MemberJobStatus } from "@/types";

const fields = "id, member_id, title, company, start_year, end_year, status, note, created_at, updated_at";
const statuses = new Set(["active", "ended"]);

function text(value: unknown) {
  return String(value || "").trim();
}

function yearValue(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
}

function toMemberJob(row: Record<string, unknown>): MemberJob {
  const status = statuses.has(String(row.status)) ? String(row.status) as MemberJobStatus : "active";
  return {
    id: String(row.id),
    memberId: String(row.member_id || ""),
    title: String(row.title || ""),
    company: String(row.company || ""),
    startYear: row.start_year === null || row.start_year === undefined ? null : Number(row.start_year),
    endYear: status === "active" || row.end_year === null || row.end_year === undefined ? null : Number(row.end_year),
    status,
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
  const startYear = yearValue(body.startYear ?? body.start_year);
  const endYear = status === "active" ? null : yearValue(body.endYear ?? body.end_year);
  return {
    memberId: text(body.memberId || body.member_id),
    title: text(body.title),
    company: text(body.company),
    startYear,
    endYear,
    status,
    note: text(body.note),
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chua dang nhap." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const result = await pool.query(`SELECT ${fields} FROM member_jobs WHERE id=$1`, [id]);
      const row = result.rows[0];
      if (!row) return NextResponse.json({ ok: false, error: "Khong tim thay cong viec." }, { status: 404 });
      if (!await canAccessMember(String(row.member_id), actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Khong co quyen." }, { status: 403 });
      return NextResponse.json({ ok: true, data: toMemberJob(row) });
    }
    const memberId = request.nextUrl.searchParams.get("memberId") || actor.memberId || "";
    if (!await canAccessMember(memberId, actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Khong co quyen." }, { status: 403 });
    const result = await pool.query(`SELECT ${fields} FROM member_jobs WHERE member_id=$1 ORDER BY start_year DESC NULLS LAST, created_at DESC`, [memberId]);
    return NextResponse.json({ ok: true, data: result.rows.map(toMemberJob) });
  } catch (error) {
    console.error("[api/member-jobs] GET failed", error);
    return NextResponse.json({ ok: false, error: "Loi may chu. Vui long thu lai." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chua dang nhap." }, { status: 401 });
    const body = payload(await request.json() as Record<string, unknown>);
    if (!body.memberId || !body.title || !body.company || !body.startYear) return NextResponse.json({ ok: false, error: "Vui long nhap du ten cong viec, cong ty va nam bat dau." }, { status: 400 });
    if (!await canAccessMember(body.memberId, actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Khong co quyen." }, { status: 403 });
    const result = await pool.query(
      `INSERT INTO member_jobs (member_id, title, company, start_year, end_year, status, note, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING ${fields}`,
      [body.memberId, body.title, body.company, body.startYear, body.endYear, body.status, body.note]
    );
    return NextResponse.json({ ok: true, data: toMemberJob(result.rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("[api/member-jobs] POST failed", error);
    return NextResponse.json({ ok: false, error: "Khong the luu cong viec." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chua dang nhap." }, { status: 401 });
    const requestBody = await request.json() as Record<string, unknown>;
    const id = request.nextUrl.searchParams.get("id") || text(requestBody.id);
    if (!id) return NextResponse.json({ ok: false, error: "Thieu id cong viec." }, { status: 400 });
    const current = await pool.query("SELECT member_id FROM member_jobs WHERE id=$1", [id]);
    if (!current.rows[0]) return NextResponse.json({ ok: false, error: "Khong tim thay cong viec." }, { status: 404 });
    if (!await canAccessMember(String(current.rows[0].member_id), actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Khong co quyen." }, { status: 403 });
    const body = payload(requestBody);
    if (!body.title || !body.company || !body.startYear) return NextResponse.json({ ok: false, error: "Vui long nhap du ten cong viec, cong ty va nam bat dau." }, { status: 400 });
    const result = await pool.query(
      `UPDATE member_jobs SET title=$2, company=$3, start_year=$4, end_year=$5, status=$6, note=$7, updated_at=NOW()
       WHERE id=$1 RETURNING ${fields}`,
      [id, body.title, body.company, body.startYear, body.endYear, body.status, body.note]
    );
    return NextResponse.json({ ok: true, data: toMemberJob(result.rows[0]) });
  } catch (error) {
    console.error("[api/member-jobs] PATCH failed", error);
    return NextResponse.json({ ok: false, error: "Khong the cap nhat cong viec." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chua dang nhap." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Thieu id cong viec." }, { status: 400 });
    const current = await pool.query("SELECT member_id FROM member_jobs WHERE id=$1", [id]);
    if (!current.rows[0]) return NextResponse.json({ ok: false, error: "Khong tim thay cong viec." }, { status: 404 });
    if (!await canAccessMember(String(current.rows[0].member_id), actor.id, actor.role, actor.memberId)) return NextResponse.json({ ok: false, error: "Khong co quyen." }, { status: 403 });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE income_records SET job_id = NULL, work_id = NULL WHERE job_id=$1 OR work_id=$1", [id]);
      await client.query("DELETE FROM member_jobs WHERE id=$1", [id]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (error) {
    console.error("[api/member-jobs] DELETE failed", error);
    return NextResponse.json({ ok: false, error: "Khong the xoa cong viec." }, { status: 500 });
  }
}
