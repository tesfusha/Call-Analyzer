import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { APP_NAME } from '@/src/lib/appInfo';
import { isNativeCapacitor } from '@/src/lib/capacitor';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { saveAndShareBytes } from '@/src/lib/export';
import { formatDuration } from '@/src/lib/format';
import type {
  ContactBadgeItem,
  ContactMilestoneRecord,
  ContactStreakStatus,
} from '@/src/types/call';

export type MilestoneCardRenderOptions = {
  milestoneDays: number;
  milestoneTitle: string;
  reachedDate: string;
  pointsAwarded: number;
  includeName: boolean;
  contactName?: string | null;
  nickname?: string | null;
  relationshipTag?: string | null;
  totalDurationSeconds?: number;
  dateRangeLabel?: string;
  isStreakOnly?: boolean;
};

export function buildContactMilestoneShareRecord(
  status: ContactStreakStatus,
  existingMilestones: ContactMilestoneRecord[],
  specificBadge?: ContactBadgeItem,
): ContactMilestoneRecord | null {
  const badge =
    specificBadge && specificBadge.earned
      ? specificBadge
      : [...status.badges].reverse().find((b) => b.earned);

  if (badge) {
    const existing = existingMilestones.find(
      (m) => m.contactKey === status.contactKey && m.days === badge.days,
    );
    const matchingRun = status.milestoneRuns?.find((r) => r.days === badge.days);
    const reachedDate =
      existing?.reachedDate ??
      matchingRun?.reachedDate ??
      badge.unlockedEatDate ??
      status.lastConnectedDate ??
      '';
    const streakStartDate =
      existing?.streakStartDate ??
      matchingRun?.streakStartDate ??
      status.currentStreakStartDate ??
      reachedDate;
    return (
      existing ?? {
        id: `${status.contactKey}:${badge.days}:${streakStartDate}`,
        contactKey: status.contactKey,
        days: badge.days,
        streakStartDate,
        reachedDate,
        badgeId: badge.id,
        badgeTitle: badge.title,
        points: badge.points,
        awardedAt: Date.now(),
        celebratedAt: Date.now(),
      }
    );
  }

  const days = status.currentStreak > 0 ? status.currentStreak : status.longestStreak;
  if (days <= 0) return null;
  const reachedDate = status.lastConnectedDate ?? '';
  const streakStartDate = status.currentStreakStartDate ?? reachedDate;
  return {
    id: `${status.contactKey}:streak:${days}:${streakStartDate}`,
    contactKey: status.contactKey,
    days,
    streakStartDate,
    reachedDate,
    badgeId: `streak-${days}`,
    badgeTitle: days === 1 ? '1-Day Streak' : `${days}-Day Streak`,
    points: status.contactScore,
    awardedAt: Date.now(),
    celebratedAt: Date.now(),
  };
}

export type MilestoneShareResult = 'capacitor-share' | 'web-share' | 'downloaded' | 'cancelled';

