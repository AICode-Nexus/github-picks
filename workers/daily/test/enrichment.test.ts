import { readFile } from "node:fs/promises";
import { type Candidate, loadPicksConfig } from "@github-picks/core";
import { describe, expect, it } from "vitest";
import { enrichCandidate } from "../src/enrichment.js";
import { parseGitHubSnapshot } from "../src/github.js";
import { FileRawStore } from "../src/raw-store.js";

const observedAt = "2026-08-03T15:30:00.000Z";

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

async function candidate(): Promise<Candidate> {
  const config = await loadPicksConfig("../../config/picks.yaml");
  const source = config.sources.find((item) => item.sourceId === "gittrend");
  if (source === undefined) throw new Error("gittrend source missing");
  return {
    fullName: "openai/codex",
    primaryDirection: "ai-agent",
    directions: ["ai-agent"],
    signals: [
      {
        fullName: "openai/codex",
        sourceId: source.sourceId,
        sourceTier: source.tier,
        independenceGroup: source.independenceGroup,
        direction: "ai-agent",
        evidenceUrl: "https://gittrend.io/api/trending?limit=50",
        observedAt,
        rank: 1,
        sourceScore: 100,
        stale: false,
        summaryZh: null,
        metrics: {
          starVelocity: 500,
          trendingScore: 100,
          discussionPoints: null,
          discussionComments: null,
        },
        rawObjectRef: `sha256:${"a".repeat(64)}`,
      },
    ],
  };
}

function rawRef(sourceId: string, hashCharacter: string) {
  const sha256 = hashCharacter.repeat(64);
  return {
    objectRef: `sha256:${sha256}`,
    sha256,
    sourceId,
    path: `/tmp/${sourceId}-${sha256}.bin`,
    observedAt,
    url: `https://example.com/${sourceId}`,
  };
}

describe("repository enrichment", () => {
  it("derives repository identity and human activity from GitHub facts", async () => {
    const snapshot = parseGitHubSnapshot({
      repository: JSON.parse(await fixture("github-repository.json")),
      events: JSON.parse(await fixture("github-events.json")),
      candidate: await candidate(),
      observedAt,
      repositoryRawRef: rawRef("github-rest", "b"),
      eventsRawRef: rawRef("github-rest", "c"),
    });

    expect(snapshot.nodeId).toBe("R_kgDOExample");
    expect(snapshot.ownerType).toBe("Organization");
    expect(snapshot.licenseSpdx).toBe("Apache-2.0");
    expect(snapshot.eventFeatures).toEqual({
      activeDays7d: 4,
      activeDays30d: 4,
      humanActors30d: 4,
      pushes30d: 1,
      pullRequests30d: 1,
      issues30d: 1,
      releases30d: 1,
    });
    expect(snapshot.missingFields).toContain("scorecard");
  });

  it("adds OpenSSF evidence without replacing GitHub facts", async () => {
    const repository = await fixture("github-repository.json");
    const events = await fixture("github-events.json");
    const scorecard = await fixture("scorecard.json");
    const fetchImpl = (async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("api.securityscorecards.dev")) {
        return new Response(scorecard, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/events?per_page=100")) {
        return new Response(events, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(repository, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const snapshot = await enrichCandidate(await candidate(), {
      observedAt,
      reportDate: "2026-08-03",
      rawStore: new FileRawStore("/tmp/github-picks-enrichment-success"),
      githubToken: null,
      fetchImpl,
    });

    expect(snapshot.scorecard?.score).toBe(7.8);
    expect(snapshot.missingFields).not.toContain("scorecard");
    expect(
      snapshot.evidence.some((item) => item.sourceId === "openssf-scorecard"),
    ).toBe(true);
  });

  it("keeps an unavailable Scorecard as missing rather than a zero score", async () => {
    const repository = await fixture("github-repository.json");
    const events = await fixture("github-events.json");
    const fetchImpl = (async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("api.securityscorecards.dev"))
        return new Response("missing", { status: 404 });
      if (url.endsWith("/events?per_page=100"))
        return new Response(events, { status: 200 });
      return new Response(repository, { status: 200 });
    }) as typeof fetch;

    const snapshot = await enrichCandidate(await candidate(), {
      observedAt,
      reportDate: "2026-08-03",
      rawStore: new FileRawStore("/tmp/github-picks-enrichment-missing"),
      githubToken: null,
      fetchImpl,
    });

    expect(snapshot.scorecard).toBeNull();
    expect(snapshot.missingFields).toContain("scorecard");
  });
});
