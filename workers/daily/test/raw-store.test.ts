import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRawStore } from "../src/raw-store.js";

describe("FileRawStore", () => {
  it("reuses the same immutable object for identical response bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "github-picks-raw-"));
    const store = new FileRawStore(root);
    const input = {
      sourceId: "gittrend",
      url: "https://gittrend.io/api/trending?limit=2",
      observedAt: "2026-08-03T15:30:00.000Z",
      contentType: "application/json",
      body: new TextEncoder().encode('{"data":[]}'),
    };

    const first = await store.put(input);
    const second = await store.put(input);

    expect(first.objectRef).toBe(second.objectRef);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(new Uint8Array(await readFile(first.path))).toEqual(input.body);
  });
});
