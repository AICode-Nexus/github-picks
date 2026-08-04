import type { SourceSummaryModel } from "../lib/view-model";
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
  sources: SourceSummaryModel;
}

export function DailyMasthead({ cover, sources }: DailyMastheadProps) {
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

      <SourcePulse summary={sources} />

      <section className="daily-cover__pipeline" aria-label="日报处理数量">
        <strong>
          {cover.counts.discovered} → {cover.counts.enriched} →{" "}
          {cover.counts.published}
        </strong>
        <span>候选 → 补全 → 发布</span>
      </section>
    </section>
  );
}
