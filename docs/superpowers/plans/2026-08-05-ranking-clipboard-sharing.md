# Ranking Clipboard Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click, group-friendly plain-text copying to the daily, period, and historical rankings, with every GitHub project URL and the current ranking page URL.

**Architecture:** Keep formatting in a pure `ranking-share` module that consumes existing ranking ViewModels, and keep browser clipboard behavior in one small Client Component backed by a focused clipboard helper. Daily filtering remains inside the existing `DailyRanking` client boundary; period and history server components pass preformatted text into the same copy control.

**Tech Stack:** Next.js 16.3 App Router static export, React 19.2, TypeScript 7, Vitest 4 + Testing Library, Playwright 1.62, Lucide React, existing CSS design tokens.

## Global Constraints

- Cover the homepage daily ranking, all 7/30/90/180-day rankings, and every historical daily report page.
- The homepage copies only the current filter result while retaining original overall ranks.
- Every copied item contains rank, repository id, `githubUrl`, and one recommendation or period-performance line.
- The final non-empty content is the browser's current page URL, including deployed base path, query, and meaningful hash.
- Do not modify `DailyReport`, ranking calculations, historical snapshot semantics, or internal repository-detail routing.
- Do not add dependencies, tracking parameters, short links, network requests, system share sheets, cards, modals, or toast libraries.
- Use Clipboard API first, then a temporary-textarea fallback; expose stable `复制榜单 / 已复制 / 复制失败` states.
- Preserve the existing square, newspaper-like visual language; the control stays at least 44x44px and does not resize between states.
- Before production code, read `apps/web/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and `apps/web/node_modules/next/dist/docs/01-app/02-guides/static-exports.md` as required by `apps/web/AGENTS.md`.
- Follow strict red-green-refactor: every production behavior starts with a test that fails for the expected missing behavior.

---

## File Map

- Create `apps/web/src/lib/ranking-share.ts`: pure daily, period, history, and final-page-URL text formatters.
- Create `apps/web/test/ranking-share.test.ts`: exact text-contract tests using real report fixtures.
- Create `apps/web/src/lib/clipboard.ts`: Clipboard API plus focus/selection-preserving fallback.
- Create `apps/web/src/components/copy-ranking-button.tsx`: one reusable stateful copy control.
- Create `apps/web/test/copy-ranking-button.test.tsx`: success, fallback, failure, cleanup, and timer behavior.
- Modify `apps/web/src/components/home-page.tsx`: pass report date into `DailyRanking`.
- Modify `apps/web/src/components/daily-ranking.tsx`: derive visible items and daily copy text from the active filter.
- Modify `apps/web/test/home-page.test.tsx`: lock current-filter copy behavior.
- Modify `apps/web/src/components/period-ranking-page.tsx`: add the period copy control.
- Modify `apps/web/src/components/history-report-page.tsx`: build historical copy text from the selected report.
- Modify `apps/web/src/components/ranking-section.tsx`: render an optional copy action only when supplied.
- Modify `apps/web/test/period-pages.test.tsx`: verify period/history integration and absence on unrelated sections.
- Modify `apps/web/test/detail-pages.test.tsx`: lock the non-goal that direction rankings have no copy action.
- Modify `apps/web/src/styles/globals.css`: stable heading action group and responsive copy control.
- Modify `apps/web/e2e/site.spec.ts`: exercise real clipboard contents on daily, period, and history routes.
- Modify `apps/web/e2e/responsive-boundaries.spec.ts`: verify control bounds and no horizontal overflow.

---

### Task 1: Pure Ranking Share Text Contract

**Files:**
- Create: `apps/web/src/lib/ranking-share.ts`
- Create: `apps/web/test/ranking-share.test.ts`

**Interfaces:**
- Consumes: `DailyRankingItemModel`, `PeriodRankingModel`, and `RepositoryCardModel`.
- Produces: `buildDailyRankingShareText(input): string`, `buildPeriodRankingShareText(ranking): string`, `buildHistoryRankingShareText(input): string`, and `appendRankingPageUrl(body, pageUrl): string`.

- [ ] **Step 1: Write failing text-contract tests**

Create `apps/web/test/ranking-share.test.ts` with real fixtures and focused assertions:

```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { beforeAll, describe, expect, it } from "vitest";
import { buildDailyRankingItems } from "../src/lib/daily-ranking";
import { buildPeriodRanking } from "../src/lib/period-ranking";
import {
  appendRankingPageUrl,
  buildDailyRankingShareText,
  buildHistoryRankingShareText,
  buildPeriodRankingShareText,
} from "../src/lib/ranking-share";
import { buildRankingItems } from "../src/lib/view-model";

