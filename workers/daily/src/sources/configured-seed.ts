import {
  type CandidateSignal,
  CandidateSignalSchema,
} from "@github-picks/core";
import type { DiscoveryAdapter, DiscoveryContext } from "../discovery.js";

export class ConfiguredSeedAdapter implements DiscoveryAdapter {
  readonly sourceId = "configured-seed";

  async discover(context: DiscoveryContext): Promise<CandidateSignal[]> {
    return context.config.seedRepositories.map((repository) => {
      return CandidateSignalSchema.parse({
        fullName: repository.fullName.toLowerCase(),
        sourceId: this.sourceId,
        sourceTier: "C",
        independenceGroup: "github-public-data",
        direction: repository.direction,
        evidenceUrl: `https://github.com/${repository.fullName}`,
        observedAt: context.observedAt,
        rank: null,
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
      });
    });
  }
}
