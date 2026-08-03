# GitHub Picks Daily MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个真实可运行的纵向闭环，使 `pnpm picks:daily` 能从多信源发现候选、补全 GitHub 一手事实、执行八维确定性评分，并生成当天 JSON 与中文 Markdown 榜单。

**Architecture:** 采用 TypeScript monorepo 的两层结构：`@github-picks/core` 保存版本化契约、评分、榜单和中文解释等纯函数，`@github-picks/daily` 负责 HTTP 采集、不可变原始快照、流水线编排和 CLI。首版使用文件系统保存可回放证据，不提前引入 PostgreSQL、Redis、对象存储或网站框架；后续网站直接消费相同的 `DailyReport` 契约。

**Tech Stack:** Node.js 24.15.0、pnpm 11.18.0、TypeScript 7.0.2、Zod 4.4.3、YAML 2.9.0、Cheerio 1.2.0、Vitest 4.1.10、Node 原生 `fetch` 与文件系统 API。

## Global Constraints

- 用户已于 2026-08-03 明确终止 Day 2–7 人工竞品观测并授权直接建设；不得把这一决定伪装成 M0 机器评估已输出 `BUILD`。
- GitTrend、HubLens、GitHub Trending 和 Hacker News 只负责候选发现与交叉验证；核心仓库事实必须回到 GitHub REST 等一手来源。
- 首期固定覆盖 `ai-agent`、`data-ml`、`app-platform`、`infra-devtools`、`security-supply-chain` 五个方向。
- 八维权重固定为 Utility 18、Activity 18、Organization 15、Engineering 14、Adoption 10、Security 10、Momentum 10、Innovation 5，总和必须等于 100。
- 总 Star 对综合分的直接贡献不得超过 1.5 分；Star 增速对综合分的直接贡献不得超过 3 分。
- `missing` 只降低置信度或使用 50 分先验，不能被当作明确负面事实；风险、置信度和价值分必须分开。
- 明确 archived 的项目不能进入普通榜单；许可证缺失产生独立风险，不得被组织信誉或 Star 抵消。
- 大模型不得直接产生维度分或发布分；首版中文解释由确定性证据模板生成。
- 所有公开结论必须保存 `sourceId`、`evidenceUrl`、`observedAt` 与评分版本；原始响应按内容哈希不可变保存。
- 默认无 Token 也能运行；存在 `GITHUB_TOKEN` 时才增加 GitHub 配额。日志不得输出 Token、Cookie 或完整响应头。
- 单个信源失败时记录健康状态并继续降级；只有所有发现源都失败或没有任何可补全候选时 CLI 才失败。
- 每项生产行为先写测试并观察正确失败，再写最小实现；每个任务完成后运行 focused test、`pnpm format` 和 `pnpm check`。

---

## File Structure

| Path | Responsibility |
|---|---|
| `config/picks.yaml` | 评分版本、五个方向、信源、候选与榜单限额 |
| `packages/picks-core/src/schema.ts` | Evidence、Candidate、RepositorySnapshot、ScoreCard、DailyReport 契约 |
| `packages/picks-core/src/scoring.ts` | 八维、置信度、风险和发布分的确定性计算 |
| `packages/picks-core/src/ranking.ts` | 综合榜、新锐榜、隐藏宝石榜、活跃榜与方向榜 |
| `packages/picks-core/src/analysis.ts` | 基于证据的中文项目结论 |
| `packages/picks-core/src/report.ts` | 标准 Markdown 渲染 |
| `workers/daily/src/http.ts` | 超时、重试、User-Agent、脱敏和响应读取 |
| `workers/daily/src/discovery.ts` | 多发现源采集、解析、去重和方向补位 |
| `workers/daily/src/github.ts` | GitHub 仓库和事件一手事实补全 |
| `workers/daily/src/scorecard.ts` | OpenSSF Scorecard 补全与可降级缺失状态 |
| `workers/daily/src/raw-store.ts` | SHA-256 内容寻址原始快照 |
| `workers/daily/src/pipeline.ts` | 发现、补全、评分、排行和产物写入编排 |
| `workers/daily/src/cli.ts` | `picks:daily` 参数、退出码和摘要输出 |
| `workers/daily/test/fixtures/` | 不联网的解析及端到端回放样本 |
| `artifacts/daily/<date>/` | 实际运行生成的 `report.json`、`report.md`、`manifest.json` |

