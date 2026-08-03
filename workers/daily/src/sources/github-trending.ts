import {
  type CandidateSignal,
  CandidateSignalSchema,
} from "@github-picks/core";
import { load } from "cheerio";
import type { DiscoveryAdapter, DiscoveryContext } from "../discovery.js";
import { requestArtifact } from "../http.js";
import { normalizeRepositoryId } from "../repository-id.js";

const sourceUrl = "https://github.com/trending?since=daily";

export function parseGitHubTrending(
  html: string,
  observedAt: string,
): CandidateSignal[] {
  const $ = load(html);
  return $("article.Box-row h2 a")
    .toArray()
    .flatMap((element, index) => {
      const fullName = normalizeRepositoryId($(element).attr("href") ?? "");
      if (fullName === null) return [];
      return [
        CandidateSignalSchema.parse({
          fullName,
          sourceId: "github-trending",
          sourceTier: "B",
          independenceGroup: "github-public-data",
          direction: null,
          evidenceUrl: sourceUrl,
          observedAt,
          rank: index + 1,
          sourceScore: null,
          stale: false,
          summaryZh: null,
          metrics: {
            starVelocity: null,
            trendingScore: null,
            discussionPoints: null,
            discussionComments: null,
          },
          rawObjectRef: null,
        }),
      ];
    });
}

export class GitHubTrendingAdapter implements DiscoveryAdapter {
  readonly sourceId = "github-trending";

  async discover(context: DiscoveryContext): Promise<CandidateSignal[]> {
    const artifact = await requestArtifact({
      sourceId: this.sourceId,
      url: sourceUrl,
      observedAt: context.observedAt,
      rawStore: context.rawStore,
      fetchImpl: context.fetchImpl,
      headers: { Accept: "text/html" },
    });
    return parseGitHubTrending(artifact.text, context.observedAt).map(
      (signal) => ({
        ...signal,
        rawObjectRef: artifact.rawRef.objectRef,
      }),
    );
  }
}
