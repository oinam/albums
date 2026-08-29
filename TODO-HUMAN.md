# TODO — Brajeshwar

Things only you can do. Claude cannot: touch your Cloudflare dashboard, force-push, or spend money on the API without asking.

## Blocking — nothing works until these are done

- [x] **Create the R2 bucket** and attach `media.oinam.com` as its custom domain. Done: `oinam-media`, European region.
- [ ] **Check whether that bucket has a jurisdiction or only a location hint.** Its page in the dashboard says which. If it shows a jurisdiction, set `R2_JURISDICTION = "eu"` in `mise.local.toml` — a jurisdictional bucket answers only on `<account>.eu.r2.cloudflarestorage.com`, and uploads to the ordinary endpoint fail with `NoSuchBucket`. A location hint needs nothing.
- [ ] **Enable Images transformations** for the zone. `docs/deploy.md` §2.
- [ ] **Create an R2 API token**, then `cp mise.local.toml.example mise.local.toml`, fill it in, and run `mise trust`.
- [ ] **Create the Pages project**: build command `npm run build`, output `dist`,
      Node 22+. `docs/deploy.md` §4.

## Force-push required

History was rewritten to strip ~21 MB of committed photos, so local and
`origin/main` have diverged. Nothing is pushed automatically:

```bash
git fetch origin                       # filter-repo dropped the tracking refs
git push --force-with-lease origin main
```

- [ ] Run that when you are ready.
- [ ] A full backup of the pre-rewrite repository and the original photos is at
      `~/Desktop/albums.oinam.com-backup-2026-08-29/`. Delete it once you are happy.

## Decisions I did not make for you

- [ ] **Images paid plan.** The free plan hard-stops at 5,000 transformations a
      month with error 9422 — images stop rendering rather than costing money.
      Decide deliberately. `docs/costs.md`.
- [ ] **`album.oinam.com` vs `albums.oinam.com`.** README says singular, the site is
      built for plural. Pick one and add a zone Redirect Rule for the other.
- [ ] **EXIF on originals.** Renditions are stripped, but the "Original" download
      link serves the untouched file with GPS coordinates intact. `docs/urls.md`.
      It also needs `media.oinam.com` live first.

## For the giveaway

- [ ] Add the Deploy button to `README.md` — yours to edit, so I left it alone:

```markdown
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oinam/albums)
```

- [ ] Confirm `LICENSE` (MIT) is what you want before making the repo public.
