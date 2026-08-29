import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadConfig } from "./lib/config.ts";
import { loadAlbums } from "./lib/albums.ts";
import type { Album, Item } from "./lib/albums.ts";
import {
  renderAlbum,
  renderIndex,
  renderPhoto,
  renderStream,
} from "./lib/templates.ts";

const OUT = "dist";

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
  const lines = ["/albums/ / 301"];
  for (const album of albums) {
    lines.push(`/${album.slug}/ /albums/${album.slug}/ 301`);
  }
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const cfg = loadConfig();
  const albums = loadAlbums();
  assertUniqueIds(albums);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  write("index.html", renderIndex(cfg, albums));
  write("photos/index.html", renderStream(cfg, albums));

  let photoCount = 0;
  for (const album of albums) {
    write(`albums/${album.slug}/index.html`, renderAlbum(cfg, album));

    album.items.forEach((item: Item, index: number) => {
      write(
        `photos/${item.id}/index.html`,
        renderPhoto(cfg, album, item, album.items[index - 1], album.items[index + 1]),
      );
      photoCount += 1;
    });
  }

  write("_redirects", redirects(albums));
  write(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: https://${cfg.site.host}/sitemap.txt\n`,
  );
  write(
    "sitemap.txt",
    [
      `https://${cfg.site.host}/`,
      `https://${cfg.site.host}/photos/`,
      ...albums.map((a) => `https://${cfg.site.host}/albums/${a.slug}/`),
      ...albums.flatMap((a) =>
        a.items.map((i) => `https://${cfg.site.host}/photos/${i.id}/`),
      ),
    ].join("\n") + "\n",
  );

  cpSync("assets", join(OUT, "assets"), { recursive: true });
  if (existsSync("favicon.ico")) cpSync("favicon.ico", join(OUT, "favicon.ico"));

  console.log(
    `Built ${albums.length} album(s), ${photoCount} item page(s) into ${OUT}/`,
  );
}

main();
