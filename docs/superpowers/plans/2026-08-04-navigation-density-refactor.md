# GitHub Picks Navigation and Density Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated navigation and repeated homepage/period data with one responsive navigation tree and one canonical filterable daily ranking.

**Architecture:** Derive one homepage ranking model from `report.rankings.overall`, attach specialty membership as tags, and render each repository exactly once. Mount one client-aware navigation tree in the root layout and reposition that same tree as a wide sidebar, medium horizontal bar, or mobile bottom bar through CSS. Keep the static `DailyReport` boundary, scoring semantics, direction/detail pages, and GitHub Pages export unchanged.

**Tech Stack:** Next.js 16.3 App Router/static export, React 19.2, TypeScript 7, Vitest, Testing Library, Playwright, Axe, Biome, existing global CSS.

## Global Constraints

- Preserve the `DailyReport v0.1.0` schema, ranking order, scoring algorithm, evidence links, and static export behavior.
- Render 20 unique homepage repository records as 20 unique `data-repository-id` nodes for the `2026-08-04` fixture.
- Keep published score, confidence, and risk penalty separate; filtering must never recompute or reorder them.
- Use one `SiteNavigation` tree across wide, medium, and mobile layouts; never show two time-range navigations in one viewport.
- Wide navigation starts at `1360px`; medium layout covers `761–1359px`; mobile layout ends at `760px`.
- Keep wide main content at least approximately `1120px`; do not solve density with unreadably small text or horizontal page scrolling.
- Allow client JavaScript only for pathname-aware navigation and local ranking filter state; no client fetches, global store, chart library, or scoring logic.
- Preserve unrelated AI Hot commits `77352de` and `7233a3d`; do not modify or restage `docs/superpowers/specs/2026-08-04-ai-hot-source-design.md` or `docs/superpowers/plans/2026-08-04-ai-hot-source-integration.md`.
- Use Node `24.15.0` and pnpm `11.18.0` from the repository declarations.

---

## File Structure Map

**Create**

- `apps/web/src/lib/daily-ranking.ts` — pure canonical ranking and specialty-tag derivation.
- `apps/web/src/components/ranking-tags.tsx` — shared semantic tag rendering.
- `apps/web/src/components/daily-ranking.tsx` — client-side filter state and unique homepage list.
- `apps/web/src/components/site-navigation.tsx` — the single global navigation tree and active-route behavior.
- `apps/web/test/daily-ranking.test.ts` — canonical model contract.
- `apps/web/test/site-navigation.test.tsx` — route state and navigation structure.

**Modify**

- `apps/web/src/app/layout.tsx` — mount navigation once around page content.
- `apps/web/src/components/site-header.tsx` — remove duplicated link sets and mobile menu.
- `apps/web/src/components/home-page.tsx` — replace independent featured/full/slice lists with `DailyRanking`.
- `apps/web/src/components/daily-masthead.tsx` — remove top repository and merge report/source status.
- `apps/web/src/components/source-pulse.tsx` — compact source summary and problem details.
- `apps/web/src/components/top-story-card.tsx` — add repository identity attribute and specialty tags.
- `apps/web/src/components/repository-row.tsx` — add identity attribute and specialty tags.
- `apps/web/src/components/direction-index.tsx` — stop repeating project names.
- `apps/web/src/components/site-footer.tsx` — remove repeated internal navigation.
- `apps/web/src/components/period-ranking-page.tsx` — remove duplicated leader and merge coverage explanation.
- `apps/web/src/components/history-index-page.tsx` — remove page-local period navigation.
- `apps/web/src/components/history-report-page.tsx` — remove page-local period navigation.
- `apps/web/src/styles/globals.css` — responsive frame, navigation, unique ranking, compact summary, period dedupe, and safe-area styles.
- `apps/web/test/home-page.test.tsx` — unique rendering and source-summary assertions.
- `apps/web/test/period-pages.test.tsx` — period leader/coverage uniqueness.
- `apps/web/e2e/site.spec.ts` — wide, medium, mobile navigation and density flows.
- `apps/web/e2e/accessibility.spec.ts` — retain coverage after navigation changes.

**Delete**

