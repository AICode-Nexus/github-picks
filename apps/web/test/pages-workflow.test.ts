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
    expect(workflow).toContain(
      'GITHUB_PICKS_PUBLIC_BASE_URL: "https://aicode-nexus.github.io/github-picks"',
    );
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

  it("verifies the public API before uploading the Pages artifact", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    const verification = workflow.indexOf("name: Verify public API artifacts");
    const upload = workflow.indexOf("uses: actions/upload-pages-artifact@v5");

    expect(verification).toBeGreaterThan(-1);
    expect(upload).toBeGreaterThan(verification);
    expect(workflow).toContain("apps/web/out/api/v1/meta.json");
    expect(workflow).toContain("apps/web/out/api/v1/reports/latest.json");
    expect(workflow).toContain("apps/web/out/api/v1/reports/index.json");
    expect(workflow).toContain("apps/web/out/api/v1/rankings/180d.json");
    expect(workflow).toContain(
      "apps/web/out/api/v1/directions/security-supply-chain.json",
    );
    expect(workflow).toContain("document.schemaVersion !== 1");
    expect(workflow).toContain(
      "const normalizedRepositoryId = repositoryId.toLowerCase();",
    );
    expect(workflow).toMatch(
      /join\(apiRoot,\s+"repositories",\s+`\$\{normalizedRepositoryId\}\.json`\s*\),/,
    );
  });
});
