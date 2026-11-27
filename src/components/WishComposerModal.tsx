import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share } from '@capacitor/share';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  BookmarkCheck,
  Cake,
  Check,
  Copy,
  Instagram,
  MessageCircle,
  MessageSquare,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import { CustomSelect } from '@/src/components/CustomSelect';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { useBackHandler } from '@/src/lib/backNavigation';
import {
  getInstalledMessagingApps,
  isNativeCapacitor,
  type InstalledMessagingApps,
} from '@/src/lib/capacitor';
import { getContactKey } from '@/src/lib/contacts';
import { toWhatsAppPhoneDigits } from '@/src/lib/ethiopia';
import {
  OTHER_WISH_PRESETS,
  getDefaultWishTemplate,
  getHolidaysInGregorianYearOrUpcoming,
  resolveWishTemplatePlaceholders,
  type CalendarLang,
  type OtherWishPresetKey,
} from '@/src/lib/ethiopianCalendar';
import { triggerHaptic } from '@/src/lib/haptics';
import { measureSmsLength } from '@/src/lib/smsUtils';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { WishChannel, WishOccasionType } from '@/src/types/call';

type ComposerCategory = 'holiday' | 'birthday' | 'other';

function getTemplateCategory(tag?: string): string {
  const lower = (tag ?? '').trim().toLowerCase();
  if (lower.includes('family')) return 'family';
  if (lower.includes('business') || lower.includes('work') || lower.includes('coworker')) {
    return 'business';
  }
  return 'general';
}

function buildTemplateKey(
  category: ComposerCategory,
  tag: string | undefined,
  lang: CalendarLang,
  otherPreset?: OtherWishPresetKey,
): string {
  if (category === 'other' && otherPreset) {
    return `other:${otherPreset}:${getTemplateCategory(tag)}:${lang}`;
  }
  return `${category}:${getTemplateCategory(tag)}:${lang}`;
}

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function toComposerCategory(t: WishOccasionType): ComposerCategory {
  if (t === 'birthday') return 'birthday';
  if (t === 'holiday') return 'holiday';
  return 'other';
}