- `apps/web/src/components/period-navigation.tsx` — superseded by `SiteNavigation`.

---

### Task 1: Canonical Daily Ranking Model

**Files:**
- Create: `apps/web/src/lib/daily-ranking.ts`
- Create: `apps/web/test/daily-ranking.test.ts`

**Interfaces:**
- Consumes: `DailyReport`, `RepositoryCardModel`, and `buildRankingItems(report, ids)`.
- Produces: `DailyRankingTagId`, `DailyRankingTagModel`, `DailyRankingItemModel`, `DAILY_RANKING_TAGS`, and `buildDailyRankingItems(report)`.

- [ ] **Step 1: Write the failing model tests**

Create `apps/web/test/daily-ranking.test.ts` with these exact contracts:

```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { beforeAll, describe, expect, it } from "vitest";
import { buildDailyRankingItems } from "../src/lib/daily-ranking";

let report: DailyReport;

beforeAll(async () => {
  const value = JSON.parse(
    await readFile(
      resolve(process.cwd(), "../../artifacts/daily/2026-08-04/report.json"),
      "utf8",
    ),
  ) as unknown;
  report = DailyReportSchema.parse(value);
});

describe("canonical daily ranking", () => {
  it("builds one item per overall repository in unchanged order", () => {
    const items = buildDailyRankingItems(report);
    expect(items.map((item) => item.id)).toEqual(report.rankings.overall);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });

  it("attaches specialty membership without changing the overall rank", () => {
    const items = buildDailyRankingItems(report);
    const leader = items[0];
    if (leader === undefined) throw new Error("missing fixture leader");
    expect(leader.rank).toBe(1);
    expect(leader.tags.map((tag) => tag.id)).toEqual([
      "rising",
      "new",
      "hidden",
      "active",
    ]);
  });

  it("rejects a specialty item that is absent from the canonical ranking", () => {
    const invalid = structuredClone(report);
    invalid.rankings.rising = ["missing/example"];
    expect(() => buildDailyRankingItems(invalid)).toThrow(
      /specialty ranking references non-overall repository: missing\/example/,
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/daily-ranking.test.ts
```

Expected: FAIL because `../src/lib/daily-ranking` does not exist.

- [ ] **Step 3: Implement the pure model**

Create `apps/web/src/lib/daily-ranking.ts`:

```ts
import type { DailyReport } from "@github-picks/core/schema";
import { buildRankingItems, type RepositoryCardModel } from "./view-model";

export const DAILY_RANKING_TAGS = [
  { id: "rising", label: "趋势上升", rankingKey: "rising" },
  { id: "new", label: "新项目", rankingKey: "newProjects" },
  { id: "hidden", label: "隐藏宝石", rankingKey: "hiddenGems" },
  { id: "active", label: "开发活跃", rankingKey: "active" },
] as const;

export type DailyRankingTagId = (typeof DAILY_RANKING_TAGS)[number]["id"];
export type DailyRankingFilter = "all" | DailyRankingTagId;

export interface DailyRankingTagModel {
  id: DailyRankingTagId;
  label: string;
}

export interface DailyRankingItemModel extends RepositoryCardModel {
  tags: DailyRankingTagModel[];
}

export function buildDailyRankingItems(
  report: DailyReport,
): DailyRankingItemModel[] {
  const overallIds = new Set(report.rankings.overall);
  for (const tag of DAILY_RANKING_TAGS) {
    for (const repositoryId of report.rankings[tag.rankingKey]) {
      if (!overallIds.has(repositoryId)) {
        throw new Error(
          `specialty ranking references non-overall repository: ${repositoryId}`,
        );
      }
    }
  }

  const membership = new Map<string, DailyRankingTagModel[]>();
  for (const tag of DAILY_RANKING_TAGS) {
    for (const repositoryId of report.rankings[tag.rankingKey]) {
      const tags = membership.get(repositoryId) ?? [];
      tags.push({ id: tag.id, label: tag.label });
      membership.set(repositoryId, tags);
    }
  }

  return buildRankingItems(report, report.rankings.overall).map((item) => ({
    ...item,
    tags: membership.get(item.id) ?? [],
  }));
}
```

- [ ] **Step 4: Run model tests**

