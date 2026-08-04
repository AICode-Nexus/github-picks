import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { DailyRankingTagModel } from "../lib/daily-ranking";
import type { RepositoryCardModel } from "../lib/view-model";
import { RankingTags } from "./ranking-tags";

export interface TopStoryCardProps {
  item: RepositoryCardModel;
  featured?: boolean;
  tags?: DailyRankingTagModel[];
  testId?: string;
}

export function TopStoryCard({
  item,
  featured = false,
  tags = [],
  testId,
}: TopStoryCardProps) {
  return (
    <article
      className={`top-story${featured ? " top-story--featured" : ""}`}
      data-repository-id={item.id}
      data-testid={testId}
    >
      <div className="top-story__number">
        <span className="sr-only">第 {item.rank} 名</span>
        <span aria-hidden="true">{String(item.rank).padStart(2, "0")}</span>
      </div>
      <div className="top-story__body">
        <div className="top-story__meta">
          <span>{item.directionName}</span>
          <span>{item.language}</span>
        </div>
        <RankingTags tags={tags} />
        <h3>
          <Link href={item.href}>{item.id}</Link>
        </h3>
        <p className="top-story__description">{item.description}</p>
        <div className="recommendation-reason top-story__why">
          <span>{item.analysisAttribution.label}</span>
          <p>{item.recommendationReason}</p>
        </div>
        <div className="top-story__footer">
          <dl className="score-line">
            <div data-testid="published-score">
              <dt>发布分</dt>
              <dd>{item.score.toFixed(1)}</dd>
            </div>
            <div data-testid="confidence">
              <dt>置信度</dt>
              <dd>{Math.round(item.confidence * 100)}%</dd>
            </div>
            <div data-testid="risk-penalty">
              <dt>风险</dt>
              <dd>−{item.riskPenalty.toFixed(0)}</dd>
            </div>
          </dl>
          <a
            className="icon-link"
            href={item.githubUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`在 GitHub 打开 ${item.id}`}
          >
            <ArrowUpRight aria-hidden="true" size={18} />
          </a>
        </div>
      </div>
    </article>
  );
}
