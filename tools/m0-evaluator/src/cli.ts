import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { evaluateM0 } from "./evaluate.js";
import { renderDecisionReport } from "./report.js";
import { M0ObservationSchema, M0ScopeSchema } from "./schema.js";

const [
  scopePath = "docs/research/m0/scope.yaml",
  observationDir = "docs/research/m0/observations",
  outputPath = "docs/research/m0/decision.md",
] = process.argv.slice(2);
const scope = M0ScopeSchema.parse(
  YAML.parse(await readFile(resolve(scopePath), "utf8")),
);
const files = (await readdir(resolve(observationDir)))
  .filter((file) => file.endsWith(".yaml"))
  .sort();
const observations = await Promise.all(
  files.map(async (file) =>
    M0ObservationSchema.parse(
      YAML.parse(await readFile(resolve(observationDir, file), "utf8")),
    ),
  ),
);
const result = evaluateM0(scope, observations);
await writeFile(resolve(outputPath), renderDecisionReport(result), "utf8");
process.stdout.write(`${result.decision}\n`);
process.exitCode = result.decision === "INSUFFICIENT_EVIDENCE" ? 2 : 0;
