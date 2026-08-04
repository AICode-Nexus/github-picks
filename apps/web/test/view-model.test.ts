import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core";
import { beforeAll, describe, expect, it } from "vitest";
import { DIMENSION_META, DIRECTION_META } from "../src/lib/site-meta.js";
import {
  buildDirectionSummary,
  buildRankingItems,
  buildRepositoryCard,
  buildRepositoryDetail,
  buildRepositoryIndex,
  buildSourceSummary,
} from "../src/lib/view-model.js";

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
    const model = buildRepositoryCard(report, "quickwit-oss/quickwit", 1);

    expect(model.score).toBe(66.9);
    expect(model.confidence).toBe(0.9);
    expect(model.confidenceLabel).toBe("高");
    expect(model.riskPenalty).toBe(0);
    expect(model.strongestDimension).toEqual({
      id: "security",
      label: "安全与合规",
      value: 85,
    });
    expect(model.href).toBe("/repositories/quickwit-oss/quickwit/");
  });

  it("normalizes index keys and preserves ranking order", () => {
    const index = buildRepositoryIndex(report);
    const items = buildRankingItems(report, [
      "openmls/openmls",
      "quickwit-oss/quickwit",
    ]);

    expect(
      index.get("QUICKWIT-OSS/QUICKWIT".toLowerCase())?.snapshot.fullName,
    ).toBe("quickwit-oss/quickwit");
    expect(items.map((item) => [item.rank, item.id])).toEqual([
      [1, "openmls/openmls"],
      [2, "quickwit-oss/quickwit"],
    ]);
  });

  it("fails the build when a ranking references a missing repository", () => {
    expect(() => buildRepositoryCard(report, "missing/repository", 1)).toThrow(
      "ranking references missing repository",
    );
  });

  it("describes missing license and Scorecard as evidence gaps", () => {
    const missingLicense = buildRepositoryDetail(
      report,
      "argonne-lcf/atpesc_machinelearning",
    );
    const missingScorecard = buildRepositoryDetail(report, "lyogavin/airllm");

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

    expect(summary.counts).toEqual({
      healthy: 6,
      degraded: 2,
      offline: 0,
    });
    expect(summary.hasProblems).toBe(true);
    expect(hubLens).toMatchObject({
      name: "HubLens",
      status: "degraded",
      statusLabel: "降级",
      message: "全部候选信号超过新鲜度阈值",
    });
  });
});
