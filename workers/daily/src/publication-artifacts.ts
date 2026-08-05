import { type DailyReport, SourceHealthSchema } from "@github-picks/core";
import { z } from "zod";

export const DailyManifestSchema = z
  .object({
    version: z.literal(1),
    date: z.iso.date(),
    mode: z.enum(["live", "replay"]),
    generatedAt: z.iso.datetime(),
    scoreVersion: z.string().regex(/^v\d+\.\d+\.\d+$/),
    analysisVersion: z
      .string()
      .regex(/^v\d+\.\d+\.\d+$/)
      .optional(),
    configHash: z.string().regex(/^[a-f0-9]{64}$/),
    counts: z
      .object({
        discovered: z.int().nonnegative(),
        enriched: z.int().nonnegative(),
        published: z.int().nonnegative(),
      })
      .strict(),
    sourceHealth: z.array(SourceHealthSchema),
    rawObjectRefs: z.array(z.string().min(8)),
    repositories: z.array(z.string().regex(/^[^/\s]+\/[^/\s]+$/)),
  })
  .strict();

export type DailyManifest = z.infer<typeof DailyManifestSchema>;

export function buildDailyManifest(report: DailyReport): DailyManifest {
  const rawObjectRefs = [
    ...report.repositories.flatMap((item) =>
      item.snapshot.evidence.flatMap((evidence) =>
        evidence.rawObjectRef === null ? [] : [evidence.rawObjectRef],
      ),
    ),
    ...report.repositories.flatMap((item) =>
      item.snapshot.candidateSignals.flatMap((signal) =>
        signal.rawObjectRef === null ? [] : [signal.rawObjectRef],
      ),
    ),
  ].filter((value, index, values) => values.indexOf(value) === index);

  return DailyManifestSchema.parse({
    version: 1,
    date: report.date,
    mode: report.mode,
    generatedAt: report.generatedAt,
    scoreVersion: report.scoreVersion,
    analysisVersion: report.analysisVersion,
    configHash: report.configHash,
    counts: report.counts,
    sourceHealth: report.sourceHealth,
    rawObjectRefs,
    repositories: report.repositories.map((item) => item.snapshot.fullName),
  });
}
