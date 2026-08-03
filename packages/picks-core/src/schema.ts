import { z } from "zod";

export const DirectionIdSchema = z.enum([
  "ai-agent",
  "data-ml",
  "app-platform",
  "infra-devtools",
  "security-supply-chain",
]);
export type DirectionId = z.infer<typeof DirectionIdSchema>;

export const SourceTierSchema = z.enum(["S", "A", "B", "C"]);
export const SourcePurposeSchema = z.enum([
  "discovery",
  "fact",
  "risk",
  "cross_validation",
]);
export const HealthStatusSchema = z.enum(["healthy", "degraded", "offline"]);

export const DirectionDefinitionSchema = z
  .object({
    id: DirectionIdSchema,
    name: z.string().min(2),
    query: z.string().min(8),
  })
  .strict();

export const SourceDefinitionSchema = z
  .object({
    sourceId: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(2),
    tier: SourceTierSchema,
    purpose: z.array(SourcePurposeSchema).min(1),
    independenceGroup: z.string().min(3),
    evidenceUrl: z.url(),
  })
  .strict();

export const DimensionWeightsSchema = z
  .object({
    utility: z.number().nonnegative(),
    activity: z.number().nonnegative(),
    organization: z.number().nonnegative(),
    engineering: z.number().nonnegative(),
    adoption: z.number().nonnegative(),
    security: z.number().nonnegative(),
    momentum: z.number().nonnegative(),
    innovation: z.number().nonnegative(),
  })
  .strict()
  .superRefine((weights, context) => {
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    if (total !== 100) {
      context.addIssue({
        code: "custom",
        message: `dimension weights must total 100, got ${total}`,
      });
    }
  });

export const PicksConfigSchema = z
  .object({
    version: z.string().regex(/^v\d+\.\d+\.\d+$/),
    timezone: z.literal("Asia/Shanghai"),
    directions: z.array(DirectionDefinitionSchema).length(5),
    sources: z.array(SourceDefinitionSchema).min(7),
    weights: DimensionWeightsSchema,
    features: z
      .object({
        adoption: z
          .object({ starStockWeight: z.number().min(0).max(1) })
          .strict(),
        momentum: z
          .object({ starVelocityWeight: z.number().min(0).max(1) })
          .strict(),
      })
      .strict(),
    limits: z
      .object({
        candidateLimit: z.int().positive(),
        enrichmentLimit: z.int().positive(),
        perDirectionMinimum: z.int().positive(),
        overallLimit: z.int().positive(),
        directionLimit: z.int().positive(),
        organizationLimit: z.int().positive(),
        enrichmentConcurrency: z.int().positive(),
      })
      .strict(),
    ranking: z
      .object({
        ordinaryMinimumConfidence: z.number().min(0).max(1),
        overallMinimumConfidence: z.number().min(0).max(1),
        hiddenGemMaximumStars: z.int().positive(),
        newProjectMaximumAgeDays: z.int().positive(),
      })
      .strict(),
  })
  .strict()
  .superRefine((config, context) => {
    const sourceIds = new Set(config.sources.map((source) => source.sourceId));
    if (sourceIds.size !== config.sources.length) {
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: "source IDs must be unique",
      });
    }
    const directionIds = new Set(
      config.directions.map((direction) => direction.id),
    );
    if (directionIds.size !== config.directions.length) {
      context.addIssue({
        code: "custom",
        path: ["directions"],
        message: "direction IDs must be unique",
      });
    }
  });
export type PicksConfig = z.infer<typeof PicksConfigSchema>;

export const EvidenceSchema = z
  .object({
    id: z.string().min(8),
    sourceId: z.string().regex(/^[a-z0-9-]+$/),
    sourceTier: SourceTierSchema,
    independenceGroup: z.string().min(3),
    evidenceUrl: z.url(),
    observedAt: z.iso.datetime(),
    field: z.string().min(1),
    value: z.unknown(),
    rawObjectRef: z.string().nullable(),
  })
  .strict();