let reports: DailyReport[];

beforeAll(async () => {
  const paths = [
    "../../artifacts/daily/2026-08-03-live/report.json",
    "../../artifacts/daily/2026-08-04/report.json",
  ];
  reports = await Promise.all(
    paths.map(async (path) =>
      DailyReportSchema.parse(
        JSON.parse(await readFile(resolve(process.cwd(), path), "utf8")) as unknown,
      ),
    ),
  );
});

describe("ranking share text", () => {
  it("formats only the supplied daily filter items with GitHub URLs", () => {
    const report = reports[1];
    if (report === undefined) throw new Error("missing daily report");
    const filtered = buildDailyRankingItems(report).filter((item) =>
      item.tags.some((tag) => tag.id === "new"),
    );
    const text = buildDailyRankingShareText({
      date: report.date,
      filterLabel: "新项目",
      items: filtered,
    });

    expect(text).toContain(`${report.date}｜筛选：新项目｜共 ${filtered.length} 项`);
    for (const item of filtered) {
      expect(text).toContain(`${String(item.rank).padStart(2, "0")} ${item.id}`);
      expect(text).toContain(`项目地址：${item.githubUrl}`);
      expect(text).toContain(`推荐理由：${item.recommendationReason.replace(/\s+/g, " ").trim()}`);
      expect(text).not.toContain(`项目地址：${item.href}`);
    }
  });

  it("formats honest period coverage and one performance line per item", () => {
    const ranking = buildPeriodRanking(reports, "7d");
    const text = buildPeriodRankingShareText(ranking);
    const leader = ranking.items[0];
    if (leader === undefined) throw new Error("missing period leader");

    expect(text).toContain(`${ranking.fromDate} 至 ${ranking.toDate}`);
    expect(text).toContain(`实际日报 ${ranking.reportCount} 份`);
    expect(text).toContain(`项目地址：${leader.githubUrl}`);
    expect(text).toContain(
      `周期表现：上榜 ${leader.appearanceCount}/${leader.reportCount} 日 · 平均发布分 ${leader.averageScore.toFixed(1)} · 最近名次 #${String(leader.latestDailyRank).padStart(2, "0")}`,
    );
  });

  it("formats a selected historical snapshot and normalizes embedded newlines", () => {
    const report = reports[0];
    if (report === undefined) throw new Error("missing history report");
    const items = buildRankingItems(report, report.rankings.overall);
    const changed = [{ ...items[0]!, recommendationReason: "第一行\n  第二行" }, ...items.slice(1)];
    const text = buildHistoryRankingShareText({ date: report.date, items: changed });

    expect(text).toContain("第一行 第二行");
    expect(text).toContain(`GitHub Picks｜${report.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日")}综合价值榜`);
  });

  it("keeps the current page URL as the final non-empty content", () => {
    const pageUrl = "https://example.test/github-picks/rankings/7d/?view=all#ranking";
    const text = appendRankingPageUrl("榜单正文\n", pageUrl);

    expect(text).toBe(`榜单正文\n\n完整榜单：\n${pageUrl}`);
    expect(text.trimEnd().endsWith(pageUrl)).toBe(true);
  });

  it("keeps empty rankings copyable", () => {
    expect(
      buildDailyRankingShareText({ date: "2026-08-05", filterLabel: "新项目", items: [] }),
    ).toBe("GitHub Picks｜今日综合价值榜\n2026-08-05｜筛选：新项目｜共 0 项");
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/ranking-share.test.ts
```

Expected: FAIL because `../src/lib/ranking-share` does not exist.

- [ ] **Step 3: Implement the minimal pure formatter**

Create `apps/web/src/lib/ranking-share.ts`:

```ts
import type { DailyRankingItemModel } from "./daily-ranking";
import type { PeriodRankingModel } from "./period-ranking";
import type { RepositoryCardModel } from "./view-model";

interface DailyRankingShareInput {
  date: string;
  filterLabel: string;
  items: readonly DailyRankingItemModel[];
}

interface HistoryRankingShareInput {
  date: string;
  items: readonly RepositoryCardModel[];
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function rankLabel(rank: number): string {
  return String(rank).padStart(2, "0");
}

function joinHeaderAndItems(header: string[], items: string[]): string {
  return items.length === 0 ? header.join("\n") : [...header, "", items.join("\n\n")].join("\n");
}

export function buildDailyRankingShareText({
  date,
  filterLabel,
  items,
}: DailyRankingShareInput): string {
  return joinHeaderAndItems(
    [
      "GitHub Picks｜今日综合价值榜",
      `${date}｜筛选：${filterLabel}｜共 ${items.length} 项`,
    ],
    items.map((item) =>
      [
        `${rankLabel(item.rank)} ${item.id}`,
        `项目地址：${item.githubUrl}`,
        `推荐理由：${oneLine(item.recommendationReason)}`,
      ].join("\n"),
    ),
  );
}

export function buildPeriodRankingShareText(ranking: PeriodRankingModel): string {
  return joinHeaderAndItems(
    [
      `GitHub Picks｜${ranking.label}持续价值榜`,
      `${ranking.fromDate} 至 ${ranking.toDate}｜实际日报 ${ranking.reportCount} 份｜共 ${ranking.items.length} 项`,
    ],
    ranking.items.map((item) =>
      [
        `${rankLabel(item.rank)} ${item.id}`,
        `项目地址：${item.githubUrl}`,
        `周期表现：上榜 ${item.appearanceCount}/${item.reportCount} 日 · 平均发布分 ${item.averageScore.toFixed(1)} · 最近名次 #${rankLabel(item.latestDailyRank)}`,
      ].join("\n"),
    ),
  );
}

export function buildHistoryRankingShareText({
  date,
  items,
}: HistoryRankingShareInput): string {
  const dateLabel = date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日");
  return joinHeaderAndItems(
    [`GitHub Picks｜${dateLabel}综合价值榜`, `历史日报｜共 ${items.length} 项`],
    items.map((item) =>
      [
        `${rankLabel(item.rank)} ${item.id}`,
        `项目地址：${item.githubUrl}`,
        `推荐理由：${oneLine(item.recommendationReason)}`,
      ].join("\n"),
    ),
  );
}

export function appendRankingPageUrl(body: string, pageUrl: string): string {
  return `${body.trimEnd()}\n\n完整榜单：\n${pageUrl.trim()}`;
}
```

- [ ] **Step 4: Run formatter tests and existing ranking model tests**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/ranking-share.test.ts test/daily-ranking.test.ts test/period-ranking.test.ts
```

Expected: all tests PASS with no warnings.

- [ ] **Step 5: Refactor only if the formatter duplicates behavior, then commit**

Run `git diff --check`, then:

```bash
git add apps/web/src/lib/ranking-share.ts apps/web/test/ranking-share.test.ts
git commit -m "feat(web): format ranking share text"
```

---

### Task 2: Clipboard Helper and Reusable Copy Control

**Files:**
- Create: `apps/web/src/lib/clipboard.ts`
- Create: `apps/web/src/components/copy-ranking-button.tsx`
- Create: `apps/web/test/copy-ranking-button.test.tsx`

**Interfaces:**
- Consumes: `appendRankingPageUrl(body, window.location.href)` from Task 1.
- Produces: `copyTextToClipboard(text): Promise<void>` and `<CopyRankingButton text: string />`.

- [ ] **Step 1: Read the local Next.js client-boundary and static-export docs**

Run:

```bash
sed -n '1,260p' apps/web/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
sed -n '1,260p' apps/web/node_modules/next/dist/docs/01-app/02-guides/static-exports.md
```

Expected: confirm that a small Client Component may be imported by server-rendered ranking components and that browser-only APIs execute only after interaction.

- [ ] **Step 2: Write failing clipboard behavior tests**

Create `apps/web/test/copy-ranking-button.test.tsx` with these cases:

```tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyRankingButton } from "../src/components/copy-ranking-button";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");

function setClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

function setExecCommand(value: boolean) {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: vi.fn(() => value),
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
  if (originalExecCommand) Object.defineProperty(document, "execCommand", originalExecCommand);
  else Reflect.deleteProperty(document, "execCommand");
});

describe("CopyRankingButton", () => {
  it("copies the body plus the current URL and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<CopyRankingButton text="榜单正文" />);

    fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
    await screen.findByRole("button", { name: "已复制" });
    expect(writeText).toHaveBeenCalledWith(
      `榜单正文\n\n完整榜单：\n${window.location.href}`,
    );
  });

  it("falls back to a temporary textarea and restores focus", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    setExecCommand(true);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const previous = document.createElement("button");
    document.body.append(previous);
    previous.focus();
    render(<CopyRankingButton text="榜单正文" />);

    fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
    await screen.findByRole("button", { name: "已复制" });
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("[data-ranking-copy-fallback]")).toBeNull();
    expect(document.activeElement).toBe(previous);
    previous.remove();
  });

  it("reports a retryable error when both copy paths fail", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    setExecCommand(false);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<CopyRankingButton text="榜单正文" />);

    fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
    expect(await screen.findByRole("button", { name: "复制失败" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "复制失败" }));
    await waitFor(() => expect(document.execCommand).toHaveBeenCalledTimes(2));
  });

  it("restores the idle label and clears the timer on unmount", async () => {
    vi.useFakeTimers();
    setClipboard(vi.fn().mockResolvedValue(undefined));
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const view = render(<CopyRankingButton text="榜单正文" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "已复制" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("button", { name: "复制榜单" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
    await act(async () => Promise.resolve());
    view.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the component test and verify RED**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/copy-ranking-button.test.tsx
```

Expected: FAIL because `copy-ranking-button.tsx` does not exist.

- [ ] **Step 4: Implement Clipboard API and fallback behavior**

Create `apps/web/src/lib/clipboard.ts`:

```ts
function fallbackCopyText(text: string): boolean {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.dataset.rankingCopyFallback = "true";
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.append(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    return typeof document.execCommand === "function" && document.execCommand("copy");
  } finally {
    textarea.remove();
    active?.focus({ preventScroll: true });
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
    window.scrollTo(scrollX, scrollY);
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue to the local fallback.
    }
  }
  if (fallbackCopyText(text)) return;
  throw new Error("clipboard copy failed");
}
```

- [ ] **Step 5: Implement the stable stateful button**

Create `apps/web/src/components/copy-ranking-button.tsx`:

```tsx
"use client";

import { Check, CircleAlert, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "../lib/clipboard";
import { appendRankingPageUrl } from "../lib/ranking-share";

type CopyStatus = "idle" | "success" | "error";

export interface CopyRankingButtonProps {
  text: string;
}

const STATUS = {
  idle: { label: "复制榜单", Icon: Copy },
  success: { label: "已复制", Icon: Check },
  error: { label: "复制失败", Icon: CircleAlert },
} as const;

export function CopyRankingButton({ text }: CopyRankingButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<number | null>(null);

  function clearResetTimer() {
    if (resetTimer.current === null) return;
    window.clearTimeout(resetTimer.current);
    resetTimer.current = null;
  }

  useEffect(() => clearResetTimer, []);

  async function handleCopy() {
    clearResetTimer();
    try {
      await copyTextToClipboard(appendRankingPageUrl(text, window.location.href));
      setStatus("success");
      resetTimer.current = window.setTimeout(() => {
        setStatus("idle");
        resetTimer.current = null;
      }, 2_000);
    } catch {
      setStatus("error");
    }
  }

  const { label, Icon } = STATUS[status];
  return (
    <div className="ranking-copy">
      <button
        className="ranking-copy__button"
        data-state={status}
        type="button"
        onClick={handleCopy}
      >
        <Icon aria-hidden="true" size={16} />
        <span>{label}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {status === "success" ? "榜单内容已复制到剪贴板" : null}
        {status === "error" ? "复制失败，请重试" : null}
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Run RED-to-GREEN verification and commit**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/copy-ranking-button.test.tsx test/ranking-share.test.ts
pnpm --filter @github-picks/web typecheck
git diff --check
```

Expected: all tests and typecheck PASS with no whitespace errors. Then:

```bash
git add apps/web/src/lib/clipboard.ts apps/web/src/components/copy-ranking-button.tsx apps/web/test/copy-ranking-button.test.tsx
git commit -m "feat(web): add ranking copy control"
```

---

### Task 3: Daily Ranking Current-Filter Integration

**Files:**
- Modify: `apps/web/src/components/home-page.tsx:42-67`
- Modify: `apps/web/src/components/daily-ranking.tsx:10-79`
- Modify: `apps/web/test/home-page.test.tsx:1-118`

**Interfaces:**
- Consumes: `<CopyRankingButton text />` and `buildDailyRankingShareText({ date, filterLabel, items })`.
- Produces: `<DailyRanking items date />` whose copied set is exactly the current visible filter set.

- [ ] **Step 1: Add a failing homepage filter-copy test**

Add `waitFor` and `vi` to imports in `apps/web/test/home-page.test.tsx`. Replace `afterEach(cleanup)` with this exact descriptor-safe cleanup:

```tsx
const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
});
```

Then add:

```tsx
it("copies only the active specialty filter with every GitHub URL", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<HomePage report={report} />);
  fireEvent.click(screen.getByRole("button", { name: "新项目" }));
  fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));

  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  const copied = String(writeText.mock.calls[0]?.[0]);
  const expected = new Set(report.rankings.newProjects);
  for (const repository of report.repositories) {
    if (expected.has(repository.snapshot.fullName)) {
      expect(copied).toContain(`项目地址：${repository.snapshot.url}`);
    } else {
      expect(copied).not.toContain(`项目地址：${repository.snapshot.url}`);
    }
  }
  expect(copied).toContain(`筛选：新项目｜共 ${expected.size} 项`);
  expect(copied.trimEnd()).toMatch(/http:\/\/localhost(?::\d+)?\/$/);
});
```

In the shared `afterEach`, delete the configurable test clipboard after `cleanup()` so other tests do not inherit it.

- [ ] **Step 2: Run the homepage test and verify RED**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/home-page.test.tsx
```

Expected: FAIL because there is no “复制榜单” button and `DailyRanking` has no date prop.

- [ ] **Step 3: Pass the report date and derive share text from visible items**

Change the homepage call to:

```tsx
<DailyRanking date={report.date} items={items} />
```

In `daily-ranking.tsx`, add the prop and imports, derive one visible array, and replace the count-only header cell:

```tsx
import { buildDailyRankingShareText } from "../lib/ranking-share";
import { CopyRankingButton } from "./copy-ranking-button";

export interface DailyRankingProps {
  date: string;
  items: DailyRankingItemModel[];
}

export function DailyRanking({ date, items }: DailyRankingProps) {
  const [filter, setFilter] = useState<DailyRankingFilter>("all");
  const matches = (item: DailyRankingItemModel) =>
    filter === "all" || item.tags.some((tag) => tag.id === filter);
  const visibleItems = items.filter(matches);
  const filterLabel =
    filter === "all"
      ? "全部"
      : DAILY_RANKING_TAGS.find((tag) => tag.id === filter)?.label ?? "全部";
  const shareText = buildDailyRankingShareText({
    date,
    filterLabel,
    items: visibleItems,
  });
  const leaders = items.filter((item) => item.rank <= 3);
  const rest = items.filter((item) => item.rank > 3);
  const hasMatches = visibleItems.length > 0;

  <div className="section-heading__actions">
    <span className="section-heading__count">{items.length} PICKS</span>
    <CopyRankingButton text={shareText} />
  </div>;
}
```

Do not reorder or remove existing ranking nodes; hidden state still uses `matches(item)` so the DOM uniqueness contract remains unchanged.

- [ ] **Step 4: Run homepage, ranking, and component tests**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/home-page.test.tsx test/daily-ranking.test.ts test/copy-ranking-button.test.tsx
```

Expected: all tests PASS; the current filter controls both visible nodes and copied items.

- [ ] **Step 5: Commit the daily integration**

Run `git diff --check`, then:

```bash
git add apps/web/src/components/home-page.tsx apps/web/src/components/daily-ranking.tsx apps/web/test/home-page.test.tsx
git commit -m "feat(web): copy filtered daily ranking"
```

---

### Task 4: Period and Historical Ranking Integration

**Files:**
- Modify: `apps/web/src/components/period-ranking-page.tsx:1-111`
- Modify: `apps/web/src/components/history-report-page.tsx:1-142`
- Modify: `apps/web/src/components/ranking-section.tsx:1-49`
- Modify: `apps/web/test/period-pages.test.tsx:1-125`
- Modify: `apps/web/test/detail-pages.test.tsx:20-40`

**Interfaces:**
- Consumes: period/history formatters and `<CopyRankingButton text />`.
- Produces: a copy action on period and historical rankings while leaving other `RankingSection` consumers unchanged.

- [ ] **Step 1: Write failing period/history integration tests**

In `apps/web/test/period-pages.test.tsx`, add `fireEvent`, `waitFor`, and `vi` to the imports. Replace `afterEach(cleanup)` with the same descriptor-safe cleanup used in Task 3, then add:

```tsx
it("copies period performance with project and current-page links", async () => {
  const ranking = buildPeriodRanking(reports, "7d");
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<PeriodRankingPage ranking={ranking} />);

  fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  const copied = String(writeText.mock.calls[0]?.[0]);
  for (const item of ranking.items) expect(copied).toContain(`项目地址：${item.githubUrl}`);
  expect(copied).toContain("周期表现：");
});

it("copies the selected historical snapshot", async () => {
  const archive = buildReportArchive(reports);
  const report = reports[0];
  if (report === undefined) throw new Error("missing history report");
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(
    <HistoryReportPage
      report={report}
      archive={archive}
      previousDate={null}
      nextDate="2026-08-04"
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "复制榜单" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  const [year, month, day] = report.date.split("-");
  expect(String(writeText.mock.calls[0]?.[0])).toContain(
    `${year}年${month}月${day}日综合价值榜`,
  );
});
```

- [ ] **Step 2: Run the period page tests and verify RED**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/period-pages.test.tsx
```

Expected: FAIL because neither period nor history renders a copy button.

- [ ] **Step 3: Add the period action**

In `period-ranking-page.tsx`, import the formatter and button, compute `const shareText = buildPeriodRankingShareText(ranking)`, and replace the count-only header cell with:

```tsx
<div className="section-heading__actions">
  <span className="section-heading__count">
    {ranking.items.length} PICKS
  </span>
  <CopyRankingButton text={shareText} />
</div>
```

- [ ] **Step 4: Add an optional history action without affecting direction pages**

Extend `RankingSectionProps` and the heading in `ranking-section.tsx`:

```tsx
export interface RankingSectionProps {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  items: RepositoryCardModel[];
  compact?: boolean;
  testIdPrefix?: string;
  shareText?: string;
}

{shareText ? (
  <div className="section-heading__actions">
    <span className="section-heading__count">{items.length} PICKS</span>
    <CopyRankingButton text={shareText} />
  </div>
) : (
  <span className="section-heading__count">{items.length} PICKS</span>
)}
```

In `history-report-page.tsx`, build and pass the text:

```tsx
const shareText = buildHistoryRankingShareText({
  date: report.date,
  items: overall,
});

<RankingSection
  id="history-overall"
  eyebrow={`DAILY VALUE / ${report.date}`}
  title="当日综合价值榜"
  description="以下顺序完整保留该日发布结果；项目详情链接展示最新公开档案，本页数值仍是历史快照。"
  items={overall}
  testIdPrefix="history-row"
  shareText={shareText}
/>
```

Import `CopyRankingButton` in `ranking-section.tsx` and `buildHistoryRankingShareText` in `history-report-page.tsx`. Do not pass `shareText` from direction pages.

In the existing `detail-pages.test.tsx` direction-ranking test, add:

```tsx
expect(
  screen.queryByRole("button", { name: "复制榜单" }),
).toBeNull();
```

- [ ] **Step 5: Run all page component tests and commit**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/period-pages.test.tsx test/detail-pages.test.tsx test/home-page.test.tsx
pnpm --filter @github-picks/web typecheck
git diff --check
```

Expected: all tests and typecheck PASS; direction pages still have no copy action. Then:

```bash
git add apps/web/src/components/period-ranking-page.tsx apps/web/src/components/history-report-page.tsx apps/web/src/components/ranking-section.tsx apps/web/test/period-pages.test.tsx apps/web/test/detail-pages.test.tsx
git commit -m "feat(web): copy period and history rankings"
```

---

### Task 5: Responsive Styling, Browser Clipboard Proof, and Full Gates

**Files:**
- Modify: `apps/web/src/styles/globals.css:466-530, 3038-3070`
- Modify: `apps/web/e2e/site.spec.ts:1-230`
- Modify: `apps/web/e2e/responsive-boundaries.spec.ts:1-180`

**Interfaces:**
- Consumes: `.section-heading__actions`, `.ranking-copy`, `.ranking-copy__button`, and `data-state` emitted by Tasks 2-4.
- Produces: stable responsive control layout plus live browser proof of copied project/page URLs.

- [ ] **Step 1: Add failing browser tests for clipboard contents and control bounds**

Append to `apps/web/e2e/site.spec.ts`:

```ts
async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test("daily copy follows the active filter and ends with the current page", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3100",
  });
  await page.goto("/");
  await page.getByRole("button", { name: "新项目" }).click();
  const visibleIds = await page
    .locator("[data-repository-id]:visible")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.repositoryId ?? ""));

  await page.getByRole("button", { name: "复制榜单" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  const copied = await readClipboard(page);
  for (const id of visibleIds) expect(copied).toContain(`项目地址：https://github.com/${id}`);
  expect(copied).toContain(`筛选：新项目｜共 ${visibleIds.length} 项`);
  expect(copied.trimEnd().endsWith(page.url())).toBe(true);
});

test("period and history copies use their exact current routes", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3100",
  });
  for (const route of ["/rankings/7d/", "/history/2026-08-03/"]) {
    await page.goto(route);
    await page.getByRole("button", { name: "复制榜单" }).click();
    await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
    const copied = await readClipboard(page);
    expect(copied).toContain("项目地址：https://github.com/");
    expect(copied.trimEnd().endsWith(page.url())).toBe(true);
  }
});
```

Append this control-boundary test to `responsive-boundaries.spec.ts`:

```ts
test("ranking copy control keeps stable 44px bounds without overflow", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3100",
  });

  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const heading = page.locator(".daily-ranking .section-heading");
    const button = page.getByRole("button", { name: "复制榜单" });
    const headingBox = await heading.boundingBox();
    const before = await button.boundingBox();
    if (headingBox === null || before === null) {
      throw new Error(`missing copy control bounds at ${width}px`);
    }

    expect(before.height).toBeGreaterThanOrEqual(44);
    expect(before.x).toBeGreaterThanOrEqual(headingBox.x);
    expect(before.x + before.width).toBeLessThanOrEqual(
      headingBox.x + headingBox.width,
    );
    expect(before.y).toBeGreaterThanOrEqual(headingBox.y);
    expect(before.y + before.height).toBeLessThanOrEqual(
      headingBox.y + headingBox.height,
    );

    await button.click();
    await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
    const after = await page.getByRole("button", { name: "已复制" }).boundingBox();
    if (after === null) throw new Error(`missing success bounds at ${width}px`);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(0.5);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
