import {
  Bot,
  CalendarRange,
  Compass,
  Database,
  ExternalLink,
  GitCompareArrows,
} from "lucide-react";
import Link from "next/link";

export const PROJECT_INSTALL_COMMAND =
  "DISABLE_TELEMETRY=1 npx -y skills@1.5.21 add AICode-Nexus/github-picks --skill github-picks --agent codex --yes --copy";

export const GLOBAL_INSTALL_COMMAND = `${PROJECT_INSTALL_COMMAND} --global`;

export const VERIFY_PROMPT =
  "使用 $github-picks 告诉我今天最值得关注的 5 个 GitHub 开源项目，并说明理由和风险。";

const EXAMPLE_PROMPTS = [
  "今天最值得关注的 5 个 GitHub 开源项目是什么？说明理由和风险。",
  "近 30 天安全与软件供应链方向有哪些持续值得看的项目？不要按 Star 重排。",
  "比较两个已收录仓库的工程成熟度、置信度和公开风险证据。",
] as const;

const CAPABILITIES = [
  {
    label: "最新日报",
    detail: "读取最新 live 日报、生成时间与信源健康状态。",
    icon: Database,
  },
  {
    label: "周期持续价值榜",
    detail: "查询 7、30、90 与 180 天窗口，并如实说明实际覆盖天数。",
    icon: CalendarRange,
  },
  {
    label: "五个技术方向",
    detail: "按 AI、数据、应用平台、基础设施与安全方向保序筛选。",
    icon: Compass,
  },
  {
    label: "仓库证据与历史观测",
    detail: "比较已收录项目的公开事实、置信度、风险与历史变化。",
    icon: GitCompareArrows,
  },
] as const;

const RESOURCE_LINKS = [
  {
    label: "Skill 源码",
    href: "https://github.com/AICode-Nexus/github-picks/tree/master/.agents/skills/github-picks",
  },
  {
    label: "API 状态",
    href: "https://aicode-nexus.github.io/github-picks/api/v1/meta.json",
  },
  {
    label: "接入运行手册",
    href: "https://github.com/AICode-Nexus/github-picks/blob/master/docs/runbooks/github-picks-agent-api.md",
  },
] as const;

export function AgentTutorialPage() {
  return (
    <main id="main-content">
      <div className="page-shell inner-page agent-page">
        <nav className="breadcrumbs" aria-label="面包屑">
          <Link href="/">今日榜单</Link>
          <span aria-hidden="true">/</span>
          <span>Agent 接入</span>
        </nav>

        <header className="agent-hero">
          <div className="agent-hero__copy">
            <p className="eyebrow">AGENT ACCESS / PUBLIC API V1</p>
            <h1>让 Agent 直接使用 GitHub Picks</h1>
            <p>
              安装公开
              Skill，直接查询最新日报、周期榜、技术方向和已收录仓库证据。
            </p>
          </div>
          <ul className="agent-status-list" aria-label="接入状态">
            <li>匿名只读</li>
            <li>无需 API Key</li>
            <li>公开数据</li>
            <li>
              <Bot aria-hidden="true" size={17} />
              Skill 已发布
            </li>
          </ul>
        </header>

        <section
          className="agent-section"
          aria-labelledby="agent-install-title"
        >
          <header className="agent-section__heading">
            <p className="eyebrow">QUICK START</p>
            <h2 id="agent-install-title">三步开始</h2>
          </header>
          <ol className="agent-steps">
            <li>
              <span className="agent-step__number">01</span>
              <h3>安装 Skill</h3>
              <p>在项目目录执行命令。安装前可以先审阅公开 Skill 文件。</p>
              <div className="agent-command">
                <pre>
                  <code>{PROJECT_INSTALL_COMMAND}</code>
                </pre>
              </div>
              <details className="agent-global-install">
                <summary>改为用户级安装</summary>
                <pre>
                  <code>{GLOBAL_INSTALL_COMMAND}</code>
                </pre>
              </details>
            </li>
            <li>
              <span className="agent-step__number">02</span>
              <h3>新开会话</h3>
              <p>
                多数 Agent 只在会话开始时扫描
                Skill。安装后关闭旧会话，再新建一个。
              </p>
            </li>
            <li>
              <span className="agent-step__number">03</span>
              <h3>开始提问</h3>
              <p>{VERIFY_PROMPT}</p>
            </li>
          </ol>
        </section>

        <section
          className="agent-section"
          aria-labelledby="agent-examples-title"
        >
          <header className="agent-section__heading">
            <p className="eyebrow">ASK DIRECTLY</p>
            <h2 id="agent-examples-title">装好后这样问</h2>
          </header>
          <ol className="agent-example-list">
            {EXAMPLE_PROMPTS.map((prompt, index) => (
              <li key={prompt}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{prompt}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="agent-section"
          aria-labelledby="agent-capabilities-title"
        >
          <header className="agent-section__heading">
            <p className="eyebrow">PUBLIC INTELLIGENCE</p>
            <h2 id="agent-capabilities-title">Agent 能做什么</h2>
          </header>
          <ul className="agent-capabilities" aria-label="Agent 能力">
            {CAPABILITIES.map(({ label, detail, icon: Icon }) => (
              <li key={label}>
                <Icon aria-hidden="true" size={20} />
                <div>
                  <h3>{label}</h3>
                  <p>{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="agent-boundary"
          aria-labelledby="agent-boundary-title"
        >
          <div>
            <p className="eyebrow">READ-ONLY BOUNDARY</p>
            <h2 id="agent-boundary-title">公开数据，有明确边界</h2>
            <p>
              Skill 只读取 GitHub Picks 固定域名下的匿名只读
              API，不访问私有仓库，不要求 Token，也不重新评分或按 Star 改序。
            </p>
          </div>
          <aside>
            <h3>没有发现 Skill？</h3>
            <ol>
              <li>关闭旧会话并新建会话。</li>
              <li>
                确认 Agent 发现了 <code>github-picks</code>。
              </li>
              <li>仍失败时审阅安装路径和公开运行手册。</li>
            </ol>
          </aside>
          <nav className="agent-resources" aria-label="Agent 接入资源">
            {RESOURCE_LINKS.map((resource) => (
              <a
                key={resource.href}
                href={resource.href}
                target="_blank"
                rel="noreferrer"
              >
                {resource.label}
                <ExternalLink aria-hidden="true" size={15} />
              </a>
            ))}
          </nav>
        </section>
      </div>
    </main>
  );
}
