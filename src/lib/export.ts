import { estimateCallCostEtb, formatEtb, formatSimDisplay, type TariffConfig } from '@/src/lib/ethiopia';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { formatDateTime, formatDuration } from '@/src/lib/format';
import { carrierStats, computeTotals, contactStats, totalSpendEtb } from '@/src/lib/stats';
import type { CallRecord, SimLabels } from '@/src/types/call';

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function callsToCsv(calls: CallRecord[]): string {
  const header = ['number', 'name', 'direction', 'sim', 'timestamp', 'duration', 'note', 'tag'];
  const lines = [header.join(',')];
  const sorted = [...calls].sort((a, b) => b.timestamp - a.timestamp);
  sorted.forEach((call) => {
    lines.push(
      [
        call.number,
        call.name ?? '',
        call.direction,
        call.sim ?? '',
        new Date(call.timestamp).toISOString(),
        String(call.duration),
        call.note ?? '',
        call.tag ?? '',
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  });
  return `\uFEFF${lines.join('\n')}`;
}

export function callsToJson(calls: CallRecord[]): string {
  const sorted = [...calls].sort((a, b) => b.timestamp - a.timestamp);
  return JSON.stringify({ exportedAt: new Date().toISOString(), calls: sorted }, null, 2);
}

export function callsToHtmlReport(
  calls: CallRecord[],
  tariffs: TariffConfig,
  simLabels: SimLabels,
  title = 'Call Analyzer - ETH Statement',
): string {
  const sorted = [...calls].sort((a, b) => b.timestamp - a.timestamp);
  const totals = computeTotals(sorted);
  const totalEtb = totalSpendEtb(sorted, tariffs);
  const carriers = carrierStats(sorted, tariffs);
  const topContacts = [...contactStats(sorted)].sort((a, b) => b.duration - a.duration).slice(0, 10);
  const generatedEc = formatEthiopianShort(new Date());
  const generatedGc = new Date().toLocaleString();

  const carrierRows = carriers
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.carrier)}</td><td>${c.count}</td><td>${escapeHtml(formatDuration(c.duration))}</td><td>${escapeHtml(formatEtb(c.spendEtb))}</td></tr>`,
    )
    .join('');

  const topRows = topContacts
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.number)}</td><td>${c.count}</td><td>${escapeHtml(formatDuration(c.duration))}</td></tr>`,
    )
    .join('');

  const callRows = sorted
    .slice(0, 250)
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.name?.trim() || c.number)}</td><td>${escapeHtml(c.number)}</td><td>${escapeHtml(c.direction)}</td><td>${escapeHtml(c.sim ? formatSimDisplay(c.sim, simLabels) : '—')}</td><td>${escapeHtml(formatDateTime(c.timestamp))} (${escapeHtml(formatEthiopianShort(c.timestamp))} EC)</td><td>${escapeHtml(formatDuration(c.duration))}</td><td>${escapeHtml(c.direction === 'outgoing' && c.duration > 0 ? formatEtb(estimateCallCostEtb(c, tariffs)) : '—')}</td><td>${escapeHtml(c.tag ?? '')}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, 'Noto Sans Ethiopic', sans-serif; color: #0f172a; margin: 28px auto; max-width: 960px; padding: 0 16px; line-height: 1.5; }
  header { border-bottom: 2px solid #FF6A00; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  h1 { margin: 0; font-size: 22px; color: #08246B; }
  h2 { font-size: 15px; color: #08246B; margin: 22px 0 8px; }
  .meta { font-size: 12px; color: #475569; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 18px; }
  .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; background: #f8fafc; }
  .card .k { font-size: 11px; color: #475569; text-transform: uppercase; }
  .card .v { font-size: 18px; font-weight: 700; color: #08246B; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; color: #08246B; }
  @media print { body { margin: 12px; } }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Generated ${escapeHtml(generatedGc)} · ${escapeHtml(generatedEc)} EC</div>
    </div>
    <div class="meta">Billing: ${escapeHtml(tariffs.billingMode)} · SIM 1: ${tariffs.sim1RatePerMin} ETB/min · SIM 2: ${tariffs.sim2RatePerMin} ETB/min</div>
  </header>
  <div class="grid">
    <div class="card"><div class="k">Total Calls</div><div class="v">${totals.totalCalls}</div></div>
    <div class="card"><div class="k">Talk Time</div><div class="v">${escapeHtml(formatDuration(totals.totalDuration))}</div></div>
    <div class="card"><div class="k">Est. Airtime Spend</div><div class="v">${escapeHtml(formatEtb(totalEtb))}</div></div>
    <div class="card"><div class="k">Missed Calls</div><div class="v">${totals.missedCount}</div></div>
  </div>
  <h2>Carrier Breakdown</h2>
  <table><thead><tr><th>Carrier</th><th>Calls</th><th>Duration</th><th>Est. Spend</th></tr></thead><tbody>${carrierRows || '<tr><td colspan="4">No carrier records</td></tr>'}</tbody></table>
  <h2>Top Contacts by Talk Time</h2>
  <table><thead><tr><th>Contact</th><th>Number</th><th>Calls</th><th>Duration</th></tr></thead><tbody>${topRows || '<tr><td colspan="4">No contacts</td></tr>'}</tbody></table>
  <h2>Call Log (Latest ${Math.min(sorted.length, 250)} of ${sorted.length})</h2>
  <table><thead><tr><th>Contact</th><th>Number</th><th>Direction</th><th>SIM</th><th>Time</th><th>Duration</th><th>Cost</th><th>Tag</th></tr></thead><tbody>${callRows || '<tr><td colspan="8">No calls logged</td></tr>'}</tbody></table>
</body>
</html>`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
