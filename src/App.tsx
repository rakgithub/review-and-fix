import { startTransition, useMemo, useRef, useState } from 'react';
import styles from './App.module.css';
import { AllRowsBanner, ProblemBanner } from './components/Banners.tsx';
import { BulkFixDialog } from './components/BulkFixDialog.tsx';
import { Grid, type Selection } from './components/Grid.tsx';
import { LoadingScreen } from './components/LoadingScreen.tsx';
import { Overview } from './components/Overview.tsx';
import { ProblemPanel } from './components/ProblemPanel.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { UndoDialog } from './components/UndoDialog.tsx';
import { Upload } from './components/Upload.tsx';
import { BULK_FIX_CODE } from './core/bulkFix.ts';
import { countProblems, type ProblemCounts } from './core/counts.ts';
import { editCell } from './core/edit.ts';
import {
  convertDates,
  detectDateStyle,
  type FileData,
} from './core/fileData.ts';
import { filterRows, nextProblem, type RowFilter } from './core/filter.ts';
import { formatNumber } from './core/format.ts';
import { loadFile, type Progress } from './core/loadFile.ts';
import { yieldToBrowser } from './core/yieldToBrowser.ts';
import { PROBLEM_COLUMNS } from './rules/columns.ts';
import type { DateStyle } from './rules/date.ts';
import { useBulkFix } from './useBulkFix.ts';

type State =
  | { status: 'idle'; error: string | null }
  | { status: 'loading'; progress: Progress }
  | {
      status: 'ready';
      data: FileData;
      counts: ProblemCounts;
      dateStyle: DateStyle;
      dateStyleProven: boolean;
    };

const NO_ROWS: FileData = {
  fileName: '',
  rows: [],
  problems: [],
  searchText: [],
  duplicates: { customer_id: new Map(), email: new Map() },
  changed: new Map(),
};

