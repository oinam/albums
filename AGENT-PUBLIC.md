# Working on this repository

Rename this file to `CLAUDE.md` or `AGENT.md` and your coding agent will read it
every session. It is the starting prompt for a fork: what you have, what to change
first, and the rules worth keeping.

## What this is

A static photo, video and audio album that runs entirely on Cloudflare. Originals
live in R2. Renditions come from `/cdn-cgi/image/` at request time — nothing is
pre-generated and no derivative is ever written back into the bucket. The site
itself is plain HTML, built on your machine into `dist/` and deployed by Cloudflare
Pages.

There is no database, no CMS and no admin. An album is a folder, its metadata is
two files beside the pictures, and both are committed. `git push` is the deploy.

**`docs/` is the source of truth, not this file.** Read it before changing
anything, and keep it current when you do:

| Page                     | Covers                                              |
| ------------------------ | --------------------------------------------------- |
| `docs/workflow.md`       | The stage → ingest → build loop, and the editor     |
| `docs/album-metadata.md` | Every field in `album.md` and `photos.json`         |
| `docs/urls.md`           | Routes, the size ladder, ordering, the feed         |
| `docs/design.md`         | The interface rules and why each one holds          |
| `docs/architecture.md`   | Why each piece sits where it does, and the file map |
| `docs/deploy.md`         | Cloudflare setup, start to finish                   |
| `docs/costs.md`          | The bill, with the arithmetic shown                 |

## Make it yours first

1. **`site.config.json`** is the whole of what is personal to a site — title, host,
   author, the media domain, the footer links, the three rendition sizes. Nothing
   else in the source names a domain or a person. `docs/deploy.md` has the table.
2. **`mise.local.toml`** holds your R2 credentials. Copy `mise.local.toml.example`,
   fill it in, then `mise trust`. It is gitignored and must stay that way.
3. **`mise run doctor`** answers whether Cloudflare is actually wired up — bucket,
   endpoint, read, write, the media domain and transformations — before you spend
   an upload finding out.
4. **Delete `albums/` and start your own.** The code is MIT (`LICENSE`), but the
   photographs and the writing about them are all rights reserved
   (`LICENSE-MEDIA.md`). Nothing in the build depends on the example albums existing.

## Commands

```bash
mise run ingest     # _incoming/ → EXIF → R2 → photos.json   (needs credentials)
mise run dev        # local preview on :8788, watches and rebuilds
mise run build      # → dist/                                (no credentials)
mise run doctor     # is Cloudflare wired up correctly?       (needs credentials)
mise run prune      # delete R2 prefixes no album claims       (dry run by default)
mise run check      # types, lint, formatting, docs links
```

The npm scripts still exist because Cloudflare Pages runs `npm run build` and knows
nothing about mise. **`npm run build` must never require a secret** — Pages runs it
with none, so anything needing credentials belongs in ingest, doctor or prune.

`npm run dev` builds with `--local`, which rewrites every media URL to `/media/...`
and has the dev server render the renditions Cloudflare would. Production output is
unaffected.

## Rules worth keeping

- **Never change a published `id` in `photos.json`.** It is a permalink. Ids are
  written once and are never recomputed, precisely so that renaming a folder or
  fixing a typo cannot break a link that is already out in the world.
- **Unprocessed originals never enter the repository.** They stage in `_incoming/`
  (gitignored), go to R2, and only their metadata is committed.
- **`docs/` explains; comments do not.** A comment in the source is for the
  non-obvious _why_ — the reason a line is written the way it is and not the
  obvious way. Everything else belongs in `docs/`, where it can be read in order.
- **`mise run check` before you commit.** Types, lint, formatting and the docs link
  checker. There is also a CSS linter that fails the build when the templates emit
  a class the stylesheet has no rule for — added because that failure is otherwise
  silent and survives for weeks.
- **Commit each meaningful change; do not push on someone's behalf.** Pushing is a
  deploy on this setup, and a deploy is a decision.

## Things that look like bugs and are not

- **Item ordering is a plain sort on capture time, and `date` beats it.** Ingest
  reads EXIF into a `taken` field, which is what the file _claims_ — a scan carries
  the date of the scan. A hand-written `date` in `photos.json` is the correction.
- **A file's own capture time never moves it between albums.** The album's folder
  date places its whole run in the feed. Trusting EXIF globally lets one album of
  re-saved originals crowd out every newer album. See `docs/urls.md`.
- **`taken` is stored as wall-clock with no timezone.** Do not revive it into a
  `Date` on read — that resolves it against whichever machine is running, so the
  same photograph gets a different answer in a different country.
- **The date prefix on an album folder is not in its URL.** `albums/2005-06-07-lego/`
  is served at `/album/lego/`. The prefix orders the shelf; a visitor never reads it.
- **`?` and `/` both open the shortcut panel.** Not a duplicate: the key handler
  rejects every modifier, `?` is Shift on most layouts, so it is tested before
  that guard and the unshifted key comes along for free.
- **The local editor is dev-only and must stay that way.** `npm run build` emits no
  editor markup, style, script or `/_edit` reference anywhere in `dist/`. It is
  also why `npm run dev` builds to `.dev-dist/` rather than `dist/` — the two
  outputs differ, and sharing a directory let a production build quietly strip the
  editor out from under a running dev server.
