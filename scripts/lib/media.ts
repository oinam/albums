import type { SiteConfig } from "./config.ts";
import type { Item, Orientation } from "./albums.ts";

const QUALITY = 82;
const CONTACT_QUALITY = 80;

/** Where the poster frame is pulled from when the item does not say. */
const POSTER_SECOND = 1;

export interface Rendition {
  width: number;
  height?: number;
  fit: "cover" | "scale-down";
  quality: number;
  format: "auto" | "jpeg";
}

/**
 * A filename is whatever the camera or the phone wrote, and that includes spaces:
 * `Image 2023-03-28 at 7.33 PM.jpeg` is a real file here. Unencoded it makes a URL
 * the edge rejects outright, and inside `srcset` — where the space is the
 * delimiter — it destroys the whole attribute. The slug never needs this; the
 * filename always does.
 */
function encodeFile(file: string): string {
  return encodeURIComponent(file);
}

export function originalUrl(cfg: SiteConfig, slug: string, file: string): string {
  const base = cfg.media.local ? "/_media" : `https://${cfg.media.host}`;
  return `${base}/${cfg.media.prefix}/${slug}/${encodeFile(file)}`;
}

/**
 * Local mode has no edge, so the rendition is expressed as a query string the dev
 * server resizes on demand. Production emits the same intent as `/cdn-cgi/image/`
 * parameters.
 */
function transform(
  cfg: SiteConfig,
  slug: string,
  file: string,
  rendition: Rendition,
): string {
  const source = originalUrl(cfg, slug, file);

  if (cfg.media.local) {
    const query = new URLSearchParams({ w: String(rendition.width) });
    if (rendition.height !== undefined) query.set("h", String(rendition.height));
    if (rendition.fit === "cover") query.set("fit", "cover");
    return `${source}?${query.toString()}`;
  }

  const params = [`width=${rendition.width}`];
  if (rendition.height !== undefined) params.push(`height=${rendition.height}`);
  params.push(`fit=${rendition.fit}`);
  if (rendition.fit === "cover") params.push("gravity=auto");
  params.push(
    `quality=${rendition.quality}`,
    `format=${rendition.format}`,
    "metadata=none",
  );

  return `https://${cfg.media.host}/cdn-cgi/image/${params.join(",")}/${cfg.media.prefix}/${slug}/${encodeFile(file)}`;
}

/**
 * Thumbnail dimensions for one orientation. The configured size is the long
 * edge; the short edge is three quarters of it, giving 4:3 and 3:4 exactly.
 */
export function thumbSize(
  cfg: SiteConfig,
  orientation: Orientation,
): { width: number; height: number } {
  const long = cfg.sizes.thumb;
  const short = Math.round((long * 3) / 4);
  return orientation === "wide"
    ? { width: long, height: short }
    : { width: short, height: long };
}

/** Cropped rendition at an explicit long edge — 4:3 or 3:4, never anything else. */
function croppedUrl(
  cfg: SiteConfig,
  slug: string,
  file: string,
  orientation: Orientation,
  long: number,
): string {
  const short = Math.round((long * 3) / 4);
  const [width, height] = orientation === "wide" ? [long, short] : [short, long];
  return transform(cfg, slug, file, {
    width,
    height,
    fit: "cover",
    quality: CONTACT_QUALITY,
    format: "auto",
  });
}

/** Cropped thumbnail for grids. */
export function thumbUrl(
  cfg: SiteConfig,
  slug: string,
  file: string,
  orientation: Orientation,
): string {
  return croppedUrl(cfg, slug, file, orientation, cfg.sizes.thumb);
}

/** Width-constrained rendition used as a srcset candidate. */
export function scaledUrl(
  cfg: SiteConfig,
  slug: string,
  file: string,
  width: number,
): string {
  return transform(cfg, slug, file, {
    width,
    fit: "scale-down",
    quality: QUALITY,
    format: "auto",
  });
}

export function srcset(cfg: SiteConfig, slug: string, file: string): string {
  return [cfg.sizes.phone, cfg.sizes.desktop]
    .map((w) => `${scaledUrl(cfg, slug, file, w)} ${w}w`)
    .join(", ");
}

/**
 * Local mode asks the dev server for the frame, the same way it asks for a
 * rendition — `?frame=` alongside the width. It shells out to ffmpeg; if that is
 * not installed it answers with a placeholder, so this URL is always safe to emit.
 */
function localFrame(
  cfg: SiteConfig,
  slug: string,
  file: string,
  second: number,
  width: number,
  height?: number,
): string {
  const query = new URLSearchParams({ frame: String(second), w: String(width) });
  if (height !== undefined) {
    query.set("h", String(height));
    query.set("fit", "cover");
  }
  return `${originalUrl(cfg, slug, file)}?${query.toString()}`;
}

/** Still frame pulled from a video via Media Transformations. */
export function posterUrl(cfg: SiteConfig, slug: string, item: Item): string {
  const second = item.poster_time ?? POSTER_SECOND;
  if (cfg.media.local) {
    return localFrame(cfg, slug, item.file, second, cfg.sizes.desktop);
  }
  const source = originalUrl(cfg, slug, item.file);
  return `https://${cfg.media.host}/cdn-cgi/media/mode=frame,time=${second}s,width=${cfg.sizes.desktop},format=jpg/${source}`;
}

/** Video still cropped to a grid thumbnail. */
export function posterThumbUrl(
  cfg: SiteConfig,
  slug: string,
  item: Item,
  orientation: Orientation,
): string {
  const second = item.poster_time ?? POSTER_SECOND;
  const { width, height } = thumbSize(cfg, orientation);
  if (cfg.media.local) {
    return localFrame(cfg, slug, item.file, second, width, height);
  }
  const source = originalUrl(cfg, slug, item.file);
  return `https://${cfg.media.host}/cdn-cgi/media/mode=frame,time=${second}s,width=${width},height=${height},fit=cover,format=jpg/${source}`;
}
