import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BellRing,
  CheckCircle2,
  Flame,
  HeartHandshake,
  Phone,
  ShieldCheck,
  Smartphone,
  UserCog,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/src/components/BrandLogo';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import {
  APP_NAME,
  APP_RELEASE_LABEL,
  APP_VERSION,
  LATEST_RELEASE_NOTES,
} from '@/src/lib/appInfo';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';

const NOTE_ICONS = {
  'exact-alarms-clean-header': null,
  'streak-counting': Flame,
  'mobile-modals': Smartphone,
  'brand-launcher': ShieldCheck,
  'clean-call-logs': Phone,
  'notification-actions': BellRing,
  'smart-rules': HeartHandshake,
  'profile-avatars': UserCog,
} as const;

export function WhatsNewModal({
  open,
  onClose,
  onOpenGuide,
}: {
  open: boolean;
  onClose: () => void;
  onOpenGuide?: () => void;
}) {
  useLockBodyScroll(open);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useBackHandler({
    id: 'whats-new-modal',
    active: open,
    priority: 70,
    onBack: onClose,
  });

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="whats-new-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 overscroll-contain"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whats-new-title"
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-xl overflow-hidden flex flex-col max-h-[88dvh]"
          >
            {/* Pinned Header */}
            <div className="px-5 py-4 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <BrandLogo size={38} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2
                      id="whats-new-title"
                      className="text-base font-bold text-[#08246B] dark:text-white truncate"
                    >
                      What&apos;s New
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] text-[11px] font-mono font-bold">
                      <FlaticonIcon name="fi-rr-badge-check" className="text-[11px]" />
                      v{APP_VERSION}
                    </span>
                  </div>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    {APP_NAME} · {APP_RELEASE_LABEL}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close What's New"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto overscroll-contain space-y-3 flex-1 min-h-0">
              <div className="rounded-xl bg-[#FFF0E6]/70 dark:bg-[#FF6A00]/10 border border-[#FF6A00]/25 px-3.5 py-2.5 flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-[#FF6A00] shrink-0" />
                <p className="text-xs font-medium text-[#08246B] dark:text-white">
                  App updated to <span className="font-mono font-bold">v{APP_VERSION}</span>. Here&apos;s what&apos;s new in this release:
                </p>
              </div>

              <div className="space-y-2.5">
                {LATEST_RELEASE_NOTES.map((item) => {
                  const Icon = NOTE_ICONS[item.id];
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#FF6A00] flex items-center justify-center shrink-0">
                        {Icon ? (
                          <Icon size={17} />
                        ) : (
                          <FlaticonIcon name="fi-rr-rocket-lunch" className="text-[17px]" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="text-xs font-bold text-[#08246B] dark:text-white">
                          {item.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pinned Footer */}
            <div className="px-5 py-3.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/70 dark:bg-[var(--dark-canvas)]/50 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              {onOpenGuide ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGuide();
                  }}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] whitespace-nowrap transition-colors"
                >
                  Open App Guide
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap transition-colors ml-auto"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
