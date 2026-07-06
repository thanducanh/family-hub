import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { updateCardPendingTransaction, deleteCardPendingTransaction, requireCardPendingTransactionAccess } from "@/lib/card-pending-transactions";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const access = await requireCardPendingTransactionAccess(user, id);
  if (access.error) return access.error;
  
  if (access.transaction.status === "paid") {
    return NextResponse.json({ ok: false, error: "Không thể sửa giao dịch đã thanh toán." }, { status: 400 });
  }

  const body = await request.json();
  const tx = await updateCardPendingTransaction(id, {
    title: body.title,
    amount: body.amount !== undefined ? Number(body.amount) : undefined,
    date: body.date,
    category: body.category,
    note: body.note
  });

  return NextResponse.json({ ok: true, data: tx });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const access = await requireCardPendingTransactionAccess(user, id);
  if (access.error) return access.error;
  
  if (access.transaction.status === "paid") {
    return NextResponse.json({ ok: false, error: "Không thể xóa giao dịch đã thanh toán." }, { status: 400 });
  }

  await deleteCardPendingTransaction(id);
  return NextResponse.json({ ok: true });
}
