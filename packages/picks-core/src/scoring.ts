import {
  clamp,
  daysBetween,
  linearScore,
  logarithmicScore,
  round,
  weightedMean,
} from "./math.js";
import {
  type DimensionScores,
  type PicksConfig,
  type RepositoryScore,
  RepositoryScoreSchema,
  type RepositorySnapshot,
} from "./schema.js";
import type { FeatureScore, RiskFinding } from "./scoring-types.js";

type FeatureStatus = FeatureScore["status"];

function feature(
  score: number,
  status: FeatureStatus,
  note: string,
  evidenceIds: string[],
): FeatureScore {
  return { score: round(clamp(score)), status, note, evidenceIds };
}

function referenceTime(snapshot: RepositorySnapshot): string {
  const observations = [
    ...snapshot.evidence.map((item) => item.observedAt),
    ...snapshot.candidateSignals.map((item) => item.observedAt),
  ];
  return observations.sort().at(-1) ?? snapshot.updatedAt;
}

function recencyScore(timestamp: string, reference: string): number {
  const age = daysBetween(timestamp, reference);
  if (age <= 7) return 100;
  if (age <= 30) return 80;
  if (age <= 90) return 55;
  if (age <= 180) return 25;
  return 0;
}

function evidenceIds(
  snapshot: RepositorySnapshot,
  sourceId?: string,
): string[] {
  return snapshot.evidence
    .filter((item) => sourceId === undefined || item.sourceId === sourceId)
    .map((item) => item.id);
}

function signalIds(snapshot: RepositorySnapshot, sourceId?: string): string[] {
  return snapshot.candidateSignals
    .filter((item) => sourceId === undefined || item.sourceId === sourceId)
    .map((item) => `signal:${item.sourceId}:${item.fullName}`);
}

function scorecardCheck(
  snapshot: RepositorySnapshot,
  name: string,
): number | null {
  const check = snapshot.scorecard?.checks.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
  return check === undefined || check.score < 0 ? null : check.score * 10;
}

function dimension(
  features: Record<string, FeatureScore>,
  entries: Array<[string, number]>,
): number {
  return round(
    weightedMean(
      entries.map(([name, weight]) => {
        const value = features[name];
        if (value === undefined) throw new Error(`missing feature: ${name}`);
        return { score: value.score, weight };
      }),
    ),
  );
}

