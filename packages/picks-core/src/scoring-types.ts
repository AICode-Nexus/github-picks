import type { z } from "zod";
import type { FeatureScoreSchema, RiskFindingSchema } from "./schema.js";

export type FeatureScore = z.infer<typeof FeatureScoreSchema>;
export type RiskFinding = z.infer<typeof RiskFindingSchema>;