export type Evidence = z.infer<typeof EvidenceSchema>;

export const CandidateMetricsSchema = z
  .object({
    starVelocity: z.number().nonnegative().nullable(),
    trendingScore: z.number().nonnegative().nullable(),
    discussionPoints: z.number().nonnegative().nullable(),
    discussionComments: z.number().nonnegative().nullable(),
  })
  .strict();

export const CandidateSignalSchema = z
  .object({
    fullName: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    sourceId: z.string().regex(/^[a-z0-9-]+$/),
    sourceTier: SourceTierSchema,
    independenceGroup: z.string().min(3),
    direction: DirectionIdSchema.nullable(),
    evidenceUrl: z.url(),
    observedAt: z.iso.datetime(),
    rank: z.int().positive().nullable(),
    sourceScore: z.number().nullable(),
    stale: z.boolean(),
    summaryZh: z.string().nullable(),
    metrics: CandidateMetricsSchema,
    rawObjectRef: z.string().nullable(),
  })
  .strict();
export type CandidateSignal = z.infer<typeof CandidateSignalSchema>;

export const CandidateSchema = z
  .object({
    fullName: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    primaryDirection: DirectionIdSchema,
    directions: z.array(DirectionIdSchema).min(1),
    signals: z.array(CandidateSignalSchema).min(1),
  })
  .strict();
export type Candidate = z.infer<typeof CandidateSchema>;

export const RepositoryEventFeaturesSchema = z
  .object({
    activeDays7d: z.int().nonnegative(),
    activeDays30d: z.int().nonnegative(),
    humanActors30d: z.int().nonnegative(),
    pushes30d: z.int().nonnegative(),
    pullRequests30d: z.int().nonnegative(),
    issues30d: z.int().nonnegative(),
    releases30d: z.int().nonnegative(),
  })
  .strict();

export const ScorecardSnapshotSchema = z
  .object({
    score: z.number().min(0).max(10),
    date: z.string().min(8),
    checks: z.array(
      z
        .object({ name: z.string(), score: z.number().min(-1).max(10) })
        .strict(),
    ),
  })
  .strict();

export const RepositorySnapshotSchema = z
  .object({
    nodeId: z.string().min(1),
    fullName: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    url: z.url(),
    ownerLogin: z.string().min(1),
    ownerType: z.enum(["Organization", "User"]),
    description: z.string().nullable(),
    homepage: z.string().nullable(),
    language: z.string().nullable(),
    topics: z.array(z.string()),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    pushedAt: z.iso.datetime(),
    defaultBranch: z.string().min(1),
    stars: z.int().nonnegative(),
    forks: z.int().nonnegative(),
    watchers: z.int().nonnegative(),
    openIssues: z.int().nonnegative(),
    archived: z.boolean(),
    licenseSpdx: z.string().nullable(),
    direction: DirectionIdSchema,
    eventFeatures: RepositoryEventFeaturesSchema,
    scorecard: ScorecardSnapshotSchema.nullable(),
    candidateSignals: z.array(CandidateSignalSchema).min(1),
    evidence: z.array(EvidenceSchema).min(1),
    missingFields: z.array(z.string()),
  })
  .strict();
export type RepositorySnapshot = z.infer<typeof RepositorySnapshotSchema>;

export const DimensionScoresSchema = z
  .object({
    utility: z.number().min(0).max(100),
    activity: z.number().min(0).max(100),
    organization: z.number().min(0).max(100),
    engineering: z.number().min(0).max(100),
    adoption: z.number().min(0).max(100),
    security: z.number().min(0).max(100),
    momentum: z.number().min(0).max(100),
    innovation: z.number().min(0).max(100),
  })
  .strict();
export type DimensionScores = z.infer<typeof DimensionScoresSchema>;

export const FeatureScoreSchema = z
  .object({
    score: z.number().min(0).max(100),
    status: z.enum(["observed", "prior", "negative", "not_applicable"]),
    evidenceIds: z.array(z.string()),
    note: z.string().min(2),
  })
  .strict();

