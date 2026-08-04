import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  analyzeRepository,
  buildRankings,
  type Candidate,
  type DailyReport,
  DailyReportSchema,
  hashPicksConfig,
  loadPicksConfig,
  type RepositorySnapshot,
  RepositorySnapshotSchema,
  renderDailyMarkdown,
  type ScoredRepository,
  ScoredRepositorySchema,
  type SourceHealth,
  SourceHealthSchema,
  scoreRepository,
} from "@github-picks/core";
import { z } from "zod";
import type {
  RecommendationGenerator,
  RecommendationInput,
} from "./ai-analysis.js";
import { discoverCandidates } from "./discovery.js";
import { enrichCandidate } from "./enrichment.js";
import { FileRawStore } from "./raw-store.js";
import { ConfiguredSeedAdapter } from "./sources/configured-seed.js";
import { GitHubSearchAdapter } from "./sources/github-search.js";
import { GitHubTrendingAdapter } from "./sources/github-trending.js";
import { GitTrendAdapter } from "./sources/gittrend.js";
import { HackerNewsAdapter } from "./sources/hacker-news.js";
import { HubLensAdapter } from "./sources/hublens.js";

const ReplayManifestSchema = z
  .object({
    version: z.literal(1),
    observedAt: z.iso.datetime(),
    discoveredCount: z.int().nonnegative(),
    sourceHealth: z.array(SourceHealthSchema),
    snapshots: z.array(RepositorySnapshotSchema).min(1),
  })
  .strict();

export interface PipelineOptions {
  mode: "live" | "replay";
  date: string;
  configPath: string;
  outputDirectory: string;
  rawDirectory: string;
  replayManifestPath: string;
  githubToken: string | null;
  fetchImpl?: typeof fetch | undefined;
  recommendationGenerator?: RecommendationGenerator | null;
  analysisRequired?: boolean;
}

interface SnapshotBatch {
  snapshots: RepositorySnapshot[];
  discoveredCount: number;
  sourceHealth: SourceHealth[];
  observedAt: string;
}

function selectCandidates(
  candidates: Candidate[],
  enrichmentLimit: number,
  perDirection: number,
): Candidate[] {
  const selected = new Map<string, Candidate>();
  const directions = [
    "ai-agent",
    "data-ml",
    "app-platform",
    "infra-devtools",
    "security-supply-chain",
  ] as const;
  for (const direction of directions) {
    const matches = candidates
      .filter((candidate) => candidate.primaryDirection === direction)
      .slice(0, perDirection);
    for (const candidate of matches)
      selected.set(candidate.fullName, candidate);
  }
  for (const candidate of candidates) {
    if (selected.size >= enrichmentLimit) break;
    selected.set(candidate.fullName, candidate);
  }
  return [...selected.values()].slice(0, enrichmentLimit);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<R>,
): Promise<{ values: R[]; failures: number }> {
  const results: Array<R | undefined> = new Array(values.length);
  let cursor = 0;
  let failures = 0;
  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      const value = values[index];
      if (value === undefined) continue;
      try {
        results[index] = await operation(value);
      } catch {
        failures += 1;
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), values.length) },
      () => worker(),
    ),
  );
  return {
    values: results.filter((value): value is R => value !== undefined),
    failures,
  };
}

async function replayBatch(path: string): Promise<SnapshotBatch> {
  const manifest = ReplayManifestSchema.parse(
    JSON.parse(await readFile(path, "utf8")),
  );
  return {
    snapshots: manifest.snapshots,
    discoveredCount: manifest.discoveredCount,
    sourceHealth: manifest.sourceHealth,
    observedAt: manifest.observedAt,
  };
}

