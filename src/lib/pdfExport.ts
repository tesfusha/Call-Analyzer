import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  estimateCallCostEtb,
  formatEtb,
  formatSimDisplay,
  type TariffConfig,
} from '@/src/lib/ethiopia';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { formatDateTime, formatDuration } from '@/src/lib/format';
import { type ExportDeliveryResult, saveAndShareBytes } from '@/src/lib/export';
import { maskPhoneNumber, maskPrivateText } from '@/src/lib/security';
import {
  carrierStats,
  computeTotals,
  contactStats,
  dailyBuckets,
  heatmapBuckets,
  totalSpendEtb,
  type CarrierStat,
  type DailyBucket,
  type HeatmapCell,
  type Totals,
} from '@/src/lib/stats';
import type { CallRecord, SimLabels } from '@/src/types/call';

const SCALE = 3;
const FONT_FAMILY = "'Noto Sans Ethiopic', system-ui, -apple-system, sans-serif";

function hasNonLatin1(text: string): boolean {
  return /[^\u0000-\u00FF]/.test(text);
}

function drawRoundedRect(
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

function createHiDpiCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas for PDF chart generation.');
  }
  ctx.scale(SCALE, SCALE);
  return { canvas, ctx };
}

function drawCardShell(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  subtitle: string,
) {
  drawRoundedRect(ctx, 0.5, 0.5, w - 1, h - 1, 14);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#DDE4EA';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#08246B';
  ctx.font = `700 14px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, 18, 15);

  ctx.fillStyle = '#4B5563';
  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.fillText(subtitle, 18, 34);
}

function renderDirectionDonutChart(totals: Totals): string {
  const w = 540;
  const h = 320;
  const { canvas, ctx } = createHiDpiCanvas(w, h);

  drawCardShell(
    ctx,
    w,
    h,
    'Direction Split',
    `${totals.totalCalls} call${totals.totalCalls === 1 ? '' : 's'} analyzed`,
  );

  const segments = [
    {
      label: 'Incoming',
      count: totals.incomingCount,
      duration: totals.incomingDuration,
      color: '#4FA3F7',
    },
    {
      label: 'Outgoing',
      count: totals.outgoingCount,
      duration: totals.outgoingDuration,
      color: '#FF6A00',
    },
    {
      label: 'Missed',
      count: totals.missedCount,
      duration: 0,
      color: '#EF4444',
    },
  ];

  const total = Math.max(1, totals.totalCalls);
  const cx = 135;
  const cy = 186;
  const outerR = 86;
  const innerR = 54;

  if (totals.totalCalls === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, (outerR + innerR) / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#EEF2F6';
    ctx.lineWidth = outerR - innerR;
    ctx.stroke();
  } else {
    let startAngle = -Math.PI / 2;
    segments.forEach((seg) => {
      if (seg.count <= 0) return;
      const sweep = (seg.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, (outerR + innerR) / 2, startAngle, startAngle + sweep);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = outerR - innerR;
      ctx.lineCap = 'butt';
      ctx.stroke();
      startAngle += sweep;
    });
  }

  // Center KPI
  ctx.fillStyle = '#08246B';
  ctx.font = `700 24px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(totals.totalCalls), cx, cy - 8);

  ctx.fillStyle = '#4B5563';
  ctx.font = `600 11px ${FONT_FAMILY}`;
  ctx.fillText('Total Calls', cx, cy + 14);

  // Legend
  const legendX = 258;
  let legendY = 104;
  segments.forEach((seg) => {
    const pct = totals.totalCalls > 0 ? Math.round((seg.count / totals.totalCalls) * 100) : 0;

    drawRoundedRect(ctx, legendX, legendY, 256, 52, 10);
    ctx.fillStyle = '#F7F9FB';
    ctx.fill();
    ctx.strokeStyle = '#E5E9F0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(legendX + 18, legendY + 26, 6, 0, Math.PI * 2);
    ctx.fillStyle = seg.color;
    ctx.fill();

    ctx.fillStyle = '#08246B';
    ctx.font = `700 13px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(seg.label, legendX + 34, legendY + 10);

    ctx.fillStyle = '#4B5563';
    ctx.font = `500 11px ${FONT_FAMILY}`;
    const sub =
      seg.label === 'Missed'
        ? 'Unanswered'
        : `Talk time ${formatDuration(seg.duration)}`;
    ctx.fillText(sub, legendX + 34, legendY + 28);

    ctx.fillStyle = '#08246B';
    ctx.font = `700 13px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${seg.count} (${pct}%)`, legendX + 242, legendY + 17);

    legendY += 62;
  });

  return canvas.toDataURL('image/png');
}

function renderDailyStackedBarChart(buckets: DailyBucket[]): string {
  const w = 540;
  const h = 320;
  const { canvas, ctx } = createHiDpiCanvas(w, h);

  drawCardShell(
    ctx,
    w,
    h,
    'Daily Call Frequency',
    buckets.length > 0 ? `Last ${buckets.length} active days` : 'No daily call data',
  );

  // Compact Legend
  const legendItems = [
    { label: 'In', color: '#4FA3F7' },
    { label: 'Out', color: '#FF6A00' },
    { label: 'Missed', color: '#EF4444' },
  ];
  let lx = w - 18;
  ctx.textBaseline = 'middle';
  ctx.font = `600 11px ${FONT_FAMILY}`;
  for (let i = legendItems.length - 1; i >= 0; i -= 1) {
    const item = legendItems[i];
    const tw = ctx.measureText(item.label).width;
    ctx.fillStyle = '#4B5563';
    ctx.textAlign = 'right';
    ctx.fillText(item.label, lx, 24);
    ctx.beginPath();
    ctx.arc(lx - tw - 8, 24, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();
    lx -= tw + 24;
  }

  const plotX = 48;
  const plotY = 66;
  const plotW = w - plotX - 20;
  const plotH = 200;

  if (buckets.length === 0) {
    ctx.fillStyle = '#8A93A0';
    ctx.font = `500 13px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No calls in the selected range', w / 2, h / 2 + 12);
    return canvas.toDataURL('image/png');
  }

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const yTicks = 4;

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `500 10px ${FONT_FAMILY}`;
  for (let i = 0; i <= yTicks; i += 1) {
    const val = Math.round((maxCount / yTicks) * i);
    const y = plotY + plotH - (plotH / yTicks) * i;
    ctx.strokeStyle = i === 0 ? '#CBD5E1' : '#EEF2F6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotW, y);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.fillText(String(val), plotX - 8, y);
  }

  const slotW = plotW / buckets.length;
  const barW = Math.min(26, Math.max(10, slotW * 0.56));
  const labelEvery = buckets.length > 9 ? 2 : 1;

  buckets.forEach((b, idx) => {
    const bx = plotX + idx * slotW + (slotW - barW) / 2;
    let currentBottom = plotY + plotH;

    const parts = [
      { value: b.incoming, color: '#4FA3F7' },
      { value: b.outgoing, color: '#FF6A00' },
      { value: b.missed, color: '#EF4444' },
    ];

    parts.forEach((part) => {
      if (part.value <= 0) return;
      const segH = Math.max(2, (part.value / maxCount) * plotH);
      const topY = currentBottom - segH;
      ctx.fillStyle = part.color;
      ctx.fillRect(bx, topY, barW, segH);
      currentBottom = topY;
    });

    // Total above bar
    if (b.count > 0) {
      ctx.fillStyle = '#08246B';
      ctx.font = `600 10px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(b.count), bx + barW / 2, currentBottom - 3);
    }

    if (idx % labelEvery === 0 || idx === buckets.length - 1) {
      ctx.fillStyle = '#4B5563';
      ctx.font = `500 10px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(b.label, bx + barW / 2, plotY + plotH + 8);
    }
  });

  return canvas.toDataURL('image/png');
}

