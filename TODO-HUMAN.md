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

## Decisions I did not make for you

- [ ] **Images paid plan.** The free plan hard-stops at 5,000 transformations a
      month with error 9422 — images stop rendering rather than costing money.
      Decide deliberately. `docs/costs.md`.
- [ ] **`album.oinam.com` is a dangling CNAME.** It points at `abstract-coyote.pikapod.net`, which no longer resolves — so the singular host is dead, not free. Your README still links to it as the site's home. Either delete the record and add a zone Redirect Rule sending it to `albums.oinam.com`, or point it straight at the Pages project. Until then that README link is broken. (README is yours; I have not touched it.)
- [ ] **EXIF on originals.** Renditions carry `metadata=none`, but the "Original" download link serves the untouched file — camera serial, timestamp and GPS included. `docs/urls.md`. Strip it before staging if that is not what you want.

## For the giveaway

- [ ] Add the Deploy button to `README.md` — yours to edit, so I left it alone:

```markdown
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oinam/albums)
```

- [ ] Confirm `LICENSE` (MIT) is what you want before making the repo public.
