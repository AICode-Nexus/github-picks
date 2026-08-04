import { CalendarSearch } from "lucide-react";
import Link from "next/link";
import {
  RANKING_PERIOD_IDS,
  RANKING_PERIOD_META,
  type RankingPeriodId,
} from "../lib/site-meta";

export type PeriodNavigationValue = "daily" | "history" | RankingPeriodId;

export interface PeriodNavigationProps {
  active: PeriodNavigationValue;
}

export function PeriodNavigation({ active }: PeriodNavigationProps) {
  return (
    <nav className="period-navigation" aria-label="榜单时间范围">
      <span className="period-navigation__label">RANGE / 时间尺度</span>
      <div className="period-navigation__links">
        <Link href="/" aria-current={active === "daily" ? "page" : undefined}>
          今日
        </Link>
        {RANKING_PERIOD_IDS.map((periodId) => (
          <Link
            href={`/rankings/${periodId}/`}
            aria-label={RANKING_PERIOD_META[periodId].label}
            aria-current={active === periodId ? "page" : undefined}
            key={periodId}
          >
            {RANKING_PERIOD_META[periodId].shortLabel}
          </Link>
        ))}
      </div>
      <Link
        className="period-navigation__history"
        href="/history/"
        aria-current={active === "history" ? "page" : undefined}
      >
        <CalendarSearch aria-hidden="true" size={16} />
        历史查询
      </Link>
    </nav>
  );
}
