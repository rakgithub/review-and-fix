export type ProblemCode =
  | 'customer_id_missing'
  | 'customer_id_duplicate'
  | 'name_missing'
  | 'email_missing'
  | 'email_invalid'
  | 'email_duplicate'
  | 'date_missing'
  | 'date_not_a_date'
  | 'date_not_real'
  | 'date_other_style'
  | 'country_not_code'
  | 'country_unknown'
  | 'plan_invalid'
  | 'amount_has_symbol'
  | 'amount_not_number'
  | 'amount_negative'
  | 'amount_missing';

/**
 * Every problem reads the same way: the title says what's wrong, `why` says
 * what a good value is, then an example. Duplicates have no single right
 * value, so they say what to do instead.
 */
type ProblemInfo = {
  title: string;
  why: string;
} & ({ goodExample: string } | { whatToDo: string });

export const CATALOGUE: Record<ProblemCode, ProblemInfo> = {
  customer_id_missing: {
    title: 'Customer ID is missing',
    why: 'Every customer needs an ID.',
    goodExample: 'C-0000123',
  },
  customer_id_duplicate: {
    title: 'Customer ID is used more than once',
    why: 'Every customer needs their own ID.',
    whatToDo: 'Give one of these rows a new ID.',
  },
  name_missing: {
    title: 'Name is missing',
    why: 'Every customer needs a first and last name.',
    goodExample: 'Anna Müller',
  },
  email_missing: {
    title: 'Email is missing',
    why: 'Every customer needs an email address.',
    goodExample: 'anna.mueller@example.com',
  },
  email_invalid: {
    title: 'Email is not valid',
    why: 'An email needs a name, an @ and a domain.',
    goodExample: 'anna.mueller@example.com',
  },
  email_duplicate: {
    title: 'Email is used more than once',
    why: 'Every customer needs their own email.',
    whatToDo: 'Change the email on one of these rows.',
  },
  date_missing: {
    title: 'Date is missing',
    why: 'Every customer needs a signup date.',
    goodExample: '2024-04-03',
  },
  date_not_a_date: {
    title: "Date can't be read",
    why: 'Write the date as year-month-day.',
    goodExample: '2024-04-03',
  },
  date_not_real: {
    title: "Date doesn't exist",
    why: 'Use a real calendar day.',
    goodExample: '2024-02-29',
  },
  date_other_style: {
    title: 'Date is written in a different style',
    why: 'Write every date as year-month-day.',
    goodExample: '2024-04-03',
  },
  country_not_code: {
    title: 'Country is written in a different style',
    why: 'Write every country as a 2-letter code.',
    goodExample: 'DE',
  },
  country_unknown: {
    title: 'Country is missing or not recognised',
    why: 'Use a 2-letter country code.',
    goodExample: 'DE',
  },
  plan_invalid: {
    title: 'Plan is not valid',
    why: 'Use free, pro or enterprise, in lower case.',
    goodExample: 'pro',
  },
  amount_has_symbol: {
    title: 'Amount is written in a different style',
    why: 'Write a plain number, with a dot for decimals.',
    goodExample: '120.50',
  },
  amount_not_number: {
    title: 'Amount is not a number',
    why: 'Write the monthly spend as a number.',
    goodExample: '49.00',
  },
  amount_negative: {
    title: 'Amount is below zero',
    why: 'Use 0 or more.',
    goodExample: '49.00',
  },
  amount_missing: {
    title: 'Amount is missing',
    why: 'Every customer needs a monthly spend.',
    goodExample: '49.00',
  },
};
