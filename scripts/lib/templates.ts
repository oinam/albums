import type { SiteConfig } from "./config.ts";
import type { Album, Item, StreamEntry } from "./albums.ts";
import type { Page } from "./pages.ts";
import { coverOf, formatDate, orientationOf } from "./albums.ts";
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

/**
 * Standalone pages available to the header and footer. Set once at the start of a
 * build; a build is a single run, so a module-level value is honest here and saves
 * threading the list through every renderer.
 */
let chromePages: Page[] = [];

export function configureChrome(pages: Page[]): void {
  chromePages = pages;
}

const ICON = {
  prev: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  random: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h3l4 10h5M4 17h3l4-10h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 4l3 3-3 3M17 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
} as const;

const LOGO = `<svg class="logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>`;

/**
 * Applied before the first paint, so a chosen theme never flashes the other one.
 * Three states: an explicit light or dark, or auto, which follows the system and
 * stamps nothing.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;

const THEME_TOGGLE = `<button type="button" class="theme-toggle" data-theme-toggle aria-label="Theme: auto. Click to change.">
<span data-theme-label>Auto</span>
</button>`;

const TOGGLE_SCRIPT = `(function(){var b=document.querySelector("[data-theme-toggle]");if(!b)return;var l=b.querySelector("[data-theme-label]");var order=["auto","light","dark"];
function current(){try{return localStorage.getItem("theme")||"auto"}catch(e){return "auto"}}
function paint(v){l.textContent=v.charAt(0).toUpperCase()+v.slice(1);b.setAttribute("aria-label","Theme: "+v+". Click to change.");if(v==="auto")delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=v}
paint(current());
b.addEventListener("click",function(){var v=order[(order.indexOf(current())+1)%3];try{localStorage.setItem("theme",v)}catch(e){}paint(v)})})()`;

function chromeLinks(): { header: string; footer: string } {
  const links = chromePages.map(
    (page) => `<a href="/${page.slug}/">${esc(page.title)}</a>`,
  );
  return {
    header: links.join(""),
    footer: [`<a href="/feed.xml">RSS</a>`, ...links].join(""),
  };
}

function siteHeader(cfg: SiteConfig): string {
  return `<header class="bar site-header">
<a class="brand" href="/">${LOGO}<span>${esc(cfg.site.title)}</span></a>
<nav class="bar-nav">${chromeLinks().header}${THEME_TOGGLE}</nav>
</header>`;
}

function siteFooter(cfg: SiteConfig): string {
  const year = new Date().getFullYear();
  return `<footer class="bar site-footer">
<p>&copy; ${year}. All Rights Reserved by <a href="https://oinam.com/">${esc(cfg.site.author.split(" ").pop() ?? "Oinam")}</a>.</p>
<nav class="bar-nav">${chromeLinks().footer}</nav>
</footer>`;
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
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.site.title)}" href="/feed.xml">
<link rel="stylesheet" href="/assets/site.css">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="website">
${head}<script>${THEME_SCRIPT}</script>
</head>
<body>
${siteHeader(cfg)}
<main>
${body}
</main>
${siteFooter(cfg)}
<script>${TOGGLE_SCRIPT}</script>
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
  const parts: string[] = [];
  if (album.meta.date) parts.push(formatDate(album.meta.date, album.meta.date_end));
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

export function renderHome(
  cfg: SiteConfig,
  albums: Album[],
  highlights: StreamEntry[],
): string {
  const highlightSection =
    highlights.length === 0
      ? ""
      : `<ul class="grid">
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
    body: `${highlightSection}
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

/**
 * Title, date, description — and only when they exist. Everything the file
 * happened to know about itself (camera, lens, exposure, dimensions, weight) is
 * deliberately not here: it is data about the photograph rather than about the
 * picture, and it was crowding out the three things worth reading.
 */
function itemMeta(item: Item): string {
  const rows = [
    item.title ? `<h1>${esc(item.title)}</h1>` : "",
    item.date ? `<p class="item-date">${formatDate(item.date)}</p>` : "",
    item.description ? `<p class="item-description">${esc(item.description)}</p>` : "",
  ].filter(Boolean);

  return rows.length === 0 ? "" : `<div class="item-meta">\n${rows.join("\n")}\n</div>`;
}

export function renderItem(
  cfg: SiteConfig,
  album: Album,
  item: Item,
  prev: Item | undefined,
  next: Item | undefined,
): string {
  return layout({
    cfg,
    title: item.title
      ? `${item.title} — ${cfg.site.title}`
      : `${album.meta.title} — ${cfg.site.title}`,
    description: item.description ?? album.meta.title,
    path: itemPath(item),
    body: `${stage(cfg, album, item)}
${itemMeta(item)}
<nav class="pager">
<a class="pager-album" href="${albumPath(album)}">${esc(album.meta.title)}</a>
<span class="pager-icons">
${prev ? `<a class="icon" href="${itemPath(prev)}" rel="prev" aria-label="Previous">${ICON.prev}</a>` : `<span class="icon is-off" aria-hidden="true">${ICON.prev}</span>`}
<a class="icon" href="/random/" aria-label="A random item">${ICON.random}</a>
${next ? `<a class="icon" href="${itemPath(next)}" rel="next" aria-label="Next">${ICON.next}</a>` : `<span class="icon is-off" aria-hidden="true">${ICON.next}</span>`}
</span>
</nav>`,
  });
}

/**
 * Sends the visitor to a random item. The ids ship with the page, so there is no
 * request to make a choice — the page picks one and replaces itself, leaving no
 * entry in history to trap the back button.
 */
export function renderRandom(cfg: SiteConfig, entries: StreamEntry[]): string {
  const ids = entries.map((entry) => entry.item.id);
  const list = ids
    .map((id) => `<li><a href="/media/${id}/">${esc(id)}</a></li>`)
    .join("");

  return layout({
    cfg,
    title: `Random — ${cfg.site.title}`,
    description: "Sends you to something at random.",
    path: "/random/",
    head: `<meta name="robots" content="noindex">\n`,
    body: `<h1>Random</h1>
<p class="caption">Picking something&hellip;</p>
<noscript><ul class="prose">${list}</ul></noscript>
<script>(function(){var i=${JSON.stringify(ids)};if(!i.length)return;location.replace("/media/"+i[Math.floor(Math.random()*i.length)]+"/")})()</script>`,
  });
}
