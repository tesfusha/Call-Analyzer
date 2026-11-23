import { getContactKey } from '@/src/lib/contacts';
import { normaliseEthPhone } from '@/src/lib/ethiopia';
import { computeScoreFromHistory, toEatDateString } from '@/src/lib/gamification';
import type {
  BackupSettingsSnapshot,
  BadgeRecord,
  CallDirection,
  CallRecord,
  ContactMilestoneRecord,
  ContactProfile,
  PointsHistoryEntry,
  PointsReason,
  ScheduledCall,
  ScheduledCallStatus,
  SimSlot,
  StreakRecord,
} from '@/src/types/call';

export const CURRENT_BACKUP_SCHEMA_VERSION = 3;

export type ImportResult = {
  calls: CallRecord[];
  invalid: number;
  problems: string[];
};

export type ParsedImportPackage = {
  formatLabel: string;
  isBackup: boolean;
  schemaVersion: number | null;
  exportedAt: string | null;
  calls: CallRecord[];
  invalid: number;
  problems: string[];
  tags: string[];
  contacts: ContactProfile[];
  settings: BackupSettingsSnapshot | null;
  streaks: StreakRecord | null;
  pointsHistory: PointsHistoryEntry[];
  importedScore: number | null;
  badges: BadgeRecord[];
  contactMilestones: ContactMilestoneRecord[];
  scheduledCalls: ScheduledCall[];
  favorites: string[];
  dismissedMissedIds: string[];
  mutedAlertKeys: string[];
};

export type ImportPreviewSummary = {
  filename: string;
  formatLabel: string;
  isBackup: boolean;
  schemaVersion: number | null;
  newerSchemaWarning: boolean;
  newCallsCount: number;
  duplicateCallsCount: number;
  mergeUpdatesCount: number;
  invalidCount: number;
  problems: string[];
  totalRowsEvaluated: number;
  newTagsCount: number;
  contactsCount: number;
  newContactsCount: number;
  updatedContactsCount: number;
  scheduledCallsCount: number;
  newScheduledCount: number;
  hasSettings: boolean;
  hasStreaks: boolean;
  hasBadges: boolean;
  hasContactMilestones: boolean;
  contactMilestonesCount: number;
  hasScore: boolean;
  scorePreviewValue: number | null;
  hasRestorableContent: boolean;
};

const MAX_PROBLEMS = 6;
const MIN_VALID_TIMESTAMP_MS = Date.UTC(2000, 0, 1);
const MAX_DURATION_SECONDS = 864_000;

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

