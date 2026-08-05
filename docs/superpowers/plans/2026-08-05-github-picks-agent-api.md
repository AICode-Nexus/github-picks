# GitHub Picks Agent And Public API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a versioned anonymous GitHub Picks JSON API from the existing static build and ship a validated `github-picks` Agent Skill that answers Chinese repository intelligence questions from that API.

**Architecture:** The implementation validates repository `DailyReport` files once, projects them into a raw-reference-free `PublicDailyReport`, and deterministically writes API documents into `apps/web/out/api/v1` after Next.js export. The Agent Skill follows an AI HOT-style routing and error contract, reads only those public endpoints, and performs transparent order-preserving filters rather than rescoring repositories.

**Tech Stack:** TypeScript 7, Zod 4, Vitest 4, Next.js 16 static export, pnpm 11, Agent Skills (`SKILL.md` plus `agents/openai.yaml`), GitHub Pages.

## Global Constraints

- `DailyReport` remains the sole fact store; do not change collection, scoring, AI analysis, or ranking semantics.
- Publish only the newest `mode: "live"` report per date; never publish replay reports.
- Remove every `rawObjectRef` from public documents while preserving evidence URLs and provenance.
- Public rankings preserve source order. Personalization filters that order and never creates a new score.
- The production API base is `https://aicode-nexus.github.io/github-picks/api/v1` and requires no key, cookie, account, or private data.
- Static output must not contain credentials, absolute local paths, raw artifacts, model reasoning, or uncommitted data.
- Use test-first RED/GREEN cycles for each production behavior.
- Node.js stays at `24.15.x`; pnpm stays at `11.18.0`; use existing dependency versions (`zod@4.4.3`, `tsx@4.23.5`).
- The final integration target is `master`, explicitly authorized by the user; push and verify the GitHub Pages deployment after merged-result gates pass.

---

### Task 1: Define The Public Report Projection

**Files:**
- Create: `apps/web/src/lib/public-api.ts`
- Create: `apps/web/test/public-api.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `DailyReport`, `DailyReportSchema`, `EvidenceSchema`, `CandidateSignalSchema`, `RepositorySnapshotSchema`, `ScoredRepositorySchema` from `@github-picks/core/schema`.
- Produces: `PublicDailyReportSchema`, `PublicDailyReport`, `toPublicDailyReport(report)`, `normalizePublicBaseUrl(value)`.

- [ ] **Step 1: Add direct runtime and CLI dependencies to the web package**

Use the existing locked versions:

```json
{
  "dependencies": {
    "zod": "4.4.3"
  },
  "devDependencies": {
    "tsx": "4.23.5"
  }
}
```

Run `pnpm install --lockfile-only` so the workspace importer records both direct dependencies without changing unrelated versions.

- [ ] **Step 2: Write failing projection tests**

Add tests based on `artifacts/daily/2026-08-05/report.json`:

```ts
it("projects a live report without raw object references", () => {
  const projected = toPublicDailyReport(fixture);
  expect(PublicDailyReportSchema.parse(projected).date).toBe("2026-08-05");
  expect(JSON.stringify(projected)).not.toContain("rawObjectRef");
  expect(projected.repositories[0]?.snapshot.evidence[0]?.evidenceUrl).toMatch(
    /^https:/,
  );
});

it("rejects replay reports", () => {
  expect(() =>
    toPublicDailyReport({ ...fixture, mode: "replay" }),
  ).toThrow("only live DailyReport");
});

