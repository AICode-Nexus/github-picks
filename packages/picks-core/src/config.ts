import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { type PicksConfig, PicksConfigSchema } from "./schema.js";

export async function loadPicksConfig(path: string): Promise<PicksConfig> {
  const contents = await readFile(path, "utf8");
  return PicksConfigSchema.parse(YAML.parse(contents));
}

export function hashPicksConfig(config: PicksConfig): string {
  return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}
