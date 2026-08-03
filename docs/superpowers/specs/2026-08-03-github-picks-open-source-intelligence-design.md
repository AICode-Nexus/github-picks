# GitHub Picks：中文开源情报与决策系统设计规格

- 日期：2026-08-03
- 状态：用户已确认，进入 M0/M1 实施规划
- 产品主名称：GitHub Picks
- 中文定位：GitHub 精选
- 产品副标题：每日发现真正值得关注的开源项目
- 独立声明：GitHub Picks 是独立、非官方项目，与 GitHub, Inc. 不存在隶属或合作关系
- 当前边界：先完成信源、分析、榜单和网站，再接入 Obsidian，最后开放个性化 Agent；邮件等主动推送不在首期

## 0. 已确认需求总表与追踪矩阵

本规格是此前全部讨论的总规格，不只是技术架构摘要。后续若拆分实施文档，以本节的产品边界和第 34 节的决策记录为准；各里程碑实施计划不得自行删减这些要求。

### 0.1 已确认且不可回退的产品要求

1. 产品名称确定为 **GitHub Picks**，中文副标题为“每日发现真正值得关注的开源项目”。
2. 目标不是复制 GitHub Trending，而是提供多信源、可解释、可回放的中文开源情报。
3. 在决定自建前必须认真比较现有产品；如果用户只需要“看热门项目”，应直接推荐现有网站，不为自建而自建。
4. 第一阶段不做邮件推送，顺序固定为：稳定采集 → 分析处理 → 榜单和分析结果 → 网站/API/Markdown → Obsidian → Agent → 主动推送。
5. 信源必须多样且稳定，既覆盖 GitHub 一手数据，也覆盖包生态、安全、依赖、社区和外部发现信号。
6. 技术方向不能只做单一 AI 赛道，首期按第 7.3 节覆盖多类软件工程方向，并允许后续扩展。
7. 评分不能只看 Star；总 Star 直接贡献最多 1.5 分，Star 增速直接贡献最多 3 分。
8. 高频且持续的真实开发活动必须明显加分；Activity 占综合分 18%，Momentum 占 10%，但同一事件不得重复计分。
9. 优质组织和维护者必须明显加分；Organization 独立占综合分 15%，同时设置衰减、上限和新组织保护。
10. 分数、置信度和风险必须分开展示；高分不能抵消明确的许可证、安全或维护风险。
11. 所有事实、特征、分数、榜单和中文结论都必须能追溯到来源、时间与算法版本。
12. 中文分析要回答“为什么值得看、适合谁、风险是什么、下一步做什么”，不能只是翻译 README。
13. Obsidian 是正式产品层，不是导出附件；标准 Markdown 为基线，原生插件增量同步，永不覆盖用户内容。
14. Agent 最后接入，只改变个性化排序和解释，不改变公共事实分，也不得默认读取整个 Vault。

### 0.2 需求追踪矩阵

| 此前提出的要求 | 规格落点 | 可验收结果 |
|---|---|---|
| 每天看到最新、最有价值的 GitHub 仓库 | 第 5、10、11、29 节 | 北京时间 08:00 形成不可变日报、榜单和 Top 3 分析 |
| 先看有没有类似网站，能用就不自建 | 第 21、25 节 | 对至少 8 类现有产品逐项比较，并明确替代边界 |
| 多信源且稳定采集 | 第 5、17、26、32 节 | 每个信源有用途、频率、SLO、配额、降级与回放策略 |
| 技术方向多一些，由系统设计 | 第 7.3、28.11 节 | 多赛道分类、赛道榜和防单一热点淹没机制 |
| 高频活动要有加分权重 | 第 8.4、27.5 节 | 提交、贡献者、PR、Issue、Release 与持续性共同构成 Activity 18 分 |
| 好组织要有加分权重 | 第 8.5、27.6 节 | 组织七项指标构成 Organization 15 分，带时间衰减和新组织保护 |
| 不能只看 Star 高低 | 第 8.3、27.8、27.13 节 | 自动化测试证明总 Star 与 Star 速度不能越过 1.5/3 分上限 |
| 对信息进行分析处理，输出榜单和结论 | 第 10、11、27、28 节 | 八维评分、独立榜单、证据包、中文分析和风险说明 |
| 先不做邮件推送 | 第 20、22、34 节 | M1 至 M5 均不依赖邮件；主动推送独立为 M6 |
| 后续接入 Obsidian | 第 13、31.7、33.7 节 | Markdown、原生插件、幂等增量同步、冲突保护和移动端验收 |
| 最后开放个性化 Agent | 第 14、20、33.8 节 | 只读受限工具、显式偏好、个性化排序与目录级授权 |
| 网站使用 GitHub XXXX 形式命名 | 第 2、34 节 | 统一使用 GitHub Picks，并展示独立非官方声明 |

### 0.3 文档分层

- 第 1 至 23 节定义产品、原则、系统架构和阶段边界，第 24 节汇总核验来源。
- 第 25 至 34 节把此前讨论展开成竞品、信源、指标、榜单、生产、数据、交付、运维和验收细则。
- 本文是主规格；M0 至 M5 分别建立独立实施计划，以便控制范围，但不得修改本规格的跨阶段契约。

## 1. 产品定义

GitHub Picks 不是“每日 Star 排行榜”，而是一套面向中文技术用户的 GitHub 开源情报与决策系统。

它持续采集多个独立信源，把仓库、组织、维护者、版本、社区、依赖与安全事件连接成可追溯的证据图谱；在项目类型和生命周期可比的前提下，进行多维评分、反作弊、榜单生成与中文分析，帮助用户回答：

1. 最近哪些开源项目真正值得关注？
2. 项目为什么突然增长，增长是否可信？
3. 项目由谁维护，组织和维护者是否长期可靠？
4. 它是否适合试用、学习、引入生产或继续观察？
5. 同赛道有哪些替代方案，它们之间的核心差异是什么？
6. 项目的价值、风险和证据发生了哪些变化？

### 1.1 核心价值

- **发现**：从多信源中发现高潜力项目，而不是只看已经很大的项目。
- **判断**：把活跃度、工程质量、安全、组织信誉、采用度、创新性和趋势拆开评估。
- **解释**：每个结论都能回到数据、时间和原始信源。
- **跟踪**：保存每日快照和历史变化，区分短期爆发与长期建设。
- **沉淀**：通过标准 Markdown 和 Obsidian，把情报转化为个人知识资产。
- **个性化**：后续 Agent 根据用户方向重新排序、比较和解释，但不改变底层事实。

### 1.2 目标用户

- 需要持续跟踪技术方向的开发者、架构师和技术负责人。
- 进行技术选型、预研或开源治理的研发团队。
- 关注 AI Coding、Agent、基础设施和工程效率的研究者与讲师。
- 希望用中文快速理解全球开源变化的产品和投资研究人员。

### 1.3 非目标

- 不做 GitHub 的镜像站。
- 不承诺覆盖 GitHub 上的全部仓库。
- 不把 Star 数量解释为项目价值。
- 不用大模型凭印象直接打分。
- 不在首期提供代码托管、Issue 管理或邮件推送。
- 不默认读取、上传或分析用户的 Obsidian 私人笔记。

## 2. 品牌与命名体系

GitHub Picks 采用与 GitHub Trending 相同的直白功能型命名结构：

- GitHub 表明首期核心项目来源和用户认知入口。
- Picks 表明结果不是原始热度流，而是经过多信源证据、评分、风险检查和中文分析后的精选。

产品功能统一使用以下名称：

- GitHub Picks Daily：每日中文情报总览。
- GitHub Picks Rankings：综合榜、新锐榜、稳健榜等榜单。
- GitHub Picks Profiles：仓库、组织和赛道的长期档案。
- GitHub Picks Compare：同类项目横向比较。
- GitHub Picks Watchlist：用户关注列表和变化提醒。
- GitHub Picks for Obsidian：个人知识库同步插件。
- GitHub Picks Agent：后续个性化开源顾问。

技术标识统一使用 github-picks，Obsidian 属性使用 github_picks_ 前缀。

由于名称包含 GitHub，所有公开页面、插件 README、About 页面和仓库说明必须显著展示：

> GitHub Picks is an independent, unofficial project and is not affiliated with GitHub, Inc.

产品不得使用 GitHub 官方 Logo、Octocat 或容易造成官方隶属误解的视觉设计。正式公开发布前仍需完成名称、域名和商标使用专项核验。

## 3. 设计原则

### 3.1 证据优先

所有可发布事实必须带有来源、观测时间、事件时间和原始记录引用。大模型只负责理解与表达，不负责伪造缺失事实。

### 3.2 先分类，再比较

框架、命令行工具、数据库、模型权重、教程仓库和 Awesome 列表不能用同一套绝对阈值竞争。项目必须先识别类型、赛道、年龄和生命周期，再进入同类评分。

### 3.3 趋势优于存量

总 Star 仅作为采用度中的弱信号。增长速度、贡献者质量、发布节奏、Issue 响应和持续性比绝对 Star 更重要。

### 3.4 分数与风险分离

高价值不等于低风险。系统同时发布价值分、置信度和风险等级，避免用一个总分掩盖许可证、维护者集中度或安全问题。

### 3.5 对未知保持诚实

缺少数据不直接等于质量差。低样本项目采用贝叶斯收缩，并降低置信度；页面明确显示“证据不足”，不填补虚假结论。

### 3.6 可解释和可回放

任意榜单结果必须能用当时的数据快照、评分版本和规则重新计算。

### 3.7 多信源不等于多抓网页

每个信源必须有清晰用途、可靠性等级、刷新频率、使用限制和故障降级方案。相互转载的多个页面不能被视作多个独立证据。

### 3.8 开放格式和用户所有权

网站提供版本化 API 和标准 Markdown。Obsidian 笔记即使离开 GitHub Picks 仍能完整阅读，用户批注永不被系统覆盖。

## 4. 总体分层

~~~mermaid
flowchart TB
    S["多信源事实层"] --> E["证据库与实体图谱"]
    E --> F["特征与分类层"]
    F --> R["评分、反作弊与榜单层"]
    R --> C["中文分析与赛道情报层"]
    C --> W["网站、API 与 Markdown"]
    W --> O["Obsidian 知识层"]
    W --> A["个性化 Agent"]
    O --> A
~~~

系统进一步划分为四个平面：

1. **数据平面**：采集、原始快照、标准化、实体解析和历史数据。
2. **情报平面**：分类、特征、评分、风险、榜单和中文分析。
3. **交付平面**：网站、开放 API、Markdown、Obsidian 和未来推送。
4. **控制平面**：任务编排、信源健康、成本、审计、版本与人工复核。

## 5. 多信源采集体系

### 5.1 信源分级

#### S 级：一手事实

- GitHub REST API：仓库、组织、Release、Issue、Pull Request、Contributor 等事实。
- GitHub GraphQL API：批量关系查询和精细化字段补充。
- GitHub Events 与 GH Archive：公开事件流和历史事件。
- 各语言官方包注册表：npm、PyPI、crates.io、Maven Central、Go、NuGet 等。
- 仓库自身文件：README、LICENSE、SECURITY、CODEOWNERS、贡献指南和发布说明。

S 级信源用于事实判定和核心特征计算。

#### A 级：权威风险与工程信号

- OpenSSF Scorecard：供应链和项目安全实践。
- OSV：开源漏洞信息。
- deps.dev：包、版本、依赖与项目关系。
- SPDX 与官方许可证元数据。
- 官方组织博客、发布日志和项目文档。

A 级信源用于安全、依赖、工程质量和版本风险。

#### B 级：发现与交叉验证

- GitHub Trending 与 GitHub Topics。
- OSS Insight、OpenDigger/OpenRank 等开源指标平台。
- Hacker News、Lobsters 和高质量技术社区的公开讨论。
- 维护质量较高的 Awesome 列表、基金会项目目录和技术雷达。
- 技术媒体及项目作者的公开发布信息。

B 级信源主要负责候选发现、舆情和交叉验证，不单独决定核心分数。

#### C 级：外部榜单参考

- Trendshift 等第三方趋势产品。
- 各类 GitHub 每日推荐、Newsletter 和聚合站。
- 社交平台热度。

C 级信源只提供候选和背景。若条款不允许缓存或再分发，只保存必要引用，不复制其原始数据。

### 5.2 Source Registry

每个采集器必须在信源注册表登记：

| 字段 | 含义 |
|---|---|
| source_id | 稳定信源标识 |
| tier | S/A/B/C 可靠性等级 |
| purpose | 发现、事实、风险或交叉验证 |
| official | 是否为一手官方来源 |
| independence_group | 去除转载和同源重复 |
| cadence | 计划刷新频率 |
| freshness_slo | 最大可接受延迟 |
| rate_limit | 速率和配额约束 |
| legal_policy | 缓存、展示和再分发边界 |
| parser_version | 解析器版本 |
| fallback_source | 故障时替代来源 |
| last_success_at | 最近成功时间 |
| health_state | healthy、degraded、offline |

### 5.3 采集频率

| 数据类型 | 建议频率 | 目的 |
|---|---:|---|
| GitHub 公开事件候选 | 15 分钟 | 尽早发现突发增长和发布 |
| Trending/社区发现 | 1 小时 | 补充候选 |
| 热门候选仓库快照 | 1 小时 | 捕捉高频变化 |
| 普通观察仓库快照 | 6 小时 | 控制 API 成本 |
| Release、Issue、PR | 1 至 6 小时 | 活跃度与维护质量 |
| 安全和依赖数据 | 6 至 24 小时 | 风险变化 |
| 全量特征与榜单 | 每日 | 生成正式日报 |
| 组织画像与历史校准 | 每周 | 长周期信誉 |

每日榜单采用北京时间数据窗口。默认在 06:30 截止主要数据，08:00 前完成计算、质检和发布。

### 5.4 候选漏斗

不尝试高成本扫描全部 GitHub，而采用分层候选池：

1. 多信源发现候选。
2. 通过仓库有效性、语言、活动时间和垃圾特征做廉价预筛。
3. 对通过预筛的仓库进行完整数据补齐。
4. 对高潜项目提高采集频率。
5. 对长期低信号项目降低频率，但保留历史。

候选被某个信源漏掉不会永久消失；其他信源、组织追踪、赛道扫描和周期性回补均可重新发现。

## 6. 数据与证据模型

### 6.1 核心实体

- Repository
- Organization
- Maintainer
- Contributor
- Release
- Commit
- Issue
- PullRequest
- Package
- Dependency
- Vulnerability
- Topic
- TechnologySector
- SourceObservation
- Evidence
- FeatureSnapshot
- ScoreSnapshot
- RankingSnapshot
- AnalysisReport
- Watchlist

### 6.2 稳定身份

- 仓库内部主键使用 GitHub node_id，不使用 owner/name 作为永久身份。
- owner/name 是随时间变化的别名。
- 仓库改名或组织转移时保留同一实体，记录 alias_history。
- Fork、镜像、模板和上游关系单独建边，避免重复上榜。
- 包与仓库之间允许多对多映射，并保存映射置信度。

