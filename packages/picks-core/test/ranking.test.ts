import { describe, expect, it } from "vitest";
import { loadPicksConfig } from "../src/config.js";
import { buildRankings } from "../src/ranking.js";
import { makeScoredRepository } from "./helpers.js";

describe("independent daily rankings", () => {
  it("limits one organization to two repositories in the overall list", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const rankings = buildRankings(
      [
        makeScoredRepository({
          fullName: "same/one",
          ownerLogin: "same",
          publishedScore: 95,
        }),
        makeScoredRepository({
          fullName: "same/two",
          ownerLogin: "same",
          publishedScore: 94,
        }),
        makeScoredRepository({
          fullName: "same/three",
          ownerLogin: "same",
          publishedScore: 93,
        }),
        makeScoredRepository({
          fullName: "other/four",
          ownerLogin: "other",
          publishedScore: 92,
        }),
      ],
      config,
    );

    expect(
      rankings.overall.filter((fullName) => fullName.startsWith("same/")),
    ).toHaveLength(2);
    expect(rankings.overall).toContain("other/four");
  });

  it("keeps excluded repositories out of every ordinary ranking", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const rankings = buildRankings(
      [
        makeScoredRepository({
          fullName: "example/archived",
          publishedScore: 100,
          eligibility: "excluded",
          archived: true,
        }),
        makeScoredRepository({
          fullName: "example/healthy",
          publishedScore: 70,
        }),
      ],
      config,
    );
    const allEntries = [
      ...rankings.overall,
      ...rankings.rising,
      ...rankings.newProjects,
      ...rankings.hiddenGems,
      ...rankings.active,
      ...Object.values(rankings.byDirection).flat(),
    ];

    expect(allEntries).not.toContain("example/archived");
    expect(allEntries).toContain("example/healthy");
  });

  it("publishes a separate list for every populated direction", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const directions = config.directions.map((direction) => direction.id);
    const rankings = buildRankings(
      directions.map((direction, index) =>
        makeScoredRepository({
          fullName: `example/project-${index}`,
          direction,
          publishedScore: 80 - index,
        }),
      ),
      config,
    );

    expect(Object.keys(rankings.byDirection).sort()).toEqual(
      [...directions].sort(),
    );
    expect(
      Object.values(rankings.byDirection).every((items) => items.length === 1),
    ).toBe(true);
  });

  it("uses momentum and activity formulas independently from the overall score", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const rankings = buildRankings(
      [
        makeScoredRepository({
          fullName: "example/high-overall",
          publishedScore: 90,
          dimensions: { momentum: 40, activity: 50 },
        }),
        makeScoredRepository({
          fullName: "example/high-momentum",
          publishedScore: 75,
          dimensions: { momentum: 98, activity: 65, innovation: 90 },
        }),
        makeScoredRepository({
          fullName: "example/high-activity",
          publishedScore: 74,
          dimensions: { momentum: 55, activity: 99 },
        }),
      ],
      config,
    );

    expect(rankings.overall[0]).toBe("example/high-overall");
    expect(rankings.rising[0]).toBe("example/high-momentum");
    expect(rankings.active[0]).toBe("example/high-activity");
  });

  it("breaks equal scores by normalized repository name", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const rankings = buildRankings(
      [
        makeScoredRepository({ fullName: "example/zeta", publishedScore: 80 }),
        makeScoredRepository({ fullName: "example/alpha", publishedScore: 80 }),
      ],
      config,
    );

    expect(rankings.overall).toEqual(["example/alpha", "example/zeta"]);
  });
});
