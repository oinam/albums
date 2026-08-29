import { readFileSync } from "node:fs";

/**
 * Every class the templates emit must have a rule in the stylesheet.
 *
 * This exists because the opposite kept happening quietly: editing CSS by
 * replacing a span between two selectors removed neighbouring rules along with
 * the intended one, and nothing failed — the markup still rendered, just
 * unstyled. Types, lint and the build all stayed green while headings silently
 * lost their styling for several commits.
 */
const TEMPLATES = "scripts/lib/templates.ts";
const STYLESHEET = "assets/site.css";

const markup = readFileSync(TEMPLATES, "utf8");
const css = readFileSync(STYLESHEET, "utf8");

const emitted = new Set(
  [...markup.matchAll(/class="([a-z0-9 _-]+)"/g)]
    .flatMap((match) => (match[1] ?? "").split(/\s+/))
    .filter(Boolean),
);

const missing = [...emitted]
  .filter((name) => !new RegExp(`\\.${name}\\b`).test(css))
  .sort();

if (missing.length > 0) {
  console.error(
    `${missing.length} class(es) emitted by ${TEMPLATES} have no rule in ${STYLESHEET}:`,
  );
  for (const name of missing) console.error(`  .${name}`);
  process.exit(1);
}

console.log(`${emitted.size} emitted classes, all styled.`);
