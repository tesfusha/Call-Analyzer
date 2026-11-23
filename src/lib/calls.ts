import { getContactKey } from '@/src/lib/contacts';
import { dayKey, dayLabel } from '@/src/lib/format';
import type { CallRecord, ContactProfile } from '@/src/types/call';

export type CallSection = {
  key: string;
  title: string;
  data: CallRecord[];
};

function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let minInRow = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < minInRow) minInRow = value;
    }
    if (minInRow > cap) return cap + 1;
    previous = current;
  }
  return previous[b.length];
}

function normalizeSearchDigits(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('251') && digits.length >= 10) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

export function filterCalls(
  calls: CallRecord[],
  query: string,
  contacts?: Record<string, ContactProfile>,
): CallRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return calls;

  const rawDigits = needle.replace(/[^0-9+]/g, '');
  const normalizedQueryDigits = normalizeSearchDigits(needle);

  return calls.filter((call) => {
    const profile = contacts ? contacts[getContactKey(call.number)] : undefined;
    const callName = (call.name ?? '').trim();
    const profileName = (profile?.name ?? '').trim();
    const combinedName = [callName, profileName].filter(Boolean).join(' ').toLowerCase();
    const combinedTag = [call.tag ?? '', profile?.tag ?? ''].filter(Boolean).join(' ').toLowerCase();
    const haystack = [
      callName,
      profileName,
      call.number,
      profile?.number ?? '',
      call.note ?? '',
      call.tag ?? '',
      profile?.tag ?? '',
    ]
      .join(' ')
      .toLowerCase();

    if (haystack.includes(needle)) return true;

    if (rawDigits.length >= 2) {
      const compactNumber = call.number.replace(/[\s()-]/g, '');
      if (compactNumber.includes(rawDigits)) return true;
      if (normalizedQueryDigits.length >= 2) {
        const normalizedCallDigits = normalizeSearchDigits(call.number);
        if (normalizedCallDigits.includes(normalizedQueryDigits)) return true;
      }
    }

    if (needle.length >= 3 && needle.length <= 24 && !rawDigits) {
      const nameCandidates = [callName.toLowerCase(), profileName.toLowerCase()].filter(Boolean);
      if (nameCandidates.some((n) => editDistance(n, needle) <= 2)) return true;
      if (combinedTag && editDistance(combinedTag, needle) <= 2) return true;
      const queryWords = needle.split(/\s+/).filter(Boolean);
      const nameWords = combinedName.split(/\s+/).filter(Boolean);
      if (
        queryWords.length > 0 &&
        queryWords.every((qw) => nameWords.some((nw) => nw.startsWith(qw)))
      ) {
        return true;
      }
    }

    return false;
  });
}

export function groupCalls(calls: CallRecord[]): CallSection[] {
  if (calls.length === 0) return [];
  const sorted = [...calls].sort((a, b) => b.timestamp - a.timestamp);
  const sections: CallSection[] = [];
  let currentKey = '';
  let current: CallSection | undefined;

  sorted.forEach((call) => {
    const key = dayKey(call.timestamp);
    if (key !== currentKey) {
      current = { key, title: dayLabel(call.timestamp), data: [] };
      sections.push(current);
      currentKey = key;
    }
    current?.data.push(call);
  });

  return sections;
}

export type CallCluster = {
  id: string;
  primary: CallRecord;
  calls: CallRecord[];
  totalDuration: number;
};

export function clusterConsecutiveCalls(
  calls: CallRecord[],
  getKey: (number: string) => string,
): CallCluster[] {
  if (calls.length === 0) return [];
  const clusters: CallCluster[] = [];

  calls.forEach((call) => {
    const last = clusters[clusters.length - 1];
    if (
      last &&
      last.primary.direction === call.direction &&
      getKey(last.primary.number) === getKey(call.number)
    ) {
      last.calls.push(call);
      last.totalDuration += call.duration;
    } else {
      clusters.push({
        id: call.id,
        primary: call,
        calls: [call],
        totalDuration: call.duration,
      });
    }
  });

  return clusters;
}

