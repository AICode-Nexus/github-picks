import type { DailyReport } from "@github-picks/core/schema";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CodeXml,
  GitFork,
  Scale,
  ShieldCheck,
  Star,
} from "lucide-react";
import Link from "next/link";
import { buildRepositoryDetail } from "../lib/view-model";
import { AnalysisBrief } from "./analysis-brief";
import { DimensionBars } from "./dimension-bars";
import { EvidenceList } from "./evidence-list";

export interface RepositoryDetailProps {
  report: DailyReport;
  repositoryId: string;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export function RepositoryDetail({
  report,
  repositoryId,
}: RepositoryDetailProps) {
  const detail = buildRepositoryDetail(report, repositoryId);

  return (
    <main id="main-content">
      <div className="page-shell inner-page repository-detail">
        <nav className="breadcrumbs" aria-label="面包屑">
          <Link href="/">
            <ArrowLeft aria-hidden="true" size={15} />
            今日榜单
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`/directions/${detail.directionId}/`}>
            {detail.directionName}
          </Link>
        </nav>

        <header className="repository-hero">
          <div className="repository-hero__identity">
            <p className="eyebrow">
              REPOSITORY DOSSIER / OVERALL #
              {String(detail.rank).padStart(2, "0")}
            </p>
            <h1>{detail.id}</h1>
            <p>{detail.description}</p>
            <div className="repository-hero__actions">
              <a
                className="button-link"
                href={detail.githubUrl}
                target="_blank"
                rel="noreferrer"
              >
                查看 GitHub
                <ArrowUpRight aria-hidden="true" size={17} />
              </a>
              {detail.homepage ? (
                <a
                  className="text-link"
                  href={detail.homepage}
                  target="_blank"
                  rel="noreferrer"
                >
                  项目主页
                  <ArrowUpRight aria-hidden="true" size={15} />
                </a>
              ) : null}
            </div>
          </div>

          <dl className="score-ledger" aria-label="评分总账">
            <div className="score-ledger__primary">
              <dt>发布分</dt>
              <dd>{detail.score.toFixed(1)}</dd>
            </div>
            <div>
              <dt>基础分</dt>
              <dd>{detail.baseScore.toFixed(1)}</dd>
            </div>
            <div>
              <dt>置信度</dt>
              <dd>
                {detail.confidenceLabel} · {Math.round(detail.confidence * 100)}
                %
              </dd>
            </div>
            <div>
              <dt>风险扣分</dt>
              <dd className={detail.riskPenalty > 0 ? "has-risk" : undefined}>
                −{detail.riskPenalty.toFixed(0)}
              </dd>
            </div>
          </dl>
        </header>

        <section className="repository-facts" aria-label="仓库事实">
          <div>
            <Star aria-hidden="true" size={17} />
            <span>Star</span>
            <strong>{detail.stars.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <GitFork aria-hidden="true" size={17} />
            <span>Fork</span>
            <strong>{detail.forks.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <CodeXml aria-hidden="true" size={17} />
            <span>语言</span>
            <strong>{detail.language}</strong>
          </div>
          <div>
            <Scale aria-hidden="true" size={17} />
            <span>许可证</span>
            <strong>{detail.license.label}</strong>
          </div>
          <div>
            <CalendarClock aria-hidden="true" size={17} />
            <span>最近推送</span>
            <strong>{formatDate(detail.pushedAt)}</strong>
          </div>
        </section>

        <section
          className="evidence-boundary"
          aria-labelledby="evidence-boundary-title"
        >
          <div>
            <p className="eyebrow">RISK &amp; COVERAGE</p>
            <h2 id="evidence-boundary-title">风险与证据边界</h2>
          </div>
          <div className="evidence-boundary__column">
            <h3>明确风险 Finding</h3>
            {detail.riskFindings.length > 0 ? (
              <ul>
                {detail.riskFindings.map((finding) => (
                  <li className="evidence-boundary__copy" key={finding.code}>
                    <strong>
                      {finding.levelLabel}风险 · −{finding.penalty}
                    </strong>
                    <span>{finding.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="evidence-boundary__copy">
                尚未发现带数值扣分的明确风险；这不代表完成安全审查。
              </p>
            )}
          </div>
          <div className="evidence-boundary__column">
            <h3>缺失证据</h3>
            {detail.evidenceGaps.length > 0 ? (
              <ul>
                {detail.evidenceGaps.map((gap) => (
                  <li className="evidence-boundary__copy" key={gap}>
                    {gap}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="evidence-boundary__copy">关键证据字段齐全。</p>
            )}
            <p className="scorecard-status evidence-boundary__copy">
              <ShieldCheck aria-hidden="true" size={17} />
              OpenSSF：{detail.scorecard.label}
            </p>
          </div>
        </section>

        <DimensionBars dimensions={detail.dimensions} />
        <AnalysisBrief analysis={detail.analysis} />

        <section className="detail-section" aria-labelledby="activity-title">
          <header className="detail-section__heading">
            <p className="eyebrow">30-DAY ENGINEERING WINDOW</p>
            <h2 id="activity-title">近期工程活动</h2>
            <p className="detail-section__description">
              事件窗口反映维护活动，不直接代表代码质量。
            </p>
          </header>
          <dl className="activity-grid">
            <div>
              <dt>7 日活跃天</dt>
              <dd>{detail.activity.activeDays7d}</dd>
            </div>
            <div>
              <dt>30 日活跃天</dt>
              <dd>{detail.activity.activeDays30d}</dd>
            </div>
            <div>
              <dt>真人参与者</dt>
              <dd>{detail.activity.humanActors30d}</dd>
            </div>
            <div>
              <dt>Push</dt>
              <dd>{detail.activity.pushes30d}</dd>
            </div>
            <div>
              <dt>Pull Request</dt>
              <dd>{detail.activity.pullRequests30d}</dd>
            </div>
            <div>
              <dt>Issue</dt>
              <dd>{detail.activity.issues30d}</dd>
            </div>
            <div>
              <dt>Release</dt>
              <dd>{detail.activity.releases30d}</dd>
            </div>
          </dl>
        </section>

        <section className="detail-section" aria-labelledby="signals-title">
          <header className="detail-section__heading">
            <p className="eyebrow">DISCOVERY TRAIL / {detail.signals.length}</p>
            <h2 id="signals-title">候选发现信号</h2>
            <p className="detail-section__description">
              同一 GitHub 数据组的多个信号不能被误算为完全独立证据。
            </p>
          </header>
          <ol className="signal-list">
            {detail.signals.map((signal, index) => (
              <li key={`${signal.sourceId}-${signal.evidenceUrl}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{signal.sourceName}</strong>
                  <small>
                    Tier {signal.sourceTier}
                    {signal.rank ? ` · 来源排名 #${signal.rank}` : ""}
                  </small>
                </div>
                <a href={signal.evidenceUrl} target="_blank" rel="noreferrer">
                  查看信号
                  <ArrowUpRight aria-hidden="true" size={16} />
                </a>
              </li>
            ))}
          </ol>
        </section>

        <EvidenceList evidence={detail.evidence} />

        <Link className="back-to-ranking" href="/#overall">
          <ArrowLeft aria-hidden="true" size={18} />
          返回综合价值榜
        </Link>
      </div>
    </main>
  );
}
