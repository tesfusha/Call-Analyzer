import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bell,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Upload,
  Voicemail,
  X,
} from 'lucide-react';
import { ContactAvatar } from '@/src/components/ContactAvatar';
import { ImportPreviewModal, type PendingImportState } from '@/src/components/ImportPreviewModal';
import { hasNativeCallLogSyncPlugin } from '@/src/lib/capacitor';
import { readUploadedTextFile } from '@/src/lib/contacts';
import {
  dayKey,
  dayLabel,
  formatDuration,
  formatTime,
} from '@/src/lib/format';
import { buildImportPreview, parseBackupImport } from '@/src/lib/import';
import { unreturnedMissedCalls } from '@/src/lib/reminders';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { totalSpendEtb } from '@/src/lib/stats';
import { useCalls } from '@/src/store/CallsContext';
import type { CallDirection, CallRecord } from '@/src/types/call';

type QuickFilter = 'all' | 'missed' | 'vip' | 'outgoing';
type SimChoice = 'all' | 'SIM 1' | 'SIM 2';
type DirectionChoice = 'all' | CallDirection;
type SortChoice = 'newest' | 'longest';

const PLURAL_RULES = new Intl.PluralRules('en-US');

function pluralize(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString()} ${PLURAL_RULES.select(count) === 'one' ? singular : plural}`;
}

/**
 * UI Cheatsheet rule: Switch from relative time to an absolute date after 7 days
 * so timestamps never read "340 days ago".
 */
function formatCraftTimestamp(timestamp: number, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - timestamp);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return `Yesterday, ${formatTime(timestamp)}`;
  if (diffDays < 7) return `${diffDays}d ago`;
  const d = new Date(timestamp);
  const sameYear = d.getFullYear() === new Date(nowMs).getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function DirectionIcon({ direction }: { direction: CallDirection }) {
  if (direction === 'incoming') {
    return <PhoneIncoming size={13} className="text-[#2563EB] dark:text-[#60A5FA] shrink-0" />;
  }
  if (direction === 'outgoing') {
    return <PhoneOutgoing size={13} className="text-[#E45A0D] dark:text-[#F4762C] shrink-0" />;
  }
  if (direction === 'missed') {
    return <PhoneMissed size={13} className="text-[#DC2626] dark:text-[#F87171] shrink-0" />;
  }
  if (direction === 'voicemail') {
    return <Voicemail size={13} className="text-[#7C3AED] dark:text-[#A78BFA] shrink-0" />;
  }
  return <PhoneOff size={13} className="text-[#6B7280] dark:text-[#9CA3AF] shrink-0" />;
}

function directionLabel(direction: CallDirection): string {
  if (direction === 'incoming') return 'Incoming';
  if (direction === 'outgoing') return 'Outgoing';
  if (direction === 'missed') return 'Missed';
  if (direction === 'rejected') return 'Declined';
  if (direction === 'blocked') return 'Blocked';
  return 'Voicemail';
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SPRING_CONTROL = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.8 };

export function CallsCraftV110({
  onSelectCall,
  onSelectContact,
  onCallBack,
  onOpenReminders,
}: {
  onSelectCall: (call: CallRecord) => void;
  onSelectContact: (number: string) => void;
  onCallBack: (number: string) => void;
  onOpenReminders: () => void;
}) {
  const {
    calls,
    contacts,
    availableTags,
    scheduledCalls,
    favorites,
    dismissedMissedIds,
    simLabels,
    tariffs,
    authUser,
    openAuthPrompt,
    syncPhoneCalls,
    importBackupPackage,
    showNotice,
  } = useCalls();

  const prefersReducedMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [simFilter, setSimFilter] = useState<SimChoice>('all');
  const [directionFilter, setDirectionFilter] = useState<DirectionChoice>('all');
  const [sortBy, setSortBy] = useState<SortChoice>('newest');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(60);
  const [syncing, setSyncing] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImportState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isNativeAndroid = hasNativeCallLogSyncPlugin();
  const nowMs = Date.now();

  // Keyboard shortcut `/` focuses search immediately (zero animation on keyboard action)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key === 'Escape' && filterSheetOpen) {
        setFilterSheetOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filterSheetOpen]);

  const unreturnedMissed = useMemo(
    () => unreturnedMissedCalls(calls, dismissedMissedIds),
    [calls, dismissedMissedIds],
  );

  // Compact top telemetry strip: Today's calls, talk time, missed queue, estimated ETB
  const todayStats = useMemo(() => {
    const today = dayKey(nowMs);
    let todayCount = 0;
    let totalDurationSec = 0;
    for (const call of calls) {
      if (dayKey(call.timestamp) === today) {
        todayCount += 1;
      }
      totalDurationSec += call.duration;
    }
    return {
      todayCount,
      totalDurationSec,
      estSpendEtb: totalSpendEtb(calls, tariffs),
    };
  }, [calls, nowMs, tariffs]);

  const activeAdvancedCount =
    (simFilter !== 'all' ? 1 : 0) +
    (directionFilter !== 'all' ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0);

  const filteredCalls = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = calls.filter((call) => {
      if (quickFilter === 'missed' && call.direction !== 'missed') return false;
      if (quickFilter === 'vip' && !favorites.has(call.number)) return false;
      if (quickFilter === 'outgoing' && call.direction !== 'outgoing') return false;
      if (simFilter !== 'all' && call.sim !== simFilter) return false;
      if (directionFilter !== 'all' && call.direction !== directionFilter) return false;
      if (q) {
        const hay = `${call.name ?? ''} ${call.number} ${call.note ?? ''} ${call.tag ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'longest') {
      return [...list].sort((a, b) => b.duration - a.duration || b.timestamp - a.timestamp);
    }
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [calls, query, quickFilter, simFilter, directionFilter, sortBy, favorites]);

  const grouped = useMemo(() => {
    const slice = filteredCalls.slice(0, visibleCount);
    if (sortBy === 'longest') {
      return slice.length > 0 ? [{ key: 'longest', label: 'Longest duration', items: slice }] : [];
    }
    const buckets: Array<{ key: string; label: string; items: CallRecord[] }> = [];
    const indexByKey = new Map<string, number>();
    for (const call of slice) {
      const k = dayKey(call.timestamp);
      const idx = indexByKey.get(k);
      if (idx === undefined) {
        indexByKey.set(k, buckets.length);
        buckets.push({ key: k, label: dayLabel(call.timestamp), items: [call] });
      } else {
        buckets[idx].items.push(call);
      }
    }
    return buckets;
  }, [filteredCalls, visibleCount, sortBy]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncPhoneCalls({ fullResync: false });
    } finally {
      setSyncing(false);
    }
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    if (!authUser) {
      openAuthPrompt('signin', 'Sign in to import your call history.');
      return;
    }
    try {
      const text = await readUploadedTextFile(file);
      const parsed = parseBackupImport(text, file.name);
      if (parsed.calls.length === 0 && parsed.contacts.length === 0) {
        showNotice('No valid calls found in that file.');
        return;
      }
      const preview = buildImportPreview(file.name, parsed, {
        calls,
        contacts,
        availableTags,
        scheduledCalls,
      });
      setPendingImport({ pkg: parsed, preview });
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not read that file.', 'warning');
    }
  };

  const resetAllFilters = () => {
    setQuery('');
    setQuickFilter('all');
    setSimFilter('all');
    setDirectionFilter('all');
    setSortBy('newest');
  };

  const quickTabs: Array<{ id: QuickFilter; label: string; count?: number }> = [
    { id: 'all', label: 'All' },
    { id: 'missed', label: 'Missed', count: unreturnedMissed.length > 0 ? unreturnedMissed.length : undefined },
    { id: 'vip', label: 'VIP' },
    { id: 'outgoing', label: 'Outgoing' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Row — tight display tracking, single primary action */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h1 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.025em] text-[#111214] dark:text-[#F5F6F8] leading-tight">
            Calls
          </h1>
          <p className="text-[13px] text-[#5C616B] dark:text-[#969CA6] tabular-nums">
            {pluralize(filteredCalls.length, 'call', 'calls')}
            {filteredCalls.length !== calls.length ? ` of ${calls.length.toLocaleString()}` : ''}
            {unreturnedMissed.length > 0 ? ` · ${unreturnedMissed.length} unreturned` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isNativeAndroid ? (
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="v110-press min-h-[44px] px-4 rounded-[12px] bg-[#111214] dark:bg-[#F5F6F8] text-white dark:text-[#111214] text-[13px] font-semibold inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing…' : 'Sync'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="v110-press min-h-[44px] px-4 rounded-[12px] bg-[#111214] dark:bg-[#F5F6F8] text-white dark:text-[#111214] text-[13px] font-semibold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Upload size={14} />
              <span>Import</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void handleFileSelected(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Hairline Precision Summary Strip (single elevation, tabular figures, zero pill clutter) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 rounded-[16px] bg-white dark:bg-[#121316] border border-black/[0.07] dark:border-white/[0.08] divide-y sm:divide-y-0 sm:divide-x divide-black/[0.06] dark:divide-white/[0.07] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-4 py-3.5">
          <p className="text-[11px] font-medium text-[#6B7280] dark:text-[#8E95A0]">Today</p>
          <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-[#111214] dark:text-[#F5F6F8]">
            {todayStats.todayCount.toLocaleString()}
          </p>
        </div>
        <div className="px-4 py-3.5 border-l sm:border-l-0 border-black/[0.06] dark:border-white/[0.07]">
          <p className="text-[11px] font-medium text-[#6B7280] dark:text-[#8E95A0]">Talk time</p>
          <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-[#111214] dark:text-[#F5F6F8]">
            {formatDuration(todayStats.totalDurationSec)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setQuickFilter(quickFilter === 'missed' ? 'all' : 'missed')}
          className="v110-press px-4 py-3.5 text-left transition-colors v110-hover-subtle"
        >
          <p className="text-[11px] font-medium text-[#6B7280] dark:text-[#8E95A0]">
            Unreturned
          </p>
          <p
            className={`mt-1 text-[20px] font-semibold tracking-[-0.02em] tabular-nums ${
              unreturnedMissed.length > 0
                ? 'text-[#E45A0D] dark:text-[#F4762C]'
                : 'text-[#111214] dark:text-[#F5F6F8]'
            }`}
          >
            {unreturnedMissed.length.toLocaleString()}
          </p>
        </button>
        <div className="px-4 py-3.5 border-l sm:border-l-0 border-black/[0.06] dark:border-white/[0.07]">
          <p className="text-[11px] font-medium text-[#6B7280] dark:text-[#8E95A0]">Est. spend</p>
          <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-[#111214] dark:text-[#F5F6F8]">
            {todayStats.estSpendEtb.toFixed(0)}{' '}
            <span className="text-[12px] font-medium text-[#6B7280] dark:text-[#8E95A0]">ETB</span>
          </p>
        </div>
      </div>

      {/* Quiet Callback Queue Alert (only when unreturned missed calls exist) */}
      <AnimatePresence initial={false}>
        {unreturnedMissed.length > 0 && quickFilter !== 'missed' && (
          <motion.div
            key="unreturned-bar"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="rounded-[14px] bg-white dark:bg-[#121316] border border-[#E45A0D]/25 dark:border-[#F4762C]/30 px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111214] dark:text-[#F5F6F8] truncate">
                {pluralize(unreturnedMissed.length, 'missed call', 'missed calls')} waiting
              </p>
              <p className="text-[12px] text-[#5C616B] dark:text-[#969CA6] truncate">
                Latest: {formatDisplayNameOrPhone(unreturnedMissed[0].name, unreturnedMissed[0].number)} ·{' '}
                {formatCraftTimestamp(unreturnedMissed[0].timestamp, nowMs)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setQuickFilter('missed')}
                className="v110-press min-h-[38px] px-3 rounded-[10px] bg-[#E45A0D] text-white text-[12px] font-semibold whitespace-nowrap"
              >
                Review
              </button>
              <button
                type="button"
                onClick={onOpenReminders}
                aria-label="Open reminders"
                className="v110-press w-[38px] h-[38px] rounded-[10px] border border-black/[0.08] dark:border-white/[0.1] text-[#5C616B] dark:text-[#969CA6] flex items-center justify-center"
              >
                <Bell size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + Spring-Gliding Segmented Filter + Filter Sheet Trigger */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A909B]"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, number, note, or tag…"
              aria-label="Search calls"
              className="w-full h-[44px] pl-10 pr-10 rounded-[12px] bg-white dark:bg-[#121316] border border-black/[0.08] dark:border-white/[0.09] text-[16px] sm:text-[14px] text-[#111214] dark:text-[#F5F6F8] placeholder:text-[#8A909B] outline-none focus:border-[#E45A0D] dark:focus:border-[#F4762C] transition-colors"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="v110-press absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[8px] text-[#6B7280] flex items-center justify-center"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-[5px] border border-black/[0.08] dark:border-white/[0.1] text-[10px] font-mono text-[#8A909B]">
                /
              </kbd>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-label="Filter calls"
            className={`v110-press min-h-[44px] px-3.5 rounded-[12px] border text-[13px] font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              activeAdvancedCount > 0
                ? 'border-[#E45A0D] bg-[#E45A0D]/[0.08] text-[#E45A0D] dark:text-[#F4762C]'
                : 'border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#121316] text-[#111214] dark:text-[#F5F6F8]'
            }`}
          >
            <SlidersHorizontal size={15} />
            <span className="hidden sm:inline">Filters</span>
            {activeAdvancedCount > 0 && (
              <span className="font-mono text-[11px] font-semibold tabular-nums">
                {activeAdvancedCount}
              </span>
            )}
          </button>
        </div>

        {/* Concentric radius segmented control: outer 14px, padding 4px -> inner 10px */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div
            role="tablist"
            aria-label="Quick call filters"
            className="inline-flex flex-wrap items-center gap-0.5 p-1 rounded-[14px] bg-black/[0.045] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.05] max-w-full"
          >
            {quickTabs.map((tab) => {
              const active = quickFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setQuickFilter(tab.id)}
                  className={`relative min-h-[36px] px-3.5 rounded-[10px] text-[13px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-[#111214] dark:text-[#F5F6F8]'
                      : 'text-[#5C616B] dark:text-[#969CA6] v110-hover-ink'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="v110-calls-filter-thumb"
                      transition={prefersReducedMotion ? { duration: 0.1 } : SPRING_CONTROL}
                      className="absolute inset-0 rounded-[10px] bg-white dark:bg-[#1E2026] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.08)]"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="font-mono text-[11px] font-semibold tabular-nums text-[#E45A0D] dark:text-[#F4762C]">
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {(activeAdvancedCount > 0 || query || quickFilter !== 'all') && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="v110-press min-h-[36px] px-2.5 rounded-[8px] text-[12px] font-medium text-[#5C616B] dark:text-[#969CA6] v110-hover-ink"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Grouped Call Feed — Hairline Dividers, Zero Card-Within-Card Nesting */}
      {grouped.length === 0 ? (
        <div className="rounded-[16px] bg-white dark:bg-[#121316] border border-black/[0.07] dark:border-white/[0.08] px-6 py-12 text-center space-y-3">
          <p className="text-[15px] font-semibold text-[#111214] dark:text-[#F5F6F8]">
            No calls match these filters
          </p>
          <p className="text-[13px] text-[#5C616B] dark:text-[#969CA6] max-w-[40ch] mx-auto">
            Try clearing your search or switching back to all calls.
          </p>
          <button
            type="button"
            onClick={resetAllFilters}
            className="v110-press min-h-[40px] px-4 rounded-[10px] bg-[#111214] dark:bg-[#F5F6F8] text-white dark:text-[#111214] text-[13px] font-semibold"
          >
            Show all calls
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.key} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[#5C616B] dark:text-[#8E95A0]">
                  {group.label}
                </h2>
                <span className="text-[11px] font-mono tabular-nums text-[#8A909B]">
                  {pluralize(group.items.length, 'call', 'calls')}
                </span>
              </div>

              <div className="rounded-[16px] bg-white dark:bg-[#121316] border border-black/[0.07] dark:border-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] divide-y divide-black/[0.055] dark:divide-white/[0.06] overflow-hidden">
                {group.items.map((call, index) => {
                  const display = formatDisplayNameOrPhone(call.name, call.number);
                  const isVip = favorites.has(call.number);
                  const simText =
                    call.sim === 'SIM 2'
                      ? simLabels.sim2Label || 'SIM 2'
                      : simLabels.sim1Label || 'SIM 1';
                  const rowDelay = prefersReducedMotion || index > 6 ? 0 : index * 0.022;

                  return (
                    <motion.div
                      key={call.id}
                      initial={prefersReducedMotion || index > 6 ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: rowDelay, ease: EASE_OUT }}
                      className="flex items-center gap-3 px-3.5 sm:px-4 min-h-[66px] py-2.5 transition-colors v110-hover-subtle"
                    >
                      {/* Non-squishing circular avatar (flex-shrink: 0) */}
                      <button
                        type="button"
                        onClick={() => onSelectContact(call.number)}
                        aria-label={`Open contact ${display}`}
                        className="v110-press rounded-full shrink-0"
                      >
                        <ContactAvatar name={call.name} number={call.number} colorKey={display} size="md" />
                      </button>

                      {/* Primary Call Content — clickable full-row detail trigger */}
                      <button
                        type="button"
                        onClick={() => onSelectCall(call)}
                        className="flex-1 min-w-0 text-left py-0.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[14px] font-semibold text-[#111214] dark:text-[#F5F6F8] truncate">
                            {display}
                            {isVip ? ' ★' : ''}
                          </span>
                          <span className="text-[12px] font-mono tabular-nums text-[#6B7280] dark:text-[#8E95A0] whitespace-nowrap shrink-0">
                            {formatCraftTimestamp(call.timestamp, nowMs)}
                          </span>
                        </div>

                        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#5C616B] dark:text-[#969CA6] min-w-0">
                          <DirectionIcon direction={call.direction} />
                          <span className="truncate">
                            {directionLabel(call.direction)}
                            {call.duration > 0 ? ` · ${formatDuration(call.duration)}` : ''}
                            {` · ${simText}`}
                            {call.tag ? ` · ${call.tag}` : ''}
                          </span>
                        </div>
                      </button>

                      {/* 44x44px tactile callback trigger */}
                      <button
                        type="button"
                        onClick={() => onCallBack(call.number)}
                        aria-label={`Call ${display}`}
                        className="v110-press w-11 h-11 rounded-[12px] shrink-0 text-[#5C616B] dark:text-[#969CA6] v110-hover-ink v110-hover-subtle flex items-center justify-center"
                      >
                        <Phone size={16} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}

          {filteredCalls.length > visibleCount && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + 60)}
                className="v110-press min-h-[44px] px-5 rounded-[12px] bg-white dark:bg-[#121316] border border-black/[0.08] dark:border-white/[0.09] text-[13px] font-semibold text-[#111214] dark:text-[#F5F6F8] tabular-nums"
              >
                Load more ({(filteredCalls.length - visibleCount).toLocaleString()} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Vaul-inspired Tactile Bottom Sheet for Advanced Filters */}
      <AnimatePresence>
        {filterSheetOpen && (
          <motion.div
            key="v110-filter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            onClick={() => setFilterSheetOpen(false)}
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px] flex items-end sm:items-center justify-center sm:p-4"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Filter calls"
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 28, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 20, scale: 0.98 }
              }
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md rounded-t-[24px] sm:rounded-[20px] bg-white dark:bg-[#15171C] border-t sm:border border-black/[0.08] dark:border-white/[0.1] shadow-2xl px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 max-h-[85dvh] overflow-y-auto overscroll-contain space-y-5"
            >
              <div className="sm:hidden w-9 h-1 rounded-full bg-black/[0.15] dark:bg-white/[0.18] mx-auto" />

              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-[#111214] dark:text-[#F5F6F8]">
                  Filter &amp; sort
                </h2>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  aria-label="Close filters"
                  className="v110-press w-9 h-9 rounded-[10px] text-[#5C616B] dark:text-[#969CA6] v110-hover-subtle flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>

              {/* SIM filter */}
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[#5C616B] dark:text-[#969CA6]">SIM line</p>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-[14px] bg-black/[0.045] dark:bg-white/[0.06]">
                  {(['all', 'SIM 1', 'SIM 2'] as const).map((sim) => {
                    const active = simFilter === sim;
                    const label =
                      sim === 'all'
                        ? 'Both SIMs'
                        : sim === 'SIM 1'
                          ? simLabels.sim1Label || 'SIM 1'
                          : simLabels.sim2Label || 'SIM 2';
                    return (
                      <button
                        key={sim}
                        type="button"
                        onClick={() => setSimFilter(sim)}
                        className={`v110-press min-h-[38px] px-2 rounded-[10px] text-[12px] font-semibold truncate transition-colors ${
                          active
                            ? 'bg-white dark:bg-[#22252C] text-[#111214] dark:text-[#F5F6F8] shadow-xs'
                            : 'text-[#5C616B] dark:text-[#969CA6]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direction filter */}
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[#5C616B] dark:text-[#969CA6]">
                  Direction
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['all', 'Any'],
                      ['incoming', 'Incoming'],
                      ['outgoing', 'Outgoing'],
                      ['missed', 'Missed'],
                      ['rejected', 'Declined'],
                      ['blocked', 'Blocked'],
                    ] as const
                  ).map(([value, label]) => {
                    const active = directionFilter === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDirectionFilter(value)}
                        className={`v110-press min-h-[40px] px-2.5 rounded-[10px] border text-[12px] font-medium transition-colors ${
                          active
                            ? 'border-[#E45A0D] bg-[#E45A0D]/[0.09] text-[#E45A0D] dark:text-[#F4762C]'
                            : 'border-black/[0.08] dark:border-white/[0.09] text-[#111214] dark:text-[#F5F6F8]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort order */}
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[#5C616B] dark:text-[#969CA6]">Sort by</p>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[14px] bg-black/[0.045] dark:bg-white/[0.06]">
                  {(
                    [
                      ['newest', 'Most recent'],
                      ['longest', 'Longest call'],
                    ] as const
                  ).map(([value, label]) => {
                    const active = sortBy === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSortBy(value)}
                        className={`v110-press min-h-[38px] px-3 rounded-[10px] text-[12px] font-semibold transition-colors ${
                          active
                            ? 'bg-white dark:bg-[#22252C] text-[#111214] dark:text-[#F5F6F8] shadow-xs'
                            : 'text-[#5C616B] dark:text-[#969CA6]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSimFilter('all');
                    setDirectionFilter('all');
                    setSortBy('newest');
                  }}
                  className="v110-press flex-1 min-h-[44px] rounded-[12px] border border-black/[0.09] dark:border-white/[0.1] text-[13px] font-semibold text-[#111214] dark:text-[#F5F6F8]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  className="v110-press flex-1 min-h-[44px] rounded-[12px] bg-[#111214] dark:bg-[#F5F6F8] text-white dark:text-[#111214] text-[13px] font-semibold"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Preview Modal */}
      {pendingImport && (
        <ImportPreviewModal
          pending={pendingImport}
          onClose={() => setPendingImport(null)}
          onConfirm={() => {
            importBackupPackage(pendingImport.pkg);
            setPendingImport(null);
          }}
        />
      )}
    </div>
  );
}
