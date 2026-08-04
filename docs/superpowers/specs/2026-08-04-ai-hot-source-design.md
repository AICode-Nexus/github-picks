# GitHub Picks AI Hot 信源接入设计规格

日期：2026-08-04

状态：设计已确认，待实施计划

上游契约：AI HOT Public API v1、`DailyReport v0.1.0`

## 1. 背景

GitHub Picks 当前以 GitHub 仓库为唯一核心实体，通过 GitHub Trending、GitHub Search、GitTrend、HubLens、Hacker News 和方向种子发现候选，再使用 GitHub REST 与 OpenSSF Scorecard 补全事实、评分并生成中文日报。

AI Hot 聚合 X、微信公众号、RSS、官方博客、Hugging Face Daily Papers、Hacker News 等 AI 资讯来源，并通过匿名只读 API 提供中文标题、摘要、来源、时间、分数和原始链接。它能够补充“刚被讨论但还没有进入通用仓库榜单”的项目，但其数据实体是资讯条目，不是 GitHub 仓库。

本设计将 AI Hot 接成一个保守的候选发现源，不把 GitHub Picks 扩展为通用 AI 新闻站，也不把资讯热度直接等同于仓库价值。

官方边界：

- 最近资讯接口：<https://aihot.virxact.com/api/v1/items>
- OpenAPI：<https://aihot.virxact.com/openapi-v1.json>
- 公开接入条款：<https://aihot.virxact.com/terms>

## 2. 目标

1. 在每日流水线中新增 AI Hot 候选发现适配器。
2. 只把能够确定映射为 `owner/repo` 的资讯条目送入 GitHub 仓库候选池。
3. 保存 AI Hot 与其上游来源的双层溯源信息。
4. 借助现有独立来源组模型避免重复来源抬高置信度。
5. 遵守 AI Hot 的匿名访问、条件请求、缓存、重试和公开归因要求。
6. 保持现有评分、日报和历史网站向后兼容。

## 3. 非目标

- 不在本期增加普通 AI 新闻列表、热点榜、日报或资讯详情页。
- 不解析媒体正文、X 帖子、公众号文章或论文正文来猜测仓库。
- 不通过标题相似度、搜索结果第一名或 AI 推断把项目名称强行映射为仓库。
- 不同步 AI Hot 的完整精选快照，也不维护其 selected changes 镜像。
- 不把 AI Hot 的 `score`、时间顺序或 `selected` 状态转换为 GitHub Picks 榜单分数。
- 不在本期直接批量抓取 AI Hot 覆盖的全部上游来源。
- 不公开镜像或批量再分发 AI Hot 数据。

## 4. 方案比较

### 方案 A：24 小时全量窗口适配器（采用）

通过 `/api/v1/items` 查询过去 24 小时全部公开动态，并使用服务端关键词 `GitHub` 收窄结果。只接受 `links.original` 能严格规范化为 GitHub 仓库首页的条目。

优点是及时覆盖尚未进入精选池的新项目，实体映射可以由 URL 确定，接入范围与每日候选需求一致。代价是必须自行执行严格过滤、同仓库合并和来源组归一化。

### 方案 B：仅接精选池

使用 `mode=selected` 可以降低噪声，但会漏掉刚出现、尚未进入精选的开源项目，不符合新增发现源的主要目的。

### 方案 C：完整精选同步或复制上游信源

使用 selected snapshot/changes 或直接建立数百个上游采集器可以获得最大覆盖，但它们面向持久镜像和通用资讯聚合，显著超出 GitHub Picks 日报的实体边界，也会增加授权、去重、状态恢复和维护成本。

采用方案 A。上游来源只先作为溯源和后续信源评估样本；达到稳定命中率并完成独立验证后，再通过单独设计接为直接适配器。

## 5. 上游请求契约

首个请求固定为：

