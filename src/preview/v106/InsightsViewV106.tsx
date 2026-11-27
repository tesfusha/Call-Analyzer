import { useMemo, useState } from 'react';
import { Hash } from 'lucide-react';
import { CarrierUssdModal } from '@/src/components/CarrierUssdModal';
import {
  computeBundleStatus,
  formatEtb,
  formatSimDisplay,
} from '@/src/lib/ethiopia';
import { avatarColor, formatDuration, initials } from '@/src/lib/format';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import {
  computeTotals,
  contactStats,
  simStats,
  topByDuration,
  totalSpendEtb,
} from '@/src/lib/stats';
import {
  TrendChartV106,
  filterCallsForInsightsRange,
  type InsightsRangeKey,
} from '@/src/preview/v106/TrendChartV106';
import { useCalls } from '@/src/store/CallsContext';

const RANGES: Array<{ key: InsightsRangeKey; label: string }> = [
  { key: '7d', label: '7D' },
  { key: '14d', label: '14D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All' },
];

export function InsightsViewV106({
  onSelectContact,
}: {
  onSelectContact: (number: string) => void;
}) {
  const { calls, tariffs, simLabels, voiceBundles } = useCalls();
  const [range, setRange] = useState<InsightsRangeKey>('30d');
  const [callerSort, setCallerSort] = useState<'duration' | 'count'>('duration');
  const [ussdOpen, setUssdOpen] = useState(false);

  const scoped = useMemo(() => filterCallsForInsightsRange(calls, range), [calls, range]);
  const totals = useMemo(() => computeTotals(scoped), [scoped]);
  const scopedSpend = useMemo(() => totalSpendEtb(scoped, tariffs), [scoped, tariffs]);
  const monthlyCalls = useMemo(() => filterCallsForInsightsRange(calls, '30d'), [calls]);
  const monthlySpend = useMemo(() => totalSpendEtb(monthlyCalls, tariffs), [monthlyCalls, tariffs]);
  const topPerson = useMemo(() => topByDuration(scoped), [scoped]);
  const sims = useMemo(() => simStats(scoped), [scoped]);

  const topCallers = useMemo(() => {
    const list = contactStats(scoped);
    return list
      .sort((a, b) => (callerSort === 'duration' ? b.duration - a.duration : b.count - a.count))
      .slice(0, 6);
  }, [scoped, callerSort]);

  const maxCallerMetric = useMemo(() => {
    if (topCallers.length === 0) return 1;
    return Math.max(
      1,
      ...topCallers.map((c) => (callerSort === 'duration' ? c.duration : c.count)),
    );
  }, [topCallers, callerSort]);

  const sim1Bundle = useMemo(
    () =>
      voiceBundles.sim1.enabled
        ? computeBundleStatus('SIM 1', voiceBundles.sim1, calls, tariffs.billingMode)
        : null,
    [voiceBundles.sim1, calls, tariffs.billingMode],
  );
  const sim2Bundle = useMemo(
    () =>
      voiceBundles.sim2.enabled
        ? computeBundleStatus('SIM 2', voiceBundles.sim2, calls, tariffs.billingMode)
        : null,
    [voiceBundles.sim2, calls, tariffs.billingMode],
  );

  const budgetPct =
    tariffs.monthlyBudgetEtb > 0
      ? Math.min(100, Math.round((monthlySpend / tariffs.monthlyBudgetEtb) * 100))
      : 0;

  const avgSeconds = totals.avgDuration;

  if (calls.length === 0) {
    return (
      <div className="space-y-4">
        <h1
          className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
          style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
        >
          Insights
        </h1>
        <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-10 text-center space-y-2">
          <p className="text-base font-semibold text-[#14161A] dark:text-[#F4F4F1]">
            No call insights yet
          </p>
          <p className="text-sm text-[#626874] dark:text-[#989EA9] max-w-sm mx-auto">
            Sync your phone or import a call file on the Calls tab to see your spending, SIM split, and talk-time trends.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + Single Global Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
            style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
          >
            Insights
          </h1>
          <p className="text-xs text-[#626874] dark:text-[#989EA9] tabular-nums">
            {scoped.length.toLocaleString()} calls · {totals.uniqueContacts} people
          </p>
        </div>

        <div
          role="group"
          aria-label="Time range"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EDEBE6] dark:bg-[#15181D] self-start"
        >
          {RANGES.map((item) => {
            const active = range === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-colors ${
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
      </div>

      {/* Plain-English 3-Answer Top Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Spend & Budget */}
        <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-5 space-y-3">
          <p className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
            Estimated spend ({range === 'all' ? 'All time' : range.toUpperCase()})
          </p>
          <p className="text-2xl font-bold tracking-tight font-mono tabular-nums text-[#14161A] dark:text-[#F4F4F1]">
            {formatEtb(scopedSpend)}
          </p>
          {tariffs.monthlyBudgetEtb > 0 && (
            <div className="space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-[#EDEBE6] dark:bg-white/[0.08] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetPct >= 90 ? 'bg-[#DC2626]' : 'bg-[#E45A0D]'
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className="text-[11px] text-[#626874] dark:text-[#989EA9] tabular-nums">
                {budgetPct}% of {formatEtb(tariffs.monthlyBudgetEtb)} monthly budget
              </p>
            </div>
          )}
        </div>

        {/* Card 2: Talk Time */}
        <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-5 space-y-2">
          <p className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
            Total talk time
          </p>
          <p className="text-2xl font-bold tracking-tight font-mono tabular-nums text-[#14161A] dark:text-[#F4F4F1]">
            {formatDuration(totals.totalDuration)}
          </p>
          <p className="text-xs text-[#626874] dark:text-[#989EA9] tabular-nums">
            Avg {formatDuration(avgSeconds)} per answered call · {totals.missedCount} missed
          </p>
        </div>

        {/* Card 3: Top Person */}
        <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-5 space-y-2.5">
          <p className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
            Most talked-to person
          </p>
          {topPerson ? (
            <button
              type="button"
              onClick={() => onSelectContact(topPerson.number)}
              className="w-full flex items-center gap-3 text-left group"
            >
              <span
                className="w-10 h-10 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                style={{ backgroundColor: avatarColor(topPerson.number) }}
              >
                {initials(topPerson.name, topPerson.number)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#14161A] dark:text-[#F4F4F1] group-hover:text-[#E45A0D] truncate transition-colors">
                  {formatDisplayNameOrPhone(topPerson.name, topPerson.number)}
                </p>
                <p className="text-xs text-[#626874] dark:text-[#989EA9] font-mono tabular-nums">
                  {formatDuration(topPerson.duration)} · {topPerson.count} calls
                </p>
              </div>
            </button>
          ) : (
            <p className="text-sm text-[#626874] dark:text-[#989EA9]">No answered calls yet</p>
          )}
        </div>
      </div>

      {/* Upgraded Multi-Range Trend Chart (NO 14-day cap!) */}
      <TrendChartV106
        allCalls={calls}
        scopedCalls={scoped}
        range={range}
        tariffs={tariffs}
      />

      {/* Bottom 2-Column Row: Top Callers + SIM & Voice Bundles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Callers */}
        <section className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1]">
              Top people
            </h2>
            <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[#F2F0EC] dark:bg-[#0E1013]">
              {(
                [
                  { key: 'duration', label: 'Talk time' },
                  { key: 'count', label: 'Calls' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setCallerSort(opt.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    callerSort === opt.key
                      ? 'bg-white dark:bg-[#232730] text-[#14161A] dark:text-[#F4F4F1] shadow-xs'
                      : 'text-[#626874] dark:text-[#989EA9]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {topCallers.map((person) => {
              const val = callerSort === 'duration' ? person.duration : person.count;
              const pct = Math.max(6, Math.round((val / maxCallerMetric) * 100));
              const displayName = formatDisplayNameOrPhone(person.name, person.number);
              return (
                <button
                  key={person.number}
                  type="button"
                  onClick={() => onSelectContact(person.number)}
                  className="w-full text-left space-y-1.5 group"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[#14161A] dark:text-[#F4F4F1] group-hover:text-[#E45A0D] truncate transition-colors">
                      {displayName}
                    </span>
                    <span className="font-mono tabular-nums text-[#626874] dark:text-[#989EA9] shrink-0">
                      {callerSort === 'duration'
                        ? formatDuration(person.duration)
                        : `${person.count} calls`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#F2F0EC] dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#E45A0D]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* SIM Usage, Active Voice Bundles & Carrier USSD */}
        <section className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1]">
              SIM cards &amp; bundles
            </h2>
            <button
              type="button"
              onClick={() => setUssdOpen(true)}
              className="min-h-[34px] px-3 rounded-lg border border-[#E5E2DC] dark:border-white/[0.1] text-xs font-medium text-[#14161A] dark:text-[#F4F4F1] hover:border-[#E45A0D] flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Hash size={13} />
              <span>USSD codes</span>
            </button>
          </div>

          <div className="divide-y divide-[#F0EEE9] dark:divide-white/[0.06]">
            {sims.map((s) => (
              <div key={s.sim} className="py-3 first:pt-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] truncate">
                    {s.sim === 'SIM 1' || s.sim === 'SIM 2'
                      ? formatSimDisplay(s.sim, simLabels)
                      : s.sim}
                  </p>
                  <p className="text-xs text-[#626874] dark:text-[#989EA9] tabular-nums">
                    {s.count} calls · {formatDuration(s.duration)}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#626874] dark:text-[#989EA9]">
                  {scoped.length > 0 ? `${Math.round((s.count / scoped.length) * 100)}%` : '0%'}
                </span>
              </div>
            ))}
          </div>

          {(sim1Bundle || sim2Bundle) && (
            <div className="pt-2 border-t border-[#F0EEE9] dark:divide-white/[0.06] space-y-3">
              {[
                { label: voiceBundles.sim1.name, slot: 'SIM 1', status: sim1Bundle },
                { label: voiceBundles.sim2.name, slot: 'SIM 2', status: sim2Bundle },
              ]
                .filter((b) => b.status !== null)
                .map((b) => (
                  <div key={b.slot} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#14161A] dark:text-[#F4F4F1] truncate">
                        {b.label}
                      </span>
                      <span className="font-mono tabular-nums text-[#626874] dark:text-[#989EA9] shrink-0">
                        {b.status!.remainingMinutes}m left
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#F2F0EC] dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#16A34A]"
                        style={{ width: `${b.status!.percentRemaining}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      <CarrierUssdModal open={ussdOpen} onClose={() => setUssdOpen(false)} />
    </div>
  );
}
