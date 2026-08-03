import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli-args.js";

describe("daily CLI arguments", () => {
  it("defaults to the Beijing calendar date and live mode", () => {
    expect(parseCliArgs([], new Date("2026-08-03T16:30:00.000Z"))).toEqual({
      date: "2026-08-04",
      mode: "live",
    });
  });

  it("parses explicit replay and path options", () => {
    expect(
      parseCliArgs(
        [
          "--date",
          "2026-08-03",
          "--mode",
          "replay",
          "--config",
          "config.yaml",
          "--output",
          "out",
          "--raw",
          "raw",
          "--replay-manifest",
          "fixture.json",
        ],
        new Date("2026-08-03T00:00:00.000Z"),
      ),
    ).toEqual({
      date: "2026-08-03",
      mode: "replay",
      configPath: "config.yaml",
      outputDirectory: "out",
      rawDirectory: "raw",
      replayManifestPath: "fixture.json",
    });
  });

  it("ignores the pnpm argument separator", () => {
    expect(
      parseCliArgs(
        ["--", "--date", "2026-08-03", "--mode", "replay"],
        new Date("2026-08-03T00:00:00.000Z"),
      ),
    ).toEqual({ date: "2026-08-03", mode: "replay" });
  });

  it("rejects unknown flags and invalid dates", () => {
    expect(() => parseCliArgs(["--unknown"], new Date())).toThrow(
      "unknown argument",
    );
    expect(() => parseCliArgs(["--date", "2026-02-30"], new Date())).toThrow(
      "invalid date",
    );
  });
});
