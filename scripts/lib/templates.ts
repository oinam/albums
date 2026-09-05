import type { SiteConfig } from "./config.ts";
import type { Album, Item, StreamEntry } from "./albums.ts";
import { coverOf, formatDate, orientationOf, plainText } from "./albums.ts";
import { albumEditor, itemEditor } from "./editor.ts";
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
  /** The local editor, appended last. Empty in every production build. */
  edit?: string;
}

/**
 * The stylesheet's hashed name, set once at the start of a build. A build is a
 * single run, so a module-level value is honest here and saves threading the name
 * through every renderer.
 */
let stylesheetHref = "/assets/site.css";

export function configureChrome(stylesheet: string): void {
  stylesheetHref = stylesheet;
}

const ICON = {
  prev: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  random: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h3l4 10h5M4 17h3l4-10h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 4l3 3-3 3M17 14l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
} as const;

/** Bars shortening downward with the arrow, lengthening against it. */
const SORT_ICON = {
  newest: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h9M4 12h6M4 18h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 5v14m0 0l-3-3m3 3l3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  oldest: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h3M4 12h6M4 18h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 19V5m0 0l-3 3m3-3l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
} as const;

const SORT_LABEL = { newest: "Newest first", oldest: "Oldest first" } as const;

/**
 * Applied before the first paint, so a chosen theme never flashes the other one.
 * Three states: an explicit light or dark, or auto, which follows the system and
 * stamps nothing.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;

const THEME_ICON = {
  auto: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 000 16z" fill="currentColor"/></svg>`,
  light: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  dark: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
} as const;

const THEME_TOGGLE = `<button type="button" class="theme-toggle" data-theme-toggle title="Theme: auto" aria-label="Theme: auto. Click to change.">${THEME_ICON.auto}</button>`;

/**
 * The site has no header bar, so until now the only link home was the site name
 * in the footer. Prefixing the album title with it turns the title into a
 * breadcrumb and puts the way back where a visitor already looks. It is labelled
 * for what the root actually holds — a list of albums — rather than "Home".
 */
const HOME_CRUMB = `<a class="crumb-home" href="/" title="Albums (H)">Albums</a> <span class="crumb-sep" aria-hidden="true">/</span> `;

/**
 * The shortcut panel, and the notes with it.
 *
 * A shortcut nobody can discover is a shortcut nobody uses, which is why the
 * pager icons carry their key in `title` — but that only reaches someone already
 * hovering the thing they were going to click anyway. This is the list, plus the
 * four facts about the site that are worth knowing and are otherwise invisible.
 *
 * It is a real `<dialog>` opened with `showModal()`, so the focus trap, the
 * backdrop and Escape are the browser's rather than ours.
 */
const HELP = `<dialog class="help" aria-labelledby="help-title">
<div class="help-head">
<h2 id="help-title">Getting around</h2>
<button type="button" class="help-close" aria-label="Close" title="Close (Esc)">&times;</button>
</div>
<dl class="help-keys">
<dt><kbd>&larr;</kbd><kbd>&rarr;</kbd></dt><dd>The picture before, and the one after</dd>
<dt><kbd>A</kbd></dt><dd>Back to the album</dd>
<dt><kbd>R</kbd></dt><dd>Something at random</dd>
<dt><kbd>H</kbd></dt><dd>Every album</dd>
<dt><kbd>?</kbd><kbd>/</kbd></dt><dd>This window</dd>
</dl>
<p class="help-note">The first three want a picture on screen. <kbd>H</kbd> and <kbd>?</kbd> work anywhere.</p>
<ul class="help-notes">
<li><strong>Newest first.</strong> Albums run that way and so do the pictures inside them. The button on an album's title line turns it around, and remembers.</li>
<li><strong>Every picture has a permanent address.</strong> Renaming an album, or re-encoding a video, never moves one — a link that worked once keeps working.</li>
<li><strong>The feed carries the pictures.</strong> Subscribe and a photograph shows up in your reader, not a link promising one.</li>
<li><strong>Light, dark, or whatever your system says.</strong> The control in the footer cycles all three.</li>
</ul>
</dialog>`;

const HELP_BUTTON = `<button type="button" class="help-open" title="Getting around (? or /)" aria-label="Getting around">?</button>`;

