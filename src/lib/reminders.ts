import { getContactKey } from '@/src/lib/contacts';
import { estimateCallCostEtb, formatEtb, normaliseEthPhone, type TariffConfig } from '@/src/lib/ethiopia';
import { formatDuration } from '@/src/lib/format';
import { eatDateDiffDays, toEatDateString } from '@/src/lib/gamification';
import { EAT_UTC_OFFSET_MS } from '@/src/lib/gamificationConstants';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { computeTotals, filterByRange, topByDuration } from '@/src/lib/stats';
import type { CallRecord, ContactProfile } from '@/src/types/call';

export const DORMANT_DAYS = 90;

export type QuietContact = {
  contactKey: string;
  number: string;
  name: string;
  tag: string;
  isFavorite: boolean;
  typicalIntervalDays: number | null;
  daysSinceLast: number;
  overdueDays: number;
  overdueRatio: number;
  lastTimestamp: number;
  callCount: number;
  priorityScore: number;
  isDormant: boolean;
};

export type QuietContactsAnalysis = {
  active: QuietContact[];
  dormant: QuietContact[];
};

const MS_PER_DAY = 86_400_000;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Returns the Monday 00:00 East Africa Time (UTC+3) YYYY-MM-DD key
 * for the week containing `nowMs`.
 */
export function getEatWeekKey(nowMs: number = Date.now()): string {
  const shifted = new Date(nowMs + EAT_UTC_OFFSET_MS);
  const utcDay = shifted.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysSinceMonday = (utcDay + 6) % 7;
  const mondayMs =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - daysSinceMonday,
    ) - EAT_UTC_OFFSET_MS;
  return toEatDateString(mondayMs);
}

/**
 * Strict Step 15 rhythm calculation:
 * Only answered incoming/outgoing calls (duration > 0), requiring at least
 * 4 answered calls across at least 3 distinct EAT days.
 * Returns null if the contact does not have an established rhythm yet.
 */
export function typicalIntervalDays(calls: CallRecord[]): number | null {
  const answered = calls.filter(
    (c) => (c.direction === 'incoming' || c.direction === 'outgoing') && c.duration > 0,
  );
  if (answered.length < 4) return null;

  const distinctDays = Array.from(new Set(answered.map((c) => toEatDateString(c.timestamp)))).sort();
  if (distinctDays.length < 3) return null;

  const gaps: number[] = [];
  for (let i = 1; i < distinctDays.length; i += 1) {
    const diff = eatDateDiffDays(distinctDays[i - 1], distinctDays[i]);
    if (Number.isFinite(diff) && diff >= 1) {
      gaps.push(diff);
    }
  }
  if (gaps.length === 0) return null;
  const value = median(gaps);
  return Math.max(1, Math.round(value));
}

function tagPriorityWeight(tag: string): number {
  const lower = tag.trim().toLowerCase();
  if (!lower) return 4;
  if (lower.includes('family')) return 18;
  if (lower.includes('friend')) return 14;
  if (lower.includes('business') || lower.includes('work') || lower.includes('coworker')) {
    return 6;
  }
  return 8;
}

