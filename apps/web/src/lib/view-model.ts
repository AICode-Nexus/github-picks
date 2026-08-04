import type {
  DailyReport,
  DirectionId,
  ScoredRepository,
} from "@github-picks/core";
import {
  DIMENSION_IDS,
  DIMENSION_META,
  DIRECTION_META,
  type DimensionId,
  getSourceName,
} from "./site-meta.js";

export type ConfidenceLabel = "高" | "中" | "低";
export type SourceStatus = "healthy" | "degraded" | "offline";

export interface RepositoryCardModel {
  id: string;
  owner: string;
  name: string;
  rank: number;
  description: string;
  language: string;
  stars: number;
  score: number;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  riskPenalty: number;
  strongestDimension: {
    id: DimensionId;
    label: string;
    value: number;
  };
  directionId: DirectionId;
  directionName: string;
  why: string;
  href: string;
  githubUrl: string;
}

export interface DimensionModel {
  id: DimensionId;
  label: string;
  weight: number;
  value: number;
}

export interface EvidenceLinkModel {
  sourceId: string;
  sourceName: string;
  field: string;
  url: string;
  observedAt: string | null;
}

export interface DiscoverySignalModel {
  sourceId: string;
  sourceName: string;
  sourceTier: "S" | "A" | "B" | "C";
  rank: number | null;
  observedAt: string;
  evidenceUrl: string;
  summary: string | null;
}

export interface RepositoryDetailModel extends RepositoryCardModel {
  homepage: string | null;
  license: {
    status: "declared" | "missing";
    label: string;
    spdx: string | null;
  };
  forks: number;
  watchers: number;
  openIssues: number;
  pushedAt: string;
  baseScore: number;
  eligibility: "eligible" | "watch" | "quarantined" | "excluded";
  dimensions: DimensionModel[];
  analysis: {
    why: string;
    suitableFor: string;
    risks: string;
    nextStep: string;
  };
  activity: {
    activeDays7d: number;
    activeDays30d: number;
    humanActors30d: number;
    pushes30d: number;
    pullRequests30d: number;
    issues30d: number;
    releases30d: number;
  };
  riskFindings: Array<{
    code: string;
    level: "low" | "medium" | "high" | "critical";
    levelLabel: string;
    penalty: number;
    message: string;
  }>;
  evidenceGaps: string[];
  scorecard: {
    status: "available" | "missing";
    label: string;
    score: number | null;
    observedAt: string | null;
  };
  signals: DiscoverySignalModel[];
  evidence: EvidenceLinkModel[];
}

export interface DirectionSummaryModel {
  id: DirectionId;
  name: string;
  shortName: string;
  description: string;
  count: number;
  maximumScore: number | null;
  medianConfidence: number | null;
  items: RepositoryCardModel[];
}

export interface SourceSummaryItemModel {
  id: string;
  name: string;
  status: SourceStatus;
  statusLabel: "正常" | "降级" | "离线";
  observedAt: string;
  message: string;
}

export interface SourceSummaryModel {
  counts: Record<SourceStatus, number>;
  hasProblems: boolean;
  items: SourceSummaryItemModel[];
}

export type RepositoryIndex = ReadonlyMap<string, ScoredRepository>;

export function confidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.85) return "高";
  if (confidence >= 0.7) return "中";
  return "低";
}

export function buildRepositoryIndex(report: DailyReport): RepositoryIndex {
  const index = new Map<string, ScoredRepository>();
  for (const repository of report.repositories) {
    const key = repository.snapshot.fullName.toLowerCase();
    if (index.has(key)) {
      throw new Error(`duplicate repository identifier: ${key}`);
    }
    index.set(key, repository);
  }
  return index;
}

function findRepository(
  index: RepositoryIndex,
  repositoryId: string,
): ScoredRepository {
  const repository = index.get(repositoryId.toLowerCase());
  if (repository === undefined) {
    throw new Error(`ranking references missing repository: ${repositoryId}`);
  }
  return repository;
}

