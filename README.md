# GitHub Picks

GitHub Picks 是一个中文开源项目情报引擎：从多个发现源持续收集候选仓库，再用 GitHub 事实、工程健康度、组织质量和风险证据生成每日榜单与中文分析。它不把 Star 总量直接等同于项目价值。

> GitHub Picks 是独立、非官方项目，与 GitHub, Inc. 不存在隶属或合作关系。当前 `v0.1.0` 评分仍是实验版本，不能替代正式的技术选型、安全审查或许可证审查。

## 当前完成范围

当前仓库已经跑通第一阶段的纵向闭环：

1. 多信源发现候选项目；
2. 获取 GitHub 仓库事实和近期事件；
3. 获取可用的 OpenSSF Scorecard 结果；
4. 计算八维评分、置信度和独立风险扣分；
5. 生成综合榜、趋势榜、新项目榜、隐藏宝石榜、活跃榜和五个方向榜；
6. 输出可回放的 JSON、中文 Markdown 和运行清单。

网站、Obsidian 接入和个性化 Agent 是下一阶段，尚未在本版本中假装完成。当前产物已经为这三类消费者提供稳定的 `report.json` 和 `report.md` 契约。

## 快速开始

要求 Node.js `24.15.x` 和 pnpm `11.18.0`。

```bash
nvm use
pnpm install
```

先跑不访问网络的证据回放：

```bash
pnpm picks:daily --date 2026-08-03 --mode replay
```

再跑当天实时采集：

```bash
pnpm picks:daily
```

推荐为持续运行提供 GitHub Token，减少匿名额度不足造成的降级：

```bash
GITHUB_TOKEN="$(gh auth token)" pnpm picks:daily
```

默认结果写入 `artifacts/daily/YYYY-MM-DD/`。可用 `--output`、`--config`、`--raw` 和 `--replay-manifest` 显式指定路径。

## 评分框架

总分由八个维度构成，权重固定在 [`config/picks.yaml`](config/picks.yaml)：

| 维度 | 权重 | 主要判断 |
|---|---:|---|
| 实用价值 | 18 | 问题边界、文档入口、主题和交付信号 |
| 活跃度 | 18 | 活跃日、真人参与者、事件多样性和近期推送 |
| 组织与维护者 | 15 | 组织身份、连续维护、参与者和治理代理信号 |
| 工程质量 | 14 | 许可证、Scorecard、评审和发布实践 |
| 真实采用 | 10 | Fork、Watcher、参与者和独立讨论，而非只看 Star |
| 安全与合规 | 10 | 许可证、Scorecard、安全策略和生命周期 |
| 趋势动量 | 10 | Star 速度、外部榜单位置和独立社区讨论 |
| 创新与时效 | 5 | 项目年龄、近期交付和生态扩展性 |

Star 存量对总分的最大直接贡献为 `1.5` 分，Star 速度最大直接贡献为 `3` 分。高频出现的优质组织和持续维护会加分，但综合榜同一组织最多保留两个项目。缺失事实采用中性先验并降低置信度；许可证缺失、长期停更和归档等明确事实进入独立风险通道。

## 当前信源

实际运行中的发现源包括 GitHub Trending、GitHub Search、GitTrend、HubLens 和 Hacker News；配置候选仅在外部源降级时保障五个方向都有可采项目，不提供榜单名次、速度或独立信源加分。事实层当前使用 GitHub REST 和 OpenSSF Scorecard。

更完整的端点、额度、降级和恢复说明见 [`docs/runbooks/daily-pipeline.md`](docs/runbooks/daily-pipeline.md)。首次实时运行与修复后的对照见 [`docs/research/daily/2026-08-03-first-live-run.md`](docs/research/daily/2026-08-03-first-live-run.md)。最新已提交实时榜单见 [`artifacts/daily/2026-08-04/report.md`](artifacts/daily/2026-08-04/report.md)。

## 工程结构

```text
config/picks.yaml                 方向、信源、权重和限额
packages/picks-core/              数据契约、评分、分析和榜单
workers/daily/                    采集、原始快照、补全和日报流水线
artifacts/daily/                  可提交的 JSON/Markdown 日报
artifacts/raw/                    不提交的内容寻址原始响应
docs/runbooks/                    运行与故障恢复说明
docs/research/                    观测证据和验证记录
```

## 验证

```bash
pnpm format
TURBO_FORCE=true pnpm check
```

仓库使用证据回放测试保证离线可复现；实时报告则始终标记采集模式、生成时间和信源健康状态。
