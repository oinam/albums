# [Oinam Albums](https://albums.oinam.com/)

> Oinam Albums — Pictures, Audio, and Videos.

by [Oinam](https://oinam.com/)

## Media Upload

Stage the originals in `_incoming/YYYY-MM-DD-album-title/`, then:

```bash
mise run ingest                               # dimensions + EXIF → R2 → albums/<slug>/photos.json
mise run ingest -- --album 2026-06-16-london  # just that one
mise run dev                                  # preview on http://localhost:8788
```

Ingest gives every file a permanent id and never removes one, so re-running is safe and you only ever stage what you are adding. `--album` may be repeated, and a name that is not staged lists the ones that are. Write the title, date and description into `albums/<slug>/album.md`.

## Deploy your own

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oinam/albums)
