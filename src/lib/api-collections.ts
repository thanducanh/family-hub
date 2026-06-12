import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type Collection = "members" | "tasks" | "transactions" | "events" | "notes";

const columns: Record<Collection, string[]> = {
  members: ["id", "name", "nickname", "birthday", "gender", "role", "phone", "avatar", "avatar_url", "notes", "color"],
  tasks: ["id", "title", "member_id", "assignee", "due", "due_date_ui", "priority", "status"],
  transactions: ["id", "title", "member_id", "amount", "gross_amount", "discount_amount", "type", "category", "subcategory", "date", "transaction_time", "note", "bank_account_id", "payment_account_id", "estimated_cashback", "actual_cashback", "payment_method"],
  events: ["id", "title", "member_id", "type", "date", "time", "color", "event_date"],
  notes: ["id", "title", "member_id", "kind", "important", "tag", "content", "updated_at"],
};

async function ensureCollectionSchema(collection: Collection) {
  if (collection !== "transactions") return;
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash'");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_time TIME");
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
    return { ...item, member_id: item.memberId || null, gross_amount: item.grossAmount || item.amount, discount_amount: item.discountAmount || 0, date: toDatabaseDate(item.date), transaction_time: item.transactionTime || item.transaction_time || null, bank_account_id: paymentAccountId, payment_account_id: paymentAccountId, estimated_cashback: item.estimatedCashback || 0, actual_cashback: item.actualCashback || 0, payment_method: item.paymentMethod || item.payment_method || "cash" };
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
    const { member_id, bank_account_id, payment_account_id, gross_amount, discount_amount, estimated_cashback, actual_cashback, created_at, payment_method, transaction_time, category, ...rest } = item as any;
    const mappedCategory = category === "Nhà cửa & sinh hoạt" ? "Sinh hoạt" : category;
    const paymentAccountId = payment_account_id || bank_account_id || "";
    return { ...rest, category: mappedCategory, memberId: member_id || "", grossAmount: Number(gross_amount || rest.amount || 0), discountAmount: Number(discount_amount || 0), bankAccountId: paymentAccountId, paymentAccountId, payment_account_id: paymentAccountId, bank_account_id: paymentAccountId, transactionTime: transaction_time || "", transaction_time: transaction_time || "", estimatedCashback: Number(estimated_cashback || 0), actualCashback: Number(actual_cashback || 0), createdAt: created_at, paymentMethod: payment_method || "cash", payment_method: payment_method || "cash" };
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

export function collectionHandlers(collection: Collection) {
  const fields = columns[collection];
  return {
    GET: async () => {
      if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
      await ensureCollectionSchema(collection);
      const selectFields = collection === "transactions" ? [...fields, "created_at"] : fields;
      const result = await pool.query(`SELECT ${selectFields.join(", ")} FROM ${collection} ORDER BY id`);
      return NextResponse.json(result.rows.map(row => fromDb(collection, row)));
    },
    POST: async (request: NextRequest) => {
      if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
      await ensureCollectionSchema(collection);
      const item = toDb(collection, await request.json());
      const values = fields.map(field => item[field] ?? null);
      const params = fields.map((_, index) => `$${index + 1}`).join(", ");
      const updates = fields.filter(field => field !== "id").map(field => `${field} = EXCLUDED.${field}`).join(", ");
      const result = await pool.query(`INSERT INTO ${collection} (${fields.join(", ")}) VALUES (${params}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING ${fields.join(", ")}`, values);
      return NextResponse.json(fromDb(collection, result.rows[0]), { status: 201 });
    },
    PUT: async (request: NextRequest) => {
      if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
      await ensureCollectionSchema(collection);
      const item = toDb(collection, await request.json());
      const values = fields.map(field => item[field] ?? null);
      const params = fields.map((_, index) => `$${index + 1}`).join(", ");
      const updates = fields.filter(field => field !== "id").map(field => `${field} = EXCLUDED.${field}`).join(", ");
      const result = await pool.query(`INSERT INTO ${collection} (${fields.join(", ")}) VALUES (${params}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING ${fields.join(", ")}`, values);
      return NextResponse.json(fromDb(collection, result.rows[0]));
    },
    DELETE: async (request: NextRequest) => {
      if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
      await pool.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
      return NextResponse.json({ ok: true });
    },
  };
}
