# TODO-HUMAN

- TODO
  - [ ] Purge three cached pages. `/about/`, `/contact/` and `/album/1111-11-11-random/`
        still answer 200 with old HTML. The origin returns 404 for all three, so only the
        edge copy is stale and it expires within a week on its own. Still 200 on
        2026-09-01 at ~2.9 days of edge age, and still titled "Oinam's Album" — while an
        unknown URL correctly 404s, so `404.html` is right in production and this really
        is only the cache.
  - [ ] Finish `bangalore`'s metadata. `greenage` and `imphal-peace-museum` now have
        their descriptions; bangalore has a title, cover and location but no date and no
        description. Quickest through `mise run dev` and the Edit button.
  - [ ] Describe the three albums ingested on 2026-08-30. `london-2015may-jul`,
        `los-angeles-2023may` and `san-francisco-2023may-jun` were named since —
        verified 2026-09-01, they carry proper titles, dates and locations — but none
        of the three has a description.
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
  - [x] Four stale R2 prefixes deleted — 125 objects. The bucket mirrors the site
        exactly: 455 objects against 455 items, prefix by prefix, verified with
        `mise run prune` on 2026-08-30.
  - [x] EXIF on originals: decided to leave it. Renditions still carry
        `metadata=none`; the Original download serves the untouched file.