### 6.3 事实记录

每条事实至少包含：

~~~text
entity_id
field
value
source_id
source_url
event_at
observed_at
raw_snapshot_ref
parser_version
confidence
~~~

raw_snapshot 采用不可变存储；标准化表可重建。修复解析器后可以回放历史，而不是覆盖过去。

### 6.4 证据图谱

关键关系包括：

- 组织维护仓库。
- 维护者贡献、审核或发布版本。
- 仓库发布软件包。
- 软件包依赖其他软件包。
- 漏洞影响版本或依赖路径。
- 项目属于赛道并与其他项目竞争或互补。
- 榜单引用特征，特征引用事实，事实引用原始信源。

页面上的任何评分解释均可沿这条链返回原始证据。

## 7. 分类与可比性

### 7.1 项目类型

- 应用程序
- 开发框架或 SDK
- 库
- 命令行工具
- 数据库或存储系统
- 基础设施与平台
- 模型、数据集或推理资源
- 教程或示例
- Awesome/资源列表
- 标准、规范或研究实现

不同类型使用不同特征可用性、权重微调和最低门槛。Awesome 列表不会因为提交频繁而和数据库项目争夺同一个综合榜名次。

### 7.2 生命周期

- incubation：刚创建或证据不足。
- emerging：快速形成早期用户和贡献。
- growing：持续增长并扩大维护规模。
- mature：采用稳定、治理完善。
- maintenance：功能稳定，以维护为主。
- declining：活跃度和响应持续下降。
- archived：明确归档或停止维护。

### 7.3 技术方向

首期支持但不限于：

- AI Coding
- AI Agent 与 Agent 基础设施
- 大模型、推理与评测
- 数据与机器学习工程
- 前端与跨端
- 后端与 API
- 数据库、搜索与存储
- 云原生与分布式系统
- DevOps、CI/CD 与开发者工具
- 可观测性与 SRE
- 安全、隐私与软件供应链
- 编程语言、编译器与运行时
- 桌面、移动与个人效率
- 音视频与内容工程
- 机器人、IoT 与边缘计算
- 科学计算、教育与研究工具

系统允许一个项目属于多个方向，但必须有主方向；分类同时保存模型结果、规则证据和人工覆盖记录。

## 8. 评分模型

### 8.1 八个价值维度

| 维度 | 权重 | 主要问题 |
|---|---:|---|
| Utility 实用价值 | 18 | 是否解决真实问题，是否有清晰适用场景 |
| Activity 开发活跃 | 18 | 是否持续提交、发布、审核和响应 |
| Organization 组织信誉 | 15 | 组织和维护者是否长期可靠 |
| Engineering 工程质量 | 14 | 测试、文档、CI、版本、治理是否成熟 |
| Adoption 采用度 | 10 | 是否有真实用户、依赖者和社区采用 |
| Security 安全与合规 | 10 | 安全实践、漏洞响应、许可证是否健康 |
| Momentum 趋势动量 | 10 | 当前增长是否持续且来自多种信号 |
| Innovation 创新与时效 | 5 | 是否提供新的技术路径或明显改进 |
| **合计** | **100** | |

置信度 Confidence 和风险 Risk 不直接混入上述八维原始分。

### 8.2 发布分

~~~text
BaseScore =
  0.18 * Utility +
  0.18 * Activity +
  0.15 * Organization +
  0.14 * Engineering +
  0.10 * Adoption +
  0.10 * Security +
  0.10 * Momentum +
  0.05 * Innovation

PublishedScore =
  clamp(50 + Confidence * (BaseScore - 50) - RiskPenalty, 0, 100)
~~~

以 50 分为先验中心进行置信度收缩，避免新项目因数据少被误判为极好或极差。

- 八个维度均标准化为 0 至 100。
- Confidence 取值为 0 至 1。
- RiskPenalty 默认取值为 0 至 30；达到 hard_exclude 的项目不再计算公开发布分。
- 对外发布分保留一位小数，内部保留完整精度。

### 8.3 Star 的限制

- 总 Star 对 100 分综合分的直接贡献上限为 1.5 分。
- Star 增速的直接贡献上限为 3 分。
- Star 只作为 Adoption 和 Momentum 中的一个特征。
- Fork、Watcher、依赖数、下载、贡献者、Issue/PR 和外部讨论必须共同验证增长。
- 发现异常 Star 模式时，相应特征归零并进入反作弊审核。

### 8.4 Activity 细分

- 7、30、90 天有效提交频率及其持续性。
- 活跃贡献者和核心维护者数量。
- PR 审核、合并时间和外部贡献接受率。
- Issue 首次响应与关闭时间。
- Release 频率、版本规律和发布说明质量。
- 提交集中度、Bus Factor 和机器人占比。
- 相对自身历史基线的变化。

只统计格式化、依赖机器人或机械更新会被降权。

### 8.5 Organization 组织信誉

~~~text
Organization =
  0.24 * 历史项目质量 +
  0.18 * 持续维护能力 +
  0.16 * 维护者响应质量 +
  0.14 * 项目组合成功率 +
  0.10 * 安全成熟度 +
  0.10 * 治理透明度 +
  0.08 * 身份可信度
~~~

设计约束：

- GitHub Verified 只证明域名身份，不等于项目质量。
- 组织历史是加分信号，不允许压制高质量的新组织或个人维护者。
- 组织加分必须有时间衰减；多年以前的成功不能永久透支信誉。
- 仓库自身强证据优先于组织先验。
- 单一组织在同一榜单中的项目数量设上限，避免榜单被大厂占满。

### 8.6 统计校准

连续指标在同类型、同年龄段和相近规模的 cohort 内进行比较：

~~~text
SmoothedMetric =
  n / (n + k) * RepositoryMetric +
  k / (n + k) * CohortPrior

TimeWeight =
  exp(-ln(2) * age / half_life)
~~~

- 对极端值 Winsorize，避免一次异常事件主导分数。
- 对语言生态差异使用百分位，而不是统一绝对阈值。
- 不同特征使用不同半衰期：趋势短，治理和安全长。
- 评分版本必须固定参数并保存，历史榜单不被新公式悄然改写。

### 8.7 置信度

置信度由以下因素组成：

- 关键字段完整率。
- 独立信源数量。
- 信源之间的一致程度。
- 数据新鲜度。
- 样本量和观测窗口长度。
- 实体映射置信度。
- 解析器和采集任务健康状态。

页面同时展示“高分低置信”和“中分高置信”的差异。

## 9. 风险与反作弊

### 9.1 风险类型

- Star/Fork 异常增长。
- 恶意代码、供应链投毒或账号接管迹象。
- 严重漏洞且长期未响应。
- 许可证缺失、冲突或限制不清。
- 单维护者和极高 Bus Factor 风险。
- 仓库与发布包不一致。
- 项目废弃、归档或长期无人响应。
- README 宣传与代码、发布事实明显矛盾。
- 仿冒、镜像、重复仓库或品牌冒用。

### 9.2 处理方式

- **hard_exclude**：确认恶意、仿冒、删除或不可访问，不进入公开推荐。
- **quarantine**：异常待核验，保留内部计算但不进入正常榜单。
- **penalty**：存在明确但非致命风险，从发布分扣分。
- **warning_only**：不扣分但在项目卡显著显示。

风险事实不能被高 Star 或知名组织抵消。

### 9.3 异常检测

- Star 和 Fork 的时间序列突变与周期间隔。
- Star/Fork/Watch/Contributor/Download 之间的不合理比例。
- 增长来源过度集中。
- 大量低活动账户的同步行为；只使用合法可获得的公开数据。
- 社区讨论、依赖采用和代码活动与社交热度不匹配。
- 仓库改名、转移、重建导致的虚假“新项目”。

异常检测只生成风险证据和复核建议，不公开指控无法证实的作弊行为。

## 10. 榜单系统

### 10.1 固定榜单

- 每日综合价值榜
- 每周趋势上升榜
- 新项目潜力榜
- 隐藏宝石榜
- 工程成熟榜
- 生产采用候选榜
- 最活跃维护榜
- 优质开源组织榜
- 各技术赛道榜
- 风险观察榜

### 10.2 榜单独立公式

综合榜使用 PublishedScore。其他榜单不只是换筛选条件：

~~~text
Rising =
  0.35 * Momentum +
  0.20 * Activity +
  0.15 * Utility +
  0.10 * Innovation +
  0.10 * Organization +
  0.10 * Engineering -
  RiskPenalty

Stable =
  0.25 * Engineering +
  0.20 * Security +
  0.20 * Activity +
  0.15 * Adoption +
  0.10 * Utility +
  0.10 * Organization -
  RiskPenalty
~~~

新项目榜增加年龄和证据门槛，隐藏宝石榜限制存量热度并强调真实采用和工程质量。

### 10.3 入榜资格

- 达到榜单最低置信度。
- 在有效观测窗口内有足够新鲜数据。
- 未处于 hard_exclude 或 quarantine。
- 不是未说明的 Fork、镜像或重复实体。
- 满足该项目类型的最低工程证据。

### 10.4 多样性约束

- 同一组织的项目数量上限。
- 同一项目的多个子仓库合并展示。
- 防止单一语言或短期热点占满榜单。
- 同时保留“纯分数排序”和“多样化推荐视图”，并公开两者区别。

### 10.5 榜单快照

每天保存名次、得分、维度、风险、置信度和评分版本。项目页展示：

- 今日名次与昨日、7 日、30 日变化。
- 分数变化由哪些证据触发。
- 首次入榜、连续入榜和历史最佳。

## 11. 中文分析系统

### 11.1 四阶段流程

1. **事实包生成**：只提供结构化事实、变化和证据引用。
2. **矛盾检查**：比较 README 宣称、代码活动、Release、社区和安全信息。
3. **价值判断**：规则与模型产生适用人群、采用阶段和待验证问题。
4. **中文写作与复核**：大模型按固定结构写作，验证器检查数字、链接、语气和遗漏。

大模型不能修改数值评分，也不能在没有证据时断言“生产可用”“官方支持”或“行业第一”。

### 11.2 项目分析模板

- 一句话结论
- 它解决什么问题
- 为什么现在值得关注
- 关键证据
- 评分拆解
- 适合谁
- 不适合谁
- 上手与采用成本
- 组织和维护者
- 安全、许可证和维护风险
- 同类项目与差异
- 建议动作：试用、预研、采用、继续观察或忽略
- 最近变化
- 证据链接与更新时间

### 11.3 每日情报模板

1. 今日最值得看的 3 个项目。
2. 综合榜 Top 10。
3. 新锐与隐藏宝石。
4. 优质组织动态。
5. 技术赛道变化。
6. 风险与降温项目。
7. “为什么今天值得看”的编辑判断。
8. 数据覆盖、异常和方法版本说明。

### 11.4 质量控制

- 所有数字必须能在事实包中找到。
- 每个强结论至少有两个相互独立的证据，或明确标注为推断。
- 内容不得只是 README 翻译。
- 相似项目分析需去除模板化重复。
- 未通过验证的分析保持 draft，不进入公开站点。
- 每次分析保存 prompt_version、model、evidence_hash 和 analysis_version。

## 12. 网站产品

### 12.1 核心页面

- 首页：今日情报、重点项目和赛道变化。
- 榜单页：榜单切换、筛选、历史名次和方法说明。
- 项目档案：评分、证据、历史、替代项目和风险。
- 组织档案：项目组合、维护持续性、治理和近期动作。
- 赛道页：项目地图、竞争关系、趋势和阶段变化。
- 项目对比：维度、适用场景、成本、风险和证据对照。
- 搜索与发现：语言、方向、类型、年龄、分数、风险和许可证。
- 方法论：公式、版本、信源、限制和变更记录。
- 信源状态：新鲜度、覆盖率和降级说明。

### 12.2 项目卡片

首屏必须在 30 秒内回答：

- 这是做什么的？
- 为什么今天出现？
- 综合分、置信度和风险分别是多少？
- 最强证据和最大风险是什么？
- 我下一步应该做什么？

### 12.3 网站初期账户边界

- 第一阶段公开浏览无需登录。
- 收藏可先保存在本地浏览器。
- 接入跨设备观察列表或 Agent 时再引入账户。
- 后续优先支持 GitHub OAuth，但平台账户权限与 GitHub 仓库权限严格分离。

### 12.4 公开 API

首期采用只读、版本化 API：

~~~text
GET /api/v1/daily/{date}
GET /api/v1/rankings/{ranking}
GET /api/v1/repositories/{owner}/{repo}
GET /api/v1/repositories/{owner}/{repo}/history
GET /api/v1/organizations/{login}
GET /api/v1/sectors/{slug}
GET /api/v1/compare?repos=...
GET /api/v1/methodology
GET /api/v1/sources/health
GET /api/v1/exports/markdown/...
~~~

API 响应包含 data_version、score_version、analysis_version、generated_at 和 evidence links。

## 13. Obsidian 正式接入

### 13.1 三层方案

1. **标准 Markdown**：无需插件即可下载日报、项目档案、组织报告和赛道报告。
2. **原生插件**：通过 API 增量同步、管理观察列表和生成 Bases。
3. **本地 Agent/MCP**：后续在明确授权下读取用户选定目录。

第一、二层属于正式交付；第三层与个性化 Agent 同期建设。

### 13.2 Vault 结构

~~~text
GitHub Picks/
├── 每日情报/
├── 项目/
├── 组织/
├── 赛道/
├── 观察列表/
├── 风险预警/
└── 开源项目总览.base
~~~

用户可以修改根目录。插件必须使用 Obsidian normalizePath 和 Vault API，不直接假定文件系统路径。

### 13.3 Properties

系统属性统一使用 github_picks_ 前缀：

~~~yaml
---
github_picks_id: "github:repo:R_xxxxx"
github_picks_repo: "owner/repository"
github_picks_entity_type: "repository"
github_picks_value_score: 86.4
github_picks_momentum_score: 82
github_picks_activity_score: 91
github_picks_organization_score: 88
github_picks_risk_level: "low"
github_picks_confidence: 0.93
github_picks_categories:
  - "AI Agent"
  - "Developer Tools"
github_picks_analysis_version: "score-v1"
github_picks_source_updated_at: "2026-08-03T08:00:00+08:00"
---
~~~

插件使用 FileManager.processFrontMatter 修改系统字段，不手工重写完整 YAML。

### 13.4 双链

- 项目笔记链接组织、赛道和替代项目。
- 日报链接当天入榜项目。
- 组织笔记反向链接其维护项目。
- 赛道笔记链接榜单和竞争项目。

Markdown 和双链是主数据表现；Bases 只是增强视图，保证旧版本或停用 Bases 时仍可阅读。

### 13.5 幂等同步

自动内容只存在于管理区：

