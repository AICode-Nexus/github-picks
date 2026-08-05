# GitHub Picks Agent Tutorial Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a globally discoverable `/agent/` tutorial that lets visitors install, verify, and use the published GitHub Picks Agent Skill.

**Architecture:** Keep the tutorial content statically rendered through a server component and isolate clipboard access in one small client component. Reuse the existing navigation activation model, editorial layout tokens, static export, and test stack; do not change the report pipeline or public API.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 7, Lucide React, Vitest with Testing Library, Playwright, plain CSS.

## Global Constraints

- The canonical route is `/agent/` and must work under the production `/github-picks` base path.
- The primary install command is exactly `DISABLE_TELEMETRY=1 npx -y skills@1.5.21 add AICode-Nexus/github-picks --skill github-picks --agent codex --yes --copy`.
- The tutorial only presents the shipped Agent Skill and anonymous read-only REST API v1; it must not claim MCP, RSS, account, private-repository, write, or push capabilities.
- The page must remain useful without JavaScript: all commands and prompts stay visible and selectable.
- Do not add runtime dependencies or change the `DailyReport`, ranking, scoring, or public API contracts.
- Keep public ranking order authoritative; explain that the Agent may produce only a filtered, order-preserving subset.
- Preserve the current paper, ink, vermilion, signal-green, serif, sans, and mono token system.
- Use section dividers and layout grids rather than a dashboard-card mosaic or nested cards.
- Support keyboard operation, `prefers-reduced-motion`, Axe serious/critical checks, and 320 px through 1440 px viewports without page-level horizontal overflow.

---

## File Map

- Create `apps/web/src/app/agent/page.tsx`: static route and route metadata.
- Create `apps/web/src/components/agent-tutorial-page.tsx`: server-rendered tutorial content and exported copy constants.
- Create `apps/web/src/components/copy-command-button.tsx`: clipboard-only client boundary and status feedback.
- Create `apps/web/test/agent-tutorial-page.test.tsx`: tutorial content contract.
- Create `apps/web/test/copy-command-button.test.tsx`: clipboard success and failure behavior.
- Modify `apps/web/src/components/site-navigation.tsx`: global Agent navigation entry.
- Modify `apps/web/test/site-navigation.test.tsx`: navigation discoverability and active state.
- Modify `apps/web/src/styles/globals.css`: tutorial layout, code surfaces, copy controls, and breakpoint rules.
- Modify `apps/web/e2e/site.spec.ts`: discoverability, copy, and responsive workflow.
- Modify `apps/web/e2e/accessibility.spec.ts`: add `/agent/` to the Axe route set.
- Modify `apps/web/e2e/responsive-boundaries.spec.ts`: assert code and tutorial layout boundaries at 320 px and 390 px.
- Modify `README.md`: add `/agent/` to the documented website routes.

### Task 1: Make Agent Access Globally Discoverable

**Files:**
- Modify: `apps/web/test/site-navigation.test.tsx`
- Modify: `apps/web/src/components/site-navigation.tsx`
- Modify: `apps/web/src/styles/globals.css`

**Interfaces:**
- Consumes: `isNavigationActive(pathname: string, href: string): boolean`.
- Produces: a primary navigation link with accessible name `Agent`, `href="/agent/"`, and route-aware `aria-current`.

- [ ] **Step 1: Write the failing navigation tests**

Extend the first navigation test and add an active-route test:

```tsx
expect(
  within(navigation)
    .getByRole("link", { name: "Agent" })
    .getAttribute("href"),
).toBe("/agent/");

it("marks the Agent tutorial active without rendering homepage anchors", () => {
  pathname = "/agent/";
  render(<SiteNavigation />);

  expect(
    screen.getByRole("link", { name: "Agent" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen.getByRole("link", { name: "今日" }).getAttribute("aria-current"),
  ).toBeNull();
  expect(screen.queryByRole("link", { name: "今日榜单" })).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```bash
pnpm --filter @github-picks/web test -- site-navigation.test.tsx
```

Expected: FAIL because no link named `Agent` exists.

- [ ] **Step 3: Add the navigation entry**

Import `Bot` from Lucide and add this after the `sources` link:

```tsx
<p className="site-navigation__section-label">接入</p>
<Link
  className="site-navigation__item"
  href="/agent/"
  aria-current={isActive("/agent/") ? "page" : undefined}
