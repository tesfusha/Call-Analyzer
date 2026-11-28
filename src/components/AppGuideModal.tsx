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
  X,
} from 'lucide-react';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
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
    eyebrow: 'Step 1 of 4 · Calls',
    title: 'Dual-SIM call timeline',
    description:
      'Auto-sync calls with EC/GC dates, ETB cost, and missed-callback filters.',
    highlights: [
      'Instant search by name, number, or tag',
      '1-tap callback alerts & VIPs',
      'CSV / JSON / vCard import preview',
    ],
    icon: Phone,
  },
  {
    id: 'sim-ussd',
    eyebrow: 'Step 2 of 4 · SIM & USSD',
    title: 'Voice bundles & carrier USSD',
    description:
      'Compare ETC vs SFC talk-time, bundle balance, and dial shortcodes in 1 tap.',
    highlights: [
      'SIM 1 vs SIM 2 duration & ETB spend',
      'Bundle countdown & expiry alerts',
      'Quick USSD balance & bundle dialer',
    ],
    icon: Smartphone,
  },
  {
    id: 'analytics',
    eyebrow: 'Step 3 of 4 · Analytics',
    title: 'Charts & PDF reports',
    description:
      'Tap charts for daily duration & ETB totals, or export PDF statements.',
    highlights: [
      'Interactive volume & carrier charts',
      'Weekly & monthly airtime summaries',
      'Printable PDF & HTML statements',
    ],
    icon: BarChart3,
  },
  {
    id: 'calendar-privacy',
    eyebrow: 'Step 4 of 4 · Calendar & Lock',
    title: 'Ethiopian holidays & local privacy',
    description:
      'Send holiday & birthday wishes while keeping data private on your phone.',
    highlights: [
      'Ethiopian & Gregorian dual calendar',
      'Quiet-contact & birthday reminders',
      'Fingerprint / 4-digit PIN app lock',
    ],
    icon: Calendar,
  },
];

function StepPreview({ stepIndex }: { stepIndex: number }) {
  const prefersReducedMotion = useReducedMotion();

  if (stepIndex === 0) {
    return (
      <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 space-y-1.5">
        {[
          { name: 'Abebe Bikila', sim: 'SIM 1 · ETC', meta: 'Outgoing · 4m 12s · 2.15 ETB', accent: '#FF6A00' },
          { name: 'Sara Tadesse', sim: 'SIM 2 · SFC', meta: 'Missed · Follow-up 15m', accent: '#EF4444' },
        ].map((row, idx) => (
          <motion.div
            key={row.name}
            initial={prefersReducedMotion ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.14, delay: idx * 0.04 }}
            className="rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-2 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[#08246B] dark:text-white truncate">
                {row.name}
              </p>
              <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums truncate">
                {row.meta}
              </p>
            </div>
            <span
              className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] whitespace-nowrap shrink-0"
              style={{ color: row.accent }}
            >
              {row.sim}
            </span>
          </motion.div>
        ))}
        <div className="flex items-center justify-between px-1 pt-0.5 text-[10px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
          <span className="flex items-center gap-1 text-[#FF6A00] font-semibold">
            <Clock size={11} />
            Auto call log sync
          </span>
          <span>EC &amp; GC</span>
        </div>
      </div>
    );
  }

  if (stepIndex === 1) {
    return (
      <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 space-y-2">
        <div className="rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-[#08246B] dark:text-white">SIM 1 Monthly Bundle</span>
            <span className="font-mono tabular-nums text-[#FF6A00]">136 / 200 min</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] overflow-hidden">
            <motion.div
              initial={prefersReducedMotion ? { width: '68%' } : { width: '12%' }}
              animate={{ width: '68%' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-[#FF6A00]"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
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
              className="rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2 py-1.5 text-center"
            >
              <p className="text-[11px] font-mono font-bold text-[#08246B] dark:text-white flex items-center justify-center gap-0.5">
                <Hash size={10} className="text-[#FF6A00]" />
                {item.code.replace('#', '')}#
              </p>
              <p className="text-[9.5px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
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
      <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-[#08246B] dark:text-white">Weekly Volume</span>
          <span className="font-mono text-[10px] font-semibold text-[#FF6A00] tabular-nums">
            Tap bars for ETB &amp; mins
          </span>
        </div>
        <div className="rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 pt-3 pb-2">
          <div className="h-14 flex items-end justify-between gap-2">
            {bars.map((bar, idx) => (
              <div key={bar.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <motion.div
                  initial={prefersReducedMotion ? { height: `${bar.h}%` } : { height: '8%' }}
                  animate={{ height: `${bar.h}%` }}
                  transition={{ duration: 0.45, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className={`w-full max-w-[20px] rounded-t ${
                    idx === 3 ? 'bg-[#FF6A00]' : 'bg-[#08246B] dark:bg-[#4FA3F7]'
                  }`}
                />
                <span className="text-[9.5px] font-mono text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
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
    <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 space-y-1.5">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
            <FlaticonIcon name="fi-rr-book-open-cover" className="text-[14px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#08246B] dark:text-white truncate">
              Ethiopian Calendar &amp; Wishes
            </p>
            <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
              Birthdays &amp; Amharic/English greetings
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.08 }}
        className="rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 flex items-center gap-2"
      >
        <div className="w-7 h-7 rounded-lg bg-[#10B981]/12 text-[#059669] dark:text-[#34D399] flex items-center justify-center shrink-0">
          <Lock size={13} />
        </div>
        <p className="text-[10px] leading-snug text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
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
            <div className="px-4 pt-3.5 pb-3 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <BrandLogo size={30} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-[#08246B] dark:text-white truncate">
                      {APP_NAME}
                    </h2>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] shrink-0">
                      v{APP_VERSION}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    Quick walkthrough
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close app guide"
                className="min-h-[36px] min-w-[36px] rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-4">
              <motion.div
                key={step.id}
                initial={prefersReducedMotion ? { opacity: 0.7 } : { opacity: 0.65, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.06 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-2.5"
              >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                      <StepIcon size={16} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#FF6A00]">
                        {step.eyebrow}
                      </p>
                      <h3 className="text-sm font-bold text-[#08246B] dark:text-white leading-snug">
                        {step.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-[10.5px] leading-snug text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {step.description}
                  </p>

                  <StepPreview stepIndex={stepIndex} />

                  <ul className="space-y-1 pt-0.5">
                    {step.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-1.5 text-[10.5px] leading-snug text-[#08246B] dark:text-white"
                      >
                        <ShieldCheck size={12} className="text-[#FF6A00] mt-0.5 shrink-0" />
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
