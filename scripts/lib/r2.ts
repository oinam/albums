import { createReadStream } from "node:fs";
import { extname } from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireEnv } from "./config.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
};

export function contentType(file: string): string {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}

export interface Bucket {
  client: S3Client;
  name: string;
}

export function openBucket(): Bucket {
  const account = requireEnv("R2_ACCOUNT_ID");
  return {
    name: requireEnv("R2_BUCKET"),
    client: new S3Client({
      region: "auto",
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
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
