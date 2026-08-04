import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "../src/components/site-header";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import {
  isNavigationActive,
  SiteNavigation,
} from "../src/components/site-navigation";

afterEach(() => {
  cleanup();
  pathname = "/";
});

describe("site navigation", () => {
  it("renders one complete navigation tree", () => {
    render(
      <>
        <SiteHeader />
        <SiteNavigation />
      </>,
    );

    const navigations = screen.getAllByRole("navigation", { name: "主导航" });
    expect(navigations).toHaveLength(1);
    const navigation = navigations[0];
    if (navigation === undefined) throw new Error("missing main navigation");

    expect(within(navigation).getByRole("link", { name: "今日" })).toBeTruthy();
    expect(
      within(navigation).getByRole("link", { name: "近 180 天" }),
    ).toBeTruthy();
    expect(within(navigation).getByRole("link", { name: "历史" })).toBeTruthy();
    expect(within(navigation).getByRole("link", { name: "信源" })).toBeTruthy();
    expect(
      within(navigation).getByRole("link", { name: "今日榜单" }),
    ).toBeTruthy();
  });

  it("marks nested routes active without marking the homepage", () => {
    pathname = "/rankings/30d/";
    render(<SiteNavigation />);

    expect(
      screen
        .getByRole("link", { name: "近 30 天" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "今日" }).getAttribute("aria-current"),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "今日榜单" })).toBeNull();
  });

  it("includes homepage navigation semantics in the initial static markup", () => {
    pathname = "/";

    const markup = renderToStaticMarkup(<SiteNavigation />);
    const container = document.createElement("div");
    container.innerHTML = markup;

    expect(
      container.querySelector('a[href="/"]')?.getAttribute("aria-current"),
    ).toBe("page");
    expect(container.querySelector('a[href="#ranking"]')).toBeTruthy();
    expect(container.querySelector('a[href="#directions"]')).toBeTruthy();
    expect(container.querySelector('a[href="#method"]')).toBeTruthy();
    expect(container.querySelector("details[open]")).toBeNull();
  });

  it("marks the current period in the initial static markup", () => {
    pathname = "/rankings/30d/";

    const markup = renderToStaticMarkup(<SiteNavigation />);
    const container = document.createElement("div");
    container.innerHTML = markup;

    expect(
      container
        .querySelector('a[href="/rankings/30d"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
  });

  it("matches the homepage exactly and nested sections by prefix", () => {
    expect(isNavigationActive("/", "/")).toBe(true);
    expect(isNavigationActive("/history/2026-08-04/", "/history/")).toBe(true);
    expect(isNavigationActive("/rankings/30d/", "/")).toBe(false);
    expect(isNavigationActive("/rankings/30d/", "/rankings/7d/")).toBe(false);
  });
});
