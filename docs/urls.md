---
title: URLs and sizes
description: The Flickr-shaped routes, and the three-rung size ladder behind them.
---

# URLs and sizes

## Page routes

The grammar is Flickr's, minus the `/{user}/` segment — one host serves one person,
so repeating the name only lengthens every URL.

| Flickr | Here |
| --- | --- |
| `/photos/{user}/` | `/photos/` — everything, newest first |
| `/photos/{user}/albums/` | `/albums/` → redirects to `/` |
| `/photos/{user}/albums/{id}` | `/albums/2005-06-14-macromedia-lego-team/` |
| `/photos/{user}/{photo-id}` | `/photos/7hKp2mQ4x/` |
| `live.staticflickr.com/…_{size}.jpg` | `media.oinam.com/cdn-cgi/image/{params}/…` |

The build also emits a redirect per album from the bare slug, so
`/2005-06-14-macromedia-lego-team/` still resolves.

## The size ladder

Every distinct width is a separate transformation, and each one bills once per
calendar month it is requested. Flickr publishes about thirteen sizes per photo;
copying that would multiply the bill for no perceptible gain. Three rungs plus the
untouched original covers every screen.

| Rung | Width | Serves |
| --- | --- | --- |
| Contact | 400 | Album grid tiles — 400px covers 200 CSS px at 2× |
| Phone | 800 | First `srcset` candidate |
| Desktop | 1600 | Second `srcset` candidate — tablets, desktops, Retina |
| Original | — | Download link, straight from R2. No transformation, no egress charge. |

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
