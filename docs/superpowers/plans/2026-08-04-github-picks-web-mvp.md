# GitHub Picks Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade Chinese static website that turns the latest live `DailyReport` into a daily intelligence homepage, five direction pages, repository dossiers, and a source-health page.

**Architecture:** Add a Next.js App Router package at `apps/web`. Build-time server-only code discovers and validates committed daily reports through `@github-picks/core`, pure view-model functions create one presentation contract, and Server Components render static routes with `output: "export"`. GitHub Pages publishes `apps/web/out` only after changes reach `master`.

**Tech Stack:** Node.js 24.15.x, pnpm 11.18.0, TypeScript 7.0.2, Next.js 16.3.0, React 19.2.8, Vitest 4.1.10, Testing Library 16.3.2, Playwright 1.62.1, axe-core 4.12.1, CSS Modules/global CSS, GitHub Pages.

## Global Constraints

- Work only on `codex/github-picks-web-mvp`; do not merge to `master`.
- The site consumes `DailyReportSchema`; it must not duplicate collection, scoring, ranking, or analysis logic.
- Public pages must select `mode: "live"`; replay reports are test fixtures only.
- Static export is mandatory: `output: "export"`, `trailingSlash: true`, no API routes, middleware, cookies, server actions, ISR, or runtime filesystem reads.
- Initial browsing is public and login-free; no cloud bookmarks, OAuth, email, Obsidian, or Agent code.
- Visual direction is “Chinese open-source intelligence newspaper × engineering terminal,” using warm paper, ink, vermilion, and signal green—not a generic SaaS dashboard.
- Published score, confidence, and risk remain visually and semantically separate.
- Missing Scorecard is an evidence gap, not a security failure; missing license remains an explicit risk.
- All external facts link to existing evidence URLs; `artifacts/raw` and raw SHA references remain private implementation detail.
- 375px, 768px, and 1280px layouts must have no horizontal overflow; keyboard focus and reduced-motion behavior are mandatory.
- Use test-first red/green cycles for every behavior change.

---

## File Map

| Path | Responsibility |
|---|---|
| `apps/web/src/lib/report-store.ts` | Discover, parse, and select build-time daily reports |
| `apps/web/src/lib/view-model.ts` | Convert `DailyReport` data into stable display models |
| `apps/web/src/lib/site-meta.ts` | Direction, dimension, route, label, and formatter metadata |
| `apps/web/src/app/**` | Static App Router routes and metadata |
| `apps/web/src/components/**` | Stateless editorial UI components |
| `apps/web/src/styles/globals.css` | Design tokens, layout, responsive, focus, and motion rules |
| `apps/web/test/**` | Unit and rendering regression tests |
| `apps/web/e2e/**` | Browser and accessibility acceptance tests |
| `.github/workflows/pages.yml` | Build and deploy static output from `master` |
| `docs/runbooks/web-static-site.md` | Local build, data refresh, base path, and Pages recovery |

---

### Task 1: Scaffold the Static Web Package and Report Store

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `turbo.json`
- Modify: `.gitignore`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/test/report-store.test.ts`
- Create: `apps/web/src/lib/report-store.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: committed `artifacts/daily/*/report.json`, `DailyReportSchema`.
- Produces: `loadDailyReports(options?): Promise<DailyReport[]>`, `getLatestLiveReport(options?): Promise<DailyReport>`, `resolveDailyArtifactsDirectory(moduleUrl?): string`.

- [x] **Step 1: Register and configure the package**

Add `apps/*` to `pnpm-workspace.yaml`. Extend Turbo build outputs to `dist/**`, `.next/**`, and `out/**`. Ignore `.next/`, `apps/web/out/`, `playwright-report/`, and `test-results/`.

Create `apps/web/package.json` with this exact package boundary:

```json
{
  "name": "@github-picks/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --dir test",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@github-picks/core": "workspace:*",
    "lucide-react": "1.28.0",
    "next": "16.3.0",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.12.1",
    "@playwright/test": "1.62.1",
    "@testing-library/react": "16.3.2",
    "@types/node": "26.1.2",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
    "jsdom": "30.0.1",
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  }
}
```

