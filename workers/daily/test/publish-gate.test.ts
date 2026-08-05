import { copyFile, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DailyReport,
  DailyReportSchema,
  type ScoredRepository,
} from "@github-picks/core";
import { describe, expect, it } from "vitest";
import {
  assertPublishableReport,
  validatePublicationDirectory,
} from "../src/publish-gate.js";

const liveDirectoryUrl = new URL(
  "../../../artifacts/daily/2026-08-04/",
  import.meta.url,
);
const liveDirectory = fileURLToPath(liveDirectoryUrl);
const networkSourceIds = new Set([
  "github-trending",
  "github-search",
  "gittrend",
  "hublens",
  "hacker-news",
  "ai-hot",
]);

async function loadReport(): Promise<DailyReport> {
  return DailyReportSchema.parse(
    JSON.parse(
      await readFile(new URL("report.json", liveDirectoryUrl), "utf8"),
    ),
  );
}

function firstPublicRepository(report: DailyReport): ScoredRepository {
  const fullName = report.rankings.overall[0];
  const repository = report.repositories.find(
    (item) => item.snapshot.fullName.toLowerCase() === fullName,
  );
  if (repository === undefined)
    throw new Error("fixture has no public project");
  return repository;
}

async function copyPublicationDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "github-picks-publish-gate-"));
  await Promise.all(
    ["report.json", "report.md", "manifest.json"].map((name) =>
      copyFile(join(liveDirectory, name), join(directory, name)),
    ),
  );
  return directory;
}

describe("publishable daily report", () => {
  it("accepts the committed verified live report", async () => {
    expect(
      assertPublishableReport(await loadReport(), "2026-08-04"),
    ).toMatchObject({
      date: "2026-08-04",
      published: 20,
      aiVerified: 20,
    });
  });

  it("rejects a report assigned to another date", async () => {
    const report = await loadReport();
    expect(() => assertPublishableReport(report, "2026-08-05")).toThrow(
      "report date does not match expected date",
    );
  });

  it("rejects replay output", async () => {
    const report = await loadReport();
    report.mode = "replay";
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "only live reports can be published",
    );
  });

  it("requires at least two healthy network discovery sources", async () => {
    const report = await loadReport();
    for (const source of report.sourceHealth) {
      if (networkSourceIds.has(source.sourceId)) {
        source.status = "degraded";
        source.message = "测试降级";
      }
    }
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "fewer than two healthy network discovery sources",
    );
  });

  it("requires an available GitHub REST fact layer", async () => {
    const report = await loadReport();
    report.sourceHealth = report.sourceHealth.filter(
      (source) => source.sourceId !== "github-rest",
    );
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "GitHub REST facts are offline or missing",
    );
  });

  it("requires every direction ranking", async () => {
    const report = await loadReport();
    report.rankings.byDirection["ai-agent"] = [];
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "direction ranking is empty: ai-agent",
    );
  });

  it("rejects archived repositories in public rankings", async () => {
    const report = await loadReport();
    firstPublicRepository(report).snapshot.archived = true;
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "archived repository appears in a public ranking",
    );
  });

  it("requires GitHub REST evidence for every public repository", async () => {
    const report = await loadReport();
    const repository = firstPublicRepository(report);
    repository.snapshot.evidence = repository.snapshot.evidence.filter(
      (evidence) => evidence.sourceId !== "github-rest",
    );
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "public repository has no GitHub REST evidence",
    );
  });

  it("requires a reason for every degraded source", async () => {
    const report = await loadReport();
    const degraded = report.sourceHealth.find(
      (source) => source.status === "degraded",
    );
    if (degraded === undefined)
      throw new Error("fixture has no degraded source");
    degraded.message = null;
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "degraded source has no explanatory message",
    );
  });

  it("requires healthy AI analysis", async () => {
    const report = await loadReport();
    const aiHealth = report.sourceHealth.find(
      (source) => source.sourceId === "ai-analysis",
    );
    if (aiHealth === undefined) throw new Error("fixture has no AI health");
    aiHealth.status = "degraded";
    aiHealth.message = "测试降级";
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "AI analysis is not healthy",
    );
  });

  it("requires verified AI output for every public repository", async () => {
    const report = await loadReport();
    firstPublicRepository(report).analysis.generation = {
      kind: "rules",
      status: "fallback",
      provider: "rules",
      model: null,
      promptVersion: "v1.0.0",
      analysisVersion: "v1.1.0",
      evidenceHash: "a".repeat(64),
      generatedAt: report.generatedAt,
    };
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "public repository is not backed by verified AI analysis",
    );
  });

  it("requires counts to match repository contents", async () => {
    const report = await loadReport();
    report.counts.enriched -= 1;
    expect(() => assertPublishableReport(report, report.date)).toThrow(
      "report counts do not match repository contents",
    );
  });
});

describe("publication directory", () => {
  it("accepts three mutually consistent committed artifacts", async () => {
    await expect(
      validatePublicationDirectory(liveDirectory, "2026-08-04"),
    ).resolves.toMatchObject({ date: "2026-08-04", aiVerified: 20 });
  });

  it("rejects Markdown that does not match report.json", async () => {
    const directory = await copyPublicationDirectory();
    await writeFile(join(directory, "report.md"), "invalid\n", "utf8");
    await expect(
      validatePublicationDirectory(directory, "2026-08-04"),
    ).rejects.toThrow("report.md does not match report.json");
  });

  it("rejects a manifest that does not match report.json", async () => {
    const directory = await copyPublicationDirectory();
    const manifestPath = join(directory, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      generatedAt: string;
    };
    manifest.generatedAt = "2026-08-04T00:00:00.000Z";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await expect(
      validatePublicationDirectory(directory, "2026-08-04"),
    ).rejects.toThrow("manifest.json does not match report.json");
  });
});
