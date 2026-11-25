import { CATALOGUE, type ProblemCode } from '../rules/catalogue.ts';
import type { Problem } from './fileData.ts';

export interface ProblemCounts {
  rowsWithProblems: number;
  byCode: { code: ProblemCode; rows: number }[];
}

/** Counts rows, not cells: a row missing both names counts once. */
export function countProblems(
  problems: readonly (readonly Problem[])[],
): ProblemCounts {
  const byCode = new Map<ProblemCode, number>();
  let rowsWithProblems = 0;
  for (const rowProblems of problems) {
    let hasProblem = false;
    for (let c = 0; c < rowProblems.length; c++) {
      const code = rowProblems[c];
      if (code === null) continue;
      hasProblem = true;
      if (rowProblems.indexOf(code) !== c) continue;
      byCode.set(code, (byCode.get(code) ?? 0) + 1);
    }
    if (hasProblem) rowsWithProblems++;
  }
  return {
    rowsWithProblems,
    byCode: [...byCode]
      .map(([code, rows]) => ({ code, rows }))
      .sort(
        (a, b) =>
          b.rows - a.rows ||
          CATALOGUE[a.code].title.localeCompare(CATALOGUE[b.code].title),
      ),
  };
}
