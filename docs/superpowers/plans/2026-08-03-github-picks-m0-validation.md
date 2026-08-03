# GitHub Picks M0 Existing-Product Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用连续 7 天、5 个技术方向和 30 个代表仓库的可审计证据，决定 GitHub Picks 应直接使用现有产品、只做薄层集成，还是进入 M1 自建证据底座。

**Architecture:** 在最小 pnpm workspace 中建立一个确定性的 M0 评估工具。人工只负责按固定量表记录现场证据，工具负责校验覆盖度、聚合八个竞品在七项关键能力上的得分，并生成可回放的 go/no-go 报告。

**Tech Stack:** Node.js 24.15.0、pnpm 11.18.0、TypeScript 7.0.2、Zod 4.4.3、YAML 2.9.0、Vitest 4.1.10、Turborepo 2.10.8、Biome 2.5.6。

## Global Constraints

- 产品名称固定为 `GitHub Picks`，不得使用已废弃名称。
- M0 是 M1 的强制门禁；结果不是 `BUILD` 时不得执行 M1。
- 评估对象至少包含 GitHub Trending、OSS Insight、Trending Repos、Trendshift、PickGithub、GitTrend、HubLens、GitHub 中文社区排行榜。
- 评估覆盖至少 7 个连续自然日、5 个技术方向、30 个 GitHub 仓库。
- 七项关键差异固定为：多源证据、可比性校准、活动与组织权重、反作弊与回放、中文决策分析、Obsidian、受限 Agent。
- 只有至少五项差异仍未被任何单一产品满足，且“多源证据”和“Obsidian”均仍是缺口时，才允许输出 `BUILD`。
- 现场事实必须附 URL、北京时间日期和中文说明；无证据不得凭印象打分。
- 不抓取登录页、付费内容或禁止自动访问的页面；Trendshift 等许可限制必须记录。
- M0 不建设采集平台、评分、网站、邮件、Obsidian 插件或 Agent。
- 每次提交前先运行 `pnpm format`，再运行任务列出的测试与 `pnpm check`；代码片段的换行允许由 Biome 机械调整，接口和行为不得改变。

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | 根脚本、版本与 workspace 开发依赖 |
| `pnpm-workspace.yaml` | workspace 边界 |
| `turbo.json` | test/typecheck/build 任务图 |
| `tsconfig.base.json` | 全仓严格 TypeScript 配置 |
| `biome.json` | 格式与静态检查 |
| `.nvmrc` | Node.js 版本 |
| `.gitignore` | 本地凭据、依赖和构建产物边界 |
| `tools/m0-evaluator/src/schema.ts` | M0 范围、观测和结果契约 |
| `tools/m0-evaluator/src/evaluate.ts` | 确定性聚合与决策规则 |
| `tools/m0-evaluator/src/report.ts` | Markdown 报告生成 |
| `tools/m0-evaluator/src/cli.ts` | 校验/评估命令行入口 |
| `tools/m0-evaluator/test/*.test.ts` | 契约、决策和固定范围测试 |
| `docs/research/m0/scope.yaml` | 八个产品、五个方向和三十个仓库的固定样本 |
| `docs/research/m0/protocol.md` | 评分量表与每天操作规程 |
| `docs/research/m0/observations/*.yaml` | 每日现场证据；一日一个不可变文件 |
| `docs/research/m0/decision.md` | 自动生成的最终 go/no-go 报告 |

## Decision Outputs

- `USE_EXISTING`：至少一个现有产品完整满足七项能力，停止自建。
- `THIN_INTEGRATION`：至少一个现有产品满足五项或六项能力，先另写薄层集成规格。
- `BUILD`：没有产品达到五项，且至少五项是全市场缺口，同时包含多源证据和 Obsidian；允许执行 M1。
- `INSUFFICIENT_EVIDENCE`：日期、方向、仓库或证据字段未达门槛，继续 M0，不得作结论。

---

### Task 1: Bootstrap the Reproducible M0 Workspace

**Files:**
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `biome.json`
- Create: `tools/m0-evaluator/package.json`
- Create: `tools/m0-evaluator/tsconfig.json`
- Create: `tools/m0-evaluator/test/schema.test.ts`
- Create: `tools/m0-evaluator/src/schema.ts`

