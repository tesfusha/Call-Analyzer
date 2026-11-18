import { useEffect, useMemo, useState } from 'react';
import {
  Cake,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import { CustomSelect } from '@/src/components/CustomSelect';
import {
  formatEthiopianDate,
  getEthiopianMonthCalendar,
  getEthiopianMonthName,
  getHolidaysInGregorianYearOrUpcoming,
  toEthiopianDate,
  type CalendarGridCell,
  type CalendarLang,
} from '@/src/lib/ethiopianCalendar';
import { dayKey, formatDuration, formatTime } from '@/src/lib/format';
import { formatScheduledCountdown } from '@/src/lib/schedule';
import { maskPhoneNumber } from '@/src/lib/security';
import { useCalls } from '@/src/store/CallsContext';
import type { CallRecord, ScheduledCall } from '@/src/types/call';

const MONTHS_1_TO_13 = Array.from({ length: 13 }, (_, idx) => idx + 1);

type CalendarCategory = 'month' | 'holidays' | 'prefs';

const CALENDAR_META: Record<CalendarCategory, { title: string; description: string }> = {
  month: {
    title: 'Ethiopian Month & Daily Activity',
    description: '13-month Ethiopian calendar grid with daily calls, birthdays, and schedules',
  },
  holidays: {
    title: 'Upcoming Ethiopian Holidays',
    description: 'Upcoming Ethiopian holidays with EC & GC dates and wish templates',
  },
  prefs: {
    title: 'Calendar Language & Numerals',
    description: 'Switch calendar language (English / አማርኛ), Geez numerals, and date jump',
  },
};

export function EthiopianCalendarView({
  onSelectCall,
  onSelectContact,
  onOpenWishes,
}: {
  onSelectCall: (call: CallRecord) => void;
  onSelectContact: (number: string) => void;
  onOpenWishes: () => void;
}) {
  const { calls, contacts, scheduledCalls, calendarPrefs, privacyMode } = useCalls();
  const todayEc = useMemo(() => toEthiopianDate(new Date()), []);

  const [activeCategory, setActiveCategory] = useState<CalendarCategory>('month');
  const [viewYear, setViewYear] = useState(todayEc.year);
  const [viewMonth, setViewMonth] = useState(todayEc.month);
  const [lang, setLang] = useState<CalendarLang>(calendarPrefs.defaultLang);
  const [useGeez, setUseGeez] = useState(calendarPrefs.defaultGeezNumerals);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => dayKey(Date.now()));

  useEffect(() => {
    setLang(calendarPrefs.defaultLang);
    setUseGeez(calendarPrefs.defaultGeezNumerals);
  }, [calendarPrefs.defaultLang, calendarPrefs.defaultGeezNumerals]);

  const grid = useMemo(
    () => getEthiopianMonthCalendar(viewYear, viewMonth, { lang, useGeez }),
    [viewYear, viewMonth, lang, useGeez],
  );

  // Index calls by Gregorian YYYY-MM-DD
  const callsByDay = useMemo(() => {
    const map = new Map<string, CallRecord[]>();
    calls.forEach((c) => {
      const k = dayKey(c.timestamp);
      const list = map.get(k) ?? [];
      list.push(c);
      map.set(k, list);
    });
    return map;
  }, [calls]);

  // Index pending scheduled calls by Gregorian YYYY-MM-DD
  const scheduledByDay = useMemo(() => {
    const map = new Map<string, ScheduledCall[]>();
    scheduledCalls
      .filter((s) => s.status === 'pending')
      .forEach((s) => {
        const k = dayKey(s.scheduledFor);
        const list = map.get(k) ?? [];
        list.push(s);
        map.set(k, list);
      });
    return map;
  }, [scheduledCalls]);

  // Index contact birthdays/events by both Gregorian (MM-DD) and Ethiopian (ec-MM-DD)
  const eventsByCell = useMemo(() => {
    const gcMap = new Map<string, Array<{ name: string; number: string; label: string; tag: string }>>();
    const ecMap = new Map<string, Array<{ name: string; number: string; label: string; tag: string }>>();

    Object.values(contacts).forEach((profile) => {
      const display = profile.name || profile.number;
      if (profile.birthday) {
        const key = `${profile.birthday.month}-${profile.birthday.day}`;
        const entry = {
          name: display,
          number: profile.number,
          label: `${display}'s Birthday`,
          tag: profile.tag,
        };
        const target = profile.birthday.calendar === 'ethiopian' ? ecMap : gcMap;
        target.set(key, [...(target.get(key) ?? []), entry]);
      }
      profile.events.forEach((evt) => {
        const key = `${evt.month}-${evt.day}`;
        const entry = {
          name: display,
          number: profile.number,
          label: `${display}: ${evt.title}`,
          tag: profile.tag,
        };
        const target = evt.calendar === 'ethiopian' ? ecMap : gcMap;
        target.set(key, [...(target.get(key) ?? []), entry]);
      });
    });

    return { gcMap, ecMap };
  }, [contacts]);

  const cellKeyFromGc = (gc: { year: number; month: number; day: number }) =>
    `${gc.year}-${String(gc.month).padStart(2, '0')}-${String(gc.day).padStart(2, '0')}`;

  const selectedCell: CalendarGridCell | null = useMemo(() => {
    for (const cell of grid.days) {
      if (!cell) continue;
      if (cellKeyFromGc(cell.gregorian) === selectedDayKey) return cell;
    }
    return grid.days.find((d): d is CalendarGridCell => d !== null) ?? null;
  }, [grid.days, selectedDayKey]);

  const selectedCellCalls = useMemo(() => {
    if (!selectedCell) return [];
    const k = cellKeyFromGc(selectedCell.gregorian);
    return [...(callsByDay.get(k) ?? [])].sort((a, b) => b.timestamp - a.timestamp);
  }, [selectedCell, callsByDay]);

  const selectedCellScheduled = useMemo(() => {
    if (!selectedCell) return [];
    const k = cellKeyFromGc(selectedCell.gregorian);
    return [...(scheduledByDay.get(k) ?? [])].sort((a, b) => a.scheduledFor - b.scheduledFor);
  }, [selectedCell, scheduledByDay]);

  const selectedCellEvents = useMemo(() => {
    if (!selectedCell) return [];
    const ecKey = `${selectedCell.ethiopian.month}-${selectedCell.ethiopian.day}`;
    const gcKey = `${selectedCell.gregorian.month}-${selectedCell.gregorian.day}`;
    return [
      ...(eventsByCell.ecMap.get(ecKey) ?? []),
      ...(eventsByCell.gcMap.get(gcKey) ?? []),
    ];
  }, [selectedCell, eventsByCell]);

  const upcomingHolidays = useMemo(
    () => getHolidaysInGregorianYearOrUpcoming(new Date(), 120, lang).slice(0, 6),
    [lang],
  );

  const stepMonth = (delta: number) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) {
      nextMonth = 13;
      nextYear -= 1;
    } else if (nextMonth > 13) {
      nextMonth = 1;
      nextYear += 1;
    }
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  };

  const jumpToday = () => {
    const nowEc = toEthiopianDate(new Date());
    setViewYear(nowEc.year);
    setViewMonth(nowEc.month);
    setSelectedDayKey(dayKey(Date.now()));
  };

  const categories: Array<CategoryItem<CalendarCategory>> = useMemo(
    () => [
      { key: 'month', label: 'Month & Day', icon: CalendarDays },
      { key: 'holidays', label: 'Holidays', icon: Sparkles, count: upcomingHolidays.length },
      { key: 'prefs', label: 'Style', icon: SlidersHorizontal },
    ],
    [upcomingHolidays.length],
  );

  const activeMeta = CALENDAR_META[activeCategory];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#08246B] dark:text-white">
              Ethiopian Calendar
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
              {activeMeta.description} · Today{' '}
              {formatEthiopianDate(new Date(), { lang, showWeekday: false, useGeez })} EC
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              jumpToday();
              setActiveCategory('month');
            }}
            className="min-h-[42px] px-3.5 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0"
          >
            Today
          </button>
        </div>

        <CategoryTabs
          items={categories}
          activeKey={activeCategory}
          onChange={setActiveCategory}
          ariaLabel="Ethiopian calendar categories"
        />
      </div>

      <CategoryPanel activeKey={activeCategory} label={activeMeta.title}>
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-bold text-[#08246B] dark:text-white">
            {activeMeta.title}
          </h2>
        </div>
        {activeCategory === 'month' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 sm:p-5 space-y-4">
          {/* Month / Year Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepMonth(-1)}
                aria-label="Previous Ethiopian month"
                className="min-h-[40px] min-w-[40px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-center text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
              >
                <ChevronLeft size={16} />
              </button>
              <CustomSelect
                ariaLabel="Select Ethiopian month"
                value={String(viewMonth)}
                variant="inset"
                compact
                options={MONTHS_1_TO_13.map((m) => ({
                  value: String(m),
                  label: `${m}. ${getEthiopianMonthName(m, lang)}`,
                }))}
                onChange={(val) => setViewMonth(Number(val))}
              />
              <div className="flex items-center rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y - 1)}
                  aria-label="Previous year"
                  className="px-2.5 py-2 text-xs font-bold text-[#08246B] dark:text-white"
                >
                  −
                </button>
                <span className="px-2 text-sm font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                  {grid.yearDisplay}
                </span>
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y + 1)}
                  aria-label="Next year"
                  className="px-2.5 py-2 text-xs font-bold text-[#08246B] dark:text-white"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => stepMonth(1)}
                aria-label="Next Ethiopian month"
                className="min-h-[40px] min-w-[40px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-center text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
              13-Month Calendar · EC
            </span>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            {grid.headers.map((head) => (
              <div key={head} className="py-1 truncate">
                {head}
              </div>
            ))}
          </div>

          {/* Days Matrix */}
          <div className="grid grid-cols-7 gap-1">
            {grid.days.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} className="h-14 sm:h-16" />;
              }
              const gcKey = cellKeyFromGc(cell.gregorian);
              const isSelected = selectedCell && cellKeyFromGc(selectedCell.gregorian) === gcKey;
              const dayCallsCount = callsByDay.get(gcKey)?.length ?? 0;
              const dayScheduledCount = scheduledByDay.get(gcKey)?.length ?? 0;
              const ecEventKey = `${cell.ethiopian.month}-${cell.ethiopian.day}`;
              const gcEventKey = `${cell.gregorian.month}-${cell.gregorian.day}`;
              const hasContactEvent =
                (eventsByCell.ecMap.get(ecEventKey)?.length ?? 0) > 0 ||
                (eventsByCell.gcMap.get(gcEventKey)?.length ?? 0) > 0;
              const hasHoliday = cell.holidays.length > 0;

              return (
                <button
                  key={gcKey}
                  type="button"
                  onClick={() => setSelectedDayKey(gcKey)}
                  className={`h-14 sm:h-16 rounded-xl p-1.5 flex flex-col justify-between text-left border transition-colors ${
                    isSelected
                      ? 'border-[#FF6A00] bg-[#FFF0E6] dark:bg-[#FF6A00]/20'
                      : cell.isToday
                        ? 'border-[#FF6A00]/70 bg-[#EEF2F6] dark:bg-[var(--dark-elevated)]'
                        : 'border-[#DDE4EA]/70 dark:border-[var(--dark-border-70)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated-60)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-0.5 w-full">
                    <span
                      className={`text-xs sm:text-sm font-bold tabular-nums leading-none ${
                        cell.isToday || isSelected
                          ? 'text-[#FF6A00]'
                          : 'text-[#08246B] dark:text-white'
                      }`}
                    >
                      {cell.ethiopianDisplayDay}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-[#8A93A0] dark:text-[var(--dark-text-muted)] leading-none">
                      {cell.gregorian.day}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 w-full">
                    <div className="flex items-center gap-1">
                      {hasHoliday && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#FF6A00]"
                          title={cell.holidays.map((h) => h.name).join(', ')}
                        />
                      )}
                      {hasContactEvent && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#4FA3F7]"
                          title="Contact birthday or event"
                        />
                      )}
                      {dayScheduledCount > 0 && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#10B981]"
                          title={`${dayScheduledCount} scheduled call(s)`}
                        />
                      )}
                    </div>
                    {dayCallsCount > 0 && (
                      <span className="text-[10px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        {dayCallsCount}c
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF6A00]" />
              Ethiopian holiday
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4FA3F7]" />
              Birthday / Event
            </span>
            <span>Top-left = EC · Top-right = GC · Bottom = calls</span>
          </div>
        </div>

        {/* Selected Day Inspector */}
        <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
          {selectedCell ? (
            <>
              <div className="space-y-1 pb-3 border-b border-[#DDE4EA] dark:border-[var(--dark-border)]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6A00]">
                  <CalendarDays size={15} />
                  <span>{selectedCell.weekdayName}</span>
                </div>
                <h2 className="text-lg font-bold text-[#08246B] dark:text-white tabular-nums">
                  {getEthiopianMonthName(selectedCell.ethiopian.month, lang)}{' '}
                  {selectedCell.ethiopianDisplayDay}, {grid.yearDisplay} EC
                </h2>
                <p className="text-xs font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Gregorian:{' '}
                  {new Date(
                    selectedCell.gregorian.year,
                    selectedCell.gregorian.month - 1,
                    selectedCell.gregorian.day,
                  ).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {/* Holidays on selected date */}
              {selectedCell.holidays.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Ethiopian Holidays
                  </p>
                  {selectedCell.holidays.map((h) => (
                    <div
                      key={h.key}
                      className="rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border border-[#FF6A00]/30 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#FF6A00]">{h.name}</span>
                        <button
                          type="button"
                          onClick={onOpenWishes}
                          className="text-[11px] font-semibold text-[#08246B] dark:text-white underline"
                        >
                          Send wishes
                        </button>
                      </div>
                      {h.description && (
                        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          {h.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Birthdays / Contact Events on selected date */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Contact Birthdays & Events ({selectedCellEvents.length})
                </p>
                {selectedCellEvents.length === 0 ? (
                  <p className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                    No birthdays or events on this date.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedCellEvents.map((evt, idx) => (
                      <button
                        key={`${evt.number}-${idx}`}
                        type="button"
                        onClick={() => onSelectContact(evt.number)}
                        className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 flex items-center justify-between gap-2 text-left hover:border-[#FF6A00]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Cake size={14} className="text-[#FF6A00] shrink-0" />
                          <span className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                            {evt.label}
                          </span>
                        </div>
                        {evt.tag && (
                          <span className="text-[11px] text-[#FF6A00] font-medium shrink-0">
                            {evt.tag}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Scheduled Calls on selected date */}
              {selectedCellScheduled.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Scheduled Calls ({selectedCellScheduled.length})
                  </p>
                  <div className="space-y-1.5">
                    {selectedCellScheduled.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectContact(item.number)}
                        className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 flex items-center justify-between gap-2 text-left hover:border-[#FF6A00]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Clock size={14} className="text-[#10B981] shrink-0" />
                          <span className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                            {item.name?.trim() || maskPhoneNumber(item.number, privacyMode)}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#FF6A00] tabular-nums shrink-0">
                          {formatTime(item.scheduledFor)} · {formatScheduledCountdown(item.scheduledFor)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Calls on selected date */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Calls on this day ({selectedCellCalls.length})
                </p>
                {selectedCellCalls.length === 0 ? (
                  <p className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                    No calls logged on this date.
                  </p>
                ) : (
                  <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                    {selectedCellCalls.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectCall(c)}
                        className="w-full py-2 flex items-center justify-between gap-2 text-left hover:opacity-80"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                            {c.name?.trim() || maskPhoneNumber(c.number, privacyMode)}
                          </p>
                          <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] capitalize tabular-nums">
                            {c.direction} · {formatTime(c.timestamp)}
                          </p>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-[#08246B] dark:text-white shrink-0">
                          {formatDuration(c.duration)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
        )}

        {activeCategory === 'holidays' && (
      <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#FF6A00]" />
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
              Upcoming Ethiopian Holidays
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenWishes}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
          >
            <Phone size={13} />
            Send holiday wishes
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcomingHolidays.map((h) => (
            <button
              key={`${h.key}-${h.ethiopian.year}`}
              type="button"
              onClick={() => {
                setViewYear(h.ethiopian.year);
                setViewMonth(h.ethiopian.month);
                setSelectedDayKey(cellKeyFromGc(h.gregorian));
                setActiveCategory('month');
              }}
              className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-left space-y-1 hover:border-[#FF6A00] transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                  {h.name}
                </span>
                <span className="text-[11px] font-mono font-semibold text-[#FF6A00] tabular-nums shrink-0">
                  {h.isToday ? 'Today' : `in ${h.daysUntil}d`}
                </span>
              </div>
              <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                {getEthiopianMonthName(h.ethiopian.month, lang)} {h.ethiopian.day}, {h.ethiopian.year} EC ·{' '}
                {new Date(h.gregorian.year, h.gregorian.month - 1, h.gregorian.day).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </button>
          ))}
        </div>
      </div>
        )}

        {activeCategory === 'prefs' && (
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-5">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Calendar Language &amp; Numerals
              </h2>
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Switch month names, weekday headers, and holiday titles between English and Amharic (አማርኛ), or toggle traditional Geez numerals.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-2.5">
                <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                  Display language
                </p>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                  {(['english', 'amharic'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setLang(opt)}
                      className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        lang === opt
                          ? 'bg-[#FF6A00] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {opt === 'english' ? 'English' : 'አማርኛ'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    Geez Numerals
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Show Ethiopian day numbers in Geez script (፩, ፪, ፫...)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUseGeez((prev) => !prev)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    useGeez
                      ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                      : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white'
                  }`}
                >
                  {useGeez ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                Today: {formatEthiopianDate(new Date(), { lang, showWeekday: true, useGeez })}
              </span>
              <button
                type="button"
                onClick={() => {
                  jumpToday();
                  setActiveCategory('month');
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap"
              >
                Jump to Today
              </button>
            </div>
          </div>
        )}
      </CategoryPanel>
    </div>
  );
}
