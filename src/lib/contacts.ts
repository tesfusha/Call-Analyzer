import { normaliseEthPhone } from '@/src/lib/ethiopia';
import { toEthiopianDate, toGregorianJsDate } from '@/src/lib/ethiopianCalendar';
import { contactStats } from '@/src/lib/stats';
import type {
  CalendarKind,
  CallRecord,
  ContactBirthday,
  ContactEvent,
  ContactProfile,
  ScheduledCall,
} from '@/src/types/call';

export const DEFAULT_RELATIONSHIP_TAGS = ['Family', 'Friends', 'Coworkers'] as const;

/**
 * Formats a contact/call tag into a compact label for dense call log rows
 * (e.g. "Graphics Designer" -> "Graphics") while keeping short tags intact.
 */
export function formatShortTag(tag: string): string {
  const clean = tag.trim();
  if (!clean) return '';
  if (clean.length <= 12) return clean;
  const firstWord = clean.split(/\s+/)[0] ?? clean;
  if (firstWord.length >= 3 && firstWord.length <= 12) {
    return firstWord;
  }
  return `${clean.slice(0, 11).trimEnd()}…`;
}

export function mergeTagOptions(...sources: Array<Iterable<string | null | undefined>>): string[] {
  const seen = new Map<string, string>();
  for (const src of sources) {
    for (const raw of src) {
      const clean = typeof raw === 'string' ? raw.trim() : '';
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, clean);
      }
    }
  }
  return [...seen.values()];
}

const MS_PER_DAY = 86_400_000;

export function getContactKey(number: string): string {
  const norm = normaliseEthPhone(number);
  return norm || number.trim();
}

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function daysUntilAnnualDate(
  month: number,
  day: number,
  calendar: CalendarKind,
  now: Date = new Date(),
): number {
  const todayStart = startOfDayMs(now);

  if (calendar === 'ethiopian') {
    const currentEc = toEthiopianDate(now);
    for (const yearOffset of [0, 1]) {
      const targetYear = currentEc.year + yearOffset;
      const safeDay = month === 13 ? Math.min(day, targetYear % 4 === 3 ? 6 : 5) : Math.min(day, 30);
      try {
        const gcDate = toGregorianJsDate(targetYear, month, safeDay);
        const diff = Math.round((startOfDayMs(gcDate) - todayStart) / MS_PER_DAY);
        if (diff >= 0) return diff;
      } catch {
        // try next year
      }
    }
    return 365;
  }

  const currentYear = now.getFullYear();
  for (const yearOffset of [0, 1]) {
    const targetYear = currentYear + yearOffset;
    const maxDaysInMonth = new Date(targetYear, month, 0).getDate();
    const safeDay = Math.min(day, maxDaysInMonth);
    const candidate = new Date(targetYear, month - 1, safeDay);
    const diff = Math.round((startOfDayMs(candidate) - todayStart) / MS_PER_DAY);
    if (diff >= 0) return diff;
  }
  return 365;
}

export type UpcomingContactEvent = {
  id: string;
  contactKey: string;
  number: string;
  name: string;
  tag: string;
  title: string;
  kind: 'birthday' | 'event';
  month: number;
  day: number;
  calendar: CalendarKind;
  daysUntil: number;
  isToday: boolean;
};

