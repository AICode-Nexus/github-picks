import {
  type Candidate,
  type Evidence,
  type RawArtifactRef,
  type RepositorySnapshot,
  RepositorySnapshotSchema,
} from "@github-picks/core";
import { z } from "zod";
import type { EnrichmentContext } from "./enrichment.js";
import { type HttpArtifact, HttpStatusError, requestArtifact } from "./http.js";

const GitHubRepositoryResponseSchema = z.object({
  node_id: z.string().min(1),
  full_name: z.string().min(3),
  html_url: z.url(),
  owner: z.object({
    login: z.string().min(1),
    type: z.enum(["Organization", "User"]),
  }),
  description: z.string().nullable(),
  homepage: z.string().nullable().default(null),
  language: z.string().nullable(),
  topics: z.array(z.string()).default([]),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  pushed_at: z.iso.datetime(),
  default_branch: z.string().min(1),
  stargazers_count: z.int().nonnegative(),
  forks_count: z.int().nonnegative(),
  subscribers_count: z.int().nonnegative().default(0),
  open_issues_count: z.int().nonnegative(),
  archived: z.boolean(),
  license: z.object({ spdx_id: z.string().nullable() }).nullable(),
});

const GitHubEventResponseSchema = z.array(
  z.object({
    type: z.string(),
    actor: z.object({ login: z.string() }),
    created_at: z.iso.datetime(),
  }),
);

export interface ParseGitHubSnapshotInput {
  repository: unknown;
  events: unknown | null;
  candidate: Candidate;
  observedAt: string;
  repositoryRawRef: RawArtifactRef;
  eventsRawRef: RawArtifactRef | null;
}

function evidence(
  sourceId: string,
  field: string,
  value: unknown,
  evidenceUrl: string,
  observedAt: string,
  rawRef: RawArtifactRef,
): Evidence {
  return {
    id: `${sourceId}:${field}:${rawRef.sha256.slice(0, 12)}`,
    sourceId,
    sourceTier: "S",
    independenceGroup: "github-public-data",
    evidenceUrl,
    observedAt,
    field,
    value,
    rawObjectRef: rawRef.objectRef,
  };
}

function isHuman(login: string): boolean {
  return !/\[bot\]$/i.test(login);
}

function eventFeatures(eventsInput: unknown | null, observedAt: string) {
  const parsed = GitHubEventResponseSchema.safeParse(eventsInput);
  const events = parsed.success ? parsed.data : [];
  const end = Date.parse(observedAt);
  const start7d = end - 7 * 24 * 60 * 60 * 1000;
  const start30d = end - 30 * 24 * 60 * 60 * 1000;
  const events30d = events.filter((event) => {
    const eventAt = Date.parse(event.created_at);
    return eventAt >= start30d && eventAt <= end && isHuman(event.actor.login);
  });
  const events7d = events30d.filter(
    (event) => Date.parse(event.created_at) >= start7d,
  );

  return {
    activeDays7d: new Set(
      events7d.map((event) => event.created_at.slice(0, 10)),
    ).size,
    activeDays30d: new Set(
      events30d.map((event) => event.created_at.slice(0, 10)),
    ).size,
    humanActors30d: new Set(
      events30d.map((event) => event.actor.login.toLowerCase()),
    ).size,
    pushes30d: events30d.filter((event) => event.type === "PushEvent").length,
    pullRequests30d: events30d.filter(
      (event) => event.type === "PullRequestEvent",
    ).length,
    issues30d: events30d.filter((event) => event.type === "IssuesEvent").length,
    releases30d: events30d.filter((event) => event.type === "ReleaseEvent")
      .length,
  };
}

export function parseGitHubSnapshot(
  input: ParseGitHubSnapshotInput,
): RepositorySnapshot {
  const repository = GitHubRepositoryResponseSchema.parse(input.repository);
  const features = eventFeatures(input.events, input.observedAt);
  const missingFields = ["scorecard"];
  if (input.events === null || input.eventsRawRef === null)
    missingFields.push("events");
  const repositoryEvidence = evidence(
    "github-rest",
    "repository",
    {
      nodeId: repository.node_id,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      archived: repository.archived,
      licenseSpdx: repository.license?.spdx_id ?? null,
    },
    repository.html_url,
    input.observedAt,
    input.repositoryRawRef,
  );
  const eventEvidence =
    input.eventsRawRef === null
      ? []
      : [
          evidence(
            "github-rest",
            "events30d",
            features,
            `${repository.html_url}/activity`,
            input.observedAt,
            input.eventsRawRef,
          ),
        ];

  const licenseSpdx = repository.license?.spdx_id;
  return RepositorySnapshotSchema.parse({
    nodeId: repository.node_id,
    fullName: repository.full_name.toLowerCase(),
    url: repository.html_url,
    ownerLogin: repository.owner.login,
    ownerType: repository.owner.type,
    description: repository.description,
    homepage: repository.homepage,
    language: repository.language,
    topics: repository.topics,
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at,
    defaultBranch: repository.default_branch,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    watchers: repository.subscribers_count,
    openIssues: repository.open_issues_count,
    archived: repository.archived,
    licenseSpdx:
      licenseSpdx === undefined || licenseSpdx === "NOASSERTION"
        ? null
        : licenseSpdx,
    direction: input.candidate.primaryDirection,
    eventFeatures: features,
    scorecard: null,
    candidateSignals: input.candidate.signals,
    evidence: [repositoryEvidence, ...eventEvidence],
    missingFields,
  });
}

export class InvalidCandidateError extends Error {
  constructor(readonly fullName: string) {
    super(`GitHub repository not found: ${fullName}`);
    this.name = "InvalidCandidateError";
  }
}

export class GitHubEnricher {
  async enrich(
    fullName: string,
    context: EnrichmentContext & { candidate: Candidate },
  ): Promise<RepositorySnapshot> {
    if (context.candidate.fullName !== fullName)
      throw new Error("candidate identity mismatch");
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(context.githubToken === null
        ? {}
        : { Authorization: `Bearer ${context.githubToken}` }),
    };
    const repositoryUrl = `https://api.github.com/repos/${fullName}`;
    let repositoryArtifact: HttpArtifact;
    try {
      repositoryArtifact = await requestArtifact({
        sourceId: "github-rest",
        url: repositoryUrl,
        observedAt: context.observedAt,
        rawStore: context.rawStore,
        fetchImpl: context.fetchImpl,
        headers,
      });
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404) {
        throw new InvalidCandidateError(fullName);
      }
      throw error;
    }

    const eventsUrl = `${repositoryUrl}/events?per_page=100`;
    let events: unknown | null = null;
    let eventsRawRef: RawArtifactRef | null = null;
    try {
      const eventsArtifact = await requestArtifact({
        sourceId: "github-rest",
        url: eventsUrl,
        observedAt: context.observedAt,
        rawStore: context.rawStore,
        fetchImpl: context.fetchImpl,
        headers,
      });
      events = JSON.parse(eventsArtifact.text);
      eventsRawRef = eventsArtifact.rawRef;
    } catch {
      events = null;
    }

    return parseGitHubSnapshot({
      repository: JSON.parse(repositoryArtifact.text),
      events,
      candidate: context.candidate,
      observedAt: context.observedAt,
      repositoryRawRef: repositoryArtifact.rawRef,
      eventsRawRef,
    });
  }
}
