import { describe, expect, it } from "vitest";
import { loadPicksConfig } from "../src/config.js";

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

  it("registers every source with evidence and independence metadata", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");

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
});
