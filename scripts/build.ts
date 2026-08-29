import { loadConfig } from "./lib/config.ts";
import { buildSite, OUT } from "./lib/site.ts";

const cfg = loadConfig();
if (process.argv.includes("--local")) cfg.media.local = true;

const { albums, items } = buildSite(cfg);
console.log(
  `Built ${albums} album(s), ${items} item page(s) into ${OUT}/` +
    (cfg.media.local ? " (local media)" : ""),
);
