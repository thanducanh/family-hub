import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ensureMemberSimsTable } from "@/lib/member-sims";

export type Collection = "members" | "tasks" | "transactions" | "events" | "notes";

const columns: Record<Collection, string[]> = {
  members: ["id", "name", "nickname", "birthday", "gender", "role", "phone", "avatar", "avatar_url", "notes", "color"],
  tasks: ["id", "title", "member_id", "assignee", "due", "due_date_ui", "priority", "status"],
  transactions: ["id", "title", "member_id", "amount", "gross_amount", "discount_amount", "type", "category", "subcategory", "date", "transaction_time", "note", "bank_account_id", "payment_account_id", "sim_id", "sim_topup_applied", "savings_applied", "savings_holder", "linked_savings_id", "estimated_cashback", "actual_cashback", "payment_method", "is_reimbursable", "reimbursement_person", "reimbursement_status", "reimbursed_amount", "reimbursed_at", "counts_for_personal_expense", "counts_for_card_spending"],
  events: ["id", "title", "member_id", "type", "date", "time", "color", "event_date"],
  notes: ["id", "title", "member_id", "kind", "important", "tag", "content", "updated_at"],
};

async function ensureCollectionSchema(collection: Collection) {
  if (collection !== "transactions") return;
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash'");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL");
  await ensureMemberSimsTable();
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sim_id UUID REFERENCES member_sims(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sim_topup_applied BOOLEAN DEFAULT false");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS savings_applied BOOLEAN DEFAULT false");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS savings_holder TEXT");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_savings_id UUID");
  await pool.query(`CREATE TABLE IF NOT EXISTS savings_records (
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
  )`);
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_time TIME");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursement_person TEXT");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursement_status TEXT NOT NULL DEFAULT 'none'");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursed_amount NUMERIC NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursed_at DATE");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counts_for_personal_expense BOOLEAN NOT NULL DEFAULT TRUE");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counts_for_card_spending BOOLEAN NOT NULL DEFAULT TRUE");
  await pool.query("UPDATE transactions SET is_reimbursable = TRUE, reimbursement_status = COALESCE(NULLIF(reimbursement_status, 'none'), 'pending'), reimbursed_amount = COALESCE(reimbursed_amount, 0), counts_for_personal_expense = FALSE, counts_for_card_spending = TRUE WHERE category = 'Thanh toán hộ'");
  await pool.query("UPDATE transactions SET is_reimbursable = FALSE, counts_for_personal_expense = FALSE, counts_for_card_spending = FALSE WHERE category = 'Tiết kiệm'");
  await pool.query("UPDATE transactions SET payment_account_id = bank_account_id WHERE payment_account_id IS NULL AND bank_account_id IS NOT NULL");
}