**Interfaces:**
- Consumes: none.
- Produces: `M0ScopeSchema`, `M0ObservationSchema`, `M0DecisionSchema`, `DIMENSIONS`, and their inferred TypeScript types.

- [ ] **Step 1: Create root workspace configuration**

```json
// package.json
{
  "name": "github-picks",
  "private": true,
  "packageManager": "pnpm@11.18.0",
  "engines": { "node": "24.15.x" },
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "format": "biome format --write .",
    "lint": "biome check .",
    "check": "biome check . && turbo typecheck test",
    "m0:evaluate": "pnpm --filter @github-picks/m0-evaluator evaluate"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.6",
    "@types/node": "26.1.2",
    "turbo": "2.10.8",
    "tsx": "4.23.5",
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "workers/*"
  - "tools/*"
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^typecheck"], "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] }
  }
}
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.5.6/schema.json",
  "files": { "includes": ["**", "!!**/dist", "!!**/node_modules"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
```

```text
# .nvmrc
24.15.0
```

```gitignore
# .gitignore
.env
.env.*
!.env.example
node_modules/
dist/
coverage/
.turbo/
*.log
```

- [ ] **Step 2: Create the tool package and failing schema test**

```json
// tools/m0-evaluator/package.json
{
  "name": "@github-picks/m0-evaluator",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "evaluate": "tsx src/cli.ts"
  },
  "dependencies": {
    "yaml": "2.9.0",
    "zod": "4.4.3"
  }
}
```

```json
// tools/m0-evaluator/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": ".", "outDir": "dist" },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

```ts
// tools/m0-evaluator/test/schema.test.ts
import { describe, expect, it } from "vitest";
import { DIMENSIONS, M0ObservationSchema } from "../src/schema.js";

