import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { parseSlug } from "./slug.ts";

export type MediaKind = "photo" | "video" | "audio";
export type Orientation = "wide" | "tall";

export interface Item {
  // Written by ingest. Never edit `id` — it is the permalink.
  id: string;
  file: string;
  /** Derived from the extension at load; never stored. */
  kind: MediaKind;
  /** Structural: they choose the 4:3 or 3:4 crop and reserve space before load. */
  width?: number;
  height?: number;

  // Yours. All optional, all left alone by ingest, none of them invented.
  // Anything absent is simply not rendered.
  title?: string;
  date?: string;
  description?: string;
  alt?: string;
  highlight?: boolean;
}

export interface AlbumMeta {
  title: string;
  /** Optional. An album with no date shows none, and sorts after every dated one. */
  date?: string;
  date_end?: string;
  location?: string;
  cover?: string;
}

export interface Album {
  slug: string;
  meta: AlbumMeta;
  /**
   * Ordering only, never displayed. The folder's date prefix is how you arrange
   * albums; `date` in album.md is what a visitor reads. Keeping them apart means
   * renaming for sort order does not rewrite the page, and writing `1945-46` for
   * readers does not scramble the shelf.
   */
  sortKey: string;
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
  return (parsed.items ?? []).map((item) => ({
    ...item,
    kind: kindFor(item.file) ?? "photo",
  }));
}

/**
 * YAML gives back three different types depending on precision: `1965-04-02`
 * becomes a Date, `1965-04` stays a string, and a bare `1965` arrives as a
 * number. Normalise all three to the string the rest of the code expects.
 */
function isoDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
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
  if (!meta.title) {
    throw new Error(`${metaPath}: album.md needs a title.`);
  }

  const description = parsed.content.trim();
  const fromFolder = parseSlug(slug).date;
  const fromMeta = meta.date ? sortableDate(meta.date) : undefined;

  return {
    slug,
    sortKey: fromFolder ?? fromMeta ?? "",
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
    .sort((a, b) => {
      if (!a.sortKey && !b.sortKey) return a.meta.title.localeCompare(b.meta.title);
      if (!a.sortKey) return 1;
      if (!b.sortKey) return -1;
      return b.sortKey.localeCompare(a.sortKey);
    });
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

interface DateParts {
  y: string;
  m?: string;
  d?: number;
}

/** Accepts `YYYY`, `YYYY-MM` and `YYYY-MM-DD` — folder names carry all three. */
function parts(iso: string): DateParts | null {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(iso.slice(0, 10));
  if (!match?.[1]) return null;

  const monthIndex = match[2] ? Number(match[2]) - 1 : undefined;
  const month = monthIndex === undefined ? undefined : MONTHS[monthIndex];
  if (match[2] && !month) return null;

  return { y: match[1], m: month, d: match[3] ? Number(match[3]) : undefined };
}

function one(p: DateParts): string {
  if (!p.m) return p.y;
  return p.d === undefined ? `${p.m} ${p.y}` : `${p.m} ${p.d}, ${p.y}`;
}

/**
 * A single date or a range, at whatever precision each end carries.
 *
 * Anything the parser does not recognise is returned verbatim, which makes the
 * field an escape hatch: `1945-46` renders as written. Ordering still works —
 * see sortableDate.
 */
export function formatDate(date: string, dateEnd?: string): string {
  const start = parts(date);
  if (!start) return date;
  if (!dateEnd || dateEnd === date) return one(start);

  const end = parts(dateEnd);
  if (!end) return one(start);

  if (start.y !== end.y) return `${one(start)} – ${one(end)}`;
  if (start.m !== end.m) {
    return start.d === undefined || end.d === undefined
      ? `${start.m ?? ""} – ${end.m ?? ""} ${start.y}`.trim()
      : `${start.m} ${start.d} – ${end.m} ${end.d}, ${start.y}`;
  }
  if (start.d === undefined || end.d === undefined) return one(start);
  return `${start.m} ${start.d}–${end.d}, ${start.y}`;
}

/**
 * Pads a date so string comparison orders it correctly.
 *
 * Unrecognised strings fall back to their leading year, so a hand-written
 * `1945-46` still sorts among 1945 rather than by accident of its characters.
 */
export function sortableDate(date: string): string {
  const p = parts(date);
  if (!p) {
    const year = /^(\d{4})/.exec(date)?.[1];
    return year ? `${year}-01-01` : date;
  }
  const month = p.m ? String(MONTHS.indexOf(p.m) + 1).padStart(2, "0") : "01";
  const day = p.d === undefined ? "01" : String(p.d).padStart(2, "0");
  return `${p.y}-${month}-${day}`;
}

export interface StreamEntry {
  album: Album;
  item: Item;
}

/**
 * Every item across every album, newest first. A hand-written item date wins;
 * otherwise the item inherits its album's position on the shelf.
 */
export function chronological(albums: Album[]): StreamEntry[] {
  return albums
    .flatMap((album) =>
      album.items.map((item) => ({
        album,
        item,
        at: item.date ?? (album.sortKey ? `${album.sortKey}T00:00:00` : ""),
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ album, item }) => ({ album, item }));
}

/** The item named by `cover:` in album.md, falling back to the first one. */
export function coverOf(album: Album): Item | undefined {
  const named = album.meta.cover;
  if (named) {
    const match = album.items.find((item) => item.file === named);
    if (match) return match;
  }
  return album.items[0];
}

/** Highlighted items, newest first — what the home page leads with. */
export function highlightsOf(albums: Album[], limit: number): StreamEntry[] {
  return chronological(albums)
    .filter((entry) => entry.item.highlight === true)
    .slice(0, limit);
}

/**
 * Every thumbnail is 4:3 or 3:4 — nothing else. Only a photo taller than it is
 * wide gets the tall crop; video and audio are always wide.
 */
export function orientationOf(item: Item): Orientation {
  if (item.kind !== "photo") return "wide";
  if (item.width !== undefined && item.height !== undefined) {
    return item.height > item.width ? "tall" : "wide";
  }
  return "wide";
}

/** Seconds as m:ss, or h:mm:ss past an hour. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
