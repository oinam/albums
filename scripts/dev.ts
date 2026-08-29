import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  watch,
} from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import sharp from "sharp";
import { loadConfig } from "./lib/config.ts";
import { contentType } from "./lib/mime.ts";
import { OUT, buildSite } from "./lib/site.ts";

const STAGING = "_incoming";
const CACHE = ".dev-cache";
const RESIZABLE = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
// Content only. Changes under scripts/ are handled by `tsx watch`, which restarts
// the process — an in-process rebuild would keep running the old modules.
const WATCHED = ["albums", "assets", "site.config.json"];
const DEBOUNCE_MS = 120;

const cfg = loadConfig();
cfg.media.local = true;

function rebuild(): void {
  try {
    const { albums, items } = buildSite(cfg);
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
  const path = join(OUT, "_redirects");
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
  return within(STAGING, pathname.slice(prefix.length));
}

function sitePath(pathname: string): string | null {
  const candidate = within(OUT, decodeURIComponent(pathname));
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
}

function renditionFrom(url: URL): Rendition | null {
  const width = Number(url.searchParams.get("w"));
  if (!Number.isFinite(width) || width <= 0) return null;
  const rawHeight = Number(url.searchParams.get("h"));
  return {
    width,
    height: Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : null,
    cover: url.searchParams.get("fit") === "cover",
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

function send(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

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
  if (media && rendition && RESIZABLE.has(extname(file).toLowerCase())) {
    try {
      file = await render(file, rendition);
    } catch (error) {
      console.error(`  resize failed for ${pathname}: ${String(error)}`);
    }
  }

  res.writeHead(200, {
    "content-type": contentType(file),
    "cache-control": media ? "public, max-age=300" : "no-store",
  });
  createReadStream(file).pipe(res);
}

function startWatching(): void {
  let timer: NodeJS.Timeout | undefined;
  const schedule = (): void => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, DEBOUNCE_MS);
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

createServer((req, res) => {
  void handle(req, res);
}).listen(port, () => {
  console.log(`\n  albums.oinam.com — local preview`);
  console.log(`  http://localhost:${port}\n`);
  console.log(`  Media is rendered from ${STAGING}/ and cached in ${CACHE}/.`);
  console.log(`  Sizes mirror production; AVIF/WebP negotiation is edge-only.`);
  console.log(`  Editing albums/ or assets/ rebuilds; editing scripts/ restarts.\n`);
});
