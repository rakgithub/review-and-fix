import type { BulkFixPlan } from '../core/bulkFix.ts';
import { formatNumber, formatRows, hasOuterSpaces } from '../core/format.ts';
import styles from './BulkFixDialog.module.css';
import { MarkedSpaces, SpaceLegend } from './MarkedSpaces.tsx';

interface Props {
  plan: BulkFixPlan;
  busy: boolean;
  onApply: () => void;
  onCancel: () => void;
}

const UNCHANGED_SHOWN = 8;

function Value({ value }: { value: string }) {
  if (value === '') return <em className={styles.empty}>(empty)</em>;
  return (
    <code className={styles.code}>
      <MarkedSpaces value={value} />
    </code>
  );
}

const countries = (n: number) => (n === 1 ? 'country' : 'countries');

export function BulkFixDialog({ plan, busy, onApply, onCancel }: Props) {
  const { changes, unchanged, total } = plan;
  const hidden = unchanged.length - UNCHANGED_SHOWN;
  const hasExtraSpaces = [
    ...changes.map((c) => c.from),
    ...unchanged.map((u) => u.value),
  ].some(hasOuterSpaces);

  return (
    <dialog
      className={styles.dialog}
      aria-labelledby="bulk-fix-title"
      aria-busy={busy}
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onCancel}
    >
      <h2 id="bulk-fix-title" className={styles.title}>
        Change countries to 2-letter codes
      </h2>
      <p>
        We'll change <strong>{formatNumber(total)}</strong> {countries(total)}.
        You can undo this.
      </p>
      {hasExtraSpaces && <SpaceLegend className={styles.hint} />}

      <div className={styles.scroll}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colFrom} />
            <col className={styles.colArrow} />
            <col />
            <col className={styles.colRows} />
          </colgroup>
          <thead>
            <tr>
              <th>Now written as</th>
              <th />
              <th>Becomes</th>
              <th className={styles.number}>Rows</th>
            </tr>
          </thead>
          <tbody>
            {changes.map(({ from, to, rows }) => (
              <tr key={from}>
                <td>
                  <Value value={from} />
                </td>
                <td className={styles.arrow} aria-hidden="true">
                  →
                </td>
                <td>
                  <Value value={to} />
                </td>
                <td className={styles.number}>{formatNumber(rows.length)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {unchanged.length > 0 && (
          <section className={styles.unchanged}>
            <h3 className={styles.subtitle}>Left unchanged</h3>
            <p>
              We're not sure what these should be, so we'll leave them. You can
              change them yourself.
            </p>
            <ul>
              {unchanged.slice(0, UNCHANGED_SHOWN).map(({ value, rows }) => (
                <li key={value}>
                  <Value value={value} /> · {formatRows(rows)}
                </li>
              ))}
            </ul>
            {hidden > 0 && <p>and {formatNumber(hidden)} more</p>}
          </section>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancel}
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.apply}
          autoFocus
          disabled={total === 0 || busy}
          onClick={onApply}
        >
          {busy
            ? `Changing ${countries(total)}…`
            : `Change ${formatNumber(total)} ${countries(total)}`}
        </button>
      </div>
    </dialog>
  );
}