function strongestDimension(
  repository: ScoredRepository,
): RepositoryCardModel["strongestDimension"] {
  const id = DIMENSION_IDS.reduce((strongest, current) =>
    repository.score.dimensions[current] >
    repository.score.dimensions[strongest]
      ? current
      : strongest,
  );

  return {
    id,
    label: DIMENSION_META[id].label,
    value: repository.score.dimensions[id],
  };
}

function toRepositoryCard(
  repository: ScoredRepository,
  rank: number,
): RepositoryCardModel {
  const [owner, name] = repository.snapshot.fullName.split("/");
  if (owner === undefined || name === undefined) {
    throw new Error(
      `invalid repository identifier: ${repository.snapshot.fullName}`,
    );
  }

  const directionId = repository.snapshot.direction;
  return {
    id: repository.snapshot.fullName,
    owner,
    name,
    rank,
    description: repository.snapshot.description ?? "暂无项目描述",
    language: repository.snapshot.language ?? "未标注",
    stars: repository.snapshot.stars,
    score: repository.score.publishedScore,
    confidence: repository.score.confidence,
    confidenceLabel: confidenceLabel(repository.score.confidence),
    riskPenalty: repository.score.riskPenalty,
    strongestDimension: strongestDimension(repository),
    directionId,
    directionName: DIRECTION_META[directionId].name,
    why: repository.analysis.why,
    href: `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/`,
    githubUrl: repository.snapshot.url,
  };
}

export function buildRepositoryCard(
  report: DailyReport,
  repositoryId: string,
  rank: number,
): RepositoryCardModel {
  return toRepositoryCard(
    findRepository(buildRepositoryIndex(report), repositoryId),
    rank,
  );
}

export function buildRankingItems(
  report: DailyReport,
  repositoryIds: readonly string[],
): RepositoryCardModel[] {
  const index = buildRepositoryIndex(report);
  return repositoryIds.map((repositoryId, indexInRanking) =>
    toRepositoryCard(findRepository(index, repositoryId), indexInRanking + 1),
  );
}

function riskLevelLabel(level: "low" | "medium" | "high" | "critical"): string {
  if (level === "low") return "低";
  if (level === "medium") return "中";
  if (level === "high") return "高";
  return "严重";
}

function buildEvidenceLinks(repository: ScoredRepository): EvidenceLinkModel[] {
  const links = new Map<string, EvidenceLinkModel>();

  for (const evidence of repository.snapshot.evidence) {
    links.set(evidence.evidenceUrl, {
      sourceId: evidence.sourceId,
      sourceName: getSourceName(evidence.sourceId),
      field: evidence.field,
      url: evidence.evidenceUrl,
      observedAt: evidence.observedAt,
    });
  }

  for (const signal of repository.snapshot.candidateSignals) {
    if (!links.has(signal.evidenceUrl)) {
      links.set(signal.evidenceUrl, {
        sourceId: signal.sourceId,
        sourceName: getSourceName(signal.sourceId),
        field: "discovery-signal",
        url: signal.evidenceUrl,
        observedAt: signal.observedAt,
      });
    }
  }

  for (const url of repository.analysis.evidenceUrls) {
    if (!links.has(url)) {
      links.set(url, {
        sourceId: "analysis",
        sourceName: "分析引用",
        field: "analysis",
        url,
        observedAt: null,
      });
    }
  }

  return [...links.values()];
}

