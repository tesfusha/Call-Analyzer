import { useMemo, useState } from 'react';
import { Check, Copy, FileDown, FileText, Phone, ArrowRight } from 'lucide-react';
import { formatEtb } from '@/src/lib/ethiopia';
import { downloadTextFile } from '@/src/lib/export';
import { formatDuration } from '@/src/lib/format';
import {
  TrendChartV106,
  filterCallsForInsightsRange,
  type InsightsRangeKey,
} from '@/src/preview/v106/TrendChartV106';
import {
  buildBusinessCsvReport,
  buildBusinessHtmlReport,
  buildWhatsAppExecutiveSummary,
  computeBusinessMetrics,
  formatHourShort,
  formatMinutesCompact,
  isBusinessCall,
  type BusinessConfig,
  type CrmContactMeta,
} from '@/src/preview/v107/businessStore';
import { useCalls } from '@/src/store/CallsContext';

const RANGES: Array<{ key: InsightsRangeKey; label: string; full: string }> = [
  { key: '7d', label: '7D', full: 'Last 7 days' },
  { key: '14d', label: '14D', full: 'Last 14 days' },
  { key: '30d', label: '30D', full: 'Last 30 days' },
  { key: '90d', label: '90D', full: 'Last 90 days' },
  { key: 'all', label: 'All', full: 'All time' },
];

