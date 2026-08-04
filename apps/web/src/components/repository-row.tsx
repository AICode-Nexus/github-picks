import { ArrowUpRight, Star } from "lucide-react";
import Link from "next/link";
import type { RepositoryCardModel } from "../lib/view-model";

export interface RepositoryRowProps {
  item: RepositoryCardModel;
  testId?: string | undefined;
  compact?: boolean;
}

export function RepositoryRow({
  item,
  testId,
  compact = false,
}: RepositoryRowProps) {
  return (
    <article
      className={`repository-row${compact ? " repository-row--compact" : ""}`}
      data-testid={testId}
    >
      <div className="repository-row__rank">
        <span className="sr-only">第 {item.rank} 名</span>
        <span aria-hidden="true">{String(item.rank).padStart(2, "0")}</span>
      </div>
      <div className="repository-row__identity">
        <p className="repository-row__context">
          <span>{item.directionName}</span>
          <span>{item.language}</span>
        </p>
        <h3>
          <Link href={item.href}>{item.id}</Link>
        </h3>
        <p className="repository-row__description">{item.description}</p>
        {compact ? null : (
          <p className="repository-row__annotation">
            强项：{item.strongestDimension.label}{" "}
            {item.strongestDimension.value.toFixed(1)}
          </p>
        )}
      </div>
      <div className="repository-row__stars">
        <Star aria-hidden="true" size={15} />
        {item.stars.toLocaleString("zh-CN")}
        <span className="sr-only"> Star</span>
      </div>
      <dl className="repository-row__score">
        <div data-testid="published-score">
          <dt>发布分</dt>
          <dd>{item.score.toFixed(1)}</dd>
        </div>
        <div data-testid="confidence">
          <dt>置信度</dt>
          <dd>
            {item.confidenceLabel} · {Math.round(item.confidence * 100)}%
          </dd>
        </div>
        <div data-testid="risk-penalty">
          <dt>风险扣分</dt>
          <dd className={item.riskPenalty > 0 ? "has-risk" : undefined}>
            {item.riskPenalty.toFixed(0)}
          </dd>
        </div>
      </dl>
      <Link
        className="repository-row__open"
        href={item.href}
        aria-label={`查看 ${item.id} 的完整分析`}
      >
        <ArrowUpRight aria-hidden="true" size={18} />
      </Link>
    </article>
  );
}
