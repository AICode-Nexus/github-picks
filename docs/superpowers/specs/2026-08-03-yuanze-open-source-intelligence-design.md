# 源择：中文开源情报与决策系统设计规格

- 日期：2026-08-03
- 状态：已确认设计
- 产品主名称：源择
- 英文工作名：Yuanze
- 产品口号：让开源选择有据可依
- 当前边界：先完成信源、分析、榜单和网站，再接入 Obsidian，最后开放个性化 Agent；邮件等主动推送不在首期

## 1. 产品定义

源择不是“每日 Star 排行榜”，而是一套面向中文技术用户的开源情报与决策系统。

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

“源择”有两层含义：

- “源”代表开源、信源和可追溯来源。
- “择”代表选择、判断和决策。

“源择”与“原则”同音，能够承载本产品最重要的品牌承诺：不追逐虚高数字，用透明原则选择开源项目。

产品功能统一使用以下名称：

- 源择日报：每日中文情报总览。
- 源择榜：综合榜、新锐榜、稳健榜等榜单。
- 源择档案：仓库、组织和赛道的长期档案。
- 源择对比：同类项目横向比较。
- 源择观察：用户关注列表和变化提醒。
- 源择 Obsidian：个人知识库同步插件。
- 源择 Agent：后续个性化开源顾问。

英文技术标识暂用 Yuanze，域名、商标和社区插件名称在公开发布前进行专项核验，不在本规格中假定可用。

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

网站提供版本化 API 和标准 Markdown。Obsidian 笔记即使离开源择仍能完整阅读，用户批注永不被系统覆盖。

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
GitHub 开源情报/
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

系统属性统一使用 yuanze_ 前缀：

~~~yaml
---
yuanze_id: "github:repo:R_xxxxx"
yuanze_repo: "owner/repository"
yuanze_entity_type: "repository"
yuanze_value_score: 86.4
yuanze_momentum_score: 82
yuanze_activity_score: 91
yuanze_organization_score: 88
yuanze_risk_level: "low"
yuanze_confidence: 0.93
yuanze_categories:
  - "AI Agent"
  - "Developer Tools"
yuanze_analysis_version: "score-v1"
yuanze_source_updated_at: "2026-08-03T08:00:00+08:00"
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
<!-- yuanze:managed:start checksum="..." -->
系统生成内容
<!-- yuanze:managed:end -->

## 我的判断

用户内容，系统永不覆盖。
~~~

同步规则：

- yuanze_id 是实体身份，文件名不是身份。
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
- 命令面板快速搜索源择项目。
- 桌面和移动端使用相同核心逻辑。

### 13.8 隐私和安全

- 只读平台令牌通过 Obsidian SecretStorage 保存。
- 插件默认只操作用户指定的源择目录。
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

如果需求只是“每天看热门仓库”，直接使用现有网站更省成本；源择值得建设的前提是坚持完成以下差异：

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

- “源择/Yuanze”的商标、域名和社区插件名称专项核验。
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
- [GitHub GraphQL API rate limits](https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api)
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

- [OSS Insight](https://ossinsight.io/)
- [Trendshift](https://trendshift.io/)

这些链接用于能力与边界参考，不代表源择可以复制或再分发第三方数据。
