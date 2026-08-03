# GitHub Picks M1 Evidence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 M0 明确输出 `BUILD` 后，交付可稳定采集、不可变存证、实体去重、健康检查和历史回放的 GitHub Picks M1 证据底座。

**Architecture:** 使用 TypeScript monorepo 共享契约；BullMQ Worker 按信源适配器采集，把原始响应写入 S3-compatible 对象存储，把运行、观测和稳定实体写入 PostgreSQL。Redis 只负责任务，所有事实都可沿 observation → raw snapshot → source/parser version 回放；本里程碑不计算价值分，也不生成网站内容。

**Tech Stack:** Node.js 24.15.0、pnpm 11.18.0、TypeScript 7.0.2、PostgreSQL 18.1、Redis 8.2.2、MinIO S3、BullMQ 6.0.6、pg 8.22.0、AWS SDK S3 3.1101.0、Zod 4.4.3、Pino 10.3.1、OpenTelemetry API 1.9.1、prom-client 15.1.3、Vitest 4.1.10。

## Global Constraints

- **Entry gate:** `docs/research/m0/decision.md` 的机器生成决策必须是 `BUILD`；否则本计划不得执行。
- GitHub Picks 是独立非官方产品；采集器 User-Agent 使用 `github-picks/0.1 (+public-contact-url)`，正式运行前把公开联系页写入配置。
- M1 最小信源：GitHub REST、GraphQL、Events、GH Archive、仓库文件、npm、PyPI、crates.io、OpenSSF Scorecard、OSV、deps.dev、GitHub Trending、Hacker News。
- Collector 只采集、存证和标准化观察，不计算 Utility、Activity、Organization、PublishedScore 或榜单。
- 每个信源必须登记 source_id、tier、purpose、official、independence_group、cadence、freshness_slo、rate_limit_policy、legal_policy、parser_version、fallback_source 和 health_state。
- 原始对象不可原地覆盖；所有核心事实必须具有 source_id、observed_at、raw_snapshot_ref 和 parser_version。
- 仓库永久身份使用 GitHub node_id；owner/name 只是带时间范围的 alias。
- missing、not_applicable 和 negative 不能混为一类；M1 只记录观测状态，不推断质量分。
- GitHub REST 基础额度运行时读取，不硬编码为永久额度；请求使用 ETag/Last-Modified、队列、退避和不超过 20 的单凭据并发。
- 403/429 遵守 Retry-After 或 reset；无明确时间时指数退避加抖动，不轮换账号绕限。
- GitHub Events 遵守 X-Poll-Interval，并承认公开事件可延迟，不能宣传秒级实时。
- C 级或 community 来源只发现候选，不能直接把实体提升为 eligible；本计划没有 eligible/ranking 状态。
- 日志、DLQ、对象存储和测试 fixture 不得包含 Token、Cookie、完整私人路径或私人笔记。
- M1 不建设网站、评分、中文分析、邮件、Obsidian 插件或 Agent。
- 每个任务按 TDD 完成，并在独立测试通过后提交。
- 每次提交前先运行 `pnpm format`，再运行任务列出的测试与 `pnpm check`；Biome 可机械调整代码片段换行，但不得改变契约与行为。

---

## File Structure

| Path | Responsibility |
|---|---|
| `config/sources.yaml` | 首期信源注册表的版本化源文件 |
| `config/m1-targets.yaml` | 每个 M1 适配器至少一个可调度的基线目标 |
| `packages/contracts/` | 来源、目标、原始对象、观察、实体与任务的 Zod/TS 契约 |
| `packages/source-sdk/` | 礼貌 HTTP、重试、限流状态和 SourceAdapter 接口 |
| `packages/evidence/` | S3 原始对象和 PostgreSQL 运行/观测持久化 |
| `packages/entity-resolver/` | node_id、alias、Fork、包映射解析 |
| `packages/observability/` | Pino 日志、Prometheus 指标与追踪上下文 |
| `workers/collector/` | 适配器、BullMQ Worker、调度和 CLI |
| `tools/db/` | SQL migration runner 与 source registry seed |
| `tools/health/` | 来源成功率、新鲜度和降级状态 CLI |
| `tools/replay/` | 按 raw snapshot 重跑 parser 并比较结果 |
| `tools/acceptance/` | M1 端到端验收脚本 |
| `infra/migrations/` | PostgreSQL append-friendly schema |
| `infra/docker/compose.yaml` | PostgreSQL、Redis、MinIO 本地环境 |
| `docs/runbooks/` | 配额、故障、回放、凭据和恢复操作手册 |
| `.github/workflows/ci.yml` | 单元、类型、格式和容器集成门禁 |

## Stable Interfaces

Later tasks must use these names exactly:

```ts
export interface RawStore {
  put(input: RawObjectInput): Promise<StoredRawObject>;
  get(objectRef: string): Promise<Uint8Array>;
}

export interface EvidenceWriter {
  startRun(input: StartRunInput): Promise<string | null>;
  recordArtifact(runId: string, artifact: CollectedArtifact): Promise<string>;
  finishRun(runId: string, result: FinishRunInput): Promise<void>;
}

export interface SourceAdapter {
  readonly sourceId: string;
  collect(context: CollectorContext, request: CollectRequest): Promise<CollectionBatch>;
  parse(raw: ReplayRawObject): Promise<ObservationDraft[]>;
}
```

---

### Task 1: Add Shared Contracts and the Versioned Source Registry

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/source.ts`
- Create: `packages/contracts/src/collector.ts`
- Create: `packages/contracts/src/entity.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/source-registry.test.ts`
- Create: `config/sources.yaml`
- Create: `config/m1-targets.yaml`

**Interfaces:**
- Consumes: M0 root workspace.
- Produces: all stable interfaces named above plus `SourceDefinitionSchema`, `CollectRequestSchema`, `CollectionTargetRegistrySchema`, `ObservationDraftSchema`, and `EntityHintSchema`.

- [ ] **Step 1: Add the contracts package and failing registry test**

```json
// packages/contracts/package.json
{
  "name": "@github-picks/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "zod": "4.4.3" },
  "devDependencies": { "yaml": "2.9.0" }
}
```

```json
// packages/contracts/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": ".", "outDir": "dist" },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

```ts
// packages/contracts/test/source-registry.test.ts
import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { CollectionTargetRegistrySchema, SourceRegistrySchema } from "../src/index.js";

describe("source registry", () => {
  it("contains the thirteen required M1 sources with unique IDs", async () => {
    const registry = SourceRegistrySchema.parse(YAML.parse(await readFile("../../config/sources.yaml", "utf8")));
    expect(registry.sources).toHaveLength(13);
    const sourceIds = new Set(registry.sources.map((source) => source.sourceId));
    expect(sourceIds.size).toBe(13);
    expect(registry.sources.filter((source) => source.tier === "S").length).toBeGreaterThanOrEqual(7);
    expect(registry.sources.every((source) => source.parserVersion.startsWith("v1."))).toBe(true);
    expect(registry.sources.every((source) => source.fallbackSource === null || sourceIds.has(source.fallbackSource))).toBe(true);
    const targetRegistry = CollectionTargetRegistrySchema.parse(YAML.parse(await readFile("../../config/m1-targets.yaml", "utf8")));
    expect(targetRegistry.targets).toHaveLength(13);
    expect(new Set(targetRegistry.targets.map((target) => target.sourceId))).toEqual(sourceIds);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm install && pnpm --filter @github-picks/contracts test`

Expected: FAIL because `packages/contracts/src/index.ts` and `config/sources.yaml` do not exist.

- [ ] **Step 3: Implement the exact source, collection, and entity contracts**

```ts
// packages/contracts/src/source.ts
import { z } from "zod";

export const SourceTierSchema = z.enum(["S", "A", "B", "C"]);
export const SourcePurposeSchema = z.enum(["discovery", "fact", "risk", "dependency", "cross_validation"]);
export const HealthStateSchema = z.enum(["healthy", "degraded", "offline"]);
export const SourceDefinitionSchema = z.object({
  sourceId: z.string().regex(/^[a-z0-9-]+$/),
  tier: SourceTierSchema,
  purpose: z.array(SourcePurposeSchema).min(1),
  official: z.boolean(),
  independenceGroup: z.string().min(2),
  cadenceSeconds: z.int().positive(),
  freshnessSloSeconds: z.int().positive(),
  rateLimitPolicy: z.string().min(8),
  legalPolicy: z.string().min(8),
  parserVersion: z.string().regex(/^v1\.\d+\.\d+$/),
  fallbackSource: z.string().nullable(),
  healthState: HealthStateSchema,
});
export const SourceRegistrySchema = z.object({ version: z.literal(1), sources: z.array(SourceDefinitionSchema).min(1) });
export type SourceDefinition = z.infer<typeof SourceDefinitionSchema>;
```

```ts
// packages/contracts/src/entity.ts
import { z } from "zod";

export const EntityHintSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("repository"), nodeId: z.string().nullable(), owner: z.string(), name: z.string() }),
  z.object({ type: z.literal("organization"), login: z.string() }),
  z.object({ type: z.literal("maintainer"), nodeId: z.string().nullable(), login: z.string() }),
  z.object({ type: z.literal("package"), ecosystem: z.string(), name: z.string() }),
  z.object({ type: z.literal("discovery"), externalId: z.string() }),
]);
export type EntityHint = z.infer<typeof EntityHintSchema>;
```

```ts
// packages/contracts/src/collector.ts
import { z } from "zod";
import { EntityHintSchema } from "./entity.js";

export const CollectTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("repository"), owner: z.string(), name: z.string(), ref: z.string().optional() }),
  z.object({ kind: z.literal("package"), ecosystem: z.enum(["npm", "pypi", "cargo"]), name: z.string(), version: z.string().optional() }),
  z.object({ kind: z.literal("hour"), hour: z.iso.datetime() }),
  z.object({ kind: z.literal("discovery"), cursor: z.string().nullable() }),
]);
export const CollectionTargetSeedSchema = z.object({
  sourceId: z.string().regex(/^[a-z0-9-]+$/),
  resourceKey: z.string().min(1),
  target: CollectTargetSchema,
  temperature: z.enum(["hot", "warm", "cold", "quarantine"]),
  reason: z.string().min(8),
});
export const CollectionTargetRegistrySchema = z.object({ version: z.literal(1), targets: z.array(CollectionTargetSeedSchema).min(1) });
export const CollectRequestSchema = z.object({
  target: CollectTargetSchema,
  windowStart: z.iso.datetime(),
  windowEnd: z.iso.datetime(),
  cursor: z.string().nullable(),
  etag: z.string().nullable(),
  lastModified: z.string().nullable(),
});
export const ObservationDraftSchema = z.object({
  externalId: z.string(),
  entityHint: EntityHintSchema,
  field: z.string(),
  value: z.unknown(),
  eventAt: z.iso.datetime().nullable(),
  confidence: z.number().min(0).max(1),
  status: z.enum(["observed", "missing", "not_applicable", "negative"]),
});
export const CollectedArtifactSchema = z.object({
  sourceId: z.string(),
  url: z.url(),
  requestFingerprint: z.string(),
  contentType: z.string(),
  body: z.instanceof(Uint8Array),
  responseHeaders: z.record(z.string(), z.string()),
  requestBody: z.string().nullable(),
  observedAt: z.iso.datetime(),
  eventAt: z.iso.datetime().nullable(),
  observations: z.array(ObservationDraftSchema),
});
export const CollectionBatchSchema = z.object({
  artifacts: z.array(CollectedArtifactSchema),
  nextCursor: z.string().nullable(),
  nextPollSeconds: z.number().int().positive().nullable(),
});
export type CollectRequest = z.infer<typeof CollectRequestSchema>;
export type ObservationDraft = z.infer<typeof ObservationDraftSchema>;
export type CollectedArtifact = z.infer<typeof CollectedArtifactSchema>;
export type CollectionBatch = z.infer<typeof CollectionBatchSchema>;

export interface ReplayRawObject {
  sourceId: string;
  sourceUrl: string;
  requestBody: string | null;
  contentType: string;
  body: Uint8Array;
  observedAt: string;
  eventAt: string | null;
}

export interface CollectorContext {
  http: {
    request(input: {
      url: string;
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: string;
      etag?: string | null;
      lastModified?: string | null;
    }): Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>;
    rateLimitSnapshot(origin: string): { limit: number; remaining: number; resetAt: string; resource: string | null } | null;
  };
  now(): Date;
}

export interface SourceAdapter {
  readonly sourceId: string;
  collect(context: CollectorContext, request: CollectRequest): Promise<CollectionBatch>;
  parse(raw: ReplayRawObject): Promise<ObservationDraft[]>;
}
```

```ts
// packages/contracts/src/index.ts
export * from "./collector.js";
export * from "./entity.js";
export * from "./source.js";
```

- [ ] **Step 4: Add the complete M1 source registry**

```yaml
# config/sources.yaml
version: 1
sources:
  - { sourceId: github-rest, tier: S, purpose: [fact], official: true, independenceGroup: github-core, cadenceSeconds: 3600, freshnessSloSeconds: 5400, rateLimitPolicy: "runtime rate endpoint, ETag, queue and reset", legalPolicy: "GitHub API terms; store provenance and necessary raw response", parserVersion: v1.0.0, fallbackSource: github-graphql, healthState: healthy }
  - { sourceId: github-graphql, tier: S, purpose: [fact], official: true, independenceGroup: github-core, cadenceSeconds: 21600, freshnessSloSeconds: 28800, rateLimitPolicy: "runtime node-cost budget and queue", legalPolicy: "GitHub API terms; retain query and provenance", parserVersion: v1.0.0, fallbackSource: github-rest, healthState: healthy }
  - { sourceId: github-events, tier: S, purpose: [discovery, fact], official: true, independenceGroup: github-events, cadenceSeconds: 900, freshnessSloSeconds: 3600, rateLimitPolicy: "ETag and X-Poll-Interval", legalPolicy: "public Events API; acknowledge event latency", parserVersion: v1.0.0, fallbackSource: gharchive, healthState: healthy }
  - { sourceId: gharchive, tier: S, purpose: [discovery, fact], official: false, independenceGroup: github-events, cadenceSeconds: 3600, freshnessSloSeconds: 7200, rateLimitPolicy: "one immutable hourly object", legalPolicy: "GH Archive public data terms and attribution", parserVersion: v1.0.0, fallbackSource: github-events, healthState: healthy }
  - { sourceId: repository-files, tier: S, purpose: [fact, risk], official: true, independenceGroup: repository-self, cadenceSeconds: 21600, freshnessSloSeconds: 28800, rateLimitPolicy: "fetch only when default branch SHA changes", legalPolicy: "retain hash and minimal artifact needed for evidence", parserVersion: v1.0.0, fallbackSource: github-rest, healthState: healthy }
  - { sourceId: npm, tier: S, purpose: [fact, dependency], official: true, independenceGroup: package-registry, cadenceSeconds: 21600, freshnessSloSeconds: 86400, rateLimitPolicy: "registry-specific queue and cache", legalPolicy: "npm registry terms; no unnecessary package content copy", parserVersion: v1.0.0, fallbackSource: deps-dev, healthState: healthy }
  - { sourceId: pypi, tier: S, purpose: [fact, dependency], official: true, independenceGroup: package-registry, cadenceSeconds: 86400, freshnessSloSeconds: 86400, rateLimitPolicy: "registry-specific queue and cache", legalPolicy: "PyPI API terms; retain package metadata provenance", parserVersion: v1.0.0, fallbackSource: deps-dev, healthState: healthy }
  - { sourceId: crates, tier: S, purpose: [fact, dependency], official: true, independenceGroup: package-registry, cadenceSeconds: 86400, freshnessSloSeconds: 86400, rateLimitPolicy: "identify User-Agent and use registry queue", legalPolicy: "crates.io data access policy and attribution", parserVersion: v1.0.0, fallbackSource: deps-dev, healthState: healthy }
  - { sourceId: openssf-scorecard, tier: A, purpose: [risk, cross_validation], official: true, independenceGroup: security-practice, cadenceSeconds: 86400, freshnessSloSeconds: 172800, rateLimitPolicy: "CDN cache and source-specific queue", legalPolicy: "CDLA-Permissive-2.0 API data with attribution", parserVersion: v1.0.0, fallbackSource: repository-files, healthState: healthy }
  - { sourceId: osv, tier: A, purpose: [risk], official: true, independenceGroup: security-db, cadenceSeconds: 21600, freshnessSloSeconds: 86400, rateLimitPolicy: "batch package queries when possible", legalPolicy: "OSV source licenses preserved per record", parserVersion: v1.0.0, fallbackSource: null, healthState: healthy }
  - { sourceId: deps-dev, tier: A, purpose: [dependency, cross_validation], official: true, independenceGroup: dependency-graph, cadenceSeconds: 86400, freshnessSloSeconds: 172800, rateLimitPolicy: "v3alpha cache and source-specific queue", legalPolicy: "deps.dev API terms and source attribution", parserVersion: v1.0.0, fallbackSource: null, healthState: healthy }
  - { sourceId: github-trending, tier: B, purpose: [discovery], official: true, independenceGroup: github-derived, cadenceSeconds: 3600, freshnessSloSeconds: 7200, rateLimitPolicy: "one page per language window with parser circuit breaker", legalPolicy: "discovery references only; do not republish page content", parserVersion: v1.0.0, fallbackSource: hacker-news, healthState: healthy }
  - { sourceId: hacker-news, tier: B, purpose: [discovery, cross_validation], official: false, independenceGroup: community-discussion, cadenceSeconds: 3600, freshnessSloSeconds: 7200, rateLimitPolicy: "official Firebase API with bounded item fetches", legalPolicy: "public item links and minimal metadata only", parserVersion: v1.0.0, fallbackSource: github-trending, healthState: healthy }
```

```yaml
# config/m1-targets.yaml
version: 1
targets:
  - { sourceId: github-rest, resourceKey: "ossf/scorecard", target: { kind: repository, owner: ossf, name: scorecard }, temperature: hot, reason: "baseline repository facts" }
  - { sourceId: github-graphql, resourceKey: "ossf/scorecard", target: { kind: repository, owner: ossf, name: scorecard }, temperature: warm, reason: "baseline repository history" }
  - { sourceId: repository-files, resourceKey: "ossf/scorecard", target: { kind: repository, owner: ossf, name: scorecard }, temperature: warm, reason: "baseline repository artifacts" }
  - { sourceId: github-events, resourceKey: public-events, target: { kind: discovery, cursor: null }, temperature: hot, reason: "rolling public discovery" }
  - { sourceId: gharchive, resourceKey: rolling-hour, target: { kind: hour, hour: "1970-01-01T00:00:00.000Z" }, temperature: hot, reason: "rolling archive clock; scheduler replaces sentinel" }
  - { sourceId: github-trending, resourceKey: daily-global, target: { kind: discovery, cursor: null }, temperature: warm, reason: "daily community discovery" }
  - { sourceId: hacker-news, resourceKey: top-github, target: { kind: discovery, cursor: null }, temperature: warm, reason: "bounded community validation" }
  - { sourceId: npm, resourceKey: "npm:zod", target: { kind: package, ecosystem: npm, name: zod }, temperature: warm, reason: "baseline npm package evidence" }
  - { sourceId: pypi, resourceKey: "pypi:requests", target: { kind: package, ecosystem: pypi, name: requests }, temperature: warm, reason: "baseline PyPI package evidence" }
  - { sourceId: crates, resourceKey: "cargo:serde", target: { kind: package, ecosystem: cargo, name: serde }, temperature: warm, reason: "baseline crates package evidence" }
  - { sourceId: openssf-scorecard, resourceKey: "ossf/scorecard", target: { kind: repository, owner: ossf, name: scorecard }, temperature: warm, reason: "baseline security practice evidence" }
  - { sourceId: osv, resourceKey: "pypi:jinja2:2.4.1", target: { kind: package, ecosystem: pypi, name: jinja2, version: "2.4.1" }, temperature: warm, reason: "known vulnerable fixture evidence" }
  - { sourceId: deps-dev, resourceKey: "pypi:jinja2", target: { kind: package, ecosystem: pypi, name: jinja2 }, temperature: cold, reason: "baseline dependency graph evidence" }
```

- [ ] **Step 5: Run contracts checks and commit**

Run: `pnpm --filter @github-picks/contracts test && pnpm --filter @github-picks/contracts typecheck && pnpm check`

Expected: registry test PASS, full check exits 0.

```bash
git add packages/contracts config/sources.yaml config/m1-targets.yaml pnpm-lock.yaml
git commit -m "feat: define M1 source and evidence contracts"
```

### Task 2: Provision Local Infrastructure and the Append-Friendly Schema

