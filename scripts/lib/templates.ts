import type { SiteConfig } from "./config.ts";
import type { Album, Item, StreamEntry } from "./albums.ts";
import { coverOf, formatDate, formatDuration, orientationOf } from "./albums.ts";
import {
  originalUrl,
  posterThumbUrl,
  posterUrl,
  scaledUrl,
  srcset,
  thumbSize,
  thumbUrl,
} from "./media.ts";

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface PageOptions {
  cfg: SiteConfig;
  title: string;
  description: string;
  path: string;
  body: string;
  head?: string;
}

export function layout({
  cfg,
  title,
  description,
  path,
  body,
  head = "",
}: PageOptions): string {
  const canonical = `https://${cfg.site.host}${path}`;
  return `<!doctype html>
<html lang="${esc(cfg.site.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/assets/site.css">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="website">
${head}</head>
<body>
${body}
<footer class="site-footer">
<p><a href="/">${esc(cfg.site.title)}</a> &middot; ${esc(cfg.site.author)}</p>
</footer>
</body>
</html>
`;
}

function albumPath(album: Album): string {
  return `/album/${album.slug}/`;
}

/**
 * One route for every kind of item. Keeping the media type out of the path is
 * what makes the id a permalink: re-encoding a clip or swapping a still for a
 * video moves nothing.
 */
function itemPath(item: Item): string {
  return `/media/${item.id}/`;
}

/** Empty is deliberate: a screen reader announcing "photo-1.jpg" is worse than silence. */
function altFor(item: Item): string {
  return item.alt ?? item.title ?? "";
}

/** Album covers are always wide, so the album list stays a tidy uniform grid. */
/**
 * How many tiles load eagerly. Anything plausibly above the fold must not be
 * lazy: the browser defers it until layout says it is near the viewport, and
 * that decision is unreliable — content blockers and some engines never make
 * it at all, leaving visible tiles permanently blank.
 */
const EAGER_TILES = 8;

function loadingAttrs(index: number): string {
  return index < EAGER_TILES
    ? ` loading="eager"${index === 0 ? ' fetchpriority="high"' : ""}`
    : ` loading="lazy"`;
}

function coverImage(cfg: SiteConfig, album: Album, item: Item): string {
  return item.kind === "video"
    ? posterThumbUrl(cfg, album.slug, item.file, "wide")
    : thumbUrl(cfg, album.slug, item.file, "wide");
}

function tile(cfg: SiteConfig, album: Album, item: Item, index: number): string {
  const href = itemPath(item);
  const alt = esc(altFor(item));

  const orientation = orientationOf(item);
  const cell = `cell cell--${orientation}`;

  if (item.kind === "audio") {
    return `<li class="${cell}"><div class="audio-tile">
<span>${esc(item.title ?? item.file)}</span>
<audio controls preload="none" src="${esc(originalUrl(cfg, album.slug, item.file))}"></audio>
<a href="${href}">Details</a>
</div></li>`;
  }

  const { width, height } = thumbSize(cfg, orientation);
  const src =
    item.kind === "video"
      ? esc(posterThumbUrl(cfg, album.slug, item.file, orientation))
      : esc(thumbUrl(cfg, album.slug, item.file, orientation));
  const badge = item.kind === "video" ? `<span class="badge">Video</span>` : "";

  return `<li class="${cell}"><a class="tile" href="${href}">
<img src="${src}" alt="${alt}" width="${width}" height="${height}"${loadingAttrs(index)} decoding="async">
${badge}
</a></li>`;
}

function grid(cfg: SiteConfig, album: Album, items: Item[]): string {
  if (items.length === 0) {
    return `<p class="empty">Nothing here yet.</p>`;
  }
  return `<ul class="grid">
${items.map((item, index) => tile(cfg, album, item, index)).join("\n")}
</ul>`;
}

function albumSubtitle(album: Album): string {
  const parts = [formatDate(album.meta.date, album.meta.date_end)];
  if (album.meta.location) parts.push(album.meta.location);
  const count = album.items.length;
  parts.push(count === 1 ? "1 item" : `${count} items`);
  return parts.join(" &middot; ");
}

function albumCard(cfg: SiteConfig, album: Album, index: number): string {
  const cover = coverOf(album);
  const href = albumPath(album);
  const art = cover
    ? `<img src="${esc(coverImage(cfg, album, cover))}" alt="${esc(cover.alt ?? album.meta.title)}" width="${thumbSize(cfg, "wide").width}" height="${thumbSize(cfg, "wide").height}"${loadingAttrs(index)} decoding="async">`
    : "";

  return `<li class="album-item">
<a class="tile" href="${href}">${art}</a>
<h3><a href="${href}">${esc(album.meta.title)}</a></h3>
<p class="meta">${albumSubtitle(album)}</p>
</li>`;
}

function archiveSummary(albums: Album[]): string {
  const items = albums.reduce((total, album) => total + album.items.length, 0);
  const years = albums.map((album) => album.meta.date.slice(0, 4)).sort();
  const first = years[0];
  const last = years[years.length - 1];

  const parts = [
    items === 1 ? "1 item" : `${items} items`,
    albums.length === 1 ? "1 album" : `${albums.length} albums`,
  ];
  if (first !== undefined && last !== undefined) {
    parts.push(first === last ? first : `${first}–${last}`);
  }
  return parts.join(" &middot; ");
}