describe("M0ObservationSchema", () => {
  it("accepts a complete auditable observation", () => {
    const capabilities = Object.fromEntries(
      DIMENSIONS.map((dimension) => [
        dimension,
        {
          score: 2,
          evidenceUrl: "https://example.com/evidence",
          note: "页面直接提供该能力，并能定位到公开证据。",
        },
      ]),
    );

    expect(
      M0ObservationSchema.parse({
        date: "2026-08-03",
        product: "github-trending",
        directions: ["ai-agent"],
        repositories: ["openai/codex"],
        capabilities,
      }),
    ).toBeTruthy();
  });

  it("rejects evidence without a URL", () => {
    expect(() =>
      M0ObservationSchema.parse({
        date: "2026-08-03",
        product: "github-trending",
        directions: ["ai-agent"],
        repositories: ["openai/codex"],
        capabilities: {},
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Install dependencies and verify the test fails**

Run: `corepack enable && corepack prepare pnpm@11.18.0 --activate && pnpm install && pnpm --filter @github-picks/m0-evaluator test`

Expected: FAIL because `tools/m0-evaluator/src/schema.ts` does not exist.

- [ ] **Step 4: Add the complete M0 schemas**

```ts
// tools/m0-evaluator/src/schema.ts
import { z } from "zod";

export const DIMENSIONS = [
  "multi_source_evidence",
  "cohort_comparability",
  "activity_and_organization",
  "anti_gaming_and_replay",
  "chinese_decision_analysis",
  "obsidian_ownership",
  "restricted_agent",
] as const;

export const DimensionSchema = z.enum(DIMENSIONS);
export const CapabilityEvidenceSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  evidenceUrl: z.url(),
  note: z.string().min(10),
});

export const M0ObservationSchema = z.object({
  date: z.iso.date(),
  product: z.string().min(2),
  directions: z.array(z.string().min(2)).min(1),
  repositories: z.array(z.string().regex(/^[^/]+\/[^/]+$/)).min(1),
  capabilities: z.record(DimensionSchema, CapabilityEvidenceSchema),
});

export const M0ScopeSchema = z.object({
  timezone: z.literal("Asia/Shanghai"),
  minimumDays: z.literal(7),
  minimumDirections: z.literal(5),
  minimumRepositories: z.literal(30),
  products: z.array(z.object({ id: z.string(), name: z.string(), url: z.url() })).min(8),
  directions: z.array(z.object({ id: z.string(), name: z.string() })).min(5),
  repositories: z.array(z.object({ slug: z.string().regex(/^[^/]+\/[^/]+$/), direction: z.string() })).min(30),
  requiredDimensions: z.array(DimensionSchema).length(DIMENSIONS.length),
  capabilityThreshold: z.literal(1.5),
  thinIntegrationMinimum: z.literal(5),
  buildGapMinimum: z.literal(5),
});

export const M0DecisionSchema = z.enum([
  "USE_EXISTING",
  "THIN_INTEGRATION",
  "BUILD",
  "INSUFFICIENT_EVIDENCE",
]);

export type Dimension = z.infer<typeof DimensionSchema>;
export type M0Observation = z.infer<typeof M0ObservationSchema>;
export type M0Scope = z.infer<typeof M0ScopeSchema>;
export type M0Decision = z.infer<typeof M0DecisionSchema>;
```

- [ ] **Step 5: Run checks and commit**

Run: `pnpm format && pnpm --filter @github-picks/m0-evaluator test && pnpm --filter @github-picks/m0-evaluator typecheck && pnpm lint`

Expected: 2 tests PASS; TypeScript and Biome exit 0.

```bash
git add .nvmrc .gitignore package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json biome.json tools/m0-evaluator
git commit -m "chore: bootstrap M0 evaluation workspace"
```

### Task 2: Implement the Deterministic Go/No-Go Evaluator

**Files:**
- Create: `tools/m0-evaluator/test/evaluate.test.ts`
- Create: `tools/m0-evaluator/src/evaluate.ts`
- Create: `tools/m0-evaluator/src/report.ts`
- Create: `tools/m0-evaluator/src/cli.ts`

**Interfaces:**
- Consumes: `M0Scope`, `M0Observation`, `DIMENSIONS` from Task 1.
- Produces: `EvaluationResult`, `evaluateM0(scope, observations)`, `renderDecisionReport(result)`, CLI `pnpm m0:evaluate -- <scope> <observations-dir> <output>`.

- [ ] **Step 1: Write failing decision tests**

```ts
// tools/m0-evaluator/test/evaluate.test.ts
import { describe, expect, it } from "vitest";
import { evaluateM0 } from "../src/evaluate.js";
import { DIMENSIONS, type M0Observation, type M0Scope } from "../src/schema.js";

const scope: M0Scope = {
  timezone: "Asia/Shanghai",
  minimumDays: 7,
  minimumDirections: 5,
  minimumRepositories: 30,
  products: Array.from({ length: 8 }, (_, index) => ({
    id: `product-${index}`,
    name: `Product ${index}`,
    url: `https://example.com/product-${index}`,
  })),
  directions: Array.from({ length: 5 }, (_, index) => ({ id: `direction-${index}`, name: `Direction ${index}` })),
  repositories: Array.from({ length: 30 }, (_, index) => ({
    slug: `owner-${index}/repo-${index}`,
    direction: `direction-${index % 5}`,
  })),
  requiredDimensions: [...DIMENSIONS],
  capabilityThreshold: 1.5,
  thinIntegrationMinimum: 5,
  buildGapMinimum: 5,
};

function observations(scoreFor: (product: number, dimension: number) => 0 | 1 | 2): M0Observation[] {
  return Array.from({ length: 7 }, (_, day) =>
    scope.products.map((product, productIndex) => ({
      date: `2026-08-${String(day + 3).padStart(2, "0")}`,
      product: product.id,
      directions: scope.directions.map((direction) => direction.id),
      repositories: scope.repositories.map((repository) => repository.slug),
      capabilities: Object.fromEntries(
        DIMENSIONS.map((dimension, dimensionIndex) => [
          dimension,
          {
            score: scoreFor(productIndex, dimensionIndex),
            evidenceUrl: product.url,
            note: "根据当天公开页面和接口记录形成的可审计判断。",
          },
        ]),
      ) as M0Observation["capabilities"],
    })),
  ).flat();
}

describe("evaluateM0", () => {
  it("returns USE_EXISTING when one product covers all seven dimensions", () => {
    expect(evaluateM0(scope, observations((product) => (product === 0 ? 2 : 0))).decision).toBe("USE_EXISTING");
  });

  it("returns THIN_INTEGRATION when one product covers five dimensions", () => {
    expect(evaluateM0(scope, observations((product, dimension) => (product === 0 && dimension < 5 ? 2 : 0))).decision).toBe(
      "THIN_INTEGRATION",
    );
  });

  it("returns BUILD only when five market gaps include evidence and Obsidian", () => {
    expect(evaluateM0(scope, observations(() => 0)).decision).toBe("BUILD");
  });

  it("returns INSUFFICIENT_EVIDENCE before seven dates are present", () => {
    expect(evaluateM0(scope, observations(() => 0).filter((row) => row.date !== "2026-08-09")).decision).toBe(
      "INSUFFICIENT_EVIDENCE",
    );
  });

  it("rejects seven non-consecutive dates", () => {
    const rows = observations(() => 0).map((row) => row.date === "2026-08-09" ? { ...row, date: "2026-08-10" } : row);
    expect(evaluateM0(scope, rows).issues).toContain("consecutive-dates:6/7");
  });

  it("rejects substituted directions repositories and products", () => {
    const rows = observations(() => 0);
    rows[0] = { ...rows[0]!, product: "unknown-product", directions: ["wrong-1", "wrong-2", "wrong-3", "wrong-4", "wrong-5"], repositories: Array.from({ length: 30 }, (_, index) => `wrong/repo-${index}`) };
    expect(evaluateM0(scope, rows).decision).toBe("INSUFFICIENT_EVIDENCE");
    expect(evaluateM0(scope, rows).issues).toEqual(expect.arrayContaining(["unknown-product:unknown-product", "direction-set-mismatch", "repository-set-mismatch"]));
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter @github-picks/m0-evaluator test -- evaluate.test.ts`

Expected: FAIL because `evaluateM0` is not defined.

- [ ] **Step 3: Implement aggregation and the decision rule**

```ts
// tools/m0-evaluator/src/evaluate.ts
import { DIMENSIONS, type Dimension, type M0Decision, type M0Observation, type M0Scope } from "./schema.js";

export interface ProductCoverage {
  product: string;
  averages: Record<Dimension, number>;
  coveredDimensions: Dimension[];
}

export interface EvaluationResult {
  decision: M0Decision;
  issues: string[];
  observedDates: string[];
  observedDirections: string[];
  observedRepositories: string[];
  productCoverage: ProductCoverage[];
  marketGaps: Dimension[];
}

export function evaluateM0(scope: M0Scope, observations: M0Observation[]): EvaluationResult {
  const observedDates = [...new Set(observations.map((row) => row.date))].sort();
  const observedDirections = [...new Set(observations.flatMap((row) => row.directions))].sort();
  const observedRepositories = [...new Set(observations.flatMap((row) => row.repositories))].sort();
  const issues: string[] = [];

  const expectedProducts = new Set(scope.products.map((product) => product.id));
  const expectedDirections = new Set(scope.directions.map((direction) => direction.id));
  const expectedRepositories = new Set(scope.repositories.map((repository) => repository.slug));
  const sameSet = (actual: string[], expected: Set<string>) => actual.length === expected.size && new Set(actual).size === expected.size && actual.every((item) => expected.has(item));
  const dayNumbers = observedDates.map((date) => Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  let longestConsecutiveRun = dayNumbers.length > 0 ? 1 : 0;
  let currentRun = longestConsecutiveRun;
  for (let index = 1; index < dayNumbers.length; index += 1) {
    currentRun = dayNumbers[index] === dayNumbers[index - 1]! + 1 ? currentRun + 1 : 1;
    longestConsecutiveRun = Math.max(longestConsecutiveRun, currentRun);
  }
  if (longestConsecutiveRun < scope.minimumDays) issues.push(`consecutive-dates:${longestConsecutiveRun}/${scope.minimumDays}`);

  for (const product of new Set(observations.map((row) => row.product))) if (!expectedProducts.has(product)) issues.push(`unknown-product:${product}`);
  if (observations.some((row) => !sameSet(row.directions, expectedDirections))) issues.push("direction-set-mismatch");
  if (observations.some((row) => !sameSet(row.repositories, expectedRepositories))) issues.push("repository-set-mismatch");

  const productDateCells = new Set(observations.map((row) => `${row.date}:${row.product}`));
  if (productDateCells.size !== observations.length) issues.push("duplicate-product-date-observation");
  const requiredCells = observedDates.flatMap((date) => scope.products.map((product) => `${date}:${product.id}`));
  const presentRequiredCells = requiredCells.filter((cell) => productDateCells.has(cell)).length;
  if (observedDates.length >= scope.minimumDays && presentRequiredCells !== requiredCells.length) issues.push(`product-date-cells:${presentRequiredCells}/${requiredCells.length}`);

  if (observedDates.length < scope.minimumDays) issues.push(`dates:${observedDates.length}/${scope.minimumDays}`);
  if (observedDirections.length < scope.minimumDirections) issues.push(`directions:${observedDirections.length}/${scope.minimumDirections}`);
  if (observedRepositories.length < scope.minimumRepositories) {
    issues.push(`repositories:${observedRepositories.length}/${scope.minimumRepositories}`);
  }

  const productCoverage = scope.products.map(({ id }) => {
    const rows = observations.filter((row) => row.product === id);
    const averages = Object.fromEntries(
      DIMENSIONS.map((dimension) => {
        const values = rows.map((row) => row.capabilities[dimension].score);
        return [dimension, values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length];
      }),
    ) as Record<Dimension, number>;
    const coveredDimensions = DIMENSIONS.filter((dimension) => averages[dimension] >= scope.capabilityThreshold);
    return { product: id, averages, coveredDimensions };
  });

  const marketGaps = DIMENSIONS.filter(
    (dimension) => Math.max(...productCoverage.map((product) => product.averages[dimension])) < scope.capabilityThreshold,
  );

  let decision: M0Decision = "INSUFFICIENT_EVIDENCE";
  if (issues.length === 0) {
    const strongestCoverage = Math.max(...productCoverage.map((product) => product.coveredDimensions.length));
    if (strongestCoverage === DIMENSIONS.length) decision = "USE_EXISTING";
    else if (strongestCoverage >= scope.thinIntegrationMinimum) decision = "THIN_INTEGRATION";
    else if (
      marketGaps.length >= scope.buildGapMinimum &&
      marketGaps.includes("multi_source_evidence") &&
      marketGaps.includes("obsidian_ownership")
    ) {
      decision = "BUILD";
    } else decision = "THIN_INTEGRATION";
  }

  return { decision, issues, observedDates, observedDirections, observedRepositories, productCoverage, marketGaps };
}
```

- [ ] **Step 4: Add report rendering and the CLI**

```ts
// tools/m0-evaluator/src/report.ts
import type { EvaluationResult } from "./evaluate.js";

export function renderDecisionReport(result: EvaluationResult): string {
  const rows = result.productCoverage
    .map((product) => `| ${product.product} | ${product.coveredDimensions.length}/7 | ${product.coveredDimensions.join(", ") || "无"} |`)
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
```

```ts
// tools/m0-evaluator/src/cli.ts
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { evaluateM0 } from "./evaluate.js";
import { renderDecisionReport } from "./report.js";
import { M0ObservationSchema, M0ScopeSchema } from "./schema.js";

const [scopePath = "docs/research/m0/scope.yaml", observationDir = "docs/research/m0/observations", outputPath = "docs/research/m0/decision.md"] =
  process.argv.slice(2);
const scope = M0ScopeSchema.parse(YAML.parse(await readFile(resolve(scopePath), "utf8")));
const files = (await readdir(resolve(observationDir))).filter((file) => file.endsWith(".yaml")).sort();
const observations = await Promise.all(
  files.map(async (file) => M0ObservationSchema.parse(YAML.parse(await readFile(resolve(observationDir, file), "utf8")))),
);
const result = evaluateM0(scope, observations);
await writeFile(resolve(outputPath), renderDecisionReport(result), "utf8");
process.stdout.write(`${result.decision}\n`);
process.exitCode = result.decision === "INSUFFICIENT_EVIDENCE" ? 2 : 0;
```

- [ ] **Step 5: Verify all four branches and commit**

Run: `pnpm --filter @github-picks/m0-evaluator test -- evaluate.test.ts && pnpm check`

Expected: 6 evaluator tests PASS; full check exits 0.

```bash
git add tools/m0-evaluator
git commit -m "feat: add deterministic M0 go-no-go evaluator"
```

### Task 3: Freeze the Evaluation Scope and Evidence Protocol

**Files:**
- Create: `docs/research/m0/scope.yaml`
- Create: `docs/research/m0/protocol.md`
- Create: `tools/m0-evaluator/test/scope.test.ts`

**Interfaces:**
- Consumes: `M0ScopeSchema` from Task 1.
- Produces: the immutable sample population used by Task 4.

- [ ] **Step 1: Write a failing scope contract test**

```ts
// tools/m0-evaluator/test/scope.test.ts
import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { DIMENSIONS, M0ScopeSchema } from "../src/schema.js";

describe("M0 fixed scope", () => {
  it("contains eight products, five directions, thirty unique repositories, and all dimensions", async () => {
    const scope = M0ScopeSchema.parse(YAML.parse(await readFile("../../docs/research/m0/scope.yaml", "utf8")));
    expect(scope.products).toHaveLength(8);
    expect(scope.directions).toHaveLength(5);
    expect(new Set(scope.repositories.map((repository) => repository.slug)).size).toBe(30);
    expect(scope.requiredDimensions).toEqual(DIMENSIONS);
  });
});
```

- [ ] **Step 2: Run the scope test and verify failure**

Run from `tools/m0-evaluator`: `pnpm test -- scope.test.ts`

Expected: FAIL with ENOENT for `docs/research/m0/scope.yaml`.

- [ ] **Step 3: Add the exact fixed scope**

```yaml
# docs/research/m0/scope.yaml
timezone: Asia/Shanghai
minimumDays: 7
minimumDirections: 5
minimumRepositories: 30
capabilityThreshold: 1.5
thinIntegrationMinimum: 5
buildGapMinimum: 5
requiredDimensions:
  - multi_source_evidence
  - cohort_comparability
  - activity_and_organization
  - anti_gaming_and_replay
  - chinese_decision_analysis
  - obsidian_ownership
  - restricted_agent
products:
  - { id: github-trending, name: GitHub Trending, url: "https://github.com/trending" }
  - { id: oss-insight, name: OSS Insight, url: "https://ossinsight.io/" }
  - { id: trending-repos, name: Trending Repos, url: "https://trending-repos.com/" }
  - { id: trendshift, name: Trendshift, url: "https://trendshift.io/" }
  - { id: pickgithub, name: PickGithub, url: "https://pickgithub.com/" }
  - { id: gittrend, name: GitTrend, url: "https://gittrend.io/" }
  - { id: hublens, name: HubLens, url: "https://hublens.dev/en/" }
  - { id: github-cn, name: GitHub 中文社区排行榜, url: "https://github-cn.com/ranking" }
directions:
  - { id: ai-agent, name: AI Coding 与 Agent }
  - { id: data-ml, name: 数据与机器学习工程 }
  - { id: app-platform, name: 前端、后端与跨端 }
  - { id: infra-devtools, name: 云原生、可观测与开发者工具 }
  - { id: security-supply-chain, name: 安全与软件供应链 }
repositories:
  - { slug: openai/codex, direction: ai-agent }
  - { slug: microsoft/autogen, direction: ai-agent }
  - { slug: langchain-ai/langgraph, direction: ai-agent }
  - { slug: continuedev/continue, direction: ai-agent }
  - { slug: Aider-AI/aider, direction: ai-agent }
  - { slug: modelcontextprotocol/servers, direction: ai-agent }
  - { slug: vllm-project/vllm, direction: data-ml }
  - { slug: huggingface/transformers, direction: data-ml }
  - { slug: mlflow/mlflow, direction: data-ml }
  - { slug: ray-project/ray, direction: data-ml }
  - { slug: pytorch/pytorch, direction: data-ml }
  - { slug: dlt-hub/dlt, direction: data-ml }
  - { slug: vercel/next.js, direction: app-platform }
  - { slug: vuejs/core, direction: app-platform }
  - { slug: fastify/fastify, direction: app-platform }
  - { slug: denoland/deno, direction: app-platform }
  - { slug: oven-sh/bun, direction: app-platform }
  - { slug: tauri-apps/tauri, direction: app-platform }
  - { slug: kubernetes/kubernetes, direction: infra-devtools }
  - { slug: grafana/grafana, direction: infra-devtools }
  - { slug: open-telemetry/opentelemetry-collector, direction: infra-devtools }
  - { slug: dagger/dagger, direction: infra-devtools }
  - { slug: nektos/act, direction: infra-devtools }
  - { slug: astral-sh/uv, direction: infra-devtools }
  - { slug: ossf/scorecard, direction: security-supply-chain }
  - { slug: google/osv-scanner, direction: security-supply-chain }
  - { slug: anchore/syft, direction: security-supply-chain }
  - { slug: sigstore/cosign, direction: security-supply-chain }
  - { slug: aquasecurity/trivy, direction: security-supply-chain }
  - { slug: zaproxy/zaproxy, direction: security-supply-chain }
```

- [ ] **Step 4: Add the evidence scoring protocol**

```markdown
<!-- docs/research/m0/protocol.md -->
# M0 现场评估规程

每天北京时间 08:00–20:00 之间，对 scope.yaml 的八个产品完成一次观测。每个 YAML 文件只记录一个产品在一个日期的结果，文件名为 YYYY-MM-DD-product-id.yaml。每日批次提交后不得 amend、squash 或 force-push；事实错误只能在后续独立 `research: correct ...` 提交中修正原文件并说明理由，让 Git 历史保留原值和修正值，同时避免同一产品日期出现重复输入。

## 评分

- 0：公开产品没有该能力，或只有无法核验的宣传。
- 1：部分具备、依赖人工、缺少版本/证据回放，或只能通过额外开发间接获得。
- 2：产品直接提供，且公开页面/API能定位证据、时间和可重复结果。

每项必须填写公开 evidenceUrl 和至少 10 个汉字的 note。付费或登录后能力只按当天实际可核验范围评分；许可限制写入 note。

## 七项能力的统一判定

1. multi_source_evidence：不是多个 GitHub 派生页面，而是 GitHub、包、安全、依赖或独立社区的跨组证据。
2. cohort_comparability：按类型、年龄、规模或生态做可比性校准。
3. activity_and_organization：高频真实活动和组织/维护者分别具有公开权重或可解释信号。
4. anti_gaming_and_replay：具备 Star 上限、异常隔离、历史公式/数据回放。
5. chinese_decision_analysis：中文内容回答适合谁、风险、采用成本和下一步，而非 README 摘要。
6. obsidian_ownership：支持标准 Markdown、增量同步，并保护用户批注和数据所有权。
7. restricted_agent：Agent/API 能按个人方向过滤，公共分不被改写，权限范围可审计。

每天先使用产品完成五个方向的发现，再用三十个固定仓库检查深度能力。无法找到某仓库本身是覆盖证据，不允许改换更有利的样本。
```

- [ ] **Step 5: Run validation and commit the frozen scope**

Run: `pnpm --filter @github-picks/m0-evaluator test -- scope.test.ts && pnpm check`

Expected: scope test PASS; full check exits 0.

```bash
git add docs/research/m0/scope.yaml docs/research/m0/protocol.md tools/m0-evaluator/test/scope.test.ts
git commit -m "docs: freeze M0 competitor evaluation scope"
```

### Task 4: Run Seven Daily Observations and Enforce the Gate

**Files:**
- Create: `docs/research/m0/observations/YYYY-MM-DD-product-id.yaml` from actual observed values, 8 files per day for 7 consecutive days.
- Create: `docs/research/m0/decision.md` with the evaluator.
- Modify: `docs/superpowers/specs/2026-08-03-github-picks-open-source-intelligence-design.md` only to record the M0 outcome and evidence link.

**Interfaces:**
- Consumes: `scope.yaml`, `protocol.md`, and `pnpm m0:evaluate`.
- Produces: one of `USE_EXISTING`, `THIN_INTEGRATION`, `BUILD`, or `INSUFFICIENT_EVIDENCE`; M1 consumes only `BUILD`.

- [ ] **Step 1: Record one immutable YAML observation for each product each day**

Use this exact shape, replacing values only with facts observed on that date:

```yaml
date: "2026-08-03"
product: hublens
directions: [ai-agent, data-ml, app-platform, infra-devtools, security-supply-chain]
repositories:
  - openai/codex
  - microsoft/autogen
  - langchain-ai/langgraph
  - continuedev/continue
  - Aider-AI/aider
  - modelcontextprotocol/servers
  - vllm-project/vllm
  - huggingface/transformers
  - mlflow/mlflow
  - ray-project/ray
  - pytorch/pytorch
  - dlt-hub/dlt
  - vercel/next.js
  - vuejs/core
  - fastify/fastify
  - denoland/deno
  - oven-sh/bun
  - tauri-apps/tauri
  - kubernetes/kubernetes
  - grafana/grafana
  - open-telemetry/opentelemetry-collector
  - dagger/dagger
  - nektos/act
  - astral-sh/uv
  - ossf/scorecard
  - google/osv-scanner
  - anchore/syft
  - sigstore/cosign
  - aquasecurity/trivy
  - zaproxy/zaproxy
capabilities:
  multi_source_evidence: { score: 1, evidenceUrl: "https://hublens.dev/en/", note: "公开页说明使用 GitHub 与 Hacker News，但未展示完整来源回放链。" }
  cohort_comparability: { score: 1, evidenceUrl: "https://hublens.dev/en/", note: "提供分类榜，但未看到年龄、规模和生命周期 cohort 校准。" }
  activity_and_organization: { score: 1, evidenceUrl: "https://hublens.dev/en/", note: "展示贡献者等比较信息，未看到独立组织信誉权重。" }
  anti_gaming_and_replay: { score: 0, evidenceUrl: "https://hublens.dev/en/", note: "本次公开检查未找到反作弊隔离与评分快照回放说明。" }
  chinese_decision_analysis: { score: 1, evidenceUrl: "https://hublens.dev/en/", note: "提供中文摘要，是否覆盖采用成本和风险需按固定仓库继续核验。" }
  obsidian_ownership: { score: 0, evidenceUrl: "https://hublens.dev/en/", note: "本次公开检查未找到 Obsidian 增量同步和用户内容保护协议。" }
  restricted_agent: { score: 2, evidenceUrl: "https://hublens.dev/en/", note: "公开页提供 REST API 与 MCP，能够被外部 Agent 查询趋势数据。" }
```

The shown file is the first-day HubLens observation. For every other product/date, record that product's live values and evidence; do not copy HubLens scores.

- [ ] **Step 2: Validate coverage after each day**

Run: `pnpm m0:evaluate`

Expected on days 1–6: exit 2 and print `INSUFFICIENT_EVIDENCE`. On day 7, exit 0 and print a final decision.

- [ ] **Step 3: Commit each day as an immutable evidence batch**

```bash
git add docs/research/m0/observations
git commit -m "research: record GitHub Picks M0 daily evidence"
```

Expected: exactly eight new observation files in each daily commit; corrections are later standalone commits that modify only affected observation files and never add a duplicate product/date YAML.

- [ ] **Step 4: Generate and verify the final report**

Run: `pnpm m0:evaluate && pnpm check && git diff --check`

Expected: `docs/research/m0/decision.md` exists, lists 7 dates, 5 directions, 30 repositories, 8 products, no data issues, and a non-insufficient decision.

- [ ] **Step 5: Apply the mandatory branch rule and commit**

- If `USE_EXISTING`: update the spec with the chosen product and stop; do not execute M1.
- If `THIN_INTEGRATION`: create a new thin-integration design specification and stop; do not execute M1.
- If `BUILD`: update the spec with the decision report link and proceed to `2026-08-03-github-picks-m1-evidence-foundation.md`.

```bash
git add docs/research/m0/decision.md docs/superpowers/specs/2026-08-03-github-picks-open-source-intelligence-design.md
git commit -m "research: decide GitHub Picks build path"
```

## M0 Completion Checklist

- [ ] Seven distinct Beijing dates are present.
- [ ] Eight products are observed on every date.
- [ ] Five directions and thirty fixed repositories are retained.
- [ ] Every capability score has a URL and Chinese evidence note.
- [ ] `pnpm check` passes.
- [ ] `decision.md` is generated, not hand-edited.
- [ ] M1 execution is blocked unless the exact decision is `BUILD`.
