# GitHub Picks Daily Publishing Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a verified live GitHub Picks report at 10:00, 14:00, and 20:00 Asia/Shanghai through one local Codex automation while preserving the existing Ollama-backed AI quality boundary.

**Architecture:** Add a deterministic publication gate around the existing `DailyReport` contract, generated Markdown, and manifest, then expose it through a root command used by both operators and the automation. A single Codex heartbeat runs in a dedicated Git worktree, stages live output before promotion, commits only the three daily artifacts, pushes by fast-forward to `master`, and verifies the existing Pages deployment.

**Tech Stack:** Node.js 24.15.x, pnpm 11.18.0, TypeScript 7.0.2, Zod 4.4.3, Vitest 4.1.10, Next.js 16.3.0, GitHub CLI, Ollama 0.31.2 with `qwen3-vl:8b`, Codex heartbeat automations.

## Global Constraints

- The schedule is Asia/Shanghai every day at exactly 10:00, 14:00, and 20:00.
- Live publication requires `GITHUB_PICKS_AI_PROVIDER=ollama`, `GITHUB_PICKS_AI_MODEL=qwen3-vl:8b`, and `GITHUB_PICKS_AI_REQUIRED=true`.
- Read `GITHUB_TOKEN` from `gh auth token` into the current process only; never persist or print it.
- Keep `artifacts/raw/`, temporary output, credentials, model prompts, and local configuration out of Git.
- Commit only `artifacts/daily/YYYY-MM-DD/report.json`, `report.md`, and `manifest.json` for recurring runs.
- Never publish replay output, an AI fallback, an all-offline fact layer, a report with fewer than two healthy network discovery sources, or a report missing one of the five direction rankings.
- Never force-push, rewrite history, remove unknown files, or mix unrelated user changes into an automation commit.
- The publisher uses a dedicated ignored worktree and a `codex/`-prefixed branch; the user's primary checkout remains untouched during scheduled runs.
- Follow TDD for every code behavior: observe red, implement the minimum, observe green, then commit.
- Design reference: `docs/superpowers/specs/2026-08-05-github-picks-daily-publishing-automation-design.md`.

## File Map

- `workers/daily/src/publication-artifacts.ts`: owns the versioned manifest schema and deterministic manifest construction shared by generation and validation.
- `workers/daily/test/publication-artifacts.test.ts`: proves manifest construction and raw-reference deduplication.
- `workers/daily/src/pipeline.ts`: delegates manifest creation to the shared publication-artifact module.
- `workers/daily/src/publish-gate.ts`: owns pure report eligibility checks and three-file consistency validation.
- `workers/daily/test/publish-gate.test.ts`: proves success and each blocking publication condition.
- `workers/daily/src/publish-check.ts`: provides the operator-facing validation command and machine-readable summary.
- `package.json`: exposes `pnpm picks:publish-check` from the repository root.
- `README.md`: documents the verification command and current automatic schedule.
- `docs/runbooks/daily-pipeline.md`: documents staging, promotion, failure behavior, automation prerequisites, and recovery.
- `docs/superpowers/specs/2026-08-05-github-picks-daily-publishing-automation-design.md`: remains the approved design reference; implementation does not rewrite its historical status line.
- `artifacts/daily/2026-08-05/*`: contains the first verified live output published through the new gate.
- Codex automation `github-picks-daily-publisher`: stores the three-times-daily heartbeat outside Git and targets this task.

---

### Task 1: Centralize the daily manifest contract

**Files:**
- Create: `workers/daily/src/publication-artifacts.ts`
- Create: `workers/daily/test/publication-artifacts.test.ts`
- Modify: `workers/daily/src/pipeline.ts`
- Modify: `workers/daily/test/pipeline.test.ts`

**Interfaces:**
- Produces: `DailyManifestSchema`, `DailyManifest`, and `buildDailyManifest(report: DailyReport): DailyManifest`.
- Consumes: `DailyReport` and `SourceHealthSchema` from `@github-picks/core`.
- Preserves: the byte-level JSON shape of all existing `manifest.json` files.

- [ ] **Step 1: Write the failing manifest-contract test**

