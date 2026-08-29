import { createReadStream } from "node:fs";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireEnv } from "./config.ts";
import { contentType } from "./mime.ts";

export interface Bucket {
  client: S3Client;
  name: string;
}

/**
 * A bucket created under a jurisdiction is reachable only through that
 * jurisdiction's endpoint — `<account>.eu.r2.cloudflarestorage.com` rather than
 * `<account>.r2.cloudflarestorage.com`. A location hint does not change this;
 * only a jurisdiction does.
 *
 * `R2_JURISDICTION` accepts either the short code (`eu`) or the whole endpoint
 * URL, because the whole URL is what the dashboard puts in front of you.
 */
function endpointFor(account: string): string {
  const configured = process.env.R2_JURISDICTION?.trim();
  if (!configured) return `https://${account}.r2.cloudflarestorage.com`;
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
  return `https://${account}.${configured}.r2.cloudflarestorage.com`;
}

export function openBucket(): Bucket {
  const account = requireEnv("R2_ACCOUNT_ID");
  return {
    name: requireEnv("R2_BUCKET"),
    client: new S3Client({
      region: "auto",
      endpoint: endpointFor(account),
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    }),
  };
}

async function sizeOf(bucket: Bucket, key: string): Promise<number | null> {
  try {
    const head = await bucket.client.send(
      new HeadObjectCommand({ Bucket: bucket.name, Key: key }),
    );
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}

/** Uploads unless an object of the same size is already there. */
export async function upload(
  bucket: Bucket,
  key: string,
  path: string,
  bytes: number,
): Promise<"uploaded" | "skipped"> {
  if ((await sizeOf(bucket, key)) === bytes) return "skipped";

  await bucket.client.send(
    new PutObjectCommand({
      Bucket: bucket.name,
      Key: key,
      Body: createReadStream(path),
      ContentLength: bytes,
      ContentType: contentType(key),
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return "uploaded";
}
