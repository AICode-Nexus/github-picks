import type { DailyReport } from "@github-picks/core/schema";
import { buildRankingItems, type RepositoryCardModel } from "./view-model";

export const DAILY_RANKING_TAGS = [
  { id: "rising", label: "趋势上升", rankingKey: "rising" },
  { id: "new", label: "新项目", rankingKey: "newProjects" },
  { id: "hidden", label: "隐藏宝石", rankingKey: "hiddenGems" },
  { id: "active", label: "开发活跃", rankingKey: "active" },
] as const;

export type DailyRankingTagId = (typeof DAILY_RANKING_TAGS)[number]["id"];
export type DailyRankingFilter = "all" | DailyRankingTagId;

export interface DailyRankingTagModel {
  id: DailyRankingTagId;
  label: string;
}

export interface DailyRankingItemModel extends RepositoryCardModel {
  tags: DailyRankingTagModel[];
}

export function buildDailyRankingItems(
  report: DailyReport,
): DailyRankingItemModel[] {
  const overallIds = new Set(report.rankings.overall);
  for (const tag of DAILY_RANKING_TAGS) {
    for (const repositoryId of report.rankings[tag.rankingKey]) {
      if (!overallIds.has(repositoryId)) {
        throw new Error(
          `specialty ranking references non-overall repository: ${repositoryId}`,
        );
      }
    }
  }

  const membership = new Map<string, DailyRankingTagModel[]>();
  for (const tag of DAILY_RANKING_TAGS) {
    for (const repositoryId of report.rankings[tag.rankingKey]) {
      const tags = membership.get(repositoryId) ?? [];
      tags.push({ id: tag.id, label: tag.label });
      membership.set(repositoryId, tags);
    }
  }

  return buildRankingItems(report, report.rankings.overall).map((item) => ({
    ...item,
    tags: membership.get(item.id) ?? [],
  }));
}