**Files:**
- Create: `.env.example`
- Create: `infra/docker/compose.yaml`
- Create: `infra/migrations/0001_m1_foundation.sql`
- Create: `tools/db/package.json`
- Create: `tools/db/tsconfig.json`
- Create: `tools/db/src/migrate.ts`
- Create: `tools/db/src/seed-sources.ts`
- Create: `tools/db/test/migration.integration.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `config/sources.yaml`, `SourceRegistrySchema`.
- Produces: PostgreSQL tables and root commands `infra:up`, `db:migrate`, `db:seed`, `test:integration`.

- [ ] **Step 1: Add local services and environment contract**

```yaml
# infra/docker/compose.yaml
services:
  postgres:
    image: postgres:18.1-alpine
    environment:
      POSTGRES_DB: github_picks
      POSTGRES_USER: github_picks
      POSTGRES_PASSWORD: github_picks_local
    ports: ["55432:5432"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U github_picks"], interval: 2s, timeout: 2s, retries: 30 }
    volumes: ["github-picks-postgres:/var/lib/postgresql/data"]
  redis:
    image: redis:8.2.2-alpine
    command: ["redis-server", "--appendonly", "yes"]
    ports: ["56379:6379"]
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 2s, timeout: 2s, retries: 30 }
    volumes: ["github-picks-redis:/data"]
  minio:
    image: quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z
    command: ["server", "/data", "--console-address", ":9001"]
    environment:
      MINIO_ROOT_USER: github_picks_local
      MINIO_ROOT_PASSWORD: github_picks_local_secret
    ports: ["59000:9000", "59001:9001"]
    healthcheck: { test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"], interval: 2s, timeout: 2s, retries: 30 }
    volumes: ["github-picks-minio:/data"]
  minio-init:
    image: quay.io/minio/mc:RELEASE.2025-08-13T08-35-41Z
    depends_on: { minio: { condition: service_healthy } }
    entrypoint: ["/bin/sh", "-c", "mc alias set local http://minio:9000 github_picks_local github_picks_local_secret && mc mb --ignore-existing local/github-picks-raw"]
volumes:
  github-picks-postgres:
  github-picks-redis:
  github-picks-minio:
```

```dotenv
# .env.example
DATABASE_URL=postgres://github_picks:github_picks_local@127.0.0.1:55432/github_picks
REDIS_URL=redis://127.0.0.1:56379
S3_ENDPOINT=http://127.0.0.1:59000
S3_REGION=us-east-1
S3_BUCKET=github-picks-raw
S3_ACCESS_KEY_ID=github_picks_local
S3_SECRET_ACCESS_KEY=github_picks_local_secret
GITHUB_TOKEN=
GITHUB_PICKS_USER_AGENT=github-picks/0.1 (+https://example.invalid/contact)
METRICS_PORT=9464
```

- [ ] **Step 2: Write the failing database contract test**

```ts
// tools/db/test/migration.integration.test.ts
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
beforeAll(async () => pool.query("select 1"));
afterAll(async () => {
  await pool.query("delete from repository_maintainer where repository_id in (select repository_id from repository where github_node_id=$1)", [`R_${fixture}`]);
  await pool.query("delete from repository_relation where from_repository_id in (select repository_id from repository where github_node_id=$1) or to_repository_id in (select repository_id from repository where github_node_id=$1)", [`R_${fixture}`]);
  await pool.query("delete from repository_alias where repository_id in (select repository_id from repository where github_node_id=$1)", [`R_${fixture}`]);
  await pool.query("delete from organization where github_node_id in ($1,$2)", [`O_OLD_${fixture}`, `O_NEW_${fixture}`]);
  await pool.query("delete from maintainer where github_node_id=$1", [`U_${fixture}`]);
  await pool.query("delete from repository where github_node_id=$1", [`R_${fixture}`]);
  await pool.query("delete from source_observation where raw_snapshot_id=$1", [rawSnapshotId]);
  await pool.query("delete from raw_snapshot where raw_snapshot_id=$1", [rawSnapshotId]);
  await pool.query("delete from ingestion_run where resource_key=$1", [`repo-${fixture}`]);
  await pool.end();
});

describe("M1 schema", () => {
  it("creates all evidence and identity tables", async () => {
    const expected = [
      "source_registry", "ingestion_run", "raw_snapshot", "source_observation", "repository", "repository_alias",
      "repository_relation", "organization", "maintainer", "repository_maintainer", "package", "repository_package_link", "collection_target", "audit_log",
    ];
    const result = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    expect(expected.every((name) => result.rows.some((row) => row.table_name === name))).toBe(true);
  });
});
```

Run: `cp .env.example .env && set -a && source .env && set +a && docker compose -f infra/docker/compose.yaml up -d --wait && pnpm --filter @github-picks/db test`

Expected: FAIL because the tables do not exist.

- [ ] **Step 3: Add the complete first migration**

```sql
-- infra/migrations/0001_m1_foundation.sql
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists schema_migration (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table source_registry (
  source_id text primary key,
  tier text not null check (tier in ('S','A','B','C')),
  purpose text[] not null,
  official boolean not null,
  independence_group text not null,
  cadence_seconds integer not null check (cadence_seconds > 0),
  freshness_slo_seconds integer not null check (freshness_slo_seconds > 0),
  rate_limit_policy text not null,
  legal_policy text not null,
  parser_version text not null,
  fallback_source text null,
  health_state text not null check (health_state in ('healthy','degraded','offline')),
  last_success_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table ingestion_run (
  ingestion_run_id uuid primary key default gen_random_uuid(),
  source_id text not null references source_registry(source_id),
  resource_key text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  collector_version text not null,
  request_fingerprint text not null,
  cursor_in text null,
  cursor_out text null,
  next_poll_seconds integer null check (next_poll_seconds is null or next_poll_seconds > 0),
  rate_limit_before jsonb null,
  rate_limit_after jsonb null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  result_state text not null check (result_state in ('running','succeeded','failed','stale')),
  retry_count integer not null default 0,
  record_count integer not null default 0,
  error_class text null,
  error_message text null,
  unique (source_id, resource_key, window_start, window_end, collector_version, request_fingerprint)
);

create table raw_snapshot (
  raw_snapshot_id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid not null references ingestion_run(ingestion_run_id),
  source_id text not null references source_registry(source_id),
  object_ref text not null unique,
  content_hash text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  source_url text not null,
  request_body text null,
  event_at timestamptz null,
  observed_at timestamptz not null,
  parser_version text not null,
  response_headers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table source_observation (
  observation_id uuid primary key default gen_random_uuid(),
  raw_snapshot_id uuid not null references raw_snapshot(raw_snapshot_id),
  source_id text not null references source_registry(source_id),
  external_id text not null,
  entity_hint jsonb not null,
  field text not null,
  value jsonb null,
  status text not null check (status in ('observed','missing','not_applicable','negative')),
  event_at timestamptz null,
  observed_at timestamptz not null,
  parser_version text not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  unique (raw_snapshot_id, external_id, field)
);

create table repository (
  repository_id uuid primary key default gen_random_uuid(),
  github_node_id text not null unique,
  current_owner text not null,
  current_name text not null,
  owner_github_node_id text null,
  owner_type text null check (owner_type in ('Organization','User')),
  is_fork boolean not null default false,
  is_archived boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization (
  organization_id uuid primary key default gen_random_uuid(),
  github_node_id text not null unique,
  login text not null,
  updated_at timestamptz not null default now()
);

create table maintainer (
  maintainer_id uuid primary key default gen_random_uuid(),
  github_node_id text null unique,
  login text not null unique,
  updated_at timestamptz not null default now()
);

create table repository_maintainer (
  repository_id uuid not null references repository(repository_id),
  maintainer_id uuid not null references maintainer(maintainer_id),
  contributions integer not null check (contributions >= 0),
  source_observation_id uuid not null references source_observation(observation_id),
  observed_at timestamptz not null,
  primary key (repository_id, maintainer_id, observed_at)
);

create table repository_alias (
  repository_alias_id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references repository(repository_id),
  owner text not null,
  name text not null,
  valid_from timestamptz not null,
  valid_to timestamptz null,
  source_observation_id uuid not null references source_observation(observation_id),
  exclude using gist (repository_id with =, tstzrange(valid_from, coalesce(valid_to, 'infinity'::timestamptz), '[)') with &&)
);

create table repository_relation (
  relation_id uuid primary key default gen_random_uuid(),
  from_repository_id uuid not null references repository(repository_id),
  to_repository_id uuid null references repository(repository_id),
  unresolved_target jsonb null,
  relation_type text not null check (relation_type in ('fork','mirror','template','monorepo','upstream')),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  source_observation_id uuid not null references source_observation(observation_id),
  valid_from timestamptz not null,
  valid_to timestamptz null
);

create table package (
  package_id uuid primary key default gen_random_uuid(),
  ecosystem text not null check (ecosystem in ('npm','pypi','cargo')),
  package_name text not null,
  canonical_name text not null,
  created_at timestamptz not null default now(),
  unique (ecosystem, canonical_name)
);

create table repository_package_link (
  repository_package_link_id uuid primary key default gen_random_uuid(),
  repository_id uuid null references repository(repository_id),
  package_id uuid not null references package(package_id),
  candidate_repository_url text null,
  mapping_confidence numeric(4,3) not null check (mapping_confidence between 0 and 1),
  mapping_state text not null check (mapping_state in ('candidate','confirmed','rejected')),
  source_observation_id uuid not null references source_observation(observation_id),
  valid_from timestamptz not null,
  valid_to timestamptz null
);

create table collection_target (
  collection_target_id uuid primary key default gen_random_uuid(),
  source_id text not null references source_registry(source_id),
  resource_key text not null,
  target jsonb not null,
  temperature text not null check (temperature in ('hot','warm','cold','quarantine')),
  next_collect_at timestamptz not null,
  reason text not null,
  updated_at timestamptz not null default now(),
  unique (source_id, resource_key)
);

create table audit_log (
  audit_id uuid primary key default gen_random_uuid(),
  action text not null,
  actor text not null,
  subject_type text not null,
  subject_id text not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ingestion_run_source_started on ingestion_run(source_id, started_at desc);
create index source_observation_field_time on source_observation(field, observed_at desc);
create index collection_target_due on collection_target(next_collect_at) where temperature <> 'quarantine';
```

- [ ] **Step 4: Implement migration and source seeding tools**

```json
// tools/db/package.json
{
  "name": "@github-picks/db",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run", "migrate": "tsx src/migrate.ts", "seed": "tsx src/seed-sources.ts" },
  "dependencies": { "@github-picks/contracts": "workspace:*", "pg": "8.22.0", "yaml": "2.9.0" },
  "devDependencies": { "@types/pg": "8.20.3" }
}
```

```json
// tools/db/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "outDir": "dist" }, "include": ["src/**/*.ts", "test/**/*.ts"] }
```

```ts
// tools/db/src/migrate.ts
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query("create table if not exists schema_migration (version text primary key, applied_at timestamptz not null default now())");
for (const file of (await readdir("infra/migrations")).filter((name) => name.endsWith(".sql")).sort()) {
  const already = await pool.query("select 1 from schema_migration where version = $1", [file]);
  if (already.rowCount) continue;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(await readFile(`infra/migrations/${file}`, "utf8"));
    await client.query("insert into schema_migration(version) values ($1)", [file]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
await pool.end();
```

```ts
// tools/db/src/seed-sources.ts
import { readFile } from "node:fs/promises";
import pg from "pg";
import YAML from "yaml";
import { CollectionTargetRegistrySchema, SourceRegistrySchema } from "@github-picks/contracts";

const registry = SourceRegistrySchema.parse(YAML.parse(await readFile("config/sources.yaml", "utf8")));
const targetRegistry = CollectionTargetRegistrySchema.parse(YAML.parse(await readFile("config/m1-targets.yaml", "utf8")));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
for (const source of registry.sources) {
  await pool.query(
    `insert into source_registry(source_id,tier,purpose,official,independence_group,cadence_seconds,freshness_slo_seconds,rate_limit_policy,legal_policy,parser_version,fallback_source,health_state)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict(source_id) do update set tier=excluded.tier,purpose=excluded.purpose,official=excluded.official,independence_group=excluded.independence_group,cadence_seconds=excluded.cadence_seconds,freshness_slo_seconds=excluded.freshness_slo_seconds,rate_limit_policy=excluded.rate_limit_policy,legal_policy=excluded.legal_policy,parser_version=excluded.parser_version,fallback_source=excluded.fallback_source,health_state=excluded.health_state,updated_at=now()`,
    [source.sourceId, source.tier, source.purpose, source.official, source.independenceGroup, source.cadenceSeconds, source.freshnessSloSeconds, source.rateLimitPolicy, source.legalPolicy, source.parserVersion, source.fallbackSource, source.healthState],
  );
}
for (const target of targetRegistry.targets) {
  await pool.query(
    `insert into collection_target(source_id,resource_key,target,temperature,next_collect_at,reason)
     values($1,$2,$3,$4,now(),$5)
     on conflict(source_id,resource_key) do update set target=excluded.target,temperature=excluded.temperature,reason=excluded.reason,updated_at=now()`,
    [target.sourceId, target.resourceKey, target.target, target.temperature, target.reason],
  );
}
await pool.end();
```

Add these root scripts:

```json
{
  "infra:up": "docker compose -f infra/docker/compose.yaml up -d --wait",
  "db:migrate": "pnpm --filter @github-picks/db migrate",
  "db:seed": "pnpm --filter @github-picks/db seed",
  "test:integration": "pnpm --filter @github-picks/db test"
}
```

- [ ] **Step 5: Migrate, seed, verify, and commit**

Run: `set -a && source .env && set +a && pnpm db:migrate && pnpm db:seed && pnpm test:integration`

Expected: migration test PASS; `select count(*) from source_registry` and `select count(distinct source_id) from collection_target` both return 13.

```bash
git add .env.example package.json pnpm-lock.yaml infra tools/db
git commit -m "feat: add M1 evidence database and local infrastructure"
```

### Task 3: Persist Immutable Raw Objects and Evidence Lineage

**Files:**
- Create: `packages/evidence/package.json`
- Create: `packages/evidence/tsconfig.json`
- Create: `packages/evidence/src/types.ts`
- Create: `packages/evidence/src/sanitize.ts`
- Create: `packages/evidence/src/s3-raw-store.ts`
- Create: `packages/evidence/src/pg-evidence-writer.ts`
- Create: `packages/evidence/src/index.ts`
- Create: `packages/evidence/test/raw-store.test.ts`

**Interfaces:**
- Consumes: `CollectedArtifact`, PostgreSQL schema, S3 bucket.
- Produces: `RawStore`, `S3RawStore`, `EvidenceWriter`, `PgEvidenceWriter`, `sanitizeResponseHeaders`.

- [ ] **Step 1: Write failing raw-key and redaction tests**

```ts
// packages/evidence/test/raw-store.test.ts
import { describe, expect, it } from "vitest";
import { buildObjectRef, sanitizeRequestBody, sanitizeResponseHeaders } from "../src/index.js";

describe("raw evidence", () => {
  it("builds a deterministic content-addressed reference", () => {
    expect(buildObjectRef("github-rest", "2026-08-03T00:00:00.000Z", "run-1", new TextEncoder().encode("same"))).toBe(
      "raw/github-rest/2026/08/03/run-1/0967115f2813a3541eaef77de9d9d5773f1c0c04314b0bbfe4ff3b3b1c55b5d5.json",
    );
  });

  it("removes credentials and cookies before persistence", () => {
    expect(sanitizeResponseHeaders({ authorization: "Bearer secret", "set-cookie": "private=1", etag: "abc", "x-ratelimit-remaining": "42" })).toEqual({
      etag: "abc",
      "x-ratelimit-remaining": "42",
    });
  });
  it("redacts secret-shaped JSON request keys", () => {
    expect(sanitizeRequestBody('{"token":"secret","package":{"name":"zod"}}')).toBe('{"token":"[REDACTED]","package":{"name":"zod"}}');
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm --filter @github-picks/evidence test`

Expected: FAIL because the package and exports do not exist.

- [ ] **Step 3: Implement raw object types, deterministic keys, and header redaction**

```ts
// packages/evidence/src/types.ts
import type { CollectedArtifact } from "@github-picks/contracts";

export interface RawObjectInput { sourceId: string; observedAt: string; runId: string; contentType: string; body: Uint8Array; }
export interface StoredRawObject { objectRef: string; contentHash: string; sizeBytes: number; }
export interface RawStore { put(input: RawObjectInput): Promise<StoredRawObject>; get(objectRef: string): Promise<Uint8Array>; }
export interface RateLimitSnapshot { limit: number; remaining: number; resetAt: string; resource: string | null; }
export interface StartRunInput { sourceId: string; resourceKey: string; windowStart: string; windowEnd: string; collectorVersion: string; requestFingerprint: string; cursorIn: string | null; rateLimitBefore: RateLimitSnapshot | null; }
export interface FinishRunInput { state: "succeeded" | "failed" | "stale"; cursorOut: string | null; nextPollSeconds: number | null; recordCount: number; retryCount: number; rateLimitAfter: RateLimitSnapshot | null; errorClass?: string; errorMessage?: string; }
export interface EvidenceWriter {
  startRun(input: StartRunInput): Promise<string | null>;
  recordArtifact(runId: string, artifact: CollectedArtifact): Promise<string>;
  finishRun(runId: string, result: FinishRunInput): Promise<void>;
}
```

```ts
// packages/evidence/src/sanitize.ts
const BLOCKED = new Set(["authorization", "cookie", "set-cookie", "proxy-authorization", "x-api-key"]);
export function sanitizeResponseHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !BLOCKED.has(name.toLowerCase())));
}
export function sanitizeRequestBody(body: string | null): string | null {
  if (!body) return null;
  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, /token|authorization|cookie|api[-_]?key/i.test(key) ? "[REDACTED]" : redact(nested)]));
  };
  try { return JSON.stringify(redact(JSON.parse(body))); } catch { return null; }
}
```

```ts
// packages/evidence/src/s3-raw-store.ts
import { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { RawObjectInput, RawStore, StoredRawObject } from "./types.js";

export function buildObjectRef(sourceId: string, observedAt: string, runId: string, body: Uint8Array, extension = "json"): string {
  const date = new Date(observedAt);
  const hash = createHash("sha256").update(body).digest("hex");
  return `raw/${sourceId}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${runId}/${hash}.${extension}`;
}

export class S3RawStore implements RawStore {
  constructor(private readonly client: S3Client, private readonly bucket: string) {}
  async put(input: RawObjectInput): Promise<StoredRawObject> {
    const extension = input.contentType.includes("gzip") ? "json.gz" : input.contentType.includes("json") ? "json" : "bin";
    const objectRef = buildObjectRef(input.sourceId, input.observedAt, input.runId, input.body, extension);
    const contentHash = createHash("sha256").update(input.body).digest("hex");
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: objectRef, Body: input.body, ContentType: input.contentType, IfNoneMatch: "*" }));
    } catch (error) {
      if (!(error instanceof Error) || !error.name.includes("Precondition")) throw error;
    }
    return { objectRef, contentHash, sizeBytes: input.body.byteLength };
  }
  async get(objectRef: string): Promise<Uint8Array> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectRef }));
    if (!result.Body) throw new Error(`empty S3 object: ${objectRef}`);
    return result.Body.transformToByteArray();
  }
}
```

- [ ] **Step 4: Implement transactional PostgreSQL lineage writing**

```ts
// packages/evidence/src/pg-evidence-writer.ts
import type pg from "pg";
import type { CollectedArtifact } from "@github-picks/contracts";
import { sanitizeRequestBody, sanitizeResponseHeaders } from "./sanitize.js";
import type { EvidenceWriter, FinishRunInput, RawStore, StartRunInput } from "./types.js";

