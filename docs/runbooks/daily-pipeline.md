# GitHub Picks 每日流水线运行手册

## 目标与边界

每日流水线负责候选发现、GitHub 事实补全、OpenSSF 补全、评分、中文分析和榜单生成。它不会发送邮件，也不包含网站、Obsidian 插件或个性化 Agent。

所有公开结论都应能回到 `report.json` 中的 evidence URL；原始响应只保存在本机 `artifacts/raw/`，不进入 Git。

## 环境

- Node.js：`24.15.x`
- pnpm：`11.18.0`
- 默认时区：`Asia/Shanghai`
- 可选凭据：`GITHUB_TOKEN`
- 可选本地模型：Ollama 与 `GITHUB_PICKS_AI_MODEL`

```bash
nvm use
pnpm install
```

不要把 Token 写入仓库、命令参数、日报或原始响应元数据。只通过当前进程环境变量传入。

## 两种运行模式

### 证据回放

回放模式不访问网络，适合本地验收、CI 和评分规则回归：

```bash
pnpm picks:daily --date 2026-08-03 --mode replay
```

默认使用 `workers/daily/test/fixtures/replay-manifest.json`，输出到 `artifacts/daily/2026-08-03/`。如需隔离验收产物：

```bash
pnpm picks:daily \
  --date 2026-08-03 \
  --mode replay \
  --replay-manifest workers/daily/test/fixtures/replay-manifest.json \
  --output /tmp/github-picks-replay
```

### 实时采集

匿名模式适合单次试跑：

```bash
pnpm picks:daily
```

持续运行或短时间重跑应使用 GitHub Token：

```bash
GITHUB_TOKEN="$(gh auth token)" pnpm picks:daily
```

也可明确日期和目录：

```bash
GITHUB_TOKEN="$(gh auth token)" pnpm picks:daily \
  --date 2026-08-04 \
  --mode live \
  --output artifacts/daily/2026-08-04
```

日期代表北京时间的日报归属日；`generatedAt` 使用带时区可转换的 ISO 时间记录真实采集时刻。

## AI 推荐理由

实时模式可在评分完成后调用 Ollama，为每个已补全项目生成中文推荐理由。模型只接收结构化公开事实包，不接收原始响应路径、内容哈希对象或凭据；推荐理由不参与分数与名次计算。

```bash
GITHUB_TOKEN="$(gh auth token)" \
GITHUB_PICKS_AI_PROVIDER=ollama \
GITHUB_PICKS_AI_BASE_URL=http://127.0.0.1:11434 \
GITHUB_PICKS_AI_MODEL=qwen3-vl:8b \
GITHUB_PICKS_AI_REQUIRED=true \
pnpm picks:daily
```

环境变量：

- `GITHUB_PICKS_AI_MODEL`：启用 AI 分析并指定本地模型；未设置时使用规则事实摘要；
- `GITHUB_PICKS_AI_REQUIRED=true`：任一模型调用或校验失败则整次运行失败，旧日报保持不变；
- `GITHUB_PICKS_AI_BASE_URL`：默认 `http://127.0.0.1:11434`；
- `GITHUB_PICKS_AI_CONCURRENCY`：默认 `1`，本地模型不建议盲目并发；
- `GITHUB_PICKS_AI_TIMEOUT_MS`：单项目默认 `120000` 毫秒。

每条新分析保存 `provider`、`model`、`promptVersion`、`analysisVersion`、`evidenceHash` 和 `generatedAt`。AI 推荐理由只回答核心价值、本期信号和适用对象；风险与下一步由独立规则区块展示。输出必须以仓库全名开头，并通过 JSON Schema、禁止夸大/逻辑越界表述与“新增数字必须存在于事实包”的校验。模型不可用且未启用 required 时，`sourceHealth` 会写入 `ai-analysis: degraded`，网站明确显示“规则事实摘要”；规则输出不会标为 AI。

回放模式始终不调用模型，保证离线可复现。

## 正式发布门禁

正式日报不直接生成到公开历史目录。先运行代码门禁，再把 live 结果写入任务专用暂存目录：

```bash
nvm use
TURBO_FORCE=true pnpm check

report_date="$(TZ=Asia/Shanghai date +%F)"
daily_stage_dir="$(mktemp -d)"
GITHUB_TOKEN="$(gh auth token)" \
GITHUB_PICKS_AI_PROVIDER=ollama \
GITHUB_PICKS_AI_BASE_URL=http://127.0.0.1:11434 \
GITHUB_PICKS_AI_MODEL=qwen3-vl:8b \
GITHUB_PICKS_AI_REQUIRED=true \
pnpm picks:daily --date "$report_date" --mode live --output "$daily_stage_dir"

pnpm picks:publish-check -- "$daily_stage_dir" "$report_date"
```

