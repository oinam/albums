# TODO

Work on the project itself. Anything needing the site owner's own hands or
credentials is tracked outside the repository, in a gitignored `TODO-HUMAN.md`.

## Next

- [ ] Ingest cannot handle a partly staged album. The upload loop walks the merged
      item list but looks for every file in the staging folder, so staging only the
      files being added — which `docs/workflow.md` says you may do — throws ENOENT
      at the first item that is not there. Never hit yet, because every ingest so
      far staged the whole folder. Found 2026-09-02; still unexercised after the
      2026-09-03 run, which staged whole folders throughout and used `--no-upload`
      for the one scoped album — and the upload loop is where the bug lives. The
      2026-09-05 run scoped four albums with `--album` and uploaded for real, but
      every one of them was staged whole, so it still has not been hit.
- [ ] A transient upload error ends the whole ingest, and leaves the bucket short
      of what the metadata already claims. Hit on 2026-09-04: an HTTP 502 from R2 on
      an 8.5 MB file killed the run 13 of 15 into an album, and the AWS SDK could not
      retry because it had already consumed the stream — it surfaced as
      `@aws-sdk XML parse error: unexpected content`, which is Cloudflare's HTML
      error page arriving where XML was expected. `photos.json` is written before the
      upload loop, so the album claimed 15 items while R2 held 12.
      Re-running fixes it, because uploads skip what is already present — but nothing
      says it happened. `mise run prune` is what caught it. Two things would help:
      retry a failed PUT by re-opening the file (`upload()` already takes a path), and
      compare the album against the bucket at the end of a run. The 2026-09-05 run put
      88 files up with no failure, and `mise run prune` afterwards showed 908 objects
      against 908 items — but that check was run by hand, which is the point.
- [ ] Album pagination on the home page, once the archive passes roughly a hundred
      albums. Not before — the whole list fits comfortably until then.

## Considered and deliberately not done

- **GUI or bucket-side upload.** The folder-plus-script flow stays. A GUI can put
  bytes in R2, but `photos.json` is what the site reads, and only ingest builds it —
  so a GUI would still need an `ingest --from-bucket` pass afterwards. Decided
  2026-08-29 to keep the one command.
- **A photo in more than one album.** Not supported, on purpose. A photo lives in an
  album: the R2 key is `albums/<slug>/<file>` and the id derives from it. Allowing
  many would mean decoupling storage from albums, an id registry, and an ambiguous
  "back to album" — which is what Flickr's `/in/album-{id}/` URLs exist to solve.
  Decided 2026-08-29. If it ever becomes necessary, the cheap version is one _home_
  album per photo with others referencing its id.

- **A chronological stream at `/`.** Built, then removed. Paginating newest-first
  means inserting one item rewrites every page in the chain, invalidating all of
  their caches — a bad property for a static site. A page of album covers has no
  such coupling. See `docs/urls.md`.
- **Pre-baking renditions into R2.** Cheaper only if transformation volume ever
  dominates. Request-time transformations need no build step; revisit if the bill
  justifies it. See `docs/costs.md`.
- **Cloudflare Stream.** Roughly 20× the storage cost of R2 for this archive, and
  buys adaptive bitrate rather than savings. See `docs/architecture.md`.
- **A database (D1/KV).** The manifest is a few hundred KB of committed JSON. A
  database would add a moving part and a deploy-time dependency for nothing.
- **`/photo/`, `/video/`, `/audio/` routes.** Self-describing, but they put the
  media type inside the permalink. One `/media/{id}/` keeps the address stable when
  a file is re-encoded. See `docs/urls.md`.
- **Per-orientation album covers.** Covers are always wide, so the album list stays
  a uniform grid and shares the wide thumbnail every landscape photo already uses.