Configure Next:

```ts
import type { NextConfig } from "next";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  transpilePackages: ["@github-picks/core"],
};

export default config;
```

Use `module: "ESNext"`, `moduleResolution: "Bundler"`, `jsx: "preserve"`, `noEmit: true`, and the Next TypeScript plugin in `apps/web/tsconfig.json`.

- [x] **Step 2: Install exact dependencies**

Run:

```bash
pnpm install
```

Expected: lockfile records the exact versions above; no unapproved package is added.

- [x] **Step 3: Write failing report-store tests**

Create tests that copy the committed replay and live reports into a temporary directory, then assert:

```ts
expect((await loadDailyReports({ rootDirectory })).map((item) => item.mode))
  .toEqual(["replay", "live"]);
expect((await getLatestLiveReport({ rootDirectory })).date).toBe("2026-08-04");
await expect(getLatestLiveReport({ rootDirectory: emptyRoot }))
  .rejects.toThrow("no live DailyReport");
await expect(loadDailyReports({ rootDirectory: invalidRoot }))
  .rejects.toThrow("invalid DailyReport");
```

The test must create a second live report with a later `generatedAt` on the same date and verify that it wins the tie.

- [x] **Step 4: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @github-picks/web test -- report-store.test.ts
```

Expected: FAIL because `report-store.ts` does not exist.

- [x] **Step 5: Implement the report store**

Use this contract:

```ts
export interface ReportStoreOptions {
  rootDirectory?: string;
}

export function resolveDailyArtifactsDirectory(
  moduleUrl = import.meta.url,
): string {
  return fileURLToPath(new URL("../../../../artifacts/daily/", moduleUrl));
}

export async function loadDailyReports(
  options: ReportStoreOptions = {},
): Promise<DailyReport[]>;

export async function getLatestLiveReport(
  options: ReportStoreOptions = {},
): Promise<DailyReport>;
```

`loadDailyReports()` must sort directory names, parse each `report.json` through `DailyReportSchema`, wrap failures as `invalid DailyReport: <path>`, and return reports sorted by date then `generatedAt`. `getLatestLiveReport()` filters to live mode and throws `no live DailyReport in <directory>` when none exists.

- [x] **Step 6: Run focused tests and typecheck**

Run:

```bash
pnpm --filter @github-picks/web test -- report-store.test.ts
pnpm --filter @github-picks/web typecheck
```

Expected: all report-store tests pass and TypeScript reports no errors.

- [x] **Step 7: Commit**

```bash
git add .gitignore pnpm-workspace.yaml turbo.json apps/web/package.json apps/web/tsconfig.json apps/web/next-env.d.ts apps/web/next.config.ts apps/web/vitest.config.ts apps/web/test/report-store.test.ts apps/web/src/lib/report-store.ts pnpm-lock.yaml
git commit -m "feat: scaffold static GitHub Picks web app"
```

---

### Task 2: Define Site Metadata and View Models

**Files:**
- Create: `apps/web/src/lib/site-meta.ts`
- Create: `apps/web/src/lib/view-model.ts`
- Create: `apps/web/test/view-model.test.ts`

**Interfaces:**
- Consumes: `DailyReport`, `ScoredRepository`, `DirectionId`, dimension keys.
- Produces: `DIRECTION_META`, `DIMENSION_META`, `RepositoryCardModel`, `RepositoryDetailModel`, `buildRepositoryIndex()`, `buildRankingItems()`, `buildDirectionSummary()`, `buildSourceSummary()`.

- [x] **Step 1: Write failing metadata and view-model tests**

The tests must assert exact Chinese labels and semantic separation:

```ts
expect(DIRECTION_META["ai-agent"].name).toBe("AI Coding 与 Agent");
expect(DIMENSION_META.utility.weight).toBe(18);

const model = buildRepositoryCard(report, "quickwit-oss/quickwit", 1);
expect(model.score).toBe(66.9);
expect(model.confidence).toBe(0.9);
expect(model.riskPenalty).toBe(0);
expect(model.strongestDimension.label).toBe("安全与合规");
expect(() => buildRepositoryCard(report, "missing/repository", 1))
  .toThrow("ranking references missing repository");
