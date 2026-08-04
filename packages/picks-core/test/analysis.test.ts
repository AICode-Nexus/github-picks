import { describe, expect, it } from "vitest";
import { analyzeRepository } from "../src/analysis.js";
import { makeScore, makeSnapshot } from "./helpers.js";

describe("evidence-based Chinese analysis", () => {
  it("answers why, audience, risk and next action with evidence links", () => {
    const snapshot = makeSnapshot({
      fullName: "example/project",
      direction: "ai-agent",
      missingFields: ["scorecard"],
    });
    const score = makeScore({
      fullName: "example/project",
      dimensions: { activity: 92, utility: 88 },
      riskPenalty: 6,
    });

    const analysis = analyzeRepository({ snapshot, score });

    expect(analysis.why).toContain("值得关注");
    expect(analysis.suitableFor).toContain("适合");
    expect(analysis.risks).toContain("风险");
    expect(analysis.risks).toContain("scorecard");
    expect(analysis.nextStep).toContain("下一步");
    expect(analysis.recommendationReason).toBe(analysis.why);
    expect(analysis.generation).toMatchObject({
      kind: "rules",
      status: "fallback",
      provider: "github-picks-rules",
      model: null,
    });
    expect(analysis.generation?.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(analysis.evidenceUrls).toContain(
      "https://github.com/example/project",
    );
    expect(JSON.stringify(analysis)).not.toMatch(/最好|全球第一|绝对领先/);
  });

  it("recommends pausing a quarantined repository", () => {
    const snapshot = makeSnapshot({ fullName: "example/quarantined" });
    const score = makeScore({
      fullName: "example/quarantined",
      eligibility: "quarantined",
      riskPenalty: 20,
    });

    expect(analyzeRepository({ snapshot, score }).nextStep).toContain("暂缓");
  });
});