it.each([
  "file:///tmp/github-picks",
  "https://user:secret@example.com/github-picks",
  "https://example.com/github-picks?preview=1",
])("rejects unsafe public base URL %s", (value) => {
  expect(() => normalizePublicBaseUrl(value)).toThrow("public base URL");
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @github-picks/web test -- public-api.test.ts
```

Expected: FAIL because `../src/lib/public-api` does not exist.

- [ ] **Step 4: Implement strict public schemas and projection**

Build the schemas from the existing component schemas, replacing only nested arrays that contain raw references:

```ts
export const PublicEvidenceSchema = EvidenceSchema.omit({ rawObjectRef: true });
export const PublicCandidateSignalSchema = CandidateSignalSchema.omit({
  rawObjectRef: true,
});
export const PublicRepositorySnapshotSchema = RepositorySnapshotSchema.extend({
  candidateSignals: z.array(PublicCandidateSignalSchema),
  evidence: z.array(PublicEvidenceSchema),
});
export const PublicScoredRepositorySchema = ScoredRepositorySchema.extend({
  snapshot: PublicRepositorySnapshotSchema,
});
export const PublicDailyReportSchema = DailyReportSchema.extend({
  mode: z.literal("live"),
  repositories: z.array(PublicScoredRepositorySchema),
});
```

`toPublicDailyReport()` must parse the source with `DailyReportSchema`, reject replay, map each signal and evidence object with object rest destructuring, and finish by parsing with `PublicDailyReportSchema`. `normalizePublicBaseUrl()` must accept absolute HTTPS URLs, plus HTTP only for `localhost`, strip one trailing slash, and reject credentials, query strings, fragments, or non-HTTP protocols.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm --filter @github-picks/web test -- public-api.test.ts
```

Expected: all public projection tests PASS.

- [ ] **Step 6: Commit the projection**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/lib/public-api.ts apps/web/test/public-api.test.ts
git commit -m "feat(web): define public report API contract"
```

---

### Task 2: Generate The Complete Static v1 API

**Files:**
- Modify: `apps/web/src/lib/public-api.ts`
- Modify: `apps/web/test/public-api.test.ts`
- Create: `apps/web/scripts/generate-public-api.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`

**Interfaces:**
- Consumes: unique chronological live reports from `getLiveReportHistory()`, `buildPeriodRanking()`, `buildReportArchive()`, `RANKING_PERIOD_IDS`, `DIRECTION_IDS`, `DIRECTION_META`.
- Produces: `buildPublicApiDocuments(reports, options): PublicApiDocument[]`, `writePublicApi(outputRoot, documents): Promise<void>`, and the `generate-public-api.ts` CLI.

- [ ] **Step 1: Write failing document-set tests**

Add a two-date fixture with a newer live report and one replay report. Assert the complete path set and representative contracts:

```ts
const documents = buildPublicApiDocuments(reports, {
  publicBaseUrl: "https://example.test/github-picks",
});
const paths = documents.map((document) => document.path);

expect(paths).toContain("api/v1/meta.json");
expect(paths).toContain("api/v1/reports/latest.json");
expect(paths).toContain("api/v1/reports/2026-08-05.json");
expect(paths).toContain("api/v1/rankings/30d.json");
expect(paths).toContain("api/v1/directions/security-supply-chain.json");
expect(paths).toContain("api/v1/repositories/midspiral/lemmascript.json");
expect(documents.some((item) => item.path.includes("replay"))).toBe(false);
```

Parse JSON bodies and prove:

- `schemaVersion` is `1`;
- meta dates are newest-first and latest points at 2026-08-05;
- the latest report is live and contains no `rawObjectRef`;
- the 30-day response preserves coverage and item order from `buildPeriodRanking()`;
- direction items preserve `rankings.byDirection` order;
- repository observations are chronological, omit missing dates, and report all six rank positions as number or `null`;
- all `links.self`, `links.website`, repository site links, and API links use the supplied base URL;
- paths are unique and deterministic across two calls.

- [ ] **Step 2: Run the document tests and verify RED**

Run:

```bash
pnpm --filter @github-picks/web test -- public-api.test.ts
```

Expected: FAIL because document generation and writing functions are absent.

- [ ] **Step 3: Implement the common envelope and projections**

Use focused helpers:

```ts
export interface PublicApiDocument {
  path: string;
  body: string;
}

function envelope<T>(
  generatedAt: string,
  data: T,
  links: Record<string, string | null>,
  publicBaseUrl: string,
): PublicApiEnvelope<T>;

function rankOf(items: readonly string[], repositoryId: string): number | null;
function repositorySiteUrl(baseUrl: string, fullName: string): string;
function apiUrl(baseUrl: string, relativePath: string): string;
function serializeDocument(value: unknown): string;
```

`buildPublicApiDocuments()` must:

1. parse, deduplicate and sort live reports by date and `generatedAt`;
2. throw when no live report exists;
3. create meta and newest-first report index documents;
4. create latest plus every exact-date report with real adjacent links;
5. call the existing period function for `7d`, `30d`, `90d`, and `180d`;
6. create all five latest direction documents in published order;
7. group repository occurrences case-insensitively and create one normalized detail path per repository;
8. sort final documents by path and reject duplicate paths.

The rank observation shape is exact:

```ts
interface PublicRepositoryRanks {
  overall: number | null;
  rising: number | null;
  newProjects: number | null;
  hiddenGems: number | null;
  active: number | null;
  direction: number | null;
}
```

- [ ] **Step 4: Write failing filesystem tests**

Use a temporary output root and assert:

```ts
await writePublicApi(outputRoot, documents);
expect(
  JSON.parse(await readFile(join(outputRoot, "api/v1/meta.json"), "utf8")),
).toMatchObject({ schemaVersion: 1 });
```

Also write an existing stale `api/v1/stale.json`, run the writer, and prove it is removed. Pass a document path outside `api/v1/` and prove the writer rejects it without deleting unrelated files next to the API directory.

- [ ] **Step 5: Run the writer tests and verify RED**

Run the same focused test command. Expected: the new filesystem tests FAIL because `writePublicApi()` is absent.

- [ ] **Step 6: Implement transactional output and CLI integration**

`writePublicApi()` validates every document path before writing, creates a sibling temporary directory, writes every JSON file under it, removes only the exact `<outputRoot>/api/v1` target, renames the completed staged directory into place, and cleans its own temporary directory on failure.

The CLI is intentionally thin:

```ts
const reports = await getLiveReportHistory();
const documents = buildPublicApiDocuments(reports, {
  publicBaseUrl:
    process.env.GITHUB_PICKS_PUBLIC_BASE_URL ??
    "https://aicode-nexus.github.io/github-picks",
});
await writePublicApi(resolve(process.cwd(), "out"), documents);
console.log(`Generated ${documents.length} public API documents.`);
```

Update web scripts and type coverage:

```json
{
  "scripts": {
    "build": "next build && tsx scripts/generate-public-api.ts",
    "api:generate": "tsx scripts/generate-public-api.ts"
  }
}
```

Add `scripts/**/*.ts` to `apps/web/tsconfig.json`.

- [ ] **Step 7: Run focused tests, typecheck, and a production build**

Run:

```bash
pnpm --filter @github-picks/web test -- public-api.test.ts
pnpm --filter @github-picks/web typecheck
GITHUB_PICKS_PUBLIC_BASE_URL=https://aicode-nexus.github.io/github-picks NEXT_PUBLIC_BASE_PATH=/github-picks pnpm --filter @github-picks/web build
```

Expected: tests and typecheck PASS; the build reports the generated document count and `apps/web/out/api/v1/meta.json` exists.

- [ ] **Step 8: Commit static API generation**

```bash
git add apps/web/src/lib/public-api.ts apps/web/test/public-api.test.ts apps/web/scripts/generate-public-api.ts apps/web/package.json apps/web/tsconfig.json
git commit -m "feat(web): publish static GitHub Picks API"
```

---

### Task 3: Ship And Validate The GitHub Picks Agent Skill

**Files:**
- Create: `.agents/skills/github-picks/SKILL.md`
- Create: `.agents/skills/github-picks/agents/openai.yaml`
- Create: `.agents/skills/github-picks/references/api.md`
- Create: `.agents/skills/github-picks/references/errors.md`
- Create: `.agents/skills/github-picks/evals/evals.json`
- Create: `apps/web/test/agent-skill.test.ts`

**Interfaces:**
- Consumes: public API v1 endpoints and their response fields from Task 2.
- Produces: an installable `github-picks` Skill with deterministic routing, safety, output, and recovery contracts.

- [ ] **Step 1: Write failing Skill structure tests**

The tests read files from the repository root and assert:

```ts
expect(skill).toMatch(/^---\nname: github-picks\n/m);
expect(skill).toContain("https://aicode-nexus.github.io/github-picks/api/v1");
expect(skill).toContain("只读");
expect(skill).toContain("不重新评分");
expect(skill).toContain("references/api.md");
expect(skill).toContain("references/errors.md");
expect(openaiYaml).toContain('display_name: "GitHub Picks"');
expect(openaiYaml).toContain("$github-picks");
expect(JSON.parse(evals).evals).toHaveLength(3);
```

Also assert the Skill directory contains only the five expected files, all Markdown references resolve, no file contains `/Users/`, `GITHUB_TOKEN`, `api_key`, or `cookie`, and the eval prompts cover latest, period plus direction, and missing-date recovery.

- [ ] **Step 2: Run the Skill test and verify RED**

Run:

```bash
pnpm --filter @github-picks/web test -- agent-skill.test.ts
```

Expected: FAIL because `.agents/skills/github-picks` does not exist.

- [ ] **Step 3: Draft `SKILL.md` and progressive references**

The frontmatter description must include both capability and trigger phrases:

```yaml
---
name: github-picks
description: 查询 GitHub Picks 的中文开源项目日报、最新推荐、7/30/90/180 天持续价值榜、五个技术方向榜、历史日报和已收录仓库证据。用户询问今天或最近值得关注的 GitHub 仓库、按 AI Agent/数据/应用平台/基础设施/安全方向筛选、比较已收录项目，或明确提到 GitHub Picks 时使用。必须读取 GitHub Picks 匿名只读公开 API 获取当前数据，不凭训练记忆回答最新榜单，也不重新评分。
---
```

The body must contain:

- anonymous read-only safety boundary;
- the one-entry-per-intent routing table from the design;
- minimal request and order-preserving filtering rules;
- current Shanghai date versus latest available date language;
- source-health and coverage disclosure;
- default Chinese 3-8 item output;
- explicit non-trigger boundary for generic GitHub operations and AI news;
- pointers to API and error references.

`references/api.md` documents common envelope, endpoints, data semantics, valid periods/directions, public report projection, ranks, and examples. `references/errors.md` documents timeout/5xx retry, 429, latest/meta 404, exact-date index fallback, direction/repository 404, incompatible Schema, empty filters, and degraded sources.

- [ ] **Step 4: Add OpenAI metadata and eval prompts**

Use this exact OpenAI interface:

```yaml
interface:
  display_name: "GitHub Picks"
  short_description: "查询 GitHub 每日精选、周期榜、方向榜与仓库证据"
  default_prompt: "使用 $github-picks 推荐今天最值得关注的 GitHub 开源项目。"
```

Create `evals/evals.json` with three prompts and objective expected behavior. The missing date prompt uses `2099-01-01` so the expected recovery remains deterministic.

- [ ] **Step 5: Run Skill tests and official validation tools**

Run:

```bash
pnpm --filter @github-picks/web test -- agent-skill.test.ts
python3 /Users/admin/.agents/skills/skill-creator/scripts/quick_validate.py .agents/skills/github-picks
```

Expected: structure tests PASS and validator prints a successful result.

Package to a temporary directory with `package_skill.py`, inspect the archive list, and delete only that temporary directory after verification. Do not commit generated packages.

- [ ] **Step 6: Execute behavioral evals**

Serve `apps/web/out` locally and execute the three prompts against the generated API with the Skill instructions. When independent Agent runs are available, compare one isolated with-Skill run and one isolated baseline run over the same three prompts, record objective assertions, and generate the Skill Creator review artifact. When runner capacity prevents six simultaneous runs, use one isolated with-Skill worker and one isolated baseline worker, each handling the same three cases independently, and record the limitation.

Required assertions:

- latest uses `/reports/latest.json`, gives 3-8 Chinese items, and states the actual report date;
- 30-day security query uses `/rankings/30d.json`, preserves order after direction filtering, and states actual coverage;
- missing date reads `/reports/index.json` once, lists real dates, and never substitutes a guessed report;
- no result asks for credentials, fetches raw artifacts, rescans GitHub, or invents a new score.

- [ ] **Step 7: Commit the Agent Skill**

```bash
git add .agents/skills/github-picks apps/web/test/agent-skill.test.ts
git commit -m "feat(agent): add GitHub Picks skill"
```

---

### Task 4: Wire Pages Gates And User Documentation

**Files:**
- Modify: `apps/web/test/pages-workflow.test.ts`
- Modify: `.github/workflows/pages.yml`
- Modify: `README.md`
- Create: `docs/runbooks/github-picks-agent-api.md`

**Interfaces:**
- Consumes: the build command and API paths from Tasks 2-3.
- Produces: CI artifact checks, public installation guidance, API operations and recovery runbook.

- [ ] **Step 1: Write failing workflow assertions**

Extend `pages-workflow.test.ts`:

```ts
expect(workflow).toContain(
  'GITHUB_PICKS_PUBLIC_BASE_URL: "https://aicode-nexus.github.io/github-picks"',
);
expect(workflow).toContain("test -f apps/web/out/api/v1/meta.json");
expect(workflow).toContain("test -f apps/web/out/api/v1/reports/latest.json");
expect(workflow).toContain("test -f apps/web/out/api/v1/rankings/30d.json");
expect(workflow).toContain(
  "test -f apps/web/out/api/v1/directions/security-supply-chain.json",
);
```

- [ ] **Step 2: Run the workflow test and verify RED**

Run:

```bash
pnpm --filter @github-picks/web test -- pages-workflow.test.ts
```

Expected: FAIL because the workflow does not set the public base URL or verify API files.

- [ ] **Step 3: Add the Pages environment and artifact gate**

Set `GITHUB_PICKS_PUBLIC_BASE_URL` in the build job and add one post-build shell step that verifies meta, latest, report index, all four period files, all five direction files, and at least one repository JSON selected from meta. Parse meta/latest with Node so an empty or malformed file fails before upload.

- [ ] **Step 4: Update README and write the runbook**

Replace “个性化 Agent 仍是下一阶段” with implemented scope. Add:

- API base and endpoint examples;
- Skill source path and verified install command;
- example prompts for latest, period/direction, and repository detail;
- order-preserving personalization and no-credentials boundary;
- statement that scheduling or external delivery remains separate.

The runbook covers local generation, endpoint inventory, Schema versioning, canonical URL configuration, static HTTP smoke checks, Skill validation/package commands, Pages verification, failure recovery, and the rule that replay/raw outputs never publish.

- [ ] **Step 5: Run focused tests and documentation checks**

Run:

```bash
pnpm --filter @github-picks/web test -- pages-workflow.test.ts agent-skill.test.ts
git diff --check
```

Expected: tests PASS and no whitespace errors.

- [ ] **Step 6: Commit release wiring and docs**

```bash
git add .github/workflows/pages.yml apps/web/test/pages-workflow.test.ts README.md docs/runbooks/github-picks-agent-api.md
git commit -m "docs: publish GitHub Picks agent access"
```

---

### Task 5: Full Verification, Review, Merge, Push, And Live Acceptance

**Files:**
- Verify all files from Tasks 1-4.
- Do not add unrelated changes.

**Interfaces:**
- Consumes: completed feature branch and `origin/master`.
- Produces: reviewed commits merged into `master`, remote hash parity, successful Pages deployment, and verified public API/Skill evidence.

- [ ] **Step 1: Run fresh branch gates**

Run with Node `24.15.x`:

```bash
pnpm format
TURBO_FORCE=true pnpm check
GITHUB_PICKS_PUBLIC_BASE_URL=https://aicode-nexus.github.io/github-picks NEXT_PUBLIC_BASE_PATH=/github-picks TURBO_FORCE=true pnpm build
git diff --check
```

Then serve `apps/web/out` on an unused localhost port and verify with real HTTP requests:

```text
/api/v1/meta.json
/api/v1/reports/latest.json
/api/v1/reports/2026-08-05.json
/api/v1/rankings/30d.json
/api/v1/directions/security-supply-chain.json
/api/v1/repositories/<known-owner>/<known-repo>.json
/api/v1/reports/2099-01-01.json -> 404
```

Parse successful bodies, confirm `schemaVersion=1`, confirm no `rawObjectRef` or local absolute path, and compare latest date/rank order with the committed report.

- [ ] **Step 2: Request focused code review**

Provide a reviewer the base SHA, head SHA, design spec, implementation plan, and scope: API correctness, data leakage, path traversal, ranking semantics, Skill routing/errors, tests, and Pages deployment. Fix all Critical and Important findings with regression tests and rerun affected gates.

- [ ] **Step 3: Verify final feature commit state**

Confirm the branch is clean, commits contain only intended files, no secrets or absolute local paths exist, and the feature diff matches every acceptance criterion in the design.

- [ ] **Step 4: Synchronize and merge to `master`**

Fetch `origin`, verify local `master` can fast-forward to `origin/master`, update it, and merge `codex/github-picks-agent` without force or history rewriting. The user's latest instruction preselects local merge plus remote publication, so no additional integration-choice prompt is needed.

- [ ] **Step 5: Run merged-result gates**

On `master`, rerun:

```bash
TURBO_FORCE=true pnpm check
GITHUB_PICKS_PUBLIC_BASE_URL=https://aicode-nexus.github.io/github-picks NEXT_PUBLIC_BASE_PATH=/github-picks TURBO_FORCE=true pnpm build
git diff --check
```

Do not push if any merged-result gate fails.

- [ ] **Step 6: Push and verify GitHub Pages**

Push `master`, prove `HEAD`, `origin/master`, and `git ls-remote origin refs/heads/master` are identical, wait for the corresponding Pages workflow, and require a successful deploy conclusion.

Fetch the public production endpoints listed in Step 1. Confirm HTTP 200, latest report date parity, valid JSON, expected 30-day coverage, one direction result, one repository detail, and 404 for the nonexistent date. Verify the public Skill install command in a temporary directory against the merged repository.

- [ ] **Step 7: Report exact evidence**

Report branch and merge commits, test counts, build result, API document count, Skill validation/package/eval results, remote hash parity, Pages run URL, public endpoint checks, and any residual limitation such as push scheduling remaining unconfigured.
