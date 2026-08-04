# AI Hot Source Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI Hot as a conservative, attributable GitHub repository discovery source without turning GitHub Picks into a general AI-news product or allowing news heat to alter repository scores.

**Architecture:** A new `AiHotAdapter` calls the official anonymous v1 items endpoint with a 24-hour `mode=all` server-side GitHub query, accepts only strict repository-home URLs, coalesces duplicate mentions, and emits ordinary `CandidateSignal` values. A file-backed conditional-response cache extends the existing immutable raw-artifact flow with ETag/304 reuse, while optional generic provenance preserves the AI Hot item and upstream source. Existing discovery merging, GitHub enrichment, scoring, report generation, and static website consumption remain authoritative.

**Tech Stack:** Node.js 24.15.x, pnpm 11.18.0, TypeScript 7.0.2, Zod 4.4.3, Vitest 4.1.10, Next.js 16.3.0, React 19.2.8, native `fetch`, YAML.

## Global Constraints

- Use only the anonymous read-only `https://aihot.virxact.com/api/v1/*` surface; never request or send an API key, cookie, account, or user data.
- The first-page query is exactly `mode=all`, `window=24h`, `by=timeline`, `q=GitHub`, `limit=100`; cursors are opaque and remain bound to that query.
- Only `links.original` values accepted by `normalizeRepositoryId()` become candidates. Do not infer repositories from titles, summaries, search rank, articles, X posts, WeChat posts, or paper pages.
- AI Hot ordering is chronological, so emitted signals always have `rank: null`; AI Hot supplies no Star velocity, discussion, engineering, security, or risk facts.
- AI Hot `score` may select the representative item within one source only; it must not change `signalQuality`, eight-dimension scoring, risk penalties, or rankings.
- Preserve backward compatibility: historical `DailyReport` files without provenance must continue to parse and build.
- Public UI must contain a discoverable `数据来源：AI HOT` link to `https://aihot.virxact.com/`; do not mirror the full AI Hot feed or third-party content.
- No new runtime dependency is permitted.
- Raw responses and conditional-cache indexes stay under ignored `artifacts/raw/`; reports never expose local absolute paths.
- Follow TDD for every behavior change: red test, minimal implementation, green test, scoped commit.
- Preserve every unrelated working-tree file and concurrent commit; inspect `git status --short` before each scoped `git add` and never stage by directory when unrelated files are present.
- Design reference: `docs/superpowers/specs/2026-08-04-ai-hot-source-design.md`.

## File Map

- `packages/picks-core/src/schema.ts`: owns the optional, generic candidate-signal provenance contract.
- `packages/picks-core/test/schema.test.ts`: proves new and historical candidate signals both parse.
- `workers/daily/src/conditional-cache.ts`: owns ETag index persistence and cached raw-body retrieval.
- `workers/daily/test/conditional-cache.test.ts`: proves cache round trips and corrupt/missing bodies degrade to a miss.
- `workers/daily/src/http.ts`: sends conditional headers, handles 304, and exposes safe error bodies for stable Problem-code routing.
- `workers/daily/test/http.test.ts`: proves 200/304 reuse, cache recovery, retries, and terminal-error preservation.
- `workers/daily/src/sources/ai-hot.ts`: owns AI Hot schemas, entity filtering, coalescing, pagination, and cursor recovery.
- `workers/daily/test/fixtures/ai-hot.json`: deterministic official-v1-shaped response.
- `workers/daily/test/ai-hot.test.ts`: proves parsing, rejection, deduplication, source grouping, pagination, and invalid-cursor restart.
- `workers/daily/src/discovery.ts`: makes the conditional cache available to adapters without changing existing adapter behavior.
- `workers/daily/src/pipeline.ts`: constructs the file cache and registers `AiHotAdapter` in the live source set.
- `workers/daily/test/pipeline.test.ts`: proves adapter registration, replay compatibility, provenance retention, and manifest raw-reference collection.
- `config/picks.yaml`: registers AI Hot tier, purpose, independence group, and evidence URL.
- `packages/picks-core/test/config.test.ts`: verifies the exact source declaration.
- `apps/web/src/lib/site-meta.ts`: supplies the Chinese display name.
- `apps/web/src/components/source-health-table.tsx`: supplies product-level attribution on the source page.
- `apps/web/test/detail-pages.test.tsx` and `apps/web/test/view-model.test.ts`: prove attribution and source naming.
- `README.md` and `docs/runbooks/daily-pipeline.md`: document the new live source, evidence semantics, ETag behavior, and recovery.
- `artifacts/daily/2026-08-04/*`: refreshed live report, Markdown, and manifest after all gates pass with required AI analysis.

---

### Task 1: Add the backward-compatible provenance contract

**Files:**
- Modify: `packages/picks-core/src/schema.ts`
- Create: `packages/picks-core/test/schema.test.ts`

**Interfaces:**
- Produces: `CandidateSignalProvenanceSchema` and `CandidateSignalProvenance`.
- Extends: `CandidateSignalSchema` with optional property `provenance?: CandidateSignalProvenance`.
- Compatibility rule: parsing an existing candidate signal without `provenance` must produce the same object without inserting a default.

- [ ] **Step 1: Write the failing provenance and legacy-compatibility tests**

Create `packages/picks-core/test/schema.test.ts` with this complete test:

```ts
import { describe, expect, it } from "vitest";
import { CandidateSignalSchema } from "../src/schema.js";

const baseSignal = {
  fullName: "garagehq/nightcrawler",
  sourceId: "ai-hot",
  sourceTier: "C" as const,
  independenceGroup: "hacker-news-community",
  direction: null,
  evidenceUrl: "https://aihot.virxact.com/items/item-nightcrawler",
  observedAt: "2026-08-04T06:07:18.354Z",
  rank: null,
  sourceScore: 72,
  stale: false,
  summaryZh: "一款在智能手机上运行的本地 AI 渗透测试工具。",
  metrics: {
    starVelocity: null,
    trendingScore: null,
    discussionPoints: null,
    discussionComments: null,
  },
  rawObjectRef: `sha256:${"a".repeat(64)}`,
};

describe("candidate signal provenance", () => {
  it("retains generic aggregator and upstream-source provenance", () => {
    const signal = CandidateSignalSchema.parse({
      ...baseSignal,
      provenance: {
        aggregatorItemId: "item-nightcrawler",
        aggregatorUrl:
          "https://aihot.virxact.com/items/item-nightcrawler",
        originalUrl: "https://github.com/garagehq/nightcrawler",
        upstreamSourceName: "Hacker News 热门（buzzing.cc 中文翻译）",
        selected: false,
        publishedAt: "2026-08-04T05:00:00.000Z",
        discoveredAt: "2026-08-04T06:00:00.000Z",
      },
    });

    expect(signal.provenance?.upstreamSourceName).toContain("Hacker News");
    expect(signal.provenance?.originalUrl).toBe(
      "https://github.com/garagehq/nightcrawler",
    );
  });

  it("continues to parse historical signals without provenance", () => {
    expect(CandidateSignalSchema.parse(baseSignal)).toEqual(baseSignal);
  });
});
```

- [ ] **Step 2: Run the new test and verify the schema is red**

Run:

```bash
pnpm --filter @github-picks/core test -- schema.test.ts
```

