import {
  type CandidateSignal,
  CandidateSignalSchema,
} from "@github-picks/core";
import type { DiscoveryAdapter, DiscoveryContext } from "../discovery.js";
import { requestArtifact } from "../http.js";
import { normalizeRepositoryId } from "../repository-id.js";

const sourceUrl = "https://gittrend.io/api/trending?limit=50";

interface GitTrendResponse {
  data?: Array<{
    fullName?: unknown;
    starsToday?: unknown;
    trendingScore?: unknown;
  }>;
}

export function parseGitTrend(
  input: unknown,
  observedAt: string,
): CandidateSignal[] {
  const response = input as GitTrendResponse;
  if (!Array.isArray(response.data)) return [];
  return response.data.flatMap((item, index) => {
    const fullName = normalizeRepositoryId(
      typeof item.fullName === "string" ? item.fullName : "",
    );
    if (fullName === null) return [];
    return [
      CandidateSignalSchema.parse({
        fullName,
        sourceId: "gittrend",
        sourceTier: "B",
        independenceGroup: "github-public-data",
        direction: null,
        evidenceUrl: sourceUrl,
        observedAt,
        rank: index + 1,
        sourceScore:
          typeof item.trendingScore === "number" ? item.trendingScore : null,
        stale: false,
        summaryZh: null,
        metrics: {
          starVelocity:
            typeof item.starsToday === "number" ? item.starsToday : null,
          trendingScore:
            typeof item.trendingScore === "number" ? item.trendingScore : null,
          discussionPoints: null,
          discussionComments: null,
        },
        rawObjectRef: null,
      }),
    ];
  });
}

export class GitTrendAdapter implements DiscoveryAdapter {
  readonly sourceId = "gittrend";

  async discover(context: DiscoveryContext): Promise<CandidateSignal[]> {
    const artifact = await requestArtifact({
      sourceId: this.sourceId,
      url: sourceUrl,
      observedAt: context.observedAt,
      rawStore: context.rawStore,
      fetchImpl: context.fetchImpl,
    });
    return parseGitTrend(JSON.parse(artifact.text), context.observedAt).map(
      (signal) => ({
        ...signal,
        rawObjectRef: artifact.rawRef.objectRef,
      }),
    );
  }
}
