import { BankCardFormPage } from "@/components/bank-card-page";

type PageProps = { params: Promise<{ id: string; cardId: string }> };

export default async function Page({ params }: PageProps) {
  const { id, cardId } = await params;
  return <BankCardFormPage memberId={id} cardId={cardId} mode="edit" />;
}
