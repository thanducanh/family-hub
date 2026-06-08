import { MemberJobFormPage } from "@/components/member-job-page";

type PageProps = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <MemberJobFormPage memberId={id} mode="new" />;
}