`picks:publish-check` 会确定性验证 live 模式、日期、真实网络发现源、GitHub REST 事实、五个方向榜、归档排除、证据完整性、降级说明、AI verified 状态、计数，以及 JSON、Markdown、manifest 三份产物的一致性。失败时不得把暂存结果复制到 `artifacts/daily/`。

候选产物通过后，只提升三份公开文件，再重复验证并构建网站：

```bash
mkdir -p "artifacts/daily/$report_date"
cp "$daily_stage_dir/report.json" "artifacts/daily/$report_date/report.json"
cp "$daily_stage_dir/report.md" "artifacts/daily/$report_date/report.md"
cp "$daily_stage_dir/manifest.json" "artifacts/daily/$report_date/manifest.json"

pnpm picks:publish-check -- "artifacts/daily/$report_date" "$report_date"
pnpm --filter @github-picks/web build
git diff --check
```

提交时只暂存当天的 `report.json`、`report.md` 和 `manifest.json`。提交进入 `master` 后，现有 Pages 工作流负责再次运行仓库门禁、构建静态网站和部署。

## 每日三次自动运行

当前维护实例使用一个附着于 GitHub Picks 任务的本地 Codex heartbeat，在北京时间每天 `10:00`、`14:00`、`20:00` 执行正式发布链路。自动任务运行在独立 Git worktree 中；开始前要求工作区干净、`origin/master` 可快进同步、GitHub CLI 已认证、Ollama 可访问且存在 `qwen3-vl:8b`。

自动运行遵循以下失败边界：

- 本机休眠、Codex 未运行、网络不可用或模型不可用时，本档失败，不补造历史快照；
- 采集、发布门禁、测试或网站构建任一步失败时，不提交、不推送；
- 远端 `master` 在运行期间前进且无法快进时停止，不 rebase、不强推；
- 推送成功后等待对应 Pages Actions 运行，并把 Actions 成功与页面实际可访问性分开报告。

## 当前执行信源

| 信源 | 用途 | 独立性处理 | 失败行为 |
|---|---|---|---|
| 配置候选 | 五方向兜底发现 | 与 GitHub 同组；无 rank、速度或独立加分 | 配置校验失败则终止 |
| GitHub Trending | 发现 | 与 GitHub 同组 | 标记降级，继续 |
| GitHub Search | 五方向搜索发现 | 与 GitHub 同组 | 标记降级，继续 |
| GitTrend | 趋势发现、Star 速度 | 与 GitHub 同组 | 标记降级，继续 |
| HubLens | 发现、中文摘要 | 独立聚合组；超过 48 小时不算新鲜 | 全部过期时标记降级 |
| Hacker News Algolia | 独立社区讨论 | 独立社区组 | 标记降级，继续 |
| AI Hot | AI 资讯中的仓库发现、交叉验证 | 已知 Hacker News/GitHub 路径复用原来源组，其余统一为聚合组；无 rank 或指标加分 | 超时、限流、Schema 异常或无可解析仓库时降级 |
| GitHub REST | 仓库事实、近期事件 | GitHub 事实组 | 单仓库失败跳过；全部失败则终止 |
| OpenSSF Scorecard | 安全工程事实 | OpenSSF 独立组 | 单仓库缺失用中性先验 |
| AI 推荐理由 | 只读消费结构化事实包 | 不参与评分或信源独立性 | 失败则规则降级；required 模式终止发布 |

`config/picks.yaml` 还注册了 OSV、deps.dev、npm、PyPI 和 crates.io，供后续版本接入；`v0.1.0` 的执行流水线尚未调用它们，不能把“已注册”表述成“已采集”。

## 请求、额度与礼貌采集

