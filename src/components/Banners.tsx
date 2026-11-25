import { useId } from 'react';
import { formatRows } from '../core/format.ts';
import { CATALOGUE, type ProblemCode } from '../rules/catalogue.ts';
import styles from './Banners.module.css';

interface Props {
  code: ProblemCode;
  remaining: number;
  canFixAll: boolean;
}

export function ProblemBanner({ code, remaining, canFixAll }: Props) {
  const info = CATALOGUE[code];
  const titleId = useId();
  if (remaining === 0) {
    return (
      <section className={`${styles.banner} ${styles.done}`} role="status">
        <p className={styles.text}>
          <strong>All fixed.</strong> Pick the next problem on the left.
        </p>
      </section>
    );
  }
  return (
    <section className={styles.banner} aria-labelledby={titleId}>
      <div className={styles.line}>
        <h2 id={titleId} className={styles.title}>
          {info.title}
          <span className={styles.count}>{formatRows(remaining)}</span>
        </h2>
        <span className={styles.note}>
          {canFixAll
            ? 'Fix them all on the left, or click a highlighted cell.'
            : 'Click a highlighted cell to fix it.'}
        </span>
      </div>
    </section>
  );
}

export function AllRowsBanner({ problemRows }: { problemRows: number }) {
  if (problemRows === 0) {
    return (
      <section className={`${styles.banner} ${styles.done}`} role="status">
        <p className={styles.text}>
          <strong>All rows are ready.</strong> Nothing left to fix.
        </p>
      </section>
    );
  }
  const what = problemRows === 1 ? 'has a problem' : 'have problems';
  return (
    <section className={`${styles.banner} ${styles.neutral}`} role="status">
      <p className={styles.text}>
        <strong>All rows.</strong> {formatRows(problemRows)} {what}. Pick a
        problem on the left to fix it.
      </p>
    </section>
  );
}