```text
GET https://aihot.virxact.com/api/v1/items
  ?mode=all
  &window=24h
  &by=timeline
  &q=GitHub
  &limit=100
```

约束如下：

- 使用 `mode=all`，因为用户明确选择 `/all` 能力，且发现阶段需要覆盖未入精选的项目。
- 使用 `window=24h`，与每日流水线窗口一致。
- 使用 `by=timeline`，保持与 AI Hot 网页一致的慢推信源和历史回填语义。
- 使用服务端 `q=GitHub`，不先下载大列表再用本地关键词模拟查询。
- `limit=100` 减少分页次数；`page.hasMore=true` 时原样回传不透明 `nextCursor`。
- 顺序是时间轴倒序，不是排行榜；不得把数组位置写入候选 `rank`。
- 分页在没有下一页或已获得 `config.limits.candidateLimit` 个唯一、可解析仓库时停止。
- 客户端忽略未来新增字段；缺少当前契约要求的字段时将本次 AI Hot 采集降级。

## 6. 组件与边界

### 6.1 `AiHotAdapter`

在 `workers/daily/src/sources/ai-hot.ts` 增加独立适配器，职责仅包括：

1. 构造官方 v1 请求并顺序处理分页。
2. 校验响应外层与条目必需字段。
3. 严格识别 GitHub 仓库实体。
4. 合并同一仓库的重复 AI Hot 条目。
5. 生成符合核心 Schema 的候选信号。

适配器不读取网站页面、不抓第三方正文、不调用 GitHub Search 做模糊实体匹配，也不计算最终方向或仓库分数。

### 6.2 条件响应缓存

现有 `RawStore` 继续保存不可变、内容寻址的原始响应。另增加一个小型文件缓存索引，按 `sourceId + 完整 URL` 保存：

- 上次响应的 `ETag`；
- 对应原始对象引用；
- 内容类型；
- 最近成功观测时间。

缓存索引写入 `artifacts/raw/` 范围并原子替换，不进入公开日报或 Git 提交。`requestArtifact` 通过可选条件缓存能力发送 `If-None-Match`；未启用该能力的现有适配器行为不变。

收到 `304` 时从原始对象读取上次响应继续解析，不能把空响应当成零条目。若索引或原始对象缺失，清理该 URL 的损坏索引并无条件重试一次。

### 6.3 核心数据契约

`CandidateSignal` 增加一个可选的严格溯源对象，旧历史报告没有该字段时仍可通过 Schema：

```ts
provenance?: {
  aggregatorItemId: string;
  aggregatorUrl: string;
  originalUrl: string;
  upstreamSourceName: string;
  selected: boolean;
  publishedAt: string | null;
  discoveredAt: string;
}
```

该结构保持通用命名，避免核心包硬编码某一家聚合器。AI Hot 原始响应中的全部字段仍保存在内容寻址快照中，日报只携带被选为代表条目的必要溯源字段。

## 7. 实体映射与同源合并

### 7.1 严格仓库识别

只把 `links.original` 传给现有 `normalizeRepositoryId`。有效形式必须是：

```text
https://github.com/<owner>/<repo>
```

允许结尾 `.git` 或 `/`，并统一转为小写 `owner/repo`。以下内容全部拒绝：

- 非 `github.com` 域名；
- GitHub Issue、PR、Release、Tree、Blob、Discussion 或用户主页；
- 多余路径段；
- 仅在标题或摘要中出现项目名称但没有仓库链接；
- 缺少或格式错误的原始链接。

GitHub REST 补全阶段仍负责确认仓库真实存在；映射成功不等于质量通过。

### 7.2 AI Hot 内部去重

同一 API 运行中，同一 `owner/repo` 只生成一个 `ai-hot` 候选信号，避免转载或多次讨论堆叠候选权重。代表条目按以下稳定顺序选择：

1. `selected=true` 优先；
2. 非空且更高的 AI Hot `score` 优先；
3. 时间轴时间更新者优先；
4. `id` 字典序作为最终稳定决胜条件。

