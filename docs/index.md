---
title: Overview
description: A static photo, video, and audio album that runs entirely on Cloudflare.
---

# albums.oinam.com

A personal media archive that runs on nothing but Cloudflare. Originals live in R2.
Cloudflare renders every screen size and format at the edge. The site itself is plain
static HTML, generated on your machine and deployed by pushing to GitHub.

## The shape of it

| Layer                            | What holds it                                              |
| -------------------------------- | ---------------------------------------------------------- |
| Originals — photos, video, audio | R2, in `albums/<slug>/` keys                               |
| Photo renditions                 | Images transformations, `/cdn-cgi/image/`                  |
| Video posters                    | Media Transformations, `/cdn-cgi/media/`                   |
| Album and photo metadata         | `album.md` + `photos.json`, committed to this repo         |
| The site                         | Static HTML built into `dist/`, served by Cloudflare Pages |

Nothing is generated at upload time and no derivative is ever written back into R2.
The edge cache is the derivative store, and it refills itself on demand.

## Four commands

```bash
npm run ingest     # stage → EXIF → R2, writes photos.json
npm run describe   # Claude writes titles, alt text, captions
npm run dev        # local preview on http://localhost:8788
npm run build      # renders dist/
```

Then commit and push. Cloudflare Pages does the rest.

## Where to go next

- [Adding an album](/workflow/) — the everyday loop.
- [Album metadata](/album-metadata/) — every field you can edit by hand.
- [URLs and sizes](/urls/) — the Flickr-shaped routes and the size ladder.
- [Architecture](/architecture/) — why each piece is where it is.
- [Deploying](/deploy/) — Cloudflare setup, start to finish.
- [What it costs](/costs/) — the bill, with the arithmetic shown.