```

Add cases for missing license, missing Scorecard, a degraded source, and an empty direction.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @github-picks/web test -- view-model.test.ts
```

Expected: FAIL because `site-meta.ts` and `view-model.ts` do not exist.

- [x] **Step 3: Implement fixed metadata**

`site-meta.ts` must define five route slugs and eight dimensions without deriving weights from UI code:

```ts
export const DIRECTION_META = {
  "ai-agent": { name: "AI Coding 与 Agent", shortName: "AI / Agent", description: "AI Coding、Agent 工程化与模型应用基础设施。" },
  "data-ml": { name: "数据与机器学习工程", shortName: "数据 / ML", description: "数据平台、机器学习工程与模型运行基础设施。" },
  "app-platform": { name: "前端、后端与跨端", shortName: "应用平台", description: "Web、API、后端框架与跨端应用工程。" },
  "infra-devtools": { name: "云原生、可观测与开发者工具", shortName: "基础设施", description: "云原生、可观测性、DevOps 与开发者效率工具。" },
  "security-supply-chain": { name: "安全与软件供应链", shortName: "安全", description: "应用安全、依赖治理与软件供应链。" }
} as const;
```

Define dimension labels and weights exactly as `18/18/15/14/10/10/10/5`.

- [x] **Step 4: Implement pure view-model functions**

Use explicit types:

```ts
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
  confidenceLabel: "高" | "中" | "低";
  riskPenalty: number;
  strongestDimension: { id: DimensionId; label: string; value: number };
  why: string;
  href: string;
  githubUrl: string;
}
```

`buildRepositoryIndex()` normalizes keys to lower case. `buildRankingItems()` preserves ranking order and throws on broken references. Confidence labels use `>= 0.85 high`, `>= 0.7 medium`, otherwise low. Risk and confidence cannot be folded into `score`.

- [x] **Step 5: Run focused and package tests**

```bash
pnpm --filter @github-picks/web test -- view-model.test.ts
pnpm --filter @github-picks/web test
pnpm --filter @github-picks/web typecheck
```

