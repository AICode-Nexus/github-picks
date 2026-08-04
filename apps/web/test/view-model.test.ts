import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { beforeAll, describe, expect, it } from "vitest";
import { DIMENSION_META, DIRECTION_META } from "../src/lib/site-meta";
import {
  buildDirectionSummary,
  buildRankingItems,
  buildRepositoryCard,
  buildRepositoryDetail,
  buildRepositoryIndex,
  buildSourceSummary,
} from "../src/lib/view-model";

let report: DailyReport;

beforeAll(async () => {
  const reportPath = resolve(
    process.cwd(),
    "../../artifacts/daily/2026-08-04/report.json",
  );
  report = DailyReportSchema.parse(
    JSON.parse(await readFile(reportPath, "utf8")) as unknown,
  );
});

describe("site metadata", () => {
  it("keeps exact Chinese direction labels and scoring weights", () => {
    expect(DIRECTION_META["ai-agent"].name).toBe("AI Coding 与 Agent");
    expect(DIRECTION_META["security-supply-chain"].shortName).toBe("安全");
    expect(DIMENSION_META.utility).toEqual({
      label: "实用价值",
      weight: 18,
    });
    expect(DIMENSION_META.security.label).toBe("安全与合规");
    expect(
      Object.values(DIMENSION_META).reduce(
        (total, dimension) => total + dimension.weight,
        0,
      ),
    ).toBe(100);
  });
});

describe("repository view models", () => {
  it("keeps score, confidence and risk as separate card semantics", () => {
    const repositoryId = report.rankings.overall[0];
    const repository = report.repositories.find(
      (item) => item.snapshot.fullName === repositoryId,
    );
    if (repositoryId === undefined || repository === undefined) {
      throw new Error("missing ranked test repository");
    }

    const model = buildRepositoryCard(report, repositoryId, 1);

    expect(model.score).toBe(repository.score.publishedScore);
    expect(model.confidence).toBe(repository.score.confidence);
    expect(["高", "中", "低"]).toContain(model.confidenceLabel);
    expect(model.riskPenalty).toBe(repository.score.riskPenalty);
    expect(model.strongestDimension.value).toBe(
      Math.max(...Object.values(repository.score.dimensions)),
    );
    expect(model.href).toBe(`/repositories/${repositoryId}/`);
  });

  it("normalizes index keys and preserves ranking order", () => {
    const repositoryIds = report.rankings.overall.slice(0, 2);
    const firstRepositoryId = repositoryIds[0];
    if (firstRepositoryId === undefined || repositoryIds.length < 2) {
      throw new Error("missing ranked test repositories");
    }
    const index = buildRepositoryIndex(report);
    const items = buildRankingItems(report, repositoryIds);

    expect(
      index.get(firstRepositoryId.toUpperCase().toLowerCase())?.snapshot
        .fullName,
    ).toBe(firstRepositoryId);
    expect(items.map((item) => item.id)).toEqual(repositoryIds);
    expect(items.map((item) => item.rank)).toEqual([1, 2]);
  });

  it("fails the build when a ranking references a missing repository", () => {
    expect(() => buildRepositoryCard(report, "missing/repository", 1)).toThrow(
      "ranking references missing repository",
    );
  });

  it("describes missing license and Scorecard as evidence gaps", () => {
    const missingLicenseId = report.repositories.find(
      (item) => item.snapshot.licenseSpdx === null,
    )?.snapshot.fullName;
    const missingScorecardId = report.repositories.find(
      (item) => item.snapshot.scorecard === null,
    )?.snapshot.fullName;
    if (missingLicenseId === undefined || missingScorecardId === undefined) {
      throw new Error("missing evidence-gap test repositories");
    }
    const missingLicense = buildRepositoryDetail(report, missingLicenseId);
    const missingScorecard = buildRepositoryDetail(report, missingScorecardId);

    expect(missingLicense.license.label).toBe("未识别 · 生产采用前需核验");
    expect(missingLicense.evidenceGaps).toContain("许可证信息缺失");
    expect(missingLicense.riskFindings[0]?.code).toBe("license-missing");
    expect(missingScorecard.scorecard).toEqual({
      status: "missing",
      label: "安全工程证据缺口",
      score: null,
      observedAt: null,
    });
    expect(missingScorecard.evidenceGaps).toContain("安全工程证据缺口");
  });
});

describe("direction and source summaries", () => {
  it("uses honest empty-state metrics for a direction with no ranked projects", () => {
    const emptyReport = structuredClone(report);
    emptyReport.rankings.byDirection["ai-agent"] = [];

    expect(buildDirectionSummary(emptyReport, "ai-agent")).toMatchObject({
      id: "ai-agent",
      count: 0,
      maximumScore: null,
      medianConfidence: null,
      items: [],
    });
  });

  it("retains degraded source names and diagnostic messages", () => {
    const summary = buildSourceSummary(report);
    const hubLens = summary.items.find((item) => item.id === "hublens");
    const expectedCounts = { healthy: 0, degraded: 0, offline: 0 };
    for (const source of report.sourceHealth) {
      expectedCounts[source.status] += 1;
    }

    expect(summary.counts).toEqual(expectedCounts);
    expect(summary.hasProblems).toBe(true);
    expect(hubLens).toMatchObject({
      name: "HubLens",
      status: "degraded",
      statusLabel: "降级",
      message: "全部候选信号超过新鲜度阈值",
    });
  });
});
