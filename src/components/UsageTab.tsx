import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  GitMerge,
  Hash,
  Package,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Smartphone,
  Tag,
} from 'lucide-react';
import { CarrierUssdModal, type UssdCategory } from '@/src/components/CarrierUssdModal';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import { CustomSelect } from '@/src/components/CustomSelect';
import { HorizontalUsageBar } from '@/src/components/Charts';
import { DateRangePicker } from '@/src/components/DateRangePicker';
import { SavedContactsSection } from '@/src/components/SavedContactsSection';
import { getContactKey } from '@/src/lib/contacts';
import {
  VOICE_BUNDLE_PRESETS,
  computeBundleStatus,
  estimateCallCostEtb,
  formatEtb,
  formatSimDisplay,
} from '@/src/lib/ethiopia';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { formatDateTime, formatDuration } from '@/src/lib/format';
import { triggerHaptic } from '@/src/lib/haptics';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { contactStats, filterByRange, simStats, totalSpendEtb } from '@/src/lib/stats';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useCalls } from '@/src/store/CallsContext';
import type { CallDirection, CallRecord, DateRangeFilter, TimeRange } from '@/src/types/call';

type SimFilter = 'all' | 'SIM 1' | 'SIM 2';
type DirectionFilter = 'all' | CallDirection;
type UsageCategory = 'sim' | 'bundles' | 'contacts' | 'tools';

const USAGE_META: Record<UsageCategory, { title: string; description: string }> = {
  sim: {
    title: 'Dual-SIM Usage & Caller Breakdown',
    description: 'Compare SIM 1 vs SIM 2 talk time, ETB spend, and per-caller timelines',
  },
  bundles: {
    title: 'Voice Bundles & Expiry Tracker',
    description: 'Track active SIM 1 & SIM 2 voice minute bundles and expiry countdowns',
  },
  contacts: {
    title: 'Saved Contacts',
    description: 'Manage saved phone contacts, birthdays, relationship tags, and wishes',
  },
  tools: {
    title: 'Carrier USSD & Contact Merge',
    description: 'Merge duplicate contact numbers and open Ethiopian carrier USSD codes',
  },
};

