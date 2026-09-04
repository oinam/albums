---
title: URLs and sizes
description: The Flickr-shaped routes, and the three-rung size ladder behind them.
---

# URLs and sizes

## Page routes

| Route            | Shows                             |
| ---------------- | --------------------------------- |
| `/`              | Every album, by cover picture     |
| `/album/{name}/` | One album                         |
| `/media/{id}/`   | One item — photo, video, or audio |

Three routes, and only one of them is a list. There is no separate `/albums/`
page: the home page _is_ the album index.

Two more routes are not pages:

| Route       | Serves                          |
| ----------- | ------------------------------- |
| `/random/`  | Redirects to one item at random |
| `/feed.xml` | RSS, the 50 most recent items   |

Albums run newest first, by the date prefix on the folder. An album with no usable
prefix — `0000-00-00-unsorted`, or a folder with no prefix at all — falls back to
its `album.md` date, and goes to the end if it has neither. Two albums with the
same date fall back to their titles, so the order never depends on what the
filesystem happened to return.

### Items run newest first too

Inside an album the newest picture is at the top left. Ingest reads each photo's
EXIF capture time into `taken`, and that is what orders them; a `date` you wrote by
hand beats it, because `taken` is only ever what the file claimed about itself.

For a phone album the two agree — the filenames already run in capture order, so
nothing moves. It earns its keep on everything else: Flickr exports, scans, and any
folder where `DSC_1969 (1).jpeg` sorts nowhere near when it was taken.

The item pager follows the same order, so `next` keeps moving down the page. The
album page can be flipped back to oldest first from the toggle on its title line —
that is a reading preference held in the browser, not a different page, and the
item pages keep the default order either way. See [Design](/design/).

### A file's own claim never moves it between albums

The feed and `/random/` place an album's whole run by the album's date, and order
the items inside that run the way the album page does. `taken` never reaches across
albums.

That restraint is load-bearing rather than fussy. One album here holds 103 pictures
of a place in 2018 whose files were re-saved in 2026; trusting their capture times
globally hands that album eighteen of the fifty slots in the feed and pushes a whole
newer album out of it. The folder date is a decision you made about where an album
belongs. What a JPEG says about itself is not.

The exception is an album with no date at all — `0000-00-00-unsorted`. It has no run
to sit in, so each of its items falls back to its own date, and things filed nowhere
still reach the feed at the right moment.

### Why there is no chronological stream

A paginated newest-first stream reads well, but it has a property worth avoiding
on a static site: **inserting one item rewrites every page.** A new photo at the
top pushes one item off the bottom of page one, onto page two, and so on down the
whole chain — so adding a single file changes the bytes of every page and
invalidates all of their caches.

A page of album covers has no such coupling. The home page changes when you add
an album. An album page changes when that album changes. Nothing else moves.

### Album covers

`cover:` in `album.md` names the file; without it the newest item is used — ingest
writes an explicit `cover:` for a new album, so the fallback is a safety net rather
than the usual path. Covers
are rendered at the same wide 4:3 size as landscape grid tiles, so they add no
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

### When a page does not exist

The build emits a `404.html`, which Cloudflare Pages serves with a real 404 status.

That file is not decoration. Without it Pages falls back to the site root and answers
**200** — the visitor sees the home page and every crawler is told the missing URL
exists. The local dev server returns a correct 404 either way, so this is a class of
bug that only shows up in production; it was found by checking the deployed site
rather than the preview.

### The album's name is not its folder

An album folder is `YYYY-MM-DD-album-title`, but the URL is only the part after
the date: `albums/1945-08-15-calcutta/` is served at `/album/calcutta/`. The date
is how you arrange the shelf, and arranging the shelf is not something a visitor
should have to read.

The folder name does not disappear — it is still the album's identity on disk and
still its prefix in R2, so renaming a folder to reorder the home page would move
every object in the bucket. Only the URL drops the date.

Two folders whose names match after the date — `2005-06-07-london` and
`2026-06-16-london` — would both want `/album/london/`. The build stops with both
folder names rather than writing one album over the other.

### Redirects

`/albums/`, `/album/`, `/media/` and `/photos/` all land on `/`. Per album, the
build emits a redirect from the bare name, from the older `/albums/{name}/` form,
and from the dated `/album/{folder}/` URLs that were published before the date
came out of them — so nothing published earlier breaks.

## The feed

`/feed.xml` is RSS 2.0 with two namespaces added, and it carries the picture —
a subscriber sees the photograph in their reader, not a link promising one.

| Element           | Carries                                                                           |
| ----------------- | --------------------------------------------------------------------------------- |
| `title` `link`    | The item, at its permalink                                                        |
| `guid`            | The permalink again, `isPermaLink="true"`                                         |
| `pubDate`         | The item's date, else its capture time, else its album's                          |
| `category`        | The album name, with the album URL in `domain`                                    |
| `description`     | Plain text. A summary, with the Markdown flattened out of it                      |
| `content:encoded` | The body a reader renders: the image, the caption as rendered Markdown, the album |
| `media:content`   | The media itself, with real dimensions                                            |
| `media:thumbnail` | The 4:3 or 3:4 grid thumbnail                                                     |

`description` stays plain text and `content:encoded` holds the HTML. That is the
split the spec intends — summary against full content — and it means a reader
showing only the summary gets a sentence rather than a mouthful of tags.

### What `media:content` points at

A photo is published as its **1600px rendition**, never the original. Two
reasons, and both matter:

- Renditions carry `metadata=none`. The original carries its full EXIF block,
  GPS included, and the site hands that out only behind a deliberate `Original`
  click. A feed pushes to everyone who subscribed, which is not the same act.
  See the privacy note at the end of this page.
- It is an existing rung of the ladder below, so it bills nothing new. A feed
  asking for some fourth width would add a transformation per photo per month.

Video and audio have no ladder — the original _is_ the media, and it is already
what the item page plays, so that is what the feed names.

A photo carries no `type`. The rendition is `format=auto`, so what comes back is
whatever the fetching client's `Accept` negotiated; naming `image/jpeg` would
pick one of three possible answers. Video and audio have a fixed encoding and do
carry theirs.

### Why there is no `enclosure`

RSS 2.0's `enclosure` requires a byte `length`, and nothing here stores one —
`photos.json` records dimensions, not file sizes. Media RSS makes `fileSize`
optional, so `media:content` says everything true without inventing a number.

### Reading the feed from another site

The feed is enough to build a photo grid elsewhere: `media:thumbnail` gives a
URL and its exact dimensions, `category` groups by album, and `link` is where a
tile should point. A consumer should use those URLs **verbatim** rather than
composing its own `/cdn-cgi/image/` widths, for the billing reason above.

The cap is 50 items, so a consumer sees the recent stream, not the archive.

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

## How the two shapes are laid out

Two ratios and nothing else is what lets the grid be a justified gallery — rows
flush at both edges, every item in a row the same height, no JavaScript and no
library. Each item carries its ratio as `--ar` and gets a `flex-basis` and
`flex-grow` proportional to it; [Design](/design/) has the mechanism.

An earlier version packed the same two shapes into an 80px CSS-grid lattice with
`grid-auto-flow: dense`. It filled the width, but `dense` let a later item slot
into an earlier gap, so the visual order drifted from the file order — which is
the wrong trade for a grid that is now explicitly sorted by when each picture was
taken. The justified layout reads strictly left to right.

Album covers are the exception to the two shapes: they are always wide, so the
album list stays a tidy uniform grid rather than a ragged one.

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