Run the focused command from Step 2.

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the model**

```bash
git add apps/web/src/lib/daily-ranking.ts apps/web/test/daily-ranking.test.ts
git commit -m "feat: build canonical daily ranking model"
```

---

### Task 2: Unique Filterable Homepage Ranking

**Files:**
- Create: `apps/web/src/components/ranking-tags.tsx`
- Create: `apps/web/src/components/daily-ranking.tsx`
- Modify: `apps/web/src/components/top-story-card.tsx`
- Modify: `apps/web/src/components/repository-row.tsx`
- Modify: `apps/web/src/components/home-page.tsx`
- Modify: `apps/web/test/home-page.test.tsx`

**Interfaces:**
- Consumes: `DailyRankingItemModel[]`, `DAILY_RANKING_TAGS`, and `buildDailyRankingItems(report)` from Task 1.
- Produces: `DailyRanking({ items })`, unique `data-repository-id` nodes, and accessible specialty filters.

- [ ] **Step 1: Add failing homepage uniqueness/filter tests**

Extend `apps/web/test/home-page.test.tsx` imports with `fireEvent` and add:

```tsx
it("renders every repository once and filters the same canonical nodes", () => {
  const { container } = render(<HomePage report={report} />);
  const repositoryNodes = [
    ...container.querySelectorAll<HTMLElement>("[data-repository-id]"),
  ];
  const ids = repositoryNodes.map((node) => node.dataset.repositoryId);

  expect(ids).toHaveLength(report.rankings.overall.length);
  expect(new Set(ids).size).toBe(ids.length);

  fireEvent.click(screen.getByRole("button", { name: "新项目" }));
  expect(
    screen.getByRole("button", { name: "新项目" }).getAttribute("aria-pressed"),
  ).toBe("true");
  const newProjectIds = new Set(report.rankings.newProjects);
  const expectedVisibleIds = report.rankings.overall.filter((id) =>
    newProjectIds.has(id),
  );
  expect(
    repositoryNodes
      .filter((node) => node.closest("[hidden]") === null)
      .map((node) => node.dataset.repositoryId),
  ).toEqual(expectedVisibleIds);
});
```

Replace the prior source-warning assertion with an assertion that the compact report summary contains the degraded source once.

- [ ] **Step 2: Run the homepage test and verify failure**

```bash
pnpm --filter @github-picks/web exec vitest run test/home-page.test.tsx
```

Expected: FAIL because there are 40 repeated nodes and no filter buttons.

- [ ] **Step 3: Add shared specialty tags**

Create `apps/web/src/components/ranking-tags.tsx`:

```tsx
import type { DailyRankingTagModel } from "../lib/daily-ranking";

export function RankingTags({ tags }: { tags: DailyRankingTagModel[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="ranking-tags" aria-label="观察标签">
      {tags.map((tag) => (
        <li key={tag.id} data-tag={tag.id}>{tag.label}</li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Make each card/row the one canonical repository node**

Keep both components accepting `RepositoryCardModel` because `RepositoryRow` is also used by direction and history pages. Add an optional `tags?: DailyRankingTagModel[]` prop, add `data-repository-id={item.id}` to the root `<article>`, and render `<RankingTags tags={tags ?? []} />` after the direction/language context. Keep score, confidence, risk, description, reason, and detail links unchanged at this step. `DailyRanking` passes `tags={item.tags}`; other consumers omit the prop.

- [ ] **Step 5: Implement the filter boundary**

Create `apps/web/src/components/daily-ranking.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  DAILY_RANKING_TAGS,
  type DailyRankingFilter,
  type DailyRankingItemModel,
} from "../lib/daily-ranking";
import { RepositoryRow } from "./repository-row";
import { TopStoryCard } from "./top-story-card";

