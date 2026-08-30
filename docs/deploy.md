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

- Bucket: `oinam-media`
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
Secrets live in mise, not a `.env` file:

```bash
cp mise.local.toml.example mise.local.toml
# fill in the values, then
mise trust
```

`mise.local.toml` is gitignored and holds `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY` and `R2_BUCKET`. With mise active in your shell, entering the
repository loads them, and `mise run ingest` works with no further setup.

These are for ingest on your machine. The build never needs them,
which is why Pages can build with no secrets configured at all.

### Location hint or jurisdiction?

If the bucket was created under a **jurisdiction** (EU or FedRAMP) rather than a
**location hint**, it answers only on its own S3 endpoint —
`<account>.eu.r2.cloudflarestorage.com` instead of
`<account>.r2.cloudflarestorage.com` — and uploads against the wrong one fail with
`NoSuchBucket`. Set `R2_JURISDICTION = "eu"` in `mise.local.toml` and ingest uses
the right endpoint.

A location hint needs nothing: it is only a placement preference and the endpoint
is unchanged. The bucket's page in the dashboard shows which one applies.

Neither affects delivery. Transformations and the site read the bucket over HTTPS
through `media.oinam.com`, not through the S3 API.

### Check it works

```bash
mise run doctor
```

Verifies the credentials, resolves the endpoint, reads and writes the bucket,
then fetches an image through `media.oinam.com` and through `/cdn-cgi/image/` to
confirm the custom domain is public and transformations are on. If the bucket is
empty it uploads a 64×48 probe image for the last two checks and deletes it after.

Everything it touches it cleans up. Run it whenever something looks wrong.

## 4. Pages project

**Workers & Pages → Create → Pages → Connect to Git**, pick the repository, then:

| Setting                | Value           |
| ---------------------- | --------------- |
| Framework preset       | None            |
| Build command          | `npm run build` |
| Build output directory | `dist`          |
| Node version           | 22 or later     |

Every push to the default branch rebuilds and deploys. Add `albums.oinam.com` as a
custom domain under the project's **Custom domains** tab.

## 5. Legacy hosts

A `_redirects` file only applies to requests that already reached this project, so
it cannot catch a different hostname. Send `album.oinam.com` → `albums.oinam.com`
with a zone-level **Redirect Rule**. Path-level legacy links are handled by the
`_redirects` file the build emits.

## Keeping other people's pages off your bandwidth

**Nothing here is switched on.** Hotlinking costs nothing until somebody actually does
it, and the bandwidth is free either way — this is the recipe for the day you notice it in
the logs, not a job waiting to be done.

Two different things get confused here, and the confusion points the wrong way.

**CORS will not stop hotlinking.** It governs whether a _script_ on another origin may
read a response — `fetch`, `XMLHttpRequest`, a canvas that would otherwise be tainted. A
plain `<img src="https://media.oinam.com/...">` on somebody else's page is not a
cross-origin read; the browser never consults CORS for it. `media.oinam.com` currently
sends no `Access-Control-Allow-Origin` at all, which is the _closed_ state. Adding a CORS
policy would open a door, not shut one.

What stops an image being embedded elsewhere is the `Referer` header, checked at the edge.

### The rule that actually does it

The media host is an R2 custom domain, so its traffic still passes through the zone's
edge — `server: cloudflare` and a `cf-ray` on every response — which is what makes a
zone-level rule able to see it at all.

**Security → WAF → Custom rules → Create rule**, on the `oinam.com` zone. Give it a name,
switch the editor to **Expression Preview** to paste the expression, and set the action to
**Block**.

Match on the media host, and block when the referer is present and is not yours:

```
http.host eq "media.oinam.com"
and http.referer ne ""
and not http.referer matches "^https?://([^/]*\.)?(oinam\.[a-z]+|brajeshwar\.com|laaija\.com)(/|$)"
```

Action: **Block**. Three things about it are deliberate:

- **`http.referer ne ""` lets empty referers through.** A browser sent from an HTTPS page
  under `Referrer-Policy: no-referrer`, or a direct paste into the address bar, sends
  nothing. Blocking those breaks your own visitors to no purpose.
- **`matches` is a regex**, which WAF custom rules only offer on Pro and above. On Free,
  the nearest equivalent is Scrape Shield's Hotlink Protection — but that allows only the
  zone itself, so `brajeshwar.com` and `laaija.com` would be blocked with everyone else.
- **`*.oinam.*` cannot be written literally.** The regex above accepts any TLD on `oinam`;
  a CORS origin list cannot, since a CORS wildcard may only stand in for one subdomain
  label.

The trailing `(/|$)` is not decoration. Without it `https://oinam.com.evil.example/` would
match as a prefix and be waved through — the anchor is what makes the domain the whole
host rather than the start of one.

### If the editor will not take `matches`

Regex is not on every plan. The same rule without it, anchored by the trailing slash
instead, costs you wildcards — each host has to be named:

```
http.host eq "media.oinam.com"
and http.referer ne ""
and not (
  starts_with(http.referer, "https://oinam.com/")
  or starts_with(http.referer, "https://albums.oinam.com/")
  or starts_with(http.referer, "https://brajeshwar.com/")
  or starts_with(http.referer, "https://laaija.com/")
)
```

The trailing slash does the same job as the anchor in the regex: `https://oinam.com/`
cannot match `https://oinam.com.evil.example/`.

Zero-config alternative: Scrape Shield's **Hotlink Protection** needs no rule at all, but
it permits only the zone it runs on — `brajeshwar.com` and `laaija.com` would be turned
away with everyone else. Use it only if `oinam.com` is the whole list.

### Check it before and after

```bash
IMG=https://media.oinam.com/albums/<album>/<file>

curl -s -o /dev/null -w '%{http_code}\n' -H 'Referer: https://albums.oinam.com/x' "$IMG"
curl -s -o /dev/null -w '%{http_code}\n' -H 'Referer: https://someoneelse.example/x' "$IMG"
curl -s -o /dev/null -w '%{http_code}\n' "$IMG"
```

Expect `200`, `403`, `200`. The third is the one people get wrong: no referer must still
pass, or you have blocked every visitor whose browser withholds it.

It is deterrence, not security. `Referer` is a request header like any other and anyone
determined can send yours. It stops pages, not people.

### If you ever do want CORS

Only when something of yours needs to _read_ the bytes cross-origin — a canvas, a
`fetch` that inspects the image. Set it on the bucket, not the zone:

```json
[
  {
    "AllowedOrigins": [
      "https://oinam.com",
      "https://*.oinam.com",
      "https://brajeshwar.com",
      "https://*.brajeshwar.com",
      "https://laaija.com",
      "https://*.laaija.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

R2 → your bucket → Settings → CORS policy. Every TLD has to be named; there is no
`*.oinam.*`.

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
