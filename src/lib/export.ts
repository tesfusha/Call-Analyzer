import { Filesystem, Directory } from '@capacitor/filesystem';
import { APP_VERSION } from '@/src/lib/appInfo';
import {
  hasNativeFileExportPlugin,
  isNativeCapacitor,
  runNativeFileExport,
} from '@/src/lib/capacitor';
import { estimateCallCostEtb, formatEtb, formatSimDisplay, type TariffConfig } from '@/src/lib/ethiopia';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { formatDateTime, formatDuration } from '@/src/lib/format';
import { computeScoreFromHistory } from '@/src/lib/gamification';
import { CURRENT_BACKUP_SCHEMA_VERSION } from '@/src/lib/import';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { carrierStats, computeTotals, contactStats, totalSpendEtb } from '@/src/lib/stats';
import type {
  BackupSettingsSnapshot,
  BadgeRecord,
  CallRecord,
  ContactMilestoneRecord,
  ContactProfile,
  PointsHistoryEntry,
  ReconnectProgressRecord,
  ScheduledCall,
  SentWishRecord,
  SimLabels,
  StreakRecord,
  WishTemplateMap,
} from '@/src/types/call';

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
    const displayName = call.name ? formatDisplayNameOrPhone(call.name, call.number) : '';
    lines.push(
      [
        call.number,
        displayName,
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

export type VersionedBackupInput = {
  calls: CallRecord[];
  tags?: string[];
  contacts?: ContactProfile[];
  settings?: BackupSettingsSnapshot;
  streaks?: StreakRecord;
  score?: number;
  pointsHistory?: PointsHistoryEntry[];
  badges?: BadgeRecord[];
  contactMilestones?: ContactMilestoneRecord[];
  scheduledCalls?: ScheduledCall[];
  favorites?: string[];
  dismissedMissedIds?: string[];
  mutedAlertKeys?: string[];
  wishTemplates?: WishTemplateMap;
  sentWishes?: SentWishRecord[];
  snoozedQuietUntil?: Record<string, number>;
  reconnectProgress?: ReconnectProgressRecord;
};

export function buildVersionedBackupJson(input: VersionedBackupInput): string {
  const sortedCalls = [...input.calls].sort((a, b) => b.timestamp - a.timestamp);
  const contactsList = input.contacts ?? [];
  const scheduledList = input.scheduledCalls ?? [];
  const tags = Array.from(
    new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean)),
  );

  const pointsHistory = input.pointsHistory ?? [];
  const score =
    typeof input.score === 'number' && Number.isFinite(input.score)
      ? Math.max(0, Math.round(input.score))
      : computeScoreFromHistory(pointsHistory);

  const payload = {
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    calls: sortedCalls,
    tags,
    contacts: contactsList,
    settings: input.settings ?? {},
    streaks: input.streaks ?? {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      totalActiveDays: 0,
    },
    score,
    pointsHistory,
    badges: input.badges ?? [],
    contactMilestones: input.contactMilestones ?? [],
    scheduledCalls: scheduledList,
    favorites: input.favorites ?? [],
    dismissedMissedIds: input.dismissedMissedIds ?? [],
    mutedAlertKeys: input.mutedAlertKeys ?? [],
    wishTemplates: input.wishTemplates ?? {},
    sentWishes: input.sentWishes ?? [],
    snoozedQuietUntil: input.snoozedQuietUntil ?? {},
    reconnectProgress: input.reconnectProgress ?? { weekKey: '', contactedKeys: [] },
  };

  return JSON.stringify(payload, null, 2);
}

