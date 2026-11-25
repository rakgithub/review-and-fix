import { useEffect, useState } from 'react';

interface Props {
  onSearch: (query: string) => void;
  className?: string;
}

const DELAY_MS = 200;

export function SearchBox({ onSearch, className }: Props) {
  const [value, setValue] = useState('');

  // The cleanup also runs on unmount, so a search typed just before
  // "Open a different file" can't land on the next file.
  useEffect(() => {
    const timer = window.setTimeout(() => onSearch(value), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <input
      type="search"
      className={className}
      placeholder="Search these rows…"
      aria-label="Search the rows shown"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