export const ConfidenceComponentsSchema = z
  .object({
    keyCompleteness: z.number().min(0).max(1),
    independentSources: z.number().min(0).max(1),
    sourceConsistency: z.number().min(0).max(1),
    freshness: z.number().min(0).max(1),
    observationWindow: z.number().min(0).max(1),
    entityMapping: z.number().min(0).max(1),
    collectionHealth: z.number().min(0).max(1),
  })
  .strict();

export const RiskFindingSchema = z
  .object({
    code: z.string().regex(/^[a-z0-9-]+$/),
    level: z.enum(["low", "medium", "high", "critical"]),
    penalty: z.number().min(0).max(30),
    message: z.string().min(2),
    evidenceIds: z.array(z.string()),
  })
  .strict();

export const RepositoryScoreSchema = z
  .object({
    version: z.string().regex(/^v\d+\.\d+\.\d+$/),
    dimensions: DimensionScoresSchema,
    features: z.record(z.string(), FeatureScoreSchema),
    confidence: z.number().min(0).max(1),
    confidenceComponents: ConfidenceComponentsSchema,
    riskPenalty: z.number().min(0).max(30),
    riskFindings: z.array(RiskFindingSchema),
    baseScore: z.number().min(0).max(100),
    publishedScore: z.number().min(0).max(100),
    eligibility: z.enum(["eligible", "watch", "quarantined", "excluded"]),
  })
  .strict();
export type RepositoryScore = z.infer<typeof RepositoryScoreSchema>;

export const ChineseAnalysisSchema = z
  .object({
    why: z.string().min(10),
    suitableFor: z.string().min(6),
    risks: z.string().min(6),
    nextStep: z.string().min(6),
    evidenceUrls: z.array(z.url()).min(1),
  })
  .strict();
export type ChineseAnalysis = z.infer<typeof ChineseAnalysisSchema>;

export const ScoredRepositorySchema = z
  .object({
    snapshot: RepositorySnapshotSchema,
    score: RepositoryScoreSchema,
    analysis: ChineseAnalysisSchema,
  })
  .strict();
export type ScoredRepository = z.infer<typeof ScoredRepositorySchema>;

export const SourceHealthSchema = z
  .object({
    sourceId: z.string().regex(/^[a-z0-9-]+$/),
    status: HealthStatusSchema,
    observedAt: z.iso.datetime(),
    message: z.string().nullable(),
  })
  .strict();
export type SourceHealth = z.infer<typeof SourceHealthSchema>;

export const RankingsSchema = z
  .object({
    overall: z.array(z.string()),
    rising: z.array(z.string()),
    newProjects: z.array(z.string()),
    hiddenGems: z.array(z.string()),
    active: z.array(z.string()),
    byDirection: z.record(DirectionIdSchema, z.array(z.string())),
  })
  .strict();
export type Rankings = z.infer<typeof RankingsSchema>;

export const DailyReportSchema = z
  .object({
    date: z.iso.date(),
    timezone: z.literal("Asia/Shanghai"),
    generatedAt: z.iso.datetime(),
    scoreVersion: z.string().regex(/^v\d+\.\d+\.\d+$/),
    configHash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceHealth: z.array(SourceHealthSchema),
    counts: z
      .object({
        discovered: z.int().nonnegative(),
        enriched: z.int().nonnegative(),
        published: z.int().nonnegative(),
      })
      .strict(),
    repositories: z.array(ScoredRepositorySchema),
    rankings: RankingsSchema,
  })
  .strict();
export type DailyReport = z.infer<typeof DailyReportSchema>;

export const RawArtifactRefSchema = z
  .object({
    objectRef: z.string().min(8),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceId: z.string().regex(/^[a-z0-9-]+$/),
    path: z.string().min(1),
    observedAt: z.iso.datetime(),
    url: z.url(),
  })
  .strict();
export type RawArtifactRef = z.infer<typeof RawArtifactRefSchema>;
