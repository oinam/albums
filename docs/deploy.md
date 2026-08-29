---
title: Deploying
description: Cloudflare setup, start to finish — and how to hand this to someone else.
---

# Deploying

Everything runs on one Cloudflare account and one zone. The site host and the media
host must sit on the **same zone** so transformations are allowed by default.

## 1. R2 bucket

Create a bucket, then attach a custom domain to it under **R2 → your bucket →
Settings → Public access → Custom domain**:

- Bucket: `oinam-albums`
- Custom domain: `media.oinam.com`

The custom domain is what makes the originals fetchable, which is what
transformations read from. Objects are written under `albums/<slug>/<file>`.

Add a `robots.txt` object at the bucket root to keep crawlers off the transformation
URLs — see [What it costs](/costs/).

## 2. Enable transformations

**Images → Transformations → select the zone → Enable.**

Because `media.oinam.com` is on the same zone as the site, it is an allowed source
by default and no origin needs to be listed. You would only add `*.oinam.com` if
media later moved to a separate zone.

## 3. R2 API token

**R2 → Manage API tokens → Create token**, with Object Read & Write on that bucket.
Copy `.env.example` to `.env` and fill in:

```
R2_ACCOUNT_ID=…
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_BUCKET=oinam-albums
ANTHROPIC_API_KEY=…
```

These are for `npm run ingest` and `npm run describe` on your machine. The build
never needs them, which is why Pages can build with no secrets configured.

## 4. Pages project

**Workers & Pages → Create → Pages → Connect to Git**, pick the repository, then:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 22 or later |

Every push to the default branch rebuilds and deploys. Add `albums.oinam.com` as a
custom domain under the project's **Custom domains** tab.

## 5. Legacy hosts

A `_redirects` file only applies to requests that already reached this project, so
it cannot catch a different hostname. Send `album.oinam.com` → `albums.oinam.com`
with a zone-level **Redirect Rule**. Path-level legacy links are handled by the
`_redirects` file the build emits.

## Giving this away

The repository is a working template. Someone else needs to change
`site.config.json`, point it at their own bucket, and nothing else.

A **Deploy to Cloudflare** button in a public repo's README sets up the fork and the
Pages project in one flow:

```markdown
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oinam/albums)
```

The button clones the repository into the visitor's own GitHub account and creates
the Cloudflare project from it. Two things it cannot do for them, which the README
should say plainly:

1. Create and attach the R2 bucket's custom domain.
2. Enable transformations on their zone.

Both are dashboard steps, and both are in sections 1 and 2 above. Everything else —
build command, output directory, the whole static pipeline — comes from the repo.
