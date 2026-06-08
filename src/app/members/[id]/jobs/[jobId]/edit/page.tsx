import { MemberJobFormPage } from "@/components/member-job-page";

type PageProps = { params: Promise<{ id: string; jobId: string }> };

export default async function Page({ params }: PageProps) {
  const { id, jobId } = await params;
  return <MemberJobFormPage memberId={id} jobId={jobId} mode="edit" />;
}
