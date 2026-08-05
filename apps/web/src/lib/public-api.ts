import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  CandidateSignalSchema,
  type DailyReport,
  DailyReportSchema,
  type DirectionId,
  EvidenceSchema,
  RepositorySnapshotSchema,
  ScoredRepositorySchema,
} from "@github-picks/core/schema";
import { z } from "zod";
import { buildPeriodRanking } from "./period-ranking";
import {
  DIRECTION_IDS,
  DIRECTION_META,
  RANKING_PERIOD_IDS,
  RANKING_PERIOD_META,
} from "./site-meta";

export const PublicCandidateSignalSchema = CandidateSignalSchema.omit({
  rawObjectRef: true,
});

export type PublicJsonValue =
  | null
  | boolean
  | number
  | string
  | PublicJsonValue[]
  | { [key: string]: PublicJsonValue };

export const PublicJsonValueSchema: z.ZodType<PublicJsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(PublicJsonValueSchema),
    z.record(z.string(), PublicJsonValueSchema),
  ]),
);

export const PublicEvidenceSchema = EvidenceSchema.omit({
  rawObjectRef: true,
}).extend({
  value: PublicJsonValueSchema,
});

export const PublicRepositorySnapshotSchema = RepositorySnapshotSchema.extend({
  candidateSignals: z.array(PublicCandidateSignalSchema),
  evidence: z.array(PublicEvidenceSchema),
});

export const PublicScoredRepositorySchema = ScoredRepositorySchema.extend({
  snapshot: PublicRepositorySnapshotSchema,
});

export type PublicScoredRepository = z.infer<
  typeof PublicScoredRepositorySchema
>;

export const PublicDailyReportSchema = DailyReportSchema.extend({
  mode: z.literal("live"),
  repositories: z.array(PublicScoredRepositorySchema),
});

export type PublicDailyReport = z.infer<typeof PublicDailyReportSchema>;

export interface PublicApiDocument {
  path: string;
  body: string;
}

export interface PublicApiEnvelope<T> {
  schemaVersion: 1;
  generatedAt: string;
  data: T;
  links: Record<string, string | null>;
  attribution: {
    name: "GitHub Picks";
    url: string;
    disclaimer: string;
  };
}

export interface BuildPublicApiOptions {
  publicBaseUrl: string;
}

interface PublicRepositoryRanks {
  overall: number | null;
  rising: number | null;
  newProjects: number | null;
  hiddenGems: number | null;
  active: number | null;
  direction: number | null;
}

const RANKING_NAMES = [
  "overall",
  "rising",
  "newProjects",
  "hiddenGems",
  "active",
] as const;

function omitRawObjectRef<T extends { rawObjectRef: unknown }>(
  value: T,
): Omit<T, "rawObjectRef"> {
  const { rawObjectRef: _rawObjectRef, ...publicValue } = value;
  return publicValue;
}

function sanitizePublicJsonValue(
  value: unknown,
  ancestors = new WeakSet<object>(),
): PublicJsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "object") {
    throw new Error("public evidence values must be JSON-compatible");
  }
  if (ancestors.has(value)) {
    throw new Error("public evidence values must not contain cycles");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizePublicJsonValue(item, ancestors));
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "rawObjectRef")
        .map(([key, item]) => [key, sanitizePublicJsonValue(item, ancestors)]),
    );
  } finally {
    ancestors.delete(value);
  }
}

export function toPublicDailyReport(report: DailyReport): PublicDailyReport {
  const parsed = DailyReportSchema.parse(report);
  if (parsed.mode !== "live") {
    throw new Error("public API accepts only live DailyReport data");
  }

  const repositories = parsed.repositories.map((repository) => ({
    ...repository,
    snapshot: {
      ...repository.snapshot,
      candidateSignals:
        repository.snapshot.candidateSignals.map(omitRawObjectRef),
      evidence: repository.snapshot.evidence.map((evidence) => ({
        ...omitRawObjectRef(evidence),
        value: sanitizePublicJsonValue(evidence.value),
      })),
    },
  }));

  return PublicDailyReportSchema.parse({
    ...parsed,
    repositories,
  });
}

