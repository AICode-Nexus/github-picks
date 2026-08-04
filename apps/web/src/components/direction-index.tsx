import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { DirectionSummaryModel } from "../lib/view-model";

export interface DirectionIndexProps {
  directions: DirectionSummaryModel[];
}

export function DirectionIndex({ directions }: DirectionIndexProps) {
  return (
    <section className="direction-index" id="directions">
      <header className="section-heading section-heading--dark">
        <p className="eyebrow">TECHNICAL BEATS / 05</p>
        <div>
          <h2>五个技术方向</h2>
          <p>按工程目标进入分榜，减少热门项目对细分领域的淹没。</p>
        </div>
      </header>
      <ol className="direction-grid">
        {directions.map((direction, index) => (
          <li key={direction.id}>
            <Link href={`/directions/${direction.id}/`}>
              <span className="direction-card__number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="direction-card__body">
                <strong>{direction.name}</strong>
                <span>{direction.description}</span>
                <span className="direction-card__projects">
                  {direction.items.length > 0
                    ? direction.items
                        .slice(0, 3)
                        .map((item) => item.id)
                        .join(" · ")
                    : "本期暂无达到证据门槛的项目"}
                </span>
              </span>
              <span className="direction-card__count">
                {direction.count}
                <small>入榜</small>
              </span>
              <ArrowRight aria-hidden="true" size={21} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
