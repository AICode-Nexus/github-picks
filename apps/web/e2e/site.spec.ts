import { expect, type Page, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `页面横向尺寸 ${dimensions.scrollWidth}px 超过视口 ${dimensions.clientWidth}px`,
  ).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function expectSingleVisibleNavigation(page: Page) {
  await expect(page.locator('nav[aria-label="主导航"]:visible')).toHaveCount(1);
}

test("one navigation tree adapts to wide, medium and mobile viewports", async ({
  page,
}) => {
  const viewports = [
    { width: 1440, height: 900, mode: "wide" },
    { width: 1024, height: 768, mode: "medium" },
    { width: 390, height: 844, mode: "mobile" },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expectSingleVisibleNavigation(page);
    await expectNoHorizontalOverflow(page);

    const box = await page.locator('nav[aria-label="主导航"]').boundingBox();
    if (box === null) throw new Error(`missing ${viewport.mode} navigation`);

    if (viewport.mode === "wide") {
      expect(box.width).toBeLessThan(220);
      expect(box.height).toBeGreaterThan(600);
    } else if (viewport.mode === "medium") {
      expect(box.width).toBeGreaterThan(900);
      expect(box.height).toBeLessThan(80);
    } else {
      expect(box.width).toBe(viewport.width);
      expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThan(1);
    }
  }
});

test("homepage repositories stay unique while specialty filters reuse their nodes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const repositories = page.locator("[data-repository-id]");
  await expect(repositories).toHaveCount(20);
  const allIds = await repositories.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.repositoryId),
  );
  expect(new Set(allIds).size).toBe(allIds.length);

  const expectedNewProjectIds = await repositories.evaluateAll((nodes) =>
    nodes
      .filter((node) => node.querySelector('[data-tag="new"]') !== null)
      .map((node) => (node as HTMLElement).dataset.repositoryId),
  );
  await page.getByRole("button", { name: "新项目" }).click();
  await expect(page.getByRole("button", { name: "新项目" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const visibleIds = await page
    .locator("[data-repository-id]:visible")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.repositoryId),
    );
  expect(visibleIds).toEqual(expectedNewProjectIds);
  await expect(repositories).toHaveCount(20);
});

test("mobile period navigation closes after routing and never covers the footer", async ({
  page,
}) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await page.goto("/");

  const periodMenu = page.locator(".site-navigation__period");
  await expect(periodMenu).not.toHaveAttribute("open", "");
  await periodMenu.locator("summary").click();
  await expect(periodMenu).toHaveAttribute("open", "");
  await page.getByRole("link", { name: "近 7 天" }).click();
  await expect(page).toHaveURL(/\/rankings\/7d\/$/);
  await expect(periodMenu).not.toHaveAttribute("open", "");
  await expectSingleVisibleNavigation(page);
  await expectNoHorizontalOverflow(page);

  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  const overlap = await page.evaluate(() => {
    const navigation = document.querySelector<HTMLElement>(".site-navigation");
    const siteFooter = document.querySelector<HTMLElement>(".site-footer");
    if (navigation === null || siteFooter === null) return null;
    return (
      siteFooter.getBoundingClientRect().bottom -
      navigation.getBoundingClientRect().top
    );
  });
  expect(overlap).not.toBeNull();
  expect(overlap ?? 1).toBeLessThanOrEqual(0);
});

test("period navigation stays available when a mobile page widens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const periodMenu = page.locator(".site-navigation__period");
  await expect(periodMenu).not.toHaveAttribute("open", "");

  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["近 7 天", "近 30 天", "近 90 天", "近 180 天"]) {
      const link = page.getByRole("link", { name });
      await expect(link).toBeVisible();
      await link.focus();
      await expect(link).toBeFocused();
    }
  }
});

test("clicking the active mobile period closes its menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/rankings/7d/");

  const periodMenu = page.locator(".site-navigation__period");
  await expect(periodMenu).not.toHaveAttribute("open", "");
  await periodMenu.locator("summary").click();
  await expect(periodMenu).toHaveAttribute("open", "");
  await page.getByRole("link", { name: "近 7 天" }).click();
  await expect(periodMenu).not.toHaveAttribute("open", "");
});

test("homepage to direction to repository preserves the intelligence trail", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /今日开源情报/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "本次信源健康状态" }),
  ).toContainText("HubLens");
  await expectNoHorizontalOverflow(page);

  await page
    .getByRole("link", { name: /安全与软件供应链/ })
    .first()
    .click();
  await expect(page).toHaveURL(/directions\/security-supply-chain\/?$/);
  await expect(
    page.getByRole("heading", { name: "安全与软件供应链" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const repositoryLink = page
    .locator('.repository-row a[href^="/repositories/"]')
    .first();
  const repositoryName = (await repositoryLink.textContent())?.trim();
  const repositoryHref = await repositoryLink.getAttribute("href");
  if (repositoryName === undefined || repositoryHref === null) {
    throw new Error("direction page has no repository link");
  }
  await repositoryLink.click();
  await expect(page).toHaveURL(
    new RegExp(`${repositoryHref.replace(/\/$/, "")}/?$`),
    {
      timeout: 15_000,
    },
  );
  await expect(
    page.getByRole("heading", { name: repositoryName }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "公开证据" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("source status stays readable without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/sources/");
  await expect(
    page.getByRole("heading", { name: "本期信源现场" }),
  ).toBeVisible();
  await expect(page.getByText("全部候选信号超过新鲜度阈值")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("period rankings expose honest coverage and lead into exact history queries", async ({
  page,
}) => {
  await page.goto("/rankings/7d/");
  await expect(
    page.getByRole("heading", { name: "近 7 天持续价值榜" }),
  ).toBeVisible();
  await expect(page.getByText("2 / 7 天")).toBeVisible();
  await expect(page.getByText(/当前历史库尚缺 5 天/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "查看历史库" }).click();
  await expect(page).toHaveURL(/history\/?$/);
  await expect(
    page.getByRole("heading", { name: "历史日报查询" }),
  ).toBeVisible();

  await page.getByLabel("选择已存档日期").selectOption("2026-08-03");
  await page.getByRole("button", { name: "打开日报" }).click();
  await expect(page).toHaveURL(/history\/2026-08-03\/?$/);
  await expect(
    page.getByRole("heading", { name: "2026年08月03日 开源情报" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