export function UsageTab({
  onSelectCall,
  onSelectContact,
}: {
  onSelectCall: (call: CallRecord) => void;
  onSelectContact: (number: string) => void;
}) {
  const {
    calls,
    contacts: contactProfiles,
    tariffs,
    simLabels,
    voiceBundles,
    setVoiceBundles,
    mergeContacts,
    showNotice,
  } = useCalls();

  const prefersReducedMotion = useReducedMotion();
  const [activeCategory, setActiveCategory] = useState<UsageCategory>('sim');
  const [range, setRange] = useState<TimeRange>('all');
  const [customRange, setCustomRange] = useState<DateRangeFilter>(null);
  const [simFilter, setSimFilter] = useState<SimFilter>('all');
  const [dirFilter, setDirFilter] = useState<DirectionFilter>('all');
  const [metric, setMetric] = useState<'duration' | 'count'>('duration');
  const [expandedNumber, setExpandedNumber] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeName, setMergeName] = useState('');
  const [ussdOpen, setUssdOpen] = useState(false);
  const [ussdInitialCategory, setUssdInitialCategory] = useState<UssdCategory>('all');
  const [editingBundleSlot, setEditingBundleSlot] = useState<'sim1' | 'sim2' | null>(null);
  const [visibleUsageContacts, setVisibleUsageContacts] = useState(6);

  useBackHandler({
    id: 'usage-bundle-editor',
    active: Boolean(editingBundleSlot),
    priority: 25,
    onBack: () => setEditingBundleSlot(null),
  });
  useBackHandler({
    id: 'usage-subtab',
    active: activeCategory !== 'sim',
    priority: 15,
    onBack: () => setActiveCategory('sim'),
  });

  const openUssd = (initialCategory: UssdCategory = 'all') => {
    setUssdInitialCategory(initialCategory);
    setUssdOpen(true);
  };

  const savedContactsCount = Object.keys(contactProfiles).length;
  const activeBundlesCount =
    (voiceBundles.sim1.enabled ? 1 : 0) + (voiceBundles.sim2.enabled ? 1 : 0);

  const ranged = useMemo(
    () => filterByRange(calls, range, new Date(), customRange),
    [calls, range, customRange],
  );
  const sims = useMemo(() => simStats(ranged), [ranged]);

  const filtered = useMemo(
    () =>
      ranged.filter((call) => {
        if (simFilter !== 'all' && call.sim !== simFilter) return false;
        if (dirFilter !== 'all' && call.direction !== dirFilter) return false;
        return true;
      }),
    [ranged, simFilter, dirFilter],
  );

  const contacts = useMemo(() => {
    const list = contactStats(filtered);
    return list.sort((a, b) =>
      metric === 'duration' ? b.duration - a.duration : b.count - a.count,
    );
  }, [filtered, metric]);

  const allCallContacts = useMemo(
    () => contactStats(calls).sort((a, b) => b.count - a.count),
    [calls],
  );

  const visibleUsageList = useMemo(
    () => contacts.slice(0, visibleUsageContacts),
    [contacts, visibleUsageContacts],
  );

  const maxContactVal = useMemo(() => {
    if (contacts.length === 0) return 1;
    return Math.max(
      1,
      ...contacts.map((c) => (metric === 'duration' ? c.duration : c.count)),
    );
  }, [contacts, metric]);

  const maxSimCount = useMemo(
    () => Math.max(1, ...sims.map((s) => (metric === 'duration' ? s.duration : s.count))),
    [sims, metric],
  );

  const categories: Array<CategoryItem<UsageCategory>> = useMemo(
    () => [
      { key: 'sim', label: 'SIM Usage', count: filtered.length },
      { key: 'bundles', label: 'Bundles', count: activeBundlesCount },
      { key: 'contacts', label: 'Contacts', count: savedContactsCount },
      { key: 'tools', label: 'Carrier' },
    ],
    [filtered.length, activeBundlesCount, savedContactsCount],
  );

  const activeMeta = USAGE_META[activeCategory];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#08246B] dark:text-white">
              Usage &amp; Contacts
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              {activeMeta.description}
            </p>
          </div>
        </div>

        <CategoryTabs
          items={categories}
          activeKey={activeCategory}
          onChange={setActiveCategory}
          ariaLabel="Usage categories"
        />
      </div>

      <CategoryPanel activeKey={activeCategory} label={activeMeta.title}>
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-bold text-[#08246B] dark:text-white">
            {activeMeta.title}
          </h2>
        </div>
        {activeCategory === 'sim' &&
          (calls.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center mx-auto">
                <Smartphone size={22} />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h2 className="text-base font-semibold text-[#08246B] dark:text-white">
                  No usage data yet
                </h2>
                <p className="text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Sync your phone call log on Android or import a call file in Calls to compare SIM 1 vs SIM 2 usage, or switch to Saved Contacts or Voice Bundles above.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory('contacts')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap shrink-0"
                >
                  Open Saved Contacts
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('bundles')}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0"
                >
                  Open Voice Bundles
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CustomSelect
                    value={simFilter}
                    options={[
                      { value: 'all', label: 'All SIMs' },
                      { value: 'SIM 1', label: 'SIM 1' },
                      { value: 'SIM 2', label: 'SIM 2' },
                    ]}
                    onChange={(v) => {
                      triggerHaptic('tap');
                      setSimFilter(v as SimFilter);
                    }}
                    ariaLabel="Filter by SIM"
                    activeHighlight={simFilter !== 'all'}
                    compact
                  />

                  <CustomSelect
                    value={dirFilter}
                    options={[
                      { value: 'all', label: 'All calls' },
                      { value: 'incoming', label: 'Incoming' },
                      { value: 'outgoing', label: 'Outgoing' },
                      { value: 'missed', label: 'Missed' },
                      { value: 'rejected', label: 'Rejected' },
                      { value: 'blocked', label: 'Blocked' },
                      { value: 'voicemail', label: 'Voicemail' },
                    ]}
                    onChange={(v) => {
                      triggerHaptic('tap');
                      setDirFilter(v as DirectionFilter);
                    }}
                    ariaLabel="Filter by call direction"
                    activeHighlight={dirFilter !== 'all'}
                    compact
                  />
                </div>

                <div className="grid grid-cols-2 items-center gap-1 p-1 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] ml-auto">
                  {(['duration', 'count'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setMetric(m);
                      }}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        metric === m
                          ? 'bg-[#FF6A00] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {m === 'duration' ? 'Duration' : 'Calls'}
                    </button>
                  ))}
                </div>
              </div>

              <DateRangePicker
                range={range}
                customRange={customRange}
                onChangeRange={setRange}
                onChangeCustomRange={setCustomRange}
              />

              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
                <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                  Dual-SIM breakdown
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sims.map((sim, idx) => {
                    const val = metric === 'duration' ? sim.duration : sim.count;
                    const simCalls = ranged.filter((c) => (c.sim ?? 'Unknown') === sim.sim);
                    const spend = totalSpendEtb(simCalls, tariffs);
                    const simTitle =
                      sim.sim === 'SIM 1' || sim.sim === 'SIM 2'
                        ? formatSimDisplay(sim.sim, simLabels)
                        : sim.sim;
                    return (
                      <HorizontalUsageBar
                        key={sim.sim}
                        label={simTitle}
                        valueLabel={
                          metric === 'duration'
                            ? `${formatDuration(sim.duration)} · ${formatEtb(spend)}`
                            : `${sim.count} calls · ${formatEtb(spend)}`
                        }
                        subLabel={`${sim.count} calls · ${sim.incoming} in / ${sim.outgoing} out / ${sim.missed} missed`}
                        percent={(val / maxSimCount) * 100}
                        color={idx === 0 ? '#FF6A00' : '#4FA3F7'}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
                <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                  Per-contact usage (tap to expand timeline)
                </h2>

                {contacts.length === 0 ? (
                  <p className="text-sm text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                    No calls match the selected SIM / direction filters.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      {visibleUsageList.map((contact) => {
                        const isExpanded = expandedNumber === contact.number;
                        const val = metric === 'duration' ? contact.duration : contact.count;
                        const pct = Math.max(4, Math.round((val / maxContactVal) * 100));
                        const contactSpend = contact.calls.reduce(
                          (sum, c) => sum + estimateCallCostEtb(c, tariffs),
                          0,
                        );

                        const contactTag = contactProfiles[getContactKey(contact.number)]?.tag;
                        const displayContactLabel = formatDisplayNameOrPhone(
                          contact.name,
                          contact.number,
                        );

                        return (
                          <div
                            key={contact.number}
                            className="py-3 first:pt-0 last:pb-0 bg-white dark:bg-[var(--dark-surface)] border-b border-[#DDE4EA] dark:border-[var(--dark-border)] last:border-b-0"
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('tap');
                                  setExpandedNumber(isExpanded ? null : contact.number);
                                }}
                                className="flex-1 min-w-0 text-left space-y-2 py-0.5"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  {isExpanded ? (
                                    <ChevronDown size={16} className="text-[#FF6A00] shrink-0 mt-0.5" />
                                  ) : (
                                    <ChevronRight size={16} className="text-[#8A93A0] shrink-0 mt-0.5" />
                                  )}
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      <span className="text-sm font-semibold text-[#08246B] dark:text-white break-words">
                                        {displayContactLabel}
                                      </span>
                                      {contactTag && (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#FF6A00] shrink-0">
                                          <Tag size={11} className="shrink-0" />
                                          <span>{contactTag}</span>
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                      {formatDuration(contact.duration)} · {contact.count} calls
                                      {contactSpend > 0 ? ` · ${formatEtb(contactSpend)}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="pl-6">
                                  <div className="h-2 w-full rounded-full bg-[#E5E9F0] dark:bg-[var(--dark-canvas)] overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-[#FF6A00] transition-all duration-200"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => onSelectContact(contact.number)}
                                aria-label={`View ${contact.name} profile`}
                                className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 whitespace-nowrap shrink-0 mt-0.5 transition-colors"
                              >
                                Profile
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="mt-3 ml-6 pl-3 border-l border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-1.5">
                                {contact.calls.map((call) => (
                                  <button
                                    key={call.id}
                                    type="button"
                                    onClick={() => onSelectCall(call)}
                                    className="w-full py-1.5 px-2 rounded-lg hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-between gap-2 text-left text-xs transition-colors"
                                  >
                                    <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] capitalize tabular-nums">
                                      {call.direction} · {formatDateTime(call.timestamp)}
                                      {call.sim ? ` · ${formatSimDisplay(call.sim, simLabels)}` : ''}
                                    </span>
                                    <span className="font-mono tabular-nums text-[#08246B] dark:text-white shrink-0">
                                      {formatDuration(call.duration)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {(contacts.length > visibleUsageContacts || visibleUsageContacts > 6) && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0.5, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, amount: 0.25 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                        className="flex flex-wrap items-center justify-center gap-2 pt-1"
                      >
                        {contacts.length > visibleUsageContacts && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('tap');
                              setVisibleUsageContacts((prev) => prev + 10);
                            }}
                            className="min-h-[38px] px-4 py-1.5 rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] tabular-nums transition-colors"
                          >
                            Show more ({contacts.length - visibleUsageContacts} remaining)
                          </button>
                        )}
                        {visibleUsageContacts > 6 && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('tap');
                              setVisibleUsageContacts(6);
                            }}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-2xl text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00] transition-colors"
                          >
                            Show less
                          </button>
                        )}
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

        {activeCategory === 'bundles' && (
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Package size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                    Voice Package &amp; Bundle Tracker
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Auto-deducts outgoing talk time on SIM 1 &amp; SIM 2 against your active minute packs
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setUssdOpen(true)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Hash size={13} className="text-[#FF6A00]" />
                Check Carrier USSD
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  { key: 'sim1' as const, sim: 'SIM 1' as const, accent: '#FF6A00' },
                  { key: 'sim2' as const, sim: 'SIM 2' as const, accent: '#4FA3F7' },
                ]
              ).map(({ key, sim, accent }) => {
                const bundle = voiceBundles[key];
                const status = computeBundleStatus(sim, bundle, calls, tariffs.billingMode);
                const isEditing = editingBundleSlot === key;
                const currentDays =
                  bundle.startedAt > 0 && bundle.expiresAt > bundle.startedAt
                    ? Math.max(1, Math.round((bundle.expiresAt - bundle.startedAt) / 86_400_000))
                    : 7;

                const updateSlot = (patch: Partial<typeof bundle>) => {
                  setVoiceBundles({
                    ...voiceBundles,
                    [key]: { ...bundle, ...patch },
                  });
                };

                const resetStartToToday = (daysOverride?: number) => {
                  const now = Date.now();
                  const days = Math.max(1, daysOverride ?? currentDays);
                  updateSlot({
                    enabled: true,
                    startedAt: now,
                    expiresAt: now + days * 86_400_000,
                  });
                  showNotice(`${formatSimDisplay(sim, simLabels)} bundle timer reset to today.`);
                };

                const barColor =
                  status.isExpired || status.percentRemaining < 15 ? '#EF4444' : accent;

                return (
                  <div
                    key={key}
                    className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F7F9FB] dark:bg-[var(--dark-canvas)] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                          {formatSimDisplay(sim, simLabels)}
                        </p>
                        <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                          {bundle.enabled ? bundle.name : 'No active voice bundle tracked'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingBundleSlot(isEditing ? null : key)}
                          aria-label={`Configure ${sim} bundle`}
                          className="min-h-[34px] px-2.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1 whitespace-nowrap"
                        >
                          <SlidersHorizontal size={12} />
                          {isEditing ? 'Done' : 'Setup'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!bundle.enabled && bundle.startedAt === 0) {
                              const now = Date.now();
                              updateSlot({
                                enabled: true,
                                startedAt: now,
                                expiresAt: now + currentDays * 86_400_000,
                              });
                            } else {
                              updateSlot({ enabled: !bundle.enabled });
                            }
                          }}
                          className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                            bundle.enabled
                              ? 'bg-[#FF6A00] text-white'
                              : 'border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                          }`}
                        >
                          {bundle.enabled ? 'Active' : 'Enable'}
                        </button>
                      </div>
                    </div>

                    {bundle.enabled && (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                          <span className="font-bold text-[#08246B] dark:text-white">
                            {status.remainingMinutes} / {bundle.totalMinutes} min left
                          </span>
                          <span
                            className={`font-semibold ${
                              status.isExpired || status.percentRemaining < 15
                                ? 'text-[#EF4444]'
                                : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                            }`}
                          >
                            {status.percentRemaining}% ·{' '}
                            {status.isExpired ? 'Expired' : `${status.daysLeft}d left`}
                          </span>
                        </div>

                        <div className="h-2.5 w-full rounded-full bg-[#E5E9F0] dark:bg-[var(--dark-surface)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${status.percentRemaining}%`,
                              backgroundColor: barColor,
                            }}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                          <span>
                            {status.usedMinutes} min used · {status.effectiveRatePerMin.toFixed(2)} ETB/min
                            {bundle.startedAt > 0
                              ? ` · Started ${formatEthiopianShort(bundle.startedAt)} EC`
                              : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => resetStartToToday()}
                            className="text-[#FF6A00] font-semibold hover:underline flex items-center gap-1 whitespace-nowrap"
                          >
                            <RotateCcw size={11} />
                            Reset start to today
                          </button>
                        </div>
                      </div>
                    )}

                    {(isEditing || !bundle.enabled) && (
                      <div className="pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {VOICE_BUNDLE_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                const now = Date.now();
                                updateSlot({
                                  enabled: true,
                                  name: preset.name,
                                  totalMinutes: preset.totalMinutes,
                                  priceEtb: preset.priceEtb,
                                  startedAt: now,
                                  expiresAt: now + preset.days * 86_400_000,
                                });
                                setEditingBundleSlot(null);
                                showNotice(`${preset.name} activated on ${sim}.`);
                              }}
                              className="min-h-[32px] px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[11px] font-medium text-[#08246B] dark:text-white hover:border-[#FF6A00] whitespace-nowrap transition-colors"
                            >
                              {preset.name} ({preset.priceEtb} ETB)
                            </button>
                          ))}
                        </div>

                        {isEditing && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <label className="col-span-2 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] space-y-1">
                                <span>Bundle name</span>
                                <input
                                  type="text"
                                  value={bundle.name}
                                  onChange={(e) => updateSlot({ name: e.target.value })}
                                  className="w-full rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-1.5 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                                />
                              </label>
                              <label className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] space-y-1">
                                <span>Minutes</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={bundle.totalMinutes}
                                  onChange={(e) =>
                                    updateSlot({
                                      totalMinutes: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  className="w-full rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                                />
                              </label>
                              <label className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] space-y-1">
                                <span>Price (ETB)</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  value={bundle.priceEtb}
                                  onChange={(e) =>
                                    updateSlot({
                                      priceEtb: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className="w-full rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-1.5 text-xs font-mono tabular-nums text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                                />
                              </label>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <div className="flex items-center gap-1">
                                {[1, 7, 30].map((days) => (
                                  <button
                                    key={days}
                                    type="button"
                                    onClick={() => resetStartToToday(days)}
                                    className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${
                                      currentDays === days
                                        ? 'border-[#FF6A00] bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00]'
                                        : 'border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                                    }`}
                                  >
                                    {days}d start today
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingBundleSlot(null)}
                                className="min-h-[32px] px-3 rounded-lg bg-[#FF6A00] text-white text-[11px] font-semibold whitespace-nowrap"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeCategory === 'contacts' && (
          <SavedContactsSection onSelectContact={onSelectContact} />
        )}

        {activeCategory === 'tools' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Hash size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                    Ethiopian Carrier USSD &amp; Emergency Hotlines
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Quick balance, packages, 991/939/907 emergency numbers, and custom USSD codes
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-auto min-w-0 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openUssd('emergency')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                >
                  <ShieldAlert size={14} />
                  Emergency Hotlines
                </button>
                <button
                  type="button"
                  onClick={() => openUssd('all')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Hash size={14} />
                  Open USSD Shortcuts
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <GitMerge size={17} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                    Merge Two Numbers Into One Contact
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Combine dual-SIM or old/new phone numbers under one unified name
                  </p>
                </div>
              </div>

              {allCallContacts.length < 2 ? (
                <p className="text-xs text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                  At least two distinct callers in your call history are required to merge numbers.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <CustomSelect
                      ariaLabel="Source number to merge from"
                      value={mergeSource || allCallContacts[0]?.number || ''}
                      variant="inset"
                      fullWidth
                      searchable
                      searchPlaceholder="Search caller..."
                      options={allCallContacts.map((c) => ({
                        value: c.number,
                        label: `From: ${formatDisplayNameOrPhone(c.name, c.number)}`,
                        sublabel: c.number,
                      }))}
                      onChange={setMergeSource}
                    />
                    <CustomSelect
                      ariaLabel="Target number to keep"
                      value={mergeTarget || allCallContacts[1]?.number || ''}
                      variant="inset"
                      fullWidth
                      searchable
                      searchPlaceholder="Search target..."
                      options={allCallContacts.map((c) => ({
                        value: c.number,
                        label: `Into: ${formatDisplayNameOrPhone(c.name, c.number)}`,
                        sublabel: c.number,
                      }))}
                      onChange={(val) => {
                        setMergeTarget(val);
                        const found = allCallContacts.find((c) => c.number === val);
                        if (found && found.name !== found.number) setMergeName(found.name);
                      }}
                    />
                    <input
                      type="text"
                      value={mergeName}
                      onChange={(e) => setMergeName(e.target.value)}
                      placeholder="Unified contact name"
                      className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0]"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={
                        (mergeSource || allCallContacts[0]?.number) ===
                        (mergeTarget || allCallContacts[1]?.number)
                      }
                      onClick={() => {
                        const src = mergeSource || allCallContacts[0]?.number || '';
                        const tgt = mergeTarget || allCallContacts[1]?.number || '';
                        if (!src || !tgt || src === tgt) return;
                        mergeContacts(src, tgt, mergeName);
                        setMergeSource('');
                        setMergeTarget('');
                        setMergeName('');
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-40 text-xs font-semibold text-white whitespace-nowrap"
                    >
                      Merge contact history
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CategoryPanel>

      <CarrierUssdModal
        open={ussdOpen}
        onClose={() => setUssdOpen(false)}
        initialCategory={ussdInitialCategory}
      />
    </div>
  );
}
