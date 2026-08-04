import { describe, expect, it } from "vitest";
import {
  loadPicksConfig,
  type PicksConfig,
  type RepositorySnapshot,
  RepositorySnapshotSchema,
} from "../src/index.js";
import {
  scoreContribution,
  scoreRepository,
  sumDimensionWeights,
} from "../src/scoring.js";

const observedAt = "2026-08-03T15:30:00.000Z";

function makeSnapshot(
  overrides: Partial<RepositorySnapshot> = {},
): RepositorySnapshot {
  const base: RepositorySnapshot = {
    nodeId: "R_kgDOExample",
    fullName: "example/active-project",
    url: "https://github.com/example/active-project",
    ownerLogin: "example",
    ownerType: "Organization",
    description: "A practical developer tool with a documented workflow",
    homepage: "https://example.dev",
    language: "TypeScript",
    topics: ["devtools", "automation", "typescript"],
    createdAt: "2025-10-01T00:00:00.000Z",
    updatedAt: "2026-08-03T14:00:00.000Z",
    pushedAt: "2026-08-03T13:00:00.000Z",
    defaultBranch: "main",
    stars: 3200,
    forks: 420,
    watchers: 80,
    openIssues: 32,
    archived: false,
    licenseSpdx: "Apache-2.0",
    direction: "infra-devtools",
    eventFeatures: {
      activeDays7d: 6,
      activeDays30d: 18,
      humanActors30d: 12,
      pushes30d: 30,
      pullRequests30d: 14,
      issues30d: 10,
      releases30d: 2,
    },
    scorecard: {
      score: 8.2,
      date: "2026-08-03",
      checks: [
        { name: "Maintained", score: 10 },
        { name: "Code-Review", score: 8 },
      ],
    },
    candidateSignals: [
      {
        fullName: "example/active-project",
        sourceId: "gittrend",
        sourceTier: "B",
        independenceGroup: "github-public-data",
        direction: "infra-devtools",
        evidenceUrl: "https://gittrend.io/api/trending?limit=50",
        observedAt,
        rank: 4,
        sourceScore: 90,
        stale: false,
        summaryZh: null,
        metrics: {
          starVelocity: 180,
          trendingScore: 90,
          discussionPoints: null,
          discussionComments: null,
        },
        rawObjectRef: `sha256:${"a".repeat(64)}`,
      },
      {
        fullName: "example/active-project",
        sourceId: "hacker-news",
        sourceTier: "B",
        independenceGroup: "hacker-news-community",
        direction: null,
        evidenceUrl: "https://news.ycombinator.com/item?id=1",
        observedAt,
        rank: 3,
        sourceScore: 42,
        stale: false,
        summaryZh: null,
        metrics: {
          starVelocity: null,
          trendingScore: null,
          discussionPoints: 42,
          discussionComments: 16,
        },
        rawObjectRef: `sha256:${"b".repeat(64)}`,
      },
    ],
    evidence: [
      {
        id: "github-rest:repository:abc123",
        sourceId: "github-rest",
        sourceTier: "S",
        independenceGroup: "github-public-data",
        evidenceUrl: "https://github.com/example/active-project",
        observedAt,
        field: "repository",
        value: { archived: false },
        rawObjectRef: `sha256:${"c".repeat(64)}`,
      },
      {
        id: "openssf-scorecard:score:def456",
        sourceId: "openssf-scorecard",
        sourceTier: "A",
        independenceGroup: "openssf-security",
        evidenceUrl:
          "https://api.securityscorecards.dev/projects/github.com/example/active-project",
        observedAt,
        field: "scorecard",
        value: { score: 8.2 },
        rawObjectRef: `sha256:${"d".repeat(64)}`,
      },
    ],
    missingFields: [],
  };
  return RepositorySnapshotSchema.parse({ ...base, ...overrides });
}

