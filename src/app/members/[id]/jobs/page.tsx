import { MemberJobsPage } from "@/components/member-job-page";

type PageProps = { params: Promise<{ id: string }> };

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <MemberJobsPage memberId={id} />;
}
