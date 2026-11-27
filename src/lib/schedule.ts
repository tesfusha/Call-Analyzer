import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { formatDateTime } from '@/src/lib/format';
import type { ScheduledCall } from '@/src/types/call';

export function formatScheduledCountdown(scheduledFor: number, nowMs: number = Date.now()): string {
  const diffMs = scheduledFor - nowMs;
  const absMins = Math.round(Math.abs(diffMs) / 60_000);

  if (diffMs <= 0) {
    if (absMins < 1) return 'Due now';
    if (absMins < 60) return `Overdue ${absMins}m`;
    const hrs = Math.floor(absMins / 60);
    if (hrs < 24) return `Overdue ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `Overdue ${days}d`;
  }

  if (absMins < 60) return `In ${Math.max(1, absMins)}m`;
  const hrs = Math.floor(absMins / 60);
  const remMins = absMins % 60;
  if (hrs < 24) return remMins > 0 ? `In ${hrs}h ${remMins}m` : `In ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `In ${days}d`;
}

export function toDateTimeLocalValue(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateTimeLocalValue(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (m) {
    const dt = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      m[6] ? Number(m[6]) : 0,
      0,
    );
    return dt.getTime();
  }
  return Date.parse(value);
}

export function tomorrowAtHour(hour = 9, now: Date = new Date()): number {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export function nextOccurrenceAtHour(hour = 18, minute = 0, now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now.getTime() + 5 * 60_000) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

export function formatScheduleSummary(timestamp: number, nowMs: number = Date.now()): string {
  if (!Number.isFinite(timestamp)) return 'Select date & time';
  const target = new Date(timestamp);
  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const dayDiff = Math.round((startOfTarget - startOfToday) / 86_400_000);

  const timePart = target.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const dayPart =
    dayDiff === 0
      ? 'Today'
      : dayDiff === 1
        ? 'Tomorrow'
        : target.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });

  return `${dayPart} · ${timePart} · ${formatEthiopianShort(timestamp)} EC`;
}

export function buildScheduledCallIcs(item: ScheduledCall): string {
  const start = new Date(item.scheduledFor);
  const end = new Date(item.scheduledFor + 15 * 60_000);
  const toUtcIcs = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
      d.getUTCDate(),
    ).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}${String(
      d.getUTCMinutes(),
    ).padStart(2, '0')}00Z`;

  const displayName = item.name?.trim() || item.number;
  const description = [
    `Call ${displayName} (${item.number})`,
    item.note ? `Note: ${item.note}` : '',
    `Ethiopian date: ${formatEthiopianShort(item.scheduledFor)} EC`,
  ]
    .filter(Boolean)
    .join('\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Call Analyzer - ETH//EN',
    'BEGIN:VEVENT',
    `UID:${item.id}@callanalyzer.eth`,
    `DTSTAMP:${toUtcIcs(new Date())}`,
    `DTSTART:${toUtcIcs(start)}`,
    `DTEND:${toUtcIcs(end)}`,
    `SUMMARY:Call ${displayName}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${item.number}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT5M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Call reminder: ${displayName}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function formatScheduledLabel(item: ScheduledCall): string {
  return `${formatDateTime(item.scheduledFor)} · ${formatEthiopianShort(item.scheduledFor)} EC`;
}
