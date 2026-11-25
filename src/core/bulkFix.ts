import type { ProblemCode } from '../rules/catalogue.ts';
import { suggestCountry } from '../rules/country.ts';
import { COLUMNS, checkCell } from '../rules/columns.ts';
import { markChanged, writeCell } from './edit.ts';
import { type FileData, type Problem } from './fileData.ts';
import { yieldToBrowser } from './yieldToBrowser.ts';

const COUNTRY = COLUMNS.indexOf('country');

/**
 * Cells written between pauses. Writing all 67k countries at once blocks the
 * page for over 100 ms on a slower laptop; 10k keeps each block well under
 * 50 ms.
 */
export const BULK_SLICE = 10_000;

export const BULK_FIX_CODE: ProblemCode = 'country_not_code';

interface BulkChange {
  from: string;
  to: string;
  rows: number[];
}

export interface BulkFixPlan {
  changes: BulkChange[];
  unchanged: { value: string; rows: number }[];
  total: number;
}

export function planBulkFix(data: FileData): BulkFixPlan {
  const changes = new Map<string, BulkChange>();
  const unchanged = new Map<string, number>();
  for (let r = 0; r < data.rows.length; r++) {
    const problem = data.problems[r][COUNTRY];
    if (problem !== BULK_FIX_CODE && problem !== 'country_unknown') continue;
    const value = data.rows[r][COUNTRY];
    const to = problem === BULK_FIX_CODE ? suggestCountry(value) : null;
    if (to === null) {
      unchanged.set(value, (unchanged.get(value) ?? 0) + 1);
      continue;
    }
    const change = changes.get(value);
    if (change) change.rows.push(r);
    else changes.set(value, { from: value, to, rows: [r] });
  }
  const list = [...changes.values()].sort(
    (a, b) => b.rows.length - a.rows.length,
  );
  return {
    changes: list,
    unchanged: [...unchanged]
      .map(([value, rows]) => ({ value, rows }))
      .sort((a, b) => b.rows - a.rows),
    total: list.reduce((sum, change) => sum + change.rows.length, 0),
  };
}

export interface AppliedBulkFix {
  cells: { row: number; from: string; to: string }[];
  changes: { from: string; to: string; rows: number }[];
}

/**
 * Gives the browser a turn before every BULK_SLICE cells, so the caller must
 * keep the user from editing until it resolves. Leaves search text null, to
 * be rebuilt with rebuildSearchText.
 */
export async function applyBulkFix(
  data: FileData,
  plan: BulkFixPlan,
): Promise<AppliedBulkFix> {
  const cells: AppliedBulkFix['cells'] = [];
  const changes: AppliedBulkFix['changes'] = [];
  let visited = 0;
  for (const { from, to, rows } of plan.changes) {
    const problem = checkCell('country', to);
    let written = 0;
    for (const row of rows) {
      if (visited++ % BULK_SLICE === 0) await yieldToBrowser();
      // Skip cells edited since the preview was made.
      if (data.rows[row][COUNTRY] !== from) continue;
      writeCell(data, row, COUNTRY, to, problem);
      data.searchText[row] = null;
      markChanged(data, row, COUNTRY, from);
      cells.push({ row, from, to });
      written++;
    }
    if (written > 0) changes.push({ from, to, rows: written });
  }
  changes.sort((a, b) => b.rows - a.rows);
  return { cells, changes };
}

export interface UndoCounts {
  reverted: number;
  kept: number;
}

export function countUndo(data: FileData, applied: AppliedBulkFix): UndoCounts {
  const reverted = applied.cells.filter(
    ({ row, to }) => data.rows[row][COUNTRY] === to,
  ).length;
  return { reverted, kept: applied.cells.length - reverted };
}

/**
 * Cells the user edited since the fix keep their value. Pauses like
 * applyBulkFix.
 */
export async function undoBulkFix(
  data: FileData,
  applied: AppliedBulkFix,
): Promise<UndoCounts> {
  const problems = new Map<string, Problem>();
  let reverted = 0;
  for (const [i, { row, from, to }] of applied.cells.entries()) {
    if (i % BULK_SLICE === 0) await yieldToBrowser();
    if (data.rows[row][COUNTRY] !== to) continue;
    let problem = problems.get(from);
    if (problem === undefined) {
      problem = checkCell('country', from);
      problems.set(from, problem);
    }
    writeCell(data, row, COUNTRY, from, problem);
    data.searchText[row] = null;
    // Only cells changed before the fix stay marked.
    markChanged(data, row, COUNTRY, to);
    reverted++;
  }
  return { reverted, kept: applied.cells.length - reverted };
}
