import type { RawArtifactRef } from "@github-picks/core";
import { describe, expect, it } from "vitest";
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
});
