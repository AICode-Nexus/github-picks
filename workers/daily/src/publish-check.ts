import { resolve } from "node:path";
import { validatePublicationDirectory } from "./publish-gate.js";

try {
  const rawArguments = process.argv.slice(2);
  const argumentsWithoutSeparator =
    rawArguments[0] === "--" ? rawArguments.slice(1) : rawArguments;
  const [directory, expectedDate, ...rest] = argumentsWithoutSeparator;
  if (!directory || !expectedDate || rest.length > 0) {
    throw new Error("usage: picks:publish-check -- <directory> <YYYY-MM-DD>");
  }

  const summary = await validatePublicationDirectory(
    resolve(process.cwd(), directory),
    expectedDate,
  );
  process.stdout.write(
    `${[
      `date=${summary.date}`,
      `generatedAt=${summary.generatedAt}`,
      `discovered=${summary.discovered}`,
      `enriched=${summary.enriched}`,
      `published=${summary.published}`,
      `aiVerified=${summary.aiVerified}`,
      `degraded=${summary.degradedSources.join(",") || "none"}`,
    ].join("\n")}\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`PublicationGateError: ${message}\n`);
  process.exitCode = 1;
}
