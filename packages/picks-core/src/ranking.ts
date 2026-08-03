import { daysBetween } from "./math.js";
import {
  type PicksConfig,
  type Rankings,
  RankingsSchema,
  type ScoredRepository,
} from "./schema.js";

function repositoryName(item: ScoredRepository): string {
  return item.snapshot.fullName.toLowerCase();
}

function rankBy(
  items: ScoredRepository[],
  formula: (item: ScoredRepository) => number,
  limit: number,
): string[] {
  return [...items]
    .sort(
      (left, right) =>
        formula(right) - formula(left) ||
        repositoryName(left).localeCompare(repositoryName(right)),
    )
    .slice(0, limit)
    .map(repositoryName);
}

function referenceTime(items: ScoredRepository[]): string {
  const observations = items.flatMap((item) => [
    ...item.snapshot.evidence.map((evidence) => evidence.observedAt),
    ...item.snapshot.candidateSignals.map((signal) => signal.observedAt),
  ]);
  return observations.sort().at(-1) ?? new Date(0).toISOString();
}

function ordinaryEligible(
  item: ScoredRepository,
  config: PicksConfig,
): boolean {
  return (
    item.score.eligibility === "eligible" &&
    item.score.confidence >= config.ranking.ordinaryMinimumConfidence &&
    !item.snapshot.archived
  );
}

function applyOrganizationLimit(
  fullNames: string[],
  items: ScoredRepository[],
  limit: number,
  totalLimit: number,
): string[] {
  const byName = new Map(items.map((item) => [repositoryName(item), item]));
  const counts = new Map<string, number>();
  const output: string[] = [];
  for (const fullName of fullNames) {
    const item = byName.get(fullName);
    if (item === undefined) continue;
    const owner = item.snapshot.ownerLogin.toLowerCase();
    const count = counts.get(owner) ?? 0;
    if (count >= limit) continue;
    counts.set(owner, count + 1);
    output.push(fullName);
    if (output.length >= totalLimit) break;
  }
  return output;
}

function risingScore(item: ScoredRepository): number {
  const dimensions = item.score.dimensions;
  return (
    0.35 * dimensions.momentum +
    0.2 * dimensions.activity +
    0.15 * dimensions.utility +
    0.1 * dimensions.innovation +
    0.1 * dimensions.organization +
    0.1 * item.score.confidence * 100
  );
}

function newProjectScore(item: ScoredRepository): number {
  const dimensions = item.score.dimensions;
  return (
    0.25 * dimensions.utility +
    0.2 * dimensions.innovation +
    0.2 * dimensions.momentum +
    0.15 * dimensions.engineering +
    0.1 * dimensions.activity +
    0.1 * dimensions.organization
  );
}

function hiddenGemScore(item: ScoredRepository): number {
  const dimensions = item.score.dimensions;
  return (
    0.25 * dimensions.utility +
    0.2 * dimensions.engineering +
    0.15 * dimensions.activity +
    0.15 * dimensions.adoption +
    0.1 * dimensions.security +
    0.1 * dimensions.organization +
    0.05 * dimensions.innovation
  );
}

export function buildRankings(
  items: ScoredRepository[],
  config: PicksConfig,
): Rankings {
  const ordinary = items.filter((item) => ordinaryEligible(item, config));
  const overallCandidates = ordinary.filter(
    (item) => item.score.confidence >= config.ranking.overallMinimumConfidence,
  );
  const overallUncapped = rankBy(
    overallCandidates,
    (item) => item.score.publishedScore,
    overallCandidates.length,
  );
  const overall = applyOrganizationLimit(
    overallUncapped,
    overallCandidates,
    config.limits.organizationLimit,
    config.limits.overallLimit,
  );
  const reference = referenceTime(items);
  const newProjects = ordinary.filter(
    (item) =>
      daysBetween(item.snapshot.createdAt, reference) <=
      config.ranking.newProjectMaximumAgeDays,
  );
  const hiddenGems = ordinary.filter(
    (item) =>
      item.snapshot.stars <= config.ranking.hiddenGemMaximumStars &&
      item.score.dimensions.utility >= 60 &&
      item.score.dimensions.engineering >= 60,
  );
  const byDirection = Object.fromEntries(
    config.directions.map((direction) => [
      direction.id,
      rankBy(
        ordinary.filter((item) => item.snapshot.direction === direction.id),
        (item) => item.score.publishedScore,
        config.limits.directionLimit,
      ),
    ]),
  );

  return RankingsSchema.parse({
    overall,
    rising: rankBy(ordinary, risingScore, config.limits.overallLimit),
    newProjects: rankBy(
      newProjects,
      newProjectScore,
      config.limits.overallLimit,
    ),
    hiddenGems: rankBy(hiddenGems, hiddenGemScore, config.limits.overallLimit),
    active: rankBy(
      ordinary,
      (item) => item.score.dimensions.activity,
      config.limits.overallLimit,
    ),
    byDirection,
  });
}
