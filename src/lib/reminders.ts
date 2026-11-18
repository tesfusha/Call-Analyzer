import { estimateCallCostEtb, formatEtb, normaliseEthPhone, type TariffConfig } from '@/src/lib/ethiopia';
import { formatDuration } from '@/src/lib/format';
import { computeTotals, filterByRange, topByDuration } from '@/src/lib/stats';
import type { CallRecord } from '@/src/types/call';

export type QuietContact = {
  number: string;
  name: string;
  typicalIntervalDays: number;
  daysSinceLast: number;
  overdueDays: number;
  lastTimestamp: number;
  callCount: number;
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

export function typicalIntervalDays(calls: CallRecord[]): number | null {
  if (calls.length < 2) return null;
  const sorted = [...calls].sort((a, b) => a.timestamp - b.timestamp);
  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    gaps.push((sorted[index].timestamp - sorted[index - 1].timestamp) / MS_PER_DAY);
  }
  const value = median(gaps);
  return value > 0 ? value : null;
}

export function quietContacts(
  calls: CallRecord[],
  now: Date = new Date(),
  maxIntervalDays = 30,
): QuietContact[] {
  const nowMs = now.getTime();
  const byNumber = new Map<string, CallRecord[]>();

  calls.forEach((call) => {
    const key = normaliseEthPhone(call.number);
    const list = byNumber.get(key) ?? [];
    list.push(call);
    byNumber.set(key, list);
  });

  const result: QuietContact[] = [];
  byNumber.forEach((contactCalls) => {
    const interval = typicalIntervalDays(contactCalls);
    if (interval === null || interval > maxIntervalDays) return;
    const lastTimestamp = Math.max(...contactCalls.map((call) => call.timestamp));
    const daysSinceLast = (nowMs - lastTimestamp) / MS_PER_DAY;
    const threshold = Math.max(interval * 1.5, Math.min(7, maxIntervalDays));
    if (daysSinceLast >= threshold) {
      const named = contactCalls.find((c) => c.name?.trim());
      result.push({
        number: contactCalls[0].number,
        name: named?.name?.trim() || contactCalls[0].number,
        typicalIntervalDays: Math.max(1, Math.round(interval)),
        daysSinceLast: Math.floor(daysSinceLast),
        overdueDays: Math.max(0, Math.floor(daysSinceLast - interval)),
        lastTimestamp,
        callCount: contactCalls.length,
      });
    }
  });

  return result.sort((a, b) => b.overdueDays - a.overdueDays);
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
  const usually = contact.typicalIntervalDays;
  return `It's been ${days} day${days === 1 ? '' : 's'} since you called ${contact.name} — you usually call every ${usually} day${usually === 1 ? '' : 's'}.`;
}

/**
 * Finds missed calls where no later incoming/outgoing call happened with the same
 * contact, excluding any call IDs the user marked as handled.
 */
export function unreturnedMissedCalls(
  calls: CallRecord[],
  dismissedIds: Set<string> = new Set(),
): CallRecord[] {
  const latestAnsweredByContact = new Map<string, number>();
  const latestMissedByContact = new Map<string, CallRecord>();

  calls.forEach((call) => {
    const key = normaliseEthPhone(call.number);
    if (call.direction === 'incoming' || call.direction === 'outgoing') {
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
    topContactName: top ? top.name : null,
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
