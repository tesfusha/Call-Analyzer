import { getContactKey } from '@/src/lib/contacts';
import { estimateCallCostEtb, formatEtb, normaliseEthPhone, type TariffConfig } from '@/src/lib/ethiopia';
import { formatDuration } from '@/src/lib/format';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import type { CallRecord } from '@/src/types/call';

export type BusinessSimScope = 'all' | 'SIM 1' | 'SIM 2';

export type BusinessStage = 'lead' | 'followup' | 'client' | 'won' | 'supplier' | 'personal';

export const BUSINESS_STAGES: Array<{
  key: BusinessStage;
  label: string;
  shortLabel: string;
  accentClass: string;
}> = [
  { key: 'lead', label: 'New Lead', shortLabel: 'Lead', accentClass: 'text-[#2563EB] dark:text-[#60A5FA]' },
  { key: 'followup', label: 'Follow-Up', shortLabel: 'Follow-Up', accentClass: 'text-[#D97706] dark:text-[#FBBF24]' },
  { key: 'client', label: 'Active Client', shortLabel: 'Client', accentClass: 'text-[#0F766E] dark:text-[#2DD4BF]' },
  { key: 'won', label: 'Closed / Won', shortLabel: 'Won', accentClass: 'text-[#16A34A] dark:text-[#4ADE80]' },
  { key: 'supplier', label: 'Supplier', shortLabel: 'Supplier', accentClass: 'text-[#7C3AED] dark:text-[#A78BFA]' },
  { key: 'personal', label: 'Personal', shortLabel: 'Personal', accentClass: 'text-[#626874] dark:text-[#989EA9]' },
];

export const QUICK_CALL_OUTCOMES = [
  'Price quote',
  'Order placed',
  'Callback needed',
  'Support issue',
  'Not interested',
] as const;

export type BusinessConfig = {
  businessName: string;
  businessSim: BusinessSimScope;
  workDays: number[]; // 0=Sun..6=Sat
  workStartHour: number; // 0..23
  workEndHour: number; // 1..24
  slaTargetMinutes: number; // e.g. 15, 30, 60
};

export type CrmContactMeta = {
  stage: BusinessStage;
  dealValueEtb: number;
  company: string;
  lastOutcome: string;
  updatedAt: number;
};

export type BusinessStateSnapshot = {
  config: BusinessConfig;
  crm: Record<string, CrmContactMeta>; // keyed by getContactKey(number)
  callOutcomes: Record<string, string>; // keyed by call.id
};

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  businessName: 'My Business',
  businessSim: 'all',
  workDays: [1, 2, 3, 4, 5, 6], // Mon-Sat common in Ethiopia
  workStartHour: 8,
  workEndHour: 18,
  slaTargetMinutes: 30,
};

function storageKeyFor(uid: string | null): string {
  return `callanalyzer.v107.business.${uid || 'guest'}.v1`;
}

export function loadBusinessState(uid: string | null): BusinessStateSnapshot {
  const fallback: BusinessStateSnapshot = {
    config: { ...DEFAULT_BUSINESS_CONFIG },
    crm: {},
    callOutcomes: {},
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKeyFor(uid));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BusinessStateSnapshot>;
    return {
      config: {
        ...DEFAULT_BUSINESS_CONFIG,
        ...(parsed.config ?? {}),
        workDays: Array.isArray(parsed.config?.workDays)
          ? parsed.config.workDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
          : DEFAULT_BUSINESS_CONFIG.workDays,
      },
      crm: parsed.crm && typeof parsed.crm === 'object' ? parsed.crm : {},
      callOutcomes:
        parsed.callOutcomes && typeof parsed.callOutcomes === 'object' ? parsed.callOutcomes : {},
    };
  } catch {
    return fallback;
  }
}

