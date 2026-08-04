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
    expect(
      workflow.match(/^\s*uses:\s+actions\/configure-pages@v6\s*$/gm),
    ).toHaveLength(1);
    expect(
      workflow.match(/^\s*uses:\s+actions\/upload-pages-artifact@v5\s*$/gm),
    ).toHaveLength(1);
    expect(
      workflow.match(/^\s*uses:\s+actions\/deploy-pages@v5\s*$/gm),
    ).toHaveLength(1);
    expect(workflow).toContain("path: apps/web/out");
  });
});
