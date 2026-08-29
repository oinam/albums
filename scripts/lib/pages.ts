import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

export interface Page {
  slug: string;
  title: string;
  html: string;
}

const DIR = "pages";

/**
 * Standalone pages — About, Contact, anything else — as Markdown files.
 *
 * They are optional in the strictest sense: delete the file and the page stops
 * being built *and* stops being linked from the header and footer. Nothing has
 * to be edited in two places to remove one.
 */
export function loadPages(dir = DIR): Page[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => extname(file) === ".md")
    .map((file) => {
      const parsed = matter(readFileSync(join(dir, file), "utf8"));
      const data = parsed.data as { title?: string };
      const slug = basename(file, ".md");
      return {
        slug,
        title: data.title ?? slug,
        html: marked.parse(parsed.content.trim(), { async: false }),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
