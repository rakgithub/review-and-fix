import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { cellKey, type FileData, type Problem } from '../core/fileData.ts';
import { matchParts } from '../core/filter.ts';
import { CATALOGUE } from '../rules/catalogue.ts';
import { COLUMN_LABELS, COLUMNS, type Column } from '../rules/columns.ts';
import styles from './Grid.module.css';

export interface Selection {
  row: number;
  column: number;
  editing?: boolean;
}

interface Props {
  data: FileData;
  version: unknown;
  indexes: readonly number[];
  query: string;
  highlight: readonly Column[];
  selected: Selection | null;
  focusSelected: RefObject<boolean>;
  onSelect: (row: number, column: number) => void;
  onEdit: (editing: boolean) => void;
  onSave: (row: number, column: number, value: string) => void;
}

const ROW_HEIGHT = 32;
const OVERSCAN = 15;

export function Grid({
  data,
  version,
  indexes,
  query,
  highlight,
  selected,
  focusSelected,
  onSelect,
  onEdit,
  onSave,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const headerBox = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  // Kept rendered while scrolled out of view, so the draft and focus survive.
  const editingIndex = selected?.editing ? indexes.indexOf(selected.row) : -1;
  const virtualizer = useVirtualizer({
    count: indexes.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    rangeExtractor: (range) => {
      const items = defaultRangeExtractor(range);
      if (editingIndex === -1 || items.includes(editingIndex)) return items;
      return [...items, editingIndex].sort((a, b) => a - b);
    },
  });

  const selectedRow = selected?.row;
  useEffect(() => {
    const el = scroller.current;
    if (!el || selectedRow === undefined) return;
    const i = indexes.indexOf(selectedRow);
    if (i === -1) return;
    const top = i * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(0, top - el.clientHeight / 3);
    }
  }, [selectedRow, indexes]);

  const firstHighlighted = COLUMNS.findIndex((column) =>
    highlight.includes(column),
  );
  const selectedColumn = selected?.column ?? firstHighlighted;
  useEffect(() => {
    const el = scroller.current;
    const cells = header.current?.children;
    if (!el || !cells || selectedColumn === -1) return;
    // +1 skips the "Row" column, which sticks over the left edge.
    const cell = cells[selectedColumn + 1];
    if (!(cell instanceof HTMLElement)) return;
    const rowNumberWidth =
      cells[0] instanceof HTMLElement ? cells[0].offsetWidth : 0;
    const left = cell.offsetLeft - rowNumberWidth;
    const right = cell.offsetLeft + cell.offsetWidth;
    if (left < el.scrollLeft) el.scrollLeft = left;
    else if (right > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = right - el.clientWidth;
    }
  }, [selectedColumn, selectedRow]);

  const isHighlighted = COLUMNS.map((column) => highlight.includes(column));

  return (
    <div
      role="table"
      aria-rowcount={indexes.length + 1}
      className={styles.table}
    >
      <div ref={headerBox} className={styles.headerBox}>
        <div
          ref={header}
          role="row"
          aria-rowindex={1}
          className={styles.header}
        >
          <span role="columnheader" className={styles.rowNumber}>
            <span className={styles.note}>Row</span>
          </span>
          {COLUMNS.map((column, c) => (
            <span
              key={column}
              role="columnheader"
              className={isHighlighted[c] ? styles.highlighted : undefined}
            >
              {COLUMN_LABELS[column]}
            </span>
          ))}
        </div>
      </div>
      <div
        ref={scroller}
        className={styles.scroller}
        onScroll={(e) => {
          if (headerBox.current) {
            headerBox.current.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
      >
        <div
          className={styles.body}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const r = indexes[item.index];
            const isSelectedRow = selected?.row === r;
            return (
              <Row
                key={r}
                row={r}
                rowIndex={item.index}
                top={item.start}
                data={data}
                version={version}
                query={query}
                highlight={highlight}
                selectedColumn={isSelectedRow ? selected.column : -1}
                editing={isSelectedRow && selected.editing === true}
                focusSelectedRef={focusSelected}
                onSelect={onSelect}
                onEdit={onEdit}
                onSave={onSave}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  row: number;
  rowIndex: number;
  top: number;
  data: FileData;
  /** Edits change `data` in place, so this new value is what tells memo. */
  version: unknown;
  query: string;
  highlight: readonly Column[];
  selectedColumn: number;
  editing: boolean;
  focusSelectedRef: RefObject<boolean>;
  onSelect: (row: number, column: number) => void;
  onEdit: (editing: boolean) => void;
  onSave: (row: number, column: number, value: string) => void;
}

// Memoized so scrolling only renders rows coming into view; rows already on
// screen keep the same props while the virtualizer re-renders the grid.
const Row = memo(function Row({
  row: r,
  rowIndex,
  top,
  data,
  query,
  highlight,
  selectedColumn,
  editing,
  focusSelectedRef,
  onSelect,
  onEdit,
  onSave,
}: RowProps) {
  function focusIfAsked(el: HTMLElement | null) {
    if (!el || !focusSelectedRef.current) return;
    focusSelectedRef.current = false;
    el.focus({ preventScroll: true });
  }

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      className={styles.row}
      style={{ transform: `translateY(${top}px)` }}
    >
      <span role="rowheader" className={styles.rowNumber}>
        {r + 1}
      </span>
      {data.rows[r].map((value, c) => {
        const isSelected = selectedColumn === c;
        return isSelected && editing ? (
          <CellEditor
            key={c}
            initial={value}
            onDone={(next, keepFocus) => {
              focusSelectedRef.current = keepFocus;
              if (next !== null) onSave(r, c, next);
              onEdit(false);
            }}
          />
        ) : (
          <Cell
            key={c}
            value={value}
            query={query}
            problem={data.problems[r][c]}
            changed={data.changed.has(cellKey(r, c))}
            highlighted={highlight.includes(COLUMNS[c])}
            selected={isSelected}
            cellRef={isSelected ? focusIfAsked : undefined}
            onSelect={() => onSelect(r, c)}
            onEdit={() => {
              onSelect(r, c);
              onEdit(true);
            }}
          />
        );
      })}
    </div>
  );
});

interface CellProps {
  value: string;
  query: string;
  problem: Problem;
  changed: boolean;
  highlighted: boolean;
  selected: boolean;
  cellRef?: (el: HTMLElement | null) => void;
  onSelect: () => void;
  onEdit: () => void;
}

function Cell({
  value,
  query,
  problem,
  changed,
  highlighted,
  selected,
  cellRef,
  onSelect,
  onEdit,
}: CellProps) {
  const fixed = changed && problem === null;
  const classes = [
    styles.cell,
    highlighted && styles.highlighted,
    problem && styles.problem,
    fixed && styles.fixed,
    selected && styles.selected,
  ];
  const note = fixed
    ? 'Changed by you'
    : [problem && CATALOGUE[problem].title, changed && 'Changed by you']
        .filter(Boolean)
        .join(' · ');
  return (
    <span
      ref={cellRef}
      role="cell"
      className={classes.filter(Boolean).join(' ')}
      title={note || undefined}
      tabIndex={0}
      // The second click of a double-click may land on another cell once the
      // panel has opened; App turns the double-click into an edit of this one.
      onClick={(e) => {
        if (e.detail <= 1) onSelect();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' && selected) || e.key === 'F2') {
          e.preventDefault();
          onEdit();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {value === '' ? (
        <span className={styles.empty}>(empty)</span>
      ) : (
        <span className={styles.value}>
          {matchParts(value, query).map((part, i) =>
            part.match ? (
              <mark key={i} className={styles.match}>
                {part.text}
              </mark>
            ) : (
              part.text
            ),
          )}
        </span>
      )}
      {note && <span className={styles.note}> ({note})</span>}
    </span>
  );
}

interface CellEditorProps {
  initial: string;
  onDone: (value: string | null, keepFocus: boolean) => void;
}

function CellEditor({ initial, onDone }: CellEditorProps) {
  const [draft, setDraft] = useState(initial);
  // Enter and Escape end the edit; the blur that follows must not save again.
  const done = useRef(false);

  function finish(value: string | null, keepFocus: boolean) {
    if (done.current) return;
    done.current = true;
    onDone(value, keepFocus);
  }

  return (
    <span role="cell" className={`${styles.cell} ${styles.editing}`}>
      <input
        aria-label="Change this value"
        autoFocus
        className={styles.input}
        value={draft}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(draft, false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            finish(draft, true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(null, true);
          }
        }}
      />
    </span>
  );
}