function detectTextDelimiter(source: string): string {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const candidates = [',', '\t', ';', '|'];
  let bestDelim = ',';
  let bestCount = 0;

  candidates.forEach((delim) => {
    let inQuotes = false;
    let count = 0;
    for (let i = 0; i < firstLine.length; i += 1) {
      const ch = firstLine[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && ch === delim) {
        count += 1;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestDelim = delim;
    }
  });

  return bestDelim;
}

function parseDelimitedText(source: string, delimiter: string): string[][] {
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
    } else if (ch === delimiter) {
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

function validatePhoneNumber(raw: string): { valid: boolean; value: string; reason?: string } {
  const cleaned = normaliseNumber(raw).trim();
  if (!cleaned) {
    return { valid: false, value: '', reason: 'missing phone number' };
  }
  if (cleaned.includes('*')) {
    return {
      valid: false,
      value: '',
      reason: 'masked phone number (turn off Privacy Mode before exporting a restorable backup)',
    };
  }
  if (cleaned.length > 40) {
    return { valid: false, value: '', reason: `phone number too long (${cleaned.length} chars)` };
  }
  const compact = cleaned.replace(/[\s()-]/g, '');
  if (!/^\+?\d+$/.test(compact)) {
    return { valid: false, value: '', reason: `invalid characters in number "${cleaned}"` };
  }
  const digits = compact.startsWith('+') ? compact.slice(1) : compact;
  if (digits.length < 3 || digits.length > 16) {
    return {
      valid: false,
      value: '',
      reason: `invalid phone length (${digits.length} digits in "${cleaned}")`,
    };
  }
  return { valid: true, value: cleaned };
}

function parseDirection(value: string): CallDirection | null {
  const key = value.trim().toLowerCase();
  if (key === 'missed' || key === 'miss' || key === 'rejected' || key === 'declined') {
    return 'missed';
  }
  if (key === 'outgoing' || key === 'out' || key === 'placed' || key === 'dialed') {
    return 'outgoing';
  }
  if (key === 'incoming' || key === 'in' || key === 'received') return 'incoming';
  return null;
}

function parseSimStrict(value: string): { valid: boolean; value: SimSlot } {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true, value: null };
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === '-' || lower === 'none' || lower === 'unknown' || lower === '—') {
    return { valid: true, value: null };
  }
  const compact = lower.replace(/\s+/g, '');
  if (
    compact === '1' ||
    compact === 'sim1' ||
    compact === 'slot1' ||
    /^sim\s*1(?:\b|\s*\()/.test(lower) ||
    /^sim1\(/.test(compact) ||
    /^slot\s*1\b/.test(lower)
  ) {
    return { valid: true, value: 'SIM 1' };
  }
  if (
    compact === '2' ||
    compact === 'sim2' ||
    compact === 'slot2' ||
    /^sim\s*2(?:\b|\s*\()/.test(lower) ||
    /^sim2\(/.test(compact) ||
    /^slot\s*2\b/.test(lower)
  ) {
    return { valid: true, value: 'SIM 2' };
  }
  return { valid: false, value: null };
}

function parseTimestampStrict(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let ms: number;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 1e14) return null;
    ms = Math.round(numeric < 1e12 ? numeric * 1000 : numeric);
  } else {
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) return null;
    ms = Math.round(parsed);
  }
  const maxAllowed = Date.now() + 365 * 86_400_000;
  if (ms < MIN_VALID_TIMESTAMP_MS || ms > maxAllowed) return null;
  return ms;
}

function parseDurationStrict(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.includes(':')) {
    const rawParts = trimmed.split(':');
    if (rawParts.length < 2 || rawParts.length > 3) return null;
    const parts = rawParts.map((part) => Number(part.trim()));
    if (parts.some((part) => !Number.isFinite(part) || !Number.isInteger(part) || part < 0)) {
      return null;
    }
    for (let i = 1; i < parts.length; i += 1) {
      if (parts[i] >= 60) return null;
    }
    const total = parts.reduce((acc, part) => acc * 60 + part, 0);
    return total >= 0 && total <= MAX_DURATION_SECONDS ? total : null;
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const rounded = Math.round(seconds);
  return rounded <= MAX_DURATION_SECONDS ? rounded : null;
}

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function buildCallDedupKey(call: {
  number: string;
  timestamp: number;
  duration: number;
}): string {
  const norm = normaliseEthPhone(call.number).toLowerCase() || call.number.trim().toLowerCase();
  const ts = Math.round(Number(call.timestamp) || 0);
  const dur = Math.max(0, Math.round(Number(call.duration) || 0));
  return `${norm}|${ts}|${dur}`;
}

export function makeCallId(call: {
  number: string;
  timestamp: number;
  direction?: CallDirection;
  duration: number;
}): string {
  const raw = buildCallDedupKey(call);
  return `c${fnv1a(raw, 0x811c9dc5).toString(16)}${fnv1a(raw, 0x9e3779b9).toString(16)}`;
}

/**
 * Merges incoming call fields onto an existing call without overwriting
 * existing local `tag`, `note`, `name`, or `sim` unless the local field is empty.
 */
export function mergeCallWithoutOverwrite(
  existing: CallRecord,
  incoming: Pick<CallRecord, 'tag' | 'note' | 'name' | 'sim'>,
): { merged: CallRecord; changed: boolean } {
  const nextTag = existing.tag?.trim() ? existing.tag : incoming.tag?.trim() || null;
  const nextNote = existing.note?.trim() ? existing.note : incoming.note?.trim() || null;
  const nextName = existing.name?.trim() ? existing.name : incoming.name?.trim() || null;
  const nextSim = existing.sim ?? incoming.sim ?? null;

  const changed =
    nextTag !== existing.tag ||
    nextNote !== existing.note ||
    nextName !== existing.name ||
    nextSim !== existing.sim;

  if (!changed) {
    return { merged: existing, changed: false };
  }

  return {
    merged: {
      ...existing,
      tag: nextTag,
      note: nextNote,
      name: nextName,
      sim: nextSim,
    },
    changed: true,
  };
}

type Table = { header: string[]; rows: string[][] };

function tableFromCallArray(list: unknown[]): Table | null {
  const objects = list.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  );
  if (objects.length === 0) {
    return { header: ['number', 'timestamp', 'direction', 'duration'], rows: [] };
  }
  const IGNORED_KEYS = new Set(['id', 'owner', 'owneruid', 'uid', 'syncedat']);
  const header: string[] = [];
  objects.forEach((entry) => {
    Object.keys(entry).forEach((key) => {
      if (IGNORED_KEYS.has(key.toLowerCase())) return;
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

function evaluateTable(table: Table): ImportResult {
  const columns = mapColumns(table.header);
  if (columns.number === undefined) {
    return {
      calls: [],
      invalid: table.rows.length,
      problems: ['No phone number column found — expected "number", "phone" or similar.'],
    };
  }
  if (columns.direction === undefined) {
    return {
      calls: [],
      invalid: table.rows.length,
      problems: ['No direction/type column found — expected "direction" or "type".'],
    };
  }
  if (columns.timestamp === undefined) {
    return {
      calls: [],
      invalid: table.rows.length,
      problems: ['No timestamp/date column found — expected "timestamp" or "date".'],
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
    const lineNum = rowIndex + 2;
    const phoneCheck = validatePhoneNumber(read(row, 'number'));
    if (!phoneCheck.valid) {
      invalid += 1;
      if (problems.length < MAX_PROBLEMS) {
        problems.push(`Row ${lineNum}: ${phoneCheck.reason}.`);
      }
      return;
    }

    const timestamp = parseTimestampStrict(read(row, 'timestamp'));
    if (timestamp === null) {
      invalid += 1;
      if (problems.length < MAX_PROBLEMS) {
        problems.push(`Row ${lineNum}: invalid timestamp "${read(row, 'timestamp')}".`);
      }
      return;
    }

    const duration = parseDurationStrict(read(row, 'duration'));
    if (duration === null) {
      invalid += 1;
      if (problems.length < MAX_PROBLEMS) {
        problems.push(`Row ${lineNum}: invalid duration "${read(row, 'duration')}".`);
      }
      return;
    }

    const directionValue = read(row, 'direction');
    const direction = parseDirection(directionValue);
    if (!direction) {
      invalid += 1;
      if (problems.length < MAX_PROBLEMS) {
        problems.push(
          `Row ${lineNum}: invalid direction "${directionValue || 'empty'}" (expected incoming, outgoing, or missed).`,
        );
      }
      return;
    }

    const simCheck = parseSimStrict(read(row, 'sim'));
    if (!simCheck.valid) {
      invalid += 1;
      if (problems.length < MAX_PROBLEMS) {
        problems.push(`Row ${lineNum}: invalid SIM "${read(row, 'sim')}" (expected SIM 1, SIM 2, or blank).`);
      }
      return;
    }

    const name = read(row, 'name') || null;
    const note = read(row, 'note') || null;
    const tag = read(row, 'tag') || null;

    calls.push({
      id: makeCallId({ number: phoneCheck.value, timestamp, direction, duration }),
      number: phoneCheck.value,
      name,
      direction,
      sim: simCheck.value,
      timestamp,
      duration,
      note,
      tag,
    });
  });

  if (problems.length > 0 && invalid > problems.length) {
    problems.push(`...and ${invalid - problems.length} more invalid row${invalid - problems.length === 1 ? '' : 's'}.`);
  }

  return { calls, invalid, problems };
}

function sanitiseImportedContacts(raw: unknown): ContactProfile[] {
  const entries: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw as Record<string, unknown>)
      : [];

  const out: ContactProfile[] = [];
  entries.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const obj = item as Record<string, unknown>;
    const numRaw = typeof obj.number === 'string' ? obj.number.trim() : '';
    const phoneCheck = validatePhoneNumber(numRaw);
    if (!phoneCheck.valid) return;
    const key = getContactKey(phoneCheck.value);
    const name =
      typeof obj.name === 'string' && obj.name.trim()
        ? obj.name.trim().slice(0, 120)
        : phoneCheck.value;
    const tag = typeof obj.tag === 'string' ? obj.tag.trim().slice(0, 48) : '';
    const notes = typeof obj.notes === 'string' ? obj.notes.trim().slice(0, 1000) : '';

    let birthday: ContactProfile['birthday'] = null;
    if (obj.birthday && typeof obj.birthday === 'object') {
      const b = obj.birthday as Record<string, unknown>;
      const month = Number(b.month);
      const day = Number(b.day);
      const year = typeof b.year === 'number' && Number.isFinite(b.year) ? Math.round(b.year) : undefined;
      if (
        Number.isInteger(month) &&
        month >= 1 &&
        month <= 13 &&
        Number.isInteger(day) &&
        day >= 1 &&
        day <= 31
      ) {
        birthday = {
          month,
          day,
          calendar: b.calendar === 'ethiopian' ? 'ethiopian' : 'gregorian',
          ...(year !== undefined ? { year } : {}),
        };
      }
    }

    const events: ContactProfile['events'] = [];
    if (Array.isArray(obj.events)) {
      obj.events.slice(0, 25).forEach((evtRaw, idx) => {
        if (!evtRaw || typeof evtRaw !== 'object') return;
        const e = evtRaw as Record<string, unknown>;
        const month = Number(e.month);
        const day = Number(e.day);
        if (
          !Number.isInteger(month) ||
          month < 1 ||
          month > 13 ||
          !Number.isInteger(day) ||
          day < 1 ||
          day > 31
        ) {
          return;
        }
        const year = typeof e.year === 'number' && Number.isFinite(e.year) ? Math.round(e.year) : undefined;
        events.push({
          id: typeof e.id === 'string' && e.id.trim() ? e.id.trim().slice(0, 80) : `evt-${idx}-${Date.now()}`,
          title: typeof e.title === 'string' && e.title.trim() ? e.title.trim().slice(0, 100) : 'Event',
          month,
          day,
          calendar: e.calendar === 'ethiopian' ? 'ethiopian' : 'gregorian',
          ...(year !== undefined ? { year } : {}),
        });
      });
    }

    out.push({
      key,
      number: phoneCheck.value,
      name,
      tag,
      birthday,
      events,
      notes,
      updatedAt:
        typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) && obj.updatedAt > 0
          ? Math.round(obj.updatedAt)
          : Date.now(),
    });
  });

  return out;
}

function sanitiseImportedScheduledCalls(raw: unknown): ScheduledCall[] {
  if (!Array.isArray(raw)) return [];
  const out: ScheduledCall[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const obj = item as Record<string, unknown>;
    const numRaw = typeof obj.number === 'string' ? obj.number.trim() : '';
    const phoneCheck = validatePhoneNumber(numRaw);
    if (!phoneCheck.valid) return;
    const scheduledFor = Number(obj.scheduledFor);
    if (!Number.isFinite(scheduledFor) || scheduledFor < MIN_VALID_TIMESTAMP_MS) return;

    const statusRaw = typeof obj.status === 'string' ? obj.status : 'pending';
    const status: ScheduledCallStatus =
      statusRaw === 'completed' || statusRaw === 'dismissed' ? statusRaw : 'pending';

    out.push({
      id: `sched-${Math.round(scheduledFor)}-${index}-${fnv1a(phoneCheck.value, 0x811c9dc5).toString(16)}`,
      number: phoneCheck.value,
      name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 120) : null,
      scheduledFor: Math.round(scheduledFor),
      note: typeof obj.note === 'string' && obj.note.trim() ? obj.note.trim().slice(0, 500) : null,
      sourceCallId:
        typeof obj.sourceCallId === 'string' && obj.sourceCallId.trim()
          ? obj.sourceCallId.trim().slice(0, 128)
          : null,
      status,
      notifiedAt:
        typeof obj.notifiedAt === 'number' && Number.isFinite(obj.notifiedAt) && obj.notifiedAt > 0
          ? Math.round(obj.notifiedAt)
          : null,
      createdAt:
        typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) && obj.createdAt > 0
          ? Math.round(obj.createdAt)
          : Date.now(),
    });
  });
  return out;
}

