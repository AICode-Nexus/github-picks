import { createHash } from "node:crypto";
import {
  type ChineseAnalysis,
  ChineseAnalysisSchema,
  type DimensionScores,
  type RepositoryScore,
  type RepositorySnapshot,
} from "./schema.js";

export interface AnalysisInput {
  snapshot: RepositorySnapshot;
  score: RepositoryScore;
  generatedAt?: string;
}

export const RULE_ANALYSIS_VERSION = "v1.0.0";
export const RULE_PROMPT_VERSION = "v1.0.0";

const dimensionNames: Record<keyof DimensionScores, string> = {
  utility: "实用价值",
  activity: "开发活跃",
  organization: "组织与维护者",
  engineering: "工程质量",
  adoption: "真实采用",
  security: "安全与合规",
  momentum: "趋势动量",
  innovation: "创新与时效",
};

const audiences: Record<RepositorySnapshot["direction"], string> = {
  "ai-agent": "适合关注 AI Coding、Agent 工程化和研发效率的开发者与技术负责人",
  "data-ml": "适合负责数据平台、机器学习工程和模型基础设施的团队",
  "app-platform": "适合进行前端、后端、API 或跨端技术选型的工程团队",
  "infra-devtools": "适合负责云原生、可观测性、DevOps 和开发者工具的团队",
  "security-supply-chain": "适合负责应用安全、开源治理和软件供应链的团队",
};

function topDimensions(
  score: RepositoryScore,
): Array<[keyof DimensionScores, number]> {
  return (
    Object.entries(score.dimensions) as Array<[keyof DimensionScores, number]>
  )
    .sort(
      ([leftName, left], [rightName, right]) =>
        right - left || leftName.localeCompare(rightName),
    )
    .slice(0, 2);
}

function riskText(input: AnalysisInput): string {
  const findings = input.score.riskFindings.map((finding) => finding.message);
  const missing = input.snapshot.missingFields;
  const parts = [
    findings.length === 0
      ? "尚未发现带数值扣分的明确风险"
      : findings.join("；"),
    missing.length === 0
      ? "关键证据字段齐全"
      : `证据缺口：${missing.join("、")}`,
  ];
  return `风险：${parts.join("；")}。高分不能抵消许可证、安全或维护风险。`;
}

function action(score: RepositoryScore): string {
  if (score.eligibility === "excluded" || score.eligibility === "quarantined") {
    return "下一步：暂缓采用，先核验排除或隔离原因并补齐权威证据。";
  }
  if (score.confidence >= 0.75 && score.riskPenalty < 5) {
    return "下一步：建议在隔离环境中试用，并用真实工作负载验证安装、性能和维护响应。";
  }
  if (score.confidence >= 0.65) {
    return "下一步：先与同赛道项目进行对比，再决定是否进入小范围试用。";
  }
  return "下一步：继续观察并补齐缺失证据，当前不形成生产采用结论。";
}

export function buildAnalysisFactPackage(input: AnalysisInput) {
  return {
    repository: {
      fullName: input.snapshot.fullName,
      url: input.snapshot.url,
      description: input.snapshot.description,
      homepage: input.snapshot.homepage,
      language: input.snapshot.language,
      topics: input.snapshot.topics,
      direction: input.snapshot.direction,
      createdAt: input.snapshot.createdAt,
      pushedAt: input.snapshot.pushedAt,
      stars: input.snapshot.stars,
      forks: input.snapshot.forks,
      watchers: input.snapshot.watchers,
      openIssues: input.snapshot.openIssues,
      licenseSpdx: input.snapshot.licenseSpdx,
      humanReadableCounts: {
        starsThousandsFloor: Math.floor(input.snapshot.stars / 1000),
        starsThousandsRounded: Math.round(input.snapshot.stars / 1000),
        starsThousandsOneDecimal:
          Math.round((input.snapshot.stars / 1000) * 10) / 10,
        starsTenThousandsRounded:
          Math.round((input.snapshot.stars / 10_000) * 10) / 10,
        forksThousandsFloor: Math.floor(input.snapshot.forks / 1000),
        forksThousandsRounded: Math.round(input.snapshot.forks / 1000),
        forksThousandsOneDecimal:
          Math.round((input.snapshot.forks / 1000) * 10) / 10,
        forksTenThousandsRounded:
          Math.round((input.snapshot.forks / 10_000) * 10) / 10,
      },
    },
    activity: input.snapshot.eventFeatures,
    scorecard:
      input.snapshot.scorecard === null
        ? null
        : {
            score: input.snapshot.scorecard.score,
            date: input.snapshot.scorecard.date,
            checks: input.snapshot.scorecard.checks,
          },
    score: {
      publishedScore: input.score.publishedScore,
      confidence: input.score.confidence,
      confidencePercent: Math.round(input.score.confidence * 100),
      dimensions: input.score.dimensions,
      riskPenalty: input.score.riskPenalty,
      eligibility: input.score.eligibility,
    },
    risks: input.score.riskFindings.map((finding) => ({
      code: finding.code,
      level: finding.level,
      penalty: finding.penalty,
      message: finding.message,
    })),
    missingFields: input.snapshot.missingFields,
    discoverySignals: input.snapshot.candidateSignals.map((signal) => ({
      sourceId: signal.sourceId,
      sourceTier: signal.sourceTier,
      observedAt: signal.observedAt,
      stale: signal.stale,
      rank: signal.rank,
      summaryZh: signal.summaryZh,
      metrics: signal.metrics,
      evidenceUrl: signal.evidenceUrl,
    })),
    evidenceUrls: [
      ...input.snapshot.evidence.map((evidence) => evidence.evidenceUrl),
      ...input.snapshot.candidateSignals.map((signal) => signal.evidenceUrl),
    ].filter((url, index, values) => values.indexOf(url) === index),
  };
}

export function analysisEvidenceHash(input: AnalysisInput): string {
  return createHash("sha256")
    .update(JSON.stringify(buildAnalysisFactPackage(input)))
    .digest("hex");
}

export function analyzeRepository(input: AnalysisInput): ChineseAnalysis {
  const drivers = topDimensions(input.score)
    .map(([name, value]) => `${dimensionNames[name]} ${value.toFixed(1)} 分`)
    .join("、");
  const evidenceUrls = [
    ...input.snapshot.evidence.map((evidence) => evidence.evidenceUrl),
    ...input.snapshot.candidateSignals.map((signal) => signal.evidenceUrl),
  ].filter((url, index, values) => values.indexOf(url) === index);

  const why = `${input.snapshot.fullName} 值得关注：当前主要驱动来自${drivers}；发布分 ${input.score.publishedScore.toFixed(1)}，置信度 ${(input.score.confidence * 100).toFixed(0)}%。`;
  const generatedAt =
    input.generatedAt ??
    input.snapshot.evidence[0]?.observedAt ??
    input.snapshot.updatedAt;

  return ChineseAnalysisSchema.parse({
    recommendationReason: why,
    why,
    suitableFor: `${audiences[input.snapshot.direction]}；仍需结合项目类型和自身约束判断。`,
    risks: riskText(input),
    nextStep: action(input.score),
    evidenceUrls,
    generation: {
      kind: "rules",
      status: "fallback",
      provider: "github-picks-rules",
      model: null,
      promptVersion: RULE_PROMPT_VERSION,
      analysisVersion: RULE_ANALYSIS_VERSION,
      evidenceHash: analysisEvidenceHash(input),
      generatedAt,
    },
  });
}
