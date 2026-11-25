import { describe, expect, it } from 'vitest';
import { checkRow, markDuplicates, type Problem } from '../core/fileData.ts';
import { CATALOGUE, type ProblemCode } from './catalogue.ts';
import { COLUMNS, checkCell, type Column } from './columns.ts';

const GOOD_ROW = [
  'C-0000123',
  'Anna',
  'Müller',
  'anna.mueller@example.com',
  '2024-04-03',
  'DE',
  'pro',
  '49.00',
];

function expectCell(
  column: Column,
  values: string[],
  code: ProblemCode,
  title: string,
) {
  for (const value of values) {
    expect(checkCell(column, value), JSON.stringify(value)).toBe(code);
  }
  expect(CATALOGUE[code].title).toBe(title);
}

function checkPair(column: 'customer_id' | 'email', a: string, b: string) {
  const c = COLUMNS.indexOf(column);
  const rows = [a, b].map((v, i) => {
    const row = [...GOOD_ROW];
    row[0] = `C-000000${i}`;
    row[3] = `customer${i}@example.com`;
    row[c] = v;
    return row;
  });
  const problems: Problem[][] = rows.map(checkRow);
  markDuplicates(rows, problems, column);
  return problems.map((p) => p[c]);
}

describe('PRD problem catalogue', () => {
  it('accepts the PRD "what good looks like" row', () => {
    expect(checkRow(GOOD_ROW)).toEqual(COLUMNS.map(() => null));
  });

  it('Customer ID is missing', () => {
    expectCell(
      'customer_id',
      ['', '  '],
      'customer_id_missing',
      'Customer ID is missing',
    );
  });

  it('Customer ID is used more than once', () => {
    expect(checkPair('customer_id', 'C-0000123', 'C-0000123')).toEqual([
      'customer_id_duplicate',
      'customer_id_duplicate',
    ]);
    expect(CATALOGUE.customer_id_duplicate.title).toBe(
      'Customer ID is used more than once',
    );
  });

  it('Name is missing (first and last name)', () => {
    expectCell('first_name', ['', '   '], 'name_missing', 'Name is missing');
    expectCell('last_name', ['', '   '], 'name_missing', 'Name is missing');
  });

  it('Email is missing', () => {
    expectCell('email', ['', ' '], 'email_missing', 'Email is missing');
  });

  it('Email is not valid', () => {
    expectCell(
      'email',
      ['anna.muellerexample.com'],
      'email_invalid',
      'Email is not valid',
    );
  });

  it('Email is used more than once', () => {
    expect(checkPair('email', 'anna@example.com', 'anna@example.com')).toEqual([
      'email_duplicate',
      'email_duplicate',
    ]);
    expect(CATALOGUE.email_duplicate.title).toBe(
      'Email is used more than once',
    );
  });

  it('Date is missing', () => {
    expectCell('signup_date', [''], 'date_missing', 'Date is missing');
  });

  it('Date is written in a different style', () => {
    expectCell(
      'signup_date',
      ['3 Apr 2024', '25/04/2024', '03/04/2024'],
      'date_other_style',
      'Date is written in a different style',
    );
  });

  it("Date doesn't exist", () => {
    expectCell(
      'signup_date',
      ['2024-02-30'],
      'date_not_real',
      "Date doesn't exist",
    );
  });

  it("Date can't be read (added in the roadmap)", () => {
    expectCell('signup_date', ['TBD'], 'date_not_a_date', "Date can't be read");
  });

  it('Country is written in a different style', () => {
    expectCell(
      'country',
      ['Germany', 'Deutschland', 'de', 'UK'],
      'country_not_code',
      'Country is written in a different style',
    );
  });

  it('Country is missing or not recognised', () => {
    expectCell(
      'country',
      ['', 'Atlantis'],
      'country_unknown',
      'Country is missing or not recognised',
    );
  });

  it('Plan is not valid', () => {
    expectCell(
      'plan',
      ['PRO', ' free', 'enterprize', 'pros'],
      'plan_invalid',
      'Plan is not valid',
    );
  });

  it('Amount is written in a different style', () => {
    expectCell(
      'monthly_spend',
      ['€ 120', '120,50', '120 EUR'],
      'amount_has_symbol',
      'Amount is written in a different style',
    );
  });

  it('Amount is not a number', () => {
    expectCell(
      'monthly_spend',
      ['n/a', 'TBD', '??'],
      'amount_not_number',
      'Amount is not a number',
    );
  });

  it('Amount is below zero', () => {
    expectCell(
      'monthly_spend',
      ['-120'],
      'amount_negative',
      'Amount is below zero',
    );
  });

  it('Amount is missing', () => {
    expectCell('monthly_spend', [''], 'amount_missing', 'Amount is missing');
  });

  it('accepts every PRD "what good looks like" value', () => {
    const good: [Column, string[]][] = [
      ['customer_id', ['C-0000123']],
      ['first_name', ['Müller', '  Anna  ']],
      ['email', ['anna.mueller@example.com']],
      ['signup_date', ['2024-04-03', '2024-02-29']],
      ['country', ['DE', 'GB']],
      ['plan', ['pro', 'free', 'enterprise']],
      ['monthly_spend', ['120', '120.50', '49.00', '0']],
    ];
    for (const [column, values] of good) {
      for (const value of values) {
        expect(checkCell(column, value), `${column}: ${value}`).toBeNull();
      }
    }
  });
});