describe("explainable repository scoring", () => {
  it("requires the eight dimension weights to total 100", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    expect(sumDimensionWeights(config)).toBe(100);
  });

  it("caps total Star stock contribution at 1.5 published points", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    expect(
      scoreContribution("adoption.starStock", 100, config),
    ).toBeLessThanOrEqual(1.5);
  });

  it("caps Star velocity contribution at 3 published points", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    expect(
      scoreContribution("momentum.starVelocity", 100, config),
    ).toBeLessThanOrEqual(3);
  });

  it("does not let additional Stars change engineering or organization", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const before = scoreRepository(makeSnapshot(), config);
    const after = scoreRepository(makeSnapshot({ stars: 1_000_000 }), config);

    expect(after.dimensions.engineering).toBe(before.dimensions.engineering);
    expect(after.dimensions.organization).toBe(before.dimensions.organization);
  });

  it("ranks sustained activity above an inactive repository with many Stars", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const activeSnapshot = makeSnapshot();
    const signal = activeSnapshot.candidateSignals[0];
    const repositoryEvidence = activeSnapshot.evidence[0];
    if (signal === undefined || repositoryEvidence === undefined) {
      throw new Error("scoring fixture must contain signal and evidence");
    }
    const active = scoreRepository(activeSnapshot, config);
    const inactive = scoreRepository(
      makeSnapshot({
        nodeId: "R_inactive",
        fullName: "example/inactive-project",
        url: "https://github.com/example/inactive-project",
        stars: 1_000_000,
        forks: 20,
        watchers: 2,
        pushedAt: "2025-01-01T00:00:00.000Z",
        eventFeatures: {
          activeDays7d: 0,
          activeDays30d: 0,
          humanActors30d: 0,
          pushes30d: 0,
          pullRequests30d: 0,
          issues30d: 0,
          releases30d: 0,
        },
        candidateSignals: [signal],
        evidence: [repositoryEvidence],
        scorecard: null,
        missingFields: ["scorecard"],
      }),
      config,
    );

    expect(active.publishedScore).toBeGreaterThan(inactive.publishedScore);
  });

  it("treats a missing Scorecard as uncertainty rather than risk", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const score = scoreRepository(
      makeSnapshot({ scorecard: null, missingFields: ["scorecard"] }),
      config,
    );

    expect(score.riskPenalty).toBe(0);
    expect(score.features["security.scorecard"]?.status).toBe("prior");
  });

  it("uses a neutral prior for missing trend and discussion observations", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const baseline = makeSnapshot();
    const signal = baseline.candidateSignals[0];
    if (signal === undefined)
      throw new Error("scoring fixture must contain a signal");
    const score = scoreRepository(
      makeSnapshot({
        candidateSignals: [
          {
            ...signal,
            rank: null,
            sourceScore: null,
            metrics: {
              starVelocity: null,
              trendingScore: null,
              discussionPoints: null,
              discussionComments: null,
            },
          },
        ],
      }),
      config,
    );

    expect(score.features["momentum.starVelocity"]?.score).toBe(50);
    expect(score.features["momentum.sourceRank"]?.score).toBe(50);
    expect(score.features["momentum.discussion"]?.score).toBe(50);
    expect(score.features["adoption.discussion"]?.score).toBe(50);
  });

  it("records a missing license as a six-point independent risk", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const score = scoreRepository(makeSnapshot({ licenseSpdx: null }), config);

    expect(score.riskPenalty).toBe(6);
    expect(score.riskFindings.map((finding) => finding.code)).toContain(
      "license-missing",
    );
  });

  it("excludes an archived repository regardless of its value dimensions", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const score = scoreRepository(
      makeSnapshot({ archived: true, stars: 2_000_000 }),
      config,
    );

    expect(score.eligibility).toBe("excluded");
  });

  it("does not turn an aggregator source score into repository value", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const snapshot = makeSnapshot();
    const signal = snapshot.candidateSignals[0];
    if (signal === undefined) {
      throw new Error("scoring fixture must contain a signal");
    }
    const aiHotSignal = {
      ...signal,
      sourceId: "ai-hot",
      sourceTier: "C" as const,
      independenceGroup: "ai-hot-aggregator",
      rank: null,
      metrics: {
        starVelocity: null,
        trendingScore: null,
        discussionPoints: null,
        discussionComments: null,
      },
    };
    const low = scoreRepository(
      makeSnapshot({
        candidateSignals: [{ ...aiHotSignal, sourceScore: 1 }],
      }),
      config,
    );
    const high = scoreRepository(
      makeSnapshot({
        candidateSignals: [{ ...aiHotSignal, sourceScore: 99 }],
      }),
      config,
    );

    expect(high.dimensions).toEqual(low.dimensions);
    expect(high.publishedScore).toBe(low.publishedScore);
    expect(high.riskPenalty).toBe(low.riskPenalty);
  });

  it("returns byte-identical results for the same snapshot and config", async () => {
    const config: PicksConfig = await loadPicksConfig(
      "../../config/picks.yaml",
    );
    const snapshot = makeSnapshot();

    expect(scoreRepository(snapshot, config)).toEqual(
      scoreRepository(snapshot, config),
    );
  });
});
