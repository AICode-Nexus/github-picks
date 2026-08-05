import { expect, test } from "@playwright/test";

const minimumControlFontSize = 0.78 * 16;
const minimumEditorialGap = 12;

test("top ranking numbers keep clear of their story content", async ({
  page,
}) => {
  for (const width of [1638, 1920, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const boundaries = await page.locator(".top-story").evaluateAll((cards) =>
      cards.map((card) => {
        const number = card.querySelector<HTMLElement>(
          '.top-story__number span[aria-hidden="true"]',
        );
        const body = card.querySelector<HTMLElement>(".top-story__body");
        if (number === null || body === null) {
          throw new Error("missing top ranking card content");
        }

        const numberRange = document.createRange();
        numberRange.selectNodeContents(number);
        const numberRect = numberRange.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        return {
          cardLeft: cardRect.left,
          cardRight: cardRect.right,
          numberLeft: numberRect.left,
          numberRight: numberRect.right,
          bodyLeft: bodyRect.left,
          bodyRight: bodyRect.right,
        };
      }),
    );

    expect(boundaries).toHaveLength(3);
    for (const boundary of boundaries) {
      expect(boundary.numberLeft).toBeGreaterThanOrEqual(boundary.cardLeft);
      expect(boundary.numberRight + minimumEditorialGap).toBeLessThanOrEqual(
        boundary.bodyLeft,
      );
      expect(boundary.bodyRight).toBeLessThanOrEqual(boundary.cardRight);
    }
  }
});

test("mobile source status cards preserve a readable value column", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/sources/");

    const dimensions = await page
      .locator(".source-health-table tbody tr")
      .first()
      .evaluate((row) => {
        const source = row.querySelector("th");
        const sourceName = source?.querySelector("strong");
        const sourceId = source?.querySelector("small");
        if (source === null || sourceName === null || sourceId === null) {
          throw new Error("missing source status card content");
        }

        const rowRect = row.getBoundingClientRect();
        const sourceRect = source.getBoundingClientRect();
        const sourceNameRect = sourceName.getBoundingClientRect();
        const sourceIdRect = sourceId.getBoundingClientRect();
        return {
          rowWidth: rowRect.width,
          sourceWidth: sourceRect.width,
          sourceNameWidth: sourceNameRect.width,
          sourceIdWidth: sourceIdRect.width,
        };
      });

    expect(dimensions.sourceWidth).toBeGreaterThan(dimensions.rowWidth * 0.8);
    expect(dimensions.sourceNameWidth).toBeGreaterThan(80);
    expect(dimensions.sourceIdWidth).toBeGreaterThan(80);
  }
});

test("opened mobile period menu stays entirely within each narrow viewport", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");

    const periodMenu = page.locator(".site-navigation__period");
    await expect(periodMenu).not.toHaveAttribute("open", "");
    await periodMenu.locator("summary").click();
    await expect(periodMenu).toHaveAttribute("open", "");

    const boundaries = await page
      .locator(".site-navigation__periods")
      .evaluate((menu) => {
        const menuRect = menu.getBoundingClientRect();
        const linkRects = Array.from(menu.querySelectorAll("a"), (link) => {
          const rect = link.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
        });
        const navigation = menu.closest("nav");
        if (navigation === null) throw new Error("missing mobile navigation");
        const navigationRect = navigation.getBoundingClientRect();
        return {
          menu: {
            left: menuRect.left,
            right: menuRect.right,
            top: menuRect.top,
            bottom: menuRect.bottom,
          },
          links: linkRects,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          navigationTop: navigationRect.top,
        };
      });

    expect(boundaries.links.length).toBeGreaterThan(0);
    expect(boundaries.menu.left).toBeGreaterThanOrEqual(0);
    expect(boundaries.menu.right).toBeLessThanOrEqual(boundaries.viewportWidth);
    expect(boundaries.menu.top).toBeGreaterThanOrEqual(0);
    expect(boundaries.menu.bottom).toBeLessThanOrEqual(
      boundaries.viewportHeight,
    );
    expect(boundaries.menu.bottom).toBeLessThanOrEqual(
      boundaries.navigationTop,
    );
    for (const link of boundaries.links) {
      expect(link.left).toBeGreaterThanOrEqual(0);
      expect(link.right).toBeLessThanOrEqual(boundaries.viewportWidth);
      expect(link.top).toBeGreaterThanOrEqual(0);
      expect(link.bottom).toBeLessThanOrEqual(boundaries.viewportHeight);
      expect(link.bottom).toBeLessThanOrEqual(boundaries.navigationTop);
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
  await expect(page.locator(".site-navigation__period")).toHaveAttribute(
    "open",
    "",
  );
  const lastLocalLink = page.getByRole("link", { name: "读榜说明" });
  await lastLocalLink.focus();
  await expect(lastLocalLink).toBeFocused();

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
  expect(mobileControlSizes.length).toBeGreaterThan(0);
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
  expect(wideControlSizes.length).toBeGreaterThan(0);
  for (const size of wideControlSizes) {
    expect(size).toBeGreaterThanOrEqual(minimumControlFontSize);
  }
});

test("Agent commands scroll inside their own surface on narrow screens", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/agent/");

    const boundary = await page
      .locator(".agent-command")
      .first()
      .evaluate((surface) => {
        const command = surface.querySelector(".agent-command__scroll");
        if (command === null) throw new Error("missing Agent command");
        return {
          surfaceLeft: surface.getBoundingClientRect().left,
          surfaceRight: surface.getBoundingClientRect().right,
          viewportRight: document.documentElement.clientWidth,
          commandOverflowX: getComputedStyle(command).overflowX,
        };
      });

    expect(boundary.surfaceLeft).toBeGreaterThanOrEqual(0);
    expect(boundary.surfaceRight).toBeLessThanOrEqual(boundary.viewportRight);
    expect(boundary.commandOverflowX).toMatch(/auto|scroll/);
  }
});

test("Agent copy control never covers the install command", async ({
  page,
}) => {
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/agent/");

    const boundary = await page
      .locator(".agent-command")
      .first()
      .evaluate((surface) => {
        const command = surface.querySelector(".agent-command__scroll");
        const copy = surface.querySelector(".copy-command");
        if (command === null || copy === null) {
          throw new Error("missing Agent command controls");
        }
        const commandRect = command.getBoundingClientRect();
        const copyRect = copy.getBoundingClientRect();
        return {
          commandRight: commandRect.right,
          commandBottom: commandRect.bottom,
          copyLeft: copyRect.left,
          copyTop: copyRect.top,
        };
      });

    if (width > 760) {
      expect(boundary.commandRight).toBeLessThanOrEqual(boundary.copyLeft);
    } else {
      expect(boundary.commandBottom).toBeLessThanOrEqual(boundary.copyTop);
    }
  }
});
