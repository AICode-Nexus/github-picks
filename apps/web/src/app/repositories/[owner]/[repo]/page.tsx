import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepositoryDetail } from "../../../../components/repository-detail";
import {
  getLatestLiveReportForRepository,
  getLiveReportHistory,
} from "../../../../lib/report-store";

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
  const history = await getLiveReportHistory();
  const repositories = new Map<string, string>();

  for (const report of history) {
    for (const repository of report.repositories) {
      repositories.set(
        repository.snapshot.fullName.toLowerCase(),
        repository.snapshot.fullName,
      );
    }
  }

  return [...repositories.values()].map(splitRepositoryId);
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: RepositoryRouteProps): Promise<Metadata> {
  const { owner, repo } = await params;
  const repositoryId = `${owner}/${repo}`;
  const report = await getLatestLiveReportForRepository(repositoryId);
  if (report === null) return {};
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
  const repositoryId = `${owner}/${repo}`;
  const report = await getLatestLiveReportForRepository(repositoryId);
  if (report === null) notFound();

  return <RepositoryDetail report={report} repositoryId={repositoryId} />;
}
