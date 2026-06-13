import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureMemberSimsTable, normalizeMemberSimBody, requireMemberSimAccess, upsertMemberSim, validateMemberSimAccess } from "@/lib/member-sims";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();
    const { id } = await props.params;
    const existing = await requireMemberSimAccess(user, id);
    if (existing.error) return existing.error;
    const sim = normalizeMemberSimBody({ ...await request.json(), id });
    const accessError = await validateMemberSimAccess(user, sim);
    if (accessError) return accessError;
    const saved = await upsertMemberSim(sim);
    return NextResponse.json({ ok: true, data: saved });
  } catch (error) {
    console.error("[api/member-sims/:id] PUT failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();
    const { id } = await props.params;
    const existing = await requireMemberSimAccess(user, id);
    if (existing.error) return existing.error;
    await pool.query("DELETE FROM member_sims WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/member-sims/:id] DELETE failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
