import { BULK_FIX_CODE, type AppliedBulkFix } from '../core/bulkFix.ts';
import type { ProblemCounts } from '../core/counts.ts';
import type { RowFilter } from '../core/filter.ts';
import { formatNumber, formatRows } from '../core/format.ts';
import { CATALOGUE, type ProblemCode } from '../rules/catalogue.ts';
import { COLUMN_LABELS, PROBLEM_COLUMNS } from '../rules/columns.ts';
import styles from './Overview.module.css';

interface Props {
  rowCount: number;
  counts: ProblemCounts;
  filter: RowFilter;
  onFilter: (filter: RowFilter) => void;
  fixes: readonly AppliedBulkFix[];
  onUndo: (fix: AppliedBulkFix) => void;
  onFixAll: () => void;
}

type CodeCount = ProblemCounts['byCode'][number];

function columnTag(code: ProblemCode): string {
  return PROBLEM_COLUMNS[code].map((c) => COLUMN_LABELS[c]).join(' / ');
}

function problemCount(n: number): string {
  return n === 1 ? '1 problem' : `${n} problems`;
}

function effortLine(oneClick: number, rowByRow: number): string | null {
  if (oneClick === 0) return null;
  const types = problemCount(oneClick);
  return rowByRow === 0
    ? `${types} left, fixed in one click.`
    : `${types} can be fixed in one click. The rest you fix row by row.`;
}

function Headline({
  rowCount,
  problemRows,
}: {
  rowCount: number;
  problemRows: number;
}) {
  if (problemRows === 0) {
    const verb = rowCount === 1 ? 'is' : 'are';
    return (
      <p className={styles.headline}>
        All <strong>{formatRows(rowCount)}</strong> {verb} ready.
      </p>
    );
  }
  const verb = problemRows === 1 ? 'needs' : 'need';
  return (
    <>
      <p className={styles.headline}>
        <strong>{formatNumber(problemRows)}</strong>{' '}
        {problemRows === 1 ? 'row' : 'rows'} {verb} attention
      </p>
      <p className={styles.effort}>
        {formatNumber(rowCount - problemRows)} of {formatRows(rowCount)} are
        ready.
      </p>
    </>
  );
}

export function Overview({
  rowCount,
  counts,
  filter,
  onFilter,
  fixes,
  onUndo,
  onFixAll,
}: Props) {
  const percent = (n: number) => (rowCount === 0 ? 0 : (n / rowCount) * 100);
  // Only countries have a bulk fix so far; others join this group as they get one.
  const oneClick = counts.byCode.filter((c) => c.code === BULK_FIX_CODE);
  const rowByRow = counts.byCode.filter((c) => c.code !== BULK_FIX_CODE);
  const effort = effortLine(oneClick.length, rowByRow.length);

  function item({ code, rows }: CodeCount) {
    return (
      <FilterItem
        key={code}
        tag={columnTag(code)}
        label={CATALOGUE[code].title}
        rows={rows}
        selected={filter.kind === 'code' && filter.code === code}
        onSelect={() => onFilter({ kind: 'code', code })}
      />
    );
  }

  return (
    <aside className={styles.overview}>
      <div className={styles.summary}>
        <Headline rowCount={rowCount} problemRows={counts.rowsWithProblems} />
        {effort && <p className={styles.effort}>{effort}</p>}
        <div className={styles.bar} aria-hidden="true">
          <div
            className={styles.fill}
            style={{ width: `${percent(rowCount - counts.rowsWithProblems)}%` }}
          />
        </div>
      </div>

      <ul className={styles.list}>
        <FilterItem
          label="All rows"
          rows={rowCount}
          selected={filter.kind === 'all'}
          onSelect={() => onFilter({ kind: 'all' })}
        />
      </ul>

      {(oneClick.length > 0 || fixes.length > 0) && (
        <section className={styles.oneClickSection}>
          <h2 className={styles.heading}>
            Fix in one click
            {oneClick.length > 0 && (
              <span className={styles.types}>
                {problemCount(oneClick.length)}
              </span>
            )}
          </h2>
          <ul className={`${styles.list} ${styles.oneClickList}`}>
            {oneClick.map(({ code, rows }) => (
              <li key={code} className={styles.entry}>
                <FilterItem
                  tag={columnTag(code)}
                  label={CATALOGUE[code].title}
                  rows={rows}
                  selected={filter.kind === 'code' && filter.code === code}
                  onSelect={() => onFilter({ kind: 'code', code })}
                  bare
                />
                <div className={styles.fixAllRow}>
                  <button
                    type="button"
                    className={styles.fixAll}
                    onClick={onFixAll}
                  >
                    Fix all {formatNumber(rows)}
                  </button>
                </div>
              </li>
            ))}
            {fixes.map((fix, i) => (
              <li key={fixes.length - i} className={styles.entry}>
                <AppliedFix fix={fix} onUndo={() => onUndo(fix)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {rowByRow.length > 0 && (
        <section className={styles.problemsSection}>
          <h2 className={styles.heading}>
            Fix row by row
            <span className={styles.types}>
              {problemCount(rowByRow.length)}
            </span>
          </h2>
          <ul className={`${styles.list} ${styles.problemList}`}>
            {rowByRow.map(item)}
          </ul>
        </section>
      )}
    </aside>
  );
}

function AppliedFix({
  fix,
  onUndo,
}: {
  fix: AppliedBulkFix;
  onUndo: () => void;
}) {
  const label = 'Country changed to a 2-letter code';
  return (
    <div className={styles.applied}>
      <span className={styles.title}>{label}</span>
      <span className={styles.meta}>
        {formatRows(fix.cells.length)} ·{' '}
        <button
          type="button"
          className={styles.undo}
          aria-label={`Undo: ${label}`}
          onClick={onUndo}
        >
          Undo
        </button>
      </span>
    </div>
  );
}

interface FilterItemProps {
  tag?: string;
  label: string;
  rows: number;
  selected: boolean;
  onSelect: () => void;
  bare?: boolean;
}

function FilterItem({
  tag,
  label,
  rows,
  selected,
  onSelect,
  bare = false,
}: FilterItemProps) {
  const button = (
    <button
      type="button"
      className={styles.item}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.title}>{label}</span>
      <span className={styles.meta}>
        {tag && `${tag} · `}
        {formatRows(rows)}
      </span>
    </button>
  );
  return bare ? button : <li className={styles.entry}>{button}</li>;
}
