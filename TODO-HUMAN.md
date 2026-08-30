# TODO — Brajeshwar

Things only you can do. Claude cannot: touch your Cloudflare dashboard, force-push, or spend money on the API without asking.

## Blocking — nothing works until these are done

- [x] **R2 bucket + custom domain.** `oinam-media`, EU, mapped to `media.oinam.com`.
- [x] **Jurisdiction settled.** A real EU _jurisdiction_, not a location hint. `R2_JURISDICTION` set and working.
- [x] **Images transformations enabled.** Verified: `/cdn-cgi/image/` returns `cf-resized` and honours `format=auto`.
- [x] **R2 API token + `mise.local.toml`.** Read and write both confirmed against the live bucket.
- [x] **Pages project exists** and already serves `albums.oinam.com` from the repo.

## Live

`albums.oinam.com` is serving the new build. Verified end to end: the routes and
redirects answer correctly, `/nope/` is a real 404, thumbnails come off the edge at
about 17 KB from 5 MB originals, and all 11 demo files are in `oinam-media`.

Pages settings, for the record — Framework preset `None`, build command
`npm run build`, output `dist`, `NODE_VERSION` `22`. Nothing else, and no secrets:
the build reads only the repository.

Deploying from here is just `git push`.

## Before going public

Nobody is looking at the site yet, so none of this is urgent.

- [ ] **Three pages the purge did not reach.** `/about/`, `/contact/` and the old
      `/album/1111-11-11-random/` still answer 200 with their old HTML. The cached
      entries are ~13 hours old and still ageing, so the purge did not clear these
      three — a purge would have reset them, and the origin cannot refill them
      because it returns `404` with `no-store`. They hold a 7-day `s-maxage`, so
      they expire on their own in about six days. Purge those three URLs if you
      would rather not wait. Nothing links to any of them.

- [x] **Twelve highlights.** London's cover made the twelfth, so the home page
      opens on the mosaic. Unmark one and it falls back to the justified grid.
- [x] **Ten orphaned R2 objects deleted.** Confirmed: the old
      `albums/1111-11-11-random/` prefix returns 404 at origin. One edge copy is
      still warm and will age out.
- [x] README's title link points at `albums.oinam.com` directly.

## Decisions I did not make for you

- [x] **Images paid plan** is in motion and will land on its own. That lifts the
      5,000-transformations-a-month hard stop (error 9422). `docs/costs.md`.
- [x] **`album.oinam.com` resolves again.** It now answers `301 → https://albums.oinam.com/`, so the README's link works; it just takes the extra hop.
- [ ] **EXIF on originals.** Renditions carry `metadata=none`, but the "Original" download link serves the untouched file — camera serial, timestamp and GPS included. `docs/urls.md`. Strip it before staging if that is not what you want.

## For the giveaway

- [x] Deploy button is in `README.md`.
- [ ] **Decide the licence split before publishing.** `LICENSE` is removed and
      `package.json` says `UNLICENSED`, so nothing currently grants anyone rights
      to anything — which is the safe state while you decide. What you want is a
      split: a licence on the code, and none on the photographs. The usual shape
      is an MIT `LICENSE` covering the source, plus a line in `README.md` saying
      the images in `albums/` and on R2 are not covered by it and remain all
      rights reserved. Nothing is published yet, so there is no hurry.