/**
 * Keyboard shortcuts, on top of tabbing — never instead of it. Every target is a
 * real link, so Tab and Enter already work and these are a shortcut over the same
 * hrefs rather than a parallel mechanism.
 *
 * Three rules keep them from fighting the browser. Any modifier held and we do
 * nothing, so Cmd/Alt+Arrow stays history navigation. Typing in a field does
 * nothing, so a future search box is safe. And nothing is bound that the browser
 * already uses on a normal page — which is why Random is R and not Space: Space
 * is page-down, and taking it would break scrolling on exactly the pages where
 * these shortcuts are useful.
 *
 * `?` and `/` are the one exception to the first rule. `?` is Shift on most
 * layouts, so a bare-key test would mean it never fires; both are checked before
 * that guard, and only the three modifiers that would make either a browser
 * command are rejected. Binding the unshifted key as well means the panel opens
 * whether or not you reached for Shift, and on a layout that puts `?` somewhere
 * else entirely.
 */
const KEYS_SCRIPT = `(function(){
var map={ArrowLeft:'[rel=prev]',ArrowRight:'[rel=next]',a:'.pager-album',A:'.pager-album',r:'.pager .icon[href="/random/"]',R:'.pager .icon[href="/random/"]',h:'.brand a',H:'.brand a'};
var help=document.querySelector('.help'),opener=document.querySelector('.help-open'),
closer=help&&help.querySelector('.help-close');
function openHelp(){if(!help||help.open)return;if(help.showModal)help.showModal();else help.setAttribute('open','')}
function closeHelp(){if(!help||!help.open)return;if(help.close)help.close();else help.removeAttribute('open')}
if(opener)opener.addEventListener('click',openHelp);
if(closer)closer.addEventListener('click',closeHelp);
// A native dialog fills the whole top layer, so a click landing on the element
// itself is a click on the backdrop rather than on anything inside it.
if(help)help.addEventListener('click',function(e){if(e.target===help)closeHelp()});
document.addEventListener('keydown',function(e){
var t=e.target;
if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;
if((e.key==='?'||e.key==='/')&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();if(help&&help.open)closeHelp();else openHelp();return;}
if(e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;
if(help&&help.open)return;
var sel=map[e.key];if(!sel)return;
var a=document.querySelector(sel);if(!a||!a.href)return;
e.preventDefault();location.href=a.href;});
})()`;

const TOGGLE_SCRIPT = `(function(){var b=document.querySelector("[data-theme-toggle]");if(!b)return;var order=["auto","light","dark"];var icons=${JSON.stringify(THEME_ICON)};
function current(){try{return localStorage.getItem("theme")||"auto"}catch(e){return "auto"}}
function paint(v){b.innerHTML=icons[v];b.title="Theme: "+v;b.setAttribute("aria-label","Theme: "+v+". Click to change.");if(v==="auto")delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=v}
paint(current());
b.addEventListener("click",function(){var v=order[(order.indexOf(current())+1)%3];try{localStorage.setItem("theme",v)}catch(e){}paint(v)})})()`;

function siteFooter(cfg: SiteConfig): string {
  // RSS is the site's own and always there; everything after it points somewhere
  // else and belongs to whoever owns the site, so it comes from the config.
  const links = [
    `<a href="/feed.xml">RSS</a>`,
    ...(cfg.site.links ?? []).map(
      (link) => `<a href="${esc(link.href)}">${esc(link.label)}</a>`,
    ),
  ].join("");

  const year = new Date().getFullYear();

  return `<footer class="bar site-footer">
<p class="brand">&copy; ${year}. All Rights Reserved. <a href="/" title="Home (H)">${esc(cfg.site.title)}</a>.</p>
<nav class="bar-nav">${links}${HELP_BUTTON}${THEME_TOGGLE}</nav>
</footer>`;
}

