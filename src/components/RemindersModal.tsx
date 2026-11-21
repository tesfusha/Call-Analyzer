import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  Bell,
  BellOff,
  Cake,
  Check,
  Clock,
  Copy,
  Download,
  FileDown,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import { CustomSelect } from '@/src/components/CustomSelect';
import { DateTimePicker } from '@/src/components/DateTimePicker';
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
  formatReportClipboard,
  quietContacts,
  quietMessage,
  unreturnedMissedCalls,
} from '@/src/lib/reminders';
import {
  buildScheduledCallIcs,
  formatScheduledCountdown,
  formatScheduledLabel,
  toDateTimeLocalValue,
  tomorrowAtHour,
} from '@/src/lib/schedule';
import { maskPhoneNumber, maskPrivateText } from '@/src/lib/security';
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
    scheduledCalls,
    tariffs,
    simLabels,
    calendarPrefs,
    reminderPrefs,
    privacyMode,
    dismissedMissedIds,
    mutedAlertKeys,
    mutedAlertSet,
    muteAlertKey,
    unmuteAlertKey,
    dismissMissedCall,
    scheduleCall,
    completeScheduledCall,
    snoozeScheduledCall,
    removeScheduledCall,
    notificationsEnabled,
    setNotificationsEnabled,
    notificationPermission,
    requestAlertPermissions,
    sendTestAlertNotification,
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
    toDateTimeLocalValue(Date.now() + 30 * 60_000),
  );
  const [schedNote, setSchedNote] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

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
  const quiet = useMemo(
    () =>
      quietContacts(calls, new Date(), reminderPrefs.quietContactDays).filter(
        (q) => !mutedAlertSet.has(`quiet:${getContactKey(q.number)}`),
      ),
    [calls, reminderPrefs.quietContactDays, mutedAlertSet],
  );
  const unreturned = useMemo(
    () =>
      unreturnedMissedCalls(calls, dismissedMissedIds).filter(
        (m) => !mutedAlertSet.has(`missed:${getContactKey(m.number)}`),
      ),
    [calls, dismissedMissedIds, mutedAlertSet],
  );
  const weekly = useMemo(() => buildPeriodReport(calls, 'weekly', tariffs), [calls, tariffs]);
  const monthly = useMemo(() => buildPeriodReport(calls, 'monthly', tariffs), [calls, tariffs]);

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
      count: unreturned.length + pendingScheduled.length,
    },
    {
      key: 'wishes',
      label: 'Wishes',
      icon: Sparkles,
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

  return (
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
            className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col h-[84vh] sm:h-[640px] max-h-[90vh] overflow-hidden shadow-xl"
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

          <CategoryTabs
            items={categories}
            activeKey={activeCategory}
            onChange={setActiveCategory}
            ariaLabel="Wishes and alerts categories"
            variant="inset"
          />
        </div>

        {/* Dedicated Scrollable Body — fixed height prevents jump between tall & short tabs */}
        <div ref={bodyScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5">
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
                  const wish = buildBirthdayWish(evt.name, evt.title, evt.tag);
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
                        <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                          {evt.name}
                          {evt.tag ? (
                            <span className="ml-2 text-xs font-medium text-[#FF6A00]">{evt.tag}</span>
                          ) : null}
                        </p>
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
                          onClick={() => void copyText(wish, `Copied wish for ${evt.name}.`)}
                          aria-label={`Copy wish for ${evt.name}`}
                          className="min-h-[38px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1"
                        >
                          <Copy size={13} />
                          Copy
                        </button>
                        <a
                          href={`sms:${evt.number}?body=${encodeURIComponent(wish)}`}
                          className="min-h-[38px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1"
                        >
                          <MessageSquare size={13} className="text-[#FF6A00]" />
                          Wish
                        </a>
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
                <Sparkles size={15} className="text-[#FF6A00]" />
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
                  icon={Sparkles}
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
                  const wishText = buildHolidayWish(holidayTitle, caller.name, caller.tag);
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
                        <div className="flex items-center gap-2">
                          <UserCheck size={13} className="text-[#FF6A00] shrink-0" />
                          <span className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                            {caller.name}
                          </span>
                          {caller.tag && (
                            <span className="text-xs font-medium text-[#FF6A00] shrink-0">
                              {caller.tag}
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
                            void copyText(wishText, `Copied ${holidayTitle} wish for ${caller.name}.`)
                          }
                          className="min-h-[36px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1"
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                        <a
                          href={`sms:${caller.number}?body=${encodeURIComponent(wishText)}`}
                          className="min-h-[36px] px-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <MessageSquare size={12} />
                          Send wish
                        </a>
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
                  const parsed = Date.parse(schedAt);
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
                              {c.name}
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
                    className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white"
                  />
                  <input
                    type="text"
                    value={schedName}
                    onChange={(e) => setSchedName(e.target.value)}
                    placeholder="Contact name (optional)"
                    className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white"
                  />
                  <DateTimePicker
                    value={schedAt}
                    onChange={setSchedAt}
                    variant="surface"
                    compact
                    ariaLabel="Scheduled date and time"
                  />
                  <input
                    type="text"
                    value={schedNote}
                    onChange={(e) => setSchedNote(e.target.value)}
                    placeholder="Reason / topic (optional)"
                    className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { label: 'In 15m', ts: () => Date.now() + 15 * 60_000 },
                      { label: 'In 1h', ts: () => Date.now() + 60 * 60_000 },
                      { label: 'Tomorrow 9 AM', ts: () => tomorrowAtHour(9) },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setSchedAt(toDateTimeLocalValue(preset.ts()))}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[11px] font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Save schedule
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
                  const displayName =
                    item.name?.trim() || maskPhoneNumber(item.number, privacyMode);
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
                        <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                          <span className="font-semibold text-[#FF6A00]">
                            {formatScheduledCountdown(item.scheduledFor)}
                          </span>{' '}
                          · {formatScheduledLabel(item)}
                        </p>
                        {item.note && (
                          <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] truncate">
                            {maskPrivateText(item.note, privacyMode)}
                          </p>
                        )}
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
                  const name = missed.name?.trim() || missed.number;
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
                        <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                          {name}
                        </p>
                        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                          Missed {formatDateTime(missed.timestamp)}
                          {missed.sim ? ` · ${missed.sim}` : ''}
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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

        {/* Quiet Contacts */}
        {activeCategory === 'quiet' && (
          <div className="space-y-4">
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Contacts gone quiet ({quiet.length})
            </h3>
            {quiet.length === 0 ? (
              <p className="text-sm text-[#8A93A0] dark:text-[var(--dark-text-muted)] py-3 border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                No overdue frequent contacts right now. Contacts appear here when they call at least 5 times within 30 days and then pass 1.5× their usual calling interval.
              </p>
            ) : (
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] border-y border-[#DDE4EA] dark:border-[var(--dark-border)]">
                {quiet.map((item) => {
                  const qMuteKey = `quiet:${getContactKey(item.number)}`;
                  return (
                    <div key={item.number} className="py-3 flex items-center justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectContact(item.number);
                        }}
                        className="min-w-0 text-left flex-1"
                      >
                        <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          {quietMessage(item)}
                        </p>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => muteAlertKey(qMuteKey)}
                          aria-label={`Mute quiet reminders for ${item.name}`}
                          className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#DC2626] flex items-center justify-center"
                        >
                          <BellOff size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCallBack(item.number)}
                          aria-label={`Call ${item.name}`}
                          className="min-h-[40px] min-w-[44px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
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
                      privacyMode,
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
}
