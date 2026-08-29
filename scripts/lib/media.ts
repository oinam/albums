import type { SiteConfig } from "./config.ts";

const QUALITY = 82;
const CONTACT_QUALITY = 80;

export function originalUrl(cfg: SiteConfig, slug: string, file: string): string {
  return `https://${cfg.media.host}/${cfg.media.prefix}/${slug}/${file}`;
}

function transform(
  cfg: SiteConfig,
  slug: string,
  file: string,
  params: string,
): string {
  return `https://${cfg.media.host}/cdn-cgi/image/${params}/${cfg.media.prefix}/${slug}/${file}`;
}

/** Square crop for album grids. */
export function contactUrl(cfg: SiteConfig, slug: string, file: string): string {
  const w = cfg.sizes.contact;
  const params = `width=${w},height=${w},fit=cover,gravity=auto,quality=${CONTACT_QUALITY},format=auto,metadata=none`;
  return transform(cfg, slug, file, params);
}

/** Width-constrained rendition used as a srcset candidate. */
export function scaledUrl(
  cfg: SiteConfig,
  slug: string,
  file: string,
  width: number,
): string {
  return transform(
    cfg,
    slug,
    file,
    `width=${width},fit=scale-down,quality=${QUALITY},format=auto,metadata=none`,
  );
}

export function srcset(cfg: SiteConfig, slug: string, file: string): string {
  return [cfg.sizes.phone, cfg.sizes.desktop]
    .map((w) => `${scaledUrl(cfg, slug, file, w)} ${w}w`)
    .join(", ");
}

/** Still frame pulled from a video via Media Transformations. */
export function posterUrl(cfg: SiteConfig, slug: string, file: string): string {
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
  return transform(
    cfg,
    slug,
    file,
    `width=${width},fit=scale-down,quality=${QUALITY},format=jpeg,metadata=none`,
  );
}
