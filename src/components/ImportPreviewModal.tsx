import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Contact,
  FileSpreadsheet,
  Flame,
  Settings,
  Tag,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import type { ImportPreviewSummary, ParsedImportPackage } from '@/src/lib/import';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';

export type PendingImportState = {
  pkg: ParsedImportPackage;
  preview: ImportPreviewSummary;
};

export function ImportPreviewModal({
  pending,
  onClose,
  onConfirm,
}: {
  pending: PendingImportState | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useLockBodyScroll(Boolean(pending));
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, onClose]);

  useBackHandler({
    id: 'import-preview-modal',
    active: Boolean(pending),
    priority: 60,
    onBack: onClose,
  });

  const preview = pending?.preview ?? null;

  const backupBadges: Array<{ label: string; detail: string; icon: typeof Tag }> = preview
    ? [
        ...(preview.newTagsCount > 0
          ? [{ label: 'Tags', detail: `${preview.newTagsCount} new`, icon: Tag }]
          : []),
        ...(preview.contactsCount > 0
          ? [
              {
                label: 'Contacts',
                detail: `${preview.newContactsCount} new · ${preview.updatedContactsCount} merge`,
                icon: Contact,
              },
            ]
          : []),
        ...(preview.scheduledCallsCount > 0
          ? [
              {
                label: 'Schedules',
                detail: `${preview.newScheduledCount} new`,
                icon: Clock,
              },
            ]
          : []),
        ...(preview.hasSettings
          ? [{ label: 'Settings', detail: 'Included', icon: Settings }]
          : []),
        ...(preview.hasStreaks
          ? [{ label: 'Streaks', detail: 'Included', icon: Flame }]
          : []),
        ...(preview.hasScore
          ? [{ label: 'Score', detail: `${preview.scorePreviewValue ?? 0} pts`, icon: Trophy }]
          : []),
        ...(preview.hasBadges
          ? [{ label: 'Badges', detail: 'Included', icon: Award }]
          : []),
        ...(preview.hasContactMilestones
          ? [
              {
                label: 'Milestones',
                detail: `${preview.contactMilestonesCount} contact`,
                icon: Flame,
              },
            ]
          : []),
      ]
    : [];

  const modalContent = (
    <AnimatePresence>
      {pending && preview && (
        <motion.div
          key="import-preview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
        >
          <motion.div
            key="import-preview-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Import Preview"
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col max-h-[88dvh] overflow-hidden shadow-xl"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={19} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-[#08246B] dark:text-white truncate">
                    Preview Before Import
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    {preview.filename} · {preview.formatLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close import preview"
                className="min-h-[40px] min-w-[40px] rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
              {preview.newerSchemaWarning && (
                <div className="rounded-xl bg-[#F59E0B]/12 border border-[#F59E0B]/35 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-[#08246B] dark:text-white">
                  <AlertTriangle size={15} className="text-[#F59E0B] mt-0.5 shrink-0" />
                  <span>
                    This backup uses schema v{preview.schemaVersion}. Compatible calls, contacts, and settings will still import cleanly.
                  </span>
                </div>
              )}

              {/* Call Row Counts */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                  <p className="text-lg font-mono font-bold tabular-nums text-[#FF6A00]">
                    {preview.newCallsCount}
                  </p>
                  <p className="text-[11px] font-semibold text-[#08246B] dark:text-white">
                    New calls
                  </p>
                </div>

                <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                  <p className="text-lg font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                    {preview.duplicateCallsCount}
                  </p>
                  <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Duplicates
                  </p>
                </div>

                <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                  <p
                    className={`text-lg font-mono font-bold tabular-nums ${
                      preview.invalidCount > 0
                        ? 'text-[#EF4444]'
                        : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                    }`}
                  >
                    {preview.invalidCount}
                  </p>
                  <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Invalid
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                <CheckCircle2 size={15} className="text-[#10B981] mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p>
                    Deduplicated by normalized phone number, timestamp, and duration. Existing local tags and notes are always kept unless empty.
                  </p>
                  {preview.mergeUpdatesCount > 0 && (
                    <p className="font-semibold text-[#08246B] dark:text-white">
                      {preview.mergeUpdatesCount} existing call
                      {preview.mergeUpdatesCount === 1 ? '' : 's'} will fill empty local notes, tags, or names.
                    </p>
                  )}
                </div>
              </div>

              {backupBadges.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    Backup sections included
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {backupBadges.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 flex items-center gap-2"
                        >
                          <Icon size={14} className="text-[#FF6A00] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                              {item.label}
                            </p>
                            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                              {item.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {preview.problems.length > 0 && (
                <div className="rounded-xl bg-[#EF4444]/8 border border-[#EF4444]/30 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0" />
                    Skipped invalid rows ({preview.invalidCount})
                  </p>
                  <ul className="space-y-1 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {preview.problems.map((problem, idx) => (
                      <li key={`${idx}-${problem}`}>{problem}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/80 dark:bg-[var(--dark-canvas)]/70 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!preview.hasRestorableContent}
                onClick={onConfirm}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-45 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Upload size={14} />
                {preview.hasRestorableContent
                  ? preview.isBackup && preview.newCallsCount === 0
                    ? 'Restore Backup'
                    : preview.newCallsCount > 0
                      ? `Import ${preview.newCallsCount} New Call${preview.newCallsCount === 1 ? '' : 's'}`
                      : 'Apply Updates'
                  : 'Nothing New to Import'}
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