function sanitiseImportedSettings(raw: unknown): BackupSettingsSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const snapshot: BackupSettingsSnapshot = {};
  let hasAny = false;

  if (obj.tariffs && typeof obj.tariffs === 'object') {
    const t = obj.tariffs as Record<string, unknown>;
    const sim1 = Number(t.sim1RatePerMin);
    const sim2 = Number(t.sim2RatePerMin);
    const budget = Number(t.monthlyBudgetEtb);
    if (Number.isFinite(sim1) || Number.isFinite(sim2) || Number.isFinite(budget)) {
      snapshot.tariffs = {
        sim1RatePerMin: Math.max(0, Math.min(1000, Number.isFinite(sim1) ? sim1 : 0.5)),
        sim2RatePerMin: Math.max(0, Math.min(1000, Number.isFinite(sim2) ? sim2 : 0.55)),
        billingMode: t.billingMode === 'per-minute' ? 'per-minute' : 'per-second',
        monthlyBudgetEtb: Math.max(0, Math.min(1_000_000, Number.isFinite(budget) ? budget : 500)),
      };
      hasAny = true;
    }
  }

  if (obj.simLabels && typeof obj.simLabels === 'object') {
    const s = obj.simLabels as Record<string, unknown>;
    snapshot.simLabels = {
      sim1Label: typeof s.sim1Label === 'string' && s.sim1Label.trim() ? s.sim1Label.trim().slice(0, 40) : 'ETC',
      sim2Label: typeof s.sim2Label === 'string' && s.sim2Label.trim() ? s.sim2Label.trim().slice(0, 40) : 'SFC',
    };
    hasAny = true;
  }

  if (obj.calendarPrefs && typeof obj.calendarPrefs === 'object') {
    const c = obj.calendarPrefs as Record<string, unknown>;
    snapshot.calendarPrefs = {
      defaultLang: c.defaultLang === 'amharic' ? 'amharic' : 'english',
      defaultGeezNumerals: Boolean(c.defaultGeezNumerals),
      dateDisplay: c.dateDisplay === 'both' ? 'both' : 'ec-first',
    };
    hasAny = true;
  }

  if (obj.reminderPrefs && typeof obj.reminderPrefs === 'object') {
    const r = obj.reminderPrefs as Record<string, unknown>;
    const callbackDelay = Number(r.callbackDelayMinutes);
    const eventLead = Number(r.eventLeadDays);
    const quietDays = Number(r.quietContactDays);
    const quietStart = Number(r.quietStartHour);
    const quietEnd = Number(r.quietEndHour);
    snapshot.reminderPrefs = {
      callbackDelayMinutes: Math.max(5, Math.min(1440, Number.isFinite(callbackDelay) ? Math.round(callbackDelay) : 15)),
      missedCallReminderEnabled:
        typeof r.missedCallReminderEnabled === 'boolean' ? r.missedCallReminderEnabled : true,
      missedCallReminderDelayMinutes: Number(r.missedCallReminderDelayMinutes) === 10 ? 10 : 5,
      eventLeadDays: Math.max(0, Math.min(60, Number.isFinite(eventLead) ? Math.round(eventLead) : 7)),
      quietContactDays: Math.max(3, Math.min(180, Number.isFinite(quietDays) ? Math.round(quietDays) : 30)),
      quietHoursEnabled: Boolean(r.quietHoursEnabled),
      quietStartHour: Math.max(0, Math.min(23, Number.isFinite(quietStart) ? Math.round(quietStart) : 22)),
      quietEndHour: Math.max(0, Math.min(23, Number.isFinite(quietEnd) ? Math.round(quietEnd) : 7)),
    };
    hasAny = true;
  }

  if (obj.voiceBundles && typeof obj.voiceBundles === 'object') {
    const vb = obj.voiceBundles as Record<string, unknown>;
    const parseSlot = (slotRaw: unknown) => {
      const s = slotRaw && typeof slotRaw === 'object' ? (slotRaw as Record<string, unknown>) : {};
      return {
        enabled: Boolean(s.enabled),
        name: typeof s.name === 'string' ? s.name.trim().slice(0, 60) : '',
        totalMinutes: Math.max(0, Math.min(100_000, Number(s.totalMinutes) || 0)),
        priceEtb: Math.max(0, Math.min(1_000_000, Number(s.priceEtb) || 0)),
        startedAt: Math.max(0, Math.round(Number(s.startedAt) || 0)),
        expiresAt: Math.max(0, Math.round(Number(s.expiresAt) || 0)),
      };
    };
    snapshot.voiceBundles = {
      sim1: parseSlot(vb.sim1),
      sim2: parseSlot(vb.sim2),
    };
    hasAny = true;
  }

  if (typeof obj.notificationsEnabled === 'boolean') {
    snapshot.notificationsEnabled = obj.notificationsEnabled;
    hasAny = true;
  }
  if (typeof obj.privacyMode === 'boolean') {
    snapshot.privacyMode = obj.privacyMode;
    hasAny = true;
  }
  if (
    obj.themePreference === 'system' ||
    obj.themePreference === 'light' ||
    obj.themePreference === 'dark-gray'
  ) {
    snapshot.themePreference = obj.themePreference;
    hasAny = true;
  } else if (obj.theme === 'light' || obj.theme === 'dark-gray') {
    snapshot.themePreference = obj.theme;
    hasAny = true;
  }
  if (
    obj.fontSizeScale === 'default' ||
    obj.fontSizeScale === 'large' ||
    obj.fontSizeScale === 'xlarge'
  ) {
    snapshot.fontSizeScale = obj.fontSizeScale;
    hasAny = true;
  }
  if (typeof obj.profileName === 'string' && obj.profileName.trim()) {
    snapshot.profileName = obj.profileName.trim().slice(0, 120);
    hasAny = true;
  }

  return hasAny ? snapshot : null;
}