export function BusinessOverviewV107({
  config,
  crm,
  callOutcomes,
  onCallBack,
  onOpenLeadsTab,
  onSelectContact,
}: {
  config: BusinessConfig;
  crm: Record<string, CrmContactMeta>;
  callOutcomes: Record<string, string>;
  onCallBack: (number: string) => void;
  onOpenLeadsTab: () => void;
  onSelectContact: (number: string) => void;
}) {
  const { calls, tariffs, showNotice } = useCalls();
  const [range, setRange] = useState<InsightsRangeKey>('30d');
  const [copiedSummary, setCopiedSummary] = useState(false);

  const scoped = useMemo(() => filterCallsForInsightsRange(calls, range), [calls, range]);
  const allBusinessCalls = useMemo(
    () => calls.filter((c) => isBusinessCall(c, config, crm)),
    [calls, config, crm],
  );
  const metrics = useMemo(
    () => computeBusinessMetrics(calls, scoped, config, tariffs, crm),
    [calls, scoped, config, tariffs, crm],
  );

  const rangeFullLabel = RANGES.find((r) => r.key === range)?.full ?? 'Selected period';

  const handleCopyWhatsAppSummary = async () => {
    const text = buildWhatsAppExecutiveSummary(metrics, config, rangeFullLabel);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      showNotice('Executive summary copied for WhatsApp / Telegram.', 'success');
      window.setTimeout(() => setCopiedSummary(false), 2200);
    } catch {
      showNotice('Could not copy to clipboard on this browser.');
    }
  };

  const handleExportCsv = async () => {
    const csv = buildBusinessCsvReport(metrics, config, tariffs, crm, callOutcomes);
    const slug = (config.businessName || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await downloadTextFile(`${slug}-calls-${range}.csv`, csv, 'text/csv;charset=utf-8');
    showNotice('Business CSV report exported.', 'success');
  };

  const handleExportHtml = async () => {
    const html = buildBusinessHtmlReport(metrics, config, rangeFullLabel);
    const slug = (config.businessName || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await downloadTextFile(`${slug}-executive-report-${range}.html`, html, 'text/html;charset=utf-8');
    showNotice('Printable business report exported.', 'success');
  };

  if (calls.length === 0) {
    return (
      <div className="space-y-4">
        <h1
          className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
          style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
        >
          {config.businessName || 'Business Overview'}
        </h1>
        <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-10 text-center space-y-2">
          <p className="text-base font-semibold text-[#14161A] dark:text-[#F4F4F1]">
            No business call data yet
          </p>
          <p className="text-sm text-[#626874] dark:text-[#989EA9] max-w-md mx-auto">
            Sync your Android call log or import a CSV/JSON file in the Calls tab to unlock answer rates, callback SLA speed, new inquiries, and airtime expense reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Executive Header + Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
            {config.businessSim === 'all' ? 'All SIMs' : `${config.businessSim} Business Line`} ·{' '}
            {formatHourShort(config.workStartHour)} – {formatHourShort(config.workEndHour)}
          </p>
          <h1
            className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
            style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
          >
            {config.businessName || 'Business Overview'}
          </h1>
        </div>

        <div
          role="group"
          aria-label="Business report range"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EAECEF] dark:bg-[#151921] self-start"
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
                    ? 'bg-white dark:bg-[#232936] text-[#14161A] dark:text-[#F4F4F1] shadow-xs'
                    : 'text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Urgent Unreturned Leads Banner (only shown if there are unreturned business leads) */}
      {metrics.unreturnedLeads.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#FECACA] dark:border-[#DC2626]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-semibold text-[#DC2626] dark:text-[#F87171]">
              {metrics.unreturnedLeads.length} unreturned business{' '}
              {metrics.unreturnedLeads.length === 1 ? 'lead' : 'leads'} waiting
            </p>
            <p className="text-xs text-[#626874] dark:text-[#989EA9] truncate">
              Most urgent:{' '}
              <button
                type="button"
                onClick={() => onSelectContact(metrics.unreturnedLeads[0].call.number)}
                className="font-semibold text-[#14161A] dark:text-[#F4F4F1] hover:underline"
              >
                {metrics.unreturnedLeads[0].displayName}
              </button>{' '}
              · {metrics.unreturnedLeads[0].isNewInquiry ? 'First-time caller' : 'Repeat caller'} ·
              waiting {formatMinutesCompact(metrics.unreturnedLeads[0].waitMinutes)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onCallBack(metrics.unreturnedLeads[0].call.number)}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#E45A0D] hover:bg-[#C94D09] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Phone size={13} />
              <span>Call back now</span>
            </button>
            <button
              type="button"
              onClick={onOpenLeadsTab}
              className="min-h-[38px] px-3 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1] flex items-center gap-1 whitespace-nowrap"
            >
              <span>Queue</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 4-Column Executive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-4 sm:p-5 space-y-1.5">
          <p className="text-xs text-[#626874] dark:text-[#989EA9]">Answer rate</p>
          <p
            className={`text-2xl font-bold font-mono tabular-nums ${
              metrics.answerRatePct >= 80
                ? 'text-[#16A34A] dark:text-[#4ADE80]'
                : metrics.answerRatePct >= 60
                  ? 'text-[#D97706] dark:text-[#FBBF24]'
                  : 'text-[#DC2626] dark:text-[#F87171]'
            }`}
          >
            {metrics.answerRatePct}%
          </p>
          <p className="text-[11px] text-[#626874] dark:text-[#989EA9] tabular-nums">
            {metrics.inHoursAnswerRatePct}% in-hours · {metrics.incomingMissed} missed
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-4 sm:p-5 space-y-1.5">
          <p className="text-xs text-[#626874] dark:text-[#989EA9]">Avg callback speed</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#14161A] dark:text-[#F4F4F1]">
            {formatMinutesCompact(metrics.avgCallbackMinutes)}
          </p>
          <p className="text-[11px] text-[#626874] dark:text-[#989EA9] tabular-nums">
            {metrics.slaHitRatePct !== null
              ? `${metrics.slaHitRatePct}% under ${config.slaTargetMinutes}m goal`
              : `Goal: under ${config.slaTargetMinutes}m`}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-4 sm:p-5 space-y-1.5">
          <p className="text-xs text-[#626874] dark:text-[#989EA9]">New inquiries</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#14161A] dark:text-[#F4F4F1]">
            {metrics.newInquiries.length}
          </p>
          <p className="text-[11px] text-[#626874] dark:text-[#989EA9] tabular-nums">
            First-time callers · {metrics.businessCalls.length} biz calls
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-4 sm:p-5 space-y-1.5">
          <p className="text-xs text-[#626874] dark:text-[#989EA9]">Business airtime</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#14161A] dark:text-[#F4F4F1]">
            {formatEtb(metrics.businessSpendEtb)}
          </p>
          <p className="text-[11px] text-[#626874] dark:text-[#989EA9] tabular-nums">
            {formatDuration(metrics.totalTalkSeconds)} talk ·{' '}
            {metrics.personalCallsCount > 0
              ? `${metrics.personalCallsCount} personal excl.`
              : 'All calls incl.'}
          </p>
        </div>
      </div>

      {/* Multi-Range Business Trend Chart (7D / 14D / 30D / 90D / All) */}
      <TrendChartV106
        allCalls={allBusinessCalls}
        scopedCalls={metrics.businessCalls}
        range={range}
        tariffs={tariffs}
      />

      {/* Bottom 2-Column Row: Peak Customer Hours + Executive Report / Pipeline Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Peak Customer Hours */}
        <section className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1]">
                Peak customer hours
              </h2>
              <p className="text-xs text-[#626874] dark:text-[#989EA9]">
                Busiest window:{' '}
                <span className="font-semibold text-[#14161A] dark:text-[#F4F4F1]">
                  {metrics.peakWindowLabel}
                </span>
              </p>
            </div>
            <div className="text-right text-[11px] text-[#626874] dark:text-[#989EA9] tabular-nums">
              <p>{metrics.inHoursCount} in-hours</p>
              <p>{metrics.afterHoursCount} after-hours</p>
            </div>
          </div>

          <div className="h-32 flex items-end gap-1 pt-2" aria-label="Hourly call distribution">
            {metrics.hourlyCounts.map((count, hour) => {
              const pct =
                metrics.peakHourCount > 0 ? Math.max(4, Math.round((count / metrics.peakHourCount) * 100)) : 4;
              const inHours = hour >= config.workStartHour && hour < config.workEndHour;
              return (
                <div
                  key={hour}
                  title={`${formatHourShort(hour)}: ${count} calls (${inHours ? 'Business hours' : 'After hours'})`}
                  className="flex-1 flex flex-col items-center justify-end h-full"
                >
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      count === 0
                        ? 'bg-[#EAECEF] dark:bg-white/[0.06]'
                        : inHours
                          ? 'bg-[#0F2544] dark:bg-[#F4762C]'
                          : 'bg-[#CBD5E1] dark:bg-white/25'
                    }`}
                    style={{ height: `${count === 0 ? 4 : pct}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#7A808C] dark:text-[#8B92A0]">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>

          <p className="text-xs text-[#626874] dark:text-[#989EA9]">
            {metrics.afterHoursMissedCount > 0
              ? `${metrics.afterHoursMissedCount} missed calls came in after business hours — check Leads each morning.`
              : 'No missed calls outside your configured business hours.'}
          </p>
        </section>

        {/* Shareable Reports & Pipeline Summary */}
        <section className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-5 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1]">
              Pipeline &amp; shareable reports
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#F6F7F8] dark:bg-[#0D1014] p-3.5 space-y-1">
                <p className="text-[11px] text-[#626874] dark:text-[#989EA9]">Active pipeline</p>
                <p className="text-lg font-bold font-mono tabular-nums text-[#14161A] dark:text-[#F4F4F1]">
                  {formatEtb(metrics.pipelineValueEtb)}
                </p>
                <p className="text-[11px] text-[#626874] dark:text-[#989EA9] tabular-nums">
                  {metrics.activeLeadCount} open leads
                </p>
              </div>
              <div className="rounded-xl bg-[#F6F7F8] dark:bg-[#0D1014] p-3.5 space-y-1">
                <p className="text-[11px] text-[#626874] dark:text-[#989EA9]">Closed / Won</p>
                <p className="text-lg font-bold font-mono tabular-nums text-[#16A34A] dark:text-[#4ADE80]">
                  {formatEtb(metrics.wonValueEtb)}
                </p>
                <p className="text-[11px] text-[#626874] dark:text-[#989EA9]">Tracked in CRM</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs text-[#626874] dark:text-[#989EA9]">
              Send a clean summary to your manager, team, or accountant:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyWhatsAppSummary}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#0F2544] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap hover:opacity-90 transition-opacity"
              >
                {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedSummary ? 'Copied summary' : 'Copy WhatsApp summary'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="min-h-[40px] px-3.5 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1] hover:border-[#E45A0D] flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <FileDown size={14} />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportHtml}
                className="min-h-[40px] px-3.5 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1] hover:border-[#E45A0D] flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <FileText size={14} />
                <span>Print report</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