>
  <Bot aria-hidden="true" size={18} />
  <span>Agent</span>
</Link>
```

Update the fixed navigation grids for the fifth control:

```css
@media (min-width: 761px) and (max-width: 1359px) {
  .site-navigation__primary {
    grid-template-columns: 1fr 4fr repeat(3, 1fr);
  }
}

@media (max-width: 760px) {
  .site-navigation__primary {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
```

- [ ] **Step 4: Run the navigation test and formatting check**

Run:

```bash
pnpm --filter @github-picks/web test -- site-navigation.test.tsx
pnpm exec biome check apps/web/src/components/site-navigation.tsx apps/web/test/site-navigation.test.tsx apps/web/src/styles/globals.css
```

Expected: navigation tests PASS and Biome reports no diagnostics.

- [ ] **Step 5: Commit the navigation slice**

```bash
git add apps/web/src/components/site-navigation.tsx apps/web/test/site-navigation.test.tsx apps/web/src/styles/globals.css
git commit -m "feat(web): add Agent tutorial navigation"
```

### Task 2: Publish the Static Tutorial Route and Content Contract

**Files:**
- Create: `apps/web/test/agent-tutorial-page.test.tsx`
- Create: `apps/web/src/components/agent-tutorial-page.tsx`
- Create: `apps/web/src/app/agent/page.tsx`

**Interfaces:**
- Produces: `PROJECT_INSTALL_COMMAND`, `GLOBAL_INSTALL_COMMAND`, `VERIFY_PROMPT`, and the `AgentTutorialPage` React component.
- Produces: route metadata title `Agent 接入` and a default route component for `/agent/`.

- [ ] **Step 1: Write the failing tutorial content test**

Create `apps/web/test/agent-tutorial-page.test.tsx`:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  AgentTutorialPage,
  PROJECT_INSTALL_COMMAND,
  VERIFY_PROMPT,
} from "../src/components/agent-tutorial-page";

afterEach(cleanup);

describe("Agent tutorial page", () => {
  it("renders the install, restart, and first-query path", () => {
    render(<AgentTutorialPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "让 Agent 直接使用 GitHub Picks",
      }),
    ).toBeTruthy();
    expect(screen.getByText(PROJECT_INSTALL_COMMAND)).toBeTruthy();
    expect(screen.getByText(VERIFY_PROMPT)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "新开会话" })).toBeTruthy();
  });

  it("states the shipped capabilities and public-data boundary", () => {
    render(<AgentTutorialPage />);

    const capabilities = screen.getByRole("list", { name: "Agent 能力" });
    for (const label of [
      "最新日报",
      "周期持续价值榜",
      "五个技术方向",
      "仓库证据与历史观测",
    ]) {
      expect(within(capabilities).getByText(label)).toBeTruthy();
    }

    expect(screen.getByText(/不访问私有仓库/)).toBeTruthy();
    expect(screen.getByText(/不重新评分或按 Star 改序/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Skill 源码" }).getAttribute("href"),
    ).toContain("/.agents/skills/github-picks");
    expect(
      screen.getByRole("link", { name: "API 状态" }).getAttribute("href"),
    ).toBe("https://aicode-nexus.github.io/github-picks/api/v1/meta.json");
    expect(screen.queryByText(/^MCP$/)).toBeNull();
    expect(screen.queryByText(/^RSS$/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```bash
pnpm --filter @github-picks/web test -- agent-tutorial-page.test.tsx
```

Expected: FAIL because `agent-tutorial-page.tsx` does not exist.

- [ ] **Step 3: Implement the static tutorial component**

Create `apps/web/src/components/agent-tutorial-page.tsx` with fixed public content:

```tsx
import { Bot, CalendarRange, Compass, Database, GitCompareArrows } from "lucide-react";
import Link from "next/link";

export const PROJECT_INSTALL_COMMAND =
  "DISABLE_TELEMETRY=1 npx -y skills@1.5.21 add AICode-Nexus/github-picks --skill github-picks --agent codex --yes --copy";
export const GLOBAL_INSTALL_COMMAND = `${PROJECT_INSTALL_COMMAND} --global`;
export const VERIFY_PROMPT =
  "使用 $github-picks 告诉我今天最值得关注的 5 个 GitHub 开源项目，并说明理由和风险。";

const EXAMPLE_PROMPTS = [
  VERIFY_PROMPT,
  "近 30 天安全与软件供应链方向有哪些持续值得看的项目？不要按 Star 重排。",
  "比较两个已收录仓库的工程成熟度、置信度和公开风险证据。",
] as const;

const CAPABILITIES = [
  { label: "最新日报", detail: "读取最新 live 日报与信源健康状态。", icon: Database },
  { label: "周期持续价值榜", detail: "查询 7、30、90 与 180 天真实覆盖窗口。", icon: CalendarRange },
  { label: "五个技术方向", detail: "按 AI、数据、应用、基础设施与安全保序筛选。", icon: Compass },
  { label: "仓库证据与历史观测", detail: "比较已收录项目的公开事实、风险与历史。", icon: GitCompareArrows },
] as const;

const RESOURCE_LINKS = [
  {
    label: "Skill 源码",
    href: "https://github.com/AICode-Nexus/github-picks/tree/master/.agents/skills/github-picks",
  },
  {
    label: "API 状态",
    href: "https://aicode-nexus.github.io/github-picks/api/v1/meta.json",
  },
  {
    label: "接入运行手册",
    href: "https://github.com/AICode-Nexus/github-picks/blob/master/docs/runbooks/github-picks-agent-api.md",
  },
] as const;

export function AgentTutorialPage() {
  return (
    <main id="main-content">
      <div className="page-shell inner-page agent-page">
        <nav className="breadcrumbs" aria-label="面包屑">
          <Link href="/">今日榜单</Link>
          <span aria-hidden="true">/</span>
          <span>Agent 接入</span>
        </nav>

        <header className="agent-hero">
          <div className="agent-hero__copy">
            <p className="eyebrow">AGENT ACCESS / PUBLIC API V1</p>
            <h1>让 Agent 直接使用 GitHub Picks</h1>
            <p>安装公开 Skill，直接查询最新日报、周期榜、技术方向和已收录仓库证据。</p>
          </div>
          <ul className="agent-status-list" aria-label="接入状态">
            <li>匿名只读</li>
            <li>无需 API Key</li>
            <li>公开数据</li>
            <li><Bot aria-hidden="true" size={17} /> Skill 已发布</li>
          </ul>
        </header>

        <section className="agent-section" aria-labelledby="agent-install-title">
          <header className="agent-section__heading">
            <p className="eyebrow">QUICK START</p>
            <h2 id="agent-install-title">三步开始</h2>
          </header>
          <ol className="agent-steps">
            <li>
              <span className="agent-step__number">01</span>
              <h3>安装 Skill</h3>
              <p>在项目目录执行命令，安装前可先审阅公开 Skill 文件。</p>
              <div className="agent-command"><pre><code>{PROJECT_INSTALL_COMMAND}</code></pre></div>
              <details className="agent-global-install">
                <summary>改为用户级安装</summary>
                <pre><code>{GLOBAL_INSTALL_COMMAND}</code></pre>
              </details>
            </li>
            <li>
              <span className="agent-step__number">02</span>
              <h3>新开会话</h3>
              <p>多数 Agent 只在会话开始时扫描 Skill。安装后关闭旧会话，再新建一个。</p>
            </li>
            <li>
              <span className="agent-step__number">03</span>
              <h3>开始提问</h3>
              <p>{VERIFY_PROMPT}</p>
            </li>
          </ol>
        </section>

        <section className="agent-section" aria-labelledby="agent-examples-title">
          <header className="agent-section__heading">
            <p className="eyebrow">ASK DIRECTLY</p>
            <h2 id="agent-examples-title">装好后这样问</h2>
          </header>
          <ol className="agent-example-list">
            {EXAMPLE_PROMPTS.map((prompt, index) => (
              <li key={prompt}><span>{String(index + 1).padStart(2, "0")}</span><p>{prompt}</p></li>
            ))}
          </ol>
        </section>

        <section className="agent-section" aria-labelledby="agent-capabilities-title">
          <header className="agent-section__heading">
            <p className="eyebrow">PUBLIC INTELLIGENCE</p>
            <h2 id="agent-capabilities-title">Agent 能做什么</h2>
          </header>
          <ul className="agent-capabilities" aria-label="Agent 能力">
            {CAPABILITIES.map(({ label, detail, icon: Icon }) => (
              <li key={label}><Icon aria-hidden="true" size={20} /><div><h3>{label}</h3><p>{detail}</p></div></li>
            ))}
          </ul>
        </section>

        <section className="agent-boundary" aria-labelledby="agent-boundary-title">
          <div>
            <p className="eyebrow">READ-ONLY BOUNDARY</p>
            <h2 id="agent-boundary-title">公开数据，有明确边界</h2>
            <p>Skill 只读取 GitHub Picks 固定域名下的匿名只读 API，不访问私有仓库，不要求 Token，也不重新评分或按 Star 改序。</p>
          </div>
          <aside>
            <h3>没有发现 Skill？</h3>
            <ol><li>关闭旧会话并新建会话。</li><li>确认 Agent 发现了 `github-picks`。</li><li>仍失败时审阅安装路径和公开运行手册。</li></ol>
          </aside>
          <nav className="agent-resources" aria-label="Agent 接入资源">
            {RESOURCE_LINKS.map((resource) => (
              <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer">
                {resource.label}
              </a>
            ))}
          </nav>
        </section>
      </div>
    </main>
  );
}
```

The internal breadcrumb uses Next `Link` for base-path compatibility. The three external resources stay normal anchors with `target="_blank"` and `rel="noreferrer"`.

- [ ] **Step 4: Add the static App Router page**

Create `apps/web/src/app/agent/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AgentTutorialPage } from "../../components/agent-tutorial-page";

export const metadata: Metadata = {
  title: "Agent 接入",
  description: "安装 GitHub Picks Agent Skill，查询最新开源日报、周期榜、技术方向和仓库证据。",
};

export default function Page() {
  return <AgentTutorialPage />;
}
```

- [ ] **Step 5: Run the focused component and route type checks**

Run:

```bash
pnpm --filter @github-picks/web test -- agent-tutorial-page.test.tsx
pnpm --filter @github-picks/web typecheck
```

Expected: tutorial tests PASS and TypeScript reports no errors.

- [ ] **Step 6: Commit the static page**

```bash
git add apps/web/src/app/agent/page.tsx apps/web/src/components/agent-tutorial-page.tsx apps/web/test/agent-tutorial-page.test.tsx
git commit -m "feat(web): add Agent tutorial content"
```

### Task 3: Add Resilient Copy Controls

**Files:**
- Create: `apps/web/test/copy-command-button.test.tsx`
- Create: `apps/web/src/components/copy-command-button.tsx`
- Modify: `apps/web/src/components/agent-tutorial-page.tsx`

**Interfaces:**
- Produces: `CopyCommandButtonProps` and the `CopyCommandButton` React component.
- Consumes: `PROJECT_INSTALL_COMMAND`, `GLOBAL_INSTALL_COMMAND`, and each example prompt.

- [ ] **Step 1: Write failing clipboard success and failure tests**

Create `apps/web/test/copy-command-button.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyCommandButton } from "../src/components/copy-command-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setClipboard(writeText: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("CopyCommandButton", () => {
  it("copies the exact value and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<CopyCommandButton value="install exact" label="复制安装命令" />);

    fireEvent.click(screen.getByRole("button", { name: "复制安装命令" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("install exact"));
    expect(screen.getByText("已复制")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("已复制");
  });

  it("keeps the command visible and offers retry when clipboard access fails", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<CopyCommandButton value="install exact" label="复制安装命令" />);

    fireEvent.click(screen.getByRole("button", { name: "复制安装命令" }));

    await waitFor(() => expect(screen.getByText("重试")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toContain(
      "复制失败，请手动选择命令",
    );
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```bash
pnpm --filter @github-picks/web test -- copy-command-button.test.tsx
```

Expected: FAIL because `copy-command-button.tsx` does not exist.

- [ ] **Step 3: Implement the clipboard-only client component**

Create `apps/web/src/components/copy-command-button.tsx`:

```tsx
"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface CopyCommandButtonProps {
  value: string;
  label: string;
}

type CopyState = "idle" | "copied" | "error";

export function CopyCommandButton({ value, label }: CopyCommandButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (resetTimer.current !== undefined) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText === undefined) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setState("copied");
      resetTimer.current = window.setTimeout(() => setState("idle"), 2400);
    } catch {
      setState("error");
    }
  };

  const visibleLabel = state === "copied" ? "已复制" : state === "error" ? "重试" : "复制";
  const announcement =
    state === "copied" ? "已复制到剪贴板" : state === "error" ? "复制失败，请手动选择命令" : "";

  return (
    <div className="copy-command">
      <button type="button" onClick={copy} aria-label={label}>
        {state === "copied" ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
        <span>{visibleLabel}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}
```

- [ ] **Step 4: Integrate copy controls without hiding source text**

Import `CopyCommandButton` into `agent-tutorial-page.tsx`. Place it next to both installation code surfaces and each example prompt:

```tsx
<div className="agent-command">
  <pre><code>{PROJECT_INSTALL_COMMAND}</code></pre>
  <CopyCommandButton value={PROJECT_INSTALL_COMMAND} label="复制项目级安装命令" />
</div>
```

```tsx
<li key={prompt}>
  <span>{String(index + 1).padStart(2, "0")}</span>
  <p>{prompt}</p>
  <CopyCommandButton value={prompt} label={`复制示例问题 ${index + 1}`} />
</li>
```

- [ ] **Step 5: Run clipboard and tutorial tests**

Run:

```bash
pnpm --filter @github-picks/web test -- copy-command-button.test.tsx agent-tutorial-page.test.tsx
```

Expected: all focused tests PASS; the exact command remains in rendered text.

- [ ] **Step 6: Commit the interaction slice**

```bash
git add apps/web/src/components/copy-command-button.tsx apps/web/src/components/agent-tutorial-page.tsx apps/web/test/copy-command-button.test.tsx
git commit -m "feat(web): add Agent tutorial copy controls"
```

### Task 4: Complete Responsive Editorial Styling and Browser Contracts

**Files:**
- Modify: `apps/web/src/styles/globals.css`
- Modify: `apps/web/e2e/site.spec.ts`
- Modify: `apps/web/e2e/accessibility.spec.ts`
- Modify: `apps/web/e2e/responsive-boundaries.spec.ts`

**Interfaces:**
- Consumes: `.agent-page`, `.agent-hero`, `.agent-steps`, `.agent-command`, `.agent-example-list`, `.agent-capabilities`, `.agent-boundary`, and `.copy-command` markup.
- Produces: stable wide, medium, 390 px, and 320 px layouts with visible navigation and contained code scrolling.

- [ ] **Step 1: Write the browser workflow before final styling**

Add to `apps/web/e2e/site.spec.ts`:

```ts
test("Agent tutorial is discoverable, usable, and contained at every viewport", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("link", { name: "Agent" }).click();
    await expect(page).toHaveURL(/\/agent\/$/);
    await expect(
      page.getByRole("heading", { name: "让 Agent 直接使用 GitHub Picks" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Agent" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectNoHorizontalOverflow(page);
  }

  const copyButton = page.getByRole("button", { name: "复制项目级安装命令" });
  await copyButton.click();
  await expect(copyButton).toContainText("已复制");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
    "DISABLE_TELEMETRY=1 npx -y skills@1.5.21 add AICode-Nexus/github-picks --skill github-picks --agent codex --yes --copy",
  );
});
```

Add `/agent/` to the `routes` array in `apps/web/e2e/accessibility.spec.ts`.

Add a focused code-boundary assertion to `responsive-boundaries.spec.ts`:

```ts
test("Agent commands scroll inside their own surface on narrow screens", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/agent/");
    const boundary = await page.locator(".agent-command").first().evaluate((surface) => ({
      surfaceRight: surface.getBoundingClientRect().right,
      viewportRight: document.documentElement.clientWidth,
      preOverflowX: getComputedStyle(surface.querySelector("pre")!).overflowX,
    }));
    expect(boundary.surfaceRight).toBeLessThanOrEqual(boundary.viewportRight);
    expect(boundary.preOverflowX).toMatch(/auto|scroll/);
  }
});
```

- [ ] **Step 2: Run the new E2E cases and confirm the visual contract is red**

Run:

```bash
pnpm --filter @github-picks/web test:e2e -- --grep "Agent tutorial|Agent commands"
```

Expected: FAIL before the tutorial selectors have responsive styles, typically on overflow or layout containment.

- [ ] **Step 3: Add the editorial tutorial CSS**

Add one contiguous `agent-*` block before `.site-footer`, using these concrete rules as the base:

```css
.agent-page {
  padding-top: 1.25rem;
}

.agent-hero {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(15rem, 3fr);
  gap: clamp(2rem, 5vw, 5rem);
  padding: clamp(2rem, 5vw, 4.5rem) 0;
  border-top: 4px solid var(--ink);
  border-bottom: 1px solid var(--ink);
}

.agent-hero h1,
.agent-section h2,
.agent-boundary h2 {
  font-family: var(--serif);
  letter-spacing: -0.055em;
}

.agent-hero h1 {
  max-width: 10em;
  margin: 0.7rem 0 1rem;
  font-size: clamp(2.7rem, 5vw, 5rem);
  line-height: 0.98;
}

.agent-hero__copy > p:last-child {
  max-width: 42rem;
  margin: 0;
  color: var(--muted);
  font-family: var(--serif);
}

.agent-status-list,
.agent-steps,
.agent-example-list,
.agent-capabilities {
  margin: 0;
  padding: 0;
  list-style: none;
}

.agent-status-list {
  align-self: end;
  border-top: 1px solid var(--ink);
}

.agent-status-list li {
  display: flex;
  gap: 0.5rem;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  font-family: var(--mono);
  font-size: 0.7rem;
}

.agent-section {
  margin-top: clamp(3.25rem, 5.5vw, 5.5rem);
}

.agent-section__heading {
  padding-bottom: 1rem;
  border-bottom: 3px solid var(--ink);
}

.agent-section h2,
.agent-boundary h2 {
  margin: 0.6rem 0 0;
  font-size: clamp(2rem, 3.4vw, 3.5rem);
  line-height: 1;
}

.agent-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--ink);
}

.agent-steps > li {
  min-width: 0;
  padding: 1.5rem;
  border-right: 1px solid var(--ink);
}

.agent-steps > li:first-child {
  padding-left: 0;
}

.agent-steps > li:last-child {
  border-right: 0;
}

.agent-step__number {
  color: var(--vermilion);
  font-family: var(--serif);
  font-size: 2.5rem;
}

.agent-command {
  position: relative;
  min-width: 0;
  margin-top: 1rem;
  color: var(--paper);
  background: var(--panel);
  border: 1px solid var(--ink);
}

.agent-command pre,
.agent-global-install pre {
  max-width: 100%;
  margin: 0;
  padding: 1rem 6rem 1rem 1rem;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 0.7rem;
  line-height: 1.55;
  white-space: pre;
}

.copy-command button {
  display: inline-flex;
  width: 5.3rem;
  min-height: 36px;
  gap: 0.35rem;
  align-items: center;
  justify-content: center;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  font-family: var(--mono);
  font-size: 0.68rem;
  cursor: pointer;
}

.agent-command > .copy-command {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
}

.agent-example-list li,
.agent-capabilities li {
  display: grid;
  gap: 1rem;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid var(--line);
}

.agent-example-list li {
  grid-template-columns: 3rem minmax(0, 1fr) auto;
}

.agent-example-list > li > span {
  color: var(--vermilion);
  font-family: var(--mono);
}

.agent-capabilities {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.agent-capabilities li {
  grid-template-columns: auto minmax(0, 1fr);
  padding-right: 1.5rem;
}

.agent-capabilities h3,
.agent-capabilities p,
.agent-example-list p {
  margin: 0;
}

.agent-capabilities p,
.agent-steps p,
.agent-boundary p,
.agent-boundary li {
  color: var(--muted);
  font-family: var(--serif);
}

.agent-boundary {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  margin-top: clamp(3.25rem, 5.5vw, 5.5rem);
  padding: 2.25rem 0;
  border-top: 4px solid var(--ink);
  border-bottom: 1px solid var(--ink);
}

.agent-boundary aside {
  padding: 1.2rem;
  color: var(--ink);
  background: var(--signal);
  border: 1px solid var(--ink);
  box-shadow: 4px 4px 0 var(--ink);
}

.agent-resources {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  gap: 0.7rem 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
  font-family: var(--mono);
  font-size: 0.7rem;
}

.copy-command button:hover {
  color: var(--ink);
  background: var(--signal);
}
```

Add these exact breakpoint rules. The existing reduced-motion block will suppress the copy button's background transition:

```css
.copy-command button {
  transition: color 160ms ease, background 160ms ease;
}

@media (max-width: 1050px) {
  .agent-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .agent-steps > li:first-child {
    grid-column: 1 / -1;
    padding-right: 0;
    border-right: 0;
    border-bottom: 1px solid var(--ink);
  }
}

@media (max-width: 760px) {
  .agent-hero,
  .agent-steps,
  .agent-capabilities,
  .agent-boundary {
    grid-template-columns: minmax(0, 1fr);
  }

  .agent-steps > li,
  .agent-steps > li:first-child {
    grid-column: auto;
    padding: 1.25rem 0;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .agent-command pre,
  .agent-global-install pre {
    padding-right: 1rem;
  }

  .agent-command > .copy-command {
    position: static;
    padding: 0 1rem 1rem;
  }

  .agent-example-list li {
    grid-template-columns: 2rem minmax(0, 1fr);
  }

  .agent-example-list .copy-command {
    grid-column: 2;
  }

  .agent-resources {
    display: grid;
  }
}
```

- [ ] **Step 4: Run browser and accessibility tests**

Run:

```bash
pnpm --filter @github-picks/web test:e2e -- --grep "Agent tutorial|Agent commands|/agent/"
```

Expected: Agent workflow, responsive boundary, and Axe route tests PASS in desktop and mobile projects.

- [ ] **Step 5: Commit the responsive and browser slice**

```bash
git add apps/web/src/styles/globals.css apps/web/e2e/site.spec.ts apps/web/e2e/accessibility.spec.ts apps/web/e2e/responsive-boundaries.spec.ts
git commit -m "test(web): cover Agent tutorial workflow"
```

### Task 5: Document, Build, and Perform Final Acceptance

**Files:**
- Modify: `README.md`
- Verify: `apps/web/out/agent/index.html`

**Interfaces:**
- Consumes: the finished `/agent/` route, production base path, and existing Pages workflow.
- Produces: documented website route and static export proof.

- [ ] **Step 1: Add the public tutorial route to README**

Under `网站时间入口`, add:

```markdown
- `/agent/`：安装、验证并使用 GitHub Picks Agent Skill；
```

Under `Agent 与公开 API`, add one sentence before the install command:

```markdown
网页教程位于 <https://aicode-nexus.github.io/github-picks/agent/>，包含安装、示例提问、验证和故障排查。
```

- [ ] **Step 2: Run all repository gates**

Run:

```bash
pnpm format
TURBO_FORCE=true pnpm check
GITHUB_PICKS_PUBLIC_BASE_URL=https://aicode-nexus.github.io/github-picks NEXT_PUBLIC_BASE_PATH=/github-picks TURBO_FORCE=true pnpm build
pnpm --filter @github-picks/web test:e2e
```

Expected: formatting is clean; all workspace lint, typecheck, and unit tests pass; the static build and every Playwright project pass.

- [ ] **Step 3: Verify the static artifact and public-data scan**

Run:

```bash
test -f apps/web/out/agent/index.html
grep -q "让 Agent 直接使用 GitHub Picks" apps/web/out/agent/index.html
grep -R -n -E '/Users/|GITHUB_TOKEN=|ghp_[A-Za-z0-9]{20,}|rawObjectRef' apps/web/out/agent .agents/skills/github-picks
```

Expected: the first two commands succeed and the scan returns no matches.

- [ ] **Step 4: Inspect desktop and mobile screenshots**

Start the site in one terminal:

```bash
pnpm --filter @github-picks/web dev --hostname 127.0.0.1 --port 3100
```

Capture both target viewports in another terminal:

```bash
pnpm --filter @github-picks/web exec playwright screenshot --viewport-size="1440,1000" http://127.0.0.1:3100/agent/ /tmp/github-picks-agent-desktop.png
pnpm --filter @github-picks/web exec playwright screenshot --viewport-size="390,844" http://127.0.0.1:3100/agent/ /tmp/github-picks-agent-mobile.png
```

Inspect both images. Confirm the Agent nav item is visible and active, the first install command is not clipped, copy controls do not overlap code, the mobile bottom navigation does not cover the final resource links, and no text crosses a section boundary. Stop the server and delete only these two exact temporary screenshots after inspection.

- [ ] **Step 5: Commit the documentation and any acceptance fixes**

```bash
git add README.md apps/web
git commit -m "docs(web): publish Agent tutorial access"
```

- [ ] **Step 6: Request final code review before merge**

Review the full diff from `master...HEAD` for regressions, accessibility, public-data leakage, static-export compatibility, and missing tests. Resolve every Important or higher finding, rerun the complete gates, then merge and publish only when explicitly authorized.