export function quietContactsAnalysis(
  calls: CallRecord[],
  options: {
    now?: Date;
    contacts?: Record<string, ContactProfile>;
    favorites?: string[];
    maxIntervalDays?: number;
  } = {},
): QuietContactsAnalysis {
  const nowMs = (options.now ?? new Date()).getTime();
  const todayEat = toEatDateString(nowMs);
  const contactsMap = options.contacts ?? {};
  const favSet = new Set((options.favorites ?? []).map((f) => getContactKey(f)));
  const maxIntervalDays = options.maxIntervalDays ?? 45;

  const byContact = new Map<string, CallRecord[]>();
  calls.forEach((call) => {
    // Only answered incoming/outgoing calls with duration > 0 count toward rhythm & last connected call.
    if (
      (call.direction !== 'incoming' && call.direction !== 'outgoing') ||
      call.duration <= 0
    ) {
      return;
    }
    const key = getContactKey(call.number);
    if (!key) return;
    const list = byContact.get(key) ?? [];
    list.push(call);
    byContact.set(key, list);
  });

  const active: QuietContact[] = [];
  const dormant: QuietContact[] = [];

  byContact.forEach((answeredCalls, contactKey) => {
    const sorted = [...answeredCalls].sort((a, b) => a.timestamp - b.timestamp);
    const lastCall = sorted[sorted.length - 1];
    const lastTimestamp = lastCall.timestamp;
    const lastEatDay = toEatDateString(lastTimestamp);
    const rawDiff = eatDateDiffDays(lastEatDay, todayEat);
    const daysSinceLast = Number.isFinite(rawDiff) ? Math.max(0, rawDiff) : 0;

    const profile = contactsMap[contactKey];
    const namedCall = [...sorted].reverse().find((c) => c.name?.trim());
    const number = profile?.number || lastCall.number;
    const displayName =
      profile?.name?.trim() || namedCall?.name?.trim() || '';
    const tag = profile?.tag?.trim() || '';
    const isFavorite = favSet.has(contactKey);

    const rhythm = typicalIntervalDays(sorted);

    if (daysSinceLast > DORMANT_DAYS) {
      dormant.push({
        contactKey,
        number,
        name: displayName,
        tag,
        isFavorite,
        typicalIntervalDays: rhythm,
        daysSinceLast,
        overdueDays: rhythm !== null ? Math.max(0, daysSinceLast - rhythm) : daysSinceLast,
        overdueRatio: rhythm !== null ? daysSinceLast / Math.max(1, rhythm) : daysSinceLast / 30,
        lastTimestamp,
        callCount: sorted.length,
        priorityScore: 0,
        isDormant: true,
      });
      return;
    }

    if (rhythm !== null) {
      if (rhythm > maxIntervalDays) return;
      const quietThreshold = Math.max(2 * rhythm, 7);
      if (daysSinceLast <= quietThreshold) return;

      const overdueDays = Math.max(1, daysSinceLast - rhythm);
      const overdueRatio = daysSinceLast / Math.max(1, rhythm);
      const priorityScore =
        Math.log1p(sorted.length) * 18 +
        (isFavorite ? 25 : 0) +
        tagPriorityWeight(tag) +
        Math.min(36, overdueRatio * 8);

      active.push({
        contactKey,
        number,
        name: displayName,
        tag,
        isFavorite,
        typicalIntervalDays: rhythm,
        daysSinceLast,
        overdueDays,
        overdueRatio,
        lastTimestamp,
        callCount: sorted.length,
        priorityScore,
        isDormant: false,
      });
      return;
    }

    // Contacts without >= 4 calls on >= 3 distinct days never show "usually every N days",
    // but repeated contacts quiet for >= 14 days can still surface gently.
    const fallbackThreshold = Math.max(14, Math.min(30, maxIntervalDays));
    if (sorted.length >= 2 && daysSinceLast >= fallbackThreshold) {
      const overdueRatio = daysSinceLast / fallbackThreshold;
      const priorityScore =
        Math.log1p(sorted.length) * 14 +
        (isFavorite ? 25 : 0) +
        tagPriorityWeight(tag) +
        Math.min(24, overdueRatio * 6);

      active.push({
        contactKey,
        number,
        name: displayName,
        tag,
        isFavorite,
        typicalIntervalDays: null,
        daysSinceLast,
        overdueDays: Math.max(0, daysSinceLast - fallbackThreshold),
        overdueRatio,
        lastTimestamp,
        callCount: sorted.length,
        priorityScore,
        isDormant: false,
      });
    }
  });

  active.sort((a, b) => b.priorityScore - a.priorityScore || b.overdueDays - a.overdueDays);
  dormant.sort((a, b) => a.daysSinceLast - b.daysSinceLast);

  return { active, dormant };
}

export function quietContacts(
  calls: CallRecord[],
  now: Date = new Date(),
  maxIntervalDays = 45,
): QuietContact[] {
  return quietContactsAnalysis(calls, { now, maxIntervalDays }).active;
}

export function isWithinQuietHours(
  prefs: { quietHoursEnabled: boolean; quietStartHour: number; quietEndHour: number },
  now: Date = new Date(),
): boolean {
  if (!prefs.quietHoursEnabled) return false;
  const hour = now.getHours();
  if (prefs.quietStartHour === prefs.quietEndHour) return false;
  if (prefs.quietStartHour < prefs.quietEndHour) {
    return hour >= prefs.quietStartHour && hour < prefs.quietEndHour;
  }
  return hour >= prefs.quietStartHour || hour < prefs.quietEndHour;
}