AI Hot `score` 只用于同源代表条目选择，写入 `sourceScore` 便于审计，但不进入 `signalQuality`、八维评分、风险扣分或榜单名次。

## 8. 多信源独立性

新增配置：

```yaml
- sourceId: ai-hot
  name: AI HOT
  tier: C
  purpose: [discovery, cross_validation]
  independenceGroup: ai-hot-aggregator
  evidenceUrl: https://aihot.virxact.com/all
```

默认按 C 级聚合发现源处理，因为中文摘要和条目分数属于聚合加工结果，不能替代仓库事实。

为避免把同一社区传播路径重复计数，AI Hot 条目的来源组按保守规则归一化：

- `source.name` 明确为 Hacker News 派生来源时使用现有 `hacker-news-community`；
- 明确为 GitHub 自身数据入口时使用现有 `github-public-data`；
- 其他上游来源统一使用 `ai-hot-aggregator`，本期不为每个媒体或账号创建新的独立组。

因此，同一项目同时被现有 Hacker News 适配器和 AI Hot 的 Hacker News 条目发现时，信号可以同时保留用于溯源，但置信度只增加一个独立来源组。

## 9. 候选与评分语义

AI Hot 候选信号固定遵循：

- `sourceId: ai-hot`；
- `sourceTier: C`；
- `evidenceUrl: links.aihot`；
- `summaryZh: summary ?? null`；
- `rank: null`；
- `metrics.starVelocity: null`；
- `metrics.trendingScore: null`；
- `metrics.discussionPoints: null`；
- `metrics.discussionComments: null`；
- `stale: false`，因为条目来自 24 小时时间轴窗口；
- `direction: null`，继续使用现有仓库名与中文摘要方向推断，再由 GitHub 事实补全确认。

AI Hot 可以让一个项目进入待补全候选池，也可以通过一个真实独立来源组提高证据覆盖；它不能直接增加 Star 动量、讨论热度、工程质量、安全结论或风险分。

## 10. 错误、重试与健康状态

- 网络超时和 `5xx`：沿用最多两次指数退避，仍失败则抛出适配器错误。
- `429`：遵守 `Retry-After` 并串行重试，不增加并发；仍失败则降级。
- `400`：视为请求契约错误，不自动放宽查询。
- `invalid_cursor`：清理本次分页链，从第一页无条件重启一次；再次失败则降级，不能把新第一页静默拼到旧结果。
- 未知 Problem code：按 HTTP 状态保守处理，原始错误响应仍写入快照。
- `304`：复用对应 URL 的缓存对象，不生成空候选结果。
- 外层结构错误或必需字段类型错误：AI Hot 标记降级，不用宽松强制转换掩盖上游变化。
- API 成功但没有可解析仓库：使用现有健康规则标记降级并显示“未发现可解析仓库”。
- AI Hot 单源失败：其他发现源继续工作。
- 全部发现源均不健康：继续使用现有规则终止流水线，不发布伪造日报。

错误信息进入 `SourceHealth` 时只暴露稳定错误类型，不把第三方返回的任意正文直接显示到公开网站。

## 11. 网站与归因

网站信源元数据增加 `ai-hot: AI HOT`。信源状态页展示当次采集状态，并在可正常发现的位置增加：

```text
数据来源：AI HOT
```

文字链接到 <https://aihot.virxact.com/>。候选证据链接使用 `links.aihot`，让用户先看到 AI Hot 的中文条目与归因；溯源对象继续保留 `links.original`。

网站不复制 AI Hot 的全部资讯流，不展示第三方全文或图片，也不将 GitHub Picks 描述为 AI Hot 的官方合作产品。

## 12. 上游来源纳入策略

本期把 `source.name` 纳入溯源数据，从真实日报中观察不同上游来源的：

