import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { canAccessBankMember } from "@/lib/bank-accounts";

const CREDIT_TYPES = new Set(["credit", "credit_card", "the tin dung", "thẻ tín dụng"]);
const ACTIVE_STATUSES = new Set(["active", "enabled", "dang dung", "đang dùng"]);

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isCreditCard(row: Record<string, unknown>) {
  return CREDIT_TYPES.has(normalizeText(row.account_type)) || CREDIT_TYPES.has(normalizeText(row.card_type));
}

function isActive(row: Record<string, unknown>) {
  return ACTIVE_STATUSES.has(normalizeText(row.status));
}

function appendNote(note: unknown, line: string) {
  const current = String(note || "").trim();
  return current ? `${current}\n${line}` : line;
}

function appendInlineNote(note: unknown, suffix: string) {
  const current = String(note || "").trim();
  return current ? `${current} | ${suffix}` : suffix;
}

async function ensureConversionColumns(client: { query: typeof pool.query }) {
  await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS converted_to_card_pending_id UUID");
  await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS excluded_from_expense BOOLEAN DEFAULT false");
  await client.query("ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS subcategory TEXT");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const bankAccountId = String(body.bank_account_id || body.bankAccountId || "").trim();

  if (!bankAccountId) {
    return NextResponse.json({ ok: false, error: "Thiếu bank_account_id." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureConversionColumns(client);

    const txResult = await client.query("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [id]);
    const tx = txResult.rows[0];
    if (!tx) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Không tìm thấy giao dịch." }, { status: 404 });
    }
    if (!await canAccessBankMember(user, String(tx.member_id || ""))) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Không có quyền với giao dịch này." }, { status: 403 });
    }
    const txType = String(tx.type || "").toLowerCase();
    if (txType && txType !== "expense") {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Chỉ có thể chuyển giao dịch chi tiêu." }, { status: 400 });
    }
    if (normalizeText(tx.category) === "thanh toan the") {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Không thể chuyển giao dịch Thanh toán thẻ." }, { status: 400 });
    }
    if (tx.converted_to_card_pending_id || tx.excluded_from_expense === true) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Giao dịch đã được chuyển hoặc đã bị loại khỏi Chi thật." }, { status: 409 });
    }

    const bankResult = await client.query("SELECT * FROM bank_accounts WHERE id = $1", [bankAccountId]);
    const bank = bankResult.rows[0];
    if (!bank) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Không tìm thấy thẻ tín dụng." }, { status: 404 });
    }
    if (!await canAccessBankMember(user, String(bank.member_id || ""))) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Không có quyền với thẻ tín dụng này." }, { status: 403 });
    }
    if (!isCreditCard(bank) || !isActive(bank)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Vui lòng chọn thẻ tín dụng đang active." }, { status: 400 });
    }

    const amount = Math.abs(Number(tx.amount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Số tiền giao dịch không hợp lệ." }, { status: 400 });
    }

    const pendingNote = appendInlineNote(tx.note, "Chuyển từ giao dịch cũ");
    const pendingResult = await client.query(
      `INSERT INTO card_pending_transactions (
        member_id, bank_account_id, title, amount, category, subcategory, note, date, status, payment_transaction_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NULL)
      RETURNING id`,
      [
        tx.member_id,
        bankAccountId,
        tx.title || "Giao dịch cũ",
        amount,
        tx.category || "Khác",
        tx.subcategory || null,
        pendingNote,
        tx.date,
      ]
    );

    const pendingId = pendingResult.rows[0].id;
    const cardName = [bank.display_name, bank.product_name, bank.bank_name].find(value => String(value || "").trim()) || "thẻ tín dụng";
    const convertedNote = appendNote(tx.note, `Đã chuyển sang tạm tính thẻ tín dụng: ${cardName}`);

    await client.query(
      `UPDATE transactions
       SET converted_to_card_pending_id = $1,
           excluded_from_expense = true,
           note = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [pendingId, convertedNote, id]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, data: { pendingId } });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[POST /api/transactions/:id/convert-to-card-pending]", error);
    return NextResponse.json({ ok: false, error: "Không thể chuyển giao dịch sang tạm tính thẻ." }, { status: 500 });
  } finally {
    client.release();
  }
}
