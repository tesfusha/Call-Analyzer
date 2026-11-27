import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { triggerHaptic } from '@/src/lib/haptics';

export type CategoryItem<T extends string> = {
  key: T;
  label: string;
  icon?: LucideIcon;
  flaticon?: string;
  count?: number;
};

const GRID_CLASS: Record<number, string> = {
  2: 'grid grid-cols-2',
  3: 'grid grid-cols-3',
  4: 'grid grid-cols-4',
  5: 'grid grid-cols-6 sm:grid-cols-5',
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
  const isFiveTabs = items.length === 5;
  const isOverflowTabs = items.length > 5;
  const layoutClass = GRID_CLASS[items.length] ?? 'flex overflow-x-auto no-scrollbar md:grid md:grid-cols-4';
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
      data-unslop-tabs="category"
      aria-label={ariaLabel}
      className={`${layoutClass} items-center gap-1 p-1 rounded-2xl ${containerBg} border border-[#DDE4EA] dark:border-[var(--dark-border)] ${className}`}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        const active = activeKey === item.key;
        const fiveTabSpanClass = isFiveTabs
          ? idx < 3
            ? 'col-span-2 sm:col-span-1'
            : 'col-span-3 sm:col-span-1'
          : '';
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
            className={`relative min-h-[42px] ${fiveTabSpanClass} ${
              isOverflowTabs ? 'shrink-0 sm:shrink sm:min-w-0 px-3 sm:px-2.5' : 'min-w-0 px-2 sm:px-3'
            } py-2 rounded-xl text-[11.5px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-100 ${
              active
                ? 'bg-[#FF6A00] text-white shadow-sm'
                : `text-[#4B5563] dark:text-[var(--dark-text-secondary)] ${inactiveHover}`
            }`}
          >
            {showIcons &&
              (item.flaticon ? (
                <FlaticonIcon
                  name={item.flaticon}
                  className={`text-[14px] shrink-0 ${isFiveTabs || isOverflowTabs ? 'inline-flex' : 'hidden sm:inline-flex'}`}
                />
              ) : Icon ? (
                <Icon
                  size={14}
                  className={`shrink-0 ${isFiveTabs || isOverflowTabs ? 'inline-block' : 'hidden sm:inline-block'}`}
                />
              ) : null)}
            <span className="truncate">{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={`font-mono tabular-nums text-[10px] sm:text-[11px] shrink-0 ${
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
  className = 'space-y-4',
}: {
  activeKey: string;
  label: string;
  children: ReactNode;
  transitionStyle?: 'slide' | 'fade';
  className?: string;
}) {
  return (
    <div
      key={activeKey}
      role="tabpanel"
      aria-label={label}
      className={className}
    >
      {children}
    </div>
  );
}