function layout({
  cfg,
  title,
  description,
  path,
  body,
  head = "",
  edit = "",
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
<link rel="stylesheet" href="${stylesheetHref}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="website">
${head}<script>${THEME_SCRIPT}</script>
</head>
<body>
<main>
${body}
</main>
${siteFooter(cfg)}
${HELP}
<script>${TOGGLE_SCRIPT}</script>
<script>${KEYS_SCRIPT}</script>
<script>${SORT_SCRIPT}</script>
${edit}</body>
</html>
`;
}

function albumPath(album: Album): string {
  return `/album/${album.path}/`;
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

/**
 * The album's sort toggle. It moves the tiles rather than reordering them with
 * flexbox `order`, because `order` is visual only: the tab order would keep
 * running the other way, and a gallery whose focus ring jumps to the far end of
 * the page is worse than no toggle at all.
 *
 * Reordering also invalidates what the build decided about loading, so the tiles
 * that are now at the top are marked eager. Without that, a reversed page opens
 * with a screenful of images the browser has been told it may defer — and
 * sometimes defers forever. See the eager/lazy note in docs/design.md.
 *
 * The choice is remembered across albums. Someone who wants to read an album
 * oldest first almost certainly wants the next one that way too.
 */
const SORT_SCRIPT = `(function(){var b=document.querySelector("[data-sort-toggle]"),g=document.querySelector(".grid");if(!b||!g)return;
var icons=${JSON.stringify(SORT_ICON)},labels=${JSON.stringify(SORT_LABEL)},now="newest";
function stored(){try{return localStorage.getItem("album-sort")==="oldest"?"oldest":"newest"}catch(e){return "newest"}}
function paint(v){b.innerHTML=icons[v];b.title=labels[v];b.setAttribute("aria-label","Sorted "+labels[v].toLowerCase()+". Click to reverse.")}
function set(v){if(v!==now){var c=[].slice.call(g.children).reverse();for(var i=0;i<c.length;i++)g.appendChild(c[i]);now=v;
var m=g.querySelectorAll("img");for(var j=0;j<${EAGER_TILES}&&j<m.length;j++)m[j].loading="eager"}
paint(v)}
set(stored());
b.addEventListener("click",function(){var v=now==="newest"?"oldest":"newest";try{localStorage.setItem("album-sort",v)}catch(e){}set(v)})})()`;

function coverImage(cfg: SiteConfig, album: Album, item: Item): string {
  return item.kind === "video"
    ? posterThumbUrl(cfg, album.slug, item, "wide")
    : thumbUrl(cfg, album.slug, item.file, "wide");
}

/**
 * Audio has no picture of its own, so every clip shares one. A waveform says
 * what it is at a glance and the play disc says it goes somewhere — the tile is
 * a link to the item page, not a player. Inline rather than a file in `assets/`
 * because it is drawn in the page's own colours, and the theme toggle is a
 * `data-theme` attribute an `<img>` would never see.
 */
const AUDIO_ART = `<svg class="audio-art" viewBox="0 0 64 48" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
<rect class="audio-art-bg" width="64" height="48"/>
<g class="audio-art-wave">${[8, 15, 22, 30, 19, 26, 36, 26, 19, 30, 22, 15, 8]
  .map(
    (h, i) =>
      `<rect x="${6 + i * 4}" y="${24 - h / 2}" width="2" height="${h}" rx="1"/>`,
  )
  .join("")}</g>
<circle class="audio-art-disc" cx="32" cy="24" r="10"/>
<path class="audio-art-play" d="M29 18.5v11l9-5.5z"/>
</svg>`;

function tile(cfg: SiteConfig, album: Album, item: Item, index: number): string {
  const href = itemPath(item);
  const alt = esc(altFor(item));

  const orientation = orientationOf(item);
  // The ratio drives both the crop and the row maths: an item's flex-basis and
  // flex-grow are both proportional to it, so every item in a row lands on the
  // same height and the row fills the width exactly.
  const cell = `class="cell" style="--ar:${orientation === "wide" ? "1.3333" : "0.75"}"`;

  if (item.kind === "audio") {
    return `<li ${cell}><a class="tile" href="${href}" aria-label="${esc(item.title ?? item.file)}">
${AUDIO_ART}
<span class="badge">Audio</span>
</a></li>`;
  }

  const { width, height } = thumbSize(cfg, orientation);
  const src =
    item.kind === "video"
      ? esc(posterThumbUrl(cfg, album.slug, item, orientation))
      : esc(thumbUrl(cfg, album.slug, item.file, orientation));
  const badge = item.kind === "video" ? `<span class="badge">Video</span>` : "";

  return `<li ${cell}><a class="tile" href="${href}">
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

/**
 * "Calcutta, India (1945-46)" — the album named the way the item page names it.
 * Location and dates are both optional and simply absent when the album has none.
 */
function albumCaption(album: Album): string {
  const location = album.meta.location ? `, ${album.meta.location}` : "";
  const dates = album.meta.date
    ? ` (${formatDate(album.meta.date, album.meta.date_end)})`
    : "";
  return `${album.meta.title}${location}${dates}`;
}

/**
 * The tools that sit on the album title's line. Sorting is the only one so far.
 *
 * It is rendered in its default state and corrected by script, the way the theme
 * control is — there is no server-side memory of a choice on a static site. An
 * album of one has nothing to reorder, so it gets no toolbar at all.
 *
 * The state is carried by the icon and by `title`, never by a visible word:
 * "Newest first" and "Oldest first" are different widths, so a text label moved
 * the button — and therefore the icon — every time it was pressed.
 */
function albumTools(album: Album): string {
  if (album.items.length < 2) return "";
  return `<div class="album-tools">
<button type="button" class="tool" data-sort-toggle title="${SORT_LABEL.newest}" aria-label="Sorted newest first. Click to reverse.">${SORT_ICON.newest}</button>
</div>`;
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
  // An album whose cover is a sound has no picture to crop, so it wears the same
  // artwork its tile does rather than asking the edge to resize an mp3.
  const art = !cover
    ? ""
    : cover.kind === "audio"
      ? AUDIO_ART
      : `<img src="${esc(coverImage(cfg, album, cover))}" alt="${esc(cover.alt ?? album.meta.title)}" width="${thumbSize(cfg, "wide").width}" height="${thumbSize(cfg, "wide").height}"${loadingAttrs(index)} decoding="async">`;

  return `<li class="album-item">
<a class="tile" href="${href}">${art}</a>
<h3><a href="${href}">${esc(album.meta.title)}</a></h3>
<p class="meta">${albumSubtitle(album)}</p>
</li>`;
}

export function renderHome(cfg: SiteConfig, albums: Album[]): string {
  const albumSection =
    albums.length === 0
      ? `<p class="empty">No albums yet. Add one under <code>albums/</code> and run <code>npm run build</code>.</p>`
      : `<ul class="album-grid">
${albums.map((album, index) => albumCard(cfg, album, index)).join("\n")}
</ul>`;

  return layout({
    cfg,
    title: cfg.site.title,
    description: cfg.site.tagline,
    path: "/",
    body: albumSection,
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
  const description = album.description
    ? plainText(album.description)
    : `${album.meta.title} — ${cfg.site.title}`;
  return layout({
    cfg,
    title: `${album.meta.title} — ${cfg.site.title}`,
    description,
    path: albumPath(album),
    edit: cfg.media.local === true ? albumEditor(album) : "",
    body: `<div class="album-head">
<h1>${HOME_CRUMB}${esc(album.meta.title)}</h1>
${albumTools(album)}
</div>
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
       poster="${esc(posterUrl(cfg, album.slug, item))}"
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
    item.descriptionHtml
      ? `<div class="item-description">${item.descriptionHtml}</div>`
      : "",
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
    description: item.description ? plainText(item.description) : album.meta.title,
    path: itemPath(item),
    edit: cfg.media.local === true ? itemEditor(album, item) : "",
    body: `${stage(cfg, album, item)}
${itemMeta(item)}
<nav class="pager">
<p class="pager-crumb">${HOME_CRUMB}<a class="pager-album" href="${albumPath(album)}" title="Album (A)">${esc(albumCaption(album))}</a></p>
<span class="pager-icons">
${prev ? `<a class="icon" href="${itemPath(prev)}" rel="prev" aria-label="Previous" title="Previous (←)">${ICON.prev}</a>` : `<span class="icon is-off" aria-hidden="true">${ICON.prev}</span>`}
<a class="icon" href="/random/" aria-label="A random item" title="Random (R)">${ICON.random}</a>
${next ? `<a class="icon" href="${itemPath(next)}" rel="next" aria-label="Next" title="Next (→)">${ICON.next}</a>` : `<span class="icon is-off" aria-hidden="true">${ICON.next}</span>`}
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
