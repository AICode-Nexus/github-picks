import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { beforeAll, describe, expect, it } from "vitest";
import {
  normalizePublicBaseUrl,
  PublicDailyReportSchema,
  toPublicDailyReport,
} from "../src/lib/public-api";

let fixture: DailyReport;

beforeAll(async () => {
  const reportPath = resolve(
    process.cwd(),
    "../../artifacts/daily/2026-08-05/report.json",
  );
  fixture = DailyReportSchema.parse(
    JSON.parse(await readFile(reportPath, "utf8")) as unknown,
  );
});

describe("public report projection", () => {
  it("projects a live report without raw object references", () => {
    const projected = toPublicDailyReport(fixture);

    expect(PublicDailyReportSchema.parse(projected).date).toBe("2026-08-05");
    expect(JSON.stringify(projected)).not.toContain("rawObjectRef");
    expect(
      projected.repositories[0]?.snapshot.evidence[0]?.evidenceUrl,
    ).toMatch(/^https:/);
  });

  it("rejects replay reports", () => {
    expect(() => toPublicDailyReport({ ...fixture, mode: "replay" })).toThrow(
      "only live DailyReport",
    );
  });
});

describe("public base URL", () => {
  it("normalizes HTTPS and localhost URLs", () => {
    expect(normalizePublicBaseUrl("https://example.com/github-picks/")).toBe(
      "https://example.com/github-picks",
    );
    expect(normalizePublicBaseUrl("http://localhost:3101/preview/")).toBe(
      "http://localhost:3101/preview",
    );
  });

  it.each([
    "file:///tmp/github-picks",
    "https://user:secret@example.com/github-picks",
    "https://example.com/github-picks?preview=1",
    "https://example.com/github-picks#preview",
  ])("rejects unsafe public base URL %s", (value) => {
    expect(() => normalizePublicBaseUrl(value)).toThrow("public base URL");
  });
});
