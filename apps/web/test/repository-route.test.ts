import { describe, expect, it } from "vitest";
import {
  generateMetadata,
  generateStaticParams,
} from "../src/app/repositories/[owner]/[repo]/page";

describe("repository static routes", () => {
  it("generates detail pages for repositories found only in published history", async () => {
    await expect(generateStaticParams()).resolves.toContainEqual({
      owner: "lyogavin",
      repo: "airllm",
    });
  });

  it("uses the newest historical dossier for repository metadata", async () => {
    await expect(
      generateMetadata({
        params: Promise.resolve({ owner: "lyogavin", repo: "airllm" }),
      }),
    ).resolves.toMatchObject({ title: "lyogavin/airllm" });
  });
});
