import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { bankRawNoteFields, bankRawNotesFromRows, ensureBankRawNotesTable, normalizeBankRawNoteBody, upsertBankRawNote } from "@/lib/bank-raw-notes";
import { bankMemberExists, canAccessBankMember } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankRawNotesTable();
    const result = user.role === "full_access"
      ? await pool.query(`SELECT ${bankRawNoteFields} FROM bank_raw_notes ORDER BY updated_at DESC`)
      : await pool.query(`SELECT ${bankRawNoteFields} FROM bank_raw_notes WHERE member_id = $1 ORDER BY updated_at DESC`, [user.memberId || "00000000-0000-0000-0000-000000000000"]);
    return NextResponse.json({ ok: true, data: bankRawNotesFromRows(result.rows) });
  } catch (error) {
    console.error("[api/bank-raw-notes] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankRawNotesTable();
    const note = normalizeBankRawNoteBody(await request.json());
    if (!note.memberId || !note.title || (!note.rawText && !note.imageUrl)) return NextResponse.json({ ok: false, error: "Vui lòng nhập tiêu đề và nội dung gốc hoặc upload ảnh." }, { status: 400 });
    if (!await bankMemberExists(note.memberId)) return NextResponse.json({ ok: false, error: "Không tìm thấy thành viên." }, { status: 404 });
    if (!await canAccessBankMember(user, note.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const saved = await upsertBankRawNote(note);
    return NextResponse.json({ ok: true, data: saved }, { status: 201 });
  } catch (error) {
    console.error("[api/bank-raw-notes] POST failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
