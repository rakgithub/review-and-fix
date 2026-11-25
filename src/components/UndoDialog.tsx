import type { AppliedBulkFix, UndoCounts } from '../core/bulkFix.ts';
import { formatNumber } from '../core/format.ts';
import { MarkedSpaces } from './MarkedSpaces.tsx';
import styles from './UndoDialog.module.css';

const SHOWN_CHANGES = 3;

interface Props {
  counts: UndoCounts;
  changes: AppliedBulkFix['changes'];
  busy: boolean;
  onUndo: () => void;
  onCancel: () => void;
}

export function UndoDialog({ counts, changes, busy, onUndo, onCancel }: Props) {
  const noun = (n: number) => (n === 1 ? 'country' : 'countries');
  const { reverted, kept } = counts;
  const shown = changes.slice(0, SHOWN_CHANGES);
  const more = changes.length - shown.length;

  return (
    <dialog
      className={styles.dialog}
      aria-labelledby="undo-title"
      aria-busy={busy}
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onCancel}
    >
      <h2 id="undo-title" className={styles.title}>
        Undo this change?
      </h2>
      {reverted > 0 ? (
        <p>
          We'll put back <strong>{formatNumber(reverted)}</strong>{' '}
          {noun(reverted)} as {reverted === 1 ? 'it was' : 'they were'}.
        </p>
      ) : (
        <p>You've changed all of these yourself since, so nothing goes back.</p>
      )}
      {reverted > 0 && shown.length > 0 && (
        <div className={styles.changes}>
          <p className={styles.label}>This fix changed</p>
          <ul className={styles.changeList}>
            {shown.map(({ from, to, rows }) => (
              <li key={from}>
                <span className={styles.change}>
                  <code>
                    <MarkedSpaces value={from} />
                  </code>{' '}
                  → <code>{to}</code>
                </span>
                <span className={styles.count}>{formatNumber(rows)}</span>
              </li>
            ))}
          </ul>
          {more > 0 && (
            <p className={styles.more}>
              and {formatNumber(more)} more {more === 1 ? 'value' : 'values'}
            </p>
          )}
        </div>
      )}
      {reverted > 0 && kept > 0 && (
        <p>
          <strong>{formatNumber(kept)}</strong> {noun(kept)} you changed since
          will stay as you left {kept === 1 ? 'it' : 'them'}.
        </p>
      )}
      <div className={styles.actions}>
        {/* Focused first: a stray Enter shouldn't undo thousands of values. */}
        <button
          type="button"
          className={styles.cancel}
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          {reverted > 0 ? 'Cancel' : 'Close'}
        </button>
        {reverted > 0 && (
          <button
            type="button"
            className={styles.undo}
            disabled={busy}
            onClick={onUndo}
          >
            {busy
              ? `Putting back ${noun(reverted)}…`
              : `Undo ${formatNumber(reverted)} ${noun(reverted)}`}
          </button>
        )}
      </div>
    </dialog>
  );
}