~~~markdown
<!-- github-picks:managed:start checksum="..." -->
系统生成内容
<!-- github-picks:managed:end -->

## 我的判断

用户内容，系统永不覆盖。
~~~

同步规则：

- github_picks_id 是实体身份，文件名不是身份。
- 使用 cursor、entity_version、content_hash 和 ETag 增量同步。
- 相同版本重复同步不写文件。
- 仓库改名时更新路径和 aliases，保持实体和双链连续。
- 检测到管理区被人工修改时，保留原文件并生成冲突副本或要求确认。
- 项目删除、私有化或归档时只修改状态，不自动删除用户笔记。
- 用户主动清理时使用 Obsidian trash 语义，禁止不可恢复删除。
- 同步中断后从最近成功 cursor 继续。

### 13.6 Obsidian API

~~~text
GET /api/v1/obsidian/manifest?cursor=...
GET /api/v1/obsidian/entities/{entity_id}.md
GET /api/v1/obsidian/daily/{date}.md
GET /api/v1/obsidian/bases
GET /api/v1/obsidian/sync-state
~~~

manifest 只返回变化清单、版本、哈希、目标建议路径和 tombstone 状态；Markdown 内容按需拉取。

### 13.7 插件功能

- 手动立即同步。
- 自动同步频率配置。
- 选择技术方向、榜单和最低分。
- 同步观察项目与组织。
- 网站“一键保存到 Obsidian”。
- 生成本地总览 Base。
- 显示最近同步、失败原因和待解决冲突。
- 命令面板快速搜索 GitHub Picks 项目。
- 桌面和移动端使用相同核心逻辑。

### 13.8 隐私和安全

- 只读平台令牌通过 Obsidian SecretStorage 保存。
- 插件默认只操作用户指定的 GitHub Picks 目录。
- 默认不扫描或上传 Vault 其他内容。
- 默认无客户端遥测。
- 日志不得包含令牌、完整私人路径和用户笔记内容。
- 网络访问、账户要求和数据处理在 README 明确披露。
- 移动端使用 Obsidian requestUrl，不依赖 Node.js fs、path 或 Electron。

### 13.9 Obsidian 验收

- 连续同步两次不产生重复文件或无意义 diff。
- 用户在管理区外的内容百分之百保留。
- 管理区冲突不会被静默覆盖。
- 仓库改名或转移后不生成第二个实体。
- 网络中断和 API 非法响应不会损坏 Vault。
- 桌面、iOS 和 Android 均能执行核心同步。
- 令牌不会进入笔记、普通插件配置或日志。
- 卸载插件后全部笔记仍可正常阅读。

## 14. 个性化 Agent

Agent 位于事实、评分、中文分析和 API 稳定之后。

### 14.1 用户兴趣模型

- 明确选择的技术方向、语言和项目类型。
- 关注和忽略的项目、组织与赛道。
- 对“学习、试用、生产选型、课程研究”等目标的选择。
- 用户主动授权的 Obsidian 笔记目录。

默认只使用显式偏好，不以未经同意的行为追踪构建画像。

### 14.2 个性化排序

~~~text
PersonalScore =
  0.55 * PublishedScore +
  0.20 * InterestMatch +
  0.10 * GoalMatch +
  0.10 * NoveltyForUser +
  0.05 * Diversity -
  UserSpecificRiskPenalty
~~~

个性化只改变推荐顺序和解释角度，不篡改公共项目评分。

### 14.3 Agent 能力

- “今天 AI Coding 有什么真正值得看？”
- “比较这三个项目，哪个更适合团队生产使用？”
- “这个项目为什么比上周上升？”
- “只看我未收藏过的新项目。”
- “把这份赛道分析同步到 Obsidian。”
- “根据我的批注继续观察，但不要自动采用。”

### 14.4 Agent 接口

后续提供受限 API、MCP 或 SDK。每个工具具有最小权限、可审计输入输出和明确数据范围。Obsidian 本地上下文采用目录 allowlist 和逐项授权，禁止默认上传整个 Vault。

## 15. 技术架构

### 15.1 技术选择

- Monorepo：pnpm workspace + Turborepo。
- 网站：Next.js、React、TypeScript。
- 公共 API：Fastify + TypeScript，使用 JSON Schema/OpenAPI。
- 采集与任务：TypeScript Worker + BullMQ/Redis。
- 统计、校准和回测：独立 Python 包，输入输出使用版本化 Parquet/JSON Schema。
- 主数据库：PostgreSQL。
- 原始快照：S3 兼容对象存储。
- 缓存与任务：Redis。
- 本地分析：DuckDB/Parquet。
- 搜索：首期 PostgreSQL 全文和向量扩展；达到明确规模门槛后再引入专用搜索。
- 可观测性：OpenTelemetry、结构化日志、Prometheus 指标。
- 部署：容器化，开发环境使用 Docker Compose；避免绑定单一云厂商。

首期不引入 Kafka、ClickHouse 或复杂微服务。只有当事件量、查询延迟和成本数据证明 PostgreSQL/对象存储无法满足时再升级。

### 15.2 Monorepo 结构

~~~text
apps/
  web/
  api/
  obsidian-plugin/
workers/
  collector/
  enrichment/
  ranking/
  analysis/
packages/
  contracts/
  scoring/
  source-sdk/
  evidence/
  markdown/
  observability/
python/
  calibration/
  backtest/
infra/
  docker/
  migrations/
docs/
~~~

### 15.3 服务边界

- Collector 只负责获取和保存原始观察，不做业务评分。
- Normalizer 将来源字段转成统一事实。
- Entity Resolver 处理仓库、包、组织和别名。
- Feature Builder 从时序事实计算特征。
- Scoring Engine 是确定性、版本化函数。
- Risk Engine 独立于价值评分。
- Ranking Engine 管理资格、公式和多样性。
- Analysis Engine 只消费已冻结的事实包。
- Publisher 使用事务和 Outbox 同时发布网站/API/Markdown 版本。

## 16. 端到端数据流

~~~mermaid
sequenceDiagram
    participant Scheduler
    participant Collector
    participant RawStore
    participant Normalizer
    participant Feature
    participant Score
    participant Analysis
    participant Publisher

    Scheduler->>Collector: 下发 source + window
    Collector->>RawStore: 保存不可变快照
    Collector->>Normalizer: 发送 observation reference
    Normalizer->>Feature: 标准事实与实体变化
    Feature->>Score: 冻结 feature snapshot
    Score->>Analysis: 分数、风险、榜单与 evidence pack
    Analysis->>Publisher: 已验证中文分析
    Publisher->>Publisher: 原子发布 Web/API/Markdown
~~~

仓库状态机：

~~~text
discovered
  -> enriched
  -> eligible
  -> scored
  -> ranked
  -> analysis_draft
  -> verified
  -> published

任意阶段可进入 stale、quarantined 或 failed。
~~~

## 17. 错误处理与降级

### 17.1 采集错误

- 按错误类型区分重试、限速、认证失败、解析失败和永久不存在。
- 429/5xx 使用指数退避和随机抖动。
- 每个 source_id 独立熔断，不能因为一个网站失败阻塞整条日报。
- 超过重试上限进入 Dead Letter Queue，保留请求上下文和原始响应引用。
- 解析器失败时保留原始快照，修复后回放。

### 17.2 部分数据

- 核心事实缺失时降低 Confidence。
- 榜单达到最低置信度才发布。
- 非核心信源故障时允许降级发布，并在信源状态页和日报注明。
- 不使用旧数据冒充最新；页面显示 last_observed_at 和 stale。

### 17.3 幂等与一致性

- 采集任务使用 source_id + entity_id + window 作为幂等键。
- Feature、Score、Ranking 均以 snapshot_version 为输入。
- 发布使用数据库事务和 Outbox，避免网站已更新而 API/Markdown 未更新。
- 所有重新计算产生新版本，不就地覆盖历史快照。

### 17.4 分析降级

- 大模型失败时仍可发布结构化榜单和规则生成的事实摘要。
- 分析验证失败时不展示草稿。
- 模型切换必须经过固定评测集，不能直接替换生产版本。

### 17.5 Obsidian 降级

- API 不可用时保留本地内容和同步游标。
- 收到非法 Markdown、哈希不符或版本倒退时拒绝写入。
- 单个文件冲突不阻塞其他文件同步。

## 18. 可观测性和运营

### 18.1 核心指标

- 各信源采集成功率、延迟和配额余量。
- 候选发现量、补齐成功率和去重率。
- 实体映射不确定率。
- 数据新鲜度和缺失率。
- 榜单每日变动、异常波动和多样性。
- 分析验证通过率和人工退回率。
- API 延迟、错误率和缓存命中率。
- Obsidian 同步成功、冲突和恢复率。
- 每日报告的单次采集、存储和模型成本。

### 18.2 发布门禁

每日发布前自动检查：

- S 级核心信源是否达到最低健康度。
- 榜单候选是否满足数量和置信度。
- 分数分布是否异常漂移。
- Top 项目是否存在未处理的风险事件。
- 所有项目分析中的数字和链接是否通过验证。
- data_version、score_version 和 analysis_version 是否一致。

门禁失败时发布“延迟/降级说明”，不静默生成不可信日报。

## 19. 测试与评估

### 19.1 采集器

- 使用保存的响应快照进行 Contract Test。
- 覆盖分页、限流、空字段、重定向、仓库转移和格式变化。
- 每个解析器维护 golden fixtures。

### 19.2 数据质量

- 唯一性、非空、范围、时间单调性和关系完整性检查。
- 仓库 node_id 与别名历史一致性。
- Fork、镜像和包映射抽样复核。
- 原始快照到事实表的可回放验证。

### 19.3 评分

- 单元测试覆盖每个特征和公式。
- Property-based Test 验证不变量，例如增加未验证 Star 不能越过加分上限。
- 固定项目集做 golden score 回归。
- 对不同类型、年龄、语言检查分布公平性。
- 使用历史快照回测“入榜后 30/90 天持续维护、采用和风险”。

### 19.4 反作弊

- 合成突发 Star、机械提交、机器人 PR 和仓库重建场景。
- 已知异常样本回放。
- 检查误报，未经证实的异常不得自动公开定性。

### 19.5 中文分析

- 数字忠实度。
- 证据覆盖率。
- 推断标注率。
- 重复和模板化程度。
- 项目适用场景与风险是否完整。
- 人工评审固定样本，对模型和 Prompt 版本进行对比。

### 19.6 网站与 API

- API Schema Contract Test。
- 排名和页面版本一致性。
- Playwright 覆盖首页、榜单、项目、组织、对比和移动端。
- 无障碍、SEO、断链和性能检查。

### 19.7 Obsidian

- 在一次性测试 Vault 中验证创建、更新、冲突、改名和恢复。
- 同步两次不得产生重复或无意义 diff。
- 模拟多设备先后写入。
- 模拟 API 中断、非法内容和插件中途退出。
- 桌面、iOS、Android 兼容测试。
- 扫描构建产物和日志，确保无令牌与私人笔记内容。

## 20. 里程碑与退出门槛

### M0：现有产品替代验证

交付：

- GitHub Trending、PickGithub、OSS Insight、HubLens 等现有产品的连续使用记录。
- 代表方向/项目的能力缺口矩阵。
- “直接使用、薄层集成或自建”的 go/no-go 结论。

退出门槛：

- 完成第 33.1 节的 7 天验证。
- 证明第 25.3 节的关键差异确实无法由现有产品直接满足。
- 若现有产品已足够，则本项目以“不自建”完成，不进入 M1。

### M1：信源与证据基础

交付：

- Source Registry。
- GitHub、GH Archive、包注册表、安全信源的首批采集器。
- 原始快照、标准事实和实体解析。
- 信源健康与回放工具。

退出门槛：

- 核心采集连续稳定运行。
- 仓库改名、转移、Fork 和重复实体正确处理。
- 每条核心事实可追溯到原始快照。

### M2：分类、评分和反作弊

交付：

- 类型、生命周期和赛道分类。
- 八维评分、置信度和风险。
- 多榜单与历史快照。
- 方法论和评分版本。

退出门槛：

- Star 上限、组织权重和 cohort 校准有自动化证明。
- 固定样本通过人工评审与回测。
- 异常项目不能进入普通榜单。

### M3：中文情报与网站

交付：

- 项目、组织、赛道分析。
- 日报、榜单、档案、对比和信源状态页面。
- 只读版本化 API 和 Markdown 导出。

退出门槛：

- 分析数字百分之百来自事实包。
- 每日发布门禁和降级机制可验证。
- 用户能在 30 秒内理解项目价值、证据和风险。

### M4：Obsidian

交付：

- 原生插件。
- 增量同步协议。
- 项目、组织、赛道和日报模板。
- Bases 总览与网站一键保存。

退出门槛：

- 满足第 13.9 节全部验收条件。
- 插件卸载后知识仍完整。

### M5：个性化 Agent

交付：

- 兴趣档案、个性化排序和解释。
- 受限 API/MCP。
- Obsidian 目录授权。

退出门槛：

- 公共事实分与个性化排序完全分离。
- 用户数据权限、删除和审计完整。
- Agent 无法越权读取 Vault。

### M6：主动推送

在前述能力稳定后，再选择邮件、飞书、Webhook 等推送方式。推送只消费已经发布的情报版本，不创建新的事实或评分分支。

## 21. 是否值得自建

现有产品通常解决其中一部分：

- GitHub Trending 适合快速发现，但缺少长期历史、组织信誉和决策解释。
- OSS Insight 等平台擅长指标与趋势查询，但不是中文个人决策工作流。
- 第三方 Trending 产品提供榜单，但评分、数据授权和个性化边界各不相同。
- 中文推荐站多为编辑精选或 Star 聚合，难以提供证据链、反作弊和可回放评分。

如果需求只是“每天看热门仓库”，直接使用现有网站更省成本；GitHub Picks 值得建设的前提是坚持完成以下差异：

1. 多信源证据，而非单一 Trending。
2. 类型和生命周期校准，而非全站统一按 Star 排序。
3. 组织信誉、高频活动、工程和安全共同评分。
4. 可解释、可回放、带置信度与风险。
5. 面向中文用户的决策分析。
6. 标准 API、Markdown 和 Obsidian 知识沉淀。
7. 后续基于个人方向的 Agent，而不是通用榜单换皮。

若这些差异被削减，项目应停止自建并直接使用现有服务。

## 22. 首期明确不做

- 邮件、短信和社交平台主动推送。
- 读取用户整个 Obsidian Vault。
- 企业私有仓库分析。
- 代码执行、自动安装或自动采用开源项目。
- 用大模型代替事实采集和评分公式。
- 未经验证的全 GitHub 大规模爬取。
- 复杂商业计费与团队权限。

## 23. 实施前仍需确认的运营项

这些项目不改变产品架构，但在公开发布前必须完成：