function toDb(collection: Collection, item: Record<string, unknown>) {
  if (collection === "notes") return { ...item, member_id: item.memberId || null, updated_at: item.updatedAt };
  if (collection === "members") {
    const avatar = item.avatarUrl ?? item.avatar ?? "";
    return { ...item, birthday: toDatabaseDate(item.birthday), avatar, avatar_url: avatar };
  }
  if (collection === "tasks") return { ...item, member_id: item.memberId || null, due_date_ui: toDatabaseDate(item.dueDate) };
  if (collection === "transactions") {
    const paymentAccountId = item.paymentAccountId || item.payment_account_id || item.bankAccountId || item.bank_account_id || null;
    const savingsApplied = String(item.category || "") === "Tiết kiệm" && String(item.type || "") === "expense";
    
    let counts_for_personal_expense = item.countsForPersonalExpense ?? item.counts_for_personal_expense ?? true;
    let counts_for_card_spending = item.countsForCardSpending ?? item.counts_for_card_spending ?? true;
    let is_reimbursable = item.isReimbursable ?? item.is_reimbursable ?? false;
    let reimbursement_status = item.reimbursementStatus ?? item.reimbursement_status ?? 'none';
    
    if (item.category === 'Thanh toán hộ') {
      counts_for_personal_expense = false;
      counts_for_card_spending = true;
      is_reimbursable = true;
      reimbursement_status = item.reimbursementStatus ?? item.reimbursement_status ?? 'pending';
    } else if (item.category === 'Tiết kiệm') {
      counts_for_personal_expense = false;
      counts_for_card_spending = false;
    }
    
    return { 
      ...item, 
      member_id: item.memberId || null, 
      gross_amount: item.grossAmount || item.amount, 
      discount_amount: item.discountAmount || 0, 
      date: toDatabaseDate(item.date), 
      transaction_time: item.transactionTime || item.transaction_time || null, 
      bank_account_id: paymentAccountId, 
      payment_account_id: paymentAccountId, 
      sim_id: item.simId || item.sim_id || null, 
      sim_topup_applied: Boolean(item.simTopupApplied || item.sim_topup_applied), 
      savings_applied: Boolean(item.savingsApplied || item.savings_applied || savingsApplied), 
      savings_holder: item.savingsHolder || item.savings_holder || item.subcategory || null, 
      linked_savings_id: item.linkedSavingsId || item.linked_savings_id || null, 
      estimated_cashback: item.estimatedCashback || 0, 
      actual_cashback: item.actualCashback || 0, 
      payment_method: item.paymentMethod || item.payment_method || "cash",
      is_reimbursable,
      reimbursement_person: item.reimbursementPerson || item.reimbursement_person || null,
      reimbursement_status,
      reimbursed_amount: item.reimbursedAmount || item.reimbursed_amount || 0,
      reimbursed_at: toDatabaseDate(item.reimbursedAt || item.reimbursed_at),
      counts_for_personal_expense,
      counts_for_card_spending
    };
  }
  if (collection === "events") {
    const date = toDatabaseDate(item.date);
    return { ...item, member_id: item.memberId || null, date, event_date: date ? `${date}T${item.time || "00:00"}:00` : null };
  }
  return item;
}
function fromDb(collection: Collection, item: Record<string, unknown>) {
  if (collection === "notes") {
    const { updated_at, member_id, ...rest } = item;
    return { ...rest, memberId: member_id || "", updatedAt: updated_at };
  }
  if (collection === "tasks") {
    const { member_id, due_date_ui, ...rest } = item;
    return { ...rest, memberId: member_id || "", dueDate: due_date_ui || "" };
  }
  if (collection === "transactions") {
    const { member_id, bank_account_id, payment_account_id, sim_id, sim_topup_applied, savings_applied, savings_holder, linked_savings_id, gross_amount, discount_amount, estimated_cashback, actual_cashback, created_at, payment_method, transaction_time, category, is_reimbursable, reimbursement_person, reimbursement_status, reimbursed_amount, reimbursed_at, counts_for_personal_expense, counts_for_card_spending, ...rest } = item as any;
    const mappedCategory = category === "Nhà cửa & sinh hoạt" ? "Sinh hoạt" : category;
    const paymentAccountId = payment_account_id || bank_account_id || "";
    return { ...rest, category: mappedCategory, memberId: member_id || "", grossAmount: Number(gross_amount || rest.amount || 0), discountAmount: Number(discount_amount || 0), bankAccountId: paymentAccountId, paymentAccountId, payment_account_id: paymentAccountId, bank_account_id: paymentAccountId, simId: sim_id || "", sim_id: sim_id || "", simTopupApplied: Boolean(sim_topup_applied), sim_topup_applied: Boolean(sim_topup_applied), savingsApplied: Boolean(savings_applied), savings_applied: Boolean(savings_applied), savingsHolder: savings_holder || "", savings_holder: savings_holder || "", linkedSavingsId: linked_savings_id || "", linked_savings_id: linked_savings_id || "", transactionTime: transaction_time || "", transaction_time: transaction_time || "", estimatedCashback: Number(estimated_cashback || 0), actualCashback: Number(actual_cashback || 0), createdAt: created_at, paymentMethod: payment_method || "cash", payment_method: payment_method || "cash", isReimbursable: Boolean(is_reimbursable), reimbursementPerson: reimbursement_person || "", reimbursementStatus: reimbursement_status || "none", reimbursedAmount: Number(reimbursed_amount || 0), reimbursedAt: reimbursed_at || "", countsForPersonalExpense: counts_for_personal_expense !== false, countsForCardSpending: counts_for_card_spending !== false };
  }
  if (collection === "events") {
    const { event_date, member_id, ...rest } = item;
    const timestamp = typeof event_date === "string" ? event_date : "";
    return { ...rest, memberId: member_id || "", date: rest.date || timestamp.slice(0, 10), time: rest.time || timestamp.slice(11, 16) };
  }
  if (collection === "members") {
    const { avatar_url, ...rest } = item;
    const avatar = avatar_url || rest.avatar || "";
    return { ...rest, avatar, avatarUrl: avatar };
  }
  return item;
}

function toDatabaseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [day, month] = value.split("/").map(Number);
  if (!day || !month) return null;
  return `${new Date().getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function revertSimTopupForTransaction(transactionId: string) {
  const rows = await pool.query("SELECT sim_id, amount FROM sim_transactions WHERE note = $1 AND type = 'topup'", [`Nạp từ phiếu chi: ${transactionId}`]);
  for (const row of rows.rows) {
    const amount = Number(row.amount || 0);
    if (!row.sim_id || amount <= 0) continue;
    await pool.query("UPDATE member_sims SET sim_balance = GREATEST(COALESCE(sim_balance, 0) - $2, 0), updated_at = now() WHERE id = $1", [row.sim_id, amount]);
    await pool.query(
      `INSERT INTO sim_transactions (sim_id, type, amount, transaction_date, note)
       VALUES ($1, 'adjust', $2, CURRENT_DATE, $3)`,
      [row.sim_id, -amount, "Hoàn tác nạp do sửa/xóa phiếu chi"]
    );
  }
  await pool.query("DELETE FROM sim_transactions WHERE note = $1 AND type = 'topup'", [`Nạp từ phiếu chi: ${transactionId}`]);
}

async function applySimTopupForTransaction(row: Record<string, unknown>) {
  if (!row.sim_id || !row.sim_topup_applied) return;
  const amount = Number(row.amount || 0);
  if (amount <= 0) return;
  const date = toDatabaseDate(row.date) || todayDateOnly();
  await pool.query(
    `UPDATE member_sims
     SET sim_balance = COALESCE(sim_balance, 0) + $2,
         last_topup_date = $3,
         last_topup_amount = $2,
         updated_at = now()
     WHERE id = $1`,
    [row.sim_id, amount, date]
  );
  await pool.query(
    `INSERT INTO sim_transactions (sim_id, member_id, type, amount, transaction_date, note)
     VALUES ($1, $2, 'topup', $3, $4, $5)`,
    [row.sim_id, row.member_id || null, amount, date, `Nạp từ phiếu chi: ${row.id}`]
  );
}

function isSavingsExpense(row: Record<string, unknown>) {
  return String(row.type || "") === "expense" && String(row.category || "") === "Tiết kiệm";
}

function yearMonthFromDate(value: unknown) {
  const date = toDatabaseDate(value) || todayDateOnly();
  const [year, month] = date.split("-").map(Number);
  return { date, year, month };
}

async function removeLinkedSavingsForTransaction(transactionId: string) {
  const result = await pool.query("SELECT linked_savings_id FROM transactions WHERE id = $1", [transactionId]);
  const linkedSavingsId = result.rows[0]?.linked_savings_id;
  if (!linkedSavingsId) return;
  await pool.query("DELETE FROM savings_records WHERE id = $1", [linkedSavingsId]);
  await pool.query(
    "UPDATE transactions SET linked_savings_id = NULL, savings_applied = false, savings_holder = NULL WHERE id = $1",
    [transactionId]
  );
}

async function syncSavingsForTransaction(row: Record<string, unknown>) {
  const transactionId = String(row.id || "");
  if (!transactionId) return row;
  if (!isSavingsExpense(row)) {
    await removeLinkedSavingsForTransaction(transactionId);
    return row;
  }

  const amount = Number(row.amount || 0);
  if (amount <= 0) {
    await removeLinkedSavingsForTransaction(transactionId);
    return row;
  }

  const linkedSavingsId = row.linked_savings_id ? String(row.linked_savings_id) : "";
  const holder = String(row.savings_holder || row.subcategory || "Khác");
  const description = String(row.title || "Tiết kiệm");
  const note = String(row.note || "");
  const { year, month } = yearMonthFromDate(row.date);

  if (linkedSavingsId) {
    const update = await pool.query(
      `UPDATE savings_records
       SET member_id = $2,
           year = $3,
           month = $4,
           amount = $5,
           type = 'monthly',
           holder = $6,
           description = $7,
           note = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [linkedSavingsId, row.member_id || null, year, month, amount, holder, description, note]
    );
    if ((update.rowCount || 0) > 0) {
      await pool.query("UPDATE transactions SET savings_applied = true, savings_holder = $2 WHERE id = $1", [transactionId, holder]);
      return row;
    }
  }

  const insert = await pool.query(
    `INSERT INTO savings_records (member_id, year, month, amount, type, holder, description, note)
     VALUES ($1, $2, $3, $4, 'monthly', $5, $6, $7)
     RETURNING id`,
    [row.member_id || null, year, month, amount, holder, description, note]
  );
  const newSavingsId = insert.rows[0]?.id;
  await pool.query(
    "UPDATE transactions SET linked_savings_id = $2, savings_applied = true, savings_holder = $3 WHERE id = $1",
    [transactionId, newSavingsId, holder]
  );
  return { ...row, linked_savings_id: newSavingsId, savings_applied: true, savings_holder: holder };
}

