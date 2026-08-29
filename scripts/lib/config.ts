import { readFileSync } from "node:fs";

export interface SiteConfig {
  site: {
    title: string;
    tagline: string;
    host: string;
    author: string;
    locale: string;
    highlights: number;
  };
  media: { host: string; prefix: string; local?: boolean };
  sizes: { thumb: number; phone: number; desktop: number };
}

export function loadConfig(path = "site.config.json"): SiteConfig {
  return JSON.parse(readFileSync(path, "utf8")) as SiteConfig;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy mise.local.toml.example to mise.local.toml, fill it in, ` +
        `run \`mise trust\`, and use \`mise run\` — or export ${name} yourself.`,
    );
  }
  return value;
}

/**
 * Where unprocessed originals are staged before upload.
 *
 * Defaults to `_incoming/` inside the repository, which is convenient but sits
 * in the blast radius of `git clean -xdf`. Point `ALBUMS_STAGING` at a directory
 * outside the repo — an external drive, a photo library — and the originals stop
 * depending on the repository surviving.
 */
export function stagingDir(): string {
  const configured = process.env.ALBUMS_STAGING?.trim();
  return configured === undefined || configured === "" ? "_incoming" : configured;
}
