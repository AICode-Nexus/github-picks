import { expect, test } from "@playwright/test";

const minimumControlFontSize = 0.78 * 16;

test("opened mobile period menu stays entirely within each narrow viewport", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");

    const periodMenu = page.locator(".site-navigation__period");
    await periodMenu.locator("summary").click();
    await expect(periodMenu).toHaveAttribute("open", "");

    const boundaries = await page
      .locator(".site-navigation__periods")
      .evaluate((menu) => {
        const menuRect = menu.getBoundingClientRect();
        const linkRects = Array.from(menu.querySelectorAll("a"), (link) => {
          const rect = link.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        });
        return {
          menu: { left: menuRect.left, right: menuRect.right },
          links: linkRects,
          viewportWidth: window.innerWidth,
        };
      });

    expect(boundaries.menu.left).toBeGreaterThanOrEqual(0);
    expect(boundaries.menu.right).toBeLessThanOrEqual(boundaries.viewportWidth);
    for (const link of boundaries.links) {
      expect(link.left).toBeGreaterThanOrEqual(0);
      expect(link.right).toBeLessThanOrEqual(boundaries.viewportWidth);
    }
  }
});

test("wide navigation rail scrolls its final local link inside the available viewport", async ({
  page,
}) => {
  const viewport = { width: 1440, height: 500 };
  await page.setViewportSize(viewport);
  await page.goto("/");

  const rail = page.locator('nav[aria-label="主导航"]');
  await expect(rail).toHaveCSS("overflow-y", /auto|scroll/);
  const lastLocalLink = page.getByRole("link", { name: "读榜说明" });
  await lastLocalLink.focus();
  await lastLocalLink.evaluate((link) =>
    link.scrollIntoView({ block: "nearest" }),
  );

  const { link, rail: railBox } = await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>(
      'nav[aria-label="主导航"]',
    );
    const link = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a"),
    ).find((anchor) => anchor.textContent?.trim() === "读榜说明");
    if (rail === null || link === undefined)
      throw new Error("missing wide rail");
    const railRect = rail.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    return {
      link: { top: linkRect.top, bottom: linkRect.bottom },
      rail: { top: railRect.top, bottom: railRect.bottom },
    };
  });

  expect(railBox.top).toBeGreaterThanOrEqual(0);
  expect(railBox.bottom).toBeLessThanOrEqual(viewport.height);
  expect(link.top).toBeGreaterThanOrEqual(railBox.top);
  expect(link.bottom).toBeLessThanOrEqual(railBox.bottom);
  expect(link.bottom).toBeLessThanOrEqual(viewport.height);
});

test("ranking and primary navigation controls retain the minimum readable font size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const mobileControlSizes = await page
    .locator(".ranking-filters button, .site-navigation__item")
    .evaluateAll((controls) =>
      controls.map((control) =>
        Number.parseFloat(getComputedStyle(control).fontSize),
      ),
    );
  for (const size of mobileControlSizes) {
    expect(size).toBeGreaterThanOrEqual(minimumControlFontSize);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const wideControlSizes = await page
    .locator(
      ".site-navigation__item, .site-navigation__periods a, .site-navigation__local a",
    )
    .evaluateAll((controls) =>
      controls.map((control) =>
        Number.parseFloat(getComputedStyle(control).fontSize),
      ),
    );
  for (const size of wideControlSizes) {
    expect(size).toBeGreaterThanOrEqual(minimumControlFontSize);
  }
});
