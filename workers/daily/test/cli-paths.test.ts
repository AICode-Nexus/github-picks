import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { resolveCliPaths } from "../src/cli-paths.js";

describe("resolveCliPaths", () => {
  it("anchors default daily paths at the repository root", () => {
    expect(
      resolveCliPaths(
        { date: "2026-08-03", mode: "replay" },
        "/workspace/workers/daily",
        "file:///workspace/workers/daily/src/cli-paths.ts",
      ),
    ).toEqual({
      configPath: "/workspace/config/picks.yaml",
      outputDirectory: "/workspace/artifacts/daily/2026-08-03",
      rawDirectory: "/workspace/artifacts/raw",
      replayManifestPath:
        "/workspace/workers/daily/test/fixtures/replay-manifest.json",
    });
  });

  it("keeps explicit daily paths relative to the invocation directory", () => {
    expect(
      resolveCliPaths(
        {
          date: "2026-08-03",
          mode: "live",
          configPath: "picks.yaml",
          outputDirectory: "out",
          rawDirectory: "raw",
          replayManifestPath: "replay.json",
        },
        "/tmp/daily-run",
        "file:///workspace/workers/daily/src/cli-paths.ts",
      ),
    ).toEqual({
      configPath: "/tmp/daily-run/picks.yaml",
      outputDirectory: "/tmp/daily-run/out",
      rawDirectory: "/tmp/daily-run/raw",
      replayManifestPath: "/tmp/daily-run/replay.json",
    });
  });

  it("runs the root command without changing the invocation directory", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../../../package.json", import.meta.url), "utf8"),
    );

    expect(packageJson.scripts["picks:daily"]).toBe(
      "tsx workers/daily/src/cli.ts",
    );
    expect(packageJson.scripts["picks:publish-check"]).toBe(
      "tsx workers/daily/src/publish-check.ts",
    );
  });
});