export function buildRepositoryDetail(
  report: DailyReport,
  repositoryId: string,
): RepositoryDetailModel {
  const repository = findRepository(buildRepositoryIndex(report), repositoryId);
  const rank =
    report.rankings.overall.findIndex(
      (item) => item.toLowerCase() === repositoryId.toLowerCase(),
    ) + 1;
  const card = toRepositoryCard(repository, Math.max(rank, 0));
  const evidenceGaps = new Set<string>();

  if (repository.snapshot.licenseSpdx === null) {
    evidenceGaps.add("许可证信息缺失");
  }
  if (repository.snapshot.scorecard === null) {
    evidenceGaps.add("安全工程证据缺口");
  }
  for (const field of repository.snapshot.missingFields) {
    if (field === "scorecard") {
      evidenceGaps.add("安全工程证据缺口");
    } else {
      evidenceGaps.add(`字段缺失：${field}`);
    }
  }

  return {
    ...card,
    homepage: repository.snapshot.homepage || null,
    license: repository.snapshot.licenseSpdx
      ? {
          status: "declared",
          label: repository.snapshot.licenseSpdx,
          spdx: repository.snapshot.licenseSpdx,
        }
      : {
          status: "missing",
          label: "未识别 · 生产采用前需核验",
          spdx: null,
        },
    forks: repository.snapshot.forks,
    watchers: repository.snapshot.watchers,
    openIssues: repository.snapshot.openIssues,
    pushedAt: repository.snapshot.pushedAt,
    baseScore: repository.score.baseScore,
    eligibility: repository.score.eligibility,
    dimensions: DIMENSION_IDS.map((id) => ({
      id,
      label: DIMENSION_META[id].label,
      weight: DIMENSION_META[id].weight,
      value: repository.score.dimensions[id],
    })),
    analysis: { ...repository.analysis },
    activity: { ...repository.snapshot.eventFeatures },
    riskFindings: repository.score.riskFindings.map((finding) => ({
      code: finding.code,
      level: finding.level,
      levelLabel: riskLevelLabel(finding.level),
      penalty: finding.penalty,
      message: finding.message,
    })),
    evidenceGaps: [...evidenceGaps],
    scorecard: repository.snapshot.scorecard
      ? {
          status: "available",
          label: `${repository.snapshot.scorecard.score.toFixed(1)} / 10`,
          score: repository.snapshot.scorecard.score,
          observedAt: repository.snapshot.scorecard.date,
        }
      : {
          status: "missing",
          label: "安全工程证据缺口",
          score: null,
          observedAt: null,
        },
    signals: repository.snapshot.candidateSignals.map((signal) => ({
      sourceId: signal.sourceId,
      sourceName: getSourceName(signal.sourceId),
      sourceTier: signal.sourceTier,
      rank: signal.rank,
      observedAt: signal.observedAt,
      evidenceUrl: signal.evidenceUrl,
      summary: signal.summaryZh,
    })),
    evidence: buildEvidenceLinks(repository),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const right = sorted[middle];
  if (right === undefined) return null;
  if (sorted.length % 2 === 1) return right;
  const left = sorted[middle - 1];
  return left === undefined ? right : (left + right) / 2;
}

export function buildDirectionSummary(
  report: DailyReport,
  directionId: DirectionId,
): DirectionSummaryModel {
  const meta = DIRECTION_META[directionId];
  const items = buildRankingItems(
    report,
    report.rankings.byDirection[directionId],
  );

  return {
    id: directionId,
    ...meta,
    count: items.length,
    maximumScore:
      items.length === 0 ? null : Math.max(...items.map((item) => item.score)),
    medianConfidence: median(items.map((item) => item.confidence)),
    items,
  };
}

const SOURCE_STATUS_LABELS: Record<
  SourceStatus,
  SourceSummaryItemModel["statusLabel"]
> = {
  healthy: "正常",
  degraded: "降级",
  offline: "离线",
};

function defaultSourceMessage(status: SourceStatus): string {
  if (status === "healthy") return "采集正常";
  if (status === "degraded") return "本次采集降级";
  return "本次采集离线";
}

export function buildSourceSummary(report: DailyReport): SourceSummaryModel {
  const counts: Record<SourceStatus, number> = {
    healthy: 0,
    degraded: 0,
    offline: 0,
  };
  const items = report.sourceHealth.map((source) => {
    counts[source.status] += 1;
    return {
      id: source.sourceId,
      name: getSourceName(source.sourceId),
      status: source.status,
      statusLabel: SOURCE_STATUS_LABELS[source.status],
      observedAt: source.observedAt,
      message: source.message ?? defaultSourceMessage(source.status),
    };
  });

  return {
    counts,
    hasProblems: counts.degraded + counts.offline > 0,
    items,
  };
}
