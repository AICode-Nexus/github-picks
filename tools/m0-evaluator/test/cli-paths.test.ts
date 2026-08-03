import { describe, expect, it } from "vitest";
import { resolveCliPaths } from "../src/cli-paths.js";

describe("resolveCliPaths", () => {
  it("anchors default paths at the repository root", () => {
    expect(
      resolveCliPaths(
        [],
        "/workspace/tools/m0-evaluator",
        "file:///workspace/tools/m0-evaluator/src/cli-paths.ts",
      ),
    ).toEqual({
      scopePath: "/workspace/docs/research/m0/scope.yaml",
      observationDir: "/workspace/docs/research/m0/observations",
      outputPath: "/workspace/docs/research/m0/decision.md",
    });
  });

  it("keeps explicit paths relative to the invocation directory", () => {
    expect(
      resolveCliPaths(
        ["scope.yaml", "rows", "report.md"],
        "/tmp/m0-run",
        "file:///workspace/tools/m0-evaluator/src/cli-paths.ts",
      ),
    ).toEqual({
      scopePath: "/tmp/m0-run/scope.yaml",
      observationDir: "/tmp/m0-run/rows",
      outputPath: "/tmp/m0-run/report.md",
    });
  });
});
