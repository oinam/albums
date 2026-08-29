import type { SiteConfig } from "./config.ts";
import type { Album, Item, StreamEntry } from "./albums.ts";
import { formatDate, year } from "./albums.ts";
import { contactUrl, originalUrl, posterUrl, scaledUrl, srcset } from "./media.ts";

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

const ALBUMS_PATH = "/albums/";

/** Page one of the stream is the site root; the rest hang off /page/. */
function streamPath(page: number): string {
  return page <= 1 ? "/" : `/page/${page}/`;
}

/**
 * One route for every kind of item. Keeping the media type out of the path is
 * what makes the id a permalink: re-encoding a clip or swapping a still for a
 * video moves nothing.
 */
function itemPath(item: Item): string {
  return `/media/${item.id}/`;
}

function altFor(item: Item): string {
  return item.alt ?? item.title ?? item.file;
}

function tile(cfg: SiteConfig, album: Album, item: Item): string {
  const href = itemPath(item);
  const alt = esc(altFor(item));

  if (item.kind === "audio") {
    return `<li class="audio-tile">
<span>${esc(item.title ?? item.file)}</span>
<audio controls preload="none" src="${esc(originalUrl(cfg, album.slug, item.file))}"></audio>
<a href="${href}">Details</a>
</li>`;
  }

  const src =
    item.kind === "video"
      ? esc(posterUrl(cfg, album.slug, item.file))
      : esc(contactUrl(cfg, album.slug, item.file));
  const badge = item.kind === "video" ? `<span class="badge">Video</span>` : "";

  return `<li><a class="tile" href="${href}">
<img src="${src}" alt="${alt}" width="${cfg.sizes.contact}" height="${cfg.sizes.contact}" loading="lazy" decoding="async">
${badge}
</a></li>`;
}

function grid(cfg: SiteConfig, album: Album, items: Item[]): string {
  if (items.length === 0) {
    return `<p class="empty">Nothing here yet.</p>`;
  }
  return `<ul class="grid">
${items.map((item) => tile(cfg, album, item)).join("\n")}
</ul>`;
}

function albumSubtitle(album: Album): string {
  const parts = [formatDate(album.meta.date, album.meta.date_end)];
  if (album.meta.location) parts.push(album.meta.location);
  const count = album.items.length;
  parts.push(count === 1 ? "1 item" : `${count} items`);
  return parts.join(" &middot; ");
}

const PREVIEW_COUNT = 8;

export function renderAlbums(cfg: SiteConfig, albums: Album[]): string {
  if (albums.length === 0) {
    return layout({
      cfg,
      title: `Albums — ${cfg.site.title}`,
      description: `Every album in ${cfg.site.title}.`,
      path: ALBUMS_PATH,
      body: `<p class="crumb"><a href="/">${esc(cfg.site.title)}</a></p>
<h1>Albums</h1>
<p class="empty">No albums yet. Add one under <code>albums/</code> and run <code>npm run build</code>.</p>`,
    });
  }

  const sections: string[] = [];
  let current = "";
  for (const album of albums) {
    const y = year(album);
    if (y !== current) {
      if (current !== "") sections.push(`</div>`);
      sections.push(`<h2 class="year">${esc(y)}</h2>`, `<div class="albums">`);
      current = y;
    }
    sections.push(`<section class="album-card">
<h2><a href="${albumPath(album)}">${esc(album.meta.title)}</a></h2>
<p class="meta">${albumSubtitle(album)}</p>
${grid(cfg, album, album.items.slice(0, PREVIEW_COUNT))}
</section>`);
  }
  if (current !== "") sections.push(`</div>`);

  return layout({
    cfg,
    title: `Albums — ${cfg.site.title}`,
    description: `Every album in ${cfg.site.title}, newest first.`,
    path: ALBUMS_PATH,
    body: `<p class="crumb"><a href="/">${esc(cfg.site.title)}</a></p>
<h1>Albums</h1>
${sections.join("\n")}`,
  });
}

export function renderAlbum(cfg: SiteConfig, album: Album): string {
  const description = album.description || `${album.meta.title} — ${cfg.site.title}`;
  return layout({
    cfg,
    title: `${album.meta.title} — ${cfg.site.title}`,
    description,
    path: albumPath(album),
    body: `<p class="crumb"><a href="/">${esc(cfg.site.title)}</a> / <a href="${ALBUMS_PATH}">Albums</a></p>
<h1>${esc(album.meta.title)}</h1>
<p class="meta">${albumSubtitle(album)}</p>
${album.descriptionHtml ? `<div class="caption">${album.descriptionHtml}</div>` : ""}
${grid(cfg, album, album.items)}`,
  });
}

