import type { RepositoryCardModel } from "../lib/view-model";
import { RepositoryRow } from "./repository-row";

export interface RankingSectionProps {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  items: RepositoryCardModel[];
  compact?: boolean;
  testIdPrefix?: string;
}

export function RankingSection({
  id,
  eyebrow,
  title,
  description,
  items,
  compact = false,
  testIdPrefix,
}: RankingSectionProps) {
  return (
    <section className="ranking-section" id={id}>
      <header className="section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="section-heading__count">{items.length} PICKS</span>
      </header>
      <div className="ranking-list">
        {items.map((item) => (
          <RepositoryRow
            item={item}
            key={item.id}
            compact={compact}
            testId={
              testIdPrefix
                ? `${testIdPrefix}-${item.id.replace("/", "-")}`
                : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
