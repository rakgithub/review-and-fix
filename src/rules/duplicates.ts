import type { ProblemCode } from './catalogue.ts';
import type { Column } from './columns.ts';

/** Customer IDs count as the same when they match after trimming spaces. */
export function customerIdKey(value: string): string {
  return value.trim();
}

/** Emails count as the same ignoring case and surrounding spaces. */
export function emailKey(value: string): string {
  return value.trim().toLowerCase();
}

export const DUPLICATE_RULES = {
  customer_id: { key: customerIdKey, code: 'customer_id_duplicate' },
  email: { key: emailKey, code: 'email_duplicate' },
} satisfies Record<string, { key: (v: string) => string; code: ProblemCode }>;

export type DuplicateColumn = keyof typeof DUPLICATE_RULES;

export function isDuplicateColumn(column: Column): column is DuplicateColumn {
  return column in DUPLICATE_RULES;
}
