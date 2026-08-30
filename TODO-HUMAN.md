# TODO-HUMAN

- TODO
  - [ ] Delete four stale R2 prefixes. `mise run prune` lists them; `mise run prune -- --apply`
        removes them. Mine was refused by a permission gate, twice. They are
        `1111-11-11-unsorted`, `1945-08-15-calcutta`, `2025-06-07-macromedia-lego` and
        `2026-06-16-london` — 125 objects, every file already living under a current album.
  - [ ] Purge three cached pages. `/about/`, `/contact/` and `/album/1111-11-11-random/`
        still answer 200 with old HTML. The origin returns 404 for all three, so only the
        edge copy is stale and it expires within a week on its own.
  - [ ] Finish `bangalore`'s metadata. `greenage` and `imphal-peace-museum` now have
        their descriptions; bangalore has a location and nothing else. Quickest
        through `mise run dev` and the Edit button.
  - [ ] Decide the licence split before publishing. `LICENSE` is gone and `package.json`
        says `UNLICENSED`, so nothing grants rights to anything. The shape you want is a
        licence on the code and none on the photographs.
- DONE
  - [x] R2 bucket `oinam-media`, EU jurisdiction, mapped to `media.oinam.com`.
  - [x] `R2_JURISDICTION` set to a real jurisdiction, not a location hint.
  - [x] Images transformations enabled; `format=auto` honoured.
  - [x] R2 API token in `mise.local.toml`; read and write both confirmed.
  - [x] Pages project serves `albums.oinam.com` from the repo. Deploying is `git push`.
  - [x] Images paid plan in motion; lifts the 5,000-a-month hard stop.
  - [x] `album.oinam.com` answers `301 → albums.oinam.com`.
  - [x] Ten orphaned objects from the Random rename deleted.
  - [x] README title link points straight at `albums.oinam.com`.
  - [x] Deploy button in `README.md`.
  - [x] EXIF on originals: decided to leave it. Renditions still carry
        `metadata=none`; the Original download serves the untouched file.