Expected: FAIL because strict `CandidateSignalSchema` rejects `provenance`.

- [ ] **Step 3: Add the generic provenance schema and optional signal field**

Insert before `CandidateSignalSchema` in `packages/picks-core/src/schema.ts`:

```ts
export const CandidateSignalProvenanceSchema = z
  .object({
    aggregatorItemId: z.string().min(1),
    aggregatorUrl: z.url(),
    originalUrl: z.url(),
    upstreamSourceName: z.string().min(1),
    selected: z.boolean(),
    publishedAt: z.iso.datetime().nullable(),
    discoveredAt: z.iso.datetime(),
  })
  .strict();
export type CandidateSignalProvenance = z.infer<
  typeof CandidateSignalProvenanceSchema
>;
```

Add this property immediately before `rawObjectRef` in `CandidateSignalSchema`:

```ts
    provenance: CandidateSignalProvenanceSchema.optional(),
```

- [ ] **Step 4: Run core tests and typecheck**

Run:

```bash
pnpm --filter @github-picks/core test
pnpm --filter @github-picks/core typecheck
```

Expected: all core tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the contract**

```bash
git add packages/picks-core/src/schema.ts packages/picks-core/test/schema.test.ts
git commit -m "feat: add candidate signal provenance"
```

### Task 2: Add a file-backed conditional artifact cache

**Files:**
- Create: `workers/daily/src/conditional-cache.ts`
- Create: `workers/daily/test/conditional-cache.test.ts`

**Interfaces:**
- Produces: `ConditionalArtifact`, `ConditionalArtifactInput`, `ConditionalArtifactCache`, and `FileConditionalArtifactCache`.
- `read(sourceId, url)` returns the cached ETag, body, content type, and raw reference or `null`.
- `write(input)` atomically records an index that points at an already stored immutable raw object.
- `remove(sourceId, url)` removes only the exact cache index, never the immutable raw object.

- [ ] **Step 1: Write failing round-trip and broken-body tests**

Create `workers/daily/test/conditional-cache.test.ts`:

```ts
import { mkdtemp, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileConditionalArtifactCache } from "../src/conditional-cache.js";
import { FileRawStore } from "../src/raw-store.js";

describe("FileConditionalArtifactCache", () => {
  it("round-trips an ETag and immutable raw body by exact URL", async () => {
    const root = await mkdtemp(join(tmpdir(), "github-picks-cache-"));
    const rawStore = new FileRawStore(root);
    const cache = new FileConditionalArtifactCache(root);
    const body = new TextEncoder().encode('{"items":[]}');
    const rawRef = await rawStore.put({
      sourceId: "ai-hot",
      url: "https://aihot.virxact.com/api/v1/items?mode=all",
      observedAt: "2026-08-04T06:00:00.000Z",
      contentType: "application/json",
      body,
    });

    await cache.write({
      sourceId: "ai-hot",
      url: rawRef.url,
      etag: '"ai-hot-v1"',
      contentType: "application/json",
      rawRef,
    });

    const cached = await cache.read("ai-hot", rawRef.url);
    expect(cached?.etag).toBe('"ai-hot-v1"');
    expect(new TextDecoder().decode(cached?.body)).toBe('{"items":[]}');
    expect(cached?.rawRef.objectRef).toBe(rawRef.objectRef);
  });

  it("turns a missing raw body into a recoverable cache miss", async () => {
    const root = await mkdtemp(join(tmpdir(), "github-picks-cache-miss-"));
    const rawStore = new FileRawStore(root);
    const cache = new FileConditionalArtifactCache(root);
    const rawRef = await rawStore.put({
      sourceId: "ai-hot",
      url: "https://aihot.virxact.com/api/v1/items?mode=all",
      observedAt: "2026-08-04T06:00:00.000Z",
      contentType: "application/json",
      body: new TextEncoder().encode('{"items":[]}'),
    });
    await cache.write({
      sourceId: "ai-hot",
      url: rawRef.url,
      etag: '"ai-hot-v1"',
      contentType: "application/json",
      rawRef,
    });
    await unlink(rawRef.path);

    expect(await cache.read("ai-hot", rawRef.url)).toBeNull();
    expect(await cache.read("ai-hot", rawRef.url)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the cache test and verify it fails because the module is absent**

Run:

```bash
pnpm --filter @github-picks/daily test -- conditional-cache.test.ts
```

Expected: FAIL with module-not-found for `conditional-cache.js`.

- [ ] **Step 3: Implement the focused conditional-cache module**

Create `workers/daily/src/conditional-cache.ts` with these public types and behaviors:

```ts
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type RawArtifactRef,
  RawArtifactRefSchema,
} from "@github-picks/core";
import { z } from "zod";

const CacheIndexSchema = z
  .object({
    version: z.literal(1),
    sourceId: z.string().regex(/^[a-z0-9-]+$/),
    url: z.url(),
    etag: z.string().min(1),
    contentType: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    objectRef: z.string().min(8),
    observedAt: z.iso.datetime(),
  })
  .strict();

export interface ConditionalArtifact {
  etag: string;
  contentType: string;
  body: Uint8Array;
  rawRef: RawArtifactRef;
}

export interface ConditionalArtifactInput {
  sourceId: string;
  url: string;
  etag: string;
  contentType: string;
  rawRef: RawArtifactRef;
}

