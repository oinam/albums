import { createReadStream, statSync } from "node:fs";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { requireEnv } from "./config.ts";
import { contentType } from "./mime.ts";

/**
 * One day, and deliberately not `immutable`.
 *
 * These objects are addressed by path, not by a content hash, so the same URL can
 * legitimately hold different bytes tomorrow. A year-long immutable TTL meant a
 * replaced — or deleted — photo kept being served from the edge long after the
 * bucket had moved on, with nothing short of a manual purge to stop it. Egress is
 * free and a re-fetch costs a Class B operation, so a shorter TTL buys correctness
 * for almost nothing.
 */
const CACHE_CONTROL = "public, max-age=86400";

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

/**
 * Uploads unless an object of the same size is already there.
 *
 * The body stays a plain read stream. Attaching a listener to it to count bytes
 * puts it in flowing mode, and the SDK refuses to checksum a stream that is
 * already flowing — which is why progress is reported as elapsed time instead.
 */
export async function upload(
  bucket: Bucket,
  key: string,
  path: string,
): Promise<"uploaded" | "skipped"> {
  const bytes = statSync(path).size;
  if ((await sizeOf(bucket, key)) === bytes) return "skipped";

  await bucket.client.send(
    new PutObjectCommand({
      Bucket: bucket.name,
      Key: key,
      Body: createReadStream(path),
      ContentLength: bytes,
      ContentType: contentType(key),
      CacheControl: CACHE_CONTROL,
    }),
  );
  return "uploaded";
}

/** Removes one object. Deleting something already gone is not an error in S3. */
export async function remove(bucket: Bucket, key: string): Promise<void> {
  await bucket.client.send(new DeleteObjectCommand({ Bucket: bucket.name, Key: key }));
}
