import {
  type CandidateSignal,
  CandidateSignalSchema,
} from "@github-picks/core";
import type { DiscoveryAdapter, DiscoveryContext } from "../discovery.js";
import { requestArtifact } from "../http.js";
import { normalizeRepositoryId } from "../repository-id.js";

const sourceUrl = "https://hublens.dev/api/v1/trending?limit=50";

interface HubLensResponse {
  data?: Array<{
    repo_url?: unknown;
    summary_zh?: unknown;
    rank_overall?: unknown;
    score?: unknown;
    trending_score?: unknown;
    updated_at?: unknown;
  }>;
}

export function parseHubLens(
  input: unknown,
  observedAt: string,
): CandidateSignal[] {
  const response = input as HubLensResponse;
  if (!Array.isArray(response.data)) return [];
  return response.data.flatMap((item, index) => {
    const fullName = normalizeRepositoryId(
      typeof item.repo_url === "string" ? item.repo_url : "",
    );
    if (fullName === null) return [];
    const updatedAt =
      typeof item.updated_at === "string"
        ? Date.parse(item.updated_at)
        : Number.NaN;
    const age = Date.parse(observedAt) - updatedAt;
    const stale = !Number.isFinite(updatedAt) || age > 48 * 60 * 60 * 1000;
    return [
      CandidateSignalSchema.parse({
        fullName,
        sourceId: "hublens",
        sourceTier: "C",
        independenceGroup: "hublens-aggregator",
        direction: null,
        evidenceUrl: sourceUrl,
        observedAt,
        rank:
          typeof item.rank_overall === "number" ? item.rank_overall : index + 1,
        sourceScore: typeof item.score === "number" ? item.score : null,
        stale,
        summaryZh: typeof item.summary_zh === "string" ? item.summary_zh : null,
        metrics: {
          starVelocity: null,
          trendingScore:
            typeof item.trending_score === "number"
              ? item.trending_score
              : null,
          discussionPoints: null,
          discussionComments: null,
        },
        rawObjectRef: null,
      }),
    ];
  });
}

export class HubLensAdapter implements DiscoveryAdapter {
  readonly sourceId = "hublens";

  async discover(context: DiscoveryContext): Promise<CandidateSignal[]> {
    const artifact = await requestArtifact({
      sourceId: this.sourceId,
      url: sourceUrl,
      observedAt: context.observedAt,
      rawStore: context.rawStore,
      fetchImpl: context.fetchImpl,
    });
    return parseHubLens(JSON.parse(artifact.text), context.observedAt).map(
      (signal) => ({
        ...signal,
        rawObjectRef: artifact.rawRef.objectRef,
      }),
    );
  }
}
