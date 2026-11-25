import type { ProblemCode } from './catalogue.ts';

export function checkCustomerId(value: string): ProblemCode | null {
  return value.trim() === '' ? 'customer_id_missing' : null;
}

/** A name is fine as long as it isn't blank; extra spaces are not a problem. */
export function checkName(value: string): ProblemCode | null {
  return value.trim() === '' ? 'name_missing' : null;
}

// Practical check: one @, text before it, a dot in the domain, no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkEmail(value: string): ProblemCode | null {
  const email = value.trim();
  if (email === '') return 'email_missing';
  return EMAIL.test(email) ? null : 'email_invalid';
}
