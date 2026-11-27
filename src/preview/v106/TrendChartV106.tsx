import { useMemo, useState } from 'react';
import { estimateCallCostEtb, formatEtb, type TariffConfig } from '@/src/lib/ethiopia';
import { dayKey, formatDuration } from '@/src/lib/format';
import type { CallRecord } from '@/src/types/call';

export type InsightsRangeKey = '7d' | '14d' | '30d' | '90d' | 'all';
export type TrendMetric = 'duration' | 'count' | 'spend';

export type TrendPoint = {
  key: string;
  label: string;
  fullLabel: string;
  duration: number;
  count: number;
  spend: number;
  incoming: number;
  outgoing: number;
  missed: number;
};

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function weekStartKey(ts: number): { key: string; date: Date } {
  const d = startOfDay(new Date(ts));
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return { key: dayKey(d.getTime()), date: d };
}

function monthKey(ts: number): { key: string; date: Date } {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    date: start,
  };
}

export function filterCallsForInsightsRange(
  calls: CallRecord[],
  range: InsightsRangeKey,
  now: Date = new Date(),
): CallRecord[] {
  if (range === 'all') return calls;
  const days = range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : 90;
  // Anchor to the latest call date if all calls are older than today (e.g. imported historical backups)
  const latestCallTs = calls.reduce((max, c) => (c.timestamp > max ? c.timestamp : max), 0);
  const anchorMs = latestCallTs > 0 && now.getTime() - latestCallTs > days * MS_PER_DAY
    ? latestCallTs
    : now.getTime();
  const cutoff = startOfDay(new Date(anchorMs - (days - 1) * MS_PER_DAY)).getTime();
  return calls.filter((c) => c.timestamp >= cutoff && c.timestamp <= anchorMs + MS_PER_DAY);
}

function computePreviousPeriodDelta(
  allCalls: CallRecord[],
  range: InsightsRangeKey,
  metric: TrendMetric,
  tariffs: TariffConfig,
  now: Date = new Date(),
): { deltaPct: number | null; label: string } {
  if (range === 'all' || allCalls.length === 0) {
    return { deltaPct: null, label: '' };
  }
  const days = range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : 90;
  const latestCallTs = allCalls.reduce((max, c) => (c.timestamp > max ? c.timestamp : max), 0);
  const anchorMs = latestCallTs > 0 && now.getTime() - latestCallTs > days * MS_PER_DAY
    ? latestCallTs
    : now.getTime();

  const currentStart = startOfDay(new Date(anchorMs - (days - 1) * MS_PER_DAY)).getTime();
  const prevStart = currentStart - days * MS_PER_DAY;

  const valueOf = (list: CallRecord[]) => {
    if (metric === 'duration') return list.reduce((s, c) => s + c.duration, 0);
    if (metric === 'count') return list.length;
    return list.reduce((s, c) => s + estimateCallCostEtb(c, tariffs), 0);
  };

  const currentCalls = allCalls.filter((c) => c.timestamp >= currentStart && c.timestamp <= anchorMs + MS_PER_DAY);
  const prevCalls = allCalls.filter((c) => c.timestamp >= prevStart && c.timestamp < currentStart);

  const cur = valueOf(currentCalls);
  const prev = valueOf(prevCalls);
  if (prev <= 0) return { deltaPct: null, label: '' };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { deltaPct: pct, label: `vs previous ${days} days` };
}

function buildTrendSeries(
  calls: CallRecord[],
  range: InsightsRangeKey,
  tariffs: TariffConfig,
): { points: TrendPoint[]; granularity: 'day' | 'week' | 'month' } {
  if (calls.length === 0) {
    return { points: [], granularity: 'day' };
  }

  const sorted = [...calls].sort((a, b) => a.timestamp - b.timestamp);
  const minTs = sorted[0].timestamp;
  const maxTs = sorted[sorted.length - 1].timestamp;
  const spanDays = Math.max(1, Math.round((maxTs - minTs) / MS_PER_DAY) + 1);

  const granularity: 'day' | 'week' | 'month' =
    range === '7d' || range === '14d' || range === '30d'
      ? 'day'
      : range === '90d'
        ? 'week'
        : spanDays <= 35
          ? 'day'
          : spanDays <= 210
            ? 'week'
            : 'month';

  const map = new Map<string, TrendPoint>();

  // For daily ranges (7d / 14d / 30d), pre-fill continuous days up to anchor so gaps show truthfully
  if (granularity === 'day') {
    const dayCount =
      range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : Math.min(35, spanDays);
    const endDate = startOfDay(new Date(maxTs));
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (dayCount - 1));

    for (let i = 0; i < dayCount; i += 1) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const k = dayKey(d.getTime());
      const shortLabel = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const fullLabel = d.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      map.set(k, {
        key: k,
        label: shortLabel,
        fullLabel,
        duration: 0,
        count: 0,
        spend: 0,
        incoming: 0,
        outgoing: 0,
        missed: 0,
      });
    }
  }

  for (const call of sorted) {
    let key: string;
    let label: string;
    let fullLabel: string;

    if (granularity === 'day') {
      key = dayKey(call.timestamp);
      const d = new Date(call.timestamp);
      label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      fullLabel = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    } else if (granularity === 'week') {
      const w = weekStartKey(call.timestamp);
      key = w.key;
      label = w.date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const end = new Date(w.date);
      end.setDate(end.getDate() + 6);
      fullLabel = `Week of ${label} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    } else {
      const m = monthKey(call.timestamp);
      key = m.key;
      label = m.date.toLocaleDateString([], { month: 'short', year: '2-digit' });
      fullLabel = m.date.toLocaleDateString([], { month: 'long', year: 'numeric' });
    }

    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        key,
        label,
        fullLabel,
        duration: 0,
        count: 0,
        spend: 0,
        incoming: 0,
        outgoing: 0,
        missed: 0,
      };
      map.set(key, bucket);
    }

    bucket.count += 1;
    bucket.duration += call.duration;
    bucket.spend += estimateCallCostEtb(call, tariffs);
    if (call.direction === 'incoming') bucket.incoming += 1;
    else if (call.direction === 'outgoing') bucket.outgoing += 1;
    else if (call.direction === 'missed') bucket.missed += 1;
  }

  const ordered = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { points: ordered, granularity };
}

function getMetricValue(point: TrendPoint, metric: TrendMetric): number {
  if (metric === 'duration') return point.duration;
  if (metric === 'count') return point.count;
  return point.spend;
}

function formatMetricAxis(value: number, metric: TrendMetric): string {
  if (metric === 'duration') {
    const mins = Math.round(value / 60);
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h${m}m` : `${h}h`;
    }
    return `${mins}m`;
  }
  if (metric === 'count') return String(Math.round(value));
  return `${Math.round(value)} ETB`;
}