function calculateFeatures(
  snapshot: RepositorySnapshot,
): Record<string, FeatureScore> {
  const reference = referenceTime(snapshot);
  const githubEvidence = evidenceIds(snapshot, "github-rest");
  const scorecardEvidence = evidenceIds(snapshot, "openssf-scorecard");
  const allSignalIds = signalIds(snapshot);
  const freshSignals = snapshot.candidateSignals.filter(
    (signal) => !signal.stale,
  );
  const independentGroups = new Set([
    ...snapshot.evidence.map((item) => item.independenceGroup),
    ...freshSignals.map((item) => item.independenceGroup),
  ]);
  const eventDiversity = [
    snapshot.eventFeatures.pushes30d,
    snapshot.eventFeatures.pullRequests30d,
    snapshot.eventFeatures.issues30d,
    snapshot.eventFeatures.releases30d,
  ].filter((count) => count > 0).length;
  const hasDiscussion = freshSignals.some(
    (signal) => signal.metrics.discussionPoints !== null,
  );
  const hasStarVelocity = freshSignals.some(
    (signal) => signal.metrics.starVelocity !== null,
  );
  const hasSourceRank = freshSignals.some((signal) => signal.rank !== null);
  const discussionPoints = Math.max(
    0,
    ...freshSignals.map((signal) => signal.metrics.discussionPoints ?? 0),
  );
  const starVelocity = Math.max(
    0,
    ...freshSignals.map((signal) => signal.metrics.starVelocity ?? 0),
  );
  const bestRank = Math.min(
    50,
    ...freshSignals.map((signal) => signal.rank ?? 50),
  );
  const repositoryAge = daysBetween(snapshot.createdAt, reference);
  const scorecardValue = snapshot.scorecard?.score;
  const maintainedCheck = scorecardCheck(snapshot, "Maintained");
  const securityPolicyCheck = scorecardCheck(snapshot, "Security-Policy");

  const features: Record<string, FeatureScore> = {};
  features["utility.description"] = feature(
    snapshot.description === null
      ? 50
      : snapshot.description.length >= 40
        ? 90
        : 65,
    snapshot.description === null ? "prior" : "observed",
    snapshot.description === null
      ? "缺少可核验的问题描述，采用先验"
      : "仓库描述提供了可核验的问题边界",
    githubEvidence,
  );
  features["utility.homepage"] = feature(
    snapshot.homepage === null ? 50 : 85,
    snapshot.homepage === null ? "prior" : "observed",
    snapshot.homepage === null
      ? "未提供独立文档入口，采用先验"
      : "存在独立文档或产品入口",
    githubEvidence,
  );
  features["utility.topics"] = feature(
    linearScore(snapshot.topics.length, 5),
    "observed",
    "主题标签用于确认使用场景覆盖",
    githubEvidence,
  );
  features["utility.delivery"] = feature(
    snapshot.eventFeatures.releases30d >= 2
      ? 100
      : snapshot.eventFeatures.releases30d === 1
        ? 75
        : 50,
    "observed",
    "近期 Release 作为功能交付的有限代理信号",
    githubEvidence,
  );
  features["utility.discovery"] = feature(
    linearScore(independentGroups.size, 3),
    "observed",
    "独立信源覆盖用于交叉验证真实使用场景",
    allSignalIds,
  );

  features["activity.activeDays"] = feature(
    linearScore(snapshot.eventFeatures.activeDays30d, 15),
    "observed",
    "三十天内的人类活跃日",
    githubEvidence,
  );
  features["activity.humanActors"] = feature(
    linearScore(snapshot.eventFeatures.humanActors30d, 10),
    "observed",
    "三十天内去除机器人后的独立参与者",
    githubEvidence,
  );
  features["activity.eventDiversity"] = feature(
    linearScore(eventDiversity, 4),
    "observed",
    "Push、PR、Issue 与 Release 的活动多样性",
    githubEvidence,
  );
  features["activity.pushRecency"] = feature(
    recencyScore(snapshot.pushedAt, reference),
    "observed",
    "最近推送时间反映维护是否仍在继续",
    githubEvidence,
  );
  features["activity.releaseCadence"] = feature(
    linearScore(snapshot.eventFeatures.releases30d, 2),
    "observed",
    "三十天发布节奏按项目当前事件窗口计算",
    githubEvidence,
  );

  features["organization.identity"] = feature(
    snapshot.ownerType === "Organization" ? 60 : 50,
    "observed",
    snapshot.ownerType === "Organization"
      ? "组织身份仅提供有限先验加分"
      : "个人维护者使用中性先验",
    githubEvidence,
  );
  features["organization.continuity"] = feature(
    weightedMean([
      { score: recencyScore(snapshot.pushedAt, reference), weight: 0.65 },
      { score: linearScore(repositoryAge, 365), weight: 0.35 },
    ]),
    "observed",
    "项目年龄与近期维护共同表示持续维护能力",
    githubEvidence,
  );
  features["organization.maintainers"] = feature(
    linearScore(snapshot.eventFeatures.humanActors30d, 8),
    "observed",
    "多个人类参与者可降低单一维护者先验风险",
    githubEvidence,
  );
  features["organization.activity"] = feature(
    linearScore(snapshot.eventFeatures.activeDays30d, 12),
    "observed",
    "持续活跃日只表示当前维护连续性，不代表品牌声誉",
    githubEvidence,
  );
  features["organization.governance"] = feature(
    maintainedCheck ?? 50,
    maintainedCheck === null ? "prior" : "observed",
    maintainedCheck === null
      ? "缺少 OpenSSF 维护证据，采用先验"
      : "OpenSSF Maintained 检查作为治理证据",
    scorecardEvidence,
  );

  features["engineering.license"] = feature(
    snapshot.licenseSpdx === null ? 0 : 100,
    snapshot.licenseSpdx === null ? "negative" : "observed",
    snapshot.licenseSpdx === null
      ? "GitHub 未返回明确 SPDX 许可证"
      : "存在明确 SPDX 许可证",
    githubEvidence,
  );
  features["engineering.scorecard"] = feature(
    scorecardValue === undefined ? 50 : scorecardValue * 10,
    scorecardValue === undefined ? "prior" : "observed",
    scorecardValue === undefined
      ? "OpenSSF 数据缺失，采用先验"
      : "OpenSSF 综合工程实践分",
    scorecardEvidence,
  );
  features["engineering.review"] = feature(
    linearScore(snapshot.eventFeatures.pullRequests30d, 12),
    "observed",
    "PR 事件数量是评审活动的有限代理信号",
    githubEvidence,
  );
  features["engineering.release"] = feature(
    linearScore(snapshot.eventFeatures.releases30d, 2),
    "observed",
    "近期 Release 反映发布纪律但不替代完整版本审计",
    githubEvidence,
  );
  features["engineering.workflow"] = feature(
    linearScore(eventDiversity, 4),
    "observed",
    "事件类型多样性反映基本协作流程",
    githubEvidence,
  );

  features["adoption.starStock"] = feature(
    logarithmicScore(snapshot.stars, 100_000),
    "observed",
    "Star 存量仅占 Adoption 的 15%",
    githubEvidence,
  );
  features["adoption.forks"] = feature(
    logarithmicScore(snapshot.forks, 10_000),
    "observed",
    "Fork 存量作为采用代理，未假设每个 Fork 都活跃",
    githubEvidence,
  );
  features["adoption.watchers"] = feature(
    logarithmicScore(snapshot.watchers, 1_000),
    "observed",
    "订阅者数量作为持续关注的弱信号",
    githubEvidence,
  );
  features["adoption.contributors"] = feature(
    linearScore(snapshot.eventFeatures.humanActors30d, 12),
    "observed",
    "近期人类参与者广度作为真实采用信号",
    githubEvidence,
  );
  features["adoption.discussion"] = feature(
    hasDiscussion ? logarithmicScore(discussionPoints, 100) : 50,
    hasDiscussion ? "observed" : "prior",
    hasDiscussion ? "存在独立 Hacker News 讨论" : "缺少独立社区讨论，采用先验",
    signalIds(snapshot, "hacker-news"),
  );
  features["adoption.coverage"] = feature(
    linearScore(independentGroups.size, 4),
    "observed",
    "采用判断由独立信源组覆盖度约束",
    allSignalIds,
  );

  features["momentum.starVelocity"] = feature(
    hasStarVelocity ? logarithmicScore(starVelocity, 1_000) : 50,
    hasStarVelocity ? "observed" : "prior",
    hasStarVelocity
      ? "Star 速度只占 Momentum 的 30%"
      : "缺少 Star 速度窗口，采用先验",
    signalIds(snapshot, "gittrend"),
  );
  features["momentum.sourceRank"] = feature(
    hasSourceRank ? clamp(104 - bestRank * 4) : 50,
    hasSourceRank ? "observed" : "prior",
    hasSourceRank ? "多个发现源中的近期名次" : "缺少可用发现名次，采用先验",
    allSignalIds,
  );
  features["momentum.discussion"] = feature(
    hasDiscussion ? logarithmicScore(discussionPoints, 100) : 50,
    hasDiscussion ? "observed" : "prior",
    hasDiscussion
      ? "非 GitHub 社区讨论提供独立趋势验证"
      : "缺少独立社区讨论，采用先验",
    signalIds(snapshot, "hacker-news"),
  );
  features["momentum.crossSource"] = feature(
    linearScore(independentGroups.size, 3),
    "observed",
    "趋势必须由多个独立信源组支持",
    allSignalIds,
  );

  features["security.license"] = feature(
    snapshot.licenseSpdx === null ? 0 : 100,
    snapshot.licenseSpdx === null ? "negative" : "observed",
    snapshot.licenseSpdx === null
      ? "许可证缺失是明确合规风险"
      : "许可证标识明确",
    githubEvidence,
  );
  features["security.scorecard"] = feature(
    scorecardValue === undefined ? 50 : scorecardValue * 10,
    scorecardValue === undefined ? "prior" : "observed",
    scorecardValue === undefined
      ? "Scorecard 缺失只降低置信度"
      : "OpenSSF 安全工程实践证据",
    scorecardEvidence,
  );
  features["security.lifecycle"] = feature(
    snapshot.archived ? 0 : 100,
    snapshot.archived ? "negative" : "observed",
    snapshot.archived ? "仓库已明确归档" : "仓库未归档",
    githubEvidence,
  );
  features["security.policy"] = feature(
    securityPolicyCheck ?? 50,
    securityPolicyCheck === null ? "prior" : "observed",
    securityPolicyCheck === null
      ? "缺少安全策略检查，采用先验"
      : "OpenSSF Security-Policy 检查",
    scorecardEvidence,
  );

  const projectNewness =
    repositoryAge <= 90
      ? 95
      : repositoryAge <= 365
        ? 80
        : repositoryAge <= 1_095
          ? 60
          : 50;
  features["innovation.projectAge"] = feature(
    projectNewness,
    "observed",
    "项目年龄仅表示时效机会，不直接证明创新",
    githubEvidence,
  );
  features["innovation.delivery"] = feature(
    snapshot.eventFeatures.releases30d > 0 ? 80 : 50,
    snapshot.eventFeatures.releases30d > 0 ? "observed" : "prior",
    "近期功能交付支持创新已进入工程阶段",
    githubEvidence,
  );
  features["innovation.ecosystem"] = feature(
    linearScore(snapshot.topics.length, 5),
    "observed",
    "主题覆盖只表示潜在生态扩展性",
    githubEvidence,
  );
  features["innovation.unverifiedNovelty"] = feature(
    50,
    "prior",
    "尚无可复现实验或独立差异证据，保持中性先验",
    [],
  );

  return features;
}

