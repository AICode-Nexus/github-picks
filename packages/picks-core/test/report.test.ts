import { describe, expect, it } from "vitest";
import { renderDailyMarkdown } from "../src/report.js";
import type { DailyReport } from "../src/schema.js";
import { makeScoredRepository } from "./helpers.js";

describe("daily Markdown report", () => {
  it("renders experimental rankings, source health, confidence, risk and evidence", () => {
    const repository = makeScoredRepository({
      fullName: "example/project",
      direction: "ai-agent",
      publishedScore: 82,
      confidence: 0.78,
      riskPenalty: 6,
    });
    const report: DailyReport = {
      date: "2026-08-03",
      mode: "replay",
      timezone: "Asia/Shanghai",
      generatedAt: "2026-08-03T15:30:00.000Z",
      scoreVersion: "v0.1.0",
      configHash: "a".repeat(64),
      sourceHealth: [
        {
          sourceId: "github-rest",
          status: "healthy",
          observedAt: "2026-08-03T15:30:00.000Z",
          message: null,
        },
        {
          sourceId: "hublens",
          status: "degraded",
          observedAt: "2026-08-03T15:30:00.000Z",
          message: "数据超过 48 小时",
        },
      ],
      counts: { discovered: 12, enriched: 5, published: 1 },
      repositories: [repository],
      rankings: {
        overall: ["example/project"],
        rising: ["example/project"],
        newProjects: ["example/project"],
        hiddenGems: ["example/project"],
        active: ["example/project"],
        byDirection: {
          "ai-agent": ["example/project"],
          "data-ml": [],
          "app-platform": [],
          "infra-devtools": [],
          "security-supply-chain": [],
        },
      },
    };

    const markdown = renderDailyMarkdown(report);

    expect(markdown).toContain("# GitHub Picks Daily · 2026-08-03");
    expect(markdown).toContain("实验性评分");
    expect(markdown).toContain("证据回放（非实时榜单）");
    expect(markdown).toContain("信源健康");
    expect(markdown).toContain("综合价值榜");
    expect(markdown).toContain("AI Coding 与 Agent");
    expect(markdown).toContain("置信度：中");
    expect(markdown).toContain("风险扣分：6");
    expect(markdown).toContain("https://github.com/example/project");
  });
});
