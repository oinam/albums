# TODO — Brajeshwar

Only what needs you: the Cloudflare dashboard, money, and decisions that are yours.

- TODO
  - Delete four stale R2 prefixes. `mise run prune` lists them; `mise run prune -- --apply`
    removes them. Mine was refused by a permission gate, twice. They are
    `1111-11-11-unsorted`, `1945-08-15-calcutta`, `2025-06-07-macromedia-lego` and
    `2026-06-16-london` — 125 objects, every file already living under a current album.
  - Purge three cached pages. `/about/`, `/contact/` and `/album/1111-11-11-random/`
    still answer 200 with old HTML. The origin returns 404 for all three, so only the
    edge copy is stale and it expires within a week on its own.
  - Write metadata for three new albums. `bangalore`, `greenage` and
    `imphal-peace-museum` have generated `album.md` files; title, date, location and
    description are yours. Quickest through `mise run dev` and the Edit button.
  - Decide the licence split before publishing. `LICENSE` is gone and `package.json`
    says `UNLICENSED`, so nothing grants rights to anything. The shape you want is a
    licence on the code and none on the photographs.
  - EXIF on originals. Renditions carry `metadata=none`, but the Original download
    link serves the untouched file — camera serial, timestamp, GPS. `docs/urls.md`.
- DONE
  - R2 bucket `oinam-media`, EU jurisdiction, mapped to `media.oinam.com`.
  - `R2_JURISDICTION` set to a real jurisdiction, not a location hint.
  - Images transformations enabled; `format=auto` honoured.
  - R2 API token in `mise.local.toml`; read and write both confirmed.
  - Pages project serves `albums.oinam.com` from the repo. Deploying is `git push`.
  - Images paid plan in motion; lifts the 5,000-a-month hard stop.
  - `album.oinam.com` answers `301 → albums.oinam.com`.
  - Ten orphaned objects from the Random rename deleted.
  - Twelve highlights, so the home page opens on the mosaic.
  - README title link points straight at `albums.oinam.com`.
  - Deploy button in `README.md`.

Pages settings, for the record: framework preset `None`, build command
`npm run build`, output `dist`, `NODE_VERSION` `22`. No secrets — the build reads
only the repository.
