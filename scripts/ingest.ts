import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import exifr from "exifr";
import { loadConfig, stagingDir } from "./lib/config.ts";
import { kindFor, readItems } from "./lib/albums.ts";
import { writeItems } from "./lib/metadata.ts";
import type { Item } from "./lib/albums.ts";
import { deriveId } from "./lib/ids.ts";
import { parseSlug } from "./lib/slug.ts";
import { applyOrientation, readDimensions } from "./lib/dimensions.ts";
import { probeMedia } from "./lib/probe.ts";
import { formatBytes, progress } from "./lib/progress.ts";
import { openBucket, upload } from "./lib/r2.ts";

const ALBUMS = "albums";

interface Exif {
  Orientation?: number;
  DateTimeOriginal?: string;
}

/**
 * EXIF records wall-clock time with no zone — `2011:09:08 10:55:35` — so it is
 * kept exactly as the camera wrote it, reshaped into the form the rest of the
 * code compares as a plain string.
 *
 * Letting exifr revive it into a `Date` would resolve those digits against
 * whichever machine happened to run the ingest, and the same photograph would
 * get a different answer on a laptop in another country.
 */
function takenAt(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m || m[1] === "0000") return undefined;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

async function describeFile(slug: string, dir: string, file: string): Promise<Item> {
  const path = join(dir, file);
  const kind = kindFor(file);
  if (!kind) throw new Error(`Unsupported file type: ${path}`);

  const item: Item = { id: deriveId(slug, file), file, kind };

  if (kind !== "photo") {
    const probe = probeMedia(path);
    if (probe?.width !== undefined) item.width = probe.width;
    if (probe?.height !== undefined) item.height = probe.height;
    return item;
  }

  // Both flags are load-bearing. `reviveValues` off keeps DateTimeOriginal the
  // raw wall-clock string; `translateValues` off keeps Orientation the number
  // applyOrientation expects, rather than the prose "Rotate 90 CW".
  const exif = ((await exifr
    .parse(path, {
      pick: ["Orientation", "DateTimeOriginal"],
      reviveValues: false,
      translateValues: false,
    })
    .catch(() => null)) ?? {}) as Exif;
  const dims = readDimensions(path);
  if (dims) {
    const oriented = applyOrientation(dims, exif.Orientation);
    item.width = oriented.width;
    item.height = oriented.height;
  }

  const taken = takenAt(exif.DateTimeOriginal);
  if (taken) item.taken = taken;

  return item;
}

function ensureAlbumMeta(slug: string, albumDir: string, items: Item[]): void {
  const path = join(albumDir, "album.md");
  if (existsSync(path)) return;

  const parsed = parseSlug(slug);

  writeFileSync(
    path,
    `---
title: ${parsed.title || slug}${items[0] ? `\ncover: ${items[0].file}` : ""}
# Optional: date, date_end, location. Anything below this block is the
# album's description. See docs/album-metadata.md
---

`,
  );
  console.log(`  created ${path} — yours to edit from here on`);
}

/**
 * Existing entries win: their id is a permalink and their prose may be hand-written.
 *
 * Ingest never removes an item. Staging is transient — you only stage the files you
 * are adding — so anything already in photos.json survives a run that did not see it.
 */
function merge(existing: Item[], scanned: Item[]): Item[] {
  const byFile = new Map(existing.map((item) => [item.file, item]));
  const updated = scanned.map((fresh) => {
    const prior = byFile.get(fresh.file);
    if (!prior) return fresh;
    // What the file says about itself is ingest's to own, so a fresh read wins —
    // but only when it read something. An unreadable file keeps what was there
    // rather than erasing it.
    return {
      ...fresh,
      ...prior,
      width: fresh.width ?? prior.width,
      height: fresh.height ?? prior.height,
      taken: fresh.taken ?? prior.taken,
    };
  });

  const staged = new Set(scanned.map((item) => item.file));
  return [...existing.filter((item) => !staged.has(item.file)), ...updated];
}

function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) =>
    a.file.localeCompare(b.file, undefined, { numeric: true }),
  );
}

async function ingestAlbum(
  slug: string,
  noUpload: boolean,
  prefix: string,
  staging: string,
): Promise<void> {
  const stageDir = join(staging, slug);
  const files = readdirSync(stageDir)
    .filter((f) => !f.startsWith("."))
    .filter((f) => kindFor(f) !== null)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    console.log(`${slug}: no media files, skipping`);
    return;
  }

  console.log(`${slug}: ${files.length} file(s)`);
  const albumDir = join(ALBUMS, slug);
  mkdirSync(albumDir, { recursive: true });

  const reading = progress("reading", files.length);
  const scanned: Item[] = [];
  for (const file of files) {
    reading.step(file);
    scanned.push(await describeFile(slug, stageDir, file));
  }
  reading.done();

  const items = sortItems(merge(readItems(albumDir), scanned));
  ensureAlbumMeta(slug, albumDir, items);
  writeItems(albumDir, items);

  if (noUpload) {
    console.log(`  metadata written; skipped upload (--no-upload)`);
    return;
  }

  const bucket = openBucket();
  const uploading = progress("uploading", items.length);
  let uploaded = 0;
  let skipped = 0;
  for (const item of items) {
    const key = `${prefix}/${slug}/${item.file}`;
    const path = join(stageDir, item.file);
    uploading.step(item.file, formatBytes(statSync(path).size));
    const result = await upload(bucket, key, path);
    if (result === "uploaded") uploaded += 1;
    else skipped += 1;
  }
  uploading.done();
  console.log(`  uploaded ${uploaded}, already present ${skipped}`);
}

const ALBUM_FLAG = "--album";

/**
 * Album names, however they were given: bare, `--album name`, or `--album=name`.
 * The bare form came first and still works — the flag exists because it reads
 * better in a command someone else has to understand.
 */
function namedAlbums(args: string[]): string[] {
  const named: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) continue;

    if (arg === ALBUM_FLAG) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${ALBUM_FLAG} needs an album folder name after it`);
      }
      named.push(value);
      i += 1;
    } else if (arg.startsWith(`${ALBUM_FLAG}=`)) {
      named.push(arg.slice(ALBUM_FLAG.length + 1));
    } else if (!arg.startsWith("--")) {
      named.push(arg);
    }
  }

  return named;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const staging = stagingDir();
  const args = process.argv.slice(2);
  const noUpload = args.includes("--no-upload");
  const named = namedAlbums(args);

  if (!existsSync(staging)) {
    console.log(`No ${staging}/ directory. Put an album folder there and re-run.`);
    return;
  }

  const staged = readdirSync(staging, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  // Without this a mistyped name reaches readdirSync and dies as a bare ENOENT.
  const missing = named.filter((slug) => !staged.includes(slug));
  if (missing.length > 0) {
    console.error(`Not staged in ${staging}/: ${missing.join(", ")}`);
    if (staged.length > 0) console.error(`Staged: ${staged.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const slugs = named.length > 0 ? named : staged;

  if (slugs.length === 0) {
    console.log(`No album folders in ${staging}/.`);
    return;
  }

  for (const slug of slugs) {
    await ingestAlbum(slug, noUpload, cfg.media.prefix, staging);
  }
}

await main();
