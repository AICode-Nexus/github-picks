import { describe, expect, it } from "vitest";
import { loadPicksConfig } from "../src/config.js";
import { PicksConfigSchema } from "../src/schema.js";

describe("GitHub Picks config", () => {
  it("freezes five directions and the eight dimensions at 100 percent", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");

    expect(config.directions).toHaveLength(5);
    expect(
      Object.values(config.weights).reduce((sum, value) => sum + value, 0),
    ).toBe(100);
    expect(config.weights.activity).toBe(18);
    expect(config.weights.organization).toBe(15);
    expect(config.features.adoption.starStockWeight).toBe(0.15);
    expect(config.features.momentum.starVelocityWeight).toBe(0.3);
  });

  it("keeps GitHub Search queries valid and seeds every direction", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");

    expect(
      config.directions.every(
        (direction) => !/\b(?:AND|OR|NOT)\s+topic:/i.test(direction.query),
      ),
    ).toBe(true);
    for (const direction of config.directions) {
      expect(
        config.seedRepositories.filter(
          (repository) => repository.direction === direction.id,
        ),
      ).toHaveLength(3);
    }
  });

  it("registers every source with evidence and independence metadata", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");

    expect(
      config.sources.find((source) => source.sourceId === "ai-hot"),
    ).toEqual({
      sourceId: "ai-hot",
      name: "AI HOT",
      tier: "C",
      purpose: ["discovery", "cross_validation"],
      independenceGroup: "ai-hot-aggregator",
      evidenceUrl: "https://aihot.virxact.com/all",
    });

    expect(config.sources.length).toBeGreaterThanOrEqual(7);
    expect(new Set(config.sources.map((source) => source.sourceId)).size).toBe(
      config.sources.length,
    );
    expect(
      config.sources.every((source) =>
        source.evidenceUrl.startsWith("https://"),
      ),
    ).toBe(true);
    expect(
      config.sources.every((source) => source.independenceGroup.length > 2),
    ).toBe(true);
  });

  it("rejects seed sets and limits that cannot preserve every direction", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const oneSidedSeeds = config.seedRepositories.map((repository) => ({
      ...repository,
      direction:
        repository.direction === "security-supply-chain"
          ? ("ai-agent" as const)
          : repository.direction,
    }));

    expect(() =>
      PicksConfigSchema.parse({ ...config, seedRepositories: oneSidedSeeds }),
    ).toThrow("each direction must have enough seed repositories");
    expect(() =>
      PicksConfigSchema.parse({
        ...config,
        limits: { ...config.limits, candidateLimit: 14 },
      }),
    ).toThrow("candidate limit must fit direction minimums");
  });
});
