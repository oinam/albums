# TODO

Work Claude tracks. Anything needing Brajeshwar's hands or credentials lives in
[TODO-HUMAN.md](./TODO-HUMAN.md).

## Next

- [ ] Album pagination on the home page, once the archive passes roughly a hundred
      albums. Not before — the whole list fits comfortably until then.
- [ ] `npm run describe` runs one request at a time. Add small-batch concurrency,
      or move to the Batch API for a 50% saving on large runs.
- [ ] Video duration is not read at ingest. Needed before any Stream-vs-R2 decision
      can be automated per file.
- [ ] Nothing surfaces highlights during ingest. Marking one means editing
      `photos.json` by hand; a `--highlight` flag on ingest would be friendlier.

## Considered and deliberately not done

- **A chronological stream at `/`.** Built, then removed. Paginating newest-first
  means inserting one item rewrites every page in the chain, invalidating all of
  their caches — a bad property for a static site. Highlights plus album covers
  has no such coupling. See `docs/urls.md`.
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
