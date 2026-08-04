import type { DailyReport } from "@github-picks/core/schema";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { DIMENSION_IDS, DIMENSION_META, DIRECTION_IDS } from "../lib/site-meta";
import {
  buildDirectionSummary,
  buildRankingItems,
  buildSourceSummary,
} from "../lib/view-model";
import { DailyMasthead, type DailyMastheadModel } from "./daily-masthead";
import { DirectionIndex } from "./direction-index";
import { RankingSection } from "./ranking-section";
import { TopStoryCard } from "./top-story-card";

export interface HomePageProps {
  report: DailyReport;
}

function formatReportDate(date: string): {
  dateLabel: string;
  weekdayLabel: string;
} {
  const value = new Date(`${date}T00:00:00+08:00`);
  return {
    dateLabel: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Shanghai",
    }).format(value),
    weekdayLabel: new Intl.DateTimeFormat("zh-CN", {
      weekday: "long",
      timeZone: "Asia/Shanghai",
    }).format(value),
  };
}

function formatGeneratedAt(generatedAt: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(generatedAt));
}

export function HomePage({ report }: HomePageProps) {
  const overall = buildRankingItems(report, report.rankings.overall);
  const topStories = overall.slice(0, 3);
  const topStory = topStories[0];
  if (topStory === undefined) {
    throw new Error("live DailyReport has no overall ranking");
  }

  const sourceSummary = buildSourceSummary(report);
  const problemSources = sourceSummary.items.filter(
    (source) => source.status !== "healthy",
  );
  const date = formatReportDate(report.date);
  const cover: DailyMastheadModel = {
    ...date,
    generatedAtLabel: formatGeneratedAt(report.generatedAt),
    modeLabel: report.mode === "live" ? "实时观测" : "证据回放",
    scoreVersion: report.scoreVersion,
    counts: report.counts,
  };
  const directionSummaries = DIRECTION_IDS.map((directionId) =>
    buildDirectionSummary(report, directionId),
  );
  const rankingSlices = [
    {
      key: "rising",
      eyebrow: "MOMENTUM",
      title: "趋势上升",
      description: "近期信号增速与跨源趋势更强的项目。",
      items: report.rankings.rising,
    },
    {
      key: "new",
      eyebrow: "NEW PROJECTS",
      title: "新项目潜力",
      description: "仍年轻，但已经显露工程交付和真实采用信号。",
      items: report.rankings.newProjects,
    },
    {
      key: "hidden",
      eyebrow: "UNDER THE RADAR",
      title: "隐藏宝石",
      description: "Star 存量尚未占优，综合证据却值得提前观察。",
      items: report.rankings.hiddenGems,
    },
    {
      key: "active",
      eyebrow: "ENGINEERING PULSE",
      title: "开发活跃",
      description: "近期真人参与、提交协作和维护连续性更突出。",
      items: report.rankings.active,
    },
  ] as const;

  return (
    <main id="main-content">
      <div className="page-shell">
        {sourceSummary.hasProblems ? (
          <aside className="source-warning" data-testid="source-warning">
            <AlertTriangle aria-hidden="true" size={19} />
            <div>
              <strong>本期存在信源降级，榜单仍按可用证据发布</strong>
              <ul>
                {problemSources.map((source) => (
                  <li key={source.id}>
                    {source.name}：{source.message}
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/sources/">
              查看影响范围
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </aside>
        ) : null}

        <DailyMasthead
          cover={cover}
          topStory={topStory}
          sources={sourceSummary}
        />

        <section className="editor-picks" aria-labelledby="editor-picks-title">
          <header className="section-heading">
            <p className="eyebrow">EDITOR'S DESK / TOP 03</p>
            <div>
              <h2 id="editor-picks-title">编辑部精选</h2>
              <p>先看价值证据，再看热度；每个分数都保留置信度与风险边界。</p>
            </div>
          </header>
          <div className="editor-picks__grid">
            {topStories.map((item, index) => (
              <TopStoryCard item={item} featured={index === 0} key={item.id} />
            ))}
          </div>
        </section>

        <RankingSection
          id="overall"
          eyebrow="COMPOSITE VALUE / FULL LIST"
          title="综合价值榜"
          description="八维价值分经置信度折算并扣除明确风险；Star 只占采用维度的一小部分。"
          items={overall}
          testIdPrefix="overall-row"
        />

        <section className="ranking-slices" aria-label="专项榜单">
          {rankingSlices.map((ranking) => (
            <RankingSection
              key={ranking.key}
              eyebrow={ranking.eyebrow}
              title={ranking.title}
              description={ranking.description}
              items={buildRankingItems(report, ranking.items.slice(0, 5))}
              compact
            />
          ))}
        </section>

        <DirectionIndex directions={directionSummaries} />

        <section className="method-note" aria-labelledby="method-note-title">
          <div>
            <p className="eyebrow">SCORING NOTE / {report.scoreVersion}</p>
            <h2 id="method-note-title">这不是另一个 Star 排行榜</h2>
            <p>
              GitHub Picks
              同时看实用价值、维护活动、组织连续性、工程成熟度、采用、安全、趋势与创新。发布分、置信度和风险扣分始终分开展示。
            </p>
          </div>
          <ol className="weight-list">
            {DIMENSION_IDS.map((id, index) => (
              <li key={id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{DIMENSION_META[id].label}</strong>
                <em>{DIMENSION_META[id].weight}%</em>
              </li>
            ))}
          </ol>
          <aside>
            <strong>读榜提示</strong>
            <p>
              高分不等于生产可用；缺失值不按零分处理；无风险扣分也不代表完成安全审查。
            </p>
            <Link href="/sources/">查看本期证据覆盖</Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
