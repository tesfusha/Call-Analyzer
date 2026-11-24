import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Award,
  Cake,
  CalendarHeart,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Flame,
  Lock,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  Share2,
  Star,
  Tag,
  Trash2,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import { CustomSelect } from '@/src/components/CustomSelect';
import { DateTimePicker } from '@/src/components/DateTimePicker';
import { SpecialEventsEditor } from '@/src/components/SpecialEventsEditor';
import {
  daysUntilAnnualDate,
  getContactKey,
  mergeTagOptions,
} from '@/src/lib/contacts';
import { detectCarrier, estimateCallCostEtb, formatEtb, formatSimDisplay } from '@/src/lib/ethiopia';
import {
  buildBirthdayWish,
  buildHolidayWish,
  formatEthiopianShort,
  getEthiopianMonthName,
  getHolidaysInGregorianYearOrUpcoming,
} from '@/src/lib/ethiopianCalendar';
import { downloadTextFile, shareContactVcard } from '@/src/lib/export';
import { avatarColor, formatDateTime, formatDuration, initials } from '@/src/lib/format';
import { buildEmptyContactStatus } from '@/src/lib/gamification';
import {
  buildScheduledCallIcs,
  formatScheduledCountdown,
  formatScheduledLabel,
  toDateTimeLocalValue,
  tomorrowAtHour,
} from '@/src/lib/schedule';
import { formatDisplayNameOrPhone, sanitizeSocialUsername } from '@/src/lib/security';
import { getEatWeekKey } from '@/src/lib/reminders';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type {
  CalendarKind,
  CallDirection,
  CallRecord,
  ContactBadgeItem,
  ContactBirthday,
  ContactEvent,
  ContactMilestoneRecord,
  ContactProfile,
} from '@/src/types/call';

const GREGORIAN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function DirectionIcon({ direction }: { direction: CallDirection }) {
  if (direction === 'incoming') return <PhoneIncoming size={13} className="text-[#4FA3F7] shrink-0" />;
  if (direction === 'outgoing') return <PhoneOutgoing size={13} className="text-[#FF6A00] shrink-0" />;
  if (direction === 'missed') return <PhoneMissed size={13} className="text-[#EF4444] shrink-0" />;
  return <PhoneMissed size={13} className="text-[#8A93A0] shrink-0" />;
}

function formatCallDirectionLabel(direction: CallDirection): string {
  switch (direction) {
    case 'incoming':
      return 'Incoming';
    case 'outgoing':
      return 'Outgoing';
    case 'rejected':
      return 'Rejected';
    case 'blocked':
      return 'Blocked';
    case 'voicemail':
      return 'Voicemail';
    default:
      return 'Missed';
  }
}