export function WishComposerModal() {
  const {
    wishComposerRequest,
    closeWishComposer,
    calendarPrefs,
    wishTemplates,
    sentWishes,
    contacts,
    saveWishTemplate,
    recordWishOpened,
    recordQuietReconnect,
    showNotice,
  } = useCalls();

  const isOpen = Boolean(wishComposerRequest);
  useLockBodyScroll(isOpen);
  const prefersReducedMotion = useReducedMotion();

  const [lang, setLang] = useState<CalendarLang>(calendarPrefs.defaultLang);
  const [category, setCategory] = useState<ComposerCategory>('holiday');
  const [selectedHolidayUid, setSelectedHolidayUid] = useState<string>('');
  const [otherPreset, setOtherPreset] = useState<OtherWishPresetKey>('greeting');
  const [customOccasionTitle, setCustomOccasionTitle] = useState('');
  const [message, setMessage] = useState('');
  const [baselineMessage, setBaselineMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);
  const [savedTemplateFeedback, setSavedTemplateFeedback] = useState(false);
  const [installedApps, setInstalledApps] = useState<InstalledMessagingApps>({
    whatsapp: true,
    telegram: true,
    instagram: true,
  });

  const currentYear = new Date().getFullYear();

  const holidays = useMemo(
    () => getHolidaysInGregorianYearOrUpcoming(new Date(), 366, lang),
    [lang],
  );

  const holidayUid = (h: (typeof holidays)[number]) =>
    `${h.key}-${h.ethiopian.year}-${h.ethiopian.month}-${h.ethiopian.day}`;

  const activeHoliday = useMemo(
    () => holidays.find((h) => holidayUid(h) === selectedHolidayUid) ?? holidays[0] ?? null,
    [holidays, selectedHolidayUid],
  );

  const contactKey = useMemo(() => {
    if (!wishComposerRequest) return '';
    return wishComposerRequest.contactKey || getContactKey(wishComposerRequest.contactNumber);
  }, [wishComposerRequest]);

  const matchedProfile = contactKey ? contacts[contactKey] : undefined;
  const resolvedTag = wishComposerRequest?.tag || matchedProfile?.tag || '';
  const telegramUsername =
    wishComposerRequest?.telegramUsername || matchedProfile?.telegramUsername || '';
  const instagramUsername =
    wishComposerRequest?.instagramUsername || matchedProfile?.instagramUsername || '';

  const activeOtherMeta = useMemo(
    () => OTHER_WISH_PRESETS.find((p) => p.key === otherPreset) ?? OTHER_WISH_PRESETS[0],
    [otherPreset],
  );

  const effectiveOccasionName = useMemo(() => {
    if (category === 'holiday') {
      return activeHoliday?.name || wishComposerRequest?.occasionName || 'Holiday';
    }
    if (category === 'birthday') {
      return wishComposerRequest?.occasionType === 'birthday' && wishComposerRequest.occasionName
        ? wishComposerRequest.occasionName
        : 'Birthday';
    }
    if (otherPreset === 'custom') {
      return customOccasionTitle.trim() || (lang === 'amharic' ? activeOtherMeta.occasionAm : activeOtherMeta.occasionEn);
    }
    return lang === 'amharic' ? activeOtherMeta.occasionAm : activeOtherMeta.occasionEn;
  }, [
    activeHoliday,
    activeOtherMeta,
    category,
    customOccasionTitle,
    lang,
    otherPreset,
    wishComposerRequest,
  ]);

  const effectiveOccasionKey = useMemo(() => {
    if (category === 'holiday') {
      return activeHoliday?.key || wishComposerRequest?.occasionKey || 'holiday';
    }
    if (category === 'birthday') {
      return wishComposerRequest?.occasionType === 'birthday'
        ? wishComposerRequest.occasionKey
        : `bday-${contactKey || 'wish'}`;
    }
    if (otherPreset === 'checkin' && wishComposerRequest?.occasionType === 'reconnect') {
      return wishComposerRequest.occasionKey;
    }
    return `other:${otherPreset}`;
  }, [activeHoliday, category, contactKey, otherPreset, wishComposerRequest]);

  const templateKey = useMemo(() => {
    if (!wishComposerRequest) return '';
    return buildTemplateKey(category, resolvedTag, lang, category === 'other' ? otherPreset : undefined);
  }, [wishComposerRequest, category, resolvedTag, lang, otherPreset]);

  const resolveAutoText = useCallback(
    (opts: {
      targetCategory: ComposerCategory;
      targetLang: CalendarLang;
      targetHolidayName?: string;
      targetOtherPreset?: OtherWishPresetKey;
      targetCustomTitle?: string;
      preferExplicitInitial?: boolean;
    }) => {
      if (!wishComposerRequest) return '';
      const {
        targetCategory,
        targetLang,
        targetHolidayName,
        targetOtherPreset = 'greeting',
        targetCustomTitle = '',
        preferExplicitInitial = false,
      } = opts;

      const key = buildTemplateKey(
        targetCategory,
        resolvedTag,
        targetLang,
        targetCategory === 'other' ? targetOtherPreset : undefined,
      );
      const savedTpl = wishTemplates[key];

      const occasionLabel =
        targetCategory === 'holiday'
          ? targetHolidayName || 'Holiday'
          : targetCategory === 'birthday'
            ? wishComposerRequest.occasionType === 'birthday' && wishComposerRequest.occasionName
              ? wishComposerRequest.occasionName
              : 'Birthday'
            : targetOtherPreset === 'custom' && targetCustomTitle.trim()
              ? targetCustomTitle.trim()
              : (() => {
                  const p =
                    OTHER_WISH_PRESETS.find((x) => x.key === targetOtherPreset) ??
                    OTHER_WISH_PRESETS[0];
                  return targetLang === 'amharic' ? p.occasionAm : p.occasionEn;
                })();

      const tpl =
        savedTpl ||
        (preferExplicitInitial && wishComposerRequest.initialText?.trim()
          ? wishComposerRequest.initialText.trim()
          : getDefaultWishTemplate({
              occasionType: targetCategory,
              tag: resolvedTag,
              lang: targetLang,
              otherPreset: targetOtherPreset,
            }));

      return resolveWishTemplatePlaceholders(tpl, {
        name: wishComposerRequest.contactName,
        occasion: occasionLabel,
      });
    },
    [resolvedTag, wishComposerRequest, wishTemplates],
  );

  useEffect(() => {
    if (!wishComposerRequest) return;
    const startLang = calendarPrefs.defaultLang;
    const startCat = toComposerCategory(wishComposerRequest.occasionType);
    const startOtherPreset: OtherWishPresetKey =
      wishComposerRequest.occasionType === 'reconnect' ? 'checkin' : 'greeting';

    const langHolidays = getHolidaysInGregorianYearOrUpcoming(new Date(), 366, startLang);
    const matchedHoliday =
      langHolidays.find(
        (h) =>
          h.key === wishComposerRequest.occasionKey ||
          h.name.toLowerCase() === wishComposerRequest.occasionName.toLowerCase(),
      ) ?? langHolidays[0];

    setLang(startLang);
    setCategory(startCat);
    setSelectedHolidayUid(matchedHoliday ? holidayUid(matchedHoliday) : '');
    setOtherPreset(startOtherPreset);
    setCustomOccasionTitle('');

    const initial = resolveAutoText({
      targetCategory: startCat,
      targetLang: startLang,
      targetHolidayName: matchedHoliday?.name ?? wishComposerRequest.occasionName,
      targetOtherPreset: startOtherPreset,
      preferExplicitInitial: true,
    });
    setMessage(initial);
    setBaselineMessage(initial);
    setIsDirty(false);
    setConfirmDiscardOpen(false);
    setCopiedBanner(null);
    setSavedTemplateFeedback(false);

    if (isNativeCapacitor()) {
      void getInstalledMessagingApps().then(setInstalledApps);
    } else {
      setInstalledApps({ whatsapp: true, telegram: true, instagram: true });
    }
    // Only re-initialize when a new composer request arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishComposerRequest]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    closeWishComposer();
  }, [closeWishComposer, isDirty]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDiscardOpen) {
          setConfirmDiscardOpen(false);
        } else {
          requestClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDiscardOpen, isOpen, requestClose]);

  useBackHandler({
    id: 'wish-composer-modal',
    active: isOpen,
    priority: 72,
    onBack: closeWishComposer,
    hasUnsavedChanges: () => isDirty,
    unsavedMessage: 'Discard your edited wish message?',
  });

  const handleCategoryChange = (nextCat: ComposerCategory) => {
    if (nextCat === category) return;
    triggerHaptic('tap');
    setCategory(nextCat);
    const nextText = resolveAutoText({
      targetCategory: nextCat,
      targetLang: lang,
      targetHolidayName: activeHoliday?.name,
      targetOtherPreset: otherPreset,
      targetCustomTitle: customOccasionTitle,
    });
    setMessage(nextText);
    setBaselineMessage(nextText);
    setIsDirty(false);
  };

  const handleHolidayChange = (uid: string) => {
    triggerHaptic('tap');
    setSelectedHolidayUid(uid);
    const found = holidays.find((h) => holidayUid(h) === uid);
    const nextText = resolveAutoText({
      targetCategory: 'holiday',
      targetLang: lang,
      targetHolidayName: found?.name ?? 'Holiday',
    });
    setMessage(nextText);
    setBaselineMessage(nextText);
    setIsDirty(false);
  };

  const handleOtherPresetChange = (presetKey: OtherWishPresetKey) => {
    triggerHaptic('tap');
    setOtherPreset(presetKey);
    const nextText = resolveAutoText({
      targetCategory: 'other',
      targetLang: lang,
      targetOtherPreset: presetKey,
      targetCustomTitle: customOccasionTitle,
    });
    setMessage(nextText);
    setBaselineMessage(nextText);
    setIsDirty(false);
  };

  const handleCustomTitleChange = (title: string) => {
    setCustomOccasionTitle(title);
    if (!isDirty && category === 'other' && otherPreset === 'custom') {
      const nextText = resolveAutoText({
        targetCategory: 'other',
        targetLang: lang,
        targetOtherPreset: 'custom',
        targetCustomTitle: title,
      });
      setMessage(nextText);
      setBaselineMessage(nextText);
    }
  };

  const handleLangChange = (nextLang: CalendarLang) => {
    if (nextLang === lang) return;
    triggerHaptic('tap');
    setLang(nextLang);
    const nextHolidays = getHolidaysInGregorianYearOrUpcoming(new Date(), 366, nextLang);
    const matched =
      (activeHoliday
        ? nextHolidays.find((h) => h.key === activeHoliday.key)
        : undefined) ?? nextHolidays[0];
    if (matched) {
      setSelectedHolidayUid(holidayUid(matched));
    }
    if (!isDirty) {
      const nextText = resolveAutoText({
        targetCategory: category,
        targetLang: nextLang,
        targetHolidayName: matched?.name ?? activeHoliday?.name,
        targetOtherPreset: otherPreset,
        targetCustomTitle: customOccasionTitle,
      });
      setMessage(nextText);
      setBaselineMessage(nextText);
    }
  };

  const handleResetTemplate = () => {
    if (!wishComposerRequest) return;
    triggerHaptic('tap');
    const resetText = resolveWishTemplatePlaceholders(
      getDefaultWishTemplate({
        occasionType: category,
        tag: resolvedTag,
        lang,
        otherPreset,
      }),
      {
        name: wishComposerRequest.contactName,
        occasion: effectiveOccasionName,
      },
    );
    setMessage(resetText);
    setBaselineMessage(resetText);
    setIsDirty(false);
  };

  const handleSaveTemplate = () => {
    if (!wishComposerRequest || !templateKey || !message.trim()) return;
    const nameClean = wishComposerRequest.contactName.trim();
    const firstName = nameClean.split(/\s+/)[0] || '';
    const occasionClean = effectiveOccasionName.trim();
    let tokenized = message.trim();
    if (nameClean) {
      tokenized = tokenized.split(nameClean).join('{name}');
    }
    if (firstName && firstName.length >= 2 && firstName !== nameClean) {
      tokenized = tokenized.split(firstName).join('{name}');
    }
    if (occasionClean && occasionClean.length >= 2) {
      tokenized = tokenized.split(occasionClean).join('{occasion}');
    }
    saveWishTemplate(templateKey, tokenized);
    setSavedTemplateFeedback(true);
    setBaselineMessage(message);
    setIsDirty(false);
    window.setTimeout(() => setSavedTemplateFeedback(false), 2200);
  };

  const existingWishThisYear = useMemo(() => {
    if (!wishComposerRequest || !contactKey) return null;
    return (
      sentWishes.find(
        (w) =>
          w.contactKey === contactKey &&
          w.occasionKey === effectiveOccasionKey &&
          w.year === currentYear,
      ) ?? null
    );
  }, [contactKey, currentYear, effectiveOccasionKey, sentWishes, wishComposerRequest]);

  const smsStats = useMemo(() => measureSmsLength(message), [message]);
  const waDigits = wishComposerRequest ? toWhatsAppPhoneDigits(wishComposerRequest.contactNumber) : '';
  const hasSavedCustomTemplate = Boolean(templateKey && wishTemplates[templateKey]);

  const finalizeChannelTap = (channel: WishChannel) => {
    if (!wishComposerRequest) return;
    const wishRes = recordWishOpened({
      contactKey,
      occasionKey: effectiveOccasionKey,
      year: currentYear,
      channel,
      occasionName: effectiveOccasionName,
      contactName: wishComposerRequest.contactName,
    });
    let reconnectAward = 0;
    if (
      wishComposerRequest.occasionType === 'reconnect' ||
      (category === 'other' && otherPreset === 'checkin')
    ) {
      reconnectAward = recordQuietReconnect(contactKey, wishComposerRequest.contactName).awardedPoints;
    }
    const totalAward = wishRes.awardedPoints + reconnectAward;
    if (totalAward > 0) {
      showNotice(`+${totalAward} pts earned!`, 'success');
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleSmsSend = () => {
    if (!wishComposerRequest || !message.trim()) return;
    finalizeChannelTap('sms');
    const url = `sms:${wishComposerRequest.contactNumber}?body=${encodeURIComponent(message)}`;
    window.location.href = url;
    closeWishComposer();
  };

  const handleWhatsAppSend = () => {
    if (!wishComposerRequest || !waDigits || !message.trim()) return;
    finalizeChannelTap('whatsapp');
    const url = `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    closeWishComposer();
  };

  const handleTelegramSend = async () => {
    if (!wishComposerRequest || !message.trim()) return;
    finalizeChannelTap('telegram');
    await copyToClipboard(message);
    if (telegramUsername) {
      setCopiedBanner('Text copied, paste it in the chat');
      window.open(`https://t.me/${telegramUsername}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (isNativeCapacitor()) {
      try {
        await Share.share({
          title: effectiveOccasionName,
          text: message,
          dialogTitle: 'Share wish via Telegram',
        });
        return;
      } catch {
        // Fallback notice below
      }
    }
    setCopiedBanner('Text copied, paste it in the chat');
    showNotice('Wish text copied — open Telegram and paste it in chat.');
  };

  const handleInstagramSend = async () => {
    if (!wishComposerRequest || !message.trim()) return;
    finalizeChannelTap('instagram');
    await copyToClipboard(message);
    setCopiedBanner('Text copied, paste it in the chat');
    if (instagramUsername) {
      window.open(`https://ig.me/m/${instagramUsername}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (isNativeCapacitor()) {
      try {
        await Share.share({
          title: effectiveOccasionName,
          text: message,
          dialogTitle: 'Share wish via Instagram',
        });
        return;
      } catch {
        // Fallback banner shown above
      }
    }
    showNotice('Text copied, paste it in the chat.');
  };

  const handleCopyOnly = async () => {
    if (!wishComposerRequest || !message.trim()) return;
    const ok = await copyToClipboard(message);
    finalizeChannelTap('copy');
    if (ok) {
      setCopiedBanner('Wish copied to clipboard!');
      showNotice(`Copied message for ${wishComposerRequest.contactName}.`, 'success');
    } else {
      showNotice('Clipboard unavailable in this browser.', 'warning');
    }
  };

  const modalContent = (
    <AnimatePresence>
      {wishComposerRequest && (
        <motion.div
          key="wish-composer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[#08246B]/50 dark:bg-black/75 backdrop-blur-sm p-0 sm:p-4 overscroll-contain"
          onClick={requestClose}
        >
          <motion.div
            key="wish-composer-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4 max-h-[92dvh] overflow-y-auto overscroll-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Compose wish for ${wishComposerRequest.contactName}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0 font-bold text-sm">
                  {getInitials(wishComposerRequest.contactName)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-[#08246B] dark:text-white truncate">
                      {wishComposerRequest.contactName}
                    </h2>
                    {existingWishThisYear && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <Check size={11} />
                        Sent · {currentYear}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    <span className="font-mono tabular-nums">{wishComposerRequest.contactNumber}</span>
                    {resolvedTag ? ` · ${resolvedTag}` : ''}
                    {` · ${effectiveOccasionName}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close wish composer"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* 3-Tab Wish Occasion Type Selector */}
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
              ).map(({ key, label, icon: Icon, flaticon }) => {
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleCategoryChange(key)}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[#FF6A00] text-white shadow-sm'
                        : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                    }`}
                  >
                    {flaticon ? (
                      <FlaticonIcon name={flaticon} className="text-[13px] shrink-0" />
                    ) : (
                      Icon && <Icon size={13} className="shrink-0" />
                    )}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Occasion Sub-controls */}
            {category === 'holiday' && holidays.length > 0 && (
              <div className="space-y-1">
                <span className="block text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Select holiday
                </span>
                <CustomSelect
                  ariaLabel="Choose Ethiopian holiday"
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

            {category === 'other' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {OTHER_WISH_PRESETS.map((preset) => {
                    const active = otherPreset === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => handleOtherPresetChange(preset.key)}
                        className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                          active
                            ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#FF6A00]'
                            : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]/70'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                {otherPreset === 'custom' && (
                  <input
                    type="text"
                    value={customOccasionTitle}
                    onChange={(e) => handleCustomTitleChange(e.target.value)}
                    placeholder="Occasion name (e.g. Graduation, New Baby, Safe Trip)"
                    aria-label="Custom occasion name"
                    className="w-full min-h-[40px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                  />
                )}
              </div>
            )}

            {/* Language switcher + template actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label="Message language"
                className="inline-flex rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] p-1 border border-[#DDE4EA] dark:border-[var(--dark-border)]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={lang === 'english'}
                  onClick={() => handleLangChange('english')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    lang === 'english'
                      ? 'bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white shadow-sm'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={lang === 'amharic'}
                  onClick={() => handleLangChange('amharic')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    lang === 'amharic'
                      ? 'bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white shadow-sm'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                  }`}
                >
                  አማርኛ
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
                  title="Restore default message template"
                >
                  <RotateCcw size={13} />
                  Default
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!message.trim()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] disabled:opacity-50"
                >
                  {savedTemplateFeedback ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      Saved
                    </>
                  ) : (
                    <>
                      <BookmarkCheck size={13} className="text-[#FF6A00]" />
                      Save template
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Message Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                <span className="inline-flex items-center gap-1 font-medium">
                  <FlaticonIcon name="fi-rr-envelope-heart" className="text-[12px] text-[#FF6A00]" />
                  {hasSavedCustomTemplate ? 'Using your saved template' : 'Default text · edit freely'}
                </span>
                <span className="font-mono tabular-nums">
                  {smsStats.charCount} chars · {smsStats.smsSegments} SMS ({smsStats.encoding})
                </span>
              </div>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setMessage(nextVal);
                  setIsDirty(nextVal !== baselineMessage);
                }}
                placeholder="Write or edit your wish message..."
                className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-3 text-sm text-[#08246B] dark:text-white leading-relaxed resize-y focus:outline-none focus:border-[#FF6A00]"
              />
              {smsStats.isMultiSmsUnicode && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>
                    Unicode / Amharic SMS splits at 67 chars per part. Sending as SMS will use{' '}
                    <strong>{smsStats.smsSegments} SMS segments</strong> ({smsStats.remainingInSegment}{' '}
                    chars left in current segment).
                  </span>
                </div>
              )}
              {copiedBanner && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <Check size={14} className="shrink-0" />
                  <span>{copiedBanner}</span>
                </div>
              )}
            </div>

            {/* Channel Buttons */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Choose how to send (+5 pts once per occasion/year)
                </p>
                {(telegramUsername || instagramUsername) && (
                  <p className="text-[10px] font-mono text-[#8A93A0] dark:text-[var(--dark-text-muted)] truncate">
                    {[
                      telegramUsername ? `TG @${telegramUsername}` : '',
                      instagramUsername ? `IG @${instagramUsername}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  onClick={handleSmsSend}
                  disabled={!message.trim()}
                  title="Send via SMS"
                  aria-label="Send via SMS"
                  className="flex-1 sm:flex-none sm:w-[70px] min-w-0 min-h-[44px] px-1 py-1.5 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-white text-[9.5px] sm:text-[10px] font-semibold flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                >
                  <MessageSquare size={15} className="shrink-0" />
                  <span className="truncate max-w-full leading-none">SMS</span>
                </button>

                {installedApps.whatsapp && waDigits && (
                  <button
                    type="button"
                    onClick={handleWhatsAppSend}
                    disabled={!message.trim()}
                    title="Send via WhatsApp"
                    aria-label="Send via WhatsApp"
                    className="flex-1 sm:flex-none sm:w-[70px] min-w-0 min-h-[44px] px-1 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 hover:bg-emerald-500/20 text-[9.5px] sm:text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <MessageCircle size={15} className="shrink-0" />
                    <span className="truncate max-w-full leading-none">WhatsApp</span>
                  </button>
                )}

                {installedApps.telegram && (
                  <button
                    type="button"
                    onClick={() => void handleTelegramSend()}
                    disabled={!message.trim()}
                    title={telegramUsername ? `Telegram (@${telegramUsername})` : 'Send via Telegram'}
                    aria-label={telegramUsername ? `Telegram (@${telegramUsername})` : 'Send via Telegram'}
                    className="flex-1 sm:flex-none sm:w-[70px] min-w-0 min-h-[44px] px-1 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-[9.5px] sm:text-[10px] font-semibold text-sky-700 dark:text-sky-300 flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <Send size={15} className="shrink-0" />
                    <span className="truncate max-w-full leading-none">Telegram</span>
                  </button>
                )}

                {installedApps.instagram && (
                  <button
                    type="button"
                    onClick={() => void handleInstagramSend()}
                    disabled={!message.trim()}
                    title={instagramUsername ? `Instagram (@${instagramUsername})` : 'Send via Instagram'}
                    aria-label={instagramUsername ? `Instagram (@${instagramUsername})` : 'Send via Instagram'}
                    className="flex-1 sm:flex-none sm:w-[70px] min-w-0 min-h-[44px] px-1 py-1.5 rounded-lg border border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 text-[9.5px] sm:text-[10px] font-semibold text-pink-700 dark:text-pink-300 flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <Instagram size={15} className="shrink-0" />
                    <span className="truncate max-w-full leading-none">Instagram</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void handleCopyOnly()}
                  disabled={!message.trim()}
                  title="Copy wish text"
                  aria-label="Copy wish text"
                  className="flex-1 sm:flex-none sm:w-[70px] min-w-0 min-h-[44px] px-1 py-1.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] text-[9.5px] sm:text-[10px] font-semibold text-[#08246B] dark:text-white flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                >
                  <Copy size={15} className="shrink-0" />
                  <span className="truncate max-w-full leading-none">Copy</span>
                </button>
              </div>
            </div>

            {/* Inline unsaved-changes confirmation when closing via backdrop/X */}
            {confirmDiscardOpen && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                  Discard your edited wish message?
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmDiscardOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white"
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={closeWishComposer}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
