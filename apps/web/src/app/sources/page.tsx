import type { Metadata } from "next";
import Link from "next/link";
import { SourceHealthTable } from "../../components/source-health-table";
import { getLatestLiveReport } from "../../lib/report-store";
import { buildSourceSummary } from "../../lib/view-model";

export const metadata: Metadata = {
  title: "信源状态",
  description: "GitHub Picks 本期多信源采集健康、降级与证据覆盖说明。",
};

export default async function Page() {
  const report = await getLatestLiveReport();
  const summary = buildSourceSummary(report);

  return (
    <main id="main-content">
      <div className="page-shell inner-page sources-page">
        <nav className="breadcrumbs" aria-label="面包屑">
          <Link href="/">今日榜单</Link>
          <span aria-hidden="true">/</span>
          <span>信源状态</span>
        </nav>

        <header className="sources-hero">
          <div>
            <p className="eyebrow">SOURCE ROOM / {report.date}</p>
            <h1>本期信源现场</h1>
            <p>
              多信源用于发现、事实补全、风险核验与交叉验证。健康状态只描述本次执行，不把缺失证据包装成确定结论。
            </p>
          </div>
          <dl>
            <div data-status="healthy">
              <dt>正常</dt>
              <dd>{summary.counts.healthy}</dd>
            </div>
            <div data-status="degraded">
              <dt>降级</dt>
              <dd>{summary.counts.degraded}</dd>
            </div>
            <div data-status="offline">
              <dt>离线</dt>
              <dd>{summary.counts.offline}</dd>
            </div>
          </dl>
        </header>

        <SourceHealthTable sources={report.sourceHealth} />

        <section
          className="source-method"
          aria-labelledby="source-method-title"
        >
          <header className="detail-section__heading">
            <p className="eyebrow">INDEPENDENCE MODEL</p>
            <h2 id="source-method-title">怎样理解“多信源”</h2>
            <p className="detail-section__description">
              信源数量不等于独立证据数量，必须看来源组和用途。
            </p>
          </header>
          <div className="source-method__grid">
            <article>
              <span>01</span>
              <h3>配置候选</h3>
              <p className="source-method__copy">
                方向种子保证五个领域不会因当天热度而消失。它只负责发现候选，不直接证明项目质量。
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>GitHub 同组</h3>
              <p className="source-method__copy">
                Trending、Search、REST 与 GitTrend
                可能来自同一公开数据生态；多个端点不能自动算成多个独立事实。
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>独立社区与安全组</h3>
              <p className="source-method__copy">
                Hacker News 提供社区讨论，OpenSSF
                提供安全工程实践。两者用途不同，也不能互相替代。
              </p>
            </article>
          </div>
        </section>

        <aside className="source-principle">
          <strong>缺失值原则</strong>
          <p className="source-principle__copy">
            缺少
            Scorecard、讨论信号或速度窗口时，系统使用中性先验并降低置信度；不会直接记零分，也不会宣称通过安全审查。
          </p>
        </aside>
      </div>
    </main>
  );
}