- 可解析 GitHub 仓库数量；
- 与现有信源的重复率；
- 进入补全与最终发布榜单的转化；
- 新鲜度和失败情况。

这些数据只用于判断后续是否值得建立直接适配器。直接纳入某个官方博客、RSS、Hugging Face 或社区来源前，必须单独验证其公开接口、稳定性、许可、实体映射和独立来源组；不得从 AI Hot 页面反向复制私有信源配置。

## 13. 测试设计

### 13.1 解析与实体测试

- 解析一条直接链接 GitHub 仓库的完整条目。
- 拒绝文章、X、公众号、ArXiv 和非 GitHub URL。
- 拒绝 GitHub Issue、PR、Tree、Blob、Release 和用户主页。
- 允许可空的 `summary`、`publishedAt`、`category` 和 `score`。
- 忽略未来新增的未知字段。
- 必需字段缺失或类型错误时明确失败。

### 13.2 去重与来源组测试

- 同仓库多条 AI Hot 记录只生成一个信号。
- 精选状态、分数、时间和 ID 决胜顺序稳定。
- Hacker News 派生条目复用 `hacker-news-community`。
- 其他未知上游来源统一进入 `ai-hot-aggregator`。
- AI Hot 时间顺序不会生成候选 `rank`。
- AI Hot 分数变化不会改变八维评分和榜单分数。

### 13.3 HTTP 与缓存测试

- 首次 `200` 保存原始对象、ETag 和缓存索引。
- 后续请求发送 `If-None-Match`。
- `304` 复用旧响应并产生相同信号。
- 缓存索引损坏时只无条件恢复一次。
- 正常分页原样回传 cursor。
- `invalid_cursor` 从第一页重启一次，不混接两轮结果。
- 限流、超时、`5xx` 和 Problem JSON 按约定降级。

### 13.4 流水线与网站测试

- AI Hot 加入实时适配器列表和 `sourceHealth`。
- AI Hot 失败时其余健康来源仍可生成日报。
- 回放夹具包含 AI Hot 信号与溯源字段，旧回放夹具仍能解析。
- manifest 收集 AI Hot 原始对象引用。
- 信源页显示 AI Hot 中文名称、状态和产品级归因链接。
- 历史日报没有 `provenance` 时网站构建保持成功。

## 14. 验收标准

1. 官方 AI Hot API 实时冒烟请求成功，且请求无需 Key、cookie 或用户数据。
2. 实时日报的 `sourceHealth` 包含 `ai-hot`，成功、无映射结果和失败三种情况均有真实状态。
3. 至少一个合法 AI Hot GitHub 仓库夹具进入候选并完成 GitHub REST 实体确认。
4. 非仓库资讯不会进入补全队列。
5. AI Hot 不能伪造名次、Star 速度、讨论数据或工程事实。
6. 与 Hacker News 等已有来源重叠时不会重复增加独立来源置信度。
7. `ETag/304`、分页和缓存恢复有自动化回归证明。
8. 信源页可发现“数据来源：AI HOT”链接。
9. `pnpm format`、`TURBO_FORCE=true pnpm check`、生产构建、离线回放和实时运行全部通过。
10. 实时报告、manifest、README 和每日流水线运行手册同步反映新增信源。

## 15. 预计改动边界

```text
config/picks.yaml
packages/picks-core/src/schema.ts
packages/picks-core/test/
workers/daily/src/http.ts
workers/daily/src/raw-store.ts
workers/daily/src/discovery.ts
workers/daily/src/pipeline.ts
workers/daily/src/sources/ai-hot.ts
workers/daily/test/
apps/web/src/lib/site-meta.ts
apps/web/src/app/sources/page.tsx
apps/web/test/
README.md
docs/runbooks/daily-pipeline.md
```

实现应保持改动聚焦于 AI Hot 接入所需边界。上游来源的直接适配器、通用新闻页面、推送和个性化 Agent 留在后续独立里程碑。
