import {
  detectCarrier,
  estimateCallCostEtb,
  type CarrierName,
  type TariffConfig,
} from '@/src/lib/ethiopia';
import { dayKey } from '@/src/lib/format';
import type { CallRecord, DateRangeFilter, TimeRange } from '@/src/types/call';

const MS_PER_DAY = 86_400_000;

export function filterByRange(
  calls: CallRecord[],
  range: TimeRange,
  now: Date = new Date(),
  customRange: DateRangeFilter = null,
): CallRecord[] {
  if (range === 'all') return calls;
  if (range === 'custom') {
    if (!customRange || (!customRange.start && !customRange.end)) return calls;
    const startMs = customRange.start
      ? new Date(`${customRange.start}T00:00:00`).getTime()
      : Number.NEGATIVE_INFINITY;
    const endMs = customRange.end
      ? new Date(`${customRange.end}T23:59:59.999`).getTime()
      : Number.POSITIVE_INFINITY;
    return calls.filter((call) => call.timestamp >= startMs && call.timestamp <= endMs);
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const cutoff = now.getTime() - days * MS_PER_DAY;
  return calls.filter((call) => call.timestamp >= cutoff);
}

export type Totals = {
  totalCalls: number;
  totalDuration: number;
  incomingCount: number;
  incomingDuration: number;
  outgoingCount: number;
  outgoingDuration: number;
  missedCount: number;
  avgDuration: number;
  uniqueContacts: number;
};

export function computeTotals(calls: CallRecord[]): Totals {
  let totalDuration = 0;
  let incomingCount = 0;
  let incomingDuration = 0;
  let outgoingCount = 0;
  let outgoingDuration = 0;
  let missedCount = 0;
  const contacts = new Set<string>();

  calls.forEach((call) => {
    contacts.add(call.number);
    totalDuration += call.duration;
    if (call.direction === 'incoming') {
      incomingCount += 1;
      incomingDuration += call.duration;
    } else if (call.direction === 'outgoing') {
      outgoingCount += 1;
      outgoingDuration += call.duration;
    } else {
      missedCount += 1;
    }
  });

  const answered = incomingCount + outgoingCount;
  return {
    totalCalls: calls.length,
    totalDuration,
    incomingCount,
    incomingDuration,
    outgoingCount,
    outgoingDuration,
    missedCount,
    avgDuration: answered > 0 ? Math.round(totalDuration / answered) : 0,
    uniqueContacts: contacts.size,
  };
}

export type DailyBucket = {
  key: string;
  label: string;
  count: number;
  duration: number;
  incoming: number;
  outgoing: number;
  missed: number;
};

export function dailyBuckets(calls: CallRecord[]): DailyBucket[] {
  const map = new Map<string, DailyBucket>();
  const sorted = [...calls].sort((a, b) => a.timestamp - b.timestamp);

  sorted.forEach((call) => {
    const key = dayKey(call.timestamp);
    let bucket = map.get(key);
    if (!bucket) {
      const label = new Date(call.timestamp).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });
      bucket = { key, label, count: 0, duration: 0, incoming: 0, outgoing: 0, missed: 0 };
      map.set(key, bucket);
    }
    bucket.count += 1;
    bucket.duration += call.duration;
    bucket[call.direction] += 1;
  });

  return [...map.values()].slice(-14);
}

export type ContactStat = {
  number: string;
  name: string;
  count: number;
  duration: number;
  incoming: number;
  outgoing: number;
  missed: number;
  lastTimestamp: number;
  calls: CallRecord[];
};

export function contactStats(calls: CallRecord[]): ContactStat[] {
  const map = new Map<string, ContactStat>();
  calls.forEach((call) => {
    let stat = map.get(call.number);
    if (!stat) {
      stat = {
        number: call.number,
        name: call.name?.trim() || call.number,
        count: 0,
        duration: 0,
        incoming: 0,
        outgoing: 0,
        missed: 0,
        lastTimestamp: call.timestamp,
        calls: [],
      };
      map.set(call.number, stat);
    } else if (stat.name === stat.number && call.name?.trim()) {
      stat.name = call.name.trim();
    }
    stat.count += 1;
    stat.duration += call.duration;
    stat[call.direction] += 1;
    if (call.timestamp > stat.lastTimestamp) stat.lastTimestamp = call.timestamp;
    stat.calls.push(call);
  });

  return [...map.values()].map((item) => ({
    ...item,
    calls: [...item.calls].sort((a, b) => b.timestamp - a.timestamp),
  }));
}