function confidence(snapshot: RepositorySnapshot): {
  value: number;
  components: RepositoryScore["confidenceComponents"];
} {
  const freshSignals = snapshot.candidateSignals.filter(
    (signal) => !signal.stale,
  );
  const groups = new Set([
    ...snapshot.evidence.map((item) => item.independenceGroup),
    ...freshSignals.map((item) => item.independenceGroup),
  ]);
  const keyValues = [
    snapshot.description,
    snapshot.homepage,
    snapshot.language,
    snapshot.licenseSpdx,
    snapshot.scorecard,
    snapshot.missingFields.includes("events") ? null : snapshot.eventFeatures,
  ];
  const components: RepositoryScore["confidenceComponents"] = {
    keyCompleteness:
      keyValues.filter((value) => value !== null).length / keyValues.length,
    independentSources: clamp(groups.size / 4, 0, 1),
    sourceConsistency: snapshot.candidateSignals.every(
      (signal) => signal.fullName === snapshot.fullName,
    )
      ? 1
      : 0.5,
    freshness:
      snapshot.candidateSignals.length === 0
        ? 0.5
        : freshSignals.length / snapshot.candidateSignals.length,
    observationWindow: snapshot.missingFields.includes("events") ? 0.35 : 1,
    entityMapping: snapshot.nodeId.length > 0 ? 1 : 0,
    collectionHealth: clamp(1 - snapshot.missingFields.length / 5, 0, 1),
  };
  const value = weightedMean([
    { score: components.keyCompleteness, weight: 0.2 },
    { score: components.independentSources, weight: 0.2 },
    { score: components.sourceConsistency, weight: 0.15 },
    { score: components.freshness, weight: 0.15 },
    { score: components.observationWindow, weight: 0.15 },
    { score: components.entityMapping, weight: 0.1 },
    { score: components.collectionHealth, weight: 0.05 },
  ]);
  return { value: round(value, 3), components };
}