export class PgEvidenceWriter implements EvidenceWriter {
  constructor(private readonly pool: pg.Pool, private readonly rawStore: RawStore, private readonly parserVersions: ReadonlyMap<string, string>) {}
  async startRun(input: StartRunInput): Promise<string | null> {
    const inserted = await this.pool.query<{ ingestion_run_id: string }>(
      `insert into ingestion_run(source_id,resource_key,window_start,window_end,collector_version,request_fingerprint,cursor_in,rate_limit_before,result_state)
       values($1,$2,$3,$4,$5,$6,$7,$8,'running') on conflict do nothing returning ingestion_run_id`,
      [input.sourceId, input.resourceKey, input.windowStart, input.windowEnd, input.collectorVersion, input.requestFingerprint, input.cursorIn, input.rateLimitBefore],
    );
    if (inserted.rows[0]) return inserted.rows[0].ingestion_run_id;
    const existing = await this.pool.query<{ ingestion_run_id: string; result_state: string }>(
      `select ingestion_run_id,result_state from ingestion_run where source_id=$1 and resource_key=$2 and window_start=$3 and window_end=$4 and collector_version=$5 and request_fingerprint=$6`,
      [input.sourceId, input.resourceKey, input.windowStart, input.windowEnd, input.collectorVersion, input.requestFingerprint],
    );
    if (existing.rows[0]?.result_state === "succeeded") return null;
    await this.pool.query("update ingestion_run set result_state='running',started_at=now(),finished_at=null,retry_count=retry_count+1,rate_limit_before=$2 where ingestion_run_id=$1", [existing.rows[0]!.ingestion_run_id, input.rateLimitBefore]);
    return existing.rows[0]!.ingestion_run_id;
  }
  async recordArtifact(runId: string, artifact: CollectedArtifact): Promise<string> {
    const parserVersion = this.parserVersions.get(artifact.sourceId);
    if (!parserVersion) throw new Error(`parser version missing for source: ${artifact.sourceId}`);
    const stored = await this.rawStore.put({ sourceId: artifact.sourceId, observedAt: artifact.observedAt, runId, contentType: artifact.contentType, body: artifact.body });
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const raw = await client.query<{ raw_snapshot_id: string }>(
        `insert into raw_snapshot(ingestion_run_id,source_id,object_ref,content_hash,content_type,size_bytes,source_url,request_body,event_at,observed_at,parser_version,response_headers)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict(object_ref) do update set object_ref=excluded.object_ref returning raw_snapshot_id`,
        [runId, artifact.sourceId, stored.objectRef, stored.contentHash, artifact.contentType, stored.sizeBytes, artifact.url, sanitizeRequestBody(artifact.requestBody), artifact.eventAt, artifact.observedAt, parserVersion, sanitizeResponseHeaders(artifact.responseHeaders)],
      );
      const rawId = raw.rows[0]!.raw_snapshot_id;
      for (const observation of artifact.observations) {
        await client.query(
          `insert into source_observation(raw_snapshot_id,source_id,external_id,entity_hint,field,value,status,event_at,observed_at,parser_version,confidence)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(raw_snapshot_id,external_id,field) do nothing`,
          [rawId, artifact.sourceId, observation.externalId, observation.entityHint, observation.field, JSON.stringify(observation.value ?? null), observation.status, observation.eventAt, artifact.observedAt, parserVersion, observation.confidence],
        );
      }
      await client.query("commit");
      return rawId;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally { client.release(); }
  }
  async finishRun(runId: string, result: FinishRunInput): Promise<void> {
    await this.pool.query(
      `update ingestion_run set finished_at=now(),result_state=$2,cursor_out=$3,next_poll_seconds=$4,record_count=$5,retry_count=greatest(retry_count,$6),rate_limit_after=$7,error_class=$8,error_message=$9 where ingestion_run_id=$1`,
      [runId, result.state, result.cursorOut, result.nextPollSeconds, result.recordCount, result.retryCount, result.rateLimitAfter, result.errorClass ?? null, result.errorMessage ?? null],
    );
    if (result.nextPollSeconds !== null) await this.pool.query(`update collection_target t set next_collect_at=greatest(t.next_collect_at,now()+($2::text||' seconds')::interval),updated_at=now() from ingestion_run r where r.ingestion_run_id=$1 and t.source_id=r.source_id and t.resource_key=r.resource_key`, [runId, result.nextPollSeconds]);
    if (result.state === "succeeded") await this.pool.query("update source_registry set last_success_at=now(),health_state='healthy' where source_id=(select source_id from ingestion_run where ingestion_run_id=$1)", [runId]);
  }
}
```

```ts
// packages/evidence/src/index.ts
export * from "./pg-evidence-writer.js";
export * from "./s3-raw-store.js";
export * from "./sanitize.js";
export * from "./types.js";
```

```json
// packages/evidence/package.json
{
  "name": "@github-picks/evidence",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "build": "tsc -p tsconfig.json", "typecheck": "tsc -p tsconfig.json --noEmit", "test": "vitest run" },
  "dependencies": { "@aws-sdk/client-s3": "3.1101.0", "@github-picks/contracts": "workspace:*", "pg": "8.22.0" },
  "devDependencies": { "@types/pg": "8.20.3" }
}
```

```json
// packages/evidence/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "outDir": "dist" }, "include": ["src/**/*.ts", "test/**/*.ts"] }
```

- [ ] **Step 5: Run tests and commit**

Run: `pnpm install && pnpm --filter @github-picks/evidence test && pnpm --filter @github-picks/evidence typecheck`

Expected: 3 tests PASS and TypeScript exits 0.

```bash
git add packages/evidence pnpm-lock.yaml
git commit -m "feat: persist immutable source evidence"
```

### Task 4: Build the Polite HTTP and Adapter SDK

**Files:**
- Create: `packages/source-sdk/package.json`
- Create: `packages/source-sdk/tsconfig.json`
- Create: `packages/source-sdk/src/errors.ts`
- Create: `packages/source-sdk/src/polite-http-client.ts`
- Create: `packages/source-sdk/src/fingerprint.ts`
- Create: `packages/source-sdk/src/index.ts`
- Create: `packages/source-sdk/test/polite-http-client.test.ts`

**Interfaces:**
- Consumes: the `CollectorContext.http` shape from Task 1.
- Produces: `PoliteHttpClient.request`, `HttpStatusError`, `requestFingerprint`, and injectable `FetchLike`/`Sleep` types.

- [ ] **Step 1: Add package metadata and the failing retry tests**

```json
// packages/source-sdk/package.json
{
  "name": "@github-picks/source-sdk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "build": "tsc -p tsconfig.json", "typecheck": "tsc -p tsconfig.json --noEmit", "test": "vitest run" },
  "dependencies": { "@github-picks/contracts": "workspace:*" }
}
```

```json
// packages/source-sdk/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "outDir": "dist" }, "include": ["src/**/*.ts", "test/**/*.ts"] }
```

```ts
// packages/source-sdk/test/polite-http-client.test.ts
import { describe, expect, it, vi } from "vitest";
import { HttpStatusError, PoliteHttpClient } from "../src/index.js";

describe("PoliteHttpClient", () => {
  it("sends conditional headers and returns a 304 without retry", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("if-none-match")).toBe('"etag-1"');
      return new Response(null, { status: 304, headers: { etag: '"etag-1"' } });
    });
    const client = new PoliteHttpClient({ fetch, sleep: async () => undefined, random: () => 0, userAgent: "github-picks-test" });
    expect((await client.request({ url: "https://api.github.com/events", etag: '"etag-1"' })).status).toBe(304);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("obeys Retry-After on 429 and then succeeds", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("limited", { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    const client = new PoliteHttpClient({ fetch, sleep, random: () => 0, userAgent: "github-picks-test" });
    expect(new TextDecoder().decode((await client.request({ url: "https://example.com" })).body)).toBe("ok");
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("waits until the GitHub reset time on an exhausted 403", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("limited", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1002" } })).mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    const client = new PoliteHttpClient({ fetch, sleep, random: () => 0, now: () => 1_000_000, userAgent: "github-picks-test" });
    await client.request({ url: "https://api.github.com/events" });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("does not retry an ordinary 404", async () => {
    const fetch = vi.fn(async () => new Response("missing", { status: 404 }));
    const client = new PoliteHttpClient({ fetch, sleep: async () => undefined, random: () => 0, userAgent: "github-picks-test" });
    await expect(client.request({ url: "https://example.com/missing" })).rejects.toBeInstanceOf(HttpStatusError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a transient network failure with bounded backoff", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("network reset")).mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    const client = new PoliteHttpClient({ fetch, sleep, random: () => 0, userAgent: "github-picks-test" });
    await client.request({ url: "https://example.com" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter @github-picks/source-sdk test`

Expected: FAIL because `PoliteHttpClient` is not defined.

- [ ] **Step 3: Implement typed errors and stable request fingerprints**

```ts
// packages/source-sdk/src/errors.ts
export class HttpStatusError extends Error {
  constructor(public readonly status: number, public readonly url: string, public readonly responseBody: Uint8Array) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpStatusError";
  }
}
```

```ts
// packages/source-sdk/src/fingerprint.ts
import { createHash } from "node:crypto";

export function requestFingerprint(input: { url: string; method?: string; body?: string }): string {
  return createHash("sha256").update(`${input.method ?? "GET"}\n${input.url}\n${input.body ?? ""}`).digest("hex");
}
```

- [ ] **Step 4: Implement conditional requests, bounded retry, and rate headers**

```ts
// packages/source-sdk/src/polite-http-client.ts
import { HttpStatusError } from "./errors.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type Sleep = (milliseconds: number) => Promise<void>;

export interface PoliteHttpClientOptions {
  fetch: FetchLike;
  sleep: Sleep;
  random: () => number;
  userAgent: string;
  token?: string;
  maximumAttempts?: number;
  now?: () => number;
}

export class PoliteHttpClient {
  private readonly rateLimits = new Map<string, { limit: number; remaining: number; resetAt: string; resource: string | null }>();
  constructor(private readonly options: PoliteHttpClientOptions) {}

  rateLimitSnapshot(origin: string) {
    return this.rateLimits.get(origin) ?? null;
  }

  async request(input: {
    url: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
    etag?: string | null;
    lastModified?: string | null;
  }): Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }> {
    const maximumAttempts = this.options.maximumAttempts ?? 3;
    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      const headers = new Headers(input.headers);
      headers.set("user-agent", this.options.userAgent);
      headers.set("accept", headers.get("accept") ?? "application/json");
      if (this.options.token && input.url.startsWith("https://api.github.com/")) headers.set("authorization", `Bearer ${this.options.token}`);
      if (input.etag) headers.set("if-none-match", input.etag);
      if (input.lastModified) headers.set("if-modified-since", input.lastModified);
      let response: Response;
      try {
        response = await this.options.fetch(input.url, { method: input.method ?? "GET", headers, ...(input.body === undefined ? {} : { body: input.body }) });
      } catch (error) {
        if (attempt + 1 === maximumAttempts) throw error;
        await this.options.sleep(250 * 2 ** attempt + Math.floor(this.options.random() * 100));
        continue;
      }
      const responseHeaders = Object.fromEntries(response.headers.entries());
      const body = new Uint8Array(await response.arrayBuffer());
      const limitHeader = response.headers.get("x-ratelimit-limit");
      const remainingHeader = response.headers.get("x-ratelimit-remaining");
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const limit = Number(limitHeader); const remaining = Number(remainingHeader); const reset = Number(resetHeader);
      if (limitHeader !== null && remainingHeader !== null && resetHeader !== null && Number.isFinite(limit) && Number.isFinite(remaining) && Number.isFinite(reset)) {
        this.rateLimits.set(new URL(input.url).origin, { limit, remaining, resetAt: new Date(reset * 1000).toISOString(), resource: response.headers.get("x-ratelimit-resource") });
      }
      if ((response.status >= 200 && response.status < 300) || response.status === 304) {
        return { status: response.status, headers: responseHeaders, body };
      }
      const retryable = response.status === 429 || response.status >= 500 || (response.status === 403 && (response.headers.has("retry-after") || response.headers.get("x-ratelimit-remaining") === "0"));
      if (!retryable || attempt + 1 === maximumAttempts) throw new HttpStatusError(response.status, input.url, body);
      const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
      const resetAt = Number.parseInt(response.headers.get("x-ratelimit-reset") ?? "", 10);
      const wait = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Number.isFinite(resetAt)
          ? Math.max(0, resetAt * 1000 - (this.options.now?.() ?? Date.now()))
          : 250 * 2 ** attempt + Math.floor(this.options.random() * 100);
      await this.options.sleep(wait);
    }
    throw new Error("unreachable retry state");
  }
}
```

```ts
// packages/source-sdk/src/index.ts
export * from "./errors.js";
export * from "./fingerprint.js";
export * from "./polite-http-client.js";
```

- [ ] **Step 5: Run SDK checks and commit**

Run: `pnpm install && pnpm --filter @github-picks/source-sdk test && pnpm --filter @github-picks/source-sdk typecheck`

Expected: 5 tests PASS and TypeScript exits 0.

```bash
git add packages/source-sdk pnpm-lock.yaml
git commit -m "feat: add polite source collection SDK"
```

### Task 5: Collect GitHub Repository, GraphQL, and Repository-File Facts

**Files:**
- Create: `workers/collector/package.json`
- Create: `workers/collector/tsconfig.json`
- Create: `workers/collector/src/artifact.ts`
- Create: `workers/collector/src/adapters/github-rest.ts`
- Create: `workers/collector/src/adapters/github-graphql.ts`
- Create: `workers/collector/src/adapters/repository-files.ts`
- Create: `workers/collector/src/adapters/index.ts`
- Create: `workers/collector/test/fake-context.ts`
- Create: `workers/collector/test/github-repository.test.ts`

**Interfaces:**
- Consumes: `SourceAdapter`, `CollectorContext`, `CollectRequest`, `requestFingerprint`.
- Produces: `GitHubRestAdapter`, `GitHubGraphqlAdapter`, `RepositoryFilesAdapter`, and `M1_ADAPTERS`.

- [ ] **Step 1: Add collector metadata and a failing GitHub fact test**

```json
// workers/collector/package.json
{
  "name": "@github-picks/collector",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/adapters/index.ts", "./adapter-registry": "./src/adapter-registry.ts" },
  "scripts": { "build": "tsc -p tsconfig.json", "typecheck": "tsc -p tsconfig.json --noEmit", "test": "vitest run" },
  "dependencies": {
    "@github-picks/contracts": "workspace:*",
    "@github-picks/evidence": "workspace:*",
    "@github-picks/source-sdk": "workspace:*",
    "cheerio": "1.2.0"
  }
}
```

```json
// workers/collector/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "outDir": "dist" }, "include": ["src/**/*.ts", "test/**/*.ts"] }
```

```ts
// workers/collector/test/fake-context.ts
import type { CollectorContext } from "@github-picks/contracts";

export function fakeContext(responses: Record<string, { status?: number; headers?: Record<string, string>; body: unknown }>): CollectorContext {
  return {
    now: () => new Date("2026-08-03T00:00:00.000Z"),
    http: {
      rateLimitSnapshot: () => null,
      async request(input) {
        const response = responses[input.url];
        if (!response) throw new Error(`missing fake response: ${input.url}`);
        return { status: response.status ?? 200, headers: response.headers ?? {}, body: new TextEncoder().encode(JSON.stringify(response.body)) };
      },
    },
  };
}
```

```ts
// workers/collector/test/github-repository.test.ts
import { describe, expect, it } from "vitest";
import { GitHubGraphqlAdapter } from "../src/adapters/github-graphql.js";
import { GitHubRestAdapter } from "../src/adapters/github-rest.js";
import { RepositoryFilesAdapter } from "../src/adapters/repository-files.js";
import { fakeContext } from "./fake-context.js";

const request = {
  target: { kind: "repository" as const, owner: "octocat", name: "Hello-World" },
  windowStart: "2026-08-02T00:00:00.000Z",
  windowEnd: "2026-08-03T00:00:00.000Z",
  cursor: null, etag: null, lastModified: null,
};

describe("GitHub repository adapters", () => {
  it("emits stable node identity and mutable alias facts", async () => {
    const context = fakeContext({
      "https://api.github.com/repos/octocat/Hello-World": { body: { node_id: "MDEwOlJlcG9zaXRvcnkxMjk2MjY5", name: "Hello-World", full_name: "octocat/Hello-World", owner: { login: "octocat", node_id: "MDQ6VXNlcjU4MzIzMQ==", type: "User" }, fork: false, archived: false, default_branch: "master", stargazers_count: 3000, updated_at: "2026-08-02T12:00:00Z" } },
      "https://api.github.com/repos/octocat/Hello-World/contributors?per_page=100&anon=0": { body: [{ login: "octocat", node_id: "MDQ6VXNlcjU4MzIzMQ==", contributions: 99 }] },
    });
    const batch = await new GitHubRestAdapter().collect(context, request);
    expect(batch.artifacts[0]?.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "github_node_id", value: "MDEwOlJlcG9zaXRvcnkxMjk2MjY5" }),
      expect.objectContaining({ field: "full_name", value: "octocat/Hello-World" }),
      expect.objectContaining({ field: "owner_identity", value: expect.objectContaining({ type: "User" }) }),
    ]));
  });

  it("collects GraphQL commit and release evidence", async () => {
    const context = fakeContext({ "https://api.github.com/graphql": { body: { data: { repository: { id: "R_1", nameWithOwner: "octocat/Hello-World", isArchived: false, isFork: false, defaultBranchRef: { name: "master", target: { oid: "abc123", committedDate: "2026-08-02T12:00:00Z" } }, releases: { nodes: [{ tagName: "v1.0.0", publishedAt: "2026-08-01T00:00:00Z", isPrerelease: false }] } } } } } });
    const rows = (await new GitHubGraphqlAdapter().collect(context, request)).artifacts[0]!.observations;
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ field: "default_branch_sha", value: "abc123" }), expect.objectContaining({ field: "recent_releases" })]));
  });

  it("records observed and missing repository artifacts from one Git tree", async () => {
    const url = "https://api.github.com/repos/octocat/Hello-World/git/trees/HEAD?recursive=1";
    const context = fakeContext({ [url]: { body: { sha: "tree-1", truncated: false, tree: [{ path: "README.md", type: "blob", sha: "readme-1" }, { path: ".github/workflows/ci.yml", type: "blob", sha: "workflow-1" }] } } });
    const rows = (await new RepositoryFilesAdapter().collect(context, request)).artifacts[0]!.observations;
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ field: "artifact:readme", status: "observed" }), expect.objectContaining({ field: "artifact:security", status: "missing" }), expect.objectContaining({ field: "artifact:workflows", status: "observed" })]));
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm --filter @github-picks/collector test -- github-repository.test.ts`

Expected: FAIL because the three GitHub repository adapters do not exist.

- [ ] **Step 3: Add the shared artifact builder and REST adapter**

```ts
// workers/collector/src/artifact.ts
import type { CollectedArtifact, ObservationDraft } from "@github-picks/contracts";
import { requestFingerprint } from "@github-picks/source-sdk";

export function jsonArtifact(input: { sourceId: string; url: string; response: { headers: Record<string, string>; body: Uint8Array }; observedAt: string; eventAt: string | null; observations: ObservationDraft[]; method?: string; requestBody?: string }): CollectedArtifact {
  return { sourceId: input.sourceId, url: input.url, requestFingerprint: requestFingerprint({ url: input.url, method: input.method ?? "GET", body: input.requestBody ?? "" }), contentType: "application/json", body: input.response.body, responseHeaders: input.response.headers, requestBody: input.requestBody ?? null, observedAt: input.observedAt, eventAt: input.eventAt, observations: input.observations };
}
```

```ts
// workers/collector/src/adapters/github-rest.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";

interface GitHubRepository { node_id: string; name: string; full_name: string; owner: { login: string; node_id: string; type: "Organization" | "User" }; fork: boolean; archived: boolean; default_branch: string; stargazers_count: number; updated_at: string; parent?: { node_id: string; full_name: string }; }
interface GitHubContributor { login: string; node_id: string; contributions: number; }

function observations(repo: GitHubRepository): ObservationDraft[] {
  const hint = { type: "repository" as const, nodeId: repo.node_id, owner: repo.owner.login, name: repo.name };
  const values: Array<[string, unknown]> = [["github_node_id", repo.node_id], ["full_name", repo.full_name], ["owner", repo.owner.login], ["owner_identity", { login: repo.owner.login, nodeId: repo.owner.node_id, type: repo.owner.type }], ["name", repo.name], ["is_fork", repo.fork], ["is_archived", repo.archived], ["default_branch", repo.default_branch], ["stars_total", repo.stargazers_count]];
  if (repo.parent) values.push(["fork_parent", { nodeId: repo.parent.node_id, fullName: repo.parent.full_name }]);
  return values.map(([field, value]) => ({ externalId: `${repo.node_id}:${field}`, entityHint: hint, field, value, eventAt: repo.updated_at, confidence: 1, status: "observed" as const }));
}
function contributorObservations(body: Uint8Array, repo: GitHubRepository): ObservationDraft[] {
  return (JSON.parse(new TextDecoder().decode(body)) as GitHubContributor[]).map((contributor) => ({ externalId: `${repo.node_id}:contributor:${contributor.node_id}`, entityHint: { type: "maintainer" as const, nodeId: contributor.node_id, login: contributor.login }, field: "repository_contribution", value: { repositoryNodeId: repo.node_id, repositoryFullName: repo.full_name, contributions: contributor.contributions }, eventAt: repo.updated_at, confidence: 1, status: "observed" as const }));
}

