import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Lightbulb, Megaphone, MessageSquare, ShieldCheck, X } from 'lucide-react';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { triggerHaptic } from '@/src/lib/haptics';
import type { InAppNotificationPop } from '@/src/types/call';

function PopLeadingBadge({ item }: { item: InAppNotificationPop }) {
  if (item.senderPhotoUrl) {
    return (
      <img
        src={item.senderPhotoUrl}
        alt={item.title}
        referrerPolicy="no-referrer"
        className="w-10 h-10 rounded-full object-cover border border-[#DDE4EA] dark:border-[var(--dark-border)] shrink-0"
      />
    );
  }

  if (item.kind === 'inbox-user') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
        <ShieldCheck size={19} />
      </div>
    );
  }

  if (item.kind === 'inbox-admin') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#4FA3F7]/15 text-[#2563EB] dark:text-[#4FA3F7] flex items-center justify-center shrink-0">
        <MessageSquare size={18} />
      </div>
    );
  }

  if (item.broadcastKind === 'update') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
        <FlaticonIcon name="fi-rr-rocket-lunch" className="text-[19px]" />
      </div>
    );
  }

  if (item.broadcastKind === 'tip') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
        <Lightbulb size={18} />
      </div>
    );
  }

  if (item.broadcastKind === 'urgent') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] dark:bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center shrink-0">
        <AlertTriangle size={18} />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#4FA3F7]/15 text-[#2563EB] dark:text-[#4FA3F7] flex items-center justify-center shrink-0">
      <Megaphone size={18} />
    </div>
  );
}

export function NotificationPopToast({
  item,
  onAction,
  onDismiss,
}: {
  item: InAppNotificationPop | null;
  onAction: (item: InAppNotificationPop) => void;
  onDismiss: (id: string) => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!item) return;
    const timer = window.setTimeout(() => {
      onDismiss(item.id);
    }, 7500);
    return () => window.clearTimeout(timer);
  }, [item, onDismiss]);

  return (
    <div className="fixed top-[calc(0.75rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[65] w-[calc(100vw-1.25rem)] max-w-md pointer-events-none">
      <AnimatePresence mode="wait">
        {item && (
          <motion.div
            key={item.id}
            role="status"
            aria-live="polite"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -22, scale: 0.96 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-2xl p-3.5 flex items-start gap-3"
          >
            <PopLeadingBadge item={item} />

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6A00]">
                  {item.badgeLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tap');
                    onDismiss(item.id);
                  }}
                  aria-label="Dismiss notification"
                  className="w-6 h-6 -mr-1 -mt-0.5 rounded-lg text-[#8A93A0] hover:text-[#08246B] dark:hover:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                {item.title}
              </p>

              <p className="text-xs leading-snug text-[#4B5563] dark:text-[var(--dark-text-secondary)] line-clamp-2 break-words">
                {item.body}
              </p>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tap');
                    onAction(item);
                  }}
                  className="min-h-[32px] px-3 py-1 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-[11px] font-semibold text-white transition-colors"
                >
                  {item.actionLabel}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
