import type { Progress } from '../core/loadFile.ts';
import { formatRows } from '../core/format.ts';
import styles from './LoadingScreen.module.css';

function progressText(progress: Progress): string {
  return progress.step === 'reading'
    ? `Reading your file… ${progress.percent}%`
    : `Checking ${formatRows(progress.rowCount)}…`;
}

export function LoadingScreen({ progress }: { progress: Progress }) {
  return (
    <div role="status" className={styles.loading}>
      <p>{progressText(progress)}</p>
      <progress
        max={100}
        value={progress.step === 'reading' ? progress.percent : 100}
      />
    </div>
  );
}
