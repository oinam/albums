import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { loadConfig } from "./lib/config.ts";
import { originalUrl, thumbUrl } from "./lib/media.ts";
import { openBucket } from "./lib/r2.ts";

const PROBE_KEY = ".albums-doctor-probe";
const PROBE_IMAGE_KEY = ".albums-doctor-probe.png";
const REQUIRED = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

let failures = 0;

function pass(label: string, detail = ""): void {
  console.log(`  ok    ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, detail: string): void {
  failures += 1;
  console.log(`  FAIL  ${label}\n        ${detail}`);
}

function skip(label: string, detail: string): void {
  console.log(`  skip  ${label} — ${detail}`);
}

function checkEnv(): boolean {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    fail(
      "credentials",
      `missing ${missing.join(", ")}. Copy mise.local.toml.example to mise.local.toml, fill it in, run \`mise trust\`.`,
    );
    return false;
  }
  pass("credentials", `${REQUIRED.length} values present`);
  return true;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  console.log(`\nChecking ${cfg.site.host} against R2 and ${cfg.media.host}\n`);

  if (!checkEnv()) process.exit(1);

  const bucket = openBucket();
  const endpoint = await bucket.client.config.endpoint?.();
  pass("endpoint", `${endpoint?.hostname ?? "unknown"} (bucket ${bucket.name})`);

  let firstImageKey: string | undefined;

  try {
    const listed = await bucket.client.send(
      new ListObjectsV2Command({ Bucket: bucket.name, MaxKeys: 200 }),
    );
    const keys = (listed.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => !!k);
    pass(
      "read",
      keys.length === 0 ? "bucket is empty" : `${keys.length} object(s) visible`,
    );
    firstImageKey = keys.find((k) => /\.(jpe?g|png|webp|gif)$/i.test(k));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(
      "read",
      /NoSuchBucket/i.test(message)
        ? `bucket "${bucket.name}" not found on this endpoint. If it was created under a jurisdiction, set R2_JURISDICTION.`
        : message,
    );
  }

  try {
    await bucket.client.send(
      new PutObjectCommand({
        Bucket: bucket.name,
        Key: PROBE_KEY,
        Body: "albums.oinam.com connectivity probe",
        ContentType: "text/plain",
      }),
    );
    await bucket.client.send(
      new DeleteObjectCommand({ Bucket: bucket.name, Key: PROBE_KEY }),
    );
    pass("write", "put and delete both accepted");
  } catch (error) {
    fail("write", error instanceof Error ? error.message : String(error));
  }

  // No image in the bucket yet? Put a throwaway one there, test against it, remove it.
  let temporaryKey: string | undefined;
  if (!firstImageKey) {
    try {
      const png = await sharp({
        create: { width: 64, height: 48, channels: 3, background: "#888888" },
      })
        .png()
        .toBuffer();
      await bucket.client.send(
        new PutObjectCommand({
          Bucket: bucket.name,
          Key: PROBE_IMAGE_KEY,
          Body: png,
          ContentType: "image/png",
        }),
      );
      firstImageKey = PROBE_IMAGE_KEY;
      temporaryKey = PROBE_IMAGE_KEY;
    } catch {
      skip(
        "public domain",
        "bucket is empty and the probe image could not be uploaded",
      );
    }
  }

  if (!firstImageKey) {
    skip("transformations", "needs an image in the bucket");
  } else {
    const parts = firstImageKey.split("/");
    const file = parts.pop() ?? "";
    const slug = parts.pop() ?? "";
    const prefixed = parts.length > 0 || slug !== "";

    const direct = prefixed
      ? originalUrl(cfg, slug, file)
      : `https://${cfg.media.host}/${file}`;
    const transformed = prefixed
      ? thumbUrl(cfg, slug, file, "wide")
      : `https://${cfg.media.host}/cdn-cgi/image/width=48,fit=scale-down,format=auto/${file}`;

    try {
      const res = await fetch(direct, { headers: { accept: "image/*" } });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.startsWith("image/")) {
        pass("public domain", `${res.status} ${type}`);
      } else {
        fail(
          "public domain",
          `${res.status} ${type || "no content-type"} — ${direct}\n        Attach ${cfg.media.host} to the bucket under R2 > Settings > Public access.`,
        );
      }
    } catch (error) {
      fail(
        "public domain",
        `${error instanceof Error ? error.message : String(error)} — ${direct}`,
      );
    }

    try {
      const res = await fetch(transformed, { headers: { accept: "image/*" } });
      const type = res.headers.get("content-type") ?? "";
      // cf-resized is only present when Cloudflare actually processed the image;
      // an unenabled zone quietly serves the source through instead.
      const resized = res.headers.get("cf-resized");
      if (res.ok && type.startsWith("image/") && resized) {
        pass("transformations", `${res.status} ${type} (${resized})`);
      } else if (res.ok && type.startsWith("image/")) {
        fail(
          "transformations",
          `served the source unprocessed (no cf-resized header) — ${transformed}\n        Enable Images > Transformations for the ${cfg.media.host} zone.`,
        );
      } else {
        fail(
          "transformations",
          `${res.status} ${type || "no content-type"} — ${transformed}\n        Enable Images > Transformations for the ${cfg.media.host} zone.`,
        );
      }
    } catch (error) {
      fail(
        "transformations",
        `${error instanceof Error ? error.message : String(error)} — ${transformed}`,
      );
    }
  }

  if (temporaryKey) {
    await bucket.client
      .send(new DeleteObjectCommand({ Bucket: bucket.name, Key: temporaryKey }))
      .catch(() => undefined);
  }

  console.log(
    failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

await main();
