import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type RawArtifactRef, RawArtifactRefSchema } from "@github-picks/core";
import { z } from "zod";

const CacheIndexSchema = z
  .object({
    version: z.literal(1),
    sourceId: z.string().regex(/^[a-z0-9-]+$/),
    url: z.url(),
    etag: z.string().min(1),
    contentType: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    objectRef: z.string().min(8),
    observedAt: z.iso.datetime(),
  })
  .strict();

export interface ConditionalArtifact {
  etag: string;
  contentType: string;
  body: Uint8Array;
  rawRef: RawArtifactRef;
}

export interface ConditionalArtifactInput {
  sourceId: string;
  url: string;
  etag: string;
  contentType: string;
  rawRef: RawArtifactRef;
}

export interface ConditionalArtifactCache {
  read(sourceId: string, url: string): Promise<ConditionalArtifact | null>;
  write(input: ConditionalArtifactInput): Promise<void>;
  remove(sourceId: string, url: string): Promise<void>;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export class FileConditionalArtifactCache implements ConditionalArtifactCache {
  constructor(private readonly rootDirectory: string) {}

  private indexPath(sourceId: string, url: string): string {
    if (!/^[a-z0-9-]+$/.test(sourceId)) {
      throw new Error(`invalid source ID: ${sourceId}`);
    }
    const key = createHash("sha256").update(url).digest("hex");
    return join(this.rootDirectory, ".http-cache", sourceId, `${key}.json`);
  }

  async read(
    sourceId: string,
    url: string,
  ): Promise<ConditionalArtifact | null> {
    const path = this.indexPath(sourceId, url);
    let contents: string;
    try {
      contents = await readFile(path, "utf8");
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }

    try {
      const index = CacheIndexSchema.parse(JSON.parse(contents));
      if (index.sourceId !== sourceId || index.url !== url) {
        throw new Error("conditional cache key mismatch");
      }
      const objectPath = join(
        this.rootDirectory,
        sourceId,
        `${index.sha256}.bin`,
      );
      const body = new Uint8Array(await readFile(objectPath));
      const rawRef = RawArtifactRefSchema.parse({
        objectRef: index.objectRef,
        sha256: index.sha256,
        sourceId,
        path: objectPath,
        observedAt: index.observedAt,
        url,
      });
      return {
        etag: index.etag,
        contentType: index.contentType,
        body,
        rawRef,
      };
    } catch {
      await unlink(path).catch(() => undefined);
      return null;
    }
  }

  async write(input: ConditionalArtifactInput): Promise<void> {
    if (
      input.rawRef.sourceId !== input.sourceId ||
      input.rawRef.url !== input.url
    ) {
      throw new Error("conditional cache raw reference mismatch");
    }
    const path = this.indexPath(input.sourceId, input.url);
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(
          {
            version: 1,
            sourceId: input.sourceId,
            url: input.url,
            etag: input.etag,
            contentType: input.contentType,
            sha256: input.rawRef.sha256,
            objectRef: input.rawRef.objectRef,
            observedAt: input.rawRef.observedAt,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      await rename(temporaryPath, path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async remove(sourceId: string, url: string): Promise<void> {
    await unlink(this.indexPath(sourceId, url)).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
  }
}
