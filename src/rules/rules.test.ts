import { describe, expect, it } from 'vitest';
import { checkAmount } from './amount.ts';
import { COUNTRY_CODES, checkCountry, suggestCountry } from './country.ts';
import {
  checkDate,
  dateStyleHint,
  isAmbiguousDate,
  toIsoDate,
  type DateStyle,
} from './date.ts';
import { emailKey } from './duplicates.ts';
import { checkEmail } from './identity.ts';
import { checkPlan } from './plan.ts';

describe('checkDate', () => {
  it.each([
    ['2024-04-03', null],
    [' 2024-04-03 ', null],
    ['2024-02-29', null], // leap year
    ['2000-02-29', null], // divisible by 400
    ['', 'date_missing'],
    ['   ', 'date_missing'],
    ['TBD', 'date_not_a_date'],
    ['soon', 'date_not_a_date'],
    ['3 Foo 2024', 'date_not_a_date'],
    ['03/04/24', 'date_not_a_date'], // 2-digit years are out of scope
    ['2023-02-29', 'date_not_real'],
    ['1900-02-29', 'date_not_real'],
    ['2024-04-31', 'date_not_real'],
    ['2024-13-01', 'date_not_real'],
    ['2024-00-10', 'date_not_real'],
    ['30/02/2024', 'date_not_real'], // neither reading exists
    ['02/30/2024', 'date_not_real'],
    ['31 Apr 2024', 'date_not_real'],
    ['03/04/2024', 'date_other_style'], // read in the file's style
    ['3.4.2024', 'date_other_style'], // read in the file's style
    ['12-01-2024', 'date_other_style'], // read in the file's style
    ['04/04/2024', 'date_other_style'], // both readings are the same day
    ['25/04/2024', 'date_other_style'],
    ['04/25/2024', 'date_other_style'], // only month-first works
    ['25.04.2024', 'date_other_style'],
    ['3 Apr 2024', 'date_other_style'],
    ['3 April 2024', 'date_other_style'],
    ['Apr 3, 2024', 'date_other_style'],
    ['Sept 3 2024', 'date_other_style'],
    ['2024/04/03', 'date_other_style'],
    ['2024-4-3', 'date_other_style'],
  ])('%j → %s', (value, expected) => {
    expect(checkDate(value)).toBe(expected);
  });
});

describe('country', () => {
  it('knows all 249 ISO codes', () => {
    expect(COUNTRY_CODES.size).toBe(249);
    expect(COUNTRY_CODES.has('UK')).toBe(false);
  });

  it.each([
    ['Germany', 'DE'],
    ['Deutschland', 'DE'],
    ['germany ', 'DE'],
    ['de', 'DE'],
    [' DE', 'DE'],
    ['España', 'ES'],
    ['Nederland', 'NL'],
    ['The  Netherlands', 'NL'],
    ['Polska', 'PL'],
    ['Italia', 'IT'],
    ['France', 'FR'],
    ['FRANCE', 'FR'],
    ['UK', 'GB'],
    ['USA', 'US'],
    ['U.S.', 'US'],
  ])('suggests %j → %s', (value, code) => {
    expect(suggestCountry(value)).toBe(code);
    expect(checkCountry(value)).toBe('country_not_code');
  });

  it.each(['', '  ', 'Atlantis', 'Europe', 'Germny', 'XX'])(
    'cannot map %j',
    (value) => {
      expect(suggestCountry(value)).toBeNull();
      expect(checkCountry(value)).toBe('country_unknown');
    },
  );

  it('accepts a code only when written exactly', () => {
    expect(checkCountry('FR')).toBeNull();
    expect(checkCountry('Fr')).toBe('country_not_code');
  });
});

describe('checkAmount', () => {
  it.each([
    ['49', null],
    ['49.00', null],
    [' 120 ', null],
    ['0', null],
    ['-0', null],
    ['', 'amount_missing'],
    ['-120', 'amount_negative'],
    ['-0.50', 'amount_negative'],
    ['€ 120', 'amount_has_symbol'],
    ['$49.00', 'amount_has_symbol'],
    ['120EUR', 'amount_has_symbol'],
    ['120,50', 'amount_has_symbol'],
    ['1,200.50', 'amount_has_symbol'],
    ['-€120', 'amount_has_symbol'],
    ['n/a', 'amount_not_number'],
    ['€', 'amount_not_number'],
    ['1 200', 'amount_not_number'],
    ['12a', 'amount_not_number'],
  ])('%j → %s', (value, expected) => {
    expect(checkAmount(value)).toBe(expected);
  });
});

describe('email', () => {
  it.each([
    ['anna@example.com', null],
    [' anna@example.com ', null],
    ['anna@example', 'email_invalid'],
    ['anna @example.com', 'email_invalid'],
    ['anna@@example.com', 'email_invalid'],
    ['@example.com', 'email_invalid'],
  ])('%j → %s', (value, expected) => {
    expect(checkEmail(value)).toBe(expected);
  });

  it('compares ignoring case and surrounding spaces', () => {
    expect(emailKey(' Anna@Example.com ')).toBe(emailKey('anna@example.com'));
  });
});

describe('checkPlan', () => {
  it.each(['', 'Free', 'free ', 'premium'])('rejects %j', (value) => {
    expect(checkPlan(value)).toBe('plan_invalid');
  });
});

describe('toIsoDate', () => {
  const cases: [string, DateStyle, string | null][] = [
    ['2024-04-03', 'day-first', '2024-04-03'],
    ['03/04/2024', 'day-first', '2024-04-03'],
    ['03/04/2024', 'month-first', '2024-03-04'],
    ['25/04/2024', 'month-first', '2024-04-25'], // only one reading works
    ['3 Apr 2024', 'day-first', '2024-04-03'],
    ['2024-02-30', 'day-first', null],
    ['TBD', 'day-first', null],
    ['', 'day-first', null],
  ];
  it.each(cases)('%s read %s → %s', (value, style, expected) => {
    expect(toIsoDate(value, style)).toBe(expected);
  });
});

describe('isAmbiguousDate', () => {
  it.each([
    ['03/04/2024', true],
    ['12/01/2024', true],
    ['25/04/2024', false], // 25 can't be a month
    ['04/04/2024', false], // both readings are the same day
    ['3 Apr 2024', false],
    ['Apr 3, 2024', false],
    ['2024/04/03', false],
    ['2024-04-03', false],
    ['31/02/2024', false],
    ['TBD', false],
  ])('%s → %s', (value, expected) => {
    expect(isAmbiguousDate(value)).toBe(expected);
  });
});

describe('dateStyleHint', () => {
  it.each([
    ['25/04/2024', 'day-first'],
    ['04/25/2024', 'month-first'],
    ['03/04/2024', null],
    ['2024-04-25', null],
    ['31/31/2024', null],
  ])('%s proves %s', (value, style) => {
    expect(dateStyleHint(value)).toBe(style);
  });
});
