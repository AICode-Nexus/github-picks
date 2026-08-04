import type { DimensionModel } from "../lib/view-model";

export interface DimensionBarsProps {
  dimensions: DimensionModel[];
}

export function DimensionBars({ dimensions }: DimensionBarsProps) {
  return (
    <section
      className="detail-section dimension-section"
      aria-labelledby="dimensions-title"
    >
      <header className="detail-section__heading">
        <p className="eyebrow">VALUE PROFILE / 08</p>
        <h2 id="dimensions-title">八维价值剖面</h2>
        <p className="detail-section__description">
          权重用于综合价值计算；置信度不是第九个价值维度。
        </p>
      </header>
      <ol className="dimension-list">
        {dimensions.map((dimension, index) => (
          <li key={dimension.id}>
            <span className="dimension-list__index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="dimension-list__label">
              <strong>{dimension.label}</strong>
              <small>权重 {dimension.weight}%</small>
            </span>
            <progress
              max="100"
              value={dimension.value}
              aria-label={`${dimension.label} ${dimension.value.toFixed(1)} 分`}
            />
            <span className="dimension-list__value">
              {dimension.value.toFixed(1)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
