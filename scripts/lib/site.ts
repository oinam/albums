import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SiteConfig } from "./config.ts";
import type { Album, Item } from "./albums.ts";
import { chronological, loadAlbums } from "./albums.ts";
import { renderAlbum, renderAlbums, renderItem, renderStream } from "./templates.ts";

export const OUT = "dist";

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

function redirects(albums: Album[]): string {
  const lines = ["/album/ /albums/ 301", "/media/ / 301", "/photos/ / 301"];
  for (const album of albums) {
    lines.push(`/${album.slug}/ /album/${album.slug}/ 301`);
    lines.push(`/albums/${album.slug}/ /album/${album.slug}/ 301`);
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

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const entries = chronological(albums);
  const pageSize = Math.max(1, cfg.site.pageSize);
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));

  for (let page = 1; page <= pageCount; page += 1) {
    const slice = entries.slice((page - 1) * pageSize, page * pageSize);
    const html = renderStream(cfg, slice, page, pageCount);
    write(page === 1 ? "index.html" : `page/${page}/index.html`, html);
  }

  write("albums/index.html", renderAlbums(cfg, albums));

  let items = 0;
  for (const album of albums) {
    write(`album/${album.slug}/index.html`, renderAlbum(cfg, album));
    album.items.forEach((item: Item, index: number) => {
      write(
        `media/${item.id}/index.html`,
        renderItem(cfg, album, item, album.items[index - 1], album.items[index + 1]),
      );
      items += 1;
    });
  }

  write("_redirects", redirects(albums));
  write(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: https://${cfg.site.host}/sitemap.txt\n`,
  );

  const pageUrls = Array.from({ length: pageCount }, (_, i) =>
    i === 0 ? `https://${cfg.site.host}/` : `https://${cfg.site.host}/page/${i + 1}/`,
  );
  write(
    "sitemap.txt",
    `${[
      ...pageUrls,
      `https://${cfg.site.host}/albums/`,
      ...albums.map((a) => `https://${cfg.site.host}/album/${a.slug}/`),
      ...albums.flatMap((a) =>
        a.items.map((i) => `https://${cfg.site.host}/media/${i.id}/`),
      ),
    ].join("\n")}\n`,
  );

  cpSync("assets", join(OUT, "assets"), { recursive: true });
  if (existsSync("favicon.ico")) cpSync("favicon.ico", join(OUT, "favicon.ico"));

  return { albums: albums.length, items };
}
