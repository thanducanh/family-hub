import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser, buildDataFilter } from "@/lib/auth";
import { ensureBankAccountsTable } from "@/lib/bank-accounts";
import { ensureCardPendingTransactionsTable } from "@/lib/card-pending-transactions";

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

function normalizeCreditType(value: unknown) {
  const text = normalizeText(value);
  if (["credit", "credit_card", "the tin dung"].includes(text)) return "credit";
  return text;
}

function normalizeCardStatus(value: unknown) {
  const text = normalizeText(value);
  if (["active", "enabled", "dang dung"].includes(text)) return "active";
  if (["inactive", "disabled", "archived", "tam khoa", "da huy", "ngung dung"].includes(text)) return "inactive";
  return text || "active";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    await ensureBankAccountsTable();
    await ensureCardPendingTransactionsTable();

    const filter = await buildDataFilter(user, "", 1, "member_id", "finance");
    const pendingFilterWhere = filter.where.replace(/\bmember_id\b/g, "cpt.member_id");

    const cardsQuery = await pool.query(
      `SELECT id,
              COALESCE(NULLIF(display_name, ''), NULLIF(product_name, ''), NULLIF(bank_name, ''), 'The tin dung') AS name,
              bank_name,
              product_name,
              display_name,
              card_type,
              account_type,
              status,
              credit_limit,
              due_day AS due_date,
              member_id
       FROM bank_accounts
       WHERE ${filter.where}
       ORDER BY created_at DESC`,
      filter.params
    );

    const pendingQuery = await pool.query(
      `SELECT cpt.id,
              cpt.member_id,
              cpt.bank_account_id,
              cpt.title,
              cpt.amount,
              cpt.status,
              cpt.date,
              cpt.category,
              cpt.note,
              ba.bank_name,
              ba.product_name,
              ba.display_name,
              ba.card_type,
              ba.status AS card_status
       FROM card_pending_transactions cpt
       LEFT JOIN bank_accounts ba ON ba.id = cpt.bank_account_id
       WHERE cpt.status = 'pending'
         AND ${pendingFilterWhere}
       ORDER BY cpt.created_at DESC`,
      filter.params
    );

    let pendingCreditTotal = 0;
    const activeCreditCards = cardsQuery.rows.filter(card => {
      const normalizedType = normalizeCreditType(card.card_type) === "credit"
        ? "credit"
        : normalizeCreditType(card.account_type);
      return normalizedType === "credit" && normalizeCardStatus(card.status) === "active";
    });

    const cards = activeCreditCards.map(card => {
      const pendingTransactions = pendingQuery.rows
        .filter(p => String(p.bank_account_id) === String(card.id))
        .map(p => ({
          id: p.id,
          title: p.title,
          description: p.title || p.note || p.category || "Giao dich",
          amount: Number(p.amount || 0),
          date: p.date ? String(p.date).slice(0, 10) : "",
          category: p.category,
          note: p.note || "",
          bankAccountId: p.bank_account_id,
          memberId: p.member_id,
        }));

      const pendingTotal = pendingTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      pendingCreditTotal += pendingTotal;

      return {
        id: card.id,
        name: card.name,
        bankName: card.bank_name,
        bank_name: card.bank_name,
        productName: card.product_name,
        product_name: card.product_name,
        displayName: card.display_name,
        display_name: card.display_name,
        cardType: card.card_type,
        card_type: card.card_type,
        accountType: card.account_type,
        account_type: card.account_type,
        status: card.status,
        dueDay: card.due_date,
        due_date: card.due_date,
        creditLimit: Number(card.credit_limit || 0),
        credit_limit: Number(card.credit_limit || 0),
        memberId: card.member_id,
        member_id: card.member_id,
        pendingTotal,
        pendingItems: pendingTransactions,
        pendingTransactions,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        cards,
        pendingCreditTotal,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[api/credit-cards/summary] error", { message: err.message, stack: err.stack });
    return NextResponse.json({ ok: false, error: "Khong the tai du lieu the tin dung." }, { status: 500 });
  }
}
