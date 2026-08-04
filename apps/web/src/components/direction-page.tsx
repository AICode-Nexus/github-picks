import type { DailyReport, DirectionId } from "@github-picks/core/schema";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { DIRECTION_IDS, DIRECTION_META } from "../lib/site-meta";
import { buildDirectionSummary } from "../lib/view-model";
import { EmptyRanking } from "./empty-ranking";
import { RankingSection } from "./ranking-section";

export interface DirectionPageProps {
  report: DailyReport;
  directionId: DirectionId;
}

export function DirectionPage({ report, directionId }: DirectionPageProps) {
  const summary = buildDirectionSummary(report, directionId);
  const directionIndex = DIRECTION_IDS.indexOf(directionId);
  const previous = DIRECTION_IDS[directionIndex - 1];
  const next = DIRECTION_IDS[directionIndex + 1];

  return (
    <main id="main-content">
      <div className="page-shell inner-page">
        <nav className="breadcrumbs" aria-label="面包屑">
          <Link href="/">今日榜单</Link>
          <span aria-hidden="true">/</span>
          <span>{summary.shortName}</span>
        </nav>

        <header className="direction-hero">
          <div>
            <p className="eyebrow">TECHNICAL BEAT / {directionId}</p>
            <h1>{summary.name}</h1>
            <p>{summary.description}</p>
          </div>
          <dl className="direction-hero__metrics">
            <div>
              <dt>本期覆盖</dt>
              <dd>{summary.count} 个项目入榜</dd>
            </div>
            <div>
              <dt>最高发布分</dt>
              <dd>
                {summary.maximumScore === null
                  ? "—"
                  : summary.maximumScore.toFixed(1)}
              </dd>
            </div>
            <div>
              <dt>中位置信度</dt>
              <dd>
                {summary.medianConfidence === null
                  ? "—"
                  : `${Math.round(summary.medianConfidence * 100)}%`}
              </dd>
            </div>
          </dl>
        </header>

        {summary.items.length > 0 ? (
          <RankingSection
            eyebrow={`DIRECTION RANKING / ${report.date}`}
            title="本方向完整榜单"
            description="在相同工程方向内比较综合价值，避免跨领域热度直接挤占名额。"
            items={summary.items}
          />
        ) : (
          <EmptyRanking />
        )}

        <nav className="adjacent-directions" aria-label="相邻技术方向">
          {previous ? (
            <Link href={`/directions/${previous}/`}>
              <ArrowLeft aria-hidden="true" size={18} />
              <span>
                <small>上一方向</small>
                {DIRECTION_META[previous].name}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              className="adjacent-directions__next"
              href={`/directions/${next}/`}
            >
              <span>
                <small>下一方向</small>
                {DIRECTION_META[next].name}
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          ) : null}
        </nav>
      </div>
    </main>
  );
}
