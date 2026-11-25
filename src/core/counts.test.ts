import { describe, expect, it } from 'vitest';
import { countProblems } from './counts.ts';
import { checkRow, markDuplicates } from './fileData.ts';

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

describe('countProblems', () => {
  it('counts rows per problem, largest first, and rows with any problem', () => {
    expect(countProblems(check(ROWS))).toEqual({
      rowsWithProblems: 4,
      byCode: [
        { code: 'country_not_code', rows: 2 },
        { code: 'email_duplicate', rows: 2 },
        { code: 'name_missing', rows: 1 }, // both names missing, one row
        { code: 'plan_invalid', rows: 1 },
      ],
    });
  });

  it('returns nothing for a clean file', () => {
    expect(countProblems(check([ROWS[0]]))).toEqual({
      rowsWithProblems: 0,
      byCode: [],
    });
  });
});