## Stable Interfaces

```ts
export type DirectionId =
  | "ai-agent"
  | "data-ml"
  | "app-platform"
  | "infra-devtools"
  | "security-supply-chain";

export interface DiscoveryAdapter {
  readonly sourceId: string;
  discover(context: DiscoveryContext): Promise<CandidateSignal[]>;
}

export interface RepositoryEnricher {
  enrich(fullName: string, context: EnrichmentContext): Promise<RepositorySnapshot>;
}

export interface RawStore {
  put(input: RawArtifactInput): Promise<RawArtifactRef>;
}

export function scoreRepository(snapshot: RepositorySnapshot, config: PicksConfig): RepositoryScore;
export function buildRankings(items: ScoredRepository[], config: PicksConfig): Rankings;
export function analyzeRepository(item: ScoredRepository): ChineseAnalysis;
export function renderDailyMarkdown(report: DailyReport): string;
export function runDailyPipeline(options: PipelineOptions): Promise<DailyReport>;
```

---

### Task 1: Record the Build Decision and Add Versioned Contracts

**Files:**
- Create: `config/picks.yaml`
- Create: `packages/picks-core/package.json`
- Create: `packages/picks-core/tsconfig.json`
- Create: `packages/picks-core/src/schema.ts`
- Create: `packages/picks-core/src/config.ts`
- Create: `packages/picks-core/src/index.ts`
- Create: `packages/picks-core/test/config.test.ts`
- Modify: `package.json`
- Modify: `docs/superpowers/specs/2026-08-03-github-picks-open-source-intelligence-design.md`

**Interfaces:**
- Consumes: 已确认的主规格八维权重与 M0 Day 1 证据。
- Produces: `PicksConfigSchema`、`CandidateSignalSchema`、`RepositorySnapshotSchema`、`RepositoryScoreSchema`、`DailyReportSchema`、`loadPicksConfig()`。

- [x] **Step 1: Write the failing configuration test**

```ts
import { describe, expect, it } from "vitest";
import { loadPicksConfig } from "../src/config.js";

describe("GitHub Picks config", () => {
  it("freezes five directions and the eight dimensions at 100 percent", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    expect(config.directions).toHaveLength(5);
    expect(Object.values(config.weights).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(config.weights.activity).toBe(18);
    expect(config.weights.organization).toBe(15);
    expect(config.features.adoption.starStockWeight).toBe(0.15);
    expect(config.features.momentum.starVelocityWeight).toBe(0.3);
  });
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @github-picks/core test -- config.test.ts`

Expected: FAIL because `@github-picks/core`, `config/picks.yaml` and `loadPicksConfig` do not exist.

- [x] **Step 3: Add the package, schemas and exact configuration**

`config/picks.yaml` must declare version `v0.1.0`, timezone `Asia/Shanghai`, the five direction IDs, source metadata including `tier` and `independenceGroup`, the exact eight weights, `starStockWeight: 0.15`, `starVelocityWeight: 0.30`, `candidateLimit: 60`, `enrichmentLimit: 20`, `overallLimit: 20`, and `directionLimit: 10`.

`schema.ts` must use strict Zod objects and expose the stable interfaces above. `Evidence` must contain source, tier, independence group, URL, observation time, field and value. `RepositorySnapshot` must distinguish `missingFields` from negative facts. `DailyReport` must include a score version, generated time, source health, ranked items and evidence references.

- [x] **Step 4: Record the explicit user decision without rewriting M0 evidence**

Append a dated decision in section 34 of the main specification stating: Day 1 remains an exploratory snapshot; the seven-day competitor evaluator remains incomplete; the user explicitly stopped Day 2–7 and chose a thin-integration vertical MVP; existing products remain discovery sources and do not become unverified core facts.

- [x] **Step 5: Run tests, format, verify and commit**

Run:

```bash
pnpm install
pnpm --filter @github-picks/core test -- config.test.ts
pnpm format
pnpm check
git add package.json pnpm-lock.yaml config/picks.yaml packages/picks-core docs/superpowers/specs/2026-08-03-github-picks-open-source-intelligence-design.md docs/superpowers/plans/2026-08-03-github-picks-daily-mvp.md
git commit -m "feat: define GitHub Picks daily MVP contracts"
```

Expected: focused test and full check pass; commit contains the plan, explicit decision and stable contracts.

