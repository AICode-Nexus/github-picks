import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CliPaths {
  scopePath: string;
  observationDir: string;
  outputPath: string;
}

export function resolveCliPaths(
  args: string[],
  invocationCwd: string,
  moduleUrl: string,
): CliPaths {
  const repositoryRoot = fileURLToPath(new URL("../../../", moduleUrl));
  const [scopePath, observationDir, outputPath] = args;
  return {
    scopePath: scopePath
      ? resolve(invocationCwd, scopePath)
      : resolve(repositoryRoot, "docs/research/m0/scope.yaml"),
    observationDir: observationDir
      ? resolve(invocationCwd, observationDir)
      : resolve(repositoryRoot, "docs/research/m0/observations"),
    outputPath: outputPath
      ? resolve(invocationCwd, outputPath)
      : resolve(repositoryRoot, "docs/research/m0/decision.md"),
  };
}