export function renderHome(
  cfg: SiteConfig,
  albums: Album[],
  highlights: StreamEntry[],
): string {
  const highlightSection =
    highlights.length === 0
      ? ""
      : `<h2 class="section-head">Highlights</h2>
<ul class="grid">
${highlights.map((e, index) => tile(cfg, e.album, e.item, index)).join("\n")}
</ul>`;

  const albumSection =
    albums.length === 0
      ? `<p class="empty">No albums yet. Add one under <code>albums/</code> and run <code>npm run build</code>.</p>`
      : `<h2 class="section-head">Albums</h2>
<ul class="album-grid">
${albums.map((album, index) => albumCard(cfg, album, index)).join("\n")}
</ul>`;

  return layout({
    cfg,
    title: cfg.site.title,
    description: cfg.site.tagline,
    path: "/",
    body: `<header class="masthead">
<h1>${esc(cfg.site.title)}</h1>
<p class="tagline">${esc(cfg.site.tagline)}</p>
${albums.length > 0 ? `<p class="stat">${archiveSummary(albums)}</p>` : ""}
</header>
${highlightSection}
${albumSection}`,
  });
}

/**
 * Cloudflare Pages serves this with a real 404 status. Without the file it falls
 * back to the site root and answers 200, which is a soft 404 — the page looks
 * fine and every crawler is told the URL exists.
 */
export function renderNotFound(cfg: SiteConfig): string {
  return layout({
    cfg,
    title: `Not found — ${cfg.site.title}`,
    description: "That page does not exist.",
    path: "/404.html",
    body: `<p class="crumb"><a href="/">${esc(cfg.site.title)}</a></p>
<h1>Not found</h1>
<p class="caption">That page does not exist. Nothing here is ever deleted, so a link that used to work should still work — if one does not, it was probably never right.</p>
<p><a href="/">Back to ${esc(cfg.site.title)}</a></p>`,
  });
}

export function renderAlbum(cfg: SiteConfig, album: Album): string {
  const description = album.description || `${album.meta.title} — ${cfg.site.title}`;
  return layout({
    cfg,
    title: `${album.meta.title} — ${cfg.site.title}`,
    description,
    path: albumPath(album),
    body: `<p class="crumb"><a href="/">${esc(cfg.site.title)}</a></p>
<h1>${esc(album.meta.title)}</h1>
<p class="meta">${albumSubtitle(album)}</p>
${album.descriptionHtml ? `<div class="caption">${album.descriptionHtml}</div>` : ""}
${grid(cfg, album, album.items)}`,
  });
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

function stage(cfg: SiteConfig, album: Album, item: Item): string {
  const source = originalUrl(cfg, album.slug, item.file);
  const alt = esc(altFor(item));

  if (item.kind === "audio") {
    return `<div class="stage stage--audio">
<p class="audio-heading">${esc(item.title ?? item.file)}</p>
<audio controls preload="metadata" src="${esc(source)}"></audio>
</div>`;
  }

  if (item.kind === "video") {
    const dims =
      item.width && item.height ? ` width="${item.width}" height="${item.height}"` : "";
    return `<div class="stage">
<video controls preload="metadata" playsinline${dims}
       poster="${esc(posterUrl(cfg, album.slug, item.file))}"
       src="${esc(source)}"></video>
</div>`;
  }

  const dims =
    item.width && item.height ? ` width="${item.width}" height="${item.height}"` : "";
  return `<div class="stage">
<img src="${esc(scaledUrl(cfg, album.slug, item.file, cfg.sizes.desktop))}"
     srcset="${esc(srcset(cfg, album.slug, item.file))}"
     sizes="(max-width: 700px) 100vw, min(1600px, 90vw)"${dims}
     alt="${alt}" decoding="async">
</div>`;
}

/** Only rows that have a value. Nothing is invented and nothing shows as empty. */
function details(cfg: SiteConfig, album: Album, item: Item): string {
  const rows: [string, string][] = [];

  const when = item.date ?? item.taken;
  if (when) rows.push(["Date", when.replace("T", " ")]);
  if (item.location) rows.push(["Location", item.location]);
  if (item.duration !== undefined) {
    rows.push(["Duration", formatDuration(item.duration)]);
  }
  if (item.camera) rows.push(["Camera", item.camera]);
  if (item.lens) rows.push(["Lens", item.lens]);
  if (item.settings) rows.push(["Settings", item.settings]);
  if (item.width && item.height) {
    rows.push(["Dimensions", `${item.width} × ${item.height}`]);
  }
  if (item.bytes !== undefined) rows.push(["File size", formatBytes(item.bytes)]);

  const original = `<a href="${esc(originalUrl(cfg, album.slug, item.file))}">${esc(item.file)}</a>`;

  return `<dl class="exif">
${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("\n")}
<dt>Original</dt><dd>${original}</dd>
</dl>`;
}

export function renderItem(
  cfg: SiteConfig,
  album: Album,
  item: Item,
  prev: Item | undefined,
  next: Item | undefined,
): string {
  const heading = item.title ? `<h1>${esc(item.title)}</h1>` : "";
  const description = item.description
    ? `<p class="caption">${esc(item.description)}</p>`
    : "";

  return layout({
    cfg,
    title: item.title
      ? `${item.title} — ${cfg.site.title}`
      : `${album.meta.title} — ${cfg.site.title}`,
    description: item.description ?? album.meta.title,
    path: itemPath(item),
    body: `<p class="crumb"><a href="/">${esc(cfg.site.title)}</a> / <a href="${albumPath(album)}">${esc(album.meta.title)}</a></p>
${heading}
${stage(cfg, album, item)}
${description}
${details(cfg, album, item)}
<nav class="pager">
<span>${prev ? `<a href="${itemPath(prev)}">&larr; Previous</a>` : ""}</span>
<span><a href="${albumPath(album)}">Back to ${esc(album.meta.title)}</a></span>
<span>${next ? `<a href="${itemPath(next)}">Next &rarr;</a>` : ""}</span>
</nav>`,
  });
}
