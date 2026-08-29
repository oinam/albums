---
title: Adding an album
description: The everyday loop from a folder of photos to a deployed page.
---

# Adding an album

## 1. Stage the files

Put the originals in a folder under `_incoming/`, named `YYYY-MM-DD-some-title`:

```
_incoming/2005-06-14-macromedia-lego-team/
  dsc_0142.jpg
  dsc_0147.jpg
  hallway.mp4
  standup.m4a
```

`_incoming/` is gitignored. Unprocessed originals never enter the repository — they
go to R2 and stay there.

Upload files exactly as the camera wrote them. Full resolution, no pre-processing,
no format conversion. JPEG, PNG, GIF, WebP and HEIC all work as-is.

## 2. Ingest

```bash
npm run ingest
```

For each file this reads the dimensions and EXIF, assigns a permanent media id,
uploads to R2, and writes `albums/<slug>/photos.json`. It creates `album.md` the
first time with the title and date guessed from the folder name.

Useful flags:

```bash
npm run ingest -- 2005-06-14-macromedia-lego-team   # just one album
npm run ingest -- --no-upload                       # metadata only, no R2, no credentials
```

Re-running is safe. Existing entries keep their id and any wording you have written;
only dimensions and byte counts are refreshed. Files already in R2 at the same size
are not re-uploaded.

**Ingest never removes an item.** You only need to stage the files you are adding —
anything already in `photos.json` survives a run that did not see it, so you can
empty `_incoming/` whenever you like. To drop a photo, delete its entry by hand and
delete the object from R2.

## 3. Describe

```bash
npm run describe -- --dry-run   # list what would be sent, spend nothing
npm run describe                # generate titles, alt text, captions, keywords
```

This sends each image to Claude and writes the result back into `photos.json`.
It reads the image through the `/cdn-cgi/image/` URL at 1024px wide, so the album
must already be uploaded and `media.oinam.com` must be reachable.

Videos are described from their poster frame. Audio is skipped.

**Video and audio metadata is optional.** If `ffprobe` is on your PATH, ingest also
records duration and pixel dimensions for those files. It is not a dependency of
this project — without it those fields are simply left empty and everything else
works the same.

## 4. Edit anything you disagree with

Open `albums/<slug>/album.md` and `albums/<slug>/photos.json` and change whatever
you like. To stop an item being regenerated, set `"edited": true` on it:

```json
{
  "id": "7hKp2mQ4x",
  "file": "dsc_0142.jpg",
  "title": "The Lego wall, half finished",
  "edited": true
}
```

`npm run describe` skips every item marked that way, even with `--force`.

## 5. Preview it locally

```bash
npm run dev
```

Then open <http://localhost:8788>. The whole site is there — album pages, photo
pages, the album pages, and the redirects — with live rebuilds when you edit
`albums/` or `assets/`, and a full restart when you edit `scripts/`.

**Media works offline.** Production reads renditions from `/cdn-cgi/image/` on
Cloudflare, which does not exist on your machine, so the dev server stands in for
it: `/media/...` maps to your staged originals in `_incoming/`, and the same three
widths are rendered on demand with sharp and cached in `.dev-cache/`. A grid tile
arrives at about 14 KB rather than dragging a 5 MB original over the wire.

Two things the local preview cannot show you:

- **Format negotiation.** Locally every rendition is JPEG. `format=auto` only picks
  AVIF or WebP at the edge, so real-world payloads are smaller than what you see.
- **Video posters.** `mode=frame` is a Media Transformation. Locally a video tile
  gets a neutral play-symbol placeholder instead.

Media only appears for albums you still have staged. `_incoming/` is gitignored, so
a fresh clone previews with empty tiles until you put something in it — the layout
is all still there.

```bash
npm run dev -- --port=3000    # if 8788 is taken
```

## 6. Build and push

```bash
npm run build
git add albums/ && git commit -m "Add Macromedia Lego team album" && git push
```

Cloudflare Pages picks up the push, runs `npm run build`, and serves `dist/`.
