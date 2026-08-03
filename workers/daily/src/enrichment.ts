import type { Candidate, RepositorySnapshot } from "@github-picks/core";
import { GitHubEnricher } from "./github.js";
import type { RawStore } from "./raw-store.js";
import { ScorecardEnricher } from "./scorecard.js";

export interface EnrichmentContext {
  observedAt: string;
  reportDate: string;
  rawStore: RawStore;
  githubToken: string | null;
  fetchImpl?: typeof fetch | undefined;
}

export interface RepositoryEnricher {
  enrich(
    fullName: string,
    context: EnrichmentContext & { candidate: Candidate },
  ): Promise<RepositorySnapshot>;
}

export async function enrichCandidate(
  candidate: Candidate,
  context: EnrichmentContext,
): Promise<RepositorySnapshot> {
  const github = new GitHubEnricher();
  const scorecard = new ScorecardEnricher();
  const repository = await github.enrich(candidate.fullName, {
    ...context,
    candidate,
  });
  return scorecard.enrich(repository, context);
}
