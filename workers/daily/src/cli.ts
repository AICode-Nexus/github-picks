import { parseCliArgs } from "./cli-args.js";
import { resolveCliPaths } from "./cli-paths.js";
import { runDailyPipeline } from "./pipeline.js";

try {
  const options = parseCliArgs(process.argv.slice(2));
  const paths = resolveCliPaths(options, process.cwd(), import.meta.url);
  const report = await runDailyPipeline({
    mode: options.mode,
    date: options.date,
    ...paths,
    githubToken: process.env.GITHUB_TOKEN?.trim() || null,
  });
  const degraded = report.sourceHealth
    .filter((source) => source.status !== "healthy")
    .map((source) => source.sourceId);
  process.stdout.write(
    `${[
      `date=${report.date}`,
      `discovered=${report.counts.discovered}`,
      `enriched=${report.counts.enriched}`,
      `published=${report.counts.published}`,
      `degraded=${degraded.length === 0 ? "none" : degraded.join(",")}`,
      `report=${paths.outputDirectory}/report.md`,
    ].join("\n")}\n`,
  );
} catch (error) {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
