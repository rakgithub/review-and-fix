import type { ProblemCode } from './catalogue.ts';

const PLANS: ReadonlySet<string> = new Set(['free', 'pro', 'enterprise']);

/** Exact match only: "PRO" and " free" are problems too. */
export function checkPlan(value: string): ProblemCode | null {
  return PLANS.has(value) ? null : 'plan_invalid';
}
