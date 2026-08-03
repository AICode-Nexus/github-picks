import {
  DIMENSIONS,
  type Dimension,
  type M0Decision,
  type M0Observation,
  type M0Scope,
} from "./schema.js";

export interface ProductCoverage {
  product: string;
  averages: Record<Dimension, number>;
  coveredDimensions: Dimension[];
}

export interface EvaluationResult {
  decision: M0Decision;
  issues: string[];
  observedDates: string[];
  observedDirections: string[];
  observedRepositories: string[];
  productCoverage: ProductCoverage[];
  marketGaps: Dimension[];
}

export function evaluateM0(
  scope: M0Scope,
  observations: M0Observation[],
): EvaluationResult {
  const observedDates = [
    ...new Set(observations.map((row) => row.date)),
  ].sort();
  const observedDirections = [
    ...new Set(observations.flatMap((row) => row.directions)),
  ].sort();
  const observedRepositories = [
    ...new Set(observations.flatMap((row) => row.repositories)),
  ].sort();
  const issues: string[] = [];

  const expectedProducts = new Set(scope.products.map((product) => product.id));
  const expectedDirections = new Set(
    scope.directions.map((direction) => direction.id),
  );
  const expectedRepositories = new Set(
    scope.repositories.map((repository) => repository.slug),
  );
  const sameSet = (actual: string[], expected: Set<string>) =>
    actual.length === expected.size &&
    new Set(actual).size === expected.size &&
    actual.every((item) => expected.has(item));
  const dayNumbers = observedDates.map(
    (date) => Date.parse(`${date}T00:00:00Z`) / 86_400_000,
  );
  let longestConsecutiveRun = dayNumbers.length > 0 ? 1 : 0;
  let currentRun = longestConsecutiveRun;
  for (let index = 1; index < dayNumbers.length; index += 1) {
    const previousDay = dayNumbers[index - 1];
    const currentDay = dayNumbers[index];
    if (previousDay === undefined || currentDay === undefined) continue;
    currentRun = currentDay === previousDay + 1 ? currentRun + 1 : 1;
    longestConsecutiveRun = Math.max(longestConsecutiveRun, currentRun);
  }
  if (longestConsecutiveRun < scope.minimumDays) {
    issues.push(
      `consecutive-dates:${longestConsecutiveRun}/${scope.minimumDays}`,
    );
  }

  for (const product of new Set(observations.map((row) => row.product))) {
    if (!expectedProducts.has(product))
      issues.push(`unknown-product:${product}`);
  }
  if (
    observations.some((row) => !sameSet(row.directions, expectedDirections))
  ) {
    issues.push("direction-set-mismatch");
  }
  if (
    observations.some((row) => !sameSet(row.repositories, expectedRepositories))
  ) {
    issues.push("repository-set-mismatch");
  }

  const productDateCells = new Set(
    observations.map((row) => `${row.date}:${row.product}`),
  );
  if (productDateCells.size !== observations.length) {
    issues.push("duplicate-product-date-observation");
  }
  const requiredCells = observedDates.flatMap((date) =>
    scope.products.map((product) => `${date}:${product.id}`),
  );
  const presentRequiredCells = requiredCells.filter((cell) =>
    productDateCells.has(cell),
  ).length;
  if (
    observedDates.length >= scope.minimumDays &&
    presentRequiredCells !== requiredCells.length
  ) {
    issues.push(
      `product-date-cells:${presentRequiredCells}/${requiredCells.length}`,
    );
  }

  if (observedDates.length < scope.minimumDays) {
    issues.push(`dates:${observedDates.length}/${scope.minimumDays}`);
  }
  if (observedDirections.length < scope.minimumDirections) {
    issues.push(
      `directions:${observedDirections.length}/${scope.minimumDirections}`,
    );
  }
  if (observedRepositories.length < scope.minimumRepositories) {
    issues.push(
      `repositories:${observedRepositories.length}/${scope.minimumRepositories}`,
    );
  }

  const productCoverage = scope.products.map(({ id }) => {
    const rows = observations.filter((row) => row.product === id);
    const averages = Object.fromEntries(
      DIMENSIONS.map((dimension) => {
        const values = rows.map((row) => row.capabilities[dimension].score);
        return [
          dimension,
          values.length === 0
            ? 0
            : values.reduce<number>((sum, value) => sum + value, 0) /
              values.length,
        ];
      }),
    ) as Record<Dimension, number>;
    const coveredDimensions = DIMENSIONS.filter(
      (dimension) => averages[dimension] >= scope.capabilityThreshold,
    );
    return { product: id, averages, coveredDimensions };
  });

  const marketGaps = DIMENSIONS.filter(
    (dimension) =>
      Math.max(
        ...productCoverage.map((product) => product.averages[dimension]),
      ) < scope.capabilityThreshold,
  );

  let decision: M0Decision = "INSUFFICIENT_EVIDENCE";
  if (issues.length === 0) {
    const strongestCoverage = Math.max(
      ...productCoverage.map((product) => product.coveredDimensions.length),
    );
    if (strongestCoverage === DIMENSIONS.length) decision = "USE_EXISTING";
    else if (strongestCoverage >= scope.thinIntegrationMinimum) {
      decision = "THIN_INTEGRATION";
    } else if (
      marketGaps.length >= scope.buildGapMinimum &&
      marketGaps.includes("multi_source_evidence") &&
      marketGaps.includes("obsidian_ownership")
    ) {
      decision = "BUILD";
    } else decision = "THIN_INTEGRATION";
  }

  return {
    decision,
    issues,
    observedDates,
    observedDirections,
    observedRepositories,
    productCoverage,
    marketGaps,
  };
}