export interface ConditionalArtifactCache {
  read(sourceId: string, url: string): Promise<ConditionalArtifact | null>;
  write(input: ConditionalArtifactInput): Promise<void>;
  remove(sourceId: string, url: string): Promise<void>;
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export class FileConditionalArtifactCache
  implements ConditionalArtifactCache
{
  constructor(private readonly rootDirectory: string) {}

  private indexPath(sourceId: string, url: string): string {
    if (!/^[a-z0-9-]+$/.test(sourceId)) {
      throw new Error(`invalid source ID: ${sourceId}`);
    }
    const key = createHash("sha256").update(url).digest("hex");
    return join(this.rootDirectory, ".http-cache", sourceId, `${key}.json`);
  }

  async read(sourceId: string, url: string): Promise<ConditionalArtifact | null> {
    const path = this.indexPath(sourceId, url);
    let contents: string;
    try {
      contents = await readFile(path, "utf8");
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }

    try {
      const index = CacheIndexSchema.parse(JSON.parse(contents));
      if (index.sourceId !== sourceId || index.url !== url) {
        throw new Error("conditional cache key mismatch");
      }
      const objectPath = join(
        this.rootDirectory,
        sourceId,
        `${index.sha256}.bin`,
      );
      const body = new Uint8Array(await readFile(objectPath));
      const rawRef = RawArtifactRefSchema.parse({
        objectRef: index.objectRef,
        sha256: index.sha256,
        sourceId,
        path: objectPath,
        observedAt: index.observedAt,
        url,
      });
      return {
        etag: index.etag,
        contentType: index.contentType,
        body,
        rawRef,
      };
    } catch {
      await unlink(path).catch(() => undefined);
      return null;
    }
  }

  async write(input: ConditionalArtifactInput): Promise<void> {
    if (
      input.rawRef.sourceId !== input.sourceId ||
      input.rawRef.url !== input.url
    ) {
      throw new Error("conditional cache raw reference mismatch");
    }
    const path = this.indexPath(input.sourceId, input.url);
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(
          {
            version: 1,
            sourceId: input.sourceId,
            url: input.url,
            etag: input.etag,
            contentType: input.contentType,
            sha256: input.rawRef.sha256,
            objectRef: input.rawRef.objectRef,
            observedAt: input.rawRef.observedAt,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      await rename(temporaryPath, path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async remove(sourceId: string, url: string): Promise<void> {
    await unlink(this.indexPath(sourceId, url)).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
  }
}
```

- [ ] **Step 4: Run the cache tests and daily typecheck**

Run:

```bash
pnpm --filter @github-picks/daily test -- conditional-cache.test.ts
pnpm --filter @github-picks/daily typecheck
```

Expected: cache tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit the cache boundary**

```bash
git add workers/daily/src/conditional-cache.ts workers/daily/test/conditional-cache.test.ts
git commit -m "feat: add conditional artifact cache"
```

### Task 3: Teach the HTTP artifact layer ETag and 304 semantics

**Files:**
- Modify: `workers/daily/src/http.ts`
- Modify: `workers/daily/test/http.test.ts`

**Interfaces:**
- Consumes: `ConditionalArtifactCache` from Task 2.
- Extends: `RequestArtifactOptions` with `conditionalCache?: ConditionalArtifactCache` and `rateLimitFallbackMs?: number`.
- Extends: `HttpStatusError` with read-only `responseText` so adapters can inspect stable Problem `code` values without exposing them in public messages.
- Behavior: a valid cached ETag produces `If-None-Match`; a 304 returns cached bytes and raw reference; only successful 200 responses update the cache.

- [ ] **Step 1: Add failing HTTP conditional-request tests**

Add a memory implementation and these cases to `workers/daily/test/http.test.ts`:

```ts
import type {
  ConditionalArtifact,
  ConditionalArtifactCache,
  ConditionalArtifactInput,
} from "../src/conditional-cache.js";

class MemoryConditionalCache implements ConditionalArtifactCache {
  value: ConditionalArtifact | null = null;
  writes: ConditionalArtifactInput[] = [];
  removals: Array<[string, string]> = [];

  async read(): Promise<ConditionalArtifact | null> {
    return this.value;
  }

  async write(input: ConditionalArtifactInput): Promise<void> {
    this.writes.push(input);
  }

  async remove(sourceId: string, url: string): Promise<void> {
    this.removals.push([sourceId, url]);
    this.value = null;
  }
}
```

Add the following tests inside the existing `describe` block whose title is `requestArtifact`:

```ts
  it("sends If-None-Match and reuses cached bytes on 304", async () => {
    const store = new MemoryRawStore();
    const cache = new MemoryConditionalCache();
    const url = "https://aihot.virxact.com/api/v1/items?mode=all";
    cache.value = {
      etag: '"cached"',
      contentType: "application/json",
      body: new TextEncoder().encode('{"items":[{"id":"cached"}]}'),
      rawRef: {
        objectRef: `sha256:${"b".repeat(64)}`,
        sha256: "b".repeat(64),
        sourceId: "ai-hot",
        path: "/tmp/cached-ai-hot.bin",
        observedAt,
        url,
      },
    };
    let headers = new Headers();
    const fetchImpl = (async (
      _input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      headers = new Headers(init?.headers);
      return new Response(null, { status: 304, headers: { etag: '"cached"' } });
    }) as typeof fetch;

    const artifact = await requestArtifact({
      sourceId: "ai-hot",
      url,
      observedAt,
      rawStore: store,
      conditionalCache: cache,
      fetchImpl,
    });

    expect(headers.get("if-none-match")).toBe('"cached"');
    expect(artifact.status).toBe(304);
    expect(artifact.text).toContain('"cached"');
    expect(artifact.rawRef).toBe(cache.value?.rawRef);
    expect(store.inputs).toHaveLength(0);
    expect(cache.writes).toHaveLength(0);
  });

  it("stores a successful ETag after preserving the raw response", async () => {
    const store = new MemoryRawStore();
    const cache = new MemoryConditionalCache();
    await requestArtifact({
      sourceId: "ai-hot",
      url: "https://aihot.virxact.com/api/v1/items?mode=all",
      observedAt,
      rawStore: store,
      conditionalCache: cache,
      fetchImpl: (async () =>
        new Response('{"items":[]}', {
          status: 200,
          headers: {
            "content-type": "application/json",
            etag: '"fresh"',
          },
        })) as typeof fetch,
    });

    expect(store.inputs).toHaveLength(1);
    expect(cache.writes).toHaveLength(1);
    expect(cache.writes[0]?.etag).toBe('"fresh"');
  });

  it("retains a terminal Problem body for stable adapter routing", async () => {
    const store = new MemoryRawStore();
    const promise = requestArtifact({
      sourceId: "ai-hot",
      url: "https://aihot.virxact.com/api/v1/items?cursor=invalid",
      observedAt,
      rawStore: store,
      fetchImpl: (async () =>
        new Response('{"code":"invalid_cursor"}', {
          status: 400,
          headers: { "content-type": "application/problem+json" },
        })) as typeof fetch,
    });

    await expect(promise).rejects.toMatchObject({
      status: 400,
      responseText: '{"code":"invalid_cursor"}',
    });
  });

  it("uses the configured fallback when a 429 omits Retry-After", async () => {
    const store = new MemoryRawStore();
    let calls = 0;
    await requestArtifact({
      sourceId: "ai-hot",
      url: "https://aihot.virxact.com/api/v1/items?mode=all",
      observedAt,
      rawStore: store,
      rateLimitFallbackMs: 0,
      fetchImpl: (async () => {
        calls += 1;
        return calls === 1
          ? new Response('{"code":"rate_limited"}', { status: 429 })
          : new Response('{"items":[]}', { status: 200 });
      }) as typeof fetch,
    });

    expect(calls).toBe(2);
  });
```

- [ ] **Step 2: Run HTTP tests and verify the missing options/behavior fail**

Run:

```bash
pnpm --filter @github-picks/daily test -- http.test.ts
```

Expected: FAIL because `conditionalCache` and `responseText` are not implemented.

- [ ] **Step 3: Implement conditional HTTP behavior without changing existing callers**

In `workers/daily/src/http.ts`:

1. Import `ConditionalArtifactCache`.
2. Add these optional request fields:

```ts
  conditionalCache?: ConditionalArtifactCache | undefined;
  rateLimitFallbackMs?: number | undefined;
```

3. Replace the error constructor with:

```ts
export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly responseText: string,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
  }
}
```

4. At the start of `requestArtifact`, read the exact-URL cache once and merge its ETag into request headers:

```ts
  const cached =
    (await options.conditionalCache?.read(options.sourceId, options.url)) ??
    null;
  const requestHeaders = {
    Accept: "application/json, text/html;q=0.9",
    "User-Agent": userAgent,
    ...(cached === null ? {} : { "If-None-Match": cached.etag }),
    ...options.headers,
  };
```

5. Add this 304 branch immediately after the retry loop has produced `response` and before reading a new body:

```ts
  if (response.status === 304 && cached !== null) {
    const headers = safeHeaders(response.headers);
    return {
      url: options.url,
      status: 304,
      observedAt: options.observedAt,
      contentType: cached.contentType,
      body: cached.body,
      text: new TextDecoder().decode(cached.body),
      headers,
      rawRef: cached.rawRef,
    };
  }
```

6. For non-304 responses, keep the existing immutable raw write. After constructing `artifact` and confirming `response.ok`, persist a new cache index with:

```ts
  const etag = response.headers.get("etag");
  if (etag !== null && options.conditionalCache !== undefined) {
    await options.conditionalCache.write({
      sourceId: options.sourceId,
      url: options.url,
      etag,
      contentType,
      rawRef,
    });
  }
```

7. Throw terminal errors as `new HttpStatusError(response.status, options.url, artifact.text)`.
8. Replace `retryDelay` with the following exact function and pass `options.rateLimitFallbackMs` from `requestArtifact`:

```ts
function retryDelay(
  response: Response,
  attempt: number,
  rateLimitFallbackMs?: number,
): number {
  const retryAfterHeader = response.headers.get("retry-after");
  if (retryAfterHeader !== null) {
    const retryAfter = Number(retryAfterHeader);
    if (Number.isFinite(retryAfter) && retryAfter >= 0) {
      return Math.min(retryAfter * 1000, 60_000);
    }
  }
  if (response.status === 429 && rateLimitFallbackMs !== undefined) {
    return rateLimitFallbackMs;
  }
  return Math.min(
    250 * 2 ** attempt + Math.floor(Math.random() * 100),
    2_000,
  );
}
```

- [ ] **Step 4: Run HTTP, cache, and raw-store tests**

Run:

```bash
pnpm --filter @github-picks/daily test -- http.test.ts conditional-cache.test.ts raw-store.test.ts
pnpm --filter @github-picks/daily typecheck
```

Expected: all selected tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit conditional HTTP support**

```bash
git add workers/daily/src/http.ts workers/daily/test/http.test.ts
git commit -m "feat: support conditional source requests"
```

### Task 4: Build the AI Hot discovery adapter

**Files:**
- Modify: `packages/picks-core/test/scoring.test.ts`
- Modify: `workers/daily/src/discovery.ts`
- Create: `workers/daily/src/sources/ai-hot.ts`
- Create: `workers/daily/test/fixtures/ai-hot.json`
- Create: `workers/daily/test/ai-hot.test.ts`

**Interfaces:**
- Consumes: `CandidateSignalSchema`, `normalizeRepositoryId`, `requestArtifact`, and `ConditionalArtifactCache` from Task 2.
- Extends: `DiscoveryContext` with optional `conditionalCache?: ConditionalArtifactCache` before compiling the adapter.
- Produces: `parseAiHotPage(input): AiHotPage`, `buildAiHotSignals(items, observedAt): CandidateSignal[]`, and `AiHotAdapter` with `sourceId = "ai-hot"`.
- Pagination recovery: `invalid_cursor` clears collected items and cached URLs, then restarts from the first page once.

- [ ] **Step 1: Add an official-v1-shaped fixture**

Create `workers/daily/test/fixtures/ai-hot.json` with four entries:

```json
{
  "schemaVersion": 1,
  "query": {
    "mode": "all",
    "category": null,
    "q": "GitHub",
    "window": "24h",
    "by": "timeline",
    "ordering": "timelineDesc"
  },
  "items": [
    {
      "id": "nightcrawler-low",
      "title": "Nightcrawler：本地 AI 渗透测试工具",
      "originalTitle": null,
      "summary": "一款在智能手机上运行的本地 AI 渗透测试工具。",
      "source": { "name": "Hacker News 热门（buzzing.cc 中文翻译）" },
      "links": {
        "aihot": "https://aihot.virxact.com/items/nightcrawler-low",
        "original": "https://github.com/garagehq/nightcrawler"
      },
      "publishedAt": "2026-08-04T04:00:00.000Z",
      "discoveredAt": "2026-08-04T05:00:00.000Z",
      "category": "ai-products",
      "score": 55,
      "selected": false,
      "futureField": "ignored"
    },
    {
      "id": "nightcrawler-selected",
      "title": "Nightcrawler 入选",
      "originalTitle": null,
      "summary": null,
      "source": { "name": "Hacker News 热门（buzzing.cc 中文翻译）" },
      "links": {
        "aihot": "https://aihot.virxact.com/items/nightcrawler-selected",
        "original": "https://github.com/garagehq/nightcrawler"
      },
      "publishedAt": null,
      "discoveredAt": "2026-08-04T06:00:00.000Z",
      "category": null,
      "score": 50,
      "selected": true
    },
    {
      "id": "simple-english",
      "title": "SimpleEnglish Agent Skill",
      "originalTitle": null,
      "summary": "简化技术英语的文档生成技能。",
      "source": { "name": "独立开发者 RSS" },
      "links": {
        "aihot": "https://aihot.virxact.com/items/simple-english",
        "original": "https://github.com/AminBlg/SimpleEnglish"
      },
      "publishedAt": "2026-08-04T03:00:00.000Z",
      "discoveredAt": "2026-08-04T03:30:00.000Z",
      "category": "tip",
      "score": 61,
      "selected": false
    },
    {
      "id": "article-only",
      "title": "一篇提到 GitHub 的媒体文章",
      "originalTitle": null,
      "summary": "没有可验证仓库首页链接。",
      "source": { "name": "IT之家（RSS）" },
      "links": {
        "aihot": "https://aihot.virxact.com/items/article-only",
        "original": "https://www.ithome.com/0/985/448.htm"
      },
      "publishedAt": "2026-08-04T02:00:00.000Z",
      "discoveredAt": "2026-08-04T02:30:00.000Z",
      "category": "industry",
      "score": 47,
      "selected": false
    }
  ],
  "page": {
    "count": 4,
    "hasMore": false,
    "nextCursor": null
  }
}
```

- [ ] **Step 2: Write failing parser, deduplication, pagination, and cursor-restart tests**

Create `workers/daily/test/ai-hot.test.ts`. The tests must assert all of these exact outcomes:

```ts
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPicksConfig } from "@github-picks/core";
import { describe, expect, it } from "vitest";
import { FileRawStore } from "../src/raw-store.js";
import {
  AiHotAdapter,
  buildAiHotSignals,
  parseAiHotPage,
} from "../src/sources/ai-hot.js";

const observedAt = "2026-08-04T06:15:00.000Z";

async function fixture(): Promise<unknown> {
  return JSON.parse(
    await readFile(new URL("./fixtures/ai-hot.json", import.meta.url), "utf8"),
  );
}

function pageFor(
  id: string,
  originalUrl: string,
  hasMore: boolean,
  nextCursor: string | null,
) {
  return {
    schemaVersion: 1,
    query: {
      mode: "all",
      category: null,
      q: "GitHub",
      window: "24h",
      by: "timeline",
      ordering: "timelineDesc",
    },
    items: [
      {
        id,
        title: id,
        originalTitle: null,
        summary: `${id} repository`,
        source: { name: "独立开发者 RSS" },
        links: {
          aihot: `https://aihot.virxact.com/items/${id}`,
          original: originalUrl,
        },
        publishedAt: "2026-08-04T05:00:00.000Z",
        discoveredAt: "2026-08-04T05:30:00.000Z",
        category: "ai-products",
        score: 60,
        selected: false,
      },
    ],
    page: { count: 1, hasMore, nextCursor },
  };
}

describe("AI Hot discovery", () => {
  it("keeps strict repository URLs, coalesces duplicates, and preserves provenance", async () => {
    const page = parseAiHotPage(await fixture());
    const signals = buildAiHotSignals(
      page.items.map((item) => ({ item, rawObjectRef: `sha256:${"a".repeat(64)}` })),
      observedAt,
    );

    expect(signals.map((signal) => signal.fullName)).toEqual([
      "aminblg/simpleenglish",
      "garagehq/nightcrawler",
    ]);
    expect(signals[1]).toMatchObject({
      sourceId: "ai-hot",
      sourceTier: "C",
      independenceGroup: "hacker-news-community",
      rank: null,
      sourceScore: 50,
      metrics: {
        starVelocity: null,
        trendingScore: null,
        discussionPoints: null,
        discussionComments: null,
      },
      provenance: {
        aggregatorItemId: "nightcrawler-selected",
        selected: true,
        upstreamSourceName: "Hacker News 热门（buzzing.cc 中文翻译）",
      },
    });
    expect(signals[0]?.independenceGroup).toBe("ai-hot-aggregator");
  });

  it("rejects GitHub subpages and malformed required fields", async () => {
    const page = parseAiHotPage(await fixture());
    const issueItem = structuredClone(page.items[0]);
    if (issueItem === undefined) throw new Error("fixture item missing");
    issueItem.links.original =
      "https://github.com/garagehq/nightcrawler/issues/1";
    expect(
      buildAiHotSignals(
        [{ item: issueItem, rawObjectRef: null }],
        observedAt,
      ),
    ).toEqual([]);
    expect(() => parseAiHotPage({ schemaVersion: 1, items: [] })).toThrow();
  });
});
```

Add these two tests inside the same `describe` block:

```ts
  it("follows the opaque cursor until the page chain ends", async () => {
    const root = await mkdtemp(join(tmpdir(), "github-picks-ai-hot-pages-"));
    const config = await loadPicksConfig("../../config/picks.yaml");
    const requested: string[] = [];
    const fetchImpl = (async (input: URL | RequestInfo) => {
      const url = String(input);
      requested.push(url);
      const cursor = new URL(url).searchParams.get("cursor");
      return new Response(
        JSON.stringify(
          cursor === null
            ? pageFor(
                "first-page",
                "https://github.com/first/page",
                true,
                "cursor-2",
              )
            : pageFor(
                "second-page",
                "https://github.com/second/page",
                false,
                null,
              ),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const signals = await new AiHotAdapter().discover({
      config,
      observedAt,
      rawStore: new FileRawStore(root),
      githubToken: null,
      fetchImpl,
    });

    expect(requested).toHaveLength(2);
    expect(new URL(requested[1] ?? "").searchParams.get("cursor")).toBe(
      "cursor-2",
    );
    expect(signals.map((signal) => signal.fullName)).toEqual([
      "first/page",
      "second/page",
    ]);
  });

  it("restarts one invalid cursor chain without mixing abandoned items", async () => {
    const root = await mkdtemp(join(tmpdir(), "github-picks-ai-hot-restart-"));
    const config = await loadPicksConfig("../../config/picks.yaml");
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify(
            pageFor(
              "abandoned",
              "https://github.com/old/abandoned",
              true,
              "old-cursor",
            ),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (calls === 2) {
        return new Response('{"code":"invalid_cursor"}', {
          status: 400,
          headers: { "content-type": "application/problem+json" },
        });
      }
      if (calls === 3) {
        return new Response(
          JSON.stringify(
            pageFor(
              "restarted",
              "https://github.com/new/restarted",
              true,
              "new-cursor",
            ),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify(
          pageFor(
            "final",
            "https://github.com/second/repo",
            false,
            null,
          ),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const signals = await new AiHotAdapter().discover({
      config,
      observedAt,
      rawStore: new FileRawStore(root),
      githubToken: null,
      fetchImpl,
    });

    expect(calls).toBe(4);
    expect(signals.map((signal) => signal.fullName)).toEqual([
      "new/restarted",
      "second/repo",
    ]);
    expect(signals.some((signal) => signal.fullName === "old/abandoned")).toBe(
      false,
    );
  });
```

Add this characterization test inside the existing `explainable repository scoring` describe block in `packages/picks-core/test/scoring.test.ts`:

```ts
  it("does not turn an aggregator source score into repository value", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const snapshot = makeSnapshot();
    const signal = snapshot.candidateSignals[0];
    if (signal === undefined) {
      throw new Error("scoring fixture must contain a signal");
    }
    const aiHotSignal = {
      ...signal,
      sourceId: "ai-hot",
      sourceTier: "C" as const,
      independenceGroup: "ai-hot-aggregator",
      rank: null,
      metrics: {
        starVelocity: null,
        trendingScore: null,
        discussionPoints: null,
        discussionComments: null,
      },
    };
    const low = scoreRepository(
      makeSnapshot({
        candidateSignals: [{ ...aiHotSignal, sourceScore: 1 }],
      }),
      config,
    );
    const high = scoreRepository(
      makeSnapshot({
        candidateSignals: [{ ...aiHotSignal, sourceScore: 99 }],
      }),
      config,
    );

    expect(high.dimensions).toEqual(low.dimensions);
    expect(high.publishedScore).toBe(low.publishedScore);
    expect(high.riskPenalty).toBe(low.riskPenalty);
  });
```

- [ ] **Step 3: Run the adapter test and verify it is red**

Run:

```bash
pnpm --filter @github-picks/daily test -- ai-hot.test.ts
```

Expected: FAIL because `sources/ai-hot.ts` does not exist.

- [ ] **Step 4: Expose the optional cache to discovery adapters**

In `workers/daily/src/discovery.ts`, add the type import:

```ts
import type { ConditionalArtifactCache } from "./conditional-cache.js";
```

Add this property to `DiscoveryContext`:

```ts
  conditionalCache?: ConditionalArtifactCache | undefined;
```

- [ ] **Step 5: Implement strict AI Hot schemas, coalescing, pagination, and one-time cursor recovery**

Create `workers/daily/src/sources/ai-hot.ts` with this complete implementation:

```ts
import {
  type CandidateSignal,
  CandidateSignalSchema,
} from "@github-picks/core";
import { z } from "zod";
import type { DiscoveryAdapter, DiscoveryContext } from "../discovery.js";
import { HttpStatusError, requestArtifact } from "../http.js";
import { normalizeRepositoryId } from "../repository-id.js";

const sourceId = "ai-hot";
const endpoint = "https://aihot.virxact.com/api/v1/items";
const historyThresholdMs = 72 * 60 * 60 * 1000;

const AiHotItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    originalTitle: z.string().nullable(),
    summary: z.string().nullable(),
    source: z.object({ name: z.string().min(1) }).passthrough(),
    links: z
      .object({
        aihot: z.url(),
        original: z.url(),
      })
      .passthrough(),
    publishedAt: z.iso.datetime().nullable(),
    discoveredAt: z.iso.datetime(),
    category: z.string().nullable(),
    score: z.number().min(0).max(100).nullable(),
    selected: z.boolean(),
  })
  .passthrough();

const AiHotPageSchema = z
  .object({
    schemaVersion: z.literal(1),
    query: z
      .object({
        mode: z.enum(["selected", "all"]),
        category: z.string().nullable(),
        q: z.string().nullable(),
        window: z.enum(["24h", "7d"]),
        by: z.enum(["timeline", "published"]),
        ordering: z.string().min(1),
      })
      .passthrough(),
    items: z.array(AiHotItemSchema),
    page: z
      .object({
        count: z.int().nonnegative(),
        hasMore: z.boolean(),
        nextCursor: z.string().min(1).nullable(),
      })
      .strict(),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.page.hasMore && value.page.nextCursor === null) {
      context.addIssue({
        code: "custom",
        path: ["page", "nextCursor"],
        message: "AI Hot page with hasMore requires nextCursor",
      });
    }
  });

export type AiHotItem = z.infer<typeof AiHotItemSchema>;
export type AiHotPage = z.infer<typeof AiHotPageSchema>;

export interface CollectedAiHotItem {
  item: AiHotItem;
  rawObjectRef: string | null;
}

export function parseAiHotPage(input: unknown): AiHotPage {
  return AiHotPageSchema.parse(input);
}

function timelineTime(item: AiHotItem): number {
  const discoveredAt = Date.parse(item.discoveredAt);
  if (item.publishedAt === null) return discoveredAt;
  const publishedAt = Date.parse(item.publishedAt);
  return discoveredAt - publishedAt > historyThresholdMs
    ? publishedAt
    : discoveredAt;
}

function compareRepresentative(
  left: CollectedAiHotItem,
  right: CollectedAiHotItem,
): number {
  return (
    Number(right.item.selected) - Number(left.item.selected) ||
    (right.item.score ?? -1) - (left.item.score ?? -1) ||
    timelineTime(right.item) - timelineTime(left.item) ||
    left.item.id.localeCompare(right.item.id)
  );
}

function independenceGroupFor(sourceName: string): string {
  if (/hacker news/i.test(sourceName)) return "hacker-news-community";
  if (/github/i.test(sourceName)) return "github-public-data";
  return "ai-hot-aggregator";
}

export function buildAiHotSignals(
  items: CollectedAiHotItem[],
  observedAt: string,
): CandidateSignal[] {
  const representatives = new Map<string, CollectedAiHotItem>();
  for (const candidate of items) {
    const fullName = normalizeRepositoryId(candidate.item.links.original);
    if (fullName === null) continue;
    const current = representatives.get(fullName);
    if (
      current === undefined ||
      compareRepresentative(candidate, current) < 0
    ) {
      representatives.set(fullName, candidate);
    }
  }

  return [...representatives.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fullName, representative]) => {
      const { item, rawObjectRef } = representative;
      return CandidateSignalSchema.parse({
        fullName,
        sourceId,
        sourceTier: "C",
        independenceGroup: independenceGroupFor(item.source.name),
        direction: null,
        evidenceUrl: item.links.aihot,
        observedAt,
        rank: null,
        sourceScore: item.score,
        stale: false,
        summaryZh: item.summary,
        metrics: {
          starVelocity: null,
          trendingScore: null,
          discussionPoints: null,
          discussionComments: null,
        },
        provenance: {
          aggregatorItemId: item.id,
          aggregatorUrl: item.links.aihot,
          originalUrl: item.links.original,
          upstreamSourceName: item.source.name,
          selected: item.selected,
          publishedAt: item.publishedAt,
          discoveredAt: item.discoveredAt,
        },
        rawObjectRef,
      });
    });
}

function pageUrl(cursor: string | null): string {
  const parameters = new URLSearchParams({
    mode: "all",
    window: "24h",
    by: "timeline",
    q: "GitHub",
    limit: "100",
  });
  if (cursor !== null) parameters.set("cursor", cursor);
  return `${endpoint}?${parameters.toString()}`;
}

function problemCode(error: unknown): string | null {
  if (!(error instanceof HttpStatusError)) return null;
  try {
    const value: unknown = JSON.parse(error.responseText);
    if (
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      typeof value.code === "string"
    ) {
      return value.code;
    }
  } catch {
    return null;
  }
  return null;
}

export class AiHotAdapter implements DiscoveryAdapter {
  readonly sourceId = sourceId;

  async discover(context: DiscoveryContext): Promise<CandidateSignal[]> {
    let restarted = false;

    for (;;) {
      const collected: CollectedAiHotItem[] = [];
      const requestedUrls: string[] = [];
      const seenCursors = new Set<string>();
      let cursor: string | null = null;

      try {
        for (;;) {
          const url = pageUrl(cursor);
          requestedUrls.push(url);
          const artifact = await requestArtifact({
            sourceId,
            url,
            observedAt: context.observedAt,
            rawStore: context.rawStore,
            conditionalCache: context.conditionalCache,
            rateLimitFallbackMs: 60_000,
            fetchImpl: context.fetchImpl,
          });
          const page = parseAiHotPage(JSON.parse(artifact.text));
          collected.push(
            ...page.items.map((item) => ({
              item,
              rawObjectRef: artifact.rawRef.objectRef,
            })),
          );
          const signals = buildAiHotSignals(collected, context.observedAt);
          if (
            signals.length >= context.config.limits.candidateLimit ||
            !page.page.hasMore
          ) {
            return signals.slice(0, context.config.limits.candidateLimit);
          }
          const nextCursor = page.page.nextCursor;
          if (nextCursor === null || seenCursors.has(nextCursor)) {
            throw new Error("AI Hot returned a repeated or missing cursor");
          }
          seenCursors.add(nextCursor);
          cursor = nextCursor;
        }
      } catch (error) {
        if (problemCode(error) !== "invalid_cursor" || restarted) throw error;
        restarted = true;
        if (context.conditionalCache !== undefined) {
          for (const url of requestedUrls) {
            await context.conditionalCache.remove(sourceId, url);
          }
        }
      }
    }
  }
}
```

- [ ] **Step 6: Run the adapter and all discovery tests**

Run:

```bash
pnpm --filter @github-picks/daily test -- ai-hot.test.ts discovery.test.ts http.test.ts
pnpm --filter @github-picks/core test -- scoring.test.ts
pnpm --filter @github-picks/daily typecheck
```

Expected: all selected tests PASS and typecheck exits 0.

- [ ] **Step 7: Commit the adapter and discovery-context extension**

```bash
git add packages/picks-core/test/scoring.test.ts workers/daily/src/discovery.ts workers/daily/src/sources/ai-hot.ts workers/daily/test/ai-hot.test.ts workers/daily/test/fixtures/ai-hot.json
git commit -m "feat: add AI Hot discovery adapter"
```

### Task 5: Register AI Hot in configuration and the live pipeline

**Files:**
- Modify: `config/picks.yaml`
- Modify: `packages/picks-core/test/config.test.ts`
- Modify: `workers/daily/src/pipeline.ts`
- Modify: `workers/daily/test/pipeline.test.ts`

**Interfaces:**
- Consumes: `AiHotAdapter` and `FileConditionalArtifactCache`.
- Produces: exported `createDiscoveryAdapters(): DiscoveryAdapter[]` for deterministic wiring tests.
- Live behavior: pipeline constructs one file cache rooted at `options.rawDirectory` and shares it with AI Hot through the discovery context.

- [ ] **Step 1: Write failing configuration, registration, and replay-provenance assertions**

Add to `packages/picks-core/test/config.test.ts`:

```ts
    expect(
      config.sources.find((source) => source.sourceId === "ai-hot"),
    ).toEqual({
      sourceId: "ai-hot",
      name: "AI HOT",
      tier: "C",
      purpose: ["discovery", "cross_validation"],
      independenceGroup: "ai-hot-aggregator",
      evidenceUrl: "https://aihot.virxact.com/all",
    });
```

In `workers/daily/test/pipeline.test.ts`, import `createDiscoveryAdapters` beside `runDailyPipeline` and add this test before the replay describe block:

```ts
it("registers AI Hot exactly once in live discovery", () => {
  expect(
    createDiscoveryAdapters().filter(
      (adapter) => adapter.sourceId === "ai-hot",
    ),
  ).toHaveLength(1);
});
```

Inside `replaySnapshots()`, replace the candidate declaration with this conditional fixture so only the first snapshot carries AI Hot provenance:

```ts
    const usesAiHot = index === 0;
    const aiHotRawRef = rawRef("ai-hot", "f");
    const candidate: Candidate = {
      fullName,
      primaryDirection: direction,
      directions: [direction],
      signals: [
        {
          fullName,
          sourceId: usesAiHot ? "ai-hot" : "gittrend",
          sourceTier: usesAiHot ? "C" : "B",
          independenceGroup: usesAiHot
            ? "ai-hot-aggregator"
            : "github-public-data",
          direction,
          evidenceUrl: usesAiHot
            ? "https://aihot.virxact.com/items/replay-ai-hot"
            : "https://gittrend.io/api/trending?limit=50",
          observedAt,
          rank: usesAiHot ? null : index + 1,
          sourceScore: 100 - index,
          stale: false,
          summaryZh: usesAiHot ? "AI Hot 回放候选。" : null,
          metrics: {
            starVelocity: usesAiHot ? null : 100 - index,
            trendingScore: usesAiHot ? null : 100 - index,
            discussionPoints: null,
            discussionComments: null,
          },
          ...(usesAiHot
            ? {
                provenance: {
                  aggregatorItemId: "replay-ai-hot",
                  aggregatorUrl:
                    "https://aihot.virxact.com/items/replay-ai-hot",
                  originalUrl: `https://github.com/${fullName}`,
                  upstreamSourceName: "独立开发者 RSS",
                  selected: false,
                  publishedAt: observedAt,
                  discoveredAt: observedAt,
                },
              }
            : {}),
          rawObjectRef: usesAiHot ? aiHotRawRef.objectRef : null,
        },
      ],
    };
```

Add this source-health entry to the replay-manifest object in the test:

```ts
          {
            sourceId: "ai-hot",
            status: "healthy",
            observedAt,
            message: null,
          },
```

After reading the generated manifest, assert both provenance and the raw reference:

```ts
    expect(
      report.repositories[0]?.snapshot.candidateSignals[0]?.provenance
        ?.aggregatorItemId,
    ).toBe("replay-ai-hot");
    const manifest = JSON.parse(
      await readFile(join(outputDirectory, "manifest.json"), "utf8"),
    ) as { rawObjectRefs: string[] };
    expect(manifest.rawObjectRefs).toContain(`sha256:${"f".repeat(64)}`);
```

- [ ] **Step 2: Run focused tests and verify missing registration fails**

Run:

```bash
pnpm --filter @github-picks/core test -- config.test.ts
pnpm --filter @github-picks/daily test -- pipeline.test.ts
```

Expected: FAIL because AI Hot is neither configured nor registered.

- [ ] **Step 3: Add the source configuration and live wiring**

Add this source after Hacker News in `config/picks.yaml`:

```yaml
  - sourceId: ai-hot
    name: AI HOT
    tier: C
    purpose: [discovery, cross_validation]
    independenceGroup: ai-hot-aggregator
    evidenceUrl: https://aihot.virxact.com/all
```

In `workers/daily/src/pipeline.ts`:

- Import `DiscoveryAdapter`, `FileConditionalArtifactCache`, and `AiHotAdapter`.
- Export this source factory:

```ts
export function createDiscoveryAdapters(): DiscoveryAdapter[] {
  return [
    new ConfiguredSeedAdapter(),
    new GitHubTrendingAdapter(),
    new GitHubSearchAdapter(),
    new GitTrendAdapter(),
    new HubLensAdapter(),
    new HackerNewsAdapter(),
    new AiHotAdapter(),
  ];
}
```

- Replace the inline adapter array with `createDiscoveryAdapters()`.
- Construct `const conditionalCache = new FileConditionalArtifactCache(options.rawDirectory);` beside `FileRawStore` and pass it as `conditionalCache` in `DiscoveryContext`.

- [ ] **Step 4: Run core, daily pipeline, and replay gates**

Run:

```bash
pnpm --filter @github-picks/core test
pnpm --filter @github-picks/daily test
pnpm --filter @github-picks/daily typecheck
pnpm picks:daily --date 2026-08-03 --mode replay --output /tmp/github-picks-ai-hot-replay
```

Expected: all tests PASS; replay exits 0 without network and reports the same five-direction coverage.

- [ ] **Step 5: Commit live pipeline registration**

```bash
git add config/picks.yaml packages/picks-core/test/config.test.ts workers/daily/src/pipeline.ts workers/daily/test/pipeline.test.ts
git commit -m "feat: wire AI Hot into daily discovery"
```

### Task 6: Add website source naming and product-level attribution

**Files:**
- Modify: `apps/web/src/lib/site-meta.ts`
- Modify: `apps/web/src/components/source-health-table.tsx`
- Modify: `apps/web/test/detail-pages.test.tsx`
- Modify: `apps/web/test/view-model.test.ts`

**Interfaces:**
- Produces: `SOURCE_NAMES["ai-hot"] === "AI HOT"`.
- UI contract: source-status page exposes one discoverable external link named `AI HOT` to `https://aihot.virxact.com/`.

- [ ] **Step 1: Read the repository-mandated local Next.js guidance**

Read:

```bash
sed -n '1,220p' apps/web/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
sed -n '1,220p' apps/web/node_modules/next/dist/docs/01-app/02-guides/static-exports.md
```

Expected: confirm this remains a static Server Component with no client-side fetch or state.

- [ ] **Step 2: Add failing display-name and attribution tests**

In `apps/web/test/view-model.test.ts`, import `getSourceName` and add:

```ts
    expect(getSourceName("ai-hot")).toBe("AI HOT");
```

In the source-health test in `apps/web/test/detail-pages.test.tsx`, add:

```ts
    const attribution = screen.getByRole("link", { name: "AI HOT" });
    expect(attribution.getAttribute("href")).toBe(
      "https://aihot.virxact.com/",
    );
```

- [ ] **Step 3: Run web tests and verify the attribution is red**

Run:

```bash
pnpm --filter @github-picks/web test -- detail-pages.test.tsx view-model.test.ts
```

Expected: FAIL because the source name and attribution link are absent.

- [ ] **Step 4: Add source metadata and visible product attribution**

Add to `SOURCE_NAMES` in `apps/web/src/lib/site-meta.ts`:

```ts
  "ai-hot": "AI HOT",
```

Add after the existing Scorecard note in `SourceHealthTable`:

```tsx
      <p className="source-health-note">
        部分仓库发现信号由{" "}
        <a
          href="https://aihot.virxact.com/"
          target="_blank"
          rel="noreferrer"
        >
          AI HOT
        </a>{" "}
        提供；GitHub Picks 独立完成仓库事实核验、评分与中文分析。
      </p>
```

- [ ] **Step 5: Run web tests, typecheck, and static build**

Run:

```bash
pnpm --filter @github-picks/web test
pnpm --filter @github-picks/web typecheck
pnpm --filter @github-picks/web build
```

Expected: web tests PASS, typecheck exits 0, and static export completes. If Next.js rewrites `apps/web/next-env.d.ts`, inspect it separately and leave it unstaged unless the AI Hot change genuinely requires it.

- [ ] **Step 6: Commit only the website source changes**

```bash
git add apps/web/src/lib/site-meta.ts apps/web/src/components/source-health-table.tsx apps/web/test/detail-pages.test.tsx apps/web/test/view-model.test.ts
git commit -m "feat: attribute AI Hot on source page"
```

### Task 7: Document, run live acceptance, and publish the refreshed report

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/daily-pipeline.md`
- Modify: `artifacts/daily/2026-08-04/report.json`
- Modify: `artifacts/daily/2026-08-04/report.md`
- Modify: `artifacts/daily/2026-08-04/manifest.json`

**Interfaces:**
- Documentation names AI Hot as an executing discovery/cross-validation source, not a fact or scoring source.
- Published artifact contract contains `sourceHealth[sourceId=ai-hot]`; provenance appears only when an AI Hot candidate reaches enrichment.
- Existing AI recommendation publication boundary remains required: no final committed live report may downgrade verified AI analysis to rule fallback.

- [ ] **Step 1: Update README and runbook with exact operational semantics**

In README's current-source paragraph, include this exact substance:

```text
AI Hot 通过匿名 v1 API 补充过去 24 小时内直接指向 GitHub 仓库的 AI 资讯信号；媒体文章和无法严格映射 owner/repo 的内容不会进入候选池。AI Hot 的时间顺序与条目分数不参与仓库评分。
```

Add an AI Hot row to the runbook source table:

```markdown
| AI Hot | AI 资讯中的仓库发现、交叉验证 | 已知 Hacker News/GitHub 路径复用原来源组，其余统一为聚合组；无 rank 或指标加分 | 超时、限流、Schema 异常或无可解析仓库时降级 |
```

Document under request etiquette that AI Hot uses its exact-URL ETag, sends `If-None-Match`, reuses raw bytes on 304, follows opaque cursors, and waits 60 seconds for a 429 without `Retry-After`. Document under raw snapshots that `.http-cache/` stores only ignored local indexes pointing to immutable raw objects.

- [ ] **Step 2: Run the official API contract smoke check**

Run:

```bash
curl -fsS --max-time 30 \
  -H 'User-Agent: github-picks/0.1 (+https://github.com/AICode-Nexus/github-picks)' \
  'https://aihot.virxact.com/api/v1/items?mode=all&window=24h&by=timeline&q=GitHub&limit=100' \
  | jq -e '.schemaVersion == 1 and .query.mode == "all" and .query.window == "24h" and (.items | type == "array")'
```

Expected: `true` and exit 0. If the official service is temporarily unavailable, retain passing deterministic tests, report the live blocker, and do not claim live acceptance.

- [ ] **Step 3: Run all deterministic gates before replacing the live report**

Run:

```bash
pnpm format
TURBO_FORCE=true pnpm check
TURBO_FORCE=true pnpm build
pnpm picks:daily --date 2026-08-03 --mode replay --output /tmp/github-picks-ai-hot-final-replay
git diff --check
```

Expected: format completes; check, build, replay, and whitespace validation all exit 0.

- [ ] **Step 4: Run the live pipeline with required verified AI analysis**

Run:

```bash
GITHUB_TOKEN="$(gh auth token)" \
GITHUB_PICKS_AI_PROVIDER=ollama \
GITHUB_PICKS_AI_BASE_URL=http://127.0.0.1:11434 \
GITHUB_PICKS_AI_MODEL=qwen3-vl:8b \
GITHUB_PICKS_AI_REQUIRED=true \
pnpm picks:daily --date 2026-08-04 --mode live --output artifacts/daily/2026-08-04
```

Expected: exit 0; atomic publication prevents partial replacement if GitHub, AI Hot, or the required model fails. If the required local model is unavailable, stop and report the blocker rather than publishing fallback analysis.

- [ ] **Step 5: Validate the refreshed report, manifest, provenance boundaries, and secrets**

Run:

```bash
jq -e '.mode == "live" and any(.sourceHealth[]; .sourceId == "ai-hot")' artifacts/daily/2026-08-04/report.json
jq -e 'all(.repositories[]; .analysis.generation.kind == "ai" and .analysis.generation.status == "verified")' artifacts/daily/2026-08-04/report.json
jq -e '.sourceHealth | any(.sourceId == "ai-hot")' artifacts/daily/2026-08-04/manifest.json
grep -RInE 'GITHUB_TOKEN|Bearer [A-Za-z0-9._-]+|/Users/admin' artifacts/daily/2026-08-04 README.md docs/runbooks/daily-pipeline.md && exit 1 || true
git diff --check
```

Expected: all three `jq` checks print `true`; secret/path scan produces no matches; diff check exits 0. It is acceptable for `ai-hot` to be degraded only when its recorded message truthfully reflects no parseable repository or a live upstream failure.

- [ ] **Step 6: Run final website and repository gates against the refreshed live artifact**

Run:

```bash
TURBO_FORCE=true pnpm check
TURBO_FORCE=true pnpm build
pnpm --filter @github-picks/web test:e2e
git status --short
```

Expected: all gates exit 0. `git status --short` may still show unrelated user-owned files; no AI Hot implementation file may remain unstaged accidentally.

- [ ] **Step 7: Commit documentation and the verified live artifacts**

```bash
git add README.md docs/runbooks/daily-pipeline.md artifacts/daily/2026-08-04/report.json artifacts/daily/2026-08-04/report.md artifacts/daily/2026-08-04/manifest.json
git commit -m "docs: publish AI Hot-backed daily report"
```

## Final Verification Checklist

- [ ] `git log --oneline -8` shows one focused commit for each task plus the approved design and plan documentation.
- [ ] `git diff --check HEAD^` reports no whitespace errors in the final commit.
- [ ] `git status --short --branch` shows the branch ahead only by intended commits and preserves unrelated user-owned files.
- [ ] `report.json` and `manifest.json` both contain `sourceId: ai-hot` health state.
- [ ] Any published AI Hot signal contains strict provenance and no fabricated rank or metrics.
- [ ] The website source page contains a discoverable AI HOT attribution link.
- [ ] No API key, cookie, token, local absolute path, raw response, or cache index is staged.
