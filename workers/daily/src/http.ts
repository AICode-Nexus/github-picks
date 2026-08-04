import type { RawArtifactRef } from "@github-picks/core";
import type { ConditionalArtifactCache } from "./conditional-cache.js";
import type { RawStore } from "./raw-store.js";

const userAgent =
  "github-picks/0.1 (+https://github.com/AICode-Nexus/github-picks)";
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

export interface HttpArtifact {
  url: string;
  status: number;
  observedAt: string;
  contentType: string;
  body: Uint8Array;
  text: string;
  headers: Record<string, string>;
  rawRef: RawArtifactRef;
}

export interface RequestArtifactOptions {
  sourceId: string;
  url: string;
  observedAt: string;
  rawStore: RawStore;
  conditionalCache?: ConditionalArtifactCache | undefined;
  rateLimitFallbackMs?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
  headers?: Record<string, string> | undefined;
}

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly responseText: string,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
  }
}

function safeHeaders(headers: Headers): Record<string, string> {
  const allowed = [
    "content-type",
    "etag",
    "last-modified",
    "retry-after",
    "x-ratelimit-remaining",
  ];
  return Object.fromEntries(
    allowed.flatMap((name) => {
      const value = headers.get(name);
      return value === null ? [] : [[name, value]];
    }),
  );
}

function retryDelay(
  response: Response,
  attempt: number,
  rateLimitFallbackMs?: number,
): number {
  const retryAfterHeader = response.headers.get("retry-after");
  if (retryAfterHeader !== null) {
    const retryAfter = Number(retryAfterHeader);
    if (Number.isFinite(retryAfter) && retryAfter >= 0) {
      return Math.min(retryAfter * 1000, 60_000);
    }
  }
  if (response.status === 429 && rateLimitFallbackMs !== undefined) {
    return rateLimitFallbackMs;
  }
  return Math.min(250 * 2 ** attempt + Math.floor(Math.random() * 100), 2_000);
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function requestArtifact(
  options: RequestArtifactOptions,
): Promise<HttpArtifact> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cached =
    (await options.conditionalCache?.read(options.sourceId, options.url)) ??
    null;
  const requestHeaders = {
    Accept: "application/json, text/html;q=0.9",
    "User-Agent": userAgent,
    ...(cached === null ? {} : { "If-None-Match": cached.etag }),
    ...options.headers,
  };
  let response: Response | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetchImpl(options.url, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(15_000),
    });
    if (!retryableStatuses.has(response.status) || attempt === 2) break;
    await pause(retryDelay(response, attempt, options.rateLimitFallbackMs));
  }

  if (response === null) throw new Error("request did not produce a response");
  if (response.status === 304 && cached !== null) {
    return {
      url: options.url,
      status: 304,
      observedAt: options.observedAt,
      contentType: cached.contentType,
      body: cached.body,
      text: new TextDecoder().decode(cached.body),
      headers: safeHeaders(response.headers),
      rawRef: cached.rawRef,
    };
  }
  const body = new Uint8Array(await response.arrayBuffer());
  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const rawRef = await options.rawStore.put({
    sourceId: options.sourceId,
    url: options.url,
    observedAt: options.observedAt,
    contentType,
    body,
  });
  const artifact: HttpArtifact = {
    url: options.url,
    status: response.status,
    observedAt: options.observedAt,
    contentType,
    body,
    text: new TextDecoder().decode(body),
    headers: safeHeaders(response.headers),
    rawRef,
  };
  if (!response.ok) {
    throw new HttpStatusError(response.status, options.url, artifact.text);
  }
  const etag = response.headers.get("etag");
  if (
    response.status === 200 &&
    etag !== null &&
    options.conditionalCache !== undefined
  ) {
    await options.conditionalCache.write({
      sourceId: options.sourceId,
      url: options.url,
      etag,
      contentType,
      rawRef,
    });
  }
  return artifact;
}
