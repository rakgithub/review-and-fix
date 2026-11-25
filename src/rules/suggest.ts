import { CURRENCY } from './amount.ts';
import type { ProblemCode } from './catalogue.ts';
import { suggestCountry } from './country.ts';
import { toIsoDate, type DateStyle } from './date.ts';
import { checkCell, type Column } from './columns.ts';

const THOUSANDS = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;

/** "€ 120" → "120", "120,50" → "120.50", "1,200.50" → "1200.50". */
function amountWithoutSymbols(value: string): string {
  const bare = value.replace(CURRENCY, '').trim();
  return THOUSANDS.test(bare)
    ? bare.replaceAll(',', '')
    : bare.replace(',', '.');
}

function candidate(
  problem: ProblemCode,
  value: string,
  dateStyle: DateStyle,
): string | null {
  switch (problem) {
    case 'country_not_code':
      return suggestCountry(value);
    case 'date_other_style':
      return toIsoDate(value, dateStyle);
    case 'plan_invalid':
      return value.trim().toLowerCase();
    case 'amount_has_symbol':
      return amountWithoutSymbols(value);
    default:
      return null;
  }
}

/** Only offered when it clears the problem, never swapping it for another. */
export function suggestFix(
  column: Column,
  problem: ProblemCode,
  value: string,
  dateStyle: DateStyle,
): string | null {
  const fix = candidate(problem, value, dateStyle);
  if (fix === null || fix === value) return null;
  return checkCell(column, fix) === null ? fix : null;
}
