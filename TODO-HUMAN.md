# TODO-HUMAN

- TODO
  - [ ] Purge three cached pages. `/about/`, `/contact/` and `/album/1111-11-11-random/`
        still answer 200 with old HTML. The origin returns 404 for all three, so only the
        edge copy is stale and it expires within a week on its own. Still 200 on
        2026-09-03 at 4.92 days of edge age — an unknown URL still correctly 404s, so
        `404.html` is right in production and this really is only the cache. If it is
        still there past seven days, it is not expiring and wants a manual purge.
  - [ ] Finish `bangalore`'s metadata. `greenage` and `imphal-peace-museum` now have
        their descriptions; bangalore has a title, cover and location but no date and no
        description. Quickest through `mise run dev` and the Edit button.
  - [ ] Write album descriptions where they are still missing. Verified 2026-09-03:
        five albums have one — `calcutta-1945-46`, `manipur`, `bannerghatta-national-park`,
        `greenage`, `imphal-peace-museum`. Twelve do not, including the four ingested on
        2026-09-03 (`rajasthan-2004dec`, `los-angeles-2005jun-dec`, `bombay` — `manipur`
        already has one). A description is optional and an album reads fine without one;
        this is a list, not a debt.
  - [ ] Delete one stale R2 prefix — `albums/2025-06-07-macromedia-lego-2005jun/`,
        25 objects, a year typo for `2005-06-07`. `mise run prune` reports every file in
        it also lives under a current album, so nothing is lost. The bucket holds 746
        objects against 721 items on the site; those 25 are the whole difference.
        Verified 2026-09-03. Run `mise run prune -- --apply` to clear it.
  - [ ] Decide Calcutta's dates, all or none. All 59 originals carry the same EXIF
        capture time — `2021-05-26`, the day they were scanned — and three of them also
        carry a hand-written `date: 1945`. Sorting is faithful to that, so those three
        correctly-dated photographs now sit at the _bottom_ of the album, under 56
        labelled 2021. Either drop the three `date:` lines, which lets the whole album
        fall back to scan order, or date the other 56 by hand. The album's own
        `date: 1945-46` already tells a reader what they are looking at.
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
