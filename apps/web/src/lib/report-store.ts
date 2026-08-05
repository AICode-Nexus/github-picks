import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type DailyReport, DailyReportSchema } from "@github-picks/core/schema";

export type ReportStoreOptions = Readonly<{
  rootDirectory?: string;
}>;

export function resolveDailyArtifactsDirectory(moduleUrl?: string): string {
  if (moduleUrl !== undefined) {
    return resolve(
      fileURLToPath(new URL("../../../../artifacts/daily/", moduleUrl)),
    );
  }

  return resolve(process.cwd(), "../../artifacts/daily");
}

export const defaultDailyReportsDirectory = resolveDailyArtifactsDirectory();

async function parseDailyReport(reportPath: string): Promise<DailyReport> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(reportPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `invalid DailyReport at ${reportPath}: report.json could not be read`,
      { cause: error },
    );
  }

  const result = DailyReportSchema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`invalid DailyReport at ${reportPath}: ${issues}`);
  }

  return result.data;
}

export async function loadDailyReports(
  options: ReportStoreOptions = {},
): Promise<DailyReport[]> {
  const rootDirectory = options.rootDirectory ?? defaultDailyReportsDirectory;
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  const reportPaths = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(rootDirectory, entry.name, "report.json"))
    .sort((left, right) => left.localeCompare(right));
  const reports = await Promise.all(reportPaths.map(parseDailyReport));

  return reports.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.generatedAt.localeCompare(right.generatedAt),
  );
}

export async function getLatestLiveReport(
  options: ReportStoreOptions = {},
): Promise<DailyReport> {
  const latest = (await getLiveReportHistory(options)).at(-1);

  if (latest === undefined) {
    throw new Error("no live DailyReport is available for publication");
  }

  return latest;
}

export async function getLiveReportHistory(
  options: ReportStoreOptions = {},
): Promise<DailyReport[]> {
  const reports = await loadDailyReports(options);
  const latestByDate = new Map<string, DailyReport>();

  for (const report of reports) {
    if (report.mode !== "live") continue;
    const current = latestByDate.get(report.date);
    if (
      current === undefined ||
      report.generatedAt.localeCompare(current.generatedAt) > 0
    ) {
      latestByDate.set(report.date, report);
    }
  }

  return [...latestByDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

export async function getLiveReportByDate(
  date: string,
  options: ReportStoreOptions = {},
): Promise<DailyReport | null> {
  const history = await getLiveReportHistory(options);
  return history.find((report) => report.date === date) ?? null;
}

export async function getLatestLiveReportForRepository(
  repositoryId: string,
  options: ReportStoreOptions = {},
): Promise<DailyReport | null> {
  const normalizedRepositoryId = repositoryId.toLowerCase();
  const history = await getLiveReportHistory(options);

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const report = history[index];
    if (
      report?.repositories.some(
        (repository) =>
          repository.snapshot.fullName.toLowerCase() === normalizedRepositoryId,
      )
    ) {
      return report;
    }
  }

  return null;
}
