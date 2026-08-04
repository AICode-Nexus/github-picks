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
      page.items.map((item) => ({
        item,
        rawObjectRef: `sha256:${"a".repeat(64)}`,
      })),
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
      buildAiHotSignals([{ item: issueItem, rawObjectRef: null }], observedAt),
    ).toEqual([]);
    expect(() => parseAiHotPage({ schemaVersion: 1, items: [] })).toThrow();
  });

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
    expect(new URL(requested[0] ?? "").search).toBe(
      "?mode=all&window=24h&by=timeline&q=GitHub&limit=100",
    );
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
    const removedUrls: string[] = [];
    const conditionalCache = {
      async read() {
        return null;
      },
      async write() {},
      async remove(_sourceId: string, url: string) {
        removedUrls.push(url);
      },
    };
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
          pageFor("final", "https://github.com/second/repo", false, null),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const signals = await new AiHotAdapter().discover({
      config,
      observedAt,
      rawStore: new FileRawStore(root),
      conditionalCache,
      githubToken: null,
      fetchImpl,
    });

    expect(calls).toBe(4);
    expect(removedUrls).toHaveLength(2);
    expect(new URL(removedUrls[1] ?? "").searchParams.get("cursor")).toBe(
      "old-cursor",
    );
    expect(signals.map((signal) => signal.fullName)).toEqual([
      "new/restarted",
      "second/repo",
    ]);
    expect(signals.some((signal) => signal.fullName === "old/abandoned")).toBe(
      false,
    );
  });
});