function sanitiseImportedStreaks(raw: unknown): StreakRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const current = Math.max(0, Math.round(Number(obj.currentStreak) || 0));
  const longest = Math.max(current, Math.round(Number(obj.longestStreak) || 0));
  const lastActiveDate =
    typeof obj.lastActiveDate === 'string' && obj.lastActiveDate.trim()
      ? obj.lastActiveDate.trim().slice(0, 32)
      : null;
  const totalActiveDays =
    typeof obj.totalActiveDays === 'number' && Number.isFinite(obj.totalActiveDays)
      ? Math.max(0, Math.round(obj.totalActiveDays))
      : undefined;
  return {
    currentStreak: current,
    longestStreak: longest,
    lastActiveDate,
    ...(totalActiveDays !== undefined ? { totalActiveDays } : {}),
  };
}

function sanitiseImportedBadges(raw: unknown): BadgeRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: BadgeRecord[] = [];
  raw.forEach((item) => {
    if (typeof item === 'string' && item.trim()) {
      out.push({ id: item.trim().slice(0, 64), unlockedAt: Date.now() });
      return;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id.trim().slice(0, 64) : '';
    if (!id) return;
    out.push({
      id,
      ...(typeof obj.title === 'string' && obj.title.trim()
        ? { title: obj.title.trim().slice(0, 80) }
        : {}),
      ...(typeof obj.description === 'string' && obj.description.trim()
        ? { description: obj.description.trim().slice(0, 200) }
        : {}),
      unlockedAt:
        typeof obj.unlockedAt === 'number' && Number.isFinite(obj.unlockedAt) && obj.unlockedAt > 0
          ? Math.round(obj.unlockedAt)
          : Date.now(),
    });
  });
  return out;
}

