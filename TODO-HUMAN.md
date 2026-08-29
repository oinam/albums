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

- [ ] **Purge the Cloudflare cache once.** Two separate leftovers, same fix.

      The eleven deleted demo objects were uploaded with a one-year `immutable`
          header and still answer 200 at their old URLs. Uploads since carry a one-day
          TTL, so that will not recur.

          Deleted *pages* linger too. `/about/`, `/contact/` and the old
          `/album/1111-11-11-random/` still answer 200 with their old HTML, served from
          the edge with `s-maxage=604800` and an age of a few hours. The origin is
          correct — add any query string and all three return 404 — so this is a
          cached copy, not a broken build, and it ages out within the week. Fresh 404s
          are `no-store`, so nothing new is accumulating.

          Nothing links to any of it. Caching → Configuration → Purge Everything.

- [ ] **Mark six more highlights.** Six are flagged; the home page mosaic is
      4 x 3 and needs twelve, so the page is currently falling back to the
      justified grid. Open any photo in `mise run dev` and tick "Highlight on the
      home page" — that is what the editor is for.
- [ ] **Ten orphaned objects in R2.** Renaming the Random album left the originals
      at `albums/1111-11-11-random/` behind; the live copies are under
      `albums/1111-11-11-unsorted/`. Nothing references the old prefix. Deleting
      them was refused by a permission gate on my side, so they are yours to
      remove — or to leave, at a few megabytes.
- [ ] Fix the README's title link: it still points at `album.oinam.com`, which now
      301s to the plural host, so it works but goes the long way round.

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
