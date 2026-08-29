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
  describe: { model: string; effort: "low" | "medium" | "high" | "xhigh" | "max" };
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
