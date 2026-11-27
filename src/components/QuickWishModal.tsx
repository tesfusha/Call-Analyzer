import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Cake, Copy, MessageSquare, RotateCcw, Send, X } from 'lucide-react';
import { CustomSelect } from '@/src/components/CustomSelect';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { toWhatsAppPhoneDigits } from '@/src/lib/ethiopia';
import {
  OTHER_WISH_PRESETS,
  buildBirthdayWish,
  buildHolidayWish,
  getDefaultWishTemplate,
  getHolidaysInGregorianYearOrUpcoming,
  resolveWishTemplatePlaceholders,
  type CalendarLang,
  type OtherWishPresetKey,
} from '@/src/lib/ethiopianCalendar';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { ContactProfile } from '@/src/types/call';

type WishMode = 'holiday' | 'birthday' | 'other';

export function QuickWishModal({
  contact,
  onClose,
}: {
  contact: ContactProfile | null;
  onClose: () => void;
}) {
  const { calendarPrefs, showNotice } = useCalls();
  useLockBodyScroll(Boolean(contact));
  const prefersReducedMotion = useReducedMotion();

  const [lang, setLang] = useState<CalendarLang>(calendarPrefs.defaultLang);
  const holidays = useMemo(
    () => getHolidaysInGregorianYearOrUpcoming(new Date(), 366, lang),
    [lang],
  );

  const [mode, setMode] = useState<WishMode>('holiday');
  const [selectedHolidayKey, setSelectedHolidayKey] = useState<string>('');
  const [otherPreset, setOtherPreset] = useState<OtherWishPresetKey>('greeting');
  const [customOccasion, setCustomOccasion] = useState('');
  const [message, setMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const holidayUid = (h: (typeof holidays)[number]) =>
    `${h.key}-${h.ethiopian.year}-${h.ethiopian.month}-${h.ethiopian.day}`;

  const activeHoliday =
    holidays.find((h) => holidayUid(h) === selectedHolidayKey) ?? holidays[0] ?? null;

  const computeMessage = (
    targetMode: WishMode,
    targetLang: CalendarLang,
    holidayName: string,
    preset: OtherWishPresetKey,
    customTitle: string,
  ) => {
    if (!contact) return '';
    if (targetMode === 'birthday') {
      return buildBirthdayWish(contact.name, 'Birthday', contact.tag, targetLang);
    }
    if (targetMode === 'holiday') {
      return buildHolidayWish(holidayName, contact.name, contact.tag, targetLang);
    }
    const meta = OTHER_WISH_PRESETS.find((p) => p.key === preset) ?? OTHER_WISH_PRESETS[0];
    const occLabel =
      preset === 'custom' && customTitle.trim()
        ? customTitle.trim()
        : targetLang === 'amharic'
          ? meta.occasionAm
          : meta.occasionEn;
    return resolveWishTemplatePlaceholders(
      getDefaultWishTemplate({
        occasionType: 'other',
        tag: contact.tag,
        lang: targetLang,
        otherPreset: preset,
      }),
      { name: contact.name, occasion: occLabel },
    );
  };

  useEffect(() => {
    if (!contact) return;
    const startLang = calendarPrefs.defaultLang;
    setLang(startLang);
    const list = getHolidaysInGregorianYearOrUpcoming(new Date(), 366, startLang);
    const defaultHoliday = list[0];
    setSelectedHolidayKey(defaultHoliday ? holidayUid(defaultHoliday) : '');
    const startMode: WishMode = contact.birthday ? 'birthday' : 'holiday';
    setMode(startMode);
    setOtherPreset('greeting');
    setCustomOccasion('');
    setIsDirty(false);
    setMessage(
      startMode === 'birthday'
        ? buildBirthdayWish(contact.name, 'Birthday', contact.tag, startLang)
        : buildHolidayWish(
            defaultHoliday?.name ?? 'Holiday',
            contact.name,
            contact.tag,
            startLang,
          ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact]);

  useEffect(() => {
    if (!contact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contact, onClose]);

  useBackHandler({
    id: 'quick-wish-modal',
    active: Boolean(contact),
    priority: 55,
    onBack: onClose,
    hasUnsavedChanges: () => isDirty,
    unsavedMessage: 'Discard your edited wish message?',
  });

  const switchMode = (nextMode: WishMode) => {
    if (!contact) return;
    setMode(nextMode);
    setIsDirty(false);
    setMessage(
      computeMessage(
        nextMode,
        lang,
        activeHoliday?.name ?? 'Holiday',
        otherPreset,
        customOccasion,
      ),
    );
  };

  const handleHolidayChange = (holidayKey: string) => {
    if (!contact) return;
    setSelectedHolidayKey(holidayKey);
    const found = holidays.find((h) => holidayUid(h) === holidayKey);
    setMode('holiday');
    setIsDirty(false);
    setMessage(
      computeMessage('holiday', lang, found?.name ?? 'Holiday', otherPreset, customOccasion),
    );
  };

  const handleOtherPreset = (preset: OtherWishPresetKey) => {
    if (!contact) return;
    setOtherPreset(preset);
    setMode('other');
    setIsDirty(false);
    setMessage(
      computeMessage('other', lang, activeHoliday?.name ?? 'Holiday', preset, customOccasion),
    );
  };

  const handleLangSwitch = (nextLang: CalendarLang) => {
    if (nextLang === lang || !contact) return;
    setLang(nextLang);
    const list = getHolidaysInGregorianYearOrUpcoming(new Date(), 366, nextLang);
    const found =
      (activeHoliday ? list.find((h) => h.key === activeHoliday.key) : undefined) ?? list[0];
    if (found) setSelectedHolidayKey(holidayUid(found));
    if (!isDirty) {
      setMessage(
        computeMessage(mode, nextLang, found?.name ?? 'Holiday', otherPreset, customOccasion),
      );
    }
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

  const modalContent = (
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
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Send wish to ${contact.name}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <FlaticonIcon name="fi-rr-gift" className="text-[18px]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[#08246B] dark:text-white truncate">
                    Send wish to {contact.name}
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] font-mono tabular-nums truncate">
                    {contact.number}
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

            <div
              role="tablist"
              aria-label="Wish occasion type"
              className="grid grid-cols-3 gap-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] p-1 border border-[#DDE4EA] dark:border-[var(--dark-border)]"
            >
              {(
                [
                  { key: 'holiday', label: 'Holiday', icon: null, flaticon: 'fi-rr-calendar-star' },
                  { key: 'birthday', label: 'Birthday', icon: Cake, flaticon: null },
                  { key: 'other', label: 'Other', icon: MessageSquare, flaticon: null },
                ] as const
              ).map(({ key, label, icon: Icon, flaticon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => switchMode(key)}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                    mode === key
                      ? 'bg-[#FF6A00] text-white shadow-sm'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                  }`}
                >
                  {flaticon ? (
                    <FlaticonIcon name={flaticon} className="text-[13px]" />
                  ) : (
                    Icon && <Icon size={13} />
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {mode === 'holiday' && holidays.length > 0 && (
              <div className="space-y-1">
                <span className="block text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Select holiday
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

            {mode === 'other' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {OTHER_WISH_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleOtherPreset(preset.key)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-xl border text-xs font-semibold whitespace-nowrap ${
                        otherPreset === preset.key
                          ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#FF6A00]'
                          : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {otherPreset === 'custom' && (
                  <input
                    type="text"
                    value={customOccasion}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomOccasion(val);
                      if (!isDirty) {
                        setMessage(
                          computeMessage(
                            'other',
                            lang,
                            activeHoliday?.name ?? 'Holiday',
                            'custom',
                            val,
                          ),
                        );
                      }
                    }}
                    placeholder="Occasion name (optional)"
                    className="w-full min-h-[38px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white"
                  />
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] p-1 border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                <button
                  type="button"
                  onClick={() => handleLangSwitch('english')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    lang === 'english'
                      ? 'bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white shadow-sm'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleLangSwitch('amharic')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    lang === 'amharic'
                      ? 'bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white shadow-sm'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                  }`}
                >
                  አማርኛ
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDirty(false);
                  setMessage(
                    computeMessage(
                      mode,
                      lang,
                      activeHoliday?.name ?? 'Holiday',
                      otherPreset,
                      customOccasion,
                    ),
                  );
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
              >
                <RotateCcw size={12} />
                Default
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Default message (edit freely)
              </span>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-xs text-[#08246B] dark:text-white resize-none focus:outline-none focus:border-[#FF6A00]"
              />
            </label>

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

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
