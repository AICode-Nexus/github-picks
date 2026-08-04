import type { DailyReport } from "@github-picks/core/schema";
import Link from "next/link";
import { buildDailyRankingItems } from "../lib/daily-ranking";
import { DIMENSION_IDS, DIMENSION_META, DIRECTION_IDS } from "../lib/site-meta";
import { buildDirectionSummary, buildSourceSummary } from "../lib/view-model";
import { DailyMasthead, type DailyMastheadModel } from "./daily-masthead";
import { DailyRanking } from "./daily-ranking";
import { DirectionIndex } from "./direction-index";
import { PeriodNavigation } from "./period-navigation";

export interface HomePageProps {
  report: DailyReport;
}

function formatReportDate(date: string): {
  dateLabel: string;
  weekdayLabel: string;
} {
  const value = new Date(`${date}T00:00:00+08:00`);
  return {
    dateLabel: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Shanghai",
    }).format(value),
    weekdayLabel: new Intl.DateTimeFormat("zh-CN", {
      weekday: "long",
      timeZone: "Asia/Shanghai",
    }).format(value),
  };
}

function formatGeneratedAt(generatedAt: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(generatedAt));
}

export function HomePage({ report }: HomePageProps) {
  const items = buildDailyRankingItems(report);

  const sourceSummary = buildSourceSummary(report);
  const date = formatReportDate(report.date);
  const cover: DailyMastheadModel = {
    ...date,
    generatedAtLabel: formatGeneratedAt(report.generatedAt),
    modeLabel: report.mode === "live" ? "实时观测" : "证据回放",
    scoreVersion: report.scoreVersion,
    counts: report.counts,
  };
  const directionSummaries = DIRECTION_IDS.map((directionId) =>
    buildDirectionSummary(report, directionId),
  );
  return (
    <main id="main-content">
      <div className="page-shell">
        <PeriodNavigation active="daily" />

        <DailyMasthead cover={cover} sources={sourceSummary} />

        <DailyRanking items={items} />

        <DirectionIndex directions={directionSummaries} />

        <section className="method-note" aria-labelledby="method-note-title">
          <div>
            <p className="eyebrow">SCORING NOTE / {report.scoreVersion}</p>
            <h2 id="method-note-title">这不是另一个 Star 排行榜</h2>
            <p>
              GitHub Picks
              同时看实用价值、维护活动、组织连续性、工程成熟度、采用、安全、趋势与创新。发布分、置信度和风险扣分始终分开展示。
            </p>
          </div>
          <details className="method-note__details">
            <summary>查看八维评分权重</summary>
            <ol className="weight-list">
              {DIMENSION_IDS.map((id, index) => (
                <li key={id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{DIMENSION_META[id].label}</strong>
                  <em>{DIMENSION_META[id].weight}%</em>
                </li>
              ))}
            </ol>
          </details>
          <aside>
            <strong>读榜提示</strong>
            <p>
              高分不等于生产可用；缺失值不按零分处理；无风险扣分也不代表完成安全审查。
            </p>
            <Link href="/sources/">查看本期证据覆盖</Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
