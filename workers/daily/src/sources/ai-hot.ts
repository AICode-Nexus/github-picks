import {
  type CandidateSignal,
  CandidateSignalSchema,
} from "@github-picks/core";
import { z } from "zod";
import type { DiscoveryAdapter, DiscoveryContext } from "../discovery.js";
import { HttpStatusError, requestArtifact } from "../http.js";
import { normalizeRepositoryId } from "../repository-id.js";

const sourceId = "ai-hot";
const endpoint = "https://aihot.virxact.com/api/v1/items";
const historyThresholdMs = 72 * 60 * 60 * 1000;

const AiHotItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    originalTitle: z.string().nullable(),
    summary: z.string().nullable(),
    source: z.object({ name: z.string().min(1) }).passthrough(),
    links: z
      .object({
        aihot: z.url(),
        original: z.url(),
      })
      .passthrough(),
    publishedAt: z.iso.datetime().nullable(),
    discoveredAt: z.iso.datetime(),
    category: z.string().nullable(),
    score: z.number().min(0).max(100).nullable(),
    selected: z.boolean(),
  })
  .passthrough();

const AiHotPageSchema = z
  .object({
    schemaVersion: z.literal(1),
    query: z
      .object({
        mode: z.enum(["selected", "all"]),
        category: z.string().nullable(),
        q: z.string().nullable(),
        window: z.enum(["24h", "7d"]),
        by: z.enum(["timeline", "published"]),
        ordering: z.string().min(1),
      })
      .passthrough(),
    items: z.array(AiHotItemSchema),
    page: z
      .object({
        count: z.int().nonnegative(),
        hasMore: z.boolean(),
        nextCursor: z.string().min(1).nullable(),
      })
      .passthrough(),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.page.hasMore && value.page.nextCursor === null) {
      context.addIssue({
        code: "custom",
        path: ["page", "nextCursor"],
        message: "AI Hot page with hasMore requires nextCursor",
      });
    }
  });

export type AiHotItem = z.infer<typeof AiHotItemSchema>;
export type AiHotPage = z.infer<typeof AiHotPageSchema>;

export interface CollectedAiHotItem {
  item: AiHotItem;
  rawObjectRef: string | null;
}

export function parseAiHotPage(input: unknown): AiHotPage {
  return AiHotPageSchema.parse(input);
}

function timelineTime(item: AiHotItem): number {
  const discoveredAt = Date.parse(item.discoveredAt);
  if (item.publishedAt === null) return discoveredAt;
  const publishedAt = Date.parse(item.publishedAt);
  return discoveredAt - publishedAt > historyThresholdMs
    ? publishedAt
    : discoveredAt;
}

function compareRepresentative(
  left: CollectedAiHotItem,
  right: CollectedAiHotItem,
): number {
  return (
    Number(right.item.selected) - Number(left.item.selected) ||
    (right.item.score ?? -1) - (left.item.score ?? -1) ||
    timelineTime(right.item) - timelineTime(left.item) ||
    left.item.id.localeCompare(right.item.id)
  );
}

function independenceGroupFor(sourceName: string): string {
  if (/hacker news/i.test(sourceName)) return "hacker-news-community";
  if (/github/i.test(sourceName)) return "github-public-data";
  return "ai-hot-aggregator";
}

export function buildAiHotSignals(
  items: CollectedAiHotItem[],
  observedAt: string,
): CandidateSignal[] {
  const representatives = new Map<string, CollectedAiHotItem>();
  for (const candidate of items) {
    const fullName = normalizeRepositoryId(candidate.item.links.original);
    if (fullName === null) continue;
    const current = representatives.get(fullName);
    if (
      current === undefined ||
      compareRepresentative(candidate, current) < 0
    ) {
      representatives.set(fullName, candidate);
    }
  }

  return [...representatives.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fullName, representative]) => {
      const { item, rawObjectRef } = representative;
      return CandidateSignalSchema.parse({
        fullName,
        sourceId,
        sourceTier: "C",
        independenceGroup: independenceGroupFor(item.source.name),
        direction: null,
        evidenceUrl: item.links.aihot,
        observedAt,
        rank: null,
        sourceScore: item.score,
        stale: false,
        summaryZh: item.summary,
        metrics: {
          starVelocity: null,
          trendingScore: null,
          discussionPoints: null,
          discussionComments: null,
        },
        provenance: {
          aggregatorItemId: item.id,
          aggregatorUrl: item.links.aihot,
          originalUrl: item.links.original,
          upstreamSourceName: item.source.name,
          selected: item.selected,
          publishedAt: item.publishedAt,
          discoveredAt: item.discoveredAt,
        },
        rawObjectRef,
      });
    });
}

function pageUrl(cursor: string | null): string {
  const parameters = new URLSearchParams({
    mode: "all",
    window: "24h",
    by: "timeline",
    q: "GitHub",
    limit: "100",
  });
  if (cursor !== null) parameters.set("cursor", cursor);
  return `${endpoint}?${parameters.toString()}`;
}

function problemCode(error: unknown): string | null {
  if (!(error instanceof HttpStatusError)) return null;
  try {
    const value: unknown = JSON.parse(error.responseText);
    if (
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      typeof value.code === "string"
    ) {
      return value.code;
    }
  } catch {
    return null;
  }
  return null;
}

export class AiHotAdapter implements DiscoveryAdapter {
  readonly sourceId = sourceId;

  async discover(context: DiscoveryContext): Promise<CandidateSignal[]> {
    let restarted = false;

    for (;;) {
      const collected: CollectedAiHotItem[] = [];
      const requestedUrls: string[] = [];
      const seenCursors = new Set<string>();
      let cursor: string | null = null;

      try {
        for (;;) {
          const url = pageUrl(cursor);
          requestedUrls.push(url);
          const artifact = await requestArtifact({
            sourceId,
            url,
            observedAt: context.observedAt,
            rawStore: context.rawStore,
            conditionalCache: context.conditionalCache,
            rateLimitFallbackMs: 60_000,
            fetchImpl: context.fetchImpl,
          });
          const page = parseAiHotPage(JSON.parse(artifact.text));
          collected.push(
            ...page.items.map((item) => ({
              item,
              rawObjectRef: artifact.rawRef.objectRef,
            })),
          );
          const signals = buildAiHotSignals(collected, context.observedAt);
          if (
            signals.length >= context.config.limits.candidateLimit ||
            !page.page.hasMore
          ) {
            return signals.slice(0, context.config.limits.candidateLimit);
          }
          const nextCursor = page.page.nextCursor;
          if (nextCursor === null || seenCursors.has(nextCursor)) {
            throw new Error("AI Hot returned a repeated or missing cursor");
          }
          seenCursors.add(nextCursor);
          cursor = nextCursor;
        }
      } catch (error) {
        if (problemCode(error) !== "invalid_cursor" || restarted) throw error;
        restarted = true;
        if (context.conditionalCache !== undefined) {
          for (const url of requestedUrls) {
            await context.conditionalCache.remove(sourceId, url);
          }
        }
      }
    }
  }
}