async function liveBatch(
  options: PipelineOptions,
  config: Awaited<ReturnType<typeof loadPicksConfig>>,
): Promise<SnapshotBatch> {
  const observedAt = new Date().toISOString();
  const rawStore = new FileRawStore(options.rawDirectory);
  const discovery = await discoverCandidates(
    [
      new ConfiguredSeedAdapter(),
      new GitHubTrendingAdapter(),
      new GitHubSearchAdapter(),
      new GitTrendAdapter(),
      new HubLensAdapter(),
      new HackerNewsAdapter(),
    ],
    {
      config,
      observedAt,
      rawStore,
      githubToken: options.githubToken,
      fetchImpl: options.fetchImpl,
    },
  );
  const selected = selectCandidates(
    discovery.candidates,
    config.limits.enrichmentLimit,
    config.limits.perDirectionMinimum,
  );
  const enrichment = await mapWithConcurrency(
    selected,
    config.limits.enrichmentConcurrency,
    (candidate) =>
      enrichCandidate(candidate, {
        observedAt,
        reportDate: options.date,
        rawStore,
        githubToken: options.githubToken,
        fetchImpl: options.fetchImpl,
      }),
  );
  if (enrichment.values.length === 0)
    throw new Error("no candidates could be enriched");
  const scorecardCount = enrichment.values.filter(
    (snapshot) => snapshot.scorecard !== null,
  ).length;
  const sourceHealth: SourceHealth[] = [
    ...discovery.sourceHealth,
    {
      sourceId: "github-rest",
      status:
        enrichment.failures === selected.length
          ? "offline"
          : enrichment.failures > 0
            ? "degraded"
            : "healthy",
      observedAt,
      message:
        enrichment.failures > 0
          ? `${enrichment.failures}/${selected.length} 个候选补全失败`
          : null,
    },
    {
      sourceId: "openssf-scorecard",
      status: scorecardCount === 0 ? "degraded" : "healthy",
      observedAt,
      message:
        scorecardCount === enrichment.values.length
          ? null
          : `${enrichment.values.length - scorecardCount}/${enrichment.values.length} 个项目缺少 Scorecard`,
    },
  ];
  return {
    snapshots: enrichment.values,
    discoveredCount: discovery.candidates.length,
    sourceHealth,
    observedAt,
  };
}

function scoreSnapshots(
  snapshots: RepositorySnapshot[],
  config: Awaited<ReturnType<typeof loadPicksConfig>>,
  generatedAt: string,
): ScoredRepository[] {
  return snapshots.map((snapshot) => {
    const score = scoreRepository(snapshot, config);
    const analysis = analyzeRepository({ snapshot, score, generatedAt });
    return ScoredRepositorySchema.parse({ snapshot, score, analysis });
  });
}

interface AnalysisBatchResult {
  repositories: ScoredRepository[];
  health: SourceHealth;
}

