import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ExternalLink,
  Lightbulb,
  Megaphone,
  X,
} from 'lucide-react';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { useBackHandler } from '@/src/lib/backNavigation';
import { triggerHaptic } from '@/src/lib/haptics';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { BroadcastKind, BroadcastMessage } from '@/src/types/call';

function isSafeHttpsUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return /^https:\/\/[^\s]+$/i.test(url.trim());
}

function getKindMeta(kind: BroadcastKind) {
  switch (kind) {
    case 'update':
      return {
        label: 'App Update',
        icon: null,
        flaticon: 'fi-rr-rocket-lunch',
        accentBg: 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15',
        accentBorder: 'border-[#FF6A00]/35',
        accentText: 'text-[#FF6A00]',
        buttonBg: 'bg-[#FF6A00] hover:bg-[#E65F00]',
      };
    case 'tip':
      return {
        label: 'Tip',
        icon: Lightbulb,
        flaticon: null,
        accentBg: 'bg-[#ECFDF5] dark:bg-[#10B981]/15',
        accentBorder: 'border-[#10B981]/35',
        accentText: 'text-[#10B981]',
        buttonBg: 'bg-[#10B981] hover:bg-[#059669]',
      };
    case 'urgent':
      return {
        label: 'Important',
        icon: AlertTriangle,
        flaticon: null,
        accentBg: 'bg-[#FEF2F2] dark:bg-[#EF4444]/15',
        accentBorder: 'border-[#EF4444]/40',
        accentText: 'text-[#EF4444]',
        buttonBg: 'bg-[#EF4444] hover:bg-[#DC2626]',
      };
    default:
      return {
        label: 'Announcement',
        icon: Megaphone,
        flaticon: null,
        accentBg: 'bg-[#EFF6FF] dark:bg-[#4FA3F7]/15',
        accentBorder: 'border-[#4FA3F7]/40',
        accentText: 'text-[#2563EB] dark:text-[#4FA3F7]',
        buttonBg: 'bg-[#08246B] hover:bg-[#0B318F] dark:bg-[#4FA3F7] dark:hover:bg-[#3B8CE0] dark:text-[#08246B]',
      };
  }
}

export function BroadcastBanners() {
  const { activeBroadcasts, dismissedBroadcastIds, dismissBroadcast } = useCalls();

  const banners = activeBroadcasts
    .filter(
      (b) => b.displayMode === 'banner' && !dismissedBroadcastIds.includes(b.id),
    )
    .slice(0, 2);

  if (banners.length === 0) return null;

  return (
    <div className="mb-4 space-y-2.5" role="region" aria-label="Updates and announcements">
      {banners.map((item) => (
        <BroadcastBannerCard
          key={item.id}
          item={item}
          onDismiss={() => {
            triggerHaptic('tap');
            dismissBroadcast(item.id);
          }}
        />
      ))}
    </div>
  );
}

function BroadcastBannerCard({
  item,
  onDismiss,
}: {
  item: BroadcastMessage;
  onDismiss: () => void;
}) {
  const meta = getKindMeta(item.kind);
  const Icon = meta.icon;
  const safeUrl = isSafeHttpsUrl(item.actionUrl) ? item.actionUrl.trim() : null;

  return (
    <div
      className={`rounded-2xl border ${meta.accentBorder} ${meta.accentBg} px-4 py-3 flex items-start justify-between gap-3`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className={`w-9 h-9 rounded-xl bg-white dark:bg-[var(--dark-surface)] border ${meta.accentBorder} flex items-center justify-center shrink-0 ${meta.accentText} shadow-xs`}
        >
          {meta.flaticon ? (
            <FlaticonIcon name={meta.flaticon} className="text-[18px]" />
          ) : (
            Icon && <Icon size={18} />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${meta.accentText}`}
            >
              {meta.label}
            </span>
            <span className="text-xs font-bold text-[#08246B] dark:text-white break-words">
              {item.title}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[#374151] dark:text-[var(--dark-text-secondary)] whitespace-pre-line break-words">
            {item.message}
          </p>
          {safeUrl && (
            <div className="pt-1">
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold text-white transition-colors ${meta.buttonBg}`}
              >
                <span>{item.actionLabel?.trim() || 'Open link'}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dismiss ${item.title}`}
        className="w-8 h-8 rounded-lg text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function BroadcastPopupModal() {
  const { activeBroadcasts, dismissedBroadcastIds, dismissBroadcast } = useCalls();
  const prefersReducedMotion = useReducedMotion();

  const popup =
    activeBroadcasts.find(
      (b) => b.displayMode === 'popup' && !dismissedBroadcastIds.includes(b.id),
    ) ?? null;

  const handleDismiss = () => {
    if (!popup) return;
    triggerHaptic('tap');
    dismissBroadcast(popup.id);
  };

  useLockBodyScroll(Boolean(popup));

  useBackHandler({
    id: 'broadcast-popup-modal',
    active: Boolean(popup),
    priority: 55,
    onBack: handleDismiss,
  });

  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popup]);

  if (!popup) return null;

  const meta = getKindMeta(popup.kind);
  const Icon = meta.icon;
  const safeUrl = isSafeHttpsUrl(popup.actionUrl) ? popup.actionUrl.trim() : null;

  return (
    <AnimatePresence>
      <motion.div
        key={popup.id}
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-popup-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
        onClick={handleDismiss}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-xl overflow-hidden"
        >
          <div className={`px-5 py-4 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-start justify-between gap-3 ${meta.accentBg}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl bg-white dark:bg-[var(--dark-surface)] border ${meta.accentBorder} flex items-center justify-center shrink-0 ${meta.accentText}`}>
                {meta.flaticon ? (
                  <FlaticonIcon name={meta.flaticon} className="text-[20px]" />
                ) : (
                  Icon && <Icon size={20} />
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${meta.accentText}`}>
                  {meta.label}
                </p>
                <h2
                  id="broadcast-popup-title"
                  className="text-base font-bold text-[#08246B] dark:text-white leading-snug break-words"
                >
                  {popup.title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Close message"
              className="w-8 h-8 rounded-lg text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm leading-relaxed text-[#374151] dark:text-[var(--dark-text-secondary)] whitespace-pre-line break-words">
              {popup.message}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {safeUrl && (
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleDismiss}
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors ${meta.buttonBg}`}
                >
                  <span>{popup.actionLabel?.trim() || 'Open link'}</span>
                  <ExternalLink size={14} />
                </a>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  safeUrl
                    ? 'border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]'
                    : 'bg-[#FF6A00] hover:bg-[#E65F00] text-white'
                }`}
              >
                Got it
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