export function DailyRanking({ items }: { items: DailyRankingItemModel[] }) {
  const [filter, setFilter] = useState<DailyRankingFilter>("all");
  const matches = (item: DailyRankingItemModel) =>
    filter === "all" || item.tags.some((tag) => tag.id === filter);
  const top = items.filter((item) => item.rank <= 3);
  const rest = items.filter((item) => item.rank > 3);
  const hasMatches = items.some(matches);

  return (
    <section className="daily-ranking" id="ranking" aria-labelledby="ranking-title">
      <header className="section-heading">
        <p className="eyebrow">DAILY VALUE / 20 PICKS</p>
        <div>
          <h2 id="ranking-title">今日综合价值榜</h2>
          <p>每个项目只出现一次；标签用于切换观察视角，不改变综合名次。</p>
        </div>
        <span className="section-heading__count">{items.length} PICKS</span>
      </header>
      <div className="ranking-filters" role="group" aria-label="筛选观察标签">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部</button>
        {DAILY_RANKING_TAGS.map((tag) => (
          <button key={tag.id} type="button" aria-pressed={filter === tag.id} onClick={() => setFilter(tag.id)}>
            {tag.label}
          </button>
        ))}
      </div>
      <div className="daily-ranking__top">
        {top.map((item) => (
          <div key={item.id} hidden={!matches(item)}>
            <TopStoryCard item={item} featured={item.rank === 1} tags={item.tags} />
          </div>
        ))}
      </div>
      <div className="ranking-list">
        {rest.map((item) => (
          <div key={item.id} hidden={!matches(item)}>
            <RepositoryRow item={item} tags={item.tags} testId={`overall-row-${item.id.replace("/", "-")}`} />
          </div>
        ))}
      </div>
      {!hasMatches ? <p role="status">当前筛选暂无项目</p> : null}
    </section>
  );
}
```

If no nodes match, render a `role="status"` empty message after the filters. Do not duplicate an item in separate filtered lists.

- [ ] **Step 6: Replace homepage repeated sections**

In `HomePage`, replace `buildRankingItems(report, report.rankings.overall)` with `buildDailyRankingItems(report)`. Remove `topStories`, `editor-picks`, the full `RankingSection`, `rankingSlices`, and all four slice sections. Render exactly one `<DailyRanking items={items} />` after the report summary.

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/daily-ranking.test.ts test/home-page.test.tsx
```

Expected: canonical model and homepage tests PASS.

- [ ] **Step 8: Commit the unique homepage list**

```bash
git add apps/web/src/components/ranking-tags.tsx apps/web/src/components/daily-ranking.tsx apps/web/src/components/top-story-card.tsx apps/web/src/components/repository-row.tsx apps/web/src/components/home-page.tsx apps/web/test/home-page.test.tsx
git commit -m "feat: render one filterable daily ranking"
```

---

### Task 3: Consolidated Report Summary and Secondary Sections

**Files:**
- Modify: `apps/web/src/components/daily-masthead.tsx`
- Modify: `apps/web/src/components/source-pulse.tsx`
- Modify: `apps/web/src/components/home-page.tsx`
- Modify: `apps/web/src/components/direction-index.tsx`
- Modify: `apps/web/src/components/site-footer.tsx`
- Modify: `apps/web/test/home-page.test.tsx`

**Interfaces:**
- Consumes: existing `DailyMastheadModel`, `SourceSummaryModel`, and direction summaries.
- Produces: one report/source summary, directions without repeated repositories, and a non-duplicated footer.

- [ ] **Step 1: Add failing summary tests**

Add assertions that:

```tsx
expect(screen.getByRole("region", { name: /今日开源情报/ })).toBeTruthy();
expect(screen.getAllByText(/HubLens/)).toHaveLength(1);
expect(screen.getByText("60 → 20 → 20")).toBeTruthy();
expect(screen.queryByTestId("source-warning")).toBeNull();
```

Also assert the direction index does not contain repository links by querying `.direction-index a[href^="/repositories/"]`.

- [ ] **Step 2: Run the test and verify failure**

Use the homepage test command from Task 2. Expected: FAIL on duplicate source and pipeline summary assertions.

- [ ] **Step 3: Remove the top repository from `DailyMasthead`**

Delete the `topStory` prop and the `lead-intelligence` article. Render the processing counts as one compact pipeline string with accessible detail:

```tsx
<div className="daily-cover__pipeline" aria-label="日报处理数量">
  <strong>
    {cover.counts.discovered} → {cover.counts.enriched} → {cover.counts.published}
  </strong>
  <span>候选 → 补全 → 发布</span>
</div>
```

