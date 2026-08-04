import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { RepositoryCardModel } from "../lib/view-model";

export interface TopStoryCardProps {
  item: RepositoryCardModel;
  featured?: boolean;
}

export function TopStoryCard({ item, featured = false }: TopStoryCardProps) {
  return (
    <article className={`top-story${featured ? " top-story--featured" : ""}`}>
      <div className="top-story__number">
        <span className="sr-only">第 {item.rank} 名</span>
        <span aria-hidden="true">{String(item.rank).padStart(2, "0")}</span>
      </div>
      <div className="top-story__body">
        <div className="top-story__meta">
          <span>{item.directionName}</span>
          <span>{item.language}</span>
        </div>
        <h3>
          <Link href={item.href}>{item.id}</Link>
        </h3>
        <p className="top-story__description">{item.description}</p>
        {featured ? <p className="top-story__why">{item.why}</p> : null}
        <div className="top-story__footer">
          <dl className="score-line">
            <div>
              <dt>发布分</dt>
              <dd>{item.score.toFixed(1)}</dd>
            </div>
            <div>
              <dt>置信度</dt>
              <dd>{Math.round(item.confidence * 100)}%</dd>
            </div>
            <div>
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
