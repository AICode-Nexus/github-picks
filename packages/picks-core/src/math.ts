export function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function linearScore(value: number, target: number): number {
  if (target <= 0) throw new Error("score target must be positive");
  return clamp((Math.max(0, value) / target) * 100);
}

export function logarithmicScore(value: number, target: number): number {
  if (target <= 0) throw new Error("score target must be positive");
  return clamp((Math.log1p(Math.max(0, value)) / Math.log1p(target)) * 100);
}

export function daysBetween(earlier: string, later: string): number {
  return Math.max(
    0,
    (Date.parse(later) - Date.parse(earlier)) / (24 * 60 * 60 * 1000),
  );
}

export function weightedMean(
  values: Array<{ score: number; weight: number }>,
): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0)
    throw new Error("weighted mean requires positive weight");
  return (
    values.reduce((sum, item) => sum + item.score * item.weight, 0) /
    totalWeight
  );
}
