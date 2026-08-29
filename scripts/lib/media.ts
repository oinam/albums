import type { SiteConfig } from "./config.ts";

const QUALITY = 82;
const CONTACT_QUALITY = 80;

const LOCAL_POSTER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23ddd'/%3E%3Cpath d='M6 4.5v7l5-3.5z' fill='%23888'/%3E%3C/svg%3E";

export interface Rendition {
  width: number;
  height?: number;
  fit: "cover" | "scale-down";
  quality: number;
  format: "auto" | "jpeg";
}

export function originalUrl(cfg: SiteConfig, slug: string, file: string): string {
  const base = cfg.media.local ? "/media" : `https://${cfg.media.host}`;
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

/** Square crop for album grids. */
export function contactUrl(cfg: SiteConfig, slug: string, file: string): string {
  return transform(cfg, slug, file, {
    width: cfg.sizes.contact,
    height: cfg.sizes.contact,
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
 */
export function visionUrl(
  cfg: SiteConfig,
  slug: string,
  file: string,
  width: number,
): string {
  return transform(cfg, slug, file, {
    width,
    fit: "scale-down",
    quality: QUALITY,
    format: "jpeg",
  });
}
