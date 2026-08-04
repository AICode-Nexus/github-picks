import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { PeriodRankingItemModel } from "../lib/period-ranking";

export interface PeriodRepositoryRowProps {
  item: PeriodRankingItemModel;
}

function formatSigned(value: number | null, suffix = ""): string {
  if (value === null) return "待累积";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("zh-CN", {
    maximumFractionDigits: 1,
  })}${suffix}`;
}

export function PeriodRepositoryRow({ item }: PeriodRepositoryRowProps) {
  return (
    <article
      className="period-repository-row"
      data-testid={`period-row-${item.id.replace("/", "-")}`}
    >
      <div className="period-repository-row__rank">
        <span className="sr-only">周期榜第 {item.rank} 名</span>
        <span aria-hidden="true">{String(item.rank).padStart(2, "0")}</span>
      </div>

      <div className="period-repository-row__identity">
        <p className="repository-row__context">
          <span>{item.directionName}</span>
          <span>{item.language}</span>
          <span>最近上榜 {item.latestDate}</span>
        </p>
        <h2>
          <Link href={item.href}>{item.id}</Link>
        </h2>
        <p>{item.description}</p>
      </div>

      <dl className="period-repository-row__metrics">
        <div className="period-repository-row__frequency">
          <dt>上榜覆盖</dt>
          <dd>
            <span>
              {item.appearanceCount}/{item.reportCount} 日
            </span>
            <progress
              aria-label={`${item.id} 上榜覆盖率`}
              max={item.reportCount}
              value={item.appearanceCount}
            />
          </dd>
        </div>
        <div>
          <dt>平均发布分</dt>
          <dd>{item.averageScore.toFixed(1)}</dd>
        </div>
        <div>
          <dt>最佳 / 最近</dt>
          <dd>
            #{String(item.bestRank).padStart(2, "0")} / #
            {String(item.latestDailyRank).padStart(2, "0")}
          </dd>
        </div>
        <div>
          <dt>分数变化</dt>
          <dd
            className={
              item.scoreDelta !== null && item.scoreDelta < 0
                ? "has-risk"
                : undefined
            }
          >
            {formatSigned(item.scoreDelta)}
          </dd>
        </div>
        <div>
          <dt>Star 变化</dt>
          <dd>{formatSigned(item.starDelta)}</dd>
        </div>
      </dl>

      <div className="period-repository-row__latest">
        <span>最新发布分</span>
        <strong>{item.latestScore.toFixed(1)}</strong>
        <small>
          置信度 {item.confidenceLabel} · 风险 −{item.riskPenalty.toFixed(0)}
        </small>
      </div>

      <Link
        className="period-repository-row__open"
        href={item.href}
        aria-label={`查看 ${item.id} 的最新完整分析`}
      >
        <ArrowUpRight aria-hidden="true" size={18} />
      </Link>
    </article>
  );
}
