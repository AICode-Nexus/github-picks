import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  type DailyReport,
  DailyReportSchema,
  type DirectionId,
  renderDailyMarkdown,
} from "@github-picks/core";
import {
  buildDailyManifest,
  DailyManifestSchema,
} from "./publication-artifacts.js";

const NETWORK_DISCOVERY_SOURCE_IDS = new Set([
  "github-trending",
  "github-search",
  "gittrend",
  "hublens",
  "hacker-news",
  "ai-hot",
]);

const DIRECTIONS: DirectionId[] = [
  "ai-agent",
  "data-ml",
  "app-platform",
  "infra-devtools",
  "security-supply-chain",
];

export interface PublicationSummary {
  date: string;
  generatedAt: string;
  discovered: number;
  enriched: number;
  published: number;
  aiVerified: number;
  degradedSources: string[];
}

function publicRepositoryNames(report: DailyReport): Set<string> {
  return new Set(
    [
      ...report.rankings.overall,
      ...report.rankings.rising,
      ...report.rankings.newProjects,
      ...report.rankings.hiddenGems,
      ...report.rankings.active,
      ...Object.values(report.rankings.byDirection).flat(),
    ].map((fullName) => fullName.toLowerCase()),
  );
}

export function assertPublishableReport(
  report: DailyReport,
  expectedDate: string,
): PublicationSummary {
  if (report.date !== expectedDate) {
    throw new Error("report date does not match expected date");
  }
  if (report.mode !== "live") {
    throw new Error("only live reports can be published");
  }

  const healthyNetworkSources = report.sourceHealth.filter(
    (source) =>
      NETWORK_DISCOVERY_SOURCE_IDS.has(source.sourceId) &&
      source.status === "healthy",
  );
  if (healthyNetworkSources.length < 2) {
    throw new Error("fewer than two healthy network discovery sources");
  }

  const githubRest = report.sourceHealth.find(
    (source) => source.sourceId === "github-rest",
  );
  if (githubRest === undefined || githubRest.status === "offline") {
    throw new Error("GitHub REST facts are offline or missing");
  }

  for (const direction of DIRECTIONS) {
    if (report.rankings.byDirection[direction].length === 0) {
      throw new Error(`direction ranking is empty: ${direction}`);
    }
  }

  const eligibleCount = report.repositories.filter(
    (repository) => repository.score.eligibility === "eligible",
  ).length;
  if (
    report.counts.enriched !== report.repositories.length ||
    report.counts.published !== eligibleCount
  ) {
    throw new Error("report counts do not match repository contents");
  }

  for (const source of report.sourceHealth) {
    if (source.status !== "healthy" && !source.message?.trim()) {
      throw new Error("degraded source has no explanatory message");
    }
  }

  const aiHealth = report.sourceHealth.find(
    (source) => source.sourceId === "ai-analysis",
  );
  if (aiHealth?.status !== "healthy") {
    throw new Error("AI analysis is not healthy");
  }

  const repositoriesByName = new Map(
    report.repositories.map((repository) => [
      repository.snapshot.fullName.toLowerCase(),
      repository,
    ]),
  );
  const publicNames = publicRepositoryNames(report);
  let aiVerified = 0;
  for (const fullName of publicNames) {
    const repository = repositoriesByName.get(fullName);
    if (repository === undefined) {
      throw new Error(
        `public ranking references unknown repository: ${fullName}`,
      );
    }
    if (repository.snapshot.archived) {
      throw new Error("archived repository appears in a public ranking");
    }
    if (
      !repository.snapshot.evidence.some(
        (evidence) => evidence.sourceId === "github-rest",
      )
    ) {
      throw new Error("public repository has no GitHub REST evidence");
    }
    if (
      repository.analysis.generation?.kind !== "ai" ||
      repository.analysis.generation.status !== "verified"
    ) {
      throw new Error(
        "public repository is not backed by verified AI analysis",
      );
    }
    aiVerified += 1;
  }

  return {
    date: report.date,
    generatedAt: report.generatedAt,
    discovered: report.counts.discovered,
    enriched: report.counts.enriched,
    published: report.counts.published,
    aiVerified,
    degradedSources: report.sourceHealth
      .filter((source) => source.status !== "healthy")
      .map((source) => source.sourceId),
  };
}

export async function validatePublicationDirectory(
  directory: string,
  expectedDate: string,
): Promise<PublicationSummary> {
  const [reportJson, reportMarkdown, manifestJson] = await Promise.all([
    readFile(join(directory, "report.json"), "utf8"),
    readFile(join(directory, "report.md"), "utf8"),
    readFile(join(directory, "manifest.json"), "utf8"),
  ]);
  const report = DailyReportSchema.parse(JSON.parse(reportJson));
  const summary = assertPublishableReport(report, expectedDate);

  if (reportMarkdown !== renderDailyMarkdown(report)) {
    throw new Error("report.md does not match report.json");
  }

  const manifest = DailyManifestSchema.parse(JSON.parse(manifestJson));
  if (!isDeepStrictEqual(manifest, buildDailyManifest(report))) {
    throw new Error("manifest.json does not match report.json");
  }

  return summary;
}