export function quietMessage(contact: QuietContact): string {
  const days = contact.daysSinceLast;
  const dayLabel = `Last call ${days} day${days === 1 ? '' : 's'} ago`;
  if (contact.typicalIntervalDays !== null) {
    return `${dayLabel}, usually every ${contact.typicalIntervalDays} day${contact.typicalIntervalDays === 1 ? '' : 's'}`;
  }
  return dayLabel;
}

/**
 * Finds missed calls within the last 7 days where no later answered incoming or outgoing call
 * happened with the same contact, excluding dismissed call IDs and rejected/blocked/voicemail calls.
 */
export function unreturnedMissedCalls(
  calls: CallRecord[],
  dismissedIds: Set<string> = new Set(),
  now: Date = new Date(),
  maxAgeDays = 7,
): CallRecord[] {
  const nowMs = now.getTime();
  const maxAgeMs = maxAgeDays * MS_PER_DAY;
  const latestAnsweredByContact = new Map<string, number>();
  const latestMissedByContact = new Map<string, CallRecord>();

  calls.forEach((call) => {
    const key = normaliseEthPhone(call.number);
    if (!key) return;
    if (
      call.direction === 'outgoing' ||
      (call.direction === 'incoming' && call.duration > 0)
    ) {
      const prev = latestAnsweredByContact.get(key) ?? 0;
      if (call.timestamp > prev) latestAnsweredByContact.set(key, call.timestamp);
    } else if (call.direction === 'missed' && !dismissedIds.has(call.id)) {
      const prev = latestMissedByContact.get(key);
      if (!prev || call.timestamp > prev.timestamp) {
        latestMissedByContact.set(key, call);
      }
    }
  });

  const pending: CallRecord[] = [];
  latestMissedByContact.forEach((missedCall, key) => {
    if (nowMs - missedCall.timestamp > maxAgeMs) return;
    const answeredAfter = latestAnsweredByContact.get(key) ?? 0;
    if (missedCall.timestamp > answeredAfter) {
      pending.push(missedCall);
    }
  });

  return pending.sort((a, b) => b.timestamp - a.timestamp);
}

export type PeriodReport = {
  period: 'weekly' | 'monthly';
  title: string;
  totalCalls: number;
  incomingCount: number;
  outgoingCount: number;
  incomingDuration: number;
  outgoingDuration: number;
  totalDuration: number;
  missedCount: number;
  spendEtb: number;
  topContactName: string | null;
};

export function buildPeriodReport(
  calls: CallRecord[],
  period: 'weekly' | 'monthly',
  tariffs?: TariffConfig,
  now: Date = new Date(),
): PeriodReport {
  const slice = filterByRange(calls, period === 'weekly' ? '7d' : '30d', now);
  const totals = computeTotals(slice);
  const top = topByDuration(slice);
  const spendEtb = tariffs
    ? Number(slice.reduce((sum, c) => sum + estimateCallCostEtb(c, tariffs), 0).toFixed(2))
    : 0;
  return {
    period,
    title:
      period === 'weekly'
        ? 'Weekly Call Report (Last 7 Days)'
        : 'Monthly Call Report (Last 30 Days)',
    totalCalls: totals.totalCalls,
    incomingCount: totals.incomingCount,
    outgoingCount: totals.outgoingCount,
    incomingDuration: totals.incomingDuration,
    outgoingDuration: totals.outgoingDuration,
    totalDuration: totals.totalDuration,
    missedCount: totals.missedCount,
    spendEtb,
    topContactName: top ? formatDisplayNameOrPhone(top.name, top.number) : null,
  };
}

export function formatReportClipboard(report: PeriodReport): string {
  const lines = [
    `Call Analyzer - ETH — ${report.title}`,
    `• Total calls: ${report.totalCalls} (${report.incomingCount} in / ${report.outgoingCount} out / ${report.missedCount} missed)`,
    `• Talk time: ${formatDuration(report.totalDuration)}`,
    `• Est. spend: ${formatEtb(report.spendEtb)}`,
  ];
  if (report.topContactName) {
    lines.push(`• Top contact: ${report.topContactName}`);
  }
  return lines.join('\n');
}
