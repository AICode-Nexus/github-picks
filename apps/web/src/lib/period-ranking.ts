import type { DailyReport, DirectionId } from "@github-picks/core/schema";
import { RANKING_PERIOD_META, type RankingPeriodId } from "./site-meta";
import { buildRepositoryCard, type ConfidenceLabel } from "./view-model";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

interface RankingOccurrence {
  report: DailyReport;
  repositoryId: string;
  rank: number;
  score: number;
  stars: number;
}

export interface PeriodRankingItemModel {
  id: string;
  rank: number;
  description: string;
  language: string;
  directionId: DirectionId;
  directionName: string;
  href: string;
  githubUrl: string;
  appearanceCount: number;
  reportCount: number;
  appearanceRate: number;
  bestRank: number;
  averageRank: number;
  averageScore: number;
  latestScore: number;
  latestDailyRank: number;
  scoreDelta: number | null;
  starDelta: number | null;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  riskPenalty: number;
  latestDate: string;
}

export interface PeriodRankingModel {
  id: RankingPeriodId;
  label: string;
  description: string;
  days: number;
  fromDate: string;
  toDate: string;
  reportCount: number;
  missingDayCount: number;
  coverageRate: number;
  uniqueRepositoryCount: number;
  items: PeriodRankingItemModel[];
}

export interface ReportArchiveEntryModel {
  date: string;
  dateLabel: string;
  weekdayLabel: string;
  generatedAtLabel: string;
  href: string;
  topRepositoryId: string;
  topRepositoryScore: number;
  publishedCount: number;
  degradedSourceCount: number;
  offlineSourceCount: number;
}

function dayNumber(date: string): number {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    throw new Error(`invalid report date: ${date}`);
  }
  return Math.floor(timestamp / DAY_IN_MILLISECONDS);
}

function dateFromDayNumber(value: number): string {
  return new Date(value * DAY_IN_MILLISECONDS).toISOString().slice(0, 10);
}

