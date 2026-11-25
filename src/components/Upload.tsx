import { useState } from 'react';
import styles from './Upload.module.css';

interface Props {
  error: string | null;
  onFile: (file: File) => void;
}

export function Upload({ error, onFile }: Props) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        We'll check your customers for problems and help you fix them. Nothing
        changes without your OK.
      </p>
      <label
        className={dragging ? `${styles.zone} ${styles.dragging}` : styles.zone}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          className={styles.input}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // so picking the same file again still loads it
            if (file) onFile(file);
          }}
        />
        <strong>Drop your customer file here</strong>
        <span>or click to choose a CSV file</span>
      </label>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
