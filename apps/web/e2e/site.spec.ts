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

test("homepage to direction to repository preserves the intelligence trail", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /今日开源情报/ }),
  ).toBeVisible();
  await expect(page.getByTestId("source-warning")).toContainText("HubLens");
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

  await page.getByRole("link", { name: "历史查询" }).first().click();
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
