const AVATAR_COLORS = [
  '#08246B',
  '#FF6A00',
  '#2F7FDB',
  '#D49A1F',
  '#2F9E8F',
  '#C15BA5',
  '#6FA832',
  '#5A6B8C',
];

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  if (whole === 0) return '0s';
  const hours = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  return `${secs}s`;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayLabel(timestamp: number, now: Date = new Date()): string {
  const key = dayKey(timestamp);
  const todayKey = dayKey(now.getTime());
  if (key === todayKey) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === dayKey(yesterday.getTime())) return 'Yesterday';
  return new Date(timestamp).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

type GraphemeSegmenter = {
  segment: (input: string) => Iterable<{ segment: string }>;
};

let cachedSegmenter: GraphemeSegmenter | null | undefined;

function getGraphemeSegmenter(): GraphemeSegmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;
  try {
    const Seg = (
      Intl as unknown as {
        Segmenter?: new (
          locales?: string | string[],
          options?: { granularity: 'grapheme' },
        ) => GraphemeSegmenter;
      }
    ).Segmenter;
    cachedSegmenter = Seg ? new Seg(undefined, { granularity: 'grapheme' }) : null;
  } catch {
    cachedSegmenter = null;
  }
  return cachedSegmenter;
}

export function splitGraphemes(input: string): string[] {
  if (!input) return [];
  const segmenter = getGraphemeSegmenter();
  if (segmenter) {
    return Array.from(segmenter.segment(input), (item) => item.segment);
  }
  return Array.from(input);
}

export function firstGraphemes(input: string, count: number): string {
  return splitGraphemes(input).slice(0, count).join('');
}

const NON_NAME_LABELS = new Set([
  'unknown',
  'unknown caller',
  'private',
  'private number',
  'withheld',
  'hidden',
  'hidden number',
  'no caller id',
  'no name',
  'anonymous',
  'voicemail',
]);

/**
 * Returns true when `name` is blank, a generic unknown-caller placeholder,
 * or just a phone number / short code (e.g. "+251941505775", "0911 22 33 44", "*804#").
 */
export function isPhoneLikeName(
  name: string | null | undefined,
  number?: string | null,
): boolean {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return true;
  if (NON_NAME_LABELS.has(trimmed.toLowerCase())) return true;

  const cleanNumber = number?.trim() ?? '';
  if (cleanNumber) {
    if (trimmed === cleanNumber) return true;
    const nameDigits = trimmed.replace(/\D/g, '');
    const numDigits = cleanNumber.replace(/\D/g, '');
    if (nameDigits.length >= 4 && numDigits.length >= 4) {
      if (nameDigits === numDigits) return true;
      if (nameDigits.length >= 9 && numDigits.length >= 9 && nameDigits.slice(-9) === numDigits.slice(-9)) {
        return true;
      }
    }
  }

  // Matches strings made purely of digits and phone formatting symbols (+, -, (), spaces, *, #, .)
  const strippedPhoneChars = trimmed.replace(/[\d\s+\-().*/#]+/g, '');
  if (strippedPhoneChars.length === 0 && /\d/.test(trimmed)) {
    return true;
  }

  return false;
}

function stripLeadingDecorations(word: string): string {
  // Remove leading punctuation/brackets/symbols so names like "(Abel)" or "A." start on a letter
  return word.replace(/^[^\p{L}\p{N}]+/u, '');
}

/**
 * Computes 2-letter uppercase initials for named contacts (e.g. "Abel" -> "AB",
 * "Abel Tesfaye" -> "AT"). Returns "" when the contact is phone-only so avatars
 * render a clean User icon instead of "+2" or trailing digits.
 */
export function initials(name: string | null | undefined, number: string): string {
  if (isPhoneLikeName(name, number)) {
    return '';
  }
  const trimmed = name!.trim();
  const parts = trimmed
    .split(/\s+/)
    .map(stripLeadingDecorations)
    .filter(Boolean);

  if (parts.length >= 2) {
    const first = firstGraphemes(parts[0], 1);
    const second = firstGraphemes(parts[1], 1);
    const pair = `${first}${second}`.toLocaleUpperCase();
    if (pair) return pair;
  }

  const single = parts[0] || trimmed;
  return firstGraphemes(single, 2).toLocaleUpperCase();
}

export function avatarColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
