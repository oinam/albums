import { writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { loadConfig } from "./lib/config.ts";
import type { SiteConfig } from "./lib/config.ts";
import { loadAlbums, formatDate } from "./lib/albums.ts";
import type { Album, Item } from "./lib/albums.ts";
import { loadEnv } from "./lib/env.ts";
import { posterUrl, visionUrl } from "./lib/media.ts";

const VISION_WIDTH = 1024;

const Description = z.object({
  title: z
    .string()
    .describe("A short, specific title of two to six words. No trailing punctuation."),
  alt: z
    .string()
    .describe(
      "Alt text for a screen reader: one sentence naming only what is visibly in the frame.",
    ),
  caption: z
    .string()
    .describe("One or two sentences of context a viewer would find useful."),
  keywords: z
    .array(z.string())
    .describe(
      "Three to eight lowercase subject keywords, single words or short phrases.",
    ),
});

const SYSTEM = `You write metadata for a personal photo archive.

Describe only what is actually visible. Never invent names of people, places, dates,
or events, and never restate the album title as if it were an observation. If you
cannot tell where something is, say nothing about location.

Write plainly. No marketing language, no "this image shows", no exclamation marks.`;

function albumContext(album: Album): string {
  const lines = [
    `Album: ${album.meta.title}`,
    `Date: ${formatDate(album.meta.date, album.meta.date_end)}`,
  ];
  if (album.meta.location) lines.push(`Location: ${album.meta.location}`);
  if (album.description) lines.push(`Album notes: ${album.description}`);
  return lines.join("\n");
}

function sourceUrl(cfg: SiteConfig, album: Album, item: Item): string | null {
  if (item.kind === "photo") return visionUrl(cfg, album.slug, item.file, VISION_WIDTH);
  if (item.kind === "video") return posterUrl(cfg, album.slug, item.file);
  return null;
}

function needsDescription(item: Item, force: boolean): boolean {
  if (item.edited) return false;
  if (item.kind === "audio") return false;
  return force || !item.generated;
}

async function describeItem(
  client: Anthropic,
  cfg: SiteConfig,
  album: Album,
  item: Item,
  url: string,
): Promise<void> {
  const response = await client.messages.parse({
    model: cfg.describe.model,
    max_tokens: 2000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: {
      format: zodOutputFormat(Description),
      effort: cfg.describe.effort,
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url } },
          {
            type: "text",
            text: `${albumContext(album)}\n\nFilename: ${item.file}\n\nDescribe this ${item.kind}.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    console.log(`    declined (${response.stop_details?.category ?? "unknown"})`);
    return;
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    console.log(`    no structured output returned`);
    return;
  }

  item.title = parsed.title;
  item.alt = parsed.alt;
  item.caption = parsed.caption;
  item.keywords = parsed.keywords;
  item.generated = true;
  item.edited = false;
}

async function main(): Promise<void> {
  loadEnv();
  const cfg = loadConfig();
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const only = args.filter((a) => !a.startsWith("--"));

  const albums = loadAlbums().filter(
    (album) => only.length === 0 || only.includes(album.slug),
  );

  const pending = albums.flatMap((album) =>
    album.items
      .filter((item) => needsDescription(item, force))
      .map((item) => ({ album, item })),
  );

  if (pending.length === 0) {
    console.log("Nothing to describe. Use --force to regenerate.");
    return;
  }

  console.log(`${pending.length} item(s) to describe with ${cfg.describe.model}.`);
  if (dryRun) {
    for (const { album, item } of pending) console.log(`  ${album.slug}/${item.file}`);
    console.log("\n--dry-run: no API calls made.");
    return;
  }

  const client = new Anthropic();
  const touched = new Set<Album>();

  for (const { album, item } of pending) {
    const url = sourceUrl(cfg, album, item);
    if (!url) continue;
    console.log(`  ${album.slug}/${item.file}`);
    try {
      await describeItem(client, cfg, album, item, url);
      touched.add(album);
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        console.log(`    API error ${error.status}: ${error.message}`);
        if (error.status === 400) {
          console.log(
            `    Claude fetches the image from ${cfg.media.host} — confirm that host is public.`,
          );
        }
      } else {
        throw error;
      }
    }
  }

  for (const album of touched) {
    writeFileSync(
      join("albums", album.slug, "photos.json"),
      `${JSON.stringify({ items: album.items }, null, 2)}\n`,
    );
    console.log(`Wrote albums/${album.slug}/photos.json`);
  }
  console.log(
    '\nEdit any wording you want to keep, then set "edited": true on that item so it is never regenerated.',
  );
}

await main();