---

### Task 2: Add Multi-Source Candidate Discovery and Immutable Raw Storage

**Files:**
- Create: `workers/daily/package.json`
- Create: `workers/daily/tsconfig.json`
- Create: `workers/daily/src/http.ts`
- Create: `workers/daily/src/raw-store.ts`
- Create: `workers/daily/src/repository-id.ts`
- Create: `workers/daily/src/discovery.ts`
- Create: `workers/daily/src/sources/github-trending.ts`
- Create: `workers/daily/src/sources/github-search.ts`
- Create: `workers/daily/src/sources/gittrend.ts`
- Create: `workers/daily/src/sources/hublens.ts`
- Create: `workers/daily/src/sources/hacker-news.ts`
- Create: `workers/daily/test/discovery.test.ts`
- Create: `workers/daily/test/raw-store.test.ts`
- Create: `workers/daily/test/fixtures/github-trending.html`
- Create: `workers/daily/test/fixtures/github-search.json`
- Create: `workers/daily/test/fixtures/gittrend.json`
- Create: `workers/daily/test/fixtures/hublens.json`
- Create: `workers/daily/test/fixtures/hacker-news.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `CandidateSignalSchema`, `PicksConfig` and source metadata from Task 1.
- Produces: five `DiscoveryAdapter` implementations, `discoverCandidates()`, `normalizeRepositoryId()`, `FileRawStore`.

- [x] **Step 1: Write failing parser, deduplication and raw-store tests**

Tests must prove that:

```ts
expect(parseGitHubTrending(html, observedAt)[0]?.fullName).toBe("openai/codex");
expect(parseGitTrend(json, observedAt)[0]?.metrics.starVelocity).toBe(2523);
expect(parseHubLens(json, observedAt)[0]?.stale).toBe(true);
expect(parseHackerNews(json, observedAt)[0]?.fullName).toBe("mdp/driftty");
expect(normalizeRepositoryId("https://github.com/OpenAI/Codex.git")).toBe("openai/codex");
expect(merged.find((item) => item.fullName === "openai/codex")?.signals).toHaveLength(3);
expect(first.objectRef).toBe(second.objectRef);
```

The last assertion stores identical raw bytes twice and proves content-addressed idempotency.

- [x] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter @github-picks/daily test -- discovery.test.ts raw-store.test.ts`

Expected: FAIL because the worker package and adapters do not exist.

- [x] **Step 3: Implement polite HTTP and raw snapshots**

`requestArtifact()` must use `AbortSignal.timeout(15_000)`, `github-picks/0.1 (+https://github.com/AICode-Nexus/github-picks)` as User-Agent, two retries for 429/5xx with bounded jitter, and return only allow-listed response metadata. `FileRawStore.put()` must compute SHA-256 over bytes and write `raw/<sourceId>/<sha256>.bin` plus a JSON metadata sidecar using exclusive creation; an existing object is reused and never overwritten.

- [x] **Step 4: Implement all five discovery adapters and merge policy**

- GitHub Trending parses repository links from `article.Box-row`.
- GitHub Search runs one configured query per direction and assigns the query direction.
- GitTrend reads `data[].fullName`, `starsToday` and `trendingScore`.
- HubLens reads `repo_url`, bilingual summary, rank and `updated_at`; records `stale: true` when older than 48 hours.
- Hacker News Algolia reads direct GitHub repository URLs, points and comments.
- `discoverCandidates()` uses lower-case `owner/name` only as a temporary dedupe key, merges signals without treating GitHub-derived products as independent sources, keeps best source rank, enforces five-direction seeding and returns at most `candidateLimit` items.
- A failed adapter becomes `degraded` with its error class; other adapters continue.

- [x] **Step 5: Run tests, format, verify and commit**

Run:

```bash
pnpm install
pnpm --filter @github-picks/daily test -- discovery.test.ts raw-store.test.ts
pnpm format
pnpm check
git add .gitignore package.json pnpm-lock.yaml workers/daily
git commit -m "feat: discover GitHub candidates from multiple sources"
```

Expected: deterministic fixture parsing, dedupe and immutable-store tests pass.

---

### Task 3: Enrich Candidates with GitHub Facts and OpenSSF Evidence

