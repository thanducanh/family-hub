import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCardPendingTransactions, createCardPendingTransaction } from "@/lib/card-pending-transactions";
import { requireBankAccountAccess } from "@/lib/bank-accounts";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bankAccountId = searchParams.get("bankAccountId");
  if (!bankAccountId) return NextResponse.json({ ok: false, error: "Thiếu bankAccountId" }, { status: 400 });

  const access = await requireBankAccountAccess(user, bankAccountId);
  if (access.error) return access.error;

  const data = await getCardPendingTransactions(bankAccountId);
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.bankAccountId || !body.memberId || !body.title || !body.amount || !body.date) {
    return NextResponse.json({ ok: false, error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  const access = await requireBankAccountAccess(user, body.bankAccountId);
  if (access.error) return access.error;

  const tx = await createCardPendingTransaction({
    memberId: body.memberId,
    bankAccountId: body.bankAccountId,
    title: body.title,
    amount: Number(body.amount),
    date: body.date,
    category: body.category || "Khác",
    note: body.note || ""
  });

  return NextResponse.json({ ok: true, data: tx });
}
