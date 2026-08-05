import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  buildPublicApiDocuments,
  normalizePublicBaseUrl,
  type PublicApiDocument,
  PublicDailyReportSchema,
  toPublicDailyReport,
  writePublicApi,
} from "../src/lib/public-api";

let fixture: DailyReport;
const temporaryRoots: string[] = [];

beforeAll(async () => {
  const reportPath = resolve(
    process.cwd(),
    "../../artifacts/daily/2026-08-05/report.json",
  );
  fixture = DailyReportSchema.parse(
    JSON.parse(await readFile(reportPath, "utf8")) as unknown,
  );
});

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

async function makeOutputRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "github-picks-public-api-"));
  temporaryRoots.push(root);
  return root;
}

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

describe("public API writer", () => {
  it("atomically replaces the API directory and preserves sibling output", async () => {
    const outputRoot = await makeOutputRoot();
    const apiRoot = join(outputRoot, "api", "v1");
    await mkdir(apiRoot, { recursive: true });
    await writeFile(join(apiRoot, "stale.json"), "{}\n", "utf8");
    await writeFile(join(outputRoot, "keep.txt"), "keep\n", "utf8");
    const documents = buildPublicApiDocuments(reportsForApi(), {
      publicBaseUrl: "https://example.test/github-picks",
    });

    await writePublicApi(outputRoot, documents);

    expect(
      JSON.parse(await readFile(join(outputRoot, "api/v1/meta.json"), "utf8")),
    ).toMatchObject({ schemaVersion: 1 });
    await expect(
      readFile(join(apiRoot, "stale.json"), "utf8"),
    ).rejects.toThrow();
    await expect(readFile(join(outputRoot, "keep.txt"), "utf8")).resolves.toBe(
      "keep\n",
    );
  });

  it("rejects paths outside api/v1 without touching existing files", async () => {
    const outputRoot = await makeOutputRoot();
    await writeFile(join(outputRoot, "keep.txt"), "keep\n", "utf8");

    await expect(
      writePublicApi(outputRoot, [{ path: "../escape.json", body: "{}\n" }]),
    ).rejects.toThrow("inside api/v1");
    await expect(readFile(join(outputRoot, "keep.txt"), "utf8")).resolves.toBe(
      "keep\n",
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

interface TestEnvelope<T> {
  schemaVersion: number;
  generatedAt: string;
  data: T;
  links: Record<string, string | null>;
}

function jsonDocument<T>(
  documents: PublicApiDocument[],
  path: string,
): TestEnvelope<T> {
  const document = documents.find((item) => item.path === path);
  if (document === undefined) {
    throw new Error(`missing public API document: ${path}`);
  }
  return JSON.parse(document.body) as TestEnvelope<T>;
}

function reportsForApi(): DailyReport[] {
  const older = structuredClone(fixture);
  older.date = "2026-08-04";
  older.generatedAt = "2026-08-04T12:00:00.000Z";

  const duplicate = structuredClone(older);
  duplicate.generatedAt = "2026-08-04T10:00:00.000Z";
  duplicate.counts.published = 1;

  const replay = structuredClone(fixture);
  replay.date = "2026-08-06";
  replay.generatedAt = "2026-08-06T12:00:00.000Z";
  replay.mode = "replay";

  return [replay, duplicate, fixture, older];
}

describe("public API documents", () => {
  it("builds the complete deterministic v1 document set from live reports", () => {
    const reports = reportsForApi();
    const options = {
      publicBaseUrl: "https://example.test/github-picks",
    };

    const documents = buildPublicApiDocuments(reports, options);
    const paths = documents.map((document) => document.path);

    expect(paths).toEqual([...paths].sort());
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("api/v1/meta.json");
    expect(paths).toContain("api/v1/reports/index.json");
    expect(paths).toContain("api/v1/reports/latest.json");
    expect(paths).toContain("api/v1/reports/2026-08-05.json");
    expect(paths).toContain("api/v1/rankings/30d.json");
    expect(paths).toContain("api/v1/directions/security-supply-chain.json");
    expect(paths).toContain("api/v1/repositories/midspiral/lemmascript.json");
    expect(paths.some((path) => path.includes("2026-08-06"))).toBe(false);
    expect(buildPublicApiDocuments(reports, options)).toEqual(documents);
  });

  it("publishes metadata, reports, rankings, directions, and repository history", () => {
    const documents = buildPublicApiDocuments(reportsForApi(), {
      publicBaseUrl: "https://example.test/github-picks",
    });
    const meta = jsonDocument<{
      latestReportDate: string;
      availableReportDates: string[];
    }>(documents, "api/v1/meta.json");
    const latest = jsonDocument<{ report: DailyReport }>(
      documents,
      "api/v1/reports/latest.json",
    );
    const ranking = jsonDocument<{
      ranking: {
        reportCount: number;
        items: Array<{ id: string; rank: number; href: string }>;
      };
    }>(documents, "api/v1/rankings/30d.json");
    const direction = jsonDocument<{
      reportDate: string;
      items: Array<{
        rank: number;
        repository: { snapshot: { fullName: string } };
      }>;
    }>(documents, "api/v1/directions/security-supply-chain.json");
    const repository = jsonDocument<{
      latestReportDate: string;
      observations: Array<{
        date: string;
        ranks: Record<string, number | null>;
      }>;
    }>(documents, "api/v1/repositories/midspiral/lemmascript.json");

    expect(meta.schemaVersion).toBe(1);
    expect(meta.data).toEqual({
      latestReportDate: "2026-08-05",
      availableReportDates: ["2026-08-05", "2026-08-04"],
      product: "GitHub Picks",
      timezone: "Asia/Shanghai",
      periods: expect.any(Array),
      directions: expect.any(Array),
      endpoints: expect.any(Object),
    });
    expect(meta.links.self).toBe(
      "https://example.test/github-picks/api/v1/meta.json",
    );
    expect(latest.data.report.mode).toBe("live");
    expect(latest.data.report.date).toBe("2026-08-05");
    expect(JSON.stringify(latest)).not.toContain("rawObjectRef");

    expect(ranking.data.ranking.reportCount).toBe(2);
    expect(ranking.data.ranking.items[0]?.rank).toBe(1);
    expect(ranking.data.ranking.items[0]?.href).toMatch(
      /^https:\/\/example\.test\/github-picks\/repositories\//,
    );

    expect(direction.data.reportDate).toBe("2026-08-05");
    expect(
      direction.data.items.map((item) => item.repository.snapshot.fullName),
    ).toEqual(fixture.rankings.byDirection["security-supply-chain"]);
    expect(direction.data.items.map((item) => item.rank)).toEqual([1, 2, 3]);

    expect(repository.data.latestReportDate).toBe("2026-08-05");
    expect(repository.data.observations.map((item) => item.date)).toEqual([
      "2026-08-04",
      "2026-08-05",
    ]);
    expect(Object.keys(repository.data.observations[0]?.ranks ?? {})).toEqual([
      "overall",
      "rising",
      "newProjects",
      "hiddenGems",
      "active",
      "direction",
    ]);
    expect(JSON.stringify(documents)).not.toContain("/Users/");
    expect(JSON.stringify(documents)).not.toContain("rawObjectRef");
  });

  it("uses only the newest live run for each report date", () => {
    const index = jsonDocument<{
      items: Array<{ date: string; publishedCount: number }>;
    }>(
      buildPublicApiDocuments(reportsForApi(), {
        publicBaseUrl: "https://example.test/github-picks",
      }),
      "api/v1/reports/index.json",
    );

    expect(index.data.items).toHaveLength(2);
    expect(index.data.items[1]).toMatchObject({
      date: "2026-08-04",
      publishedCount: fixture.counts.published,
    });
  });
});
