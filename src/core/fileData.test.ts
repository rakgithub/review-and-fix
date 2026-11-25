import { describe, expect, it } from 'vitest';
import {
  checkRow,
  convertDates,
  flagDuplicates,
  groupDuplicates,
  markDuplicates,
  searchTextOf,
  type DuplicateGroups,
  type FileData,
  type Problem,
  detectDateStyle,
} from './fileData.ts';
import { COLUMNS } from '../rules/columns.ts';

const ID = COLUMNS.indexOf('customer_id');
const EMAIL = COLUMNS.indexOf('email');

function row(id: string, email: string): string[] {
  return [id, 'Anna', 'Müller', email, '2024-04-03', 'DE', 'pro', '49.00'];
}

function check(rows: string[][]): Problem[][] {
  const problems = rows.map(checkRow);
  markDuplicates(rows, problems, 'customer_id');
  markDuplicates(rows, problems, 'email');
  return problems;
}

describe('markDuplicates', () => {
  it('flags every row in a group of three or more', () => {
    const rows = [
      row('C-1', 'a@example.com'),
      row('C-2', 'b@example.com'),
      row('C-3', 'a@example.com'),
      row('C-4', 'a@example.com'),
    ];
    expect(check(rows).map((p) => p[EMAIL])).toEqual([
      'email_duplicate',
      null,
      'email_duplicate',
      'email_duplicate',
    ]);
  });

  it('compares emails ignoring case and surrounding spaces', () => {
    const rows = [
      row('C-1', 'Anna@Example.com'),
      row('C-2', ' anna@example.com'),
    ];
    expect(check(rows).map((p) => p[EMAIL])).toEqual([
      'email_duplicate',
      'email_duplicate',
    ]);
  });

  it('compares customer IDs ignoring surrounding spaces only', () => {
    const rows = [
      row('C-1', 'a@example.com'),
      row(' C-1 ', 'b@example.com'),
      row('c-1', 'c@example.com'),
    ];
    expect(check(rows).map((p) => p[ID])).toEqual([
      'customer_id_duplicate',
      'customer_id_duplicate',
      null,
    ]);
  });

  it("keeps a cell's own problem instead of the duplicate", () => {
    const rows = [
      row('', ''),
      row('', ''),
      row('C-3', 'not-an-email'),
      row('C-4', 'not-an-email'),
    ];
    const problems = check(rows);
    expect(problems.map((p) => p[ID])).toEqual([
      'customer_id_missing',
      'customer_id_missing',
      null,
      null,
    ]);
    expect(problems.map((p) => p[EMAIL])).toEqual([
      'email_missing',
      'email_missing',
      'email_invalid',
      'email_invalid',
    ]);
  });

  it('clears the flag on both rows when one is edited, and can be re-run', () => {
    const rows = [row('C-1', 'a@example.com'), row('C-2', 'a@example.com')];
    const problems = check(rows);

    rows[1][EMAIL] = 'b@example.com';
    problems[1] = checkRow(rows[1]);
    markDuplicates(rows, problems, 'email');
    expect(problems.map((p) => p[EMAIL])).toEqual([null, null]);

    rows[1][EMAIL] = 'A@example.com';
    problems[1] = checkRow(rows[1]);
    markDuplicates(rows, problems, 'email');
    expect(problems.map((p) => p[EMAIL])).toEqual([
      'email_duplicate',
      'email_duplicate',
    ]);
  });

  it('keeps the others flagged while two of three still share a value', () => {
    const rows = [
      row('C-1', 'a@example.com'),
      row('C-2', 'a@example.com'),
      row('C-3', 'a@example.com'),
    ];
    const problems = check(rows);
    rows[0][EMAIL] = 'z@example.com';
    problems[0] = checkRow(rows[0]);
    markDuplicates(rows, problems, 'email');
    expect(problems.map((p) => p[EMAIL])).toEqual([
      null,
      'email_duplicate',
      'email_duplicate',
    ]);
  });

  it('gives the same result when rows are grouped chunk by chunk', () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      row(`C-${i % 17}`, `user${i % 13}@example.com`),
    );
    const whole = check(rows);

    const chunked = rows.map(checkRow);
    const idGroups: DuplicateGroups = new Map();
    const emailGroups: DuplicateGroups = new Map();
    for (let start = 0; start < rows.length; start += 7) {
      const end = Math.min(start + 7, rows.length);
      groupDuplicates(idGroups, rows, chunked, 'customer_id', start, end);
      groupDuplicates(emailGroups, rows, chunked, 'email', start, end);
    }
    flagDuplicates(idGroups, chunked, 'customer_id');
    flagDuplicates(emailGroups, chunked, 'email');

    expect(chunked).toEqual(whole);
    expect(whole[0][ID]).toBe('customer_id_duplicate');
  });
});

