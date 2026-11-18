import type { CallDirection, CallRecord, SimSlot } from '@/src/types/call';

export type ImportResult = {
  calls: CallRecord[];
  invalid: number;
  problems: string[];
};

const MAX_PROBLEMS = 5;

type Column =
  | 'number'
  | 'name'
  | 'direction'
  | 'sim'
  | 'timestamp'
  | 'duration'
  | 'note'
  | 'tag';

const COLUMN_ALIASES: Record<Column, string[]> = {
  number: ['number', 'phone', 'phonenumber', 'mobile', 'msisdn', 'to', 'address', 'callee'],
  name: ['name', 'contact', 'contactname', 'caller', 'callername', 'displayname'],
  direction: ['direction', 'type', 'calltype', 'inout'],
  sim: ['sim', 'slot', 'simslot', 'subscription'],
  timestamp: ['timestamp', 'date', 'datetime', 'time', 'calledat', 'createdat'],
  duration: ['duration', 'durationseconds', 'seconds', 'length'],
  note: ['note', 'notes', 'comment', 'comments'],
  tag: ['tag', 'tags', 'label', 'category'],
};

const normaliseHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

function mapColumns(header: string[]): Partial<Record<Column, number>> {
  const columns: Partial<Record<Column, number>> = {};
  header.forEach((raw, index) => {
    const key = normaliseHeader(raw);
    (Object.keys(COLUMN_ALIASES) as Column[]).forEach((column) => {
      if (columns[column] === undefined && COLUMN_ALIASES[column].includes(key)) {
        columns[column] = index;
      }
    });
  });
  return columns;
}

function normaliseNumber(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?[eE][+-]?\d+$/.test(trimmed)) return trimmed;
  const expanded = Number(trimmed);
  return Number.isFinite(expanded) ? expanded.toFixed(0) : trimmed;
}

function parseDirection(value: string): CallDirection | null {
  const key = value.trim().toLowerCase();
  if (key === 'missed' || key === 'miss') return 'missed';
  if (key === 'outgoing' || key === 'out' || key === 'placed' || key === 'dialed') {
    return 'outgoing';
  }
  if (key === 'incoming' || key === 'in' || key === 'received') return 'incoming';
  return null;
}

function parseSim(value: string): SimSlot {
  const digit = value.match(/\d/);
  if (!digit) return null;
  if (digit[0] === '1') return 'SIM 1';
  if (digit[0] === '2') return 'SIM 2';
  return null;
}

function parseTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (numeric <= 0 || numeric > 1e14) return null;
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((part) => Number(part.trim()));
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
    return Math.round(parts.reduce((total, part) => total * 60 + part, 0));
  }
  const seconds = Number(trimmed);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
}

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function makeCallId(call: {
  number: string;
  timestamp: number;
  direction: CallDirection;
  duration: number;
}): string {
  const raw = `${call.number.trim()}|${call.timestamp}|${call.direction}|${call.duration}`;
  return `c${fnv1a(raw, 0x811c9dc5).toString(16)}${fnv1a(raw, 0x9e3779b9).toString(16)}`;
}

type Table = { header: string[]; rows: string[][] };

function tableFromJson(text: string): Table | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { calls?: unknown[] }).calls)
      ? (parsed as { calls: unknown[] }).calls
      : null;
  if (!list) return null;
  const objects = list.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  );
  const header: string[] = [];
  objects.forEach((entry) => {
    Object.keys(entry).forEach((key) => {
      if (!header.includes(key)) header.push(key);
    });
  });
  if (header.length === 0) return null;
  const rows = objects.map((entry) =>
    header.map((key) => {
      const value = entry[key];
      return value === undefined || value === null ? '' : String(value);
    }),
  );
  return { header, rows };
}

export function parseCallImport(text: string, filename = ''): ImportResult {
  const source = text.replace(/^\uFEFF/, '').trim();
  if (!source) {
    return { calls: [], invalid: 0, problems: ['That file is empty.'] };
  }
  const looksJson =
    filename.toLowerCase().endsWith('.json') ||
    source.startsWith('[') ||
    source.startsWith('{');

  let table: Table | null;
  if (looksJson) {
    table = tableFromJson(source);
    if (!table) {
      return { calls: [], invalid: 0, problems: ['Could not read that JSON file.'] };
    }
  } else {
    const rows = parseCsv(source);
    if (rows.length < 2) {
      return {
        calls: [],
        invalid: 0,
        problems: ['That CSV has no data rows below its header.'],
      };
    }
    table = { header: rows[0], rows: rows.slice(1) };
  }

  const columns = mapColumns(table.header);
  if (columns.number === undefined) {
    return {
      calls: [],
      invalid: table.rows.length,
      problems: ['No phone number column found — expected "number", "phone" or similar.'],
    };
  }

  const calls: CallRecord[] = [];
  const problems: string[] = [];
  let invalid = 0;

  const read = (row: string[], column: Column): string => {
    const index = columns[column];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };

  table.rows.forEach((row, rowIndex) => {
    const number = normaliseNumber(read(row, 'number'));
    if (!number) {
      invalid += 1;
      if (problems.length < MAX_PROBLEMS) {
        problems.push(`Row ${rowIndex + 2}: missing phone number.`);
      }
      return;
    }

    const timestamp = parseTimestamp(read(row, 'timestamp'));
    if (timestamp === null) {
      invalid += 1;
      if (problems.length < MAX_PROBLEMS) {
        problems.push(`Row ${rowIndex + 2}: unreadable date "${read(row, 'timestamp')}".`);
      }
      return;
    }

    const duration = parseDuration(read(row, 'duration'));
    if (duration === null) {
      invalid += 1;
      if (problems.length < MAX_PROBLEMS) {
        problems.push(`Row ${rowIndex + 2}: unreadable duration "${read(row, 'duration')}".`);
      }
      return;
    }

    const directionValue = read(row, 'direction');
    const direction = parseDirection(directionValue) ?? 'outgoing';
    const name = read(row, 'name') || null;
    const note = read(row, 'note') || null;
    const tag = read(row, 'tag') || null;

    calls.push({
      id: makeCallId({ number, timestamp, direction, duration }),
      number,
      name,
      direction,
      sim: parseSim(read(row, 'sim')),
      timestamp,
      duration,
      note,
      tag,
    });
  });

  if (problems.length > 0 && invalid > problems.length) {
    problems.push(`...and ${invalid - problems.length} more skipped rows.`);
  }

  return { calls, invalid, problems };
}

