---
title: URLs and sizes
description: The Flickr-shaped routes, and the three-rung size ladder behind them.
---

# URLs and sizes

## Page routes

| Route            | Shows                                         |
| ---------------- | --------------------------------------------- |
| `/`              | Highlights, then every album by cover picture |
| `/album/{slug}/` | One album                                     |
| `/media/{id}/`   | One item — photo, video, or audio             |

Three routes, and only one of them is a list. There is no separate `/albums/`
page: the home page _is_ the album index, with a curated strip of highlights
above it.

### Why there is no chronological stream

A paginated newest-first stream reads well, but it has a property worth avoiding
on a static site: **inserting one item rewrites every page.** A new photo at the
top pushes one item off the bottom of page one, onto page two, and so on down the
whole chain — so adding a single file changes the bytes of every page and
invalidates all of their caches.

Highlights plus album covers has no such coupling. The home page changes when you
mark a highlight or add an album. An album page changes when that album changes.
Nothing else moves.

### Highlights

Set `"highlight": true` on any item in `photos.json`. The home page shows the most
recent `site.highlights` of them (default 12), newest first. Mark none and the
section is omitted entirely — the home page is then just albums.

### Album covers

`cover:` in `album.md` names the file; without it the first item is used. Covers
are rendered at the same square contact size as grid tiles, so they add no
transformation beyond the three rungs below.

### Pagination

None yet, deliberately. Albums are few and the home page lists them all. Past
roughly a hundred albums it will want paging — that is the point to add it, and
only there.

Segments are singular where the page shows one thing. `media` is a mass noun, so
the scheme needs no plural anywhere.

### Why one route for photos, video, and audio

`/photo/{id}/`, `/video/{id}/` and `/audio/{id}/` would each be self-describing, and
that is the obvious design. It was rejected for one reason: **it puts the media type
inside the permalink.** Re-encode a `.mov` as an `.mp4`, or replace a clip with the
still you actually wanted, and the id survives but the URL moves. A permalink that
depends on a file's current encoding is not a permalink.

`/media/{id}/` costs a little description — you cannot tell from the URL what kind
of thing you are about to see — and buys an address that never moves. The id was
already opaque, so the loss is smaller than it first looks.

### Redirects

`/albums/`, `/album/`, `/media/` and `/photos/` all land on `/`. Per album, the
build emits a redirect from the bare slug and from the older `/albums/{slug}/`
form, so nothing published earlier breaks.

## The size ladder

Every distinct width is a separate transformation, and each one bills once per
calendar month it is requested. Flickr publishes about thirteen sizes per photo;
copying that would multiply the bill for no perceptible gain. Three rungs plus the
untouched original covers every screen.

| Rung     | Width | Serves                                                                |
| -------- | ----- | --------------------------------------------------------------------- |
| Contact  | 400   | Album grid tiles — 400px covers 200 CSS px at 2×                      |
| Phone    | 800   | First `srcset` candidate                                              |
| Desktop  | 1600  | Second `srcset` candidate — tablets, desktops, Retina                 |
| Original | —     | Download link, straight from R2. No transformation, no egress charge. |

Widths come from `site.config.json` under `sizes`.

## How one file becomes every screen

Two independent axes, both controlled from the markup:

**Dimensions** come from ordinary `srcset`. The browser picks the candidate that
fits its viewport and pixel density; a phone fetches the 800px rendition and a
Retina desktop fetches the 1600px one. Neither downloads the other.

**Format** comes from `format=auto`, which reads the browser's `Accept` header and
serves AVIF, WebP, or JPEG from the same URL. No `<picture>` element is needed, and
all three formats bill as a **single** transformation — format optimization is free.

Never hardcode `format=avif`: forcing it caps output dimensions far below the normal
ceiling. `auto` sidesteps the question and still delivers AVIF where it helps.

## Privacy note

Every rendition carries `metadata=none`, which strips EXIF — including GPS
coordinates. The original does not. The `Original` link on each photo page serves
the untouched file straight from R2, with its full EXIF block intact.

That is a choice, and it should be a deliberate one. If it isn't what you want,
strip EXIF from the files before they go into `_incoming/`.