async function fetchTransactionRow(transactionId: string, fields: string[]) {
  const result = await pool.query(`SELECT ${fields.join(", ")} FROM transactions WHERE id = $1`, [transactionId]);
  return result.rows[0] || null;
}

function todayDateOnly() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function collectionHandlers(collection: Collection) {
  const fields = columns[collection];
  return {
    GET: async () => {
      if (!await requireSession()) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      await ensureCollectionSchema(collection);
      const selectFields = collection === "transactions" ? [...fields, "created_at"] : fields;
      const result = await pool.query(`SELECT ${selectFields.join(", ")} FROM ${collection} ORDER BY id`);
      return NextResponse.json(result.rows.map(row => fromDb(collection, row)));
    },
    POST: async (request: NextRequest) => {
      if (!await requireSession()) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      await ensureCollectionSchema(collection);
      const item = toDb(collection, await request.json());
      const values = fields.map(field => item[field] ?? null);
      const params = fields.map((_, index) => `$${index + 1}`).join(", ");
      const updates = fields.filter(field => field !== "id").map(field => `${field} = EXCLUDED.${field}`).join(", ");
      const result = await pool.query(`INSERT INTO ${collection} (${fields.join(", ")}) VALUES (${params}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING ${fields.join(", ")}`, values);
      if (collection === "transactions") {
        await revertSimTopupForTransaction(String(result.rows[0].id));
        await applySimTopupForTransaction(result.rows[0]);
        await syncSavingsForTransaction(result.rows[0]);
        const synced = await fetchTransactionRow(String(result.rows[0].id), fields);
        if (synced) return NextResponse.json(fromDb(collection, synced), { status: 201 });
      }
      return NextResponse.json(fromDb(collection, result.rows[0]), { status: 201 });
    },
    PUT: async (request: NextRequest) => {
      if (!await requireSession()) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      await ensureCollectionSchema(collection);
      const item = toDb(collection, await request.json());
      const values = fields.map(field => item[field] ?? null);
      const params = fields.map((_, index) => `$${index + 1}`).join(", ");
      const updates = fields.filter(field => field !== "id").map(field => `${field} = EXCLUDED.${field}`).join(", ");
      if (collection === "transactions" && item.id) await revertSimTopupForTransaction(String(item.id));
      const result = await pool.query(`INSERT INTO ${collection} (${fields.join(", ")}) VALUES (${params}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING ${fields.join(", ")}`, values);
      if (collection === "transactions") {
        await applySimTopupForTransaction(result.rows[0]);
        await syncSavingsForTransaction(result.rows[0]);
        const synced = await fetchTransactionRow(String(result.rows[0].id), fields);
        if (synced) return NextResponse.json(fromDb(collection, synced));
      }
      return NextResponse.json(fromDb(collection, result.rows[0]));
    },
    DELETE: async (request: NextRequest) => {
      if (!await requireSession()) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
      if (collection === "transactions") {
        await revertSimTopupForTransaction(id);
        await removeLinkedSavingsForTransaction(id);
      }
      await pool.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
      return NextResponse.json({ ok: true });
    },
  };
}
