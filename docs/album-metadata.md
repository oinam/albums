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
      "alt": "A partition of interlocking plastic bricks dividing an open-plan office.",
      "caption": "Built over three afternoons and dismantled the following Monday.",
      "keywords": ["office", "lego", "construction"],
      "generated": true,
      "edited": false
    }
  ]
}
```

| Field                                 | Written by        | Notes                                                                             |
| ------------------------------------- | ----------------- | --------------------------------------------------------------------------------- |
| `id`                                  | ingest, once      | **A permalink.** Never change it after publishing — `/media/<id>/` depends on it. |
| `file`                                | ingest            | The R2 object name within the album.                                              |
| `kind`                                | ingest            | `photo`, `video`, or `audio`, from the extension.                                 |
| `bytes`, `width`, `height`            | ingest, every run | Read from the file header, not EXIF.                                              |
| `taken`, `camera`, `lens`, `settings` | ingest            | From EXIF, omitted when absent.                                                   |
| `title`, `alt`, `caption`, `keywords` | describe          | Yours to overwrite.                                                               |
| `generated`                           | describe          | Marks machine-written wording.                                                    |
| `edited`                              | you               | Set `true` to freeze an item against regeneration.                                |
| `highlight`                           | you               | Set `true` to surface it on the home page.                                        |

## About the id

The id starts life as a base58 digest of `<slug>/<filename>`, then it is written down
and the file becomes the source of truth. It is never recomputed. That is deliberate:
a purely derived id would silently break every published link the first time you
corrected a typo in a folder name.

If two items ever collide, the build fails with both filenames rather than quietly
overwriting one page with the other. Change one id by hand.
