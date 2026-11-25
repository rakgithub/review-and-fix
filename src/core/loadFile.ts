import Papa from 'papaparse';
import { formatNumber } from './format.ts';
import { COLUMNS, COLUMN_LABELS, type Column } from '../rules/columns.ts';
import {
  checkRow,
  searchTextOf,
  flagDuplicates,
  groupDuplicates,
  type DuplicateGroups,
  type FileData,
  type Problem,
} from './fileData.ts';
import { yieldToBrowser } from './yieldToBrowser.ts';

export type Progress =
  { step: 'reading'; percent: number } | { step: 'checking'; rowCount: number };

type LoadResult = { ok: true; data: FileData } | { ok: false; error: string };

const CHUNK_SIZE = 512 * 1024;

const EMPTY_ERROR =
  'This file is empty. Check that you picked the right file and try again.';

function headerKey(name: string): string {
  return name
    .replace(/^\uFEFF/, '')
    .replace(/[\s_]/g, '')
    .toLowerCase();
}

export function mapHeader(
  header: readonly string[],
): { ok: true; indexes: number[] } | { ok: false; missing: Column[] } {
  const keys = header.map(headerKey);
  const indexes = COLUMNS.map((column) => keys.indexOf(headerKey(column)));
  const missing = COLUMNS.filter((_, c) => indexes[c] === -1);
  return missing.length > 0 ? { ok: false, missing } : { ok: true, indexes };
}

function toRow(raw: readonly string[], indexes: readonly number[]): string[] {
  return indexes.map((i) => raw[i] ?? '');
}

function fileTypeError(file: File): string | null {
  if (!/\.csv$/i.test(file.name)) {
    return "This file isn't a CSV file. Save it from your spreadsheet as CSV (comma-separated values), then open it here.";
  }
  if (file.size === 0) {
    return EMPTY_ERROR;
  }
  return null;
}

function missingColumnsError(missing: Column[]): string {
  if (missing.length === COLUMNS.length) {
    return "We couldn't find the customer columns in this file. Its first row should name the columns, like Customer ID, Email and Country.";
  }
  const names = missing.map((c) => COLUMN_LABELS[c]);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const noun = names.length === 1 ? 'a column' : 'columns';
  return `This file is missing ${noun} for ${list}. Add ${names.length === 1 ? 'it' : 'them'} to the first row of the file, then open it again.`;
}

/**
 * A streaming decoder keeps characters split across slices (ü, €) intact,
 * which Papa Parse's own file reading breaks.
 */
async function readText(file: File): Promise<string> {
  const decoder = new TextDecoder();
  const parts: string[] = [];
  for (let start = 0; start < file.size; start += CHUNK_SIZE) {
    const bytes = await file.slice(start, start + CHUNK_SIZE).arrayBuffer();
    parts.push(decoder.decode(bytes, { stream: true }));
  }
  parts.push(decoder.decode());
  return parts.join('');
}

const READ_ERROR =
  "We couldn't read this file. Try opening it again, or pick a different file.";

function quoteError(row: number): string {
  return `A cell near row ${formatNumber(row)} has a stray quote mark ("), so the rows after it can't be read. Remove it in your spreadsheet, save as CSV again, then open it here.`;
}

export async function loadFile(
  file: File,
  onProgress: (progress: Progress) => void,
): Promise<LoadResult> {
  const typeError = fileTypeError(file);
  if (typeError) return { ok: false, error: typeError };

  let text: string;
  try {
    text = await readText(file);
  } catch {
    return { ok: false, error: READ_ERROR };
  }
  await yieldToBrowser();
  return parseText(text, file.name, onProgress);
}

function parseText(
  text: string,
  fileName: string,
  onProgress: (progress: Progress) => void,
): Promise<LoadResult> {
  return new Promise((resolve) => {
    const rows: string[][] = [];
    const problems: Problem[][] = [];
    const searchText: string[] = [];
    const idGroups: DuplicateGroups = new Map();
    const emailGroups: DuplicateGroups = new Map();
    let indexes: number[] | null = null;
    let failed = false;

    function fail(error: string, parser?: Papa.Parser) {
      failed = true;
      parser?.abort();
      resolve({ ok: false, error });
    }

    Papa.parse<string[]>(text, {
      chunkSize: CHUNK_SIZE,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', ';'],
      // Typed by hand: the overload for text input that allows `chunk` can't
      // be inferred from an untyped callback.
      chunk(results: Papa.ParseResult<string[]>, parser: Papa.Parser) {
        let raws = results.data;
        // An unclosed quote reads the rest of the file into one cell and would
        // silently drop rows. A stray quote ("O"Brien") still reads every row.
        const quote = results.errors.find((e) => e.code === 'MissingQuotes');
        if (quote) {
          const headerRows = indexes ? 0 : 1;
          const row = rows.length + (quote.row ?? 0) - headerRows + 1;
          return fail(quoteError(Math.max(1, row)), parser);
        }
        if (!indexes) {
          if (raws.length === 0) return;
          const mapped = mapHeader(raws[0] ?? []);
          if (!mapped.ok)
            return fail(missingColumnsError(mapped.missing), parser);
          indexes = mapped.indexes;
          raws = raws.slice(1);
        }
        const start = rows.length;
        for (const raw of raws) {
          const row = toRow(raw, indexes);
          rows.push(row);
          problems.push(checkRow(row));
          searchText.push(searchTextOf(row));
        }
        groupDuplicates(idGroups, rows, problems, 'customer_id', start);
        groupDuplicates(emailGroups, rows, problems, 'email', start);
        const percent = Math.min(
          99,
          Math.floor((results.meta.cursor / text.length) * 100),
        );
        onProgress({ step: 'reading', percent });
        parser.pause();
        setTimeout(() => parser.resume(), 0);
      },
      async complete() {
        if (failed) return;
        if (!indexes) {
          return fail(EMPTY_ERROR);
        }
        if (rows.length === 0) {
          return fail(
            'This file has column names but no customers. Check that you picked the right file and try again.',
          );
        }
        onProgress({ step: 'checking', rowCount: rows.length });
        await yieldToBrowser();
        flagDuplicates(idGroups, problems, 'customer_id');
        flagDuplicates(emailGroups, problems, 'email');
        resolve({
          ok: true,
          data: {
            fileName,
            rows,
            problems,
            searchText,
            duplicates: { customer_id: idGroups, email: emailGroups },
            changed: new Map(),
          },
        });
      },
    });
  });
}
