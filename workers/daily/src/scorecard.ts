import {
  type Evidence,
  type RepositorySnapshot,
  RepositorySnapshotSchema,
} from "@github-picks/core";
import { z } from "zod";
import type { EnrichmentContext } from "./enrichment.js";
import { requestArtifact } from "./http.js";

const ScorecardResponseSchema = z.object({
  date: z.string().min(8),
  score: z.number().min(0).max(10),
  checks: z.array(
    z.object({ name: z.string(), score: z.number().min(-1).max(10) }),
  ),
});

export class ScorecardEnricher {
  async enrich(
    snapshot: RepositorySnapshot,
    context: EnrichmentContext,
  ): Promise<RepositorySnapshot> {
    const url = `https://api.securityscorecards.dev/projects/github.com/${snapshot.fullName}`;
    try {
      const artifact = await requestArtifact({
        sourceId: "openssf-scorecard",
        url,
        observedAt: context.observedAt,
        rawStore: context.rawStore,
        fetchImpl: context.fetchImpl,
      });
      const scorecard = ScorecardResponseSchema.parse(
        JSON.parse(artifact.text),
      );
      const scorecardEvidence: Evidence = {
        id: `openssf-scorecard:score:${artifact.rawRef.sha256.slice(0, 12)}`,
        sourceId: "openssf-scorecard",
        sourceTier: "A",
        independenceGroup: "openssf-security",
        evidenceUrl: url,
        observedAt: context.observedAt,
        field: "scorecard",
        value: { score: scorecard.score, date: scorecard.date },
        rawObjectRef: artifact.rawRef.objectRef,
      };
      return RepositorySnapshotSchema.parse({
        ...snapshot,
        scorecard,
        evidence: [...snapshot.evidence, scorecardEvidence],
        missingFields: snapshot.missingFields.filter(
          (field) => field !== "scorecard",
        ),
      });
    } catch {
      return snapshot;
    }
  }
}
