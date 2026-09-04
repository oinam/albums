---
title: Architecture
description: Why each piece sits where it does.
---

# Architecture

## Request path

```
browser → edge cache → Images transformation → R2 origin
             ↑ hit: served, no billing
```

No derivative is ever stored in R2. Cloudflare renders on first request, caches at
the edge, and re-renders if the cache evicts. The consequence is billing, not
capability: cost tracks traffic, not library size.

## Why the build runs on your machine

Cloudflare Pages serves what a build produced. An R2 upload event cannot regenerate
an already-deployed site — there is nothing for an event-triggered Worker to
rewrite. So the generator runs locally, its output is committed as metadata, and
Pages rebuilds from the push.

That is also why `photos.json` is committed. The build reads only the repository:
it needs no R2 credentials and no network. Ingest needs credentials; building does
not.

## Why not the hosted Images product

Cloudflare also sells storage _inside_ Images, served from
`imagedelivery.net/{hash}/{image-id}/{variant}`. It would replace album folders with
opaque image ids, which destroys the organizing principle this whole thing is built
on, and it adds a per-image storage charge for files already stored in R2. Zone
transformations against R2 keep the folders and cost less.

## Why videos are not on Stream

Stream is the obvious-looking choice and usually the wrong one here. A 500-minute
archive costs about $2.50/month to hold in Stream versus roughly $0.11/month as MP4s
in R2. Stream buys adaptive bitrate and a hosted player, not savings.

R2 supports range requests, so seeking works in a native `<video>` element. Media
Transformations supplies the poster frame at one transformation each.

Reach for Stream only when a specific video is long enough that adaptive bitrate
genuinely changes the experience. Media Transformations itself caps at 100 MB and
10 minutes of input, so anything larger is served directly from R2 regardless.

## Code layout

```
scripts/
  build.ts        entry point — loads config, calls buildSite
  dev.ts          local preview server: static files, renditions, watch, /_edit
                  builds to .dev-dist/, never dist/ — see workflow.md
  ingest.ts       _incoming/ → dimensions + EXIF → R2 → photos.json
  doctor.ts       checks R2, the media domain and transformations end to end
  prune.ts        deletes R2 prefixes no album claims any more
  lint-css.ts     fails the build if a class the templates emit has no rule
  lib/
    albums.ts     album.md + photos.json loading, ordering, orientation
    config.ts     site.config.json and environment
    dimensions.ts pixel dimensions from file headers
    editor.ts     the local metadata panel and cover picker — never in a real build
    feed.ts       RSS, with the picture in it
    ids.ts        stable base58 media ids
    media.ts      every media URL the site emits
    metadata.ts   the only writer of album.md and photos.json
    mime.ts       content types, shared by R2 upload and the dev server
    probe.ts      optional ffprobe read of video dimensions
    progress.ts   the one-line progress readout ingest prints while it works
    r2.ts         S3-compatible R2 client
    slug.ts       album folder name → date and title
    site.ts       the build itself — every page written into dist/
    templates.ts  HTML
assets/site.css   the whole stylesheet
```

`metadata.ts` is the single writer so that ingest and the local editor cannot
disagree about what a file on disk looks like. Two writers would mean each run of
one reformatting the other's output, and the diff noise would hide the real change.

`dimensions.ts` reads the container header rather than EXIF on purpose. Exported and
edited files routinely carry an ICC profile and no camera tags at all, so EXIF
cannot be trusted for something the layout depends on.

The header is the pixels as stored, though, which is not always the picture as
seen: EXIF orientations 5–8 turn it a quarter turn, and the stored dimensions have
to be swapped to match. That is the one thing the header cannot tell you, so the
orientation tag is read after all — as a **number**, which is why ingest asks exifr
for `translateValues: false`. Left on, exifr helpfully returns `"Rotate 90 CW"`
instead of `6`, the range check silently never matches, and a portrait photograph is
laid out in a landscape frame. Nothing in this archive was affected, because these
originals are all rotated upright before they are staged — which is exactly the kind
of bug that waits for the one file that is not.
