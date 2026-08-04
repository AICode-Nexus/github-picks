import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PeriodRankingPage } from "../../../components/period-ranking-page";
import { buildPeriodRanking } from "../../../lib/period-ranking";
import { getLiveReportHistory } from "../../../lib/report-store";
import {
  isRankingPeriodId,
  RANKING_PERIOD_IDS,
  RANKING_PERIOD_META,
} from "../../../lib/site-meta";

interface PeriodRouteProps {
  params: Promise<{ period: string }>;
}

export function generateStaticParams() {
  return RANKING_PERIOD_IDS.map((period) => ({ period }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PeriodRouteProps): Promise<Metadata> {
  const { period } = await params;
  if (!isRankingPeriodId(period)) return {};
  const meta = RANKING_PERIOD_META[period];
  return {
    title: `${meta.label}持续价值榜`,
    description: `${meta.description} GitHub Picks 中文开源项目周期榜。`,
  };
}

export default async function Page({ params }: PeriodRouteProps) {
  const { period } = await params;
  if (!isRankingPeriodId(period)) notFound();

  const reports = await getLiveReportHistory();
  return <PeriodRankingPage ranking={buildPeriodRanking(reports, period)} />;
}
