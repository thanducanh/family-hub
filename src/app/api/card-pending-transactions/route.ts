import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getCardPendingTransactions,
  createCardPendingTransaction,
  ensureCardPendingTransactionsTable,
} from "@/lib/card-pending-transactions";
import { requireBankAccountAccess } from "@/lib/bank-accounts";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    await ensureCardPendingTransactionsTable();

    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get("bankAccountId");
    if (!bankAccountId) return NextResponse.json({ ok: false, error: "Thieu bankAccountId" }, { status: 400 });

    const access = await requireBankAccountAccess(user, bankAccountId);
    if (access.error) return access.error;

    const data = await getCardPendingTransactions(bankAccountId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[api/card-pending-transactions] GET error", { message: err.message, stack: err.stack });
    return NextResponse.json({ ok: false, error: "Khong the tai tam tinh the." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    await ensureCardPendingTransactionsTable();

    const body = await request.json();
    if (!body.bankAccountId || !body.memberId || !body.title || !body.amount || !body.date) {
      return NextResponse.json({ ok: false, error: "Thieu thong tin bat buoc" }, { status: 400 });
    }

    const access = await requireBankAccountAccess(user, body.bankAccountId);
    if (access.error) return access.error;

    const tx = await createCardPendingTransaction({
      memberId: body.memberId,
      bankAccountId: body.bankAccountId,
      title: body.title,
      amount: Number(body.amount),
      date: body.date,
      category: body.category || "Khac",
      subcategory: body.subcategory || "",
      note: body.note || "",
    });

    return NextResponse.json({ ok: true, data: tx });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[api/card-pending-transactions] POST error", { message: err.message, stack: err.stack });
    return NextResponse.json({ ok: false, error: "Khong the luu tam tinh the." }, { status: 500 });
  }
}
