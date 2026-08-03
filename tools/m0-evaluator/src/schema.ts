import { z } from "zod";

export const DIMENSIONS = [
  "multi_source_evidence",
  "cohort_comparability",
  "activity_and_organization",
  "anti_gaming_and_replay",
  "chinese_decision_analysis",
  "obsidian_ownership",
  "restricted_agent",
] as const;

export const DimensionSchema = z.enum(DIMENSIONS);
export const CapabilityEvidenceSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  evidenceUrl: z.url(),
  note: z.string().min(10),
});

export const M0ObservationSchema = z.object({
  date: z.iso.date(),
  product: z.string().min(2),
  directions: z.array(z.string().min(2)).min(1),
  repositories: z.array(z.string().regex(/^[^/]+\/[^/]+$/)).min(1),
  capabilities: z.record(DimensionSchema, CapabilityEvidenceSchema),
});

export const M0ScopeSchema = z.object({
  timezone: z.literal("Asia/Shanghai"),
  minimumDays: z.literal(7),
  minimumDirections: z.literal(5),
  minimumRepositories: z.literal(30),
  products: z
    .array(z.object({ id: z.string(), name: z.string(), url: z.url() }))
    .min(8),
  directions: z.array(z.object({ id: z.string(), name: z.string() })).min(5),
  repositories: z
    .array(
      z.object({
        slug: z.string().regex(/^[^/]+\/[^/]+$/),
        direction: z.string(),
      }),
    )
    .min(30),
  requiredDimensions: z.array(DimensionSchema).length(DIMENSIONS.length),
  capabilityThreshold: z.literal(1.5),
  thinIntegrationMinimum: z.literal(5),
  buildGapMinimum: z.literal(5),
});

export const M0DecisionSchema = z.enum([
  "USE_EXISTING",
  "THIN_INTEGRATION",
  "BUILD",
  "INSUFFICIENT_EVIDENCE",
]);

export type Dimension = z.infer<typeof DimensionSchema>;
export type M0Observation = z.infer<typeof M0ObservationSchema>;
export type M0Scope = z.infer<typeof M0ScopeSchema>;
export type M0Decision = z.infer<typeof M0DecisionSchema>;
