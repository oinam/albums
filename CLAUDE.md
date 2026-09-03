# albums.oinam.com

A static photo, video, and audio album running entirely on Cloudflare. Originals in
R2, renditions from `/cdn-cgi/image/`, static HTML deployed by Cloudflare Pages.

**The documentation is in `docs/`, and it is the source of truth.** Read it before
changing anything; keep it current when you do. This file stays short on purpose.

- `docs/workflow.md` — the stage → ingest → build loop
- `docs/album-metadata.md` — every field in `album.md` and `photos.json`
- `docs/urls.md` — routes, the size ladder, the EXIF privacy note
- `docs/architecture.md` — why each piece sits where it does
- `docs/deploy.md` — Cloudflare setup
- `docs/costs.md` — the bill and what moves it

## Rules

- **`README.md` belongs to Brajeshwar.** Read it; never edit it unless he says so.
  It is excluded from Prettier for the same reason.
- **Write for a public audience.** This repository is meant to be given away. Clean,
  precise, linted.
- **Comment less.** If something needs explaining, explain it in `docs/`, not in a
  comment. Comments in the source are reserved for the non-obvious _why_.
- **Never change a published `id` in `photos.json`.** It is a permalink.
- **Commit each meaningful change; never push.** Pushing happens at a release
  point, and only when Brajeshwar asks for it.
- **Unprocessed originals never enter the repository.** They stage in `_incoming/`
  (gitignored), go to R2, and only their metadata is committed.
- **The code is MIT; the pictures are not.** `LICENSE` covers the software,
  `LICENSE-MEDIA.md` reserves the media and the album text. Keep the two apart — the
  licence file is not the place for a note about photographs.

## Commands

```bash
mise run ingest     # _incoming/ → EXIF → R2 → photos.json   (needs mise.local.toml)
mise run dev        # local preview on :8788, watches + rebuilds
mise run build      # → dist/                                (no credentials)
mise run doctor     # is Cloudflare wired up correctly?      (needs mise.local.toml)
mise run check      # types + lint + formatting + docs links
mise run docs       # ovellum build
```

Secrets live in `mise.local.toml` (gitignored), never a `.env` file — mise owns env
and tooling for this project. The npm scripts still exist because Cloudflare Pages
runs `npm run build` and knows nothing about mise.

`npm run build` must never require a secret — Pages runs it with none.

`npm run dev` builds with `--local`, which rewrites every media URL to `/media/...`
and has the dev server render the renditions Cloudflare would. Production output is
unaffected; see `docs/workflow.md`.

## /odo

- Queue: `~/_/Oinam/1-Projects/devCommands/oinam.com-albums.md`
- Log: `~/_/Oinam/1-Projects/devLogs/oinam.com-albums.md`
