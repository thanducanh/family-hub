import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export type Collection = "members" | "tasks" | "transactions" | "events" | "notes";

const columns: Record<Collection, string[]> = {
  members: ["id", "name", "nickname", "birthday", "gender", "role", "phone", "avatar", "notes", "color"],
  tasks: ["id", "title", "member_id", "assignee", "due", "due_date_ui", "priority", "status"],
  transactions: ["id", "title", "member_id", "amount", "type", "category", "date", "bank_account_id", "estimated_cashback", "actual_cashback"],
  events: ["id", "title", "member_id", "type", "date", "time", "color", "event_date"],
  notes: ["id", "title", "member_id", "kind", "important", "tag", "content", "updated_at"],
};

function toDb(collection: Collection, item: Record<string, unknown>) {
  if (collection === "notes") return { ...item, member_id: item.memberId || null, updated_at: item.updatedAt };
  if (collection === "members") return { ...item, birthday: toDatabaseDate(item.birthday) };
  if (collection === "tasks") return { ...item, member_id: item.memberId || null, due_date_ui: toDatabaseDate(item.dueDate) };
  if (collection === "transactions") return { ...item, member_id: item.memberId || null, date: toDatabaseDate(item.date), bank_account_id: item.bankAccountId || null, estimated_cashback: item.estimatedCashback || 0, actual_cashback: item.actualCashback || 0 };
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
    const { member_id, bank_account_id, estimated_cashback, actual_cashback, ...rest } = item;
    return { ...rest, memberId: member_id || "", bankAccountId: bank_account_id || "", estimatedCashback: Number(estimated_cashback || 0), actualCashback: Number(actual_cashback || 0) };
  }
  if (collection === "events") {
    const { event_date, member_id, ...rest } = item;
    const timestamp = typeof event_date === "string" ? event_date : "";
    return { ...rest, memberId: member_id || "", date: rest.date || timestamp.slice(0, 10), time: rest.time || timestamp.slice(11, 16) };
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
      const result = await pool.query(`SELECT ${fields.join(", ")} FROM ${collection} ORDER BY id`);
      return NextResponse.json(result.rows.map(row => fromDb(collection, row)));
    },
    POST: async (request: NextRequest) => {
      if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
      const item = toDb(collection, await request.json());
      const values = fields.map(field => item[field] ?? null);
      const params = fields.map((_, index) => `$${index + 1}`).join(", ");
      const updates = fields.filter(field => field !== "id").map(field => `${field} = EXCLUDED.${field}`).join(", ");
      const result = await pool.query(`INSERT INTO ${collection} (${fields.join(", ")}) VALUES (${params}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING ${fields.join(", ")}`, values);
      return NextResponse.json(fromDb(collection, result.rows[0]), { status: 201 });
    },
    PUT: async (request: NextRequest) => {
      if (!await requireSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
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
