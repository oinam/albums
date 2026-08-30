import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { SiteConfig } from "./config.ts";
import type { Album, Item } from "./albums.ts";
import { chronological, loadAlbums } from "./albums.ts";
import { renderFeed } from "./feed.ts";
import {
  configureChrome,
  renderAlbum,
  renderHome,
  renderItem,
  renderNotFound,
  renderRandom,
} from "./templates.ts";

export const OUT = "dist";

const STYLESHEET = "assets/site.css";

/**
 * The stylesheet is served with a one-year cache and its URL never changed, so a
 * returning visitor kept the old file long after a deploy — new markup styled by
 * old rules. Hashing the contents into the name means a change is a different
 * URL, which is what makes caching it for a year correct instead of harmful.
 */
function stylesheetHref(): string {
  const hash = createHash("sha256")
    .update(readFileSync(STYLESHEET))
    .digest("hex")
    .slice(0, 8);
  return `/assets/site.${hash}.css`;
}

function write(path: string, contents: string): void {
  const full = join(OUT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

function assertUniqueIds(albums: Album[]): void {
  const seen = new Map<string, string>();
  for (const album of albums) {
    for (const item of album.items) {
      const previous = seen.get(item.id);
      if (previous) {
        throw new Error(
          `Duplicate photo id "${item.id}" in ${album.slug}/${item.file} and ${previous}. ` +
            `Ids are permalinks — change one by hand in photos.json.`,
        );
      }
      seen.set(item.id, `${album.slug}/${item.file}`);
    }
  }
}

/**
 * Two folders can reduce to the same URL — `2005-06-07-london` and
 * `2026-06-16-london` are different albums that both want `/album/london/`. The
 * build must stop rather than write one album over the other.
 */
function assertUniqueAlbumPaths(albums: Album[]): void {
  const seen = new Map<string, string>();
  for (const album of albums) {
    const previous = seen.get(album.path);
    if (previous) {
      throw new Error(
        `Albums "${previous}" and "${album.slug}" both resolve to /album/${album.path}/. ` +
          `Rename one folder — the part after the date has to be unique.`,
      );
    }
    seen.set(album.path, album.slug);
  }
}

function redirects(albums: Album[]): string {
  const lines = ["/albums/ / 301", "/album/ / 301", "/media/ / 301", "/photos/ / 301"];
  for (const album of albums) {
    const to = `/album/${album.path}/`;
    lines.push(`/${album.path}/ ${to} 301`);
    lines.push(`/albums/${album.path}/ ${to} 301`);
    // The dated URLs were live before the folder date stopped being part of them.
    if (album.slug !== album.path) {
      lines.push(`/album/${album.slug}/ ${to} 301`);
      lines.push(`/${album.slug}/ ${to} 301`);
      lines.push(`/albums/${album.slug}/ ${to} 301`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export interface BuildResult {
  albums: number;
  items: number;
}

export function buildSite(cfg: SiteConfig): BuildResult {
  const albums = loadAlbums();
  assertUniqueIds(albums);
  assertUniqueAlbumPaths(albums);

  configureChrome(stylesheetHref());

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  write("index.html", renderHome(cfg, albums));

  let items = 0;
  for (const album of albums) {
    write(`album/${album.path}/index.html`, renderAlbum(cfg, album));
    album.items.forEach((item: Item, index: number) => {
      write(
        `media/${item.id}/index.html`,
        renderItem(cfg, album, item, album.items[index - 1], album.items[index + 1]),
      );
      items += 1;
    });
  }

  write("404.html", renderNotFound(cfg));

  write("random/index.html", renderRandom(cfg, chronological(albums)));
  write("feed.xml", renderFeed(cfg, chronological(albums)));
  write("_redirects", redirects(albums));
  write(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: https://${cfg.site.host}/sitemap.txt\n`,
  );

  write(
    "sitemap.txt",
    `${[
      `https://${cfg.site.host}/`,
      ...albums.map((a) => `https://${cfg.site.host}/album/${a.path}/`),
      ...albums.flatMap((a) =>
        a.items.map((i) => `https://${cfg.site.host}/media/${i.id}/`),
      ),
    ].join("\n")}\n`,
  );

  cpSync("assets", join(OUT, "assets"), { recursive: true });
  writeFileSync(join(OUT, stylesheetHref().slice(1)), readFileSync(STYLESHEET));
  if (existsSync("favicon.ico")) cpSync("favicon.ico", join(OUT, "favicon.ico"));

  return { albums: albums.length, items };
}