export class GitHubRestAdapter implements SourceAdapter {
  readonly sourceId = "github-rest";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "repository") throw new Error("github-rest requires repository target");
    const url = `https://api.github.com/repos/${request.target.owner}/${request.target.name}`;
    const response = await context.http.request({ url, etag: request.etag, lastModified: request.lastModified });
    if (response.status === 304) return { artifacts: [], nextCursor: request.cursor, nextPollSeconds: null };
    const repo = JSON.parse(new TextDecoder().decode(response.body)) as GitHubRepository;
    const observedAt = context.now().toISOString();
    const contributorsUrl = `${url}/contributors?per_page=100&anon=0`;
    const contributors = await context.http.request({ url: contributorsUrl });
    return { artifacts: [jsonArtifact({ sourceId: this.sourceId, url, response, observedAt, eventAt: repo.updated_at, observations: observations(repo) }), jsonArtifact({ sourceId: this.sourceId, url: contributorsUrl, response: contributors, observedAt, eventAt: repo.updated_at, observations: contributorObservations(contributors.body, repo), requestBody: JSON.stringify({ repositoryNodeId: repo.node_id, repositoryFullName: repo.full_name, updatedAt: repo.updated_at }) })], nextCursor: response.headers.etag ?? null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) {
    if (raw.sourceUrl.includes("/contributors")) {
      const context = JSON.parse(raw.requestBody ?? "{}") as { repositoryNodeId?: string; repositoryFullName?: string; updatedAt?: string };
      if (!context.repositoryNodeId || !context.repositoryFullName) throw new Error("contributors replay context is missing");
      const repository = { node_id: context.repositoryNodeId, full_name: context.repositoryFullName, updated_at: context.updatedAt ?? raw.eventAt ?? raw.observedAt } as GitHubRepository;
      return contributorObservations(raw.body, repository);
    }
    return observations(JSON.parse(new TextDecoder().decode(raw.body)) as GitHubRepository);
  }
}
```

- [ ] **Step 4: Add GraphQL and repository-file adapters**

```ts
// workers/collector/src/adapters/github-graphql.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";

export const REPOSITORY_QUERY = `query RepositoryEvidence($owner:String!,$name:String!){repository(owner:$owner,name:$name,followRenames:true){id nameWithOwner isArchived isFork defaultBranchRef{name target{... on Commit{oid committedDate}}} releases(first:20,orderBy:{field:CREATED_AT,direction:DESC}){nodes{tagName publishedAt isPrerelease}}}}`;
function parseGraphql(body: Uint8Array): ObservationDraft[] {
  const repo = (JSON.parse(new TextDecoder().decode(body)) as { data: { repository: { id: string; nameWithOwner: string; isArchived: boolean; isFork: boolean; defaultBranchRef: { name: string; target: { oid: string; committedDate: string } } | null; releases: { nodes: unknown[] } } } }).data.repository;
  const [owner, name] = repo.nameWithOwner.split("/");
  const hint = { type: "repository" as const, nodeId: repo.id, owner: owner!, name: name! };
  return [["github_node_id", repo.id], ["owner", owner], ["name", name], ["is_fork", repo.isFork], ["is_archived", repo.isArchived], ["default_branch_sha", repo.defaultBranchRef?.target.oid ?? null], ["default_branch_commit_at", repo.defaultBranchRef?.target.committedDate ?? null], ["recent_releases", repo.releases.nodes]].map(([field, value]) => ({ externalId: `${repo.id}:${field}`, entityHint: hint, field: field as string, value, eventAt: repo.defaultBranchRef?.target.committedDate ?? null, confidence: 1, status: value === null ? "missing" as const : "observed" as const }));
}
export class GitHubGraphqlAdapter implements SourceAdapter {
  readonly sourceId = "github-graphql";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "repository") throw new Error("github-graphql requires repository target");
    const url = "https://api.github.com/graphql";
    const body = JSON.stringify({ query: REPOSITORY_QUERY, variables: { owner: request.target.owner, name: request.target.name } });
    const response = await context.http.request({ url, method: "POST", headers: { "content-type": "application/json" }, body });
    return { artifacts: [jsonArtifact({ sourceId: this.sourceId, url, response, observedAt: context.now().toISOString(), eventAt: null, observations: parseGraphql(response.body), method: "POST", requestBody: body })], nextCursor: null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { return parseGraphql(raw.body); }
}
```

```ts
// workers/collector/src/adapters/repository-files.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";
const ARTIFACTS = {
  readme: ["README.md", "README", "README.rst"],
  license: ["LICENSE", "LICENSE.md", "COPYING"],
  security: ["SECURITY.md", ".github/SECURITY.md"],
  contributing: ["CONTRIBUTING.md", ".github/CONTRIBUTING.md"],
  codeowners: ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"],
  workflows: [".github/workflows/"],
} as const;
interface GitTree { sha: string; truncated: boolean; tree: Array<{ path: string; type: string; sha: string }>; }
function parseTree(body: Uint8Array, sourceUrl: string): ObservationDraft[] {
  const tree = JSON.parse(new TextDecoder().decode(body)) as GitTree;
  const match = /repos\/([^/]+)\/([^/]+)\/git\/trees\//.exec(sourceUrl);
  if (!match) throw new Error("invalid Git tree source URL");
  const [owner, name] = [match[1]!, match[2]!];
  return Object.entries(ARTIFACTS).map(([artifact, candidates]) => {
    const found = tree.tree.find((entry) => candidates.some((candidate) => candidate.endsWith("/") ? entry.path.startsWith(candidate) : entry.path.toLowerCase() === candidate.toLowerCase()));
    return { externalId: `${owner}/${name}:artifact:${artifact}:${tree.sha}`, entityHint: { type: "repository" as const, nodeId: null, owner, name }, field: `artifact:${artifact}`, value: found ? { exists: true, path: found.path, sha: found.sha, treeSha: tree.sha, treeTruncated: tree.truncated } : { exists: false, treeSha: tree.sha, treeTruncated: tree.truncated }, eventAt: null, confidence: tree.truncated && !found ? 0.5 : 1, status: found ? "observed" as const : "missing" as const };
  });
}

export class RepositoryFilesAdapter implements SourceAdapter {
  readonly sourceId = "repository-files";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "repository") throw new Error("repository-files requires repository target");
    const ref = encodeURIComponent(request.target.ref ?? "HEAD");
    const url = `https://api.github.com/repos/${request.target.owner}/${request.target.name}/git/trees/${ref}?recursive=1`;
    const response = await context.http.request({ url, etag: request.etag });
    if (response.status === 304) return { artifacts: [], nextCursor: request.cursor, nextPollSeconds: null };
    return { artifacts: [jsonArtifact({ sourceId: this.sourceId, url, response, observedAt: context.now().toISOString(), eventAt: null, observations: parseTree(response.body, url) })], nextCursor: response.headers.etag ?? null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { return parseTree(raw.body, raw.sourceUrl); }
}
```

```ts
// workers/collector/src/adapters/index.ts
import type { SourceAdapter } from "@github-picks/contracts";
import { GitHubGraphqlAdapter } from "./github-graphql.js";
import { GitHubRestAdapter } from "./github-rest.js";
import { RepositoryFilesAdapter } from "./repository-files.js";
export const M1_ADAPTERS: SourceAdapter[] = [new GitHubRestAdapter(), new GitHubGraphqlAdapter(), new RepositoryFilesAdapter()];
export { GitHubGraphqlAdapter, GitHubRestAdapter, RepositoryFilesAdapter };
```

- [ ] **Step 5: Run GitHub adapter tests and commit**

Run: `pnpm install && pnpm --filter @github-picks/collector test -- github-repository.test.ts && pnpm --filter @github-picks/collector typecheck`

Expected: all 3 GitHub repository adapter tests PASS and TypeScript exits 0.

```bash
git add workers/collector pnpm-lock.yaml
git commit -m "feat: collect GitHub repository evidence"
```

### Task 6: Collect Public Events, Hourly History, Trending, and Community Discovery

**Files:**
- Create: `workers/collector/src/adapters/github-events.ts`
- Create: `workers/collector/src/adapters/gharchive.ts`
- Create: `workers/collector/src/adapters/github-trending.ts`
- Create: `workers/collector/src/adapters/hacker-news.ts`
- Create: `workers/collector/test/discovery.test.ts`
- Modify: `workers/collector/src/adapters/index.ts`

**Interfaces:**
- Consumes: `SourceAdapter`, `CollectRequest`, conditional HTTP, `M1_ADAPTERS`.
- Produces: four discovery adapters; GitHub Events returns `nextPollSeconds`; GH Archive emits event observations from immutable gzip bytes.

- [ ] **Step 1: Write failing tests for poll interval, event parsing, and Trending discovery**

```ts
// workers/collector/test/discovery.test.ts
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { GhArchiveAdapter, GitHubEventsAdapter, GitHubTrendingAdapter, HackerNewsAdapter } from "../src/adapters/index.js";
import { fakeContext } from "./fake-context.js";

describe("discovery adapters", () => {
  it("honors GitHub X-Poll-Interval and emits event IDs", async () => {
    const url = "https://api.github.com/events?per_page=100";
    const context = fakeContext({ [url]: { headers: { "x-poll-interval": "60", etag: '"events"' }, body: [{ id: "evt-1", type: "WatchEvent", repo: { id: 1, name: "owner/repo" }, created_at: "2026-08-03T00:00:00Z", payload: {} }] } });
    const batch = await new GitHubEventsAdapter().collect(context, { target: { kind: "discovery", cursor: null }, windowStart: "2026-08-02T00:00:00.000Z", windowEnd: "2026-08-03T00:00:00.000Z", cursor: null, etag: null, lastModified: null });
    expect(batch.nextPollSeconds).toBe(60);
    expect(batch.artifacts[0]?.observations[0]?.externalId).toBe("evt-1");
  });

  it("parses an immutable GH Archive hour", async () => {
    const url = "https://data.gharchive.org/2026-08-03-0.json.gz";
    const body = gzipSync(`${JSON.stringify({ id: "evt-2", type: "PushEvent", repo: { id: 2, name: "owner/repo" }, created_at: "2026-08-03T00:10:00Z", payload: {} })}\n`);
    const context = { now: () => new Date("2026-08-03T01:00:00Z"), http: { rateLimitSnapshot: () => null, request: async () => ({ status: 200, headers: {}, body: new Uint8Array(body) }) } };
    const batch = await new GhArchiveAdapter().collect(context, { target: { kind: "hour", hour: "2026-08-03T00:00:00.000Z" }, windowStart: "2026-08-03T00:00:00.000Z", windowEnd: "2026-08-03T01:00:00.000Z", cursor: null, etag: null, lastModified: null });
    expect(batch.artifacts[0]?.observations[0]?.externalId).toBe("evt-2");
    expect(batch.artifacts[0]?.contentType).toBe("application/gzip");
  });

  it("extracts repository slugs from GitHub Trending HTML", async () => {
    const url = "https://github.com/trending?since=daily";
    const html = '<article class="Box-row"><h2><a href="/owner/repo"> owner / repo </a></h2></article>';
    const context = { now: () => new Date("2026-08-03T00:00:00Z"), http: { rateLimitSnapshot: () => null, request: async () => ({ status: 200, headers: {}, body: new TextEncoder().encode(html) }) } };
    const batch = await new GitHubTrendingAdapter().collect(context, { target: { kind: "discovery", cursor: null }, windowStart: "2026-08-02T00:00:00.000Z", windowEnd: "2026-08-03T00:00:00.000Z", cursor: null, etag: null, lastModified: null });
    expect(batch.artifacts[0]?.observations[0]?.value).toEqual({ fullName: "owner/repo", rank: 1 });
  });

  it("opens the parser circuit when Trending markup no longer matches", async () => {
    const url = "https://github.com/trending?since=daily";
    const context = { now: () => new Date("2026-08-03T00:00:00Z"), http: { rateLimitSnapshot: () => null, request: async () => ({ status: 200, headers: {}, body: new TextEncoder().encode("<html>changed</html>") }) } };
    await expect(new GitHubTrendingAdapter().collect(context, { target: { kind: "discovery", cursor: null }, windowStart: "2026-08-02T00:00:00.000Z", windowEnd: "2026-08-03T00:00:00.000Z", cursor: null, etag: null, lastModified: null })).rejects.toThrow("Trending parser returned zero repositories");
  });

  it("bounds Hacker News item fetches and emits only GitHub links", async () => {
    const topUrl = "https://hacker-news.firebaseio.com/v0/topstories.json";
    const itemUrl = "https://hacker-news.firebaseio.com/v0/item/1.json";
    const context = fakeContext({ [topUrl]: { body: [1] }, [itemUrl]: { body: { id: 1, time: 1785715200, title: "Repository", url: "https://github.com/owner/repo", score: 10, descendants: 2 } } });
    const batch = await new HackerNewsAdapter().collect(context, { target: { kind: "discovery", cursor: null }, windowStart: "2026-08-02T00:00:00.000Z", windowEnd: "2026-08-03T00:00:00.000Z", cursor: null, etag: null, lastModified: null });
    expect(batch.artifacts).toHaveLength(1);
    expect(batch.artifacts[0]?.observations[0]).toEqual(expect.objectContaining({ externalId: "hn:1", field: "community_discussion" }));
  });
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter @github-picks/collector test -- discovery.test.ts`

Expected: FAIL because the four adapters are absent.

- [ ] **Step 3: Implement GitHub Events and GH Archive with shared event parsing**

```ts
// workers/collector/src/adapters/github-events.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";

interface PublicEvent { id: string; type: string; repo: { id: number; name: string }; created_at: string; payload: unknown; }
export function parsePublicEvents(body: Uint8Array): ObservationDraft[] {
  const events = JSON.parse(new TextDecoder().decode(body)) as PublicEvent[];
  return events.map((event) => ({ externalId: event.id, entityHint: { type: "repository" as const, nodeId: null, owner: event.repo.name.split("/")[0]!, name: event.repo.name.split("/")[1]! }, field: "public_event", value: { type: event.type, repoId: event.repo.id, payload: event.payload }, eventAt: event.created_at, confidence: 1, status: "observed" as const }));
}
export class GitHubEventsAdapter implements SourceAdapter {
  readonly sourceId = "github-events";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "discovery") throw new Error("github-events requires discovery target");
    const url = "https://api.github.com/events?per_page=100";
    const response = await context.http.request({ url, etag: request.etag });
    const nextPollSeconds = Number.parseInt(response.headers["x-poll-interval"] ?? "60", 10);
    if (response.status === 304) return { artifacts: [], nextCursor: request.cursor, nextPollSeconds };
    return { artifacts: [jsonArtifact({ sourceId: this.sourceId, url, response, observedAt: context.now().toISOString(), eventAt: null, observations: parsePublicEvents(response.body) })], nextCursor: response.headers.etag ?? null, nextPollSeconds };
  }
  async parse(raw: ReplayRawObject) { return parsePublicEvents(raw.body); }
}
```

```ts
// workers/collector/src/adapters/gharchive.ts
import { gunzipSync } from "node:zlib";
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { requestFingerprint } from "@github-picks/source-sdk";
import { parsePublicEvents } from "./github-events.js";

function parseArchive(body: Uint8Array): ObservationDraft[] {
  const events = new TextDecoder().decode(gunzipSync(body)).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  return parsePublicEvents(new TextEncoder().encode(JSON.stringify(events)));
}
export class GhArchiveAdapter implements SourceAdapter {
  readonly sourceId = "gharchive";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "hour") throw new Error("gharchive requires hour target");
    const hour = new Date(request.target.hour);
    const url = `https://data.gharchive.org/${hour.toISOString().slice(0, 10)}-${hour.getUTCHours()}.json.gz`;
    const response = await context.http.request({ url });
    return { artifacts: [{ sourceId: this.sourceId, url, requestFingerprint: requestFingerprint({ url }), contentType: "application/gzip", body: response.body, responseHeaders: response.headers, requestBody: null, observedAt: context.now().toISOString(), eventAt: request.target.hour, observations: parseArchive(response.body) }], nextCursor: null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { return parseArchive(raw.body); }
}
```

- [ ] **Step 4: Implement GitHub Trending and bounded Hacker News discovery**

```ts
// workers/collector/src/adapters/github-trending.ts
import { load } from "cheerio";
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { requestFingerprint } from "@github-picks/source-sdk";

