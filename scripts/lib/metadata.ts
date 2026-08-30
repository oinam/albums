import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { AlbumMeta, Item } from "./albums.ts";
import { readItems } from "./albums.ts";

/**
 * The one place that knows what metadata looks like on disk. Ingest and the local
 * editor both write through here, so a hand edit and a form edit produce the same
 * bytes and neither churns the other's output.
 */

const ALBUMS = "albums";

/**
 * What actually goes in `photos.json`: identity, then anything you wrote, then
 * what the file told us. `kind` is left out — it is the extension, and storing it
 * only gives a second place for it to be wrong.
 */
export function forFile(item: Item): Record<string, unknown> {
  const ordered: Record<string, unknown> = { id: item.id, file: item.file };
  const keys = [
    "title",
    "date",
    "description",
    "alt",
    "highlight",
    "width",
    "height",
  ] as const;
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined) ordered[key] = value;
  }
  return ordered;
}

export function writeItems(albumDir: string, items: Item[]): void {
  writeFileSync(
    join(albumDir, "photos.json"),
    `${JSON.stringify({ items: items.map(forFile) }, null, 2)}\n`,
  );
}

/** An empty field means "remove it", not "store an empty string". */
function pruned(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value === "" || value === false ? undefined : value;
  }
  return out;
}

export function updateItem(slug: string, id: string, patch: Partial<Item>): void {
  const albumDir = join(ALBUMS, slug);
  const items = readItems(albumDir);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) throw new Error(`No item ${id} in ${slug}`);

  const current = items[index];
  if (!current) throw new Error(`No item ${id} in ${slug}`);
  items[index] = { ...current, ...pruned(patch) };
  writeItems(albumDir, items);
}

/** Drops one item from an album and returns the file it pointed at. */
export function removeItem(slug: string, id: string): string {
  const albumDir = join(ALBUMS, slug);
  const items = readItems(albumDir);
  const gone = items.find((item) => item.id === id);
  if (!gone) throw new Error(`No item ${id} in ${slug}`);
  writeItems(
    albumDir,
    items.filter((item) => item.id !== id),
  );
  return gone.file;
}

const META_ORDER = ["title", "date", "date_end", "location", "cover"] as const;

/**
 * Frontmatter is built by hand rather than round-tripped through a YAML writer.
 * Unquoted `2026-06-16` parses into a Date and comes back out as
 * `2026-06-16T00:00:00.000Z`; every one of these fields is a string we control,
 * and a JSON scalar is always valid YAML, so quoting each value keeps dates,
 * colons and leading digits intact.
 *
 * Comments in the frontmatter do not survive an edit — the file is rewritten, not
 * patched.
 */
export function albumMarkdown(meta: AlbumMeta, description: string): string {
  const front = META_ORDER.filter((key) => meta[key] !== undefined && meta[key] !== "")
    .map((key) => `${key}: ${JSON.stringify(meta[key])}`)
    .join("\n");

  const body = description.trim();
  return body ? `---\n${front}\n---\n\n${body}\n` : `---\n${front}\n---\n`;
}

export function updateAlbum(slug: string, meta: AlbumMeta, description: string): void {
  writeFileSync(join(ALBUMS, slug, "album.md"), albumMarkdown(meta, description));
}

/** The album's description as written, not as rendered. */
export function albumSource(slug: string): string {
  const path = join(ALBUMS, slug, "album.md");
  return matter(readFileSync(path, "utf8")).content.trim();
}
