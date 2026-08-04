import type { EvaluationResult } from "./evaluate.js";

export function renderDecisionReport(result: EvaluationResult): string {
  const rows = result.productCoverage
    .map(
      (product) =>
        `| ${product.product} | ${product.coveredDimensions.length}/7 | ${product.coveredDimensions.join(", ") || "无"} |`,
    )
    .join("\n");
  return `# GitHub Picks M0 决策报告

- 决策：**${result.decision}**
- 覆盖日期：${result.observedDates.join(", ")}
- 技术方向数：${result.observedDirections.length}
- 代表仓库数：${result.observedRepositories.length}
- 数据问题：${result.issues.join(", ") || "无"}
- 全市场缺口：${result.marketGaps.join(", ") || "无"}

| 产品 | 已满足能力 | 能力列表 |
|---|---:|---|
${rows}

## 执行约束

- USE_EXISTING：停止自建并记录推荐入口。
- THIN_INTEGRATION：先写薄层集成规格，不执行 M1。
- BUILD：允许执行 M1 信源与证据底座计划。
- INSUFFICIENT_EVIDENCE：继续采集，不得进入 M1。
`;
}