- HTTP User-Agent 固定为 `github-picks/0.1 (+https://github.com/AICode-Nexus/github-picks)`。
- 单次请求超时 15 秒。
- 对 `429`、`500`、`502`、`503`、`504` 最多再尝试两次，并使用有上限的退避。
- AI Hot 请求按完整 URL 保存 ETag，下次发送 `If-None-Match`；收到 `304` 时复用此前已保存的原始字节和对象引用，不重复写 raw 对象。
- AI Hot 首次请求固定为过去 24 小时、时间顺序和 `GitHub` 查询；后续只跟随服务端返回的不透明 cursor，不解析或自行构造 cursor。服务端返回 `invalid_cursor` 时清除本次链路的条件缓存并最多从第一页重启一次。
- AI Hot 的 `429` 优先遵守 `Retry-After`；响应未提供该字段时等待 60 秒后重试，避免密集请求匿名公共服务。
- 单一发现源失败不会阻断其他信源。
- GitHub Search 和 GitHub REST 使用不同额度池；实际额度应以响应头和 [GitHub Rate Limit 文档](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) 为准。
- 当前一次完整运行最多补全 20 个候选，每个候选至少需要仓库详情和事件两次 GitHub REST 请求。匿名运行后不要立即重复执行。
- 当 GitHub REST 额度不足时，不要伪造事实或沿用旧值为今日结果；等待额度恢复或使用合规 Token 重跑。

## 原始快照和可追溯性

网络响应按内容 SHA-256 存放：

```text
artifacts/raw/<sourceId>/<sha256>.bin
artifacts/raw/<sourceId>/<sha256>.json
```

`.bin` 是原始响应字节，`.json` 记录来源、URL、采集时间和内容类型。相同字节复用同一对象，文件采用 exclusive create，不覆盖既有快照。`artifacts/raw/` 默认被 Git 忽略；公开仓库只提交日报及其中的公开证据链接。

AI Hot 的条件请求索引保存在 `artifacts/raw/.http-cache/<sourceId>/`。索引仅记录完整 URL、ETag、内容类型和既有 raw 对象引用，不复制响应正文；索引损坏或正文缺失会自动按缓存未命中处理。该目录与全部原始响应一样只保留在本机、不会进入 Git。

日报目录包含：

- `report.json`：网站、Obsidian 和 Agent 后续使用的结构化契约；
- `report.md`：中文可读榜单与逐项目分析；
- `manifest.json`：配置哈希、计数、信源健康、仓库清单和原始对象引用。

## 降级语义

- `healthy`：当前运行获得了可用且新鲜的数据；
- `degraded`：超时、解析失败、没有候选、全部候选过期或部分补全缺失；
- `offline`：事实补全整体不可用等无法提供服务的状态。

缺失、负面事实和信源故障分开处理：

- OpenSSF 没有某仓库结果：安全维度采用 50 分中性先验，并降低置信度，不直接判为有漏洞；
- GitHub 未返回明确许可证：记录 6 分风险扣分；
- 仓库已归档：从公开榜单中排除；
- HubLens 超过 48 小时：可帮助发现候选，但不参与新鲜趋势信号；
- AI Hot：只把 `links.original` 严格映射为 GitHub 仓库首页的条目作为候选；条目热度、时间顺序和媒体内容不参与仓库评分；
- 配置候选：只保证方向覆盖，不提供名次、速度或独立信源加分。

## 原子写入、重跑与恢复

`report.json`、`report.md` 和 `manifest.json` 都先写同目录临时文件，再原子 rename。运行中断时，已有完整日报不会变成半个文件。

同一目录重跑的行为：

- 回放模式使用固定证据和固定观测时间，结果可重复验证；
- 实时模式会原子替换三份结果，因为上游数据和采集时刻可能变化；
- 原始内容对象按 SHA-256 复用，不重复覆盖；
- 若要保留多次实时观测，应使用不同输出目录，而不是依赖文件历史。

进程异常退出后，先确认三份正式文件能否解析，再检查同目录是否存在 `*.tmp` 孤儿文件。只清理已核验的具体临时文件，然后重跑；不要删除整个 `artifacts/` 或原始证据目录。

## 验收

```bash
pnpm format
TURBO_FORCE=true pnpm check
pnpm picks:daily --date 2026-08-03 --mode replay --output /tmp/github-picks-acceptance
git diff --check
```

实时验收至少检查：

1. `mode` 必须是 `live`；
2. 至少两个网络发现源为健康；
3. 五个方向榜均有候选；
4. 综合榜不含 `archived: true` 仓库；
5. 每个发布项目至少有 GitHub REST 证据；
6. 信源缺失必须出现在 `sourceHealth` 或项目 `missingFields` 中；
7. 中文分析不得把中性先验写成已验证事实。
8. 正式 AI 发布时 `ai-analysis` 必须为 `healthy`，且所有公开项目的 `generation.kind` 为 `ai`、`status` 为 `verified`。
