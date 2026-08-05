import type { DailyRankingItemModel } from "./daily-ranking";
import type { PeriodRankingModel } from "./period-ranking";
import type { RepositoryCardModel } from "./view-model";

export interface DailyRankingShareInput {
  date: string;
  filterLabel: string;
  items: readonly DailyRankingItemModel[];
}

export interface HistoryRankingShareInput {
  date: string;
  items: readonly RepositoryCardModel[];
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function rankLabel(rank: number): string {
  return String(rank).padStart(2, "0");
}

function joinHeaderAndItems(header: string[], items: string[]): string {
  if (items.length === 0) return header.join("\n");
  return [...header, "", items.join("\n\n")].join("\n");
}

export function buildDailyRankingShareText({
  date,
  filterLabel,
  items,
}: DailyRankingShareInput): string {
  return joinHeaderAndItems(
    [
      "GitHub Picks｜今日综合价值榜",
      `${date}｜筛选：${filterLabel}｜共 ${items.length} 项`,
    ],
    items.map((item) =>
      [
        `${rankLabel(item.rank)} ${item.id}`,
        `项目地址：${item.githubUrl}`,
        `推荐理由：${oneLine(item.recommendationReason)}`,
      ].join("\n"),
    ),
  );
}

export function buildPeriodRankingShareText(
  ranking: PeriodRankingModel,
): string {
  return joinHeaderAndItems(
    [
      `GitHub Picks｜${ranking.label}持续价值榜`,
      `${ranking.fromDate} 至 ${ranking.toDate}｜实际日报 ${ranking.reportCount} 份｜共 ${ranking.items.length} 项`,
    ],
    ranking.items.map((item) =>
      [
        `${rankLabel(item.rank)} ${item.id}`,
        `项目地址：${item.githubUrl}`,
        `周期表现：上榜 ${item.appearanceCount}/${item.reportCount} 日 · 平均发布分 ${item.averageScore.toFixed(1)} · 最近名次 #${rankLabel(item.latestDailyRank)}`,
      ].join("\n"),
    ),
  );
}

export function buildHistoryRankingShareText({
  date,
  items,
}: HistoryRankingShareInput): string {
  const dateLabel = date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日");
  return joinHeaderAndItems(
    [`GitHub Picks｜${dateLabel}综合价值榜`, `历史日报｜共 ${items.length} 项`],
    items.map((item) =>
      [
        `${rankLabel(item.rank)} ${item.id}`,
        `项目地址：${item.githubUrl}`,
        `推荐理由：${oneLine(item.recommendationReason)}`,
      ].join("\n"),
    ),
  );
}

export function appendRankingPageUrl(body: string, pageUrl: string): string {
  return `${body.trimEnd()}\n\n完整榜单：\n${pageUrl.trim()}`;
}
