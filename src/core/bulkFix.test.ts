import { describe, expect, it } from 'vitest';
import { COLUMNS } from '../rules/columns.ts';
import {
  applyBulkFix,
  BULK_SLICE,
  countUndo,
  planBulkFix,
  undoBulkFix,
} from './bulkFix.ts';
import { editCell } from './edit.ts';
import {
  cellKey,
  checkRow,
  flagDuplicates,
  groupDuplicates,
  searchTextOf,
  type DuplicateGroups,
  type FileData,
} from './fileData.ts';
import { filterRows, rebuildSearchText, type RowFilter } from './filter.ts';

const COUNTRY = COLUMNS.indexOf('country');

function row(id: string, email: string, country = 'DE'): string[] {
  return [id, 'Anna', 'Müller', email, '2024-04-03', country, 'pro', '49'];
}

function load(rows: string[][]): FileData {
  const problems = rows.map(checkRow);
  const idGroups: DuplicateGroups = new Map();
  const emailGroups: DuplicateGroups = new Map();
  groupDuplicates(idGroups, rows, problems, 'customer_id');
  groupDuplicates(emailGroups, rows, problems, 'email');
  flagDuplicates(idGroups, problems, 'customer_id');
  flagDuplicates(emailGroups, problems, 'email');
  return {
    fileName: 'test.csv',
    rows,
    problems,
    searchText: rows.map(searchTextOf),
    duplicates: { customer_id: idGroups, email: emailGroups },
    changed: new Map(),
  };
}

