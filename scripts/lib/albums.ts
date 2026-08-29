import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

export type MediaKind = "photo" | "video" | "audio";

export interface Item {
  id: string;
  file: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  bytes?: number;
  taken?: string;
  camera?: string;
  lens?: string;
  settings?: string;
  title?: string;
  alt?: string;
  caption?: string;
  keywords?: string[];
  generated?: boolean;
  edited?: boolean;
}

export interface AlbumMeta {
  title: string;
  date: string;
  date_end?: string;
  location?: string;
  cover?: string;
}

export interface Album {
  slug: string;
  meta: AlbumMeta;
  description: string;
  descriptionHtml: string;
  items: Item[];
}

const KIND_BY_EXT: Record<string, MediaKind> = {
  ".jpg": "photo",
  ".jpeg": "photo",
  ".png": "photo",
  ".gif": "photo",
  ".webp": "photo",
  ".heic": "photo",
  ".heif": "photo",
  ".mp4": "video",
  ".m4v": "video",
  ".mov": "video",
  ".webm": "video",
  ".mp3": "audio",
  ".m4a": "audio",
  ".aac": "audio",
  ".wav": "audio",
  ".flac": "audio",
  ".ogg": "audio",
};

export function kindFor(file: string): MediaKind | null {
  return KIND_BY_EXT[extname(file).toLowerCase()] ?? null;
}

export function readItems(albumDir: string): Item[] {
  const path = join(albumDir, "photos.json");
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { items?: Item[] };
  return parsed.items ?? [];
}

/** YAML parses an unquoted `1965-04-02` into a Date; normalise both shapes to a string. */
function isoDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return undefined;
}

function readAlbum(root: string, slug: string): Album | null {
  const dir = join(root, slug);
  const metaPath = join(dir, "album.md");
  if (!existsSync(metaPath)) return null;

  const parsed = matter(readFileSync(metaPath, "utf8"));
  const raw = parsed.data as Record<string, unknown>;
  const meta: Partial<AlbumMeta> = {
    ...(raw as Partial<AlbumMeta>),
    date: isoDate(raw.date),
    date_end: isoDate(raw.date_end),
  };
  if (!meta.title || !meta.date) {
    throw new Error(`${metaPath}: album.md needs at least a title and a date.`);
  }

  const description = parsed.content.trim();
  return {
    slug,
    meta: meta as AlbumMeta,
    description,
    descriptionHtml: description ? marked.parse(description, { async: false }) : "",
    items: readItems(dir),
  };
}

/** Albums newest first, by start date. */
export function loadAlbums(root = "albums"): Album[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readAlbum(root, entry.name))
    .filter((album): album is Album => album !== null)
    .sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parts(iso: string): { y: string; m: string; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return null;
  return { y: match[1], m: month, d: Number(match[3]) };
}

/** "Jun 14, 2005", or "Jun 14–17, 2005" / "Dec 30, 2005 – Jan 2, 2006" for a range. */
export function formatDate(date: string, dateEnd?: string): string {
  const start = parts(date);
  if (!start) return date;
  const single = `${start.m} ${start.d}, ${start.y}`;
  if (!dateEnd || dateEnd === date) return single;

  const end = parts(dateEnd);
  if (!end) return single;
  if (start.y !== end.y) return `${single} – ${end.m} ${end.d}, ${end.y}`;
  if (start.m !== end.m) return `${start.m} ${start.d} – ${end.m} ${end.d}, ${start.y}`;
  return `${start.m} ${start.d}–${end.d}, ${start.y}`;
}

export function year(album: Album): string {
  return album.meta.date.slice(0, 4);
}

export interface StreamEntry {
  album: Album;
  item: Item;
}

/**
 * Every item across every album, newest first. Capture time wins where EXIF
 * supplied one; otherwise the item inherits its album's start date, so
 * undated scans still land in the right stretch of the timeline.
 */
export function chronological(albums: Album[]): StreamEntry[] {
  return albums
    .flatMap((album) =>
      album.items.map((item) => ({
        album,
        item,
        at: item.taken ?? `${album.meta.date}T00:00:00`,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ album, item }) => ({ album, item }));
}
