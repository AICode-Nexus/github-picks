import { describe, expect, it } from "vitest";
import { DIMENSIONS, M0ObservationSchema } from "../src/schema.js";

describe("M0ObservationSchema", () => {
  it("accepts a complete auditable observation", () => {
    const capabilities = Object.fromEntries(
      DIMENSIONS.map((dimension) => [
        dimension,
        {
          score: 2,
          evidenceUrl: "https://example.com/evidence",
          note: "页面直接提供该能力，并能定位到公开证据。",
        },
      ]),
    );

    expect(
      M0ObservationSchema.parse({
        date: "2026-08-03",
        product: "github-trending",
        directions: ["ai-agent"],
        repositories: ["openai/codex"],
        capabilities,
      }),
    ).toBeTruthy();
  });

  it("rejects evidence without a URL", () => {
    expect(() =>
      M0ObservationSchema.parse({
        date: "2026-08-03",
        product: "github-trending",
        directions: ["ai-agent"],
        repositories: ["openai/codex"],
        capabilities: {},
      }),
    ).toThrow();
  });
});
