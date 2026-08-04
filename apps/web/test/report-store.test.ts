import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { DailyReport } from "@github-picks/core/schema";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  getLatestLiveReport,
  getLiveReportByDate,
  getLiveReportHistory,
  loadDailyReports,
  resolveDailyArtifactsDirectory,
} from "../src/lib/report-store";

const fixturePath = resolve(
  process.cwd(),
  "../../artifacts/daily/2026-08-04/report.json",
);
const temporaryRoots: string[] = [];
let fixture: DailyReport;

beforeAll(async () => {
  fixture = JSON.parse(await readFile(fixturePath, "utf8")) as DailyReport;
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

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "github-picks-report-store-"));
  temporaryRoots.push(root);
  return root;
}

async function writeReport(
  root: string,
  directory: string,
  overrides: Partial<DailyReport> = {},
): Promise<DailyReport> {
  const report = {
    ...structuredClone(fixture),
    ...overrides,
  };
  const reportDirectory = join(root, directory);
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    join(reportDirectory, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  return report;
}

describe("report store", () => {
  it("resolves the repository artifact directory from the module URL", () => {
    const moduleUrl = pathToFileURL(
      resolve(process.cwd(), "src/lib/report-store.ts"),
    ).href;

    expect(resolveDailyArtifactsDirectory(moduleUrl)).toBe(
      resolve(process.cwd(), "../../artifacts/daily"),
    );
  });

  it("loads and validates replay and live reports in chronological order", async () => {
    const root = await makeRoot();
    await writeReport(root, "2026-08-04", {
      date: "2026-08-04",
      mode: "live",
      generatedAt: "2026-08-03T16:11:08.802Z",
    });
    await writeReport(root, "2026-08-03-live", {
      date: "2026-08-03",
      mode: "live",
      generatedAt: "2026-08-03T15:00:00.000Z",
    });
    await writeReport(root, "2026-08-03", {
      date: "2026-08-03",
      mode: "replay",
      generatedAt: "2026-08-03T14:00:00.000Z",
    });

    const reports = await loadDailyReports({ rootDirectory: root });

    expect(
      reports.map(({ date, mode, generatedAt }) => ({
        date,
        mode,
        generatedAt,
      })),
    ).toEqual([
      {
        date: "2026-08-03",
        mode: "replay",
        generatedAt: "2026-08-03T14:00:00.000Z",
      },
      {
        date: "2026-08-03",
        mode: "live",
        generatedAt: "2026-08-03T15:00:00.000Z",
      },
      {
        date: "2026-08-04",
        mode: "live",
        generatedAt: "2026-08-03T16:11:08.802Z",
      },
    ]);
  });

  it("selects the newest live report and never publishes replay data", async () => {
    const root = await makeRoot();
    await writeReport(root, "2026-08-04-replay", {
      date: "2026-08-04",
      mode: "replay",
      generatedAt: "2026-08-03T18:00:00.000Z",
    });
    await writeReport(root, "2026-08-04-early", {
      date: "2026-08-04",
      mode: "live",
      generatedAt: "2026-08-03T16:00:00.000Z",
    });
    await writeReport(root, "2026-08-04-late", {
      date: "2026-08-04",
      mode: "live",
      generatedAt: "2026-08-03T17:00:00.000Z",
    });

    const latest = await getLatestLiveReport({ rootDirectory: root });

    expect(latest.mode).toBe("live");
    expect(latest.generatedAt).toBe("2026-08-03T17:00:00.000Z");
  });

  it("builds a queryable live history and keeps only the latest run per date", async () => {
    const root = await makeRoot();
    await writeReport(root, "2026-08-03-replay", {
      date: "2026-08-03",
      mode: "replay",
      generatedAt: "2026-08-03T18:00:00.000Z",
    });
    await writeReport(root, "2026-08-03-early", {
      date: "2026-08-03",
      mode: "live",
      generatedAt: "2026-08-03T15:00:00.000Z",
    });
    await writeReport(root, "2026-08-03-late", {
      date: "2026-08-03",
      mode: "live",
      generatedAt: "2026-08-03T17:00:00.000Z",
    });
    await writeReport(root, "2026-08-04", {
      date: "2026-08-04",
      mode: "live",
      generatedAt: "2026-08-03T19:00:00.000Z",
    });

    const history = await getLiveReportHistory({ rootDirectory: root });

    expect(
      history.map(({ date, generatedAt }) => ({ date, generatedAt })),
    ).toEqual([
      {
        date: "2026-08-03",
        generatedAt: "2026-08-03T17:00:00.000Z",
      },
      {
        date: "2026-08-04",
        generatedAt: "2026-08-03T19:00:00.000Z",
      },
    ]);
    await expect(
      getLiveReportByDate("2026-08-03", { rootDirectory: root }),
    ).resolves.toMatchObject({
      date: "2026-08-03",
      generatedAt: "2026-08-03T17:00:00.000Z",
    });
    await expect(
      getLiveReportByDate("2026-08-02", { rootDirectory: root }),
    ).resolves.toBeNull();
  });

  it("fails clearly when no live report exists", async () => {
    const root = await makeRoot();
    await writeReport(root, "2026-08-03", {
      date: "2026-08-03",
      mode: "replay",
    });

    await expect(getLatestLiveReport({ rootDirectory: root })).rejects.toThrow(
      "no live DailyReport",
    );
  });

  it("fails clearly when a report does not match the shared schema", async () => {
    const root = await makeRoot();
    const reportDirectory = join(root, "broken");
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(join(reportDirectory, "report.json"), "{}\n", "utf8");

    await expect(loadDailyReports({ rootDirectory: root })).rejects.toThrow(
      "invalid DailyReport",
    );
  });
});
