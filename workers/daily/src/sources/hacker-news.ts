import {
  type CandidateSignal,
  CandidateSignalSchema,
} from "@github-picks/core";
import type { DiscoveryAdapter, DiscoveryContext } from "../discovery.js";
import { requestArtifact } from "../http.js";
import { normalizeRepositoryId } from "../repository-id.js";

interface HackerNewsResponse {
  hits?: Array<{
    objectID?: unknown;
    url?: unknown;
    points?: unknown;
    num_comments?: unknown;
  }>;
}

export function parseHackerNews(
  input: unknown,
  observedAt: string,
): CandidateSignal[] {
  const response = input as HackerNewsResponse;
  if (!Array.isArray(response.hits)) return [];
  return response.hits.flatMap((item, index) => {
    const fullName = normalizeRepositoryId(
      typeof item.url === "string" ? item.url : "",
    );
    if (fullName === null) return [];
    const itemId =
      typeof item.objectID === "string" ? item.objectID : "unknown";
    return [
      CandidateSignalSchema.parse({
        fullName,
        sourceId: "hacker-news",
        sourceTier: "B",
        independenceGroup: "hacker-news-community",
        direction: null,
        evidenceUrl: `https://news.ycombinator.com/item?id=${itemId}`,
        observedAt,
        rank: index + 1,
        sourceScore: typeof item.points === "number" ? item.points : null,
        stale: false,
        summaryZh: null,
        metrics: {
          starVelocity: null,
          trendingScore: null,
          discussionPoints:
            typeof item.points === "number" ? item.points : null,
          discussionComments:
            typeof item.num_comments === "number" ? item.num_comments : null,
        },
        rawObjectRef: null,
      }),
    ];
  });
}

export class HackerNewsAdapter implements DiscoveryAdapter {
  readonly sourceId = "hacker-news";

  async discover(context: DiscoveryContext): Promise<CandidateSignal[]> {
    const after = Math.floor(
      (Date.parse(context.observedAt) - 48 * 60 * 60 * 1000) / 1000,
    );
    const query = new URLSearchParams({
      query: "github.com",
      tags: "story",
      hitsPerPage: "50",
      numericFilters: `created_at_i>${after}`,
    });
    const url = `https://hn.algolia.com/api/v1/search_by_date?${query.toString()}`;
    const artifact = await requestArtifact({
      sourceId: this.sourceId,
      url,
      observedAt: context.observedAt,
      rawStore: context.rawStore,
      fetchImpl: context.fetchImpl,
    });
    return parseHackerNews(JSON.parse(artifact.text), context.observedAt).map(
      (signal) => ({
        ...signal,
        rawObjectRef: artifact.rawRef.objectRef,
      }),
    );
  }
}
