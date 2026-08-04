import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildPeriodRanking,
  buildReportArchive,
} from "../src/lib/period-ranking";

let fixture: DailyReport;
let sustainedRepositoryId: string;
let spikeRepositoryId: string;

beforeAll(async () => {
  const reportPath = resolve(
    process.cwd(),
    "../../artifacts/daily/2026-08-04/report.json",
  );
  fixture = DailyReportSchema.parse(
    JSON.parse(await readFile(reportPath, "utf8")) as unknown,
  );
  const sustainedRepository = fixture.repositories[0];
  const spikeRepository = fixture.repositories[1];
  if (sustainedRepository === undefined || spikeRepository === undefined) {
    throw new Error(
      "period ranking fixture requires at least two repositories",
    );
  }
  sustainedRepositoryId = sustainedRepository.snapshot.fullName;
  spikeRepositoryId = spikeRepository.snapshot.fullName;
});

function reportFor(
  date: string,
  overall: string[],
  values: Record<string, { score?: number; stars?: number }> = {},
): DailyReport {
  const report = structuredClone(fixture);
  report.date = date;
  report.generatedAt = `${date}T13:00:00.000Z`;
  report.mode = "live";
  report.rankings.overall = overall;
  report.repositories = report.repositories.map((repository) => {
    const override = values[repository.snapshot.fullName.toLowerCase()];
    if (!override) return repository;
    return {
      ...repository,
      snapshot: {
        ...repository.snapshot,
        stars: override.stars ?? repository.snapshot.stars,
      },
      score: {
        ...repository.score,
        publishedScore: override.score ?? repository.score.publishedScore,
      },
    };
  });
  return report;
}

describe("period ranking", () => {
  it("uses an inclusive window and ranks sustained appearances before one-day spikes", () => {
    const reports = [
      reportFor("2026-07-27", [spikeRepositoryId], {
        [spikeRepositoryId.toLowerCase()]: { score: 99, stars: 100 },
      }),
      reportFor("2026-08-02", [sustainedRepositoryId, spikeRepositoryId], {
        [sustainedRepositoryId.toLowerCase()]: { score: 60, stars: 200 },
        [spikeRepositoryId.toLowerCase()]: { score: 80, stars: 120 },
      }),
      reportFor("2026-08-03", [sustainedRepositoryId], {
        [sustainedRepositoryId.toLowerCase()]: { score: 62, stars: 205 },
      }),
      reportFor("2026-08-04", [sustainedRepositoryId, spikeRepositoryId], {
        [sustainedRepositoryId.toLowerCase()]: { score: 64, stars: 211 },
        [spikeRepositoryId.toLowerCase()]: { score: 90, stars: 150 },
      }),
    ];

    const ranking = buildPeriodRanking(reports, "7d");

    expect(ranking).toMatchObject({
      id: "7d",
      days: 7,
      fromDate: "2026-07-29",
      toDate: "2026-08-04",
      reportCount: 3,
      missingDayCount: 4,
      uniqueRepositoryCount: 2,
    });
    expect(ranking.items.map((item) => item.id)).toEqual([
      sustainedRepositoryId,
      spikeRepositoryId,
    ]);
    expect(ranking.items[0]).toMatchObject({
      rank: 1,
      appearanceCount: 3,
      reportCount: 3,
      bestRank: 1,
      averageScore: 62,
      scoreDelta: 4,
      starDelta: 11,
    });
    expect(ranking.items[1]).toMatchObject({
      appearanceCount: 2,
      reportCount: 3,
      averageScore: 85,
      scoreDelta: 10,
      starDelta: 30,
    });
  });

  it("creates newest-first archive entries with source degradation counts", () => {
    const olderReport = reportFor("2026-08-03", [sustainedRepositoryId]);
    const newestReport = reportFor("2026-08-04", [spikeRepositoryId]);
    newestReport.sourceHealth = newestReport.sourceHealth.map(
      (source, index) => ({
        ...source,
        status: index === 0 ? "degraded" : index === 1 ? "offline" : "healthy",
      }),
    );

    const archive = buildReportArchive([olderReport, newestReport]);

    expect(archive.map((entry) => entry.date)).toEqual([
      "2026-08-04",
      "2026-08-03",
    ]);
    expect(archive[0]).toMatchObject({
      href: "/history/2026-08-04/",
      topRepositoryId: spikeRepositoryId,
      publishedCount: fixture.counts.published,
      degradedSourceCount: 1,
      offlineSourceCount: 1,
    });
  });
});