Expected: all tests pass with no warnings from application code.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/lib/site-meta.ts apps/web/src/lib/view-model.ts apps/web/test/view-model.test.ts
git commit -m "feat: add website presentation models"
```

---

### Task 3: Build the Editorial Design System and Homepage

**Files:**
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/not-found.tsx`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/src/components/site-header.tsx`
- Create: `apps/web/src/components/daily-masthead.tsx`
- Create: `apps/web/src/components/source-pulse.tsx`
- Create: `apps/web/src/components/top-story-card.tsx`
- Create: `apps/web/src/components/repository-row.tsx`
- Create: `apps/web/src/components/ranking-section.tsx`
- Create: `apps/web/src/components/direction-index.tsx`
- Create: `apps/web/src/components/site-footer.tsx`
- Create: `apps/web/src/components/home-page.tsx`
- Create: `apps/web/test/home-page.test.tsx`

**Interfaces:**
- Consumes: latest live report and Task 2 view models.
- Produces: static homepage with navigation, Top 3, full overall ranking, four ranking excerpts, five direction entries, and methodology summary.

- [x] **Step 1: Write failing homepage rendering tests**

Render `HomePage` with the committed live report and assert:

```tsx
expect(screen.getByRole("heading", { name: /今日开源情报/ })).toBeTruthy();
expect(screen.getByText("60 个候选")).toBeTruthy();
expect(screen.getByRole("link", { name: /quickwit-oss\/quickwit/ })).toBeTruthy();
expect(screen.getByText(/HubLens/)).toBeTruthy();
expect(screen.getByText(/全部候选信号超过新鲜度阈值/)).toBeTruthy();
expect(screen.getByRole("heading", { name: "五个技术方向" })).toBeTruthy();
```

Add a reduced fixture with no degraded sources and verify the warning strip is absent.

- [x] **Step 2: Run the component test and verify RED**

```bash
pnpm --filter @github-picks/web test -- home-page.test.tsx
```

Expected: FAIL because homepage components do not exist.

- [x] **Step 3: Create layout and localised typography**

Use `Noto_Serif_SC`, `Noto_Sans_SC`, and `IBM_Plex_Mono` through `next/font/google`; expose font variables on `<body>`. Global metadata must identify the site as independent and unofficial.

```tsx
export const metadata: Metadata = {
  title: { default: "GitHub Picks · 每日开源情报", template: "%s · GitHub Picks" },
  description: "不只看 Star 的中文 GitHub 开源项目榜单与证据分析。",
};
```

- [x] **Step 4: Implement design tokens and responsive primitives**

Start `globals.css` with exact tokens:

```css
:root {
  --paper: #f2ebdd;
  --ink: #141512;
  --muted: #65665f;
  --line: #c9c1b2;
  --vermilion: #e34b32;
  --signal: #b8f34a;
  --panel: #20231f;
  --serif: var(--font-serif), "Songti SC", serif;
  --sans: var(--font-sans), sans-serif;
  --mono: var(--font-mono), monospace;
}
```

Use a 12-column desktop grid, a one-column mobile flow, editorial border rules instead of generic card shadows, visible `:focus-visible`, and a reduced-motion media query.

- [x] **Step 5: Implement stateless homepage components**

`DailyMasthead` must show date, mode, score version, counts, Top 1 score/confidence/risk, and `SourcePulse`. `RepositoryRow` must keep score/confidence/risk in separate DOM elements. All internal navigation uses `next/link`; external links include `target="_blank" rel="noreferrer"`.

- [x] **Step 6: Connect the page to the report store**

```tsx
export default async function Page() {
  const report = await getLatestLiveReport();
  return <HomePage report={report} />;
}
```

The homepage must not use `fetch()`, `useEffect`, or client-side scoring.

- [x] **Step 7: Run tests and static build**

```bash
pnpm --filter @github-picks/web test -- home-page.test.tsx
pnpm --filter @github-picks/web typecheck
pnpm --filter @github-picks/web build
test -f apps/web/out/index.html
```

Expected: component test passes and static homepage exists.

- [x] **Step 8: Commit**

```bash
git add apps/web/src/app apps/web/src/components apps/web/src/styles apps/web/test/home-page.test.tsx
git commit -m "feat: build GitHub Picks editorial homepage"
```

---

### Task 4: Add Direction, Repository, and Source-Health Routes

**Files:**
- Create: `apps/web/src/app/directions/[direction]/page.tsx`
- Create: `apps/web/src/app/repositories/[owner]/[repo]/page.tsx`
- Create: `apps/web/src/app/sources/page.tsx`
- Create: `apps/web/src/components/direction-page.tsx`
- Create: `apps/web/src/components/repository-detail.tsx`
- Create: `apps/web/src/components/dimension-bars.tsx`
- Create: `apps/web/src/components/analysis-brief.tsx`
- Create: `apps/web/src/components/evidence-list.tsx`
- Create: `apps/web/src/components/source-health-table.tsx`
- Create: `apps/web/src/components/empty-ranking.tsx`
- Create: `apps/web/test/detail-pages.test.tsx`

**Interfaces:**
- Consumes: Task 1 report store and Task 2 view models.
- Produces: five direction routes, one route per enriched repository, and `/sources/`.

- [ ] **Step 1: Write failing route-component tests**

Test exact semantics:

```tsx
render(<DirectionPage report={report} directionId="security-supply-chain" />);
expect(screen.getByRole("heading", { name: "安全与软件供应链" })).toBeTruthy();
cleanup();

render(<RepositoryDetail report={report} repositoryId="vllm-project/vllm" />);
expect(screen.getByText("安全工程证据缺口")).toBeTruthy();
cleanup();

render(<SourceHealthTable sources={report.sourceHealth} />);
expect(screen.getByText("全部候选信号超过新鲜度阈值")).toBeTruthy();
cleanup();

render(<EmptyRanking />);
expect(screen.getByText(/未达到当前证据门槛/)).toBeTruthy();
```

Verify evidence links are deduplicated and raw SHA identifiers never appear.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
pnpm --filter @github-picks/web test -- detail-pages.test.tsx
```

