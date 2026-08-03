import { readFile } from "node:fs/promises";
import { loadPicksConfig } from "@github-picks/core";
import { describe, expect, it } from "vitest";
import { discoverCandidates, mergeCandidateSignals } from "../src/discovery.js";
import { FileRawStore } from "../src/raw-store.js";
import { normalizeRepositoryId } from "../src/repository-id.js";
import { parseGitHubSearch } from "../src/sources/github-search.js";
import { parseGitHubTrending } from "../src/sources/github-trending.js";
import { parseGitTrend } from "../src/sources/gittrend.js";
import { parseHackerNews } from "../src/sources/hacker-news.js";
import { parseHubLens } from "../src/sources/hublens.js";

const observedAt = "2026-08-03T15:30:00.000Z";

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

describe("candidate discovery", () => {
  it("normalizes GitHub repository URLs into stable temporary IDs", () => {
    expect(normalizeRepositoryId("https://github.com/OpenAI/Codex.git")).toBe(
      "openai/codex",
    );
    expect(normalizeRepositoryId("/Astral-SH/uv/")).toBe("astral-sh/uv");
    expect(normalizeRepositoryId("https://example.com/not-github")).toBeNull();
  });

  it("parses each discovery source without treating stale data as fresh", async () => {
    const trending = parseGitHubTrending(
      await fixture("github-trending.html"),
      observedAt,
    );
    const search = parseGitHubSearch(
      JSON.parse(await fixture("github-search.json")),
      observedAt,
      "ai-agent",
    );
    const gitTrend = parseGitTrend(
      JSON.parse(await fixture("gittrend.json")),
      observedAt,
    );
    const hubLens = parseHubLens(
      JSON.parse(await fixture("hublens.json")),
      observedAt,
    );
    const hackerNews = parseHackerNews(
      JSON.parse(await fixture("hacker-news.json")),
      observedAt,
    );

    expect(trending[0]?.fullName).toBe("openai/codex");
    expect(search[1]?.fullName).toBe("aider-ai/aider");
    expect(gitTrend[0]?.metrics.starVelocity).toBe(2523);
    expect(hubLens[0]?.stale).toBe(true);
    expect(hackerNews).toHaveLength(1);
    expect(hackerNews[0]?.fullName).toBe("mdp/driftty");
  });

  it("deduplicates repositories while retaining every source signal", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const signals = [
      ...parseGitHubTrending(await fixture("github-trending.html"), observedAt),
      ...parseGitHubSearch(
        JSON.parse(await fixture("github-search.json")),
        observedAt,
        "ai-agent",
      ),
      ...parseGitTrend(JSON.parse(await fixture("gittrend.json")), observedAt),
      ...parseHubLens(JSON.parse(await fixture("hublens.json")), observedAt),
    ];

    const merged = mergeCandidateSignals(signals, config);
    const codex = merged.find(
      (candidate) => candidate.fullName === "openai/codex",
    );

    expect(codex?.signals).toHaveLength(4);
    expect(codex?.primaryDirection).toBe("ai-agent");
    expect(
      new Set(codex?.signals.map((signal) => signal.independenceGroup)),
    ).toEqual(new Set(["github-public-data", "hublens-aggregator"]));
  });

  it("continues with healthy sources while reporting a failed source as degraded", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const rawStore = new FileRawStore("/tmp/github-picks-discovery-test");
    const signal = parseGitTrend(
      JSON.parse(await fixture("gittrend.json")),
      observedAt,
    )[0];
    if (signal === undefined) throw new Error("fixture must contain a signal");

    const result = await discoverCandidates(
      [
        { sourceId: "gittrend", discover: async () => [signal] },
        {
          sourceId: "hublens",
          discover: async () => {
            throw new TypeError("upstream response changed");
          },
        },
      ],
      { config, observedAt, rawStore, githubToken: null },
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.sourceHealth).toEqual([
      { sourceId: "gittrend", status: "healthy", observedAt, message: null },
      {
        sourceId: "hublens",
        status: "degraded",
        observedAt,
        message: "TypeError",
      },
    ]);
  });

  it("fails only when every discovery source is unavailable", async () => {
    const config = await loadPicksConfig("../../config/picks.yaml");
    const rawStore = new FileRawStore(
      "/tmp/github-picks-discovery-test-all-failed",
    );

    await expect(
      discoverCandidates(
        [
          {
            sourceId: "gittrend",
            discover: async () => {
              throw new Error("offline");
            },
          },
        ],
        { config, observedAt, rawStore, githubToken: null },
      ),
    ).rejects.toThrow("all discovery sources failed");
  });
});
