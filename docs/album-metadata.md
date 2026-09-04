---
title: Album metadata
description: Every field in album.md and photos.json.
---

# Album metadata

Two files per album, both committed, both meant to be edited by hand.

## Naming the folder

One shape, always:

```
YYYY-MM-DD-album-title
2005-06-14-macromedia-lego-team
```

The first ten characters are yours. Everything after them is the album's name, in
lowercase, exactly as written — `2005-06-14-macromedia-lego-team` is served at
`/album/macromedia-lego-team/`.

The prefix is for sorting and nothing else. It is never displayed and never
reaches the URL. What a visitor reads is `date` in `album.md`, which is optional
and independent, so renaming a folder to move an album up the page does not
rewrite what the page says, and writing `1945-46` for readers does not scramble
the shelf.

Two separate questions get asked of that prefix, and they have different answers:

- **Is it shaped like a date?** Ten characters, `NNNN-NN-NN`, followed by a
  hyphen. If so it comes off the name, always.
- **Is it a real calendar date?** Only then does it also become a sort key.

Which is why `0000-00-00-unsorted` works and means what it looks like: it is
served at `/album/unsorted/`, and because there is no such day it contributes no
sort date, so the album falls back to its `album.md` date and sorts last without
one. Use `01` for a day or month you do not know; use `0000-00-00` for an album
that is not on the timeline at all.

Worth knowing, because it reads as a contradiction the first time: `0000-00-00`
puts the folder **first** in a directory listing and the album **last** on the
home page. Both are right. The listing sorts the characters; the page sorts by
date, newest first, and an album with no date goes to the end. For a drawer of
things that have not been filed yet, top of your folders and bottom of the page
is usually what you want. If you want it at the top of the page instead, give it
a `date` in `album.md` — the folder prefix does not have to carry that.

**A date after the prefix is deliberate and is kept.** `2026-06-16-london-2026jun`
is served at `/album/london-2026jun/`, which is how two visits to the same city
stay apart — `london-2026jun` and `london-2015jun-aug` are different albums with
different URLs. The build never strips a second date, because it cannot know
whether you meant it. You always do.

The part after the prefix has to be unique across albums, since it is the URL. The
build stops and names both folders if two of them collide there.

A folder with no prefix at all still works: the whole name becomes the URL, and
the album takes its order from `album.md` or sorts last.

The prefix used to accept month-only, year-only and two range forms, which sounds
more flexible and was worse: `2005-06-14-24-hours-in-tokyo` had no correct reading
— is `24` the end of a range or the start of the title? One shape removes the
question.

### The title is a starting point

Minor words stay lowercase inside the title and never at either end, so
`2005-06-14-a-day-in-imphal` becomes **A Day in Imphal**. That convention has more
exceptions than any word list can hold, so treat it as a first draft: `album.md` is
written once and is authoritative from then on. Correct it there and nothing
re-reads the folder name.

### An album can have no date

Comment `date` out and the album shows none — no date on its card, no date on its
page, and nothing contributed to the archive summary. Undated albums sort after
every dated one.

Leaving it out is a decision rather than an omission, and it is the right one for
an album that is a **place rather than an occasion**. A trip has dates and wants
them. A palace does not: the pictures were taken on some day, but the album is
about the building, and you will add more the next time you visit. Printing the
day of the first visit would date the album to a thing that was never the point,
and it would go stale the moment the album grows.

The folder prefix still carries a date, so the shelf stays ordered either way —
which is the whole reason ordering and display are separate fields.

### Dates in `album.md` can be less precise

The folder format is strict; the file it generates is not. Once written you can set
`date` to `YYYY-MM` or a bare `YYYY` and it will render as _Jun 2005_ or _2005_
rather than pretending to a day it does not know. Ranges work the same way through
`date_end`. Partial dates sort as their first day.

The field is also an escape hatch. A string the parser does not recognise is
printed exactly as written — `1945-46` for a span across two years, or
`circa 1945` — and sorts by its leading year, so ordering still holds.

## `albums/<slug>/album.md`

YAML frontmatter for the structured fields, Markdown below it for the description.
An item's `description` in `photos.json` is Markdown too, so the two read the same
way — write `[a link](https://example.com)` rather than an `<a>` tag, in either.

