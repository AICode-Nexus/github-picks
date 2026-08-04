import { ArrowUpRight } from "lucide-react";
import type { EvidenceLinkModel } from "../lib/view-model";

export interface EvidenceListProps {
  evidence: EvidenceLinkModel[];
}

export function EvidenceList({ evidence }: EvidenceListProps) {
  const uniqueEvidence = [
    ...new Map(evidence.map((item) => [item.url, item])).values(),
  ];

  return (
    <section className="detail-section evidence-section" aria-label="公开证据">
      <header className="detail-section__heading">
        <p className="eyebrow">PUBLIC EVIDENCE / {uniqueEvidence.length}</p>
        <h2>公开证据</h2>
        <p className="detail-section__description">
          仅展示可访问 URL；内部原始对象标识与存储哈希不会公开。
        </p>
      </header>
      <ol className="evidence-list">
        {uniqueEvidence.map((item, index) => (
          <li key={item.url}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <a href={item.url} target="_blank" rel="noreferrer">
              <strong>
                {item.sourceName} · {item.field}
              </strong>
              <small>{item.url}</small>
              <ArrowUpRight aria-hidden="true" size={18} />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
