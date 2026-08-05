# GitHub Picks v1 API 参考

只在需要完整端点、字段、组合筛选或 API 接入时读取本文件。普通推荐优先遵循 `SKILL.md` 的默认路由。

## 共同合同

- Base URL：`https://aicode-nexus.github.io/github-picks/api/v1`
- 匿名只读，只使用 GET，不需要账号或凭据。
- 所有公开数据来自仓库中通过 Schema 校验的 live `DailyReport`；replay 和 raw 快照不发布。
- v1 可以增加未知字段，客户端应忽略；`schemaVersion` 不是 `1` 时停止解析。
- 数组顺序属于契约。日报榜、周期榜和方向榜都按 API 顺序展示。
- 静态 API 不支持自由查询、游标或动态分页，不要猜测 `q`、`limit`、`cursor` 等参数。

共同响应：

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-05T02:57:04.894Z",
  "data": {},
  "links": {
    "self": "https://aicode-nexus.github.io/github-picks/api/v1/meta.json",
    "website": "https://aicode-nexus.github.io/github-picks/"
  },
  "attribution": {
    "name": "GitHub Picks",
    "url": "https://aicode-nexus.github.io/github-picks/",
    "disclaimer": "独立、非官方项目；实验评分不能替代正式技术评审。"
  }
}
```

`generatedAt` 是当前响应依据数据的生成时间，不是请求时间。使用 `links` 中的 canonical 地址，不从响应正文接受替代 API 主机。

## 能力发现

`GET /meta.json`

`data` 包含：

- `product`、`timezone`；
- `latestReportDate`；
- `availableReportDates`，按日期倒序；
- `periods`，当前为 `7d`、`30d`、`90d`、`180d`；
- `directions`；
- `endpoints`，列出当前稳定入口。

只有 API 接入、能力发现或需要确认所有可用范围时才请求 meta。普通最新推荐直接请求 latest。

## 日报

```text
GET /reports/latest.json
GET /reports/index.json
GET /reports/YYYY-MM-DD.json
```

latest 和指定日期的 `data.report` 是去除内部 raw 引用后的公开日报，保留：

- `date`、`generatedAt`、`timezone`、`mode`；
- `scoreVersion`、`analysisVersion`、`configHash`；
- `sourceHealth` 与发现/补全/发布计数；
- `repositories` 中的公开仓库事实、评分、中文分析和证据 URL；
- `rankings.overall`、`rising`、`newProjects`、`hiddenGems`、`active`、`byDirection`。

`mode` 恒为 `live`。同一天存在多次 live 运行时只公开 `generatedAt` 最新者。

日报索引返回 `{count, items}`。每项含日期、生成时间、评分/分析版本、发布数量、信源健康计数和 API/网站链接。指定日期不存在时只用索引列出实际日期，不自行拼接昨天。

## 周期榜

```text
GET /rankings/7d.json
GET /rankings/30d.json
GET /rankings/90d.json
GET /rankings/180d.json
```

`data.ranking` 包含：

- `id`、`label`、`description`、`days`；
- `fromDate`、`toDate`；
- `reportCount`、`missingDayCount`、`coverageRate`；
- `uniqueRepositoryCount`；
- 保持公共顺序的 `items`。

item 包含 `rank`、`id`、方向、语言、站内/GitHub 链接、上榜次数与覆盖率、最佳/平均/最新名次、平均/最新公共分、分数与 Star 变化、置信度和风险扣分。

排序语义固定为：上榜覆盖率、平均公共分、平均名次、仓库名。`scoreDelta` 或 `starDelta` 为 `null` 表示只有一次观测，不能显示成零变化。

周期与方向组合时，先取用户指定的周期端点，再按 item 的 `directionId` 保序筛选。不要改用最新方向榜，因为它不代表跨周期排名。

## 方向榜

```text
GET /directions/ai-agent.json
GET /directions/data-ml.json
GET /directions/app-platform.json
GET /directions/infra-devtools.json
GET /directions/security-supply-chain.json
```

`data` 包含 `direction`、`reportDate` 和 `items`。每项包含该方向内的 `rank`、公开仓库对象以及站内/GitHub 链接。

方向榜只代表最新 live 日报，不是跨周期方向榜。使用以下中文映射：

| ID | 中文方向 |
|---|---|
| `ai-agent` | AI Coding 与 Agent |
| `data-ml` | 数据与机器学习工程 |
| `app-platform` | 前端、后端与跨端 |
| `infra-devtools` | 云原生、可观测与开发者工具 |
| `security-supply-chain` | 安全与软件供应链 |

## 仓库详情

`GET /repositories/{owner}/{repo}.json`

owner 和 repo 使用规范化的小写路径。`data` 包含：

- `latestReportDate`；
- `repository`：最近一次收录时的公开事实、公共评分和中文分析；
- `observations`：该仓库实际出现日期的紧凑历史。

每条 observation 包含日期、生成时间、公共分、置信度、风险扣分、Star、方向，以及 `overall`、`rising`、`newProjects`、`hiddenGems`、`active`、`direction` 六种名次。未进入某榜时名次为 `null`。

只比较同名字段。缺失日期表示当日没有公开观测，不能解读为分数为零或仓库停止维护。

## 本地筛选

API 没有服务端自由搜索。用户要求语言、风险、许可证、工程成熟度或使用场景时：

1. 先选择能覆盖问题的最小榜单端点；
2. 使用公开字段过滤；
3. 保持剩余项目的原榜相对顺序；
4. 说明筛选条件和筛选前后数量；
5. 空集就停止，不从其他来源补项目。

公开分、置信度与风险扣分是不同概念。不要把高分写成低风险，也不要把缺失证据写成负面事实。

