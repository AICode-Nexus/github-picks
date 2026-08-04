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
  const reports = await loadDailyReports(options);
  const latest = reports.filter((report) => report.mode === "live").at(-1);

  if (latest === undefined) {
    throw new Error("no live DailyReport is available for publication");
  }

  return latest;
}