Keep date, mode, generated time, score version, and `<SourcePulse summary={sources} />`.

- [ ] **Step 4: Make `SourcePulse` the only homepage source-status block**

Add `problemSources = summary.items.filter((item) => item.status !== "healthy")`. Display counts once and, when nonempty, show each problem source name/message in a compact list inside `SourcePulse`. Remove the separate `source-warning` markup and imports from `HomePage`.

- [ ] **Step 5: Remove repeated project names from direction index**

Delete `.direction-card__projects` markup. Keep direction name, description, count, and direction-page link.

- [ ] **Step 6: Collapse the full eight-weight method ledger**

Wrap the weight list in:

```tsx
<details className="method-note__details">
  <summary>查看八维评分权重</summary>
  <ol className="weight-list">
    {DIMENSION_IDS.map((id, index) => (
      <li key={id}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{DIMENSION_META[id].label}</strong>
        <em>{DIMENSION_META[id].weight}%</em>
      </li>
    ))}
  </ol>
</details>
```

Keep the short score/confidence/risk reading boundary visible outside the details.

- [ ] **Step 7: Remove repeated internal footer navigation**

Keep the brand statement, legal copy, and one external GitHub link. Delete internal links for today, 30 days, history, and sources.

- [ ] **Step 8: Run homepage and detail-page tests**

```bash
pnpm --filter @github-picks/web exec vitest run test/home-page.test.tsx test/detail-pages.test.tsx
```

Expected: PASS with one source-status explanation and unchanged detail semantics.

- [ ] **Step 9: Commit the summary cleanup**

```bash
git add apps/web/src/components/daily-masthead.tsx apps/web/src/components/source-pulse.tsx apps/web/src/components/home-page.tsx apps/web/src/components/direction-index.tsx apps/web/src/components/site-footer.tsx apps/web/test/home-page.test.tsx
git commit -m "feat: consolidate homepage intelligence summary"
```

---

### Task 4: One Responsive Site Navigation Tree

**Files:**
- Create: `apps/web/src/components/site-navigation.tsx`
- Create: `apps/web/test/site-navigation.test.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/components/site-header.tsx`
- Modify: `apps/web/src/components/home-page.tsx`
- Modify: `apps/web/src/components/period-ranking-page.tsx`
- Modify: `apps/web/src/components/history-index-page.tsx`
- Modify: `apps/web/src/components/history-report-page.tsx`
- Delete: `apps/web/src/components/period-navigation.tsx`

**Interfaces:**
- Consumes: `RANKING_PERIOD_IDS`, `RANKING_PERIOD_META`, and Next `usePathname()`.
- Produces: `SiteNavigation`, `isNavigationActive(pathname, href)`, and a single `aria-label="主导航"` tree.

- [ ] **Step 1: Write failing navigation tests**

Create `apps/web/test/site-navigation.test.tsx` and mock `next/navigation`:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { SiteNavigation } from "../src/components/site-navigation";

afterEach(cleanup);

