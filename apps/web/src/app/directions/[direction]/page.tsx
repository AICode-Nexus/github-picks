import type { DirectionId } from "@github-picks/core/schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DirectionPage } from "../../../components/direction-page";
import { getLatestLiveReport } from "../../../lib/report-store";
import { DIRECTION_IDS, DIRECTION_META } from "../../../lib/site-meta";

interface DirectionRouteProps {
  params: Promise<{ direction: string }>;
}

function isDirectionId(value: string): value is DirectionId {
  return DIRECTION_IDS.some((directionId) => directionId === value);
}

export function generateStaticParams() {
  return DIRECTION_IDS.map((direction) => ({ direction }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: DirectionRouteProps): Promise<Metadata> {
  const { direction } = await params;
  if (!isDirectionId(direction)) return {};
  const meta = DIRECTION_META[direction];
  return {
    title: meta.name,
    description: `${meta.description} GitHub Picks 中文开源项目方向榜。`,
  };
}

export default async function Page({ params }: DirectionRouteProps) {
  const { direction } = await params;
  if (!isDirectionId(direction)) notFound();

  const report = await getLatestLiveReport();
  return <DirectionPage report={report} directionId={direction} />;
}
