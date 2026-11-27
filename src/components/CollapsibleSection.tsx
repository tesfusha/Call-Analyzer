import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { triggerHaptic } from '@/src/lib/haptics';

export function CollapsibleSection({
  title,
  summary,
  icon: Icon,
  flaticon,
  open,
  onToggle,
  rightHint,
  children,
  className = '',
  contentClassName = '',
}: {
  title: string;
  summary?: string;
  icon?: LucideIcon;
  flaticon?: string;
  open: boolean;
  onToggle: () => void;
  rightHint?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const baseId = useId();
  const headerId = `${baseId}-header`;
  const panelId = `${baseId}-panel`;

  return (
    <section
      className={`rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden ${className}`}
    >
      <button
        id={headerId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          triggerHaptic('tap');
          onToggle();
        }}
        className="w-full min-h-[60px] px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F8FAFC] dark:hover:bg-[var(--dark-elevated)]/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {(flaticon || Icon) && (
            <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              {flaticon ? (
                <FlaticonIcon name={flaticon} className="text-[17px]" />
              ) : (
                Icon && <Icon size={17} />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
              {title}
            </h2>
            {summary && (
              <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                {summary}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0">
          {rightHint && <span className="hidden sm:inline">{rightHint}</span>}
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${
              open ? 'rotate-180 text-[#FF6A00]' : ''
            }`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={headerId}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.1 : 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden"
          >
            <div
              className={`border-t border-[#DDE4EA] dark:border-[var(--dark-border)] ${contentClassName}`}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
