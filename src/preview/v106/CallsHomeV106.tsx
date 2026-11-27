import { useMemo, useRef, useState } from 'react';
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
import { ImportPreviewModal, type PendingImportState } from '@/src/components/ImportPreviewModal';
import { hasNativeCallLogSyncPlugin } from '@/src/lib/capacitor';
import { readUploadedTextFile } from '@/src/lib/contacts';
import { avatarColor, dayKey, dayLabel, formatDuration, formatTime, initials } from '@/src/lib/format';
import { buildImportPreview, parseBackupImport } from '@/src/lib/import';
import { unreturnedMissedCalls } from '@/src/lib/reminders';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { useCalls } from '@/src/store/CallsContext';
import type { CallDirection, CallRecord } from '@/src/types/call';

type QuickFilter = 'all' | 'missed' | 'vip';
type SimChoice = 'all' | 'SIM 1' | 'SIM 2';
type DirectionChoice = 'all' | CallDirection;
type SortChoice = 'newest' | 'longest';

function DirectionMark({ direction }: { direction: CallDirection }) {
  if (direction === 'incoming') return <PhoneIncoming size={13} className="text-[#2563EB] dark:text-[#60A5FA] shrink-0" />;
  if (direction === 'outgoing') return <PhoneOutgoing size={13} className="text-[#E45A0D] dark:text-[#F4762C] shrink-0" />;
  if (direction === 'missed') return <PhoneMissed size={13} className="text-[#DC2626] dark:text-[#F87171] shrink-0" />;
  if (direction === 'voicemail') return <Voicemail size={13} className="text-[#7C3AED] dark:text-[#A78BFA] shrink-0" />;
  return <PhoneOff size={13} className="text-[#626874] dark:text-[#989EA9] shrink-0" />;
}

function directionWord(direction: CallDirection): string {
  if (direction === 'incoming') return 'Incoming';
  if (direction === 'outgoing') return 'Outgoing';
  if (direction === 'missed') return 'Missed';
  if (direction === 'rejected') return 'Declined';
  if (direction === 'blocked') return 'Blocked';
  return 'Voicemail';
}

