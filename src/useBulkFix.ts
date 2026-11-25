import { useState } from 'react';
import {
  applyBulkFix,
  countUndo,
  planBulkFix,
  undoBulkFix,
  type AppliedBulkFix,
  type BulkFixPlan,
  type UndoCounts,
} from './core/bulkFix.ts';
import type { FileData } from './core/fileData.ts';
import { rebuildSearchText } from './core/filter.ts';
import { yieldToBrowser } from './core/yieldToBrowser.ts';

const SEARCH_TEXT_SLICE = 5000;

// Bulk fixes leave search text stale to stay fast; rebuild it in slices.
async function rebuildSearchTextLater(data: FileData, rows: number[]) {
  for (let i = 0; i < rows.length; i += SEARCH_TEXT_SLICE) {
    await yieldToBrowser();
    rebuildSearchText(data, rows.slice(i, i + SEARCH_TEXT_SLICE));
  }
}

export function useBulkFix(data: FileData, onDataChanged: () => void) {
  const [plan, setPlan] = useState<BulkFixPlan | null>(null);
  const [fixes, setFixes] = useState<AppliedBulkFix[]>([]);
  // Counted when the dialog opens, not on every render: it walks every cell.
  const [undoing, setUndoing] = useState<{
    fix: AppliedBulkFix;
    counts: UndoCounts;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply(current: BulkFixPlan) {
    setBusy(true);
    const applied = await applyBulkFix(data, current);
    setBusy(false);
    setPlan(null);
    onDataChanged();
    void rebuildSearchTextLater(
      data,
      applied.cells.map((cell) => cell.row),
    );
    setFixes((all) => [applied, ...all]);
  }

  async function undo(applied: AppliedBulkFix) {
    setBusy(true);
    await undoBulkFix(data, applied);
    setBusy(false);
    setUndoing(null);
    onDataChanged();
    void rebuildSearchTextLater(
      data,
      applied.cells.map((cell) => cell.row),
    );
    setFixes((all) => all.filter((fix) => fix !== applied));
  }

  return {
    plan,
    fixes,
    undoing,
    busy,
    preview: () => setPlan(planBulkFix(data)),
    apply,
    cancelPreview: () => setPlan(null),
    askUndo: (fix: AppliedBulkFix) =>
      setUndoing({ fix, counts: countUndo(data, fix) }),
    undo,
    cancelUndo: () => setUndoing(null),
    reset: () => {
      setPlan(null);
      setUndoing(null);
      setFixes([]);
    },
  };
}
