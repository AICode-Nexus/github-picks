import {
  type CandidateSignal,
  CandidateSignalSchema,
  type DirectionId,
} from "@github-picks/core";
import type { DiscoveryAdapter, DiscoveryContext } from "../discovery.js";
import { requestArtifact } from "../http.js";
import { normalizeRepositoryId } from "../repository-id.js";

interface GitHubSearchResponse {
  items?: Array<{ full_name?: unknown; html_url?: unknown; score?: unknown }>;
}

export function parseGitHubSearch(
  input: unknown,
  observedAt: string,
  direction: DirectionId,
): CandidateSignal[] {
  const response = input as GitHubSearchResponse;
  if (!Array.isArray(response.items)) return [];
  return response.items.flatMap((item, index) => {
    const fullName = normalizeRepositoryId(
      typeof item.full_name === "string" ? item.full_name : "",
    );
    if (fullName === null) return [];
    return [
      CandidateSignalSchema.parse({
        fullName,
        sourceId: "github-search",
        sourceTier: "S",
        independenceGroup: "github-public-data",
        direction,
        evidenceUrl:
          typeof item.html_url === "string"
            ? item.html_url
            : `https://github.com/${fullName}`,
        observedAt,
        rank: index + 1,
        sourceScore: typeof item.score === "number" ? item.score : null,
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

export class GitHubSearchAdapter implements DiscoveryAdapter {
  readonly sourceId = "github-search";

  async discover(context: DiscoveryContext): Promise<CandidateSignal[]> {
    const output: CandidateSignal[] = [];
    for (const direction of context.config.directions) {
      const query = new URLSearchParams({
        q: direction.query,
        sort: "updated",
        order: "desc",
        per_page: "10",
      });
      const url = `https://api.github.com/search/repositories?${query.toString()}`;
      const artifact = await requestArtifact({
        sourceId: this.sourceId,
        url,
        observedAt: context.observedAt,
        rawStore: context.rawStore,
        fetchImpl: context.fetchImpl,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(context.githubToken === null
            ? {}
            : { Authorization: `Bearer ${context.githubToken}` }),
        },
      });
      output.push(
        ...parseGitHubSearch(
          JSON.parse(artifact.text),
          context.observedAt,
          direction.id,
        ).map((signal) => ({
          ...signal,
          rawObjectRef: artifact.rawRef.objectRef,
        })),
      );
    }
    return output;
  }
}
