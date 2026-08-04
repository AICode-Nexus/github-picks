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
