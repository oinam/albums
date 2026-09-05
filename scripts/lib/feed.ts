import type { SiteConfig } from "./config.ts";
import type { Item, StreamEntry } from "./albums.ts";
import { orientationOf, plainText } from "./albums.ts";
import { contentType } from "./mime.ts";
import {
  originalUrl,
  posterThumbUrl,
  posterUrl,
  scaledUrl,
  thumbSize,
  thumbUrl,
} from "./media.ts";

const MAX_ITEMS = 50;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A reader sorts by this, not by the order of the document, so every item needs
 * its own moment — without the capture time every photo in an album shared one
 * timestamp and arrived as an undifferentiated heap.
 *
 * The `Z` is not decoration. `taken` is wall-clock with no zone, and a bare
 * date-time string is parsed as local, so the same album would publish different
 * timestamps from a laptop and from the build that runs on Pages. `date` and
 * `sortKey` are date-only and already parse as UTC.
 */
function pubDate(entry: StreamEntry): string {
  const taken = entry.item.taken ? `${entry.item.taken}Z` : undefined;
  const raw = entry.item.date ?? taken ?? entry.album.sortKey;
  const parsed = raw ? new Date(raw) : new Date(Number.NaN);
  return (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toUTCString();
}

/**
 * `scale-down` never enlarges, so a rendition asked for at 800 is 800 wide only
 * if the original is at least that. Getting this right is what lets the feed
 * state real dimensions rather than guess them.
 */
function scaledSize(
  item: Item,
  width: number,
): { width: number; height: number } | undefined {
  if (item.width === undefined || item.height === undefined) return undefined;
  const w = Math.min(width, item.width);
  return { width: w, height: Math.round((item.height * w) / item.width) };
}

/**
 * Everything a feed item needs, resolved once. A subscriber's reader is not on
 * this machine, so `url()` forces every media URL absolute: local mode emits
 * site-rooted paths for the dev server, and those would resolve against the
 * reader's own host.
 */
class Entry {
  readonly link: string;
  readonly albumLink: string;

  constructor(
    private readonly cfg: SiteConfig,
    private readonly entry: StreamEntry,
    private readonly origin: string,
  ) {
    this.link = `${origin}/media/${entry.item.id}/`;
    this.albumLink = `${origin}/album/${entry.album.path}/`;
  }

  private url(value: string): string {
    return value.startsWith("/") ? `${this.origin}${value}` : value;
  }

  /** The picture a reader shows in its list: a grid thumbnail, at its exact size. */
  thumbnail(): string {
    const { album, item } = this.entry;
    if (item.kind === "audio") return "";
    const orientation = orientationOf(item);
    const { width, height } = thumbSize(this.cfg, orientation);
    const src = this.url(
      item.kind === "video"
        ? posterThumbUrl(this.cfg, album.slug, item, orientation)
        : thumbUrl(this.cfg, album.slug, item.file, orientation),
    );
    return `<media:thumbnail url="${escapeXml(src)}" width="${width}" height="${height}"/>`;
  }

  /**
   * The media itself.
   *
   * A photo is published as its 1600px rendition rather than the original, for
   * two reasons. Renditions carry `metadata=none`; the original carries its full
   * EXIF block, GPS included, and the site hands that out only behind a
   * deliberate `Original` click — a feed pushes to everyone who subscribed,
   * which is not the same act. And a rendition is an existing rung of the
   * ladder, so it bills nothing new. Video and audio have no ladder: the
   * original is the media, and it is already what the item page plays.
   *
   * No `type` on a photo. The rendition is `format=auto`, so what comes back is
   * whatever the fetching client's `Accept` header negotiated — declaring
   * `image/jpeg` would name one of three possible answers.
   */
  content(): string {
    const { album, item } = this.entry;

    if (item.kind === "photo") {
      const src = this.url(
        scaledUrl(this.cfg, album.slug, item.file, this.cfg.sizes.desktop),
      );
      const size = scaledSize(item, this.cfg.sizes.desktop);
      const dims = size ? ` width="${size.width}" height="${size.height}"` : "";
      return `<media:content url="${escapeXml(src)}" medium="image"${dims}/>`;
    }

    const src = this.url(originalUrl(this.cfg, album.slug, item.file));
    const dims =
      item.width !== undefined && item.height !== undefined
        ? ` width="${item.width}" height="${item.height}"`
        : "";
    return `<media:content url="${escapeXml(src)}" medium="${item.kind}" type="${escapeXml(contentType(item.file))}"${dims}/>`;
  }

  /**
   * The body a reader renders. `description` stays plain text — it is the
   * summary, and a reader that shows only that should still get a sentence
   * rather than markup, which is why the Markdown is flattened for it. This is
   * where the picture goes, and where the description keeps its formatting.
   *
   * Audio gets no image: there is nothing to show, on this page or any other,
   * and a placeholder would be worse than the link alone.
   */
  encoded(): string {
    const { album, item } = this.entry;
    const href = escapeXml(this.link);
    const alt = escapeXml(item.alt ?? item.title ?? "");
    const parts: string[] = [];

    if (item.kind === "photo") {
      const src = this.url(
        scaledUrl(this.cfg, album.slug, item.file, this.cfg.sizes.phone),
      );
      const size = scaledSize(item, this.cfg.sizes.phone);
      const dims = size ? ` width="${size.width}" height="${size.height}"` : "";
      parts.push(
        `<a href="${href}"><img src="${escapeXml(src)}" alt="${alt}"${dims}></a>`,
      );
    } else if (item.kind === "video") {
      const src = this.url(posterUrl(this.cfg, album.slug, item));
      parts.push(`<a href="${href}"><img src="${escapeXml(src)}" alt="${alt}"></a>`);
    }

    // The description is Markdown, and this is the one place a reader is handed
    // HTML — so it arrives rendered, links and all, rather than as its source.
    if (item.descriptionHtml) parts.push(item.descriptionHtml);
    // The album, linking to the album — the reader already links the item itself,
    // both as the headline and on the image above.
    parts.push(
      `<p><a href="${escapeXml(this.albumLink)}">${escapeXml(album.meta.title)}</a></p>`,
    );

    return parts.join("");
  }
}

export function renderFeed(cfg: SiteConfig, entries: StreamEntry[]): string {
  const origin = `https://${cfg.site.host}`;

  const items = entries.slice(0, MAX_ITEMS).map((streamEntry) => {
    const entry = new Entry(cfg, streamEntry, origin);
    const { album, item } = streamEntry;
    const title = item.title ?? `${album.meta.title} — ${item.file}`;

    const rows = [
      `<title>${escapeXml(title)}</title>`,
      `<link>${escapeXml(entry.link)}</link>`,
      `<guid isPermaLink="true">${escapeXml(entry.link)}</guid>`,
      `<pubDate>${pubDate(streamEntry)}</pubDate>`,
      // The album is the item's category, and `domain` is a URL by design — so
      // one element carries both halves a consumer needs in order to group.
      `<category domain="${escapeXml(entry.albumLink)}">${escapeXml(album.meta.title)}</category>`,
      `<description>${escapeXml(item.description ? plainText(item.description) : album.meta.title)}</description>`,
      `<content:encoded>${escapeXml(entry.encoded())}</content:encoded>`,
      entry.content(),
      entry.thumbnail(),
    ].filter(Boolean);

    return `    <item>\n${rows.map((row) => `      ${row}`).join("\n")}\n    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(cfg.site.title)}</title>
    <link>${origin}/</link>
    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(cfg.site.tagline)}</description>
    <language>${escapeXml(cfg.site.locale)}</language>
${items.join("\n")}
  </channel>
</rss>
`;
}
