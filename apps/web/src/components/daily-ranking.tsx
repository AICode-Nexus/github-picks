"use client";

import { useState } from "react";
import {
  DAILY_RANKING_TAGS,
  type DailyRankingFilter,
  type DailyRankingItemModel,
} from "../lib/daily-ranking";
import { buildDailyRankingShareText } from "../lib/ranking-share";
import { CopyRankingButton } from "./copy-ranking-button";
import { RepositoryRow } from "./repository-row";
import { TopStoryCard } from "./top-story-card";

export interface DailyRankingProps {
  date: string;
  items: DailyRankingItemModel[];
}

export function DailyRanking({ date, items }: DailyRankingProps) {
  const [filter, setFilter] = useState<DailyRankingFilter>("all");
  const matches = (item: DailyRankingItemModel) =>
    filter === "all" || item.tags.some((tag) => tag.id === filter);
  const visibleItems = items.filter(matches);
  const filterLabel =
    filter === "all"
      ? "全部"
      : (DAILY_RANKING_TAGS.find((tag) => tag.id === filter)?.label ?? filter);
  const shareText = buildDailyRankingShareText({
    date,
    filterLabel,
    items: visibleItems,
  });
  const leaders = items.filter((item) => item.rank <= 3);
  const rest = items.filter((item) => item.rank > 3);
  const hasMatches = visibleItems.length > 0;

  return (
    <section
      className="daily-ranking"
      id="ranking"
      aria-labelledby="ranking-title"
    >
      <header className="section-heading">
        <p className="eyebrow">DAILY VALUE / {items.length} PICKS</p>
        <div>
          <h2 id="ranking-title">今日综合价值榜</h2>
          <p>每个项目只出现一次；标签用于切换观察视角，不改变综合名次。</p>
        </div>
        <div className="section-heading__actions">
          <span className="section-heading__count">{items.length} PICKS</span>
          <CopyRankingButton text={shareText} />
        </div>
      </header>

      <fieldset className="ranking-filters">
        <legend className="sr-only">筛选观察标签</legend>
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          全部
        </button>
        {DAILY_RANKING_TAGS.map((tag) => (
          <button
            type="button"
            aria-pressed={filter === tag.id}
            key={tag.id}
            onClick={() => setFilter(tag.id)}
          >
            {tag.label}
          </button>
        ))}
      </fieldset>

      <div className="daily-ranking__top">
        {leaders.map((item) => (
          <div hidden={!matches(item)} key={item.id}>
            <TopStoryCard
              item={item}
              featured={item.rank === 1}
              tags={item.tags}
              testId={`overall-row-${item.id.replace("/", "-")}`}
            />
          </div>
        ))}
      </div>

      <div className="ranking-list">
        {rest.map((item) => (
          <div hidden={!matches(item)} key={item.id}>
            <RepositoryRow
              item={item}
              tags={item.tags}
              testId={`overall-row-${item.id.replace("/", "-")}`}
            />
          </div>
        ))}
      </div>

      {!hasMatches ? <p role="status">当前筛选暂无项目</p> : null}
    </section>
  );
}
