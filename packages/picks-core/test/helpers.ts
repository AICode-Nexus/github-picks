import type {
  DirectionId,
  RepositoryScore,
  RepositorySnapshot,
  ScoredRepository,
} from "../src/schema.js";

const observedAt = "2026-08-03T15:30:00.000Z";

export interface ScoredOptions {
  fullName: string;
  ownerLogin?: string;
  direction?: DirectionId;
  publishedScore?: number;
  confidence?: number;
  eligibility?: RepositoryScore["eligibility"];
  stars?: number;
  createdAt?: string;
  archived?: boolean;
  dimensions?: Partial<RepositoryScore["dimensions"]>;
  riskPenalty?: number;
  missingFields?: string[];
}

export function makeSnapshot(options: ScoredOptions): RepositorySnapshot {
  const ownerLogin =
    options.ownerLogin ?? options.fullName.split("/")[0] ?? "example";
  return {
    nodeId: `R_${options.fullName.replace("/", "_")}`,
    fullName: options.fullName,
    url: `https://github.com/${options.fullName}`,
    ownerLogin,
    ownerType: "Organization",
    description:
      "A useful open source project with clear developer documentation",
    homepage: null,
    language: "TypeScript",
    topics: ["developer-tools"],
    createdAt: options.createdAt ?? "2026-06-01T00:00:00.000Z",
    updatedAt: observedAt,
    pushedAt: observedAt,
    defaultBranch: "main",
    stars: options.stars ?? 2000,
    forks: 200,
    watchers: 20,
    openIssues: 10,
    archived: options.archived ?? false,
    licenseSpdx: "Apache-2.0",
    direction: options.direction ?? "infra-devtools",
    eventFeatures: {
      activeDays7d: 5,
      activeDays30d: 15,
      humanActors30d: 8,
      pushes30d: 20,
      pullRequests30d: 8,
      issues30d: 6,
      releases30d: 1,
    },
    scorecard: null,
    candidateSignals: [
      {
        fullName: options.fullName,
        sourceId: "gittrend",
        sourceTier: "B",
        independenceGroup: "github-public-data",
        direction: options.direction ?? "infra-devtools",
        evidenceUrl: "https://gittrend.io/api/trending?limit=50",
        observedAt,
        rank: 5,
        sourceScore: 80,
        stale: false,
        summaryZh: null,
        metrics: {
          starVelocity: 100,
          trendingScore: 80,
          discussionPoints: null,
          discussionComments: null,
        },
        rawObjectRef: null,
      },
    ],
    evidence: [
      {
        id: `github-rest:repository:${options.fullName.replace("/", "-")}`,
        sourceId: "github-rest",
        sourceTier: "S",
        independenceGroup: "github-public-data",
        evidenceUrl: `https://github.com/${options.fullName}`,
        observedAt,
        field: "repository",
        value: { archived: options.archived ?? false },
        rawObjectRef: null,
      },
    ],
    missingFields: options.missingFields ?? ["scorecard"],
  };
}

export function makeScore(options: ScoredOptions): RepositoryScore {
  const dimensions = {
    utility: 75,
    activity: 75,
    organization: 70,
    engineering: 70,
    adoption: 60,
    security: 65,
    momentum: 70,
    innovation: 60,
    ...options.dimensions,
  };
  const riskPenalty = options.riskPenalty ?? 0;
  return {
    version: "v0.1.0",
    dimensions,
    features: {},
    confidence: options.confidence ?? 0.8,
    confidenceComponents: {
      keyCompleteness: 0.8,
      independentSources: 0.75,
      sourceConsistency: 1,
      freshness: 1,
      observationWindow: 1,
      entityMapping: 1,
      collectionHealth: 0.8,
    },
    riskPenalty,
    riskFindings:
      riskPenalty === 0
        ? []
        : [
            {
              code: "license-missing",
              level: "medium",
              penalty: riskPenalty,
              message: "许可证证据不足。",
              evidenceIds: [],
            },
          ],
    baseScore: options.publishedScore ?? 75,
    publishedScore: options.publishedScore ?? 75,
    eligibility: options.eligibility ?? "eligible",
  };
}

export function makeScoredRepository(options: ScoredOptions): ScoredRepository {
  return {
    snapshot: makeSnapshot(options),
    score: makeScore(options),
    analysis: {
      why: `${options.fullName} 值得关注，因为具有可追溯的活跃证据。`,
      suitableFor: "适合进行开发工具选型的工程团队。",
      risks: "风险：仍需补充长期采用证据。",
      nextStep: "下一步：先在隔离环境中试用。",
      evidenceUrls: [`https://github.com/${options.fullName}`],
    },
  };
}