function sanitiseImportedPointsHistory(raw: unknown): PointsHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const validReasons = new Set<PointsReason>([
    'daily_open',
    'quick_callback',
    'call_tag_or_note',
    'streak_bonus',
    'contact_milestone',
  ]);
  const byId = new Map<string, PointsHistoryEntry>();

  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const obj = item as Record<string, unknown>;
    const id =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim().slice(0, 128)
        : `imported-pts-${index}`;
    const rawReason = typeof obj.reason === 'string' ? obj.reason.trim() : '';
    const reason: PointsReason = validReasons.has(rawReason as PointsReason)
      ? (rawReason as PointsReason)
      : 'daily_open';
    const points = Math.max(0, Math.min(1000, Math.round(Number(obj.points) || 0)));
    if (points <= 0) return;
    const timestamp =
      typeof obj.timestamp === 'number' && Number.isFinite(obj.timestamp) && obj.timestamp > 0
        ? Math.round(obj.timestamp)
        : Date.now();
    const eatDate =
      typeof obj.eatDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.eatDate.trim())
        ? obj.eatDate.trim()
        : toEatDateString(timestamp);
    const label =
      typeof obj.label === 'string' && obj.label.trim()
        ? obj.label.trim().slice(0, 120)
        : 'Points activity';
    const meta =
      typeof obj.meta === 'string' && obj.meta.trim() ? obj.meta.trim().slice(0, 128) : undefined;

    if (!byId.has(id)) {
      byId.set(id, {
        id,
        reason,
        points,
        label,
        timestamp,
        eatDate,
        ...(meta !== undefined ? { meta } : {}),
      });
    }
  });

  return Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
}