Expected: FAIL because route components do not exist.

- [ ] **Step 3: Implement direction pages**

Export all five parameters:

```ts
export function generateStaticParams() {
  return Object.keys(DIRECTION_META).map((direction) => ({ direction }));
}

export const dynamicParams = false;
```

Reject an unknown slug with `notFound()`. Show count, maximum score, median confidence, complete ranking, and adjacent direction links.

- [ ] **Step 4: Implement repository detail pages**

`generateStaticParams()` must return the owner and repo segments for every repository in the latest live report. The detail model must expose description, language, license, stars, forks, pushed date, eight dimensions, four Chinese analysis sections, activity features, risk findings, missing fields, signals, and public evidence.

Do not display `rawObjectRef`. Do not convert missing Scorecard into a vulnerability statement.

- [ ] **Step 5: Implement source-health page**

Render text plus status symbol for healthy/degraded/offline. Explain independence groups and neutral prior semantics beneath the table. On small screens, use CSS grid definition cards rather than an overflowing table.

- [ ] **Step 6: Run tests and verify all generated files**

```bash
pnpm --filter @github-picks/web test -- detail-pages.test.tsx
pnpm --filter @github-picks/web test
pnpm --filter @github-picks/web typecheck
pnpm --filter @github-picks/web build
test -f apps/web/out/directions/ai-agent/index.html
test -f apps/web/out/repositories/quickwit-oss/quickwit/index.html
test -f apps/web/out/sources/index.html
```

Expected: all route tests pass and all named files exist.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/directions apps/web/src/app/repositories apps/web/src/app/sources apps/web/src/components apps/web/test/detail-pages.test.tsx
git commit -m "feat: add GitHub Picks intelligence pages"
```

---

### Task 5: Add Browser, Accessibility, and Static-Export Acceptance

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/site.spec.ts`
- Create: `apps/web/e2e/accessibility.spec.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: complete static website.
- Produces: reproducible desktop/mobile navigation and accessibility gates.

- [ ] **Step 1: Write browser acceptance journeys**

Configure Playwright with Chromium desktop and a 375×812 mobile project. Use `pnpm --filter @github-picks/web dev` as the web server on port 3100.

The journey must cover:

```ts
await page.goto("/");
await expect(page.getByRole("heading", { name: /今日开源情报/ })).toBeVisible();
await page.getByRole("link", { name: /安全与软件供应链/ }).first().click();
await expect(page).toHaveURL(/directions\/security-supply-chain/);
await page.getByRole("link", { name: /aquasecurity\/trivy/ }).click();
await expect(page.getByRole("heading", { name: /aquasecurity\/trivy/ })).toBeVisible();
await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
```

The accessibility test runs `AxeBuilder` on `/`, `/sources/`, one direction, and one detail page with zero serious or critical violations.

- [ ] **Step 2: Run the browser baseline**

```bash
pnpm --filter @github-picks/web exec playwright install chromium
pnpm --filter @github-picks/web test:e2e
```

Expected: the journeys execute against the real site. A failure is evidence for a narrow UI correction; a clean run authorizes no production change in this task.

- [ ] **Step 3: Fix only observed UI acceptance failures using a red/green regression**

For each observed failure, first retain the failing browser assertion (or add a smaller failing component test), then adjust only the relevant semantic heading, link name, focus style, responsive grid, table card, or reduced-motion rule. Do not add unrelated animation or new product scope. If the baseline is green, skip this step.

- [ ] **Step 4: Run browser and production checks**

```bash
pnpm --filter @github-picks/web test:e2e
pnpm --filter @github-picks/web build
```

Expected: desktop, mobile, and axe projects pass; build exports all routes.

- [ ] **Step 5: Manually inspect screenshots**

Capture and inspect `/`, `/directions/ai-agent/`, one repository page, and `/sources/` at 1440×1000 and 375×812. Confirm typography, no overlap, no clipped score bars, clear degraded-source treatment, and no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e apps/web/package.json pnpm-lock.yaml apps/web/src
git commit -m "test: verify GitHub Picks web experience"
```

---

### Task 6: Add GitHub Pages, Documentation, and Release Verification

