import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureBankRawNotesTable, normalizeBankRawNoteBody, requireBankRawNoteAccess, upsertBankRawNote } from "@/lib/bank-raw-notes";
import { bankMemberExists, canAccessBankMember } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankRawNotesTable();
    const { id } = await params;
    const existing = await requireBankRawNoteAccess(user, id);
    if (existing.error) return existing.error;
    const note = normalizeBankRawNoteBody({ ...await request.json(), id });
    if (!note.memberId || !note.title || (!note.rawText && !note.imageUrl)) return NextResponse.json({ ok: false, error: "Vui lòng nhập tiêu đề và nội dung gốc hoặc upload ảnh." }, { status: 400 });
    if (!await bankMemberExists(note.memberId)) return NextResponse.json({ ok: false, error: "Không tìm thấy thành viên." }, { status: 404 });
    if (!await canAccessBankMember(user, note.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const saved = await upsertBankRawNote(note);
    return NextResponse.json({ ok: true, data: saved });
  } catch (error) {
    console.error("[api/bank-raw-notes/:id] PUT failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankRawNotesTable();
    const { id } = await params;
    const existing = await requireBankRawNoteAccess(user, id);
    if (existing.error) return existing.error;
    await pool.query("DELETE FROM bank_raw_notes WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/bank-raw-notes/:id] DELETE failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
