import { readFile } from "node:fs/promises";
import { DailyReportSchema } from "@github-picks/core";
import { describe, expect, it } from "vitest";
import {
  buildDailyManifest,
  DailyManifestSchema,
} from "../src/publication-artifacts.js";

describe("daily publication manifest", () => {
  it("rebuilds the committed live manifest and deduplicates raw refs", async () => {
    const directory = new URL(
      "../../../artifacts/daily/2026-08-04/",
      import.meta.url,
    );
    const report = DailyReportSchema.parse(
      JSON.parse(await readFile(new URL("report.json", directory), "utf8")),
    );
    const committed = DailyManifestSchema.parse(
      JSON.parse(await readFile(new URL("manifest.json", directory), "utf8")),
    );

    expect(buildDailyManifest(report)).toEqual(committed);
    expect(new Set(committed.rawObjectRefs).size).toBe(
      committed.rawObjectRefs.length,
    );
  });
});
