# TODO — Brajeshwar

Things only you can do. Claude cannot: touch your Cloudflare dashboard, force-push, or spend money on the API without asking.

## Blocking — nothing works until these are done

- [x] **R2 bucket + custom domain.** `oinam-media`, EU, mapped to `media.oinam.com`.
- [x] **Jurisdiction settled.** It is a real EU _jurisdiction_, not a location hint — the endpoint carries `.eu.`. `R2_JURISDICTION` is set and working.
- [x] **Images transformations enabled.** Verified: `/cdn-cgi/image/` returns `cf-resized` and honours `format=auto`.
- [x] **R2 API token + `mise.local.toml`.** Read and write both confirmed against the live bucket.
- [ ] **Create the Pages project**: build command `npm run build`, output `dist`, Node 22+. `docs/deploy.md` §4. This is the only one left.

Re-run `mise run doctor` any time to re-check all of the above in about two seconds.

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
