import type { SiteConfig } from "./config.ts";
import type { StreamEntry } from "./albums.ts";

const MAX_ITEMS = 50;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pubDate(entry: StreamEntry): string {
  const raw = entry.item.date ?? entry.item.taken ?? entry.album.sortKey;
  const parsed = raw ? new Date(raw) : new Date(Number.NaN);
  return (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toUTCString();
}

export function renderFeed(cfg: SiteConfig, entries: StreamEntry[]): string {
  const origin = `https://${cfg.site.host}`;
  const items = entries.slice(0, MAX_ITEMS).map((entry) => {
    const link = `${origin}/media/${entry.item.id}/`;
    const title = entry.item.title ?? `${entry.album.meta.title} — ${entry.item.file}`;
    const description = entry.item.description ?? entry.album.meta.title;
    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate(entry)}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
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
