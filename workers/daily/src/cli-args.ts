export type PipelineMode = "live" | "replay";

export interface DailyCliOptions {
  date: string;
  mode: PipelineMode;
  configPath?: string;
  outputDirectory?: string;
  rawDirectory?: string;
  replayManifestPath?: string;
}

function beijingDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(`invalid date: ${value}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`invalid date: ${value}`);
  }
  return value;
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--"))
    throw new Error(`missing value for ${flag}`);
  return value;
}

export function parseCliArgs(
  args: string[],
  now = new Date(),
): DailyCliOptions {
  const options: DailyCliOptions = { date: beijingDate(now), mode: "live" };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === undefined) continue;
    if (flag === "--") {
      continue;
    }
    if (flag === "--date") {
      options.date = validateDate(readValue(args, index, flag));
      index += 1;
    } else if (flag === "--mode") {
      const value = readValue(args, index, flag);
      if (value !== "live" && value !== "replay")
        throw new Error(`invalid mode: ${value}`);
      options.mode = value;
      index += 1;
    } else if (flag === "--config") {
      options.configPath = readValue(args, index, flag);
      index += 1;
    } else if (flag === "--output") {
      options.outputDirectory = readValue(args, index, flag);
      index += 1;
    } else if (flag === "--raw") {
      options.rawDirectory = readValue(args, index, flag);
      index += 1;
    } else if (flag === "--replay-manifest") {
      options.replayManifestPath = readValue(args, index, flag);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  return options;
}