**Files:**
- Create: `workers/daily/src/github.ts`
- Create: `workers/daily/src/scorecard.ts`
- Create: `workers/daily/src/enrichment.ts`
- Create: `workers/daily/test/enrichment.test.ts`
- Create: `workers/daily/test/fixtures/github-repository.json`
- Create: `workers/daily/test/fixtures/github-events.json`
- Create: `workers/daily/test/fixtures/scorecard.json`

**Interfaces:**
- Consumes: merged candidate signals, `requestArtifact()` and `FileRawStore`.
- Produces: `GitHubEnricher.enrich(fullName, context)`, `ScorecardEnricher.enrich(fullName, context)`, `enrichCandidate()`.

- [ ] **Step 1: Write failing enrichment tests**

Tests must prove the output carries the immutable GitHub `node_id`, repository alias, owner type, timestamps, license, topics, counts, archived state and event-window features. Event parsing must produce unique active days, unique human actors, Push/PullRequest/Issues/Release counts and ignore actors ending in `[bot]`. A missing Scorecard response must add `scorecard` to `missingFields` without setting its score to zero.

- [ ] **Step 2: Run focused test and verify RED**

Run: `pnpm --filter @github-picks/daily test -- enrichment.test.ts`

Expected: FAIL because enrichment modules do not exist.

- [ ] **Step 3: Implement GitHub REST enrichment**

For each selected candidate fetch exactly:

```text
GET https://api.github.com/repos/{owner}/{repo}
GET https://api.github.com/repos/{owner}/{repo}/events?per_page=100
```

Use `application/vnd.github+json`, API version `2022-11-28`, optional Bearer auth, and do not log the token. Derive event features for the 7- and 30-day windows relative to the requested report date. Use `node_id` as permanent identity; preserve current `full_name` as an alias. A 404 marks the candidate invalid; 403/429 degrades the candidate and lowers confidence instead of inventing facts.

- [ ] **Step 4: Implement OpenSSF Scorecard enrichment**

Fetch `https://api.securityscorecards.dev/projects/github.com/{owner}/{repo}` for candidates selected for full enrichment. Preserve aggregate score, check names/scores and date as evidence. A 404, timeout or rate limit becomes `missingFields: ["scorecard"]`; it is not a negative security finding.

- [ ] **Step 5: Run tests, format, verify and commit**

Run:

```bash
pnpm --filter @github-picks/daily test -- enrichment.test.ts
pnpm format
pnpm check
git add workers/daily
git commit -m "feat: enrich candidates with repository evidence"
```

Expected: enrichment and all existing tests pass.

---

### Task 4: Implement Explainable Scoring, Risk and Rankings

**Files:**
- Create: `packages/picks-core/src/math.ts`
- Create: `packages/picks-core/src/scoring.ts`
- Create: `packages/picks-core/src/ranking.ts`
- Create: `packages/picks-core/src/analysis.ts`
- Create: `packages/picks-core/test/scoring.test.ts`
- Create: `packages/picks-core/test/ranking.test.ts`
- Create: `packages/picks-core/test/analysis.test.ts`
- Modify: `packages/picks-core/src/index.ts`

**Interfaces:**
- Consumes: `RepositorySnapshot`, candidate signals and `PicksConfig`.
- Produces: `scoreRepository()`, `buildRankings()`, `analyzeRepository()`.

- [ ] **Step 1: Write failing scoring invariant tests**

Tests must include these behavioral proofs:

```ts
expect(sumDimensionWeights(config)).toBe(100);
expect(scoreContribution("adoption.starStock", 100, config)).toBeLessThanOrEqual(1.5);
expect(scoreContribution("momentum.starVelocity", 100, config)).toBeLessThanOrEqual(3);
expect(addOnlyStars(base, 1_000_000).dimensions.engineering).toBe(base.dimensions.engineering);
expect(addOnlyStars(base, 1_000_000).dimensions.organization).toBe(base.dimensions.organization);
expect(scoreRepository(archivedHugeRepo, config).eligibility).toBe("excluded");
expect(scoreRepository(activeSmallRepo, config).publishedScore).toBeGreaterThan(
  scoreRepository(inactiveLargeRepo, config).publishedScore,
);
expect(scoreRepository(missingScorecardRepo, config).riskPenalty).toBe(0);
expect(scoreRepository(noLicenseRepo, config).riskPenalty).toBe(6);
```

- [ ] **Step 2: Run scoring tests and verify RED**

Run: `pnpm --filter @github-picks/core test -- scoring.test.ts`

