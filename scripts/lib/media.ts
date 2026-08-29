import type { SiteConfig } from "./config.ts";
import type { Orientation } from "./albums.ts";

const QUALITY = 82;
const CONTACT_QUALITY = 80;

const LOCAL_POSTER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 48'%3E%3Crect width='64' height='48' fill='%23e4e4e4'/%3E%3Cpath d='M27 17.5v13l11-6.5z' fill='%23999'/%3E%3C/svg%3E";

export interface Rendition {
  width: number;
  height?: number;
  fit: "cover" | "scale-down";
  quality: number;
  format: "auto" | "jpeg";
}

export function originalUrl(cfg: SiteConfig, slug: string, file: string): string {
  const base = cfg.media.local ? "/_media" : `https://${cfg.media.host}`;
  return `${base}/${cfg.media.prefix}/${slug}/${file}`;
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

  return `https://${cfg.media.host}/cdn-cgi/image/${params.join(",")}/${cfg.media.prefix}/${slug}/${file}`;
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

/** Cropped thumbnail for grids — 4:3 or 3:4, never anything else. */
export function thumbUrl(
  cfg: SiteConfig,
  slug: string,
  file: string,
  orientation: Orientation,
): string {
  const { width, height } = thumbSize(cfg, orientation);
  return transform(cfg, slug, file, {
    width,
    height,
    fit: "cover",
    quality: CONTACT_QUALITY,
    format: "auto",
  });
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

/** Still frame pulled from a video via Media Transformations. */
export function posterUrl(cfg: SiteConfig, slug: string, file: string): string {
  if (cfg.media.local) return LOCAL_POSTER;
  const source = originalUrl(cfg, slug, file);
  return `https://${cfg.media.host}/cdn-cgi/media/mode=frame,time=1s,width=${cfg.sizes.desktop},format=jpg/${source}`;
}

/**
 * Fixed-format rendition for handing to an API that negotiates its own Accept
 * header. `format=auto` could return AVIF, which such a consumer may reject.
 *
 * Both axes are bounded so the *long* edge is what gets constrained. Bounding
 * width alone leaves a portrait taller than a landscape is wide, and vision
 * tokens are billed on area — a 9:16 frame cost 2.7x a 3:2 one for no gain.
 */
export function visionUrl(
  cfg: SiteConfig,
  slug: string,
  file: string,
  longEdge: number,
): string {
  return transform(cfg, slug, file, {
    width: longEdge,
    height: longEdge,
    fit: "scale-down",
    quality: QUALITY,
    format: "jpeg",
  });
}

/** Video still cropped to a grid thumbnail. */
export function posterThumbUrl(
  cfg: SiteConfig,
  slug: string,
  file: string,
  orientation: Orientation,
): string {
  if (cfg.media.local) return LOCAL_POSTER;
  const { width, height } = thumbSize(cfg, orientation);
  const source = originalUrl(cfg, slug, file);
  return `https://${cfg.media.host}/cdn-cgi/media/mode=frame,time=1s,width=${width},height=${height},fit=cover,format=jpg/${source}`;
}
