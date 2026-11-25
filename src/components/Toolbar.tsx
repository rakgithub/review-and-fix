import { formatRows } from '../core/format.ts';
import { SearchBox } from './SearchBox.tsx';
import styles from './Toolbar.module.css';

interface Props {
  shownRows: number;
  onSearch: (query: string) => void;
}

export function Toolbar({ shownRows, onSearch }: Props) {
  return (
    <div className={styles.toolbar}>
      <SearchBox className={styles.search} onSearch={onSearch} />
      <span role="status" className={styles.showing}>
        {shownRows === 0
          ? 'No rows match.'
          : `Showing ${formatRows(shownRows)}`}
      </span>
      <span className={styles.legend}>
        <span className={styles.problemKey}>Problem</span>
        <span className={styles.fixedKey}>Changed</span>
      </span>
    </div>
  );
}
