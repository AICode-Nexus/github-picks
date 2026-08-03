import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type RawArtifactRef, RawArtifactRefSchema } from "@github-picks/core";

export interface RawArtifactInput {
  sourceId: string;
  url: string;
  observedAt: string;
  contentType: string;
  body: Uint8Array;
}

export interface RawStore {
  put(input: RawArtifactInput): Promise<RawArtifactRef>;
}

async function writeOnce(
  path: string,
  contents: Uint8Array | string,
): Promise<void> {
  try {
    await writeFile(path, contents, { flag: "wx" });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "EEXIST"
    )
      throw error;
  }
}

export class FileRawStore implements RawStore {
  constructor(private readonly rootDirectory: string) {}

  async put(input: RawArtifactInput): Promise<RawArtifactRef> {
    if (!/^[a-z0-9-]+$/.test(input.sourceId)) {
      throw new Error(`invalid source ID: ${input.sourceId}`);
    }

    const sha256 = createHash("sha256").update(input.body).digest("hex");
    const directory = join(this.rootDirectory, input.sourceId);
    const objectPath = join(directory, `${sha256}.bin`);
    const metadataPath = join(directory, `${sha256}.json`);
    await mkdir(directory, { recursive: true });
    await writeOnce(objectPath, input.body);
    await writeOnce(
      metadataPath,
      `${JSON.stringify(
        {
          sha256,
          sourceId: input.sourceId,
          url: input.url,
          observedAt: input.observedAt,
          contentType: input.contentType,
        },
        null,
        2,
      )}\n`,
    );

    return RawArtifactRefSchema.parse({
      objectRef: `sha256:${sha256}`,
      sha256,
      sourceId: input.sourceId,
      path: objectPath,
      observedAt: input.observedAt,
      url: input.url,
    });
  }
}