export function callsToJson(calls: CallRecord[]): string {
  return buildVersionedBackupJson({ calls });
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
        `<tr><td>${escapeHtml(formatDisplayNameOrPhone(c.name, c.number))}</td><td>${escapeHtml(c.number)}</td><td>${c.count}</td><td>${escapeHtml(formatDuration(c.duration))}</td></tr>`,
    )
    .join('');

  const callRows = sorted
    .slice(0, 250)
    .map(
      (c) =>
        `<tr><td>${escapeHtml(formatDisplayNameOrPhone(c.name, c.number))}</td><td>${escapeHtml(c.number)}</td><td>${escapeHtml(c.direction)}</td><td>${escapeHtml(c.sim ? formatSimDisplay(c.sim, simLabels) : '—')}</td><td>${escapeHtml(formatDateTime(c.timestamp))} (${escapeHtml(formatEthiopianShort(c.timestamp))} EC)</td><td>${escapeHtml(formatDuration(c.duration))}</td><td>${escapeHtml(c.direction === 'outgoing' && c.duration > 0 ? formatEtb(estimateCallCostEtb(c, tariffs)) : '—')}</td><td>${escapeHtml(c.tag ?? '')}</td></tr>`,
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

export type ExportDeliveryResult = 'native' | 'shared' | 'downloaded';

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function saveAndShareBytes(
  filename: string,
  bytes: Uint8Array,
  mimeType: string,
  shareTitle?: string,
  openShare = true,
): Promise<ExportDeliveryResult> {
  const baseMime = mimeType.split(';')[0]?.trim() || 'application/octet-stream';
  const base64Data = isNativeCapacitor() ? uint8ToBase64(bytes) : '';

  if (isNativeCapacitor() && hasNativeFileExportPlugin()) {
    try {
      const res = await runNativeFileExport({
        filename,
        mimeType: baseMime,
        base64Data,
        shareTitle: shareTitle || filename,
        openShare,
      });
      if (res?.saved || res?.shared) {
        return 'native';
      }
    } catch {
      // fall through to Capacitor Filesystem / Web Share fallback
    }
  }

  if (isNativeCapacitor()) {
    try {
      await Filesystem.writeFile({
        path: `Call Analyzer - ETH/${filename}`,
        data: base64Data || uint8ToBase64(bytes),
        directory: Directory.Documents,
        recursive: true,
      });
      return 'native';
    } catch {
      // fall through to Web Share if available
    }
  }

  if (
    isNativeCapacitor() &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    try {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const file = new File([copy.buffer], filename, { type: baseMime });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: shareTitle || filename,
        });
        return 'shared';
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return 'shared';
      }
      // fall through
    }
  }

  if (isNativeCapacitor()) {
    throw new Error('Could not write file to Android device storage.');
  }

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
  return 'downloaded';
}

export async function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
  shareTitle?: string,
): Promise<ExportDeliveryResult> {
  const bytes = new TextEncoder().encode(content);
  return saveAndShareBytes(filename, bytes, mimeType, shareTitle || filename);
}

export type QuickShareContactInput = {
  name: string;
  number: string;
  email?: string | null;
  tag?: string | null;
  note?: string | null;
};

export function buildContactVcard(input: QuickShareContactInput): string {
  const cleanName = (input.name || input.number || 'Contact').trim();
  const cleanNumber = (input.number || '').trim();
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${cleanName}`, `N:${cleanName};;;;`];
  if (cleanNumber) lines.push(`TEL;TYPE=CELL:${cleanNumber}`);
  if (input.email?.trim()) lines.push(`EMAIL;TYPE=INTERNET:${input.email.trim()}`);
  if (input.tag?.trim()) lines.push(`CATEGORIES:${input.tag.trim()}`);
  if (input.note?.trim()) lines.push(`NOTE:${input.note.trim().replace(/\r?\n/g, ' ')}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export async function shareContactVcard(
  input: QuickShareContactInput,
): Promise<'shared' | 'native' | 'copied'> {
  const cleanName = (input.name || input.number || 'Contact').trim();
  const vcf = buildContactVcard(input);
  const slug =
    cleanName
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'contact';
  const filename = `${slug}.vcf`;
  const bytes = new TextEncoder().encode(vcf);
  const summary = [
    cleanName,
    input.number?.trim(),
    input.email?.trim(),
    input.tag?.trim() ? `Tag: ${input.tag.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (isNativeCapacitor() && hasNativeFileExportPlugin()) {
    try {
      const res = await runNativeFileExport({
        filename,
        mimeType: 'text/vcard',
        base64Data: uint8ToBase64(bytes),
        shareTitle: `Share ${cleanName}`,
      });
      if (res?.saved || res?.shared) return 'native';
    } catch {
      // fall through
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const file = new File([copy.buffer], filename, { type: 'text/vcard' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: cleanName,
          text: summary,
        });
        return 'shared';
      }
      await navigator.share({
        title: cleanName,
        text: summary,
      });
      return 'shared';
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  try {
    await navigator.clipboard.writeText(summary);
    return 'copied';
  } catch {
    await saveAndShareBytes(filename, bytes, 'text/vcard;charset=utf-8', `Share ${cleanName}`);
    return 'native';
  }
}