function risks(snapshot: RepositorySnapshot): RiskFinding[] {
  const githubIds = evidenceIds(snapshot, "github-rest");
  const findings: RiskFinding[] = [];
  if (snapshot.licenseSpdx === null) {
    findings.push({
      code: "license-missing",
      level: "medium",
      penalty: 6,
      message: "GitHub 未返回明确许可证，不进入生产采用候选。",
      evidenceIds: githubIds,
    });
  }
  if (daysBetween(snapshot.pushedAt, referenceTime(snapshot)) > 180) {
    findings.push({
      code: "maintenance-stale",
      level: "medium",
      penalty: 5,
      message: "最近推送已超过 180 天，需要核验维护状态。",
      evidenceIds: githubIds,
    });
  }
  if (snapshot.archived) {
    findings.push({
      code: "archived",
      level: "high",
      penalty: 0,
      message: "仓库已明确归档，只保留历史档案。",
      evidenceIds: githubIds,
    });
  }
  return findings;
}

export function sumDimensionWeights(config: PicksConfig): number {
  return Object.values(config.weights).reduce((sum, value) => sum + value, 0);
}

export function scoreContribution(
  featureName: "adoption.starStock" | "momentum.starVelocity",
  featureScore: number,
  config: PicksConfig,
): number {
  if (featureName === "adoption.starStock") {
    return (
      config.weights.adoption *
      config.features.adoption.starStockWeight *
      (clamp(featureScore) / 100)
    );
  }
  return (
    config.weights.momentum *
    config.features.momentum.starVelocityWeight *
    (clamp(featureScore) / 100)
  );
}

