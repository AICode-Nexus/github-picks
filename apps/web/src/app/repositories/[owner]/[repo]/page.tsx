import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepositoryDetail } from "../../../../components/repository-detail";
import { getLatestLiveReport } from "../../../../lib/report-store";

interface RepositoryRouteProps {
  params: Promise<{ owner: string; repo: string }>;
}

function splitRepositoryId(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`invalid repository identifier: ${fullName}`);
  }
  return { owner, repo };
}

export async function generateStaticParams() {
  const report = await getLatestLiveReport();
  return report.repositories.map((repository) =>
    splitRepositoryId(repository.snapshot.fullName),
  );
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: RepositoryRouteProps): Promise<Metadata> {
  const { owner, repo } = await params;
  const report = await getLatestLiveReport();
  const repositoryId = `${owner}/${repo}`;
  const repository = report.repositories.find(
    (item) =>
      item.snapshot.fullName.toLowerCase() === repositoryId.toLowerCase(),
  );
  if (!repository) return {};

  return {
    title: repository.snapshot.fullName,
    description:
      repository.snapshot.description ??
      `${repository.snapshot.fullName} 的 GitHub Picks 中文证据分析。`,
  };
}

export default async function Page({ params }: RepositoryRouteProps) {
  const { owner, repo } = await params;
  const report = await getLatestLiveReport();
  const repositoryId = `${owner}/${repo}`;
  const exists = report.repositories.some(
    (item) =>
      item.snapshot.fullName.toLowerCase() === repositoryId.toLowerCase(),
  );
  if (!exists) notFound();

  return <RepositoryDetail report={report} repositoryId={repositoryId} />;
}
