---
title: What it costs
description: The monthly bill, with the arithmetic shown.
---

# What it costs

Modelling a realistic archive: 5,000 photos averaging 4 MB, 50 videos averaging
100 MB, 100 audio files averaging 10 MB — 26 GB, with ordinary personal traffic.

| Line                  | Basis                                                            | Monthly     |
| --------------------- | ---------------------------------------------------------------- | ----------- |
| R2 storage            | 26 GB less the 10 GB free tier, at $0.015/GB                     | $0.24       |
| R2 Class A (writes)   | ~5,150 uploads against 1M free                                   | $0.00       |
| R2 Class B (reads)    | Origin pulls and downloads against 10M free                      | $0.00       |
| Image transformations | ~3,000 unique image×size combinations viewed, against 5,000 free | $0.00       |
| Video posters         | 50 stills, same free pool                                        | $0.00       |
| Pages                 | Builds and requests on the free plan                             | $0.00       |
| Egress                | R2 never charges for it                                          | $0.00       |
| **Total**             |                                                                  | **≈ $0.24** |

## The line that can move

Transformations bill per **unique image-plus-parameters requested per calendar
month** — not per photo stored. A library nobody browses costs nothing to transform.
A library crawled end to end costs the most it possibly can: 5,000 photos at three
sizes is 15,000 transformations, 10,000 of them billable at $0.50/1,000 = **$5.00**.
Same archive, twenty times the bill, decided entirely by traffic.

Two mitigations, both cheap. Keep the ladder at three rungs. And keep crawlers off
the transformation URLs — those live on `media.oinam.com`, so that host needs its
own `robots.txt` as an object at the bucket root. The `robots.txt` this build emits
covers `albums.oinam.com` only, which is the host you _do_ want indexed.

## The free-plan cliff

Worth deciding in advance, because the failure mode is surprising. On the free plan,
exceeding 5,000 unique transformations in a month does not generate a bill — new
transformations return **error 9422** and images stop rendering. The site visibly
breaks instead of costing money.

For an archive you care about, the paid plan is the safer posture even if usage
rarely reaches the threshold.

## Describing images

`npm run describe` is the only line that isn't Cloudflare. Each image is one request
to Claude carrying a 1024px rendition — roughly 1,000 input tokens and a couple of
hundred output. At Opus 5 rates that is well under a cent per photo, paid once.
Run `--dry-run` first to see exactly how many items would be sent.

## If transformations ever dominate

Pre-bake the three renditions into R2 at ingest and serve them as plain objects.
Delivery becomes ordinary R2 GETs at $0.36/million with free egress, and the
recurring transformation line drops to zero. It costs about 30% more storage and a
full rebuild whenever the ladder changes. Start with request-time transformations,
because they need no build step at all.
