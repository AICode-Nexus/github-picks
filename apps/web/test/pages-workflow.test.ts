import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(
  process.cwd(),
  "../../.github/workflows/pages.yml",
);

describe("GitHub Pages workflow", () => {
  it("builds and deploys the static export with the project base path", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("branches: [master]");
    expect(workflow).toContain('NEXT_PUBLIC_BASE_PATH: "/github-picks"');
    expect(workflow).toContain("actions/configure-pages@v6");
    expect(workflow).toContain("actions/upload-pages-artifact@v5");
    expect(workflow).toContain("actions/deploy-pages@v5");
    expect(workflow).toContain("path: apps/web/out");
  });
});