export function getUpcomingContactEvents(
  profiles: Record<string, ContactProfile>,
  calls: CallRecord[],
  withinDays = 45,
  now: Date = new Date(),
): UpcomingContactEvent[] {
  const profilesWithDates = Object.values(profiles).filter(
    (p) => Boolean(p.birthday) || p.events.length > 0,
  );
  if (profilesWithDates.length === 0) return [];

  const statsByKey = new Map<string, { number: string; name: string }>();
  calls.forEach((c) => {
    const key = getContactKey(c.number);
    const existing = statsByKey.get(key);
    if (!existing) {
      statsByKey.set(key, { number: c.number, name: c.name?.trim() || c.number });
    } else if (existing.name === existing.number && c.name?.trim()) {
      existing.name = c.name.trim();
    }
  });

  const upcoming: UpcomingContactEvent[] = [];

  profilesWithDates.forEach((profile) => {
    const fallback = statsByKey.get(profile.key);
    const name = profile.name.trim() || fallback?.name || profile.number;
    const number = profile.number || fallback?.number || profile.key;
    const tag = profile.tag || '';

    if (profile.birthday) {
      const daysUntil = daysUntilAnnualDate(
        profile.birthday.month,
        profile.birthday.day,
        profile.birthday.calendar,
        now,
      );
      if (daysUntil <= withinDays) {
        upcoming.push({
          id: `${profile.key}-birthday`,
          contactKey: profile.key,
          number,
          name,
          tag,
          title: 'Birthday',
          kind: 'birthday',
          month: profile.birthday.month,
          day: profile.birthday.day,
          calendar: profile.birthday.calendar,
          daysUntil,
          isToday: daysUntil === 0,
        });
      }
    }

    profile.events.forEach((evt) => {
      const daysUntil = daysUntilAnnualDate(evt.month, evt.day, evt.calendar, now);
      if (daysUntil <= withinDays) {
        upcoming.push({
          id: `${profile.key}-${evt.id}`,
          contactKey: profile.key,
          number,
          name,
          tag,
          title: evt.title,
          kind: 'event',
          month: evt.month,
          day: evt.day,
          calendar: evt.calendar,
          daysUntil,
          isToday: daysUntil === 0,
        });
      }
    });
  });

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}

export type HighlightedCaller = {
  key: string;
  number: string;
  name: string;
  tag: string;
  count: number;
  duration: number;
  avgDuration: number;
  lastTimestamp: number;
  reason: 'frequent' | 'long-time' | 'both';
};

export function getFrequentAndLongCallers(
  calls: CallRecord[],
  profiles: Record<string, ContactProfile>,
): HighlightedCaller[] {
  const byKey = new Map<
    string,
    {
      key: string;
      number: string;
      name: string;
      count: number;
      duration: number;
      answered: number;
      lastTimestamp: number;
    }
  >();

  contactStats(calls).forEach((stat) => {
    const key = getContactKey(stat.number);
    const existing = byKey.get(key);
    const answered = stat.calls.filter((c) => c.duration > 0).length;
    if (!existing) {
      byKey.set(key, {
        key,
        number: stat.number,
        name: stat.name,
        count: stat.count,
        duration: stat.duration,
        answered,
        lastTimestamp: stat.lastTimestamp,
      });
    } else {
      existing.count += stat.count;
      existing.duration += stat.duration;
      existing.answered += answered;
      if (stat.lastTimestamp > existing.lastTimestamp) existing.lastTimestamp = stat.lastTimestamp;
      if (existing.name === existing.number && stat.name !== stat.number) {
        existing.name = stat.name;
      }
    }
  });

  const merged = [...byKey.values()].map((item) => {
    const profile = profiles[item.key];
    const tagFromCalls = calls.find(
      (c) => getContactKey(c.number) === item.key && c.tag?.trim(),
    )?.tag;
    return {
      key: item.key,
      number: profile?.number || item.number,
      name: profile?.name?.trim() || item.name,
      tag: profile?.tag || tagFromCalls || '',
      count: item.count,
      duration: item.duration,
      avgDuration: item.answered > 0 ? Math.round(item.duration / item.answered) : 0,
      lastTimestamp: item.lastTimestamp,
    };
  });

  return merged
    .filter((item) => item.count >= 2 || item.duration >= 300)
    .map((item) => {
      const isFrequent = item.count >= 3;
      const isLong = item.duration >= 450 || item.avgDuration >= 240;
      const reason: HighlightedCaller['reason'] =
        isFrequent && isLong ? 'both' : isFrequent ? 'frequent' : 'long-time';
      return { ...item, reason };
    })
    .sort((a, b) => b.count * 120 + b.duration - (a.count * 120 + a.duration));
}

