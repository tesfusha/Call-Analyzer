import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Copy,
  Flame,
  Hash,
  HeartPulse,
  Phone,
  ShieldAlert,
  Signal,
  SlidersHorizontal,
  Wrench,
  X,
} from 'lucide-react';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import {
  ETHIOPIAN_EMERGENCY_HOTLINES,
  ETHIOPIAN_USSD_CODES,
  toDialableUssdHref,
  type EmergencyCategory,
} from '@/src/lib/ethiopia';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';

export type UssdCategory = 'all' | 'emergency' | 'ethio' | 'safaricom' | 'custom';

const USSD_META: Record<UssdCategory, { title: string; description: string }> = {
  all: {
    title: 'All Carrier USSD Codes',
    description: 'All ETC & SFC balance, package, and callback codes',
  },
  emergency: {
    title: '24/7 Ethiopian Emergency Hotlines',
    description: '24/7 Ethiopian police, fire, ambulance, traffic, and essential utility hotlines',
  },
  ethio: {
    title: 'ETC USSD Codes',
    description: 'ETC airtime, package menu (*999#), transfer, and support codes',
  },
  safaricom: {
    title: 'SFC USSD Codes',
    description: 'SFC balance (*704#), offers (*777#), and support codes',
  },
  custom: {
    title: 'Custom USSD Dialer',
    description: 'Dial any custom USSD, Telebirr, or voucher recharge code directly',
  },
};

function EmergencyIcon({ category, id }: { category: EmergencyCategory; id: string }) {
  if (id === 'fire') return <Flame size={15} className="text-[#EF4444]" />;
  if (category === 'medical') return <HeartPulse size={15} className="text-[#EF4444]" />;
  if (category === 'utility') return <Wrench size={15} className="text-[#FF6A00]" />;
  return <ShieldAlert size={15} className="text-[#EF4444]" />;
}

