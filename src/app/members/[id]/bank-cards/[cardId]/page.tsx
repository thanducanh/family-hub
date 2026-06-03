import { BankCardDetailPage } from "@/components/bank-card-page";

type PageProps = { params: Promise<{ id: string; cardId: string }> };

export default async function Page({ params }: PageProps) {
  const { id, cardId } = await params;
  return <BankCardDetailPage memberId={id} cardId={cardId} />;
}
