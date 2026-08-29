---
title: Album metadata
description: Every field in album.md and photos.json.
---

# Album metadata

Two files per album, both committed, both meant to be edited by hand.

## `albums/<slug>/album.md`

YAML frontmatter for the structured fields, Markdown below it for the description.

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

| Field      | Required | Notes                                                                             |
| ---------- | -------- | --------------------------------------------------------------------------------- |
| `title`    | yes      | Shown everywhere. Nothing derives from the folder name after the first ingest.    |
| `date`     | yes      | `YYYY-MM-DD`. Sorts the album on the home page and supplies its year heading.     |
| `date_end` | no       | Makes it a range. Rendered as `Jun 14–17, 2005`.                                  |
| `location` | no       | Free text, shown under the title.                                                 |
| `cover`    | no       | Filename shown as the album's cover on the home page. Defaults to the first item. |

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
      "location": "San Francisco, CA",
      "highlight": true
    }
  ]
}
```

### Written by ingest

| Field                                 | Notes                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `id`                                  | **A permalink.** Never change it after publishing — `/media/<id>/` depends on it. |
| `file`                                | The R2 object name within the album.                                              |
| `kind`                                | `photo`, `video`, or `audio`, from the extension.                                 |
| `bytes`, `width`, `height`            | Read from the file header, not EXIF. Refreshed every run.                         |
| `taken`, `camera`, `lens`, `settings` | From EXIF, omitted when the file has none.                                        |
| `duration`                            | Seconds, for video and audio. Needs ffprobe; omitted without it.                  |

### Written by you

All optional. Ingest never touches them, so re-running it is always safe.

| Field         | Notes                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `title`       | Becomes the page heading. Without it there is no heading.                                                                 |
| `description` | A sentence or two under the image.                                                                                        |
| `date`        | `YYYY-MM-DD`. Overrides `taken` for display and for ordering — the field to reach for with scans and wrong camera clocks. |
| `location`    | Free text.                                                                                                                |
| `alt`         | Screen-reader text. Falls back to `title`, then to empty.                                                                 |
| `highlight`   | `true` puts it on the home page.                                                                                          |

**Anything absent is not rendered.** No heading, no empty row, no placeholder, and
never the filename standing in for a title. A photo with nothing written about it is
just a photograph, which is usually the right answer.

## About the id

The id starts life as a base58 digest of `<slug>/<filename>`, then it is written down
and the file becomes the source of truth. It is never recomputed. That is deliberate:
a purely derived id would silently break every published link the first time you
corrected a typo in a folder name.

If two items ever collide, the build fails with both filenames rather than quietly
overwriting one page with the other. Change one id by hand.
