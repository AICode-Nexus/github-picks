import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Candidate,
  DailyReportSchema,
  type DirectionId,
  RepositorySnapshotSchema,
} from "@github-picks/core";
import { describe, expect, it } from "vitest";
import type { RecommendationGenerator } from "../src/ai-analysis.js";
import { parseGitHubSnapshot } from "../src/github.js";
import { runDailyPipeline } from "../src/pipeline.js";

const observedAt = "2026-08-03T15:30:00.000Z";
const directions: DirectionId[] = [
  "ai-agent",
  "data-ml",
  "app-platform",
  "infra-devtools",
  "security-supply-chain",
];

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function rawRef(sourceId: string, character: string) {
  const sha256 = character.repeat(64);
  return {
    objectRef: `sha256:${sha256}`,
    sha256,
    sourceId,
    path: `/tmp/${sha256}.bin`,
    observedAt,
    url: `https://example.com/${sourceId}`,
  };
}

async function replaySnapshots() {
  const repository = JSON.parse(await fixture("github-repository.json"));
  const events = JSON.parse(await fixture("github-events.json"));
  return directions.map((direction, index) => {
    const fullName = `replay-${index}/project-${index}`;
    const candidate: Candidate = {
      fullName,
      primaryDirection: direction,
      directions: [direction],
      signals: [
        {
          fullName,
          sourceId: "gittrend",
          sourceTier: "B",
          independenceGroup: "github-public-data",
          direction,
          evidenceUrl: "https://gittrend.io/api/trending?limit=50",
          observedAt,
          rank: index + 1,
          sourceScore: 100 - index,
          stale: false,
          summaryZh: null,
          metrics: {
            starVelocity: 100 - index,
            trendingScore: 100 - index,
            discussionPoints: null,
            discussionComments: null,
          },
          rawObjectRef: null,
        },
      ],
    };
    const snapshot = parseGitHubSnapshot({
      repository: {
        ...repository,
        node_id: `R_replay_${index}`,
        full_name: fullName,
        html_url: `https://github.com/${fullName}`,
        owner: { login: `replay-${index}`, type: "Organization" },
        stargazers_count: 1000 + index * 100,
      },
      events,
      candidate,
      observedAt,
      repositoryRawRef: rawRef("github-rest", String(index + 1)),
      eventsRawRef: rawRef("github-rest", String(index + 6)),
    });
    return RepositorySnapshotSchema.parse(snapshot);
  });
}

describe("daily pipeline replay", () => {
  it("generates schema-valid JSON, Markdown and manifest without network", async () => {
    const root = await mkdtemp(join(tmpdir(), "github-picks-pipeline-"));
    const replayManifestPath = join(root, "replay.json");
    const outputDirectory = join(root, "output");
    await writeFile(
      replayManifestPath,
      JSON.stringify({
        version: 1,
        observedAt,
        discoveredCount: 12,
        sourceHealth: [
          {
            sourceId: "gittrend",
            status: "healthy",
            observedAt,
            message: null,
          },
          {
            sourceId: "hublens",
            status: "degraded",
            observedAt,
            message: "数据超过 48 小时",
          },
        ],
        snapshots: await replaySnapshots(),
      }),
    );

    const recommendationGenerator: RecommendationGenerator = {
      provider: "test-ai",
      model: "test-model",
      promptVersion: "v1.0.0",
      analysisVersion: "v1.1.0",
      concurrency: 2,
      async generate({ snapshot }) {
        return `${snapshot.fullName}：工程活动与方向价值均有事实支撑，适合对应技术团队先做隔离验证；正式采用前仍需核验长期维护与安全边界。`;
      },
    };
    const report = await runDailyPipeline({
      mode: "replay",
      date: "2026-08-03",
      configPath: "../../config/picks.yaml",
      outputDirectory,
      rawDirectory: join(root, "raw"),
      replayManifestPath,
      githubToken: null,
      fetchImpl: (async () => {
        throw new Error("replay must not access the network");
      }) as typeof fetch,
      recommendationGenerator,
      analysisRequired: true,
    });

    expect(DailyReportSchema.parse(report)).toEqual(report);
    expect(report.mode).toBe("replay");
    expect(report.repositories).toHaveLength(5);
    expect(
      Object.values(report.rankings.byDirection).every(
        (items) => items.length === 1,
      ),
    ).toBe(true);
    expect(
      report.sourceHealth.some((source) => source.status === "degraded"),
    ).toBe(true);
    expect(
      report.sourceHealth.find((source) => source.sourceId === "ai-analysis"),
    ).toMatchObject({ status: "healthy" });
    expect(
      report.repositories.every(
        (repository) =>
          repository.analysis.generation?.kind === "ai" &&
          repository.analysis.generation.status === "verified" &&
          repository.analysis.recommendationReason?.startsWith(
            repository.snapshot.fullName,
          ),
      ),
    ).toBe(true);
    expect(
      JSON.parse(await readFile(join(outputDirectory, "report.json"), "utf8")),
    ).toEqual(report);
    expect(
      await readFile(join(outputDirectory, "report.md"), "utf8"),
    ).toContain("GitHub Picks Daily");
    expect(
      JSON.parse(
        await readFile(join(outputDirectory, "manifest.json"), "utf8"),
      ),
    ).toMatchObject({
      configHash: report.configHash,
      counts: report.counts,
    });
  });
});
