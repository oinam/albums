import { readdirSync } from "node:fs";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { openBucket } from "./lib/r2.ts";

/**
 * Deletes R2 prefixes that no album in `albums/` claims any more.
 *
 * Renaming an album folder moves its objects to a new prefix and leaves the old
 * one behind, so this is the broom for that. It refuses to touch a prefix holding
 * any file that exists nowhere else, which is what keeps a mistyped rename from
 * deleting the only copy of a picture.
 *
 * Dry run by default. `mise run prune -- --apply` does it.
 */

const APPLY = process.argv.includes("--apply");
const { client, name } = openBucket();

async function listAll(): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({ Bucket: name, ContinuationToken: token }),
    );
    for (const o of out.Contents ?? []) if (o.Key) keys.push(o.Key);
    token = out.IsTruncated === true ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

const live = new Set(
  readdirSync("albums", { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name),
);

const keys = await listAll();
const byPrefix = new Map<string, string[]>();
for (const k of keys) {
  const parts = k.split("/");
  if (parts[0] !== "albums" || parts.length < 3) continue;
  const slug = parts[1] ?? "";
  const list = byPrefix.get(slug) ?? [];
  list.push(parts.slice(2).join("/"));
  byPrefix.set(slug, list);
}

// Every filename that any live album still holds. A stale prefix is only safe to
// drop when nothing under it is the last copy of that file.
const liveFiles = new Set<string>();
for (const [slug, files] of byPrefix) {
  if (live.has(slug)) for (const f of files) liveFiles.add(f);
}

const stale: string[] = [];
console.log(`bucket ${name}: ${keys.length} objects, ${byPrefix.size} prefixes\n`);
for (const [slug, files] of [...byPrefix].sort()) {
  if (live.has(slug)) {
    console.log(`  keep    ${String(files.length).padStart(3)}  albums/${slug}/`);
    continue;
  }
  const orphaned = files.filter((f) => !liveFiles.has(f));
  if (orphaned.length > 0) {
    console.log(
      `  REFUSE  ${String(files.length).padStart(3)}  albums/${slug}/  — ${orphaned.length} file(s) exist nowhere else`,
    );
    for (const f of orphaned.slice(0, 3)) console.log(`            ${f}`);
    continue;
  }
  console.log(
    `  stale   ${String(files.length).padStart(3)}  albums/${slug}/  — every file also lives under a current album`,
  );
  stale.push(slug);
}

if (!APPLY) {
  console.log(
    `\ndry run. ${stale.length} prefix(es) would be deleted. Pass --apply to do it.`,
  );
} else {
  for (const slug of stale) {
    const objs = (byPrefix.get(slug) ?? []).map((f) => ({
      Key: `albums/${slug}/${f}`,
    }));
    for (let i = 0; i < objs.length; i += 1000) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: name,
          Delete: { Objects: objs.slice(i, i + 1000) },
        }),
      );
    }
    console.log(`  deleted albums/${slug}/ (${objs.length})`);
  }
}
