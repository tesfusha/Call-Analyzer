import { DatePickerField } from '@/src/components/DateTimePicker';
import {
  formatIsoDateDual,
  getEthiopianMonthGregorianBounds,
  toEthiopianDate,
  toIsoYmd,
} from '@/src/lib/ethiopianCalendar';
import type { DateRangeFilter, TimeRange } from '@/src/types/call';

const PRESETS: Array<{ value: TimeRange; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'year', label: '1y' },
  { value: 'custom', label: 'Custom' },
];

export function DateRangePicker({
  range,
  customRange,
  onChangeRange,
  onChangeCustomRange,
}: {
  range: TimeRange;
  customRange: DateRangeFilter;
  onChangeRange: (next: TimeRange) => void;
  onChangeCustomRange: (next: DateRangeFilter) => void;
}) {
  const today = new Date();
  const ecToday = toEthiopianDate(today);
  const thisEcMonth = getEthiopianMonthGregorianBounds(ecToday.year, ecToday.month);
  const prevEcMonth =
    ecToday.month === 1
      ? getEthiopianMonthGregorianBounds(ecToday.year - 1, 13)
      : getEthiopianMonthGregorianBounds(ecToday.year, ecToday.month - 1);

  const startValue = customRange?.start ?? toIsoYmd(new Date(today.getTime() - 14 * 86_400_000));
  const endValue = customRange?.end ?? toIsoYmd(today);

  const selectPreset = (nextRange: TimeRange) => {
    if (nextRange === 'custom' && !customRange) {
      onChangeCustomRange({ start: startValue, end: endValue });
    }
    onChangeRange(nextRange);
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-6 items-center gap-1 p-1 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
        {PRESETS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => selectPreset(item.value)}
            className={`min-h-[36px] px-1.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center whitespace-nowrap transition-colors ${
              range === item.value
                ? 'bg-[#FF6A00] text-white'
                : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#08246B] dark:text-white">
              Custom date window
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onChangeCustomRange({ start: thisEcMonth.start, end: thisEcMonth.end })
                }
                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-medium text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0"
              >
                {thisEcMonth.label}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeCustomRange({ start: prevEcMonth.start, end: prevEcMonth.end })
                }
                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-medium text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0"
              >
                {prevEcMonth.label}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">From date</span>
              <DatePickerField
                value={startValue}
                maxDate={endValue || undefined}
                onChange={(nextStart) =>
                  onChangeCustomRange({ start: nextStart, end: endValue })
                }
                ariaLabel="From date"
                variant="inset"
              />
              {startValue && (
                <span className="block text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] tabular-nums">
                  {formatIsoDateDual(startValue)}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">To date</span>
              <DatePickerField
                value={endValue}
                minDate={startValue || undefined}
                onChange={(nextEnd) =>
                  onChangeCustomRange({ start: startValue, end: nextEnd })
                }
                ariaLabel="To date"
                variant="inset"
              />
              {endValue && (
                <span className="block text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] tabular-nums">
                  {formatIsoDateDual(endValue)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
