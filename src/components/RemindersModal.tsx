import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  Bell,
  BellOff,
  Cake,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileDown,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import { ContactAvatar } from '@/src/components/ContactAvatar';
import { CustomSelect } from '@/src/components/CustomSelect';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { SimpleScheduleTimePicker } from '@/src/components/SimpleScheduleTimePicker';
import {
  DEFAULT_RELATIONSHIP_TAGS,
  getContactKey,
  getFrequentAndLongCallers,
  getUpcomingContactEvents,
} from '@/src/lib/contacts';
import { formatEtb } from '@/src/lib/ethiopia';
import {
  buildBirthdayWish,
  buildHolidayWish,
  getEthiopianMonthName,
  getHolidaysInGregorianYearOrUpcoming,
} from '@/src/lib/ethiopianCalendar';
import { downloadTextFile } from '@/src/lib/export';
import { formatDateTime, formatDuration } from '@/src/lib/format';
import { exportCallHistoryPdfReport } from '@/src/lib/pdfExport';
import {
  buildPeriodReport,
  findLongGapReturnCalls,
  formatReportClipboard,
  getEatWeekKey,
  quietContactsAnalysis,
  unreturnedMissedCalls,
  type QuietContact,
} from '@/src/lib/reminders';
import {
  buildScheduledCallIcs,
  formatScheduledCountdown,
  formatScheduledLabel,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
} from '@/src/lib/schedule';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';

type RemindersCategory = 'action' | 'wishes' | 'quiet' | 'reports';

const REMINDERS_META: Record<RemindersCategory, { title: string; description: string }> = {
  action: {
    title: 'Follow-ups & Scheduled Callbacks',
    description: 'Scheduled callback reminders and unreturned missed calls',
  },
  wishes: {
    title: 'Birthdays & Holiday Wishes',
    description: 'Upcoming birthdays, special events, and Ethiopian holiday greetings',
  },
  quiet: {
    title: 'Quiet Contacts',
    description: 'Frequent callers you have not spoken with recently',
  },
  reports: {
    title: 'Weekly & Monthly Reports',
    description: 'Talk-time, direction split, airtime spend, and PDF export',
  },
};