function App() {
  const [state, setState] = useState<State>({ status: 'idle', error: null });
  const [filter, setFilter] = useState<RowFilter>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Selection | null>(null);
  const focusSelected = useRef(false);
  // Whether the latest first click hit a cell. The panel opens on that click
  // and narrows the grid, so the second click of a double-click can land on
  // another cell or the panel; the double-click still edits the selected cell.
  const firstClickOnCell = useRef(false);

  const data = state.status === 'ready' ? state.data : NO_ROWS;
  // Not re-run on edits, so a fixed row stays in view with its new marker.
  const indexes = useMemo(
    () => filterRows(data, filter, query),
    [data, filter, query],
  );

  const bulk = useBulkFix(data, () => {
    recount();
    pickFilter({ kind: 'all' });
  });

  async function open(file: File) {
    setState({ status: 'loading', progress: { step: 'reading', percent: 0 } });
    const result = await loadFile(file, (progress) =>
      setState({ status: 'loading', progress }),
    );
    if (!result.ok) {
      setState({ status: 'idle', error: result.error });
      return;
    }
    await yieldToBrowser();
    // Dates we can read are converted, not flagged (see the design document).
    const dateStyle = detectDateStyle(result.data.rows);
    convertDates(result.data, dateStyle.style);
    const startCounts = countProblems(result.data.problems);
    await yieldToBrowser();
    startTransition(() => {
      setFilter({ kind: 'all' });
      setQuery('');
      setSelected(null);
      bulk.reset();
      setState({
        status: 'ready',
        data: result.data,
        counts: startCounts,
        dateStyle: dateStyle.style,
        dateStyleProven: dateStyle.proven,
      });
    });
  }

  // Every function that changes the file data must call it.
  function recount() {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, counts: countProblems(current.data.problems) }
        : current,
    );
  }

  function save(row: number, column: number, value: string) {
    if (!editCell(data, row, column, value)) return;
    recount();
  }

  function pickFilter(next: RowFilter) {
    setFilter(next);
    setSelected(null);
  }

  function openDifferentFile() {
    const count = data.changed.size;
    if (
      count > 0 &&
      !window.confirm(
        `You've changed ${formatNumber(count)} ${count === 1 ? 'value' : 'values'} in this file. If you open a different file, your changes will be lost.`,
      )
    ) {
      return;
    }
    setState({ status: 'idle', error: null });
  }

  if (state.status !== 'ready') {
    return (
      <main className={styles.start}>
        {state.status === 'idle' ? (
          <Upload error={state.error} onFile={open} />
        ) : (
          <LoadingScreen progress={state.progress} />
        )}
      </main>
    );
  }

  const { plan, undoing } = bulk;
  const next = selected
    ? nextProblem(data.problems, indexes, selected.row, filter)
    : null;

  return (
    <main
      className={
        selected ? `${styles.review} ${styles.withPanel}` : styles.review
      }
      onClickCapture={(e) => {
        if (e.detail !== 1) return;
        firstClickOnCell.current =
          e.target instanceof Element &&
          e.target.closest('[role=cell]') !== null;
      }}
      onDoubleClick={() => {
        if (!firstClickOnCell.current) return;
        setSelected((current) => current && { ...current, editing: true });
      }}
    >
      <header className={styles.header}>
        <h1>{state.data.fileName}</h1>
        <button
          type="button"
          className={styles.secondary}
          onClick={openDifferentFile}
        >
          Open a different file
        </button>
      </header>

      <Overview
        rowCount={data.rows.length}
        counts={state.counts}
        filter={filter}
        onFilter={pickFilter}
        fixes={bulk.fixes}
        onUndo={bulk.askUndo}
        onFixAll={() => {
          pickFilter({ kind: 'code', code: BULK_FIX_CODE });
          bulk.preview();
        }}
      />

      <section className={styles.rows}>
        {filter.kind === 'code' ? (
          <ProblemBanner
            code={filter.code}
            remaining={
              state.counts.byCode.find((c) => c.code === filter.code)?.rows ?? 0
            }
            canFixAll={filter.code === BULK_FIX_CODE}
          />
        ) : (
          <AllRowsBanner problemRows={state.counts.rowsWithProblems} />
        )}
        <Toolbar shownRows={indexes.length} onSearch={setQuery} />
        <Grid
          key={JSON.stringify(filter) + query}
          data={data}
          // Every edit, fix and undo recounts, so this changes with the data.
          version={state.counts}
          indexes={indexes}
          query={query}
          highlight={filter.kind === 'code' ? PROBLEM_COLUMNS[filter.code] : []}
          selected={selected}
          focusSelected={focusSelected}
          onSelect={(row, column) => setSelected({ row, column })}
          onEdit={(editing) =>
            setSelected((current) => current && { ...current, editing })
          }
          onSave={save}
        />
      </section>

      {plan && (
        <BulkFixDialog
          plan={plan}
          busy={bulk.busy}
          onApply={() => void bulk.apply(plan)}
          onCancel={bulk.cancelPreview}
        />
      )}

      {undoing && (
        <UndoDialog
          counts={undoing.counts}
          changes={undoing.fix.changes}
          busy={bulk.busy}
          onUndo={() => void bulk.undo(undoing.fix)}
          onCancel={bulk.cancelUndo}
        />
      )}

      {selected && (
        <ProblemPanel
          data={data}
          row={selected.row}
          column={selected.column}
          dateStyle={state.dateStyle}
          dateStyleProven={state.dateStyleProven}
          explainedAbove={filter.kind === 'code' ? filter.code : null}
          editingInTable={selected.editing === true}
          onSave={(value) => save(selected.row, selected.column, value)}
          onEdit={() =>
            setSelected((current) => current && { ...current, editing: true })
          }
          onNext={
            next &&
            (() => {
              focusSelected.current = true;
              setSelected(next);
            })
          }
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

export default App;