Create `workers/daily/test/publication-artifacts.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { DailyReportSchema } from "@github-picks/core";
import { describe, expect, it } from "vitest";
import {
  buildDailyManifest,
  DailyManifestSchema,
} from "../src/publication-artifacts.js";

describe("daily publication manifest", () => {
  it("rebuilds the committed live manifest and deduplicates raw refs", async () => {
    const directory = new URL(
      "../../../artifacts/daily/2026-08-04/",
      import.meta.url,
    );
    const report = DailyReportSchema.parse(
      JSON.parse(await readFile(new URL("report.json", directory), "utf8")),
    );
    const committed = DailyManifestSchema.parse(
      JSON.parse(await readFile(new URL("manifest.json", directory), "utf8")),
    );

    expect(buildDailyManifest(report)).toEqual(committed);
    expect(new Set(committed.rawObjectRefs).size).toBe(
      committed.rawObjectRefs.length,
    );
  });
});
```

- [ ] **Step 2: Run the focused test and observe red**

Run:

```bash
pnpm --filter @github-picks/daily test -- publication-artifacts.test.ts
```

Expected: FAIL because `../src/publication-artifacts.js` does not exist.

- [ ] **Step 3: Add the manifest schema and builder**

Create `workers/daily/src/publication-artifacts.ts` with a strict Zod schema for the existing fields `version`, `date`, `mode`, `generatedAt`, `scoreVersion`, optional `analysisVersion`, `configHash`, `counts`, `sourceHealth`, `rawObjectRefs`, and `repositories`. Implement `buildDailyManifest()` by moving the current `manifestFor()` raw-reference collection unchanged and parsing the result with `DailyManifestSchema`.

The exported signature must be:

```ts
export function buildDailyManifest(report: DailyReport): DailyManifest;
```

The raw-reference list must continue to use first-observation order and deduplicate with:

```ts
.filter((value, index, values) => values.indexOf(value) === index);
```

- [ ] **Step 4: Make the pipeline consume the shared builder**

In `workers/daily/src/pipeline.ts`, import `buildDailyManifest`, remove the private `manifestFor()` function, and replace:

```ts
JSON.stringify(manifestFor(report), null, 2)
```

with:

```ts
JSON.stringify(buildDailyManifest(report), null, 2)
```

Keep all atomic-write behavior unchanged. Update the existing pipeline test to parse its generated manifest with `DailyManifestSchema`.

- [ ] **Step 5: Run focused and package gates**

Run:

```bash
pnpm --filter @github-picks/daily test -- publication-artifacts.test.ts pipeline.test.ts
pnpm --filter @github-picks/daily typecheck
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit the manifest contract**

```bash
git add workers/daily/src/publication-artifacts.ts workers/daily/src/pipeline.ts workers/daily/test/publication-artifacts.test.ts workers/daily/test/pipeline.test.ts
git diff --cached --check
git commit -m "refactor(daily): centralize publication manifest"
```

### Task 2: Add the deterministic publication gate

**Files:**
- Create: `workers/daily/src/publish-gate.ts`
- Create: `workers/daily/test/publish-gate.test.ts`

**Interfaces:**
- Produces: `PublicationSummary`.
- Produces: `assertPublishableReport(report: DailyReport, expectedDate: string): PublicationSummary`.
- Produces: `validatePublicationDirectory(directory: string, expectedDate: string): Promise<PublicationSummary>`.
- Consumes: `DailyReportSchema`, `renderDailyMarkdown()`, `DailyManifestSchema`, and `buildDailyManifest()`.

- [ ] **Step 1: Write pure gate tests using the committed live report**

Create a test helper in `workers/daily/test/publish-gate.test.ts` that parses `artifacts/daily/2026-08-04/report.json`, clones it with `structuredClone()`, and passes `2026-08-04` as the expected date. Add tests with these exact assertions:

```ts
expect(assertPublishableReport(report, "2026-08-04")).toMatchObject({
  date: "2026-08-04",
  published: 20,
  aiVerified: 20,
});
expect(() =>
  assertPublishableReport(report, "2026-08-05"),
).toThrow("report date does not match expected date");
```

Add one mutation per blocking case and require these stable messages:

```text
only live reports can be published
fewer than two healthy network discovery sources
GitHub REST facts are offline or missing
direction ranking is empty: ai-agent
archived repository appears in a public ranking
public repository has no GitHub REST evidence
degraded source has no explanatory message
AI analysis is not healthy
public repository is not backed by verified AI analysis
report counts do not match repository contents
```

- [ ] **Step 2: Run the gate tests and observe red**

Run:

```bash
pnpm --filter @github-picks/daily test -- publish-gate.test.ts
```

Expected: FAIL because `../src/publish-gate.js` does not exist.

- [ ] **Step 3: Implement the pure publication assertions**

Create `workers/daily/src/publish-gate.ts` with:

```ts
const NETWORK_DISCOVERY_SOURCE_IDS = new Set([
  "github-trending",
  "github-search",
  "gittrend",
  "hublens",
  "hacker-news",
  "ai-hot",
]);