describe("site navigation", () => {
  it("renders one complete navigation tree", () => {
    render(<SiteNavigation />);
    const navigation = screen.getByRole("navigation", { name: "主导航" });
    expect(within(navigation).getByRole("link", { name: "今日" })).toBeTruthy();
    expect(within(navigation).getByRole("link", { name: "近 180 天" })).toBeTruthy();
    expect(within(navigation).getByRole("link", { name: "历史" })).toBeTruthy();
    expect(within(navigation).getByRole("link", { name: "信源" })).toBeTruthy();
  });

  it("marks nested routes active without marking the homepage", () => {
    pathname = "/rankings/30d/";
    render(<SiteNavigation />);
    expect(screen.getByRole("link", { name: "近 30 天" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "今日" }).getAttribute("aria-current")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

```bash
pnpm --filter @github-picks/web exec vitest run test/site-navigation.test.tsx
```

Expected: FAIL because `site-navigation.tsx` does not exist.

- [ ] **Step 3: Implement navigation route semantics**

Create `site-navigation.tsx` as a Client Component. Normalize a trailing slash, treat `/` as exact-only, treat history and sources as prefix matches, and treat each period route as its own prefix. Use one `<nav aria-label="主导航">`, one home link, one `<details>` period group containing all four period links, and direct history/source links. Add homepage-only anchor links for `#ranking`, `#directions`, and `#method` inside a `.site-navigation__local` block.

The route helper must have this signature:

```ts
export function isNavigationActive(pathname: string, href: string): boolean {
  const current = pathname.replace(/\/+$/, "") || "/";
  const target = href.replace(/\/+$/, "") || "/";
  return target === "/" ? current === "/" : current === target || current.startsWith(`${target}/`);
}
```

Use a `details` ref and `useEffect` keyed by pathname to remove `open` after navigation.

- [ ] **Step 4: Mount navigation once in the root layout**

Wrap it in `Suspense` and structure the body as:

```tsx
<SiteHeader />
<div className="site-frame">
  <Suspense fallback={<div className="site-navigation site-navigation--fallback" aria-hidden="true" />}>
    <SiteNavigation />
  </Suspense>
  <div className="site-frame__content">
    {children}
    <SiteFooter />
  </div>
</div>
```

- [ ] **Step 5: Simplify `SiteHeader`**

Remove `navigation`, `NavigationLinks`, `.desktop-nav`, and `.mobile-nav`. Keep the brand and a short static descriptor such as `DAILY OSS INTELLIGENCE`; do not repeat the time ranges.

- [ ] **Step 6: Remove page-local period navigation**

Delete `PeriodNavigation` imports and JSX from home, period ranking, history index, and history report. Delete `apps/web/src/components/period-navigation.tsx`.

- [ ] **Step 7: Run navigation and page tests**

```bash
pnpm --filter @github-picks/web exec vitest run test/site-navigation.test.tsx test/period-pages.test.tsx test/home-page.test.tsx
```

Expected: PASS after updating period tests to stop querying `榜单时间范围`.

- [ ] **Step 8: Commit navigation structure**

```bash
git add apps/web/src/components/site-navigation.tsx apps/web/test/site-navigation.test.tsx apps/web/src/app/layout.tsx apps/web/src/components/site-header.tsx apps/web/src/components/home-page.tsx apps/web/src/components/period-ranking-page.tsx apps/web/src/components/history-index-page.tsx apps/web/src/components/history-report-page.tsx apps/web/src/components/period-navigation.tsx apps/web/test/period-pages.test.tsx
git commit -m "feat: add one responsive site navigation"
```

---

### Task 5: Deduplicated Period Ranking

**Files:**
- Modify: `apps/web/src/components/period-ranking-page.tsx`
- Modify: `apps/web/test/period-pages.test.tsx`

**Interfaces:**
- Consumes: unchanged `PeriodRankingModel` and `PeriodRepositoryRow`.
- Produces: one leader node and one consolidated coverage status.

- [ ] **Step 1: Add failing uniqueness assertions**

In `period-pages.test.tsx`, render the 7-day ranking and assert:

```tsx
const leader = ranking.items[0];
if (leader === undefined) throw new Error("missing period leader");
expect(screen.getAllByRole("link", { name: leader.id })).toHaveLength(1);
expect(screen.getByText(`${ranking.reportCount} / ${ranking.days} 天`)).toBeTruthy();
expect(screen.getAllByText(/当前历史库尚缺 5 天/)).toHaveLength(1);
```

- [ ] **Step 2: Run the test and verify failure**

```bash
pnpm --filter @github-picks/web exec vitest run test/period-pages.test.tsx
```

Expected: FAIL because the leader link appears in Hero and row, and coverage language is split.

- [ ] **Step 3: Remove the period Hero leader**

Delete `lead`, `period-hero__lead`, and its project/metrics markup. Keep title, description, and date range.

- [ ] **Step 4: Consolidate coverage**

Render actual reports, calendar coverage, unique repository count, progress, and any missing-day explanation inside one `period-hero__coverage` block. Include one history link there and delete the separate `data-coverage-note` aside.

- [ ] **Step 5: Run period tests**

Use the command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit period deduplication**

```bash
git add apps/web/src/components/period-ranking-page.tsx apps/web/test/period-pages.test.tsx
git commit -m "feat: deduplicate period ranking summary"
```

---

### Task 6: Responsive Density Styling

**Files:**
- Modify: `apps/web/src/styles/globals.css`

**Interfaces:**
- Consumes: class names introduced by Tasks 2–5.
- Produces: wide sidebar, medium horizontal bar, mobile bottom bar, compact report summary, unique ranking layout, and safe content spacing.

- [ ] **Step 1: Add site-frame tokens and wide layout**

Add root tokens:

```css
--site-width: 1600px;
--rail-width: 176px;
--header-height: 64px;
```

Define `.site-frame` as a max-width grid only at `min-width: 1360px`, with columns `var(--rail-width) minmax(0, 1fr)`. Make `.site-navigation` sticky at `top: var(--header-height)`, give it a right border and viewport-height panel, and keep `.site-frame__content` at `min-width: 0`.

- [ ] **Step 2: Style the single navigation across breakpoints**

Wide rules expose period links and homepage anchors in grouped vertical rows. Medium rules turn the same navigation into one sticky horizontal strip below the header. Mobile rules position it at the viewport bottom, show four primary controls, turn the period panel into an upward popover, and add `padding-bottom: calc(72px + env(safe-area-inset-bottom))` to content.

Delete obsolete `.desktop-nav`, `.mobile-nav`, and `.period-navigation*` rules. Ensure hidden wide/medium-only labels use `display: none` rather than remaining focusable offscreen.

- [ ] **Step 3: Compress the report summary without losing fields**

Change `.daily-cover` so date, compact pipeline, and source status fit in one desktop row beneath the edition strip. Remove `.lead-intelligence` and old full-width count ledger styles. On mobile stack these three blocks with one border between each.

- [ ] **Step 4: Style one ranking collection**

Use `.daily-ranking__top` for a three-card editorial grid, with the first card wider only on wide screens. Use `.ranking-filters` as a wrapping button group with strong `aria-pressed="true"` styling. Reduce ordinary row height through two-line description/reason clamps and an inline score ledger; do not reduce core text below `0.78rem`.

- [ ] **Step 5: Compact directions, method, footer, and period coverage**

Remove unused direction-project styles, style the method `<details>` summary as an explicit control, reduce the footer to two columns/one mobile column, and let period coverage own its warning state and history link.

- [ ] **Step 6: Run formatting and component tests**

```bash
pnpm exec biome check apps/web/src apps/web/test
pnpm --filter @github-picks/web test
```

Expected: Biome clean and all web tests PASS.

- [ ] **Step 7: Commit responsive styling**

```bash
git add apps/web/src/styles/globals.css
git commit -m "style: refine responsive intelligence density"
```

---

### Task 7: Browser and Accessibility Regression Proof

**Files:**
- Modify: `apps/web/e2e/site.spec.ts`
- Modify: `apps/web/e2e/accessibility.spec.ts` only if route selectors need adjustment.

**Interfaces:**
- Consumes: final rendered navigation and homepage repository nodes.
- Produces: automated proof of single navigation, unique repositories, mobile period interaction, and no overflow.

- [ ] **Step 1: Add viewport helpers and navigation assertions**

Add a helper that sets each viewport and verifies exactly one visible `nav[aria-label="主导航"]`. At `1440×900`, assert `.site-navigation` is a left rail; at `1024×768`, assert it is a horizontal strip; at `390×844`, assert its bounding box touches the viewport bottom.

- [ ] **Step 2: Add homepage uniqueness proof**

On `/`, collect all `[data-repository-id]`, assert length equals 20 and `new Set(ids).size === ids.length`. Click “新项目” and assert every visible node belongs to the fixture’s expected new-project IDs exposed by the rendered tags.

- [ ] **Step 3: Add mobile period-menu navigation proof**

At `390×844`, open the “周期” summary, click “近 7 天”, assert the URL ends in `/rankings/7d/`, and verify no horizontal overflow or bottom-bar overlap with the final content element.

- [ ] **Step 4: Run focused browser tests**

```bash
pnpm --filter @github-picks/web exec playwright test e2e/site.spec.ts e2e/accessibility.spec.ts
```

Expected: all Chromium tests PASS with no serious/critical Axe violations.

- [ ] **Step 5: Commit browser proof**

```bash
git add apps/web/e2e/site.spec.ts apps/web/e2e/accessibility.spec.ts
git commit -m "test: verify navigation and density regression"
```

---

### Task 8: Full Verification and Visual Acceptance

**Files:**
- Modify only files required by failures found in this task.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a release-ready static site with evidence-backed handoff.

- [ ] **Step 1: Run repository quality gates**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Expected: every command exits 0. If a gate fails, fix only the owned regression, rerun the focused failing test, then rerun the full gate.

- [ ] **Step 2: Start the production-equivalent local preview**

Use the existing Next app on an available explicit port and record it:

```bash
pnpm --filter @github-picks/web exec next dev --hostname 127.0.0.1 --port 3100
```

Expected: `http://127.0.0.1:3100` responds with the latest live report.

- [ ] **Step 3: Capture and inspect three viewport screenshots**

Capture `/` at `1440×900`, `1024×768`, and `390×844`, plus `/rankings/7d/` at desktop and mobile. Verify:

- one visible global navigation;
- no repeated period bar;
- the report summary fits without a duplicate warning strip;
- exactly one main node per repository;
- readable descriptions and metrics;
- mobile bottom navigation does not cover content;
- no horizontal overflow.

- [ ] **Step 4: Compare fixture density**

Evaluate DOM counts on `/`: total `[data-repository-id]` must be 20 and unique count must be 20. Record current document height for the fixture and confirm it is materially below the previous 12,350px desktop / 13,696px mobile baseline without hiding required project data.

- [ ] **Step 5: Stop preview and verify Git state**

Stop the exact preview session. Run:

```bash
git status --short --branch
git log --oneline --decorate -10
```

Expected: the tracked worktree is clean; no generated screenshot, `.next`, browser artifact, or AI Hot document is modified or staged.

- [ ] **Step 6: Final corrective commit only if needed**

If Step 1–4 required owned fixes, stage only the complete navigation-density allowlist below; unchanged paths are harmless and the unrelated AI Hot plan remains excluded:

```bash
git add -- \
  apps/web/src/app/layout.tsx \
  apps/web/src/components/daily-masthead.tsx \
  apps/web/src/components/daily-ranking.tsx \
  apps/web/src/components/direction-index.tsx \
  apps/web/src/components/history-index-page.tsx \
  apps/web/src/components/history-report-page.tsx \
  apps/web/src/components/home-page.tsx \
  apps/web/src/components/period-ranking-page.tsx \
  apps/web/src/components/ranking-tags.tsx \
  apps/web/src/components/repository-row.tsx \
  apps/web/src/components/site-footer.tsx \
  apps/web/src/components/site-header.tsx \
  apps/web/src/components/site-navigation.tsx \
  apps/web/src/components/source-pulse.tsx \
  apps/web/src/components/top-story-card.tsx \
  apps/web/src/lib/daily-ranking.ts \
  apps/web/src/styles/globals.css \
  apps/web/test/daily-ranking.test.ts \
  apps/web/test/home-page.test.tsx \
  apps/web/test/period-pages.test.tsx \
  apps/web/test/site-navigation.test.tsx \
  apps/web/e2e/site.spec.ts \
  apps/web/e2e/accessibility.spec.ts
git commit -m "fix: close navigation density verification gaps"
```

If no fixes were required, do not create an empty commit.

---

## Plan Self-Review Checklist

- Spec coverage: canonical ranking, source-summary merge, three responsive navigation modes, period dedupe, direction/footer cleanup, accessibility, and full verification all map to Tasks 1–8.
- Placeholder scan: the plan contains no deferred implementation placeholders; every conditional verification commit has an explicit staging allowlist.
- Type consistency: `DailyRankingTagId`, `DailyRankingFilter`, `DailyRankingTagModel`, `DailyRankingItemModel`, `buildDailyRankingItems`, and `SiteNavigation` use the same names across producer and consumer tasks.
- Scope check: all tasks modify the `apps/web` consumer only; the AI Hot integration plan, core schema, worker, scoring, and artifacts remain outside scope.