export function saveBusinessState(uid: string | null, state: BusinessStateSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKeyFor(uid), JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function isWithinBusinessHours(ts: number, config: BusinessConfig): boolean {
  const d = new Date(ts);
  if (!config.workDays.includes(d.getDay())) return false;
  const h = d.getHours();
  return h >= config.workStartHour && h < config.workEndHour;
}

export function isBusinessCall(
  call: CallRecord,
  config: BusinessConfig,
  crm: Record<string, CrmContactMeta>,
): boolean {
  const key = getContactKey(call.number);
  if (crm[key]?.stage === 'personal') return false;
  if (config.businessSim !== 'all' && call.sim && call.sim !== config.businessSim) {
    return false;
  }
  return true;
}

export type UnreturnedLeadItem = {
  call: CallRecord;
  contactKey: string;
  displayName: string;
  isNewInquiry: boolean;
  afterHours: boolean;
  waitMinutes: number;
  missedAttempts: number;
};

export type NewInquiryItem = {
  contactKey: string;
  number: string;
  displayName: string;
  firstCall: CallRecord;
  totalCallsInPeriod: number;
  totalDurationInPeriod: number;
  wasAnswered: boolean;
};

export type BusinessMetrics = {
  businessCalls: CallRecord[];
  personalCallsCount: number;
  inHoursCount: number;
  afterHoursCount: number;
  incomingTotal: number;
  incomingAnswered: number;
  incomingMissed: number;
  answerRatePct: number;
  inHoursAnswerRatePct: number;
  afterHoursMissedCount: number;
  returnedCount: number;
  returnedWithinSlaCount: number;
  slaHitRatePct: number | null;
  avgCallbackMinutes: number | null;
  unreturnedLeads: UnreturnedLeadItem[];
  newInquiries: NewInquiryItem[];
  hourlyCounts: number[]; // 24 buckets
  peakWindowLabel: string;
  peakHourCount: number;
  businessSpendEtb: number;
  personalSpendEtb: number;
  totalTalkSeconds: number;
  pipelineValueEtb: number;
  wonValueEtb: number;
  activeLeadCount: number;
};

export function formatHourShort(h: number): string {
  const normalized = ((h % 24) + 24) % 24;
  if (normalized === 0) return '12 AM';
  if (normalized === 12) return '12 PM';
  return normalized < 12 ? `${normalized} AM` : `${normalized - 12} PM`;
}

export function formatMinutesCompact(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '–';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const remH = h % 24;
    return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function computeBusinessMetrics(
  allCalls: CallRecord[],
  scopedCalls: CallRecord[],
  config: BusinessConfig,
  tariffs: TariffConfig,
  crm: Record<string, CrmContactMeta>,
  nowMs: number = Date.now(),
): BusinessMetrics {
  // Earliest timestamp ever seen per normalized phone across all calls
  const earliestByKey = new Map<string, number>();
  for (const c of allCalls) {
    const k = normaliseEthPhone(c.number) || c.number.trim();
    const prev = earliestByKey.get(k);
    if (prev === undefined || c.timestamp < prev) {
      earliestByKey.set(k, c.timestamp);
    }
  }

  const businessCalls: CallRecord[] = [];
  let personalCallsCount = 0;
  let businessSpendEtb = 0;
  let personalSpendEtb = 0;

  for (const c of scopedCalls) {
    const cost = estimateCallCostEtb(c, tariffs);
    if (isBusinessCall(c, config, crm)) {
      businessCalls.push(c);
      businessSpendEtb += cost;
    } else {
      personalCallsCount += 1;
      personalSpendEtb += cost;
    }
  }

  let inHoursCount = 0;
  let afterHoursCount = 0;
  let incomingTotal = 0;
  let incomingAnswered = 0;
  let incomingMissed = 0;
  let inHoursIncomingTotal = 0;
  let inHoursIncomingAnswered = 0;
  let afterHoursMissedCount = 0;
  let totalTalkSeconds = 0;

  const hourlyCounts = new Array<number>(24).fill(0);
  const minScopedTs =
    scopedCalls.length > 0
      ? scopedCalls.reduce((m, c) => (c.timestamp < m ? c.timestamp : m), Infinity)
      : 0;

  for (const c of businessCalls) {
    totalTalkSeconds += c.duration;
    const inHours = isWithinBusinessHours(c.timestamp, config);
    if (inHours) inHoursCount += 1;
    else afterHoursCount += 1;

    const hr = new Date(c.timestamp).getHours();
    hourlyCounts[hr] += 1;

    if (c.direction === 'incoming' || c.direction === 'missed' || c.direction === 'rejected') {
      incomingTotal += 1;
      if (inHours) inHoursIncomingTotal += 1;

      if (c.direction === 'incoming' && c.duration > 0) {
        incomingAnswered += 1;
        if (inHours) inHoursIncomingAnswered += 1;
      } else {
        incomingMissed += 1;
        if (!inHours) afterHoursMissedCount += 1;
      }
    }
  }

  // Group all business calls chronologically per contact to compute callback SLA & unreturned leads
  const allBizSorted = allCalls
    .filter((c) => isBusinessCall(c, config, crm))
    .sort((a, b) => a.timestamp - b.timestamp);

  const callsByContact = new Map<string, CallRecord[]>();
  for (const c of allBizSorted) {
    const k = normaliseEthPhone(c.number) || c.number.trim();
    const list = callsByContact.get(k);
    if (list) list.push(c);
    else callsByContact.set(k, [c]);
  }

  const scopedIdSet = new Set(businessCalls.map((c) => c.id));
  const callbackDurationsMin: number[] = [];
  let returnedWithinSlaCount = 0;
  const unreturnedMap = new Map<string, UnreturnedLeadItem>();

  for (const [normKey, timeline] of callsByContact.entries()) {
    let pendingMissed: CallRecord | null = null;
    let missedBurst = 0;

    for (const c of timeline) {
      const isMissedLike = c.direction === 'missed' || c.direction === 'rejected';
      const isAnsweredOrOut =
        c.direction === 'outgoing' || (c.direction === 'incoming' && c.duration > 0);

      if (isMissedLike) {
        if (!pendingMissed) {
          pendingMissed = c;
          missedBurst = 1;
        } else {
          missedBurst += 1;
        }
      } else if (isAnsweredOrOut && pendingMissed) {
        // Missed call was returned! Count toward SLA if the missed call is inside scoped period
        if (scopedIdSet.has(pendingMissed.id)) {
          const waitMin = Math.max(0.5, (c.timestamp - pendingMissed.timestamp) / 60_000);
          // Cap outlier callbacks > 48h from skewing average callback metric, still count as returned
          if (waitMin <= 48 * 60) {
            callbackDurationsMin.push(waitMin);
            if (waitMin <= config.slaTargetMinutes) {
              returnedWithinSlaCount += 1;
            }
          }
        }
        pendingMissed = null;
        missedBurst = 0;
      }
    }

    // If still unreturned at end of timeline AND happened within the scoped period (or recent 14d)
    if (pendingMissed && scopedIdSet.has(pendingMissed.id)) {
      const firstEver = earliestByKey.get(normKey) ?? pendingMissed.timestamp;
      const isNew = firstEver >= minScopedTs;
      unreturnedMap.set(normKey, {
        call: pendingMissed,
        contactKey: getContactKey(pendingMissed.number),
        displayName: formatDisplayNameOrPhone(pendingMissed.name, pendingMissed.number),
        isNewInquiry: isNew,
        afterHours: !isWithinBusinessHours(pendingMissed.timestamp, config),
        waitMinutes: Math.max(1, Math.round((nowMs - pendingMissed.timestamp) / 60_000)),
        missedAttempts: missedBurst,
      });
    }
  }

  // New Inquiries inside scoped period
  const newInquiryMap = new Map<string, NewInquiryItem>();
  const scopedBizSorted = [...businessCalls].sort((a, b) => a.timestamp - b.timestamp);
  for (const c of scopedBizSorted) {
    const normKey = normaliseEthPhone(c.number) || c.number.trim();
    const firstEver = earliestByKey.get(normKey) ?? c.timestamp;
    if (firstEver < minScopedTs) continue;
    const existing = newInquiryMap.get(normKey);
    const answered = c.direction === 'outgoing' || (c.direction === 'incoming' && c.duration > 0);
    if (!existing) {
      newInquiryMap.set(normKey, {
        contactKey: getContactKey(c.number),
        number: c.number,
        displayName: formatDisplayNameOrPhone(c.name, c.number),
        firstCall: c,
        totalCallsInPeriod: 1,
        totalDurationInPeriod: c.duration,
        wasAnswered: answered,
      });
    } else {
      existing.totalCallsInPeriod += 1;
      existing.totalDurationInPeriod += c.duration;
      if (answered) existing.wasAnswered = true;
    }
  }

  // Peak 2-hour window
  let bestStart = 9;
  let bestPairSum = -1;
  for (let h = 0; h < 23; h += 1) {
    const sum = hourlyCounts[h] + hourlyCounts[h + 1];
    if (sum > bestPairSum) {
      bestPairSum = sum;
      bestStart = h;
    }
  }
  const peakWindowLabel =
    bestPairSum > 0
      ? `${formatHourShort(bestStart)} – ${formatHourShort(bestStart + 2)}`
      : 'Not enough data';

  // Pipeline totals from CRM metadata
  let pipelineValueEtb = 0;
  let wonValueEtb = 0;
  let activeLeadCount = 0;
  for (const meta of Object.values(crm)) {
    const val = Number.isFinite(meta.dealValueEtb) && meta.dealValueEtb > 0 ? meta.dealValueEtb : 0;
    if (meta.stage === 'lead' || meta.stage === 'followup' || meta.stage === 'client') {
      pipelineValueEtb += val;
      if (meta.stage === 'lead' || meta.stage === 'followup') activeLeadCount += 1;
    } else if (meta.stage === 'won') {
      wonValueEtb += val;
    }
  }

  const avgCallbackMinutes =
    callbackDurationsMin.length > 0
      ? callbackDurationsMin.reduce((a, b) => a + b, 0) / callbackDurationsMin.length
      : null;

  const slaHitRatePct =
    callbackDurationsMin.length > 0
      ? Math.round((returnedWithinSlaCount / callbackDurationsMin.length) * 100)
      : null;

  const unreturnedLeads = [...unreturnedMap.values()].sort(
    (a, b) => Number(b.isNewInquiry) - Number(a.isNewInquiry) || b.call.timestamp - a.call.timestamp,
  );

  const newInquiries = [...newInquiryMap.values()].sort(
    (a, b) => b.firstCall.timestamp - a.firstCall.timestamp,
  );

  return {
    businessCalls,
    personalCallsCount,
    inHoursCount,
    afterHoursCount,
    incomingTotal,
    incomingAnswered,
    incomingMissed,
    answerRatePct: incomingTotal > 0 ? Math.round((incomingAnswered / incomingTotal) * 100) : 100,
    inHoursAnswerRatePct:
      inHoursIncomingTotal > 0
        ? Math.round((inHoursIncomingAnswered / inHoursIncomingTotal) * 100)
        : 100,
    afterHoursMissedCount,
    returnedCount: callbackDurationsMin.length,
    returnedWithinSlaCount,
    slaHitRatePct,
    avgCallbackMinutes,
    unreturnedLeads,
    newInquiries,
    hourlyCounts,
    peakWindowLabel,
    peakHourCount: Math.max(...hourlyCounts, 0),
    businessSpendEtb: Number(businessSpendEtb.toFixed(2)),
    personalSpendEtb: Number(personalSpendEtb.toFixed(2)),
    totalTalkSeconds,
    pipelineValueEtb,
    wonValueEtb,
    activeLeadCount,
  };
}

export function buildWhatsAppExecutiveSummary(
  metrics: BusinessMetrics,
  config: BusinessConfig,
  rangeLabel: string,
): string {
  const lines = [
    `*${config.businessName || 'Business'} — Call Report (${rangeLabel})*`,
    `• Business Calls: ${metrics.businessCalls.length} (${metrics.inHoursCount} in-hours · ${metrics.afterHoursCount} after-hours)`,
    `• Answer Rate: ${metrics.answerRatePct}% (${metrics.incomingAnswered}/${metrics.incomingTotal} answered)`,
    `• New Inquiries: ${metrics.newInquiries.length} first-time callers`,
    `• Avg Callback Speed: ${formatMinutesCompact(metrics.avgCallbackMinutes)}${
      metrics.slaHitRatePct !== null
        ? ` (${metrics.slaHitRatePct}% within ${config.slaTargetMinutes}m goal)`
        : ''
    }`,
    `• Unreturned Missed Leads: ${metrics.unreturnedLeads.length}`,
    `• Peak Customer Hours: ${metrics.peakWindowLabel}`,
    `• Talk Time: ${formatDuration(metrics.totalTalkSeconds)} · Airtime Cost: ${formatEtb(metrics.businessSpendEtb)}`,
  ];
  if (metrics.pipelineValueEtb > 0 || metrics.wonValueEtb > 0) {
    lines.push(
      `• CRM Pipeline: ${formatEtb(metrics.pipelineValueEtb)} active · ${formatEtb(metrics.wonValueEtb)} won`,
    );
  }
  return lines.join('\n');
}

function safeCsvCell(raw: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(raw) && !/^\+\d/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export function buildBusinessCsvReport(
  metrics: BusinessMetrics,
  config: BusinessConfig,
  tariffs: TariffConfig,
  crm: Record<string, CrmContactMeta>,
  callOutcomes: Record<string, string>,
): string {
  const header = [
    'date_time',
    'caller_name',
    'phone',
    'direction',
    'sim',
    'hours_window',
    'duration_sec',
    'estimated_cost_etb',
    'crm_stage',
    'deal_value_etb',
    'call_outcome',
  ];
  const rows = [header.join(',')];
  const sorted = [...metrics.businessCalls].sort((a, b) => b.timestamp - a.timestamp);
  for (const c of sorted) {
    const key = getContactKey(c.number);
    const meta = crm[key];
    const row = [
      new Date(c.timestamp).toISOString(),
      formatDisplayNameOrPhone(c.name, c.number),
      c.number,
      c.direction,
      c.sim ?? '',
      isWithinBusinessHours(c.timestamp, config) ? 'Business Hours' : 'After Hours',
      String(c.duration),
      String(estimateCallCostEtb(c, tariffs)),
      meta?.stage ?? '',
      meta?.dealValueEtb ? String(meta.dealValueEtb) : '',
      callOutcomes[c.id] ?? meta?.lastOutcome ?? '',
    ];
    rows.push(row.map(safeCsvCell).join(','));
  }
  return `\uFEFF${rows.join('\n')}`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildBusinessHtmlReport(
  metrics: BusinessMetrics,
  config: BusinessConfig,
  rangeLabel: string,
): string {
  const title = `${config.businessName || 'Business'} — Call Analysis Report (${rangeLabel})`;
  const leadRows = metrics.unreturnedLeads
    .slice(0, 20)
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.displayName)}</td><td>${escapeHtml(l.call.number)}</td><td>${
          l.isNewInquiry ? 'New Inquiry' : 'Returning'
        }</td><td>${escapeHtml(formatMinutesCompact(l.waitMinutes))} ago</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #14161A; max-width: 820px; margin: 32px auto; padding: 0 20px; line-height: 1.5; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #626874; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #E2E5EA; border-radius: 10px; padding: 14px; }
  .label { font-size: 11px; color: #626874; margin-bottom: 4px; }
  .val { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #ECEEF2; }
  th { color: #626874; font-weight: 600; font-size: 12px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="sub">Generated ${escapeHtml(new Date().toLocaleString())} · Working hours ${escapeHtml(formatHourShort(config.workStartHour))} – ${escapeHtml(formatHourShort(config.workEndHour))}</div>
  <div class="grid">
    <div class="card"><div class="label">Business Calls</div><div class="val">${metrics.businessCalls.length}</div></div>
    <div class="card"><div class="label">Answer Rate</div><div class="val">${metrics.answerRatePct}%</div></div>
    <div class="card"><div class="label">Avg Callback</div><div class="val">${escapeHtml(formatMinutesCompact(metrics.avgCallbackMinutes))}</div></div>
    <div class="card"><div class="label">Business Airtime</div><div class="val">${escapeHtml(formatEtb(metrics.businessSpendEtb))}</div></div>
  </div>
  <h2>Executive Summary</h2>
  <p>New first-time inquiries: <strong>${metrics.newInquiries.length}</strong> · Unreturned missed leads: <strong>${metrics.unreturnedLeads.length}</strong> · Peak customer hours: <strong>${escapeHtml(metrics.peakWindowLabel)}</strong> · Total talk time: <strong>${escapeHtml(formatDuration(metrics.totalTalkSeconds))}</strong>.</p>
  ${
    metrics.unreturnedLeads.length > 0
      ? `<h2>Unreturned Missed Leads</h2><table><thead><tr><th>Caller</th><th>Number</th><th>Type</th><th>Waiting</th></tr></thead><tbody>${leadRows}</tbody></table>`
      : '<p><strong>All missed business leads have been returned.</strong></p>'
  }
</body>
</html>`;
}
