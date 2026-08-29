# [Oinam’s Album](https://album.oinam.com/)

> Oinam Albums — Pictures, Audio, and Videos.

## Uploading photos

Stage the originals in `_incoming/YYYY-MM-DD-album-title/`, then:

```bash
mise run ingest   # dimensions + EXIF → R2 → albums/<slug>/photos.json
mise run dev      # preview on http://localhost:8788
```

Ingest gives every file a permanent id and never removes one, so re-running is safe
and you only ever stage what you are adding. Write the title, date and description
into `albums/<slug>/album.md`.

R2 credentials live in `mise.local.toml`. Everything else is in
[docs/workflow.md](docs/workflow.md).

by [Oinam](https://oinam.com/)