export function ContactDetailModal({
  contactNumber,
  onClose,
  onSelectCall,
  onCallBack,
  onShareMilestone,
}: {
  contactNumber: string | null;
  onClose: () => void;
  onSelectCall: (call: CallRecord) => void;
  onCallBack: (number: string) => void;
  onShareMilestone?: (milestone: ContactMilestoneRecord) => void;
}) {
  const {
    calls,
    contacts,
    scheduledCalls,
    favorites,
    tariffs,
    simLabels,
    calendarPrefs,
    availableTags,
    addCustomTag,
    toggleFavorite,
    upsertContactProfile,
    removeContactProfile,
    scheduleCall,
    completeScheduledCall,
    snoozeScheduledCall,
    contactStatuses,
    contactMilestones,
    sentWishes,
    openWishComposer,
    showNotice,
  } = useCalls();

  const contactKey = contactNumber ? getContactKey(contactNumber) : '';
  const profile = contactKey ? contacts[contactKey] : undefined;

  useLockBodyScroll(Boolean(contactNumber));
  const prefersReducedMotion = useReducedMotion();
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  const contactScheduled = useMemo(() => {
    if (!contactNumber) return [];
    return scheduledCalls
      .filter((s) => s.status === 'pending' && getContactKey(s.number) === contactKey)
      .sort((a, b) => a.scheduledFor - b.scheduledFor);
  }, [scheduledCalls, contactNumber, contactKey]);

  const contactCalls = useMemo(() => {
    if (!contactNumber) return [];
    return calls
      .filter((c) => getContactKey(c.number) === contactKey)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [calls, contactNumber, contactKey]);

  const stats = useMemo(() => {
    let totalDuration = 0;
    let incoming = 0;
    let outgoing = 0;
    let missed = 0;
    let spendEtb = 0;
    const sims = new Set<string>();
    contactCalls.forEach((c) => {
      totalDuration += c.duration;
      if (c.direction === 'incoming') incoming += 1;
      else if (c.direction === 'outgoing') outgoing += 1;
      else if (c.direction === 'missed') missed += 1;
      spendEtb += estimateCallCostEtb(c, tariffs);
      if (c.sim) sims.add(c.sim);
    });
    const answered = incoming + outgoing;
    return {
      totalCalls: contactCalls.length,
      totalDuration,
      avgDuration: answered > 0 ? Math.round(totalDuration / answered) : 0,
      incoming,
      outgoing,
      missed,
      spendEtb: Number(spendEtb.toFixed(2)),
      sims: [...sims],
    };
  }, [contactCalls, tariffs]);

  const initialName = useMemo(() => {
    if (profile?.name?.trim()) return profile.name.trim();
    const namedCall = contactCalls.find((c) => c.name?.trim());
    return namedCall?.name?.trim() || contactNumber || '';
  }, [profile, contactCalls, contactNumber]);

  const initialTag = useMemo(() => {
    if (profile?.tag?.trim()) return profile.tag.trim();
    const taggedCall = contactCalls.find((c) => c.tag?.trim());
    return taggedCall?.tag?.trim() || '';
  }, [profile, contactCalls]);

  const [activeCategory, setActiveCategory] = useState<'overview' | 'profile' | 'history'>('overview');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [notes, setNotes] = useState('');
  const [hasBirthday, setHasBirthday] = useState(false);
  const [bdayCalendar, setBdayCalendar] = useState<CalendarKind>('gregorian');
  const [bdayMonth, setBdayMonth] = useState(1);
  const [bdayDay, setBdayDay] = useState(1);
  const [bdayYear, setBdayYear] = useState('');
  const [events, setEvents] = useState<ContactEvent[]>([]);
  const [newEvtTitle, setNewEvtTitle] = useState('');
  const [newEvtCalendar, setNewEvtCalendar] = useState<CalendarKind>('ethiopian');
  const [newEvtMonth, setNewEvtMonth] = useState(1);
  const [newEvtDay, setNewEvtDay] = useState(1);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(() =>
    toDateTimeLocalValue(Date.now() + 60 * 60_000),
  );
  const [scheduleNote, setScheduleNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusCardOpen, setStatusCardOpen] = useState(false);
  const [profileSectionsOpen, setProfileSectionsOpen] = useState({
    profile: true,
    birthday: false,
    events: false,
    social: false,
  });

  useEffect(() => {
    if (!contactNumber) return;
    setStatusCardOpen(false);
    setProfileSectionsOpen({
      profile: true,
      birthday: false,
      events: false,
      social: false,
    });
  }, [contactNumber]);

  useEffect(() => {
    if (!contactNumber) return;
    setActiveCategory('overview');
    setName(initialName);
    setTag(initialTag);
    setNotes(profile?.notes ?? '');
    if (profile?.birthday) {
      setHasBirthday(true);
      setBdayCalendar(profile.birthday.calendar);
      setBdayMonth(profile.birthday.month);
      setBdayDay(profile.birthday.day);
      setBdayYear(profile.birthday.year ? String(profile.birthday.year) : '');
    } else {
      setHasBirthday(false);
      setBdayCalendar('gregorian');
      setBdayMonth(1);
      setBdayDay(1);
      setBdayYear('');
    }
    setEvents(profile?.events ?? []);
    setNewEvtTitle('');
    setTelegramUsername(profile?.telegramUsername ?? '');
    setInstagramUsername(profile?.instagramUsername ?? '');
    setScheduleOpen(false);
    setScheduleAt(toDateTimeLocalValue(Date.now() + 60 * 60_000));
    setScheduleNote('');
    setConfirmDelete(false);
  }, [contactNumber, initialName, initialTag, profile]);

  useEffect(() => {
    if (!contactNumber) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contactNumber, onClose]);

  useBackHandler({
    id: 'contact-detail-modal',
    active: Boolean(contactNumber),
    priority: 50,
    onBack: onClose,
    hasUnsavedChanges: () =>
      Boolean(
        contactNumber &&
          (name !== initialName ||
            tag !== initialTag ||
            notes !== (profile?.notes ?? '') ||
            hasBirthday !== Boolean(profile?.birthday) ||
            (hasBirthday &&
              (bdayCalendar !== (profile?.birthday?.calendar ?? 'gregorian') ||
                bdayMonth !== (profile?.birthday?.month ?? 1) ||
                bdayDay !== (profile?.birthday?.day ?? 1) ||
                bdayYear !== (profile?.birthday?.year ? String(profile.birthday.year) : ''))) ||
            JSON.stringify(events) !== JSON.stringify(profile?.events ?? []) ||
            telegramUsername !== (profile?.telegramUsername ?? '') ||
            instagramUsername !== (profile?.instagramUsername ?? '') ||
            Boolean(newEvtTitle.trim()) ||
            Boolean(scheduleNote.trim())),
      ),
    unsavedMessage: 'Discard unsaved contact profile edits?',
  });

  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = 0;
    }
  }, [activeCategory, contactNumber]);

  const todaysHoliday = useMemo(
    () =>
      getHolidaysInGregorianYearOrUpcoming(
        new Date(),
        0,
        calendarPrefs.defaultLang,
      ).find((h) => h.isToday) ?? null,
    [calendarPrefs.defaultLang],
  );

  const safeNumber = contactNumber ?? '';
  const displayName = formatDisplayNameOrPhone(name, safeNumber);
  const isFav =
    Boolean(contactNumber) &&
    (favorites.has(safeNumber) || favorites.has(contactKey));

  const bdayCountdown = hasBirthday
    ? daysUntilAnnualDate(bdayMonth, bdayDay, bdayCalendar)
    : null;
  const isContactBirthdayToday = hasBirthday && bdayCountdown === 0;
  const canShowWishToday = isContactBirthdayToday || todaysHoliday !== null;

  const contactStatus = useMemo(() => {
    if (!contactKey) {
      return buildEmptyContactStatus('', '', displayName, tag);
    }
    return (
      contactStatuses[contactKey] ??
      buildEmptyContactStatus(contactKey, safeNumber, displayName, tag)
    );
  }, [contactStatuses, contactKey, safeNumber, displayName, tag]);

  const handleSaveProfile = () => {
    if (!contactNumber) return;
    const cleanTag = tag.trim();
    if (cleanTag) {
      addCustomTag(cleanTag);
    }
    const birthday: ContactBirthday | null = hasBirthday
      ? {
          calendar: bdayCalendar,
          month: Math.max(1, Math.min(bdayCalendar === 'ethiopian' ? 13 : 12, bdayMonth)),
          day: Math.max(1, Math.min(bdayCalendar === 'ethiopian' ? 30 : 31, bdayDay)),
          year: bdayYear.trim() ? Number(bdayYear) || undefined : undefined,
        }
      : null;

    const pendingDraftEvent: ContactEvent[] = newEvtTitle.trim()
      ? [
          {
            id: `evt-${Date.now()}`,
            title: newEvtTitle.trim(),
            calendar: newEvtCalendar,
            month: Math.max(1, Math.min(newEvtCalendar === 'ethiopian' ? 13 : 12, newEvtMonth)),
            day: Math.max(1, Math.min(newEvtCalendar === 'ethiopian' ? 30 : 31, newEvtDay)),
          },
        ]
      : [];

    const cleanTg = sanitizeSocialUsername(telegramUsername);
    const cleanIg = sanitizeSocialUsername(instagramUsername);

    const nextProfile: ContactProfile = {
      key: contactKey,
      number: profile?.number || contactCalls[0]?.number || contactNumber,
      name: name.trim() || contactNumber,
      tag: cleanTag,
      birthday,
      events: [...events, ...pendingDraftEvent],
      notes: notes.trim(),
      telegramUsername: cleanTg || undefined,
      instagramUsername: cleanIg || undefined,
      updatedAt: Date.now(),
    };
    upsertContactProfile(nextProfile);
    showNotice(
      cleanTag
        ? `Saved ${nextProfile.name} (${cleanTag}).`
        : `Saved ${nextProfile.name}'s profile.`,
    );
    onClose();
  };

  const displayedTagChips = useMemo(
    () => mergeTagOptions(availableTags, tag.trim() ? [tag.trim()] : []),
    [availableTags, tag],
  );

  const handleAddEvent = () => {
    if (!newEvtTitle.trim()) return;
    const maxD = newEvtCalendar === 'ethiopian' ? (newEvtMonth === 13 ? 6 : 30) : 31;
    const item: ContactEvent = {
      id: `evt-${Date.now()}`,
      title: newEvtTitle.trim(),
      calendar: newEvtCalendar,
      month: Math.max(1, Math.min(newEvtCalendar === 'ethiopian' ? 13 : 12, newEvtMonth)),
      day: Math.max(1, Math.min(maxD, newEvtDay)),
    };
    setEvents((prev) => [...prev, item]);
    setNewEvtTitle('');
  };

  const suggestedWish = isContactBirthdayToday
    ? buildBirthdayWish(displayName, 'Birthday', tag)
    : todaysHoliday
      ? buildHolidayWish(todaysHoliday.name, displayName, tag)
      : '';

  const handleCopyWish = async () => {
    if (!suggestedWish) return;
    try {
      await navigator.clipboard.writeText(suggestedWish);
      showNotice('Wish message copied.');
    } catch {
      showNotice('Clipboard unavailable in this browser.');
    }
  };

  const handleShareContact = async () => {
    if (!contactNumber) return;
    const mode = await shareContactVcard({
      name: displayName,
      number: contactCalls[0]?.number || contactNumber,
      tag: tag.trim() || null,
      note: notes.trim() || null,
    });
    if (mode === 'copied') {
      showNotice('Contact copied to clipboard.', 'success');
    } else if (mode === 'native') {
      showNotice('Contact card saved & ready to share.', 'success');
    } else {
      showNotice(`Shared ${displayName}.`, 'success');
    }
  };

  const maxBdayMonth = bdayCalendar === 'ethiopian' ? 13 : 12;

  const categories: Array<CategoryItem<'overview' | 'profile' | 'history'>> = [
    { key: 'overview', label: 'Overview', icon: User },
    { key: 'profile', label: 'Profile & Events', icon: Cake },
    { key: 'history', label: 'Call History', icon: Phone, count: contactCalls.length },
  ];

  const activeHeading =
    activeCategory === 'overview'
      ? 'Contact Overview & Actions'
      : activeCategory === 'profile'
        ? 'Profile, Birthday & Special Events'
        : 'Call History with Contact';

  const modalContent = (
    <AnimatePresence>
      {contactNumber && (
        <motion.div
          key="contact-detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
          onClick={onClose}
        >
          <motion.div
            key="contact-detail-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col h-[85dvh] sm:h-[650px] max-h-[90dvh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Contact details for ${formatDisplayNameOrPhone(displayName, contactNumber)}`}
          >
            {/* Pinned Header + Tabs */}
            <div className="shrink-0 p-5 pb-3.5 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
                    style={{ backgroundColor: avatarColor(contactNumber) }}
                  >
                    {initials(displayName, contactNumber)}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <h2 className="text-lg font-bold text-[#08246B] dark:text-white truncate">
                        {formatDisplayNameOrPhone(displayName, contactNumber)}
                      </h2>
                      {tag.trim() && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF6A00] shrink-0">
                          <Tag size={12} className="shrink-0" />
                          <span>{tag.trim()}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] font-mono tabular-nums truncate">
                      {contactCalls[0]?.number || contactNumber} ·{' '}
                      {detectCarrier(contactNumber)}
                      {stats.sims.length > 0
                        ? ` · ${stats.sims.map((s) => (s === 'SIM 1' || s === 'SIM 2' ? formatSimDisplay(s, simLabels) : s)).join(', ')}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(contactNumber)}
                    aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
                  >
                    <Star
                      size={18}
                      className={isFav ? 'text-[#FF6A00] fill-[#FF6A00]' : 'text-[#8A93A0] dark:text-[var(--dark-text-secondary)]'}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close contact details"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <CategoryTabs
                items={categories}
                activeKey={activeCategory}
                onChange={setActiveCategory}
                ariaLabel="Contact profile categories"
                variant="inset"
              />
            </div>

            {/* Dedicated Scrollable Body */}
            <div ref={bodyScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-5">
              <CategoryPanel activeKey={activeCategory} label={activeHeading} transitionStyle="fade">
                <div className="pb-2 border-b border-[#DDE4EA]/70 dark:border-[var(--dark-border)]">
                  <h3 className="text-sm font-bold text-[#08246B] dark:text-white">
                    {activeHeading}
                  </h3>
                </div>
                {activeCategory === 'overview' && (
          <div className="space-y-4">
        {/* Action Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCallBack(contactCalls[0]?.number || contactNumber)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Phone size={14} />
            Call
          </button>
          <button
            type="button"
            onClick={() => setScheduleOpen((prev) => !prev)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Clock size={14} className="text-[#FF6A00]" />
            Schedule call
          </button>
          <button
            type="button"
            onClick={() => void handleShareContact()}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Share2 size={14} className="text-[#FF6A00]" />
            Share
          </button>
          {(() => {
            const currentYear = new Date().getFullYear();
            const occType = isContactBirthdayToday
              ? 'birthday'
              : todaysHoliday
                ? 'holiday'
                : 'reconnect';
            const occKey = isContactBirthdayToday
              ? `bday-${contactKey}`
              : todaysHoliday
                ? todaysHoliday.key
                : `reconnect:${getEatWeekKey()}`;
            const occName = isContactBirthdayToday
              ? 'Birthday'
              : todaysHoliday
                ? todaysHoliday.name
                : 'Check-in';
            const wishOpened = sentWishes.some(
              (w) =>
                w.contactKey === contactKey &&
                w.occasionKey === occKey &&
                w.year === currentYear,
            );
            return (
              <>
                <button
                  type="button"
                  onClick={() =>
                    openWishComposer({
                      contactNumber: contactCalls[0]?.number || contactNumber,
                      contactName: displayName,
                      contactKey,
                      tag: tag.trim() || undefined,
                      occasionType: occType,
                      occasionKey: occKey,
                      occasionName: occName,
                      telegramUsername: sanitizeSocialUsername(telegramUsername) || undefined,
                      instagramUsername: sanitizeSocialUsername(instagramUsername) || undefined,
                    })
                  }
                  className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    canShowWishToday
                      ? 'border-[#FF6A00]/40 bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#08246B] dark:text-white hover:border-[#FF6A00]'
                      : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]'
                  }`}
                >
                  <MessageSquare size={14} className="text-[#FF6A00]" />
                  <span>
                    {isContactBirthdayToday
                      ? 'Send Birthday Wish'
                      : todaysHoliday
                        ? `Send ${todaysHoliday.name} Wish`
                        : 'Send Wish / Message'}
                  </span>
                  {wishOpened && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Opened · {currentYear}
                    </span>
                  )}
                </button>
                {canShowWishToday && (
                  <button
                    type="button"
                    onClick={() => void handleCopyWish()}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Copy size={14} />
                    Copy Wish
                  </button>
                )}
              </>
            );
          })()}
        </div>

        {scheduleOpen && (
          <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#08246B] dark:text-white">
                Schedule a call with {displayName}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: 'In 15m', ts: () => Date.now() + 15 * 60_000 },
                  { label: 'In 1h', ts: () => Date.now() + 60 * 60_000 },
                  { label: 'Tomorrow 9 AM', ts: () => tomorrowAtHour(9) },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      scheduleCall({
                        number: contactCalls[0]?.number || contactNumber,
                        name: displayName,
                        scheduledFor: preset.ts(),
                        note: scheduleNote || null,
                      });
                      setScheduleOpen(false);
                    }}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DateTimePicker
                value={scheduleAt}
                onChange={setScheduleAt}
                variant="surface"
                ariaLabel="Scheduled call date and time"
              />
              <input
                type="text"
                value={scheduleNote}
                onChange={(e) => setScheduleNote(e.target.value)}
                placeholder="Topic / reason (optional)"
                className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const parsed = Date.parse(scheduleAt);
                  if (Number.isNaN(parsed)) return;
                  scheduleCall({
                    number: contactCalls[0]?.number || contactNumber,
                    name: displayName,
                    scheduledFor: parsed,
                    note: scheduleNote || null,
                  });
                  setScheduleOpen(false);
                }}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold whitespace-nowrap"
              >
                Save scheduled call
              </button>
            </div>
          </div>
        )}

        {contactScheduled.length > 0 && (
          <div className="rounded-2xl bg-[#FFF0E6]/70 dark:bg-[#FF6A00]/10 border border-[#FF6A00]/30 p-3.5 space-y-2">
            <p className="text-xs font-semibold text-[#FF6A00]">
              Scheduled calls ({contactScheduled.length})
            </p>
            <div className="divide-y divide-[#FF6A00]/20">
              {contactScheduled.map((item) => (
                <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#08246B] dark:text-white tabular-nums">
                      {formatScheduledCountdown(item.scheduledFor)} · {formatScheduledLabel(item)}
                    </p>
                    {item.note && (
                      <p className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">{item.note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => snoozeScheduledCall(item.id, 15)}
                      className="min-h-[32px] px-2 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[11px] font-semibold text-[#08246B] dark:text-white"
                    >
                      +15m
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const delivery = await downloadTextFile(
                          `call-${item.id}.ics`,
                          buildScheduledCallIcs(item),
                          'text/calendar;charset=utf-8',
                          `Call Reminder (${displayName})`,
                        );
                        showNotice(
                          delivery === 'native'
                            ? 'Calendar file saved to Downloads & ready to open.'
                            : 'Saved .ics calendar file.',
                        );
                      }}
                      aria-label="Download calendar invite"
                      className="min-h-[32px] px-2 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white flex items-center"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => completeScheduledCall(item.id)}
                      aria-label="Mark scheduled call done"
                      className="min-h-[32px] px-2 rounded-lg bg-[#FF6A00] text-white text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Check size={12} />
                      Done
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-0.5">
            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">Total calls</p>
            <p className="text-lg font-bold tabular-nums text-[#08246B] dark:text-white">
              {stats.totalCalls}
            </p>
            <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] tabular-nums">
              {stats.incoming} in · {stats.outgoing} out · {stats.missed} missed
            </p>
          </div>
          <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-0.5">
            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">Talk time</p>
            <p className="text-lg font-bold tabular-nums text-[#08246B] dark:text-white">
              {formatDuration(stats.totalDuration)}
            </p>
            <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] tabular-nums">
              Avg {formatDuration(stats.avgDuration)}
            </p>
          </div>
          <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-0.5">
            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">Est. spend</p>
            <p className="text-lg font-bold tabular-nums text-[#FF6A00]">
              {formatEtb(stats.spendEtb)}
            </p>
            <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">Outgoing airtime</p>
          </div>
          <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-0.5">
            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">Last call</p>
            <p className="text-sm font-bold tabular-nums text-[#08246B] dark:text-white truncate">
              {contactCalls[0] ? formatDateTime(contactCalls[0].timestamp) : 'No calls'}
            </p>
            {contactCalls[0] && (
              <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] truncate">
                {formatEthiopianShort(contactCalls[0].timestamp)} EC
              </p>
            )}
          </div>
        </div>

        {/* Status with Contact: Streak, Score & Badges (Collapsible) */}
        <div className="rounded-2xl bg-[#EEF2F6]/80 dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
          <button
            type="button"
            aria-expanded={statusCardOpen}
            onClick={() => setStatusCardOpen((prev) => !prev)}
            className="w-full p-4 flex items-center justify-between gap-2.5 text-left hover:bg-[#DDE4EA]/40 dark:hover:bg-[var(--dark-elevated)]/40 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  contactStatus.currentStreak >= 3
                    ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/20 text-[#FF6A00]'
                    : 'bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-[#FF6A00] border border-[#DDE4EA] dark:border-[var(--dark-border)]'
                }`}
              >
                <Flame size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                  Status with {displayName}: {contactStatus.statusHeadline}
                </p>
                <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                  {statusCardOpen
                    ? contactStatus.statusSubtext
                    : `${contactStatus.currentStreak}d streak · Best ${contactStatus.longestStreak}d · ${contactStatus.totalConnectedDays}d connected`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-right">
                <p className="text-sm font-mono font-bold tabular-nums text-[#FF6A00] flex items-center justify-end gap-1">
                  <Trophy size={13} />
                  <span>{contactStatus.contactScore} pts</span>
                </p>
                <p className="text-[10px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  {contactStatus.earnedBadgesCount}/{contactStatus.badges.length} badges
                </p>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0 transition-transform duration-200 ${
                  statusCardOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {statusCardOpen && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-3 border-t border-[#DDE4EA]/80 dark:border-[var(--dark-border)] space-y-3.5">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="py-1.5">
                      <p className="text-sm font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                        {contactStatus.currentStreak}d
                      </p>
                      <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Current Streak
                      </p>
                    </div>
                    <div className="py-1.5 border-x border-[#DDE4EA]/80 dark:border-[var(--dark-border)]">
                      <p className="text-sm font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                        {contactStatus.longestStreak}d
                      </p>
                      <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Best Streak
                      </p>
                    </div>
                    <div className="py-1.5">
                      <p className="text-sm font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                        {contactStatus.totalConnectedDays}d
                      </p>
                      <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Connected Days
                      </p>
                    </div>
                  </div>

                  {contactStatus.nextMilestoneDays !== null && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                        <span>
                          Next goal: {contactStatus.nextMilestoneDays}-Day Badge
                        </span>
                        <span className="font-mono font-semibold text-[#08246B] dark:text-white">
                          {Math.min(contactStatus.currentStreak, contactStatus.nextMilestoneDays)}/{contactStatus.nextMilestoneDays}d
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white dark:bg-[var(--dark-surface)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#FF6A00] transition-all duration-200"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (contactStatus.currentStreak / contactStatus.nextMilestoneDays) * 100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-[#08246B] dark:text-white flex items-center gap-1.5">
                        <Award size={13} className="text-[#FF6A00]" />
                        Contact Badges ({contactStatus.earnedBadgesCount}/{contactStatus.badges.length})
                      </p>
                      {onShareMilestone && contactStatus.earnedBadgesCount > 0 && (() => {
                        const highestBadge = [...contactStatus.badges].reverse().find((b) => b.earned);
                        if (!highestBadge) return null;
                        const openBadgeShare = (badge: ContactBadgeItem) => {
                          const existing = contactMilestones.find(
                            (m) => m.contactKey === contactStatus.contactKey && m.days === badge.days,
                          );
                          const reachedDate =
                            existing?.reachedDate ?? badge.unlockedEatDate ?? contactStatus.lastConnectedDate ?? '';
                          onShareMilestone(
                            existing ?? {
                              id: `${contactStatus.contactKey}:${badge.days}:${reachedDate}`,
                              contactKey: contactStatus.contactKey,
                              days: badge.days,
                              streakStartDate: reachedDate,
                              reachedDate,
                              badgeId: badge.id,
                              badgeTitle: badge.title,
                              points: badge.points,
                              awardedAt: Date.now(),
                              celebratedAt: Date.now(),
                            },
                          );
                        };
                        return (
                          <button
                            type="button"
                            onClick={() => openBadgeShare(highestBadge)}
                            className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-[11px] font-semibold text-white flex items-center gap-1 whitespace-nowrap transition-colors"
                          >
                            <Share2 size={11} />
                            <span>Share Milestone</span>
                          </button>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {contactStatus.badges.map((badge) => {
                        const handleBadgeClick = () => {
                          if (!badge.earned || !onShareMilestone) return;
                          const existing = contactMilestones.find(
                            (m) => m.contactKey === contactStatus.contactKey && m.days === badge.days,
                          );
                          const reachedDate =
                            existing?.reachedDate ?? badge.unlockedEatDate ?? contactStatus.lastConnectedDate ?? '';
                          onShareMilestone(
                            existing ?? {
                              id: `${contactStatus.contactKey}:${badge.days}:${reachedDate}`,
                              contactKey: contactStatus.contactKey,
                              days: badge.days,
                              streakStartDate: reachedDate,
                              reachedDate,
                              badgeId: badge.id,
                              badgeTitle: badge.title,
                              points: badge.points,
                              awardedAt: Date.now(),
                              celebratedAt: Date.now(),
                            },
                          );
                        };
                        const isInteractive = badge.earned && Boolean(onShareMilestone);
                        return (
                          <button
                            key={badge.id}
                            type="button"
                            disabled={!isInteractive}
                            onClick={handleBadgeClick}
                            className={`text-left rounded-xl border px-2.5 py-2 space-y-0.5 transition-colors ${
                              badge.earned
                                ? 'bg-white dark:bg-[var(--dark-surface)] border-[#FF6A00]/45 hover:border-[#FF6A00]'
                                : 'bg-white/50 dark:bg-[var(--dark-surface)]/50 border-[#DDE4EA] dark:border-[var(--dark-border)] opacity-70 cursor-default'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                                {badge.days}d
                              </span>
                              {badge.earned ? (
                                <Check size={12} className="text-[#10B981] shrink-0" />
                              ) : (
                                <Lock size={11} className="text-[#8A93A0] shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] font-semibold text-[#08246B] dark:text-white truncate">
                              {badge.title}
                            </p>
                            <p className="text-[10px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                              {badge.earned
                                ? `+${badge.points} pts${badge.unlockedEatDate ? ` · ${badge.unlockedEatDate}` : ''}`
                                : `+${badge.points} pts goal`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[10px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] tabular-nums">
                    Score breakdown: {contactStatus.totalConnectedDays} connected day{contactStatus.totalConnectedDays === 1 ? '' : 's'} · {contactStatus.quickCallbacksCount} quick callback{contactStatus.quickCallbacksCount === 1 ? '' : 's'} · {contactStatus.taggedOrNotedCallsCount} tagged/noted call{contactStatus.taggedOrNotedCallsCount === 1 ? '' : 's'} · EAT (UTC+3)
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
          </div>
        )}

        {/* Profile, Tags, Birthday & Events Editor (Collapsible Accordion Sections) */}
        {activeCategory === 'profile' && (() => {
          const allProfileOpen =
            profileSectionsOpen.profile &&
            profileSectionsOpen.birthday &&
            profileSectionsOpen.events &&
            profileSectionsOpen.social;
          const toggleProfileSection = (key: keyof typeof profileSectionsOpen) =>
            setProfileSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
          const bdaySummary = hasBirthday
            ? `${bdayCalendar === 'ethiopian' ? getEthiopianMonthName(bdayMonth, 'english') : GREGORIAN_MONTHS[bdayMonth - 1]} ${bdayDay}${bdayCountdown !== null ? (bdayCountdown === 0 ? ' · Today!' : ` · In ${bdayCountdown}d`) : ''}`
            : 'Not set';
          const socialParts = [
            sanitizeSocialUsername(telegramUsername) ? `@${sanitizeSocialUsername(telegramUsername)}` : '',
            sanitizeSocialUsername(instagramUsername) ? `IG @${sanitizeSocialUsername(instagramUsername)}` : '',
            notes.trim() ? 'Notes added' : '',
          ].filter(Boolean);
          const socialSummary = socialParts.length > 0 ? socialParts.join(' · ') : 'Optional';

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Tap any section below to expand or collapse
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setProfileSectionsOpen({
                      profile: !allProfileOpen,
                      birthday: !allProfileOpen,
                      events: !allProfileOpen,
                      social: !allProfileOpen,
                    })
                  }
                  className="min-h-[28px] px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[11px] font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] transition-colors shrink-0"
                >
                  {allProfileOpen ? 'Collapse all' : 'Expand all'}
                </button>
              </div>

              {/* Section 1: Profile & Relationship Tag */}
              <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
                <button
                  type="button"
                  aria-expanded={profileSectionsOpen.profile}
                  onClick={() => toggleProfileSection('profile')}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2.5 text-left hover:bg-[#DDE4EA]/45 dark:hover:bg-[var(--dark-elevated)]/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <User size={15} className="text-[#FF6A00] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                        Profile &amp; Relationship Tag
                      </p>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                        {displayName}
                        {tag.trim() ? ` · ${tag.trim()}` : ' · No tag'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0 transition-transform duration-200 ${
                      profileSectionsOpen.profile ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {profileSectionsOpen.profile && (
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            Display name
                          </span>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contact name"
                            className="w-full rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-sm text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                          />
                        </label>

                        <div className="space-y-2 sm:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              Relationship / role tag
                            </span>
                            {tag.trim() ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF6A00]">
                                <Tag size={12} className="shrink-0" />
                                <span>Selected: {tag.trim()}</span>
                                <button
                                  type="button"
                                  onClick={() => setTag('')}
                                  aria-label="Clear selected tag"
                                  className="ml-0.5 p-0.5 rounded hover:bg-[#FF6A00]/15"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                                No tag selected
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {displayedTagChips.map((preset) => {
                              const selected = tag.trim().toLowerCase() === preset.toLowerCase();
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setTag(selected ? '' : preset)}
                                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                                    selected
                                      ? 'bg-[#FF6A00] text-white'
                                      : 'bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]'
                                  }`}
                                >
                                  <Tag size={11} className="shrink-0" />
                                  <span>{preset}</span>
                                  {selected && <Check size={12} className="shrink-0" />}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tag}
                              onChange={(e) => setTag(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && tag.trim()) {
                                  e.preventDefault();
                                  const saved = addCustomTag(tag);
                                  if (saved) setTag(saved);
                                }
                              }}
                              placeholder="Type custom tag (e.g. Graphics Designer)..."
                              className="flex-1 min-w-0 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                            />
                            <button
                              type="button"
                              disabled={!tag.trim()}
                              onClick={() => {
                                const saved = addCustomTag(tag);
                                if (saved) {
                                  setTag(saved);
                                  showNotice(`Tag "${saved}" added. Tap Save to apply.`);
                                }
                              }}
                              className="min-h-[38px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] disabled:opacity-45 text-xs font-semibold text-[#FF6A00] hover:border-[#FF6A00] flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <Plus size={13} />
                              Add tag
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Section 2: Birthday */}
              <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
                <button
                  type="button"
                  aria-expanded={profileSectionsOpen.birthday}
                  onClick={() => toggleProfileSection('birthday')}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2.5 text-left hover:bg-[#DDE4EA]/45 dark:hover:bg-[var(--dark-elevated)]/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Cake size={15} className="text-[#FF6A00] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                        Birthday
                      </p>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate tabular-nums">
                        {bdaySummary}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0 transition-transform duration-200 ${
                      profileSectionsOpen.birthday ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {profileSectionsOpen.birthday && (
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {bdayCountdown !== null ? (
                            <span className="text-xs font-medium text-[#FF6A00] tabular-nums">
                              {bdayCountdown === 0 ? 'Today!' : `In ${bdayCountdown} days`}
                            </span>
                          ) : (
                            <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              No birthday saved yet
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setHasBirthday((prev) => !prev)}
                            className="min-h-[34px] px-3 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white"
                          >
                            {hasBirthday ? 'Remove birthday' : 'Set birthday'}
                          </button>
                        </div>

                        {hasBirthday && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <CustomSelect
                              ariaLabel="Birthday calendar system"
                              value={bdayCalendar}
                              variant="surface"
                              fullWidth
                              compact
                              options={[
                                { value: 'gregorian', label: 'Gregorian' },
                                { value: 'ethiopian', label: 'Ethiopian' },
                              ]}
                              onChange={(val) => {
                                const nextCal = val as CalendarKind;
                                setBdayCalendar(nextCal);
                                if (nextCal === 'gregorian' && bdayMonth > 12) setBdayMonth(12);
                              }}
                            />
                            <CustomSelect
                              ariaLabel="Birthday month"
                              value={String(bdayMonth)}
                              variant="surface"
                              fullWidth
                              compact
                              options={Array.from({ length: maxBdayMonth }, (_, idx) => idx + 1).map((m) => ({
                                value: String(m),
                                label:
                                  bdayCalendar === 'ethiopian'
                                    ? getEthiopianMonthName(m, 'english')
                                    : GREGORIAN_MONTHS[m - 1],
                              }))}
                              onChange={(val) => setBdayMonth(Number(val))}
                            />
                            <input
                              type="number"
                              min={1}
                              max={bdayCalendar === 'ethiopian' ? 30 : 31}
                              value={bdayDay}
                              onChange={(e) => setBdayDay(Math.max(1, Number(e.target.value) || 1))}
                              aria-label="Birthday day"
                              placeholder="Day"
                              className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-2 text-xs font-mono tabular-nums text-[#08246B] dark:text-white"
                            />
                            <input
                              type="number"
                              value={bdayYear}
                              onChange={(e) => setBdayYear(e.target.value)}
                              aria-label="Birth year optional"
                              placeholder="Year (opt.)"
                              className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-2 text-xs font-mono tabular-nums text-[#08246B] dark:text-white"
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Section 3: Special Events & Anniversaries */}
              <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
                <button
                  type="button"
                  aria-expanded={profileSectionsOpen.events}
                  onClick={() => toggleProfileSection('events')}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2.5 text-left hover:bg-[#DDE4EA]/45 dark:hover:bg-[var(--dark-elevated)]/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CalendarHeart size={15} className="text-[#FF6A00] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                        Special Events &amp; Anniversaries
                      </p>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate tabular-nums">
                        {events.length === 0
                          ? 'No special events yet'
                          : `${events.length} event${events.length === 1 ? '' : 's'} saved`}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0 transition-transform duration-200 ${
                      profileSectionsOpen.events ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {profileSectionsOpen.events && (
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)]">
                        <SpecialEventsEditor
                          events={events}
                          onRemoveEvent={(id) => setEvents((prev) => prev.filter((item) => item.id !== id))}
                          newTitle={newEvtTitle}
                          onNewTitleChange={setNewEvtTitle}
                          newCalendar={newEvtCalendar}
                          onNewCalendarChange={setNewEvtCalendar}
                          newMonth={newEvtMonth}
                          onNewMonthChange={setNewEvtMonth}
                          newDay={newEvtDay}
                          onNewDayChange={setNewEvtDay}
                          onAddEvent={handleAddEvent}
                          variant="surface"
                          hideHeader
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Section 4: Social & Contact Notes */}
              <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
                <button
                  type="button"
                  aria-expanded={profileSectionsOpen.social}
                  onClick={() => toggleProfileSection('social')}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2.5 text-left hover:bg-[#DDE4EA]/45 dark:hover:bg-[var(--dark-elevated)]/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare size={15} className="text-[#FF6A00] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                        Social &amp; Contact Notes
                      </p>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                        {socialSummary}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0 transition-transform duration-200 ${
                      profileSectionsOpen.social ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {profileSectionsOpen.social && (
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block space-y-1">
                            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              Telegram username (optional)
                            </span>
                            <input
                              type="text"
                              value={telegramUsername}
                              onChange={(e) => setTelegramUsername(e.target.value)}
                              placeholder="@username"
                              className="w-full rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              Instagram username (optional)
                            </span>
                            <input
                              type="text"
                              value={instagramUsername}
                              onChange={(e) => setInstagramUsername(e.target.value)}
                              placeholder="@username"
                              className="w-full rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                            />
                          </label>
                        </div>

                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            Contact notes
                          </span>
                          <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Personal or work context..."
                            className="w-full rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white resize-none focus:outline-none focus:border-[#FF6A00]"
                          />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })()}

        {/* Contact's Call History */}
        {activeCategory === 'history' && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            All calls with {displayName} ({contactCalls.length})
          </h3>
          {contactCalls.length === 0 ? (
            <p className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)] py-3 border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
              No calls logged with this number yet.
            </p>
          ) : (
            <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] overflow-hidden">
              {contactCalls.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCall(c)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#08246B] dark:text-white tabular-nums">
                      <DirectionIcon direction={c.direction} />
                      <span>{formatCallDirectionLabel(c.direction)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTime(c.timestamp)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                        {formatEthiopianShort(c.timestamp)} EC
                      </span>
                    </div>
                    {(c.note || c.sim) && (
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                        {[
                          c.sim ? formatSimDisplay(c.sim, simLabels) : '',
                          c.note ? c.note : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono tabular-nums text-[#08246B] dark:text-white">
                      {c.duration > 0 ? formatDuration(c.duration) : '0s'}
                    </p>
                    {c.direction === 'outgoing' && c.duration > 0 && (
                      <p className="text-[11px] font-mono tabular-nums text-[#FF6A00]">
                        {formatEtb(estimateCallCostEtb(c, tariffs))}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        )}
        </CategoryPanel>
            </div>

            {activeCategory === 'profile' && (
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/90 dark:bg-[var(--dark-canvas)]/90">
                {profile ? (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          removeContactProfile(profile.key);
                          setConfirmDelete(false);
                          onClose();
                        }}
                        className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-xs font-semibold text-white whitespace-nowrap"
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="min-h-[42px] px-3 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#FCA5A5] dark:border-[#EF4444]/40 text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#FEE2E2]/40 dark:hover:bg-[#EF4444]/10 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Check size={14} />
                    Save
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