export function CallsHomeV106({
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
    authUser,
    openAuthPrompt,
    syncPhoneCalls,
    importBackupPackage,
    showNotice,
  } = useCalls();

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

  const isNativeAndroid = hasNativeCallLogSyncPlugin();

  const unreturnedMissed = useMemo(
    () => unreturnedMissedCalls(calls, dismissedMissedIds),
    [calls, dismissedMissedIds],
  );

  const activeAdvancedCount =
    (simFilter !== 'all' ? 1 : 0) +
    (directionFilter !== 'all' ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0);

  const filteredCalls = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = calls.filter((call) => {
      if (quickFilter === 'missed' && call.direction !== 'missed') return false;
      if (quickFilter === 'vip' && !favorites.has(call.number)) return false;
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
      return slice.length > 0 ? [{ key: 'longest', label: 'Longest calls first', items: slice }] : [];
    }
    const now = new Date();
    const groups: Array<{ key: string; label: string; items: CallRecord[] }> = [];
    const byDay = new Map<string, { key: string; label: string; items: CallRecord[] }>();
    for (const call of slice) {
      const k = dayKey(call.timestamp);
      let grp = byDay.get(k);
      if (!grp) {
        grp = { key: k, label: dayLabel(call.timestamp, now), items: [] };
        byDay.set(k, grp);
        groups.push(grp);
      }
      grp.items.push(call);
    }
    return groups;
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

  const handleImportFile = async (file: File | null) => {
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
      showNotice(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const resetFilters = () => {
    setSimFilter('all');
    setDirectionFilter('all');
    setSortBy('newest');
  };

  return (
    <div className="space-y-5">
      {/* Clean Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
            style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
          >
            Calls
          </h1>
          <p className="text-xs text-[#626874] dark:text-[#989EA9] tabular-nums">
            {calls.length === 0
              ? 'Ready to sync or import'
              : `${calls.length.toLocaleString()} saved calls`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isNativeAndroid ? (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="min-h-[40px] px-4 rounded-xl bg-[#14161A] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] text-xs font-semibold flex items-center gap-2 whitespace-nowrap hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing…' : 'Sync phone'}</span>
            </button>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  void handleImportFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-4 rounded-xl bg-[#14161A] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] text-xs font-semibold flex items-center gap-2 whitespace-nowrap hover:opacity-90 transition-opacity"
              >
                <Upload size={14} />
                <span>Import file</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Single Calm Attention Strip (only when there are unreturned missed calls) */}
      {unreturnedMissed.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#FEF2F2] dark:bg-[#DC2626]/15 text-[#DC2626] dark:text-[#F87171] flex items-center justify-center shrink-0">
              <Bell size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] truncate">
                {unreturnedMissed.length} missed {unreturnedMissed.length === 1 ? 'call' : 'calls'} to return
              </p>
              <p className="text-xs text-[#626874] dark:text-[#989EA9] truncate">
                Latest: {formatDisplayNameOrPhone(unreturnedMissed[0].name, unreturnedMissed[0].number)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onCallBack(unreturnedMissed[0].number)}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#E45A0D] hover:bg-[#C94D09] text-white text-xs font-semibold whitespace-nowrap transition-colors"
            >
              Call back
            </button>
            {unreturnedMissed.length > 1 && (
              <button
                type="button"
                onClick={onOpenReminders}
                className="min-h-[38px] px-3 rounded-xl text-xs font-medium text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1] whitespace-nowrap"
              >
                See all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clean Search + Simple 3-Way Filter + Filter Sheet Trigger */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B92A0]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, number, or note…"
              aria-label="Search calls"
              className="w-full h-11 pl-10 pr-9 rounded-xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] text-sm text-[#14161A] dark:text-[#F4F4F1] placeholder:text-[#8B92A0] focus:outline-none focus:border-[#E45A0D]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-[#8B92A0] hover:text-[#14161A] dark:hover:text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-label="More filters"
            className={`h-11 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeAdvancedCount > 0
                ? 'border-[#E45A0D] bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C]'
                : 'border-[#E5E2DC] dark:border-white/[0.08] bg-white dark:bg-[#15181D] text-[#14161A] dark:text-[#F4F4F1] hover:border-[#C8C3B8]'
            }`}
          >
            <SlidersHorizontal size={15} />
            <span>Filter</span>
            {activeAdvancedCount > 0 && (
              <span className="font-mono tabular-nums">({activeAdvancedCount})</span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Quick call filter"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EDEBE6] dark:bg-[#15181D]"
          >
            {(
              [
                { key: 'all', label: 'All calls' },
                { key: 'missed', label: 'Missed' },
                { key: 'vip', label: 'VIP' },
              ] as Array<{ key: QuickFilter; label: string }>
            ).map((item) => {
              const active = quickFilter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setQuickFilter(item.key);
                    setVisibleCount(60);
                  }}
                  className={`min-h-[34px] px-3.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-white dark:bg-[#232730] text-[#14161A] dark:text-[#F4F4F1] shadow-xs'
                      : 'text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {activeAdvancedCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-[#E45A0D] dark:text-[#F4762C] hover:underline whitespace-nowrap"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {calls.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-10 text-center space-y-3">
          <p className="text-base font-semibold text-[#14161A] dark:text-[#F4F4F1]">
            Your call history is empty
          </p>
          <p className="text-sm text-[#626874] dark:text-[#989EA9] max-w-sm mx-auto">
            {isNativeAndroid
              ? 'Tap Sync phone above to load your Android call log privately on this device.'
              : 'Import a CSV, JSON, or TXT call file to see your history, talk-time trends, and top callers.'}
          </p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1]">
            No matching calls
          </p>
          <p className="text-xs text-[#626874] dark:text-[#989EA9]">
            Try clearing your search or switching back to All calls.
          </p>
        </div>
      ) : (
        /* Ultra-Clean Scannable Day Groups (4 items per row: Avatar, Name, Unboxed Metadata, Call Button) */
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.key} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold text-[#626874] dark:text-[#989EA9]">
                  {group.label}
                </h2>
                <span className="text-[11px] font-mono tabular-nums text-[#8B92A0]">
                  {group.items.length}
                </span>
              </div>

              <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] divide-y divide-[#F0EEE9] dark:divide-white/[0.06] overflow-hidden">
                {group.items.map((call) => {
                  const displayName = formatDisplayNameOrPhone(call.name, call.number);
                  const isMissed = call.direction === 'missed';
                  return (
                    <div
                      key={call.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF9F6] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectContact(call.number)}
                        aria-label={`Open profile for ${displayName}`}
                        className="w-10 h-10 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 transition-transform active:scale-95"
                        style={{ backgroundColor: avatarColor(call.number) }}
                      >
                        {initials(call.name, call.number)}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectCall(call)}
                        className="flex-1 min-w-0 text-left py-0.5"
                      >
                        <p
                          className={`text-sm font-semibold truncate ${
                            isMissed
                              ? 'text-[#DC2626] dark:text-[#F87171]'
                              : 'text-[#14161A] dark:text-[#F4F4F1]'
                          }`}
                        >
                          {displayName}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#626874] dark:text-[#989EA9] truncate">
                          <DirectionMark direction={call.direction} />
                          <span>{directionWord(call.direction)}</span>
                          {call.duration > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {formatDuration(call.duration)}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{formatTime(call.timestamp)}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onCallBack(call.number)}
                        aria-label={`Call ${displayName}`}
                        className="w-11 h-11 rounded-full text-[#626874] dark:text-[#989EA9] hover:text-[#E45A0D] dark:hover:text-[#F4762C] hover:bg-[#FFF5EE] dark:hover:bg-[#E45A0D]/12 flex items-center justify-center shrink-0 transition-colors"
                      >
                        <Phone size={17} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {filteredCalls.length > visibleCount && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + 80)}
                className="min-h-[42px] px-5 rounded-xl border border-[#E5E2DC] dark:border-white/[0.1] bg-white dark:bg-[#15181D] text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1] hover:border-[#E45A0D] transition-colors"
              >
                Show more ({filteredCalls.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Slide-Up Filter Bottom Sheet (Mobile) / Clean Centered Modal (Desktop) */}
      {filterSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center"
          onClick={() => setFilterSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter calls"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#15181D] border-t sm:border border-[#E5E2DC] dark:border-white/[0.1] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-5 shadow-2xl"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-[#D5D2CA] dark:bg-white/20 mx-auto -mt-1 mb-2" />

            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#14161A] dark:text-[#F4F4F1]">
                Filter calls
              </h2>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                aria-label="Close filter sheet"
                className="w-9 h-9 rounded-xl text-[#626874] dark:text-[#989EA9] hover:bg-[#F2F0EC] dark:hover:bg-white/[0.06] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">SIM card</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'all', label: 'Both SIMs' },
                      { key: 'SIM 1', label: simLabels.sim1Label || 'SIM 1' },
                      { key: 'SIM 2', label: simLabels.sim2Label || 'SIM 2' },
                    ] as Array<{ key: SimChoice; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSimFilter(opt.key)}
                      className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium truncate transition-colors ${
                        simFilter === opt.key
                          ? 'border-[#E45A0D] bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C]'
                          : 'border-[#E5E2DC] dark:border-white/[0.08] text-[#14161A] dark:text-[#F4F4F1]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">Call type</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { key: 'all', label: 'Any' },
                      { key: 'incoming', label: 'Incoming' },
                      { key: 'outgoing', label: 'Outgoing' },
                      { key: 'missed', label: 'Missed' },
                    ] as Array<{ key: DirectionChoice; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDirectionFilter(opt.key)}
                      className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors ${
                        directionFilter === opt.key
                          ? 'border-[#E45A0D] bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C]'
                          : 'border-[#E5E2DC] dark:border-white/[0.08] text-[#14161A] dark:text-[#F4F4F1]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">Sort order</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: 'newest', label: 'Most recent' },
                      { key: 'longest', label: 'Longest calls' },
                    ] as Array<{ key: SortChoice; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSortBy(opt.key)}
                      className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors ${
                        sortBy === opt.key
                          ? 'border-[#E45A0D] bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C]'
                          : 'border-[#E5E2DC] dark:border-white/[0.08] text-[#14161A] dark:text-[#F4F4F1]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={resetFilters}
                className="flex-1 min-h-[44px] rounded-xl border border-[#E5E2DC] dark:border-white/[0.1] text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-[#14161A] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] text-xs font-semibold"
              >
                Apply ({filteredCalls.length})
              </button>
            </div>
          </div>
        </div>
      )}

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