Expected: FAIL because scoring functions do not exist.

- [ ] **Step 3: Implement deterministic feature scoring**

Use bounded `0..100` feature transforms and retain every feature value plus evidence IDs. Unknown features use prior 50 and reduce confidence. The first scoring version must:

- derive Utility from problem description, homepage/topics, release evidence and independent discovery;
- derive Activity from active days, human actors, event diversity and push recency;
- derive Organization from owner identity plus sustained, multi-person maintenance evidence, with a 50 prior for new or personal maintainers;
- derive Engineering from releases, contribution activity, license and Scorecard checks;
- derive Adoption from forks, actors, discussions and Star stock at 15% of that dimension only;
- derive Momentum from source rank, fresh non-GitHub discussion, recent release and Star velocity at 30% of that dimension only;
- derive Security from license and Scorecard evidence, while missing Scorecard remains prior/missing;
- derive Innovation conservatively from project age, recent release and cross-source technical novelty signals.

Compute:

```ts
baseScore = weightedDimensionMean;
publishedScore = clamp(50 + confidence * (baseScore - 50) - riskPenalty, 0, 100);
```

Round only the public values to one decimal. Preserve raw precision internally.

- [ ] **Step 4: Write failing ranking and Chinese-analysis tests**

Prove that archived/quarantined items are absent from normal lists, one organization contributes at most two repositories to the overall list, all five populated directions get a direction list, and Chinese analysis contains “值得关注”“适合”“风险”“下一步” plus evidence URLs rather than unsupported superlatives.

- [ ] **Step 5: Implement rankings and deterministic analysis**

Produce `overall`、`rising`、`newProjects`、`hiddenGems`、`active` and `byDirection`. Use independent sort formulas from the main specification, stable tie-breaking by lower-case full name, confidence thresholds, organization diversity and direction quotas. `analyzeRepository()` must name the top two score drivers, state missing evidence, list concrete risk findings and recommend `试用`、`对比`、`观察` or `暂缓` based on eligibility, confidence and risk.

- [ ] **Step 6: Run tests, format, verify and commit**

Run:

```bash
pnpm --filter @github-picks/core test
pnpm format
pnpm check
git add packages/picks-core
git commit -m "feat: score and rank repositories with evidence"
```

Expected: all invariants, ranking rules and Chinese-analysis tests pass.

---

### Task 5: Add the Daily Pipeline, JSON/Markdown Artifacts and CLI

**Files:**
- Create: `packages/picks-core/src/report.ts`
- Create: `packages/picks-core/test/report.test.ts`
- Create: `workers/daily/src/pipeline.ts`
- Create: `workers/daily/src/cli-paths.ts`
- Create: `workers/daily/src/cli.ts`
- Create: `workers/daily/test/pipeline.test.ts`
- Create: `workers/daily/test/cli-paths.test.ts`
- Create: `workers/daily/test/fixtures/replay-manifest.json`
- Modify: `packages/picks-core/src/index.ts`
- Modify: `workers/daily/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: discovery, enrichment, scoring, ranking, analysis and raw storage.
- Produces: `runDailyPipeline()` and root command `pnpm picks:daily`.

- [ ] **Step 1: Write failing report and pipeline tests**

The fixture replay must generate a schema-valid `DailyReport` containing five directions, at least one degraded source, score/evidence references and Chinese analysis. Markdown must begin with `# GitHub Picks Daily · YYYY-MM-DD`, state that the score is experimental, include source health, all non-empty lists, risk/confidence labels and evidence links.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter @github-picks/daily test -- pipeline.test.ts && pnpm --filter @github-picks/core test -- report.test.ts`

Expected: FAIL because pipeline and report rendering do not exist.

- [ ] **Step 3: Implement replayable pipeline and atomic artifacts**

`runDailyPipeline()` accepts `mode: "live" | "replay"`, report date, config path, output directory, raw directory, optional GitHub token and injected adapters for tests. It must:

1. discover and deduplicate candidates;
2. select candidates with per-direction minimums before global rank;
3. enrich with bounded concurrency `2`;
4. score, rank and analyze only schema-valid snapshots;
5. validate the final report before writing;
6. write a temporary sibling file and rename atomically to `report.json` and `report.md`;
7. write `manifest.json` with config hash, raw object refs, source states and counts.

Replay mode reads fixture responses and performs zero network calls.

