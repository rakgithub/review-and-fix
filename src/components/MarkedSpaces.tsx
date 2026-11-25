import styles from './MarkedSpaces.module.css';

/**
 * Shows leading and trailing spaces as ␣. Otherwise " enterprise" →
 * "enterprise" looks like a change that does nothing.
 */
export function MarkedSpaces({ value }: { value: string }) {
  const [, before, middle, after] = /^( *)(.*?)( *)$/s.exec(value) ?? [];
  const space = (run: string) =>
    run && <span className={styles.space}>{'␣'.repeat(run.length)}</span>;
  return (
    <>
      {space(before)}
      {middle}
      {space(after)}
    </>
  );
}

export function SpaceLegend({ className }: { className?: string }) {
  return (
    <p className={className}>
      <span className={styles.space}>␣</span> marks an extra space.
    </p>
  );
}
