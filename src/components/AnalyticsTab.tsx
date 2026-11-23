import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ChevronDown, FileDown, FileText } from 'lucide-react';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import {
  CarrierUsageChart,
  DirectionSplitChart,
  DurationTrendChart,
  FrequencyBarChart,
  HorizontalUsageBar,
  PeakHoursHeatmap,
} from '@/src/components/Charts';
import { DateRangePicker } from '@/src/components/DateRangePicker';
import { formatEtb } from '@/src/lib/ethiopia';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { callsToHtmlReport, downloadTextFile } from '@/src/lib/export';
import { formatDuration } from '@/src/lib/format';
import { exportCallHistoryPdfReport } from '@/src/lib/pdfExport';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import {
  busiestDay,
  carrierStats,
  computeTotals,
  contactStats,
  dailyBuckets,
  durationTrends,
  filterByRange,
  heatmapBuckets,
  topByDuration,
  totalSpendEtb,
} from '@/src/lib/stats';
import { useCalls } from '@/src/store/CallsContext';
import type { DateRangeFilter, TimeRange } from '@/src/types/call';

type SubTab = 'overview' | 'summary' | 'contacts';

const SUB_TAB_META: Record<SubTab, { title: string; description: string }> = {
  overview: {
    title: 'Usage Overview & Charts',
    description: 'Call volume, airtime spend, carrier split, and interactive charts',
  },
  summary: {
    title: 'Talk-Time Trends & Highlights',
    description: 'Talk-time highlights and 7-day / 30-day duration trends',
  },
  contacts: {
    title: 'Most Frequent & Longest Callers',
    description: 'Most frequent callers and longest total conversations',
  },
};