function renderCarrierBarChart(carriers: CarrierStat[]): string {
  const w = 540;
  const h = 290;
  const { canvas, ctx } = createHiDpiCanvas(w, h);

  drawCardShell(
    ctx,
    w,
    h,
    'Carrier & Network Breakdown',
    'Calls, talk time, and estimated ETB spend',
  );

  if (carriers.length === 0) {
    ctx.fillStyle = '#8A93A0';
    ctx.font = `500 13px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No carrier activity in this range', w / 2, h / 2 + 10);
    return canvas.toDataURL('image/png');
  }

  const colors: Record<string, string> = {
    ETC: '#FF6A00',
    'Ethio Telecom': '#FF6A00',
    SFC: '#10B981',
    'Safaricom Ethiopia': '#10B981',
    Landline: '#4FA3F7',
    'International / Other': '#8B5CF6',
  };

  const visible = carriers.slice(0, 4);
  const maxCount = Math.max(1, ...visible.map((c) => c.count));
  const startY = 72;
  const rowStep = 50;

  visible.forEach((c, idx) => {
    const y = startY + idx * rowStep;
    const barColor = colors[c.carrier] ?? '#08246B';
    const pct = Math.max(4, (c.count / maxCount) * 100);

    ctx.fillStyle = '#08246B';
    ctx.font = `700 12px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(c.carrier, 18, y);

    ctx.fillStyle = '#4B5563';
    ctx.font = `600 11px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(
      `${c.count} calls · ${formatDuration(c.duration)} · ${formatEtb(c.spendEtb)}`,
      w - 18,
      y,
    );

    const trackX = 18;
    const trackY = y + 20;
    const trackW = w - 36;
    const trackH = 12;

    drawRoundedRect(ctx, trackX, trackY, trackW, trackH, 6);
    ctx.fillStyle = '#EEF2F6';
    ctx.fill();

    const fillW = Math.max(12, (trackW * pct) / 100);
    drawRoundedRect(ctx, trackX, trackY, fillW, trackH, 6);
    ctx.fillStyle = barColor;
    ctx.fill();
  });

  return canvas.toDataURL('image/png');
}

function renderPeakHoursHeatmap(cells: HeatmapCell[]): string {
  const w = 540;
  const h = 290;
  const { canvas, ctx } = createHiDpiCanvas(w, h);

  drawCardShell(
    ctx,
    w,
    h,
    'Peak Calling Hours',
    'Call intensity by weekday and 6-hour time window',
  );

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const blocks = ['00–06', '06–12', '12–18', '18–24'];
  const maxVal = Math.max(1, ...cells.map((c) => c.count));

  const leftPad = 58;
  const topPad = 82;
  const colW = (w - leftPad - 22) / 4;
  const rowH = 26;

  ctx.fillStyle = '#4B5563';
  ctx.font = `600 11px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  blocks.forEach((b, bi) => {
    ctx.fillText(b, leftPad + bi * colW + colW / 2, 66);
  });

  days.forEach((dayName, di) => {
    const ry = topPad + di * rowH;
    ctx.fillStyle = '#08246B';
    ctx.font = `600 11px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(dayName, 18, ry + (rowH - 4) / 2);

    blocks.forEach((_, bi) => {
      const cell = cells.find((c) => c.day === di && c.block === bi);
      const count = cell?.count ?? 0;
      const ratio = count > 0 ? count / maxVal : 0;

      const cx = leftPad + bi * colW + 3;
      const cy = ry + 1;
      const cw = colW - 6;
      const ch = rowH - 5;

      drawRoundedRect(ctx, cx, cy, cw, ch, 6);
      if (count === 0) {
        ctx.fillStyle = '#F1F5F9';
      } else {
        const alpha = 0.22 + ratio * 0.78;
        ctx.fillStyle = `rgba(255, 106, 0, ${alpha.toFixed(2)})`;
      }
      ctx.fill();

      if (count > 0) {
        ctx.fillStyle = ratio > 0.55 ? '#FFFFFF' : '#08246B';
        ctx.font = `700 10px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(count), cx + cw / 2, cy + ch / 2);
      }
    });
  });

  return canvas.toDataURL('image/png');
}

