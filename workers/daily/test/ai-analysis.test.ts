import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  analyzeRepository,
  loadPicksConfig,
  RepositorySnapshotSchema,
  scoreRepository,
} from "@github-picks/core";
import { describe, expect, it } from "vitest";
import { OllamaRecommendationGenerator } from "../src/ai-analysis.js";

const observedAt = "2026-08-04T03:30:00.000Z";

async function input() {
  const replay = JSON.parse(
    await readFile(
      new URL("./fixtures/replay-manifest.json", import.meta.url),
      "utf8",
    ),
  ) as { snapshots: unknown[] };
  const sourceSnapshot = replay.snapshots[0];
  if (sourceSnapshot === undefined) throw new Error("missing replay snapshot");
  const snapshot = RepositorySnapshotSchema.parse({
    ...(sourceSnapshot as Record<string, unknown>),
    nodeId: "R_example_project",
    fullName: "example/project",
    url: "https://github.com/example/project",
    ownerLogin: "example",
  });
  const config = await loadPicksConfig(
    fileURLToPath(new URL("../../../config/picks.yaml", import.meta.url)),
  );
  const score = scoreRepository(snapshot, config);
  return {
    snapshot,
    score,
    fallback: analyzeRepository({ snapshot, score, generatedAt: observedAt }),
  };
}

describe("Ollama AI recommendation generation", () => {
  it("accepts schema-validated JSON from thinking output and sends a fact-only prompt", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const generator = new OllamaRecommendationGenerator({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-vl:8b",
      fetchImpl: (async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            model: "qwen3-vl:8b",
            created_at: observedAt,
            message: {
              role: "assistant",
              content: "",
              thinking: JSON.stringify({
                recommendationReason:
                  "example/project：兼顾 Agent 工程实用性与近期维护活跃度，适合技术负责人做小范围研发提效验证；当前仍缺少长期采用与安全工程证据，不宜直接进入生产。",
              }),
            },
            done: true,
          }),
        );
      }) as typeof fetch,
    });

    const reason = await generator.generate(await input());

    expect(reason).toContain("example/project");
    expect(reason).toContain("不宜直接进入生产");
    expect(requestBody).toMatchObject({
      model: "qwen3-vl:8b",
      stream: false,
      think: false,
      format: {
        type: "object",
      },
    });
    expect(JSON.stringify(requestBody)).toContain("editorialContext");
    expect(JSON.stringify(requestBody)).not.toContain("missingFields");
    expect(JSON.stringify(requestBody)).not.toContain("rawObjectRef");
  });

  it("rejects unsupported numbers instead of publishing model inventions", async () => {
    const generator = new OllamaRecommendationGenerator({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-vl:8b",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            model: "qwen3-vl:8b",
            created_at: observedAt,
            message: {
              role: "assistant",
              content: JSON.stringify({
                recommendationReason:
                  "example/project：性能提升达到 99%，适合立即全面替换现有生产系统，且没有额外风险。",
              }),
            },
            done: true,
          }),
        )) as typeof fetch,
    });

    await expect(generator.generate(await input())).rejects.toThrow(
      /unsupported numeric claim|禁止表述/,
    );
  });

  it("rejects language-only runtime claims and stars-as-quality reasoning", async () => {
    const outputs = [
      "example/project：仅限 Rust 环境使用，适合需要 Agent 工具的工程团队；近期维护活动连续，可作为研发效率工具候选。",
      "example/project：星标证明项目工程质量与适用性，适合 Agent 工程团队；近期维护活动连续，可作为研发效率工具候选。",
      "example/project：星标验证项目成熟度，适合 Agent 工程团队；近期维护活动连续，可作为研发效率工具候选。",
    ];
    let call = 0;
    const generator = new OllamaRecommendationGenerator({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-vl:8b",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            model: "qwen3-vl:8b",
            created_at: observedAt,
            message: {
              role: "assistant",
              content: JSON.stringify({
                recommendationReason: outputs[call++] ?? outputs[2],
              }),
            },
            done: true,
          }),
        )) as typeof fetch,
    });

    await expect(generator.generate(await input())).rejects.toThrow(
      /runtime limit|stars as capability evidence/,
    );
  });

  it("rejects discovery rank as proof of technical value", async () => {
    const generator = new OllamaRecommendationGenerator({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-vl:8b",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            model: "qwen3-vl:8b",
            created_at: observedAt,
            message: {
              role: "assistant",
              content: JSON.stringify({
                recommendationReason:
                  "example/project：提供面向 Agent 的开发工具；近期讨论热度显示其技术价值，适合关注研发效率的工程团队。",
              }),
            },
            done: true,
          }),
        )) as typeof fetch,
    });

    await expect(generator.generate(await input())).rejects.toThrow(
      /discovery attention as capability evidence/,
    );
  });

  it("adds deterministic attribution to numeric project claims", async () => {
    const value = await input();
    value.snapshot.description = "Runs a 70B model on a single 4GB GPU";
    const generator = new OllamaRecommendationGenerator({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-vl:8b",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            model: "qwen3-vl:8b",
            created_at: observedAt,
            message: {
              role: "assistant",
              content: JSON.stringify({
                recommendationReason:
                  "example/project：可在单张 4GB GPU 上运行 70B 模型；近期维护活动连续，适合关注 Agent 工程化的研发团队。",
              }),
            },
            done: true,
          }),
        )) as typeof fetch,
    });

    await expect(generator.generate(value)).resolves.toContain(
      "example/project：项目自述，",
    );
  });
});
