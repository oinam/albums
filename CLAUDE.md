# albums.oinam.com

A static photo, video, and audio album running entirely on Cloudflare. Originals in
R2, renditions from `/cdn-cgi/image/`, static HTML deployed by Cloudflare Pages.

**The documentation is in `docs/`, and it is the source of truth.** Read it before
changing anything; keep it current when you do. This file stays short on purpose.

- `docs/workflow.md` — the ingest → describe → build loop
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
- **Unprocessed originals never enter the repository.** They stage in `_incoming/`
  (gitignored), go to R2, and only their metadata is committed.

## Commands

```bash
npm run ingest      # _incoming/ → EXIF → R2 → photos.json   (needs .env)
npm run describe    # photos.json → Claude → photos.json     (needs .env)
npm run dev         # local preview on :8788, watches + rebuilds
npm run build       # → dist/                                (no credentials)
npm run lint        # eslint + prettier --check
npm run typecheck   # tsc --noEmit
npm run docs        # ovellum build
```

`npm run build` must never require a secret — Cloudflare Pages runs it with none.

`npm run dev` builds with `--local`, which rewrites every media URL to `/media/...`
and has the dev server render the renditions Cloudflare would. Production output is
unaffected; see `docs/workflow.md`.

## /odo

- Queue: `~/_/Oinam/1-Projects/devCommands/albums.oinam.com.md`
- Log: `~/_/Oinam/1-Projects/devLogs/albums.oinam.com.md`