export interface PublicationSummary {
  date: string;
  generatedAt: string;
  discovered: number;
  enriched: number;
  published: number;
  aiVerified: number;
  degradedSources: string[];
}
```

Build the public repository set as the union of `overall`, `rising`, `newProjects`, `hiddenGems`, `active`, and every `byDirection` list. Validate each named repository exists before checking archived state, GitHub REST evidence, and `analysis.generation.kind === "ai" && status === "verified"`.

Count `published` from repositories whose `score.eligibility === "eligible"`; require it to equal `report.counts.published`. Require `report.counts.enriched === report.repositories.length`. Every `degraded` or `offline` source must have a non-empty message.

- [ ] **Step 4: Add three-file consistency validation**

Implement `validatePublicationDirectory()` to:

1. read and schema-parse `report.json`;
2. run `assertPublishableReport()`;
3. require `report.md === renderDailyMarkdown(report)`;
4. schema-parse `manifest.json` and require deep equality with `buildDailyManifest(report)`.

Use `isDeepStrictEqual` from `node:util` and throw these stable errors:

```text
report.md does not match report.json
manifest.json does not match report.json
```

- [ ] **Step 5: Add integration tests for valid and mismatched directories**

In the same test file, validate the committed `2026-08-04` directory successfully. Copy its three files to an `mkdtemp()` directory, replace `report.md` with `invalid\n`, and assert the Markdown mismatch error.

- [ ] **Step 6: Run focused and package gates**

Run:

```bash
pnpm --filter @github-picks/daily test -- publish-gate.test.ts
pnpm --filter @github-picks/daily test
pnpm --filter @github-picks/daily typecheck
```

Expected: all daily-worker tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit the publication gate**

```bash
git add workers/daily/src/publish-gate.ts workers/daily/test/publish-gate.test.ts
git diff --cached --check
git commit -m "feat(daily): gate live report publication"
```

### Task 3: Expose and document the operator command

**Files:**
- Create: `workers/daily/src/publish-check.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/runbooks/daily-pipeline.md`

**Interfaces:**
- Produces root command: `pnpm picks:publish-check -- <directory> <YYYY-MM-DD>`.
- Prints: date, generated time, discovery/enrichment/publication counts, verified AI count, and degraded sources.
- Exits nonzero without modifying files when validation fails.

- [ ] **Step 1: Add the CLI entry point**

Create `workers/daily/src/publish-check.ts`:

```ts
import { resolve } from "node:path";
import { validatePublicationDirectory } from "./publish-gate.js";