function round(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function latestLiveReportPerDate(reports: DailyReport[]): DailyReport[] {
  const latestByDate = new Map<string, DailyReport>();
  for (const report of reports) {
    if (report.mode !== "live") continue;
    const current = latestByDate.get(report.date);
    if (
      current === undefined ||
      report.generatedAt.localeCompare(current.generatedAt) > 0
    ) {
      latestByDate.set(report.date, report);
    }
  }
  return [...latestByDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function rankingOccurrences(
  reports: DailyReport[],
): Map<string, RankingOccurrence[]> {
  const byRepository = new Map<string, RankingOccurrence[]>();

  for (const report of reports) {
    const repositories = new Map(
      report.repositories.map((repository) => [
        repository.snapshot.fullName.toLowerCase(),
        repository,
      ]),
    );
    report.rankings.overall.forEach((repositoryId, index) => {
      const normalizedId = repositoryId.toLowerCase();
      const repository = repositories.get(normalizedId);
      if (repository === undefined) {
        throw new Error(
          `ranking references missing repository: ${repositoryId} (${report.date})`,
        );
      }
      const occurrences = byRepository.get(normalizedId) ?? [];
      occurrences.push({
        report,
        repositoryId: repository.snapshot.fullName,
        rank: index + 1,
        score: repository.score.publishedScore,
        stars: repository.snapshot.stars,
      });
      byRepository.set(normalizedId, occurrences);
    });
  }

  return byRepository;
}

export function buildPeriodRanking(
  reports: DailyReport[],
  periodId: RankingPeriodId,
): PeriodRankingModel {
  const history = latestLiveReportPerDate(reports);
  const latest = history.at(-1);
  if (latest === undefined) {
    throw new Error("period ranking requires at least one live DailyReport");
  }

  const meta = RANKING_PERIOD_META[periodId];
  const latestDay = dayNumber(latest.date);
  const earliestDay = latestDay - meta.days + 1;
  const windowReports = history.filter(
    (report) => dayNumber(report.date) >= earliestDay,
  );
  const occurrences = rankingOccurrences(windowReports);
  const unsortedItems = [...occurrences.values()].map((repositoryHistory) => {
    const first = repositoryHistory[0];
    const last = repositoryHistory.at(-1);
    if (first === undefined || last === undefined) {
      throw new Error("period ranking occurrence history is empty");
    }
    const card = buildRepositoryCard(last.report, last.repositoryId, last.rank);
    const averageScore =
      repositoryHistory.reduce((total, item) => total + item.score, 0) /
      repositoryHistory.length;
    const averageRank =
      repositoryHistory.reduce((total, item) => total + item.rank, 0) /
      repositoryHistory.length;

    return {
      id: card.id,
      rank: 0,
      description: card.description,
      language: card.language,
      directionId: card.directionId,
      directionName: card.directionName,
      href: card.href,
      githubUrl: card.githubUrl,
      appearanceCount: repositoryHistory.length,
      reportCount: windowReports.length,
      appearanceRate: repositoryHistory.length / windowReports.length,
      bestRank: Math.min(...repositoryHistory.map((item) => item.rank)),
      averageRank: round(averageRank),
      averageScore: round(averageScore),
      latestScore: round(last.score),
      latestDailyRank: last.rank,
      scoreDelta:
        repositoryHistory.length > 1 ? round(last.score - first.score) : null,
      starDelta: repositoryHistory.length > 1 ? last.stars - first.stars : null,
      confidence: card.confidence,
      confidenceLabel: card.confidenceLabel,
      riskPenalty: card.riskPenalty,
      latestDate: last.report.date,
    } satisfies PeriodRankingItemModel;
  });

  const items = unsortedItems
    .sort(
      (left, right) =>
        right.appearanceRate - left.appearanceRate ||
        right.averageScore - left.averageScore ||
        left.averageRank - right.averageRank ||
        left.id.localeCompare(right.id),
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    id: periodId,
    label: meta.label,
    description: meta.description,
    days: meta.days,
    fromDate: dateFromDayNumber(earliestDay),
    toDate: latest.date,
    reportCount: windowReports.length,
    missingDayCount: Math.max(0, meta.days - windowReports.length),
    coverageRate: windowReports.length / meta.days,
    uniqueRepositoryCount: items.length,
    items,
  };
}

function formatReportDate(date: string): {
  dateLabel: string;
  weekdayLabel: string;
} {
  const value = new Date(`${date}T00:00:00+08:00`);
  return {
    dateLabel: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Shanghai",
    }).format(value),
    weekdayLabel: new Intl.DateTimeFormat("zh-CN", {
      weekday: "long",
      timeZone: "Asia/Shanghai",
    }).format(value),
  };
}

function formatGeneratedAt(generatedAt: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(generatedAt));
}

export function buildReportArchive(
  reports: DailyReport[],
): ReportArchiveEntryModel[] {
  return latestLiveReportPerDate(reports)
    .map((report) => {
      const topRepositoryId = report.rankings.overall[0];
      if (topRepositoryId === undefined) {
        throw new Error(
          `live DailyReport has no overall ranking: ${report.date}`,
        );
      }
      const topRepository = buildRepositoryCard(report, topRepositoryId, 1);
      const date = formatReportDate(report.date);
      return {
        date: report.date,
        dateLabel: date.dateLabel,
        weekdayLabel: date.weekdayLabel,
        generatedAtLabel: formatGeneratedAt(report.generatedAt),
        href: `/history/${report.date}/`,
        topRepositoryId: topRepository.id,
        topRepositoryScore: topRepository.score,
        publishedCount: report.counts.published,
        degradedSourceCount: report.sourceHealth.filter(
          (source) => source.status === "degraded",
        ).length,
        offlineSourceCount: report.sourceHealth.filter(
          (source) => source.status === "offline",
        ).length,
      };
    })
    .reverse();
}