function parseDateTuple(raw: string): ContactBirthday | null {
  const clean = raw.trim();
  if (!clean) return null;
  // Handle --MM-DD or --MMDD (vCard yearless birthday)
  const yearless = clean.match(/^--(\d{2})-?(\d{2})$/);
  if (yearless) {
    const month = Number(yearless[1]);
    const day = Number(yearless[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day, calendar: 'gregorian' };
    }
  }
  // Handle YYYY-MM-DD or YYYYMMDD
  const fullCompact = clean.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (fullCompact) {
    const year = Number(fullCompact[1]);
    const month = Number(fullCompact[2]);
    const day = Number(fullCompact[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day, calendar: 'gregorian' };
    }
  }
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
      calendar: 'gregorian',
    };
  }
  return null;
}

function normaliseRelationshipTag(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('family')) return 'Family';
  if (lower.includes('friend')) return 'Friends';
  if (lower.includes('coworker') || lower.includes('work') || lower.includes('colleague')) {
    return 'Coworkers';
  }
  return raw.split(/[,;]/)[0]?.trim() || '';
}

export async function readUploadedTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let text: string;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
  } else if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    text = new TextDecoder('utf-8').decode(bytes.subarray(3));
  } else if (bytes.length >= 4 && bytes.length % 2 === 0) {
    const sampleLen = Math.min(bytes.length, 128);
    let evenZeros = 0;
    let oddZeros = 0;
    for (let i = 0; i < sampleLen; i += 2) {
      if (bytes[i] === 0) evenZeros += 1;
      if (bytes[i + 1] === 0) oddZeros += 1;
    }
    const pairs = sampleLen / 2;
    if (oddZeros >= pairs * 0.4 && evenZeros === 0) {
      text = new TextDecoder('utf-16le').decode(bytes);
    } else if (evenZeros >= pairs * 0.4 && oddZeros === 0) {
      text = new TextDecoder('utf-16be').decode(bytes);
    } else {
      text = decodeUtf8OrFallback(bytes);
    }
  } else {
    text = decodeUtf8OrFallback(bytes);
  }

  return text.replace(/^\uFEFF/, '');
}

function decodeUtf8OrFallback(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}

const qpUtf8Encoder = new TextEncoder();

function findUnquotedColon(line: string): number {
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ':' && !inQuotes) {
      return i;
    }
  }
  return -1;
}

function isQuotedPrintableLine(line: string): boolean {
  const colonIdx = findUnquotedColon(line);
  if (colonIdx === -1) return false;
  const header = line.slice(0, colonIdx).toUpperCase();
  return /(?:^|;)[ \t]*(?:ENCODING=[ \t]*)?QUOTED-PRINTABLE[ \t]*(?:;|$)/.test(header);
}

function unfoldVCardLines(vcfText: string): string[] {
  const rawLines = vcfText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const logicalLines: string[] = [];
  let current = '';

  for (const rawLine of rawLines) {
    if (current) {
      if (isQuotedPrintableLine(current) && /=[ \t]*$/.test(current)) {
        // vCard 2.1 Quoted-Printable soft line break ("=\n")
        current = current.replace(/=[ \t]*$/, '') + rawLine;
        continue;
      }
      if (rawLine.startsWith(' ') || rawLine.startsWith('\t')) {
        // RFC 2426 / 6350 continuation line folding
        current += rawLine.slice(1);
        continue;
      }
      logicalLines.push(current);
    }
    current = rawLine;
  }

  if (current) {
    logicalLines.push(current);
  }

  return logicalLines;
}

