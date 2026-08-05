import { act, cleanup, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
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
      within(navigation)
        .getByRole("link", { name: "Agent" })
        .getAttribute("href"),
    ).toBe("/agent");
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

  it("keeps the initial static navigation shell route-neutral", () => {
    pathname = "/";

    const markup = renderToStaticMarkup(<SiteNavigation />);
    const container = document.createElement("div");
    container.innerHTML = markup;

    expect(
      container.querySelector('a[href="/"]')?.getAttribute("aria-current"),
    ).toBeNull();
    expect(container.querySelector('a[href="#ranking"]')).toBeNull();
    expect(container.querySelector('a[href="#directions"]')).toBeNull();
    expect(container.querySelector('a[href="#method"]')).toBeNull();
    expect(container.querySelector("details[open]")).toBeNull();
  });

  it("defers the current period marker until hydration", () => {
    pathname = "/rankings/30d/";

    const markup = renderToStaticMarkup(<SiteNavigation />);
    const container = document.createElement("div");
    container.innerHTML = markup;

    expect(
      container
        .querySelector('a[href="/rankings/30d"]')
        ?.getAttribute("aria-current"),
    ).toBeNull();
  });

  it("hydrates a stable navigation shell when the client pathname differs", async () => {
    pathname = "/";
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<SiteNavigation />);
    document.body.append(container);

    pathname = "/directions/security-supply-chain/";
    const recoverableErrors: unknown[] = [];
    const root = hydrateRoot(container, <SiteNavigation />, {
      onRecoverableError: (error) => recoverableErrors.push(error),
    });
    await act(async () => {});

    expect(recoverableErrors).toEqual([]);
    await act(async () => root.unmount());
    container.remove();
  });

  it("matches the homepage exactly and nested sections by prefix", () => {
    expect(isNavigationActive("/", "/")).toBe(true);
    expect(isNavigationActive("/history/2026-08-04/", "/history/")).toBe(true);
    expect(isNavigationActive("/rankings/30d/", "/")).toBe(false);
    expect(isNavigationActive("/rankings/30d/", "/rankings/7d/")).toBe(false);
  });
});
