# GitHub Picks Agent 与公开 API 运行手册

## 发布边界

GitHub Picks 在网站静态构建结束后生成匿名只读的 `/api/v1/*.json`，再与页面一起发布到 GitHub Pages。API、网站和 Agent 读取同一批已提交、通过共享 Schema 校验的 live `DailyReport`；它们不会重新采集或重新评分。

以下内容不会发布：

- `mode: "replay"` 的报告；
- `artifacts/raw/` 原始响应；
- `rawObjectRef` 等内部快照引用；
- Token、Cookie、私有仓库、本机路径或用户数据。

Agent 只做公开榜单的保序筛选，不保存个人画像，也不向 API 写入任何内容。定时推送、消息订阅和 Obsidian 同步不属于当前静态 API。

## 本地生成

要求 Node.js `24.15.x` 和 pnpm `11.18.0`。生产等价构建命令为：

```bash
GITHUB_PICKS_PUBLIC_BASE_URL=https://aicode-nexus.github.io/github-picks \
NEXT_PUBLIC_BASE_PATH=/github-picks \
pnpm --filter @github-picks/web build
```

Next.js 静态导出完成后，`postbuild` 自动运行 API 生成器。也可以在已有 `apps/web/out/` 上单独重建 API：

```bash
GITHUB_PICKS_PUBLIC_BASE_URL=https://aicode-nexus.github.io/github-picks \
pnpm --filter @github-picks/web api:generate
```

生成器先构造并验证全部文档，再用同一输出根下的临时目录替换 `apps/web/out/api/v1`。失败时不会保留半份新 API。

## 端点

生产基址：`https://aicode-nexus.github.io/github-picks/api/v1`

```text
/meta.json
/reports/index.json
/reports/latest.json
/reports/YYYY-MM-DD.json
/rankings/7d.json
/rankings/30d.json
/rankings/90d.json
/rankings/180d.json
/directions/ai-agent.json
/directions/data-ml.json
/directions/app-platform.json
/directions/infra-devtools.json
/directions/security-supply-chain.json
/repositories/{owner}/{repo}.json
```

每份文档都有 `schemaVersion`、`generatedAt`、`data`、`links` 和 `attribution`。当前 `schemaVersion` 固定为 `1`。v1 可以增加字段，客户端应忽略未知字段；版本不为 `1` 时应停止解析，不能猜测字段映射。数组顺序属于契约，客户端不得按 Star 或模型判断重新排序。周期、方向和仓库详情同时携带对应日报的 `sourceHealth` 摘要，Agent 必须把降级、离线和证据覆盖限制告诉用户。

日报索引和周期榜只消费 live 报告。同一天有多次实时运行时，使用 `generatedAt` 最新的一份。周期覆盖不足时，`reportCount` 和 `missingDayCount` 必须原样披露，缺失日不能补零。

## 本地 HTTP 冒烟

在一个终端启动静态服务器：

```bash
python3 -m http.server 3101 --bind 127.0.0.1 --directory apps/web/out
```

在另一个终端验证实际 HTTP 行为：

```bash
curl --fail --silent --show-error http://127.0.0.1:3101/api/v1/meta.json | jq '.schemaVersion, .data.latestReportDate'
curl --fail --silent --show-error http://127.0.0.1:3101/api/v1/reports/latest.json | jq '.data.report.date'
curl --fail --silent --show-error http://127.0.0.1:3101/api/v1/rankings/30d.json | jq '.data.ranking.reportCount, .data.ranking.missingDayCount'
curl --fail --silent --show-error http://127.0.0.1:3101/api/v1/directions/security-supply-chain.json | jq '.data.items | length'
curl --fail --silent --show-error http://127.0.0.1:3101/api/v1/repositories/microsoft/agent-governance-toolkit.json | jq '.data.latestReportDate'
curl --silent --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3101/api/v1/reports/2099-01-01.json
```

前五个请求应返回有效 JSON，最后一个应返回 `404`。指定日期缺失时，Agent 只补查一次 `/reports/index.json`，不会用另一日报冒充结果。

## Skill 验证与安装

Skill 源码位于 `.agents/skills/github-picks/`。提交前运行：

```bash
skill_creator_dir=/path/to/skill-creator
uv run --with pyyaml python "$skill_creator_dir/scripts/quick_validate.py" \
  .agents/skills/github-picks
pnpm --filter @github-picks/web test -- agent-skill.test.ts
```

项目级安装命令：

```bash
DISABLE_TELEMETRY=1 npx -y skills@1.5.21 add AICode-Nexus/github-picks \
  --skill github-picks --agent codex --yes --copy
```

安装器应只复制 `SKILL.md`、`agents/openai.yaml`、`references/` 和 `evals/` 中的公开文件。安装前仍应审阅 Skill，因为 Agent Skill 在宿主 Agent 的权限范围内运行。

如需生成可分发包，输出到单独临时目录并检查归档，不把包提交到仓库：

```bash
package_dir="$(mktemp -d /tmp/github-picks-skill.XXXXXX)"
(cd "$skill_creator_dir" && uv run --with pyyaml python -m scripts.package_skill \
  "/path/to/github-picks/.agents/skills/github-picks" "$package_dir")
```

上面的打包命令应从包含 Skill Creator `scripts/` 的目录执行。检查完成后只删除本次创建的精确临时目录。

## Pages 发布验证

`.github/workflows/pages.yml` 固定 `NEXT_PUBLIC_BASE_PATH` 和 `GITHUB_PICKS_PUBLIC_BASE_URL`。上传前门禁会解析 meta、日报索引、latest、四个周期榜、五个方向榜、latest 对应日期日报和至少一个仓库详情；任一文件缺失、JSON 损坏、版本错误或跨文档日期不一致都会停止部署。

代码进入 `master` 后检查对应工作流：

```bash
gh run list --workflow pages.yml --branch master --limit 5
gh run view RUN_ID
```

部署成功后至少检查：

```bash
curl --fail --silent --show-error https://aicode-nexus.github.io/github-picks/api/v1/meta.json | jq '.schemaVersion'
curl --fail --silent --show-error https://aicode-nexus.github.io/github-picks/api/v1/reports/latest.json | jq '.data.report.date'
curl --fail --silent --show-error https://aicode-nexus.github.io/github-picks/api/v1/rankings/30d.json | jq '.data.ranking.reportCount'
curl --fail --silent --show-error https://aicode-nexus.github.io/github-picks/api/v1/directions/security-supply-chain.json | jq '.data.items | length'
```

还要验证一个仓库详情为 `200`，不存在的日期为 `404`，且 API 和网站显示相同最新日期。

## 失败恢复

- 没有 live 报告：先完成正式采集与发布检查；不要把 replay 改名发布。
- Public base URL 无效：只允许 HTTPS；本地生成链接时例外允许 `http://localhost`。静态服务器仍可绑定 `127.0.0.1`。不得包含凭据、查询串或片段。
- 生成中断：修复报告 Schema、路径或序列化错误后重新构建；不要手工补单个 JSON。
- Pages 门禁失败：按日志中的精确路径复现本地构建，修复后重新推送或重跑工作流。
- 公网返回旧日期：先核对对应 `master` 提交的 Pages run，再比较 meta、latest 和报告索引；不要在 Agent 中猜测缓存内容。
- API `schemaVersion` 升级：先新增客户端兼容方案和回归测试，再发布新版本路径；不要原地改变 v1 的既有字段语义。
