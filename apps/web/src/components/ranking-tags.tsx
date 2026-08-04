import type { DailyRankingTagModel } from "../lib/daily-ranking";

export interface RankingTagsProps {
  tags: DailyRankingTagModel[];
}

export function RankingTags({ tags }: RankingTagsProps) {
  if (tags.length === 0) return null;

  return (
    <ul className="ranking-tags" aria-label="观察标签">
      {tags.map((tag) => (
        <li data-tag={tag.id} key={tag.id}>
          {tag.label}
        </li>
      ))}
    </ul>
  );
}
