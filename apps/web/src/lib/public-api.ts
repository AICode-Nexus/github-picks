import {
  CandidateSignalSchema,
  type DailyReport,
  DailyReportSchema,
  EvidenceSchema,
  RepositorySnapshotSchema,
  ScoredRepositorySchema,
} from "@github-picks/core/schema";
import { z } from "zod";

export const PublicEvidenceSchema = EvidenceSchema.omit({
  rawObjectRef: true,
});

export const PublicCandidateSignalSchema = CandidateSignalSchema.omit({
  rawObjectRef: true,
});

export const PublicRepositorySnapshotSchema = RepositorySnapshotSchema.extend({
  candidateSignals: z.array(PublicCandidateSignalSchema),
  evidence: z.array(PublicEvidenceSchema),
});

export const PublicScoredRepositorySchema = ScoredRepositorySchema.extend({
  snapshot: PublicRepositorySnapshotSchema,
});

export const PublicDailyReportSchema = DailyReportSchema.extend({
  mode: z.literal("live"),
  repositories: z.array(PublicScoredRepositorySchema),
});

export type PublicDailyReport = z.infer<typeof PublicDailyReportSchema>;

function omitRawObjectRef<T extends { rawObjectRef: unknown }>(
  value: T,
): Omit<T, "rawObjectRef"> {
  const { rawObjectRef: _rawObjectRef, ...publicValue } = value;
  return publicValue;
}

export function toPublicDailyReport(report: DailyReport): PublicDailyReport {
  const parsed = DailyReportSchema.parse(report);
  if (parsed.mode !== "live") {
    throw new Error("public API accepts only live DailyReport data");
  }

  const repositories = parsed.repositories.map((repository) => ({
    ...repository,
    snapshot: {
      ...repository.snapshot,
      candidateSignals:
        repository.snapshot.candidateSignals.map(omitRawObjectRef),
      evidence: repository.snapshot.evidence.map(omitRawObjectRef),
    },
  }));

  return PublicDailyReportSchema.parse({
    ...parsed,
    repositories,
  });
}

export function normalizePublicBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error("public base URL must be an absolute URL", {
      cause: error,
    });
  }

  const isLocalHttp = url.protocol === "http:" && url.hostname === "localhost";
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("public base URL must use HTTPS or localhost HTTP");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("public base URL must not contain credentials");
  }
  if (url.search !== "" || url.hash !== "") {
    throw new Error("public base URL must not contain a query or fragment");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}
