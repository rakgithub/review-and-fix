import type { ProblemCode } from './catalogue.ts';

interface Day {
  year: number;
  month: number;
  day: number;
}

const MONTHS = new Map<string, number>(
  [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ].flatMap((name, i) => [
    [name, i + 1],
    [name.slice(0, 3), i + 1],
  ]),
);
MONTHS.set('sept', 9);

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_FIRST = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
const NUMERIC = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
const DAY_MONTH_NAME = /^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})$/i;
const MONTH_NAME_DAY = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i;

function isRealDay({ year, month, day }: Day): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function readings(value: string): Day[] | null {
  let m = YEAR_FIRST.exec(value);
  if (m) return [{ year: +m[1], month: +m[2], day: +m[3] }];

  m = NUMERIC.exec(value);
  if (m) {
    const [a, b, year] = [+m[1], +m[2], +m[3]];
    return [
      { year, month: b, day: a },
      { year, month: a, day: b },
    ];
  }

  m = DAY_MONTH_NAME.exec(value);
  if (m) {
    const month = MONTHS.get(m[2].toLowerCase());
    return month ? [{ year: +m[3], month, day: +m[1] }] : null;
  }

  m = MONTH_NAME_DAY.exec(value);
  if (m) {
    const month = MONTHS.get(m[1].toLowerCase());
    return month ? [{ year: +m[3], month, day: +m[2] }] : null;
  }

  return null;
}

/**
 * Order matters: missing → isn't a date → doesn't exist → different style.
 * The first that applies is the one shown. A date that could mean two days
 * (03/04/2024) is not its own problem: it is read in the file's detected
 * style (see detectDateStyle) and reported as a different style.
 */
export function checkDate(value: string): ProblemCode | null {
  const date = value.trim();
  if (date === '') return 'date_missing';

  const iso = ISO.exec(date);
  if (iso) {
    const day = { year: +iso[1], month: +iso[2], day: +iso[3] };
    return isRealDay(day) ? null : 'date_not_real';
  }

  const options = readings(date);
  if (!options) return 'date_not_a_date';

  if (!options.some(isRealDay)) return 'date_not_real';
  return 'date_other_style';
}

export type DateStyle = 'day-first' | 'month-first';

/** 25/04/2024 proves day first, 04/25/2024 month first; 03/04/2024 nothing. */
export function dateStyleHint(value: string): DateStyle | null {
  const m = NUMERIC.exec(value.trim());
  if (!m) return null;
  const [a, b] = [+m[1], +m[2]];
  if (a > 12 && b <= 12) return 'day-first';
  if (b > 12 && a <= 12) return 'month-first';
  return null;
}

/**
 * 03/04/2024 could be 3 April or 4 March, so the file's date style decides.
 * 25/04/2024, 04/04/2024 and 3 Apr 2024 each mean one day only.
 */
export function isAmbiguousDate(value: string): boolean {
  const options = readings(value.trim());
  return (
    options !== null &&
    options.length === 2 &&
    options.every(isRealDay) &&
    options[0].month !== options[1].month
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(value: string, style: DateStyle): string | null {
  const date = value.trim();
  const iso = ISO.exec(date);
  const options = iso
    ? [{ year: +iso[1], month: +iso[2], day: +iso[3] }]
    : readings(date);
  if (!options) return null;
  // Numeric dates come back as [day first, month first].
  const both = options.length === 2 && options.every(isRealDay);
  const chosen = both
    ? options[style === 'day-first' ? 0 : 1]
    : options.find(isRealDay);
  if (!chosen) return null;
  return `${chosen.year}-${pad(chosen.month)}-${pad(chosen.day)}`;
}
