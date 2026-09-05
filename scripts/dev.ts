import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  watch,
} from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import sharp from "sharp";
import { loadConfig, stagingDir } from "./lib/config.ts";
import { newestFirst, readItems } from "./lib/albums.ts";
import { contentType } from "./lib/mime.ts";
import { parseSlug } from "./lib/slug.ts";
import { removeItem, updateAlbum, updateItem } from "./lib/metadata.ts";
import { openBucket, remove } from "./lib/r2.ts";
import { buildSite } from "./lib/site.ts";

/**
 * The dev server's own output. Not `dist/`: that is production's, and a
 * `npm run build` in another terminal would otherwise replace every page this
 * server is holding open with one that has no editor on it.
 */
const DEV_OUT = ".dev-dist";

const CACHE = ".dev-cache";
const RESIZABLE = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const FRAMEABLE = new Set([".mp4", ".m4v", ".mov", ".webm"]);

/**
 * Stands in for a poster that could not be pulled — no ffmpeg on PATH, or a file
 * it could not decode. A neutral play symbol says "this is a video" without
 * claiming to be a frame of it.
 */
const PLACEHOLDER_POSTER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="48" fill="#e4e4e4"/><path d="M27 17.5v13l11-6.5z" fill="#999"/></svg>`;
// Content only. Changes under scripts/ are handled by `tsx watch`, which restarts
// the process — an in-process rebuild would keep running the old modules.
const WATCHED = ["albums", "assets", "site.config.json"];
const DEBOUNCE_MS = 120;

const cfg = loadConfig();
cfg.media.local = true;
const staging = stagingDir();

function rebuild(): void {
  try {
    const { albums, items } = buildSite(cfg, DEV_OUT);
    console.log(`  rebuilt — ${albums} album(s), ${items} item page(s)`);
  } catch (error) {
    console.error(
      `  build failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Keeps a resolved path from escaping its root via `..` or an absolute segment. */
function within(root: string, candidate: string): string | null {
  const base = resolve(root);
  const full = resolve(base, `.${normalize(`/${candidate}`)}`);
  return full === base || full.startsWith(base + sep) ? full : null;
}

function readRedirects(): Map<string, string> {
  const path = join(DEV_OUT, "_redirects");
  const map = new Map<string, string>();
  if (!existsSync(path)) return map;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const [from, to] = line.trim().split(/\s+/);
    if (from?.startsWith("/") && to) map.set(from, to);
  }
  return map;
}

/**
 * Local media stands in for R2 plus the edge. `/_media/<prefix>/<slug>/<file>`
 * maps to the staged original in `_incoming/<slug>/<file>`. The underscore keeps
 * it clear of the public `/media/` route.
 */
function mediaPath(pathname: string): string | null {
  const prefix = `/_media/${cfg.media.prefix}/`;
  if (!pathname.startsWith(prefix)) return null;
  return within(staging, decodeURIComponent(pathname.slice(prefix.length)));
}

function sitePath(pathname: string): string | null {
  const candidate = within(DEV_OUT, decodeURIComponent(pathname));
  if (!candidate) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    return join(candidate, "index.html");
  }
  return candidate;
}

interface Rendition {
  width: number;
  height: number | null;
  cover: boolean;
  /** Seconds into a video, when this is a poster rather than a resize. */
  frame: number | null;
}

function renditionFrom(url: URL): Rendition | null {
  const width = Number(url.searchParams.get("w"));
  if (!Number.isFinite(width) || width <= 0) return null;
  const rawHeight = Number(url.searchParams.get("h"));
  const rawFrame = url.searchParams.get("frame");
  const frame = rawFrame === null ? Number.NaN : Number(rawFrame);
  return {
    width,
    height: Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : null,
    cover: url.searchParams.get("fit") === "cover",
    frame: Number.isFinite(frame) && frame >= 0 ? frame : null,
  };
}

/**
 * Stands in for the edge: renders the requested size once and caches it, so the
 * grid loads at rendition weight rather than dragging full originals over the wire.
 */
async function render(source: string, r: Rendition): Promise<string> {
  const stat = statSync(source);
  const key = createHash("sha256")
    .update(`${source}:${stat.mtimeMs}:${r.width}:${r.height ?? 0}:${String(r.cover)}`)
    .digest("hex")
    .slice(0, 16);
  const target = join(CACHE, `${key}.jpg`);
  if (existsSync(target)) return target;

  mkdirSync(CACHE, { recursive: true });
  await sharp(source)
    .rotate()
    .resize({
      width: r.width,
      height: r.height ?? undefined,
      fit: r.cover ? "cover" : "inside",
      withoutEnlargement: !r.cover,
    })
    .jpeg({ quality: 82 })
    .toFile(target);
  return target;
}

/**
 * The edge pulls a poster out of a video with `mode=frame`; locally that is
 * ffmpeg. Optional in the same way `probeMedia` is — a machine without it gets
 * the placeholder rather than a broken page, which is why this returns null on
 * any failure instead of throwing.
 */
