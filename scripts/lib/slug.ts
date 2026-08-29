export interface ParsedSlug {
  /** `YYYY-MM-DD`, `YYYY-MM` or `YYYY` — whatever precision the folder name carried. */
  date?: string;
  dateEnd?: string;
  title: string;
}

const MONTH_MAX = 12;
const DAY_MAX = 31;

function validMonth(m: string): boolean {
  const n = Number(m);
  return n >= 1 && n <= MONTH_MAX;
}

function validDay(d: string): boolean {
  const n = Number(d);
  return n >= 1 && n <= DAY_MAX;
}

function titleCase(rest: string): string {
  return rest
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Reads the date out of an album folder name, in whichever of these it used:
 *
 *   2005-06-14-lego-team          one day
 *   2005-06-14-20-lego-week       a range within the month
 *   2005-06-14-07-20-summer       a range within the year
 *   2005-06-lego-team             a month
 *   2005-lego-team                a year
 *   lego-team                     no date at all
 *
 * Longest pattern first, and every component is range-checked, so a folder that
 * merely starts with digits does not get read as a date.
 *
 * One ambiguity is unavoidable: `2005-06-14-24-hours-in-tokyo` parses as a range
 * from the 14th to the 24th. Only the generated `album.md` is affected, and that
 * file is authoritative once written — correct it there and nothing re-reads the
 * folder name.
 */
export function parseSlug(slug: string): ParsedSlug {
  const yearMonthDayMonthDay = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(.+)$/.exec(
    slug,
  );
  if (
    yearMonthDayMonthDay?.[1] &&
    validMonth(yearMonthDayMonthDay[2] ?? "") &&
    validDay(yearMonthDayMonthDay[3] ?? "") &&
    validMonth(yearMonthDayMonthDay[4] ?? "") &&
    validDay(yearMonthDayMonthDay[5] ?? "")
  ) {
    const [, y, m1, d1, m2, d2, rest] = yearMonthDayMonthDay;
    return {
      date: `${y}-${m1}-${d1}`,
      dateEnd: `${y}-${m2}-${d2}`,
      title: titleCase(rest ?? ""),
    };
  }

  const yearMonthDayDay = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(.+)$/.exec(slug);
  if (
    yearMonthDayDay?.[1] &&
    validMonth(yearMonthDayDay[2] ?? "") &&
    validDay(yearMonthDayDay[3] ?? "") &&
    validDay(yearMonthDayDay[4] ?? "")
  ) {
    const [, y, m, d1, d2, rest] = yearMonthDayDay;
    return {
      date: `${y}-${m}-${d1}`,
      dateEnd: `${y}-${m}-${d2}`,
      title: titleCase(rest ?? ""),
    };
  }

  const yearMonthDay = /^(\d{4})-(\d{2})-(\d{2})-(.+)$/.exec(slug);
  if (
    yearMonthDay?.[1] &&
    validMonth(yearMonthDay[2] ?? "") &&
    validDay(yearMonthDay[3] ?? "")
  ) {
    const [, y, m, d, rest] = yearMonthDay;
    return { date: `${y}-${m}-${d}`, title: titleCase(rest ?? "") };
  }

  const yearMonth = /^(\d{4})-(\d{2})-(.+)$/.exec(slug);
  if (yearMonth?.[1] && validMonth(yearMonth[2] ?? "")) {
    const [, y, m, rest] = yearMonth;
    return { date: `${y}-${m}`, title: titleCase(rest ?? "") };
  }

  const year = /^(\d{4})-(.+)$/.exec(slug);
  if (year?.[1]) {
    const [, y, rest] = year;
    return { date: y, title: titleCase(rest ?? "") };
  }

  return { title: titleCase(slug) };
}
