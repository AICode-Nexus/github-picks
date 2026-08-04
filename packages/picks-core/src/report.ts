import type { DailyReport, ScoredRepository, SourceHealth } from "./schema.js";

const directionNames: Record<
  keyof DailyReport["rankings"]["byDirection"],
  string
> = {
  "ai-agent": "AI Coding 与 Agent",
  "data-ml": "数据与机器学习工程",
  "app-platform": "前端、后端与跨端",
  "infra-devtools": "云原生、可观测与开发者工具",
  "security-supply-chain": "安全与软件供应链",
};

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return "高";
  if (confidence >= 0.65) return "中";
  if (confidence >= 0.55) return "早期";
  if (confidence >= 0.45) return "低";
  return "证据不足";
}

function healthLabel(source: SourceHealth): string {
  if (source.status === "healthy") return "正常";
  if (source.status === "degraded") return "降级";
  return "离线";
}

function rankingSection(
  title: string,
  fullNames: string[],
  repositories: Map<string, ScoredRepository>,
): string {
  const lines = [`## ${title}`, ""];
  if (fullNames.length === 0)
    return [...lines, "暂无满足当前证据门槛的项目。", ""].join("\n");
  for (const [index, fullName] of fullNames.entries()) {
    const item = repositories.get(fullName);
    if (item === undefined) continue;
    lines.push(
      `${index + 1}. [${fullName}](${item.snapshot.url}) · ${item.score.publishedScore.toFixed(1)} 分 · 置信度：${confidenceLabel(item.score.confidence)} · 风险扣分：${item.score.riskPenalty}`,
    );
    const isAi =
      item.analysis.generation?.kind === "ai" &&
      item.analysis.generation.status === "verified";
    lines.push(
      `   - ${isAi ? "AI 推荐理由" : "规则事实摘要"}：${item.analysis.recommendationReason ?? item.analysis.why}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function analysisSection(items: ScoredRepository[]): string {
  const lines = ["## 项目分析", ""];
  if (items.length === 0)
    return [...lines, "本期没有达到分析门槛的项目。", ""].join("\n");
  for (const item of items) {
    lines.push(`### [${item.snapshot.fullName}](${item.snapshot.url})`, "");
    const generation = item.analysis.generation;
    const isAi = generation?.kind === "ai" && generation.status === "verified";
    lines.push(
      `- ${isAi ? "AI 推荐理由" : "规则事实摘要"}：${item.analysis.recommendationReason ?? item.analysis.why}`,
    );
    if (isAi) {
      lines.push(
        `- 生成记录：${generation.provider}/${generation.model ?? "unknown"} · Prompt ${generation.promptVersion} · Analysis ${generation.analysisVersion} · Evidence \`${generation.evidenceHash.slice(0, 12)}\``,
      );
    }
    lines.push(`- ${item.analysis.why}`);
    lines.push(`- ${item.analysis.suitableFor}`);
    lines.push(`- ${item.analysis.risks}`);
    lines.push(`- ${item.analysis.nextStep}`);
    lines.push(
      `- 证据：${item.analysis.evidenceUrls.map((url, index) => `[来源 ${index + 1}](${url})`).join("、")}`,
      "",
    );
  }
  return lines.join("\n");
}

export function renderDailyMarkdown(report: DailyReport): string {
  const repositories = new Map(
    report.repositories.map((repository) => [
      repository.snapshot.fullName,
      repository,
    ]),
  );
  const overallItems = report.rankings.overall
    .map((fullName) => repositories.get(fullName))
    .filter((item): item is ScoredRepository => item !== undefined);
  const lines = [
    `# GitHub Picks Daily · ${report.date}`,
    "",
    "> GitHub Picks 是独立、非官方项目，与 GitHub, Inc. 不存在隶属或合作关系。",
    "",
    `> 当前为 ${report.scoreVersion} 实验性评分：分数、置信度和风险分开展示，不应直接替代生产选型评审。`,
    "",
    `运行模式：${report.mode === "live" ? "实时采集" : "证据回放（非实时榜单）"}`,
    "",
    `生成时间：${report.generatedAt} · 时区：${report.timezone}`,
    "",
    `分析版本：${report.analysisVersion ?? "legacy"}`,
    "",
    `发现 ${report.counts.discovered} 个候选，补全 ${report.counts.enriched} 个，发布 ${report.counts.published} 个。`,
    "",
    "## 信源健康",
    "",
    "| 信源 | 状态 | 说明 |",
    "|---|---|---|",
    ...report.sourceHealth.map(
      (source) =>
        `| ${source.sourceId} | ${healthLabel(source)} | ${source.message ?? "—"} |`,
    ),
    "",
    rankingSection("综合价值榜", report.rankings.overall, repositories),
    rankingSection("趋势上升榜", report.rankings.rising, repositories),
    rankingSection("新项目潜力榜", report.rankings.newProjects, repositories),
    rankingSection("隐藏宝石榜", report.rankings.hiddenGems, repositories),
    rankingSection("开发活跃榜", report.rankings.active, repositories),
    "## 分方向榜",
    "",
  ];
  for (const [direction, fullNames] of Object.entries(
    report.rankings.byDirection,
  )) {
    lines.push(
      rankingSection(
        directionNames[direction as keyof typeof directionNames],
        fullNames,
        repositories,
      ),
    );
  }
  lines.push(
    analysisSection(overallItems),
    "---",
    "",
    `配置哈希：\`${report.configHash}\``,
    "",
  );
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}
