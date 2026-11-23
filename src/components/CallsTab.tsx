import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUp,
  ArrowUpDown,
  Award,
  Bell,
  Cake,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  Hash,
  HeartPulse,
  Layers,
  ListFilter,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Trophy,
  Upload,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { AchievementsModal } from '@/src/components/AchievementsModal';
import { CarrierUssdModal, type UssdCategory } from '@/src/components/CarrierUssdModal';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import { CustomSelect } from '@/src/components/CustomSelect';
import { ImportPreviewModal, type PendingImportState } from '@/src/components/ImportPreviewModal';
import { QuickScheduleModal } from '@/src/components/QuickScheduleModal';
import { WelcomeHero } from '@/src/components/WelcomeHero';
import { BADGE_DEFINITIONS } from '@/src/lib/gamificationConstants';
import { clusterConsecutiveCalls, filterCalls, groupCalls } from '@/src/lib/calls';
import {
  formatShortTag,
  getContactKey,
  getUpcomingContactEvents,
  readUploadedTextFile,
} from '@/src/lib/contacts';
import {
  ETHIOPIAN_EMERGENCY_HOTLINES,
  formatEtb,
  formatSimCompact,
  formatSimDisplay,
  toDialableUssdHref,
} from '@/src/lib/ethiopia';
import {
  formatEthiopianShort,
  getHolidaysInGregorianYearOrUpcoming,
} from '@/src/lib/ethiopianCalendar';
import { avatarColor, formatDuration, formatTime, initials } from '@/src/lib/format';
import { triggerHaptic } from '@/src/lib/haptics';
import { buildImportPreview, parseBackupImport } from '@/src/lib/import';
import { unreturnedMissedCalls } from '@/src/lib/reminders';
import { formatScheduledCountdown, formatScheduledLabel } from '@/src/lib/schedule';
import { formatDisplayNameOrPhone, maskPhoneNumber } from '@/src/lib/security';
import { filterByRange, totalSpendEtb } from '@/src/lib/stats';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { CallDirection, CallRecord } from '@/src/types/call';

type CallsCategory = 'log' | 'action' | 'vip' | 'tools';

const CALLS_PAGE_SIZE = 100;

const CALLS_META: Record<CallsCategory, { title: string; description: string }> = {
  log: {
    title: 'All Calls History',
    description: 'Search, filter, and review your recent call history',
  },
  action: {
    title: 'Follow-ups & Budget Alerts',
    description: 'Missed callbacks, scheduled calls, budget alerts, and upcoming events',
  },
  vip: {
    title: 'VIP Priority Contacts',
    description: 'Starred priority contacts with one-tap calling and quick profile access',
  },
  tools: {
    title: 'Quick Tools, USSD & Schedules',
    description: 'Import history, schedule callbacks, carrier USSD, and emergency hotlines',
  },
};

function DirectionIcon({ direction }: { direction: CallDirection }) {
  if (direction === 'incoming') {
    return <PhoneIncoming size={14} className="text-[#4FA3F7] shrink-0" />;
  }
  if (direction === 'outgoing') {
    return <PhoneOutgoing size={14} className="text-[#FF6A00] shrink-0" />;
  }
  return <PhoneMissed size={14} className="text-[#EF4444] shrink-0" />;
}

function formatCallStatus(direction: CallDirection): string {
  if (direction === 'incoming') return 'Incoming Call';
  if (direction === 'outgoing') return 'Outgoing Call';
  return 'Missed Call';
}