try {
  const [directory, expectedDate, ...rest] = process.argv.slice(2);
  if (!directory || !expectedDate || rest.length > 0) {
    throw new Error(
      "usage: picks:publish-check -- <directory> <YYYY-MM-DD>",
    );
  }
  const summary = await validatePublicationDirectory(
    resolve(process.cwd(), directory),
    expectedDate,
  );
  process.stdout.write(
    `${[
      `date=${summary.date}`,
      `generatedAt=${summary.generatedAt}`,
      `discovered=${summary.discovered}`,
      `enriched=${summary.enriched}`,
      `published=${summary.published}`,
      `aiVerified=${summary.aiVerified}`,
      `degraded=${summary.degradedSources.join(",") || "none"}`,
    ].join("\n")}\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`PublicationGateError: ${message}\n`);
  process.exitCode = 1;
}
```

- [ ] **Step 2: Add the root package command**

Add to `package.json` scripts:

```json
"picks:publish-check": "tsx workers/daily/src/publish-check.ts"
```

- [ ] **Step 3: Document staging, validation, and the schedule**

Update `README.md` and `docs/runbooks/daily-pipeline.md` with the exact operator flow:

```bash
daily_stage_dir="$(mktemp -d)"
GITHUB_TOKEN="$(gh auth token)" \
GITHUB_PICKS_AI_PROVIDER=ollama \
GITHUB_PICKS_AI_MODEL=qwen3-vl:8b \
GITHUB_PICKS_AI_REQUIRED=true \
pnpm picks:daily --date 2026-08-05 --mode live --output "$daily_stage_dir"
pnpm picks:publish-check -- "$daily_stage_dir" 2026-08-05
```

Document that the Codex heartbeat runs at 10:00, 14:00, and 20:00 Asia/Shanghai, requires the machine and Ollama to be available, does not backfill missed observations, and never promotes failed staging output.

- [ ] **Step 4: Format and run the full repository gate**

Run:

```bash
pnpm format
TURBO_FORCE=true pnpm check
pnpm --filter @github-picks/web build
git diff --check
```

Expected: formatter exits 0, all typechecks/tests pass, the production static export succeeds, and Git reports no whitespace errors.

- [ ] **Step 5: Commit the command and runbook**

```bash
git add package.json workers/daily/src/publish-check.ts README.md docs/runbooks/daily-pipeline.md
git diff --cached --check
git commit -m "feat: automate verified daily publication"
```

### Task 4: Publish 2026-08-05 and activate the recurring automation

**Files and state:**
- Create: `artifacts/daily/2026-08-05/report.json`
- Create: `artifacts/daily/2026-08-05/report.md`
- Create: `artifacts/daily/2026-08-05/manifest.json`
- Create local worktree: `.worktrees/daily-publisher`
- Create local branch: `codex/daily-publisher`
- Create Codex heartbeat: `github-picks-daily-publisher`
- Push and merge: `codex/daily-publishing-automation` into `master`

**Interfaces:**
- Consumes: `pnpm picks:daily`, `pnpm picks:publish-check`, GitHub CLI auth, and local Ollama.
- Produces: one verified live report, one merged implementation, one active three-times-daily heartbeat, and one successful Pages deployment.

- [ ] **Step 1: Generate the live report into an isolated directory**

Create a task-specific temporary directory with `mktemp -d`, then run:

```bash
daily_stage_dir="$(mktemp -d)"
GITHUB_TOKEN="$(gh auth token)" \
GITHUB_PICKS_AI_PROVIDER=ollama \
GITHUB_PICKS_AI_BASE_URL=http://127.0.0.1:11434 \
GITHUB_PICKS_AI_MODEL=qwen3-vl:8b \
GITHUB_PICKS_AI_REQUIRED=true \
pnpm picks:daily --date 2026-08-05 --mode live --output "$daily_stage_dir"
pnpm picks:publish-check -- "$daily_stage_dir" 2026-08-05
```

Expected: `mode=live`, at least two healthy network discovery sources, five non-empty direction rankings, and all public AI analyses verified. Do not promote the directory if either command exits nonzero.

- [ ] **Step 2: Promote only the validated three-file set**

Create `artifacts/daily/2026-08-05/` and copy exactly `report.json`, `report.md`, and `manifest.json` from the staging directory. Then run:

```bash
pnpm picks:publish-check -- artifacts/daily/2026-08-05 2026-08-05
pnpm --filter @github-picks/web build
git diff --check
```

Expected: publication validation and the production build exit 0.

- [ ] **Step 3: Commit the live report separately**

```bash
git add artifacts/daily/2026-08-05/report.json artifacts/daily/2026-08-05/report.md artifacts/daily/2026-08-05/manifest.json
git diff --cached --check
git commit -m "data: publish GitHub Picks daily report 2026-08-05"
```

- [ ] **Step 4: Push, create the PR, wait for checks, and merge**

```bash
git push -u origin codex/daily-publishing-automation
gh pr create --base master --head codex/daily-publishing-automation --title "Automate verified GitHub Picks daily publication" --body "Adds a deterministic live-report publication gate, publishes the verified 2026-08-05 report, and documents the local three-times-daily Codex automation. Verification: TURBO_FORCE=true pnpm check; pnpm --filter @github-picks/web build; pnpm picks:publish-check."
gh pr checks --watch codex/daily-publishing-automation
gh pr merge codex/daily-publishing-automation --merge --delete-branch
```

After merge, switch the primary checkout to `master`, run `git pull --ff-only`, and prove local `HEAD`, `origin/master`, and `git ls-remote origin refs/heads/master` are identical.

- [ ] **Step 5: Create the isolated publisher worktree**

From the clean, synchronized primary checkout:

```bash
git worktree add .worktrees/daily-publisher -b codex/daily-publisher origin/master
```

The automation prompt must require a clean publisher worktree, `git fetch origin master`, and `git merge --ff-only origin/master` before each run. It must use a staging directory, execute both publication gates, commit only the exact date directory, push with `git push origin HEAD:master`, wait for the Pages run associated with the pushed SHA, and report all required counts and URLs. It must stop on any unknown dirty file or non-fast-forward push.

- [ ] **Step 6: Create one active heartbeat with all three times**

Use the Codex automation API to create:

```text
id: github-picks-daily-publisher
kind: heartbeat
name: GitHub Picks 每日三次真实发布
status: ACTIVE
schedule: Asia/Shanghai every day at 10:00, 14:00, and 20:00
target: current task
```

Keep notification preferences out of the prompt. The prompt must be self-contained and include the fixed repository/worktree path, environment checks, staging and promotion flow, exact Git scope, Pages verification, no-backfill rule, and concise success/failure report contract.

Use this prompt verbatim when creating the heartbeat:

```text
在 /Users/admin/Documents/github 每日推荐/.worktrees/daily-publisher 自动发布 GitHub Picks 真实日报。只处理触发时的北京时间当天，不补造或回填错过的历史档位。计划档位为北京时间 10:00、14:00、20:00；根据触发时间记录本次最近的计划档位。

开始前检查 worktree 的 Git 状态。除被忽略的 artifacts/raw 外，只要存在未提交或未知文件就停止并报告，不得清理或覆盖。确认当前分支为 codex/daily-publisher，运行 git fetch origin master，再用 git merge --ff-only origin/master 同步；不得 rebase、强推或改写历史。确认 gh auth status 成功、gh auth token 可读取、http://127.0.0.1:11434/api/version 可访问、ollama list 中存在 qwen3-vl:8b，并使用仓库 .nvmrc 对应的 Node.js。依赖缺失时只运行 pnpm install --frozen-lockfile。

先运行 TURBO_FORCE=true pnpm check。创建一个 mktemp -d 返回的任务专用暂存目录。通过当前进程环境变量注入 GITHUB_TOKEN="$(gh auth token)"、GITHUB_PICKS_AI_PROVIDER=ollama、GITHUB_PICKS_AI_BASE_URL=http://127.0.0.1:11434、GITHUB_PICKS_AI_MODEL=qwen3-vl:8b、GITHUB_PICKS_AI_REQUIRED=true，运行 pnpm picks:daily，以北京时间当天、mode live 和该暂存目录为 output。不得打印或持久化 Token。随后运行 pnpm picks:publish-check 校验暂存目录和当天日期；失败时保留已发布日报不变并停止。

候选产物通过后，再次 git fetch origin master；若当前分支不能 git merge --ff-only origin/master，则停止。把暂存目录中的 report.json、report.md、manifest.json 复制到 artifacts/daily/YYYY-MM-DD/，不得复制其他文件。再次运行 pnpm picks:publish-check 校验正式目录，并运行 pnpm --filter @github-picks/web build 和 git diff --check。任何一步失败都不得提交或推送。

只暂存当天 report.json、report.md、manifest.json。若三份文件没有差异，报告 no-op，不创建空提交。否则以 data: publish GitHub Picks daily report YYYY-MM-DD HHmm CST 为信息提交，再运行 git push origin HEAD:master；非快进拒绝时停止，不得强推。记录提交 SHA，等待该 SHA 对应的 Deploy GitHub Picks to Pages 工作流完成并要求 conclusion=success。随后尝试读取 https://aicode-nexus.github.io/github-picks/ 并核对页面包含当天日期；网络无法访问与页面内容不匹配必须分别如实报告，不能用 Actions 成功代替页面验证。

每次最终报告日期、计划档位、generatedAt、发现/补全/发布数量、降级信源、AI verified 数量、提交 SHA、推送结果、Pages Actions URL 和页面验证结果。失败时明确指出停止的门禁。不得修改评分、Prompt、配置、源码、README、工作流或当天三份日报之外的跟踪文件。
```

- [ ] **Step 7: Verify production and automation state**

Run fresh checks:

```bash
gh run list --workflow pages.yml --limit 5 --json status,conclusion,headSha,url
git status --short
git rev-parse HEAD
git rev-parse origin/master
git ls-remote origin refs/heads/master
```

Read the automation back through the Codex automation API and confirm `ACTIVE` plus the three intended Beijing hours. Verify the rendered Pages site exposes report date `2026-08-05`; if direct HTTP access is unavailable, report that separately instead of treating an Actions success as rendered-page proof.

- [ ] **Step 8: Close the implementation record**

Report the first report's generated time, counts, degraded sources, AI verification count, merged commit, Pages URL, automation ID, and next scheduled run. Do not create an extra post-release documentation commit solely to mark checklist state.