**Files:**
- Create: `.github/workflows/pages.yml`
- Create: `docs/runbooks/web-static-site.md`
- Create: `apps/web/test/pages-workflow.test.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-04-github-picks-web-mvp.md`

**Interfaces:**
- Consumes: `apps/web/out` and committed daily reports.
- Produces: Pages-ready artifact, operator instructions, and a verified feature branch.

- [ ] **Step 1: Write a workflow contract test**

Create `apps/web/test/pages-workflow.test.ts` that reads `.github/workflows/pages.yml` and asserts:

```ts
expect(workflow).toContain("branches: [master]");
expect(workflow).toContain('NEXT_PUBLIC_BASE_PATH: "/github-picks"');
expect(workflow).toContain("actions/configure-pages@v5");
expect(workflow).toContain("actions/upload-pages-artifact@v4");
expect(workflow).toContain("actions/deploy-pages@v4");
expect(workflow).toContain("path: apps/web/out");
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
pnpm --filter @github-picks/web test -- pages-workflow.test.ts
```

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Implement the Pages workflow**

Use `actions/checkout@v6`, `actions/setup-node@v6`, Corepack, `pnpm install --frozen-lockfile`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, and `actions/deploy-pages@v4`. The build job sets `NEXT_PUBLIC_BASE_PATH: "/github-picks"`, runs `pnpm check`, builds `@github-picks/web`, creates `.nojekyll`, and uploads `apps/web/out`. The deploy job grants only `pages: write` and `id-token: write` beyond contents read.

- [ ] **Step 4: Document local and Pages operation**

The runbook must include:

- local `pnpm --filter @github-picks/web dev` on port 3000;
- production `pnpm --filter @github-picks/web build` and output path;
- how latest live report selection works;
- why replay never publishes;
- Project Pages base path and custom-domain behavior;
- enabling GitHub Pages “GitHub Actions” source;
- build failure recovery and previous-deployment preservation;
- daily data refresh without committing raw snapshots.

README must link the web app, latest report, data pipeline runbook, and web runbook.

- [ ] **Step 5: Run final uncached verification**

```bash
pnpm format
TURBO_FORCE=true pnpm check
TURBO_FORCE=true pnpm build
pnpm --filter @github-picks/web test:e2e
git diff --check
```

Then validate static export:

```bash
test -f apps/web/out/index.html
test "$(find apps/web/out/directions -name index.html | wc -l | tr -d ' ')" -eq 5
test "$(find apps/web/out/repositories -name index.html | wc -l | tr -d ' ')" -eq 20
test -f apps/web/out/sources/index.html
```

Expected: all existing and website tests pass uncached, all packages build, e2e passes, and static file counts match the live report.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/pages.yml README.md docs/runbooks/web-static-site.md docs/superpowers/plans/2026-08-04-github-picks-web-mvp.md apps/web/test/pages-workflow.test.ts
git commit -m "ci: publish GitHub Picks static website"
```

- [ ] **Step 7: Push the feature branch**

```bash
git push -u origin codex/github-picks-web-mvp
```

Expected: remote branch points to the locally verified commit. Do not merge or enable Pages without user-visible review.

---

## Self-Review Record

- **Spec coverage:** Homepage, five directions, repository details, source health, static export, Pages, accessibility, error semantics, and browser QA each map to a task.
- **Scope control:** Search, comparison, organizations, accounts, cloud bookmarks, public API, Obsidian, Agent, and scheduled collection remain outside this plan.
- **Data boundary:** `DailyReportSchema → report-store → view-model → Server Components` is the only path; no UI scoring formula is introduced.
- **Static-export consistency:** Every dynamic path is produced by `generateStaticParams`; unknown paths are disabled; no unsupported runtime Next.js feature appears.
- **Failure truthfulness:** Missing live report, invalid Schema, and broken ranking references fail the build; degraded sources and empty directions render honest public states.
- **Placeholder scan:** The automated scan matched zero prohibited placeholder tokens; every referenced helper and component has an owning task.
- **Execution choice:** The user explicitly requested direct execution; use inline execution with `superpowers:executing-plans`, not subagent dispatch.
