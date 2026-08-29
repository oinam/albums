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
  dev.ts          local preview server: static files, renditions, watch
  ingest.ts       _incoming/ → dimensions + EXIF → R2 → photos.json
  describe.ts     photos.json → Claude → titles, alt text, captions
  lib/
    albums.ts     album.md + photos.json loading, ordering, orientation
    config.ts     site.config.json and environment
    dimensions.ts pixel dimensions from file headers
    ids.ts        stable base58 media ids
    media.ts      every media URL the site emits
    mime.ts       content types, shared by R2 upload and the dev server
    probe.ts      optional ffprobe read of duration and dimensions
    r2.ts         S3-compatible R2 client
    site.ts       the build itself — every page written into dist/
    templates.ts  HTML
assets/site.css   the whole stylesheet
```

`dimensions.ts` reads the container header rather than EXIF on purpose. Exported and
edited files routinely carry an ICC profile and no camera tags at all, so EXIF
cannot be trusted for something the layout depends on.