export function RemindersModal({
  open,
  onClose,
  onCallBack,
  onSelectContact,
  initialCategory = 'action',
}: {
  open: boolean;
  onClose: () => void;
  onCallBack: (number: string) => void;
  onSelectContact: (number: string) => void;
  initialCategory?: RemindersCategory;
}) {
  const {
    calls,
    contacts,
    favorites,
    scheduledCalls,
    tariffs,
    simLabels,
    calendarPrefs,
    reminderPrefs,
    alertTypePrefs,
    isAlertsSnoozedToday,
    snoozeAlertsForToday,
    resumeSnoozedAlertsToday,
    readAlertSet,
    markAllAlertsRead,
    dismissedMissedIds,
    mutedAlertKeys,
    mutedAlertSet,
    muteAlertKey,
    unmuteAlertKey,
    dismissMissedCall,
    dismissLongGapCall,
    scheduleCall,
    completeScheduledCall,
    snoozeScheduledCall,
    removeScheduledCall,
    notificationsEnabled,
    setNotificationsEnabled,
    notificationPermission,
    requestAlertPermissions,
    sendTestAlertNotification,
    sentWishes,
    snoozedQuietUntil,
    snoozeQuietContact,
    reconnectProgress,
    recordQuietReconnect,
    openWishComposer,
    showNotice,
  } = useCalls();

  useLockBodyScroll(open);
  const prefersReducedMotion = useReducedMotion();

  const [activeCategory, setActiveCategory] = useState<RemindersCategory>('action');
  const [recipientFilter, setRecipientFilter] = useState<string>('all');
  const [wishSearch, setWishSearch] = useState('');
  const [selectedHolidayId, setSelectedHolidayId] = useState('');
  const [newSchedOpen, setNewSchedOpen] = useState(false);
  const [schedContactQuery, setSchedContactQuery] = useState('');
  const [schedNumber, setSchedNumber] = useState('');
  const [schedName, setSchedName] = useState('');
  const [schedAt, setSchedAt] = useState(() =>
    toDateTimeLocalValue(Date.now() + 60 * 60_000),
  );
  const [schedNote, setSchedNote] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [quietFilter, setQuietFilter] = useState<'all' | 'family' | 'friends' | 'business'>('all');
  const [showAllQuiet, setShowAllQuiet] = useState(false);
  const [dormantOpen, setDormantOpen] = useState(false);
  const [openSnoozeKey, setOpenSnoozeKey] = useState<string | null>(null);
  const [mutedUndo, setMutedUndo] = useState<{ key: string; label: string } | null>(null);
  const [swipeState, setSwipeState] = useState<{ key: string; dx: number } | null>(null);
  const swipeStartRef = useRef<{ key: string; x: number; y: number } | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setActiveCategory(initialCategory);
      setOpenSnoozeKey(null);
      setShowAllQuiet(false);
      setDormantOpen(false);
      setMutedUndo(null);
      setSwipeState(null);
    }
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

  useBackHandler({
    id: 'reminders-modal',
    active: open,
    priority: 45,
    onBack: onClose,
  });

  useBackHandler({
    id: 'reminders-new-schedule-form',
    active: open && newSchedOpen,
    priority: 48,
    onBack: () => setNewSchedOpen(false),
    hasUnsavedChanges: () =>
      Boolean(schedNumber.trim() || schedName.trim() || schedNote.trim()),
    unsavedMessage: 'You have an unsaved scheduled call draft. Discard it and go back?',
  });

  const pendingScheduled = useMemo(
    () =>
      scheduledCalls
        .filter((s) => s.status === 'pending' && !mutedAlertSet.has(`sched:${s.id}`))
        .sort((a, b) => a.scheduledFor - b.scheduledFor),
    [scheduledCalls, mutedAlertSet],
  );

  const upcomingHolidays = useMemo(
    () =>
      getHolidaysInGregorianYearOrUpcoming(
        new Date(),
        Math.max(365, reminderPrefs.eventLeadDays),
        calendarPrefs.defaultLang,
      ).filter((h) => !mutedAlertSet.has(`holiday:${h.key}`)),
    [reminderPrefs.eventLeadDays, calendarPrefs.defaultLang, mutedAlertSet],
  );
  const upcomingEvents = useMemo(
    () =>
      getUpcomingContactEvents(
        contacts,
        calls,
        Math.max(14, reminderPrefs.eventLeadDays),
      ).filter((evt) => !mutedAlertSet.has(`bday:${evt.contactKey}`)),
    [contacts, calls, reminderPrefs.eventLeadDays, mutedAlertSet],
  );
  const frequentAndLong = useMemo(
    () => getFrequentAndLongCallers(calls, contacts),
    [calls, contacts],
  );
  const quietAnalysis = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const analysis = quietContactsAnalysis(calls, {
      now,
      contacts,
      favorites: Array.from(favorites),
      maxIntervalDays: reminderPrefs.quietContactDays,
    });
    const active = analysis.active.filter((q) => {
      const snoozedUntil = snoozedQuietUntil[q.contactKey] ?? 0;
      return !mutedAlertSet.has(`quiet:${q.contactKey}`) && snoozedUntil <= nowMs;
    });
    const dormant = analysis.dormant.filter(
      (q) => !mutedAlertSet.has(`quiet:${q.contactKey}`),
    );
    return { active, dormant };
  }, [calls, contacts, favorites, reminderPrefs.quietContactDays, mutedAlertSet, snoozedQuietUntil]);

  const quiet = quietAnalysis.active;

  const quietCategoryCounts = useMemo(() => {
    let family = 0;
    let friends = 0;
    let business = 0;
    quiet.forEach((q) => {
      const lower = q.tag.trim().toLowerCase();
      if (lower.includes('family')) family += 1;
      else if (lower.includes('friend')) friends += 1;
      else if (lower.includes('business') || lower.includes('work') || lower.includes('coworker')) {
        business += 1;
      }
    });
    return { all: quiet.length, family, friends, business };
  }, [quiet]);

  const filteredQuiet = useMemo(() => {
    if (quietFilter === 'all') return quiet;
    return quiet.filter((q) => {
      const lower = q.tag.trim().toLowerCase();
      if (quietFilter === 'family') return lower.includes('family');
      if (quietFilter === 'friends') return lower.includes('friend');
      return lower.includes('business') || lower.includes('work') || lower.includes('coworker');
    });
  }, [quiet, quietFilter]);

  const displayedQuiet = useMemo(
    () => (showAllQuiet ? filteredQuiet : filteredQuiet.slice(0, 5)),
    [filteredQuiet, showAllQuiet],
  );

  const currentYear = new Date().getFullYear();
  const weekKey = getEatWeekKey();
  const weeklyGoal = Math.max(1, Math.min(14, Math.round(reminderPrefs.weeklyReconnectGoal ?? 3)));
  const weeklyContactedCount =
    reconnectProgress.weekKey === weekKey ? reconnectProgress.contactedKeys.length : 0;

  const hasSentWishThisYear = (cKey: string, occKey: string) =>
    sentWishes.some(
      (w) => w.contactKey === cKey && w.occasionKey === occKey && w.year === currentYear,
    );

  const unreturned = useMemo(
    () =>
      unreturnedMissedCalls(calls, dismissedMissedIds).filter(
        (m) => !mutedAlertSet.has(`missed:${getContactKey(m.number)}`),
      ),
    [calls, dismissedMissedIds, mutedAlertSet],
  );
  const longGapReturnCalls = useMemo(() => {
    if (alertTypePrefs.longGapCalls === false) return [];
    return findLongGapReturnCalls(calls, {
      contacts,
      favorites: Array.from(favorites),
      minGapDays: alertTypePrefs.longGapDays ?? 30,
      maxAgeDays: 7,
    }).filter(
      (item) =>
        !dismissedMissedIds.has(`longgap:${item.id}`) &&
        !mutedAlertSet.has(`longgap:${item.contactKey}`),
    );
  }, [
    alertTypePrefs.longGapCalls,
    alertTypePrefs.longGapDays,
    calls,
    contacts,
    favorites,
    dismissedMissedIds,
    mutedAlertSet,
  ]);
  const weekly = useMemo(
    () => buildPeriodReport(calls, 'weekly', tariffs, new Date()),
    [calls, tariffs],
  );
  const monthly = useMemo(
    () => buildPeriodReport(calls, 'monthly', tariffs, new Date()),
    [calls, tariffs],
  );

  const allActiveAlertKeys = useMemo(() => {
    const keys: string[] = [];
    longGapReturnCalls.forEach((item) => keys.push(`longgap:${item.id}`));
    unreturned.forEach((m) => keys.push(`missed:${m.id}`));
    pendingScheduled.forEach((s) => keys.push(`sched:${s.id}:${s.scheduledFor}`));
    upcomingEvents.forEach((e) => keys.push(`bday:${e.id}:${e.daysUntil}`));
    upcomingHolidays.forEach((h) => keys.push(`holiday:${h.key}:${h.daysUntil}`));
    return keys;
  }, [longGapReturnCalls, unreturned, pendingScheduled, upcomingEvents, upcomingHolidays]);

  const unreadAlertKeys = useMemo(
    () => allActiveAlertKeys.filter((k) => !readAlertSet.has(k)),
    [allActiveAlertKeys, readAlertSet],
  );

  const unifiedContacts = useMemo(() => {
    const byKey = new Map<
      string,
      {
        key: string;
        number: string;
        name: string;
        tag: string;
        count: number;
        duration: number;
        isSaved: boolean;
        subtitle: string;
      }
    >();

    frequentAndLong.forEach((caller) => {
      const reasonLabel =
        caller.reason === 'both'
          ? 'Frequent & long-time caller'
          : caller.reason === 'frequent'
            ? 'Frequent caller'
            : 'Long-time caller';
      byKey.set(caller.key, {
        key: caller.key,
        number: caller.number,
        name: caller.name,
        tag: caller.tag,
        count: caller.count,
        duration: caller.duration,
        isSaved: Boolean(contacts[caller.key]),
        subtitle: `${caller.count} calls · ${formatDuration(caller.duration)} · ${reasonLabel}`,
      });
    });

    Object.values(contacts).forEach((profile) => {
      const existing = byKey.get(profile.key);
      if (existing) {
        existing.name = profile.name || existing.name;
        existing.tag = profile.tag || existing.tag;
        existing.number = profile.number || existing.number;
        existing.isSaved = true;
      } else {
        byKey.set(profile.key, {
          key: profile.key,
          number: profile.number,
          name: profile.name,
          tag: profile.tag,
          count: 0,
          duration: 0,
          isSaved: true,
          subtitle: 'Saved contact',
        });
      }
    });

    return [...byKey.values()].sort((a, b) => {
      if (a.isSaved !== b.isSaved) return a.isSaved ? -1 : 1;
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [frequentAndLong, contacts]);

  const filteredWishRecipients = useMemo(() => {
    const q = wishSearch.trim().toLowerCase();
    return unifiedContacts.filter((item) => {
      if (
        recipientFilter !== 'all' &&
        item.tag.toLowerCase() !== recipientFilter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.number.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q)
      );
    });
  }, [unifiedContacts, recipientFilter, wishSearch]);

  const filteredScheduleContacts = useMemo(() => {
    const q = schedContactQuery.trim().toLowerCase();
    const list = Object.values(contacts).sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q) ||
        c.tag.toLowerCase().includes(q),
    );
  }, [contacts, schedContactQuery]);

  const holidayUid = (h: (typeof upcomingHolidays)[number]) =>
    `${h.key}-${h.ethiopian.year}-${h.ethiopian.month}-${h.ethiopian.day}`;

  const activeHoliday =
    upcomingHolidays.find((h) => holidayUid(h) === selectedHolidayId) ??
    upcomingHolidays[0] ??
    null;

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotice(message);
    } catch {
      showNotice('Clipboard unavailable in this browser.');
    }
  };

  const handleAlertAction = async () => {
    let permission = notificationPermission;
    if (permission !== 'granted') {
      permission = await requestAlertPermissions();
      if (permission !== 'granted') return;
    }
    setNotificationsEnabled(true);
    const lines: string[] = [];
    if (upcomingEvents[0]) {
      const e = upcomingEvents[0];
      lines.push(`${e.name}'s ${e.title} (${e.isToday ? 'Today' : `in ${e.daysUntil}d`})`);
    }
    if (activeHoliday) {
      lines.push(`${activeHoliday.name} (${activeHoliday.isToday ? 'Today' : `in ${activeHoliday.daysUntil}d`})`);
    }
    if (unreturned.length > 0) {
      lines.push(`${unreturned.length} unreturned missed call${unreturned.length === 1 ? '' : 's'}`);
    }
    await sendTestAlertNotification(
      lines.length > 0 ? lines.join(' · ') : 'All caught up — no urgent reminders today.',
    );
  };

  const categories: Array<CategoryItem<RemindersCategory>> = [
    {
      key: 'action',
      label: 'Follow-ups',
      icon: Clock,
      count: longGapReturnCalls.length + unreturned.length + pendingScheduled.length,
    },
    {
      key: 'wishes',
      label: 'Wishes',
      flaticon: 'fi-rr-gift',
      count: upcomingEvents.length + upcomingHolidays.length,
    },
    {
      key: 'quiet',
      label: 'Quiet',
      icon: UserCheck,
      count: quiet.length,
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: BarChart3,
    },
  ];

  const activeMeta = REMINDERS_META[activeCategory];

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="reminders-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
          onClick={onClose}
        >
          <motion.div
            key="reminders-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col h-[84dvh] sm:h-[640px] max-h-[90dvh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Notifications, Wishes, Follow-ups, and Reports"
          >
        {/* Pinned Modal Header + Category Tabs */}
        <div className="shrink-0 p-5 pb-3.5 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 flex items-center justify-center text-[#FF6A00] shrink-0">
                <Bell size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#08246B] dark:text-white">
                  Wishes &amp; Alerts
                </h2>
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                  {activeMeta.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void handleAlertAction()}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0"
              >
                {notificationPermission === 'granted' && notificationsEnabled
                  ? 'Test alert'
                  : 'Allow alerts'}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close notifications"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={unreadAlertKeys.length === 0}
                onClick={() => markAllAlertsRead(allActiveAlertKeys)}
                className="min-h-[34px] px-2.5 py-1 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[11px] font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] disabled:opacity-45 flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <CheckCheck size={13} className="text-[#FF6A00]" />
                {unreadAlertKeys.length > 0 ? `Mark all as read (${unreadAlertKeys.length})` : 'All read'}
              </button>

              <button
                type="button"
                onClick={() =>
                  isAlertsSnoozedToday ? resumeSnoozedAlertsToday() : snoozeAlertsForToday()
                }
                className={`min-h-[34px] px-2.5 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  isAlertsSnoozedToday
                    ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                    : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]'
                }`}
              >
                <BellOff size={13} />
                {isAlertsSnoozedToday ? 'Snoozed today · Resume' : 'Snooze for today'}
              </button>
            </div>
          </div>

          <CategoryTabs
            items={categories}
            activeKey={activeCategory}
            onChange={setActiveCategory}
            ariaLabel="Wishes and alerts categories"
            variant="inset"
          />
        </div>

        {/* Dedicated Scrollable Body — fixed height prevents jump between tall & short tabs */}
        <div ref={bodyScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-5">
        <CategoryPanel
          activeKey={activeCategory}
          label={activeMeta.title}
          transitionStyle="fade"
          className="space-y-5"
        >
          <div className="pb-2 border-b border-[#DDE4EA]/70 dark:border-[var(--dark-border)]">
            <h3 className="text-sm font-bold text-[#08246B] dark:text-white">
              {activeMeta.title}
            </h3>
          </div>
        {/* Birthdays & Events */}
        {activeCategory === 'wishes' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Cake size={15} className="text-[#FF6A00]" />
              <h3 className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Upcoming birthdays & events ({upcomingEvents.length})
              </h3>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)] py-3 border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                No upcoming birthdays or events in the next 45 days. Import phone contacts (.vcf) or tap any caller to add their birthday.
              </p>
            ) : (
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                {upcomingEvents.map((evt) => {
                  const display = formatDisplayNameOrPhone(evt.name, evt.number);
                  const wish = buildBirthdayWish(evt.name, evt.title, evt.tag, calendarPrefs.defaultLang);
                  const openedThisYear = hasSentWishThisYear(evt.contactKey, evt.id);
                  const profile = contacts[evt.contactKey];
                  return (
                    <div key={evt.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectContact(evt.number);
                        }}
                        className="min-w-0 text-left space-y-0.5"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                            {display}
                          </p>
                          {evt.tag && (
                            <span className="text-xs font-medium text-[#FF6A00]">{evt.tag}</span>
                          )}
                          {openedThisYear && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              <Check size={10} />
                              Opened · {currentYear}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                          {evt.title} ·{' '}
                          {evt.calendar === 'ethiopian'
                            ? `${getEthiopianMonthName(evt.month, 'english')} ${evt.day} EC`
                            : `${evt.month}/${evt.day} GC`}{' '}
                          ·{' '}
                          <span className="font-semibold text-[#FF6A00]">
                            {evt.isToday ? 'Today!' : `In ${evt.daysUntil} days`}
                          </span>
                        </p>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            void copyText(wish, `Copied wish for ${display}.`)
                          }
                          aria-label={`Copy wish for ${display}`}
                          className="min-h-[38px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1"
                        >
                          <Copy size={13} />
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openWishComposer({
                              contactNumber: evt.number,
                              contactName: display,
                              contactKey: evt.contactKey,
                              tag: evt.tag,
                              occasionType: 'birthday',
                              occasionKey: evt.id,
                              occasionName: evt.title,
                              telegramUsername: profile?.telegramUsername,
                              instagramUsername: profile?.instagramUsername,
                            })
                          }
                          className="min-h-[38px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1"
                        >
                          <MessageSquare size={13} className="text-[#FF6A00]" />
                          Wish
                        </button>
                        <button
                          type="button"
                          onClick={() => onCallBack(evt.number)}
                          className="min-h-[38px] px-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Phone size={13} />
                          Call
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ethiopian Holiday Wishes for Saved & Frequent Callers */}
        {activeCategory === 'wishes' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FlaticonIcon name="fi-rr-calendar-star" className="text-[15px] text-[#FF6A00]" />
                <h3 className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Ethiopian holiday wishes ({filteredWishRecipients.length})
                </h3>
              </div>
              {upcomingHolidays.length > 0 && (
                <CustomSelect
                  ariaLabel="Choose Ethiopian holiday occasion"
                  value={activeHoliday ? holidayUid(activeHoliday) : ''}
                  variant="inset"
                  compact
                  flaticon="fi-rr-calendar-star"
                  options={upcomingHolidays.map((h) => ({
                    value: holidayUid(h),
                    label: h.name,
                    sublabel: h.isToday ? 'Today!' : `In ${h.daysUntil}d`,
                  }))}
                  onChange={setSelectedHolidayId}
                />
              )}
            </div>

            {activeHoliday && (
              <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-1">
                <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                  {activeHoliday.name} · {getEthiopianMonthName(activeHoliday.ethiopian.month, 'english')}{' '}
                  {activeHoliday.ethiopian.day}, {activeHoliday.ethiopian.year} EC
                </p>
                {activeHoliday.description && (
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {activeHoliday.description}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
                />
                <input
                  type="search"
                  value={wishSearch}
                  onChange={(e) => setWishSearch(e.target.value)}
                  placeholder="Pick saved contact or caller..."
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] pl-8 pr-3 py-1.5 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', ...DEFAULT_RELATIONSHIP_TAGS] as const).map((tagOpt) => (
                  <button
                    key={tagOpt}
                    type="button"
                    onClick={() => setRecipientFilter(tagOpt)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      recipientFilter === tagOpt
                        ? 'bg-[#FF6A00] text-white'
                        : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                    }`}
                  >
                    {tagOpt === 'all' ? 'All tags' : tagOpt}
                  </button>
                ))}
              </div>
            </div>

            {filteredWishRecipients.length === 0 ? (
              <p className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)] py-2">
                No saved contacts or callers match this search or tag yet. Add contacts in Usage → Saved Contacts.
              </p>
            ) : (
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] border-y border-[#DDE4EA] dark:border-[var(--dark-border)] max-h-64 overflow-y-auto">
                {(wishSearch.trim()
                  ? filteredWishRecipients
                  : filteredWishRecipients.slice(0, 12)
                ).map((caller) => {
                  const holidayTitle = activeHoliday?.name ?? 'Holiday';
                  const holidayOccasionKey = activeHoliday?.key ?? 'holiday';
                  const display = formatDisplayNameOrPhone(caller.name, caller.number);
                  const wishText = buildHolidayWish(
                    holidayTitle,
                    caller.name,
                    caller.tag,
                    calendarPrefs.defaultLang,
                  );
                  const openedThisYear = hasSentWishThisYear(caller.key, holidayOccasionKey);
                  const profile = contacts[caller.key];
                  return (
                    <div key={caller.key} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectContact(caller.number);
                        }}
                        className="min-w-0 text-left space-y-0.5"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <UserCheck size={13} className="text-[#FF6A00] shrink-0" />
                          <span className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                            {display}
                          </span>
                          {caller.tag && (
                            <span className="text-xs font-medium text-[#FF6A00] shrink-0">
                              {caller.tag}
                            </span>
                          )}
                          {openedThisYear && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                              <Check size={10} />
                              Opened · {currentYear}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                          {caller.subtitle}
                        </p>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            void copyText(
                              wishText,
                              `Copied ${holidayTitle} wish for ${display}.`,
                            )
                          }
                          className="min-h-[36px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1"
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openWishComposer({
                              contactNumber: caller.number,
                              contactName: display,
                              contactKey: caller.key,
                              tag: caller.tag,
                              occasionType: 'holiday',
                              occasionKey: holidayOccasionKey,
                              occasionName: holidayTitle,
                              telegramUsername: profile?.telegramUsername,
                              instagramUsername: profile?.instagramUsername,
                            })
                          }
                          className="min-h-[36px] px-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <MessageSquare size={12} />
                          Send wish
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Back in Touch (30+ day return calls) */}
        {activeCategory === 'action' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <PhoneIncoming size={15} className="text-[#10B981]" />
              <h3 className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Back in touch after {alertTypePrefs.longGapDays ?? 30}+ days ({longGapReturnCalls.length})
              </h3>
            </div>

            {longGapReturnCalls.length === 0 ? (
              <p className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)] py-3 border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                No one has called after a {alertTypePrefs.longGapDays ?? 30}+ day gap in the last 7 days. You&apos;ll get an alert when a long-quiet contact reaches out.
              </p>
            ) : (
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                {longGapReturnCalls.map((item) => {
                  const displayName = formatDisplayNameOrPhone(item.name || null, item.number);
                  const profile = contacts[item.contactKey];
                  return (
                    <div key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectContact(item.number);
                        }}
                        className="min-w-0 text-left space-y-0.5 flex-1"
                      >
                        <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate flex items-center gap-1.5">
                          {!readAlertSet.has(`longgap:${item.id}`) && (
                            <span
                              className="w-2 h-2 rounded-full bg-[#FF6A00] shrink-0"
                              aria-label="Unread alert"
                            />
                          )}
                          {item.direction === 'missed' ? (
                            <PhoneMissed size={13} className="text-[#FF6A00] shrink-0" />
                          ) : (
                            <PhoneIncoming size={13} className="text-[#10B981] shrink-0" />
                          )}
                          <span className="truncate">{displayName}</span>
                          <span className="text-xs font-mono font-bold tabular-nums text-[#FF6A00] shrink-0">
                            · {item.gapDays}d gap
                          </span>
                        </p>
                        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums truncate">
                          {[
                            item.direction === 'missed'
                              ? 'Missed call'
                              : item.duration > 0
                                ? `Incoming · ${formatDuration(item.duration)}`
                                : 'Incoming',
                            formatDateTime(item.timestamp),
                            item.sim || null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </button>
                      <div className="w-full sm:w-auto min-w-0 flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            openWishComposer({
                              contactNumber: item.number,
                              contactName: displayName,
                              contactKey: item.contactKey,
                              tag: item.tag || profile?.tag || undefined,
                              occasionType: 'reconnect',
                              occasionKey: `reconnect:${item.contactKey}`,
                              occasionName: 'Back in Touch',
                              telegramUsername: profile?.telegramUsername,
                              instagramUsername: profile?.instagramUsername,
                            })
                          }
                          className="min-h-[38px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] text-xs font-semibold text-[#08246B] dark:text-white flex items-center gap-1"
                        >
                          <MessageSquare size={13} className="text-[#FF6A00]" />
                          Say Hi
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissLongGapCall(item.id)}
                          aria-label={`Mark ${displayName} handled`}
                          className="min-h-[38px] min-w-[38px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCallBack(item.number)}
                          aria-label={`Call ${displayName}`}
                          className="min-h-[38px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Phone size={14} />
                          Call
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Scheduled Calls */}
        {activeCategory === 'action' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-[#FF6A00]" />
                <h3 className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Scheduled calls ({pendingScheduled.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNewSchedOpen((prev) => !prev)}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
              >
                <Plus size={13} />
                {newSchedOpen ? 'Close' : 'Schedule call'}
              </button>
            </div>

            {newSchedOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const parsed = parseDateTimeLocalValue(schedAt);
                  if (!schedNumber.trim() || Number.isNaN(parsed)) {
                    showNotice('Enter a valid number and date/time.');
                    return;
                  }
                  scheduleCall({
                    number: schedNumber,
                    name: schedName || null,
                    scheduledFor: parsed,
                    note: schedNote || null,
                  });
                  setSchedNumber('');
                  setSchedName('');
                  setSchedNote('');
                  setSchedContactQuery('');
                  setNewSchedOpen(false);
                }}
                className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-3"
              >
                {Object.keys(contacts).length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Saved contact picker ({Object.keys(contacts).length})
                      </span>
                    </div>
                    <div className="relative">
                      <Search
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
                      />
                      <input
                        type="search"
                        value={schedContactQuery}
                        onChange={(e) => setSchedContactQuery(e.target.value)}
                        placeholder="Search saved contacts by name, phone, or tag..."
                        className="w-full rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] pl-8 pr-3 py-1.5 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0]"
                      />
                    </div>
                    <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1.5 pt-0.5">
                      {filteredScheduleContacts.length === 0 ? (
                        <span className="text-[11px] text-[#8A93A0]">
                          No saved contacts match.
                        </span>
                      ) : (
                        filteredScheduleContacts.map((c) => {
                          const selected =
                            getContactKey(schedNumber) === c.key && schedNumber.trim() !== '';
                          return (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => {
                                setSchedNumber(c.number);
                                setSchedName(c.name);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                                selected
                                  ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                                  : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]'
                              }`}
                            >
                              {formatDisplayNameOrPhone(c.name, c.number)}
                              {c.tag ? ` · ${c.tag}` : ''}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="tel"
                    required
                    value={schedNumber}
                    onChange={(e) => setSchedNumber(e.target.value)}
                    placeholder="Phone number (+251...)"
                    className="min-h-[40px] rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white"
                  />
                  <input
                    type="text"
                    value={schedName}
                    onChange={(e) => setSchedName(e.target.value)}
                    placeholder="Contact name (optional)"
                    className="min-h-[40px] rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white"
                  />
                </div>

                <SimpleScheduleTimePicker
                  value={schedAt}
                  onChange={setSchedAt}
                  variant="surface"
                  ariaLabel="Scheduled date and time"
                  resetKey={newSchedOpen}
                />

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={schedNote}
                    onChange={(e) => setSchedNote(e.target.value)}
                    placeholder="Note or topic (optional)"
                    className="flex-1 min-h-[40px] rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    Schedule Call
                  </button>
                </div>
              </form>
            )}

            {pendingScheduled.length === 0 ? (
              <p className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)] py-3 border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                No scheduled calls yet. Tap "Schedule call" above or use a missed-call callback preset.
              </p>
            ) : (
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                {pendingScheduled.map((item) => {
                  const displayName = formatDisplayNameOrPhone(item.name, item.number);
                  return (
                    <div key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectContact(item.number);
                        }}
                        className="min-w-0 text-left space-y-0.5"
                      >
                        <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate flex items-center gap-1.5">
                          {!readAlertSet.has(`sched:${item.id}:${item.scheduledFor}`) && (
                            <span
                              className="w-2 h-2 rounded-full bg-[#FF6A00] shrink-0"
                              aria-label="Unread alert"
                            />
                          )}
                          <span className="truncate">{displayName}</span>
                        </p>
                        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                          <span className="font-semibold text-[#FF6A00]">
                            {formatScheduledCountdown(item.scheduledFor)}
                          </span>{' '}
                          · {formatScheduledLabel(item)}
                        </p>
                        {item.note && (
                          <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] truncate">
                            {item.note}
                          </p>
                        )}
                      </button>

                      <div className="w-full sm:w-auto min-w-0 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => snoozeScheduledCall(item.id, 15)}
                          className="min-h-[36px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white"
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
                                ? 'Calendar invite saved to Downloads & ready to open.'
                                : 'Saved .ics calendar file.',
                            );
                          }}
                          aria-label={`Download calendar file for ${displayName}`}
                          className="min-h-[36px] min-w-[36px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] flex items-center justify-center"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => completeScheduledCall(item.id)}
                          aria-label={`Mark ${displayName} call done`}
                          className="min-h-[36px] min-w-[36px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] flex items-center justify-center"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeScheduledCall(item.id)}
                          aria-label={`Delete scheduled call with ${displayName}`}
                          className="min-h-[36px] min-w-[36px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#DC2626] dark:text-[#F28B82] flex items-center justify-center"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCallBack(item.number)}
                          className="min-h-[36px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Phone size={13} />
                          Call
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Unreturned Missed Calls */}
        {activeCategory === 'action' && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Unreturned missed calls ({unreturned.length})
            </h3>
            {unreturned.length === 0 ? (
              <p className="text-sm text-[#8A93A0] dark:text-[var(--dark-text-muted)] py-3 border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                All caught up — no unreturned missed calls right now.
              </p>
            ) : (
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                {unreturned.map((missed) => {
                  const name = formatDisplayNameOrPhone(missed.name, missed.number);
                  return (
                    <div key={missed.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectContact(missed.number);
                        }}
                        className="min-w-0 text-left"
                      >
                        <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate flex items-center gap-1.5">
                          {!readAlertSet.has(`missed:${missed.id}`) && (
                            <span
                              className="w-2 h-2 rounded-full bg-[#FF6A00] shrink-0"
                              aria-label="Unread alert"
                            />
                          )}
                          <span className="truncate">{name}</span>
                        </p>
                        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                          Missed {formatDateTime(missed.timestamp)}
                          {missed.sim ? ` · ${missed.sim}` : ''}
                        </p>
                      </button>
                      <div className="w-full sm:w-auto min-w-0 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            scheduleCall({
                              number: missed.number,
                              name: missed.name,
                              scheduledFor: Date.now() + 15 * 60_000,
                              note: 'Return missed call',
                              sourceCallId: missed.id,
                            })
                          }
                          className="min-h-[38px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                        >
                          15m
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            scheduleCall({
                              number: missed.number,
                              name: missed.name,
                              scheduledFor: Date.now() + 60 * 60_000,
                              note: 'Return missed call',
                              sourceCallId: missed.id,
                            })
                          }
                          className="min-h-[38px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                        >
                          1h
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissMissedCall(missed.id)}
                          aria-label={`Mark ${name} handled`}
                          className="min-h-[38px] min-w-[38px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCallBack(missed.number)}
                          aria-label={`Call ${name}`}
                          className="min-h-[38px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Phone size={14} />
                          Call
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quiet Contacts / Reconnect Suggestions */}
        {activeCategory === 'quiet' && (
          <div className="space-y-4">
            {/* Catchy Weekly Reconnect Hero */}
            <div className="rounded-2xl bg-gradient-to-br from-[#FFF4EB] via-[#FFF9F4] to-white dark:from-[#FF6A00]/14 dark:via-[#1B1D22] dark:to-[#16181D] border border-[#FF6A00]/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-[11px] font-semibold text-[#FF6A00]">
                    Weekly Reconnect Goal
                  </p>
                  <p className="text-lg font-bold text-[#08246B] dark:text-white font-mono tabular-nums leading-tight">
                    {weeklyContactedCount} of {weeklyGoal}{' '}
                    <span className="text-xs font-sans font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      reconnected
                    </span>
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Swipe right to call · Swipe left to snooze 1 week
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold font-mono tabular-nums text-[#08246B] dark:text-white leading-tight">
                    {filteredQuiet.length}
                  </p>
                  <p className="text-[10px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {filteredQuiet.length === 1 ? 'waiting' : 'waiting'}
                  </p>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-[#DDE4EA]/70 dark:bg-[var(--dark-canvas)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#FF6A00] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((weeklyContactedCount / weeklyGoal) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {!alertTypePrefs.quietContacts && (
              <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] px-1">
                Pop-up notifications for quiet contacts stay calm and off by default. Enable anytime in Settings → Reminders.
              </p>
            )}

            {/* Category Segmented Filter */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
              {(
                [
                  { id: 'all', label: 'All', count: quietCategoryCounts.all },
                  { id: 'family', label: 'Family', count: quietCategoryCounts.family },
                  { id: 'friends', label: 'Friends', count: quietCategoryCounts.friends },
                  { id: 'business', label: 'Work', count: quietCategoryCounts.business },
                ] as const
              ).map((chip) => {
                const active = quietFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setQuietFilter(chip.id);
                      setShowAllQuiet(false);
                    }}
                    className={`min-h-[36px] px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1 transition-colors ${
                      active
                        ? 'bg-[#FF6A00] text-white shadow-sm'
                        : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                    }`}
                  >
                    <span className="truncate">{chip.label}</span>
                    <span
                      className={`text-[10px] font-mono tabular-nums ${
                        active ? 'text-white/90' : 'text-[#8A93A0] dark:text-[var(--dark-text-muted)]'
                      }`}
                    >
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {mutedUndo && (
              <div className="rounded-xl bg-[#08246B] dark:bg-[var(--dark-elevated)] text-white px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                <span className="truncate">
                  Muted reconnect reminders for <strong>{mutedUndo.label}</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    unmuteAlertKey(mutedUndo.key);
                    setMutedUndo(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#FF6A00] text-white font-semibold shrink-0"
                >
                  Undo
                </button>
              </div>
            )}

            {/* Active Reconnect Cards */}
            {filteredQuiet.length === 0 ? (
              <div className="rounded-2xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-4 py-6 text-center space-y-1">
                <p className="text-sm font-semibold text-[#08246B] dark:text-white">
                  You&apos;re all caught up here
                </p>
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  No overdue regular contacts in this filter right now.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-hidden">
                {displayedQuiet.map((item: QuietContact) => {
                  const display = formatDisplayNameOrPhone(item.name, item.number);
                  const qMuteKey = `quiet:${item.contactKey}`;
                  const profile = contacts[item.contactKey];
                  const urgencyColor =
                    item.overdueRatio >= 3
                      ? 'text-[#EF4444]'
                      : item.overdueRatio >= 2
                        ? 'text-[#F59E0B]'
                        : 'text-[#10B981]';
                  const barColor =
                    item.overdueRatio >= 3
                      ? 'bg-[#EF4444]'
                      : item.overdueRatio >= 2
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#10B981]';
                  const barWidth = Math.min(100, Math.max(24, Math.round((item.overdueRatio / 3.5) * 100)));
                  const activeDx = swipeState?.key === item.contactKey ? swipeState.dx : 0;

                  const triggerQuietCall = () => {
                    const pts = recordQuietReconnect(item.contactKey, display).awardedPoints;
                    if (pts > 0) showNotice(`+${pts} pts earned! Reconnect goal updated.`, 'success');
                    onCallBack(item.number);
                  };

                  const triggerSnooze = (days: number, label: string) => {
                    snoozeQuietContact(item.contactKey, days * 86_400_000);
                    setOpenSnoozeKey(null);
                    showNotice(`Snoozed ${display} for ${label}.`);
                  };

                  const metaParts = [
                    item.typicalIntervalDays !== null
                      ? `Usually every ${item.typicalIntervalDays}d`
                      : `${item.callCount} past calls`,
                    item.tag || null,
                    item.isFavorite ? 'VIP' : null,
                  ].filter(Boolean);

                  return (
                    <div
                      key={item.contactKey}
                      onTouchStart={(e) => {
                        const t = e.touches[0];
                        if (!t) return;
                        swipeStartRef.current = { key: item.contactKey, x: t.clientX, y: t.clientY };
                      }}
                      onTouchMove={(e) => {
                        const start = swipeStartRef.current;
                        const t = e.touches[0];
                        if (!start || start.key !== item.contactKey || !t) return;
                        const dx = t.clientX - start.x;
                        const dy = t.clientY - start.y;
                        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
                          setSwipeState({
                            key: item.contactKey,
                            dx: Math.max(-96, Math.min(96, dx)),
                          });
                        }
                      }}
                      onTouchEnd={() => {
                        if (swipeState?.key === item.contactKey) {
                          if (swipeState.dx >= 64) {
                            triggerQuietCall();
                          } else if (swipeState.dx <= -64) {
                            triggerSnooze(7, '1 week');
                          }
                        }
                        swipeStartRef.current = null;
                        setSwipeState(null);
                      }}
                      className="rounded-2xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]/45 p-3.5 space-y-3 transition-all"
                      style={
                        activeDx !== 0
                          ? { transform: `translateX(${activeDx * 0.45}px)` }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectContact(item.number);
                          }}
                          className="min-w-0 text-left flex items-center gap-3 flex-1"
                        >
                          <ContactAvatar
                            name={item.name}
                            number={item.number}
                            size="lg"
                            className="shadow-sm"
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-sm font-bold text-[#08246B] dark:text-white truncate">
                              {display}
                            </p>
                            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                              {metaParts.join(' · ')}
                            </p>
                          </div>
                        </button>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="leading-none">
                            <span className={`text-sm font-mono font-bold tabular-nums ${urgencyColor}`}>
                              {item.daysSinceLast}d
                            </span>
                            <span className="ml-1 text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              ago
                            </span>
                          </div>
                          <div className="w-12 h-1 rounded-full bg-[#DDE4EA] dark:bg-[var(--dark-surface)] overflow-hidden ml-auto">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={triggerQuietCall}
                          aria-label={`Call ${display}`}
                          className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <Phone size={14} />
                          Call
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openWishComposer({
                              contactNumber: item.number,
                              contactName: display,
                              contactKey: item.contactKey,
                              tag: item.tag,
                              occasionType: 'reconnect',
                              occasionKey: `reconnect:${weekKey}`,
                              occasionName: 'Check-in',
                              telegramUsername: profile?.telegramUsername,
                              instagramUsername: profile?.instagramUsername,
                            })
                          }
                          className="flex-1 min-h-[40px] px-3 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] text-xs font-semibold text-[#08246B] dark:text-white flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <MessageSquare size={14} className="text-[#FF6A00]" />
                          Message
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSnoozeKey((prev) =>
                              prev === item.contactKey ? null : item.contactKey,
                            )
                          }
                          title="Snooze reminder"
                          aria-label={`Snooze reminder for ${display}`}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                            openSnoozeKey === item.contactKey
                              ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#FF6A00]'
                              : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]'
                          }`}
                        >
                          <Clock size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            muteAlertKey(qMuteKey);
                            setMutedUndo({ key: qMuteKey, label: display });
                          }}
                          title="Do not remind"
                          aria-label={`Do not remind for ${display}`}
                          className="w-10 h-10 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:border-[#DC2626]/60 hover:text-[#DC2626] flex items-center justify-center shrink-0 transition-colors"
                        >
                          <BellOff size={15} />
                        </button>
                      </div>

                      {openSnoozeKey === item.contactKey && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#DDE4EA] dark:border-[var(--dark-border)]">
                          <span className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] mr-1">
                            Snooze for:
                          </span>
                          {[
                            { days: 1, label: '1 day' },
                            { days: 7, label: '1 week' },
                            { days: 30, label: '1 month' },
                          ].map((opt) => (
                            <button
                              key={opt.days}
                              type="button"
                              onClick={() => triggerSnooze(opt.days, opt.label)}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {filteredQuiet.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllQuiet((prev) => !prev)}
                className="w-full min-h-[38px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
              >
                {showAllQuiet
                  ? 'Show top 5'
                  : `Show more (${filteredQuiet.length - 5} more)`}
              </button>
            )}

            {/* Collapsed Dormant (90+ days) drawer — never counted anywhere */}
            {quietAnalysis.dormant.length > 0 && (
              <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDormantOpen((prev) => !prev)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                >
                  <span>Dormant (90+ days)</span>
                  {dormantOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                {dormantOpen && (
                  <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] border-t border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5">
                    {quietAnalysis.dormant.map((item) => {
                      const display = formatDisplayNameOrPhone(item.name, item.number);
                      return (
                        <div
                          key={item.contactKey}
                          className="py-2.5 flex items-center justify-between gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onSelectContact(item.number);
                            }}
                            className="min-w-0 text-left"
                          >
                            <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                              {display}
                            </p>
                            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              Last call {item.daysSinceLast} days ago
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => onCallBack(item.number)}
                            className="min-h-[32px] px-2.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1 shrink-0"
                          >
                            <Phone size={12} className="text-[#FF6A00]" />
                            Call
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {mutedAlertKeys.length > 0 && (
              <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#08246B] dark:text-white flex items-center gap-1.5">
                    <BellOff size={13} className="text-[#FF6A00]" />
                    Muted contact/event alerts ({mutedAlertKeys.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mutedAlertKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => unmuteAlertKey(key)}
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[11px] font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5"
                    >
                      <span className="truncate max-w-[180px]">{key}</span>
                      <span className="text-[#FF6A00]">Unmute</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Period Reports */}
        {activeCategory === 'reports' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[weekly, monthly].map((rep) => (
                <div
                  key={rep.period}
                  className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[#08246B] dark:text-white">{rep.title}</p>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                        {rep.totalCalls} total calls · {formatEtb(rep.spendEtb)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(
                          formatReportClipboard(rep),
                          `Copied ${rep.period} report to clipboard.`,
                        )
                      }
                      aria-label={`Copy ${rep.period} summary`}
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#FF6A00] hover:bg-[#FF6A00]/10 shrink-0"
                    >
                      <Copy size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs tabular-nums">
                    <div>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">Talk time</p>
                      <p className="font-semibold text-[#08246B] dark:text-white">{formatDuration(rep.totalDuration)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">Missed</p>
                      <p className="font-semibold text-[#08246B] dark:text-white">{rep.missedCount} calls</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">Incoming</p>
                      <p className="font-medium text-[#08246B] dark:text-white">
                        {rep.incomingCount} · {formatDuration(rep.incomingDuration)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">Outgoing</p>
                      <p className="font-medium text-[#08246B] dark:text-white">
                        {rep.outgoingCount} · {formatDuration(rep.outgoingDuration)}
                      </p>
                    </div>
                  </div>

                  {rep.topContactName && (
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] pt-1 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] truncate">
                      Top caller: <span className="font-semibold text-[#08246B] dark:text-white">{rep.topContactName}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                  Formatted Call Statement (PDF)
                </p>
                <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Includes embedded charts, Dual-SIM spend breakdown, and full call ledger
                </p>
              </div>
              <button
                type="button"
                disabled={calls.length === 0 || exportingPdf}
                onClick={async () => {
                  setExportingPdf(true);
                  try {
                    await exportCallHistoryPdfReport({
                      calls,
                      tariffs,
                      simLabels,
                    });
                    showNotice('Formatted PDF report with charts downloaded.');
                  } catch {
                    showNotice('Could not generate PDF report.');
                  } finally {
                    setExportingPdf(false);
                  }
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <FileDown size={14} />
                {exportingPdf ? 'Generating...' : 'Download PDF Report'}
              </button>
            </div>
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
