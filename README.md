# [Oinam Albums](https://albums.oinam.com/)

> Oinam Albums — Pictures, Audio, and Videos.

by [Oinam](https://oinam.com/)

## Media Upload

Stage the originals in `_incoming/YYYY-MM-DD-album-title/`, then:

```bash
# dimensions + EXIF → R2 → albums/<slug>/photos.json
mise run ingest
# just that album
mise run ingest --album album-title
# preview on http://localhost:8788
mise run dev
```

Ingest gives every file a permanent id and never removes one, so re-running is safe and you only ever stage what you are adding. `--album` may be repeated, and a name that is not staged lists the ones that are. Write the title, date and description into `albums/<slug>/album.md`.

## Deploy your own

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oinam/albums)