function safeTextDecode(bytes: Uint8Array, charset: string): string {
  const normalized = charset.trim().toLowerCase() || 'utf-8';
  try {
    return new TextDecoder(normalized, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

function decodeQuotedPrintable(raw: string, charset: string): string {
  const isUtf8 = !charset || charset.toLowerCase().replace(/[^a-z0-9]/g, '') === 'utf8';
  const bytes: number[] = [];

  for (let i = 0; i < raw.length; ) {
    if (raw[i] === '=' && /^[0-9A-Fa-f]{2}/.test(raw.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(raw.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      const codePoint = raw.codePointAt(i) ?? raw.charCodeAt(i);
      const ch = String.fromCodePoint(codePoint);
      if (isUtf8) {
        const encoded = qpUtf8Encoder.encode(ch);
        for (const b of encoded) bytes.push(b);
      } else {
        bytes.push(codePoint & 0xff);
      }
      i += ch.length;
    }
  }

  return safeTextDecode(new Uint8Array(bytes), charset || 'utf-8');
}

export function decodeIfQuotedPrintableText(value: string): string {
  if (!value || !value.includes('=')) return value;
  const hasConsecutiveHex = /(?:=[0-9A-Fa-f]{2}){2,}/.test(value);
  const allHex = value.match(/=[0-9A-Fa-f]{2}/g);
  if (!hasConsecutiveHex && (!allHex || allHex.length < 3)) {
    return value;
  }

  const cleaned = value.replace(/=[ \t]*$/, '');
  const decoded = decodeQuotedPrintable(cleaned, 'utf-8');
  if (decoded && !decoded.includes('\uFFFD')) {
    return decoded;
  }

  // Handle strings that were previously truncated mid-UTF8-sequence on import
  const trimmedIncomplete = cleaned
    .replace(/(?:=[89ABab][0-9A-Fa-f])+$/, '')
    .replace(/=[C-Fc-f][0-9A-Fa-f]$/, '');
  if (trimmedIncomplete && trimmedIncomplete !== cleaned) {
    const recovered = decodeQuotedPrintable(trimmedIncomplete, 'utf-8');
    if (recovered && !recovered.includes('\uFFFD')) {
      return recovered.trim();
    }
  }

  const stripped = decoded.replace(/\uFFFD+/g, '').trim();
  return stripped || value;
}

function decodeBase64Text(raw: string, charset: string): string {
  try {
    const cleaned = raw.replace(/\s+/g, '');
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return safeTextDecode(bytes, charset || 'utf-8');
  } catch {
    return raw;
  }
}

function unescapeVCardValue(val: string, preserveNewlines = false): string {
  let out = '';
  for (let i = 0; i < val.length; i += 1) {
    if (val[i] === '\\' && i + 1 < val.length) {
      const next = val[i + 1];
      if (next === 'n' || next === 'N') {
        out += preserveNewlines ? '\n' : ' ';
        i += 1;
        continue;
      }
      if (next === ',' || next === ';' || next === ':' || next === '\\') {
        out += next;
        i += 1;
        continue;
      }
    }
    out += val[i];
  }
  return out;
}

function splitUnescapedSemicolons(val: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let i = 0; i < val.length; i += 1) {
    if (val[i] === '\\' && i + 1 < val.length) {
      current += val[i] + val[i + 1];
      i += 1;
      continue;
    }
    if (val[i] === ';') {
      parts.push(current);
      current = '';
    } else {
      current += val[i];
    }
  }
  parts.push(current);
  return parts;
}

export function parseVCardContacts(vcfText: string): ContactProfile[] {
  const lines = unfoldVCardLines(vcfText);
  const cards: string[][] = [];
  let currentCard: string[] | null = null;

  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === 'BEGIN:VCARD') {
      currentCard = [];
      continue;
    }
    if (upper === 'END:VCARD') {
      if (currentCard) cards.push(currentCard);
      currentCard = null;
      continue;
    }
    if (currentCard) {
      currentCard.push(line);
    }
  }
  if (currentCard && currentCard.length > 0) {
    cards.push(currentCard);
  }

  const profiles: ContactProfile[] = [];

  cards.forEach((cardLines) => {
    let fnName = '';
    let structuredName = '';
    const phones: string[] = [];
    let birthday: ContactBirthday | null = null;
    const events: ContactEvent[] = [];
    let tag = '';
    let notes = '';

    cardLines.forEach((line) => {
      const colonIdx = findUnquotedColon(line);
      if (colonIdx === -1) return;

      const rawHeader = line.slice(0, colonIdx);
      const rawValue = line.slice(colonIdx + 1);
      if (!rawValue.trim()) return;

      const headerParts = rawHeader.split(';');
      const propName = headerParts[0].replace(/^[^.]+\./, '').trim().toUpperCase();

      let encoding: '' | 'QP' | 'BASE64' = '';
      let charset = 'utf-8';

      for (const param of headerParts.slice(1)) {
        const cleanParam = param.trim();
        const eqIdx = cleanParam.indexOf('=');
        if (eqIdx === -1) {
          const bare = cleanParam.toUpperCase();
          if (bare === 'QUOTED-PRINTABLE') encoding = 'QP';
          else if (bare === 'B' || bare === 'BASE64') encoding = 'BASE64';
        } else {
          const pKey = cleanParam.slice(0, eqIdx).trim().toUpperCase();
          const pVal = cleanParam.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, '$1');
          if (pKey === 'ENCODING') {
            const upVal = pVal.toUpperCase();
            if (upVal === 'QUOTED-PRINTABLE') encoding = 'QP';
            else if (upVal === 'B' || upVal === 'BASE64') encoding = 'BASE64';
          } else if (pKey === 'CHARSET') {
            charset = pVal;
          }
        }
      }

      const decodeSegment = (seg: string): string => {
        if (encoding === 'QP') return decodeQuotedPrintable(seg, charset);
        if (encoding === 'BASE64') return decodeBase64Text(seg, charset);
        return decodeIfQuotedPrintableText(seg);
      };

      if (propName === 'FN') {
        const decoded = unescapeVCardValue(decodeSegment(rawValue)).trim();
        if (decoded) fnName = decoded;
      } else if (propName === 'N' && !structuredName) {
        const rawParts = splitUnescapedSemicolons(rawValue);
        const decodedParts = rawParts.map((part) =>
          unescapeVCardValue(decodeSegment(part)).trim(),
        );
        // N format: Family;Given;Additional;Prefix;Suffix
        const formatted = [
          decodedParts[3],
          decodedParts[1],
          decodedParts[2],
          decodedParts[0],
          decodedParts[4],
        ]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (formatted) structuredName = formatted;
      } else if (propName === 'TEL') {
        const cleanedTel = decodeSegment(rawValue).trim().replace(/^tel:/i, '').trim();
        if (cleanedTel) phones.push(cleanedTel);
      } else if (propName === 'BDAY') {
        birthday = parseDateTuple(decodeSegment(rawValue).trim());
      } else if (propName === 'ANNIVERSARY' || propName === 'X-ANNIVERSARY') {
        const parsed = parseDateTuple(decodeSegment(rawValue).trim());
        if (parsed) {
          events.push({
            id: `evt-${events.length + 1}`,
            title: 'Anniversary',
            month: parsed.month,
            day: parsed.day,
            year: parsed.year,
            calendar: 'gregorian',
          });
        }
      } else if (propName === 'CATEGORIES') {
        tag = normaliseRelationshipTag(unescapeVCardValue(decodeSegment(rawValue)));
      } else if (propName === 'NOTE') {
        notes = unescapeVCardValue(decodeSegment(rawValue), true).trim();
      }
    });

    const primaryPhone = phones[0];
    if (!primaryPhone) return;
    const key = getContactKey(primaryPhone);
    const resolvedName = fnName || structuredName || primaryPhone;

    profiles.push({
      key,
      number: primaryPhone,
      name: resolvedName,
      tag,
      birthday,
      events,
      notes,
      updatedAt: Date.now(),
    });
  });

  return profiles;
}

function parseCsvRows(source: string): string[][] {
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
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

export function parseCsvContacts(csvText: string): ContactProfile[] {
  const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (aliases: string[]) =>
    headers.findIndex((h) => aliases.some((alias) => h === alias || h.includes(alias)));

  const nameIdx = findCol(['name', 'fullname', 'displayname']);
  const firstIdx = findCol(['givenname', 'firstname']);
  const lastIdx = findCol(['familyname', 'lastname']);
  const phoneIdx = findCol(['phone1value', 'phone', 'mobile', 'number', 'phonenumber']);
  const bdayIdx = findCol(['birthday', 'bday', 'dob']);
  const tagIdx = findCol(['groupmembership', 'tag', 'category', 'relationship']);
  const noteIdx = findCol(['notes', 'note']);

  if (phoneIdx === -1) return [];

  const profiles: ContactProfile[] = [];
  rows.slice(1).forEach((row) => {
    const phone = row[phoneIdx]?.trim();
    if (!phone) return;
    const rawName = decodeIfQuotedPrintableText(
      (nameIdx >= 0 ? row[nameIdx] : '') ||
        [firstIdx >= 0 ? row[firstIdx] : '', lastIdx >= 0 ? row[lastIdx] : '']
          .filter(Boolean)
          .join(' '),
    );
    const birthday = bdayIdx >= 0 ? parseDateTuple(row[bdayIdx] ?? '') : null;
    const tag = tagIdx >= 0 ? normaliseRelationshipTag(decodeIfQuotedPrintableText(row[tagIdx] ?? '')) : '';
    const notes = noteIdx >= 0 ? decodeIfQuotedPrintableText(row[noteIdx] ?? '') : '';

    profiles.push({
      key: getContactKey(phone),
      number: phone,
      name: rawName.trim() || phone,
      tag,
      birthday,
      events: [],
      notes,
      updatedAt: Date.now(),
    });
  });

  return profiles;
}

type ContactPickerEntry = {
  name?: string[];
  tel?: string[];
};

type NavigatorContacts = {
  select: (
    properties: string[],
    options?: { multiple?: boolean },
  ) => Promise<ContactPickerEntry[]>;
  getProperties?: () => Promise<string[]>;
};

export function isContactPickerSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { contacts?: NavigatorContacts };
  return Boolean(nav.contacts && typeof nav.contacts.select === 'function');
}

export async function pickPhoneContacts(): Promise<{
  supported: boolean;
  contacts: ContactProfile[];
  error?: string;
}> {
  if (!isContactPickerSupported()) {
    return {
      supported: false,
      contacts: [],
      error:
        'Direct phone contact picker is supported on Android Chrome. Use .vcf or CSV import on this browser.',
    };
  }
  const nav = navigator as Navigator & { contacts: NavigatorContacts };
  try {
    const entries = await nav.contacts.select(['name', 'tel'], { multiple: true });
    const profiles: ContactProfile[] = [];
    entries.forEach((entry) => {
      const tel = entry.tel?.[0]?.trim();
      if (!tel) return;
      const name = entry.name?.[0]?.trim() || tel;
      profiles.push({
        key: getContactKey(tel),
        number: tel,
        name,
        tag: '',
        birthday: null,
        events: [],
        notes: 'Imported from phone contacts',
        updatedAt: Date.now(),
      });
    });
    return { supported: true, contacts: profiles };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Contact picker was cancelled.';
    return { supported: true, contacts: [], error: message };
  }
}

const LEGACY_SAMPLE_PROFILES: Record<string, string> = {
  '911248890': 'dawit bekele',
  '941505775': 'melek',
  '912904411': 'hanna girma',
  '945001872': 'abel tesfaye',
  '933801122': 'yonas alemu',
  '922310442': 'sara tadesse',
};

const LEGACY_ABELA_TEST_KEYS = new Set<string>(
  Array.from({ length: 20 }, (_, i) => `9117788${80 + i}`),
);

export const LEGACY_SAMPLE_FAVORITE_KEYS = new Set<string>([
  '911248890',
  '922310442',
]);

/** Identifies legacy sample contact profiles previously seeded by demo/test helpers. */
export function isLegacySampleContactProfile(profile: ContactProfile): boolean {
  const key = getContactKey(profile.key || profile.number);
  const name = (profile.name || '').trim().toLowerCase();
  if (!key) return false;
  const expected = LEGACY_SAMPLE_PROFILES[key];
  if (expected && name === expected) return true;
  if (LEGACY_ABELA_TEST_KEYS.has(key) && name === 'abela') return true;
  return false;
}

/** Identifies legacy sample calls previously seeded into signed-in accounts. */
export function isLegacySampleCall(call: CallRecord): boolean {
  const key = getContactKey(call.number);
  if (!key) return false;
  const name = (call.name || '').trim().toLowerCase();
  const note = (call.note || '').trim().toLowerCase();
  const expected = LEGACY_SAMPLE_PROFILES[key];
  if (expected && name === expected) return true;
  if (key === '918440219' && !name && note === 'courier delivery call') return true;
  if (LEGACY_ABELA_TEST_KEYS.has(key) && name === 'abela') return true;
  return false;
}

/** Identifies legacy sample scheduled calls previously seeded into signed-in accounts. */
export function isLegacySampleScheduledCall(sched: ScheduledCall): boolean {
  return sched.id === 'sched-sample-1' || sched.id === 'sched-sample-2';
}
