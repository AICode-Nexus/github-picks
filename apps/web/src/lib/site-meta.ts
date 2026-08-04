import type { DimensionScores, DirectionId } from "@github-picks/core/schema";

export type DimensionId = keyof DimensionScores;

export interface DirectionMeta {
  name: string;
  shortName: string;
  description: string;
}

export interface DimensionMeta {
  label: string;
  weight: number;
}

export const RANKING_PERIOD_IDS = ["7d", "30d", "90d", "180d"] as const;

export type RankingPeriodId = (typeof RANKING_PERIOD_IDS)[number];

export interface RankingPeriodMeta {
  days: 7 | 30 | 90 | 180;
  label: string;
  shortLabel: string;
  description: string;
}

export const RANKING_PERIOD_META = {
  "7d": {
    days: 7,
    label: "近 7 天",
    shortLabel: "7天",
    description: "观察一周内持续进入每日综合榜的项目，降低单日偶发热度的影响。",
  },
  "30d": {
    days: 30,
    label: "近 30 天",
    shortLabel: "30天",
    description: "观察一个月内的稳定上榜、平均价值与近期变化。",
  },
  "90d": {
    days: 90,
    label: "近 90 天",
    shortLabel: "90天",
    description: "观察一个季度内仍能保持价值证据和工程活力的项目。",
  },
  "180d": {
    days: 180,
    label: "近 180 天",
    shortLabel: "180天",
    description: "观察半年尺度的持续价值，优先识别长期稳定而非短期爆发。",
  },
} as const satisfies Record<RankingPeriodId, RankingPeriodMeta>;

export function isRankingPeriodId(value: string): value is RankingPeriodId {
  return RANKING_PERIOD_IDS.some((periodId) => periodId === value);
}

export const DIRECTION_META = {
  "ai-agent": {
    name: "AI Coding 与 Agent",
    shortName: "AI / Agent",
    description: "AI Coding、Agent 工程化与模型应用基础设施。",
  },
  "data-ml": {
    name: "数据与机器学习工程",
    shortName: "数据 / ML",
    description: "数据平台、机器学习工程与模型运行基础设施。",
  },
  "app-platform": {
    name: "前端、后端与跨端",
    shortName: "应用平台",
    description: "Web、API、后端框架与跨端应用工程。",
  },
  "infra-devtools": {
    name: "云原生、可观测与开发者工具",
    shortName: "基础设施",
    description: "云原生、可观测性、DevOps 与开发者效率工具。",
  },
  "security-supply-chain": {
    name: "安全与软件供应链",
    shortName: "安全",
    description: "应用安全、依赖治理与软件供应链。",
  },
} as const satisfies Record<DirectionId, DirectionMeta>;

export const DIRECTION_IDS = Object.keys(DIRECTION_META) as DirectionId[];

export const DIMENSION_META = {
  utility: { label: "实用价值", weight: 18 },
  activity: { label: "开发活跃度", weight: 18 },
  organization: { label: "组织与维护者", weight: 15 },
  engineering: { label: "工程成熟度", weight: 14 },
  adoption: { label: "采用与生态", weight: 10 },
  security: { label: "安全与合规", weight: 10 },
  momentum: { label: "趋势动量", weight: 10 },
  innovation: { label: "创新潜力", weight: 5 },
} as const satisfies Record<DimensionId, DimensionMeta>;

export const DIMENSION_IDS = Object.keys(DIMENSION_META) as DimensionId[];

export const SOURCE_NAMES: Readonly<Record<string, string>> = {
  "configured-seed": "方向种子",
  "github-rest": "GitHub REST API",
  "github-search": "GitHub Search",
  "github-trending": "GitHub Trending",
  gittrend: "GitTrend",
  hublens: "HubLens",
  "hacker-news": "Hacker News",
  "ai-hot": "AI HOT",
  "openssf-scorecard": "OpenSSF Scorecard",
  osv: "OSV",
  "deps-dev": "deps.dev",
  npm: "npm Registry",
  pypi: "Python Package Index",
  "crates-io": "crates.io",
};

export function getSourceName(sourceId: string): string {
  return SOURCE_NAMES[sourceId] ?? sourceId;
}