function parseTrending(body: Uint8Array, observedAt: string): ObservationDraft[] {
  const $ = load(new TextDecoder().decode(body));
  return $("article.Box-row h2 a").toArray().map((node, index) => {
    const fullName = ($(node).attr("href") ?? "").replace(/^\//, "").trim();
    const [owner, name] = fullName.split("/");
    return { externalId: `${observedAt}:${fullName}`, entityHint: { type: "repository" as const, nodeId: null, owner: owner!, name: name! }, field: "trending_daily", value: { fullName, rank: index + 1 }, eventAt: observedAt, confidence: 0.7, status: "observed" as const };
  }).filter((row) => row.value.fullName.includes("/"));
}
export class GitHubTrendingAdapter implements SourceAdapter {
  readonly sourceId = "github-trending";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "discovery") throw new Error("github-trending requires discovery target");
    const url = "https://github.com/trending?since=daily";
    const response = await context.http.request({ url, headers: { accept: "text/html" }, etag: request.etag });
    const observedAt = context.now().toISOString();
    if (response.status === 304) return { artifacts: [], nextCursor: request.cursor, nextPollSeconds: null };
    const observations = parseTrending(response.body, observedAt);
    if (observations.length === 0) throw new Error("Trending parser returned zero repositories");
    return { artifacts: [{ sourceId: this.sourceId, url, requestFingerprint: requestFingerprint({ url }), contentType: "text/html", body: response.body, responseHeaders: response.headers, requestBody: null, observedAt, eventAt: observedAt, observations }], nextCursor: response.headers.etag ?? null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { return parseTrending(raw.body, raw.observedAt); }
}
```

```ts
// workers/collector/src/adapters/hacker-news.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";

interface HnItem { id: number; time: number; title?: string; url?: string; score?: number; descendants?: number; }
function githubSlug(url: string): string | null { return /^https?:\/\/github\.com\/([^/]+\/[^/#?]+)/.exec(url)?.[1] ?? null; }
function parseItem(item: HnItem): ObservationDraft[] {
  const slug = item.url ? githubSlug(item.url) : null;
  if (!slug) return [];
  const [owner, name] = slug.split("/");
  return [{ externalId: `hn:${item.id}`, entityHint: { type: "repository" as const, nodeId: null, owner: owner!, name: name! }, field: "community_discussion", value: { title: item.title, url: item.url, score: item.score, comments: item.descendants }, eventAt: new Date(item.time * 1000).toISOString(), confidence: 0.7, status: "observed" as const }];
}
export class HackerNewsAdapter implements SourceAdapter {
  readonly sourceId = "hacker-news";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "discovery") throw new Error("hacker-news requires discovery target");
    const topUrl = "https://hacker-news.firebaseio.com/v0/topstories.json";
    const top = await context.http.request({ url: topUrl, etag: request.etag });
    if (top.status === 304) return { artifacts: [], nextCursor: request.cursor, nextPollSeconds: null };
    const ids = (JSON.parse(new TextDecoder().decode(top.body)) as number[]).slice(0, 30);
    const artifacts = [];
    for (const id of ids) {
      const url = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
      const response = await context.http.request({ url });
      const item = JSON.parse(new TextDecoder().decode(response.body)) as HnItem;
      artifacts.push(jsonArtifact({ sourceId: this.sourceId, url, response, observedAt: context.now().toISOString(), eventAt: new Date(item.time * 1000).toISOString(), observations: parseItem(item) }));
    }
    return { artifacts, nextCursor: top.headers.etag ?? null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { return parseItem(JSON.parse(new TextDecoder().decode(raw.body)) as HnItem); }
}
```

```ts
// workers/collector/src/adapters/index.ts after Task 6
import type { SourceAdapter } from "@github-picks/contracts";
import { GhArchiveAdapter } from "./gharchive.js";
import { GitHubEventsAdapter } from "./github-events.js";
import { GitHubGraphqlAdapter } from "./github-graphql.js";
import { GitHubRestAdapter } from "./github-rest.js";
import { GitHubTrendingAdapter } from "./github-trending.js";
import { HackerNewsAdapter } from "./hacker-news.js";
import { RepositoryFilesAdapter } from "./repository-files.js";
export const M1_ADAPTERS: SourceAdapter[] = [new GitHubRestAdapter(), new GitHubGraphqlAdapter(), new RepositoryFilesAdapter(), new GitHubEventsAdapter(), new GhArchiveAdapter(), new GitHubTrendingAdapter(), new HackerNewsAdapter()];
export { GhArchiveAdapter, GitHubEventsAdapter, GitHubGraphqlAdapter, GitHubRestAdapter, GitHubTrendingAdapter, HackerNewsAdapter, RepositoryFilesAdapter };
```

- [ ] **Step 5: Run discovery tests and commit**

Run: `pnpm --filter @github-picks/collector test -- discovery.test.ts && pnpm --filter @github-picks/collector typecheck`

Expected: 5 tests PASS and TypeScript exits 0.

```bash
git add workers/collector
git commit -m "feat: collect GitHub and community discovery signals"
```

### Task 7: Collect npm, PyPI, and crates.io Package Evidence

**Files:**
- Create: `workers/collector/src/adapters/npm.ts`
- Create: `workers/collector/src/adapters/pypi.ts`
- Create: `workers/collector/src/adapters/crates.ts`
- Create: `workers/collector/test/package-registries.test.ts`
- Modify: `workers/collector/src/adapters/index.ts`

**Interfaces:**
- Consumes: package `CollectRequest` and `jsonArtifact`.
- Produces: package version, download/adoption, and candidate repository URL observations under `npm`, `pypi`, and `crates` source IDs.

- [ ] **Step 1: Write failing registry normalization tests**

```ts
// workers/collector/test/package-registries.test.ts
import { describe, expect, it } from "vitest";
import { CratesAdapter, NpmAdapter, PyPiAdapter } from "../src/adapters/index.js";
import { fakeContext } from "./fake-context.js";

const base = { windowStart: "2026-08-02T00:00:00.000Z", windowEnd: "2026-08-03T00:00:00.000Z", cursor: null, etag: null, lastModified: null };
describe("package registries", () => {
  it("normalizes npm metadata and downloads", async () => {
    const context = fakeContext({
      "https://registry.npmjs.org/zod": { body: { name: "zod", "dist-tags": { latest: "4.4.3" }, time: { modified: "2026-08-02T00:00:00Z" }, repository: { url: "git+https://github.com/colinhacks/zod.git" } } },
      "https://api.npmjs.org/downloads/point/last-month/zod": { body: { downloads: 123456, package: "zod", start: "2026-07-03", end: "2026-08-02" } },
    });
    const batch = await new NpmAdapter().collect(context, { ...base, target: { kind: "package", ecosystem: "npm", name: "zod" } });
    expect(batch.artifacts.flatMap((artifact) => artifact.observations)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "latest_version", value: "4.4.3" }),
      expect.objectContaining({ field: "downloads_last_month", value: 123456 }),
    ]));
  });

  it("preserves PyPI and crates repository candidates", async () => {
    const pypi = fakeContext({ "https://pypi.org/pypi/requests/json": { body: { info: { name: "requests", version: "2.33.0", project_urls: { Source: "https://github.com/psf/requests" } }, releases: {}, urls: [] } } });
    const crates = fakeContext({ "https://crates.io/api/v1/crates/serde": { body: { crate: { id: "serde", newest_version: "1.0.230", downloads: 1000, repository: "https://github.com/serde-rs/serde", updated_at: "2026-08-02T00:00:00Z" }, versions: [] } } });
    expect((await new PyPiAdapter().collect(pypi, { ...base, target: { kind: "package", ecosystem: "pypi", name: "requests" } })).artifacts[0]?.observations.some((row) => row.field === "candidate_repository_url")).toBe(true);
    expect((await new CratesAdapter().collect(crates, { ...base, target: { kind: "package", ecosystem: "cargo", name: "serde" } })).artifacts[0]?.observations.some((row) => row.field === "candidate_repository_url")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter @github-picks/collector test -- package-registries.test.ts`

Expected: FAIL because registry adapters are absent.

- [ ] **Step 3: Implement npm metadata and download artifacts**

```ts
// workers/collector/src/adapters/npm.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";
function hint(name: string) { return { type: "package" as const, ecosystem: "npm", name }; }
function parseMetadata(body: Uint8Array): ObservationDraft[] {
  const value = JSON.parse(new TextDecoder().decode(body)) as { name: string; "dist-tags"?: { latest?: string }; time?: { modified?: string }; repository?: { url?: string } | string };
  const repository = typeof value.repository === "string" ? value.repository : value.repository?.url;
  return [
    { externalId: `npm:${value.name}:latest`, entityHint: hint(value.name), field: "latest_version", value: value["dist-tags"]?.latest ?? null, eventAt: value.time?.modified ?? null, confidence: 1, status: value["dist-tags"]?.latest ? "observed" as const : "missing" as const },
    { externalId: `npm:${value.name}:repository`, entityHint: hint(value.name), field: "candidate_repository_url", value: repository ?? null, eventAt: value.time?.modified ?? null, confidence: repository ? 0.8 : 0, status: repository ? "observed" as const : "missing" as const },
  ];
}
function parseDownloads(body: Uint8Array): ObservationDraft[] {
  const value = JSON.parse(new TextDecoder().decode(body)) as { package: string; downloads: number; start: string; end: string };
  return [{ externalId: `npm:${value.package}:downloads:${value.start}:${value.end}`, entityHint: hint(value.package), field: "downloads_last_month", value: value.downloads, eventAt: `${value.end}T23:59:59.000Z`, confidence: 1, status: "observed" as const }];
}
export class NpmAdapter implements SourceAdapter {
  readonly sourceId = "npm";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "package" || request.target.ecosystem !== "npm") throw new Error("npm requires npm package target");
    const name = encodeURIComponent(request.target.name);
    const metadataUrl = `https://registry.npmjs.org/${name}`;
    const downloadsUrl = `https://api.npmjs.org/downloads/point/last-month/${name}`;
    const metadata = await context.http.request({ url: metadataUrl, etag: request.etag });
    const downloads = await context.http.request({ url: downloadsUrl });
    const observedAt = context.now().toISOString();
    const artifacts = [jsonArtifact({ sourceId: this.sourceId, url: downloadsUrl, response: downloads, observedAt, eventAt: null, observations: parseDownloads(downloads.body) })];
    if (metadata.status !== 304) artifacts.unshift(jsonArtifact({ sourceId: this.sourceId, url: metadataUrl, response: metadata, observedAt, eventAt: null, observations: parseMetadata(metadata.body) }));
    return { artifacts, nextCursor: metadata.headers.etag ?? request.cursor, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { return raw.sourceUrl.includes("downloads") ? parseDownloads(raw.body) : parseMetadata(raw.body); }
}
```

- [ ] **Step 4: Implement PyPI and crates.io adapters**

```ts
// workers/collector/src/adapters/pypi.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";
function parsePyPi(body: Uint8Array): ObservationDraft[] {
  const value = JSON.parse(new TextDecoder().decode(body)) as { info: { name: string; version: string; project_urls?: Record<string, string> }; releases: Record<string, unknown>; urls: unknown[] };
  const repository = Object.entries(value.info.project_urls ?? {}).find(([key, url]) => /source|repository|code/i.test(key) || /github\.com/i.test(url))?.[1];
  const entityHint = { type: "package" as const, ecosystem: "pypi", name: value.info.name };
  return [
    { externalId: `pypi:${value.info.name}:latest`, entityHint, field: "latest_version", value: value.info.version, eventAt: null, confidence: 1, status: "observed" as const },
    { externalId: `pypi:${value.info.name}:repository`, entityHint, field: "candidate_repository_url", value: repository ?? null, eventAt: null, confidence: repository ? 0.8 : 0, status: repository ? "observed" as const : "missing" as const },
    { externalId: `pypi:${value.info.name}:releases`, entityHint, field: "release_versions", value: Object.keys(value.releases), eventAt: null, confidence: 1, status: "observed" as const },
  ];
}
export class PyPiAdapter implements SourceAdapter {
  readonly sourceId = "pypi";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "package" || request.target.ecosystem !== "pypi") throw new Error("pypi requires pypi package target");
    const url = `https://pypi.org/pypi/${encodeURIComponent(request.target.name)}/json`;
    const response = await context.http.request({ url, etag: request.etag });
    if (response.status === 304) return { artifacts: [], nextCursor: request.cursor, nextPollSeconds: null };
    return { artifacts: [jsonArtifact({ sourceId: this.sourceId, url, response, observedAt: context.now().toISOString(), eventAt: null, observations: parsePyPi(response.body) })], nextCursor: response.headers.etag ?? null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { return parsePyPi(raw.body); }
}
```

```ts
// workers/collector/src/adapters/crates.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";
function parseCrate(body: Uint8Array): ObservationDraft[] {
  const value = JSON.parse(new TextDecoder().decode(body)) as { crate: { id: string; newest_version: string; downloads: number; repository?: string; updated_at: string }; versions: unknown[] };
  const entityHint = { type: "package" as const, ecosystem: "cargo", name: value.crate.id };
  return [
    { externalId: `cargo:${value.crate.id}:latest`, entityHint, field: "latest_version", value: value.crate.newest_version, eventAt: value.crate.updated_at, confidence: 1, status: "observed" as const },
    { externalId: `cargo:${value.crate.id}:downloads`, entityHint, field: "downloads_total", value: value.crate.downloads, eventAt: value.crate.updated_at, confidence: 1, status: "observed" as const },
    { externalId: `cargo:${value.crate.id}:repository`, entityHint, field: "candidate_repository_url", value: value.crate.repository ?? null, eventAt: value.crate.updated_at, confidence: value.crate.repository ? 0.8 : 0, status: value.crate.repository ? "observed" as const : "missing" as const },
  ];
}
export class CratesAdapter implements SourceAdapter {
  readonly sourceId = "crates";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "package" || request.target.ecosystem !== "cargo") throw new Error("crates requires cargo package target");
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(request.target.name)}`;
    const response = await context.http.request({ url, etag: request.etag });
    if (response.status === 304) return { artifacts: [], nextCursor: request.cursor, nextPollSeconds: null };
    return { artifacts: [jsonArtifact({ sourceId: this.sourceId, url, response, observedAt: context.now().toISOString(), eventAt: null, observations: parseCrate(response.body) })], nextCursor: response.headers.etag ?? null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { return parseCrate(raw.body); }
}
```

```ts
// workers/collector/src/adapters/index.ts after Task 7
import type { SourceAdapter } from "@github-picks/contracts";
import { CratesAdapter } from "./crates.js";
import { GhArchiveAdapter } from "./gharchive.js";
import { GitHubEventsAdapter } from "./github-events.js";
import { GitHubGraphqlAdapter } from "./github-graphql.js";
import { GitHubRestAdapter } from "./github-rest.js";
import { GitHubTrendingAdapter } from "./github-trending.js";
import { HackerNewsAdapter } from "./hacker-news.js";
import { NpmAdapter } from "./npm.js";
import { PyPiAdapter } from "./pypi.js";
import { RepositoryFilesAdapter } from "./repository-files.js";
export const M1_ADAPTERS: SourceAdapter[] = [new GitHubRestAdapter(), new GitHubGraphqlAdapter(), new RepositoryFilesAdapter(), new GitHubEventsAdapter(), new GhArchiveAdapter(), new GitHubTrendingAdapter(), new HackerNewsAdapter(), new NpmAdapter(), new PyPiAdapter(), new CratesAdapter()];
export { CratesAdapter, GhArchiveAdapter, GitHubEventsAdapter, GitHubGraphqlAdapter, GitHubRestAdapter, GitHubTrendingAdapter, HackerNewsAdapter, NpmAdapter, PyPiAdapter, RepositoryFilesAdapter };
```

- [ ] **Step 5: Verify registry contracts and commit**

Run: `pnpm --filter @github-picks/collector test -- package-registries.test.ts && pnpm --filter @github-picks/collector typecheck`

Expected: 2 tests PASS and TypeScript exits 0.

```bash
git add workers/collector
git commit -m "feat: collect package registry evidence"
```

### Task 8: Collect OpenSSF Scorecard, OSV, and deps.dev Evidence

**Files:**
- Create: `workers/collector/src/adapters/openssf-scorecard.ts`
- Create: `workers/collector/src/adapters/osv.ts`
- Create: `workers/collector/src/adapters/deps-dev.ts`
- Create: `workers/collector/test/security-dependency.test.ts`
- Modify: `workers/collector/src/adapters/index.ts`

**Interfaces:**
- Consumes: repository/package targets and official public APIs.
- Produces: Scorecard check observations, OSV vulnerability references, and deps.dev package/version metadata. These are evidence only; M1 does not compute a risk penalty.

- [ ] **Step 1: Write failing official-API tests**

```ts
// workers/collector/test/security-dependency.test.ts
import { describe, expect, it } from "vitest";
import { DepsDevAdapter, OpenSsfScorecardAdapter, OsvAdapter } from "../src/adapters/index.js";
import { fakeContext } from "./fake-context.js";
const base = { windowStart: "2026-08-02T00:00:00.000Z", windowEnd: "2026-08-03T00:00:00.000Z", cursor: null, etag: null, lastModified: null };

describe("security and dependency adapters", () => {
  it("preserves individual Scorecard checks instead of only aggregate score", async () => {
    const url = "https://api.scorecard.dev/projects/github.com/ossf/scorecard";
    const context = fakeContext({ [url]: { body: { date: "2026-08-02T02:19:41Z", repo: { name: "github.com/ossf/scorecard" }, score: 8.2, checks: [{ name: "Maintained", score: 10, reason: "recent commits", details: null }] } } });
    const rows = (await new OpenSsfScorecardAdapter().collect(context, { ...base, target: { kind: "repository", owner: "ossf", name: "scorecard" } })).artifacts[0]!.observations;
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ field: "scorecard_check:Maintained", eventAt: "2026-08-02T02:19:41Z", value: expect.objectContaining({ score: 10 }) })]));
  });

  it("queries OSV by ecosystem/name/version and deps.dev by canonical package", async () => {
    const osvUrl = "https://api.osv.dev/v1/query";
    const depsUrl = "https://api.deps.dev/v3alpha/systems/PYPI/packages/jinja2";
    const context = fakeContext({ [osvUrl]: { body: { vulns: [{ id: "PYSEC-2021-1", modified: "2026-08-01T00:00:00Z" }] } }, [depsUrl]: { body: { packageKey: { system: "PYPI", name: "jinja2" }, versions: [] } } });
    expect((await new OsvAdapter().collect(context, { ...base, target: { kind: "package", ecosystem: "pypi", name: "jinja2", version: "2.4.1" } })).artifacts[0]?.observations[0]?.field).toBe("known_vulnerabilities");
    expect((await new DepsDevAdapter().collect(context, { ...base, target: { kind: "package", ecosystem: "pypi", name: "jinja2" } })).artifacts[0]?.observations[0]?.field).toBe("deps_dev_package");
  });
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter @github-picks/collector test -- security-dependency.test.ts`

Expected: FAIL because security/dependency adapters are absent.

- [ ] **Step 3: Implement OpenSSF Scorecard with individual checks**

```ts
// workers/collector/src/adapters/openssf-scorecard.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";
function parseScorecard(body: Uint8Array, owner: string, name: string): ObservationDraft[] {
  const value = JSON.parse(new TextDecoder().decode(body)) as { date: string; score: number; checks: Array<{ name: string; score: number; reason: string; details?: string[] | null }> };
  const hint = { type: "repository" as const, nodeId: null, owner, name };
  const eventAt = value.date.includes("T") ? value.date : `${value.date}T00:00:00.000Z`;
  return [
    { externalId: `${owner}/${name}:scorecard:${value.date}`, entityHint: hint, field: "scorecard_aggregate", value: value.score, eventAt, confidence: 0.9, status: "observed" as const },
    ...value.checks.map((check) => ({ externalId: `${owner}/${name}:scorecard:${value.date}:${check.name}`, entityHint: hint, field: `scorecard_check:${check.name}`, value: { score: check.score, reason: check.reason, details: check.details ?? [] }, eventAt, confidence: 0.9, status: "observed" as const })),
  ];
}
export class OpenSsfScorecardAdapter implements SourceAdapter {
  readonly sourceId = "openssf-scorecard";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "repository") throw new Error("openssf-scorecard requires repository target");
    const url = `https://api.scorecard.dev/projects/github.com/${request.target.owner}/${request.target.name}`;
    const response = await context.http.request({ url, etag: request.etag });
    if (response.status === 304) return { artifacts: [], nextCursor: request.cursor, nextPollSeconds: null };
    return { artifacts: [jsonArtifact({ sourceId: this.sourceId, url, response, observedAt: context.now().toISOString(), eventAt: null, observations: parseScorecard(response.body, request.target.owner, request.target.name) })], nextCursor: response.headers.etag ?? null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { const match = /github\.com\/([^/]+)\/([^/?]+)/.exec(raw.sourceUrl); if (!match) throw new Error("invalid Scorecard source URL"); return parseScorecard(raw.body, match[1]!, match[2]!); }
}
```

- [ ] **Step 4: Implement OSV and deps.dev package queries**

```ts
// workers/collector/src/adapters/osv.ts
import type { CollectedArtifact, CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";
const OSV_ECOSYSTEM = { npm: "npm", pypi: "PyPI", cargo: "crates.io" } as const;
function parseOsv(body: Uint8Array, ecosystem: "npm" | "pypi" | "cargo", name: string): ObservationDraft[] {
  const value = JSON.parse(new TextDecoder().decode(body)) as { vulns?: Array<{ id: string; modified: string; aliases?: string[] }>; next_page_token?: string };
  return [{ externalId: `${ecosystem}:${name}:osv:${value.next_page_token ?? "final"}`, entityHint: { type: "package" as const, ecosystem, name }, field: "known_vulnerabilities", value: { vulnerabilities: value.vulns ?? [], nextPageToken: value.next_page_token ?? null }, eventAt: value.vulns?.map((vulnerability) => vulnerability.modified).sort().at(-1) ?? null, confidence: 1, status: "observed" as const }];
}
export class OsvAdapter implements SourceAdapter {
  readonly sourceId = "osv";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "package") throw new Error("osv requires package target");
    const url = "https://api.osv.dev/v1/query";
    const artifacts: CollectedArtifact[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 100; page += 1) {
      const body = JSON.stringify({ version: request.target.version, package: { name: request.target.name, ecosystem: OSV_ECOSYSTEM[request.target.ecosystem] }, ...(pageToken ? { page_token: pageToken } : {}) });
      const response = await context.http.request({ url, method: "POST", headers: { "content-type": "application/json" }, body });
      artifacts.push(jsonArtifact({ sourceId: this.sourceId, url, response, observedAt: context.now().toISOString(), eventAt: null, observations: parseOsv(response.body, request.target.ecosystem, request.target.name), method: "POST", requestBody: body }));
      pageToken = (JSON.parse(new TextDecoder().decode(response.body)) as { next_page_token?: string }).next_page_token;
      if (!pageToken) return { artifacts, nextCursor: null, nextPollSeconds: null };
    }
    throw new Error("OSV pagination exceeded 100 pages");
  }
  async parse(raw: ReplayRawObject) { const request = JSON.parse(raw.requestBody ?? "{}") as { package?: { name?: string; ecosystem?: string } }; const ecosystem = request.package?.ecosystem === "PyPI" ? "pypi" : request.package?.ecosystem === "crates.io" ? "cargo" : "npm"; return parseOsv(raw.body, ecosystem, request.package?.name ?? "unknown"); }
}
```

```ts
// workers/collector/src/adapters/deps-dev.ts
import type { CollectRequest, ObservationDraft, ReplayRawObject, SourceAdapter } from "@github-picks/contracts";
import { jsonArtifact } from "../artifact.js";
const SYSTEM = { npm: "NPM", pypi: "PYPI", cargo: "CARGO" } as const;
function parseDeps(body: Uint8Array, ecosystem: "npm" | "pypi" | "cargo", name: string): ObservationDraft[] {
  return [{ externalId: `${ecosystem}:${name}:deps-dev`, entityHint: { type: "package" as const, ecosystem, name }, field: "deps_dev_package", value: JSON.parse(new TextDecoder().decode(body)), eventAt: null, confidence: 1, status: "observed" as const }];
}
export class DepsDevAdapter implements SourceAdapter {
  readonly sourceId = "deps-dev";
  async collect(context: Parameters<SourceAdapter["collect"]>[0], request: CollectRequest) {
    if (request.target.kind !== "package") throw new Error("deps-dev requires package target");
    const url = `https://api.deps.dev/v3alpha/systems/${SYSTEM[request.target.ecosystem]}/packages/${encodeURIComponent(request.target.name)}`;
    const response = await context.http.request({ url, etag: request.etag });
    if (response.status === 304) return { artifacts: [], nextCursor: request.cursor, nextPollSeconds: null };
    return { artifacts: [jsonArtifact({ sourceId: this.sourceId, url, response, observedAt: context.now().toISOString(), eventAt: null, observations: parseDeps(response.body, request.target.ecosystem, request.target.name) })], nextCursor: response.headers.etag ?? null, nextPollSeconds: null };
  }
  async parse(raw: ReplayRawObject) { const match = /systems\/(NPM|PYPI|CARGO)\/packages\/([^/?]+)/.exec(raw.sourceUrl); if (!match) throw new Error("invalid deps.dev source URL"); const ecosystem = match[1] === "PYPI" ? "pypi" : match[1] === "CARGO" ? "cargo" : "npm"; return parseDeps(raw.body, ecosystem, decodeURIComponent(match[2]!)); }
}
```

```ts
// workers/collector/src/adapters/index.ts after Task 8
import type { SourceAdapter } from "@github-picks/contracts";
import { CratesAdapter } from "./crates.js";
import { DepsDevAdapter } from "./deps-dev.js";
import { GhArchiveAdapter } from "./gharchive.js";
import { GitHubEventsAdapter } from "./github-events.js";
import { GitHubGraphqlAdapter } from "./github-graphql.js";
import { GitHubRestAdapter } from "./github-rest.js";
import { GitHubTrendingAdapter } from "./github-trending.js";
import { HackerNewsAdapter } from "./hacker-news.js";
import { NpmAdapter } from "./npm.js";
import { OpenSsfScorecardAdapter } from "./openssf-scorecard.js";
import { OsvAdapter } from "./osv.js";
import { PyPiAdapter } from "./pypi.js";
import { RepositoryFilesAdapter } from "./repository-files.js";
export const M1_ADAPTERS: SourceAdapter[] = [new GitHubRestAdapter(), new GitHubGraphqlAdapter(), new RepositoryFilesAdapter(), new GitHubEventsAdapter(), new GhArchiveAdapter(), new GitHubTrendingAdapter(), new HackerNewsAdapter(), new NpmAdapter(), new PyPiAdapter(), new CratesAdapter(), new OpenSsfScorecardAdapter(), new OsvAdapter(), new DepsDevAdapter()];
export { CratesAdapter, DepsDevAdapter, GhArchiveAdapter, GitHubEventsAdapter, GitHubGraphqlAdapter, GitHubRestAdapter, GitHubTrendingAdapter, HackerNewsAdapter, NpmAdapter, OpenSsfScorecardAdapter, OsvAdapter, PyPiAdapter, RepositoryFilesAdapter };
```

- [ ] **Step 5: Verify security/dependency adapters and commit**

Run: `pnpm --filter @github-picks/collector test -- security-dependency.test.ts && pnpm --filter @github-picks/collector typecheck`

Expected: 2 tests PASS and TypeScript exits 0.

```bash
git add workers/collector
git commit -m "feat: collect security and dependency evidence"
```

### Task 9: Resolve Stable Repository Identities, Aliases, Forks, and Package Links

**Files:**
- Create: `packages/entity-resolver/package.json`
- Create: `packages/entity-resolver/tsconfig.json`
- Create: `packages/entity-resolver/src/types.ts`
- Create: `packages/entity-resolver/src/github-url.ts`
- Create: `packages/entity-resolver/src/pg-entity-resolver.ts`
- Create: `packages/entity-resolver/src/index.ts`
- Create: `packages/entity-resolver/test/entity-resolver.integration.test.ts`

**Interfaces:**
- Consumes: PostgreSQL entity tables and source observation IDs.
- Produces: `PgEntityResolver.resolveRawSnapshot(rawSnapshotId)`, `resolveRepository(input)`, `resolveMaintainerContribution(input)`, and `resolvePackageLink(input)`.

- [ ] **Step 1: Add package metadata and a failing rename/transfer integration test**

```json
// packages/entity-resolver/package.json
{
  "name": "@github-picks/entity-resolver",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "build": "tsc -p tsconfig.json", "typecheck": "tsc -p tsconfig.json --noEmit", "test": "vitest run" },
  "dependencies": { "pg": "8.22.0" },
  "devDependencies": { "@types/pg": "8.20.3" }
}
```

```json
// packages/entity-resolver/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "outDir": "dist" }, "include": ["src/**/*.ts", "test/**/*.ts"] }
```

```ts
// packages/entity-resolver/test/entity-resolver.integration.test.ts
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { githubSlugFromUrl, PgEntityResolver } from "../src/index.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let observationId: string;
let rawSnapshotId: string;
const fixture = randomUUID();
beforeAll(async () => {
  const run = await pool.query<{ ingestion_run_id: string }>(`insert into ingestion_run(source_id,resource_key,window_start,window_end,collector_version,request_fingerprint,result_state) values('github-rest',$1,'2026-08-03','2026-08-04','v1',$2,'succeeded') returning ingestion_run_id`, [`repo-${fixture}`, `resolver-fixture-${fixture}`]);
  const raw = await pool.query<{ raw_snapshot_id: string }>(`insert into raw_snapshot(ingestion_run_id,source_id,object_ref,content_hash,content_type,size_bytes,source_url,observed_at,parser_version) values($1,'github-rest',$2,'hash','application/json',2,'https://example.com','2026-08-03','v1.0.0') returning raw_snapshot_id`, [run.rows[0]!.ingestion_run_id, `raw/github-rest/${fixture}`]);
  rawSnapshotId = raw.rows[0]!.raw_snapshot_id;
  const observation = await pool.query<{ observation_id: string }>(`insert into source_observation(raw_snapshot_id,source_id,external_id,entity_hint,field,value,status,observed_at,parser_version,confidence) values($1,'github-rest',$2,'{}','identity','{}','observed','2026-08-03','v1.0.0',1) returning observation_id`, [raw.rows[0]!.raw_snapshot_id, `repo-identity-${fixture}`]);
  observationId = observation.rows[0]!.observation_id;
});
afterAll(async () => pool.end());

describe("PgEntityResolver", () => {
  it("normalizes HTTPS npm and SSH GitHub repository URLs", () => {
    expect(githubSlugFromUrl("git+https://github.com/Owner/Repo.git/")).toEqual({ owner: "Owner", name: "Repo" });
    expect(githubSlugFromUrl("git@github.com:Owner/Repo.git")).toEqual({ owner: "Owner", name: "Repo" });
  });

  it("keeps one entity across rename and organization transfer", async () => {
    const resolver = new PgEntityResolver(pool);
    const first = await resolver.resolveRepository({ nodeId: `R_${fixture}`, owner: "old-org", name: "old-name", ownerNodeId: `O_OLD_${fixture}`, ownerType: "Organization", isFork: false, isArchived: false, parent: null, observedAt: "2026-08-03T01:00:00Z", sourceObservationId: observationId });
    const second = await resolver.resolveRepository({ nodeId: `R_${fixture}`, owner: "new-org", name: "new-name", ownerNodeId: `O_NEW_${fixture}`, ownerType: "Organization", isFork: false, isArchived: false, parent: null, observedAt: "2026-08-04T01:00:00Z", sourceObservationId: observationId });
    expect(second).toBe(first);
    const aliases = await pool.query(`select owner,name,valid_to from repository_alias where repository_id=$1 order by valid_from`, [first]);
    expect(aliases.rows).toEqual([{ owner: "old-org", name: "old-name", valid_to: new Date("2026-08-04T01:00:00Z") }, { owner: "new-org", name: "new-name", valid_to: null }]);
    const organizations = await pool.query(`select github_node_id,login from organization where github_node_id in ($1,$2) order by login`, [`O_OLD_${fixture}`, `O_NEW_${fixture}`]);
    expect(organizations.rows).toEqual([{ github_node_id: `O_NEW_${fixture}`, login: "new-org" }, { github_node_id: `O_OLD_${fixture}`, login: "old-org" }]);
  });

  it("links contributor identity to the stable repository", async () => {
    await pool.query(
      `insert into source_observation(raw_snapshot_id,source_id,external_id,entity_hint,field,value,status,observed_at,parser_version,confidence)
       values($1,'github-rest',$2,$3,'repository_contribution',$4,'observed','2026-08-04T02:00:00Z','v1.0.0',1)`,
      [rawSnapshotId, `contributor-${fixture}`, { type: "maintainer", nodeId: `U_${fixture}`, login: `maintainer-${fixture}` }, { repositoryNodeId: `R_${fixture}`, repositoryFullName: "new-org/new-name", contributions: 42 }],
    );
    const result = await new PgEntityResolver(pool).resolveRawSnapshot(rawSnapshotId);
    expect(result.maintainers).toBe(1);
    const links = await pool.query(`select m.github_node_id,m.login,rm.contributions from repository_maintainer rm join maintainer m using(maintainer_id) join repository r using(repository_id) where r.github_node_id=$1`, [`R_${fixture}`]);
    expect(links.rows).toEqual([{ github_node_id: `U_${fixture}`, login: `maintainer-${fixture}`, contributions: 42 }]);
  });
});
```

- [ ] **Step 2: Run the integration test and verify failure**

Run: `set -a && source .env && set +a && pnpm --filter @github-picks/entity-resolver test`

Expected: FAIL because `PgEntityResolver` is absent.

- [ ] **Step 3: Define resolver inputs and normalize GitHub repository URLs**

```ts
// packages/entity-resolver/src/types.ts
export interface RepositoryIdentityInput {
  nodeId: string;
  owner: string;
  name: string;
  ownerNodeId: string | null;
  ownerType: "Organization" | "User" | null;
  isFork: boolean;
  isArchived: boolean;
  parent: { nodeId: string | null; fullName: string } | null;
  observedAt: string;
  sourceObservationId: string;
}
export interface PackageLinkInput {
  ecosystem: "npm" | "pypi" | "cargo";
  packageName: string;
  candidateRepositoryUrl: string;
  confidence: number;
  observedAt: string;
  sourceObservationId: string;
}
export interface MaintainerContributionInput {
  repositoryNodeId: string;
  maintainerNodeId: string | null;
  login: string;
  contributions: number;
  observedAt: string;
  sourceObservationId: string;
}
```

```ts
// packages/entity-resolver/src/github-url.ts
export function githubSlugFromUrl(value: string): { owner: string; name: string } | null {
  const ssh = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(value);
  if (ssh) return { owner: ssh[1]!, name: ssh[2]! };
  try {
    const url = new URL(value.replace(/^git\+/, "").replace(/^git:\/\//, "https://"));
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const [owner, rawName] = url.pathname.split("/").filter(Boolean);
    if (!owner || !rawName) return null;
    return { owner: decodeURIComponent(owner), name: decodeURIComponent(rawName.replace(/\.git$/, "")) };
  } catch { return null; }
}
```

- [ ] **Step 4: Implement transactional repository and package resolution**

```ts
// packages/entity-resolver/src/pg-entity-resolver.ts
import type pg from "pg";
import { githubSlugFromUrl } from "./github-url.js";
import type { MaintainerContributionInput, PackageLinkInput, RepositoryIdentityInput } from "./types.js";

export class PgEntityResolver {
  constructor(private readonly pool: pg.Pool) {}

  async resolveRawSnapshot(rawSnapshotId: string): Promise<{ repositories: number; packageLinks: number; maintainers: number }> {
    const result = await this.pool.query<{ observation_id: string; entity_hint: { type: string; nodeId?: string | null; owner?: string; name?: string; login?: string; ecosystem?: "npm" | "pypi" | "cargo" }; field: string; value: unknown; observed_at: Date; confidence: string }>(
      "select observation_id,entity_hint,field,value,observed_at,confidence from source_observation where raw_snapshot_id=$1 order by observation_id",
      [rawSnapshotId],
    );
    const repositoryGroups = new Map<string, typeof result.rows>();
    for (const row of result.rows.filter((item) => item.entity_hint.type === "repository" && item.entity_hint.nodeId)) {
      const key = row.entity_hint.nodeId!;
      repositoryGroups.set(key, [...(repositoryGroups.get(key) ?? []), row]);
    }
    let repositories = 0;
    for (const [nodeId, rows] of repositoryGroups) {
      const fields = new Map(rows.map((row) => [row.field, row.value]));
      const first = rows[0]!;
      const ownerIdentity = fields.get("owner_identity") as { nodeId?: string; type?: "Organization" | "User" } | undefined;
      await this.resolveRepository({ nodeId, owner: String(fields.get("owner") ?? first.entity_hint.owner), name: String(fields.get("name") ?? first.entity_hint.name), ownerNodeId: ownerIdentity?.nodeId ?? null, ownerType: ownerIdentity?.type ?? null, isFork: Boolean(fields.get("is_fork")), isArchived: Boolean(fields.get("is_archived")), parent: (fields.get("fork_parent") as { nodeId: string | null; fullName: string } | undefined) ?? null, observedAt: first.observed_at.toISOString(), sourceObservationId: first.observation_id });
      repositories += 1;
    }
    let packageLinks = 0;
    for (const row of result.rows.filter((item) => item.entity_hint.type === "package" && item.field === "candidate_repository_url" && typeof item.value === "string")) {
      await this.resolvePackageLink({ ecosystem: row.entity_hint.ecosystem!, packageName: row.entity_hint.name!, candidateRepositoryUrl: row.value as string, confidence: Number(row.confidence), observedAt: row.observed_at.toISOString(), sourceObservationId: row.observation_id });
      packageLinks += 1;
    }
    let maintainers = 0;
    for (const row of result.rows.filter((item) => item.entity_hint.type === "maintainer" && item.field === "repository_contribution")) {
      const value = row.value as { repositoryNodeId?: string; contributions?: number };
      if (!value.repositoryNodeId || !Number.isInteger(value.contributions) || value.contributions! < 0 || !row.entity_hint.login) continue;
      const resolved = await this.resolveMaintainerContribution({ repositoryNodeId: value.repositoryNodeId, maintainerNodeId: row.entity_hint.nodeId ?? null, login: row.entity_hint.login, contributions: value.contributions!, observedAt: row.observed_at.toISOString(), sourceObservationId: row.observation_id });
      if (resolved) maintainers += 1;
    }
    return { repositories, packageLinks, maintainers };
  }

  async resolveRepository(input: RepositoryIdentityInput): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const repository = await client.query<{ repository_id: string }>(
        `insert into repository(github_node_id,current_owner,current_name,owner_github_node_id,owner_type,is_fork,is_archived)
         values($1,$2,$3,$4,$5,$6,$7)
         on conflict(github_node_id) do update set current_owner=excluded.current_owner,current_name=excluded.current_name,owner_github_node_id=coalesce(excluded.owner_github_node_id,repository.owner_github_node_id),owner_type=coalesce(excluded.owner_type,repository.owner_type),is_fork=excluded.is_fork,is_archived=excluded.is_archived,updated_at=now()
         returning repository_id`,
        [input.nodeId, input.owner, input.name, input.ownerNodeId, input.ownerType, input.isFork, input.isArchived],
      );
      const repositoryId = repository.rows[0]!.repository_id;
      if (input.ownerNodeId && input.ownerType === "Organization") {
        await client.query(
          `insert into organization(github_node_id,login) values($1,$2)
           on conflict(github_node_id) do update set login=excluded.login,updated_at=now()`,
          [input.ownerNodeId, input.owner],
        );
      }
      if (input.ownerType === "User") await this.upsertMaintainer(client, input.ownerNodeId, input.owner);
      const current = await client.query<{ owner: string; name: string }>(
        "select owner,name from repository_alias where repository_id=$1 and valid_to is null for update",
        [repositoryId],
      );
      const changed = current.rowCount === 0 || current.rows[0]!.owner !== input.owner || current.rows[0]!.name !== input.name;
      if (changed) {
        await client.query("update repository_alias set valid_to=$2 where repository_id=$1 and valid_to is null", [repositoryId, input.observedAt]);
        await client.query(
          "insert into repository_alias(repository_id,owner,name,valid_from,source_observation_id) values($1,$2,$3,$4,$5)",
          [repositoryId, input.owner, input.name, input.observedAt, input.sourceObservationId],
        );
      }
      if (input.isFork && input.parent) {
        const parent = input.parent.nodeId ? await client.query<{ repository_id: string }>("select repository_id from repository where github_node_id=$1", [input.parent.nodeId]) : { rows: [] };
        await client.query(
          `insert into repository_relation(from_repository_id,to_repository_id,unresolved_target,relation_type,confidence,source_observation_id,valid_from)
           select $1,$2,$3,'fork',$4,$5,$6 where not exists(select 1 from repository_relation where from_repository_id=$1 and relation_type='fork' and valid_to is null)`,
          [repositoryId, parent.rows[0]?.repository_id ?? null, parent.rows[0] ? null : { fullName: input.parent.fullName, nodeId: input.parent.nodeId }, input.parent.nodeId ? 1 : 0.8, input.sourceObservationId, input.observedAt],
        );
      }
      await client.query("commit");
      return repositoryId;
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  private async upsertMaintainer(client: pg.PoolClient, nodeId: string | null, login: string): Promise<string> {
    if (nodeId) {
      const result = await client.query<{ maintainer_id: string }>(
        `insert into maintainer(github_node_id,login) values($1,$2)
         on conflict(github_node_id) do update set login=excluded.login,updated_at=now()
         returning maintainer_id`,
        [nodeId, login],
      );
      return result.rows[0]!.maintainer_id;
    }
    const current = await client.query<{ maintainer_id: string }>("select maintainer_id from maintainer where github_node_id is null and lower(login)=lower($1) for update", [login]);
    if (current.rows[0]) return current.rows[0].maintainer_id;
    const inserted = await client.query<{ maintainer_id: string }>("insert into maintainer(login) values($1) returning maintainer_id", [login]);
    return inserted.rows[0]!.maintainer_id;
  }

  async resolveMaintainerContribution(input: MaintainerContributionInput): Promise<string | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const repository = await client.query<{ repository_id: string }>("select repository_id from repository where github_node_id=$1 for update", [input.repositoryNodeId]);
      if (!repository.rows[0]) { await client.query("commit"); return null; }
      const maintainerId = await this.upsertMaintainer(client, input.maintainerNodeId, input.login);
      await client.query(
        `insert into repository_maintainer(repository_id,maintainer_id,contributions,source_observation_id,observed_at)
         values($1,$2,$3,$4,$5)
         on conflict(repository_id,maintainer_id,observed_at) do update set contributions=excluded.contributions,source_observation_id=excluded.source_observation_id`,
        [repository.rows[0].repository_id, maintainerId, input.contributions, input.sourceObservationId, input.observedAt],
      );
      await client.query("commit");
      return maintainerId;
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }

  async resolvePackageLink(input: PackageLinkInput): Promise<string> {
    const slug = githubSlugFromUrl(input.candidateRepositoryUrl);
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const pkg = await client.query<{ package_id: string }>(
        `insert into package(ecosystem,package_name,canonical_name) values($1,$2,$3)
         on conflict(ecosystem,canonical_name) do update set package_name=excluded.package_name returning package_id`,
        [input.ecosystem, input.packageName, input.packageName.toLowerCase()],
      );
      const repository = slug && input.confidence >= 0.85
        ? await client.query<{ repository_id: string }>("select repository_id from repository_alias where lower(owner)=lower($1) and lower(name)=lower($2) and valid_to is null", [slug.owner, slug.name])
        : { rows: [] };
      const state = repository.rows[0] ? "confirmed" : "candidate";
      const current = await client.query<{ repository_package_link_id: string; repository_id: string | null; candidate_repository_url: string | null; mapping_confidence: string; mapping_state: string }>("select repository_package_link_id,repository_id,candidate_repository_url,mapping_confidence,mapping_state from repository_package_link where package_id=$1 and valid_to is null for update", [pkg.rows[0]!.package_id]);
      if (current.rows.some((row) => row.repository_id === (repository.rows[0]?.repository_id ?? null) && row.candidate_repository_url === input.candidateRepositoryUrl && Number(row.mapping_confidence) === input.confidence && row.mapping_state === state)) {
        await client.query("commit");
        return current.rows.find((row) => row.candidate_repository_url === input.candidateRepositoryUrl)!.repository_package_link_id;
      }
      await client.query("update repository_package_link set valid_to=$2 where package_id=$1 and valid_to is null", [pkg.rows[0]!.package_id, input.observedAt]);
      const link = await client.query<{ repository_package_link_id: string }>(
        `insert into repository_package_link(repository_id,package_id,candidate_repository_url,mapping_confidence,mapping_state,source_observation_id,valid_from)
         values($1,$2,$3,$4,$5,$6,$7) returning repository_package_link_id`,
        [repository.rows[0]?.repository_id ?? null, pkg.rows[0]!.package_id, input.candidateRepositoryUrl, input.confidence, state, input.sourceObservationId, input.observedAt],
      );
      await client.query("commit");
      return link.rows[0]!.repository_package_link_id;
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }
}
```

```ts
// packages/entity-resolver/src/index.ts
export * from "./github-url.js";
export * from "./pg-entity-resolver.js";
export * from "./types.js";
```

- [ ] **Step 5: Run identity tests and commit**

Run: `set -a && source .env && set +a && pnpm --filter @github-picks/entity-resolver test && pnpm --filter @github-picks/entity-resolver typecheck`

Expected: all three tests PASS; URL normalization works, and one stable repository, two temporal aliases, two owner organizations, and one repository-maintainer link exist.

```bash
git add packages/entity-resolver
git commit -m "feat: resolve repository organization maintainer and package identities"
```

### Task 10: Orchestrate Idempotent Collection with BullMQ

**Files:**
- Create: `workers/collector/src/job.ts`
- Create: `workers/collector/src/temperature.ts`
- Create: `workers/collector/src/adapter-registry.ts`
- Create: `workers/collector/src/run-collection.ts`
- Create: `workers/collector/src/scheduler.ts`
- Create: `workers/collector/src/worker.ts`
- Create: `workers/collector/test/orchestration.test.ts`
- Modify: `workers/collector/package.json`

**Interfaces:**
- Consumes: all 13 adapters, `EvidenceWriter`, `collection_target`, Redis.
- Produces: `CollectionJobSchema`, `collectionJobId`, `temperaturePriority`, `runCollection`, scheduler and worker CLIs.

- [ ] **Step 1: Add queue dependencies and failing idempotence/isolation tests**

Add exact dependencies to `workers/collector/package.json`:

```json
{
  "@aws-sdk/client-s3": "3.1101.0",
  "@github-picks/entity-resolver": "workspace:*",
  "bullmq": "6.0.6",
  "ioredis": "6.0.0",
  "pg": "8.22.0",
  "zod": "4.4.3"
}
```

```ts
// workers/collector/test/orchestration.test.ts
import { describe, expect, it } from "vitest";
import { collectionJobId } from "../src/job.js";
import { nextTemperature, temperaturePriority } from "../src/temperature.js";

describe("collection orchestration", () => {
  it("uses a stable idempotence key for the same source/resource/window/version", () => {
    const input = { sourceId: "github-rest", resourceKey: "octocat/Hello-World", windowStart: "2026-08-03T00:00:00Z", windowEnd: "2026-08-03T01:00:00Z", collectorVersion: "v1.0.0" };
    expect(collectionJobId(input)).toBe(collectionJobId(input));
    expect(collectionJobId({ ...input, windowEnd: "2026-08-03T02:00:00Z" })).not.toBe(collectionJobId(input));
  });
  it("never schedules quarantine and caps B/C discovery at warm", () => {
    expect(temperaturePriority("quarantine")).toBeNull();
    expect(nextTemperature("cold", "C", "external-discovery")).toBe("warm");
    expect(nextTemperature("warm", "S", "multi-source-acceleration")).toBe("hot");
  });
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm install && pnpm --filter @github-picks/collector test -- orchestration.test.ts`

Expected: FAIL because job and temperature functions are absent.

- [ ] **Step 3: Implement job contracts, stable IDs, and candidate temperature rules**

```ts
// workers/collector/src/job.ts
import { createHash } from "node:crypto";
import { z } from "zod";
import { CollectRequestSchema } from "@github-picks/contracts";
export const CollectionJobSchema = z.object({ sourceId: z.string(), resourceKey: z.string(), collectorVersion: z.string(), request: CollectRequestSchema });
export type CollectionJob = z.infer<typeof CollectionJobSchema>;
export function collectionJobId(input: { sourceId: string; resourceKey: string; windowStart: string; windowEnd: string; collectorVersion: string }): string {
  return createHash("sha256").update([input.sourceId, input.resourceKey, input.windowStart, input.windowEnd, input.collectorVersion].join("\n")).digest("hex");
}
```

```ts
// workers/collector/src/temperature.ts
export type Temperature = "hot" | "warm" | "cold" | "quarantine";
export function temperaturePriority(value: Temperature): number | null { return value === "hot" ? 1 : value === "warm" ? 5 : value === "cold" ? 10 : null; }
export function nextTemperature(current: Temperature, tier: "S" | "A" | "B" | "C", reason: "external-discovery" | "multi-source-acceleration" | "risk-review"): Temperature {
  if (reason === "risk-review") return "quarantine";
  if (reason === "external-discovery" && (tier === "B" || tier === "C")) return current === "hot" ? "hot" : "warm";
  if (reason === "multi-source-acceleration" && (tier === "S" || tier === "A")) return "hot";
  return current;
}
```

- [ ] **Step 4: Implement adapter registry, one-run transaction flow, scheduler, and Worker**

```ts
// workers/collector/src/adapter-registry.ts
import type { SourceAdapter } from "@github-picks/contracts";
import { M1_ADAPTERS } from "./adapters/index.js";
export const ADAPTERS = new Map<string, SourceAdapter>(M1_ADAPTERS.map((adapter) => [adapter.sourceId, adapter]));
if (ADAPTERS.size !== 13) throw new Error(`expected 13 M1 adapters, got ${ADAPTERS.size}`);
```

```ts
// workers/collector/src/run-collection.ts
import type { CollectorContext } from "@github-picks/contracts";
import type { EvidenceWriter } from "@github-picks/evidence";
import { requestFingerprint } from "@github-picks/source-sdk";
import { ADAPTERS } from "./adapter-registry.js";
import type { CollectionJob } from "./job.js";

export async function runCollection(job: CollectionJob, context: CollectorContext, evidence: EvidenceWriter, resolver: { resolveRawSnapshot(rawSnapshotId: string): Promise<unknown> }): Promise<void> {
  const adapter = ADAPTERS.get(job.sourceId);
  if (!adapter) throw new Error(`unknown source adapter: ${job.sourceId}`);
  const fingerprint = requestFingerprint({ url: `${job.sourceId}:${job.resourceKey}`, method: "COLLECT" });
  const runId = await evidence.startRun({ sourceId: job.sourceId, resourceKey: job.resourceKey, windowStart: job.request.windowStart, windowEnd: job.request.windowEnd, collectorVersion: job.collectorVersion, requestFingerprint: fingerprint, cursorIn: job.request.cursor, rateLimitBefore: context.http.rateLimitSnapshot("https://api.github.com") });
  if (!runId) return;
  try {
    const batch = await adapter.collect(context, job.request);
    let records = 0;
    for (const artifact of batch.artifacts) { const rawSnapshotId = await evidence.recordArtifact(runId, artifact); await resolver.resolveRawSnapshot(rawSnapshotId); records += artifact.observations.length; }
    await evidence.finishRun(runId, { state: "succeeded", cursorOut: batch.nextCursor, nextPollSeconds: batch.nextPollSeconds, recordCount: records, retryCount: 0, rateLimitAfter: context.http.rateLimitSnapshot("https://api.github.com") });
  } catch (error) {
    await evidence.finishRun(runId, { state: "failed", cursorOut: null, nextPollSeconds: null, recordCount: 0, retryCount: 0, rateLimitAfter: context.http.rateLimitSnapshot("https://api.github.com"), errorClass: error instanceof Error ? error.name : "UnknownError", errorMessage: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
```

```ts
// workers/collector/src/scheduler.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";
import pg from "pg";
import { collectionJobId, CollectionJobSchema } from "./job.js";
import { temperaturePriority } from "./temperature.js";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const queue = new Queue("github-picks-collect", { connection });
const due = await pool.query<{ collection_target_id: string; source_id: string; resource_key: string; target: unknown; temperature: "hot" | "warm" | "cold" | "quarantine"; parser_version: string; cadence_seconds: number; cursor_out: string | null; next_poll_seconds: number | null }>(`select t.collection_target_id,t.source_id,t.resource_key,t.target,t.temperature,s.parser_version,s.cadence_seconds,last_run.cursor_out,last_run.next_poll_seconds from collection_target t join source_registry s using(source_id) left join lateral (select cursor_out,next_poll_seconds from ingestion_run r where r.source_id=t.source_id and r.resource_key=t.resource_key and r.result_state='succeeded' order by r.finished_at desc limit 1) last_run on true where t.next_collect_at<=now() and t.temperature<>'quarantine' order by t.next_collect_at limit 1000`);
for (const row of due.rows) {
  const now = new Date();
  const effectiveCadenceSeconds = Math.max(row.cadence_seconds, row.next_poll_seconds ?? 0);
  let resourceKey = row.resource_key; let target = row.target;
  if (row.source_id === "gharchive") { const hour = new Date(now.getTime() - 6 * 3600_000); hour.setUTCMinutes(0, 0, 0); resourceKey = `hour:${hour.toISOString()}`; target = { kind: "hour", hour: hour.toISOString() }; }
  const job = CollectionJobSchema.parse({ sourceId: row.source_id, resourceKey, collectorVersion: row.parser_version, request: { target, windowStart: new Date(now.getTime() - effectiveCadenceSeconds * 1000).toISOString(), windowEnd: now.toISOString(), cursor: row.cursor_out, etag: row.cursor_out, lastModified: null } });
  await queue.add("collect", job, { jobId: collectionJobId({ sourceId: job.sourceId, resourceKey: job.resourceKey, windowStart: job.request.windowStart, windowEnd: job.request.windowEnd, collectorVersion: job.collectorVersion }), priority: temperaturePriority(row.temperature)!, attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 1000, removeOnFail: false });
  await pool.query("update collection_target set next_collect_at=$2,updated_at=now() where collection_target_id=$1", [row.collection_target_id, new Date(now.getTime() + effectiveCadenceSeconds * 1000)]);
}
await queue.close(); await connection.quit(); await pool.end();
```

```ts
// workers/collector/src/worker.ts
import { S3Client } from "@aws-sdk/client-s3";
import { PgEntityResolver } from "@github-picks/entity-resolver";
import { PgEvidenceWriter, S3RawStore } from "@github-picks/evidence";
import { PoliteHttpClient } from "@github-picks/source-sdk";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import pg from "pg";
import { ADAPTERS } from "./adapter-registry.js";
import { CollectionJobSchema } from "./job.js";
import { runCollection } from "./run-collection.js";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT!, region: process.env.S3_REGION!, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
const raw = new S3RawStore(s3, process.env.S3_BUCKET!);
const evidence = new PgEvidenceWriter(pool, raw, new Map([...ADAPTERS].map(([id]) => [id, "v1.0.0"])));
const resolver = new PgEntityResolver(pool);
const http = new PoliteHttpClient({ fetch: globalThis.fetch, sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)), random: Math.random, userAgent: process.env.GITHUB_PICKS_USER_AGENT!, ...(process.env.GITHUB_TOKEN ? { token: process.env.GITHUB_TOKEN } : {}) });
const worker = new Worker("github-picks-collect", async (bullJob) => runCollection(CollectionJobSchema.parse(bullJob.data), { http, now: () => new Date() }, evidence, resolver), { connection, concurrency: 20, limiter: { max: 4500, duration: 3600_000 } });
worker.on("failed", (job, error) => process.stderr.write(`${job?.id ?? "unknown"} ${error.message}\n`));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, async () => { await worker.close(); await connection.quit(); await pool.end(); process.exit(0); });
```

After Task 10, the collector `scripts` object is exactly:

```json
{
  "build": "tsc -p tsconfig.json",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "test": "vitest run",
  "scheduler": "tsx src/scheduler.ts",
  "worker": "tsx src/worker.ts"
}
```

- [ ] **Step 5: Run orchestration tests and commit**

Run: `pnpm --filter @github-picks/collector test -- orchestration.test.ts && pnpm --filter @github-picks/collector typecheck`

Expected: 2 tests PASS; adapter registry size is 13; TypeScript exits 0.

```bash
git add workers/collector pnpm-lock.yaml
git commit -m "feat: orchestrate idempotent evidence collection"
```

### Task 11: Expose Structured Logs, Metrics, and Source Health

**Files:**
- Create: `packages/observability/package.json`
- Create: `packages/observability/tsconfig.json`
- Create: `packages/observability/src/index.ts`
- Create: `packages/observability/test/redaction.test.ts`
- Create: `tools/health/package.json`
- Create: `tools/health/tsconfig.json`
- Create: `tools/health/src/classify.ts`
- Create: `tools/health/src/cli.ts`
- Create: `tools/health/test/classify.test.ts`
- Modify: `workers/collector/src/worker.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: ingestion runs, Source Registry SLO, worker errors.
- Produces: redacted Pino logger, Prometheus counters, `classifyHealth`, CLI `pnpm sources:health`.

- [ ] **Step 1: Write failing redaction and health-state tests**

```ts
// packages/observability/test/redaction.test.ts
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/index.js";
it("redacts credentials and cookies", () => {
  let output = "";
  const stream = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  createLogger(stream).info({ authorization: "secret", cookie: "private", sourceId: "github-rest" }, "test");
  expect(output).not.toContain("secret");
  expect(output).not.toContain("private");
  expect(output).toContain("github-rest");
});
```

```ts
// tools/health/test/classify.test.ts
import { describe, expect, it } from "vitest";
import { classifyHealth } from "../src/classify.js";
describe("classifyHealth", () => {
  it("uses freshness and seven-day success rate", () => {
    const now = new Date("2026-08-03T08:00:00Z");
    expect(classifyHealth({ successRate: 0.99, freshnessSloSeconds: 3600, lastSuccessAt: "2026-08-03T07:30:00Z" }, now)).toBe("healthy");
    expect(classifyHealth({ successRate: 0.97, freshnessSloSeconds: 3600, lastSuccessAt: "2026-08-03T07:30:00Z" }, now)).toBe("degraded");
    expect(classifyHealth({ successRate: 1, freshnessSloSeconds: 3600, lastSuccessAt: "2026-08-03T05:00:00Z" }, now)).toBe("offline");
  });
});
```

- [ ] **Step 2: Run both tests and verify failure**

Run: `pnpm --filter @github-picks/observability test; pnpm --filter @github-picks/health test`

Expected: both commands FAIL because implementations are absent.

- [ ] **Step 3: Implement the redacted logger and Prometheus metrics**

```json
// packages/observability/package.json
{
  "name": "@github-picks/observability",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "build": "tsc -p tsconfig.json", "typecheck": "tsc -p tsconfig.json --noEmit", "test": "vitest run" },
  "dependencies": { "@opentelemetry/api": "1.9.1", "pino": "10.3.1", "prom-client": "15.1.3" }
}
```

```json
// packages/observability/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "outDir": "dist" }, "include": ["src/**/*.ts", "test/**/*.ts"] }
```

```ts
// packages/observability/src/index.ts
import type { Writable } from "node:stream";
import { trace } from "@opentelemetry/api";
import pino from "pino";
import { Counter, Gauge, Registry } from "prom-client";
export const registry = new Registry();
export const collectionRuns = new Counter({ name: "github_picks_collection_runs_total", help: "Collection runs by result", labelNames: ["source_id", "result"] as const, registers: [registry] });
export const collectionFreshness = new Gauge({ name: "github_picks_source_freshness_seconds", help: "Seconds since source success", labelNames: ["source_id"] as const, registers: [registry] });
export const tracer = trace.getTracer("github-picks-collector", "0.1.0");
export function createLogger(destination?: Writable) {
  const options = { level: process.env.LOG_LEVEL ?? "info", redact: { paths: ["authorization", "cookie", "token", "req.headers.authorization", "req.headers.cookie", "*.authorization", "*.cookie"], censor: "[REDACTED]" } };
  return destination ? pino(options, destination) : pino(options);
}
```

- [ ] **Step 4: Implement health classification and database CLI**

```json
// tools/health/package.json
{
  "name": "@github-picks/health",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run", "start": "tsx src/cli.ts" },
  "dependencies": { "pg": "8.22.0" },
  "devDependencies": { "@types/pg": "8.20.3" }
}
```

```json
// tools/health/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "outDir": "dist" }, "include": ["src/**/*.ts", "test/**/*.ts"] }
```

```ts
// tools/health/src/classify.ts
export interface HealthInput { successRate: number; freshnessSloSeconds: number; lastSuccessAt: string | null; }
export type HealthState = "healthy" | "degraded" | "offline";
export function classifyHealth(input: HealthInput, now = new Date()): HealthState {
  if (!input.lastSuccessAt) return "offline";
  const ageSeconds = (now.getTime() - new Date(input.lastSuccessAt).getTime()) / 1000;
  if (ageSeconds > input.freshnessSloSeconds * 2) return "offline";
  if (ageSeconds > input.freshnessSloSeconds || input.successRate < 0.98) return "degraded";
  return "healthy";
}
```

```ts
// tools/health/src/cli.ts
import pg from "pg";
import { classifyHealth } from "./classify.js";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query<{ source_id: string; tier: "S" | "A" | "B" | "C"; freshness_slo_seconds: number; last_success_at: Date | null; success_rate: string }>(`
  select s.source_id,s.tier,s.freshness_slo_seconds,s.last_success_at,
    coalesce(avg(case when r.result_state='succeeded' then 1.0 else 0.0 end) filter(where r.started_at >= now()-interval '7 days'),0)::text as success_rate
  from source_registry s left join ingestion_run r using(source_id)
  group by s.source_id,s.tier,s.freshness_slo_seconds,s.last_success_at order by s.source_id`);
const output = result.rows.map((row) => ({ sourceId: row.source_id, tier: row.tier, successRate: Number(row.success_rate), lastSuccessAt: row.last_success_at?.toISOString() ?? null, state: classifyHealth({ successRate: Number(row.success_rate), freshnessSloSeconds: row.freshness_slo_seconds, lastSuccessAt: row.last_success_at?.toISOString() ?? null }) }));
for (const row of output) await pool.query("update source_registry set health_state=$2 where source_id=$1", [row.sourceId, row.state]);
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = output.some((row) => (row.tier === "S" || row.tier === "A") && row.state === "offline") ? 2 : 0;
await pool.end();
```

Apply this exact Worker integration after the observability package exists:

```diff
 // workers/collector/package.json
 "dependencies": {
+  "@github-picks/observability": "workspace:*",
 }

 // workers/collector/src/worker.ts
+import { createServer } from "node:http";
+import { collectionFreshness, collectionRuns, createLogger, registry } from "@github-picks/observability";
 const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
+const logger = createLogger();
+const metricsServer = createServer(async (_request, response) => {
+  const freshness = await pool.query<{ source_id: string; age_seconds: string | null }>("select source_id,extract(epoch from now()-last_success_at)::text as age_seconds from source_registry");
+  for (const row of freshness.rows) if (row.age_seconds !== null) collectionFreshness.set({ source_id: row.source_id }, Number(row.age_seconds));
+  response.writeHead(200, { "content-type": registry.contentType });
+  response.end(await registry.metrics());
+});
+metricsServer.listen(Number(process.env.METRICS_PORT ?? 9464), "127.0.0.1");
-const worker = new Worker("github-picks-collect", async (bullJob) => runCollection(CollectionJobSchema.parse(bullJob.data), { http, now: () => new Date() }, evidence, resolver), { connection, concurrency: 20, limiter: { max: 4500, duration: 3600_000 } });
-worker.on("failed", (job, error) => process.stderr.write(`${job?.id ?? "unknown"} ${error.message}\n`));
+const worker = new Worker("github-picks-collect", async (bullJob) => {
+  const job = CollectionJobSchema.parse(bullJob.data);
+  try {
+    await runCollection(job, { http, now: () => new Date() }, evidence, resolver);
+    collectionRuns.inc({ source_id: job.sourceId, result: "succeeded" });
+  } catch (error) {
+    collectionRuns.inc({ source_id: job.sourceId, result: "failed" });
+    throw error;
+  }
+}, { connection, concurrency: 20, limiter: { max: 4500, duration: 3600_000 } });
+worker.on("failed", (job, error) => logger.error({ jobId: job?.id, error }, "collection failed"));
-for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, async () => { await worker.close(); await connection.quit(); await pool.end(); process.exit(0); });
+for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, async () => { await worker.close(); await new Promise<void>((resolve, reject) => metricsServer.close((error) => error ? reject(error) : resolve())); await connection.quit(); await pool.end(); process.exit(0); });
```

Apply this exact root script entry:

```diff
 // package.json
 "scripts": {
+  "sources:health": "pnpm --filter @github-picks/health start"
 }
```

- [ ] **Step 5: Run checks and commit**

Run: `pnpm install && pnpm --filter @github-picks/observability test && pnpm --filter @github-picks/health test && pnpm typecheck`

Expected: redaction test and 3 health cases PASS; TypeScript exits 0.

```bash
git add packages/observability tools/health workers/collector/src/worker.ts package.json pnpm-lock.yaml
git commit -m "feat: report source health and collection metrics"
```

### Task 12: Replay Raw Snapshots Through Versioned Parsers

**Files:**
- Create: `tools/replay/package.json`
- Create: `tools/replay/tsconfig.json`
- Create: `tools/replay/src/compare.ts`
- Create: `tools/replay/src/cli.ts`
- Create: `tools/replay/test/compare.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `raw_snapshot_id`, S3 object, `ADAPTERS`, parser version, stored observations.
- Produces: deterministic replay diff and CLI `pnpm evidence:replay -- <raw_snapshot_id>`.

- [ ] **Step 1: Write a failing order-independent replay comparison test**

```ts
// tools/replay/test/compare.test.ts
import { describe, expect, it } from "vitest";
import { compareObservations } from "../src/compare.js";
const a = { externalId: "1", entityHint: { type: "discovery" as const, externalId: "x" }, field: "event", value: { b: 2, a: 1 }, eventAt: null, confidence: 1, status: "observed" as const };
const b = { ...a, externalId: "2" };
describe("compareObservations", () => {
  it("ignores row and JSON object key order but detects value changes", () => {
    expect(compareObservations([a, b], [b, { ...a, value: { a: 1, b: 2 } }])).toEqual([]);
    expect(compareObservations([a], [{ ...a, value: { a: 9 } }])).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the replay test and verify failure**

Run: `pnpm --filter @github-picks/replay test`

Expected: FAIL because replay package does not exist.

- [ ] **Step 3: Implement canonical observation comparison**

```json
// tools/replay/package.json
{
  "name": "@github-picks/replay",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run", "start": "tsx src/cli.ts" },
  "dependencies": { "@aws-sdk/client-s3": "3.1101.0", "@github-picks/contracts": "workspace:*", "@github-picks/evidence": "workspace:*", "@github-picks/collector": "workspace:*", "pg": "8.22.0" },
  "devDependencies": { "@types/pg": "8.20.3" }
}
```

```json
// tools/replay/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "outDir": "dist" }, "include": ["src/**/*.ts", "test/**/*.ts"] }
```

```ts
// tools/replay/src/compare.ts
import type { ObservationDraft } from "@github-picks/contracts";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function compareObservations(expected: ObservationDraft[], actual: ObservationDraft[]): string[] {
  const normalize = (rows: ObservationDraft[]) => rows.map(canonical).sort();
  const left = normalize(expected); const right = normalize(actual);
  return [...new Set([...left.filter((row) => !right.includes(row)).map((row) => `missing:${row}`), ...right.filter((row) => !left.includes(row)).map((row) => `unexpected:${row}`)])];
}
```

- [ ] **Step 4: Implement the S3-to-parser replay CLI**

```ts
// tools/replay/src/cli.ts
import { S3Client } from "@aws-sdk/client-s3";
import type { ObservationDraft, ReplayRawObject } from "@github-picks/contracts";
import { S3RawStore } from "@github-picks/evidence";
import { ADAPTERS } from "@github-picks/collector/adapter-registry";
import pg from "pg";
import { compareObservations } from "./compare.js";
const rawSnapshotId = process.argv[2];
if (!rawSnapshotId) throw new Error("usage: pnpm evidence:replay -- <raw_snapshot_id>");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rawResult = await pool.query<{ source_id: string; object_ref: string; content_type: string; source_url: string; request_body: string | null; observed_at: Date; event_at: Date | null; parser_version: string }>("select source_id,object_ref,content_type,source_url,request_body,observed_at,event_at,parser_version from raw_snapshot where raw_snapshot_id=$1", [rawSnapshotId]);
const row = rawResult.rows[0]; if (!row) throw new Error(`raw snapshot not found: ${rawSnapshotId}`);
const adapter = ADAPTERS.get(row.source_id); if (!adapter) throw new Error(`adapter not found: ${row.source_id}`);
const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT!, region: process.env.S3_REGION!, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
const rawStore = new S3RawStore(s3, process.env.S3_BUCKET!);
const replayRaw: ReplayRawObject = { sourceId: row.source_id, sourceUrl: row.source_url, requestBody: row.request_body, contentType: row.content_type, body: await rawStore.get(row.object_ref), observedAt: row.observed_at.toISOString(), eventAt: row.event_at?.toISOString() ?? null };
const actual = await adapter.parse(replayRaw);
const stored = await pool.query<{ external_id: string; entity_hint: ObservationDraft["entityHint"]; field: string; value: unknown; event_at: Date | null; confidence: string; status: ObservationDraft["status"] }>("select external_id,entity_hint,field,value,event_at,confidence,status from source_observation where raw_snapshot_id=$1", [rawSnapshotId]);
const expected: ObservationDraft[] = stored.rows.map((item) => ({ externalId: item.external_id, entityHint: item.entity_hint, field: item.field, value: item.value, eventAt: item.event_at?.toISOString() ?? null, confidence: Number(item.confidence), status: item.status }));
const diff = compareObservations(expected, actual);
process.stdout.write(`${JSON.stringify({ rawSnapshotId, sourceId: row.source_id, parserVersion: row.parser_version, expected: expected.length, actual: actual.length, diff }, null, 2)}\n`);
process.exitCode = diff.length === 0 ? 0 : 1;
await pool.end();
```

Apply this exact root script entry:

```diff
 // package.json
 "scripts": {
+  "evidence:replay": "pnpm --filter @github-picks/replay start"
 }
```

- [ ] **Step 5: Run replay tests and commit**

Run: `pnpm install && pnpm --filter @github-picks/replay test && pnpm --filter @github-picks/replay typecheck`

Expected: both comparison assertions PASS and TypeScript exits 0.

```bash
git add tools/replay package.json pnpm-lock.yaml
git commit -m "feat: replay evidence through versioned parsers"
```

### Task 13: Prove M1 End-to-End and Document Operations

**Files:**
- Create: `tools/acceptance/package.json`
- Create: `tools/acceptance/tsconfig.json`
- Create: `tools/acceptance/src/m1.ts`
- Create: `docs/runbooks/source-operations.md`
- Create: `docs/runbooks/evidence-replay.md`
- Create: `docs/runbooks/credentials-and-redaction.md`
- Create: `docs/runbooks/m1-acceptance.md`
- Create: `.github/workflows/ci.yml`
- Create: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: M0 `BUILD`, all 13 adapters, local infrastructure, evidence writer, entity resolver, health and replay tools.
- Produces: `pnpm m1:accept`, CI gates, operator commands, and a machine-readable M1 acceptance result.

- [ ] **Step 1: Add the acceptance package and a gate that refuses non-BUILD M0 results**

```json
// tools/acceptance/package.json
{
  "name": "@github-picks/acceptance",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run --passWithNoTests", "m1": "tsx src/m1.ts" },
  "dependencies": {
    "@aws-sdk/client-s3": "3.1101.0",
    "@github-picks/collector": "workspace:*",
    "@github-picks/contracts": "workspace:*",
    "@github-picks/entity-resolver": "workspace:*",
    "@github-picks/evidence": "workspace:*",
    "@github-picks/source-sdk": "workspace:*",
    "pg": "8.22.0"
  },
  "devDependencies": { "@types/pg": "8.20.3" }
}
```

```json
// tools/acceptance/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "outDir": "dist" }, "include": ["src/**/*.ts"] }
```

The first statements in `tools/acceptance/src/m1.ts` must be:

```ts
import { readFile } from "node:fs/promises";
const m0 = await readFile("docs/research/m0/decision.md", "utf8");
if (!/^- 决策：\*\*BUILD\*\*$/m.test(m0)) throw new Error("M1 is blocked until the generated M0 decision is BUILD");
if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required for the M1 live acceptance run");
if (!process.env.GITHUB_PICKS_USER_AGENT || process.env.GITHUB_PICKS_USER_AGENT.includes("example.invalid")) throw new Error("GITHUB_PICKS_USER_AGENT must include a real public contact URL");
```

- [ ] **Step 2: Implement one live, persisted run for every registered adapter**

```ts
// tools/acceptance/src/m1.ts (continue after the gate above)
import { S3Client } from "@aws-sdk/client-s3";
import type { CollectRequest, CollectorContext } from "@github-picks/contracts";
import { PgEntityResolver } from "@github-picks/entity-resolver";
import { PgEvidenceWriter, S3RawStore } from "@github-picks/evidence";
import { PoliteHttpClient, requestFingerprint } from "@github-picks/source-sdk";
import { ADAPTERS } from "@github-picks/collector/adapter-registry";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT!, region: process.env.S3_REGION!, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
const rawStore = new S3RawStore(s3, process.env.S3_BUCKET!);
const evidence = new PgEvidenceWriter(pool, rawStore, new Map([...ADAPTERS.keys()].map((id) => [id, "v1.0.0"])));
const resolver = new PgEntityResolver(pool);
const http = new PoliteHttpClient({ fetch: globalThis.fetch, sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)), random: Math.random, userAgent: process.env.GITHUB_PICKS_USER_AGENT!, token: process.env.GITHUB_TOKEN! });
const context: CollectorContext = { http, now: () => new Date() };
const end = new Date(); const start = new Date(end.getTime() - 3600_000); const archiveHour = new Date(end.getTime() - 6 * 3600_000); archiveHour.setUTCMinutes(0, 0, 0);
const base = { windowStart: start.toISOString(), windowEnd: end.toISOString(), cursor: null, etag: null, lastModified: null };
const requests = new Map<string, CollectRequest>([
  ["github-rest", { ...base, target: { kind: "repository", owner: "ossf", name: "scorecard" } }],
  ["github-graphql", { ...base, target: { kind: "repository", owner: "ossf", name: "scorecard" } }],
  ["repository-files", { ...base, target: { kind: "repository", owner: "ossf", name: "scorecard" } }],
  ["github-events", { ...base, target: { kind: "discovery", cursor: null } }],
  ["gharchive", { ...base, target: { kind: "hour", hour: archiveHour.toISOString() } }],
  ["github-trending", { ...base, target: { kind: "discovery", cursor: null } }],
  ["hacker-news", { ...base, target: { kind: "discovery", cursor: null } }],
  ["npm", { ...base, target: { kind: "package", ecosystem: "npm", name: "zod" } }],
  ["pypi", { ...base, target: { kind: "package", ecosystem: "pypi", name: "requests" } }],
  ["crates", { ...base, target: { kind: "package", ecosystem: "cargo", name: "serde" } }],
  ["openssf-scorecard", { ...base, target: { kind: "repository", owner: "ossf", name: "scorecard" } }],
  ["osv", { ...base, target: { kind: "package", ecosystem: "pypi", name: "jinja2", version: "2.4.1" } }],
  ["deps-dev", { ...base, target: { kind: "package", ecosystem: "pypi", name: "jinja2" } }],
]);

for (const [sourceId, request] of requests) {
  const adapter = ADAPTERS.get(sourceId); if (!adapter) throw new Error(`adapter missing: ${sourceId}`);
  const resourceKey = JSON.stringify(request.target);
  const runId = await evidence.startRun({ sourceId, resourceKey, windowStart: request.windowStart, windowEnd: request.windowEnd, collectorVersion: "v1.0.0", requestFingerprint: requestFingerprint({ url: `${sourceId}:${resourceKey}`, method: "COLLECT" }), cursorIn: null, rateLimitBefore: context.http.rateLimitSnapshot("https://api.github.com") });
  if (!runId) continue;
  try {
    const batch = await adapter.collect(context, request); let recordCount = 0;
    for (const artifact of batch.artifacts) { const rawId = await evidence.recordArtifact(runId, artifact); await resolver.resolveRawSnapshot(rawId); recordCount += artifact.observations.length; }
    await evidence.finishRun(runId, { state: "succeeded", cursorOut: batch.nextCursor, nextPollSeconds: batch.nextPollSeconds, recordCount, retryCount: 0, rateLimitAfter: context.http.rateLimitSnapshot("https://api.github.com") });
  } catch (error) {
    await evidence.finishRun(runId, { state: "failed", cursorOut: null, nextPollSeconds: null, recordCount: 0, retryCount: 0, rateLimitAfter: context.http.rateLimitSnapshot("https://api.github.com"), errorClass: error instanceof Error ? error.name : "UnknownError", errorMessage: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

const sourceCount = Number((await pool.query("select count(*) as count from source_registry")).rows[0].count);
const successfulSources = Number((await pool.query("select count(distinct source_id) as count from ingestion_run where result_state='succeeded' and started_at >= $1", [start])).rows[0].count);
const unlinkedFacts = Number((await pool.query("select count(*) as count from source_observation where raw_snapshot_id is null")).rows[0].count);
const rawCount = Number((await pool.query("select count(*) as count from raw_snapshot where observed_at >= $1", [start])).rows[0].count);
const repositoryCount = Number((await pool.query("select count(distinct r.repository_id) as count from source_observation o join raw_snapshot raw using(raw_snapshot_id) join repository r on r.github_node_id=o.value#>>'{}' where raw.observed_at >= $1 and o.field='github_node_id'", [start])).rows[0].count);
const organizationCount = Number((await pool.query("select count(distinct org.organization_id) as count from source_observation o join raw_snapshot raw using(raw_snapshot_id) join organization org on org.github_node_id=o.value->>'nodeId' where raw.observed_at >= $1 and o.field='owner_identity' and o.value->>'type'='Organization'", [start])).rows[0].count);
const maintainerCount = Number((await pool.query("select count(distinct rm.maintainer_id) as count from repository_maintainer rm join source_observation o on o.observation_id=rm.source_observation_id join raw_snapshot raw using(raw_snapshot_id) where raw.observed_at >= $1", [start])).rows[0].count);
const result = { sourceCount, successfulSources, rawCount, unlinkedFacts, repositoryCount, organizationCount, maintainerCount, passed: sourceCount === 13 && successfulSources === 13 && rawCount >= 13 && unlinkedFacts === 0 && repositoryCount >= 1 && organizationCount >= 1 && maintainerCount >= 1 };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
await pool.end();
if (!result.passed) process.exitCode = 1;
```

- [ ] **Step 3: Add operator runbooks with exact commands and failure rules**

```markdown
<!-- docs/runbooks/source-operations.md -->
# Source Operations

1. `cp .env.example .env` and replace only secret values locally.
2. `pnpm infra:up` starts PostgreSQL, Redis, and MinIO on 55432, 56379, and 59000/59001.
3. `set -a && source .env && set +a && pnpm db:migrate && pnpm db:seed` prepares the evidence store.
4. `pnpm --filter @github-picks/collector scheduler` enqueues due non-quarantine targets.
5. `pnpm --filter @github-picks/collector worker` processes at most 20 concurrent jobs.
6. `pnpm sources:health` exits 2 when any S/A source is offline. Do not mark stale values as current.
7. On 403/429, inspect Retry-After/reset and queue state. Never rotate accounts to evade limits.
8. On parser failure, keep raw_snapshot and failed ingestion_run, disable only that source, add a fixture, then replay.
```

```markdown
<!-- docs/runbooks/evidence-replay.md -->
# Evidence Replay

1. Find a raw ID with `select raw_snapshot_id,source_id,object_ref,parser_version from raw_snapshot order by observed_at desc limit 20;`.
2. Run `pnpm evidence:replay -- RAW_UUID` using the exact UUID from the query.
3. Exit 0 means the current registered parser reproduces stored observations; exit 1 prints missing/unexpected canonical rows.
4. A parser correction gets a new parser version and new observations. Never overwrite the old raw object or historical observation.
5. If a correction affects entity identity, add an audit_log entry and run the M1 acceptance command before release.
```

```markdown
<!-- docs/runbooks/credentials-and-redaction.md -->
# Credentials and Redaction

- Use a dedicated minimum-permission GitHub credential; never commit `.env`.
- Authorization, Cookie, Set-Cookie, proxy credentials, API keys and private paths must not enter logs, response_headers, DLQ or fixtures.
- `pnpm --filter @github-picks/observability test` is the mandatory redaction regression.
- Rotate a leaked credential immediately, revoke the old value, audit raw/log/DLQ stores, and record the incident without copying the secret.
- M1 processes public repositories only and never reads Obsidian or private repositories.
```

```markdown
<!-- docs/runbooks/m1-acceptance.md -->
# M1 Acceptance

Prerequisite: the generated M0 report says BUILD. Run `pnpm infra:up`, load `.env`, then execute `pnpm db:migrate`, `pnpm db:seed`, `pnpm check`, and `pnpm m1:accept`.

The result passes only when all 13 sources have a successful live run, at least 13 raw snapshots exist, every observation links to raw evidence, and the current run resolves GitHub node_id into repository, organization, and maintainer entities. Then run `pnpm sources:health` and replay one raw snapshot from each independence group.

Do not accept M1 from screenshots or a single successful source. Save the JSON result and referenced raw IDs in the release evidence.
```

- [ ] **Step 4: Add CI and the root operator README**

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
  push:
    branches: [master]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11.18.0, run_install: false }
      - uses: actions/setup-node@v4
        with: { node-version: 24.15.0, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11.18.0, run_install: false }
      - uses: actions/setup-node@v4
        with: { node-version: 24.15.0, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: cp .env.example .env && docker compose -f infra/docker/compose.yaml up -d --wait
      - run: set -a && source .env && set +a && pnpm db:migrate && pnpm db:seed && pnpm test:integration && pnpm --filter @github-picks/entity-resolver test
```

```markdown
<!-- README.md -->
# GitHub Picks

GitHub Picks 是中文开源情报与决策系统。当前仓库只进入 M0/M1：先验证现有产品是否足够，再建设公开开源事实的多信源证据底座。

GitHub Picks is an independent, unofficial project and is not affiliated with GitHub, Inc.

## Current boundary

- M0: seven-day existing-product go/no-go validation.
- M1: source registry, immutable raw evidence, normalized observations, stable identities, health and replay.
- Not present: public rankings, Chinese reports, website, email, Obsidian plugin, or Agent.

## Local verification

Use Node 24.15.0 and pnpm 11.18.0. Run `pnpm check`. For M1 integration, copy `.env.example` to `.env`, run `pnpm infra:up`, load the environment, then run `pnpm db:migrate`, `pnpm db:seed`, and `pnpm test:integration`.

Operational details are in `docs/runbooks/` and the approved design is in `docs/superpowers/specs/2026-08-03-github-picks-open-source-intelligence-design.md`.
```

Apply this exact root script entry:

```diff
 // package.json
 "scripts": {
+  "m1:accept": "pnpm --filter @github-picks/acceptance m1"
 }
```

- [ ] **Step 5: Execute all M1 gates and commit the release-ready foundation**

Run:

```bash
set -a && source .env && set +a
pnpm check
pnpm db:migrate
pnpm db:seed
pnpm test:integration
pnpm m1:accept
pnpm sources:health
git diff --check
```

Expected: all code/tests pass; live acceptance prints `passed: true`; Source Health has no offline S/A source; replay samples return empty diff; Git worktree contains only intended acceptance evidence.

```bash
git add README.md package.json pnpm-lock.yaml .github tools/acceptance docs/runbooks
git commit -m "docs: complete M1 evidence foundation acceptance"
```

## M1 Completion Checklist

- [ ] M0 generated decision is exactly `BUILD`.
- [ ] Source Registry has 13 versioned sources with legal/rate/fallback metadata.
- [ ] Baseline targets cover all 13 adapters; GH Archive advances a delayed rolling hour and conditional cursors survive scheduler runs.
- [ ] Rolling test fixtures cover every adapter and parser.
- [ ] Every live source run stores immutable raw bytes before observations are considered durable.
- [ ] Every observation points to raw_snapshot, source, observed time, and parser version.
- [ ] Repository rename/transfer preserves one GitHub node identity and temporal aliases.
- [ ] Organization owners and contributor maintainers resolve to stable entities with evidence-linked repository relationships.
- [ ] Fork and package links retain mapping confidence and unresolved state.
- [ ] Queue jobs are idempotent; quarantine is never scheduled into normal collection.
- [ ] Credentials and cookies are absent from logs, response headers, fixtures and DLQ.
- [ ] Source Health enforces success/freshness state and non-zero failure exit.
- [ ] GitHub X-Poll-Interval, Retry-After, rate reset, network retry, metrics scrape, and parser-circuit behavior have regression proof.
- [ ] Replay reproduces stored observations from S3 raw bytes.
- [ ] CI, local integration and live acceptance gates pass.
- [ ] No M2 scoring, M3 website, M4 Obsidian or M5 Agent code has entered the repository.
