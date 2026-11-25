import type { ProblemCode } from '../rules/catalogue.ts';
import { dateStyleHint, toIsoDate, type DateStyle } from '../rules/date.ts';
import { COLUMNS, checkCell } from '../rules/columns.ts';
import {
  DUPLICATE_RULES,
  isDuplicateColumn,
  type DuplicateColumn,
} from '../rules/duplicates.ts';

export type Problem = ProblemCode | null;

/** Mutated in place on edits. */
export interface FileData {
  fileName: string;
  rows: string[][];
  problems: Problem[][];
  /** Null when a bulk fix changed the row and it hasn't been rebuilt yet. */
  searchText: (string | null)[];
  duplicates: Record<DuplicateColumn, DuplicateGroups>;
  /** Cells the user changed, as cellKey(row, column) → value in the file. */
  changed: Map<number, string>;
}

export function cellKey(row: number, column: number): number {
  return row * COLUMNS.length + column;
}

/** The separator can't be typed, so a query never matches across two cells. */
export function searchTextOf(row: readonly string[]): string {
  return row.join('\n').toLowerCase();
}

export function checkRow(row: readonly string[]): Problem[] {
  return COLUMNS.map((column, c) => checkCell(column, row[c]));
}

export type DuplicateGroups = Map<string, number[]>;

/**
 * Cells with their own problem (missing, not an email) don't take part: that
 * one is more useful to fix first. Split from markDuplicates so loading can
 * run it chunk by chunk.
 */
export function groupDuplicates(
  groups: DuplicateGroups,
  rows: readonly (readonly string[])[],
  problems: Problem[][],
  column: DuplicateColumn,
  from = 0,
  to = rows.length,
): void {
  const c = COLUMNS.indexOf(column);
  const { key, code } = DUPLICATE_RULES[column];
  for (let r = from; r < to; r++) {
    if (problems[r][c] === code) problems[r][c] = null;
    if (problems[r][c] !== null) continue;
    const k = key(rows[r][c]);
    const group = groups.get(k);
    if (group) group.push(r);
    else groups.set(k, [r]);
  }
}

export function flagDuplicates(
  groups: DuplicateGroups,
  problems: Problem[][],
  column: DuplicateColumn,
): void {
  const c = COLUMNS.indexOf(column);
  const { code } = DUPLICATE_RULES[column];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const r of group) problems[r][c] = code;
  }
}

export function markDuplicates(
  rows: readonly (readonly string[])[],
  problems: Problem[][],
  column: DuplicateColumn,
): void {
  const groups: DuplicateGroups = new Map();
  groupDuplicates(groups, rows, problems, column);
  flagDuplicates(groups, problems, column);
}

/**
 * Writes every date we can read as YYYY-MM-DD, reading dates like 03/04/2024
 * in `style` (the documented assumption). Not marked as changed by the user.
 * Returns how many dates were converted.
 */
export function convertDates(data: FileData, style: DateStyle): number {
  const c = COLUMNS.indexOf('signup_date');
  let converted = 0;
  for (let r = 0; r < data.rows.length; r++) {
    if (data.problems[r][c] !== 'date_other_style') continue;
    const iso = toIsoDate(data.rows[r][c], style);
    if (iso === null) continue;
    data.rows[r][c] = iso;
    data.problems[r][c] = checkCell('signup_date', iso);
    data.searchText[r] = searchTextOf(data.rows[r]);
    converted++;
  }
  return converted;
}

/**
 * The majority of dates that prove a style wins; day first is the default.
 * `proven` is false when that default was used (no evidence or a tie), so the
 * UI doesn't claim the file shows a style it doesn't.
 */
export function detectDateStyle(rows: readonly (readonly string[])[]): {
  style: DateStyle;
  proven: boolean;
} {
  const c = COLUMNS.indexOf('signup_date');
  let dayFirst = 0;
  let monthFirst = 0;
  for (const row of rows) {
    const hint = dateStyleHint(row[c]);
    if (hint === 'day-first') dayFirst++;
    else if (hint === 'month-first') monthFirst++;
  }
  return {
    style: monthFirst > dayFirst ? 'month-first' : 'day-first',
    proven: monthFirst !== dayFirst,
  };
}

export function duplicatePartners(
  data: FileData,
  r: number,
  c: number,
): number[] {
  const column = COLUMNS[c];
  if (!isDuplicateColumn(column)) return [];
  const { key, code } = DUPLICATE_RULES[column];
  if (data.problems[r][c] !== code) return [];
  const group = data.duplicates[column].get(key(data.rows[r][c])) ?? [];
  return group.filter((other) => other !== r);
}
