import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildDailyRankingItems,
  DAILY_RANKING_TAGS,
} from "../src/lib/daily-ranking";

let report: DailyReport;

beforeAll(async () => {
  const value = JSON.parse(
    await readFile(
      resolve(process.cwd(), "../../artifacts/daily/2026-08-04/report.json"),
      "utf8",
    ),
  ) as unknown;
  report = DailyReportSchema.parse(value);
});

describe("canonical daily ranking", () => {
  it("builds one item per overall repository in unchanged order", () => {
    const items = buildDailyRankingItems(report);

    expect(items.map((item) => item.id)).toEqual(report.rankings.overall);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });

  it("attaches specialty membership without changing the overall rank", () => {
    const items = buildDailyRankingItems(report);

    for (const [index, item] of items.entries()) {
      expect(item.rank).toBe(index + 1);
      expect(item.tags.map((tag) => tag.id)).toEqual(
        DAILY_RANKING_TAGS.filter((tag) =>
          report.rankings[tag.rankingKey].includes(item.id),
        ).map((tag) => tag.id),
      );
    }
  });

  it("rejects a specialty item that is absent from the canonical ranking", () => {
    const invalid = structuredClone(report);
    invalid.rankings.rising = ["missing/example"];

    expect(() => buildDailyRankingItems(invalid)).toThrow(
      /specialty ranking references non-overall repository: missing\/example/,
    );
  });
});
