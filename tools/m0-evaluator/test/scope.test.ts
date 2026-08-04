import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { DIMENSIONS, M0ScopeSchema } from "../src/schema.js";

describe("M0 fixed scope", () => {
  it("contains eight products, five directions, thirty unique repositories, and all dimensions", async () => {
    const scope = M0ScopeSchema.parse(
      YAML.parse(await readFile("../../docs/research/m0/scope.yaml", "utf8")),
    );
    expect(scope.products).toHaveLength(8);
    expect(scope.directions).toHaveLength(5);
    expect(
      new Set(scope.repositories.map((repository) => repository.slug)).size,
    ).toBe(30);
    expect(scope.requiredDimensions).toEqual(DIMENSIONS);
  });
});
