import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const skillRoot = resolve(process.cwd(), "../../.agents/skills/github-picks");

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? listFiles(path)
        : [relative(skillRoot, path)];
    }),
  );
  return files.flat().sort();
}

describe("github-picks Agent Skill", () => {
  it("contains the complete minimal Skill package", async () => {
    await expect(listFiles(skillRoot)).resolves.toEqual([
      "SKILL.md",
      "agents/openai.yaml",
      "evals/evals.json",
      "references/api.md",
      "references/errors.md",
    ]);
  });

  it("defines routing, read-only safety, and public-ranking boundaries", async () => {
    const skill = await readFile(join(skillRoot, "SKILL.md"), "utf8");

    expect(skill).toMatch(/^---\nname: github-picks\ndescription: .+\n---\n/);
    expect(skill).toContain(
      "https://aicode-nexus.github.io/github-picks/api/v1",
    );
    expect(skill).toContain("匿名只读");
    expect(skill).toContain("不重新评分");
    expect(skill).toContain("保持原榜相对顺序");
    expect(skill).toContain("Asia/Shanghai");
    expect(skill).toContain("references/api.md");
    expect(skill).toContain("references/errors.md");
  });

  it("provides valid OpenAI metadata and three behavioral evals", async () => {
    const openai = await readFile(
      join(skillRoot, "agents/openai.yaml"),
      "utf8",
    );
    const evals = JSON.parse(
      await readFile(join(skillRoot, "evals/evals.json"), "utf8"),
    ) as {
      skill_name: string;
      evals: Array<{ prompt: string; expected_output: string }>;
    };

    expect(openai).toContain('display_name: "GitHub Picks"');
    expect(openai).toContain('short_description: "查询 GitHub 每日精选');
    expect(openai).toContain("$github-picks");
    expect(evals.skill_name).toBe("github-picks");
    expect(evals.evals).toHaveLength(3);
    expect(evals.evals.map((item) => item.prompt).join("\n")).toContain(
      "近 30 天",
    );
    expect(evals.evals.map((item) => item.prompt).join("\n")).toContain(
      "2099-01-01",
    );
  });

  it("resolves every bundled reference and contains no local secrets", async () => {
    const files = await listFiles(skillRoot);
    const contents = await Promise.all(
      files.map(async (file) => ({
        file,
        text: await readFile(join(skillRoot, file), "utf8"),
      })),
    );
    const skill = contents.find((item) => item.file === "SKILL.md")?.text ?? "";
    const references = [...skill.matchAll(/\((references\/[^)]+)\)/g)].map(
      (match) => match[1],
    );

    expect(references.sort()).toEqual([
      "references/api.md",
      "references/errors.md",
    ]);
    for (const reference of references) {
      await expect(
        readFile(join(skillRoot, reference), "utf8"),
      ).resolves.not.toBe("");
    }

    const packageText = contents.map((item) => item.text).join("\n");
    expect(packageText).not.toContain("/Users/");
    expect(packageText).not.toContain("GITHUB_TOKEN");
    expect(packageText).not.toContain("ghp_");
    expect(packageText).not.toContain("api_key");
  });
});
