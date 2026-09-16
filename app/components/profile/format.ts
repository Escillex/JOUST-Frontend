/**
 * One date format for the whole profile ("Sep 8, 2026"). The page used to
 * show three: raw ISO on matches, locale numerals on tournaments, and this one
 * on awards.
 *
 * A bare YYYY-MM-DD (match dates) is a calendar day, not an instant, so it is
 * read and printed in UTC — otherwise anyone west of Greenwich sees the day
 * before.
 */
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function formatDay(value: string, { withYear = true } = {}): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: withYear ? "numeric" : undefined,
    month: "short",
    day: "numeric",
    timeZone: DAY_ONLY.test(value) ? "UTC" : undefined,
  });
}

/** "January 2026" — for "Member since". */
export function formatMonth(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

export const RESULT_LABEL = { win: "Win", loss: "Loss", draw: "Draw", entry: "Played" } as const;

export const RESULT_CHIP = {
  win: "text-primary border-primary/45",
  loss: "text-[#FF4D4D] border-[#FF4D4D]/45",
  draw: "text-white/70 border-white/25",
  entry: "text-white/70 border-white/25",
} as const;