- [ ] **Step 4: Implement CLI and root command**

Supported arguments:

```text
pnpm picks:daily --date 2026-08-03 --mode live
pnpm picks:daily --date 2026-08-03 --mode replay
```

The default date is today in `Asia/Shanghai`, default mode is `live`, default output is `artifacts/daily/<date>`, and paths resolve from the repository root even though pnpm changes package working directory. Exit `0` on a valid report, `1` on invalid arguments or fatal pipeline failure. Print only date, candidate/enriched/published counts, degraded sources and artifact paths.

- [ ] **Step 5: Run tests, format, verify and commit**

Run:

```bash
pnpm --filter @github-picks/core test -- report.test.ts
pnpm --filter @github-picks/daily test -- pipeline.test.ts cli-paths.test.ts
pnpm picks:daily --date 2026-08-03 --mode replay
pnpm format
pnpm check
git add package.json pnpm-lock.yaml packages/picks-core workers/daily artifacts/daily/2026-08-03
git commit -m "feat: generate replayable GitHub Picks daily reports"
```

Expected: replay creates deterministic JSON, Markdown and manifest artifacts without network.

---

### Task 6: Run the First Live Daily Report and Document Operations

**Files:**
- Create: `docs/runbooks/daily-pipeline.md`
- Create: `docs/research/daily/2026-08-03-first-live-run.md`
- Create: `artifacts/daily/2026-08-03-live/report.json`
- Create: `artifacts/daily/2026-08-03-live/report.md`
- Create: `artifacts/daily/2026-08-03-live/manifest.json`
- Modify: `README.md` if present; otherwise create it.

**Interfaces:**
- Consumes: the complete daily CLI.
- Produces: first reproducible live report and operator instructions.

- [ ] **Step 1: Run the live pipeline**

Run:

```bash
pnpm picks:daily --date 2026-08-03 --mode live --output artifacts/daily/2026-08-03-live
```

Expected: at least two discovery sources succeed, at least ten candidates are enriched, at least five publishable repositories are produced, and missing/degraded sources are explicit rather than silently discarded.

- [ ] **Step 2: Validate generated artifacts**

Run an acceptance script or inline Node check that parses `report.json` through `DailyReportSchema`, verifies the eight weights, checks every public item has GitHub evidence and confirms no archived item appears in the overall list. Open `report.md` and manually inspect that the Chinese summary names evidence gaps and does not claim missing facts.

- [ ] **Step 3: Document credentials, quotas and recovery**

The runbook must document no-token and token modes, source endpoints, rate-limit behavior, raw snapshot layout, replay command, atomic-write recovery, rerun idempotency and the fact that HubLens stale data is discovery-only. README must identify this as an independent unofficial project and show the three commands: install, replay demo, live daily run.

- [ ] **Step 4: Run final verification and commit**

Run:

```bash
pnpm format
TURBO_FORCE=true pnpm check
pnpm picks:daily --date 2026-08-03 --mode replay
git status --short
git diff --check
git add README.md docs/runbooks/daily-pipeline.md docs/research/daily/2026-08-03-first-live-run.md artifacts/daily/2026-08-03-live
git commit -m "research: publish first GitHub Picks daily report"
```

Expected: all tests pass uncached, replay is deterministic, worktree is clean after commit.

- [ ] **Step 5: Push the implementation branch**

Run: `git push -u origin codex/github-picks-mvp`

Expected: remote branch exists and contains the complete Daily MVP without merging to `master`.

---

## Self-Review Record

- **Spec coverage:** 本计划只覆盖稳定采集、初版分析和榜单纵向闭环；网站、Obsidian 和 Agent 明确留给各自独立计划，不在本里程碑假装完成。
- **M0 truthfulness:** Day 1 证据保留，M0 evaluator 仍是 `INSUFFICIENT_EVIDENCE`；用户决策作为单独产品决策记录。
- **Type consistency:** `CandidateSignal → RepositorySnapshot → RepositoryScore → ScoredRepository → DailyReport` 是唯一流水线；网站后续只读取 `DailyReport`。
- **Failure semantics:** 信源故障、数据缺失、负面事实和项目风险使用不同字段；任一发现源失败不阻断整个日报。
- **No placeholder scan:** 计划没有 TBD、TODO 或依赖未定义的“以后补充”步骤；后续子系统通过独立计划推进。
