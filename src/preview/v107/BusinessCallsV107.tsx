import { useMemo, useRef, useState } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { ImportPreviewModal, type PendingImportState } from '@/src/components/ImportPreviewModal';
import { hasNativeCallLogSyncPlugin } from '@/src/lib/capacitor';
import { getContactKey, readUploadedTextFile } from '@/src/lib/contacts';
import { normaliseEthPhone } from '@/src/lib/ethiopia';
import { avatarColor, dayKey, dayLabel, formatDuration, formatTime, initials } from '@/src/lib/format';
import { buildImportPreview, parseBackupImport } from '@/src/lib/import';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import {
  QUICK_CALL_OUTCOMES,
  isBusinessCall,
  isWithinBusinessHours,
  type BusinessConfig,
  type CrmContactMeta,
} from '@/src/preview/v107/businessStore';
import { useCalls } from '@/src/store/CallsContext';
import type { CallRecord } from '@/src/types/call';

type BizCallFilter = 'all' | 'missed' | 'afterHours' | 'newCallers';

export function BusinessCallsV107({
  config,
  crm,
  callOutcomes,
  onSetCallOutcome,
  onSelectCall,
  onSelectContact,
  onCallBack,
}: {
  config: BusinessConfig;
  crm: Record<string, CrmContactMeta>;
  callOutcomes: Record<string, string>;
  onSetCallOutcome: (callId: string, contactKey: string, outcome: string) => void;
  onSelectCall: (call: CallRecord) => void;
  onSelectContact: (number: string) => void;
  onCallBack: (number: string) => void;
}) {
  const {
    calls,
    contacts,
    availableTags,
    scheduledCalls,
    authUser,
    openAuthPrompt,
    syncPhoneCalls,
    importBackupPackage,
    showNotice,
  } = useCalls();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BizCallFilter>('all');
  const [visibleCount, setVisibleCount] = useState(60);
  const [syncing, setSyncing] = useState(false);
  const [taggingCall, setTaggingCall] = useState<CallRecord | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImportState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNativeAndroid = hasNativeCallLogSyncPlugin();

  const earliestCallIdByContact = useMemo(() => {
    const map = new Map<string, { id: string; ts: number }>();
    for (const c of calls) {
      const k = normaliseEthPhone(c.number) || c.number.trim();
      const prev = map.get(k);
      if (!prev || c.timestamp < prev.ts) {
        map.set(k, { id: c.id, ts: c.timestamp });
      }
    }
    return new Set([...map.values()].map((v) => v.id));
  }, [calls]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls
      .filter((c) => {
        if (!isBusinessCall(c, config, crm)) return false;
        if (filter === 'missed' && c.direction !== 'missed' && c.direction !== 'rejected') return false;
        if (filter === 'afterHours' && isWithinBusinessHours(c.timestamp, config)) return false;
        if (filter === 'newCallers' && !earliestCallIdByContact.has(c.id)) return false;
        if (!q) return true;
        const outcome = callOutcomes[c.id] ?? '';
        const hay = `${c.name ?? ''} ${c.number} ${c.note ?? ''} ${outcome}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [calls, config, crm, filter, query, earliestCallIdByContact, callOutcomes]);

  const grouped = useMemo(() => {
    const now = new Date();
    const groups: Array<{ key: string; label: string; items: CallRecord[] }> = [];
    const byDay = new Map<string, { key: string; label: string; items: CallRecord[] }>();
    for (const c of filtered.slice(0, visibleCount)) {
      const k = dayKey(c.timestamp);
      let grp = byDay.get(k);
      if (!grp) {
        grp = { key: k, label: dayLabel(c.timestamp, now), items: [] };
        byDay.set(k, grp);
        groups.push(grp);
      }
      grp.items.push(c);
    }
    return groups;
  }, [filtered, visibleCount]);

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
            style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
          >
            Business Calls
          </h1>
          <p className="text-xs text-[#626874] dark:text-[#989EA9] tabular-nums">
            {filtered.length.toLocaleString()} business calls · tap Tag to log outcome
          </p>
        </div>

        <div className="shrink-0">
          {isNativeAndroid ? (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="min-h-[40px] px-4 rounded-xl bg-[#0F2544] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] text-xs font-semibold flex items-center gap-2 whitespace-nowrap"
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
                className="min-h-[40px] px-4 rounded-xl bg-[#0F2544] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] text-xs font-semibold flex items-center gap-2 whitespace-nowrap"
              >
                <Upload size={14} />
                <span>Import file</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B92A0]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search caller, number, or call outcome…"
          aria-label="Search business calls"
          className="w-full h-11 pl-10 pr-9 rounded-xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] text-sm text-[#14161A] dark:text-[#F4F4F1] placeholder:text-[#8B92A0] focus:outline-none focus:border-[#E45A0D]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-[#8B92A0] flex items-center justify-center"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter Strip */}
      <div
        role="group"
        aria-label="Business call filter"
        className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EAECEF] dark:bg-[#151921]"
      >
        {(
          [
            { key: 'all', label: 'All business' },
            { key: 'missed', label: 'Missed' },
            { key: 'afterHours', label: 'After hours' },
            { key: 'newCallers', label: 'First-time callers' },
          ] as Array<{ key: BizCallFilter; label: string }>
        ).map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setFilter(item.key);
                setVisibleCount(60);
              }}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-white dark:bg-[#232936] text-[#14161A] dark:text-[#F4F4F1] shadow-xs'
                  : 'text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Grouped List */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-10 text-center">
          <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1]">
            No business calls match this filter
          </p>
        </div>
      ) : (
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

              <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] divide-y divide-[#EEF0F4] dark:divide-white/[0.06] overflow-hidden">
                {group.items.map((call) => {
                  const displayName = formatDisplayNameOrPhone(call.name, call.number);
                  const outcome = callOutcomes[call.id];
                  const afterHours = !isWithinBusinessHours(call.timestamp, config);
                  const isFirst = earliestCallIdByContact.has(call.id);
                  const DirIcon =
                    call.direction === 'incoming'
                      ? PhoneIncoming
                      : call.direction === 'outgoing'
                        ? PhoneOutgoing
                        : call.direction === 'missed'
                          ? PhoneMissed
                          : PhoneOff;
                  const dirColor =
                    call.direction === 'incoming'
                      ? 'text-[#2563EB] dark:text-[#60A5FA]'
                      : call.direction === 'outgoing'
                        ? 'text-[#E45A0D] dark:text-[#F4762C]'
                        : call.direction === 'missed'
                          ? 'text-[#DC2626] dark:text-[#F87171]'
                          : 'text-[#626874]';

                  return (
                    <div
                      key={call.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFBFC] dark:hover:bg-white/[0.02]"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectContact(call.number)}
                        className="w-10 h-10 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: avatarColor(call.number) }}
                      >
                        {initials(call.name, call.number)}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectCall(call)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] truncate">
                          {displayName}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#626874] dark:text-[#989EA9]">
                          <DirIcon size={12} className={`${dirColor} shrink-0`} />
                          <span className="font-mono tabular-nums">{formatTime(call.timestamp)}</span>
                          {call.duration > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {formatDuration(call.duration)}
                              </span>
                            </>
                          )}
                          {isFirst && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-[#2563EB] dark:text-[#60A5FA]">
                                New caller
                              </span>
                            </>
                          )}
                          {afterHours && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>After hours</span>
                            </>
                          )}
                          {outcome && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-[#0F766E] dark:text-[#2DD4BF]">
                                {outcome}
                              </span>
                            </>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTaggingCall(call)}
                        aria-label={`Log call outcome for ${displayName}`}
                        title="Log call outcome"
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          outcome
                            ? 'text-[#0F766E] dark:text-[#2DD4BF] bg-[#F0FDFA] dark:bg-[#0F766E]/15'
                            : 'text-[#8B92A0] hover:text-[#14161A] dark:hover:text-white hover:bg-[#EAECEF] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <Tag size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onCallBack(call.number)}
                        aria-label={`Call ${displayName}`}
                        className="w-10 h-10 rounded-full text-[#626874] dark:text-[#989EA9] hover:text-[#E45A0D] hover:bg-[#FFF5EE] dark:hover:bg-[#E45A0D]/12 flex items-center justify-center shrink-0"
                      >
                        <Phone size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {filtered.length > visibleCount && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + 80)}
                className="min-h-[42px] px-5 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] bg-white dark:bg-[#151921] text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1]"
              >
                Show more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick 1-Tap Outcome Tag Sheet */}
      {taggingCall && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center"
          onClick={() => setTaggingCall(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Log call outcome"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#151921] border-t sm:border border-[#E2E5EA] dark:border-white/[0.1] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#14161A] dark:text-[#F4F4F1]">
                  Log call outcome
                </h2>
                <p className="text-xs text-[#626874] dark:text-[#989EA9]">
                  {formatDisplayNameOrPhone(taggingCall.name, taggingCall.number)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTaggingCall(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg text-[#626874] flex items-center justify-center"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {QUICK_CALL_OUTCOMES.map((outcome) => {
                const active = callOutcomes[taggingCall.id] === outcome;
                return (
                  <button
                    key={outcome}
                    type="button"
                    onClick={() => {
                      onSetCallOutcome(
                        taggingCall.id,
                        getContactKey(taggingCall.number),
                        active ? '' : outcome,
                      );
                      setTaggingCall(null);
                    }}
                    className={`min-h-[42px] px-4 rounded-xl border text-left text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#E45A0D] bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C]'
                        : 'border-[#E2E5EA] dark:border-white/[0.08] text-[#14161A] dark:text-[#F4F4F1] hover:border-[#C5CBD6]'
                    }`}
                  >
                    {outcome}
                  </button>
                );
              })}
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