export function AnalyticsTab({
  onSelectContact,
}: {
  onSelectContact: (number: string) => void;
}) {
  const { calls, tariffs, simLabels, privacyMode, loadSampleData, showNotice } = useCalls();
  const [range, setRange] = useState<TimeRange>('all');
  const [customRange, setCustomRange] = useState<DateRangeFilter>(null);
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [exportMenuOpen]);

  const scoped = useMemo(
    () => filterByRange(calls, range, new Date(), customRange),
    [calls, range, customRange],
  );
  const totals = useMemo(() => computeTotals(scoped), [scoped]);
  const buckets = useMemo(() => dailyBuckets(scoped), [scoped]);
  const heatmap = useMemo(() => heatmapBuckets(scoped), [scoped]);
  const contacts = useMemo(() => contactStats(scoped), [scoped]);
  const trends = useMemo(() => durationTrends(scoped), [scoped]);
  const busiest = useMemo(() => busiestDay(scoped), [scoped]);
  const topTalker = useMemo(() => topByDuration(scoped), [scoped]);
  const carriers = useMemo(() => carrierStats(scoped, tariffs), [scoped, tariffs]);
  const scopedSpend = useMemo(() => totalSpendEtb(scoped, tariffs), [scoped, tariffs]);
  const monthlySpend = useMemo(
    () => totalSpendEtb(filterByRange(calls, '30d'), tariffs),
    [calls, tariffs],
  );

  const topByCount = useMemo(
    () => [...contacts].sort((a, b) => b.count - a.count).slice(0, 8),
    [contacts],
  );
  const topByDur = useMemo(
    () => [...contacts].sort((a, b) => b.duration - a.duration).slice(0, 8),
    [contacts],
  );

  const categoryItems: Array<CategoryItem<SubTab>> = useMemo(
    () => [
      { key: 'overview', label: 'Overview' },
      { key: 'summary', label: 'Trends' },
      { key: 'contacts', label: 'Top Callers', count: contacts.length },
    ],
    [contacts.length],
  );

  const activeMeta = SUB_TAB_META[subTab];

  if (calls.length === 0) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center mx-auto">
          <BarChart3 size={22} />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h2 className="text-base font-semibold text-[#08246B] dark:text-white">
            Nothing to analyse yet
          </h2>
          <p className="text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            Import a call log or load sample data to inspect talk-time splits, frequency trends, and peak hours.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const counts = loadSampleData();
            showNotice(`Loaded ${counts.added} sample calls.`);
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap shrink-0"
        >
          Load sample data
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#08246B] dark:text-white">Analytics</h1>
          <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
            {activeMeta.description} · {scoped.length} calls ·{' '}
            {formatEthiopianShort(new Date())} EC
          </p>
        </div>

        <div ref={exportMenuRef} className="relative shrink-0">
          <button
            type="button"
            disabled={scoped.length === 0 || exportingPdf}
            onClick={() => setExportMenuOpen((prev) => !prev)}
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#08246B] hover:bg-[#0D328E] dark:bg-[#FF6A00] dark:hover:bg-[#E65F00] disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <FileDown size={14} />
            {exportingPdf ? 'Generating...' : 'Export'}
            <ChevronDown size={13} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportMenuOpen && (
            <div
              role="menu"
              aria-label="Export report options"
              className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-xl p-1.5 space-y-0.5 z-40"
            >
              <button
                type="button"
                role="menuitem"
                disabled={exportingPdf}
                onClick={async () => {
                  setExportMenuOpen(false);
                  setExportingPdf(true);
                  try {
                    await exportCallHistoryPdfReport({
                      calls: scoped,
                      tariffs,
                      simLabels,
                      privacyMode,
                      title: `Call History & Analytics Report (${range.toUpperCase()})`,
                      filename: `call-report-${range}.pdf`,
                    });
                    showNotice('Formatted PDF report with charts downloaded.');
                  } catch {
                    showNotice('Could not generate PDF report.');
                  } finally {
                    setExportingPdf(false);
                  }
                }}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
              >
                <FileDown size={14} className="text-[#FF6A00] shrink-0" />
                <span>PDF Report (charts)</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setExportMenuOpen(false);
                  const html = callsToHtmlReport(
                    scoped,
                    tariffs,
                    simLabels,
                    `Call Analyzer - ETH Statement (${range})`,
                    privacyMode,
                  );
                  const delivery = await downloadTextFile(
                    'call-statement.html',
                    html,
                    'text/html;charset=utf-8',
                    'Call Statement (.html)',
                  );
                  showNotice(
                    delivery === 'native'
                      ? 'Statement saved to Downloads & ready to share.'
                      : 'Printable statement (.html) exported.',
                  );
                }}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
              >
                <FileText size={14} className="text-[#4FA3F7] shrink-0" />
                <span>HTML Statement</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <DateRangePicker
        range={range}
        customRange={customRange}
        onChangeRange={setRange}
        onChangeCustomRange={setCustomRange}
      />

      <CategoryTabs
        items={categoryItems}
        activeKey={subTab}
        onChange={setSubTab}
        ariaLabel="Analytics categories"
      />

      {scoped.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-8 text-center space-y-2">
          <h2 className="text-base font-semibold text-[#08246B] dark:text-white">
            No calls in this timeframe
          </h2>
          <p className="text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            Expand the start/end date range or switch back to All to inspect your full call log.
          </p>
        </div>
      ) : (
        <CategoryPanel activeKey={subTab} label={activeMeta.title}>
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-bold text-[#08246B] dark:text-white">
              {activeMeta.title}
            </h2>
          </div>
          {subTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total calls', value: String(totals.totalCalls) },
              { label: 'Talk time', value: formatDuration(totals.totalDuration) },
              { label: 'Est. spend', value: formatEtb(scopedSpend) },
              { label: 'Missed calls', value: String(totals.missedCount) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-1"
              >
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">{stat.label}</p>
                <p className="text-xl sm:text-2xl font-bold tabular-nums text-[#08246B] dark:text-white truncate">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {tariffs.monthlyBudgetEtb > 0 && (
            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#08246B] dark:text-white">
                  30-day airtime budget
                </span>
                <span className="font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  {formatEtb(monthlySpend)} / {formatEtb(tariffs.monthlyBudgetEtb)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E5E9F0] dark:bg-[var(--dark-canvas)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((monthlySpend / tariffs.monthlyBudgetEtb) * 100))}%`,
                    backgroundColor:
                      monthlySpend > tariffs.monthlyBudgetEtb ? '#EF4444' : '#FF6A00',
                  }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Direction split
              </h2>
              <DirectionSplitChart
                incoming={totals.incomingCount}
                outgoing={totals.outgoingCount}
                missed={totals.missedCount}
                incomingDuration={totals.incomingDuration}
                outgoingDuration={totals.outgoingDuration}
              />
            </div>

            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Call frequency (recent days)
              </h2>
              <FrequencyBarChart buckets={buckets} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Network / carrier split
              </h2>
              <CarrierUsageChart carriers={carriers} formatCurrency={formatEtb} />
            </div>

            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Peak hours heatmap
              </h2>
              <PeakHoursHeatmap cells={heatmap} />
            </div>
          </div>
        </div>
      )}

      {subTab === 'summary' && (
        <div className="space-y-4">
          {buckets.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Daily talk-time trend
              </h2>
              <DurationTrendChart buckets={buckets} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
              Highlights
            </h2>
            <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] text-sm">
              {[
                { label: 'Unique contacts', value: String(totals.uniqueContacts) },
                {
                  label: 'Incoming talk time',
                  value: formatDuration(totals.incomingDuration),
                },
                {
                  label: 'Outgoing talk time',
                  value: formatDuration(totals.outgoingDuration),
                },
                {
                  label: 'Busiest day',
                  value: busiest ? `${busiest.label} (${busiest.count} calls)` : '–',
                },
                {
                  label: 'Top talker',
                  value: topTalker
                    ? `${formatDisplayNameOrPhone(topTalker.name, topTalker.number, privacyMode)} (${formatDuration(topTalker.duration)})`
                    : '–',
                },
              ].map((row) => (
                <div key={row.label} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">{row.label}</span>
                  <span className="font-semibold tabular-nums text-[#08246B] dark:text-white text-right">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
              Duration trends
            </h2>
            <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] text-sm">
              {[
                { label: 'Overall average', value: formatDuration(trends.avgAll) },
                { label: 'Last 7 days average', value: formatDuration(trends.avg7d) },
                { label: 'Last 30 days average', value: formatDuration(trends.avg30d) },
                {
                  label: 'Longest single call',
                  value: trends.longest
                    ? `${formatDisplayNameOrPhone(trends.longest.name, trends.longest.number, privacyMode)} (${formatDuration(trends.longest.duration)})`
                    : '–',
                },
              ].map((row) => (
                <div key={row.label} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">{row.label}</span>
                  <span className="font-semibold tabular-nums text-[#08246B] dark:text-white text-right">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      )}

      {subTab === 'contacts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Most called (by count)
              </h2>
              <span className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">Tap contact for details</span>
            </div>
            <div className="space-y-3">
              {topByCount.map((contact) => {
                const max = Math.max(1, topByCount[0]?.count ?? 1);
                return (
                  <button
                    key={contact.number}
                    type="button"
                    onClick={() => onSelectContact(contact.number)}
                    className="w-full text-left rounded-xl p-2 -mx-2 hover:bg-[#EEF2F6]/70 dark:hover:bg-[var(--dark-elevated-70)] transition-colors"
                  >
                    <HorizontalUsageBar
                      label={formatDisplayNameOrPhone(contact.name, contact.number, privacyMode)}
                      valueLabel={`${contact.count} calls`}
                      subLabel={`${formatDuration(contact.duration)} total`}
                      percent={(contact.count / max) * 100}
                      color="#4FA3F7"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Longest talkers (by duration)
              </h2>
              <span className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">Tap contact for details</span>
            </div>
            <div className="space-y-3">
              {topByDur.map((contact) => {
                const max = Math.max(1, topByDur[0]?.duration ?? 1);
                return (
                  <button
                    key={contact.number}
                    type="button"
                    onClick={() => onSelectContact(contact.number)}
                    className="w-full text-left rounded-xl p-2 -mx-2 hover:bg-[#EEF2F6]/70 dark:hover:bg-[var(--dark-elevated-70)] transition-colors"
                  >
                    <HorizontalUsageBar
                      label={formatDisplayNameOrPhone(contact.name, contact.number, privacyMode)}
                      valueLabel={formatDuration(contact.duration)}
                      subLabel={`${contact.count} calls`}
                      percent={(contact.duration / max) * 100}
                      color="#FF6A00"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
        </CategoryPanel>
      )}
    </div>
  );
}