export function buildSampleCalls(now: Date = new Date()): CallRecord[] {
  const base = now.getTime();
  const hour = 3_600_000;
  const day = 86_400_000;

  const seeds: Array<{
    number: string;
    name: string | null;
    direction: CallDirection;
    sim: SimSlot;
    offsetMs: number;
    duration: number;
    note: string | null;
    tag: string | null;
  }> = [
    { number: '+251941505775', name: 'Melek', direction: 'outgoing', sim: 'SIM 1', offsetMs: 1.5 * hour, duration: 194, note: 'Confirmed weekend dinner plan', tag: 'Family' },
    { number: '+251911248890', name: 'Dawit Bekele', direction: 'incoming', sim: 'SIM 1', offsetMs: 4 * hour, duration: 428, note: 'Reviewed invoice schedule', tag: 'Work' },
    { number: '+251922310442', name: 'Sara Tadesse', direction: 'missed', sim: 'SIM 2', offsetMs: 6 * hour, duration: 0, note: null, tag: null },
    { number: '+251911248890', name: 'Dawit Bekele', direction: 'outgoing', sim: 'SIM 1', offsetMs: 1 * day + 2 * hour, duration: 122, note: null, tag: 'Work' },
    { number: '+251933801122', name: 'Yonas Alemu', direction: 'incoming', sim: 'SIM 2', offsetMs: 1 * day + 7 * hour, duration: 640, note: 'Server migration checklist', tag: 'Tech' },
    { number: '+251941505775', name: 'Melek', direction: 'incoming', sim: 'SIM 1', offsetMs: 2 * day + 3 * hour, duration: 315, note: null, tag: 'Family' },
    { number: '+251918440219', name: null, direction: 'missed', sim: 'SIM 2', offsetMs: 2 * day + 9 * hour, duration: 0, note: 'Courier delivery call', tag: 'Delivery' },
    { number: '+251912904411', name: 'Hanna Girma', direction: 'outgoing', sim: 'SIM 1', offsetMs: 3 * day + 5 * hour, duration: 280, note: 'Checked on mom', tag: 'Family' },
    { number: '+251933801122', name: 'Yonas Alemu', direction: 'outgoing', sim: 'SIM 2', offsetMs: 4 * day + 1 * hour, duration: 512, note: null, tag: 'Tech' },
    { number: '+251911248890', name: 'Dawit Bekele', direction: 'incoming', sim: 'SIM 1', offsetMs: 5 * day + 4 * hour, duration: 185, note: null, tag: 'Work' },
    { number: '+251922310442', name: 'Sara Tadesse', direction: 'outgoing', sim: 'SIM 2', offsetMs: 6 * day + 6 * hour, duration: 405, note: 'Project timeline sync', tag: 'Work' },
    { number: '+251912904411', name: 'Hanna Girma', direction: 'incoming', sim: 'SIM 1', offsetMs: 11 * day + 2 * hour, duration: 230, note: null, tag: 'Family' },
    { number: '+251945001872', name: 'Abel Tesfaye', direction: 'outgoing', sim: 'SIM 1', offsetMs: 15 * day + 4 * hour, duration: 342, note: 'Used to call every 4 days', tag: 'Friends' },
    { number: '+251945001872', name: 'Abel Tesfaye', direction: 'incoming', sim: 'SIM 1', offsetMs: 19 * day + 5 * hour, duration: 218, note: null, tag: 'Friends' },
    { number: '+251945001872', name: 'Abel Tesfaye', direction: 'outgoing', sim: 'SIM 1', offsetMs: 23 * day + 2 * hour, duration: 175, note: null, tag: 'Friends' },
  ];

  return seeds.map((entry) => {
    const timestamp = Math.round(base - entry.offsetMs);
    return {
      id: makeCallId({
        number: entry.number,
        timestamp,
        direction: entry.direction,
        duration: entry.duration,
      }),
      number: entry.number,
      name: entry.name,
      direction: entry.direction,
      sim: entry.sim,
      timestamp,
      duration: entry.duration,
      note: entry.note,
      tag: entry.tag,
    };
  });
}
