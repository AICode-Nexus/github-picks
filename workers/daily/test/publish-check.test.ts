import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../src/publish-check.ts", import.meta.url),
);
const liveDirectory = fileURLToPath(
  new URL("../../../artifacts/daily/2026-08-04/", import.meta.url),
);
const tsxPath = fileURLToPath(
  new URL("../node_modules/.bin/tsx", import.meta.url),
);

describe("publication check CLI", () => {
  it("prints a machine-readable summary for valid live artifacts", async () => {
    const { stdout } = await execFileAsync(
      tsxPath,
      [cliPath, liveDirectory, "2026-08-04"],
      { encoding: "utf8" },
    );

    expect(stdout).toContain("date=2026-08-04");
    expect(stdout).toContain("published=20");
    expect(stdout).toContain("aiVerified=20");
  });

  it("accepts the pnpm argument separator", async () => {
    const { stdout } = await execFileAsync(
      tsxPath,
      [cliPath, "--", liveDirectory, "2026-08-04"],
      { encoding: "utf8" },
    );

    expect(stdout).toContain("date=2026-08-04");
  });

  it("returns a nonzero exit with the blocking gate", async () => {
    const error = await execFileAsync(
      tsxPath,
      [cliPath, liveDirectory, "2026-08-05"],
      { encoding: "utf8" },
    ).catch((value: unknown) => value as { stderr: string });

    expect(error.stderr).toContain(
      "PublicationGateError: report date does not match expected date",
    );
  });
});
