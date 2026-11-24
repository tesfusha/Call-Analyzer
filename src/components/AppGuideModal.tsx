import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hash,
  Lock,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/src/components/BrandLogo';
import { APP_NAME, APP_PRIVACY_NOTE, APP_VERSION } from '@/src/lib/appInfo';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';

type GuideStep = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  icon: typeof Phone;
};

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'calls',
    eyebrow: 'Step 1 of 4 · Auto-Synced Calls',
    title: 'Organize every call across both SIMs',
    description:
      'Review incoming, outgoing, and unreturned missed calls in one clean timeline with Ethiopian & Gregorian dates, ETB call cost, and automatic Android call-log sync.',
    highlights: [
      'Instant search by name, number, tag, or note',
      'One-tap callback reminders & VIP priority contacts',
      'CSV / JSON / TXT import with preview & deduplication',
    ],
    icon: Phone,
  },
  {
    id: 'sim-ussd',
    eyebrow: 'Step 2 of 4 · Dual-SIM, Bundles & USSD',
    title: 'Track voice packages & carrier USSD',
    description:
      'Compare ETC and SFC talk-time side by side, watch active voice bundle minutes before they expire, and dial official USSD shortcodes effortlessly.',
    highlights: [
      'SIM 1 vs SIM 2 minute and ETB spend comparison',
      'Remaining bundle minute bar & expiry alerts',
      'Quick USSD modal for balance, packages & call-me-back',
    ],
    icon: Smartphone,
  },
  {
    id: 'analytics',
    eyebrow: 'Step 3 of 4 · Interactive Analytics',
    title: 'Inspect trends & export formatted reports',
    description:
      'Hover or tap any chart point to inspect daily duration, direction splits, carrier shares, and top callers — then download printable PDF or HTML statements.',
    highlights: [
      'Hover tooltips on volume, duration & carrier charts',
      'Weekly and monthly talk-time & airtime summaries',
      'One-click PDF reports with embedded visual charts',
    ],
    icon: BarChart3,
  },
  {
    id: 'calendar-privacy',
    eyebrow: 'Step 4 of 4 · Ethiopian Calendar & Privacy',
    title: 'Celebrate milestones with private sync',
    description:
      'Stay ahead of Ethiopian holidays, contact birthdays, and quiet friends with ready-to-send wishes — all locked privately to your personal account.',
    highlights: [
      'Dual Ethiopian (Geez / English) & Gregorian calendar',
      'Smart quiet-contact nudges & birthday greeting drafts',
      'Optional 4-digit screen lock & zero 3rd-party data sharing',
    ],
    icon: Calendar,
  },
];

