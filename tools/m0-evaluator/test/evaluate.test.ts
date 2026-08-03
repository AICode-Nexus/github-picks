import { describe, expect, it } from "vitest";
import { evaluateM0 } from "../src/evaluate.js";
import { DIMENSIONS, type M0Observation, type M0Scope } from "../src/schema.js";

const scope: M0Scope = {
  timezone: "Asia/Shanghai",
  minimumDays: 7,
  minimumDirections: 5,
  minimumRepositories: 30,
  products: Array.from({ length: 8 }, (_, index) => ({
    id: `product-${index}`,
    name: `Product ${index}`,
    url: `https://example.com/product-${index}`,
  })),
  directions: Array.from({ length: 5 }, (_, index) => ({
    id: `direction-${index}`,
    name: `Direction ${index}`,
  })),
  repositories: Array.from({ length: 30 }, (_, index) => ({
    slug: `owner-${index}/repo-${index}`,
    direction: `direction-${index % 5}`,
  })),
  requiredDimensions: [...DIMENSIONS],
  capabilityThreshold: 1.5,
  thinIntegrationMinimum: 5,
  buildGapMinimum: 5,
};

function observations(
  scoreFor: (product: number, dimension: number) => 0 | 1 | 2,
): M0Observation[] {
  return Array.from({ length: 7 }, (_, day) =>
    scope.products.map((product, productIndex) => ({
      date: `2026-08-${String(day + 3).padStart(2, "0")}`,
      product: product.id,
      directions: scope.directions.map((direction) => direction.id),
      repositories: scope.repositories.map((repository) => repository.slug),
      capabilities: Object.fromEntries(
        DIMENSIONS.map((dimension, dimensionIndex) => [
          dimension,
          {
            score: scoreFor(productIndex, dimensionIndex),
            evidenceUrl: product.url,
            note: "根据当天公开页面和接口记录形成的可审计判断。",
          },
        ]),
      ) as M0Observation["capabilities"],
    })),
  ).flat();
}

describe("evaluateM0", () => {
  it("returns USE_EXISTING when one product covers all seven dimensions", () => {
    expect(
      evaluateM0(
        scope,
        observations((product) => (product === 0 ? 2 : 0)),
      ).decision,
    ).toBe("USE_EXISTING");
  });

  it("returns THIN_INTEGRATION when one product covers five dimensions", () => {
    expect(
      evaluateM0(
        scope,
        observations((product, dimension) =>
          product === 0 && dimension < 5 ? 2 : 0,
        ),
      ).decision,
    ).toBe("THIN_INTEGRATION");
  });

  it("returns BUILD only when five market gaps include evidence and Obsidian", () => {
    expect(
      evaluateM0(
        scope,
        observations(() => 0),
      ).decision,
    ).toBe("BUILD");
  });

  it("returns INSUFFICIENT_EVIDENCE before seven dates are present", () => {
    expect(
      evaluateM0(
        scope,
        observations(() => 0).filter((row) => row.date !== "2026-08-09"),
      ).decision,
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("rejects seven non-consecutive dates", () => {
    const rows = observations(() => 0).map((row) =>
      row.date === "2026-08-09" ? { ...row, date: "2026-08-10" } : row,
    );
    expect(evaluateM0(scope, rows).issues).toContain("consecutive-dates:6/7");
  });

  it("rejects substituted directions repositories and products", () => {
    const rows = observations(() => 0);
    const firstRow = rows[0];
    if (!firstRow) throw new Error("Expected at least one observation row");
    rows[0] = {
      ...firstRow,
      product: "unknown-product",
      directions: ["wrong-1", "wrong-2", "wrong-3", "wrong-4", "wrong-5"],
      repositories: Array.from(
        { length: 30 },
        (_, index) => `wrong/repo-${index}`,
      ),
    };
    expect(evaluateM0(scope, rows).decision).toBe("INSUFFICIENT_EVIDENCE");
    expect(evaluateM0(scope, rows).issues).toEqual(
      expect.arrayContaining([
        "unknown-product:unknown-product",
        "direction-set-mismatch",
        "repository-set-mismatch",
      ]),
    );
  });
});
