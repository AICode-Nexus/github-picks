import Link from "next/link";
import type {
  RepositoryCardModel,
  SourceSummaryModel,
} from "../lib/view-model";
import { SourcePulse } from "./source-pulse";

export interface DailyMastheadModel {
  dateLabel: string;
  weekdayLabel: string;
  generatedAtLabel: string;
  modeLabel: string;
  scoreVersion: string;
  counts: {
    discovered: number;
    enriched: number;
    published: number;
  };
}

export interface DailyMastheadProps {
  cover: DailyMastheadModel;
  topStory: RepositoryCardModel;
  sources: SourceSummaryModel;
}

export function DailyMasthead({
  cover,
  topStory,
  sources,
}: DailyMastheadProps) {
  return (
    <section className="daily-cover" aria-labelledby="daily-cover-title">
      <div className="daily-cover__edition">
        <span>DAILY OSS INTELLIGENCE</span>
        <span>{cover.modeLabel}</span>
        <span>{cover.scoreVersion}</span>
      </div>

      <div className="daily-cover__date">
        <p>{cover.weekdayLabel}</p>
        <h1 id="daily-cover-title">
          <span className="daily-cover__date-value">{cover.dateLabel}</span>
          今日开源情报
        </h1>
        <p className="daily-cover__timestamp">
          北京时间 {cover.generatedAtLabel} 完成观测
        </p>
      </div>

      <article className="lead-intelligence">
        <p className="eyebrow">NO. 01 / 今日头名</p>
        <Link href={topStory.href} className="lead-intelligence__title">
          {topStory.id}
        </Link>
        <p>{topStory.description}</p>
        <dl className="lead-intelligence__metrics">
          <div>
            <dt>发布分</dt>
            <dd>{topStory.score.toFixed(1)}</dd>
          </div>
          <div>
            <dt>置信度</dt>
            <dd>{Math.round(topStory.confidence * 100)}%</dd>
          </div>
          <div>
            <dt>风险扣分</dt>
            <dd>{topStory.riskPenalty.toFixed(0)}</dd>
          </div>
        </dl>
      </article>

      <SourcePulse summary={sources} />

      <dl className="daily-cover__counts" aria-label="日报处理数量">
        <div>
          <dt>候选池</dt>
          <dd>{cover.counts.discovered} 个候选</dd>
        </div>
        <div>
          <dt>证据补全</dt>
          <dd>{cover.counts.enriched} 个补全</dd>
        </div>
        <div>
          <dt>本期发布</dt>
          <dd>{cover.counts.published} 个入榜</dd>
        </div>
      </dl>
    </section>
  );
}
