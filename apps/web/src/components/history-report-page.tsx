import type { DailyReport } from "@github-picks/core/schema";
import { ArrowLeft, ArrowRight, Database, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReportArchiveEntryModel } from "../lib/period-ranking";
import { buildHistoryRankingShareText } from "../lib/ranking-share";
import { getSourceName } from "../lib/site-meta";
import { buildRankingItems } from "../lib/view-model";
import { HistoryDatePicker } from "./history-date-picker";
import { RankingSection } from "./ranking-section";

export interface HistoryReportPageProps {
  report: DailyReport;
  archive: ReportArchiveEntryModel[];
  previousDate: string | null;
  nextDate: string | null;
  basePath?: string | undefined;
}

function formatChineseDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}年${month}月${day}日`;
}

function formatGeneratedAt(generatedAt: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(generatedAt));
}

export function HistoryReportPage({
  report,
  archive,
  previousDate,
  nextDate,
  basePath,
}: HistoryReportPageProps) {
  const overall = buildRankingItems(report, report.rankings.overall);
  const problemSources = report.sourceHealth.filter(
    (source) => source.status !== "healthy",
  );
  const shareText = buildHistoryRankingShareText({
    date: report.date,
    items: overall,
  });

  return (
    <main id="main-content">
      <div className="page-shell history-report-page">
        <nav className="breadcrumbs" aria-label="面包屑">
          <Link href="/history/">
            <ArrowLeft aria-hidden="true" size={15} />
            历史日报
          </Link>
          <span aria-hidden="true">/</span>
          <span>{report.date}</span>
        </nav>

        <header className="history-report-hero">
          <div>
            <p className="eyebrow">DAILY SNAPSHOT / LIVE ONLY</p>
            <h1>{formatChineseDate(report.date)} 开源情报</h1>
            <p>
              这是所选日期的不可变公开快照；分数、置信度、风险和信源状态均来自当日
              report.json。
            </p>
          </div>
          <HistoryDatePicker
            dates={archive.map((entry) => entry.date)}
            currentDate={report.date}
            basePath={basePath}
            compact
          />
          <dl>
            <div>
              <dt>生成时间</dt>
              <dd>{formatGeneratedAt(report.generatedAt)}</dd>
            </div>
            <div>
              <dt>评分版本</dt>
              <dd>{report.scoreVersion}</dd>
            </div>
            <div>
              <dt>发布项目</dt>
              <dd>{report.counts.published}</dd>
            </div>
          </dl>
        </header>

        <nav className="history-sequence" aria-label="相邻历史日报">
          {previousDate ? (
            <Link href={`/history/${previousDate}/`}>
              <ArrowLeft aria-hidden="true" size={17} />
              <span>
                <small>上一期</small>
                {previousDate}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {nextDate ? (
            <Link href={`/history/${nextDate}/`}>
              <span>
                <small>下一期</small>
                {nextDate}
              </span>
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          ) : (
            <Link href="/">
              <span>
                <small>返回最新</small>
                今日榜单
              </span>
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          )}
        </nav>

        {problemSources.length > 0 ? (
          <aside className="history-source-note">
            <TriangleAlert aria-hidden="true" size={20} />
            <div>
              <strong>当期有 {problemSources.length} 个信源降级或离线</strong>
              <ul>
                {problemSources.map((source) => (
                  <li key={source.sourceId}>
                    {getSourceName(source.sourceId)}：
                    {source.message ?? source.status}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : null}

        <RankingSection
          id="history-overall"
          eyebrow={`DAILY VALUE / ${report.date}`}
          title="当日综合价值榜"
          description="以下顺序完整保留该日发布结果；项目详情链接展示最新公开档案，本页数值仍是历史快照。"
          items={overall}
          shareText={shareText}
          testIdPrefix="history-row"
        />

        <aside className="history-integrity-note">
          <Database aria-hidden="true" size={18} />
          <p>
            历史页不会在浏览器中重新评分，也不会用今天的数据回填过去。若同日有多次
            live 运行，索引固定选择生成时间最新的一份。
          </p>
        </aside>
      </div>
    </main>
  );
}
