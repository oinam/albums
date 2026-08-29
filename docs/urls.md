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

## Thumbnails: two ratios, nothing else

Every thumbnail is **4:3 (wide)** or **3:4 (tall)** — no other shape exists.
A photo taller than it is wide gets the tall crop; everything else, including
every video and audio item, is wide.

| Orientation | Rendition | Displayed |
| ----------- | --------- | --------- |
| Wide (4:3)  | 640 × 480 | 320 × 240 |
| Tall (3:4)  | 480 × 640 | 240 × 320 |

The rendition is **twice** the display size, so thumbnails stay sharp on a 2×
screen. `sizes.thumb` in `site.config.json` is the long edge of the rendition; the
short edge is three quarters of it, which is what makes both ratios exact.

Wide and tall have identical area — 320 × 240 and 240 × 320 are both 76,800 px —
so a portrait carries the same visual weight as a landscape beside it. Each item
needs exactly one of the two, so having two shapes costs no more than having one.

## The masonry lattice

The two shapes share a factor of 80, which is what makes a pure-CSS masonry
possible: 320 = 4 × 80 and 240 = 3 × 80. So the album grid is an 80px lattice
where a wide tile spans 4 columns × 3 rows and a tall tile spans 3 × 4.

```css
.grid {
  grid-template-columns: repeat(auto-fill, var(--cell));
  grid-auto-rows: var(--cell);
  grid-auto-flow: row dense;
}
.cell--wide {
  grid-column: span 4;
  grid-row: span 3;
}
.cell--tall {
  grid-column: span 3;
  grid-row: span 4;
}
```

No JavaScript, no column-major reading order, and no library. Two details make it
work: `gap` is zero and the gutter is padding _inside_ each cell, so a span stays
an exact multiple of the cell; and `dense` backfills holes a mixed run of shapes
would otherwise leave.

`dense` is the one trade. It lets a later item slot into an earlier gap, so the
visual order can differ slightly from the file order. For an album grid that reads
as a wall rather than a sequence, packing is worth more than strict order.

Album covers are the exception: they are always wide, so the album list stays a
tidy uniform grid rather than a ragged one.

## The size ladder

Every distinct size is a separate transformation, and each one bills once per
calendar month it is requested. Flickr publishes about thirteen sizes per photo;
copying that would multiply the bill for no perceptible gain.

| Rung      | Size                   | Serves                                                                |
| --------- | ---------------------- | --------------------------------------------------------------------- |
| Thumbnail | 640 × 480 or 480 × 640 | Grid tiles and album covers                                           |
| Phone     | 800 wide               | First `srcset` candidate                                              |
| Desktop   | 1600 wide              | Second `srcset` candidate — tablets, desktops, Retina                 |
| Original  | —                      | Download link, straight from R2. No transformation, no egress charge. |

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
