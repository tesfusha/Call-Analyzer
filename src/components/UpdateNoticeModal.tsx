import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Download, ExternalLink, Info, ShieldAlert, X } from 'lucide-react';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '@/src/lib/appInfo';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import type { AppUpdateNotice } from '@/src/types/call';

type UpdateNoticeModalProps = {
  update: AppUpdateNotice | null;
  onDismiss: () => void;
};

export function UpdateNoticeModal({ update, onDismiss }: UpdateNoticeModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const open = Boolean(update);
  const mandatory = Boolean(update?.mandatory);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open || mandatory) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, mandatory, onDismiss]);

  useBackHandler({
    id: 'update-notice-modal',
    active: open,
    priority: 90,
    onBack: () => {
      if (!mandatory) onDismiss();
    },
  });

  const modalContent = (
    <AnimatePresence>
      {update && (
        <motion.div
          key="update-notice-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          onClick={() => {
            if (!mandatory) onDismiss();
          }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[#08246B]/60 dark:bg-black/80 p-0 sm:p-4 overscroll-contain"
        >
          <motion.div
            key="update-notice-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-notice-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    mandatory
                      ? 'bg-[#EF4444]/15 text-[#EF4444]'
                      : 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00]'
                  }`}
                >
                  {mandatory ? <ShieldAlert size={22} /> : <Download size={22} />}
                </div>
                <div className="min-w-0">
                  <h2
                    id="update-notice-title"
                    className="text-base font-bold text-[#08246B] dark:text-white leading-tight"
                  >
                    {mandatory ? 'Required Update Available' : 'New Update Available'}
                  </h2>
                  <p className="text-xs font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] mt-0.5">
                    v{APP_VERSION_NAME} ({APP_VERSION_CODE}) → v{update.versionName} ({update.versionCode})
                  </p>
                </div>
              </div>

              {!mandatory && (
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Dismiss update notice"
                  className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 rounded-xl flex items-center justify-center text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                What&apos;s new
              </p>
              <p className="text-xs leading-relaxed text-[#08246B] dark:text-white whitespace-pre-line">
                {update.notes}
              </p>
            </div>

            <div className="rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/10 border border-[#FF6A00]/30 p-3 flex items-start gap-2.5 text-xs text-[#08246B] dark:text-white">
              <Info size={16} className="text-[#FF6A00] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Tapping below opens the download link in your browser. When installing the APK, Android will ask you to allow installs from this source.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <a
                href={update.apkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
              >
                <Download size={16} />
                <span>Download Update</span>
                <ExternalLink size={14} className="opacity-80" />
              </a>

              {!mandatory && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="min-h-[46px] px-4 py-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
                >
                  Later
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
