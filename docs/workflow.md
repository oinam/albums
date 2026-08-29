---
title: Adding an album
description: The everyday loop from a folder of photos to a deployed page.
---

# Adding an album

## 1. Stage the files

Put the originals in a folder under `_incoming/`, named `YYYY-MM-DD-album-title`.
Use `01` for a day or month you do not know — see [Album metadata](/album-metadata/):

```
_incoming/2005-06-14-macromedia-lego-team/
  dsc_0142.jpg
  dsc_0147.jpg
  hallway.mp4
  standup.m4a
```

`_incoming/` is gitignored. Unprocessed originals never enter the repository — they
go to R2 and stay there.

**Consider staging outside the repository.** `_incoming/` is ignored by git, which
also means `git clean -xdf` deletes it without asking. Set `ALBUMS_STAGING` in
`mise.local.toml` to a path anywhere on disk — a photo library, an external drive —
and the originals no longer depend on the repository surviving:

```toml
ALBUMS_STAGING = "/Users/brajeshwar/Pictures/oinam-albums"
```

The layout inside it is the same: one folder per album, named `YYYY-MM-DD-title`.

Upload files exactly as the camera wrote them. Full resolution, no pre-processing,
no format conversion. JPEG, PNG, GIF, WebP and HEIC all work as-is.

## 2. Ingest

```bash
mise run ingest
```

For each file this reads the dimensions and EXIF, assigns a permanent media id,
uploads to R2, and writes `albums/<slug>/photos.json`. It creates `album.md` the
first time with the title and date guessed from the folder name.

Useful flags:

```bash
mise run ingest -- --album 2005-06-14-macromedia-lego-team   # just one album
mise run ingest -- 2005-06-14-macromedia-lego-team           # the same, bare
mise run ingest -- --no-upload                               # metadata only, no R2, no credentials
```

`--album` may be repeated, and `--album=name` works too. A name that is not staged
is an error listing what is, rather than a stack trace.

Re-running is safe. Existing entries keep their id and any wording you have written;
only dimensions and byte counts are refreshed. Files already in R2 at the same size
are not re-uploaded.

**Ingest never removes an item.** You only need to stage the files you are adding —
anything already in `photos.json` survives a run that did not see it, so you can
empty `_incoming/` whenever you like. To drop a photo, delete its entry by hand and
delete the object from R2.

## 3. Say something about it, or don't

Nothing is generated for you. Every item works with no words at all — the photo just
appears, and the page shows only what the file itself supplies.

When you do want to add something, open `albums/<slug>/photos.json` and fill in any
of four optional fields:

```json
{
  "id": "7hKp2mQ4x",
  "file": "dsc_0142.jpg",
  "title": "The Lego wall, half finished",
  "description": "Built over three afternoons and dismantled the following Monday.",
  "date": "2005-06-14",
  "location": "San Francisco, CA"
}
```

**Anything you leave out is not rendered.** No heading, no empty row, no placeholder,
and no falling back to the filename. A photo with no title has no title.

`date` overrides whatever EXIF claimed, which matters for scans and for anything
whose camera clock was wrong. It also decides where the item sorts.

There is a fifth field, `alt`, for screen-reader text when the title alone is not
descriptive enough. Without it the alt falls back to the title, and then to empty —
which is correct, because a screen reader announcing "dsc_0142.jpg" is worse than
announcing nothing.

Ingest never touches any of these. Re-run it as often as you like.

## 4. Preview it locally

```bash
mise run dev
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
mise run dev -- --port=3000    # if 8788 is taken
```

A busy port is usually a previous `mise run dev` still holding it in another
terminal. The server says so in one line and stops, rather than throwing.

## Editing metadata while you look at it

`mise run dev` puts an **Edit** button in the corner of every album and item page.
It opens a panel holding exactly the fields described above — title, date,
description, alt and the highlight flag on an item; title, dates, location, cover
and description on an album — prefilled with what is there now. Save writes the
file, rebuilds, and reloads the page under you.

It writes through the same code ingest writes through, so a form edit and a hand
edit produce the same bytes and neither churns the other's output. Clearing a
field removes the key rather than storing an empty string. An item's `id` is never
part of the form.

**It is a development tool and it does not ship.** The panel is rendered only when
the build is in local mode, so `npm run build` emits no markup, no style, no
script and no `/_edit` reference anywhere in `dist/` — checked on every one of the
generated pages. The endpoint is equally narrow: it answers only a same-origin
JSON `POST` from the loopback interface, and the album name in the request is
matched against the directories that actually exist rather than being joined into
a path.

Two things it will not do. Frontmatter comments do not survive an edit, because
the file is rewritten rather than patched. And every value is written quoted —
`date: "2026-06-16"` rather than `date: 2026-06-16` — which is deliberate: bare
YAML turns that into a timestamp and a bare `1965` into a number.

Nothing about this changes the model. The files on disk are still the truth, git
still records the change, and the editor is only a faster way to type into them.

## 5. Build and push

```bash
mise run build
git add albums/ && git commit -m "Add Macromedia Lego team album" && git push
```

Cloudflare Pages picks up the push, runs `npm run build`, and serves `dist/`.