async function generateAiRecommendations(
  repositories: ScoredRepository[],
  generator: RecommendationGenerator | null,
  generatedAt: string,
  required: boolean,
): Promise<AnalysisBatchResult> {
  if (generator === null) {
    if (required) {
      throw new Error(
        "AI analysis is required but GITHUB_PICKS_AI_MODEL is not configured",
      );
    }
    return {
      repositories,
      health: {
        sourceId: "ai-analysis",
        status: "degraded",
        observedAt: generatedAt,
        message: "未配置 AI 分析模型；公开内容使用规则事实摘要",
      },
    };
  }
  const activeGenerator = generator;

  const generated = new Map<string, ScoredRepository>();
  const failures: string[] = [];
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < repositories.length) {
      const index = cursor;
      cursor += 1;
      const repository = repositories[index];
      if (repository === undefined) continue;
      const input: RecommendationInput = {
        snapshot: repository.snapshot,
        score: repository.score,
        fallback: repository.analysis,
        generatedAt,
      };
      try {
        const recommendationReason = await activeGenerator.generate(input);
        const evidenceHash = repository.analysis.generation?.evidenceHash;
        if (evidenceHash === undefined) {
          throw new Error("rule analysis did not provide an evidence hash");
        }
        generated.set(
          repository.snapshot.fullName,
          ScoredRepositorySchema.parse({
            ...repository,
            analysis: {
              ...repository.analysis,
              recommendationReason,
              generation: {
                kind: "ai",
                status: "verified",
                provider: activeGenerator.provider,
                model: activeGenerator.model,
                promptVersion: activeGenerator.promptVersion,
                analysisVersion: activeGenerator.analysisVersion,
                evidenceHash,
                generatedAt,
              },
            },
          }),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unknown error";
        failures.push(`${repository.snapshot.fullName}: ${message}`);
      }
    }
  }
  await Promise.all(
    Array.from(
      {
        length: Math.min(
          Math.max(1, activeGenerator.concurrency),
          repositories.length,
        ),
      },
      () => worker(),
    ),
  );

  if (required && failures.length > 0) {
    throw new Error(
      `AI analysis failed for ${failures.length}/${repositories.length}: ${failures.slice(0, 5).join(" | ")}`,
    );
  }
  const successCount = generated.size;
  return {
    repositories: repositories.map(
      (repository) => generated.get(repository.snapshot.fullName) ?? repository,
    ),
    health: {
      sourceId: "ai-analysis",
      status: failures.length === 0 ? "healthy" : "degraded",
      observedAt: generatedAt,
      message:
        failures.length === 0
          ? `${successCount}/${repositories.length} 个项目的 AI 推荐理由已通过结构与事实边界校验 · ${activeGenerator.provider}/${activeGenerator.model}`
          : `${successCount}/${repositories.length} 个项目使用 AI 推荐理由；${failures.length} 个降级为规则摘要`,
    },
  };
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, contents, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function manifestFor(report: DailyReport) {
  const rawObjectRefs = [
    ...report.repositories.flatMap((item) =>
      item.snapshot.evidence.flatMap((evidence) =>
        evidence.rawObjectRef === null ? [] : [evidence.rawObjectRef],
      ),
    ),
    ...report.repositories.flatMap((item) =>
      item.snapshot.candidateSignals.flatMap((signal) =>
        signal.rawObjectRef === null ? [] : [signal.rawObjectRef],
      ),
    ),
  ].filter((value, index, values) => values.indexOf(value) === index);
  return {
    version: 1,
    date: report.date,
    mode: report.mode,
    generatedAt: report.generatedAt,
    scoreVersion: report.scoreVersion,
    analysisVersion: report.analysisVersion,
    configHash: report.configHash,
    counts: report.counts,
    sourceHealth: report.sourceHealth,
    rawObjectRefs,
    repositories: report.repositories.map((item) => item.snapshot.fullName),
  };
}

export async function runDailyPipeline(
  options: PipelineOptions,
): Promise<DailyReport> {
  const config = await loadPicksConfig(options.configPath);
  const batch =
    options.mode === "replay"
      ? await replayBatch(options.replayManifestPath)
      : await liveBatch(options, config);
  const ruleRepositories = scoreSnapshots(
    batch.snapshots,
    config,
    batch.observedAt,
  );
  const analysisBatch = await generateAiRecommendations(
    ruleRepositories,
    options.recommendationGenerator ?? null,
    batch.observedAt,
    options.analysisRequired ?? false,
  );
  const repositories = analysisBatch.repositories;
  const report = DailyReportSchema.parse({
    date: options.date,
    mode: options.mode,
    timezone: config.timezone,
    generatedAt: batch.observedAt,
    scoreVersion: config.version,
    analysisVersion:
      options.recommendationGenerator?.analysisVersion ?? "v1.0.0",
    configHash: hashPicksConfig(config),
    sourceHealth: [...batch.sourceHealth, analysisBatch.health],
    counts: {
      discovered: batch.discoveredCount,
      enriched: repositories.length,
      published: repositories.filter(
        (item) => item.score.eligibility === "eligible",
      ).length,
    },
    repositories,
    rankings: buildRankings(repositories, config),
  });
  await mkdir(options.outputDirectory, { recursive: true });
  await atomicWrite(
    join(options.outputDirectory, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await atomicWrite(
    join(options.outputDirectory, "report.md"),
    renderDailyMarkdown(report),
  );
  await atomicWrite(
    join(options.outputDirectory, "manifest.json"),
    `${JSON.stringify(manifestFor(report), null, 2)}\n`,
  );
  return report;
}