export function CarrierUssdModal({
  open,
  onClose,
  initialCategory = 'all',
}: {
  open: boolean;
  onClose: () => void;
  initialCategory?: UssdCategory;
}) {
  const { showNotice } = useCalls();
  useLockBodyScroll(open);
  const prefersReducedMotion = useReducedMotion();
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<UssdCategory>(initialCategory);
  const [customCode, setCustomCode] = useState('*127#');

  useEffect(() => {
    if (open) setActiveCategory(initialCategory);
  }, [open, initialCategory]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = 0;
    }
  }, [activeCategory, open]);

  const ethioCount = ETHIOPIAN_USSD_CODES.filter((c) => c.carrier === 'ETC').length;
  const safariCount = ETHIOPIAN_USSD_CODES.filter((c) => c.carrier === 'SFC').length;

  const categories: Array<CategoryItem<UssdCategory>> = [
    { key: 'all', label: 'All', icon: Hash, count: ETHIOPIAN_USSD_CODES.length },
    {
      key: 'emergency',
      label: 'SOS',
      icon: ShieldAlert,
      count: ETHIOPIAN_EMERGENCY_HOTLINES.length,
    },
    { key: 'ethio', label: 'ETC', icon: Signal, count: ethioCount },
    { key: 'safaricom', label: 'SFC', icon: Phone, count: safariCount },
    { key: 'custom', label: 'Custom', icon: SlidersHorizontal },
  ];

  const visibleCodes =
    activeCategory === 'all'
      ? ETHIOPIAN_USSD_CODES
      : activeCategory === 'ethio'
        ? ETHIOPIAN_USSD_CODES.filter((item) => item.carrier === 'ETC')
        : activeCategory === 'safaricom'
          ? ETHIOPIAN_USSD_CODES.filter((item) => item.carrier === 'SFC')
          : [];

  const copyCode = async (code: string, label: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showNotice(`Copied ${label} (${code}).`);
    } catch {
      showNotice(`Number / code: ${code}`);
    }
  };

  const cleanCustom = customCode.trim();
  const activeMeta = USSD_META[activeCategory];

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ussd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/45 dark:bg-black/70 backdrop-blur-sm p-0 sm:p-4 overscroll-contain"
          onClick={onClose}
        >
          <motion.div
            key="ussd-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col h-[84dvh] sm:h-[620px] max-h-[90dvh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Ethiopian Emergency Hotlines and Carrier USSD Shortcuts"
          >
            {/* Pinned Header + Tabs */}
            <div className="shrink-0 p-5 pb-3.5 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      activeCategory === 'emergency'
                        ? 'bg-[#EF4444]/15 text-[#EF4444]'
                        : 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00]'
                    }`}
                  >
                    {activeCategory === 'emergency' ? <ShieldAlert size={18} /> : <Hash size={18} />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-[#08246B] dark:text-white truncate">
                      {activeCategory === 'emergency'
                        ? 'Ethiopian Emergency Hotlines'
                        : 'Carrier USSD & Hotlines'}
                    </h2>
                    <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                      {activeMeta.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close USSD and emergency hotlines"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <CategoryTabs
                items={categories}
                activeKey={activeCategory}
                onChange={setActiveCategory}
                ariaLabel="Carrier USSD and emergency categories"
                variant="inset"
              />
            </div>

            {/* Dedicated Scrollable Body */}
            <div ref={bodyScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-5">
              <CategoryPanel activeKey={activeCategory} label={activeMeta.title} transitionStyle="fade">
                <div className="pb-2 border-b border-[#DDE4EA]/70 dark:border-[var(--dark-border)]">
                  <h3 className="text-sm font-bold text-[#08246B] dark:text-white">
                    {activeMeta.title}
                  </h3>
                </div>
          {activeCategory === 'emergency' ? (
            <div className="space-y-2.5">
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/60 dark:bg-[var(--dark-canvas)] overflow-hidden">
                {ETHIOPIAN_EMERGENCY_HOTLINES.map((hotline) => {
                  const isUrgent = hotline.category !== 'utility';
                  return (
                    <div
                      key={hotline.id}
                      className="px-3.5 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isUrgent
                              ? 'bg-[#EF4444]/12'
                              : 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15'
                          }`}
                        >
                          <EmergencyIcon category={hotline.category} id={hotline.id} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-xs font-semibold text-[#08246B] dark:text-white">
                              {hotline.label}
                            </span>
                            <span className="text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              {hotline.amharicLabel}
                            </span>
                            <span
                              className={`text-xs font-mono font-bold tabular-nums ${
                                isUrgent ? 'text-[#EF4444]' : 'text-[#FF6A00]'
                              }`}
                            >
                              {hotline.number}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                            {hotline.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void copyCode(hotline.number, hotline.label)}
                          aria-label={`Copy ${hotline.number}`}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white"
                        >
                          <Copy size={14} />
                        </button>
                        <a
                          href={toDialableUssdHref(hotline.number)}
                          onClick={() =>
                            showNotice(`Opening dialer for ${hotline.label} (${hotline.number})...`)
                          }
                          className={`min-h-[38px] px-3 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            isUrgent
                              ? 'bg-[#EF4444] hover:bg-[#DC2626]'
                              : 'bg-[#FF6A00] hover:bg-[#E65F00]'
                          }`}
                        >
                          <Phone size={13} />
                          Call {hotline.number}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Toll-free or standard Ethiopian shortcodes route directly through your phone dialer.
              </p>
            </div>
          ) : activeCategory !== 'custom' ? (
            <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/60 dark:bg-[var(--dark-canvas)] overflow-hidden">
              {visibleCodes.map((item) => (
                <div key={item.id} className="px-3.5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[#08246B] dark:text-white">
                        {item.label}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-[#FF6A00] tabular-nums">
                        {item.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                      {item.carrier} · {item.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void copyCode(item.code, item.label)}
                      aria-label={`Copy ${item.code}`}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white"
                    >
                      <Copy size={14} />
                    </button>
                    <a
                      href={toDialableUssdHref(item.code)}
                      onClick={() => showNotice(`Opening dialer for ${item.code}...`)}
                      className="min-h-[38px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Phone size={13} />
                      Dial
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] p-4 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Custom USSD / Telebirr / Recharge code
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    placeholder="e.g. *127# or *805*PIN#"
                    className="flex-1 min-w-0 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm font-mono text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                  />
                  {cleanCustom && (
                    <a
                      href={toDialableUssdHref(cleanCustom)}
                      onClick={() => showNotice(`Opening dialer for ${cleanCustom}...`)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Phone size={14} />
                      Dial code
                    </a>
                  )}
                </div>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {['*127#', '*805*', '*999#', '*777#'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCustomCode(preset)}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-mono font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Hashes (#) are encoded automatically for mobile phone dialers.
              </p>
            </div>
          )}
        </CategoryPanel>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
