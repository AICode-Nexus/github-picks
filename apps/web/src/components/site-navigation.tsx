"use client";

import {
  CalendarRange,
  ChevronDown,
  History,
  House,
  RadioTower,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { RANKING_PERIOD_IDS, RANKING_PERIOD_META } from "../lib/site-meta";

export function isNavigationActive(pathname: string, href: string): boolean {
  const current = pathname.replace(/\/+$/, "") || "/";
  const target = href.replace(/\/+$/, "") || "/";
  return target === "/"
    ? current === "/"
    : current === target || current.startsWith(`${target}/`);
}

export function SiteNavigation() {
  const pathname = usePathname() || "/";
  const periodDetails = useRef<HTMLDetailsElement>(null);
  const isHome = isNavigationActive(pathname, "/");
  const isPeriod = RANKING_PERIOD_IDS.some((periodId) =>
    isNavigationActive(pathname, `/rankings/${periodId}/`),
  );

  useEffect(() => {
    const mobile = window.matchMedia?.("(max-width: 760px)");
    if (mobile === undefined) return;
    const closeMobilePeriodMenu = () => {
      if (pathname && mobile.matches) {
        periodDetails.current?.removeAttribute("open");
      }
    };

    closeMobilePeriodMenu();
    mobile.addEventListener("change", closeMobilePeriodMenu);
    return () => mobile.removeEventListener("change", closeMobilePeriodMenu);
  }, [pathname]);

  return (
    <nav className="site-navigation" aria-label="主导航">
      <div className="site-navigation__primary">
        <p className="site-navigation__section-label">日报</p>
        <Link
          className="site-navigation__item"
          href="/"
          aria-current={isHome ? "page" : undefined}
        >
          <House aria-hidden="true" size={18} />
          <span>今日</span>
        </Link>

        <p className="site-navigation__section-label">周期</p>
        <details className="site-navigation__period" open ref={periodDetails}>
          <summary
            className={`site-navigation__item${isPeriod ? " is-active" : ""}`}
          >
            <CalendarRange aria-hidden="true" size={18} />
            <span>周期</span>
            <ChevronDown
              className="site-navigation__chevron"
              aria-hidden="true"
              size={15}
            />
          </summary>
          <div className="site-navigation__periods">
            {RANKING_PERIOD_IDS.map((periodId) => {
              const href = `/rankings/${periodId}/`;
              const active = isNavigationActive(pathname, href);
              return (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={RANKING_PERIOD_META[periodId].label}
                  key={periodId}
                >
                  {RANKING_PERIOD_META[periodId].shortLabel}
                </Link>
              );
            })}
          </div>
        </details>

        <p className="site-navigation__section-label">档案</p>
        <Link
          className="site-navigation__item"
          href="/history/"
          aria-current={
            isNavigationActive(pathname, "/history/") ? "page" : undefined
          }
        >
          <History aria-hidden="true" size={18} />
          <span>历史</span>
        </Link>
        <Link
          className="site-navigation__item"
          href="/sources/"
          aria-current={
            isNavigationActive(pathname, "/sources/") ? "page" : undefined
          }
        >
          <RadioTower aria-hidden="true" size={18} />
          <span>信源</span>
        </Link>
      </div>

      {isHome ? (
        <section className="site-navigation__local" aria-label="本页导航">
          <p className="site-navigation__section-label">本页</p>
          <a href="#ranking">今日榜单</a>
          <a href="#directions">技术方向</a>
          <a href="#method">读榜说明</a>
        </section>
      ) : null}
    </nav>
  );
}