describe('convertDates', () => {
  const DATE = COLUMNS.indexOf('signup_date');

  function dataWithDates(dates: string[]): FileData {
    const rows = dates.map((d) => {
      const r = row(`C-${d}`, `${d}@example.com`);
      r[DATE] = d;
      return r;
    });
    return {
      fileName: 'test.csv',
      rows,
      problems: check(rows),
      searchText: rows.map(searchTextOf),
      duplicates: { customer_id: new Map(), email: new Map() },
      changed: new Map(),
    };
  }

  it('writes readable dates as YYYY-MM-DD in the given style, unflagged', () => {
    const data = dataWithDates(['03/04/2024', '21 Aug 2019', '25/04/2024']);
    expect(convertDates(data, 'day-first')).toBe(3);
    expect(data.rows.map((r) => r[DATE])).toEqual([
      '2024-04-03',
      '2019-08-21',
      '2024-04-25',
    ]);
    expect(data.problems.map((p) => p[DATE])).toEqual([null, null, null]);
    // Automatic, so not shown as the user's change.
    expect(data.changed.size).toBe(0);
    expect(data.searchText[1]).toContain('2019-08-21');
  });

  it('reads dates that could mean two days in the file style', () => {
    const data = dataWithDates(['03/04/2024']);
    convertDates(data, 'month-first');
    expect(data.rows[0][DATE]).toBe('2024-03-04');
  });

  it('leaves missing, unreadable and impossible dates flagged', () => {
    const data = dataWithDates(['', 'TBD', '2024-02-30', '31/31/2024']);
    expect(convertDates(data, 'day-first')).toBe(0);
    expect(data.rows.map((r) => r[DATE])).toEqual([
      '',
      'TBD',
      '2024-02-30',
      '31/31/2024',
    ]);
    expect(data.problems.map((p) => p[DATE])).toEqual([
      'date_missing',
      'date_not_a_date',
      'date_not_real',
      'date_not_real',
    ]);
  });
});

describe('detectDateStyle', () => {
  const withDates = (dates: string[]) =>
    dates.map((d) => ['C-1', 'A', 'B', 'a@example.com', d, 'DE', 'pro', '1']);

  it('defaults to day first, unproven, when nothing proves a style', () => {
    expect(detectDateStyle(withDates(['03/04/2024', '2024-01-01']))).toEqual({
      style: 'day-first',
      proven: false,
    });
  });

  it('follows the majority of dates that prove a style', () => {
    expect(
      detectDateStyle(withDates(['04/25/2024', '04/26/2024', '25/04/2024'])),
    ).toEqual({ style: 'month-first', proven: true });
    expect(
      detectDateStyle(withDates(['25/04/2024', '26/04/2024', '04/25/2024'])),
    ).toEqual({ style: 'day-first', proven: true });
  });

  it('falls back to day first, unproven, on a tie', () => {
    expect(detectDateStyle(withDates(['04/25/2024', '25/04/2024']))).toEqual({
      style: 'day-first',
      proven: false,
    });
  });
});
