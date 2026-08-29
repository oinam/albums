import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import exifr from "exifr";
import { loadConfig, stagingDir } from "./lib/config.ts";
import { kindFor, readItems } from "./lib/albums.ts";
import type { Item } from "./lib/albums.ts";
import { deriveId } from "./lib/ids.ts";
import { parseSlug } from "./lib/slug.ts";
import { applyOrientation, readDimensions } from "./lib/dimensions.ts";
import { probeMedia } from "./lib/probe.ts";
import { openBucket, upload } from "./lib/r2.ts";

const ALBUMS = "albums";

interface Exif {
  Make?: string;
  Model?: string;
  LensModel?: string;
  DateTimeOriginal?: Date;
  CreateDate?: Date;
  FNumber?: number;
  ExposureTime?: number;
  ISO?: number;
  FocalLength?: number;
  Orientation?: number;
}

function shutter(seconds: number): string {
  return seconds >= 1 ? `${seconds}s` : `1/${Math.round(1 / seconds)}s`;
}

function settingsFrom(exif: Exif): string | undefined {
  const parts: string[] = [];
  if (exif.FocalLength) parts.push(`${Math.round(exif.FocalLength)}mm`);
  if (exif.FNumber) parts.push(`f/${exif.FNumber}`);
  if (exif.ExposureTime) parts.push(shutter(exif.ExposureTime));
  if (exif.ISO) parts.push(`ISO ${exif.ISO}`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function cameraFrom(exif: Exif): string | undefined {
  const make = exif.Make?.trim();
  const model = exif.Model?.trim();
  if (!model) return make;
  return make && !model.startsWith(make) ? `${make} ${model}` : model;
}

async function describeFile(slug: string, dir: string, file: string): Promise<Item> {
  const path = join(dir, file);
  const kind = kindFor(file);
  if (!kind) throw new Error(`Unsupported file type: ${path}`);

  const item: Item = {
    id: deriveId(slug, file),
    file,
    kind,
    bytes: statSync(path).size,
  };

  if (kind !== "photo") {
    const probe = probeMedia(path);
    if (probe?.duration !== undefined) item.duration = probe.duration;
    if (probe?.width !== undefined) item.width = probe.width;
    if (probe?.height !== undefined) item.height = probe.height;
    return item;
  }

  const exif = ((await exifr.parse(path, true).catch(() => null)) ?? {}) as Exif;
  const dims = readDimensions(path);
  if (dims) {
    const oriented = applyOrientation(dims, exif.Orientation);
    item.width = oriented.width;
    item.height = oriented.height;
  }

  const taken = exif.DateTimeOriginal ?? exif.CreateDate;
  if (taken instanceof Date && !Number.isNaN(taken.getTime())) {
    item.taken = taken.toISOString().slice(0, 19);
  }
  const camera = cameraFrom(exif);
  if (camera) item.camera = camera;
  if (exif.LensModel) item.lens = exif.LensModel.trim();
  const settings = settingsFrom(exif);
  if (settings) item.settings = settings;

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
    return {
      ...fresh,
      ...prior,
      bytes: fresh.bytes,
      width: fresh.width,
      height: fresh.height,
    };
  });

  const staged = new Set(scanned.map((item) => item.file));
  return [...existing.filter((item) => !staged.has(item.file)), ...updated];
}

/**
 * What actually goes on disk: identity, then anything you wrote, then what the
 * file told us. `kind` is left out — it is the extension, and storing it only
 * gives a second place for it to be wrong.
 */
function forFile(item: Item): Record<string, unknown> {
  const ordered: Record<string, unknown> = { id: item.id, file: item.file };
  const keys = [
    "title",
    "description",
    "date",
    "location",
    "alt",
    "highlight",
    "width",
    "height",
    "bytes",
    "duration",
    "taken",
    "camera",
    "lens",
    "settings",
  ] as const;
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined) ordered[key] = value;
  }
  return ordered;
}

function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    if (a.taken && b.taken && a.taken !== b.taken)
      return a.taken.localeCompare(b.taken);
    return a.file.localeCompare(b.file, undefined, { numeric: true });
  });
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

  const scanned: Item[] = [];
  for (const file of files) scanned.push(await describeFile(slug, stageDir, file));

  const items = sortItems(merge(readItems(albumDir), scanned));
  ensureAlbumMeta(slug, albumDir, items);
  writeFileSync(
    join(albumDir, "photos.json"),
    `${JSON.stringify({ items: items.map(forFile) }, null, 2)}\n`,
  );

  if (noUpload) {
    console.log(`  metadata written; skipped upload (--no-upload)`);
    return;
  }

  const bucket = openBucket();
  let uploaded = 0;
  let skipped = 0;
  for (const item of items) {
    const key = `${prefix}/${slug}/${item.file}`;
    const result = await upload(
      bucket,
      key,
      join(stageDir, item.file),
      item.bytes ?? 0,
    );
    if (result === "uploaded") uploaded += 1;
    else skipped += 1;
  }
  console.log(`  uploaded ${uploaded}, already present ${skipped}`);
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const staging = stagingDir();
  const args = process.argv.slice(2);
  const noUpload = args.includes("--no-upload");
  const named = args.filter((a) => !a.startsWith("--"));

  if (!existsSync(staging)) {
    console.log(`No ${staging}/ directory. Put an album folder there and re-run.`);
    return;
  }

  const slugs =
    named.length > 0
      ? named
      : readdirSync(staging, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name);

  if (slugs.length === 0) {
    console.log(`No album folders in ${staging}/.`);
    return;
  }

  for (const slug of slugs) {
    await ingestAlbum(slug, noUpload, cfg.media.prefix, staging);
  }
}

await main();
