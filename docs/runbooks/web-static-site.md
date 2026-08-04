# GitHub Picks 静态网站运行手册

## 目标与发布边界

`apps/web` 把仓库中已提交的 `DailyReport` 转成中文开源情报网站，包括今日综合榜、五个技术方向、仓库分析页和本期信源状态。网站只读、静态导出，不在浏览器里重新采集、评分或调用 GitHub API。

当前 Project Pages 目标地址为 <https://aicode-nexus.github.io/github-picks/>。功能分支只验证构建；只有代码进入 `master` 后，`.github/workflows/pages.yml` 才会部署正式站点。

## 本地开发

要求 Node.js `24.15.x` 和 pnpm `11.18.0`：

```bash
nvm use
pnpm install
pnpm --filter @github-picks/web dev
```

默认地址为 <http://localhost:3000/>。本地开发不设置 `NEXT_PUBLIC_BASE_PATH`，所有路由从 `/` 开始。

生产静态导出：

```bash
pnpm --filter @github-picks/web build
```

产物写入 `apps/web/out/`。可在仓库根目录临时检查实际静态文件：

```bash
python3 -m http.server 3101 --bind 127.0.0.1 --directory apps/web/out
```

## 日报选择规则

构建时，`report-store` 读取 `artifacts/daily/*/report.json`，用共享的 `DailyReportSchema` 校验全部日报，再按 `date` 和 `generatedAt` 排序。网站只选择最后一份 `mode: "live"` 的报告：

- 更新日期相同时，使用 `generatedAt` 更新的实时报告；
- 没有实时报告时，构建直接失败；
- 任一已提交报告不符合 Schema 时，构建直接失败，不展示猜测数据；
- 回放报告可以用于测试和评分回归，但永远不会成为公开网站数据。

回放不发布是证据边界：其输入和观测时间可固定，适合验证算法，却不能代表当天真实信源状态。

## GitHub Pages 发布

首次启用时，在仓库 **Settings → Pages → Build and deployment** 中把 Source 设为 **GitHub Actions**。工作流会：

1. 安装锁定版本的依赖；
2. 运行 `pnpm check`；
3. 以 `NEXT_PUBLIC_BASE_PATH="/github-picks"` 构建静态站；
4. 给产物添加 `.nojekyll`；
5. 上传 `apps/web/out`，再部署到 `github-pages` 环境。

当前配置适用于 Project Pages 子路径 `/github-picks`。若以后绑定根级自定义域名，应把工作流中的 `NEXT_PUBLIC_BASE_PATH` 改为空字符串，重新验证首页、方向页、仓库页、图标和静态资源；如果域名管理策略要求提交 `CNAME`，将它放入 `apps/web/public/CNAME`，让静态导出一并携带。自定义域名和 DNS 变更应在仓库 Pages 设置中单独审核，不由日常数据更新自动修改。

## 日常数据刷新

先按[每日流水线运行手册](daily-pipeline.md)执行实时采集并检查报告：

```bash
GITHUB_TOKEN="$(gh auth token)" pnpm picks:daily
pnpm --filter @github-picks/web build
```

提交时只包含 `artifacts/daily/<日期>/report.json`、`report.md` 和 `manifest.json`。`artifacts/raw/` 保存内容寻址原始响应并已被 Git 忽略；不要为了更新网站而强制提交原始快照、Token、临时文件或本地截图。数据变更进入 `master` 后会复用同一 Pages 工作流重新发布。

## 失败恢复

- `pnpm check` 失败：先修复类型、格式或测试，不要跳过门禁上传产物。
- 静态构建提示没有 live 日报：先完成实时采集并提交合规报告；不要把 replay 改名冒充 live。
- Schema 校验失败：根据错误路径修复日报生成链路，再重新生成日报；不要在网站层吞掉错误。
- Pages 工作流失败：从 Actions 日志确认失败发生在安装、验证、构建、上传还是部署阶段，再本地执行同一命令复现。
- 部署失败不会覆盖最近一次成功站点；工作流只有在构建和上传都成功后才进入部署，并且 Pages 保留上一份已成功部署内容。修复后重新运行失败任务或推送新提交。
- 子路径出现 404：确认生产构建使用 `NEXT_PUBLIC_BASE_PATH="/github-picks"`，并检查链接与静态资源是否带同一前缀。

发布后至少抽查首页、一个方向页、一个仓库页和信源页，同时确认浏览器控制台无错误、移动端无横向滚动、降级信源仍明确可见。