function formatMetricValue(value: number, metric: TrendMetric): string {
  if (metric === 'duration') return formatDuration(value);
  if (metric === 'count') return `${value} ${value === 1 ? 'call' : 'calls'}`;
  return formatEtb(value);
}

export function TrendChartV106({
  allCalls,
  scopedCalls,
  range,
  tariffs,
}: {
  allCalls: CallRecord[];
  scopedCalls: CallRecord[];
  range: InsightsRangeKey;
  tariffs: TariffConfig;
}) {
  const [metric, setMetric] = useState<TrendMetric>('duration');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { points, granularity } = useMemo(
    () => buildTrendSeries(scopedCalls, range, tariffs),
    [scopedCalls, range, tariffs],
  );

  const delta = useMemo(
    () => computePreviousPeriodDelta(allCalls, range, metric, tariffs),
    [allCalls, range, metric, tariffs],
  );

  const totalValue = useMemo(
    () => points.reduce((sum, p) => sum + getMetricValue(p, metric), 0),
    [points, metric],
  );

  const activeIdx =
    selectedIndex !== null && selectedIndex < points.length
      ? selectedIndex
      : points.length > 0
        ? points.length - 1
        : null;
  const activePoint = activeIdx !== null ? points[activeIdx] : null;

  if (points.length === 0) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-6 text-center">
        <p className="text-sm text-[#626874] dark:text-[#989EA9]">
          No calls recorded in this time window yet.
        </p>
      </div>
    );
  }

  const maxRaw = Math.max(...points.map((p) => getMetricValue(p, metric)), 1);
  const niceMax =
    metric === 'duration'
      ? Math.max(60, Math.ceil(maxRaw / 600) * 600)
      : metric === 'count'
        ? Math.max(4, Math.ceil(maxRaw / 4) * 4)
        : Math.max(10, Math.ceil(maxRaw / 10) * 10);

  const chartHeight = 200;
  const padTop = 18;
  const padBottom = 34;
  const padLeft = 48;
  const padRight = 18;
  const plotHeight = chartHeight - padTop - padBottom;
  const pointStep = points.length > 18 ? 34 : 52;
  const chartWidth = Math.max(520, padLeft + padRight + Math.max(1, points.length - 1) * pointStep);
  const plotWidth = chartWidth - padLeft - padRight;

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? padLeft + plotWidth / 2
        : padLeft + (i / (points.length - 1)) * plotWidth;
    const val = getMetricValue(p, metric);
    const y = padTop + plotHeight - (val / niceMax) * plotHeight;
    return { x, y, point: p, val };
  });

  // Smooth monotone-ish path
  const linePath = coords
    .map((pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      const prev = coords[idx - 1];
      const cx = (prev.x + pt.x) / 2;
      return `C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    })
    .join(' ');

  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${padTop + plotHeight} L ${coords[0].x} ${padTop + plotHeight} Z`
      : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padTop + plotHeight - t * plotHeight,
    label: formatMetricAxis(niceMax * t, metric),
  }));

  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const granularityLabel =
    granularity === 'day' ? 'Daily' : granularity === 'week' ? 'Weekly' : 'Monthly';

  return (
    <section className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-5 sm:p-6 space-y-5">
      {/* Header + Metric Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#626874] dark:text-[#989EA9]">
            <span>{granularityLabel} trend</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {points.length} {granularity === 'day' ? 'days' : granularity === 'week' ? 'weeks' : 'months'}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h2 className="text-2xl font-bold tracking-tight tabular-nums text-[#14161A] dark:text-[#F4F4F1]">
              {formatMetricValue(totalValue, metric)}
            </h2>
            {delta.deltaPct !== null && (
              <span
                className={`text-xs font-medium tabular-nums ${
                  delta.deltaPct > 0
                    ? 'text-[#D95B16] dark:text-[#F4762C]'
                    : delta.deltaPct < 0
                      ? 'text-[#16A34A] dark:text-[#4ADE80]'
                      : 'text-[#626874] dark:text-[#989EA9]'
                }`}
              >
                {delta.deltaPct > 0 ? `+${delta.deltaPct}%` : `${delta.deltaPct}%`} {delta.label}
              </span>
            )}
          </div>
        </div>

        <div
          role="group"
          aria-label="Chart metric"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F2F0EC] dark:bg-[#0E1013] self-start"
        >
          {(
            [
              { key: 'duration', label: 'Talk time' },
              { key: 'count', label: 'Calls' },
              { key: 'spend', label: 'Spend' },
            ] as Array<{ key: TrendMetric; label: string }>
          ).map((tab) => {
            const active = metric === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMetric(tab.key)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-white dark:bg-[#232730] text-[#14161A] dark:text-[#F4F4F1] shadow-xs'
                    : 'text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Point Readout Bar (No overlapping floating box blocking dots!) */}
      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#F7F6F2] dark:bg-[#0E1013] text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-[#14161A] dark:text-[#F4F4F1] whitespace-nowrap">
              {activePoint.fullLabel}
            </span>
            <span className="text-[#9CA3AF]" aria-hidden="true">
              ·
            </span>
            <span className="font-mono font-semibold tabular-nums text-[#E45A0D] dark:text-[#F4762C]">
              {formatMetricValue(getMetricValue(activePoint, metric), metric)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#626874] dark:text-[#989EA9] font-mono tabular-nums">
            <span>{activePoint.count} calls</span>
            <span aria-hidden="true">·</span>
            <span>In {activePoint.incoming}</span>
            <span aria-hidden="true">·</span>
            <span>Out {activePoint.outgoing}</span>
            <span aria-hidden="true">·</span>
            <span>Missed {activePoint.missed}</span>
          </div>
        </div>
      )}

      {/* Horizontally scrollable SVG chart for 30+ days on mobile */}
      <div className="overflow-x-auto -mx-2 px-2 pb-1">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-[210px] select-none"
          style={{ minWidth: points.length > 14 ? `${chartWidth}px` : undefined }}
          role="img"
          aria-label={`${granularityLabel} ${metric} trend chart`}
        >
          <defs>
            <linearGradient id="v106TrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E45A0D" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#E45A0D" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines & Y labels */}
          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                x2={chartWidth - padRight}
                y1={tick.y}
                y2={tick.y}
                className="stroke-[#E5E2DC] dark:stroke-white/[0.08]"
                strokeDasharray={idx === 0 ? undefined : '3 4'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-[#7A808C] dark:fill-[#8B92A0] text-[10px] font-mono"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Area & Line */}
          {areaPath && <path d={areaPath} fill="url(#v106TrendFill)" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#E45A0D"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Active vertical hairline */}
          {activeIdx !== null && coords[activeIdx] && (
            <line
              x1={coords[activeIdx].x}
              x2={coords[activeIdx].x}
              y1={padTop}
              y2={padTop + plotHeight}
              className="stroke-[#14161A]/25 dark:stroke-white/25"
              strokeWidth="1"
            />
          )}

          {/* Interactive points + generous hit targets */}
          {coords.map((pt, idx) => {
            const isSelected = activeIdx === idx;
            const showXLabel =
              idx === 0 || idx === coords.length - 1 || idx % labelEvery === 0;
            return (
              <g
                key={pt.point.key}
                className="cursor-pointer"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => setSelectedIndex(idx)}
              >
                {/* Invisible wide touch column */}
                <rect
                  x={pt.x - Math.max(12, pointStep / 2)}
                  y={padTop}
                  width={Math.max(24, pointStep)}
                  height={plotHeight + padBottom}
                  fill="transparent"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 5.5 : 3.2}
                  fill={isSelected ? '#E45A0D' : '#FFFFFF'}
                  stroke="#E45A0D"
                  strokeWidth={isSelected ? 2.5 : 2}
                />
                {showXLabel && (
                  <text
                    x={pt.x}
                    y={chartHeight - 8}
                    textAnchor={
                      idx === 0 ? 'start' : idx === coords.length - 1 ? 'end' : 'middle'
                    }
                    className={`text-[10px] font-mono ${
                      isSelected
                        ? 'fill-[#14161A] dark:fill-[#F4F4F1] font-semibold'
                        : 'fill-[#7A808C] dark:fill-[#8B92A0]'
                    }`}
                  >
                    {pt.point.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-[11px] text-[#7A808C] dark:text-[#8B92A0]">
        Tap or hover any point to inspect that {granularity}.{' '}
        {points.length > 14 ? 'Swipe horizontally to explore all days.' : ''}
      </p>
    </section>
  );
}
