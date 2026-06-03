import { BankCardFormPage } from "@/components/bank-card-page";

type PageProps = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <BankCardFormPage memberId={id} mode="new" />;
}