describe('country fix', () => {
  const countries = (data: FileData) => data.rows.map((r) => r[COUNTRY]);

  it('previews each before → after pair and what it leaves unchanged', () => {
    const data = load([
      row('C-1', 'a@x.com', 'Germany'),
      row('C-2', 'b@x.com', 'Germany'),
      row('C-3', 'c@x.com', 'uk'),
      row('C-4', 'd@x.com', 'DE'),
      row('C-5', 'e@x.com', 'Atlantis'),
      row('C-6', 'f@x.com', ''),
    ]);
    const plan = planBulkFix(data);
    expect(plan.changes).toEqual([
      { from: 'Germany', to: 'DE', rows: [0, 1] },
      { from: 'uk', to: 'GB', rows: [2] },
    ]);
    expect(plan.total).toBe(3);
    expect(plan.unchanged).toEqual([
      { value: 'Atlantis', rows: 1 },
      { value: '', rows: 1 },
    ]);
    expect(countries(data)[0]).toBe('Germany');
  });

  it('applies the fix, marks cells changed and clears the problems', async () => {
    const data = load([row('C-1', 'a@x.com', 'Deutschland')]);
    const applied = await applyBulkFix(data, planBulkFix(data));
    expect(applied.cells).toHaveLength(1);
    expect(countries(data)).toEqual(['DE']);
    expect(data.problems[0][COUNTRY]).toBeNull();
    expect(data.changed.has(cellKey(0, COUNTRY))).toBe(true);
  });

  it('undo puts values back and removes the changed marker', async () => {
    const data = load([row('C-1', 'a@x.com', 'Deutschland')]);
    const applied = await applyBulkFix(data, planBulkFix(data));
    expect(await undoBulkFix(data, applied)).toEqual({ reverted: 1, kept: 0 });
    expect(countries(data)).toEqual(['Deutschland']);
    expect(data.problems[0][COUNTRY]).toBe('country_not_code');
    expect(data.changed.size).toBe(0);
  });

  it('undo keeps cells the user edited after the fix', async () => {
    const data = load([
      row('C-1', 'a@x.com', 'Germany'),
      row('C-2', 'b@x.com', 'Germany'),
    ]);
    const applied = await applyBulkFix(data, planBulkFix(data));
    editCell(data, 1, COUNTRY, 'AT');
    expect(await undoBulkFix(data, applied)).toEqual({ reverted: 1, kept: 1 });
    expect(countries(data)).toEqual(['Germany', 'AT']);
    expect(data.changed.has(cellKey(1, COUNTRY))).toBe(true);
  });

  it('counts what undo would put back without changing anything', async () => {
    const data = load([row('C-1', 'a@x.com', 'Deutschland')]);
    const applied = await applyBulkFix(data, planBulkFix(data));
    expect(countUndo(data, applied)).toEqual({ reverted: 1, kept: 0 });
    expect(countries(data)).toEqual(['DE']);
  });

  it('counts cells edited after the fix as kept, matching undo', async () => {
    const data = load([
      row('C-1', 'a@x.com', 'Germany'),
      row('C-2', 'b@x.com', 'Germany'),
    ]);
    const applied = await applyBulkFix(data, planBulkFix(data));
    editCell(data, 1, COUNTRY, 'AT');
    const counted = countUndo(data, applied);
    expect(counted).toEqual({ reverted: 1, kept: 1 });
    expect(await undoBulkFix(data, applied)).toEqual(counted);
  });

  it('undo keeps the changed marker on cells edited before the fix', async () => {
    const data = load([row('C-1', 'a@x.com', 'DE')]);
    editCell(data, 0, COUNTRY, 'germany');
    const applied = await applyBulkFix(data, planBulkFix(data));
    await undoBulkFix(data, applied);
    expect(countries(data)).toEqual(['germany']);
    expect(data.changed.has(cellKey(0, COUNTRY))).toBe(true);
  });

  it('search finds the new values right after the fix and after undo', async () => {
    const data = load([
      row('C-1', 'a@x.com', 'Deutschland'),
      row('C-2', 'b@x.com', 'DE'),
    ]);
    const all: RowFilter = { kind: 'all' };
    const applied = await applyBulkFix(data, planBulkFix(data));
    expect(filterRows(data, all, 'deutschland')).toEqual([]);
    expect(filterRows(data, all, 'de')).toEqual([0, 1]);

    rebuildSearchText(data, [0]);
    expect(data.searchText[0]).toBe(searchTextOf(data.rows[0]));

    await undoBulkFix(data, applied);
    expect(filterRows(data, all, 'deutschland')).toEqual([0]);
    rebuildSearchText(data, [0]);
    expect(data.searchText[0]).toContain('deutschland');
  });

  it('skips cells edited between the preview and applying', async () => {
    const data = load([row('C-1', 'a@x.com', 'Germany')]);
    const plan = planBulkFix(data);
    editCell(data, 0, COUNTRY, 'FR');
    expect((await applyBulkFix(data, plan)).cells).toHaveLength(0);
    expect(countries(data)).toEqual(['FR']);
  });

  it('sums up what changed, counting only cells it wrote, largest first', async () => {
    const data = load([
      row('C-1', 'a@x.com', 'Germany'),
      row('C-2', 'b@x.com', 'Germany'),
      row('C-3', 'c@x.com', 'uk'),
      row('C-4', 'd@x.com', 'uk'),
      row('C-5', 'e@x.com', 'uk'),
    ]);
    const plan = planBulkFix(data);
    // Edited after the preview, so the fix leaves them alone.
    editCell(data, 3, COUNTRY, 'IE');
    editCell(data, 4, COUNTRY, 'IE');
    const applied = await applyBulkFix(data, plan);
    expect(applied.changes).toEqual([
      { from: 'Germany', to: 'DE', rows: 2 },
      { from: 'uk', to: 'GB', rows: 1 },
    ]);
  });

  it('changes every cell when the fix runs in several slices', async () => {
    const count = BULK_SLICE * 2 + 1;
    const data = load(
      Array.from({ length: count }, (_, i) =>
        row(`C-${i}`, `${i}@x.com`, 'Germany'),
      ),
    );
    const applied = await applyBulkFix(data, planBulkFix(data));
    expect(applied.cells).toHaveLength(count);
    expect(countries(data).every((c) => c === 'DE')).toBe(true);

    expect(await undoBulkFix(data, applied)).toEqual({
      reverted: count,
      kept: 0,
    });
    expect(countries(data).every((c) => c === 'Germany')).toBe(true);
    expect(data.changed.size).toBe(0);
  });
});
