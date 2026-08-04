import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryReportPage } from "../../../components/history-report-page";
import { buildReportArchive } from "../../../lib/period-ranking";
import {
  getLiveReportByDate,
  getLiveReportHistory,
} from "../../../lib/report-store";

interface HistoryRouteProps {
  params: Promise<{ date: string }>;
}

export async function generateStaticParams() {
  const reports = await getLiveReportHistory();
  return reports.map((report) => ({ date: report.date }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: HistoryRouteProps): Promise<Metadata> {
  const { date } = await params;
  const report = await getLiveReportByDate(date);
  if (!report) return {};
  return {
    title: `${date} 历史日报`,
    description: `${date} GitHub Picks 中文开源项目榜单与信源快照。`,
  };
}

export default async function Page({ params }: HistoryRouteProps) {
  const { date } = await params;
  const history = await getLiveReportHistory();
  const report = history.find((item) => item.date === date);
  if (!report) notFound();

  const index = history.findIndex((item) => item.date === date);
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  return (
    <HistoryReportPage
      report={report}
      archive={buildReportArchive(history)}
      previousDate={history[index - 1]?.date ?? null}
      nextDate={history[index + 1]?.date ?? null}
      basePath={basePath}
    />
  );
}
