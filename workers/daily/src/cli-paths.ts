import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DailyCliOptions } from "./cli-args.js";

export interface DailyCliPaths {
  configPath: string;
  outputDirectory: string;
  rawDirectory: string;
  replayManifestPath: string;
}

export function resolveCliPaths(
  options: DailyCliOptions,
  invocationCwd: string,
  moduleUrl: string,
): DailyCliPaths {
  const repositoryRoot = fileURLToPath(new URL("../../../", moduleUrl));
  return {
    configPath: options.configPath
      ? resolve(invocationCwd, options.configPath)
      : resolve(repositoryRoot, "config/picks.yaml"),
    outputDirectory: options.outputDirectory
      ? resolve(invocationCwd, options.outputDirectory)
      : resolve(repositoryRoot, `artifacts/daily/${options.date}`),
    rawDirectory: options.rawDirectory
      ? resolve(invocationCwd, options.rawDirectory)
      : resolve(repositoryRoot, "artifacts/raw"),
    replayManifestPath: options.replayManifestPath
      ? resolve(invocationCwd, options.replayManifestPath)
      : resolve(
          repositoryRoot,
          "workers/daily/test/fixtures/replay-manifest.json",
        ),
  };
}
