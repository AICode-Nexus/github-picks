import { ArrowUpRight, Database, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { ReportArchiveEntryModel } from "../lib/period-ranking";
import { HistoryDatePicker } from "./history-date-picker";
import { PeriodNavigation } from "./period-navigation";

export interface HistoryIndexPageProps {
  entries: ReportArchiveEntryModel[];
  basePath?: string | undefined;
}

export function HistoryIndexPage({ entries, basePath }: HistoryIndexPageProps) {
  const newest = entries[0];
  const oldest = entries.at(-1);

  return (
    <main id="main-content">
      <div className="page-shell">
        <PeriodNavigation active="history" />

        <section className="history-hero" aria-labelledby="history-title">
          <div className="history-hero__title">
            <p className="eyebrow">ARCHIVE / IMMUTABLE DAILY SNAPSHOTS</p>
            <h1 id="history-title">历史日报查询</h1>
            <p>
              每个日期保留一份通过共享 Schema
              校验的实时日报；回放数据不会进入公开历史库。
            </p>
          </div>
          <HistoryDatePicker
            dates={entries.map((entry) => entry.date)}
            basePath={basePath}
          />
          <dl className="history-hero__ledger">
            <div>
              <dt>已存档</dt>
              <dd>{entries.length} 日</dd>
            </div>
            <div>
              <dt>最早日报</dt>
              <dd>{oldest?.date ?? "—"}</dd>
            </div>
            <div>
              <dt>最新日报</dt>
              <dd>{newest?.date ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <aside className="archive-policy">
          <Database aria-hidden="true" size={19} />
          <div>
            <strong>存储与查询口径</strong>
            <p>
              日报按日期存入 artifacts/daily；同一天存在多次 live
              运行时，公开索引只选择 generatedAt 最新的一份，同时永久排除
              replay。
            </p>
          </div>
        </aside>

        <section
          className="archive-section"
          aria-labelledby="archive-list-title"
        >
          <header className="section-heading">
            <p className="eyebrow">LIVE REPORT INDEX</p>
            <div>
              <h2 id="archive-list-title">已存档日报</h2>
              <p>
                按北京时间日期倒序排列，可逐日核对榜单、置信度、风险和当期信源状态。
              </p>
            </div>
            <span className="section-heading__count">
              {entries.length} DAYS
            </span>
          </header>
          <ol className="archive-list">
            {entries.map((entry, index) => {
              const hasSourceProblems =
                entry.degradedSourceCount + entry.offlineSourceCount > 0;
              return (
                <li key={entry.date}>
                  <span className="archive-list__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <time dateTime={entry.date}>
                    <strong>{entry.dateLabel}</strong>
                    <small>{entry.weekdayLabel}</small>
                  </time>
                  <div className="archive-list__lead">
                    <span>当日头名</span>
                    <strong>{entry.topRepositoryId}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>发布项目</dt>
                      <dd>{entry.publishedCount}</dd>
                    </div>
                    <div>
                      <dt>头名发布分</dt>
                      <dd>{entry.topRepositoryScore.toFixed(1)}</dd>
                    </div>
                    <div>
                      <dt>信源状态</dt>
                      <dd
                        className={hasSourceProblems ? "has-risk" : undefined}
                      >
                        {hasSourceProblems ? (
                          <>
                            <ShieldAlert aria-hidden="true" size={14} />
                            {entry.degradedSourceCount} 降级 /{" "}
                            {entry.offlineSourceCount} 离线
                          </>
                        ) : (
                          "全部正常"
                        )}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    href={entry.href}
                    aria-label={`查看 ${entry.date} 日报`}
                  >
                    <ArrowUpRight aria-hidden="true" size={18} />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </main>
  );
}