export function normalizePublicBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error("public base URL must be an absolute URL", {
      cause: error,
    });
  }

  const isLocalHttp = url.protocol === "http:" && url.hostname === "localhost";
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("public base URL must use HTTPS or localhost HTTP");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("public base URL must not contain credentials");
  }
  if (url.search !== "" || url.hash !== "") {
    throw new Error("public base URL must not contain a query or fragment");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function publicUrl(publicBaseUrl: string, relativePath = ""): string {
  const suffix = relativePath.replace(/^\/+/, "");
  return suffix === "" ? `${publicBaseUrl}/` : `${publicBaseUrl}/${suffix}`;
}

function apiUrl(publicBaseUrl: string, path: string): string {
  return publicUrl(publicBaseUrl, path);
}

function repositoryPath(fullName: string): {
  apiPath: string;
  websitePath: string;
} {
  const [owner, name, extra] = fullName.split("/");
  const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
  const validName = /^(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
  if (
    owner === undefined ||
    name === undefined ||
    extra !== undefined ||
    !validOwner.test(owner) ||
    !validName.test(name)
  ) {
    throw new Error(`invalid public repository path: ${fullName}`);
  }

  return {
    apiPath: `api/v1/repositories/${owner.toLowerCase()}/${name.toLowerCase()}.json`,
    websitePath: `repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/`,
  };
}

function selectLatestLiveReports(
  reports: readonly DailyReport[],
): DailyReport[] {
  const latestByDate = new Map<string, DailyReport>();

  for (const candidate of reports) {
    const report = DailyReportSchema.parse(candidate);
    if (report.mode !== "live") continue;
    const current = latestByDate.get(report.date);
    if (
      current === undefined ||
      report.generatedAt.localeCompare(current.generatedAt) > 0
    ) {
      latestByDate.set(report.date, report);
    }
  }

  const history = [...latestByDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  if (history.length === 0) {
    throw new Error("public API requires at least one live DailyReport");
  }
  return history;
}

function healthCounts(report: DailyReport): {
  healthy: number;
  degraded: number;
  offline: number;
} {
  return {
    healthy: report.sourceHealth.filter((item) => item.status === "healthy")
      .length,
    degraded: report.sourceHealth.filter((item) => item.status === "degraded")
      .length,
    offline: report.sourceHealth.filter((item) => item.status === "offline")
      .length,
  };
}

function sourceHealthSummary(report: DailyReport) {
  return {
    reportDate: report.date,
    generatedAt: report.generatedAt,
    ...healthCounts(report),
    sources: report.sourceHealth,
  };
}

function validateRankingReferences(report: DailyReport): void {
  const repositories = new Map<string, DailyReport["repositories"][number]>();
  for (const repository of report.repositories) {
    const repositoryId = repository.snapshot.fullName.toLowerCase();
    if (repositories.has(repositoryId)) {
      throw new Error(
        `report contains duplicate repository: ${repository.snapshot.fullName} (${report.date})`,
      );
    }
    repositories.set(repositoryId, repository);
  }

  const validateRanking = (
    rankingName: string,
    repositoryIds: readonly string[],
    expectedDirection?: DirectionId,
  ) => {
    const seen = new Set<string>();
    for (const repositoryId of repositoryIds) {
      const normalizedId = repositoryId.toLowerCase();
      if (seen.has(normalizedId)) {
        throw new Error(
          `ranking contains duplicate repository: ${repositoryId} (${report.date} ${rankingName})`,
        );
      }
      seen.add(normalizedId);

      const repository = repositories.get(normalizedId);
      if (repository === undefined) {
        throw new Error(
          `ranking references missing repository: ${repositoryId} (${report.date} ${rankingName})`,
        );
      }
      if (
        expectedDirection !== undefined &&
        repository.snapshot.direction !== expectedDirection
      ) {
        throw new Error(
          `direction ranking references repository in another direction: ${repositoryId} (${report.date} ${rankingName})`,
        );
      }
    }
  };

  for (const rankingName of RANKING_NAMES) {
    validateRanking(rankingName, report.rankings[rankingName]);
  }
  for (const directionId of DIRECTION_IDS) {
    validateRanking(
      `byDirection.${directionId}`,
      report.rankings.byDirection[directionId],
      directionId,
    );
  }
}

function rankOf(items: readonly string[], repositoryId: string): number | null {
  const normalizedRepositoryId = repositoryId.toLowerCase();
  const index = items.findIndex(
    (item) => item.toLowerCase() === normalizedRepositoryId,
  );
  return index === -1 ? null : index + 1;
}

function repositoryRanks(
  report: DailyReport,
  repositoryId: string,
  direction: DirectionId,
): PublicRepositoryRanks {
  return {
    overall: rankOf(report.rankings.overall, repositoryId),
    rising: rankOf(report.rankings.rising, repositoryId),
    newProjects: rankOf(report.rankings.newProjects, repositoryId),
    hiddenGems: rankOf(report.rankings.hiddenGems, repositoryId),
    active: rankOf(report.rankings.active, repositoryId),
    direction: rankOf(report.rankings.byDirection[direction], repositoryId),
  };
}

function repositoryFromReport(
  report: DailyReport,
  repositoryId: string,
): PublicScoredRepository {
  const repository = report.repositories.find(
    (item) =>
      item.snapshot.fullName.toLowerCase() === repositoryId.toLowerCase(),
  );
  if (repository === undefined) {
    throw new Error(
      `ranking references missing repository: ${repositoryId} (${report.date})`,
    );
  }

  return toPublicDailyReport({
    ...report,
    repositories: [repository],
  }).repositories[0] as PublicScoredRepository;
}

function envelope<T>(
  generatedAt: string,
  data: T,
  links: Record<string, string | null>,
  publicBaseUrl: string,
): PublicApiEnvelope<T> {
  return {
    schemaVersion: 1,
    generatedAt,
    data,
    links,
    attribution: {
      name: "GitHub Picks",
      url: publicUrl(publicBaseUrl),
      disclaimer: "独立、非官方项目；实验评分不能替代正式技术评审。",
    },
  };
}

function serializeDocument(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function document<T>(
  path: string,
  generatedAt: string,
  data: T,
  links: Record<string, string | null>,
  publicBaseUrl: string,
): PublicApiDocument {
  return {
    path,
    body: serializeDocument(envelope(generatedAt, data, links, publicBaseUrl)),
  };
}

export function buildPublicApiDocuments(
  reports: readonly DailyReport[],
  options: BuildPublicApiOptions,
): PublicApiDocument[] {
  const publicBaseUrl = normalizePublicBaseUrl(options.publicBaseUrl);
  const history = selectLatestLiveReports(reports);
  for (const report of history) validateRankingReferences(report);
  const latest = history.at(-1) as DailyReport;
  const documents: PublicApiDocument[] = [];
  const metaPath = "api/v1/meta.json";
  const reportIndexPath = "api/v1/reports/index.json";
  const latestReportPath = "api/v1/reports/latest.json";

  const endpointLinks = {
    meta: apiUrl(publicBaseUrl, metaPath),
    reports: apiUrl(publicBaseUrl, reportIndexPath),
    latest: apiUrl(publicBaseUrl, latestReportPath),
    rankings: Object.fromEntries(
      RANKING_PERIOD_IDS.map((periodId) => [
        periodId,
        apiUrl(publicBaseUrl, `api/v1/rankings/${periodId}.json`),
      ]),
    ),
    directions: Object.fromEntries(
      DIRECTION_IDS.map((directionId) => [
        directionId,
        apiUrl(publicBaseUrl, `api/v1/directions/${directionId}.json`),
      ]),
    ),
  };

  documents.push(
    document(
      metaPath,
      latest.generatedAt,
      {
        product: "GitHub Picks",
        timezone: "Asia/Shanghai",
        latestReportDate: latest.date,
        availableReportDates: history.map((report) => report.date).reverse(),
        periods: RANKING_PERIOD_IDS.map((id) => ({
          id,
          ...RANKING_PERIOD_META[id],
        })),
        directions: DIRECTION_IDS.map((id) => ({
          id,
          ...DIRECTION_META[id],
        })),
        endpoints: endpointLinks,
      },
      {
        self: apiUrl(publicBaseUrl, metaPath),
        website: publicUrl(publicBaseUrl),
      },
      publicBaseUrl,
    ),
  );

  const reportIndexItems = [...history].reverse().map((report) => ({
    date: report.date,
    generatedAt: report.generatedAt,
    scoreVersion: report.scoreVersion,
    analysisVersion: report.analysisVersion ?? null,
    publishedCount: report.counts.published,
    sourceHealth: healthCounts(report),
    links: {
      api: apiUrl(publicBaseUrl, `api/v1/reports/${report.date}.json`),
      website: publicUrl(publicBaseUrl, `history/${report.date}/`),
    },
  }));
  documents.push(
    document(
      reportIndexPath,
      latest.generatedAt,
      { count: reportIndexItems.length, items: reportIndexItems },
      {
        self: apiUrl(publicBaseUrl, reportIndexPath),
        website: publicUrl(publicBaseUrl, "history/"),
        latest: apiUrl(publicBaseUrl, latestReportPath),
      },
      publicBaseUrl,
    ),
  );

  const publicReports = history.map(toPublicDailyReport);
  for (const [index, report] of publicReports.entries()) {
    const reportPath = `api/v1/reports/${report.date}.json`;
    const previous = publicReports[index - 1];
    const next = publicReports[index + 1];
    documents.push(
      document(
        reportPath,
        report.generatedAt,
        { report },
        {
          self: apiUrl(publicBaseUrl, reportPath),
          website: publicUrl(publicBaseUrl, `history/${report.date}/`),
          index: apiUrl(publicBaseUrl, reportIndexPath),
          previous:
            previous === undefined
              ? null
              : apiUrl(publicBaseUrl, `api/v1/reports/${previous.date}.json`),
          next:
            next === undefined
              ? null
              : apiUrl(publicBaseUrl, `api/v1/reports/${next.date}.json`),
        },
        publicBaseUrl,
      ),
    );
  }
  documents.push(
    document(
      latestReportPath,
      latest.generatedAt,
      { report: toPublicDailyReport(latest) },
      {
        self: apiUrl(publicBaseUrl, latestReportPath),
        website: publicUrl(publicBaseUrl),
        index: apiUrl(publicBaseUrl, reportIndexPath),
        canonical: apiUrl(publicBaseUrl, `api/v1/reports/${latest.date}.json`),
      },
      publicBaseUrl,
    ),
  );

  for (const periodId of RANKING_PERIOD_IDS) {
    const ranking = buildPeriodRanking(history, periodId);
    const periodReports = history.filter(
      (report) =>
        report.date >= ranking.fromDate && report.date <= ranking.toDate,
    );
    if (periodReports.length !== ranking.reportCount) {
      throw new Error(`period ranking report coverage mismatch: ${periodId}`);
    }
    const rankingPath = `api/v1/rankings/${periodId}.json`;
    documents.push(
      document(
        rankingPath,
        latest.generatedAt,
        {
          ranking: {
            ...ranking,
            items: ranking.items.map((item) => ({
              ...item,
              href: publicUrl(publicBaseUrl, item.href),
            })),
          },
          sourceHealth: periodReports.map(sourceHealthSummary),
        },
        {
          self: apiUrl(publicBaseUrl, rankingPath),
          website: publicUrl(publicBaseUrl, `rankings/${periodId}/`),
          meta: apiUrl(publicBaseUrl, metaPath),
        },
        publicBaseUrl,
      ),
    );
  }

  for (const directionId of DIRECTION_IDS) {
    const directionPath = `api/v1/directions/${directionId}.json`;
    const items = latest.rankings.byDirection[directionId].map(
      (repositoryId, index) => {
        const repository = repositoryFromReport(latest, repositoryId);
        const paths = repositoryPath(repository.snapshot.fullName);
        return {
          rank: index + 1,
          repository,
          links: {
            website: publicUrl(publicBaseUrl, paths.websitePath),
            github: repository.snapshot.url,
          },
        };
      },
    );
    documents.push(
      document(
        directionPath,
        latest.generatedAt,
        {
          direction: { id: directionId, ...DIRECTION_META[directionId] },
          reportDate: latest.date,
          sourceHealth: sourceHealthSummary(latest),
          items,
        },
        {
          self: apiUrl(publicBaseUrl, directionPath),
          website: publicUrl(publicBaseUrl, `directions/${directionId}/`),
          report: apiUrl(publicBaseUrl, latestReportPath),
        },
        publicBaseUrl,
      ),
    );
  }

  const repositoryOccurrences = new Map<
    string,
    Array<{ report: DailyReport; repositoryId: string }>
  >();
  for (const report of history) {
    for (const repository of report.repositories) {
      const normalizedId = repository.snapshot.fullName.toLowerCase();
      const occurrences = repositoryOccurrences.get(normalizedId) ?? [];
      occurrences.push({
        report,
        repositoryId: repository.snapshot.fullName,
      });
      repositoryOccurrences.set(normalizedId, occurrences);
    }
  }

  for (const [normalizedId, occurrences] of [
    ...repositoryOccurrences.entries(),
  ].sort(([left], [right]) => left.localeCompare(right))) {
    const latestOccurrence = occurrences.at(-1);
    if (latestOccurrence === undefined) continue;
    const latestRepository = repositoryFromReport(
      latestOccurrence.report,
      latestOccurrence.repositoryId,
    );
    const paths = repositoryPath(normalizedId);
    const observations = occurrences.map(({ report, repositoryId }) => {
      const repository = repositoryFromReport(report, repositoryId);
      return {
        date: report.date,
        generatedAt: report.generatedAt,
        publishedScore: repository.score.publishedScore,
        confidence: repository.score.confidence,
        riskPenalty: repository.score.riskPenalty,
        stars: repository.snapshot.stars,
        direction: repository.snapshot.direction,
        ranks: repositoryRanks(
          report,
          repositoryId,
          repository.snapshot.direction,
        ),
      };
    });
    documents.push(
      document(
        paths.apiPath,
        latestOccurrence.report.generatedAt,
        {
          latestReportDate: latestOccurrence.report.date,
          repository: latestRepository,
          sourceHealth: sourceHealthSummary(latestOccurrence.report),
          observations,
        },
        {
          self: apiUrl(publicBaseUrl, paths.apiPath),
          website: publicUrl(publicBaseUrl, paths.websitePath),
          github: latestRepository.snapshot.url,
          latestReport: apiUrl(
            publicBaseUrl,
            `api/v1/reports/${latestOccurrence.report.date}.json`,
          ),
        },
        publicBaseUrl,
      ),
    );
  }

  const sortedDocuments = documents.sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const uniquePaths = new Set(sortedDocuments.map((item) => item.path));
  if (uniquePaths.size !== sortedDocuments.length) {
    throw new Error("public API generated duplicate document paths");
  }
  return sortedDocuments;
}

function validatePublicApiDocuments(
  documents: readonly PublicApiDocument[],
): void {
  const paths = new Set<string>();
  const allowedPath =
    /^api\/v1\/(?:[A-Za-z0-9._%-]+\/)*[A-Za-z0-9._%-]+\.json$/;

  for (const document of documents) {
    if (!allowedPath.test(document.path) || document.path.includes("..")) {
      throw new Error(
        `public API document must stay inside api/v1: ${document.path}`,
      );
    }
    if (paths.has(document.path)) {
      throw new Error(`duplicate public API document path: ${document.path}`);
    }
    paths.add(document.path);

    if (!document.body.endsWith("\n")) {
      throw new Error(
        `public API document must end with a newline: ${document.path}`,
      );
    }
    const value = JSON.parse(document.body) as { schemaVersion?: unknown };
    if (value.schemaVersion !== 1) {
      throw new Error(
        `public API document has unsupported schema version: ${document.path}`,
      );
    }
  }
}

export async function writePublicApi(
  outputRoot: string,
  documents: readonly PublicApiDocument[],
): Promise<void> {
  validatePublicApiDocuments(documents);

  const resolvedOutputRoot = resolve(outputRoot);
  const apiParent = join(resolvedOutputRoot, "api");
  const apiRoot = join(apiParent, "v1");
  await mkdir(apiParent, { recursive: true });
  const stagedRoot = await mkdtemp(join(apiParent, ".v1-stage-"));

  try {
    for (const document of documents) {
      const relativePath = document.path.slice("api/v1/".length);
      const outputPath = resolve(stagedRoot, relativePath);
      const pathFromStage = relative(stagedRoot, outputPath);
      if (
        pathFromStage === "" ||
        pathFromStage.startsWith(`..${sep}`) ||
        pathFromStage === ".."
      ) {
        throw new Error(
          `public API document must stay inside api/v1: ${document.path}`,
        );
      }
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, document.body, "utf8");
    }

    await rm(apiRoot, { recursive: true, force: true });
    await rename(stagedRoot, apiRoot);
  } catch (error) {
    await rm(stagedRoot, { recursive: true, force: true });
    throw error;
  }
}
