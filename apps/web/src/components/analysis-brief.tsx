import type { RepositoryDetailModel } from "../lib/view-model";

export interface AnalysisBriefProps {
  analysis: RepositoryDetailModel["analysis"];
}

const sections = [
  { id: "suitableFor", index: "02", title: "适合谁" },
  { id: "risks", index: "03", title: "风险与边界" },
  { id: "nextStep", index: "04", title: "下一步验证" },
] as const;

export function AnalysisBrief({ analysis }: AnalysisBriefProps) {
  const sectionsWithRecommendation = [
    {
      id: "recommendationReason" as const,
      index: "01",
      title: analysis.attribution.label,
    },
    ...sections,
  ];
  return (
    <section className="detail-section" aria-labelledby="analysis-title">
      <header className="detail-section__heading">
        <p className="eyebrow">EDITORIAL BRIEF / ZH</p>
        <h2 id="analysis-title">中文决策分析</h2>
        <p className="detail-section__description">
          把分数还原成适用场景、风险边界和可执行验证。
        </p>
        <p className="analysis-attribution">{analysis.attribution.detail}</p>
      </header>
      <div className="analysis-grid">
        {sectionsWithRecommendation.map((section) => (
          <article key={section.id}>
            <span>{section.index}</span>
            <h3>{section.title}</h3>
            <p className="analysis-grid__copy">{analysis[section.id]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
