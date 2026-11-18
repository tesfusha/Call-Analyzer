import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDuration } from '@/src/lib/format';
import type { CarrierStat, DailyBucket, HeatmapCell } from '@/src/lib/stats';

type TooltipPayloadItem<T = Record<string, unknown>> = {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: T;
};

type CustomTooltipProps<T = Record<string, unknown>> = {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem<T>>;
  label?: string | number;
};

type DirectionSegment = {
  label: string;
  value: number;
  color: string;
  duration?: number;
  percent: number;
};

function DirectionTooltip({ active, payload }: CustomTooltipProps<DirectionSegment>) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 shadow-lg text-xs space-y-1 pointer-events-none">
      <div className="flex items-center gap-2 font-semibold text-[#08246B] dark:text-white">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
        <span>{item.label}</span>
      </div>
      <p className="font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
        {item.value} {item.value === 1 ? 'call' : 'calls'} ({item.percent}%)
      </p>
      {item.duration !== undefined && item.duration > 0 && (
        <p className="font-mono tabular-nums text-[#FF6A00] font-semibold">
          {formatDuration(item.duration)} talk time
        </p>
      )}
    </div>
  );
}

export function DirectionSplitChart({
  incoming,
  outgoing,
  missed,
  incomingDuration,
  outgoingDuration,
}: {
  incoming: number;
  outgoing: number;
  missed: number;
  incomingDuration?: number;
  outgoingDuration?: number;
}) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const total = incoming + outgoing + missed;
  if (total === 0) return null;

  const segments: DirectionSegment[] = [
    {
      label: 'Incoming',
      value: incoming,
      color: '#4FA3F7',
      duration: incomingDuration,
      percent: Math.round((incoming / total) * 100),
    },
    {
      label: 'Outgoing',
      value: outgoing,
      color: '#FF6A00',
      duration: outgoingDuration,
      percent: Math.round((outgoing / total) * 100),
    },
    {
      label: 'Missed',
      value: missed,
      color: '#EF4444',
      duration: undefined,
      percent: Math.round((missed / total) * 100),
    },
  ];

  const pieData = segments.filter((s) => s.value > 0);
  const activeSeg = segments.find((s) => s.label === selectedLabel) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative shrink-0 w-[164px] h-[164px] outline-none select-none [&_*]:outline-none">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={pieData.length > 1 ? 2 : 0}
                stroke="none"
                isAnimationActive={!prefersReducedMotion}
                onClick={(_, idx) => {
                  const seg = pieData[idx];
                  if (seg) {
                    setSelectedLabel((prev) => (prev === seg.label ? null : seg.label));
                  }
                }}
              >
                {pieData.map((seg) => {
                  const isSelected = selectedLabel === seg.label;
                  const isDimmed = selectedLabel !== null && !isSelected;
                  return (
                    <Cell
                      key={seg.label}
                      fill={seg.color}
                      opacity={isDimmed ? 0.35 : 1}
                      className="cursor-pointer focus:outline-none"
                    />
                  );
                })}
              </Pie>
              <Tooltip
                wrapperStyle={{ zIndex: 30, outline: 'none' }}
                content={(props) => <DirectionTooltip {...(props as CustomTooltipProps<DirectionSegment>)} />}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <AnimatePresence mode="wait" initial={false}>
              {activeSeg ? (
                <motion.div
                  key={activeSeg.label}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
                  className="flex flex-col items-center"
                >
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: activeSeg.color }}
                  >
                    {activeSeg.label}
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-[#08246B] dark:text-white leading-tight">
                    {activeSeg.value}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {activeSeg.percent}%
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="total"
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                  transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
                  className="flex flex-col items-center"
                >
                  <span className="text-2xl font-bold tabular-nums text-[#08246B] dark:text-white leading-tight">
                    {total}
                  </span>
                  <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    calls
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 w-full space-y-2">
          {segments.map((seg) => {
            const isSelected = selectedLabel === seg.label;
            const isDimmed = selectedLabel !== null && !isSelected;
            return (
              <motion.button
                key={seg.label}
                type="button"
                onClick={() =>
                  setSelectedLabel((prev) => (prev === seg.label ? null : seg.label))
                }
                whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
                animate={{ opacity: isDimmed ? 0.55 : 1 }}
                transition={{ duration: 0.18 }}
                aria-pressed={isSelected}
                className={`w-full text-left rounded-xl px-2.5 py-2 transition-colors border ${
                  isSelected
                    ? 'bg-[#EEF2F6] dark:bg-[var(--dark-elevated)] border-[#FF6A00]/60'
                    : 'border-transparent hover:bg-[#EEF2F6]/60 dark:hover:bg-[var(--dark-elevated-60)]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-[#08246B] dark:text-white">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      {seg.label}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      {seg.value} · {seg.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#E5E9F0] dark:bg-[var(--dark-canvas)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={prefersReducedMotion ? { width: `${seg.percent}%` } : { width: 0 }}
                      animate={{ width: `${seg.percent}%` }}
                      transition={{ duration: prefersReducedMotion ? 0.1 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                      style={{ backgroundColor: seg.color }}
                    />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {activeSeg ? (
          <motion.div
            key={`status-${activeSeg.label}`}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, height: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeSeg.color }}
                />
                <span className="font-semibold text-[#08246B] dark:text-white">
                  {activeSeg.label} status:
                </span>
                <span className="font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  {activeSeg.value} of {total} calls ({activeSeg.percent}%)
                  {activeSeg.duration !== undefined && activeSeg.duration > 0
                    ? ` · ${formatDuration(activeSeg.duration)} talk time`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLabel(null)}
                aria-label="Clear slice selection"
                className="p-1 rounded-lg text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ) : (
          <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
            Hover or tap any slice to inspect call details
          </p>
        )}
      </AnimatePresence>
    </div>
  );
}

function FrequencyTooltip({ active, payload }: CustomTooltipProps<DailyBucket>) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 shadow-lg text-xs space-y-1.5 pointer-events-none min-w-[160px]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[#08246B] dark:text-white">{bucket.label}</span>
        <span className="font-mono tabular-nums font-semibold text-[#FF6A00]">
          {bucket.count} {bucket.count === 1 ? 'call' : 'calls'}
        </span>
      </div>
      <p className="font-mono tabular-nums text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
        Talk time: {formatDuration(bucket.duration)}
      </p>
      <div className="pt-1 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#4FA3F7] shrink-0" />
          {bucket.incoming}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#FF6A00] shrink-0" />
          {bucket.outgoing}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#EF4444] shrink-0" />
          {bucket.missed}
        </span>
      </div>
    </div>
  );
}

export function FrequencyBarChart({ buckets }: { buckets: DailyBucket[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  if (buckets.length === 0) return null;
  const selectedBucket = buckets.find((b) => b.key === selectedKey) ?? null;

  const handleBarSelect = (bucket?: DailyBucket) => {
    if (!bucket) return;
    setSelectedKey((prev) => (prev === bucket.key ? null : bucket.key));
  };

  return (
    <div className="space-y-3">
      <div className="w-full h-52 outline-none select-none [&_*]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={buckets}
            margin={{ top: 8, right: 6, left: -18, bottom: 0 }}
            onClick={(state) => {
              const label = state?.activeLabel;
              if (label !== undefined) {
                const match = buckets.find((b) => b.label === String(label));
                handleBarSelect(match);
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(138, 147, 160, 0.22)"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#8A93A0' }}
              axisLine={{ stroke: 'rgba(138, 147, 160, 0.3)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#8A93A0' }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 106, 0, 0.08)' }}
              wrapperStyle={{ zIndex: 30, outline: 'none' }}
              content={(props) => (
                <FrequencyTooltip {...(props as CustomTooltipProps<DailyBucket>)} />
              )}
            />
            <Bar
              dataKey="incoming"
              name="Incoming"
              stackId="calls"
              fill="#4FA3F7"
              isAnimationActive={!prefersReducedMotion}
              maxBarSize={28}
            />
            <Bar
              dataKey="outgoing"
              name="Outgoing"
              stackId="calls"
              fill="#FF6A00"
              isAnimationActive={!prefersReducedMotion}
              maxBarSize={28}
            />
            <Bar
              dataKey="missed"
              name="Missed"
              stackId="calls"
              fill="#EF4444"
              radius={[5, 5, 0, 0]}
              isAnimationActive={!prefersReducedMotion}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#4FA3F7]" />
          Incoming
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#FF6A00]" />
          Outgoing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" />
          Missed
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {selectedBucket ? (
          <motion.div
            key={selectedBucket.key}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#08246B] dark:text-white">
                  {selectedBucket.label}
                </span>
                <span className="font-mono tabular-nums text-[#FF6A00] font-semibold">
                  {selectedBucket.count} {selectedBucket.count === 1 ? 'call' : 'calls'} ·{' '}
                  {formatDuration(selectedBucket.duration)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#4FA3F7]" />
                  In: {selectedBucket.incoming}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#FF6A00]" />
                  Out: {selectedBucket.outgoing}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                  Missed: {selectedBucket.missed}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              aria-label="Clear day selection"
              className="p-1 rounded-lg text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        ) : (
          <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
            Hover or tap any day bar to inspect breakdown
          </p>
        )}
      </AnimatePresence>
    </div>
  );
}

type DurationPoint = DailyBucket & {
  minutes: number;
};

function DurationTrendTooltip({ active, payload }: CustomTooltipProps<DurationPoint>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const answered = point.incoming + point.outgoing;
  const avgSec = answered > 0 ? Math.round(point.duration / answered) : 0;

  return (
    <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 shadow-lg text-xs space-y-1 pointer-events-none min-w-[165px]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[#08246B] dark:text-white">{point.label}</span>
        <span className="font-mono tabular-nums font-semibold text-[#FF6A00]">
          {formatDuration(point.duration)}
        </span>
      </div>
      <p className="font-mono tabular-nums text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
        {point.count} {point.count === 1 ? 'call' : 'calls'}
        {avgSec > 0 ? ` · Avg ${formatDuration(avgSec)}` : ''}
      </p>
      <p className="font-mono tabular-nums text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
        In {point.incoming} · Out {point.outgoing} · Missed {point.missed}
      </p>
    </div>
  );
}

export function DurationTrendChart({ buckets }: { buckets: DailyBucket[] }) {
  const prefersReducedMotion = useReducedMotion();
  const gradientId = useId();

  if (buckets.length === 0) return null;

  const data: DurationPoint[] = buckets.map((b) => ({
    ...b,
    minutes: Number((b.duration / 60).toFixed(1)),
  }));

  return (
    <div className="space-y-2">
      <div className="w-full h-52 outline-none select-none [&_*]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart accessibilityLayer={false} data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF6A00" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#FF6A00" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(138, 147, 160, 0.22)"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#8A93A0' }}
              axisLine={{ stroke: 'rgba(138, 147, 160, 0.3)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#8A93A0' }}
              axisLine={false}
              tickLine={false}
              width={36}
              unit="m"
            />
            <Tooltip
              wrapperStyle={{ zIndex: 30, outline: 'none' }}
              content={(props) => (
                <DurationTrendTooltip {...(props as CustomTooltipProps<DurationPoint>)} />
              )}
            />
            <Area
              type="monotone"
              dataKey="minutes"
              name="Talk time"
              stroke="#FF6A00"
              strokeWidth={2.2}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              dot={{ r: 3.5, fill: '#FF6A00', stroke: '#FFFFFF', strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: '#FF6A00', stroke: '#FFFFFF', strokeWidth: 2 }}
              isAnimationActive={!prefersReducedMotion}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
        Hover or tap any data point to inspect daily talk time
      </p>
    </div>
  );
}

const CARRIER_COLORS = ['#FF6A00', '#4FA3F7', '#5BC6B6', '#8B5CF6'];

function CarrierTooltip({
  active,
  payload,
  formatCurrency,
}: CustomTooltipProps<CarrierStat> & { formatCurrency: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 shadow-lg text-xs space-y-1 pointer-events-none">
      <p className="font-semibold text-[#08246B] dark:text-white">{item.carrier}</p>
      <p className="font-mono tabular-nums text-[#FF6A00] font-semibold">
        {item.count} {item.count === 1 ? 'call' : 'calls'} · {formatCurrency(item.spendEtb)}
      </p>
      <p className="font-mono tabular-nums text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
        {formatDuration(item.duration)} talk time
      </p>
    </div>
  );
}

export function CarrierUsageChart({
  carriers,
  formatCurrency,
}: {
  carriers: CarrierStat[];
  formatCurrency: (n: number) => string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (carriers.length === 0) return null;

  const chartHeight = Math.max(132, carriers.length * 46);

  return (
    <div className="space-y-3">
      <div className="w-full outline-none select-none [&_*]:outline-none" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            layout="vertical"
            data={carriers}
            margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="rgba(138, 147, 160, 0.22)"
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#8A93A0' }}
              axisLine={{ stroke: 'rgba(138, 147, 160, 0.3)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="carrier"
              width={112}
              tick={{ fontSize: 11, fill: '#8A93A0' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 106, 0, 0.08)' }}
              wrapperStyle={{ zIndex: 30, outline: 'none' }}
              content={(props) => (
                <CarrierTooltip
                  {...(props as CustomTooltipProps<CarrierStat>)}
                  formatCurrency={formatCurrency}
                />
              )}
            />
            <Bar
              dataKey="count"
              name="Calls"
              radius={[0, 6, 6, 0]}
              maxBarSize={24}
              isAnimationActive={!prefersReducedMotion}
            >
              {carriers.map((item, idx) => (
                <Cell
                  key={item.carrier}
                  fill={CARRIER_COLORS[idx % CARRIER_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
        {carriers.map((item, idx) => (
          <span key={item.carrier} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: CARRIER_COLORS[idx % CARRIER_COLORS.length] }}
            />
            <span>
              {item.carrier}: {item.count} ({formatCurrency(item.spendEtb)})
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BLOCKS = ['12a–6a', '6a–12p', '12p–6p', '6p–12a'];

export function PeakHoursHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const [selectedCell, setSelectedCell] = useState<{ day: number; block: number } | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  const activeCell = selectedCell
    ? cells.find((c) => c.day === selectedCell.day && c.block === selectedCell.block) ?? null
    : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[320px] space-y-2">
          <div className="grid grid-cols-[44px_repeat(4,1fr)] gap-1.5 text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
            <div />
            {BLOCKS.map((block) => (
              <div key={block} className="text-center font-mono tabular-nums">
                {block}
              </div>
            ))}
          </div>
          {DAYS.map((dayName, dayIdx) => (
            <div key={dayName} className="grid grid-cols-[44px_repeat(4,1fr)] gap-1.5 items-center">
              <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                {dayName}
              </span>
              {[0, 1, 2, 3].map((blockIdx) => {
                const cell = cells.find((c) => c.day === dayIdx && c.block === blockIdx);
                const count = cell?.count ?? 0;
                const ratio = count / maxCount;
                const opacity = count === 0 ? 0.08 : 0.25 + ratio * 0.75;
                const isSelected =
                  selectedCell?.day === dayIdx && selectedCell?.block === blockIdx;

                return (
                  <motion.button
                    key={blockIdx}
                    type="button"
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
                    animate={
                      isSelected && !prefersReducedMotion ? { scale: 1.04 } : { scale: 1 }
                    }
                    transition={{ duration: 0.15 }}
                    onClick={() =>
                      setSelectedCell((prev) =>
                        prev?.day === dayIdx && prev?.block === blockIdx
                          ? null
                          : { day: dayIdx, block: blockIdx },
                      )
                    }
                    className={`h-8 rounded-lg flex items-center justify-center text-xs font-mono tabular-nums transition-shadow ${
                      isSelected ? 'ring-2 ring-[#FF6A00]' : ''
                    }`}
                    style={{
                      backgroundColor:
                        count === 0 ? 'rgba(122, 139, 168, 0.14)' : `rgba(255, 106, 0, ${opacity})`,
                      color: ratio > 0.55 ? '#FFFFFF' : undefined,
                    }}
                    title={`${dayName} ${BLOCKS[blockIdx]}: ${count} calls`}
                    aria-pressed={isSelected}
                  >
                    {count > 0 ? count : '–'}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {selectedCell && (
          <motion.div
            key={`${selectedCell.day}-${selectedCell.block}`}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
            className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
          >
            <span className="font-mono tabular-nums text-[#08246B] dark:text-white">
              <strong className="font-sans">{DAYS[selectedCell.day]}</strong>{' '}
              {BLOCKS[selectedCell.block]} ·{' '}
              <span className="text-[#FF6A00] font-semibold">
                {activeCell?.count ?? 0} {(activeCell?.count ?? 0) === 1 ? 'call' : 'calls'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedCell(null)}
              aria-label="Clear heatmap selection"
              className="p-1 rounded-lg text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HorizontalUsageBar({
  label,
  valueLabel,
  subLabel,
  percent,
  color = '#FF6A00',
}: {
  label: string;
  valueLabel: string;
  subLabel?: string;
  percent: number;
  color?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, percent));
  const targetWidth = `${Math.max(clamped, clamped > 0 ? 4 : 0)}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-medium text-[#08246B] dark:text-white break-words">
          {label}
        </span>
        <span className="text-xs font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] whitespace-nowrap shrink-0">
          {valueLabel}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#E5E9F0] dark:bg-[var(--dark-canvas)] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={prefersReducedMotion ? { width: targetWidth } : { width: 0 }}
          animate={{ width: targetWidth }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ backgroundColor: color }}
        />
      </div>
      {subLabel && (
        <p className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)] tabular-nums">{subLabel}</p>
      )}
    </div>
  );
}
