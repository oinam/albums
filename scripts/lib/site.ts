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
import { chronological, highlightsOf, loadAlbums } from "./albums.ts";
import { loadPages } from "./pages.ts";
import { renderFeed } from "./feed.ts";
import {
  configureChrome,
  layout,
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

function redirects(albums: Album[]): string {
  const lines = ["/albums/ / 301", "/album/ / 301", "/media/ / 301", "/photos/ / 301"];
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

  const pages = loadPages();
  configureChrome(pages, stylesheetHref());

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  write(
    "index.html",
    renderHome(cfg, albums, highlightsOf(albums, cfg.site.highlights)),
  );

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

  write("404.html", renderNotFound(cfg));
  for (const page of pages) {
    write(
      `${page.slug}/index.html`,
      layout({
        cfg,
        title: `${page.title} — ${cfg.site.title}`,
        description: page.title,
        path: `/${page.slug}/`,
        body: `<h1>${page.title}</h1>\n<div class="prose">${page.html}</div>`,
      }),
    );
  }

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
      ...albums.map((a) => `https://${cfg.site.host}/album/${a.slug}/`),
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
