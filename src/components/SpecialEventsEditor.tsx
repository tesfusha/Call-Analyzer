import { useMemo } from 'react';
import { CalendarPlus, Heart, Plus, Trash2 } from 'lucide-react';
import { CustomSelect } from '@/src/components/CustomSelect';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { daysUntilAnnualDate } from '@/src/lib/contacts';
import { getEthiopianMonthName } from '@/src/lib/ethiopianCalendar';
import type { CalendarKind, ContactEvent } from '@/src/types/call';

const GREGORIAN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const EVENT_PRESETS = [
  'Anniversary',
  'Wedding Anniversary',
  'Work Anniversary',
  'Graduation',
  'Name Day',
] as const;

export function formatSpecialEventDate(
  month: number,
  day: number,
  calendar: CalendarKind,
  year?: number,
): string {
  const monthLabel =
    calendar === 'ethiopian'
      ? getEthiopianMonthName(month, 'english')
      : (GREGORIAN_MONTHS[month - 1] ?? `Month ${month}`);
  const suffix = calendar === 'ethiopian' ? ' EC' : '';
  return `${monthLabel} ${day}${year ? `, ${year}` : ''}${suffix}`;
}

export function SpecialEventsEditor({
  events,
  onRemoveEvent,
  newTitle,
  onNewTitleChange,
  newCalendar,
  onNewCalendarChange,
  newMonth,
  onNewMonthChange,
  newDay,
  onNewDayChange,
  onAddEvent,
  variant = 'surface',
  hideHeader = false,
}: {
  events: ContactEvent[];
  onRemoveEvent: (id: string) => void;
  newTitle: string;
  onNewTitleChange: (title: string) => void;
  newCalendar: CalendarKind;
  onNewCalendarChange: (cal: CalendarKind) => void;
  newMonth: number;
  onNewMonthChange: (month: number) => void;
  newDay: number;
  onNewDayChange: (day: number) => void;
  onAddEvent: () => void;
  variant?: 'surface' | 'inset';
  hideHeader?: boolean;
}) {
  const maxMonth = newCalendar === 'ethiopian' ? 13 : 12;
  const maxDay =
    newCalendar === 'ethiopian' ? (newMonth === 13 ? 6 : 30) : 31;

  const clampedDay = Math.max(1, Math.min(maxDay, newDay));

  const monthOptions = useMemo(
    () =>
      Array.from({ length: maxMonth }, (_, idx) => idx + 1).map((m) => ({
        value: String(m),
        label:
          newCalendar === 'ethiopian'
            ? getEthiopianMonthName(m, 'english')
            : GREGORIAN_MONTHS[m - 1],
      })),
    [maxMonth, newCalendar],
  );

  const dayOptions = useMemo(
    () =>
      Array.from({ length: maxDay }, (_, idx) => idx + 1).map((d) => ({
        value: String(d),
        label: `Day ${d}`,
      })),
    [maxDay],
  );

  const cardSurface =
    variant === 'inset'
      ? 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)]'
      : 'bg-white dark:bg-[var(--dark-surface)]';

  const inputSurface =
    variant === 'inset'
      ? 'bg-white dark:bg-[var(--dark-surface)]'
      : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)]';

  return (
    <div className={hideHeader ? 'space-y-3' : 'space-y-3 pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)]'}>
      {!hideHeader && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              <CalendarPlus size={14} />
            </div>
            <div>
              <span className="block text-xs font-bold text-[#08246B] dark:text-white">
                Special Events &amp; Anniversaries
              </span>
              <span className="block text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Tap a preset or pick any Ethiopian / Gregorian annual date
              </span>
            </div>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] tabular-nums shrink-0">
            {events.length}
          </span>
        </div>
      )}

      {/* Saved Events Cards */}
      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((evt) => {
            const days = daysUntilAnnualDate(evt.month, evt.day, evt.calendar);
            return (
              <div
                key={evt.id}
                className={`rounded-xl ${cardSurface} border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2.5 flex items-center justify-between gap-2.5`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Heart size={14} className="text-[#FF6A00] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                      {evt.title}
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                      {formatSpecialEventDate(evt.month, evt.day, evt.calendar, evt.year)}
                      {' · '}
                      <span className="font-semibold text-[#FF6A00]">
                        {days === 0 ? 'Today!' : `in ${days}d`}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveEvent(evt.id)}
                  aria-label={`Remove ${evt.title}`}
                  className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 shrink-0 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modern Composer Card */}
      <div
        className={`rounded-2xl ${cardSurface} border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-3`}
      >
        {/* Quick Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] flex items-center gap-1">
            <FlaticonIcon name="fi-rr-party-horn" className="text-[11px] text-[#FF6A00]" />
            Quick presets
          </span>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_PRESETS.map((preset) => {
              const active = newTitle.trim().toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onNewTitleChange(preset)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#FF6A00] text-white'
                      : `${inputSurface} border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]`
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>

        {/* Title + Calendar Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => onNewTitleChange(e.target.value)}
            placeholder="Event or anniversary title..."
            className={`w-full min-h-[42px] rounded-xl ${inputSurface} border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]`}
          />
          <div
            className={`grid grid-cols-2 gap-1 p-1 rounded-xl ${inputSurface} border border-[#DDE4EA] dark:border-[var(--dark-border)]`}
          >
            {(['ethiopian', 'gregorian'] as const).map((cal) => (
              <button
                key={cal}
                type="button"
                onClick={() => {
                  onNewCalendarChange(cal);
                  if (cal === 'gregorian' && newMonth > 12) onNewMonthChange(12);
                }}
                className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  newCalendar === cal
                    ? 'bg-[#FF6A00] text-white'
                    : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                }`}
              >
                {cal === 'ethiopian' ? 'Ethiopian' : 'Gregorian'}
              </button>
            ))}
          </div>
        </div>

        {/* Month + Day Selectors + Add Button */}
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_110px_auto] gap-2">
          <CustomSelect
            ariaLabel="Event month"
            value={String(Math.min(maxMonth, newMonth))}
            variant={variant === 'inset' ? 'surface' : 'inset'}
            fullWidth
            compact
            options={monthOptions}
            onChange={(val) => onNewMonthChange(Number(val))}
          />
          <CustomSelect
            ariaLabel="Event day"
            value={String(clampedDay)}
            variant={variant === 'inset' ? 'surface' : 'inset'}
            fullWidth
            compact
            options={dayOptions}
            onChange={(val) => onNewDayChange(Number(val))}
          />
          <button
            type="button"
            disabled={!newTitle.trim()}
            onClick={onAddEvent}
            className="col-span-2 sm:col-span-1 min-h-[40px] px-4 py-2 rounded-xl bg-[#08246B] hover:bg-[#0D328E] dark:bg-[#FF6A00] dark:hover:bg-[#E65F00] disabled:opacity-45 text-xs font-semibold text-white flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <Plus size={14} />
            Add Event
          </button>
        </div>
      </div>
    </div>
  );
}