function renderUnicodeTextPng(
  text: string,
  color: string,
  fontSizePx = 11,
  bold = false,
): { dataUrl: string; aspect: number } {
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) return { dataUrl: '', aspect: 1 };
  const font = `${bold ? 700 : 500} ${fontSizePx}px ${FONT_FAMILY}`;
  mctx.font = font;
  const textW = Math.ceil(mctx.measureText(text).width) + 4;
  const textH = Math.ceil(fontSizePx * 1.4);

  const { canvas, ctx } = createHiDpiCanvas(Math.max(12, textW), textH);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 1, textH / 2);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    aspect: textW / textH,
  };
}

function safeLatinText(value: string): string {
  return hasNonLatin1(value) ? value.replace(/[^\u0020-\u00FF]/g, '?') : value;
}

export async function exportCallHistoryPdfReport({
  calls,
  tariffs,
  simLabels,
  title = 'Call History & Analytics Report',
  privacyMode = false,
  filename = 'call-history-report.pdf',
}: {
  calls: CallRecord[];
  tariffs: TariffConfig;
  simLabels: SimLabels;
  title?: string;
  privacyMode?: boolean;
  filename?: string;
}): Promise<ExportDeliveryResult> {
  const sorted = [...calls].sort((a, b) => b.timestamp - a.timestamp);
  const totals = computeTotals(sorted);
  const totalEtb = totalSpendEtb(sorted, tariffs);
  const carriers = carrierStats(sorted, tariffs);
  const buckets = dailyBuckets(sorted);
  const heatmap = heatmapBuckets(sorted);
  const topContacts = [...contactStats(sorted)]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  const generatedEc = formatEthiopianShort(new Date());
  const generatedGc = new Date().toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Render high-DPI chart PNGs
  const donutChartUrl = renderDirectionDonutChart(totals);
  const dailyChartUrl = renderDailyStackedBarChart(buckets);
  const carrierChartUrl = renderCarrierBarChart(carriers);
  const heatmapChartUrl = renderPeakHoursHeatmap(heatmap);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentW = pageW - marginX * 2; // 182mm

  // Top Header Banner
  doc.setFillColor(8, 36, 107); // #08246B
  doc.roundedRect(marginX, 12, contentW, 21, 3, 3, 'F');
  doc.setFillColor(255, 106, 0); // #FF6A00 accent bar
  doc.roundedRect(marginX, 12, 3, 21, 1.5, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Call Analyzer - ETH', marginX + 7, 19.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240);
  doc.text(safeLatinText(title), marginX + 7, 25.5);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Generated: ${generatedGc} (${generatedEc} EC)`,
    pageW - marginX - 4,
    19.2,
    { align: 'right' },
  );
  doc.text(
    `Billing: ${tariffs.billingMode} · SIM 1: ${tariffs.sim1RatePerMin} ETB/m · SIM 2: ${tariffs.sim2RatePerMin} ETB/m`,
    pageW - marginX - 4,
    25.2,
    { align: 'right' },
  );

  // 4 KPI Summary Cards
  const answeredCount = totals.incomingCount + totals.outgoingCount;
  const answerRate =
    totals.totalCalls > 0 ? Math.round((answeredCount / totals.totalCalls) * 100) : 0;

  const kpis = [
    {
      label: 'TOTAL CALLS',
      value: String(totals.totalCalls),
      sub: `${totals.incomingCount} in · ${totals.outgoingCount} out · ${totals.missedCount} missed`,
    },
    {
      label: 'TALK TIME',
      value: formatDuration(totals.totalDuration),
      sub: `Avg ${formatDuration(totals.avgDuration)} / answered`,
    },
    {
      label: 'EST. AIRTIME SPEND',
      value: formatEtb(totalEtb),
      sub: `${totals.outgoingCount} outgoing calls`,
    },
    {
      label: 'UNIQUE CONTACTS',
      value: String(totals.uniqueContacts),
      sub: `${answerRate}% answer rate`,
    },
  ];

  const kpiGap = 3.33;
  const kpiW = (contentW - kpiGap * 3) / 4;
  const kpiY = 37;
  kpis.forEach((kpi, idx) => {
    const kx = marginX + idx * (kpiW + kpiGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(221, 228, 234);
    doc.roundedRect(kx, kpiY, kpiW, 19, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(75, 85, 99);
    doc.text(kpi.label, kx + 3.2, kpiY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(8, 36, 107);
    doc.text(kpi.value, kx + 3.2, kpiY + 11.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, kx + 3.2, kpiY + 16);
  });

  // Embedded Charts Row 1
  const chartGap = 4;
  const chartW = (contentW - chartGap) / 2; // 89mm
  const chart1H = (chartW * 320) / 540; // ~52.74mm
  const chart1Y = 60;
  doc.addImage(donutChartUrl, 'PNG', marginX, chart1Y, chartW, chart1H, undefined, 'FAST');
  doc.addImage(
    dailyChartUrl,
    'PNG',
    marginX + chartW + chartGap,
    chart1Y,
    chartW,
    chart1H,
    undefined,
    'FAST',
  );

  // Embedded Charts Row 2
  const chart2Y = chart1Y + chart1H + 4;
  const chart2H = (chartW * 290) / 540; // ~47.8mm
  doc.addImage(carrierChartUrl, 'PNG', marginX, chart2Y, chartW, chart2H, undefined, 'FAST');
  doc.addImage(
    heatmapChartUrl,
    'PNG',
    marginX + chartW + chartGap,
    chart2Y,
    chartW,
    chart2H,
    undefined,
    'FAST',
  );

  let cursorY = chart2Y + chart2H + 7;

  // Section 1: Top Contacts by Talk Time
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(8, 36, 107);
  doc.text('Top Contacts by Talk Time', marginX, cursorY);

  const topRawNames = topContacts.map((c) => {
    const masked = maskPhoneNumber(c.number, privacyMode);
    return c.name === c.number ? masked : c.name;
  });

  autoTable(doc, {
    startY: cursorY + 2.5,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [['#', 'Contact', 'Number', 'Calls', 'In / Out / Missed', 'Duration', 'Est. Spend']],
    body:
      topContacts.length > 0
        ? topContacts.map((c, idx) => {
            const spend = c.calls.reduce(
              (sum, call) => sum + estimateCallCostEtb(call, tariffs),
              0,
            );
            const rawName = topRawNames[idx];
            return [
              String(idx + 1),
              hasNonLatin1(rawName) ? '' : rawName,
              maskPhoneNumber(c.number, privacyMode),
              String(c.count),
              `${c.incoming} / ${c.outgoing} / ${c.missed}`,
              formatDuration(c.duration),
              spend > 0 ? formatEtb(spend) : '—',
            ];
          })
        : [['—', 'No contact activity recorded', '', '', '', '', '']],
    styles: {
      fontSize: 7.8,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [8, 36, 107],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 42 },
      2: { cellWidth: 34 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 32, halign: 'center' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1 && topContacts[data.row.index]) {
        const raw = topRawNames[data.row.index];
        if (hasNonLatin1(raw)) {
          const rendered = renderUnicodeTextPng(raw, '#0F172A', 11, true);
          if (rendered.dataUrl) {
            const imgH = 3.6;
            const imgW = Math.min(data.cell.width - 3, imgH * rendered.aspect);
            doc.addImage(
              rendered.dataUrl,
              'PNG',
              data.cell.x + 1.8,
              data.cell.y + (data.cell.height - imgH) / 2,
              imgW,
              imgH,
            );
          }
        }
      }
    },
  });

  const afterTopY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ??
    cursorY + 30;
  cursorY = afterTopY + 8;

  if (cursorY > pageH - 42) {
    doc.addPage();
    cursorY = 18;
  }

  // Section 2: Detailed Call History Log
  const logSlice = sorted.slice(0, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(8, 36, 107);
  doc.text(
    `Call History Log (Latest ${logSlice.length} of ${sorted.length})`,
    marginX,
    cursorY,
  );

  const logRawNames = logSlice.map((c) => {
    const raw = c.name?.trim() || maskPhoneNumber(c.number, privacyMode);
    return privacyMode && c.name?.trim() ? c.name.trim() : raw;
  });
  const logRawTags = logSlice.map((c) => (c.tag ? maskPrivateText(c.tag, privacyMode) : '—'));

  autoTable(doc, {
    startY: cursorY + 2.5,
    margin: { left: marginX, right: marginX, bottom: 16 },
    showHead: 'everyPage',
    head: [['Contact', 'Number', 'Dir', 'SIM', 'Date & Time (GC / EC)', 'Duration', 'Cost', 'Tag']],
    body:
      logSlice.length > 0
        ? logSlice.map((c, idx) => {
            const rawName = logRawNames[idx];
            const rawTag = logRawTags[idx];
            const cost =
              c.direction === 'outgoing' && c.duration > 0
                ? formatEtb(estimateCallCostEtb(c, tariffs))
                : '—';
            const simText = c.sim ? formatSimDisplay(c.sim, simLabels) : '—';
            return [
              hasNonLatin1(rawName) ? '' : rawName,
              maskPhoneNumber(c.number, privacyMode),
              c.direction.charAt(0).toUpperCase() + c.direction.slice(1),
              hasNonLatin1(simText) ? safeLatinText(simText) : simText,
              `${formatDateTime(c.timestamp)} (${formatEthiopianShort(c.timestamp)} EC)`,
              c.duration > 0 ? formatDuration(c.duration) : '0s',
              cost,
              hasNonLatin1(rawTag) ? '' : rawTag,
            ];
          })
        : [['No calls recorded', '', '', '', '', '', '', '']],
    styles: {
      fontSize: 7.3,
      cellPadding: 1.9,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      overflow: 'ellipsize',
    },
    headStyles: {
      fillColor: [8, 36, 107],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 25 },
      2: { cellWidth: 16 },
      3: { cellWidth: 24 },
      4: { cellWidth: 42 },
      5: { cellWidth: 15, halign: 'right' },
      6: { cellWidth: 17, halign: 'right' },
      7: { cellWidth: 15 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2 && logSlice[data.row.index]) {
        const dir = logSlice[data.row.index].direction;
        if (dir === 'incoming') {
          data.cell.styles.textColor = [37, 99, 235];
          data.cell.styles.fontStyle = 'bold';
        } else if (dir === 'outgoing') {
          data.cell.styles.textColor = [234, 88, 12];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || !logSlice[data.row.index]) return;
      if (data.column.index === 0) {
        const raw = logRawNames[data.row.index];
        if (hasNonLatin1(raw)) {
          const rendered = renderUnicodeTextPng(raw, '#0F172A', 10, true);
          if (rendered.dataUrl) {
            const imgH = 3.4;
            const imgW = Math.min(data.cell.width - 2.5, imgH * rendered.aspect);
            doc.addImage(
              rendered.dataUrl,
              'PNG',
              data.cell.x + 1.5,
              data.cell.y + (data.cell.height - imgH) / 2,
              imgW,
              imgH,
            );
          }
        }
      } else if (data.column.index === 7) {
        const raw = logRawTags[data.row.index];
        if (hasNonLatin1(raw)) {
          const rendered = renderUnicodeTextPng(raw, '#0F172A', 10, false);
          if (rendered.dataUrl) {
            const imgH = 3.4;
            const imgW = Math.min(data.cell.width - 2.5, imgH * rendered.aspect);
            doc.addImage(
              rendered.dataUrl,
              'PNG',
              data.cell.x + 1.5,
              data.cell.y + (data.cell.height - imgH) / 2,
              imgW,
              imgH,
            );
          }
        }
      }
    },
  });

  // Stamp clean footers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(221, 228, 234);
    doc.line(marginX, pageH - 12, pageW - marginX, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Call Analyzer - ETH · ${generatedEc} EC${privacyMode ? ' · Privacy Mode Active' : ''}`,
      marginX,
      pageH - 7.5,
    );
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 7.5, { align: 'right' });
  }

  const pdfBuffer = doc.output('arraybuffer');
  const bytes = new Uint8Array(pdfBuffer);
  return saveAndShareBytes(filename, bytes, 'application/pdf', title);
}
