import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { triggerHaptic } from '@/src/lib/haptics';

export type CategoryItem<T extends string> = {
  key: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
};

const GRID_CLASS: Record<number, string> = {
  2: 'grid grid-cols-2',
  3: 'grid grid-cols-3',
  4: 'grid grid-cols-4',
  5: 'grid grid-cols-5',
};

export function CategoryTabs<T extends string>({
  items,
  activeKey,
  onChange,
  ariaLabel,
  variant = 'surface',
  showIcons = false,
  className = '',
}: {
  items: Array<CategoryItem<T>>;
  activeKey: T;
  onChange: (key: T) => void;
  ariaLabel: string;
  variant?: 'surface' | 'inset';
  showIcons?: boolean;
  className?: string;
}) {
  const layoutId = useId();
  const prefersReducedMotion = useReducedMotion();
  const layoutClass = GRID_CLASS[items.length] ?? 'flex overflow-x-auto md:grid md:grid-cols-4';
  const containerBg =
    variant === 'inset'
      ? 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)]'
      : 'bg-white dark:bg-[var(--dark-surface)]';
  const inactiveHover =
    variant === 'inset'
      ? 'hover:bg-white/75 dark:hover:bg-[var(--dark-surface)] hover:text-[#08246B] dark:hover:text-white'
      : 'hover:bg-[#EEF2F6]/80 dark:hover:bg-[var(--dark-elevated)] hover:text-[#08246B] dark:hover:text-white';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`${layoutClass} items-center gap-1 p-1 rounded-2xl ${containerBg} border border-[#DDE4EA] dark:border-[var(--dark-border)] ${className}`}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) triggerHaptic('tap');
              onChange(item.key);
            }}
            className={`relative min-h-[42px] min-w-0 px-1.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap transition-colors ${
              active
                ? 'text-white'
                : `text-[#4B5563] dark:text-[var(--dark-text-secondary)] ${inactiveHover}`
            }`}
          >
            {active && (
              <motion.span
                layoutId={`cat-pill-${layoutId}`}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.08 }
                    : { type: 'spring', stiffness: 440, damping: 34, mass: 0.75 }
                }
                aria-hidden="true"
                className="absolute inset-0 rounded-xl bg-[#FF6A00] shadow-sm z-0"
              />
            )}
            {showIcons && Icon && (
              <Icon size={14} className="relative z-10 shrink-0 hidden sm:inline-block" />
            )}
            <span className="relative z-10 truncate">{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={`relative z-10 font-mono tabular-nums text-[10px] sm:text-[11px] shrink-0 ${
                  active ? 'text-white/90' : 'text-[#8A93A0] dark:text-[var(--dark-text-muted)]'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function CategoryPanel({
  activeKey,
  label,
  children,
  transitionStyle = 'fade',
  className = 'space-y-4',
}: {
  activeKey: string;
  label: string;
  children: ReactNode;
  transitionStyle?: 'slide' | 'fade';
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const fadeOnly = prefersReducedMotion || transitionStyle === 'fade';

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeKey}
        role="tabpanel"
        aria-label={label}
        initial={
          prefersReducedMotion
            ? { opacity: 0 }
            : fadeOnly
              ? { opacity: 0, scale: 0.994 }
              : { opacity: 0, y: 6 }
        }
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : fadeOnly
              ? { opacity: 1, scale: 1 }
              : { opacity: 1, y: 0 }
        }
        exit={
          prefersReducedMotion
            ? { opacity: 0 }
            : fadeOnly
              ? { opacity: 0, scale: 0.996 }
              : { opacity: 0, y: -4 }
        }
        transition={{
          duration: prefersReducedMotion ? 0.08 : 0.16,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
