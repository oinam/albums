---
title: URLs and sizes
description: The Flickr-shaped routes, and the three-rung size ladder behind them.
---

# URLs and sizes

## Page routes

The grammar is Flickr's, minus the `/{user}/` segment — one host serves one person,
so repeating the name only lengthens every URL.

| Flickr                               | Here                                       |
| ------------------------------------ | ------------------------------------------ |
| `/photos/{user}/`                    | `/` — every album, newest year first       |
| `/photos/{user}/albums/{id}`         | `/album/2005-06-14-macromedia-lego-team/`  |
| `/photos/{user}/{photo-id}`          | `/media/7hKp2mQ4x/`                        |
| —                                    | `/media/` — everything, newest first       |
| `live.staticflickr.com/…_{size}.jpg` | `media.oinam.com/cdn-cgi/image/{params}/…` |

Segments are singular where the page shows one thing, and `media` is a mass noun,
so nothing in the scheme needs a plural. `/media/` is the whole stream and
`/media/{id}/` is one item in it — the same segment, so a typo cannot land between
the two.

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

The build emits, per album, a redirect from the bare slug and from the older
`/albums/{slug}/` form. Three fixed rules cover the rest: `/albums/` and `/album/`
land on `/`, and `/photos/` lands on `/media/`.

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