```

- [ ] **Step 2: Run the new E2E tests and verify RED for styling**

Run:

```bash
pnpm --filter @github-picks/web exec playwright test e2e/site.spec.ts e2e/responsive-boundaries.spec.ts --project=chromium-desktop
```

Expected: clipboard behavior may pass, but the boundary test FAILS until the heading action group receives responsive styling.

- [ ] **Step 3: Add restrained action-group styles**

Add near existing `.section-heading__count` rules in `globals.css`:

```css
.section-heading__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-self: end;
}

.section-heading__actions .section-heading__count {
  justify-self: auto;
}

.ranking-copy__button {
  display: inline-flex;
  width: 7.75rem;
  min-height: 44px;
  gap: 0.45rem;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.75rem;
  color: var(--ink);
  background: transparent;
  border: 1px solid var(--ink);
  font-family: var(--mono);
  font-size: 0.78rem;
  cursor: pointer;
  transition: color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.ranking-copy__button:hover {
  color: var(--paper);
  background: var(--ink);
}

.ranking-copy__button[data-state="success"] {
  box-shadow: inset 0 -4px 0 var(--signal);
}

.ranking-copy__button[data-state="error"] {
  color: var(--vermilion);
  border-color: var(--vermilion);
}

.ranking-copy__button:focus-visible {
  outline: 3px solid var(--signal);
  outline-offset: 2px;
}
```

Inside the existing `@media (max-width: 760px)` block add:

```css
.section-heading__actions {
  justify-self: start;
}
```

Do not add border radius, shadows outside the success inset, a toast, or another accent color.

- [ ] **Step 4: Run focused component and browser GREEN checks**

Run:

```bash
pnpm --filter @github-picks/web exec vitest run test/ranking-share.test.ts test/copy-ranking-button.test.tsx test/home-page.test.tsx test/period-pages.test.tsx
pnpm --filter @github-picks/web exec playwright test e2e/site.spec.ts e2e/responsive-boundaries.spec.ts
```

Expected: all focused Vitest and both desktop/mobile Playwright projects PASS.

- [ ] **Step 5: Run full repository quality gates and base-path build**

Run fresh commands and inspect complete output:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
NEXT_PUBLIC_BASE_PATH=/github-picks pnpm --filter @github-picks/web build
git diff --check
```

Expected: every command exits 0; no test failures, type errors, lint errors, build errors, or whitespace errors.

- [ ] **Step 6: Capture and inspect real desktop/mobile browser evidence**

With the dev server at `http://127.0.0.1:3100`, capture `/`, `/rankings/7d/`, and `/history/2026-08-03/` at `1440x1000` and `390x844`. Inspect that:

- the copy control is visible before the ranking;
- text and icon fit in the fixed-width button in all states;
- title, `PICKS` count, and button do not overlap;
- the page has no horizontal overflow;
- clicking copies nonblank text, each visible project's GitHub URL, and the exact current page URL last.

Do not commit screenshots or generated `apps/web/out` changes.

- [ ] **Step 7: Review the final diff and commit the UI/browser acceptance**

Run:

```bash
git status --short
git diff --stat
git diff -- apps/web/src/styles/globals.css apps/web/e2e/site.spec.ts apps/web/e2e/responsive-boundaries.spec.ts
```

Confirm no unrelated or generated files are included, then:

```bash
git add apps/web/src/styles/globals.css apps/web/e2e/site.spec.ts apps/web/e2e/responsive-boundaries.spec.ts
git commit -m "test(web): verify ranking copy workflow"
```

After the commit, rerun `git status --short --branch` and report the exact verification evidence. Do not push, merge, or deploy without separate user authorization.
