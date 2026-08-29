---
title: URLs and sizes
description: The Flickr-shaped routes, and the three-rung size ladder behind them.
---

# URLs and sizes

## Page routes

| Route            | Shows                                             |
| ---------------- | ------------------------------------------------- |
| `/`              | Everything, newest first — page one of the stream |
| `/page/{n}/`     | The rest of the stream                            |
| `/albums/`       | Every album, grouped by year                      |
| `/album/{slug}/` | One album                                         |
| `/media/{id}/`   | One item — photo, video, or audio                 |

The root is the stream, not the album index. That follows Flickr, where a person's
default view is their photostream and albums are a curation layer on top of it.
`/albums/` is one click away and linked from every stream page.

Segments are singular where the page shows one thing and plural where it lists many.
`media` is a mass noun, so it needs no plural at all.

### Pagination, not infinite scroll

Page size is `site.pageSize` in `site.config.json`, default 60. Every page is a real
URL, so it can be linked, bookmarked, and crawled; the back button lands where you
left; and none of it needs JavaScript. `rel="prev"` and `rel="next"` are emitted for
crawlers.

### Ordering

The stream is ordered by capture time where EXIF supplied one, and by the album's
start date otherwise — so undated scans still land in the right stretch of the
timeline rather than clumping at the epoch.

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

`/album/` lands on `/albums/`, and `/media/` and `/photos/` land on `/`. Per album,
the build emits a redirect from the bare slug and from the older `/albums/{slug}/`
form — which matters because `/albums/` and `/album/{slug}/` are one letter apart,
and the redirect is what stops that being a trap.

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