function sanitiseImportedContactMilestones(raw: unknown): ContactMilestoneRecord[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, ContactMilestoneRecord>();

  raw.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const obj = item as Record<string, unknown>;
    const rawContactKey = typeof obj.contactKey === 'string' ? obj.contactKey.trim() : '';
    if (!rawContactKey || rawContactKey.includes('*')) return;
    const contactKey = getContactKey(rawContactKey) || rawContactKey.slice(0, 64);
    const days = Math.round(Number(obj.days) || 0);
    if (!Number.isFinite(days) || days < 1 || days > 3650) return;
    const streakStartDate =
      typeof obj.streakStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.streakStartDate.trim())
        ? obj.streakStartDate.trim()
        : '';
    const reachedDate =
      typeof obj.reachedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.reachedDate.trim())
        ? obj.reachedDate.trim()
        : streakStartDate || toEatDateString();
    const startKey = streakStartDate || reachedDate;
    const id =
      typeof obj.id === 'string' && obj.id.trim() && !obj.id.includes('*')
        ? obj.id.trim().slice(0, 128)
        : `${contactKey}:${days}:${startKey}`;
    const badgeId =
      typeof obj.badgeId === 'string' && obj.badgeId.trim()
        ? obj.badgeId.trim().slice(0, 64)
        : `contact_${days}d`;
    const badgeTitle =
      typeof obj.badgeTitle === 'string' && obj.badgeTitle.trim()
        ? obj.badgeTitle.trim().slice(0, 80)
        : `${days}-Day Milestone`;
    const points = Math.max(0, Math.min(10_000, Math.round(Number(obj.points) || 0)));
    const awardedAt =
      typeof obj.awardedAt === 'number' && Number.isFinite(obj.awardedAt) && obj.awardedAt > 0
        ? Math.round(obj.awardedAt)
        : Date.now();
    const celebratedAt =
      typeof obj.celebratedAt === 'number' && Number.isFinite(obj.celebratedAt) && obj.celebratedAt > 0
        ? Math.round(obj.celebratedAt)
        : null;

    if (!byId.has(id)) {
      byId.set(id, {
        id,
        contactKey,
        days,
        streakStartDate: startKey,
        reachedDate,
        badgeId,
        badgeTitle,
        points,
        awardedAt,
        celebratedAt,
      });
    }
  });

  return Array.from(byId.values()).sort((a, b) => b.awardedAt - a.awardedAt || b.days - a.days);
}

function sanitiseStringArray(raw: unknown, maxItems = 500): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim().slice(0, 128)),
    ),
  ).slice(0, maxItems);
}

