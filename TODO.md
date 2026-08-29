# TODO

Work Claude tracks. Anything needing Brajeshwar's hands or credentials lives in
[TODO-HUMAN.md](./TODO-HUMAN.md).

## Next

- [ ] Album cover: `album.md` accepts `cover:` but the templates still use the first
      item. Honour it on the home page and album header.
- [ ] Pagination for `/photos/` once the stream goes past a few hundred items.
- [ ] `npm run describe` runs one request at a time. Add small-batch concurrency,
      or move to the Batch API for a 50% saving on large runs.
- [ ] Video duration is not read at ingest. Needed before any Stream-vs-R2 decision
      can be automated per file.

## Considered and deliberately not done

- **Pre-baking renditions into R2.** Cheaper only if transformation volume ever
  dominates. Request-time transformations need no build step; revisit if the bill
  justifies it. See `docs/costs.md`.
- **Cloudflare Stream.** Roughly 20× the storage cost of R2 for this archive, and
  buys adaptive bitrate rather than savings. See `docs/architecture.md`.
- **A database (D1/KV).** The manifest is a few hundred KB of committed JSON. A
  database would add a moving part and a deploy-time dependency for nothing.
- **`/photos/{id}/in/{album}/` context pages.** Flickr needs them because a photo can
  belong to many albums; here each photo has exactly one. Generating them would
  double the page count for no information gain.
