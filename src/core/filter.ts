import type { ProblemCode } from '../rules/catalogue.ts';
import { searchTextOf, type FileData, type Problem } from './fileData.ts';

export type RowFilter = { kind: 'all' } | { kind: 'code'; code: ProblemCode };

function matchesFilter(
  rowProblems: readonly Problem[],
  filter: RowFilter,
): boolean {
  return filter.kind === 'all' || rowProblems.includes(filter.code);
}

export interface TextPart {
  text: string;
  match: boolean;
}

export function matchParts(value: string, query: string): TextPart[] {
  const needle = query.trim().toLowerCase();
  const lower = value.toLowerCase();
  // A few characters change length when lowercased (İ), which would shift
  // the positions; rare enough to just leave those values unmarked.
  if (!needle || lower.length !== value.length) {
    return [{ text: value, match: false }];
  }
  const parts: TextPart[] = [];
  let from = 0;
  for (
    let at = lower.indexOf(needle);
    at !== -1;
    at = lower.indexOf(needle, from)
  ) {
    if (at > from) parts.push({ text: value.slice(from, at), match: false });
    parts.push({ text: value.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < value.length)
    parts.push({ text: value.slice(from), match: false });
  return parts;
}

export function filterRows(
  data: Pick<FileData, 'rows' | 'problems' | 'searchText'>,
  filter: RowFilter,
  query: string,
): number[] {
  const { rows, problems, searchText } = data;
  const needle = query.trim().toLowerCase();
  const result: number[] = [];
  for (let r = 0; r < problems.length; r++) {
    if (!matchesFilter(problems[r], filter)) continue;
    if (needle) {
      const text = searchText[r] ?? searchTextOf(rows[r]);
      if (!text.includes(needle)) continue;
    }
    result.push(r);
  }
  return result;
}

export function rebuildSearchText(
  data: FileData,
  rows: readonly number[],
): void {
  for (const r of rows) data.searchText[r] ??= searchTextOf(data.rows[r]);
}

function problemColumn(rowProblems: readonly Problem[], filter: RowFilter) {
  const c =
    filter.kind === 'code'
      ? rowProblems.indexOf(filter.code)
      : rowProblems.findIndex((p) => p !== null);
  return c === -1 ? null : c;
}

export function nextProblem(
  problems: readonly (readonly Problem[])[],
  indexes: readonly number[],
  fromRow: number,
  filter: RowFilter,
): { row: number; column: number } | null {
  const start = indexes.indexOf(fromRow);
  for (let step = 1; step <= indexes.length; step++) {
    const row = indexes[(start + step) % indexes.length];
    if (row === fromRow) continue;
    const column = problemColumn(problems[row], filter);
    if (column !== null) return { row, column };
  }
  return null;
}
