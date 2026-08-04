import { ArrowRight, CalendarRange, Database } from "lucide-react";
import Link from "next/link";
import type { PeriodRankingModel } from "../lib/period-ranking";
import { PeriodRepositoryRow } from "./period-repository-row";

export interface PeriodRankingPageProps {
  ranking: PeriodRankingModel;
}

function formatRangeDate(date: string): string {
  return date.replaceAll("-", ".");
}

export function PeriodRankingPage({ ranking }: PeriodRankingPageProps) {
  const coveragePercent = Math.round(ranking.coverageRate * 100);

  return (
    <main id="main-content">
      <div className="page-shell">
        <section className="period-hero" aria-labelledby="period-title">
          <div className="period-hero__title">
            <p className="eyebrow">ROLLING WINDOW / {ranking.days} DAYS</p>
            <h1 id="period-title">{ranking.label}持续价值榜</h1>
            <p>{ranking.description}</p>
            <span className="period-hero__range">
              <CalendarRange aria-hidden="true" size={17} />
              {formatRangeDate(ranking.fromDate)} —{" "}
              {formatRangeDate(ranking.toDate)}
            </span>
          </div>

          <section className="period-hero__coverage" aria-label="周期数据覆盖">
            <dl className="period-hero__coverage-ledger">
              <div>
                <dt>实际日报</dt>
                <dd>{ranking.reportCount} 份</dd>
              </div>
              <div>
                <dt>日历覆盖</dt>
                <dd>{coveragePercent}%</dd>
              </div>
              <div>
                <dt>入榜项目</dt>
                <dd>{ranking.uniqueRepositoryCount} 个</dd>
              </div>
              <div className="period-hero__coverage-meter">
                <dt>历史库覆盖</dt>
                <dd>
                  <span>
                    {ranking.reportCount} / {ranking.days} 天
                  </span>
                  <progress
                    aria-label={`${ranking.label}历史数据覆盖率`}
                    max={ranking.days}
                    value={ranking.reportCount}
                  />
                </dd>
              </div>
            </dl>

            {ranking.missingDayCount > 0 ? (
              <div className="period-hero__coverage-note">
                <Database aria-hidden="true" size={18} />
                <p>
                  <strong>当前历史库尚缺 {ranking.missingDayCount} 天</strong>
                  本榜只按已存档的 {ranking.reportCount}{" "}
                  份实时日报计算，未采集日期不会被当成零分或未上榜。
                </p>
              </div>
            ) : null}

            <Link className="period-hero__history-link" href="/history/">
              查看历史库
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </section>
        </section>

        <section
          className="period-ranking"
          aria-labelledby="period-ranking-title"
        >
          <header className="section-heading">
            <p className="eyebrow">SUSTAINED VALUE / FULL LIST</p>
            <div>
              <h2 id="period-ranking-title">持续上榜表现</h2>
              <p>
                优先比较上榜覆盖率，再比较平均发布分与平均名次；不改写任何一日的原始发布分。
              </p>
            </div>
            <span className="section-heading__count">
              {ranking.items.length} PICKS
            </span>
          </header>
          <div className="period-ranking__list">
            {ranking.items.map((item) => (
              <PeriodRepositoryRow item={item} key={item.id} />
            ))}
          </div>
        </section>

        <aside className="period-method-note">
          <span>HOW TO READ</span>
          <p>
            周期名次衡量的是“持续进入每日综合价值榜”的稳定性，不等于 GitHub Star
            增长榜。单次出现的项目会保留，但变化指标会显示“待累积”。
          </p>
        </aside>
      </div>
    </main>
  );
}
