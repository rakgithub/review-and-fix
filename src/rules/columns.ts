import { checkAmount } from './amount.ts';
import type { ProblemCode } from './catalogue.ts';
import { checkCountry } from './country.ts';
import { checkDate } from './date.ts';
import { checkCustomerId, checkEmail, checkName } from './identity.ts';
import { checkPlan } from './plan.ts';

export type Column =
  | 'customer_id'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'signup_date'
  | 'country'
  | 'plan'
  | 'monthly_spend';

export const COLUMNS: readonly Column[] = [
  'customer_id',
  'first_name',
  'last_name',
  'email',
  'signup_date',
  'country',
  'plan',
  'monthly_spend',
];

export const COLUMN_LABELS: Record<Column, string> = {
  customer_id: 'Customer ID',
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  signup_date: 'Signup date',
  country: 'Country',
  plan: 'Plan',
  monthly_spend: 'Monthly spend',
};

export const PROBLEM_COLUMNS: Record<ProblemCode, Column[]> = {
  customer_id_missing: ['customer_id'],
  customer_id_duplicate: ['customer_id'],
  name_missing: ['first_name', 'last_name'],
  email_missing: ['email'],
  email_invalid: ['email'],
  email_duplicate: ['email'],
  date_missing: ['signup_date'],
  date_not_a_date: ['signup_date'],
  date_not_real: ['signup_date'],
  date_other_style: ['signup_date'],
  country_not_code: ['country'],
  country_unknown: ['country'],
  plan_invalid: ['plan'],
  amount_has_symbol: ['monthly_spend'],
  amount_not_number: ['monthly_spend'],
  amount_negative: ['monthly_spend'],
  amount_missing: ['monthly_spend'],
};

const RULES: Record<Column, (value: string) => ProblemCode | null> = {
  customer_id: checkCustomerId,
  first_name: checkName,
  last_name: checkName,
  email: checkEmail,
  signup_date: checkDate,
  country: checkCountry,
  plan: checkPlan,
  monthly_spend: checkAmount,
};

/**
 * Duplicates need the whole column, so loading finds them separately with
 * groupDuplicates and flagDuplicates.
 */
export function checkCell(column: Column, value: string): ProblemCode | null {
  return RULES[column](value);
}
