import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { toDateTimeLocalValue } from '@/src/lib/schedule';

type PopoverCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseLocalDateTime(value: string): Date {
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
  const fallback = new Date(Date.now() + 30 * 60_000);
  fallback.setSeconds(0, 0);
  return fallback;
}

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toYmd(year: number, monthIndex0: number, day: number): string {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

function formatTriggerDateTime(dt: Date): string {
  const datePart = dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = dt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

function formatTriggerDate(ymd: string): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return 'Pick date';
  const dt = new Date(parsed.year, parsed.month - 1, parsed.day);
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildCalendarCells(viewYear: number, viewMonth: number): Array<number | null> {
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function useAnchoredPopover(
  open: boolean,
  onClose: () => void,
  desiredMinWidth: number,
  desiredHeight: number,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  const updateCoords = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12;

    const width = Math.min(
      Math.max(rect.width, desiredMinWidth),
      viewportW - margin * 2,
    );
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, viewportW - width - margin),
    );

    const spaceBelow = viewportH - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUpward = spaceBelow < Math.min(280, desiredHeight) && spaceAbove > spaceBelow;

    if (openUpward) {
      setCoords({
        bottom: viewportH - rect.top + 6,
        left,
        width,
        maxHeight: Math.max(200, Math.min(desiredHeight, spaceAbove - 6)),
        openUpward: true,
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left,
        width,
        maxHeight: Math.max(200, Math.min(desiredHeight, spaceBelow - 6)),
        openUpward: false,
      });
    }
  }, [desiredMinWidth, desiredHeight]);

  useEffect(() => {
    if (!open) return;
    updateCoords();

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        triggerRef.current?.focus();
      }
    };

    const handleScrollOrResize = (e: Event) => {
      if (e.type === 'scroll' && menuRef.current?.contains(e.target as Node)) {
        return;
      }
      updateCoords();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, onClose, updateCoords]);

  return { containerRef, triggerRef, menuRef, coords };
}

