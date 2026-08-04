import {
  type Candidate,
  CandidateSchema,
  type CandidateSignal,
  type DirectionId,
  type PicksConfig,
  type SourceHealth,
} from "@github-picks/core";
import type { ConditionalArtifactCache } from "./conditional-cache.js";
import type { RawStore } from "./raw-store.js";

export interface DiscoveryContext {
  config: PicksConfig;
  observedAt: string;
  rawStore: RawStore;
  conditionalCache?: ConditionalArtifactCache | undefined;
  githubToken: string | null;
  fetchImpl?: typeof fetch | undefined;
}

export interface DiscoveryAdapter {
  readonly sourceId: string;
  discover(context: DiscoveryContext): Promise<CandidateSignal[]>;
}

export interface DiscoveryResult {
  candidates: Candidate[];
  sourceHealth: SourceHealth[];
}

function inferDirection(signal: CandidateSignal): DirectionId {
  if (signal.direction !== null) return signal.direction;
  const haystack = `${signal.fullName} ${signal.summaryZh ?? ""}`.toLowerCase();
  if (/agent|llm|codex|model|ai[- ]/.test(haystack)) return "ai-agent";
  if (/data|machine-learning|pytorch|tensor|database|ml/.test(haystack))
    return "data-ml";
  if (/security|vulnerab|supply-chain|scorecard|osv|scanner/.test(haystack)) {
    return "security-supply-chain";
  }
  if (/infra|cloud|kube|observ|devtool|cli|runtime|package/.test(haystack)) {
    return "infra-devtools";
  }
  return "app-platform";
}

function signalQuality(signal: CandidateSignal): number {
  const freshness = signal.stale ? 0 : 20;
  const rank = signal.rank === null ? 0 : Math.max(0, 30 - signal.rank);
  const velocity = Math.min(signal.metrics.starVelocity ?? 0, 1_000) / 50;
  const discussion = Math.min(signal.metrics.discussionPoints ?? 0, 100) / 5;
  return freshness + rank + velocity + discussion;
}

export function mergeCandidateSignals(
  signals: CandidateSignal[],
  config: PicksConfig,
): Candidate[] {
  const grouped = new Map<string, CandidateSignal[]>();
  for (const signal of signals) {
    const existing = grouped.get(signal.fullName) ?? [];
    existing.push(signal);
    grouped.set(signal.fullName, existing);
  }

  const orderedCandidates = [...grouped.entries()]
    .map(([fullName, repositorySignals]) => {
      const sortedSignals = [...repositorySignals].sort(
        (left, right) =>
          signalQuality(right) - signalQuality(left) ||
          left.sourceId.localeCompare(right.sourceId),
      );
      const directions = [...new Set(sortedSignals.map(inferDirection))];
      return CandidateSchema.parse({
        fullName,
        primaryDirection: directions[0] ?? "app-platform",
        directions,
        signals: sortedSignals,
      });
    })
    .sort((left, right) => {
      const leftGroups = new Set(
        left.signals
          .filter((signal) => !signal.stale)
          .map((signal) => signal.independenceGroup),
      );
      const rightGroups = new Set(
        right.signals
          .filter((signal) => !signal.stale)
          .map((signal) => signal.independenceGroup),
      );
      const coverageDifference = rightGroups.size - leftGroups.size;
      if (coverageDifference !== 0) return coverageDifference;
      const qualityDifference =
        right.signals.reduce((sum, signal) => sum + signalQuality(signal), 0) -
        left.signals.reduce((sum, signal) => sum + signalQuality(signal), 0);
      return qualityDifference || left.fullName.localeCompare(right.fullName);
    });
  const selected = new Map<string, Candidate>();
  for (const direction of config.directions) {
    const matches = orderedCandidates
      .filter((candidate) => candidate.primaryDirection === direction.id)
      .slice(0, config.limits.perDirectionMinimum);
    for (const candidate of matches) {
      if (selected.size >= config.limits.candidateLimit) break;
      selected.set(candidate.fullName, candidate);
    }
  }
  for (const candidate of orderedCandidates) {
    if (selected.size >= config.limits.candidateLimit) break;
    selected.set(candidate.fullName, candidate);
  }
  return [...selected.values()];
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";
  return error.name || "Error";
}

export async function discoverCandidates(
  adapters: DiscoveryAdapter[],
  context: DiscoveryContext,
): Promise<DiscoveryResult> {
  const settled = await Promise.allSettled(
    adapters.map((adapter) => adapter.discover(context)),
  );
  const signals: CandidateSignal[] = [];
  const sourceHealth: SourceHealth[] = [];

  for (const [index, result] of settled.entries()) {
    const adapter = adapters[index];
    if (adapter === undefined) continue;
    if (result.status === "fulfilled") {
      signals.push(...result.value);
      const onlyStaleSignals =
        result.value.length > 0 && result.value.every((signal) => signal.stale);
      sourceHealth.push({
        sourceId: adapter.sourceId,
        status:
          result.value.length === 0 || onlyStaleSignals
            ? "degraded"
            : "healthy",
        observedAt: context.observedAt,
        message:
          result.value.length === 0
            ? "未发现可解析仓库"
            : onlyStaleSignals
              ? "全部候选信号超过新鲜度阈值"
              : null,
      });
    } else {
      sourceHealth.push({
        sourceId: adapter.sourceId,
        status: "degraded",
        observedAt: context.observedAt,
        message: safeErrorMessage(result.reason),
      });
    }
  }

  if (sourceHealth.every((source) => source.status !== "healthy")) {
    throw new Error("all discovery sources failed");
  }
  return {
    candidates: mergeCandidateSignals(signals, context.config),
    sourceHealth,
  };
}