export function scoreRepository(
  snapshot: RepositorySnapshot,
  config: PicksConfig,
): RepositoryScore {
  if (sumDimensionWeights(config) !== 100)
    throw new Error("dimension weights must total 100");
  const features = calculateFeatures(snapshot);
  const dimensions: DimensionScores = {
    utility: dimension(features, [
      ["utility.description", 20],
      ["utility.homepage", 10],
      ["utility.topics", 15],
      ["utility.delivery", 20],
      ["utility.discovery", 35],
    ]),
    activity: dimension(features, [
      ["activity.activeDays", 30],
      ["activity.humanActors", 25],
      ["activity.eventDiversity", 20],
      ["activity.pushRecency", 15],
      ["activity.releaseCadence", 10],
    ]),
    organization: dimension(features, [
      ["organization.identity", 15],
      ["organization.continuity", 30],
      ["organization.maintainers", 25],
      ["organization.activity", 20],
      ["organization.governance", 10],
    ]),
    engineering: dimension(features, [
      ["engineering.license", 15],
      ["engineering.scorecard", 35],
      ["engineering.review", 20],
      ["engineering.release", 15],
      ["engineering.workflow", 15],
    ]),
    adoption: dimension(features, [
      ["adoption.starStock", 15],
      ["adoption.forks", 20],
      ["adoption.watchers", 10],
      ["adoption.contributors", 20],
      ["adoption.discussion", 15],
      ["adoption.coverage", 20],
    ]),
    security: dimension(features, [
      ["security.license", 15],
      ["security.scorecard", 60],
      ["security.lifecycle", 15],
      ["security.policy", 10],
    ]),
    momentum: dimension(features, [
      ["momentum.starVelocity", 30],
      ["momentum.sourceRank", 25],
      ["momentum.discussion", 25],
      ["momentum.crossSource", 20],
    ]),
    innovation: dimension(features, [
      ["innovation.projectAge", 30],
      ["innovation.delivery", 20],
      ["innovation.ecosystem", 20],
      ["innovation.unverifiedNovelty", 30],
    ]),
  };
  const baseScore = weightedMean(
    Object.entries(config.weights).map(([name, weight]) => ({
      score: dimensions[name as keyof DimensionScores],
      weight,
    })),
  );
  const confidenceResult = confidence(snapshot);
  const riskFindings = risks(snapshot);
  const riskPenalty = clamp(
    riskFindings.reduce((sum, finding) => sum + finding.penalty, 0),
    0,
    30,
  );
  const publishedScore = clamp(
    50 + confidenceResult.value * (baseScore - 50) - riskPenalty,
  );
  const eligibility = snapshot.archived
    ? "excluded"
    : riskPenalty >= 20
      ? "quarantined"
      : confidenceResult.value >= config.ranking.ordinaryMinimumConfidence
        ? "eligible"
        : "watch";

  return RepositoryScoreSchema.parse({
    version: config.version,
    dimensions,
    features,
    confidence: confidenceResult.value,
    confidenceComponents: confidenceResult.components,
    riskPenalty,
    riskFindings,
    baseScore: round(baseScore),
    publishedScore: round(publishedScore),
    eligibility,
  });
}