function StepPreview({ stepIndex }: { stepIndex: number }) {
  const prefersReducedMotion = useReducedMotion();

  if (stepIndex === 0) {
    return (
      <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-2">
        {[
          { name: 'Abebe Bikila', sim: 'SIM 1 · ETC', meta: 'Outgoing · 4m 12s · 2.15 ETB', accent: '#FF6A00' },
          { name: 'Sara Tadesse', sim: 'SIM 2 · SFC', meta: 'Missed · Follow-up 15m', accent: '#EF4444' },
        ].map((row, idx) => (
          <motion.div
            key={row.name}
            initial={prefersReducedMotion ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.14, delay: idx * 0.04 }}
            className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                {row.name}
              </p>
              <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums truncate">
                {row.meta}
              </p>
            </div>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] whitespace-nowrap shrink-0"
              style={{ color: row.accent }}
            >
              {row.sim}
            </span>
          </motion.div>
        ))}
        <div className="flex items-center justify-between px-1 pt-0.5 text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
          <span className="flex items-center gap-1.5 text-[#FF6A00] font-semibold">
            <Clock size={12} />
            Auto call log sync
          </span>
          <span>EC &amp; GC timestamps</span>
        </div>
      </div>
    );
  }

  if (stepIndex === 1) {
    return (
      <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-2.5">
        <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#08246B] dark:text-white">SIM 1 Monthly Voice Bundle</span>
            <span className="font-mono tabular-nums text-[#FF6A00]">136 / 200 min</span>
          </div>
          <div className="h-2 rounded-full bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] overflow-hidden">
            <motion.div
              initial={prefersReducedMotion ? { width: '68%' } : { width: '12%' }}
              animate={{ width: '68%' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-[#FF6A00]"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { code: '*804#', label: 'ETC Balance' },
            { code: '*999#', label: 'ETC Bundles' },
            { code: '*707#', label: 'SFC' },
          ].map((item, idx) => (
            <motion.div
              key={item.code}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14, delay: idx * 0.03 }}
              className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-2 text-center"
            >
              <p className="text-xs font-mono font-bold text-[#08246B] dark:text-white flex items-center justify-center gap-1">
                <Hash size={11} className="text-[#FF6A00]" />
                {item.code.replace('#', '')}#
              </p>
              <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                {item.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (stepIndex === 2) {
    const bars = [
      { day: 'Mon', h: 34 },
      { day: 'Tue', h: 52 },
      { day: 'Wed', h: 42 },
      { day: 'Thu', h: 68 },
      { day: 'Fri', h: 58 },
      { day: 'Sat', h: 28 },
      { day: 'Sun', h: 46 },
    ];
    return (
      <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#08246B] dark:text-white">Weekly Call Volume</span>
          <span className="font-mono text-[11px] font-semibold text-[#FF6A00] tabular-nums">
            Hover bars for exact ETB &amp; mins
          </span>
        </div>
        <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 pt-4 pb-2.5">
          <div className="h-20 flex items-end justify-between gap-2">
            {bars.map((bar, idx) => (
              <div key={bar.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <motion.div
                  initial={prefersReducedMotion ? { height: `${bar.h}%` } : { height: '8%' }}
                  animate={{ height: `${bar.h}%` }}
                  transition={{ duration: 0.45, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className={`w-full max-w-[22px] rounded-t-md ${
                    idx === 3 ? 'bg-[#FF6A00]' : 'bg-[#08246B] dark:bg-[#4FA3F7]'
                  }`}
                />
                <span className="text-[10px] font-mono text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  {bar.day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-2">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
              Ethiopian Calendar &amp; Holiday Wishes
            </p>
            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
              Birthdays, quiet contacts &amp; Amharic/English greetings
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.08 }}
        className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 flex items-center gap-2.5"
      >
        <div className="w-8 h-8 rounded-lg bg-[#10B981]/12 text-[#059669] dark:text-[#34D399] flex items-center justify-center shrink-0">
          <Lock size={15} />
        </div>
        <p className="text-[11px] leading-snug text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
          {APP_PRIVACY_NOTE}
        </p>
      </motion.div>
    </div>
  );
}

export function AppGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useLockBodyScroll(open);
  useBackHandler({
    id: 'app-guide-modal',
    active: open,
    priority: 65,
    onBack: onClose,
  });
  const prefersReducedMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setStepIndex((prev) => Math.min(GUIDE_STEPS.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const step = GUIDE_STEPS[stepIndex];
  const StepIcon = step.icon;
  const isLast = stepIndex === GUIDE_STEPS.length - 1;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="app-guide-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/50 dark:bg-black/75 backdrop-blur-sm p-0 sm:p-4 overscroll-contain"
        >
          <motion.div
            key="app-guide-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${APP_NAME} Interactive Guide`}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col max-h-[90dvh] overflow-hidden shadow-xl"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3.5 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <BrandLogo size={34} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-[#08246B] dark:text-white truncate">
                      {APP_NAME}
                    </h2>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] shrink-0">
                      v{APP_VERSION}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    Quick interactive walkthrough
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close app guide"
                className="min-h-[40px] min-w-[40px] rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5">
              <motion.div
                key={step.id}
                initial={prefersReducedMotion ? { opacity: 0.7 } : { opacity: 0.65, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.06 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
              >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                      <StepIcon size={20} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#FF6A00]">
                        {step.eyebrow}
                      </p>
                      <h3 className="text-base sm:text-lg font-bold text-[#08246B] dark:text-white leading-snug">
                        {step.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {step.description}
                  </p>

                  <StepPreview stepIndex={stepIndex} />

                  <ul className="space-y-2 pt-0.5">
                    {step.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-xs text-[#08246B] dark:text-white"
                      >
                        <ShieldCheck size={14} className="text-[#FF6A00] mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
              </motion.div>
            </div>

            {/* Footer Navigation */}
            <div className="px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/80 dark:bg-[var(--dark-canvas)]/70 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Guide steps">
                {GUIDE_STEPS.map((s, idx) => {
                  const active = idx === stepIndex;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={`Go to step ${idx + 1}`}
                      onClick={() => setStepIndex(idx)}
                      className={`h-2 rounded-full transition-all ${
                        active
                          ? 'w-6 bg-[#FF6A00]'
                          : 'w-2 bg-[#DDE4EA] dark:bg-[var(--dark-border)] hover:bg-[#8A93A0]'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {stepIndex === 0 ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white"
                  >
                    Skip
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white flex items-center gap-1"
                  >
                    <ChevronLeft size={14} />
                    Back
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (isLast) {
                      onClose();
                    } else {
                      setStepIndex((prev) => Math.min(GUIDE_STEPS.length - 1, prev + 1));
                    }
                  }}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1 whitespace-nowrap transition-colors"
                >
                  {isLast ? 'Get Started' : 'Next'}
                  {!isLast && <ChevronRight size={14} />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