async function renderFrame(source: string, r: Rendition): Promise<string | null> {
  const stat = statSync(source);
  const key = createHash("sha256")
    .update(
      `${source}:${stat.mtimeMs}:frame${r.frame ?? 0}:${r.width}:${r.height ?? 0}:${String(r.cover)}`,
    )
    .digest("hex")
    .slice(0, 16);
  const target = join(CACHE, `${key}.jpg`);
  if (existsSync(target)) return target;

  let frame: Buffer;
  try {
    frame = execFileSync(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-ss",
        String(r.frame ?? 0),
        "-i",
        source,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-",
      ],
      { maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    return null;
  }
  if (frame.length === 0) return null;

  mkdirSync(CACHE, { recursive: true });
  await sharp(frame)
    .resize({
      width: r.width,
      height: r.height ?? undefined,
      fit: r.cover ? "cover" : "inside",
      withoutEnlargement: !r.cover,
    })
    .jpeg({ quality: 82 })
    .toFile(target);
  return target;
}

const LOOPBACK = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1"]);
const MAX_BODY = 256 * 1024;

/** Set by the editor so the file watcher does not rebuild the same change twice. */
let editedAt = 0;

/**
 * The editor writes files, so the gate is deliberately narrow.
 *
 * A loopback socket is not enough on its own: the browser is on loopback too, and
 * any page it happens to have open can post to this port. Requiring
 * `application/json` forces a CORS preflight that a cross-site page cannot pass,
 * and checking Host and Origin closes the rest. The slug is checked against the
 * albums that actually exist rather than being joined into a path, so no request
 * body can write outside `albums/`.
 */
function editAllowed(req: IncomingMessage): boolean {
  if (req.method !== "POST") return false;
  if (!LOOPBACK.has(req.socket.remoteAddress ?? "")) return false;
  if (req.headers["content-type"] !== "application/json") return false;

  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") return false;

  const origin = req.headers.origin;
  return (
    origin === undefined || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY) throw new Error("Body too large");
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function plain(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

async function handleEdit(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!editAllowed(req)) {
    plain(res, 403, "Editing is local-only.");
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await readBody(req)) as Record<string, unknown>;
  } catch {
    plain(res, 400, "Expected a JSON object.");
    return;
  }

  const text = (key: string): string =>
    typeof body[key] === "string" ? body[key].trim() : "";

  /**
   * `pruned` clears a string field by turning "" into undefined; a number has to
   * be read for itself. Empty means remove it, anything that is not a count of
   * seconds is a mistake worth saying out loud rather than storing as null.
   */
  const seconds = (key: string): number | undefined | "invalid" => {
    const raw = text(key);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : "invalid";
  };

  const slug = text("slug");
  const albums = readdirSync("albums", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (!albums.includes(slug)) {
    plain(res, 400, `Unknown album: ${slug}`);
    return;
  }

  try {
    if (body.kind === "item") {
      const id = text("id");
      if (!id) {
        plain(res, 400, "Missing item id.");
        return;
      }
      const posterTime = seconds("poster_time");
      if (posterTime === "invalid") {
        plain(res, 400, "Poster time must be a number of seconds.");
        return;
      }
      updateItem(slug, id, {
        title: text("title"),
        date: text("date"),
        description: text("description"),
        alt: text("alt"),
        poster_time: posterTime,
      });
    } else if (body.kind === "delete") {
      const id = text("id");
      if (!id) {
        plain(res, 400, "Missing item id.");
        return;
      }
      // R2 first. If the credentials are missing the throw lands here, before
      // photos.json has been touched — better than a half-deleted item whose
      // metadata is gone and whose original is still sitting in the bucket.
      const items = newestFirst(readItems(join("albums", slug)));
      const index = items.findIndex((item) => item.id === id);
      const target = items[index];
      if (!target) {
        plain(res, 400, `No item ${id} in ${slug}`);
        return;
      }
      await remove(openBucket(), `${cfg.media.prefix}/${slug}/${target.file}`);
      removeItem(slug, id);

      // The staged original goes too, or the next ingest puts the photo straight
      // back with a new id. Its absence is not a failure: the album folder and the
      // staging folder can legitimately be named differently, and a deleted item
      // may simply have been staged under some other name.
      const staged = join(staging, slug, target.file);
      const hadStaged = existsSync(staged);
      if (hadStaged) rmSync(staged);
      console.log(
        `  deleted ${slug}/${target.file}` +
          (hadStaged
            ? " — metadata, R2 and staged original"
            : " — metadata and R2; nothing staged under that name"),
      );

      editedAt = Date.now();
      rebuild();

      // Deleting is a pass down the album rather than a visit to one picture, so
      // the next item keeps you going the way you were. The one before it stands
      // in when the deleted item was last, and the album when nothing is left.
      const after = items[index + 1] ?? items[index - 1];
      plain(
        res,
        200,
        after ? `/media/${after.id}/` : `/album/${parseSlug(slug).name}/`,
      );
      return;
    } else if (body.kind === "album") {
      const title = text("title");
      if (!title) {
        plain(res, 400, "An album needs a title.");
        return;
      }
      updateAlbum(
        slug,
        {
          title,
          date: text("date") || undefined,
          date_end: text("date_end") || undefined,
          location: text("location") || undefined,
          cover: text("cover") || undefined,
        },
        text("description"),
      );
    } else {
      plain(res, 400, "Unknown edit kind.");
      return;
    }
  } catch (error) {
    plain(res, 500, error instanceof Error ? error.message : String(error));
    return;
  }

  editedAt = Date.now();
  rebuild();
  plain(res, 200, "ok");
}

function send(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

/**
 * Range requests, because the edge answers them and a video is unplayable
 * without: Safari will not start a `<video>` at all on a bare 200, and an mp4
 * whose `moov` atom sits at the end of the file — where every camera and most
 * encoders leave it — cannot be scrubbed until the reader can ask for the tail.
 * A single range is enough; nothing here sends multipart.
 */
function parseRange(
  header: string | undefined,
  total: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  // `bytes=-500` is the last 500 bytes, not a range starting at zero.
  const start =
    rawStart === "" ? Math.max(0, total - Number(rawEnd)) : Number(rawStart);
  const end = rawStart === "" || rawEnd === "" ? total - 1 : Number(rawEnd);

  if (start >= total || start > end) return "unsatisfiable";
  return { start, end: Math.min(end, total - 1) };
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/_edit") {
    await handleEdit(req, res);
    return;
  }

  const redirect = readRedirects().get(pathname);
  if (redirect) {
    res.writeHead(301, { location: redirect });
    res.end();
    return;
  }

  const media = mediaPath(pathname);
  let file = media ?? sitePath(pathname);
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    send(res, 404, `<h1>404</h1><p>No such page: ${pathname}</p>`);
    return;
  }

  const rendition = renditionFrom(url);
  if (media && rendition) {
    const ext = extname(file).toLowerCase();

    if (rendition.frame !== null && FRAMEABLE.has(ext)) {
      let poster: string | null = null;
      try {
        poster = await renderFrame(file, rendition);
      } catch (error) {
        console.error(`  poster failed for ${pathname}: ${String(error)}`);
      }
      if (poster === null) {
        res.writeHead(200, {
          "content-type": "image/svg+xml",
          "cache-control": "no-store",
        });
        res.end(PLACEHOLDER_POSTER);
        return;
      }
      file = poster;
    } else if (RESIZABLE.has(ext)) {
      try {
        file = await render(file, rendition);
      } catch (error) {
        console.error(`  resize failed for ${pathname}: ${String(error)}`);
      }
    }
  }

  const headers = {
    "content-type": contentType(file),
    "cache-control": media ? "public, max-age=300" : "no-store",
  };

  const total = statSync(file).size;
  const range = parseRange(req.headers.range, total);

  if (range === "unsatisfiable") {
    res.writeHead(416, { ...headers, "content-range": `bytes */${total}` });
    res.end();
    return;
  }

  if (range) {
    res.writeHead(206, {
      ...headers,
      "accept-ranges": "bytes",
      "content-range": `bytes ${range.start}-${range.end}/${total}`,
      "content-length": range.end - range.start + 1,
    });
    createReadStream(file, { start: range.start, end: range.end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    ...headers,
    "accept-ranges": "bytes",
    "content-length": total,
  });
  createReadStream(file).pipe(res);
}

function startWatching(): void {
  let timer: NodeJS.Timeout | undefined;
  const schedule = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // An edit already rebuilt synchronously; rebuilding again here would clear
      // dist just as the browser reloads into it.
      if (Date.now() - editedAt < 1000) return;
      rebuild();
    }, DEBOUNCE_MS);
  };

  for (const target of WATCHED) {
    if (!existsSync(target)) continue;
    watch(target, { recursive: true }, schedule);
  }
}

const portArg = process.argv.find((a) => a.startsWith("--port="))?.split("=")[1];
const port = Number(portArg ?? process.env.PORT ?? 8788);

rebuild();
startWatching();

const server = createServer((req, res) => {
  void handle(req, res);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EADDRINUSE") throw err;
  console.error(`\n  Port ${port} is already in use.`);
  console.error(`  Another dev server is probably still running — stop that one,`);
  console.error(`  or start this one on a different port:\n`);
  console.error(`      mise run dev -- --port=${port + 1}\n`);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`\n  ${cfg.site.host} — local preview`);
  console.log(`  http://localhost:${port}\n`);
  console.log(`  Media is rendered from ${staging}/ and cached in ${CACHE}/.`);
  console.log(`  Sizes mirror production; AVIF/WebP negotiation is edge-only.`);
  console.log(`  Editing albums/ or assets/ rebuilds; editing scripts/ restarts.\n`);
});
