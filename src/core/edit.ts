import { COLUMNS, checkCell } from '../rules/columns.ts';
import {
  DUPLICATE_RULES,
  isDuplicateColumn,
  type DuplicateColumn,
} from '../rules/duplicates.ts';
import {
  cellKey,
  searchTextOf,
  type FileData,
  type Problem,
} from './fileData.ts';

/** Also re-flags rows that shared the old value or share the new one. */
export function editCell(
  data: FileData,
  r: number,
  c: number,
  value: string,
): boolean {
  const old = data.rows[r][c];
  if (!writeCell(data, r, c, value)) return false;
  data.searchText[r] = searchTextOf(data.rows[r]);
  markChanged(data, r, c, old);
  return true;
}

/** Keeps the file's value; a cell set back to it no longer counts as changed. */
export function markChanged(
  data: FileData,
  r: number,
  c: number,
  old: string,
): void {
  const key = cellKey(r, c);
  const original = data.changed.get(key) ?? old;
  if (data.rows[r][c] === original) data.changed.delete(key);
  else data.changed.set(key, original);
}

export function writeCell(
  data: FileData,
  r: number,
  c: number,
  value: string,
  problem: Problem = checkCell(COLUMNS[c], value),
): boolean {
  const old = data.rows[r][c];
  if (value === old) return false;
  const column = COLUMNS[c];
  const dup = isDuplicateColumn(column) ? column : null;

  if (dup) leaveGroup(data, r, c, dup, old);
  data.rows[r][c] = value;
  data.problems[r][c] = problem;
  if (dup) joinGroup(data, r, c, dup, value);
  return true;
}

function leaveGroup(
  data: FileData,
  r: number,
  c: number,
  column: DuplicateColumn,
  old: string,
): void {
  const { key, code } = DUPLICATE_RULES[column];
  const own = data.problems[r][c];
  if (own !== null && own !== code) return; // was never grouped
  const groups = data.duplicates[column];
  const k = key(old);
  const group = (groups.get(k) ?? []).filter((other) => other !== r);
  if (group.length === 0) groups.delete(k);
  else groups.set(k, group);
  if (group.length === 1) data.problems[group[0]][c] = null;
}

function joinGroup(
  data: FileData,
  r: number,
  c: number,
  column: DuplicateColumn,
  value: string,
): void {
  if (data.problems[r][c] !== null) return; // its own problem comes first
  const { key, code } = DUPLICATE_RULES[column];
  const groups = data.duplicates[column];
  const k = key(value);
  const group = [...(groups.get(k) ?? []), r];
  groups.set(k, group);
  if (group.length < 2) return;
  for (const other of group) data.problems[other][c] = code;
}
