import type { ProblemCode } from './catalogue.ts';

const NUMBER = /^-?\d+(\.\d+)?$/;
export const CURRENCY = /[€$£¥]|eur|usd|gbp|chf|pln/gi;

function isNumberWithSymbols(value: string): boolean {
  const bare = value.replace(CURRENCY, '').trim();
  // "120,50" is a decimal comma; "1,200.50" uses commas between thousands.
  return [bare.replace(',', '.'), bare.replaceAll(',', '')].some((v) =>
    NUMBER.test(v),
  );
}

export function checkAmount(value: string): ProblemCode | null {
  const amount = value.trim();
  if (amount === '') return 'amount_missing';
  if (NUMBER.test(amount)) return Number(amount) < 0 ? 'amount_negative' : null;
  return isNumberWithSymbols(amount)
    ? 'amount_has_symbol'
    : 'amount_not_number';
}