export type SimStat = {
  sim: 'SIM 1' | 'SIM 2' | 'Unknown';
  count: number;
  duration: number;
  incoming: number;
  outgoing: number;
  missed: number;
};

export function simStats(calls: CallRecord[]): SimStat[] {
  const map = new Map<string, SimStat>();
  const ensure = (sim: string) => {
    if (!map.has(sim)) {
      map.set(sim, {
        sim: sim === 'SIM 1' || sim === 'SIM 2' ? sim : 'Unknown',
        count: 0,
        duration: 0,
        incoming: 0,
        outgoing: 0,
        missed: 0,
      });
    }
    return map.get(sim)!;
  };

  calls.forEach((call) => {
    const key = call.sim ?? 'Unknown';
    const stat = ensure(key);
    stat.count += 1;
    stat.duration += call.duration;
    stat[call.direction] += 1;
  });

  if (!map.has('SIM 1')) ensure('SIM 1');
  if (!map.has('SIM 2')) ensure('SIM 2');

  return ['SIM 1', 'SIM 2', 'Unknown']
    .filter((sim) => map.has(sim) && (sim !== 'Unknown' || map.get(sim)!.count > 0))
    .map((sim) => map.get(sim)!);
}

export function busiestDay(calls: CallRecord[]): DailyBucket | null {
  const buckets = dailyBuckets(calls);
  if (buckets.length === 0) return null;
  return buckets.reduce((best, bucket) => (bucket.count > best.count ? bucket : best));
}

export function topByDuration(calls: CallRecord[]): ContactStat | null {
  const stats = contactStats(calls);
  if (stats.length === 0) return null;
  return stats.reduce((best, stat) => (stat.duration > best.duration ? stat : best));
}

export type HeatmapCell = { day: number; block: number; count: number };

export function heatmapBuckets(calls: CallRecord[]): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day += 1) {
    for (let block = 0; block < 4; block += 1) {
      cells.push({ day, block, count: 0 });
    }
  }
  calls.forEach((call) => {
    const d = new Date(call.timestamp);
    const day = d.getDay();
    const block = Math.floor(d.getHours() / 6);
    const cell = cells.find((c) => c.day === day && c.block === block);
    if (cell) cell.count += 1;
  });
  return cells;
}

export type DurationTrends = {
  avgAll: number;
  avg7d: number;
  avg30d: number;
  longest: { name: string; number: string; duration: number; timestamp: number } | null;
};

export function durationTrends(calls: CallRecord[], now: Date = new Date()): DurationTrends {
  const nowMs = now.getTime();
  const sevenDaysAgo = nowMs - 7 * MS_PER_DAY;
  const thirtyDaysAgo = nowMs - 30 * MS_PER_DAY;
  const withDuration = calls.filter((call) => call.duration > 0);
  const avg = (subset: CallRecord[]) => {
    const answered = subset.filter((c) => c.duration > 0);
    return answered.length > 0
      ? Math.round(answered.reduce((sum, c) => sum + c.duration, 0) / answered.length)
      : 0;
  };
  const longest =
    withDuration.length > 0
      ? withDuration.reduce((best, call) => (call.duration > best.duration ? call : best))
      : null;

  return {
    avgAll: avg(calls),
    avg7d: avg(calls.filter((call) => call.timestamp >= sevenDaysAgo)),
    avg30d: avg(calls.filter((call) => call.timestamp >= thirtyDaysAgo)),
    longest: longest
      ? {
          name: longest.name?.trim() || longest.number,
          number: longest.number,
          duration: longest.duration,
          timestamp: longest.timestamp,
        }
      : null,
  };
}

export type CarrierStat = {
  carrier: CarrierName;
  count: number;
  duration: number;
  spendEtb: number;
};

export function carrierStats(calls: CallRecord[], tariffs: TariffConfig): CarrierStat[] {
  const map = new Map<CarrierName, CarrierStat>();
  calls.forEach((call) => {
    const carrier = detectCarrier(call.number);
    let stat = map.get(carrier);
    if (!stat) {
      stat = { carrier, count: 0, duration: 0, spendEtb: 0 };
      map.set(carrier, stat);
    }
    stat.count += 1;
    stat.duration += call.duration;
    stat.spendEtb = Number((stat.spendEtb + estimateCallCostEtb(call, tariffs)).toFixed(2));
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function totalSpendEtb(calls: CallRecord[], tariffs: TariffConfig): number {
  return Number(
    calls.reduce((sum, call) => sum + estimateCallCostEtb(call, tariffs), 0).toFixed(2),
  );
}
