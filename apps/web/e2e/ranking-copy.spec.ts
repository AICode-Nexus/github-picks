import { expect, type Page, test } from "@playwright/test";

async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

function expectProjectUrls(copied: string, repositoryIds: readonly string[]) {
  const projectUrls = copied
    .split(/\r?\n/)
    .filter((line) => line.startsWith("项目地址："))
    .map((line) => line.replace("项目地址：", ""));
  expect(projectUrls).toHaveLength(repositoryIds.length);
  const projectPaths = projectUrls.map((projectUrl) => {
    const url = new URL(projectUrl);
    expect(url.hostname).toBe("github.com");
    return url.pathname.replace(/^\//, "").toLowerCase();
  });
  expect(projectPaths).toEqual(repositoryIds.map((id) => id.toLowerCase()));
}

function expectProjectMissing(copied: string, repositoryId: string) {
  expect(copied.toLowerCase()).not.toContain(
    `项目地址：https://github.com/${repositoryId}`.toLowerCase(),
  );
}

function expectCurrentPageUrlLast(copied: string, page: Page) {
  expect(copied.trimEnd().endsWith(page.url())).toBe(true);
}

function normalizeIds(repositoryIds: readonly string[]): string[] {
  return repositoryIds.map((id) => id.trim()).filter(Boolean);
}

function expectAllIdsPresent(repositoryIds: readonly string[]) {
  for (const repositoryId of repositoryIds) {
    expect(repositoryId).not.toBe("");
  }
}

test("homepage copies only the active specialty ranking", async ({
  browserName,
  context,
  page,
}) => {
  test.skip(browserName !== "chromium", "Clipboard readback requires Chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const repositories = page.locator("[data-repository-id]");
  const allIds = await repositories.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.repositoryId ?? ""),
  );

  await page.getByRole("button", { name: "新项目" }).click();
  const visibleIds = await page
    .locator("[data-repository-id]:visible")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.repositoryId ?? ""),
    );
  await page.getByRole("button", { name: "复制榜单" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();

  const copied = await readClipboard(page);
  expectAllIdsPresent(visibleIds);
  expectProjectUrls(copied, visibleIds);
  for (const excludedId of allIds.filter((id) => !visibleIds.includes(id))) {
    expectProjectMissing(copied, excludedId);
  }
  expect(copied).toContain(`筛选：新项目｜共 ${visibleIds.length} 项`);
  expectCurrentPageUrlLast(copied, page);
});

test("period and history pages copy every ranked project URL", async ({
  browserName,
  context,
  page,
}) => {
  test.skip(browserName !== "chromium", "Clipboard readback requires Chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/rankings/7d/");
  const periodIds = await page
    .locator(".period-repository-row h2 a")
    .allTextContents();
  await page.getByRole("button", { name: "复制榜单" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  const periodCopied = await readClipboard(page);
  const normalizedPeriodIds = normalizeIds(periodIds);
  expectAllIdsPresent(normalizedPeriodIds);
  expectProjectUrls(periodCopied, normalizedPeriodIds);
  expect(periodCopied).toContain("周期表现：");
  expectCurrentPageUrlLast(periodCopied, page);

  await page.goto("/history/2026-08-03/");
  const historyIds = await page
    .locator("[data-repository-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.repositoryId ?? ""),
    );
  await page.getByRole("button", { name: "复制榜单" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  const historyCopied = await readClipboard(page);
  expectAllIdsPresent(historyIds);
  expectProjectUrls(historyCopied, historyIds);
  expect(historyCopied).toContain("2026年08月03日综合价值榜");
  expectCurrentPageUrlLast(historyCopied, page);
});

test("copy control stays touch-sized and stable across ranking layouts", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const heading = page.locator(".daily-ranking .section-heading");
    const copyButton = page.getByRole("button", { name: "复制榜单" });
    const before = await copyButton.boundingBox();
    const headingBox = await heading.boundingBox();
    if (before === null || headingBox === null) {
      throw new Error("missing ranking copy layout");
    }

    expect(before.height).toBeGreaterThanOrEqual(44);
    expect(before.x).toBeGreaterThanOrEqual(headingBox.x);
    expect(before.x + before.width).toBeLessThanOrEqual(
      headingBox.x + headingBox.width,
    );
    await copyButton.click();
    await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
    const after = await page
      .getByRole("button", { name: "已复制" })
      .boundingBox();
    if (after === null) throw new Error("missing copied ranking control");
    expect(after.width).toBeCloseTo(before.width, 1);
    expect(after.height).toBeCloseTo(before.height, 1);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