export function looksLikePhoneNumber(value: string | null | undefined): boolean {
  const clean = (value ?? '').trim();
  if (!clean) return false;
  const compact = clean.replace(/[\s().-]/g, '');
  if (/^\+?\d{6,}$/.test(compact)) return true;
  const digitsOnly = clean.replace(/\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length >= clean.replace(/\s+/g, '').length * 0.7;
}

export function resolveCardConnectionLabel(opts: {
  includeName: boolean;
  contactName?: string | null;
  nickname?: string | null;
  relationshipTag?: string | null;
}): { primaryLabel: string; tagLabel: string } {
  const cleanTag = (opts.relationshipTag ?? '').trim();
  const safeTag = looksLikePhoneNumber(cleanTag) ? '' : cleanTag;

  const cleanNick = (opts.nickname ?? '').trim();
  const safeNick = looksLikePhoneNumber(cleanNick) ? '' : cleanNick;

  const cleanName = (opts.contactName ?? '').trim();
  const safeName = looksLikePhoneNumber(cleanName) ? '' : cleanName;

  if (opts.includeName && safeName) {
    return {
      primaryLabel: safeNick ? `${safeName} (${safeNick})` : safeName,
      tagLabel: safeTag ? `${safeTag} Connection` : 'Verified Connection',
    };
  }

  if (safeNick) {
    return {
      primaryLabel: safeNick,
      tagLabel: safeTag ? `${safeTag} Connection` : 'Private Connection',
    };
  }

  if (safeTag) {
    return {
      primaryLabel: `${safeTag} Connection`,
      tagLabel: 'Relationship Tag',
    };
  }

  return {
    primaryLabel: 'Private Connection',
    tagLabel: 'Protected by Default',
  };
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function parseEatDateForEc(eatDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eatDate.trim());
  if (!m) return eatDate;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return formatEthiopianShort(new Date(utc));
}

function parseEatDateToNoonMs(eatDate: string | undefined): number | null {
  if (!eatDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eatDate.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 9, 0, 0);
}

export function formatMilestoneDateRange(
  startTs: number | null,
  endTs: number | null,
  fallbackStartEat?: string,
  fallbackEndEat?: string,
): string {
  const effectiveStart = startTs ?? parseEatDateToNoonMs(fallbackStartEat);
  const effectiveEnd = endTs ?? parseEatDateToNoonMs(fallbackEndEat) ?? effectiveStart;
  if (effectiveStart === null || effectiveEnd === null) {
    return 'All calls';
  }
  const lo = Math.min(effectiveStart, effectiveEnd);
  const hi = Math.max(effectiveStart, effectiveEnd);
  const startDate = new Date(lo);
  const endDate = new Date(hi);

  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameDay =
    sameYear &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (sameDay) {
    return startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (sameYear) {
    const a = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const b = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${a} – ${b}`;
  }

  const formatWithShortYear = (d: Date) => {
    const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const yr = String(d.getFullYear()).slice(-2);
    return `${md} '${yr}`;
  };
  return `${formatWithShortYear(startDate)} – ${formatWithShortYear(endDate)}`;
}

export function drawMilestoneCardCanvas(
  canvas: HTMLCanvasElement,
  options: MilestoneCardRenderOptions,
): void {
  const SIZE = 1080;
  canvas.width = SIZE;
  canvas.height = SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background gradient (deep navy -> carbon dark)
  const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bgGrad.addColorStop(0, '#08246B');
  bgGrad.addColorStop(0.55, '#0D1B3E');
  bgGrad.addColorStop(1, '#111214');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle warm orange glow behind medallion
  const glow = ctx.createRadialGradient(SIZE / 2, 435, 30, SIZE / 2, 435, 390);
  glow.addColorStop(0, 'rgba(255, 106, 0, 0.28)');
  glow.addColorStop(0.6, 'rgba(255, 106, 0, 0.08)');
  glow.addColorStop(1, 'rgba(255, 106, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle geometric orbital lines
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2;
  [250, 340, 440].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(SIZE / 2, 435, radius, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();

  // Outer hairline frame
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  drawRoundedRectPath(ctx, 44, 44, SIZE - 88, SIZE - 88, 42);
  ctx.stroke();
  ctx.restore();

  // Top Header: App Name + EAT Date
  ctx.save();
  ctx.fillStyle = '#FF6A00';
  drawRoundedRectPath(ctx, 88, 92, 14, 42, 7);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 32px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(APP_NAME, 120, 113);

  const ecLabel = parseEatDateForEc(options.reachedDate);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.font = '600 24px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${options.reachedDate} · ${ecLabel} EC`, SIZE - 88, 113);
  ctx.restore();

  // Central Milestone Medallion
  const cx = SIZE / 2;
  const cy = 415;
  ctx.save();
  const ringGrad = ctx.createLinearGradient(cx - 180, cy - 180, cx + 180, cy + 180);
  ringGrad.addColorStop(0, '#FF8A33');
  ringGrad.addColorStop(1, '#FF6A00');
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, 178, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(17, 18, 20, 0.72)';
  ctx.beginPath();
  ctx.arc(cx, cy, 162, 0, Math.PI * 2);
  ctx.fill();

  // Giant Day Count
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const dayStr = String(options.milestoneDays);
  ctx.font = `800 ${dayStr.length >= 3 ? 128 : 154}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText(dayStr, cx, cy - 12);

  ctx.fillStyle = '#FF8A33';
  ctx.font = '700 28px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(options.milestoneDays === 1 ? 'DAY STREAK' : 'DAYS STREAK', cx, cy + 84);
  ctx.restore();

  // Milestone Title
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 54px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(options.milestoneTitle, cx, 668);

  const { primaryLabel, tagLabel } = resolveCardConnectionLabel({
    includeName: options.includeName,
    contactName: options.contactName,
    nickname: options.nickname,
    relationshipTag: options.relationshipTag,
  });

  // Nickname / Relationship Tag (never includes phone number or real name when includeName=false)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = '600 34px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(primaryLabel, cx, 734, SIZE - 180);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '500 24px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(tagLabel, cx, 782, SIZE - 180);
  ctx.restore();

  // Bottom Stats Strip (Points & Badge only — never airtime/money)
  ctx.save();
  drawRoundedRectPath(ctx, 88, 856, SIZE - 176, 128, 28);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const colWidth = (SIZE - 176) / 3;
  const stats: Array<{ value: string; label: string; accent?: boolean }> = [
    {
      value: `+${options.pointsAwarded} pts`,
      label: options.isStreakOnly ? 'Contact Score' : 'Milestone Reward',
      accent: true,
    },
    {
      value: options.isStreakOnly
        ? `${options.milestoneDays}d Streak`
        : `${options.milestoneDays}d Badge`,
      label: options.isStreakOnly ? 'Call Streak' : 'Contact Badge',
    },
    {
      value: formatDuration(options.totalDurationSeconds ?? 0),
      label: options.dateRangeLabel?.trim() || 'Total Talk Time',
    },
  ];

  stats.forEach((stat, idx) => {
    const sx = 88 + colWidth * idx + colWidth / 2;
    if (idx > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(88 + colWidth * idx, 882);
      ctx.lineTo(88 + colWidth * idx, 958);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = stat.accent ? '#FF8A33' : '#FFFFFF';
    ctx.font = '700 30px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(stat.value, sx, 902, colWidth - 24);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '500 21px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(stat.label, sx, 942, colWidth - 24);
  });
  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const fallbackToDataUrl = () => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1] ?? '';
        if (!base64) {
          reject(new Error('Could not export canvas image.'));
          return;
        }
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        resolve(new Blob([bytes], { type: 'image/png' }));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not export canvas image.'));
      }
    };

    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else fallbackToDataUrl();
      }, 'image/png');
    } else {
      fallbackToDataUrl();
    }
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Base64 conversion failed.'));
    reader.readAsDataURL(blob);
  });
}

export async function downloadMilestoneCardPng(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<'native' | 'shared' | 'downloaded'> {
  const blob = await canvasToBlob(canvas);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return saveAndShareBytes(filename, bytes, 'image/png', filename, false);
}

export async function shareMilestoneCardImage(
  canvas: HTMLCanvasElement,
  opts: {
    filename: string;
    title: string;
    text: string;
  },
): Promise<MilestoneShareResult> {
  const blob = await canvasToBlob(canvas);

  if (isNativeCapacitor()) {
    try {
      const base64 = await blobToBase64(blob);
      const written = await Filesystem.writeFile({
        path: opts.filename,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: opts.title,
        text: opts.text,
        files: [written.uri],
        dialogTitle: opts.title,
      });
      return 'capacitor-share';
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? '').toLowerCase();
      if (msg.includes('cancel')) {
        return 'cancelled';
      }
      // Fall through to Web Share API / FileExport
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], opts.filename, { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: opts.title,
          text: opts.text,
        });
        return 'web-share';
      }
      await navigator.share({
        title: opts.title,
        text: opts.text,
      });
      return 'web-share';
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const delivery = await saveAndShareBytes(opts.filename, bytes, 'image/png', opts.title);
  return delivery === 'native' ? 'capacitor-share' : 'downloaded';
}
