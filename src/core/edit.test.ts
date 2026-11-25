import { describe, expect, it } from 'vitest';
import { COLUMNS } from '../rules/columns.ts';
import { editCell } from './edit.ts';
import {
  cellKey,
  checkRow,
  duplicatePartners,
  flagDuplicates,
  groupDuplicates,
  markDuplicates,
  searchTextOf,
  type DuplicateGroups,
  type FileData,
} from './fileData.ts';

const ID = COLUMNS.indexOf('customer_id');
const EMAIL = COLUMNS.indexOf('email');
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

describe('editCell', () => {
  it('re-checks the cell, marks it changed and updates search text', () => {
    const data = load([row('C-1', 'a@example.com', 'Germany')]);
    expect(data.problems[0][COUNTRY]).toBe('country_not_code');

    expect(editCell(data, 0, COUNTRY, 'DE')).toBe(true);
    expect(data.rows[0][COUNTRY]).toBe('DE');
    expect(data.problems[0][COUNTRY]).toBeNull();
    expect(data.changed.has(cellKey(0, COUNTRY))).toBe(true);
    expect(data.searchText[0]).toContain('de');
    expect(data.searchText[0]).not.toContain('germany');
  });

  it('shows the new problem when the edit is still wrong', () => {
    const data = load([row('C-1', 'a@example.com')]);
    editCell(data, 0, EMAIL, 'a@example');
    expect(data.problems[0][EMAIL]).toBe('email_invalid');
  });

  it('keeps the value from the file across several edits', () => {
    const data = load([row('C-1', 'a@example.com', 'Germany')]);
    editCell(data, 0, COUNTRY, 'DX');
    editCell(data, 0, COUNTRY, 'DE');
    expect(data.changed.get(cellKey(0, COUNTRY))).toBe('Germany');
  });

  it('no longer counts a cell changed back to its file value', () => {
    const data = load([row('C-1', 'a@example.com', 'Germany')]);
    editCell(data, 0, COUNTRY, 'DE');
    editCell(data, 0, COUNTRY, 'Germany');
    expect(data.changed.size).toBe(0);
    expect(data.problems[0][COUNTRY]).toBe('country_not_code');
  });

  it('does nothing when the value is the same', () => {
    const data = load([row('C-1', 'a@example.com')]);
    expect(editCell(data, 0, EMAIL, 'a@example.com')).toBe(false);
    expect(data.changed.size).toBe(0);
  });

  it('clears the flag on both rows when one of a pair is edited', () => {
    const data = load([
      row('C-1', 'a@example.com'),
      row('C-2', 'A@example.com'),
    ]);
    expect(duplicatePartners(data, 0, EMAIL)).toEqual([1]);

    editCell(data, 1, EMAIL, 'b@example.com');
    expect(data.problems.map((p) => p[EMAIL])).toEqual([null, null]);
    expect(duplicatePartners(data, 0, EMAIL)).toEqual([]);
  });

  it('flags both rows when an edit creates a duplicate', () => {
    const data = load([
      row('C-1', 'a@example.com'),
      row('C-2', 'b@example.com'),
    ]);
    editCell(data, 1, ID, ' C-1 ');
    expect(data.problems.map((p) => p[ID])).toEqual([
      'customer_id_duplicate',
      'customer_id_duplicate',
    ]);
    expect(duplicatePartners(data, 1, ID)).toEqual([0]);
  });

  it('keeps the other two flagged when one of three leaves', () => {
    const data = load([
      row('C-1', 'a@example.com'),
      row('C-2', 'a@example.com'),
      row('C-3', 'a@example.com'),
    ]);
    editCell(data, 0, EMAIL, '');
    expect(data.problems.map((p) => p[EMAIL])).toEqual([
      'email_missing',
      'email_duplicate',
      'email_duplicate',
    ]);
    expect(duplicatePartners(data, 1, EMAIL)).toEqual([2]);
  });

  it('lets a row with its own problem join a group once fixed', () => {
    const data = load([row('C-1', 'a@example.com'), row('C-2', '')]);
    editCell(data, 1, EMAIL, 'a@example.com');
    expect(data.problems.map((p) => p[EMAIL])).toEqual([
      'email_duplicate',
      'email_duplicate',
    ]);
  });

  it('ends in the same state as checking the file from scratch', () => {
    const values = [
      'a@example.com',
      'A@example.com',
      'b@example.com',
      '',
      'bad',
    ];
    const ids = ['C-1', 'C-2', 'C-1 ', ''];
    const data = load(
      Array.from({ length: 12 }, (_, i) => row(ids[i % 4], values[i % 5])),
    );
    let seed = 7;
    const next = (n: number) => (seed = (seed * 31 + 11) % 997) % n;
    for (let step = 0; step < 300; step++) {
      const r = next(12);
      if (next(2) === 0) editCell(data, r, EMAIL, values[next(5)]);
      else editCell(data, r, ID, ids[next(4)]);

      const fresh = data.rows.map(checkRow);
      markDuplicates(data.rows, fresh, 'customer_id');
      markDuplicates(data.rows, fresh, 'email');
      expect(data.problems).toEqual(fresh);
    }
  });
});
