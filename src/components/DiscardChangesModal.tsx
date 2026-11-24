import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import type { DiscardPromptState } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';

export function DiscardChangesModal({ prompt }: { prompt: DiscardPromptState | null }) {
  const open = Boolean(prompt?.open);
  useLockBodyScroll(open);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!prompt?.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') prompt.onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt]);

  const content = (
    <AnimatePresence>
      {prompt?.open && (
        <motion.div
          key="discard-changes-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.15 }}
          onClick={prompt.onCancel}
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
        >
          <motion.div
            key="discard-changes-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-changes-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 shadow-xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <AlertTriangle size={19} />
                </div>
                <div className="min-w-0">
                  <h2
                    id="discard-changes-title"
                    className="text-sm font-bold text-[#08246B] dark:text-white"
                  >
                    Discard unsaved changes?
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] mt-0.5 leading-relaxed">
                    {prompt.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={prompt.onCancel}
                aria-label="Keep editing"
                className="min-h-[38px] min-w-[38px] rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={prompt.onCancel}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={prompt.onConfirm}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-xs font-semibold text-white transition-colors"
              >
                Discard changes
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}
