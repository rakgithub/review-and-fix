import { describe, expect, it } from 'vitest';
import type { Progress } from './loadFile.ts';
import { COLUMNS } from '../rules/columns.ts';
import { loadFile, mapHeader } from './loadFile.ts';

const HEADER = [
  'customer_id',
  'first_name',
  'last_name',
  'email',
  'signup_date',
  'country',
  'plan',
  'monthly_spend',
];

describe('mapHeader', () => {
  it('maps the expected header in order', () => {
    expect(mapHeader(HEADER)).toEqual({
      ok: true,
      indexes: [0, 1, 2, 3, 4, 5, 6, 7],
    });
  });

  it('ignores case, spaces, underscores, a byte-order mark and extra columns', () => {
    const header = [
      '\uFEFFNotes',
      'Monthly Spend',
      ' PLAN ',
      'Country',
      'Signup_Date',
      'EMAIL',
      'Last Name',
      'firstname',
      'Customer ID',
    ];
    expect(mapHeader(header)).toEqual({
      ok: true,
      indexes: [8, 7, 6, 5, 4, 3, 2, 1],
    });
  });

  it('lists the missing columns', () => {
    expect(
      mapHeader(HEADER.filter((h) => h !== 'email' && h !== 'plan')),
    ).toEqual({
      ok: false,
      missing: ['email', 'plan'],
    });
  });
});

const HEADER_LINE = HEADER.join(',') + '\n';

function customer(i: number, lastName = 'Müller'): string {
  return `C-${i},Anna,${lastName},a${i}@example.com,2024-01-01,DE,pro,1\n`;
}

async function load(text: string, name = 'customers.csv') {
  const progress: Progress[] = [];
  const result = await loadFile(new File([text], name), (p) =>
    progress.push(p),
  );
  return { result, progress };
}

async function loadError(text: string) {
  const { result } = await load(text);
  if (result.ok) throw new Error('expected the file to be rejected');
  return result.error;
}

describe('loadFile', () => {
  it('keeps characters that straddle a 512 KB byte boundary intact', async () => {
    // Put the two bytes of "ü" on either side of byte 524,288, where reading
    // the File in byte slices used to split it into "M\uFFFD\uFFFDller".
    const enc = new TextEncoder();
    let text = HEADER_LINE;
    let i = 0;
    while (enc.encode(text).length < 524_288 - 200)
      text += customer(i++, 'Smith');
    const pad = 524_287 - enc.encode(`${text}C-${i},Anna,M`).length;
    text += customer(i++, `${'x'.repeat(pad)}Müller`);
    for (let k = 0; k < 50; k++) text += customer(i++);
    expect([...enc.encode(text).slice(524_287, 524_289)]).toEqual([0xc3, 0xbc]);

    const { result } = await load(text);
    if (!result.ok) throw new Error(result.error);
    const lastNames = result.data.rows.map((r) => r[2]);
    expect(lastNames.some((n) => n.includes('\uFFFD'))).toBe(false);
    expect(lastNames).toContain(`${'x'.repeat(pad)}Müller`);
  });

  it('loads every row exactly once across many chunks, with progress', async () => {
    let text = HEADER_LINE;
    for (let i = 0; i < 40_000; i++) text += customer(i);
    const { result, progress } = await load(text);
    if (!result.ok) throw new Error(result.error);

    expect(result.data.rows.map((r) => r[0])).toEqual(
      Array.from({ length: 40_000 }, (_, i) => `C-${i}`),
    );
    const percents = progress.flatMap((p) =>
      p.step === 'reading' ? [p.percent] : [],
    );
    expect(percents.length).toBeGreaterThan(3);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
    expect(progress.at(-1)).toEqual({ step: 'checking', rowCount: 40_000 });
  });

  it('checks rows and flags duplicates', async () => {
    const text =
      HEADER_LINE +
      'C-1,Anna,Müller,a@example.com,2024-01-01,Germany,pro,1\n' +
      'C-2,Luca,Rossi,A@example.com ,2024-01-01,IT,pro,1\n';
    const { result } = await load(text);
    if (!result.ok) throw new Error(result.error);
    const country = COLUMNS.indexOf('country');
    const email = COLUMNS.indexOf('email');
    expect(result.data.problems[0][country]).toBe('country_not_code');
    expect(result.data.problems.map((p) => p[email])).toEqual([
      'email_duplicate',
      'email_duplicate',
    ]);
    expect(result.data.searchText[1]).toContain('luca');
  });

  it('loads every row when a quoted cell has a stray quote inside', async () => {
    const text =
      HEADER_LINE +
      customer(1) +
      'C-2,Liam,"O"Brien",a2@example.com,2024-01-01,DE,pro,1\n' +
      customer(3);
    const { result } = await load(text);
    if (!result.ok) throw new Error(result.error);
    const lastName = COLUMNS.indexOf('last_name');
    expect(result.data.rows.map((row) => row[lastName])).toEqual([
      'Müller',
      'O"Brien',
      'Müller',
    ]);
  });

  it('reads semicolons, a byte-order mark, quoted cells and extra columns', async () => {
    const text =
      '\uFEFFCustomer ID;First Name;Last Name;Email;Signup Date;Country;Plan;Monthly Spend;Notes\n' +
      'C-1;Anna;"Müller; Jr.";a@example.com;2024-01-01;DE;pro;"120,50";x\n';
    const { result } = await load(text);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.rows).toEqual([
      [
        'C-1',
        'Anna',
        'Müller; Jr.',
        'a@example.com',
        '2024-01-01',
        'DE',
        'pro',
        '120,50',
      ],
    ]);
  });

  it('explains files it cannot use', async () => {
    expect(await loadError('')).toMatch('is empty');
    expect(await loadError('\n\n  \n')).toMatch('is empty');
    expect(await loadError(HEADER_LINE)).toMatch(
      'column names but no customers',
    );
    expect(await loadError('foo,bar\n1,2\n')).toMatch(
      "couldn't find the customer columns",
    );
    expect(
      await loadError(
        'customer_id,first_name,last_name,signup_date,country,monthly_spend\nC-1,A,B,2024-01-01,DE,1\n',
      ),
    ).toMatch('missing columns for Email and Plan');

    const brokenQuote =
      HEADER_LINE +
      customer(1) +
      'C-2,Anna,"Müller,a2@example.com,2024-01-01,DE,pro,1\n' +
      customer(3) +
      customer(4);
    expect(await loadError(brokenQuote)).toMatch(
      'near row 2 has a stray quote mark (")',
    );

    // Past the first chunk, the row number still counts from the file start.
    let late = HEADER_LINE;
    for (let i = 1; i < 20_000; i++) late += customer(i);
    late += 'C-x,Anna,"Müller,ax@example.com,2024-01-01,DE,pro,1\n';
    for (let i = 0; i < 100; i++) late += customer(i);
    expect(await loadError(late)).toMatch('near row 20,000 ');

    const { result } = await load(HEADER_LINE + customer(1), 'customers.xlsx');
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching("isn't a CSV"),
    });
  });
});