export function parseBackupImport(text: string, filename = ''): ParsedImportPackage {
  const source = text.replace(/^\uFEFF/, '').trim();
  const emptyPkg = (formatLabel: string, problems: string[]): ParsedImportPackage => ({
    formatLabel,
    isBackup: false,
    schemaVersion: null,
    exportedAt: null,
    calls: [],
    invalid: 0,
    problems,
    tags: [],
    contacts: [],
    settings: null,
    streaks: null,
    pointsHistory: [],
    importedScore: null,
    badges: [],
    contactMilestones: [],
    scheduledCalls: [],
    favorites: [],
    dismissedMissedIds: [],
    mutedAlertKeys: [],
  });

  if (!source) {
    return emptyPkg('Empty file', ['That file is empty.']);
  }

  const lowerName = filename.toLowerCase();
  const looksJson =
    lowerName.endsWith('.json') || source.startsWith('[') || source.startsWith('{');

  if (looksJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch {
      return emptyPkg('JSON', ['Could not read that JSON file.']);
    }

    // Legacy v0: bare array of calls
    if (Array.isArray(parsed)) {
      const table = tableFromCallArray(parsed);
      if (!table) {
        return emptyPkg('JSON (Legacy Array)', ['No valid call objects found in JSON array.']);
      }
      const res = evaluateTable(table);
      return {
        ...emptyPkg('JSON (Legacy Array)', res.problems),
        schemaVersion: 0,
        calls: res.calls,
        invalid: res.invalid,
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return emptyPkg('JSON', ['Unsupported JSON root structure.']);
    }

    const obj = parsed as Record<string, unknown>;
    const rawVersion =
      typeof obj.schemaVersion === 'number' && Number.isFinite(obj.schemaVersion)
        ? Math.round(obj.schemaVersion)
        : Array.isArray(obj.calls)
          ? 1
          : null;

    const hasBackupSections =
      obj.schemaVersion !== undefined ||
      obj.contacts !== undefined ||
      obj.tags !== undefined ||
      obj.settings !== undefined ||
      obj.streaks !== undefined ||
      obj.badges !== undefined ||
      obj.contactMilestones !== undefined ||
      obj.pointsHistory !== undefined ||
      obj.score !== undefined ||
      obj.scheduledCalls !== undefined;

    let callsResult: ImportResult = { calls: [], invalid: 0, problems: [] };
    if (Array.isArray(obj.calls)) {
      if (obj.calls.length > 0) {
        const table = tableFromCallArray(obj.calls);
        if (!table) {
          callsResult = {
            calls: [],
            invalid: obj.calls.length,
            problems: ['Could not read the calls array inside this JSON file.'],
          };
        } else {
          callsResult = evaluateTable(table);
        }
      }
    } else if (!hasBackupSections) {
      return emptyPkg('JSON', ['JSON file does not contain a "calls" array or backup sections.']);
    }

    const tags = sanitiseStringArray(obj.tags, 200);
    const contacts = sanitiseImportedContacts(obj.contacts);
    const settings = sanitiseImportedSettings(obj.settings);
    const streaks = sanitiseImportedStreaks(obj.streaks);
    const pointsHistory = sanitiseImportedPointsHistory(obj.pointsHistory);
    const importedScore =
      typeof obj.score === 'number' && Number.isFinite(obj.score)
        ? Math.max(0, Math.round(obj.score))
        : null;
    const badges = sanitiseImportedBadges(obj.badges);
    const contactMilestones = sanitiseImportedContactMilestones(obj.contactMilestones);
    const scheduledCalls = sanitiseImportedScheduledCalls(obj.scheduledCalls);
    const favorites = sanitiseStringArray(obj.favorites, 200);
    const dismissedMissedIds = sanitiseStringArray(obj.dismissedMissedIds, 500);
    const mutedAlertKeys = sanitiseStringArray(obj.mutedAlertKeys, 200);

    const formatLabel =
      rawVersion !== null && rawVersion >= 2
        ? `Versioned Backup (v${rawVersion})`
        : hasBackupSections
          ? `Backup (v${rawVersion ?? 1})`
          : 'JSON Export';

    return {
      formatLabel,
      isBackup: hasBackupSections,
      schemaVersion: rawVersion,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null,
      calls: callsResult.calls,
      invalid: callsResult.invalid,
      problems: callsResult.problems,
      tags,
      contacts,
      settings,
      streaks,
      pointsHistory,
      importedScore,
      badges,
      contactMilestones,
      scheduledCalls,
      favorites,
      dismissedMissedIds,
      mutedAlertKeys,
    };
  }

  const delimiter = detectTextDelimiter(source);
  const rows = parseDelimitedText(source, delimiter);
  const extLabel = lowerName.endsWith('.txt')
    ? delimiter === '\t'
      ? 'TXT (Tab-separated)'
      : 'TXT'
    : 'CSV';

  if (rows.length < 2) {
    return emptyPkg(extLabel, [`That ${extLabel} file has no data rows below its header.`]);
  }

  const res = evaluateTable({ header: rows[0], rows: rows.slice(1) });
  return {
    ...emptyPkg(extLabel, res.problems),
    calls: res.calls,
    invalid: res.invalid,
  };
}

export function parseCallImport(text: string, filename = ''): ImportResult {
  const pkg = parseBackupImport(text, filename);
  return {
    calls: pkg.calls,
    invalid: pkg.invalid,
    problems: pkg.problems,
  };
}

export function buildImportPreview(
  filename: string,
  pkg: ParsedImportPackage,
  current: {
    calls: CallRecord[];
    contacts: Record<string, ContactProfile>;
    availableTags: string[];
    scheduledCalls: ScheduledCall[];
  },
): ImportPreviewSummary {
  const existingById = new Map<string, CallRecord>();
  const existingByDedupKey = new Map<string, CallRecord>();
  current.calls.forEach((c) => {
    existingById.set(c.id, c);
    existingByDedupKey.set(buildCallDedupKey(c), c);
  });

  const seenInFile = new Map<string, CallRecord>();
  let newCallsCount = 0;
  let duplicateCallsCount = 0;
  let mergeUpdatesCount = 0;

  pkg.calls.forEach((rec) => {
    const dKey = buildCallDedupKey(rec);
    const localMatch = existingById.get(rec.id) ?? existingByDedupKey.get(dKey);
    if (localMatch) {
      duplicateCallsCount += 1;
      if (mergeCallWithoutOverwrite(localMatch, rec).changed) {
        mergeUpdatesCount += 1;
      }
      return;
    }
    if (seenInFile.has(dKey)) {
      duplicateCallsCount += 1;
      return;
    }
    seenInFile.set(dKey, rec);
    newCallsCount += 1;
  });

  const currentTagSet = new Set(current.availableTags.map((t) => t.trim().toLowerCase()));
  const newTagsCount = pkg.tags.filter((t) => !currentTagSet.has(t.trim().toLowerCase())).length;

  let newContactsCount = 0;
  let updatedContactsCount = 0;
  pkg.contacts.forEach((c) => {
    if (current.contacts[c.key]) {
      updatedContactsCount += 1;
    } else {
      newContactsCount += 1;
    }
  });

  const existingSchedKeys = new Set(
    current.scheduledCalls.map((s) => `${getContactKey(s.number)}|${Math.round(s.scheduledFor)}`),
  );
  const newScheduledCount = pkg.scheduledCalls.filter(
    (s) => !existingSchedKeys.has(`${getContactKey(s.number)}|${Math.round(s.scheduledFor)}`),
  ).length;

  const hasSettings = Boolean(pkg.settings);
  const hasStreaks = Boolean(pkg.streaks);
  const hasBadges = pkg.badges.length > 0;
  const hasContactMilestones = pkg.contactMilestones.length > 0;
  const contactMilestonesCount = pkg.contactMilestones.length;
  const computedHistoryScore = computeScoreFromHistory(pkg.pointsHistory);
  const scorePreviewValue =
    pkg.pointsHistory.length > 0 ? computedHistoryScore : pkg.importedScore;
  const hasScore = scorePreviewValue !== null && scorePreviewValue > 0;

  const hasRestorableContent =
    newCallsCount > 0 ||
    mergeUpdatesCount > 0 ||
    newTagsCount > 0 ||
    pkg.contacts.length > 0 ||
    newScheduledCount > 0 ||
    hasSettings ||
    hasStreaks ||
    hasBadges ||
    hasContactMilestones ||
    hasScore;

  return {
    filename,
    formatLabel: pkg.formatLabel,
    isBackup: pkg.isBackup,
    schemaVersion: pkg.schemaVersion,
    newerSchemaWarning:
      pkg.schemaVersion !== null && pkg.schemaVersion > CURRENT_BACKUP_SCHEMA_VERSION,
    newCallsCount,
    duplicateCallsCount,
    mergeUpdatesCount,
    invalidCount: pkg.invalid,
    problems: pkg.problems,
    totalRowsEvaluated: pkg.calls.length + pkg.invalid,
    newTagsCount,
    contactsCount: pkg.contacts.length,
    newContactsCount,
    updatedContactsCount,
    scheduledCallsCount: pkg.scheduledCalls.length,
    newScheduledCount,
    hasSettings,
    hasStreaks,
    hasBadges,
    hasContactMilestones,
    contactMilestonesCount,
    hasScore,
    scorePreviewValue,
    hasRestorableContent,
  };
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
