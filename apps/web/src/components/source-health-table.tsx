import type { DailyReport } from "@github-picks/core/schema";
import {
  CircleCheck,
  CircleOff,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";
import { getSourceName } from "../lib/site-meta";

type SourceHealth = DailyReport["sourceHealth"][number];

export interface SourceHealthTableProps {
  sources: DailyReport["sourceHealth"];
}

const statusMeta: Record<
  SourceHealth["status"],
  { label: string; Icon: LucideIcon }
> = {
  healthy: { label: "正常", Icon: CircleCheck },
  degraded: { label: "降级", Icon: TriangleAlert },
  offline: { label: "离线", Icon: CircleOff },
};

function formatObservedAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function fallbackMessage(status: SourceHealth["status"]): string {
  if (status === "healthy") return "本次采集正常";
  if (status === "degraded") return "本次采集降级";
  return "本次采集离线";
}

export function SourceHealthTable({ sources }: SourceHealthTableProps) {
  return (
    <section
      className="source-health-block"
      aria-labelledby="source-health-title"
    >
      <header className="detail-section__heading">
        <p className="eyebrow">COLLECTION RUN / {sources.length} SOURCES</p>
        <h2 id="source-health-title">执行信源状态</h2>
        <p className="detail-section__description">
          状态描述的是本次采集，不代表信源永久可用或不可用。
        </p>
      </header>
      <table className="source-health-table">
        <thead>
          <tr>
            <th scope="col">信源</th>
            <th scope="col">状态</th>
            <th scope="col">观测时间</th>
            <th scope="col">本次说明</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => {
            const { Icon, label } = statusMeta[source.status];
            return (
              <tr key={source.sourceId} data-status={source.status}>
                <th scope="row" data-label="信源">
                  <strong>{getSourceName(source.sourceId)}</strong>
                  <small>{source.sourceId}</small>
                </th>
                <td data-label="状态">
                  <span className="source-status">
                    <Icon aria-hidden="true" size={17} />
                    {label}
                  </span>
                </td>
                <td data-label="观测时间">
                  <time dateTime={source.observedAt}>
                    {formatObservedAt(source.observedAt)}
                  </time>
                </td>
                <td data-label="本次说明">
                  {source.message ?? fallbackMessage(source.status)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="source-health-note">
        OpenSSF Scorecard
        的覆盖不足不等于安全通过或失败；它只表示当前缺少这一类安全工程证据。
      </p>
    </section>
  );
}
