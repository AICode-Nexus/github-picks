import { describe, expect, it } from "vitest";
import { CandidateSignalSchema } from "../src/schema.js";

const baseSignal = {
  fullName: "garagehq/nightcrawler",
  sourceId: "ai-hot",
  sourceTier: "C" as const,
  independenceGroup: "hacker-news-community",
  direction: null,
  evidenceUrl: "https://aihot.virxact.com/items/item-nightcrawler",
  observedAt: "2026-08-04T06:07:18.354Z",
  rank: null,
  sourceScore: 72,
  stale: false,
  summaryZh: "一款在智能手机上运行的本地 AI 渗透测试工具。",
  metrics: {
    starVelocity: null,
    trendingScore: null,
    discussionPoints: null,
    discussionComments: null,
  },
  rawObjectRef: `sha256:${"a".repeat(64)}`,
};

describe("candidate signal provenance", () => {
  it("retains generic aggregator and upstream-source provenance", () => {
    const signal = CandidateSignalSchema.parse({
      ...baseSignal,
      provenance: {
        aggregatorItemId: "item-nightcrawler",
        aggregatorUrl: "https://aihot.virxact.com/items/item-nightcrawler",
        originalUrl: "https://github.com/garagehq/nightcrawler",
        upstreamSourceName: "Hacker News 热门（buzzing.cc 中文翻译）",
        selected: false,
        publishedAt: "2026-08-04T05:00:00.000Z",
        discoveredAt: "2026-08-04T06:00:00.000Z",
      },
    });

    expect(signal.provenance?.upstreamSourceName).toContain("Hacker News");
    expect(signal.provenance?.originalUrl).toBe(
      "https://github.com/garagehq/nightcrawler",
    );
  });

  it("continues to parse historical signals without provenance", () => {
    expect(CandidateSignalSchema.parse(baseSignal)).toEqual(baseSignal);
  });
});