export const CallsTab = memo(function CallsTab({
  onSelectCall,
  onSelectContact,
  onCallBack,
  onOpenReminders,
  onOpenAnalytics,
}: {
  onSelectCall: (call: CallRecord) => void;
  onSelectContact: (number: string) => void;
  onCallBack: (number: string) => void;
  onOpenReminders: () => void;
  onOpenAnalytics: () => void;
}) {
  const {
    calls,
    contacts,
    scheduledCalls,
    favorites,
    dismissedMissedIds,
    tariffs,
    simLabels,
    calendarPrefs,
    reminderPrefs,
    profileName,
    authUser,
    isGuest,
    openAuthPrompt,
    privacyMode,
    toggleFavorite,
    availableTags,
    importBackupPackage,
    canSyncPhoneCalls,
    syncPhoneCalls,
    scheduleCall,
    completeScheduledCall,
    snoozeScheduledCall,
    dismissMissedCall,
    effectiveStreaks,
    score,
    badges,
    topContactStatuses,
    sessionNewCallIds,
    markCallSeen,
    showNotice,
  } = useCalls();

  const [activeCategory, setActiveCategory] = useState<CallsCategory>('log');
  const [query, setQuery] = useState('');
  const [dirFilter, setDirFilter] = useState<'all' | CallDirection | 'unreturned'>('all');
  const [simFilter, setSimFilter] = useState<'all' | 'SIM 1' | 'SIM 2'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'longest'>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [visibleClusterLimit, setVisibleClusterLimit] = useState(CALLS_PAGE_SIZE);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [ussdOpen, setUssdOpen] = useState(false);
  const [ussdInitialCategory, setUssdInitialCategory] = useState<UssdCategory>('all');
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [achievementsTab, setAchievementsTab] = useState<'general' | 'contacts'>('general');
  const [budgetAlertDismissed, setBudgetAlertDismissed] = useState(false);
  const [androidNoticeDismissed, setAndroidNoticeDismissed] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImportState | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [syncingPhone, setSyncingPhone] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  useLockBodyScroll(quickActionsOpen);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (!authUser?.uid) return false;
    try {
      return localStorage.getItem(`callanalyzer.u.${authUser.uid}.welcomeDismissed`) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!authUser?.uid) {
      setBannerDismissed(false);
      return;
    }
    try {
      setBannerDismissed(
        localStorage.getItem(`callanalyzer.u.${authUser.uid}.welcomeDismissed`) === '1',
      );
    } catch {
      setBannerDismissed(false);
    }
  }, [authUser?.uid]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const lastScrollYRef = useRef<number>(typeof window !== 'undefined' ? window.scrollY : 0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (Math.abs(currentY - lastScrollYRef.current) <= 4) return;
      lastScrollYRef.current = currentY;
      setIsScrolling(true);
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
      scrollTimerRef.current = window.setTimeout(() => {
        setIsScrolling(false);
        scrollTimerRef.current = null;
      }, 700);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!quickActionsOpen) return;
    setIsScrolling(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickActionsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickActionsOpen]);

  const dismissBanner = () => {
    setBannerDismissed(true);
    if (!authUser?.uid) return;
    try {
      localStorage.setItem(`callanalyzer.u.${authUser.uid}.welcomeDismissed`, '1');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setVisibleClusterLimit(CALLS_PAGE_SIZE);
  }, [query, dirFilter, simFilter, tagFilter, sortBy]);

  const resolveCallTag = useCallback(
    (call: CallRecord): string =>
      call.tag?.trim() || contacts[getContactKey(call.number)]?.tag?.trim() || '',
    [contacts],
  );

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    calls.forEach((c) => {
      const t = resolveCallTag(c);
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    });
    const sorted = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (sorted.length === 0) return [];
    return [
      { value: 'all', label: 'All tags', count: calls.length },
      ...sorted.map(([tag, count]) => ({ value: tag, label: tag, count })),
    ];
  }, [calls, resolveCallTag]);

  const unreturnedList = useMemo(() => {
    const list = unreturnedMissedCalls(calls, dismissedMissedIds);
    return [...list].sort((a, b) => {
      const aVip =
        favorites.has(a.number) || favorites.has(getContactKey(a.number)) ? 1 : 0;
      const bVip =
        favorites.has(b.number) || favorites.has(getContactKey(b.number)) ? 1 : 0;
      if (aVip !== bVip) return bVip - aVip;
      return b.timestamp - a.timestamp;
    });
  }, [calls, dismissedMissedIds, favorites]);

  const monthlySpendEtb = useMemo(
    () => totalSpendEtb(filterByRange(calls, '30d'), tariffs),
    [calls, tariffs],
  );
  const budgetPercent =
    tariffs.monthlyBudgetEtb > 0
      ? Math.round((monthlySpendEtb / tariffs.monthlyBudgetEtb) * 100)
      : 0;
  const showBudgetAlert =
    !budgetAlertDismissed && tariffs.monthlyBudgetEtb > 0 && budgetPercent >= 80;

  const unreturnedIds = useMemo(
    () => new Set(unreturnedList.map((c) => c.id)),
    [unreturnedList],
  );
  const pendingScheduled = useMemo(
    () =>
      scheduledCalls
        .filter((s) => s.status === 'pending')
        .sort((a, b) => a.scheduledFor - b.scheduledFor),
    [scheduledCalls],
  );

  const visible = useMemo(() => {
    const searched = filterCalls(calls, query);
    return searched.filter((call) => {
      if (dirFilter === 'unreturned') {
        if (!unreturnedIds.has(call.id)) return false;
      } else if (dirFilter !== 'all' && call.direction !== dirFilter) {
        return false;
      }
      if (simFilter !== 'all' && call.sim !== simFilter) return false;
      if (tagFilter !== 'all' && resolveCallTag(call) !== tagFilter) return false;
      return true;
    });
  }, [calls, query, dirFilter, simFilter, tagFilter, unreturnedIds, resolveCallTag]);

  const activeFilterCount =
    (dirFilter !== 'all' ? 1 : 0) +
    (simFilter !== 'all' ? 1 : 0) +
    (tagFilter !== 'all' ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0);

  const resetAllFilters = () => {
    triggerHaptic('tap');
    setDirFilter('all');
    setSimFilter('all');
    setTagFilter('all');
    setSortBy('newest');
  };

  const sections = useMemo(() => {
    if (sortBy === 'longest') {
      if (visible.length === 0) return [];
      const sortedLongest = [...visible].sort((a, b) => b.duration - a.duration);
      return [
        {
          key: 'longest',
          title: 'Longest calls first',
          totalCalls: sortedLongest.length,
          clusters: sortedLongest.map((call) => ({
            id: call.id,
            primary: call,
            calls: [call],
            totalDuration: call.duration,
          })),
        },
      ];
    }
    return groupCalls(visible).map((sec) => ({
      key: sec.key,
      title: sec.title,
      totalCalls: sec.data.length,
      clusters: clusterConsecutiveCalls(sec.data, getContactKey),
    }));
  }, [visible, sortBy]);

  const { paginatedSections, totalClusterCount, renderedClusterCount } = useMemo(() => {
    let total = 0;
    for (const sec of sections) total += sec.clusters.length;

    let remainingBudget = visibleClusterLimit;
    let rendered = 0;
    const sliced: typeof sections = [];

    for (const sec of sections) {
      if (remainingBudget <= 0) break;
      if (sec.clusters.length <= remainingBudget) {
        sliced.push(sec);
        remainingBudget -= sec.clusters.length;
        rendered += sec.clusters.length;
      } else {
        sliced.push({
          ...sec,
          clusters: sec.clusters.slice(0, remainingBudget),
        });
        rendered += remainingBudget;
        remainingBudget = 0;
      }
    }

    return {
      paginatedSections: sliced,
      totalClusterCount: total,
      renderedClusterCount: rendered,
    };
  }, [sections, visibleClusterLimit]);

  const vipContactsList = useMemo(() => {
    if (favorites.size === 0) return [];
    const byKey = new Map<
      string,
      { key: string; number: string; rawFavorite: string; name: string; tag: string; lastTimestamp: number }
    >();

    favorites.forEach((raw) => {
      const k = getContactKey(raw);
      const saved = contacts[k];
      byKey.set(k, {
        key: k,
        number: saved?.number || raw,
        rawFavorite: raw,
        name: saved?.name || '',
        tag: saved?.tag || '',
        lastTimestamp: 0,
      });
    });

    calls.forEach((call) => {
      const k = getContactKey(call.number);
      const entry = byKey.get(k);
      if (!entry) return;
      if (call.timestamp > entry.lastTimestamp) {
        entry.lastTimestamp = call.timestamp;
        if (!entry.name && call.name?.trim()) entry.name = call.name.trim();
        if (!entry.tag && call.tag?.trim()) entry.tag = call.tag.trim();
      }
    });

    return [...byKey.values()].sort((a, b) => {
      if (b.lastTimestamp !== a.lastTimestamp) return b.lastTimestamp - a.lastTimestamp;
      return (a.name || a.number).localeCompare(b.name || b.number);
    });
  }, [calls, contacts, favorites]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readUploadedTextFile(file);
      const pkg = parseBackupImport(text, file.name);
      const preview = buildImportPreview(file.name, pkg, {
        calls,
        contacts,
        availableTags,
        scheduledCalls,
      });
      if (
        preview.totalRowsEvaluated === 0 &&
        !preview.isBackup &&
        preview.problems.length > 0
      ) {
        showNotice(preview.problems[0]);
        return;
      }
      setPendingImport({ pkg, preview });
    } catch {
      showNotice('Could not read the selected file.');
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    const counts = importBackupPackage(pendingImport.pkg);
    setPendingImport(null);
    const parts: string[] = [];
    if (counts.callsAdded > 0) {
      parts.push(`Imported ${counts.callsAdded} call${counts.callsAdded === 1 ? '' : 's'}`);
    } else if (counts.callsMerged > 0) {
      parts.push(`Merged notes/tags on ${counts.callsMerged} existing call${counts.callsMerged === 1 ? '' : 's'}`);
    } else if (counts.restoredSections.length > 0) {
      parts.push(`Restored ${counts.restoredSections.join(', ')}`);
    } else {
      parts.push('No new calls added');
    }
    if (counts.callsDuplicates > 0) {
      parts.push(`${counts.callsDuplicates} duplicate${counts.callsDuplicates === 1 ? '' : 's'} skipped`);
    }
    showNotice(parts.join(' · '), counts.callsAdded > 0 || counts.restoredSections.length > 0 ? 'success' : 'tap');
    setActiveCategory('log');
  };

  const upcomingEvents = useMemo(
    () => getUpcomingContactEvents(contacts, calls, reminderPrefs.eventLeadDays),
    [contacts, calls, reminderPrefs.eventLeadDays],
  );
  const upcomingHoliday = useMemo(
    () =>
      getHolidaysInGregorianYearOrUpcoming(
        new Date(),
        Math.max(7, reminderPrefs.eventLeadDays),
        calendarPrefs.defaultLang,
      )[0] ?? null,
    [reminderPrefs.eventLeadDays, calendarPrefs.defaultLang],
  );
  const delayLabel =
    reminderPrefs.callbackDelayMinutes >= 60
      ? `${reminderPrefs.callbackDelayMinutes / 60}h`
      : `${reminderPrefs.callbackDelayMinutes}m`;

  const actionNeededCount =
    (showBudgetAlert ? 1 : 0) +
    unreturnedList.length +
    pendingScheduled.length +
    upcomingEvents.length +
    (upcomingHoliday ? 1 : 0);

  const categories: Array<CategoryItem<CallsCategory>> = useMemo(
    () => [
      { key: 'log', label: 'All Calls', icon: Phone, count: calls.length },
      { key: 'action', label: 'Follow-up', icon: Bell, count: actionNeededCount },
      { key: 'vip', label: 'VIP', icon: Star, count: vipContactsList.length },
      { key: 'tools', label: 'Tools', icon: Zap },
    ],
    [calls.length, actionNeededCount, vipContactsList.length],
  );

  const activeMeta = CALLS_META[activeCategory];

  const openUssdModal = (initialCategory: UssdCategory = 'all') => {
    setUssdInitialCategory(initialCategory);
    setUssdOpen(true);
  };

  const triggerCallImport = () => {
    if (isGuest || !authUser) {
      openAuthPrompt('signin', 'Login or create an account to import your own call history.');
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-5 pb-16 md:pb-14">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,.txt,text/csv,application/json,text/plain"
        className="hidden"
        onChange={handleFileChange}
      />

      {!isGuest && (calls.length === 0 || !bannerDismissed) && (
        <WelcomeHero
          displayName={profileName || authUser?.displayName?.split(' ')[0] || ''}
          callsCount={calls.length}
          savedContactsCount={Object.keys(contacts).length}
          unreturnedCount={unreturnedList.length}
          upcomingHoliday={upcomingHoliday}
          defaultLang={calendarPrefs.defaultLang}
          canSyncPhone={canSyncPhoneCalls}
          syncingPhone={syncingPhone}
          onSyncPhone={() => {
            setSyncingPhone(true);
            void syncPhoneCalls({ fullResync: true }).finally(() => setSyncingPhone(false));
          }}
          onImportFile={triggerCallImport}
          onDismiss={dismissBanner}
        />
      )}

      {!isGuest && authUser && (() => {
        const topContact = topContactStatuses[0] ?? null;
        const activeContactStreaksCount = topContactStatuses.filter((c) => c.currentStreak > 0).length;
        const maskedTopName = topContact
          ? formatDisplayNameOrPhone(
              topContact.displayName,
              topContact.number,
              privacyMode,
            )
          : '';
        return (
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-4 py-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 sm:gap-5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                    <Flame size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#08246B] dark:text-white tabular-nums">
                      {effectiveStreaks.currentStreak}d daily streak
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                      Best {effectiveStreaks.longestStreak}d · EAT (UTC+3)
                    </p>
                  </div>
                </div>

                <div className="h-7 w-px bg-[#DDE4EA] dark:bg-[var(--dark-border)] hidden sm:block" />

                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-[#FF6A00] flex items-center justify-center shrink-0">
                    <Trophy size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#08246B] dark:text-white font-mono tabular-nums">
                      General: {score} pts
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums flex items-center gap-1">
                      <Award size={11} className="text-[#FF6A00] shrink-0" />
                      <span>
                        {badges.length}/{BADGE_DEFINITIONS.length} general badges
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  setAchievementsTab('general');
                  setAchievementsOpen(true);
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#EEF2F6]/70 dark:bg-[var(--dark-canvas)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>Score &amp; Badges</span>
                <ChevronRight size={14} className="text-[#FF6A00]" />
              </button>
            </div>

            <div className="pt-2.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-wrap items-center justify-between gap-2">
              {topContact ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tap');
                    onSelectContact(topContact.number);
                  }}
                  className="flex items-center gap-2 min-w-0 text-left hover:opacity-85 transition-opacity"
                >
                  <Users size={14} className="text-[#FF6A00] shrink-0" />
                  <p className="text-xs text-[#08246B] dark:text-white truncate">
                    <span className="font-semibold">Status with {maskedTopName}:</span>{' '}
                    <span className="font-bold text-[#FF6A00]">{topContact.statusHeadline}</span>
                    <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] font-mono tabular-nums">
                      {' '}
                      · {topContact.contactScore} pts · {activeContactStreaksCount} active
                    </span>
                  </p>
                </button>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <Users size={14} className="text-[#8A93A0] shrink-0" />
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Contact streaks: connect across consecutive days to unlock 3d–365d badges.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  setAchievementsTab('contacts');
                  setAchievementsOpen(true);
                }}
                className="min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors tabular-nums"
              >
                <span>
                  Contact Streaks{topContactStatuses.length > 0 ? ` (${topContactStatuses.length})` : ''}
                </span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        );
      })()}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#08246B] dark:text-white">Calls</h1>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
              {activeMeta.description} · {formatEthiopianShort(new Date())} EC
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canSyncPhoneCalls && (
              <button
                type="button"
                disabled={syncingPhone}
                onClick={() => {
                  setSyncingPhone(true);
                  void syncPhoneCalls({ fullResync: true }).finally(() => setSyncingPhone(false));
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <RefreshCw
                  size={15}
                  className={syncingPhone ? 'animate-spin text-[#FF6A00]' : 'text-[#FF6A00]'}
                />
                {syncingPhone ? 'Syncing...' : 'Sync Phone'}
              </button>
            )}
            <button
              type="button"
              onClick={triggerCallImport}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Upload size={15} />
              Import
            </button>
          </div>
        </div>

        <CategoryTabs
          items={categories}
          activeKey={activeCategory}
          onChange={setActiveCategory}
          ariaLabel="Calls categories"
        />
      </div>

      <CategoryPanel activeKey={activeCategory} label={activeMeta.title}>
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-bold text-[#08246B] dark:text-white">
            {activeMeta.title}
          </h2>
        </div>
        {activeCategory === 'log' && (
          <div className="space-y-3.5">
            {/* Option B: Slim always-visible Search + Collapsible Filter Toggle */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A93A0] dark:text-[var(--dark-text-muted)] pointer-events-none"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, number, note or tag"
                    className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] dark:placeholder:text-[var(--dark-text-muted)] focus:outline-none focus:border-[#FF6A00] transition-colors"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-[#8A93A0] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {calls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tap');
                      setFiltersOpen((prev) => !prev);
                    }}
                    aria-expanded={filtersOpen}
                    aria-controls="calls-filter-drawer"
                    className={`min-h-[44px] px-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                      filtersOpen || activeFilterCount > 0
                        ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#FF6A00]'
                        : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]'
                    }`}
                  >
                    <ListFilter size={16} className="shrink-0" />
                    <span>Filter</span>
                    {activeFilterCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6A00] text-white text-[11px] font-mono font-bold tabular-nums flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Active Filter Summary Chips (1-tap clear even when drawer is closed) */}
              {calls.length > 0 && activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-0.5">
                  {dirFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setDirFilter('all')}
                      className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border border-[#FF6A00]/35 text-[11px] font-semibold text-[#FF6A00] flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>
                        {dirFilter === 'unreturned'
                          ? 'Unreturned'
                          : dirFilter.charAt(0).toUpperCase() + dirFilter.slice(1)}
                      </span>
                      <X size={12} />
                    </button>
                  )}
                  {simFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSimFilter('all')}
                      className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border border-[#FF6A00]/35 text-[11px] font-semibold text-[#FF6A00] flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>{formatSimDisplay(simFilter, simLabels)}</span>
                      <X size={12} />
                    </button>
                  )}
                  {tagFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setTagFilter('all')}
                      className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border border-[#FF6A00]/35 text-[11px] font-semibold text-[#FF6A00] flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>{tagFilter}</span>
                      <X size={12} />
                    </button>
                  )}
                  {sortBy !== 'newest' && (
                    <button
                      type="button"
                      onClick={() => setSortBy('newest')}
                      className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border border-[#FF6A00]/35 text-[11px] font-semibold text-[#FF6A00] flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>Longest first</span>
                      <X size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="min-h-[30px] px-2 py-1 text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00] whitespace-nowrap"
                  >
                    Clear all
                  </button>
                  <span className="ml-auto text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {visible.length} of {calls.length}
                  </span>
                </div>
              )}

              {/* Smooth Collapsible Filter Panel */}
              <AnimatePresence initial={false}>
                {calls.length > 0 && filtersOpen && (
                  <motion.div
                    id="calls-filter-drawer"
                    key="calls-filter-drawer"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto', y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
                    transition={{
                      duration: prefersReducedMotion ? 0.1 : 0.2,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-3">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          Call Type
                        </span>
                        <div className="grid grid-cols-5 items-center gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                          {(
                            [
                              { value: 'all', label: 'All' },
                              { value: 'incoming', label: 'In' },
                              { value: 'outgoing', label: 'Out' },
                              { value: 'missed', label: 'Missed' },
                              {
                                value: 'unreturned',
                                label:
                                  unreturnedIds.size > 0
                                    ? `Unret (${unreturnedIds.size})`
                                    : 'Unret',
                              },
                            ] as const
                          ).map((opt) => {
                            const active = dirFilter === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  triggerHaptic('tap');
                                  setDirFilter(opt.value);
                                }}
                                className={`min-h-[36px] px-1.5 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap truncate transition-colors ${
                                  active
                                    ? 'bg-[#FF6A00] text-white shadow-sm'
                                    : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <CustomSelect
                          value={simFilter}
                          options={[
                            { value: 'all', label: 'All SIMs' },
                            { value: 'SIM 1', label: formatSimDisplay('SIM 1', simLabels) },
                            { value: 'SIM 2', label: formatSimDisplay('SIM 2', simLabels) },
                          ]}
                          onChange={(v) => setSimFilter(v as 'all' | 'SIM 1' | 'SIM 2')}
                          ariaLabel="Filter by SIM"
                          activeHighlight={simFilter !== 'all'}
                          compact
                        />

                        {tagOptions.length > 0 && (
                          <CustomSelect
                            value={tagFilter}
                            options={tagOptions}
                            onChange={setTagFilter}
                            ariaLabel="Filter by tag"
                            activeHighlight={tagFilter !== 'all'}
                            compact
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            setSortBy((prev) => (prev === 'newest' ? 'longest' : 'newest'));
                          }}
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                            sortBy === 'longest'
                              ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#FF6A00]'
                              : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]'
                          }`}
                        >
                          <ArrowUpDown size={13} className="text-[#FF6A00] shrink-0" />
                          {sortBy === 'newest' ? 'Sort: Newest' : 'Sort: Longest'}
                        </button>

                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            {visible.length} / {calls.length}
                          </span>
                          {(activeFilterCount > 0 || query) && (
                            <button
                              type="button"
                              onClick={() => {
                                resetAllFilters();
                                setQuery('');
                              }}
                              className="min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/12 whitespace-nowrap"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!canSyncPhoneCalls && calls.length > 0 && !androidNoticeDismissed && (
              <div className="rounded-2xl bg-[#EEF2F6]/80 dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Smartphone size={16} className="text-[#FF6A00] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    <span className="font-semibold text-[#08246B] dark:text-white">
                      Android-only auto-sync:
                    </span>{' '}
                    Automatic call-log fetching works on Android only. Use CSV, JSON, or TXT import on Web and iOS.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={triggerCallImport}
                    className="min-h-[34px] px-3 rounded-lg bg-white dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] whitespace-nowrap"
                  >
                    Import File
                  </button>
                  <button
                    type="button"
                    onClick={() => setAndroidNoticeDismissed(true)}
                    aria-label="Dismiss Android sync notice"
                    className="min-h-[34px] min-w-[34px] rounded-lg text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-white/70 dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {calls.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-8 text-center space-y-4">
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h2 className="text-base font-semibold text-[#08246B] dark:text-white">
                    No call history yet
                  </h2>
                  <p className="text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {canSyncPhoneCalls
                      ? 'Tap Sync Phone to fetch all call logs from your device, or import a CSV, JSON, or TXT backup file.'
                      : 'Automatic call-log syncing works on Android. On Web and iOS, import a CSV, JSON, or TXT call file to get started.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {canSyncPhoneCalls ? (
                    <>
                      <button
                        type="button"
                        disabled={syncingPhone}
                        onClick={() => {
                          setSyncingPhone(true);
                          void syncPhoneCalls({ fullResync: true }).finally(() => setSyncingPhone(false));
                        }}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <RefreshCw size={14} className={syncingPhone ? 'animate-spin' : ''} />
                        {syncingPhone ? 'Syncing...' : 'Sync Phone'}
                      </button>
                      <button
                        type="button"
                        onClick={triggerCallImport}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Upload size={14} />
                        Import CSV / JSON / TXT
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={triggerCallImport}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Upload size={14} />
                      Import CSV / JSON / TXT
                    </button>
                  )}
                </div>
              </div>
            ) : sections.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-8 text-center space-y-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-[#08246B] dark:text-white">
                    No matches
                  </h2>
                  <p className="text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Nothing in your history matches the active search or filters.
                  </p>
                </div>
                {(activeFilterCount > 0 || query) && (
                  <button
                    type="button"
                    onClick={() => {
                      resetAllFilters();
                      setQuery('');
                    }}
                    className="min-h-[38px] px-4 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#FF6A00] hover:border-[#FF6A00]"
                  >
                    Clear search &amp; filters
                  </button>
                )}
              </div>
            ) : (
                <div className="space-y-5">
                {paginatedSections.map((section) => (
                  <section key={section.key} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        {section.title}
                      </h2>
                      <span className="text-[11px] font-mono tabular-nums text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                        {section.totalCalls}
                      </span>
                    </div>
                    <div className="rounded-3xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] overflow-hidden">
                      {section.clusters.map((cluster) => {
                        const call = cluster.primary;
                        const isGrouped = cluster.calls.length > 1;
                        const isExpanded = Boolean(expandedClusters[cluster.id]);
                        const contactProfile = contacts[getContactKey(call.number)];
                        const displayName = formatDisplayNameOrPhone(
                          call.name?.trim() || contactProfile?.name?.trim(),
                          call.number,
                          privacyMode,
                        );
                        const resolvedTag = resolveCallTag(call);
                        const shortTag = resolvedTag ? formatShortTag(resolvedTag) : '';
                        const compactSim = call.sim ? formatSimCompact(call.sim, simLabels) : '';
                        const hasUnreturned = cluster.calls.some((item) =>
                          unreturnedIds.has(item.id),
                        );
                        const hasNewCall = cluster.calls.some((item) =>
                          sessionNewCallIds.has(item.id),
                        );

                        return (
                          <div key={cluster.id}>
                            <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#EEF2F6]/60 dark:hover:bg-[var(--dark-elevated-60)] transition-colors">
                              <button
                                type="button"
                                onClick={() => onSelectContact(call.number)}
                                aria-label={`Open ${displayName} contact card`}
                                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 hover:ring-2 hover:ring-[#FF6A00] transition-all"
                                style={{ backgroundColor: avatarColor(call.number) }}
                              >
                                {initials(call.name || contactProfile?.name, call.number)}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (isGrouped) {
                                    triggerHaptic('tap');
                                    setExpandedClusters((prev) => ({
                                      ...prev,
                                      [cluster.id]: !prev[cluster.id],
                                    }));
                                  } else {
                                    markCallSeen(call.id);
                                    onSelectCall(call);
                                  }
                                }}
                                aria-expanded={isGrouped ? isExpanded : undefined}
                                className="flex-1 min-w-0 text-left space-y-1 py-0.5"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                                    {displayName}
                                  </span>
                                  {hasNewCall && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#FF6A00] text-white text-[10px] font-bold uppercase tracking-wider leading-none shrink-0">
                                      NEW
                                    </span>
                                  )}
                                  {shortTag && (
                                    <>
                                      <span
                                        aria-hidden="true"
                                        className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0"
                                      >
                                        ·
                                      </span>
                                      <span
                                        title={resolvedTag}
                                        className="inline-flex items-center gap-1 text-xs text-[#FF6A00] font-medium truncate max-w-[96px] shrink-0"
                                      >
                                        <Tag size={11} className="shrink-0" />
                                        <span className="truncate">{shortTag}</span>
                                      </span>
                                    </>
                                  )}
                                  {compactSim && (
                                    <>
                                      <span
                                        aria-hidden="true"
                                        className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0"
                                      >
                                        ·
                                      </span>
                                      <span className="text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] whitespace-nowrap shrink-0 tabular-nums">
                                        {compactSim}
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                                  <DirectionIcon direction={call.direction} />
                                  <span
                                    className={
                                      call.direction === 'missed'
                                        ? 'text-[#EF4444] dark:text-[#F28B82] font-medium'
                                        : 'font-medium text-[#08246B] dark:text-white'
                                    }
                                  >
                                    {formatCallStatus(call.direction)}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {cluster.totalDuration > 0
                                      ? formatDuration(cluster.totalDuration)
                                      : '0s'}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono text-[11px]">
                                    {formatTime(call.timestamp)}
                                  </span>
                                </div>
                              </button>

                              <div className="flex items-center gap-0.5 shrink-0">
                                {isGrouped && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('tap');
                                      setExpandedClusters((prev) => ({
                                        ...prev,
                                        [cluster.id]: !prev[cluster.id],
                                      }));
                                    }}
                                    aria-expanded={isExpanded}
                                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${cluster.calls.length} calls`}
                                    title={`${cluster.calls.length} consecutive calls`}
                                    className="min-h-[44px] px-2 rounded-xl flex items-center gap-1 text-xs font-mono font-bold tabular-nums text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 transition-colors whitespace-nowrap shrink-0"
                                  >
                                    <Layers size={14} className="shrink-0" />
                                    <span>({cluster.calls.length})</span>
                                    <ChevronDown
                                      size={13}
                                      className={`transition-transform duration-150 ${
                                        isExpanded ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                )}

                                {hasUnreturned && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      scheduleCall({
                                        number: call.number,
                                        name: call.name,
                                        scheduledFor:
                                          Date.now() + reminderPrefs.callbackDelayMinutes * 60_000,
                                        note: 'Return missed call',
                                        sourceCallId: call.id,
                                      })
                                    }
                                    aria-label={`Schedule ${delayLabel} callback for ${displayName}`}
                                    title={`Remind me to call back in ${delayLabel}`}
                                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 shrink-0 transition-colors"
                                  >
                                    <Clock size={16} />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onCallBack(call.number)}
                                  aria-label={`Call ${displayName}`}
                                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 shrink-0 transition-colors"
                                >
                                  <Phone size={17} />
                                </button>
                              </div>
                            </div>

                            {/* Expanded consecutive calls in group */}
                            <AnimatePresence initial={false}>
                              {isGrouped && isExpanded && (
                                <motion.div
                                  initial={
                                    prefersReducedMotion
                                      ? { opacity: 0 }
                                      : { opacity: 0, height: 0 }
                                  }
                                  animate={
                                    prefersReducedMotion
                                      ? { opacity: 1 }
                                      : { opacity: 1, height: 'auto' }
                                  }
                                  exit={
                                    prefersReducedMotion
                                      ? { opacity: 0 }
                                      : { opacity: 0, height: 0 }
                                  }
                                  transition={{
                                    duration: prefersReducedMotion ? 0.1 : 0.18,
                                    ease: [0.22, 1, 0.36, 1],
                                  }}
                                  className="overflow-hidden bg-[#F5F7FA]/80 dark:bg-[var(--dark-canvas)]/70 border-t border-[#DDE4EA]/70 dark:border-[var(--dark-border)]"
                                >
                                  <div className="divide-y divide-[#DDE4EA]/60 dark:divide-[var(--dark-border)]/70 pl-14 pr-4">
                                    {cluster.calls.map((subCall) => (
                                      <button
                                        key={subCall.id}
                                        type="button"
                                        onClick={() => {
                                          markCallSeen(subCall.id);
                                          onSelectCall(subCall);
                                        }}
                                        className="w-full min-h-[44px] py-2.5 flex items-center justify-between gap-2 text-left hover:text-[#FF6A00] transition-colors"
                                      >
                                        <div className="min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                                          <DirectionIcon direction={subCall.direction} />
                                          <span
                                            className={
                                              subCall.direction === 'missed'
                                                ? 'text-[#EF4444] dark:text-[#F28B82] font-medium'
                                                : 'font-medium text-[#08246B] dark:text-white'
                                            }
                                          >
                                            {formatCallStatus(subCall.direction)}
                                          </span>
                                          {sessionNewCallIds.has(subCall.id) && (
                                            <span className="px-1.5 py-0.5 rounded bg-[#FF6A00] text-white text-[9px] font-bold uppercase tracking-wider leading-none shrink-0">
                                              NEW
                                            </span>
                                          )}
                                          <span aria-hidden="true">·</span>
                                          <span>
                                            {subCall.duration > 0
                                              ? formatDuration(subCall.duration)
                                              : '0s'}
                                          </span>
                                          <span aria-hidden="true">·</span>
                                          <span className="font-mono text-[11px]">
                                            {formatTime(subCall.timestamp)}
                                          </span>
                                          {subCall.sim && (
                                            <>
                                              <span aria-hidden="true">·</span>
                                              <span>{formatSimCompact(subCall.sim, simLabels)}</span>
                                            </>
                                          )}
                                        </div>
                                        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0">
                                          Details
                                          <ChevronRight size={13} />
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}

                {totalClusterCount > 0 && (
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0.45, y: 12, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: false, amount: 0.25 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                    className="rounded-3xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-4 py-3.5 flex flex-wrap items-center justify-between gap-2.5 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex items-end gap-0.5 h-3.5 shrink-0" aria-hidden="true">
                        {[
                          [0.45, 1, 0.55, 0.45],
                          [0.85, 0.4, 1, 0.85],
                          [0.55, 0.9, 0.35, 0.55],
                        ].map((heights, idx) => (
                          <motion.span
                            key={idx}
                            className="w-1 h-full rounded-full bg-[#FF6A00] origin-bottom"
                            animate={
                              prefersReducedMotion ? { scaleY: 0.7 } : { scaleY: heights }
                            }
                            transition={
                              prefersReducedMotion
                                ? undefined
                                : {
                                    duration: 1.35,
                                    delay: idx * 0.16,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                  }
                            }
                          />
                        ))}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                        {totalClusterCount > CALLS_PAGE_SIZE
                          ? `Showing ${renderedClusterCount} of ${totalClusterCount} groups`
                          : `End of call log · ${totalClusterCount} group${totalClusterCount === 1 ? '' : 's'}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {visibleClusterLimit > CALLS_PAGE_SIZE && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            setVisibleClusterLimit(CALLS_PAGE_SIZE);
                          }}
                          className="min-h-[40px] px-3 py-1.5 rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white transition-colors"
                        >
                          Show less
                        </button>
                      )}
                      {renderedClusterCount < totalClusterCount && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('tap');
                              setVisibleClusterLimit((prev) => prev + CALLS_PAGE_SIZE);
                            }}
                            className="min-h-[40px] px-3.5 py-1.5 rounded-2xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white transition-colors"
                          >
                            Show more (+{Math.min(CALLS_PAGE_SIZE, totalClusterCount - renderedClusterCount)})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('tap');
                              setVisibleClusterLimit(totalClusterCount);
                            }}
                            className="min-h-[40px] px-3 py-1.5 rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] transition-colors"
                          >
                            Show all
                          </button>
                        </>
                      )}
                      {renderedClusterCount > 6 && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          aria-label="Scroll back to top"
                          className="min-h-[40px] px-3 py-1.5 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-xs font-semibold text-[#FF6A00] hover:bg-[#FF6A00] hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <ArrowUp size={13} />
                          Top
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'action' && (
          <div className="space-y-4">
            {showBudgetAlert && (
              <div
                className={`rounded-2xl bg-white dark:bg-[var(--dark-surface)] border p-4 flex flex-wrap items-center justify-between gap-3 ${
                  budgetPercent >= 100
                    ? 'border-[#EF4444]/50'
                    : 'border-[#F59E0B]/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      budgetPercent >= 100
                        ? 'bg-[#EF4444]/15 text-[#EF4444]'
                        : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                    }`}
                  >
                    <AlertTriangle size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                      {budgetPercent >= 100
                        ? `30-day airtime budget exceeded (${budgetPercent}%)`
                        : `Approaching 30-day airtime budget (${budgetPercent}%)`}
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                      {formatEtb(monthlySpendEtb)} of {formatEtb(tariffs.monthlyBudgetEtb)} used in the last 30 days
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenAnalytics}
                    className="min-h-[36px] px-3 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] whitespace-nowrap"
                  >
                    View Analytics
                  </button>
                  <button
                    type="button"
                    onClick={() => setBudgetAlertDismissed(true)}
                    aria-label="Dismiss budget warning"
                    className="min-h-[36px] min-w-[36px] rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {(upcomingEvents.length > 0 || upcomingHoliday) && (
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {upcomingEvents[0] && (
                    <button
                      type="button"
                      onClick={() => onSelectContact(upcomingEvents[0].number)}
                      className="flex items-center gap-1.5 font-semibold text-[#08246B] dark:text-white hover:text-[#FF6A00]"
                    >
                      <Cake size={14} className="text-[#FF6A00] shrink-0" />
                      <span>
                        {formatDisplayNameOrPhone(
                          upcomingEvents[0].name,
                          upcomingEvents[0].number,
                          privacyMode,
                        )}
                        &apos;s {upcomingEvents[0].title}{' '}
                        <span className="text-[#FF6A00]">
                          ({upcomingEvents[0].isToday ? 'Today!' : `in ${upcomingEvents[0].daysUntil}d`})
                        </span>
                      </span>
                    </button>
                  )}
                  {upcomingHoliday && (
                    <span className="flex items-center gap-1.5 text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      <Sparkles size={14} className="text-[#FF6A00] shrink-0" />
                      <span>
                        {upcomingHoliday.name} (
                        {upcomingHoliday.isToday ? 'Today' : `in ${upcomingHoliday.daysUntil}d`})
                      </span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onOpenReminders}
                  className="text-xs font-semibold text-[#FF6A00] hover:underline whitespace-nowrap shrink-0"
                >
                  Open Wishes &amp; Alerts
                </button>
              </div>
            )}

            {unreturnedList.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#FF6A00]/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-[#08246B] dark:text-white">
                    Unreturned missed calls ({unreturnedList.length})
                  </h2>
                  <span className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    VIP contacts prioritized first
                  </span>
                </div>

                <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)]">
                  {unreturnedList.map((missed) => {
                    const isVip =
                      favorites.has(missed.number) ||
                      favorites.has(getContactKey(missed.number));
                    const label = formatDisplayNameOrPhone(
                      missed.name,
                      missed.number,
                      privacyMode,
                    );
                    return (
                      <div
                        key={missed.id}
                        className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center shrink-0">
                            <PhoneMissed size={15} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                              {isVip && (
                                <span className="inline-flex items-center gap-1 mr-1.5 text-[#FF6A00] font-bold">
                                  <Star size={11} className="fill-[#FF6A00]" />
                                  VIP
                                </span>
                              )}
                              {label}
                            </p>
                            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                              Missed {formatTime(missed.timestamp)} · {formatEthiopianShort(missed.timestamp)} EC
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              scheduleCall({
                                number: missed.number,
                                name: missed.name,
                                scheduledFor:
                                  Date.now() + reminderPrefs.callbackDelayMinutes * 60_000,
                                note: 'Return missed call',
                                sourceCallId: missed.id,
                              })
                            }
                            className="min-h-[34px] px-2.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                          >
                            Remind {delayLabel}
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
                            className="min-h-[34px] px-2.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                          >
                            1h
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissMissedCall(missed.id)}
                            aria-label="Dismiss missed call reminder"
                            className="min-h-[34px] min-w-[34px] rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] flex items-center justify-center"
                          >
                            <X size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onCallBack(missed.number)}
                            className="min-h-[34px] px-3 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1"
                          >
                            <Phone size={12} />
                            Call back
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pendingScheduled.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-[#08246B] dark:text-white">
                    Pending scheduled calls ({pendingScheduled.length})
                  </h2>
                  <button
                    type="button"
                    onClick={onOpenReminders}
                    className="text-xs font-semibold text-[#FF6A00] hover:underline"
                  >
                    Manage all
                  </button>
                </div>

                <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)]">
                  {pendingScheduled.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                          <Clock size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                            {formatDisplayNameOrPhone(item.name, item.number, privacyMode)}
                          </p>
                          <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                            <span className="font-semibold text-[#FF6A00]">
                              {formatScheduledCountdown(item.scheduledFor)}
                            </span>{' '}
                            · {formatScheduledLabel(item)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => snoozeScheduledCall(item.id, 15)}
                          className="min-h-[34px] px-2.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white"
                        >
                          +15m
                        </button>
                        <button
                          type="button"
                          onClick={() => completeScheduledCall(item.id)}
                          className="min-h-[34px] px-2.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white flex items-center gap-1"
                        >
                          <Check size={12} />
                          Done
                        </button>
                        <button
                          type="button"
                          onClick={() => onCallBack(item.number)}
                          className="min-h-[34px] px-3 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Phone size={12} />
                          Call
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {actionNeededCount === 0 && (
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-8 text-center space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mx-auto">
                  <Check size={20} />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h2 className="text-base font-semibold text-[#08246B] dark:text-white">
                    All caught up
                  </h2>
                  <p className="text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    No unreturned missed calls, overdue schedules, or airtime budget alerts right now.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickScheduleOpen(true)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap"
                >
                  Schedule New Call
                </button>
              </div>
            )}
          </div>
        )}

        {activeCategory === 'vip' && (
          <div className="space-y-4">
            {vipContactsList.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-8 text-center space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center mx-auto">
                  <Star size={20} />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h2 className="text-base font-semibold text-[#08246B] dark:text-white">
                    No VIP favourites yet
                  </h2>
                  <p className="text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Tap the star icon inside any call or contact profile to pin VIP numbers here and prioritize their missed call alerts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCategory('log')}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap"
                >
                  Browse Call Log
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] overflow-hidden">
                {vipContactsList.map((vip) => {
                  const displayName = formatDisplayNameOrPhone(
                    vip.name,
                    vip.number,
                    privacyMode,
                  );
                  const shortVipTag = vip.tag ? formatShortTag(vip.tag) : '';
                  return (
                    <div
                      key={vip.key}
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[var(--dark-surface)] hover:bg-[#EEF2F6]/60 dark:hover:bg-[var(--dark-elevated-60)] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectContact(vip.number)}
                        className="flex items-center gap-3 min-w-0 text-left flex-1"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: avatarColor(vip.number) }}
                        >
                          {initials(vip.name || null, vip.number)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                              {displayName}
                            </span>
                            {shortVipTag && (
                              <span
                                title={vip.tag}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#FF6A00] shrink-0"
                              >
                                <Tag size={11} className="shrink-0" />
                                {shortVipTag}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                            {maskPhoneNumber(vip.number, privacyMode)}
                            {vip.lastTimestamp > 0
                              ? ` · Last ${formatTime(vip.lastTimestamp)}`
                              : ''}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectContact(vip.number)}
                          className="min-h-[38px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1"
                        >
                          <User size={13} className="text-[#FF6A00]" />
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(vip.rawFavorite)}
                          aria-label={`Remove ${displayName} from VIP`}
                          className="min-h-[38px] min-w-[38px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-center text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15"
                        >
                          <Star size={15} className="fill-[#FF6A00]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCallBack(vip.number)}
                          aria-label={`Call ${displayName}`}
                          className="min-h-[38px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold flex items-center gap-1"
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

        {activeCategory === 'tools' && (
          <div className="space-y-4">
            {/* Quick Shortcuts & Hotlines */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  setQuickScheduleOpen(true);
                }}
                className="min-h-[48px] px-3.5 py-3 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] flex items-center gap-2.5 text-left transition-colors"
              >
                <span className="w-8 h-8 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Clock size={16} />
                </span>
                <span className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                  Schedule Call
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  openUssdModal('all');
                }}
                className="min-h-[48px] px-3.5 py-3 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] flex items-center gap-2.5 text-left transition-colors"
              >
                <span className="w-8 h-8 rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center shrink-0">
                  <Hash size={16} />
                </span>
                <span className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                  Carrier USSD
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  openUssdModal('emergency');
                }}
                className="min-h-[48px] px-3.5 py-3 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#EF4444] flex items-center gap-2.5 text-left transition-colors"
              >
                <span className="w-8 h-8 rounded-xl bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center shrink-0">
                  <ShieldAlert size={16} />
                </span>
                <span className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                  Emergency Hotlines
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  triggerCallImport();
                }}
                className="min-h-[48px] px-3.5 py-3 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] flex items-center gap-2.5 text-left transition-colors"
              >
                <span className="w-8 h-8 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
                  <Upload size={16} />
                </span>
                <span className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                  Import CSV/JSON/TXT
                </span>
              </button>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#EF4444]/12 text-[#EF4444] flex items-center justify-center shrink-0">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                      Ethiopian Emergency Hotlines
                    </h2>
                    <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      One-tap dial for police, fire emergency, ambulance, and public utilities
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openUssdModal('emergency')}
                  className="text-xs font-semibold text-[#FF6A00] hover:underline whitespace-nowrap"
                >
                  Open full directory
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {ETHIOPIAN_EMERGENCY_HOTLINES.map((hotline) => {
                  const isUrgent = hotline.category !== 'utility';
                  return (
                    <a
                      key={hotline.id}
                      href={toDialableUssdHref(hotline.number)}
                      onClick={() =>
                        showNotice(`Opening dialer for ${hotline.label} (${hotline.number})...`)
                      }
                      className="min-h-[56px] px-3 py-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/70 dark:bg-[var(--dark-canvas)] hover:border-[#EF4444] flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isUrgent
                              ? 'bg-[#EF4444]/12 text-[#EF4444]'
                              : 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00]'
                          }`}
                        >
                          {hotline.id === 'fire' ? (
                            <Flame size={14} />
                          ) : hotline.category === 'medical' ? (
                            <HeartPulse size={14} />
                          ) : hotline.category === 'utility' ? (
                            <Wrench size={14} />
                          ) : (
                            <ShieldAlert size={14} />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                            {hotline.label}
                          </p>
                          <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                            {hotline.amharicLabel}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-mono font-bold tabular-nums shrink-0 ${
                          isUrgent ? 'text-[#EF4444]' : 'text-[#FF6A00]'
                        }`}
                      >
                        {hotline.number}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CategoryPanel>

      <AnimatePresence>
        {quickActionsOpen && (
          <motion.div
            key="quick-actions-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
            className="fixed inset-0 z-30 bg-black/25 dark:bg-black/45 touch-none overscroll-contain"
            aria-hidden="true"
            onClick={() => setQuickActionsOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6 z-40 flex flex-col items-end gap-2.5">
        <AnimatePresence>
          {quickActionsOpen && (
            <motion.div
              key="quick-actions-menu"
              role="menu"
              aria-label="Quick actions"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="w-60 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-xl p-1.5 space-y-1 origin-bottom-right"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setQuickActionsOpen(false);
                  setQuickScheduleOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Clock size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">Schedule New Call</span>
                  <span className="block text-[11px] font-normal text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    Set a callback reminder
                  </span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setQuickActionsOpen(false);
                  onOpenAnalytics();
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-[#4FA3F7]/15 text-[#4FA3F7] flex items-center justify-center shrink-0">
                  <TrendingUp size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">View Analytics</span>
                  <span className="block text-[11px] font-normal text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    Call stats &amp; trends
                  </span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setQuickActionsOpen(false);
                  onOpenReminders();
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center shrink-0">
                  <Sparkles size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">Wishes &amp; Alerts</span>
                  <span className="block text-[11px] font-normal text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    Holidays &amp; follow-ups
                  </span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setQuickActionsOpen(false);
                  openUssdModal('emergency');
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center shrink-0">
                  <ShieldAlert size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">Emergency Hotlines</span>
                  <span className="block text-[11px] font-normal text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    991 Police · 939 Fire · 907 Ambulance
                  </span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setQuickActionsOpen(false);
                  openUssdModal('all');
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center shrink-0">
                  <Hash size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">Carrier USSD</span>
                  <span className="block text-[11px] font-normal text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    ETC &amp; SFC codes
                  </span>
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => {
            triggerHaptic('tap');
            setIsScrolling(false);
            setQuickActionsOpen((prev) => !prev);
          }}
          onMouseEnter={() => setIsScrolling(false)}
          onFocus={() => setIsScrolling(false)}
          animate={
            isScrolling && !quickActionsOpen
              ? prefersReducedMotion
                ? { opacity: 0.35 }
                : { opacity: 0.3, scale: 0.88, y: 6 }
              : { opacity: 1, scale: 1, y: 0 }
          }
          transition={{
            duration: prefersReducedMotion ? 0.12 : 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
          aria-expanded={quickActionsOpen}
          aria-haspopup="menu"
          aria-label={quickActionsOpen ? 'Close Quick Actions' : 'Open Quick Actions'}
          title="Quick Actions"
          className="w-12 h-12 rounded-full bg-[#FF6A00] hover:bg-[#E65F00] text-white shadow-lg shadow-[#FF6A00]/25 flex items-center justify-center transition-colors"
        >
          {quickActionsOpen ? <X size={18} /> : <Zap size={18} />}
        </motion.button>
      </div>

      <QuickScheduleModal
        contact={null}
        open={quickScheduleOpen}
        onClose={() => setQuickScheduleOpen(false)}
      />
      <CarrierUssdModal
        open={ussdOpen}
        onClose={() => setUssdOpen(false)}
        initialCategory={ussdInitialCategory}
      />
      <ImportPreviewModal
        pending={pendingImport}
        onClose={() => setPendingImport(null)}
        onConfirm={handleConfirmImport}
      />
      <AchievementsModal
        open={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        initialTab={achievementsTab}
        onSelectContact={onSelectContact}
      />
    </div>
  );
});
