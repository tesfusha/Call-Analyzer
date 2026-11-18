import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Play, Upload, X } from 'lucide-react';
import { BrandLogo } from '@/src/components/BrandLogo';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import type { UpcomingHoliday } from '@/src/lib/ethiopianCalendar';

const EQUALIZER_BARS = [
  { delay: 0, heights: [0.4, 1, 0.55, 0.85, 0.4] },
  { delay: 0.15, heights: [0.7, 0.35, 1, 0.5, 0.7] },
  { delay: 0.3, heights: [0.5, 0.9, 0.4, 1, 0.5] },
  { delay: 0.45, heights: [0.85, 0.45, 0.8, 0.35, 0.85] },
];

function getTimeGreeting(name: string): string {
  const hour = new Date().getHours();
  const base =
    hour < 12
      ? 'Selam · Good morning'
      : hour < 17
        ? 'Selam · Good afternoon'
        : 'Selam · Good evening';
  return name.trim() ? `${base}, ${name.trim()}` : base;
}

export function WelcomeHero({
  displayName,
  callsCount,
  savedContactsCount,
  unreturnedCount,
  upcomingHoliday,
  defaultLang,
  onLoadSample,
  onImportFile,
  onOpenTestCall,
  onDismiss,
}: {
  displayName: string;
  callsCount: number;
  savedContactsCount: number;
  unreturnedCount: number;
  upcomingHoliday: UpcomingHoliday | null;
  defaultLang: 'english' | 'amharic';
  onLoadSample: () => void;
  onImportFile: () => void;
  onOpenTestCall: () => void;
  onDismiss: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [tickerIndex, setTickerIndex] = useState(0);

  const highlights = useMemo(() => {
    const todayEc = `${formatEthiopianShort(new Date(), defaultLang)} EC`;
    const items = [
      upcomingHoliday
        ? `${todayEc} · ${upcomingHoliday.name} ${upcomingHoliday.isToday ? 'is today' : `in ${upcomingHoliday.daysUntil}d`}`
        : `${todayEc} · Ethiopian calendar & holiday alerts ready`,
      callsCount > 0
        ? unreturnedCount > 0
          ? `${callsCount} calls logged · ${unreturnedCount} missed call${unreturnedCount === 1 ? '' : 's'} waiting for callback`
          : `${callsCount} calls analyzed · All missed callbacks caught up`
        : 'Import CSV/JSON logs or run a live call test right inside the app',
      `${savedContactsCount} saved contact${savedContactsCount === 1 ? '' : 's'} · Ethio Telecom & Safaricom tracking`,
    ];
    return items;
  }, [callsCount, defaultLang, savedContactsCount, unreturnedCount, upcomingHoliday]);

  useEffect(() => {
    if (prefersReducedMotion || highlights.length <= 1) return;
    const id = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % highlights.length);
    }, 4000);
    return () => clearInterval(id);
  }, [highlights.length, prefersReducedMotion]);

  const greeting = getTimeGreeting(displayName);
  const activeHighlight = highlights[tickerIndex % highlights.length];

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-4 min-w-0">
        {/* Animated Logo Signal Emblem */}
        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
          {!prefersReducedMotion && (
            <>
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl border border-[#FF6A00]/45"
                initial={{ scale: 0.9, opacity: 0.65 }}
                animate={{ scale: 1.24, opacity: 0 }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
              <motion.span
                aria-hidden="true"
                className="absolute inset-1 rounded-2xl border border-[#4FA3F7]/40"
                initial={{ scale: 0.92, opacity: 0.55 }}
                animate={{ scale: 1.18, opacity: 0 }}
                transition={{
                  duration: 2.4,
                  delay: 1.1,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            </>
          )}
          <motion.div
            whileHover={prefersReducedMotion ? undefined : { scale: 1.05, rotate: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            className="relative z-10 rounded-2xl p-1 bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-sm"
          >
            <BrandLogo size={48} />
          </motion.div>
        </div>

        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-[#08246B] dark:text-white tracking-tight truncate">
              {greeting}
            </h2>
            {/* Live Signal Equalizer Bars */}
            <span className="inline-flex items-end gap-0.5 h-3.5" aria-hidden="true">
              {EQUALIZER_BARS.map((bar, idx) => (
                <motion.span
                  key={idx}
                  className="w-1 h-full rounded-full bg-[#FF6A00] origin-bottom"
                  animate={
                    prefersReducedMotion
                      ? { scaleY: 0.7 }
                      : { scaleY: bar.heights }
                  }
                  transition={
                    prefersReducedMotion
                      ? undefined
                      : {
                          duration: 1.4,
                          delay: bar.delay,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }
                  }
                />
              ))}
            </span>
          </div>

          <div className="min-h-[20px] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={activeHighlight}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-xs sm:text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate"
              >
                {activeHighlight}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {callsCount === 0 ? (
          <>
            <button
              type="button"
              onClick={onLoadSample}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
            >
              Load sample data
            </button>
            <button
              type="button"
              onClick={onImportFile}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Upload size={14} className="text-[#FF6A00]" />
              Import
            </button>
            <button
              type="button"
              onClick={onOpenTestCall}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Play size={13} className="text-[#FF6A00]" />
              Live test
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenTestCall}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Play size={13} className="text-[#FF6A00]" />
              Live test
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss welcome banner"
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              <X size={14} />
              Dismiss
            </button>
          </>
        )}
      </div>
    </motion.section>
  );
}
