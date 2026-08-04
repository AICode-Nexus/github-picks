import type { RawArtifactRef } from "@github-picks/core";
import { describe, expect, it } from "vitest";
import type {
  ConditionalArtifact,
  ConditionalArtifactCache,
  ConditionalArtifactInput,
} from "../src/conditional-cache.js";
import { HttpStatusError, requestArtifact } from "../src/http.js";
import type { RawArtifactInput, RawStore } from "../src/raw-store.js";

class MemoryRawStore implements RawStore {
  readonly inputs: RawArtifactInput[] = [];

  async put(input: RawArtifactInput): Promise<RawArtifactRef> {
    this.inputs.push(input);
    return {
      objectRef: `sha256:${"a".repeat(64)}`,
      sha256: "a".repeat(64),
      sourceId: input.sourceId,
      path: "/tmp/raw.bin",
      observedAt: input.observedAt,
      url: input.url,
    };
  }
}

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

const observedAt = "2026-08-03T15:30:00.000Z";

describe("requestArtifact", () => {
  it("uses the public project user agent and stores the response body", async () => {
    const store = new MemoryRawStore();
    let requestHeaders = new Headers();
    const fetchImpl = (async (
      _input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      requestHeaders = new Headers(init?.headers);
      return new Response('{"data":[]}', {
        status: 200,
        headers: { "content-type": "application/json", etag: '"abc"' },
      });
    }) as typeof fetch;

    const artifact = await requestArtifact({
      sourceId: "gittrend",
      url: "https://gittrend.io/api/trending",
      observedAt,
      rawStore: store,
      fetchImpl,
    });

    expect(requestHeaders.get("user-agent")).toBe(
      "github-picks/0.1 (+https://github.com/AICode-Nexus/github-picks)",
    );
    expect(store.inputs).toHaveLength(1);
    expect(artifact.text).toBe('{"data":[]}');
    expect(artifact.headers).toEqual({
      "content-type": "application/json",
      etag: '"abc"',
    });
  });

  it("retries a rate-limited response before storing the successful body", async () => {
    const store = new MemoryRawStore();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return calls === 1
        ? new Response("limited", {
            status: 429,
            headers: { "retry-after": "0" },
          })
        : new Response("ok", { status: 200 });
    }) as typeof fetch;

    const artifact = await requestArtifact({
      sourceId: "hublens",
      url: "https://hublens.dev/api/v1/trending",
      observedAt,
      rawStore: store,
      fetchImpl,
    });

    expect(calls).toBe(2);
    expect(artifact.text).toBe("ok");
    expect(store.inputs).toHaveLength(1);
  });

  it("stores a terminal error response before returning a typed failure", async () => {
    const store = new MemoryRawStore();
    const fetchImpl = (async () =>
      new Response("missing", { status: 404 })) as typeof fetch;

    await expect(
      requestArtifact({
        sourceId: "github-search",
        url: "https://api.github.com/repos/missing/repository",
        observedAt,
        rawStore: store,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(HttpStatusError);
    expect(store.inputs).toHaveLength(1);
  });

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
});