```markdown
---
title: Macromedia Lego Team
date: 2005-06-14
date_end: 2005-06-17
location: San Francisco, CA
cover: dsc_0142.jpg
---

The week we built half the office out of Lego. Nobody got any work done.
```

| Field      | Required | Notes                                                                                                                                                                                                 |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`    | yes      | Shown everywhere. Nothing derives from the folder name after the first ingest.                                                                                                                        |
| `date`     | no       | What readers see — nothing to do with ordering, which the folder name handles. `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, or free text like `1945-46`, printed as written. Omit it and the album shows no date. |
| `date_end` | no       | Makes it a range. Rendered as `Jun 14–17, 2005`.                                                                                                                                                      |
| `location` | no       | Free text, shown under the title.                                                                                                                                                                     |
| `cover`    | no       | Filename shown as the album's cover on the home page. Defaults to the first item.                                                                                                                     |

Everything below the frontmatter is Markdown and is rendered on the album page.
The ingest script writes this file once and never touches it again.

## `albums/<slug>/photos.json`

Two kinds of field: what ingest reads off the file, and what you choose to write.

```json
{
  "items": [
    {
      "id": "7hKp2mQ4x",
      "file": "dsc_0142.jpg",
      "kind": "photo",
      "bytes": 2795847,
      "width": 6000,
      "height": 4000,
      "taken": "2005-06-14T11:23:05",
      "camera": "NIKON D70",
      "lens": "18-70mm f/3.5-4.5",
      "settings": "35mm · f/5.6 · 1/125s · ISO 200",

      "title": "The Lego wall, half finished",
      "description": "Built over three afternoons and dismantled the following Monday.",
      "date": "2005-06-14",
      "location": "San Francisco, CA"
    }
  ]
}
```

### Written by ingest

| Field             | Notes                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `id`              | **A permalink.** Never change it after publishing — `/media/<id>/` depends on it.                                       |
| `file`            | The R2 object name within the album.                                                                                    |
| `width`, `height` | Read from the file header. Structural: they choose the 4:3 or 3:4 crop and reserve space before the image loads.        |
| `taken`           | EXIF capture time, `YYYY-MM-DDTHH:MM:SS`. Orders the item inside its album. Never shown, and never trusted over `date`. |

Nothing else. Camera, lens, exposure and file size used to be stored and shown; they
were data _about the photograph_ rather than about the picture, and they crowded out
the three things worth reading. `kind` is not stored either — it is the file
extension, and a second copy of it is only a second place to be wrong.

`taken` is the one survivor of that group, and it survives because it does a job
rather than fills a row: it is what puts an album in the order the pictures were
made. It is kept exactly as the camera wrote it — wall-clock time, no zone — so
ingesting the same photograph on a laptop in another country writes the same value.

**Treat it as a claim, not a fact.** A scan carries the date of the scan, an export
carries the date of the export, and a camera whose clock was never set carries
whatever it invented. `date` is the correction, and it always wins. If an album's
capture times are wrong in a way you care about, write `date` on **all** of its
items or on none — a handful of corrected items among uncorrected ones sorts as two
separate runs, because that is exactly what the data then says.

### Written by you

All optional. Ingest never touches them, so re-running it is always safe.

| Field         | Notes                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | Shown above the picture's caption block.                                                                                                        |
| `date`        | `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, or free text. Also places the item in the feed and in `/random/`; the album page orders by file, newest first. |
| `description` | A sentence or two under the title. **Markdown** — links, emphasis, more than one paragraph. Same as an album's.                                 |
| `alt`         | Screen-reader text. Falls back to `title`, then to empty.                                                                                       |

**Anything absent is not rendered.** An item with none of them is just a picture and
its navigation, which is usually the right answer.

## About the id

The id starts life as a base58 digest of `<slug>/<filename>`, then it is written down
and the file becomes the source of truth. It is never recomputed. That is deliberate:
a purely derived id would silently break every published link the first time you
corrected a typo in a folder name.

If two items ever collide, the build fails with both filenames rather than quietly
overwriting one page with the other. Change one id by hand.