function pagination(page: number, pageCount: number): string {
  if (pageCount <= 1) return "";
  const newer = page > 1 ? `<a href="${streamPath(page - 1)}">&larr; Newer</a>` : "";
  const older =
    page < pageCount ? `<a href="${streamPath(page + 1)}">Older &rarr;</a>` : "";
  return `<nav class="pager">
<span>${newer}</span>
<span>Page ${page} of ${pageCount}</span>
<span>${older}</span>
</nav>`;
}

export function renderStream(
  cfg: SiteConfig,
  entries: StreamEntry[],
  page: number,
  pageCount: number,
): string {
  const body =
    entries.length === 0
      ? `<p class="empty">Nothing here yet.</p>`
      : `<ul class="grid">\n${entries.map((e) => tile(cfg, e.album, e.item)).join("\n")}\n</ul>`;

  const rel: string[] = [];
  if (page > 1) rel.push(`<link rel="prev" href="${streamPath(page - 1)}">`);
  if (page < pageCount) rel.push(`<link rel="next" href="${streamPath(page + 1)}">`);

  const heading =
    page === 1
      ? `<header class="masthead">
<h1>${esc(cfg.site.title)}</h1>
<p>${esc(cfg.site.tagline)}</p>
</header>`
      : `<p class="crumb"><a href="/">${esc(cfg.site.title)}</a></p>
<h1>Page ${page}</h1>`;

  return layout({
    cfg,
    title: page === 1 ? cfg.site.title : `Page ${page} — ${cfg.site.title}`,
    description: `${cfg.site.tagline} Everything, newest first.`,
    path: streamPath(page),
    head: rel.length > 0 ? `${rel.join("\n")}\n` : "",
    body: `${heading}
<p class="meta"><a href="${ALBUMS_PATH}">Browse by album &rarr;</a></p>
${body}
${pagination(page, pageCount)}`,
  });
}

function stage(cfg: SiteConfig, album: Album, item: Item): string {
  const source = originalUrl(cfg, album.slug, item.file);
  const alt = esc(altFor(item));

  if (item.kind === "audio") {
    return `<div class="stage"><audio controls preload="metadata" src="${esc(source)}"></audio></div>`;
  }
  if (item.kind === "video") {
    return `<div class="stage"><video controls preload="none" playsinline poster="${esc(posterUrl(cfg, album.slug, item.file))}" src="${esc(source)}"></video></div>`;
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

function exif(cfg: SiteConfig, album: Album, item: Item): string {
  const rows: [string, string][] = [];
  if (item.taken) rows.push(["Taken", item.taken.replace("T", " ")]);
  if (item.camera) rows.push(["Camera", item.camera]);
  if (item.lens) rows.push(["Lens", item.lens]);
  if (item.settings) rows.push(["Settings", item.settings]);
  if (item.width && item.height) rows.push(["Size", `${item.width} × ${item.height}`]);
  rows.push([
    "Original",
    `<a href="${esc(originalUrl(cfg, album.slug, item.file))}">${esc(item.file)}</a>`,
  ]);

  return `<dl class="exif">
${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${k === "Original" ? v : esc(v)}</dd>`).join("\n")}
</dl>`;
}

export function renderItem(
  cfg: SiteConfig,
  album: Album,
  item: Item,
  prev: Item | undefined,
  next: Item | undefined,
): string {
  const title = item.title ?? `${album.meta.title} — ${item.file}`;
  const tags =
    item.keywords && item.keywords.length > 0
      ? `<p class="tags">${item.keywords.map((k) => esc(k)).join(" &middot; ")}</p>`
      : "";

  return layout({
    cfg,
    title: `${title} — ${cfg.site.title}`,
    description: item.caption ?? item.alt ?? title,
    path: itemPath(item),
    body: `<p class="crumb"><a href="/">${esc(cfg.site.title)}</a> / <a href="${albumPath(album)}">${esc(album.meta.title)}</a></p>
<h1>${esc(title)}</h1>
${stage(cfg, album, item)}
${item.caption ? `<p class="caption">${esc(item.caption)}</p>` : ""}
${tags}
${exif(cfg, album, item)}
<nav class="pager">
<span>${prev ? `<a href="${itemPath(prev)}">&larr; Previous</a>` : ""}</span>
<span><a href="${albumPath(album)}">Back to ${esc(album.meta.title)}</a></span>
<span>${next ? `<a href="${itemPath(next)}">Next &rarr;</a>` : ""}</span>
</nav>`,
  });
}
