import { describe, expect, it } from 'vitest';
import { suggestFix } from './suggest.ts';

describe('suggestFix', () => {
  it('suggests a country code', () => {
    expect(
      suggestFix('country', 'country_not_code', 'Germany', 'day-first'),
    ).toBe('DE');
  });

  it('writes dates as 2024-04-03, reading two-way dates in the chosen style', () => {
    expect(
      suggestFix('signup_date', 'date_other_style', '13 Dec 2019', 'day-first'),
    ).toBe('2019-12-13');
    expect(
      suggestFix('signup_date', 'date_other_style', '03/04/2024', 'day-first'),
    ).toBe('2024-04-03');
    expect(
      suggestFix(
        'signup_date',
        'date_other_style',
        '03/04/2024',
        'month-first',
      ),
    ).toBe('2024-03-04');
  });

  it('fixes plan casing and spaces, but not typos', () => {
    expect(suggestFix('plan', 'plan_invalid', 'PRO', 'day-first')).toBe('pro');
    expect(suggestFix('plan', 'plan_invalid', ' free', 'day-first')).toBe(
      'free',
    );
    expect(
      suggestFix('plan', 'plan_invalid', 'enterprize', 'day-first'),
    ).toBeNull();
  });

  it('removes currency signs and commas from amounts', () => {
    expect(
      suggestFix('monthly_spend', 'amount_has_symbol', '€ 120', 'day-first'),
    ).toBe('120');
    expect(
      suggestFix('monthly_spend', 'amount_has_symbol', '120,50', 'day-first'),
    ).toBe('120.50');
    expect(
      suggestFix('monthly_spend', 'amount_has_symbol', '120 EUR', 'day-first'),
    ).toBe('120');
    expect(
      suggestFix('monthly_spend', 'amount_has_symbol', '1,200.50', 'day-first'),
    ).toBe('1200.50');
  });

  it('offers nothing when the result would still be a problem', () => {
    expect(
      suggestFix('monthly_spend', 'amount_has_symbol', '-120,50', 'day-first'),
    ).toBeNull();
    expect(
      suggestFix('email', 'email_invalid', 'anna.example.com', 'day-first'),
    ).toBeNull();
  });
});
