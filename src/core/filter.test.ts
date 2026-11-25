import { describe, expect, it } from 'vitest';
import {
  checkRow,
  markDuplicates,
  searchTextOf,
  type Problem,
} from './fileData.ts';
import {
  filterRows,
  matchParts,
  nextProblem,
  type RowFilter,
} from './filter.ts';

// customer_id, first, last, email, date, country, plan, spend
const ROWS = [
  [
    'C-1',
    'Anna',
    'Müller',
    'anna@example.com',
    '2024-04-03',
    'DE',
    'pro',
    '49',
  ],
  ['C-2', '', '', 'luca@example.com', '2024-04-03', 'Germany', 'pro', '49'],
  [
    'C-3',
    'Mia',
    'Rossi',
    'mia@example.com',
    '2024-04-03',
    'Italia',
    'free',
    '0',
  ],
  ['C-4', 'Noah', 'Weber', 'NOAH@example.com', '2024-04-03', 'FR', 'PRO', '49'],
  ['C-5', 'Emma', 'Novak', 'noah@example.com', '2024-04-03', 'PL', 'pro', '49'],
];

function check(rows: string[][]) {
  const problems = rows.map(checkRow);
  markDuplicates(rows, problems, 'customer_id');
  markDuplicates(rows, problems, 'email');
  return problems;
}

describe('filterRows', () => {
  const data = {
    rows: ROWS,
    problems: check(ROWS),
    searchText: ROWS.map(searchTextOf),
  };

  it('shows all rows or one problem type', () => {
    expect(filterRows(data, { kind: 'all' }, '')).toEqual([0, 1, 2, 3, 4]);
    expect(
      filterRows(data, { kind: 'code', code: 'country_not_code' }, ''),
    ).toEqual([1, 2]);
  });

  it('searches any part of any value, ignoring case and surrounding spaces', () => {
    expect(filterRows(data, { kind: 'all' }, '  noah ')).toEqual([3, 4]);
    expect(filterRows(data, { kind: 'all' }, 'üll')).toEqual([0]);
    expect(filterRows(data, { kind: 'all' }, 'c-3')).toEqual([2]);
    expect(filterRows(data, { kind: 'all' }, 'nobody')).toEqual([]);
  });

  it("doesn't match across two cells", () => {
    expect(filterRows(data, { kind: 'all' }, 'anna müller')).toEqual([]);
    expect(filterRows(data, { kind: 'all' }, 'c-1anna')).toEqual([]);
  });

  it('combines search with the filter', () => {
    expect(
      filterRows(data, { kind: 'code', code: 'email_duplicate' }, 'emma'),
    ).toEqual([4]);
    expect(
      filterRows(data, { kind: 'code', code: 'plan_invalid' }, 'anna'),
    ).toEqual([]);
  });
});

describe('nextProblem', () => {
  const problems: Problem[][] = [
    [null, null],
    [null, 'plan_invalid'],
    ['name_missing', null],
    [null, null],
    [null, 'plan_invalid'],
  ];
  const all = [0, 1, 2, 3, 4];

  it('finds the next row with any problem in All rows', () => {
    expect(nextProblem(problems, all, 1, { kind: 'all' })).toEqual({
      row: 2,
      column: 0,
    });
  });

  it('only looks for the filtered problem', () => {
    const filter: RowFilter = { kind: 'code', code: 'plan_invalid' };
    expect(nextProblem(problems, all, 1, filter)).toEqual({
      row: 4,
      column: 1,
    });
  });

  it('wraps around to the top', () => {
    expect(nextProblem(problems, all, 4, { kind: 'all' })).toEqual({
      row: 1,
      column: 1,
    });
  });

  it('returns null when no other row has a problem', () => {
    expect(nextProblem(problems, [0, 1, 3], 1, { kind: 'all' })).toBeNull();
  });
});

describe('matchParts', () => {
  it('marks every match, ignoring case', () => {
    expect(matchParts('Anna ANN', 'ann')).toEqual([
      { text: 'Ann', match: true },
      { text: 'a ', match: false },
      { text: 'ANN', match: true },
    ]);
  });

  it('trims the search like the filter does', () => {
    expect(matchParts('a@x.de', '  x.d ')).toEqual([
      { text: 'a@', match: false },
      { text: 'x.d', match: true },
      { text: 'e', match: false },
    ]);
  });

  it('leaves the value whole without a search or a match', () => {
    expect(matchParts('Berlin', '')).toEqual([
      { text: 'Berlin', match: false },
    ]);
    expect(matchParts('Berlin', 'xyz')).toEqual([
      { text: 'Berlin', match: false },
    ]);
  });
});
