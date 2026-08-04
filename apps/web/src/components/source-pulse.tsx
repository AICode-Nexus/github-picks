import { Radio } from "lucide-react";
import Link from "next/link";
import type { SourceSummaryModel } from "../lib/view-model";

export interface SourcePulseProps {
  summary: SourceSummaryModel;
}

export function SourcePulse({ summary }: SourcePulseProps) {
  const observed = summary.items.length;
  return (
    <aside className="source-pulse" aria-label="本次信源健康状态">
      <div className="source-pulse__heading">
        <Radio aria-hidden="true" size={17} />
        <span>信源脉冲</span>
      </div>
      <div className="source-pulse__total">
        <strong>{observed}</strong>
        <span>个执行信源</span>
      </div>
      <dl className="source-pulse__counts">
        <div>
          <dt>正常</dt>
          <dd>{summary.counts.healthy}</dd>
        </div>
        <div>
          <dt>降级</dt>
          <dd>{summary.counts.degraded}</dd>
        </div>
        <div>
          <dt>离线</dt>
          <dd>{summary.counts.offline}</dd>
        </div>
      </dl>
      <Link className="text-link" href="/sources/">
        查看信源现场
      </Link>
    </aside>
  );
}
