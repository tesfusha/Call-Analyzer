import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useBackHandler } from '@/src/lib/backNavigation';

export type CustomSelectOption = {
  value: string;
  label: string;
  count?: number;
  sublabel?: string;
};

type MenuCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
};

export function CustomSelect({
  value,
  options,
  onChange,
  ariaLabel,
  icon: Icon,
  placeholder,
  activeHighlight = false,
  variant = 'surface',
  fullWidth = false,
  compact = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  className = '',
}: {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  icon?: LucideIcon;
  placeholder?: string;
  activeHighlight?: boolean;
  variant?: 'surface' | 'inset';
  fullWidth?: boolean;
  compact?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const prefersReducedMotion = useReducedMotion();

  useBackHandler({
    id: `custom-select-${listboxId}`,
    active: open,
    priority: 80,
    onBack: () => setOpen(false),
  });

  const selected = options.find((opt) => opt.value === value);
  const displayLabel = selected?.label ?? placeholder ?? options[0]?.label ?? 'Select';
  const isPlaceholder = !selected && Boolean(placeholder);

  const visibleOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = !q
      ? options
      : options.filter(
          (opt) =>
            opt.label.toLowerCase().includes(q) ||
            (opt.sublabel ? opt.sublabel.toLowerCase().includes(q) : false),
        );
    return searchable ? matched.slice(0, 50) : matched;
  }, [options, searchQuery, searchable]);

  useEffect(() => {
    if (!open) setSearchQuery('');
  }, [open]);

  const updateCoords = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12;

    const desiredWidth = fullWidth
      ? Math.max(rect.width, 190)
      : Math.max(rect.width, 210);
    const width = Math.min(desiredWidth, viewportW - margin * 2);
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportW - width - margin));

    const spaceBelow = viewportH - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;

    if (openUpward) {
      setCoords({
        bottom: viewportH - rect.top + 6,
        left,
        width,
        maxHeight: Math.max(120, Math.min(264, spaceAbove - 6)),
        openUpward: true,
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left,
        width,
        maxHeight: Math.max(120, Math.min(264, spaceBelow - 6)),
        openUpward: false,
      });
    }
  }, [fullWidth]);

  useEffect(() => {
    if (!open) return;

    updateCoords();

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleScrollOrResize = (e: Event) => {
      if (e.type === 'scroll' && menuRef.current?.contains(e.target as Node)) {
        return;
      }
      updateCoords();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, updateCoords]);

  const inactiveSurface =
    variant === 'inset'
      ? 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]/60'
      : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]';

  const triggerWidthClass = fullWidth
    ? 'w-full justify-between'
    : 'max-w-[min(100%,165px)] sm:max-w-[min(100%,195px)]';

  const triggerSizingClass = compact
    ? 'min-h-[40px] px-2.5 py-1.5 text-xs'
    : 'min-h-[44px] px-3 py-2 text-xs';

  const menuContent =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={menuRef}
                id={listboxId}
                role="listbox"
                aria-label={ariaLabel}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: coords.openUpward ? 4 : -4, scale: 0.98 }
                }
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: coords.openUpward ? 4 : -4, scale: 0.98 }
                }
                transition={{ duration: prefersReducedMotion ? 0.08 : 0.14, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  bottom: coords.bottom,
                  left: coords.left,
                  width: coords.width,
                  maxHeight: coords.maxHeight,
                }}
                className={`z-[80] overflow-y-auto rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-xl p-1.5 space-y-0.5 ${
                  coords.openUpward ? 'origin-bottom' : 'origin-top'
                }`}
              >
                {searchable && (
                  <div className="sticky top-0 z-10 bg-white dark:bg-[var(--dark-surface)] pb-1.5 pt-0.5 px-0.5">
                    <div className="relative">
                      <Search
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
                      />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        autoFocus
                        className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] pl-8 pr-7 py-1.5 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[#8A93A0]"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {visibleOptions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                    No matching options.
                  </p>
                ) : (
                  visibleOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-left text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00]'
                          : 'text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{opt.label}</span>
                          {typeof opt.count === 'number' && (
                            <span
                              className={`text-[11px] font-mono tabular-nums shrink-0 ${
                                isSelected
                                  ? 'text-[#FF6A00]'
                                  : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                              }`}
                            >
                              {opt.count}
                            </span>
                          )}
                        </span>
                        {opt.sublabel && (
                          <span className="block text-[11px] font-normal text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                            {opt.sublabel}
                          </span>
                        )}
                      </span>
                      {isSelected && <Check size={14} className="text-[#FF6A00] shrink-0" />}
                    </button>
                  );
                }))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? 'w-full' : ''} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        className={`${triggerSizingClass} ${triggerWidthClass} rounded-xl border font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
          activeHighlight || open
            ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#08246B] dark:text-white'
            : `${inactiveSurface} ${
                isPlaceholder
                  ? 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                  : 'text-[#08246B] dark:text-white'
              }`
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon size={13} className="text-[#FF6A00] shrink-0" />}
          <span className="truncate">{displayLabel}</span>
          {typeof selected?.count === 'number' && (
            <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0">
              ({selected.count})
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180 text-[#FF6A00]' : ''
          }`}
        />
      </button>
      {menuContent}
    </div>
  );
}
