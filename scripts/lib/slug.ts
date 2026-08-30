export interface ParsedSlug {
  /** `YYYY-MM-DD`, or absent when the folder did not start with one. */
  date?: string;
  /** The folder name with the date prefix removed. This is the album's URL. */
  name: string;
  title: string;
}

const MONTH_MAX = 12;
const DAY_MAX = 31;

/**
 * Words that stay lowercase inside a title. Never applied to the first or last
 * word, which is what the convention actually says.
 */
const MINOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "onto",
  "or",
  "over",
  "per",
  "the",
  "to",
  "up",
  "via",
  "with",
]);

function titleCase(rest: string): string {
  const words = rest.split("-").filter(Boolean);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      const isEdge = index === 0 || index === words.length - 1;
      if (!isEdge && MINOR_WORDS.has(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Album folders are `YYYY-MM-DD-album-title`, and nothing else.
 *
 * Earlier this understood month-only, year-only and two range forms, which made
 * `2005-06-14-24-hours-in-tokyo` unreadable — is `24` the end of a range or the
 * start of the title? One shape removes the question: the date is always exactly
 * ten characters, and everything after it is the title. Use `01` for a day or
 * month you do not know.
 *
 * The title is a starting point. Automatic casing keeps minor words lowercase
 * inside the title, but it cannot know every convention — `album.md` is written
 * once and is authoritative from then on, so correct it there.
 */
export function parseSlug(slug: string): ParsedSlug {
  const match = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/.exec(slug);
  if (!match?.[1]) return { name: slug, title: titleCase(slug) };

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > MONTH_MAX || day < 1 || day > DAY_MAX) {
    return { name: slug, title: titleCase(slug) };
  }

  const name = match[4] ?? "";
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    name,
    title: titleCase(name),
  };
}