export function DateTimePicker({
  value,
  onChange,
  ariaLabel,
  variant = 'surface',
  compact = false,
  presets,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  variant?: 'surface' | 'inset';
  compact?: boolean;
  presets?: Array<{ label: string; getTimestamp: () => number }>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const dialogId = useId();
  const closePopover = useCallback(() => setOpen(false), []);

  const currentDate = useMemo(() => parseLocalDateTime(value), [value]);
  const [viewYear, setViewYear] = useState(() => currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => currentDate.getMonth());

  useEffect(() => {
    if (open) {
      setViewYear(currentDate.getFullYear());
      setViewMonth(currentDate.getMonth());
    }
  }, [open, currentDate]);

  const { containerRef, triggerRef, menuRef, coords } = useAnchoredPopover(
    open,
    closePopover,
    300,
    430,
  );

  const cells = useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const selY = currentDate.getFullYear();
  const selM = currentDate.getMonth();
  const selD = currentDate.getDate();

  const hours24 = currentDate.getHours();
  const isPm = hours24 >= 12;
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minute = currentDate.getMinutes();

  const commitDate = (next: Date) => {
    onChange(toDateTimeLocalValue(next.getTime()));
  };

  const selectDay = (day: number) => {
    const next = new Date(currentDate);
    next.setFullYear(viewYear, viewMonth, day);
    commitDate(next);
  };

  const setHour12 = (nextHour12: number) => {
    const clamped = ((nextHour12 - 1 + 12) % 12) + 1;
    const h24 = isPm ? (clamped === 12 ? 12 : clamped + 12) : clamped === 12 ? 0 : clamped;
    const next = new Date(currentDate);
    next.setHours(h24);
    commitDate(next);
  };

  const setMinuteVal = (nextMin: number) => {
    const clamped = ((nextMin % 60) + 60) % 60;
    const next = new Date(currentDate);
    next.setMinutes(clamped);
    commitDate(next);
  };

  const setPeriod = (pm: boolean) => {
    if (pm === isPm) return;
    const next = new Date(currentDate);
    next.setHours(pm ? (hours24 % 12) + 12 : hours24 % 12);
    commitDate(next);
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const inactiveSurface =
    variant === 'inset'
      ? 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]/60'
      : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]/60';

  const triggerSizing = compact ? 'min-h-[40px] px-3 py-1.5 text-xs' : 'min-h-[42px] px-3 py-2 text-xs';

  const popover =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={menuRef}
                id={dialogId}
                role="dialog"
                aria-label={ariaLabel}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: coords.openUpward ? 4 : -4, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: coords.openUpward ? 4 : -4, scale: 0.98 }
                }
                transition={{ duration: prefersReducedMotion ? 0.06 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  bottom: coords.bottom,
                  left: coords.left,
                  width: coords.width,
                  maxHeight: coords.maxHeight,
                }}
                className={`z-[90] overflow-y-auto rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-xl p-3 space-y-3 ${
                  coords.openUpward ? 'origin-bottom' : 'origin-top'
                }`}
              >
                {/* Month header */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={goPrevMonth}
                    aria-label="Previous month"
                    className="w-8 h-8 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
                  >
                    <ChevronLeft size={15} className="shrink-0" />
                  </button>
                  <div className="text-center min-w-0">
                    <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                      {MONTHS[viewMonth]} {viewYear}
                    </p>
                    <p className="text-[10px] text-[#FF6A00] font-medium tabular-nums truncate">
                      {formatEthiopianShort(currentDate)} EC
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goNextMonth}
                    aria-label="Next month"
                    className="w-8 h-8 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
                  >
                    <ChevronRight size={15} className="shrink-0" />
                  </button>
                </div>

                {/* Weekday row + Calendar grid */}
                <div className="space-y-1">
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {WEEKDAYS.map((wd) => (
                      <span
                        key={wd}
                        className="text-[10px] font-semibold text-[#8A93A0] dark:text-[var(--dark-text-muted)] py-0.5"
                      >
                        {wd}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, idx) => {
                      if (day === null) {
                        return <span key={`empty-${idx}`} className="h-8" />;
                      }
                      const isSelected = viewYear === selY && viewMonth === selM && day === selD;
                      const isToday = viewYear === todayY && viewMonth === todayM && day === todayD;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => selectDay(day)}
                          className={`h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors ${
                            isSelected
                              ? 'bg-[#FF6A00] text-white'
                              : isToday
                                ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/40'
                                : 'text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time selector */}
                <div className="pt-2.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      <Clock size={12} className="text-[#FF6A00] shrink-0" />
                      Time
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => setHour12(hour12 - 1)}
                          aria-label="Decrease hour"
                          className="w-6 h-6 rounded-lg text-xs font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00]"
                        >
                          -
                        </button>
                        <span className="w-7 text-center text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                          {pad2(hour12)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setHour12(hour12 + 1)}
                          aria-label="Increase hour"
                          className="w-6 h-6 rounded-lg text-xs font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00]"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        :
                      </span>
                      <div className="flex items-center rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => setMinuteVal(minute - 5)}
                          aria-label="Decrease minutes"
                          className="w-6 h-6 rounded-lg text-xs font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00]"
                        >
                          -
                        </button>
                        <span className="w-7 text-center text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                          {pad2(minute)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMinuteVal(minute + 5)}
                          aria-label="Increase minutes"
                          className="w-6 h-6 rounded-lg text-xs font-bold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00]"
                        >
                          +
                        </button>
                      </div>
                      <div className="grid grid-cols-2 p-0.5 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                        {(['AM', 'PM'] as const).map((period) => {
                          const active = (period === 'PM') === isPm;
                          return (
                            <button
                              key={period}
                              type="button"
                              onClick={() => setPeriod(period === 'PM')}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${
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
                  </div>

                  {/* Quick minute pills */}
                  <div className="flex flex-wrap items-center gap-1">
                    {[0, 15, 30, 45].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMinuteVal(m)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold tabular-nums transition-colors ${
                          minute === m
                            ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/40'
                            : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                        }`}
                      >
                        :{pad2(m)}
                      </button>
                    ))}
                    {presets &&
                      presets.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            onChange(toDateTimeLocalValue(p.getTimestamp()));
                            setOpen(false);
                          }}
                          className="px-2 py-1 rounded-lg bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[11px] font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                        >
                          {p.label}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="ml-auto px-3 py-1 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-white text-[11px] font-semibold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full justify-between ${triggerSizing} rounded-xl border font-semibold flex items-center gap-2 transition-colors ${
          open
            ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#08246B] dark:text-white'
            : `${inactiveSurface} text-[#08246B] dark:text-white`
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Calendar size={14} className="text-[#FF6A00] shrink-0" />
          <span className="truncate font-mono tabular-nums">
            {formatTriggerDateTime(currentDate)}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0 transition-transform duration-100 ${
            open ? 'rotate-180 text-[#FF6A00]' : ''
          }`}
        />
      </button>
      {popover}
    </div>
  );
}

export function DatePickerField({
  value,
  onChange,
  minDate,
  maxDate,
  ariaLabel,
  variant = 'inset',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  ariaLabel: string;
  variant?: 'surface' | 'inset';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const dialogId = useId();
  const closePopover = useCallback(() => setOpen(false), []);

  const parsedValue = useMemo(() => {
    const p = parseYmd(value);
    if (p) return p;
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }, [value]);

  const [viewYear, setViewYear] = useState(() => parsedValue.year);
  const [viewMonth, setViewMonth] = useState(() => parsedValue.month - 1);

  useEffect(() => {
    if (open) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month - 1);
    }
  }, [open, parsedValue]);

  const { containerRef, triggerRef, menuRef, coords } = useAnchoredPopover(
    open,
    closePopover,
    276,
    330,
  );

  const cells = useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const inactiveSurface =
    variant === 'inset'
      ? 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]/60'
      : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]/60';

  const popover =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={menuRef}
                id={dialogId}
                role="dialog"
                aria-label={ariaLabel}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: coords.openUpward ? 4 : -4, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: coords.openUpward ? 4 : -4, scale: 0.98 }
                }
                transition={{ duration: prefersReducedMotion ? 0.06 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  bottom: coords.bottom,
                  left: coords.left,
                  width: coords.width,
                  maxHeight: coords.maxHeight,
                }}
                className={`z-[90] overflow-y-auto rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-xl p-3 space-y-2.5 ${
                  coords.openUpward ? 'origin-bottom' : 'origin-top'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={goPrevMonth}
                    aria-label="Previous month"
                    className="w-8 h-8 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
                  >
                    <ChevronLeft size={15} className="shrink-0" />
                  </button>
                  <div className="text-center min-w-0">
                    <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                      {MONTHS[viewMonth]} {viewYear}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goNextMonth}
                    aria-label="Next month"
                    className="w-8 h-8 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
                  >
                    <ChevronRight size={15} className="shrink-0" />
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {WEEKDAYS.map((wd) => (
                      <span
                        key={wd}
                        className="text-[10px] font-semibold text-[#8A93A0] dark:text-[var(--dark-text-muted)] py-0.5"
                      >
                        {wd}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, idx) => {
                      if (day === null) return <span key={`empty-${idx}`} className="h-8" />;
                      const candidate = toYmd(viewYear, viewMonth, day);
                      const disabled =
                        (Boolean(minDate) && candidate < (minDate ?? '')) ||
                        (Boolean(maxDate) && candidate > (maxDate ?? ''));
                      const isSelected = candidate === value;
                      const isToday = viewYear === todayY && viewMonth === todayM && day === todayD;

                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            onChange(candidate);
                            setOpen(false);
                          }}
                          className={`h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors disabled:opacity-30 ${
                            isSelected
                              ? 'bg-[#FF6A00] text-white'
                              : isToday
                                ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] border border-[#FF6A00]/40'
                                : 'text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const ymd = toYmd(todayY, todayM, todayD);
                      const valid =
                        (!minDate || ymd >= minDate) && (!maxDate || ymd <= maxDate);
                      if (valid) {
                        onChange(ymd);
                        setOpen(false);
                      } else {
                        setViewYear(todayY);
                        setViewMonth(todayM);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[11px] font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-3 py-1 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-white text-[11px] font-semibold"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
          open
            ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#08246B] dark:text-white'
            : `${inactiveSurface} text-[#08246B] dark:text-white`
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Calendar size={14} className="text-[#FF6A00] shrink-0" />
          <span className="truncate font-mono tabular-nums">{formatTriggerDate(value)}</span>
        </span>
        <ChevronDown
          size={14}
          className={`text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0 transition-transform duration-100 ${
            open ? 'rotate-180 text-[#FF6A00]' : ''
          }`}
        />
      </button>
      {popover}
    </div>
  );
}
