import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { DatePickerField } from '@/src/components/DateTimePicker';
import { triggerHaptic } from '@/src/lib/haptics';
import {
  formatScheduleSummary,
  nextOccurrenceAtHour,
  toDateTimeLocalValue,
  tomorrowAtHour,
} from '@/src/lib/schedule';

type PresetKey = '15m' | '1h' | 'evening' | 'tomorrow' | 'custom';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseDateTimeOrNow(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (m) {
    const dt = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      0,
      0,
    );
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return new Date(Date.now() + 60 * 60_000);
}

export function SimpleScheduleTimePicker({
  value,
  onChange,
  variant = 'inset',
  ariaLabel = 'Scheduled date and time',
  resetKey,
}: {
  value: string;
  onChange: (value: string) => void;
  variant?: 'surface' | 'inset';
  ariaLabel?: string;
  resetKey?: string | number | boolean;
}) {
  const [activePreset, setActivePreset] = useState<PresetKey>('1h');
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    setActivePreset('1h');
    setCustomOpen(false);
  }, [resetKey]);

  const currentDate = useMemo(() => parseDateTimeOrNow(value), [value]);
  const parsedMs = currentDate.getTime();

  const hours24 = currentDate.getHours();
  const isPm = hours24 >= 12;
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minute = currentDate.getMinutes();

  const ymdValue = `${currentDate.getFullYear()}-${pad2(currentDate.getMonth() + 1)}-${pad2(
    currentDate.getDate(),
  )}`;

  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYmd = `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(
    tomorrow.getDate(),
  )}`;

  const updateDate = (next: Date) => {
    setActivePreset('custom');
    onChange(toDateTimeLocalValue(next.getTime()));
  };

  const setDayFromYmd = (ymd: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return;
    const next = new Date(currentDate);
    next.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    updateDate(next);
  };

  const setHour12 = (nextHour12: number) => {
    const clamped = ((nextHour12 - 1 + 12) % 12) + 1;
    const h24 = isPm ? (clamped === 12 ? 12 : clamped + 12) : clamped === 12 ? 0 : clamped;
    const next = new Date(currentDate);
    next.setHours(h24);
    updateDate(next);
  };

  const setMinuteVal = (nextMin: number) => {
    const clamped = ((nextMin % 60) + 60) % 60;
    const next = new Date(currentDate);
    next.setMinutes(clamped);
    updateDate(next);
  };

  const setPeriod = (pm: boolean) => {
    if (pm === isPm) return;
    const next = new Date(currentDate);
    next.setHours(pm ? (hours24 % 12) + 12 : hours24 % 12);
    updateDate(next);
  };

  const presets: Array<{ key: Exclude<PresetKey, 'custom'>; label: string; getTs: () => number }> = [
    { key: '15m', label: 'In 15m', getTs: () => Date.now() + 15 * 60_000 },
    { key: '1h', label: 'In 1h', getTs: () => Date.now() + 60 * 60_000 },
    { key: 'evening', label: '6:00 PM', getTs: () => nextOccurrenceAtHour(18, 0) },
    { key: 'tomorrow', label: 'Tomorrow 9 AM', getTs: () => tomorrowAtHour(9) },
  ];

  const inactiveBtn =
    variant === 'inset'
      ? 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]/70'
      : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]/70';

  const cardSurface =
    variant === 'inset'
      ? 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)]'
      : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)]';

  const innerControl =
    variant === 'inset'
      ? 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)]'
      : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)]';

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => {
          const isSelected = activePreset === preset.key && !customOpen;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                setActivePreset(preset.key);
                setCustomOpen(false);
                onChange(toDateTimeLocalValue(preset.getTs()));
              }}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                isSelected ? 'bg-[#FF6A00] border-[#FF6A00] text-white' : inactiveBtn
              }`}
            >
              {preset.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            triggerHaptic('tap');
            setActivePreset('custom');
            setCustomOpen((prev) => !prev);
          }}
          className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
            customOpen || activePreset === 'custom'
              ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#FF6A00]'
              : inactiveBtn
          }`}
        >
          <Calendar size={13} className="shrink-0" />
          Custom
        </button>
      </div>

      {customOpen && (
        <div
          aria-label={ariaLabel}
          className={`rounded-2xl border p-3.5 space-y-3 ${cardSurface}`}
        >
          {/* Date Row */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Date
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  setDayFromYmd(todayYmd);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                  ymdValue === todayYmd
                    ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                    : `${innerControl} text-[#08246B] dark:text-white hover:border-[#FF6A00]/60`
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  setDayFromYmd(tomorrowYmd);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                  ymdValue === tomorrowYmd
                    ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                    : `${innerControl} text-[#08246B] dark:text-white hover:border-[#FF6A00]/60`
                }`}
              >
                Tomorrow
              </button>
              <div className="flex-1 min-w-[138px]">
                <DatePickerField
                  value={ymdValue}
                  minDate={todayYmd}
                  onChange={setDayFromYmd}
                  variant={variant === 'inset' ? 'surface' : 'inset'}
                  ariaLabel="Pick custom date"
                />
              </div>
            </div>
          </div>

          {/* Time Row */}
          <div className="pt-2.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Time
              </span>
              <span className="text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                {pad2(hour12)}:{pad2(minute)} {isPm ? 'PM' : 'AM'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className={`flex items-center rounded-xl border px-1 py-0.5 ${innerControl}`}>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tap');
                      setHour12(hour12 - 1);
                    }}
                    aria-label="Decrease hour"
                    className="w-8 h-8 rounded-lg text-sm font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00]"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                    {pad2(hour12)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tap');
                      setHour12(hour12 + 1);
                    }}
                    aria-label="Increase hour"
                    className="w-8 h-8 rounded-lg text-sm font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00]"
                  >
                    +
                  </button>
                </div>

                <span className="text-sm font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  :
                </span>

                <div className={`flex items-center rounded-xl border px-1 py-0.5 ${innerControl}`}>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tap');
                      setMinuteVal(minute - 5);
                    }}
                    aria-label="Decrease minutes"
                    className="w-8 h-8 rounded-lg text-sm font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00]"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                    {pad2(minute)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tap');
                      setMinuteVal(minute + 5);
                    }}
                    aria-label="Increase minutes"
                    className="w-8 h-8 rounded-lg text-sm font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className={`grid grid-cols-2 p-0.5 rounded-xl border shrink-0 ${innerControl}`}>
                {(['AM', 'PM'] as const).map((period) => {
                  const active = (period === 'PM') === isPm;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setPeriod(period === 'PM');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        active
                          ? 'bg-[#FF6A00] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {period}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
              {[0, 15, 30, 45].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    triggerHaptic('tap');
                    setMinuteVal(m);
                  }}
                  className={`min-h-[34px] rounded-lg border text-xs font-mono font-semibold tabular-nums transition-colors ${
                    minute === m
                      ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#FF6A00]'
                      : `${innerControl} text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white`
                  }`}
                >
                  :{pad2(m)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
        <Clock size={12} className="text-[#FF6A00] shrink-0" />
        <span>{formatScheduleSummary(parsedMs)}</span>
      </p>
    </div>
  );
}
