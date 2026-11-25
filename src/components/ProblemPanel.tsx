import { cellKey, duplicatePartners, type FileData } from '../core/fileData.ts';
import { formatNumber, hasOuterSpaces } from '../core/format.ts';
import { CATALOGUE, type ProblemCode } from '../rules/catalogue.ts';
import { isAmbiguousDate, toIsoDate, type DateStyle } from '../rules/date.ts';
import { COLUMN_LABELS, COLUMNS } from '../rules/columns.ts';
import { suggestFix } from '../rules/suggest.ts';
import { MarkedSpaces, SpaceLegend } from './MarkedSpaces.tsx';
import styles from './ProblemPanel.module.css';

interface Props {
  data: FileData;
  row: number;
  column: number;
  dateStyle: DateStyle;
  dateStyleProven: boolean;
  explainedAbove: ProblemCode | null;
  editingInTable: boolean;
  onSave: (value: string) => void;
  onEdit: () => void;
  onNext: (() => void) | null;
  onClose: () => void;
}

const STYLE_NAMES: Record<DateStyle, string> = {
  'day-first': 'day',
  'month-first': 'month',
};

const longDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function rowName(data: FileData, r: number): string {
  const id = data.rows[r][COLUMNS.indexOf('customer_id')].trim();
  return id
    ? `row ${formatNumber(r + 1)} (${id})`
    : `row ${formatNumber(r + 1)}`;
}

function partnersText(data: FileData, partners: number[]): string {
  const shown = partners.slice(0, 3).map((r) => rowName(data, r));
  const more = partners.length - shown.length;
  return more > 0
    ? `${shown.join(', ')} and ${formatNumber(more)} more`
    : shown.join(', ');
}

export function ProblemPanel({
  data,
  row,
  column,
  dateStyle,
  dateStyleProven,
  explainedAbove,
  editingInTable,
  onSave,
  onEdit,
  onNext,
  onClose,
}: Props) {
  const value = data.rows[row][column];
  const problem = data.problems[row][column];
  const original = data.changed.get(cellKey(row, column));
  const changed = original !== undefined;

  return (
    <aside
      className={styles.panel}
      aria-label="About this value"
      onClickCapture={(e) => {
        // The panel opens on the first click of a double-click on a cell and
        // narrows the grid, so the second click can land on a panel button.
        if (e.detail > 1) e.stopPropagation();
      }}
    >
      <div className={styles.top}>
        <p className={styles.where}>
          Row {formatNumber(row + 1)} · {COLUMN_LABELS[COLUMNS[column]]}
        </p>
        <button
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <p className={styles.value}>
        {value === '' ? (
          <em>(empty)</em>
        ) : (
          <code>
            <MarkedSpaces value={value} />
          </code>
        )}
      </p>
      {changed && (
        <div className={styles.original}>
          <p>
            Was{' '}
            {original === '' ? (
              <em>(empty)</em>
            ) : (
              <code>
                <MarkedSpaces value={original} />
              </code>
            )}{' '}
            in your file
          </p>
          <button
            type="button"
            className={styles.revert}
            onClick={() => onSave(original)}
          >
            Change back
          </button>
        </div>
      )}
      {(hasOuterSpaces(value) || (changed && hasOuterSpaces(original))) && (
        <SpaceLegend className={styles.hint} />
      )}

      <div className={styles.result} aria-live="polite">
        {problem === null ? (
          <p className={styles.ok}>
            {changed
              ? '✓ Fixed. This value looks good now.'
              : '✓ This value looks good.'}
          </p>
        ) : (
          <Explanation
            data={data}
            row={row}
            column={column}
            problem={problem}
            dateStyle={dateStyle}
            dateStyleProven={dateStyleProven}
            explainedAbove={problem === explainedAbove}
            onSave={onSave}
          />
        )}
      </div>

      {editingInTable ? (
        <p className={styles.hint}>
          Editing in the table. Press Enter to save or Esc to cancel.
        </p>
      ) : (
        <div className={styles.editRow}>
          <button type="button" className={styles.edit} onClick={onEdit}>
            Edit this value
          </button>
          <span className={styles.hint}>or double-click the cell</span>
        </div>
      )}

      <button
        type="button"
        className={styles.next}
        disabled={onNext === null}
        onClick={onNext ?? undefined}
      >
        {onNext ? 'Next problem →' : 'No more problems here'}
      </button>
    </aside>
  );
}

interface ExplanationProps {
  data: FileData;
  row: number;
  column: number;
  problem: ProblemCode;
  dateStyle: DateStyle;
  dateStyleProven: boolean;
  explainedAbove: boolean;
  onSave: (value: string) => void;
}

function Explanation({
  data,
  row,
  column,
  problem,
  dateStyle,
  dateStyleProven,
  explainedAbove,
  onSave,
}: ExplanationProps) {
  const value = data.rows[row][column];
  const info = CATALOGUE[problem];
  const partners = duplicatePartners(data, row, column);
  const fix = suggestFix(COLUMNS[column], problem, value, dateStyle);
  // Only dates that could mean two days need explaining; 21 Aug 2019 doesn't.
  // They're read in the file's style, as documented, without asking the user.
  const readAs =
    problem === 'date_other_style' && isAmbiguousDate(value)
      ? toIsoDate(value, dateStyle)
      : null;

  return (
    <>
      {!explainedAbove && <h2 className={styles.title}>{info.title}</h2>}
      <p>{info.why}</p>

      {partners.length > 0 && (
        <p>Also used by {partnersText(data, partners)}.</p>
      )}

      {fix ? (
        <div className={styles.suggestion}>
          {readAs && (
            <p>
              We read this as {longDate.format(new Date(readAs))}
              {dateStyleProven
                ? `, with the ${STYLE_NAMES[dateStyle]} first like most dates in your file.`
                : `, assuming the ${STYLE_NAMES[dateStyle]} comes first.`}
            </p>
          )}
          <p>
            <code>
              <MarkedSpaces value={value} />
            </code>{' '}
            → <code>{fix}</code>
          </p>
          <button
            type="button"
            className={styles.apply}
            onClick={() => onSave(fix)}
          >
            Change to {fix}
          </button>
        </div>
      ) : 'whatToDo' in info ? (
        <div className={styles.good}>
          <p className={styles.label}>What to do</p>
          <p>{info.whatToDo}</p>
        </div>
      ) : (
        <div className={styles.good}>
          <p className={styles.label}>How it should look</p>
          <p>
            <code>{info.goodExample}</code>
          </p>
        </div>
      )}
    </>
  );
}