- “GitHub Picks”的名称、域名、GitHub 商标使用和社区插件名称专项核验。
- GitHub API Token、配额和合规使用方案。
- 第三方信源缓存、引用和再分发条款复核。
- 首期正式支持的语言包注册表清单。
- 生产部署地区、对象存储和模型供应商选择。
- 人工复核责任人和风险事件处理流程。

本规格确认的核心边界是：先把事实、证据、评分和中文分析做可信，再扩展 Obsidian 与 Agent；任何交付层都不能绕过底层证据和版本控制。

## 24. 当前设计参考

以下资料在 2026-08-03 核验，实施时仍需重新检查版本和条款：

### GitHub 与开源数据

- [GitHub REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub REST API rate limit endpoint](https://docs.github.com/en/rest/rate-limit/rate-limit)
- [GitHub GraphQL API rate limits](https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api)
- [GitHub REST API best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [GitHub Events API](https://docs.github.com/en/rest/activity/events)
- [GitHub Trademark Policy](https://docs.github.com/en/site-policy/content-removal-policies/github-trademark-policy)
- [GitHub Trending](https://github.com/trending)
- [GH Archive](https://www.gharchive.org/)
- [OpenSSF Scorecard](https://securityscorecards.dev/)
- [OSV](https://osv.dev/)
- [deps.dev](https://deps.dev/)

### Obsidian

- [Obsidian Vault API](https://docs.obsidian.md/Plugins/Vault)
- [Obsidian plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Obsidian SecretStorage](https://docs.obsidian.md/plugins/guides/secret-storage)
- [Obsidian Bases view](https://docs.obsidian.md/plugins/guides/bases-view)
- [Obsidian URI](https://help.obsidian.md/Extending%2BObsidian/Obsidian%2BURI)

### 同类产品基线

- [OSS Insight Trending API](https://ossinsight.io/docs/api/list-trending-repos)
- [OSS Insight Trending 设计说明](https://ossinsight.io/blog/introducing-trending-page)
- [Trendshift Signal](https://trendshift.io/signal)
- [Trending Repos](https://trending-repos.com/)
- [PickGithub](https://pickgithub.com/)
- [GitTrend](https://gittrend.io/)
- [HubLens](https://hublens.dev/en/)
- [GitHub 中文社区排行榜](https://github-cn.com/ranking)

这些链接用于能力与边界参考，不代表 GitHub Picks 可以复制或再分发第三方数据。

## 25. 同类产品完整调研与自建结论

本节回答项目最早提出的问题：是否已经有足够好的网站，可以直接使用而不必自己开发。结论不是“市场上没有类似产品”，而是**已有产品很多，且部分能力已高度重合；只有坚持证据、组织/维护、高频活动、安全、中文决策和 Obsidian 这些差异，GitHub Picks 才值得自建**。

### 25.1 逐项比较

| 产品 | 当前核心能力 | 可以直接解决什么 | 对本需求仍缺什么 | GitHub Picks 的处理 |
|---|---|---|---|---|
| GitHub Trending | GitHub 官方的当天热门仓库/开发者发现，可按语言等筛选 | 最低成本查看社区当天热度 | 缺少公开评分解释、长期证据链、组织质量、安全和中文采用建议 | 作为 B 级候选发现源，不把 Trending 名次当质量分 |
| OSS Insight | 基于 GitHub 事件数据做趋势、仓库洞察、集合排名并提供 API | 查询历史活动、Star、PR、Issue 等数据趋势 | 更偏数据分析平台，不提供本产品要求的中文决策、风险分层和个人知识流 | 作为 B 级交叉验证与研究参考；核心事实仍回到一手来源 |
| Trending Repos | 以 Star/Fork 速度和平滑动量做高频趋势终端，公开页面称约每四小时更新 | 很快看到“正在加速”的项目 | 动量仍主要来自互动计数，不能独立回答工程、安全、组织和生产可用性 | 作为 C 级突发候选；动量公式不复制，候选需重新核验 |
| Trendshift | 提供趋势榜、历史榜、engagement spike 和付费 Signal API | 查询 GitHub Trending 历史及第三方趋势信号 | 原始数据有禁止再分发等许可边界；仍不是完整的中文证据决策系统 | 可人工参考或在许可允许时仅作候选输入，不转售或公开其原始数据 |
| PickGithub | 中文项目介绍、趋势热榜、最新发现、语言/话题筛选 | 中文用户可以直接浏览大量项目和当日增长 | 公开页面更偏精选与聚合，未提供本产品所需的评分回放、组织信誉、安全证据和个人知识同步 | 若只需中文发现，优先直接使用；GitHub Picks 不复制其内容 |
| GitTrend | 简洁的 GitHub 趋势浏览，并标示 GitHub 数据与开放数据方向 | 快速、轻量地浏览趋势仓库 | 决策维度、证据深度和中文分析有限 | 作为产品体验参考，不作为核心评分信源 |
| HubLens | GitHub + Hacker News 发现、双语 AI 摘要、分类榜、比较、REST API 与 MCP | 已能满足“每日趋势 + 中文摘要 + Agent 接口”的大部分基础需求 | 当前公开能力仍未覆盖本规格要求的完整证据图谱、组织信誉、安全/依赖、反作弊、可回放评分和 Obsidian 内容所有权 | **最强替代品**；若不做上述差异，应该直接使用 HubLens，而不是重复建设 |
| GitHub 中文社区排行榜 | 全站排行榜、经典项目和中文浏览入口 | 看大体量项目与中文内容 | 以总量排行和内容聚合为主，新锐、隐宝、证据、风险与可比性不足 | 只作市场和中文体验参考 |

### 25.2 直接使用现有产品的建议

- 只想每天扫一眼热门项目：直接看 GitHub Trending。
- 只想看中文介绍与趋势：直接看 PickGithub。
- 想查询 GitHub 历史指标或自助分析：优先用 OSS Insight。
- 想看短期动量和 Trending 历史：使用 Trending Repos 或 Trendshift，并遵守各自许可。
- 想立即获得双语摘要、分类榜、API/MCP：优先试用 HubLens。
- 想把“可信选型证据 + 中文判断 + Obsidian 长期沉淀 + 私人方向 Agent”连成一个系统：才进入 GitHub Picks 的建设范围。

### 25.3 必须保留的七项自建差异

1. GitHub、包生态、安全、依赖、社区与外部发现的多源证据图谱。
2. 项目类型、生命周期、年龄、规模和语言生态校准。
3. 高频真实活动与优质组织分别占明确权重，不隐藏在黑箱“热度”里。
4. Star 上限、异常隔离、风险独立和历史可回放。
5. 面向试用、预研和生产选型的中文分析，而非 README 摘要。
6. 标准 Markdown 与 Obsidian 可持续知识资产。
7. 公共评分不变、只按个人方向重排的受限 Agent。

任一版本若只剩“抓 Trending + 大模型总结”，产品评审应直接判定为重复建设并停止开发。

### 25.4 竞品数据使用边界

- 竞品页面只用于候选发现、产品研究或交叉验证，不能替代 GitHub 与官方包源的核心事实。
- 不抓取需要登录、明确禁止自动访问或禁止再分发的数据。
- 对付费 API 在接入前逐项审查缓存、派生、展示和转售条款；例如 Trendshift Signal 当前明确限制原始数据再分发。
- 页面展示竞品来源时保留原始链接和观测时间，不把第三方排名包装成 GitHub Picks 自有结论。
- 同一 GitHub 事件被多个竞品转述，只算一个 github-derived 独立性组，不能制造“多源一致”的假象。

## 26. 详细信源矩阵与稳定采集协议

### 26.1 首期信源矩阵

| 信源 | 级别 / 独立性组 | 采集内容 | 建议频率 | 核心用途 | 故障与合规处理 |
|---|---|---|---:|---|---|
| GitHub REST API | S / github-core | 仓库、组织、Release、Issue、PR、Contributor、标签和状态 | 热点 1h；普通 6h | 核心事实与实体 | GraphQL/最近成功快照补结构，不把旧值冒充新值；遵守条件请求和配额 |
| GitHub GraphQL API | S / github-core | 批量关系、提交历史、贡献与连接字段 | 6h/日 | 高效补齐关系 | REST 分页降级；按 node cost 预算并动态查询配额 |
| GitHub Events API | S / github-events | Push、Watch、Fork、Issue、PR、Release 等公开事件 | 遵守 X-Poll-Interval，目标 15m | 突发候选和近实时变化 | 使用 ETag；已知事件可能延迟约 30 秒至 6 小时，因此不承诺秒级实时 |
| GH Archive | S / github-events | GitHub 公开事件小时归档和历史回补 | 每小时 | 事件历史、回测、Events 缺口 | 当前小时未就绪则延后；与 Events 去重后不能算独立双证据 |
| GitHub Search API | S / github-core | 按创建时间、更新时间、语言、Topic 回补候选 | 6h/日 | 防止 Trending 漏检 | 搜索配额独立管理；分片查询、保存游标，不能高并发扫全站 |
| 仓库文件与 Git Tree | S / repository-self | README、LICENSE、SECURITY、CONTRIBUTING、CODEOWNERS、CI、测试、发布说明 | 默认分支 SHA 变化时 | 工程、治理、用途和许可证证据 | 固定 commit SHA 与路径；大文件只存哈希/必要片段，遵守内容展示边界 |
| GitHub Advisory Database | A / security-db | GitHub 生态安全公告与受影响版本 | 6h | 漏洞与修复状态 | OSV 交叉验证；冲突进入 risk_review |
| OpenSSF Scorecard | A / security-practice | 分支保护、依赖更新、发布签名等公开安全实践 | 日/周 | Security 与工程实践 | 缺失只降低置信度，不把未评分当 0 分 |
| OSV | A / security-db | 漏洞、版本范围、修复版本和别名 | 6h | 安全风险 | 官方公告/Advisory 交叉验证；保留查询版本和时间 |
| deps.dev | A / dependency-graph | 包、版本、依赖、项目映射和 Scorecard 关联 | 日 | 依赖图、采用与供应链 | 注册表元数据降级；映射低置信时不自动合并 |
| SPDX 许可数据 | A / standards | 标准许可证 ID、兼容名称和例外 | 周/月 | 许可证规范化 | 无法识别时标 unknown 并人工复核，不自行做法律结论 |
| npm / PyPI | S / package-registry | 版本、发布时间、下载趋势、包到仓库映射 | 热点 6h；普通日 | 真实分发和采用 | 各源独立限速；仓库 URL 仅作待核验映射 |
| crates.io / Maven Central | S / package-registry | 版本、下载/反向依赖和仓库元数据 | 日 | Rust/JVM 生态采用 | 单源缺失只影响相应生态特征，不阻塞日报 |
| NuGet / Go 模块代理 | S / package-registry | 包版本、发布时间、依赖和仓库映射 | 日 | .NET/Go 生态采用 | 保留生态适用性标记，不能用“无 npm 包”惩罚 Go 项目 |
| GitHub Trending / Topics | B / github-derived | 热门仓库、开发者、语言和主题候选 | 1h/日 | 高覆盖候选发现 | 页面变化时熔断解析器；不作为唯一入榜证据 |
| OSS Insight | B / github-derived | 趋势、历史指标和集合数据 | 6h/日 | 发现与历史交叉验证 | API 不可用不阻塞；核心字段回源 GitHub |
| OpenDigger / OpenRank | B / ecosystem-metrics | 活跃度、协作和开源生态指标 | 日/周 | 模型研究与交叉验证 | 先审查算法和许可；不直接照搬为分数 |
| Hacker News / Lobsters | B / community-discussion | 独立讨论、链接、评论时间与热度 | 1h | 外部关注和问题线索 | 只把独立讨论作为弱信号；不采私人信息，不做情绪即质量 |
| 基金会目录、技术雷达、优质 Awesome | B / curated | 赛道、成熟项目和人工策展候选 | 日/周 | 长尾回补和赛道校准 | 记录维护者、更新时间和转载关系；过期列表降权 |
| Trendshift / Trending Repos / PickGithub / HubLens | C / third-party-ranking | 趋势、突发项目与中文发现候选 | 1h/日 | 外部候选与竞品校验 | 不复制原始榜单；逐项遵守许可，失败不影响核心流水线 |
| Newsletter / 技术媒体 / 官方博客 | B/C / editorial | 发布、采用案例、方向变化 | 日 | 背景与候选 | 原作者/项目官方内容优先；转载归为同一独立性组 |

首期必须落地的最小集合是：GitHub REST/GraphQL/Events、GH Archive、仓库文件、至少 npm/PyPI/crates.io 三类包源、OpenSSF Scorecard、OSV、deps.dev、GitHub Trending、一个独立技术社区。其他来源按 Registry 接口逐步接入，不允许因为追求“信源数量”拖垮核心稳定性。

### 26.2 独立性组与证据计数

系统按来源背后的原始事实分组，而不是按域名计数：

| independence_group | 示例 | 计数规则 |
|---|---|---|
| github-core | REST、GraphQL、Search、仓库文件 | 同一字段最多计一个一手证据；多个接口只提升完整性 |
| github-events | Events、GH Archive、OSS Insight 的 GitHub 事件派生 | 同一 event_id 去重；派生平台不额外增加独立性 |
| package-registry | npm、PyPI、crates.io、Maven 等 | 不同生态可独立；镜像与上游注册表不重复计数 |
| security-db | OSV、GitHub Advisory、项目官方公告 | 同一漏洞按 alias 合并，独立维护机构可增强置信度 |
| dependency-graph | deps.dev、注册表反向依赖 | 同一依赖边按版本和时间去重 |
| community-discussion | Hacker News、Lobsters、独立技术文章 | 原帖与转载只算一个；项目官方宣传不算独立采用证据 |
| third-party-ranking | Trendshift、Trending Repos、HubLens 等 | 只作发现，不为核心事实增加独立性 |

强结论所需的“两项独立证据”必须跨独立性组，或由一手官方事实直接证明。例：GitHub Events 与 OSS Insight 同时显示 Star 增长不算两项；Star 增长加包下载增长才算跨组支持。

### 26.3 冲突处理优先级

1. 同一字段优先采用原始权威来源，例如许可证以固定 commit 的 LICENSE 与规范化结果为准。
2. 同级来源优先采用 event_at 较新且 observed_at 在新鲜度范围内的记录。
3. “没有记录”不覆盖已确认记录；只有明确 tombstone、删除或状态变化才能关闭事实。
4. 包到仓库、镜像到上游等关系不能仅凭字符串相似自动确认，必须保存候选、证据和映射置信度。
5. 发生实质冲突时写入 evidence_conflict，降低 Confidence；影响安全、身份或入榜资格时转人工复核。
6. 人工覆盖必须记录操作者、原因、证据、有效期和撤销记录，不能直接改原始事实。

### 26.4 GitHub 配额与礼貌采集

当前 GitHub REST 文档给出的基础额度是：未认证公共请求通常为每小时 60 次，认证用户请求通常为每小时 5,000 次；Search、GraphQL 和安装令牌存在独立规则或动态额度。实现不得把这些数字硬编码为永久事实，而应在运行时查询 rate limit 端点并记录每个资源桶的余量和 reset 时间。

首期策略：

- 生产优先使用权限最小化的 GitHub App 或专用服务凭据，不共享个人 Token。
- 所有采集进入队列；平台上限即使允许更高并发，本系统默认单凭据并发不超过 20，并按响应动态降速。
- 使用 ETag、If-None-Match、If-Modified-Since、字段批量查询和默认分支 SHA，避免重复下载。
- API 预算初始按热点快照 40%、候选补齐 25%、安全/依赖 15%、历史回补 10%、应急保留 10% 分配，运营数据允许调整。
- 收到 403/429 时读取 Retry-After 或 reset；没有明确时间时指数退避并加随机抖动。不得持续撞限。
- 每个来源设置独立队列和熔断器；第三方来源不能消耗 GitHub 核心采集的预留预算。
- 不抓取登录态页面，不绕过验证码，不使用轮换账号规避限制。

### 26.5 采集任务契约

每次任务都必须保存：

~~~text
ingestion_run_id
source_id
collector_version
requested_window
started_at / finished_at
request_fingerprint
rate_limit_before / rate_limit_after
http_status / retry_count
raw_snapshot_ref
record_count
cursor_in / cursor_out
freshness_at
result_state
error_class
~~~

任务幂等键为 source_id + resource_key + requested_window + collector_version。同一幂等键重跑可以产生新的尝试记录，但标准事实只接受确定的去重结果。

### 26.6 新鲜度与稳定性目标

| 数据层 | 正常目标 | 降级阈值 | 处理 |
|---|---:|---:|---|
| 已知热点候选事件 | 95% 在 60 分钟内被观察 | 超过 2h | 标注 live discovery degraded，不影响已冻结日报 |
| 热门候选仓库快照 | 95% 不旧于 90 分钟 | 超过 3h | 降低趋势置信度，停止新入榜 |
| 普通观察仓库 | 95% 不旧于 8 小时 | 超过 24h | 标 stale，不参与需要新鲜数据的榜单 |
| 安全/依赖 | 95% 不旧于 24 小时 | 超过 48h | 生产候选榜暂停受影响项目 |
| 组织画像 | 95% 不旧于 7 天 | 超过 14 天 | Organization 使用衰减后的上一版本并显著降置信度 |
| 正式日榜 | 08:00 前完成 | 08:15 未完成 | 进入延迟公告，不用半成品覆盖昨日版本 |

“稳定”以可控任务统计，不要求第三方网页永远可用。首期目标是核心 S/A 级采集任务滚动 7 天成功率不低于 98%，且所有失败均可重试、回放或明确降级；C 级来源不计入正式发布可用性。

### 26.7 候选池与成本控制

候选分为四个温度层：

- hot：最近 72 小时多源增长、发布或高质量讨论，1 小时补齐。
- warm：观察列表、组织重点项目、赛道头部和近 30 天入榜项目，6 小时补齐。
- cold：历史项目与长尾候选，每日或每周抽样更新。
- quarantine：身份、异常或风险待核验，只采核验所需证据，不进入普通榜单。

候选温度由确定性规则改变，并保存原因。单一 C 级信源最多把项目提升到 warm discovery，不能直接进入 hot 或 eligible。

## 27. 特征字典、评分细则与风险扣分

第 8 节给出最终八维权重，本节定义这些分数如何从事实落地。首期所有权重写入版本化配置并由确定性代码执行；大模型可以辅助分类和提取待核验候选，但不能直接产生特征值、维度分或综合分。

### 27.1 通用计算规则

每个连续特征先在 project_type × lifecycle × age_cohort × language_ecosystem 的可比群组内处理：

~~~text
1. 删除明确无效、机器人重复和身份未确认的事件
2. 对极值做 Winsorize
3. 对偏态计数做 log1p 或适合该指标的稳定变换
4. 计算 cohort percentile 或 robust z-score
5. 使用样本量进行贝叶斯收缩
6. 映射到 0..100，并保存 transform_version

DimensionScore =
  sum(applicable_weight_i * feature_score_i)
  / sum(applicable_weight_i)
~~~

规则：

- 不适用于该项目类型的特征标记 not_applicable，并在维度内重新归一权重。例如纯规范仓库没有发布包，不因此扣分。
- 应该存在但尚未采到的数据标记 missing，使用 cohort prior 并降低 Confidence，不填 0。
- 明确存在负面事实才产生负向分或 RiskPenalty。
- 同一事实只能进入一个主特征；需要跨维度使用时必须拆分语义并通过 double_counting 测试。
- 每个 feature snapshot 保存原值、清洗值、cohort、百分位、权重、证据列表和公式版本。

### 27.2 特征证据类型

| 类型 | 示例 | 是否可自动打分 |
|---|---|---|
| deterministic | Release 时间、活跃贡献者数、Issue 首响时间、包下载 | 是 |
| artifact_presence | CI、测试目录、SECURITY、LICENSE、贡献指南 | 是，但必须固定 commit SHA |
| verified_mapping | 包与仓库、漏洞与版本、组织与维护者 | 仅映射置信达到门槛后 |
| rubric | 问题定义、上手成本、文档可操作性 | 规则提取后由证据校验；低置信时人工抽检 |
| external_claim | 生产案例、性能提升、兼容性 | 只有独立来源或可复现实验后计分 |
| model_inference | 项目类型、赛道、相似项目 | 只生成候选，规则/人工确认后生效 |

### 27.3 Utility 实用价值 18%

| 子特征 | 维度内权重 | 事实与判定 |
|---|---:|---|
| 问题与边界清晰度 | 15 | README/文档是否明确问题、输入输出、适用与非适用场景 |
| 可安装与可运行 | 15 | 可验证安装路径、包/镜像/构建、最小运行示例 |
| 文档与示例可操作 | 15 | Quickstart、API 文档、示例、迁移或故障说明的完整度 |
| 功能交付完整度 | 15 | Release、变更日志、可下载产物和功能状态一致性 |
| 互操作与集成 | 10 | 标准协议、SDK、插件、主流生态兼容与迁移成本 |
| 外部结果证据 | 20 | 独立采用案例、可验证用户结果、公开基准或真实依赖 |
| 采用成本 | 10 | 配置复杂度、基础设施要求、许可证约束和维护成本，反向计分 |

README 的宣传措辞本身不加分。安装命令存在但无法对应发布产物、案例只有项目方自述或基准不可复现时，只记为待核验证据。

### 27.4 Engineering 工程质量 14%

| 子特征 | 维度内权重 | 事实与判定 |
|---|---:|---|
| CI 覆盖与近期成功证据 | 12 | 工作流存在、覆盖主分支/PR、近期状态可见 |
| 测试与质量门禁 | 14 | 测试资产、覆盖多层级、静态检查和失败阻断 |
| 技术文档 | 12 | 架构、API、运维、升级和故障文档 |
| 版本与发布纪律 | 12 | 标签、语义版本适用性、变更日志、回滚信息 |
| 贡献与治理 | 12 | CONTRIBUTING、行为准则、决策与维护者机制 |
| 依赖卫生 | 12 | 锁文件、更新节奏、过期/高风险依赖和自动化 |
| 可重复构建与交付 | 10 | 固定依赖、构建说明、包/镜像、校验或 SBOM |
| 评审和维护自动化 | 8 | PR 模板、Issue 模板、自动检查、发布自动化 |
| 可维护性证据 | 8 | 模块边界、弃用策略、兼容测试和长期重构记录 |

框架生态不同会改变 applicable 特征，但不得通过“文件越多分越高”。只有存在且与近期实际工作流一致的工程资产才计分。

### 27.5 Activity 开发活跃 18%

| 子特征 | 维度内权重 | 事实与判定 |
|---|---:|---|
| 有效活跃日 | 15 | 7/30/90 天有人类有效提交、评审或发布的日期分布 |
| 独立活跃贡献者 | 15 | 去机器人、去重复身份后的有效贡献者及新增/回流 |
| 核心维护连续性 | 15 | 核心维护者在多个窗口持续审核、合并和发布 |
| PR 响应与合并 | 15 | 首次评审、合并时间、积压、外部贡献接受率 |
| Issue 响应与处理 | 12 | 首次有效响应、关闭/重开、长期积压与标签治理 |
| Release 节奏 | 15 | 相对项目类型的发布频率、规律性和近期版本 |
| 7/30/90 天持续性 | 8 | 多窗口均有活动，防止一天批量提交伪装活跃 |
| 集中度与 Bus Factor | 5 | 活动是否极端集中于单人或单一短期贡献者，反向计分 |

有效提交排除纯格式化、批量 vendoring、依赖机器人和机械生成噪声；机器人有真实维护价值时可作为自动化证据，但不算人类贡献者。Activity 是用户要求的“高频项目加分”主入口，最高可贡献综合分 18 分。

### 27.6 Organization 组织与维护者信誉 15%

沿用第 8.5 节的七项结构，并明确输入：

| 子特征 | 维度内权重 | 输入 |
|---|---:|---|
| 历史项目质量 | 24 | 过去项目的工程、安全、持续采用和停止维护处理质量 |
| 持续维护能力 | 18 | 跨 12/24/36 个月的活跃仓库比例与版本持续性 |
| 维护者响应质量 | 16 | 旗下项目 Issue/PR 响应的 cohort 校准中位数 |
| 项目组合成功率 | 14 | 达到健康门槛的项目比例，而非项目总数或总 Star |
| 安全成熟度 | 10 | 安全政策、漏洞响应、供应链实践与事故透明度 |
| 治理透明度 | 10 | 维护者、决策、贡献、交接和弃用机制 |
| 身份可信度 | 8 | 域名/组织身份、签名与公开关联；Verified 只在此处提供部分证据 |

组织先验采用半衰期衰减，默认历史质量半衰期 24 个月，正式值由回测确定。个人维护者使用同构的 maintainer reputation，不因没有公司组织而得 0；新组织以 cohort prior 起步，仓库自身强证据可超过组织先验。Organization 是显式 15 分，不再额外添加不可解释的“大厂加分”。

### 27.7 Adoption 真实采用 10%

| 子特征 | 维度内权重 | 事实与判定 |
|---|---:|---|
| 已验证依赖者 | 25 | deps.dev、注册表反向依赖、公开清单中的真实依赖 |
| 包下载与留存趋势 | 20 | 去异常后的多窗口下载、版本迁移与重复使用 |
| 活跃 Fork | 12 | 有后续提交、同步或明确用途的 Fork，不是 Fork 总数 |
| 贡献者广度 | 13 | 非核心组织外的持续贡献和回流贡献者 |
| 独立采用/讨论 | 10 | 非项目方的案例、教程、问题讨论和技术雷达 |
| 回访与关注深度 | 5 | 重复参与者、Watcher 等弱但持续信号 |
| Star 存量 | 15 | cohort 内对数百分位，异常时归零 |

Star 存量在 Adoption 内占 15%，Adoption 在综合分占 10%，因此其直接贡献严格不超过 1.5 分。

### 27.8 Momentum 趋势动量 10%

| 子特征 | 维度内权重 | 事实与判定 |
|---|---:|---|
| Star 速度 | 30 | 1/7/30 天新增速度、EMA 与历史基线，异常时归零 |
| 贡献与提交加速度 | 20 | 人类贡献者、有效活跃日和提交相对历史加速 |
| Fork/依赖/下载加速度 | 20 | 至少一种采用信号与增长同步，而非只看 Star |
| Release 与功能变化 | 15 | 近期版本、重要变更和迁移活动 |
| 独立讨论加速度 | 10 | 跨社区的新增独立讨论，转载去重 |
| 持续性 | 5 | 增长跨越多个采样窗口，反向惩罚单点尖峰 |

Star 速度在 Momentum 内占 30%，Momentum 在综合分占 10%，因此直接贡献严格不超过 3 分。Activity 衡量“是否持续建设”，Momentum 衡量“是否相对自身和同类加速”；相同提交计数不能在两边重复作为绝对值使用。

### 27.9 Security 安全与合规 10%

| 子特征 | 维度内权重 | 事实与判定 |
|---|---:|---|
| 许可证明确性 | 15 | LICENSE、SPDX 规范化和包元数据一致性 |
| 安全政策与联系方式 | 10 | SECURITY、披露渠道、支持版本 |
| 已知漏洞与修复 | 25 | 漏洞严重度、受影响版本、修复状态和响应时长 |
| 安全工程实践 | 20 | OpenSSF Scorecard 等公开可验证实践 |
| 发布来源与完整性 | 10 | 签名、provenance、校验、可信发布工作流 |
| 依赖新鲜与风险 | 10 | 高风险/过期依赖、锁定与更新纪律 |
| 披露与事故响应 | 10 | 公告透明度、修复、回溯和用户指引 |

Security 维度表示正向成熟度；确认的严重问题同时进入独立 RiskPenalty。二者语义不同：缺少成熟实践使 Security 低，未修复严重漏洞产生额外风险扣分。

### 27.10 Innovation 创新与时效 5%

| 子特征 | 维度内权重 | 证据要求 |
|---|---:|---|
| 相对同类的新路径 | 25 | 与可比项目的功能/架构差异，有明确证据 |
| 可测量改进 | 25 | 可复现性能、成本、质量、易用性或兼容性提升 |
| 时机与问题重要性 | 15 | 对近期标准、平台或用户问题的及时响应 |
| 研究到工程 | 15 | 论文/规范实现、验证和工程可用性 |
| 生态扩展性 | 20 | 新协议、插件、互操作或可复用能力带来的外溢价值 |

“用了最新模型”“首次”“最快”等宣传不自动得分。无法交叉验证的创新判断标记 inference，只进入中文分析的待验证项。

### 27.11 Confidence 置信度

~~~text
Confidence =
  0.20 * 关键字段完整率 +
  0.20 * 独立信源覆盖 +
  0.15 * 信源一致性 +
  0.15 * 数据新鲜度 +
  0.15 * 样本与观测窗口 +
  0.10 * 实体映射可信度 +
  0.05 * 采集与解析健康度
~~~

| 置信度 | 标签 | 使用方式 |
|---:|---|---|
| >= 0.85 | 高 | 可进入全部满足资格的榜单 |
| 0.65–0.849 | 中 | 可进入普通榜单，页面显示证据缺口 |
| 0.55–0.649 | 早期 | 仅可进入新项目/观察类榜单 |
| 0.45–0.549 | 低 | 只展示档案，不进入推荐榜 |
| < 0.45 | 证据不足 | 不发布价值结论 |

### 27.12 风险处置和数值扣分

| 风险事实 | 默认处理 | 扣分范围 | 说明 |
|---|---|---:|---|
| 已确认恶意、仿冒或供应链投毒 | hard_exclude | 不计算 | 需权威公告或人工确认，不公开未经证实的指控 |
| 删除、不可访问或明确 archived | 普通榜排除 | 不计算普通榜 | 档案和历史保留，可进入状态/风险观察 |
| Star/Fork 明显异常但未确认原因 | quarantine | 暂不计算公开名次 | 核验后解除、归零异常特征或升级处置 |
| 包与仓库身份严重不一致 | quarantine / penalty | 5–10 | 影响供应链身份时先隔离 |
| 已确认未修复 Critical 漏洞 | penalty / 生产榜排除 | 12–20 | 按影响版本、可利用性、修复时长和用户暴露确定 |
| 未修复 High 漏洞超过合理窗口 | penalty | 5–10 | 项目无可用修复且仍在发布受影响版本时加重 |
| 许可证缺失 | penalty | 6 | 不作法律结论，但不进入生产采用候选榜 |
| 许可证冲突或包/仓库不一致 | penalty / review | 8–15 | 需要明确证据并进入人工复核 |
| 维护响应长期断崖式下降 | penalty | 3–8 | 相对其生命周期和自身历史，不惩罚正常 maintenance 项目 |
| 单维护者且近期无接替/响应 | penalty | 3–6 | 单维护者本身仅 warning；与持续性风险同时存在才扣分 |
| 宣传与发布/代码事实明显冲突 | penalty | 3–8 | 保存具体冲突，不做泛化评价 |
| 发布来源、签名或账号状态可疑 | quarantine / penalty | 5–15 | 涉及身份或供应链时优先隔离 |
| 数据过期或信源故障 | 降 Confidence | 0 | 数据质量问题不能伪装成项目风险 |
| 新项目尚无正式 Release | warning_only | 0 | 按类型和阶段解释，不普遍扣分 |

同一根因只扣一次，多个风险合计上限 30。0–4 为 low，5–9 为 medium，10–19 为 high，20 以上为 critical；hard_exclude 和 quarantine 使用独立状态，不用分数美化。

### 27.13 硬约束与自动化不变量

- 八个维度权重之和必须等于 100。
- 总 Star 对 PublishedScore 的直接贡献必须小于等于 1.5。
- Star 速度对 PublishedScore 的直接贡献必须小于等于 3。
- 增加未经验证的 Star 不能提高 Engineering、Security、Utility 或 Organization。
- 知名组织不能取消 risk finding，也不能使仓库跳过最低资格。
- missing 只能降低置信度或使用先验，不能被无条件当作 0。
- hard_exclude/quarantine 项目不能通过提高任一价值维度进入普通榜单。
- 相同 feature snapshot + score config + risk snapshot 必须产生逐位一致的结果。
- 任何人工覆盖必须在回放结果中可见。

### 27.14 三个合成示例

**示例 A：优质组织下的持续活跃工具。** Utility 82、Activity 91、Organization 88、Engineering 80、Adoption 65、Security 78、Momentum 86、Innovation 75，BaseScore 为 82.2。Confidence 为 0.90、RiskPenalty 为 2 时，PublishedScore 为 77.0。它会得到高组织和高频活动加分，但仍经过置信收缩与风险扣分。

**示例 B：新团队的新锐项目。** 项目只有中等 Star，但贡献者、Release、包下载和独立讨论同步加速，Organization 仍为先验 50。它可以凭 Momentum、Activity、Utility 和 Innovation 进入新项目潜力榜；若 Confidence 只有 0.62，则不能进入要求 0.65 的综合榜。新组织不会被大厂先验压死，也不会因热度直接成为生产候选。

**示例 C：十万 Star 的归档仓库。** 无论历史 Adoption 多高，只要仓库明确 archived，就不进入综合、新锐、活跃或生产采用候选榜，只保留历史档案并在状态观察中说明。Star 不能覆盖生命周期事实。

## 28. 全部榜单的独立规则

### 28.1 通用规则

除综合榜直接使用 PublishedScore 外，其他榜单先计算自己的 RawRankScore，再统一进行置信收缩和风险处理：

~~~text
RankScore =
  clamp(50 + Confidence * (RawRankScore - 50) - RiskPenalty, 0, 100)
~~~

通用资格：实体已解析、快照在新鲜度内、满足该榜置信度、不是未说明的 Fork/镜像、未处于 hard_exclude/quarantine。任何榜单都不能通过编辑手工改名次；人工只能修正事实、分类、风险或资格，并留下审计记录。

### 28.2 每日综合价值榜

- 排序：PublishedScore。
- 最低 Confidence：0.65。
- 最低观测：正常项目 30 天；已有可靠历史与一手事实的成熟项目可由历史回补满足。
- 用途：回答“今天综合最值得关注什么”，不是“今天 Star 最多什么”。
- 展示：Top 20，首页展示 Top 10；同时显示昨日、7 日和 30 日名次变化。

### 28.3 每周趋势上升榜

~~~text
RisingRaw =
  0.35 * Momentum +
  0.20 * Activity +
  0.15 * Utility +
  0.10 * Innovation +
  0.10 * Organization +
  0.10 * Engineering
~~~

- 最低 Confidence：0.65。
- Momentum 必须至少由两类信号支持，其中至少一类不是 Star/Fork。
- 7 天与 30 天均出现的持续上升优先于单日尖峰。
- 用途：发现正在加速且增长可信的项目。

### 28.4 新项目潜力榜

~~~text
NewGemRaw =
  0.25 * Utility +
  0.20 * Innovation +
  0.20 * Momentum +
  0.15 * Engineering +
  0.10 * Activity +
  0.10 * Organization
~~~

- 年龄：以 first_meaningful_release_at 优先，缺失时用创建时间；默认不超过 180 天。
- 最低 Confidence：0.55；至少 14 天观察或两个跨独立性组的强证据。
- 不要求高 Adoption，避免新项目因没有存量用户被压制。
- incubation 项目可以进入，但必须标“早期”，不能使用“生产可用”措辞。

### 28.5 隐藏宝石榜

~~~text
HiddenGemRaw =
  0.25 * Utility +
  0.20 * Engineering +
  0.15 * Activity +
  0.15 * AdoptionWithoutStars +
  0.10 * Security +
  0.10 * Organization +
  0.05 * Innovation
~~~

- 可见度必须低于同 cohort 的 P60；可见度综合 Star 存量、主流榜单出现次数和外部提及，不采用固定 Star 一刀切。
- 必须存在至少一种真实采用证据，如依赖者、包下载、活跃 Fork 或独立案例。
- 最低 Confidence：0.65；Utility 与 Engineering 均不得低于 60。
- 用途：找“使用证据强但传播不足”的项目，不是把任意低 Star 仓库称作宝石。

### 28.6 工程成熟榜与生产采用候选榜

~~~text
EngineeringMaturityRaw =
  0.35 * Engineering +
  0.20 * Security +
  0.15 * Activity +
  0.10 * Organization +
  0.10 * Utility +
  0.10 * Adoption

ProductionCandidateRaw =
  0.25 * Engineering +
  0.20 * Security +
  0.20 * Activity +
  0.15 * Adoption +
  0.10 * Utility +
  0.10 * Organization
~~~

工程成熟榜最低 Confidence 为 0.70。生产采用候选榜更严格：Confidence >= 0.75、Security >= 70、Engineering >= 70、许可证明确、存在适合项目类型的稳定发布、无未修复 Critical、生命周期不得为 incubation/declining/archived。

“生产采用候选”只表示值得进入团队评估，不代表 GitHub Picks 为兼容性、安全或商业使用作保证。页面必须继续展示具体采用成本与风险。

### 28.7 最活跃维护榜

~~~text
ActiveMaintenanceRaw =
  0.45 * Activity +
  0.15 * PRResponsiveness +
  0.10 * IssueResponsiveness +
  0.15 * ReleaseCadence +
  0.10 * MaintainerContinuity +
  0.05 * Organization
~~~

- 最低 Confidence：0.65。
- 至少跨越 30 天，默认同时检查 7/30/90 天，避免批量提交刷榜。
- 机器人生成活动不进入贡献者和响应指标。
- maintenance 生命周期可进入；其活跃标准按同生命周期校准，不强迫稳定项目频繁发功能版本。

### 28.8 优质开源组织榜

~~~text
OrganizationRankRaw =
  0.30 * 旗下项目质量加权中位数 +
  0.20 * 健康项目组合比例 +
  0.15 * 跨年维护持续性 +
  0.15 * PR与Issue响应质量 +
  0.10 * 安全成熟度 +
  0.10 * 治理透明度
~~~

- 默认要求至少 3 个 eligible 仓库；只有一个旗舰项目的组织需至少 12 个月高置信历史，并标注“小样本”。
- 组合指标使用中位数、截尾均值和健康比例，不让一个超级大仓库或大量空仓库主导。
- 已归档但完成迁移、交接和说明的项目不等同于不负责任；突然废弃且无说明才影响持续性。
- 组织榜页面展示代表项目、近期变化、风险事件和分数贡献，不只显示品牌名称。

### 28.9 技术赛道榜

- 先要求 SectorRelevanceConfidence >= 0.75，再在赛道 cohort 内按 PublishedScore 排序。
- 每个赛道同时提供综合、新锐、成熟三个视图；新锐/成熟沿用对应独立公式。
- 多赛道项目有一个主赛道，可在次赛道出现，但首页只占一个展示位。
- 赛道分类修改会产生 taxonomy_version，不回写旧榜历史。

### 28.10 风险观察榜与降温观察

风险观察榜不是“最差项目榜”，也不是价值榜的倒序：

~~~text
RiskWatchScore =
  0.35 * Severity +
  0.20 * UserExposure +
  0.15 * UnresolvedDuration +
  0.15 * EvidenceConfidence +
  0.10 * Recency +
  0.05 * EcosystemImpact
~~~

- 只公开有充分事实支持、对用户有行动价值的风险；无法确认的异常只在内部 quarantine。
- 公开措辞描述“观察到什么”和“建议检查什么”，不在证据不足时指控作弊或恶意。
- 降温观察是独立子视图，使用 Activity、Momentum、维护响应和发布节奏的 30/90 天持续下降，不等同于安全风险。
- 风险解除、修复或误报必须在历史中留下状态变更与依据。

### 28.11 多方向与多样性约束

正式日榜覆盖第 7.3 节的多技术方向。为防止 AI 热点或大组织占满首页，在多样化视图中使用：

- Top 10 同一组织最多 2 个，Top 20 最多 4 个。
- Top 10 同一主赛道最多 4 个，同一主语言最多 5 个。
- 同一产品的 monorepo、插件仓库和镜像优先合并为项目簇展示。
- 配额不足时只从符合资格的下一名补位；不得为了凑多样性引入低置信或高风险项目。
- 页面同时提供“纯分数”与“多样化精选”切换，并解释差异。

首页“今日最值得看的 3 个”从综合、新锐/隐宝、赛道变化中各选一个高证据候选；若某类当天没有合格项目，可以少于 3 个，不能硬凑。

### 28.12 并列、快照与人工编辑

并列时依次比较：Confidence 高、RiskPenalty 低、核心证据更新近、独立信源多、稳定 entity_id 字典序。最后一项只保证确定性，不被解释为质量差异。

榜单快照包含 eligibility_result、raw_rank_score、rank_score、dimension_scores、confidence、risk_findings、diversity_adjustment、formula_version 和 evidence_hash。人工编辑可以撰写“为什么今天值得看”，但不能移动名次；编辑选择与算法名次分开展示。

## 29. 每日生产流水线与发布契约

### 29.1 时间定义

- 全部官方日报以 Asia/Shanghai 为产品时区，数据库事件保留原始时区并统一存 UTC。
- 日期 D 的正式快照截止时间为 D 日 06:30；7/30/90 天滚动指标均以这一时刻为右边界。
- “今日增长”比较 D 与 D-1 的相同截止点，不能拿完整 24 小时与半天窗口比较。
- 08:00 发布的 official snapshot 不再就地修改；迟到数据进入下一版本或显式 correction。
- 白天的 1 小时更新属于 live preview，必须与 official daily 分开标识，不能悄悄改变当日历史榜。

### 29.2 日常时序

| 北京时间 | 任务 | 产物与门禁 |
|---|---|---|
| 全天每 15–60 分钟 | 候选发现、热点事件、仓库增量采集 | live candidate 与 source health，不直接发布正式分数 |
| 00:00–05:30 | 普通仓库、包、安全、依赖和组织回补 | 原始快照、事实增量、缺口清单 |
| 05:30–06:20 | 热点最后补齐、异常初筛、配额保留 | eligible candidate set、异常隔离 |
| 06:20–06:30 | 核心信源健康检查与截止准备 | freeze readiness；核心失败则触发降级/延迟 |
| 06:30 | 数据冻结 | immutable data_version 与 cutoff_at |
| 06:30–06:50 | 标准化、实体解析、冲突检查 | fact_snapshot、identity review queue |
| 06:50–07:10 | cohort、特征、置信度和风险计算 | feature_version、risk_snapshot |
| 07:10–07:25 | 八维评分、资格、多榜单与多样性 | score_version、ranking_version |
| 07:25–07:40 | 生成/更新重点项目事实包和中文分析 | analysis draft，数字与链接校验 |
| 07:40–07:52 | 自动门禁与必要人工复核 | release candidate 或明确失败原因 |
| 07:52–08:00 | 原子发布网站、API、Markdown | publication_version；缓存预热与健康检查 |

为了不把中文分析压在 15 分钟内临时生成，系统可在白天基于 live preview 预生成草稿；冻结后只允许用正式事实包重新校验并更新变化段。预生成内容不通过 evidence_hash 校验就不能复用。

### 29.3 每日正式发布包

一次 publication 必须原子包含：

1. 日报元数据、截止时间、覆盖范围和降级说明。
2. 综合、新锐、隐宝、工程、生产候选、活跃、组织、赛道和风险榜快照。
3. 今日重点 3 项及其完整中文分析；无合格项时允许少于 3 项。
4. Top 20 项目卡片所需的事实、分数、风险和一句话结论。
5. 组织动态、赛道变化和风险/降温摘要。
6. 信源健康、数据缺口、公式与模型版本。
7. 对应的 API 响应、标准 Markdown 和校验清单。

网站、API 和 Markdown 必须引用同一个 publication_version。任何一个渠道构建失败，Outbox 不得把其余渠道标记为正式完成。

### 29.4 重点项目选择

今日重点不是简单取综合榜前三：

- 第一个优先从综合价值榜选择，代表“当前综合最值得看”。
- 第二个优先从新项目潜力或隐藏宝石选择，代表“早发现”。
- 第三个优先从赛道重大变化、组织动作或高行动价值风险中选择。
- 三项尽量属于不同项目类型/赛道；每项仍必须满足其来源榜资格。
- 编辑只能在同一候选池中选择“更值得解释”的项目，必须保存 editorial_reason，不能修改算法得分。

### 29.5 自动分析门禁

每份中文分析发布前必须通过：

- 文中所有数值与事实包逐项匹配。
- 每个仓库、文档、公告和证据链接格式有效且指向对应实体。
- “生产可用、官方、首个、最快、零风险”等强措辞有明确证据，否则删除或标推断。
- 适合谁、不适合谁、最大风险、建议动作均存在。
- 对比项目处于可比 cohort，且差异来自同一时间点的数据。
- 内容相似度不过度模板化，没有大段复述 README。
- evidence_hash、prompt_version、model_version、validator_version 完整。

### 29.6 人工复核触发器

首期不是所有项目都人工审稿，只在以下情况触发：

- 今日重点 3 项首次进入公开站。
- Top 10 出现 high/critical 风险或风险状态刚变化。
- 身份、包映射、许可证或上游关系冲突。
- 分数单日变化超过 15 分、名次异常跳升或来源间明显矛盾。
- 中文分析包含生产采用、安全或法律相关强结论。
- 自动验证多次失败或模型输出与事实包不一致。

人工超时不能被系统当作“默认通过”。可选择少发分析、延迟单项或发布结构化榜单降级版。

### 29.7 更正机制

- 迟到但不影响核心结论的数据进入次日，不改写 official snapshot。
- 解析错误、身份合并错误或风险误报影响事实时发布 correction_version，并保留原版本和更正原因。
- 页面展示“已更正”、时间和变化摘要；API 通过 supersedes_version 连接新旧版本。
- 更正不允许删除审计历史，也不能静默重排历史榜。

## 30. 数据表、事件与 API 契约

### 30.1 最小核心表

| 表 | 主键/唯一性 | 作用 |
|---|---|---|
| source_registry | source_id | 信源等级、用途、独立性、频率、合规和健康配置 |
| ingestion_run | ingestion_run_id；幂等键索引 | 一次采集尝试、配额、游标、状态和错误 |
| raw_snapshot | raw_snapshot_id；content_hash | 不可变原始响应引用、对象存储位置和抓取元数据 |
| source_observation | observation_id；source + external_id + observed_at | 来源中的原始观测 |
| repository | github_node_id | 仓库稳定实体、当前别名和生命周期 |
| repository_alias | repo_id + owner_name + valid_from | 改名、转移、旧 URL 和时间范围 |
| organization / maintainer | stable identity | 组织、个人维护者和身份置信 |
| repository_relation | from + to + type + valid_from | Fork、镜像、模板、monorepo、替代/互补关系 |
| package / package_version | ecosystem + package_name + version | 包生态实体与版本 |
| repository_package_link | repo + package + valid_from | 多对多映射、证据和 mapping_confidence |
| event_fact | provider_event_id 或规范化去重键 | 提交、Issue、PR、Release、Watch、Fork 等时序事实 |
| vulnerability_finding | vulnerability + package/repo + version range | 漏洞、严重度、状态、来源别名和修复 |
| feature_snapshot | entity + cutoff + feature_version | 特征原值、cohort、变换值和证据 |
| score_snapshot | entity + cutoff + score_version | 八维分、Base、Confidence、Risk、PublishedScore |
| risk_finding | entity + finding_type + opened_at | 证据、处置、扣分、审核和状态历史 |
| ranking_snapshot | date + ranking + entity + formula_version | 资格、名次、分数和多样性调整 |
| analysis_report | entity/date + analysis_version | 事实包哈希、中文内容、验证状态和模型版本 |
| publication | publication_version | 各渠道原子发布状态、截止、版本和更正关系 |
| audit_log | append-only audit_id | 人工覆盖、配置、规则、风险和发布操作 |

### 30.2 原始对象组织

~~~text
raw/{source_id}/{yyyy}/{mm}/{dd}/{ingestion_run_id}/{content_hash}.{ext}
facts/{data_version}/{entity_type}/{partition}.parquet
features/{feature_version}/{cutoff_at}/{cohort}/{partition}.parquet
publications/{publication_version}/{web|api|markdown}/...
~~~

原始对象不可原地覆盖；敏感响应头、Token 和 Cookie 在写入前删除。保留周期按来源条款和成本配置，删除原始对象时仍保留哈希、采集元数据与依法允许的最小审计记录。

### 30.3 内部事件

~~~text
source.observed.v1
entity.resolved.v1
fact.upserted.v1
snapshot.frozen.v1
features.built.v1
risk.evaluated.v1
scores.calculated.v1
rankings.generated.v1
analysis.verified.v1
publication.ready.v1
publication.released.v1
correction.released.v1
~~~

事件只传主键、版本和对象引用，不在队列里复制大文本。消费者使用 event_id + consumer_version 幂等；失败进入 DLQ，修复后从原始对象或前一稳定快照回放。

### 30.4 API 响应包络

~~~json
{
  "data": {},
  "meta": {
    "publication_version": "pub-2026-08-03-v1",
    "data_version": "data-2026-08-03T063000+0800",
    "score_version": "score-v1.0.0",
    "analysis_version": "analysis-v1.0.0",
    "generated_at": "2026-08-03T08:00:00+08:00",
    "cutoff_at": "2026-08-03T06:30:00+08:00",
    "degradation": null
  },
  "evidence": [],
  "links": {}
}
~~~

- ETag 基于 publication_version + resource + query 生成。
- 列表使用稳定 cursor，不使用会因新榜插入而漂移的 offset。
- 404 区分 entity_not_found、not_published 和 historical_alias；仓库旧别名返回 canonical 链接。
- 409 用于版本/同步冲突，429 返回 Retry-After，5xx 不泄露内部响应或凭据。
- API Schema 只通过向后兼容方式扩展；破坏性变化进入 /api/v2。

### 30.5 可回放链

任一榜单项必须能够按以下路径复现：

~~~text
publication_version
  -> ranking_snapshot
  -> score_snapshot + eligibility + formula config
  -> feature_snapshot + cohort config
  -> fact records
  -> source_observation
  -> raw_snapshot_ref + parser_version
~~~

回放工具输入 publication_version 和 entity_id，输出当时的名次、每一分的来源、风险扣分、缺失字段和人工覆盖；回放结果与历史快照不一致时自动阻止新评分版本发布。

## 31. 网站、中文结果、Obsidian 与 Agent 的完整用户流程

### 31.1 五条核心用户任务

| 用户任务 | 起点 | 最短完成路径 | 结果 |
|---|---|---|---|
| 每天快速发现 | 首页 | 今日 3 项 → 项目卡 → 原仓库 | 3 分钟内知道今天看什么 |
| 按方向筛选 | 赛道/搜索 | 方向 → 新锐/成熟 → 筛选 | 得到与自身技术方向相关的候选 |
| 做技术选型 | 项目档案 | 同类替代 → 加入比较 → 证据差异 | 形成试用/预研/生产评估输入 |
| 持续跟踪 | 项目/组织 | 加入本地观察 → 查看历史变化 | 看见分数、版本、风险和组织变化 |
| 沉淀知识 | 任意报告 | 下载 Markdown / 保存到 Obsidian | 变成用户拥有、可批注的长期笔记 |

首期不要求登录即可完成前四项中的公开浏览；观察列表先保存在浏览器。本地列表可导出 JSON/Markdown，等跨设备同步和 Agent 上线时再要求账户。

### 31.2 首页信息顺序

首页按照用户判断顺序，而不是按照系统模块顺序排列：

1. 日期、截止时间、数据健康和是否降级。
2. 今日最值得看的 3 项：一句话价值、为什么今天、最强证据、最大风险、建议动作。
3. 综合 Top 10 与昨日/7 日变化。
4. 新锐与隐藏宝石各 5 项。
5. 高频活跃项目和优质组织动态。
6. 赛道温度与重大变化，默认展示 AI Coding/Agent、开发者工具、数据基础设施、安全等高信号方向，但可切换全部方向。
7. 风险与降温观察。
8. 今日覆盖、信源异常、评分版本和方法入口。

如果当天没有满足条件的项目，页面明确说“今日没有足够证据的新推荐”，不能用低质量候选填满版面。

### 31.3 项目卡信息契约

每张卡必须包含：

~~~text
项目名 / 组织 / 主赛道 / 项目类型 / 生命周期
一句话中文结论
PublishedScore / Confidence / Risk
今日出现原因（最多 2 条）
最强证据（1 条）
最大风险或未知（1 条）
Star 总量与增量（弱化展示，不作为视觉主角）
Activity / Organization / Engineering 三个关键维度
建议动作：试用 / 预研 / 生产评估 / 观察 / 忽略
数据截止 / 评分版本 / 证据入口
~~~

视觉上优先突出结论、活动、组织、证据和风险；Star 放在二级元数据区，避免用户再次把本站误读为 Star 排行榜。

### 31.4 项目档案结构

1. 结论与建议动作。
2. 八维雷达/条形对照、置信度和风险；不把风险混进雷达后隐藏。
3. “为什么今天变化”：名次与分数变化的可读归因。
4. 项目做什么、适用/不适用、安装和采用成本。
5. 30/90/365 天 Activity、Release、Adoption 与 Momentum 历史。
6. 组织与核心维护者：持续性、响应、代表项目和 Bus Factor。
7. 工程、安全、许可证、依赖和已知风险。
8. 同类替代、互补项目与差异。
9. 原始证据表：字段、来源、事件时间、观测时间、状态。
10. 历史榜单、分析版本和更正记录。
11. GitHub、官方文档、包注册表、Markdown 与 Obsidian 动作。

### 31.5 比较页

- 默认只比较 2–4 个同赛道且项目类型可比的项目；不可比时先提示差异，不强行给“赢家”。
- 对齐同一 cutoff_at、score_version 和 taxonomy_version；无法对齐时显示时间差。
- 对比问题按“适用场景、成熟度、活动、组织、工程、安全、采用、集成成本、许可证、最大风险”排列。
- 每个差异都能展开证据；主观结论标记为“分析判断”。
- 输出“如果你是……优先考虑……”的条件化建议，不给脱离团队上下文的绝对排名。

### 31.6 中文分析语言规范

- 首句先说项目是什么和当前判断，避免营销开场。
- 保留必要英文技术名词，第一次出现时给简明中文解释；不生造中文译名。
- 区分“事实”“推断”“项目方宣称”“本站建议”。
- 用具体时间窗口表达增长，例如“截至 06:30 的 7 日活跃贡献者增加”，不写“最近暴涨”。
- 不用“封神、碾压、必看、零风险、生产级”等无法证明的词。
- 明确适合谁、不适合谁和验证成本；对技术负责人优先给采用边界，对学习者优先给学习价值。
- 许可证和安全只提供事实与工程风险提示，不替代法律或安全审计。

### 31.7 保存到 Obsidian 的端到端流程

**无插件路径：** 用户在日报、项目、组织或赛道页点击“下载 Markdown”，得到带 Properties、双链建议、证据和版本的标准文件；不需要账户。

**插件路径：**

1. 用户安装 GitHub Picks for Obsidian，明确选择 Vault 内目标根目录。
2. 插件生成/取得只读访问令牌，并用 SecretStorage 保存。
3. 用户选择榜单、赛道、最低分、观察项目和自动同步频率。
4. 插件请求 manifest，按 github_picks_id、entity_version、content_hash 和 ETag 计算变化。
5. 新实体创建标准 Markdown；已有实体只更新 managed block 和 github_picks_ Properties。
6. 用户自己的“我的判断”、双链、标签和管理区外内容原样保留。
7. 仓库改名更新 aliases 和建议文件名，不创建重复实体。
8. 冲突产生副本或交互确认；断网保留 cursor，恢复后续传。
9. Bases 从标准 Markdown 生成项目总览、观察列表和风险视图，Bases 不是唯一数据。

**网站一键保存：** 若 Obsidian URI/插件协议可用，网站只传公开 entity_id 或 URL，让插件自行向 API 拉取；不得把令牌放进 URL。不可用时回退为 Markdown 下载。

### 31.8 Agent 接入路径

Agent 到 M5 才开放，分三种入口：

- 网站对话：用显式方向、语言、目标和观察列表重新排序公开情报。
- 只读 API/MCP：让用户自己的 Agent 查询日报、榜单、项目、比较和证据。
- Obsidian 本地上下文：插件/本地 Agent 只读取用户逐项授权的目录，把公开证据与用户批注结合。

首轮对话要求用户明确“关注方向”和“当前目标”，例如 AI Coding + 团队生产选型。回答必须先检索已发布事实，再按第 14.2 节计算 PersonalScore；没有证据时直接说未知。Agent 可以生成观察建议和 Obsidian 内容，但不能自动安装项目、修改代码、发邮件或替用户作采用决定。

### 31.9 可访问性、移动端与性能体验

- 核心结论不依赖颜色；分数、风险和变化均有文字标签。
- 榜单、证据表和比较页支持键盘操作、语义标题和屏幕阅读器。
- 375px 宽度下项目卡不横向溢出，首屏仍能看到结论、分数、风险和原因。
- 图表都有文字摘要和可下载数据。
- 页面先渲染冻结的静态/缓存内容；交互筛选再请求 API，避免首页依赖实时评分。
- 证据链接在新窗口打开时保持上下文，并清楚标明外部站点。

## 32. 故障降级矩阵与运营 Runbook

### 32.1 发布健康等级

| 等级 | 条件 | 对外行为 |
|---|---|---|
| Green 正常 | 核心 GitHub 事实、原始存储、评分、风险和发布均健康；其余来源在 SLO 内 | 正常发布全部榜单与分析 |
| Yellow 轻度降级 | 一个非核心 A/B/C 来源超时，或部分生态包源过期，但核心事实完整 | 按时发布；受影响特征降置信，页面顶部和来源状态说明 |
| Orange 核心部分降级 | Events/历史/部分 GitHub 补齐超过阈值，或安全数据不能满足生产榜要求 | 发布不受影响的结构化榜单；暂停新入榜、趋势榜或生产候选榜中的受影响部分 |
| Red 延迟 | 核心仓库身份/元数据不可用、原始快照无法落盘、评分版本不一致、重大风险门禁失败或无法原子发布 | 保留上一 official snapshot，发布延迟公告；绝不把旧数据标成今日 |

降级是 publication_version 的正式字段，不是日志备注。日报、API、Markdown 和 Obsidian 同步都必须看到相同状态。

### 32.2 来源与组件故障矩阵

| 故障 | 可用替代 | 必须关闭/降级的能力 | 恢复动作 |
|---|---|---|---|
| GitHub REST 限流/故障 | GraphQL、条件缓存、已落盘事件 | 新实体完整补齐；持续超阈值进入 Red | 等 reset、降低热池、重跑缺口，不轮换账号绕限 |
| GraphQL 故障 | REST 分页 | 大批关系查询变慢 | 从 cursor 回补，核对 node_id |
| Events API 延迟 | GH Archive | live preview 延后 | event_id 去重回补，不修改已发布日榜 |
| GH Archive 缺小时 | Events 与下一轮归档 | 历史回测/窗口完整度下降 | 延后该小时并标 gap，归档可用后重放 |
| 单个包注册表故障 | deps.dev/最近成功包快照 | 该生态 Adoption 降置信 | 按生态队列重跑，不用其他生态阈值代替 |
| OSV/Advisory 故障 | 另一安全库、官方公告 | 受影响项目暂停生产候选榜 | 恢复后重算 Security/Risk，必要时 correction |
| OpenSSF Scorecard 故障 | 仓库安全资产 | Security 部分特征 missing | 不当作 0，恢复后日更 |
| Trending/竞品/社区故障 | 其他候选源 | 候选覆盖下降，不影响已有核心事实 | 熔断解析器并告警，不阻塞日榜 |
| 实体解析冲突 | 无自动替代 | 冲突实体不入榜 | 人工确认 alias/upstream/package mapping 后回放 |
| 大模型不可用 | 规则事实摘要 | 深度中文分析减少 | 发布结构化榜单，模型恢复后只能发新 analysis_version |
| 分析验证失败 | 结构化项目卡 | 该分析保持 draft | 修复事实包/Prompt/验证器后重跑 |
| Web 构建失败 | 无 | 整个 publication 暂不标完成 | 修复并从 Outbox 重放同一 release candidate |
| Obsidian API 故障 | 已下载 Markdown、本地现有内容 | 只暂停增量同步 | 保留 cursor，恢复后按 manifest 续传 |

### 32.3 事故处理顺序

1. 发现：监控根据 error budget、freshness 和发布门禁生成 incident_id。
2. 止损：暂停受影响队列或新发布，不删除原始快照和 DLQ。
3. 分类：确认是来源、配额、解析器、实体、公式、模型还是发布问题。
4. 降级：按矩阵生成 machine-readable degradation，不靠值班人临时决定文案。
5. 修复：在保存的 fixture/raw snapshot 上复现，更新 collector/parser/rule 版本。
6. 回放：从最后一致 data_version 或原始对象重算，比较行数、哈希、分数与榜单 diff。
7. 发布：必要时生成 correction_version；不影响结论的迟到数据进入下一日。
8. 复盘：记录根因、影响实体、检测缺口、恢复时间和防复发测试。

### 32.4 数据陈旧展示

- 每个项目显示核心数据 cutoff_at 和各关键来源 last_observed_at。
- stale 指数据超出新鲜度，不等于项目不活跃。
- 页面不得用昨天的 Star/Issue 数配上今天日期；若沿用上一已知值，明确显示“最后观测于”。
- 涉及趋势的任一必要窗口陈旧时不计算趋势名次，而不是用不完整窗口估算。
- 历史图以 gap 表示缺口，不用插值制造真实事件。

### 32.5 成本降级顺序

当 API、存储或模型成本超过当日预算时，依次：

1. 降低 cold 候选频率。
2. 延后非重点组织画像和历史回补。
3. 减少非入榜项目的深度中文分析。
4. 对 unchanged 内容复用已验证分析并校验 evidence_hash。
5. 保留核心 S/A 事实、风险、Top 榜和版本发布。

不得通过减少安全采集、取消证据存储或让模型猜测缺失数据来省成本。

## 33. 分阶段量化验收与产品校准

以下是首期可执行门槛。阈值通过 30 天影子运行校准后可以升高；任何调整都写入版本和决策记录，不能为了按时上线临时降低且不披露。

### 33.1 M0：现有产品替代验证

在开发完整系统前，用 GitHub Trending、PickGithub、OSS Insight、HubLens 等完成真实使用测试：

- 选定至少 5 个核心方向和 30 个代表项目，连续观察 7 天。
- 记录现有产品能否回答价值、活动、组织、工程、安全、风险、中文建议和知识沉淀。
- 若 HubLens 或其他产品已能满足全部必须项，停止自建；若只缺可通过其公开 API/导出补足的薄层，优先做集成而非全栈。
- 只有第 25.3 节七项差异中至少五项仍为实质缺口，且证据/Obsidian属于必须项，才进入 M1。

### 33.2 M1：信源与证据门槛

- 核心 S/A 任务滚动 7 天成功率 >= 98%。
- 第 26.6 节各层 95% 新鲜度目标达到；每个超时有结构化原因。
- 100% 核心事实具有 source_id、observed_at 和 raw_snapshot_ref。
- 仓库改名、转移、Fork、镜像、删除、包多映射 golden fixtures 全部通过。
- 人工抽样的仓库/包/上游关系映射 precision >= 99%；低置信映射不得自动合并。
- 任取 3 个日期可从原始对象重建相同的标准事实哈希。
- Token、Cookie、私人路径不会进入对象存储、日志和 DLQ。

### 33.3 M2：评分、风险与榜单门槛

- 同输入、同配置重复计算结果 100% 一致。
- Property-based Test 证明 Star 存量 <= 1.5 分、Star 速度 <= 3 分。
- missing/not_applicable/negative 三种状态均有回归样本，missing 不会被当 0。
- 所有 hard_exclude/quarantine 样本均不能进入普通榜单。
- 每张榜单的 Top 20 可由 snapshot 完整回放，资格、并列和多样性结果一致。
- 固定样本由至少两类使用视角评审：技术学习价值与生产选型价值分开，不把二者混为一个“好项目”。
- 历史回测必须证明该模型相对“只按 Star/Star 增长”基线，在 30/90 天持续维护与真实采用指标上有改善；未改善不得宣布评分有效。

### 33.4 M3：中文分析与网站门槛

- 先进行 30 个自然日影子运行，不公开承诺稳定日更。
- 影子期 95% 日报在 08:00 前形成 release candidate；所有延迟/降级 100% 有状态记录。
- 已发布分析中数字忠实度 100%，强结论证据覆盖率 100%，推断标注率 100%。
- 今日重点和 Top 10 不得含未处理 identity/risk 冲突。
- 缓存命中的公开 API p95 < 500ms；定义的移动端测试环境中首页 LCP 目标 <= 2.5s。
- Playwright 覆盖首页、所有榜单、项目、组织、赛道、比较、方法和信源状态。
- 至少 5 名目标用户参与可用性测试，80% 能在 30 秒内从项目首屏回答“做什么、为何出现、最大证据、最大风险、下一步”。
- Web/API/Markdown 对同一 publication_version 的抽样内容逐字段一致。

### 33.5 推荐质量校准

系统不把点击率当作唯一质量。每周抽样 Top、未入榜边界项和风险项，追踪：

- 专家相关性：项目是否真的值得目标方向投入时间。
- 发现领先量：首次推荐相对主流 Trending/竞品大规模出现的提前时间。
- 30/90 天持续维护率：入榜后是否继续有人类贡献、响应和发布。
- 真实采用变化：依赖者、下载、活跃 Fork 或独立案例是否增长。
- 风险命中与误报：风险是否被后续事实证实，是否伤害正常项目。
- 多样性：组织、赛道、语言和项目阶段是否被单一热点淹没。
- 用户行动价值：收藏、比较、查看证据、导出和形成试用决策，而非只点开页面。

首版目标不是给这些指标拍脑袋定商业 KPI，而是建立“GitHub Picks 模型 vs Star-only vs GitHub Trending”的同窗口基线；评分调整必须同时报告收益、误报和受影响 cohort。

### 33.6 安全、合规和发布门槛

- 完成 GitHub 名称/商标、API 条款和每个第三方信源的使用审查。
- 公开独立非官方声明，视觉不使用 GitHub 官方 Logo/Octocat 制造隶属感。
- 凭据权限最小化，Secret 扫描、依赖审计、备份恢复和事故演练通过。
- 风险内容有证据、复核和申诉/更正路径，不公开未经证实的恶意/作弊指控。
- 数据保留、删除、更正和来源下线都有可执行流程。

### 33.7 M4：Obsidian 门槛

除第 13.9 节外，还要求：

- 1,000 个实体的初始同步和 100 个变化的增量同步有性能基线，不阻塞 Obsidian 主要交互。
- 同一实体经历改名、组织转移和别名访问后仍只有一个 github_picks_id。
- 管理区人工修改、跨设备先后修改、网络中断和版本倒退均有 fixture。
- 插件只访问配置根目录，SecretStorage 中令牌不会出现在设置导出、笔记、URL 或日志。
- 桌面、iOS、Android 核心同步通过；平台不支持的增强功能明确降级。
- 卸载插件、API 永久不可用或 GitHub Picks 停服后，标准 Markdown 与用户内容仍可阅读。

### 33.8 M5：Agent 门槛

- 公共 PublishedScore 与 Agent PersonalScore 分表、分接口、分展示，测试证明个性化不回写公共分。
- 每次回答记录使用的 publication_version、检索实体和权限范围。
- 无明确兴趣时不猜测敏感画像；用户可查看、修改和删除偏好。
- Obsidian 只读取 allowlist 目录，越界请求自动拒绝并留审计。
- 针对提示注入、恶意 README、工具越权、数据外泄和错误引用建立安全评测集。
- Agent 在无证据、过期数据和冲突状态下能拒绝强结论。
- Agent 不自动安装、执行、提交、发邮件或对外发送内容。

### 33.9 每个里程碑的完成定义

里程碑只有同时具备代码、迁移、自动化测试、运行手册、监控、成本记录、回滚/回放和用户可见说明才算完成。Demo、一次成功抓取、模型生成一篇摘要或本地截图均不等同于上线。

## 34. 决策记录、评分演进与待定项

### 34.1 已确定决策

| 决策 | 最终选择 | 原因 |
|---|---|---|
| 产品名 | GitHub Picks | 满足“GitHub XXXX”的直白功能型命名，Picks 表示有证据的精选 |
| 是否无条件自建 | 否，先做 M0 替代验证 | 市场已有强替代，避免重复建设 |
| 产品顺序 | 信源 → 分析/评分 → 榜单/网站 → Obsidian → Agent → 推送 | 交付层不能先于可信事实 |
| 邮件推送 | 首期不做，放 M6 | 当前重点是结果质量与稳定生产 |
| 项目覆盖 | 多技术方向、先分类后比较 | 避免只追 AI 热点和不同类型错比 |
| 综合模型 | 八维价值 + 独立 Confidence + 独立 Risk | 兼顾价值、证据不足和明确风险 |
| 高频活动 | Activity 18% + Momentum 中独立加速度 | 明确响应“高频项目加权”，同时避免重复计数 |
| 优质组织 | Organization 15%，有衰减、上限和新组织保护 | 认可长期信誉但不迷信大厂 |
| Star | 存量 <= 1.5 分，速度 <= 3 分 | 防止退化为 Star 榜 |
| 榜单 | 每榜独立公式和资格 | 新锐、成熟、活跃、组织和风险不是综合榜筛选器 |
| 中文分析 | 事实包 → 矛盾 → 判断 → 写作/验证 | 模型不计算事实分，不只翻译 README |
| 基础技术 | TypeScript monorepo + Next.js + Fastify + Worker；Python 仅校准/回测 | 共享契约，兼顾网站工程与统计能力 |
| 数据技术 | PostgreSQL + S3-compatible raw + Redis + DuckDB/Parquet | 首期足够、可回放且不过度复杂 |
| Kafka/ClickHouse | 首期不引入 | 等真实事件量和查询成本证明需要 |
| Obsidian | 标准 Markdown + 原生插件；Bases 为增强 | 用户所有权、可读性和可持续同步 |
| Agent | M5，只做显式偏好和受限读取 | 先确保公共情报可信，再做个性化 |
| 品牌边界 | 显著非官方声明，不使用官方 Logo/Octocat | 降低隶属误解和商标风险 |

### 34.2 早期评分草案如何汇入最终模型

此前讨论曾形成“开发活跃 22、实用价值 20、工程/安全 15、组织/维护者 15、社区/采用 12、趋势 10、创新 6”的概念性权重。那一版表达了正确优先级，但工程与安全混在一起，活跃与趋势也容易重复计算，合计口径不够适合直接实现。

最终版本没有删除这些关注点，而是做了如下归并和去重：

| 早期关注点 | 最终落点 | 调整原因 |
|---|---|---|
| 开发活跃 22 | Activity 18；加速度部分进入 Momentum 10 | 把持续建设与相对加速分开，防止同一提交重复计分 |
| 实用价值 20 | Utility 18 | 保持第一梯队权重，同时为独立 Security 留空间 |
| 工程/安全 15 | Engineering 14 + Security 10 | 正向工程成熟与安全风险语义不同，必须独立展示 |
| 组织/维护者 15 | Organization 15 | 原要求完整保留，并补衰减和新组织保护 |
| 社区/采用 12 | Adoption 10 | 从泛热度收紧为依赖、下载、活跃 Fork、外部案例等真实采用 |
| 趋势 10 | Momentum 10 | 原权重保留，Star 速度只占其中 30% |
| 创新 6 | Innovation 5 | 保留但避免主观创新压过可验证的实用和工程事实 |

最终八维总计 100：Utility 18、Activity 18、Organization 15、Engineering 14、Adoption 10、Security 10、Momentum 10、Innovation 5。该版本是实施唯一权威版本；早期数字保留在这里用于说明决策演进，不作为第二套并行公式。

### 34.3 仍需在实施前或影子期校准的参数

- 各语言/项目类型的 cohort 划分与最小样本量 k。
- 各特征 Winsorize 分位、半衰期和缺失先验。
- 新项目 180 天、普通榜 30 天等资格阈值是否需按类型调整。
- 风险扣分区间与漏洞合理修复窗口。
- 组织历史半衰期和小样本组织门槛。
- 首期正式支持哪些包注册表及其下载数据使用边界。
- 影子运行中各榜 Top 20 的人工评审量和风险复核值班责任。

这些是数据校准项，不是产品方向未决项。任何参数变化均通过 score_version/formula_version 发布，并保留回测对比。

### 34.4 公开发布前待定的运营选择

- 域名、视觉方案与“GitHub Picks”专项商标审查结果。
- GitHub App/专用凭据的组织归属、Token 轮换和配额预算。
- 生产区域、对象存储、模型供应商、备份和成本上限。
- 是否开放无需登录的公共 API 额度，以及滥用保护。
- Obsidian 社区插件发布主体、隐私政策和支持渠道。
- 风险纠错、项目方反馈和公开更正的责任人。

### 34.5 下一份文档

用户已确认本总规格完整，首轮实施被拆成两个可独立验收的计划：

1. `docs/superpowers/plans/2026-08-03-github-picks-m0-validation.md`：先连续七天验证八个现有产品，输出 `USE_EXISTING`、`THIN_INTEGRATION`、`BUILD` 或 `INSUFFICIENT_EVIDENCE`。
2. `docs/superpowers/plans/2026-08-03-github-picks-m1-evidence-foundation.md`：只有 M0 机器生成结果为 `BUILD` 才能执行，建设十三个信源、不可变证据、实体解析、调度、健康与回放。

M2 评分与反作弊、M3 中文分析和网站、M4 Obsidian、M5 Agent 继续按里程碑单独设计和验收，不与 M0/M1 混为一次开发。
