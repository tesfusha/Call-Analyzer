import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Copy, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import { CustomSelect } from '@/src/components/CustomSelect';
import { toWhatsAppPhoneDigits } from '@/src/lib/ethiopia';
import {
  buildBirthdayWish,
  buildHolidayWish,
  getHolidaysInGregorianYearOrUpcoming,
} from '@/src/lib/ethiopianCalendar';
import { maskPhoneNumber } from '@/src/lib/security';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { ContactProfile } from '@/src/types/call';

type WishMode = 'holiday' | 'birthday';

export function QuickWishModal({
  contact,
  onClose,
}: {
  contact: ContactProfile | null;
  onClose: () => void;
}) {
  const { calendarPrefs, privacyMode, showNotice } = useCalls();
  useLockBodyScroll(Boolean(contact));
  const prefersReducedMotion = useReducedMotion();

  const holidays = useMemo(
    () => getHolidaysInGregorianYearOrUpcoming(new Date(), 366, calendarPrefs.defaultLang),
    [calendarPrefs.defaultLang],
  );

  const [mode, setMode] = useState<WishMode>('holiday');
  const [selectedHolidayKey, setSelectedHolidayKey] = useState<string>('');
  const [message, setMessage] = useState('');

  const holidayUid = (h: (typeof holidays)[number]) =>
    `${h.key}-${h.ethiopian.year}-${h.ethiopian.month}-${h.ethiopian.day}`;

  useEffect(() => {
    if (!contact) return;
    const defaultHoliday = holidays[0];
    setSelectedHolidayKey(defaultHoliday ? holidayUid(defaultHoliday) : '');
    const startMode: WishMode = contact.birthday ? 'birthday' : 'holiday';
    setMode(startMode);
    if (startMode === 'birthday') {
      setMessage(buildBirthdayWish(contact.name, 'Birthday', contact.tag));
    } else {
      setMessage(
        buildHolidayWish(defaultHoliday?.name ?? 'Holiday', contact.name, contact.tag),
      );
    }
  }, [contact, holidays]);

  useEffect(() => {
    if (!contact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contact, onClose]);

  const activeHoliday =
    holidays.find((h) => holidayUid(h) === selectedHolidayKey) ?? holidays[0] ?? null;

  const switchMode = (nextMode: WishMode) => {
    if (!contact) return;
    setMode(nextMode);
    if (nextMode === 'birthday') {
      setMessage(buildBirthdayWish(contact.name, 'Birthday', contact.tag));
    } else {
      setMessage(
        buildHolidayWish(activeHoliday?.name ?? 'Holiday', contact.name, contact.tag),
      );
    }
  };

  const handleHolidayChange = (holidayKey: string) => {
    if (!contact) return;
    setSelectedHolidayKey(holidayKey);
    const found = holidays.find((h) => holidayUid(h) === holidayKey);
    setMode('holiday');
    setMessage(buildHolidayWish(found?.name ?? 'Holiday', contact.name, contact.tag));
  };

  const copyMessage = async () => {
    if (!contact) return;
    try {
      await navigator.clipboard.writeText(message);
      showNotice(`Copied wish for ${contact.name}.`);
    } catch {
      showNotice('Clipboard unavailable in this browser.');
    }
  };

  const categories: Array<CategoryItem<WishMode>> = [
    { key: 'holiday', label: 'Ethiopian Holiday' },
    { key: 'birthday', label: 'Birthday Wish' },
  ];

  return (
    <AnimatePresence>
      {contact && (
        <motion.div
          key="quick-wish-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/45 dark:bg-black/70 backdrop-blur-sm p-0 sm:p-4 overscroll-contain"
          onClick={onClose}
        >
          <motion.div
            key="quick-wish-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Send wish to ${contact.name}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[#08246B] dark:text-white truncate">
                    Send wish to {contact.name}
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] font-mono tabular-nums truncate">
                    {maskPhoneNumber(contact.number, privacyMode)}
                    {contact.tag ? ` · ${contact.tag}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close wish composer"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
              >
                <X size={18} />
              </button>
            </div>

            <CategoryTabs
              items={categories}
              activeKey={mode}
              onChange={switchMode}
              ariaLabel="Wish occasion type"
              variant="inset"
            />

            <CategoryPanel
              activeKey={mode}
              label={mode === 'holiday' ? 'Ethiopian Holiday' : 'Birthday Wish'}
              transitionStyle="fade"
              className="space-y-3"
            >
              {mode === 'holiday' && holidays.length > 0 && (
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Occasion
                  </span>
                  <CustomSelect
                    ariaLabel="Choose Ethiopian holiday occasion"
                    value={activeHoliday ? holidayUid(activeHoliday) : ''}
                    variant="inset"
                    fullWidth
                    options={holidays.map((h) => ({
                      value: holidayUid(h),
                      label: h.name,
                      sublabel: h.isToday ? 'Today' : `In ${h.daysUntil}d`,
                    }))}
                    onChange={handleHolidayChange}
                  />
                </div>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Message preview
                </span>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-xs text-[#08246B] dark:text-white resize-none focus:outline-none focus:border-[#FF6A00]"
                />
              </label>
            </CategoryPanel>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void copyMessage()}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap"
              >
                <Copy size={14} />
                Copy
              </button>
              {toWhatsAppPhoneDigits(contact.number) && (
                <a
                  href={`https://wa.me/${toWhatsAppPhoneDigits(contact.number)}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#10B981]/50 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-xs font-semibold text-[#047857] dark:text-[#34D399] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Send size={14} />
                  WhatsApp
                </a>
              )}
              <a
                href={`sms:${contact.number}?body=${encodeURIComponent(message)}`}
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <MessageSquare size={14} />
                Send SMS
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
