import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share } from '@capacitor/share';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import {
  Camera,
  Check,
  ChevronDown,
  Download,
  Film,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Share2,
  X,
} from 'lucide-react';
import { APP_NAME, APP_VERSION } from '@/src/lib/appInfo';
import { isNativeCapacitor } from '@/src/lib/capacitor';
import { ETHIOPIAN_EMERGENCY_HOTLINES, ETHIOPIAN_USSD_CODES } from '@/src/lib/ethiopia';
import { saveAndShareBytes } from '@/src/lib/export';
import { triggerHaptic } from '@/src/lib/haptics';
import { useCalls } from '@/src/store/CallsContext';

type AspectKey = '9:16' | '1:1' | '16:9';
type ExportQualityKey = '720p' | '1080p';
type PromoPaletteKey = 'navy' | 'obsidian' | 'bright';
type AppTabName = 'Calls' | 'Analytics' | 'Usage' | 'Calendar' | 'Settings';

type PromoFeatureId =
  | 'hook'
  | 'tariffs'
  | 'topCallers'
  | 'trends'
  | 'ussd'
  | 'hotlines'
  | 'streaks'
  | 'calendar'
  | 'birthdayWish'
  | 'missedReminders'
  | 'reports'
  | 'privacy';

type FeatureSceneTemplate = {
  id: PromoFeatureId;
  shortTitle: string;
  durationSec: number;
};

type ActiveScene = FeatureSceneTemplate & {
  indexLabel: string;
  startSec: number;
  endSec: number;
};

const FEATURE_CATALOG: FeatureSceneTemplate[] = [
  { id: 'hook', shortTitle: 'Brand Hook', durationSec: 3.5 },
  { id: 'tariffs', shortTitle: 'Dual-SIM & Birr', durationSec: 3.6 },
  { id: 'topCallers', shortTitle: 'Top Callers', durationSec: 3.8 },
  { id: 'trends', shortTitle: 'Talk-Time Trends', durationSec: 3.8 },
  { id: 'ussd', shortTitle: 'Carrier USSD', durationSec: 3.6 },
  { id: 'hotlines', shortTitle: 'Emergency 991/907', durationSec: 3.8 },
  { id: 'streaks', shortTitle: 'Streaks & Badges', durationSec: 3.8 },
  { id: 'calendar', shortTitle: 'Ethiopian Calendar', durationSec: 3.8 },
  { id: 'birthdayWish', shortTitle: 'Birthday & Wishes', durationSec: 4.0 },
  { id: 'missedReminders', shortTitle: 'Callback & Quiet', durationSec: 4.0 },
  { id: 'reports', shortTitle: 'PDF, CSV & Backup', durationSec: 3.6 },
  { id: 'privacy', shortTitle: 'Privacy, PIN & CTA', durationSec: 3.8 },
];

const ALL_FEATURE_IDS: PromoFeatureId[] = FEATURE_CATALOG.map((f) => f.id);

const PROMO_PRESETS: Array<{
  id: string;
  label: string;
  features: PromoFeatureId[];
}> = [
  { id: 'all', label: 'All (12)', features: ALL_FEATURE_IDS },
  {
    id: 'quick',
    label: 'Quick Reel (15s)',
    features: ['hook', 'tariffs', 'calendar', 'privacy'],
  },
  {
    id: 'highlights',
    label: 'Highlights (26s)',
    features: ['hook', 'tariffs', 'topCallers', 'calendar', 'birthdayWish', 'missedReminders', 'privacy'],
  },
  {
    id: 'analytics',
    label: 'Calls & Birr',
    features: ['hook', 'tariffs', 'topCallers', 'trends', 'ussd', 'privacy'],
  },
  {
    id: 'relationships',
    label: 'Calendar & Wishes',
    features: ['hook', 'calendar', 'birthdayWish', 'missedReminders', 'streaks', 'privacy'],
  },
  {
    id: 'safety',
    label: 'Safety & Export',
    features: ['hook', 'hotlines', 'missedReminders', 'reports', 'privacy'],
  },
];

const ASPECT_CONFIG: Record<
  AspectKey,
  { label: string; platformHint: string; width: number; height: number }
> = {
  '9:16': {
    label: '9:16 Vertical',
    platformHint: 'TikTok, Reels, Shorts, Telegram Story',
    width: 1080,
    height: 1920,
  },
  '1:1': {
    label: '1:1 Square',
    platformHint: 'Telegram Post, Instagram Feed, Facebook',
    width: 1080,
    height: 1080,
  },
  '16:9': {
    label: '16:9 Wide',
    platformHint: 'YouTube, LinkedIn, X',
    width: 1920,
    height: 1080,
  },
};

const PALETTES: Record<
  PromoPaletteKey,
  {
    label: string;
    bgTop: string;
    bgBottom: string;
    shellBg: string;
    shellBorder: string;
    cardBg: string;
    cardBorder: string;
    elevatedBg: string;
    tabTrackBg: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    navy: string;
    blue: string;
    emerald: string;
    danger: string;
    isLightShell: boolean;
  }
> = {
  navy: {
    label: 'Brand Navy',
    bgTop: '#08246B',
    bgBottom: '#06153D',
    shellBg: '#F5F7FA',
    shellBorder: 'rgba(255, 255, 255, 0.22)',
    cardBg: '#FFFFFF',
    cardBorder: '#DDE4EA',
    elevatedBg: '#F1F5F9',
    tabTrackBg: '#EEF2F6',
    textPrimary: '#08246B',
    textSecondary: '#4B5563',
    textMuted: '#8A93A0',
    accent: '#FF6A00',
    navy: '#08246B',
    blue: '#4FA3F7',
    emerald: '#10B981',
    danger: '#EF4444',
    isLightShell: true,
  },
  obsidian: {
    label: 'Obsidian Dark',
    bgTop: '#111214',
    bgBottom: '#16181D',
    shellBg: '#111214',
    shellBorder: '#2A2F3A',
    cardBg: '#1B1D22',
    cardBorder: '#242830',
    elevatedBg: '#23262D',
    tabTrackBg: '#16181D',
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A9B8',
    textMuted: '#6B7280',
    accent: '#FF6A00',
    navy: '#08246B',
    blue: '#4FA3F7',
    emerald: '#10B981',
    danger: '#F87171',
    isLightShell: false,
  },
  bright: {
    label: 'Clean Bright',
    bgTop: '#F5F7FA',
    bgBottom: '#E7EDF4',
    shellBg: '#F5F7FA',
    shellBorder: '#DDE4EA',
    cardBg: '#FFFFFF',
    cardBorder: '#DDE4EA',
    elevatedBg: '#F1F5F9',
    tabTrackBg: '#EEF2F6',
    textPrimary: '#08246B',
    textSecondary: '#4B5563',
    textMuted: '#8A93A0',
    accent: '#FF6A00',
    navy: '#08246B',
    blue: '#2563EB',
    emerald: '#059669',
    danger: '#DC2626',
    isLightShell: true,
  },
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function ellipsizeToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed.trimEnd()}…`;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines?: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(ellipsizeToWidth(ctx, current, maxWidth));
      current = words[i];
    }
  }
  lines.push(ellipsizeToWidth(ctx, current, maxWidth));

  if (maxLines && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const overflowed = [kept[maxLines - 1], ...lines.slice(maxLines)].join(' ');
    kept[maxLines - 1] = ellipsizeToWidth(ctx, overflowed, maxWidth);
    return kept;
  }
  return lines;
}

function drawFittedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  weight: number,
  fontSize: number,
  family: string,
  minScale = 0.64,
) {
  let activeSize = Math.round(fontSize);
  const floorSize = Math.max(11, Math.round(fontSize * minScale));
  ctx.font = `${weight} ${activeSize}px ${family}`;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth && measured > 0) {
    activeSize = Math.max(floorSize, Math.floor(activeSize * (maxWidth / measured)));
    ctx.font = `${weight} ${activeSize}px ${family}`;
  }
  const safeText = ellipsizeToWidth(ctx, text, maxWidth);
  ctx.fillText(safeText, x, y);
  return activeSize;
}

function drawWrappedBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const lines = wrapTextLines(ctx, text, maxWidth, maxLines);
  lines.forEach((line, idx) => {
    ctx.fillText(line, x, y + idx * lineHeight);
  });
  return lines.length * lineHeight;
}

function getActiveSceneProgress(
  tSec: number,
  scenes: ActiveScene[],
  totalDurationSec: number,
): { scene: ActiveScene; sceneIndex: number; localT: number } {
  const safeTotal = Math.max(0.5, totalDurationSec);
  const wrapped = ((tSec % safeTotal) + safeTotal) % safeTotal;
  for (let i = 0; i < scenes.length; i += 1) {
    const s = scenes[i];
    if (wrapped >= s.startSec && wrapped < s.endSec) {
      const dur = Math.max(0.1, s.endSec - s.startSec);
      return {
        scene: s,
        sceneIndex: i,
        localT: clamp01((wrapped - s.startSec) / dur),
      };
    }
  }
  const last = scenes[scenes.length - 1];
  return { scene: last, sceneIndex: scenes.length - 1, localT: 1 };
}

function getSupportedRecorderMimeCandidates(): Array<{ mimeType: string; ext: 'mp4' | 'webm' }> {
  if (typeof MediaRecorder === 'undefined') {
    return [{ mimeType: '', ext: 'webm' }];
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/i.test(ua);
  const candidates: Array<{ mime: string; ext: 'mp4' | 'webm' }> = isSafari
    ? [
        { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
        { mime: 'video/mp4', ext: 'mp4' },
        { mime: 'video/webm;codecs=vp8', ext: 'webm' },
        { mime: 'video/webm', ext: 'webm' },
      ]
    : [
        { mime: 'video/webm;codecs=vp8', ext: 'webm' },
        { mime: 'video/webm', ext: 'webm' },
        { mime: 'video/webm;codecs=vp9', ext: 'webm' },
        { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
        { mime: 'video/mp4', ext: 'mp4' },
      ];
  const supported = candidates
    .filter(
      (c) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(c.mime),
    )
    .map((c) => ({ mimeType: c.mime, ext: c.ext }));

  return supported.length > 0 ? [...supported, { mimeType: '', ext: 'webm' }] : [{ mimeType: '', ext: 'webm' }];
}

async function findSupportedAvcConfig(
  width: number,
  height: number,
  framerate: number,
  bitrate: number,
): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }
  // Ensure even dimensions required by H.264 encoders
  const safeW = width % 2 === 0 ? width : width - 1;
  const safeH = height % 2 === 0 ? height : height - 1;
  const codecs = [
    'avc1.420028',
    'avc1.4d002a',
    'avc1.64002a',
    'avc1.42E01F',
    'avc1.42001f',
    'avc1.4D401F',
  ];
  const hardwareModes: Array<'no-preference' | 'prefer-software'> = [
    'no-preference',
    'prefer-software',
  ];

  for (const hardwareAcceleration of hardwareModes) {
    for (const codec of codecs) {
      const config: VideoEncoderConfig = {
        codec,
        width: safeW,
        height: safeH,
        bitrate,
        framerate,
        hardwareAcceleration,
        avc: { format: 'avc' },
      };
      try {
        const res = await VideoEncoder.isConfigSupported(config);
        if (res.supported) {
          return res.config ?? config;
        }
      } catch {
        // try next config
      }
    }
  }
  return null;
}

function triggerDirectWebDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const fallbackToDataUrl = () => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1] ?? '';
        if (!base64) {
          reject(new Error('Could not encode PNG cover.'));
          return;
        }
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        resolve(new Blob([bytes], { type: 'image/png' }));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not encode PNG cover.'));
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

function formatBytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ReadyExportAsset = {
  kind: 'video' | 'image';
  url: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  sizeLabel: string;
};

const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", monospace';
const APP_TABS: AppTabName[] = ['Calls', 'Analytics', 'Usage', 'Calendar', 'Settings'];

export function PromoVideoStudio() {
  const { showNotice } = useCalls();

  const prefersReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [aspect, setAspect] = useState<AspectKey>('9:16');
  const [exportQuality, setExportQuality] = useState<ExportQualityKey>(() =>
    isNativeCapacitor() || (typeof window !== 'undefined' && window.innerWidth < 768) ? '720p' : '1080p',
  );
  const [paletteKey, setPaletteKey] = useState<PromoPaletteKey>('navy');
  const [selectedFeatures, setSelectedFeatures] = useState<PromoFeatureId[]>(ALL_FEATURE_IDS);
  const [featuresOpen, setFeaturesOpen] = useState<boolean>(false);
  const [formatOpen, setFormatOpen] = useState<boolean>(false);
  const [headline, setHeadline] = useState('Know every call. Track every Birr.');
  const [ctaText, setCtaText] = useState(`Download v${APP_VERSION} for Android`);
  const [socialHandle, setSocialHandle] = useState('@callanalyzer_eth');
  const [playing, setPlaying] = useState<boolean>(() => !prefersReduced);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStageLabel, setExportStageLabel] = useState<'Encoding MP4' | 'Recording'>('Encoding MP4');
  const [exportError, setExportError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [readyExport, setReadyExport] = useState<ReadyExportAsset | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readyCardRef = useRef<HTMLDivElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const [logoLoaded, setLogoLoaded] = useState<boolean>(false);
  const timeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const activeEncoderRef = useRef<VideoEncoder | null>(null);
  const exportCancelledRef = useRef<boolean>(false);
  const readyExportUrlRef = useRef<string | null>(null);
  const mountedRef = useRef<boolean>(true);

  const { activeScenes, totalDurationSec } = useMemo(() => {
    const selectedSet = new Set(selectedFeatures);
    const ordered = FEATURE_CATALOG.filter((f) => selectedSet.has(f.id));
    const list = ordered.length > 0 ? ordered : [FEATURE_CATALOG[0]];
    let cursor = 0;
    const built: ActiveScene[] = list.map((tpl, idx) => {
      const startSec = cursor;
      const endSec = cursor + tpl.durationSec;
      cursor = endSec;
      return {
        ...tpl,
        indexLabel: String(idx + 1).padStart(2, '0'),
        startSec,
        endSec,
      };
    });
    return { activeScenes: built, totalDurationSec: cursor };
  }, [selectedFeatures]);

  useEffect(() => {
    if (timeRef.current >= totalDurationSec) {
      timeRef.current = 0;
      setCurrentTimeSec(0);
    }
  }, [totalDurationSec]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      logoImgRef.current = img;
      setLogoLoaded(true);
    };
    img.src = '/logo.png';
  }, []);

  const baseAspectCfg = ASPECT_CONFIG[aspect];
  const aspectCfg = useMemo(() => {
    const scale = exportQuality === '720p' ? 2 / 3 : 1;
    return {
      ...baseAspectCfg,
      width: Math.round(baseAspectCfg.width * scale),
      height: Math.round(baseAspectCfg.height * scale),
    };
  }, [baseAspectCfg, exportQuality]);
  const palette = PALETTES[paletteKey];

  const toggleFeature = useCallback(
    (id: PromoFeatureId) => {
      triggerHaptic('tap');
      setSelectedFeatures((prev) => {
        if (prev.includes(id)) {
          if (prev.length <= 1) {
            showNotice('Keep at least one feature scene selected.');
            return prev;
          }
          return prev.filter((item) => item !== id);
        }
        return ALL_FEATURE_IDS.filter((f) => f === id || prev.includes(f));
      });
    },
    [showNotice],
  );

  const applyPreset = useCallback((features: PromoFeatureId[]) => {
    triggerHaptic('tap');
    setSelectedFeatures(features);
    timeRef.current = 0;
    setCurrentTimeSec(0);
  }, []);

  const renderFrame = useCallback(
    (tSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = aspectCfg.width;
      const H = aspectCfg.height;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      const isLandscape = W > H;
      const isPortrait = H > W;
      const unit = Math.min(W, H);
      const { scene, sceneIndex, localT } = getActiveSceneProgress(
        tSec,
        activeScenes,
        totalDurationSec,
      );
      const enter = easeOutCubic(clamp01(localT / 0.2));
      const exit = 1 - easeInOutCubic(clamp01((localT - 0.89) / 0.11));
      const sceneAlpha = sceneIndex === activeScenes.length - 1 ? enter : enter * exit;

      // 1. Studio Backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, W * 0.4, H);
      bgGrad.addColorStop(0, palette.bgTop);
      bgGrad.addColorStop(1, palette.bgBottom);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      const orbX = W * (0.78 + Math.sin(tSec * 0.55) * 0.04);
      const orbY = H * (0.18 + Math.cos(tSec * 0.45) * 0.04);
      const orbGrad = ctx.createRadialGradient(orbX, orbY, 10, orbX, orbY, unit * 0.55);
      orbGrad.addColorStop(0, 'rgba(255, 106, 0, 0.20)');
      orbGrad.addColorStop(1, 'rgba(255, 106, 0, 0)');
      ctx.fillStyle = orbGrad;
      ctx.fillRect(0, 0, W, H);

      const padX = Math.round(W * (isPortrait ? 0.055 : 0.05));
      const topY = Math.round(H * (isLandscape ? 0.048 : isPortrait ? 0.036 : 0.04));
      const contentW = W - padX * 2;
      const outerTextColor = paletteKey === 'bright' ? '#08246B' : '#FFFFFF';
      const outerSubColor = paletteKey === 'bright' ? '#4B5563' : 'rgba(226, 232, 240, 0.80)';

      // Top Progress Strip & Brand Tag
      const barW = Math.round(W * (isLandscape ? 0.22 : 0.26));
      const barH = Math.max(6, Math.round(unit * 0.008));
      const barX = W - padX - barW;
      const barY = topY + Math.round(unit * 0.018);

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = outerTextColor;
      drawFittedLine(
        ctx,
        `${APP_NAME} · v${APP_VERSION}`,
        padX,
        barY,
        barX - padX - 18,
        700,
        Math.round(unit * 0.024),
        SANS,
      );

      roundRectPath(ctx, barX, barY - barH / 2, barW, barH, barH / 2);
      ctx.fillStyle = paletteKey === 'bright' ? 'rgba(8,36,107,0.10)' : 'rgba(255,255,255,0.16)';
      ctx.fill();
      const totalProg = clamp01((tSec % totalDurationSec) / totalDurationSec);
      roundRectPath(ctx, barX, barY - barH / 2, Math.max(barH, barW * totalProg), barH, barH / 2);
      ctx.fillStyle = palette.accent;
      ctx.fill();
      ctx.restore();

      const stageTop = topY + Math.round(unit * 0.048);
      const stageBottom = H - Math.round(H * (isLandscape ? 0.085 : isPortrait ? 0.055 : 0.07));
      const stageH = stageBottom - stageTop;

      // Helper to render the real Call Analyzer - ETH in-app window/phone shell
      const drawAppShell = (
        activeTab: AppTabName,
        screenTitle: string,
        screenSub: string,
        subTabs: string[],
        activeSubTabIdx: number,
        promoBannerTitle: string,
        promoBannerKicker: string,
      ): { x: number; y: number; w: number; h: number } => {
        // Promo callout caption above app window
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = palette.accent;
        drawFittedLine(
          ctx,
          `${scene.indexLabel} · ${promoBannerKicker}`,
          padX,
          stageTop,
          contentW,
          700,
          Math.round(unit * 0.022),
          SANS,
        );

        const captionSize = Math.round(unit * (isLandscape ? 0.04 : 0.042));
        ctx.fillStyle = outerTextColor;
        ctx.font = `800 ${captionSize}px ${SANS}`;
        const usedCaptionH = drawWrappedBlock(
          ctx,
          promoBannerTitle,
          padX,
          stageTop + Math.round(unit * 0.03),
          contentW,
          Math.round(captionSize * 1.15),
          2,
        );

        const winY = stageTop + Math.round(unit * 0.03) + usedCaptionH + Math.round(unit * 0.022);
        const winH = stageBottom - winY;
        const winW = contentW;

        // Device/App Window Surface
        ctx.save();
        roundRectPath(ctx, padX, winY, winW, winH, Math.round(unit * 0.032));
        ctx.fillStyle = palette.shellBg;
        ctx.fill();
        ctx.strokeStyle = palette.shellBorder;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.clip();

        // Real App Top Bar (Header with BrandLogo, App Name, Bell & Theme)
        const appHeaderH = Math.round(unit * 0.072);
        ctx.fillStyle = palette.cardBg;
        ctx.fillRect(padX, winY, winW, appHeaderH);
        ctx.fillStyle = palette.cardBorder;
        ctx.fillRect(padX, winY + appHeaderH - 1.5, winW, 1.5);

        const hPad = Math.round(unit * 0.026);
        const hLogo = Math.round(appHeaderH * 0.62);
        const hLogoY = winY + (appHeaderH - hLogo) / 2;
        if (logoImgRef.current && logoLoaded) {
          roundRectPath(ctx, padX + hPad, hLogoY, hLogo, hLogo, Math.round(hLogo * 0.25));
          ctx.save();
          ctx.clip();
          ctx.drawImage(logoImgRef.current, padX + hPad, hLogoY, hLogo, hLogo);
          ctx.restore();
        } else {
          roundRectPath(ctx, padX + hPad, hLogoY, hLogo, hLogo, Math.round(hLogo * 0.25));
          ctx.fillStyle = palette.accent;
          ctx.fill();
        }

        const titleX = padX + hPad + hLogo + Math.round(unit * 0.015);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = palette.textPrimary;
        drawFittedLine(ctx, APP_NAME, titleX, winY + appHeaderH * 0.36, winW * 0.48, 700, Math.round(unit * 0.024), SANS);
        ctx.fillStyle = palette.textSecondary;
        drawFittedLine(ctx, 'Hidar 15, 2019 EC · ኅዳር 15', titleX, winY + appHeaderH * 0.68, winW * 0.48, 500, Math.round(unit * 0.017), MONO);

        // Right header bell badge + sync badge
        const badgeW = Math.round(unit * 0.14);
        const badgeH = Math.round(appHeaderH * 0.52);
        const badgeX = padX + winW - hPad - badgeW;
        const badgeY = winY + (appHeaderH - badgeH) / 2;
        roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, Math.round(badgeH * 0.35));
        ctx.fillStyle = palette.isLightShell ? '#FFF0E6' : 'rgba(255,106,0,0.16)';
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = palette.accent;
        drawFittedLine(ctx, '2 Alerts', badgeX + badgeW / 2, winY + appHeaderH / 2, badgeW - 10, 700, Math.round(unit * 0.017), SANS);

        // Bottom 5-Tab Navigation Bar (Calls | Analytics | Usage | Calendar | Settings)
        const navH = Math.round(unit * 0.072);
        const navY = winY + winH - navH;
        ctx.fillStyle = palette.cardBg;
        ctx.fillRect(padX, navY, winW, navH);
        ctx.fillStyle = palette.cardBorder;
        ctx.fillRect(padX, navY, winW, 1.5);

        const tabW = winW / APP_TABS.length;
        APP_TABS.forEach((tab, tIdx) => {
          const tx = padX + tIdx * tabW;
          const isAct = tab === activeTab;
          if (isAct) {
            const pillW = tabW * 0.78;
            const pillH = navH * 0.68;
            roundRectPath(ctx, tx + (tabW - pillW) / 2, navY + (navH - pillH) / 2, pillW, pillH, Math.round(pillH * 0.32));
            ctx.fillStyle = palette.isLightShell ? '#FFF0E6' : 'rgba(255,106,0,0.18)';
            ctx.fill();
          }
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isAct ? palette.accent : palette.textSecondary;
          drawFittedLine(ctx, tab, tx + tabW / 2, navY + navH / 2, tabW - 8, isAct ? 700 : 600, Math.round(unit * 0.019), SANS);
        });

        // Inner Page Title + Segmented CategoryTabs (exact match to AnalyticsTab / UsageTab / EthiopianCalendarView)
        const bodyPad = Math.round(unit * 0.026);
        let curY = winY + appHeaderH + Math.round(unit * 0.02);
        const bodyW = winW - bodyPad * 2;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = palette.textPrimary;
        drawFittedLine(ctx, screenTitle, padX + bodyPad, curY, bodyW, 700, Math.round(unit * 0.028), SANS);
        curY += Math.round(unit * 0.034);

        ctx.fillStyle = palette.textSecondary;
        drawFittedLine(ctx, screenSub, padX + bodyPad, curY, bodyW, 500, Math.round(unit * 0.018), SANS);
        curY += Math.round(unit * 0.026);

        if (subTabs.length > 0) {
          const trackH = Math.round(unit * 0.048);
          roundRectPath(ctx, padX + bodyPad, curY, bodyW, trackH, Math.round(unit * 0.016));
          ctx.fillStyle = palette.tabTrackBg;
          ctx.fill();
          ctx.strokeStyle = palette.cardBorder;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          const sGap = 4;
          const sW = (bodyW - 8 - sGap * (subTabs.length - 1)) / subTabs.length;
          subTabs.forEach((st, idx) => {
            const sx = padX + bodyPad + 4 + idx * (sW + sGap);
            const active = idx === activeSubTabIdx;
            if (active) {
              roundRectPath(ctx, sx, curY + 4, sW, trackH - 8, Math.round(unit * 0.012));
              ctx.fillStyle = palette.accent;
              ctx.fill();
            }
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = active ? '#FFFFFF' : palette.textSecondary;
            drawFittedLine(ctx, st, sx + sW / 2, curY + trackH / 2, sW - 10, 600, Math.round(unit * 0.018), SANS);
          });
          curY += trackH + Math.round(unit * 0.018);
        }

        ctx.restore();
        return {
          x: padX + bodyPad,
          y: curY,
          w: bodyW,
          h: Math.max(80, navY - curY - Math.round(unit * 0.018)),
        };
      };

      ctx.save();
      ctx.globalAlpha = clamp01(sceneAlpha);
      ctx.translate(0, (1 - enter) * Math.round(unit * 0.03));

      // =========================================================================
      // 01. BRAND HOOK
      // =========================================================================
      if (scene.id === 'hook') {
        const centerX = W / 2;
        const emblemSize = Math.round(unit * (isPortrait ? 0.22 : 0.2));
        const emblemY = stageTop + Math.round(stageH * (isPortrait ? 0.12 : 0.06));

        for (let r = 0; r < 3; r += 1) {
          const ringPhase = (localT * 1.4 + r * 0.33) % 1;
          const radius = emblemSize * (0.62 + ringPhase * 0.52);
          ctx.beginPath();
          ctx.arc(centerX, emblemY + emblemSize / 2, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 106, 0, ${(1 - ringPhase) * 0.45})`;
          ctx.lineWidth = Math.max(2, unit * 0.004);
          ctx.stroke();
        }

        const scaleIn = 0.86 + 0.14 * easeOutCubic(clamp01(localT / 0.35));
        const drawSize = emblemSize * scaleIn;
        const drawX = centerX - drawSize / 2;
        const drawY = emblemY + (emblemSize - drawSize) / 2;
        if (logoImgRef.current && logoLoaded) {
          roundRectPath(ctx, drawX, drawY, drawSize, drawSize, Math.round(drawSize * 0.24));
          ctx.save();
          ctx.clip();
          ctx.drawImage(logoImgRef.current, drawX, drawY, drawSize, drawSize);
          ctx.restore();
        }

        const textY = emblemY + emblemSize + Math.round(unit * 0.085);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = palette.accent;
        drawFittedLine(
          ctx,
          'Built for Ethio Telecom & Safaricom',
          centerX,
          textY,
          contentW * 0.94,
          700,
          Math.round(unit * 0.026),
          SANS,
        );

        const heroFontSize = Math.round(unit * (isPortrait ? 0.062 : 0.06));
        ctx.fillStyle = outerTextColor;
        ctx.font = `800 ${heroFontSize}px ${SANS}`;
        const heroUsedH = drawWrappedBlock(
          ctx,
          headline.trim() || 'Know every call. Track every Birr.',
          centerX,
          textY + Math.round(unit * 0.046),
          contentW * 0.94,
          Math.round(heroFontSize * 1.15),
          3,
        );

        const subY = textY + Math.round(unit * 0.062) + heroUsedH;
        const subFontSize = Math.round(unit * 0.027);
        ctx.fillStyle = outerSubColor;
        ctx.font = `500 ${subFontSize}px ${SANS}`;
        drawWrappedBlock(
          ctx,
          'Dual-SIM Birr · Top Callers & Trends · Streaks · Hotlines · Ethiopian Calendar · Alerts',
          centerX,
          subY,
          contentW * 0.92,
          Math.round(subFontSize * 1.38),
          3,
        );
      }

      // =========================================================================
      // 02. DUAL-SIM TARIFFS & VOICE BUNDLES (Matches UsageTab)
      // =========================================================================
      if (scene.id === 'tariffs') {
        const area = drawAppShell(
          'Usage',
          'Usage & Contacts',
          'SIM 1 vs SIM 2 talk time, ETB spend & active voice bundles',
          ['SIM Usage', 'Bundles', 'Contacts', 'Carrier'],
          0,
          'Track Dual-SIM ETB & Voice Bundles',
          'USAGE & BUNDLES',
        );
        const gap = Math.round(unit * 0.018);

        const drawSimCard = (
          x: number,
          y: number,
          w: number,
          h: number,
          simBadge: string,
          carrier: string,
          sub: string,
          spentEtb: number,
          bundlePct: number,
          minsLeft: number,
          totalMins: number,
          accentColor: string,
        ) => {
          ctx.save();
          roundRectPath(ctx, x, y, w, h, Math.round(unit * 0.024));
          ctx.fillStyle = palette.cardBg;
          ctx.fill();
          ctx.strokeStyle = palette.cardBorder;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.clip();

          const ip = Math.round(unit * 0.024);
          const iw = w - ip * 2;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = accentColor;
          drawFittedLine(ctx, `${simBadge} · ${carrier}`, x + ip, y + ip, iw, 700, Math.round(unit * 0.022), SANS);

          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(ctx, sub, x + ip, y + ip + Math.round(unit * 0.03), iw, 500, Math.round(unit * 0.018), SANS);

          const animCount = spentEtb * easeOutCubic(clamp01((localT - 0.1) / 0.55));
          ctx.fillStyle = palette.textPrimary;
          drawFittedLine(
            ctx,
            `${animCount.toFixed(2)} ETB`,
            x + ip,
            y + ip + Math.round(h * 0.34),
            iw,
            800,
            Math.round(Math.min(unit * 0.052, h * 0.25)),
            MONO,
          );

          const pbH = Math.max(9, Math.round(unit * 0.015));
          const pbY = y + h - ip - pbH - Math.round(unit * 0.032);
          roundRectPath(ctx, x + ip, pbY, iw, pbH, pbH / 2);
          ctx.fillStyle = palette.elevatedBg;
          ctx.fill();

          const fillRatio = bundlePct * easeOutCubic(clamp01((localT - 0.18) / 0.55));
          roundRectPath(ctx, x + ip, pbY, Math.max(pbH, iw * fillRatio), pbH, pbH / 2);
          ctx.fillStyle = accentColor;
          ctx.fill();

          const rem = Math.round(minsLeft * easeOutCubic(clamp01((localT - 0.18) / 0.55)));
          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(
            ctx,
            `Voice Bundle: ${rem} / ${totalMins} min left`,
            x + ip,
            pbY + pbH + Math.round(unit * 0.01),
            iw,
            600,
            Math.round(unit * 0.018),
            MONO,
          );
          ctx.restore();
        };

        if (isLandscape) {
          const cw = (area.w - gap) / 2;
          drawSimCard(area.x, area.y, cw, area.h, 'SIM 1', 'Ethio Telecom (ETC)', '0.50 ETB/min · Per-second billing', 164.5, 0.71, 142, 200, palette.accent);
          drawSimCard(area.x + cw + gap, area.y, cw, area.h, 'SIM 2', 'Safaricom (SFC)', '0.55 ETB/min · Monthly package', 84.0, 0.56, 84, 150, palette.blue);
        } else {
          const ch = (area.h - gap) / 2;
          drawSimCard(area.x, area.y, area.w, ch, 'SIM 1', 'Ethio Telecom (ETC)', '0.50 ETB/min · Per-second billing', 164.5, 0.71, 142, 200, palette.accent);
          drawSimCard(area.x, area.y + ch + gap, area.w, ch, 'SIM 2', 'Safaricom (SFC)', '0.55 ETB/min · Monthly package', 84.0, 0.56, 84, 150, palette.blue);
        }
      }

      // =========================================================================
      // 03. TOP CALLERS LEADERBOARD (Matches AnalyticsTab -> Top Callers)
      // =========================================================================
      if (scene.id === 'topCallers') {
        const area = drawAppShell(
          'Analytics',
          'Analytics',
          'Top callers, talk-time breakdown & spend · Hidar 15 EC',
          ['Overview', 'Trends', 'Top Callers (14)'],
          2,
          'Spot Your Top Callers Instantly',
          'TOP CALLERS',
        );

        ctx.save();
        roundRectPath(ctx, area.x, area.y, area.w, area.h, Math.round(unit * 0.024));
        ctx.fillStyle = palette.cardBg;
        ctx.fill();
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.clip();

        const ip = Math.round(unit * 0.022);
        const iw = area.w - ip * 2;
        const callers = [
          { initial: 'D', name: 'Dawit Bekele', tag: 'Work · ★', meta: '18 calls · SIM 1 · 21.50 ETB', mins: '42m 10s', ratio: 0.94, color: palette.accent },
          { initial: 'S', name: 'Selamawit Tadesse', tag: 'Family', meta: '12 calls · SIM 2 · 15.80 ETB', mins: '31m 40s', ratio: 0.72, color: palette.blue },
          { initial: 'A', name: 'Abebe Kebede', tag: 'Client', meta: '9 calls · SIM 1 · 9.60 ETB', mins: '19m 15s', ratio: 0.48, color: palette.emerald },
          { initial: 'H', name: 'Hanna Girma', tag: 'VIP', meta: '7 calls · SIM 2 · 7.10 ETB', mins: '14m 20s', ratio: 0.36, color: palette.accent },
        ];

        const rowGap = Math.round(unit * 0.012);
        const rowH = (area.h - ip * 2 - rowGap * (callers.length - 1)) / callers.length;

        callers.forEach((c, idx) => {
          const ry = area.y + ip + idx * (rowH + rowGap);
          const rev = easeOutCubic(clamp01((localT - idx * 0.09) / 0.36));

          ctx.save();
          ctx.globalAlpha *= rev;
          roundRectPath(ctx, area.x + ip, ry, iw, rowH, Math.round(unit * 0.018));
          ctx.fillStyle = palette.elevatedBg;
          ctx.fill();

          const rp = Math.round(unit * 0.014);
          const avSize = Math.min(Math.round(unit * 0.056), rowH - rp * 1.4);
          const avX = area.x + ip + rp;
          const avY = ry + (rowH - avSize) / 2;

          roundRectPath(ctx, avX, avY, avSize, avSize, avSize / 2);
          ctx.fillStyle = c.color;
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#FFFFFF';
          drawFittedLine(ctx, c.initial, avX + avSize / 2, avY + avSize / 2, avSize, 700, Math.round(avSize * 0.48), SANS);

          const textX = avX + avSize + Math.round(unit * 0.016);
          const textW = iw - rp * 2 - avSize - Math.round(unit * 0.016);

          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = palette.textPrimary;
          drawFittedLine(ctx, `${c.name} · ${c.tag}`, textX, ry + rp * 0.75, textW * 0.72, 700, Math.round(unit * 0.022), SANS);

          ctx.textAlign = 'right';
          ctx.fillStyle = c.color;
          drawFittedLine(ctx, c.mins, area.x + ip + iw - rp, ry + rp * 0.75, textW * 0.26, 800, Math.round(unit * 0.022), MONO);

          ctx.textAlign = 'left';
          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(ctx, c.meta, textX, ry + rp * 0.75 + Math.round(unit * 0.028), textW, 500, Math.round(unit * 0.017), MONO);

          const barH = Math.max(6, Math.round(unit * 0.008));
          const barY = ry + rowH - rp * 0.75 - barH;
          roundRectPath(ctx, textX, barY, textW, barH, barH / 2);
          ctx.fillStyle = palette.cardBorder;
          ctx.fill();
          roundRectPath(ctx, textX, barY, Math.max(barH, textW * c.ratio * rev), barH, barH / 2);
          ctx.fillStyle = c.color;
          ctx.fill();
          ctx.restore();
        });
        ctx.restore();
      }

      // =========================================================================
      // 04. TALK-TIME TRENDS (Matches AnalyticsTab -> Trends + KPI Row)
      // =========================================================================
      if (scene.id === 'trends') {
        const area = drawAppShell(
          'Analytics',
          'Analytics',
          'Talk-Time Trends & Highlights · Last 7 Days · Hidar 15 EC',
          ['Overview', 'Trends', 'Top Callers'],
          1,
          'Compare Daily Incoming & Outgoing Trends',
          'TALK-TIME TRENDS',
        );
        const gap = Math.round(unit * 0.016);
        const kpiH = Math.round(area.h * 0.24);
        const kpis = [
          { label: 'TOTAL CALLS', value: '64', color: palette.textPrimary },
          { label: 'TALK TIME', value: '3h 48m', color: palette.blue },
          { label: 'MISSED', value: '5', color: palette.danger },
          { label: 'EST. SPEND', value: '164 ETB', color: palette.accent },
        ];
        const kW = (area.w - gap * 3) / 4;
        kpis.forEach((k, idx) => {
          const kx = area.x + idx * (kW + gap);
          roundRectPath(ctx, kx, area.y, kW, kpiH, Math.round(unit * 0.018));
          ctx.fillStyle = palette.cardBg;
          ctx.fill();
          ctx.strokeStyle = palette.cardBorder;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          const kp = Math.round(unit * 0.015);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(ctx, k.label, kx + kp, area.y + kp, kW - kp * 2, 600, Math.round(unit * 0.015), SANS);
          ctx.fillStyle = k.color;
          drawFittedLine(ctx, k.value, kx + kp, area.y + kpiH - kp - Math.round(unit * 0.03), kW - kp * 2, 800, Math.round(unit * 0.028), MONO);
        });

        const chartCardY = area.y + kpiH + gap;
        const chartCardH = area.h - kpiH - gap;
        ctx.save();
        roundRectPath(ctx, area.x, chartCardY, area.w, chartCardH, Math.round(unit * 0.024));
        ctx.fillStyle = palette.cardBg;
        ctx.fill();
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.clip();

        const ip = Math.round(unit * 0.024);
        const iw = area.w - ip * 2;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = palette.textPrimary;
        drawFittedLine(ctx, 'Daily Duration & Peak Hours (5–7 PM)', area.x + ip, chartCardY + ip, iw * 0.68, 700, Math.round(unit * 0.022), SANS);
        ctx.textAlign = 'right';
        ctx.fillStyle = palette.emerald;
        drawFittedLine(ctx, '+24% vs last wk', area.x + ip + iw, chartCardY + ip, iw * 0.3, 700, Math.round(unit * 0.02), MONO);

        const trendDays = [
          { day: 'Mon', inVal: 0.42, outVal: 0.58 },
          { day: 'Tue', inVal: 0.65, outVal: 0.48 },
          { day: 'Wed', inVal: 0.52, outVal: 0.76 },
          { day: 'Thu', inVal: 0.84, outVal: 0.62 },
          { day: 'Fri', inVal: 0.72, outVal: 0.92 },
          { day: 'Sat', inVal: 0.48, outVal: 0.55 },
          { day: 'Sun', inVal: 0.61, outVal: 0.71 },
        ];
        const cTop = chartCardY + ip + Math.round(unit * 0.048);
        const cBot = chartCardY + chartCardH - ip - Math.round(unit * 0.06);
        const cH = Math.max(50, cBot - cTop);
        const colW = iw / trendDays.length;
        const bW = Math.max(9, Math.round(colW * 0.24));

        trendDays.forEach((d, idx) => {
          const anim = easeOutCubic(clamp01((localT - idx * 0.06) / 0.45));
          const cx = area.x + ip + idx * colW + colW / 2;
          const hIn = Math.max(6, cH * d.inVal * anim);
          roundRectPath(ctx, cx - bW - 2, cBot - hIn, bW, hIn, 4);
          ctx.fillStyle = palette.blue;
          ctx.fill();

          const hOut = Math.max(6, cH * d.outVal * anim);
          roundRectPath(ctx, cx + 2, cBot - hOut, bW, hOut, 4);
          ctx.fillStyle = palette.accent;
          ctx.fill();

          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(ctx, d.day, cx, cBot + Math.round(unit * 0.01), colW - 4, 600, Math.round(unit * 0.018), MONO);
        });

        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = palette.blue;
        ctx.font = `600 ${Math.round(unit * 0.018)}px ${SANS}`;
        ctx.fillText('● Incoming', area.x + ip, chartCardY + chartCardH - ip * 0.45);
        ctx.fillStyle = palette.accent;
        ctx.fillText('● Outgoing', area.x + ip + Math.round(iw * 0.34), chartCardY + chartCardH - ip * 0.45);
        ctx.restore();
      }

      // =========================================================================
      // 05. CARRIER USSD SHORTCUTS (Matches CarrierUssdModal / UsageTab Carrier)
      // =========================================================================
      if (scene.id === 'ussd') {
        const area = drawAppShell(
          'Usage',
          'Carrier USSD & Shortcuts',
          'Quick balance, packages & custom USSD codes for ETC & Safaricom',
          ['Ethio Telecom', 'Safaricom', 'Emergency'],
          0,
          'One-Tap Carrier USSD Dialing',
          'CARRIER USSD',
        );
        const gap = Math.round(unit * 0.016);
        const codes = ETHIOPIAN_USSD_CODES.slice(0, 6);
        const cols = isLandscape ? 3 : 2;
        const rows = Math.ceil(codes.length / cols);
        const cellW = (area.w - gap * (cols - 1)) / cols;
        const cellH = (area.h - gap * (rows - 1)) / rows;

        codes.forEach((u, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const cx = area.x + col * (cellW + gap);
          const cy = area.y + row * (cellH + gap);
          const rev = easeOutCubic(clamp01((localT - idx * 0.07) / 0.35));
          const cColor = u.carrier === 'ETC' ? palette.accent : palette.blue;

          ctx.save();
          ctx.globalAlpha *= rev;
          roundRectPath(ctx, cx, cy, cellW, cellH, Math.round(unit * 0.022));
          ctx.fillStyle = palette.cardBg;
          ctx.fill();
          ctx.strokeStyle = palette.cardBorder;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.clip();

          const cp = Math.round(unit * 0.018);
          const cw = cellW - cp * 2;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = cColor;
          drawFittedLine(ctx, u.carrier === 'ETC' ? 'ETC · SIM 1' : 'SFC · SIM 2', cx + cp, cy + cp, cw * 0.55, 700, Math.round(unit * 0.016), SANS);

          ctx.textAlign = 'right';
          ctx.fillStyle = palette.textPrimary;
          drawFittedLine(ctx, u.code, cx + cellW - cp, cy + cp, cw * 0.42, 800, Math.round(unit * 0.026), MONO);

          ctx.textAlign = 'left';
          ctx.fillStyle = palette.textPrimary;
          drawFittedLine(ctx, u.label, cx + cp, cy + Math.round(cellH * 0.46), cw, 700, Math.round(unit * 0.021), SANS);

          // Authentic Call button chip
          const btnH = Math.round(Math.min(unit * 0.036, cellH * 0.25));
          roundRectPath(ctx, cx + cp, cy + cellH - cp - btnH, cw, btnH, Math.round(btnH * 0.35));
          ctx.fillStyle = cColor;
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#FFFFFF';
          drawFittedLine(ctx, `Dial ${u.code}`, cx + cellW / 2, cy + cellH - cp - btnH / 2, cw - 10, 700, Math.round(unit * 0.017), MONO);
          ctx.restore();
        });
      }

      // =========================================================================
      // 06. ETHIOPIAN EMERGENCY HOTLINES (Matches CarrierUssdModal Emergency Tab)
      // =========================================================================
      if (scene.id === 'hotlines') {
        const area = drawAppShell(
          'Calls',
          'Ethiopian Emergency Hotlines',
          '24/7 police, fire, ambulance, traffic & utility hotlines',
          ['Carrier USSD', 'Emergency Hotlines', 'Custom'],
          1,
          '24/7 Ethiopian Emergency Dialer',
          'EMERGENCY HOTLINES',
        );
        const gap = Math.round(unit * 0.016);
        const hotlines = ETHIOPIAN_EMERGENCY_HOTLINES.slice(0, 6);
        const cols = isLandscape ? 3 : 2;
        const rows = Math.ceil(hotlines.length / cols);
        const cellW = (area.w - gap * (cols - 1)) / cols;
        const cellH = (area.h - gap * (rows - 1)) / rows;

        hotlines.forEach((h, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const cx = area.x + col * (cellW + gap);
          const cy = area.y + row * (cellH + gap);
          const rev = easeOutCubic(clamp01((localT - idx * 0.07) / 0.35));
          const badgeColor =
            h.category === 'medical'
              ? palette.emerald
              : h.category === 'utility'
                ? palette.blue
                : palette.danger;

          ctx.save();
          ctx.globalAlpha *= rev;
          roundRectPath(ctx, cx, cy, cellW, cellH, Math.round(unit * 0.022));
          ctx.fillStyle = palette.cardBg;
          ctx.fill();
          ctx.strokeStyle = badgeColor;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.clip();

          const cp = Math.round(unit * 0.018);
          const cw = cellW - cp * 2;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = badgeColor;
          drawFittedLine(ctx, h.number, cx + cp, cy + cp, cw * 0.42, 800, Math.round(Math.min(unit * 0.038, cellH * 0.28)), MONO);

          ctx.textAlign = 'right';
          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(ctx, h.amharicLabel, cx + cellW - cp, cy + cp + 4, cw * 0.56, 600, Math.round(unit * 0.019), SANS);

          ctx.textAlign = 'left';
          ctx.fillStyle = palette.textPrimary;
          drawFittedLine(ctx, h.label, cx + cp, cy + Math.round(cellH * 0.44), cw, 700, Math.round(unit * 0.02), SANS);

          const btnH = Math.round(Math.min(unit * 0.036, cellH * 0.25));
          roundRectPath(ctx, cx + cp, cy + cellH - cp - btnH, cw, btnH, Math.round(btnH * 0.35));
          ctx.fillStyle = badgeColor;
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#FFFFFF';
          drawFittedLine(ctx, `Call ${h.number}`, cx + cellW / 2, cy + cellH - cp - btnH / 2, cw - 10, 700, Math.round(unit * 0.017), MONO);
          ctx.restore();
        });
      }

      // =========================================================================
      // 07. STREAKS & ACHIEVEMENT BADGES (Matches SettingsTab / AchievementsModal)
      // =========================================================================
      if (scene.id === 'streaks') {
        const area = drawAppShell(
          'Settings',
          'Score, Streaks & Badges',
          '1,280 pts · 14d streak · Weekly goal 3/3',
          ['Streaks', 'Milestones', 'Badges (6)'],
          0,
          'Build Daily Call Streaks & Earn Badges',
          'STREAKS & BADGES',
        );
        const gap = Math.round(unit * 0.016);
        const topH = isLandscape ? area.h : Math.round((area.h - gap) * 0.46);
        const botH = isLandscape ? area.h : area.h - gap - topH;
        const leftW = isLandscape ? Math.round((area.w - gap) * 0.5) : area.w;
        const rightX = isLandscape ? area.x + leftW + gap : area.x;
        const rightY = isLandscape ? area.y : area.y + topH + gap;
        const rightW = isLandscape ? area.w - gap - leftW : area.w;

        ctx.save();
        roundRectPath(ctx, area.x, area.y, leftW, topH, Math.round(unit * 0.024));
        ctx.fillStyle = palette.cardBg;
        ctx.fill();
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.clip();

        const ip = Math.round(unit * 0.024);
        const iw = leftW - ip * 2;
        const streakDays = Math.round(14 * easeOutCubic(clamp01(localT / 0.55)));
        const pts = Math.round(1280 * easeOutCubic(clamp01(localT / 0.65)));

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = palette.emerald;
        drawFittedLine(ctx, 'CURRENT ACTIVE STREAK', area.x + ip, area.y + ip, iw, 700, Math.round(unit * 0.018), SANS);
        ctx.fillStyle = palette.textPrimary;
        drawFittedLine(ctx, `${streakDays} Days · ${pts.toLocaleString()} pts`, area.x + ip, area.y + ip + Math.round(unit * 0.028), iw, 800, Math.round(unit * 0.036), SANS);

        const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        const pillH = Math.min(Math.round(unit * 0.062), Math.max(32, topH - ip * 2 - Math.round(unit * 0.1)));
        const pillGap = Math.round(unit * 0.01);
        const pillW = (iw - pillGap * 6) / 7;
        const pillY = area.y + topH - ip - pillH;
        dayLabels.forEach((lbl, idx) => {
          const px = area.x + ip + idx * (pillW + pillGap);
          const lit = idx <= Math.floor(localT * 8);
          roundRectPath(ctx, px, pillY, pillW, pillH, Math.round(unit * 0.014));
          ctx.fillStyle = lit ? palette.emerald : palette.elevatedBg;
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = lit ? '#FFFFFF' : palette.textSecondary;
          drawFittedLine(ctx, lbl, px + pillW / 2, pillY + pillH / 2, pillW - 4, 700, Math.round(unit * 0.019), MONO);
        });
        ctx.restore();

        // Badges Card
        ctx.save();
        roundRectPath(ctx, rightX, rightY, rightW, botH, Math.round(unit * 0.024));
        ctx.fillStyle = palette.cardBg;
        ctx.fill();
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.clip();

        const rw = rightW - ip * 2;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = palette.accent;
        drawFittedLine(ctx, 'ACHIEVEMENT BADGES & MILESTONES', rightX + ip, rightY + ip, rw, 700, Math.round(unit * 0.018), SANS);

        const badges = [
          { title: 'Inner Circle Tier', sub: '100+ min with Dawit Bekele', color: palette.accent },
          { title: 'Zero Missed Callbacks', sub: 'Returned 10/10 missed calls', color: palette.emerald },
          { title: 'Holiday Greeter', sub: 'Sent Enkutatash wishes', color: palette.blue },
        ];
        const bTop = rightY + ip + Math.round(unit * 0.032);
        const bGap = Math.round(unit * 0.01);
        const bH = (botH - (bTop - rightY) - ip - bGap * 2) / 3;
        badges.forEach((b, idx) => {
          const by = bTop + idx * (bH + bGap);
          const rev = easeOutCubic(clamp01((localT - idx * 0.12) / 0.35));
          ctx.save();
          ctx.globalAlpha *= rev;
          roundRectPath(ctx, rightX + ip, by, rw, bH, Math.round(unit * 0.016));
          ctx.fillStyle = palette.elevatedBg;
          ctx.fill();

          const bp = Math.round(unit * 0.012);
          ctx.fillStyle = b.color;
          drawFittedLine(ctx, b.title, rightX + ip + bp, by + bp * 0.7, rw - bp * 2, 700, Math.round(unit * 0.02), SANS);
          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(ctx, b.sub, rightX + ip + bp, by + bH - bp * 0.7 - Math.round(unit * 0.018), rw - bp * 2, 500, Math.round(unit * 0.016), SANS);
          ctx.restore();
        });
        ctx.restore();
      }

      // =========================================================================
      // 08. ETHIOPIAN CALENDAR (Identical Dual EC/GC Cells & Dots)
      // =========================================================================
      if (scene.id === 'calendar') {
        const area = drawAppShell(
          'Calendar',
          'Ethiopian Calendar',
          '13-Month Calendar · Today Hidar 15, 2019 EC',
          ['Month & Day', 'Holidays (6)', 'Style'],
          0,
          'Authentic 13-Month Ethiopian Calendar',
          'ETHIOPIAN CALENDAR',
        );

        ctx.save();
        roundRectPath(ctx, area.x, area.y, area.w, area.h, Math.round(unit * 0.024));
        ctx.fillStyle = palette.cardBg;
        ctx.fill();
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.clip();

        const ip = Math.round(unit * 0.022);
        const iw = area.w - ip * 2;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = palette.textPrimary;
        drawFittedLine(ctx, '‹  3. Hidar (ኅዳር)   2019 EC  ›', area.x + ip, area.y + ip, iw * 0.68, 700, Math.round(unit * 0.023), SANS);
        ctx.textAlign = 'right';
        ctx.fillStyle = palette.textSecondary;
        drawFittedLine(ctx, 'Nov – Dec 2026', area.x + ip + iw, area.y + ip + 3, iw * 0.3, 500, Math.round(unit * 0.017), MONO);

        const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const gridTop = area.y + ip + Math.round(unit * 0.042);
        const legendH = Math.round(unit * 0.032);
        const gridH = area.h - (gridTop - area.y) - ip - legendH - Math.round(unit * 0.012);
        const cGap = Math.round(unit * 0.008);
        const colW = (iw - cGap * 6) / 7;
        const hdH = Math.round(unit * 0.026);
        const cellH = (gridH - hdH - cGap * 3) / 4;

        weekDays.forEach((wd, col) => {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(ctx, wd, area.x + ip + col * (colW + cGap) + colW / 2, gridTop, colW, 600, Math.round(unit * 0.016), SANS);
        });

        for (let r = 0; r < 4; r += 1) {
          for (let c = 0; c < 7; c += 1) {
            const ecDay = r * 7 + c + 1;
            const gcDay = ((ecDay + 9 - 1) % 30) + 1;
            const cx = area.x + ip + c * (colW + cGap);
            const cy = gridTop + hdH + r * (cellH + cGap);
            const isSelected = ecDay === 15;
            const isHoliday = ecDay === 21 || ecDay === 29;
            const hasScheduled = ecDay === 15 || ecDay === 18;

            roundRectPath(ctx, cx, cy, colW, cellH, Math.round(unit * 0.012));
            ctx.fillStyle = isSelected
              ? palette.isLightShell
                ? '#FFF0E6'
                : 'rgba(255,106,0,0.20)'
              : 'transparent';
            ctx.fill();
            ctx.strokeStyle = isSelected ? palette.accent : palette.cardBorder;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();

            const cp = Math.max(5, Math.round(colW * 0.1));
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = isSelected ? palette.accent : palette.textPrimary;
            drawFittedLine(ctx, String(ecDay), cx + cp, cy + cp, colW * 0.5, 700, Math.round(Math.min(unit * 0.022, cellH * 0.36)), MONO);

            ctx.textAlign = 'right';
            ctx.fillStyle = palette.textMuted;
            drawFittedLine(ctx, String(gcDay), cx + colW - cp, cy + cp + 1, colW * 0.4, 500, Math.round(Math.min(unit * 0.015, cellH * 0.24)), MONO);

            // Exact dot indicators at bottom-left
            let dotX = cx + cp + 3;
            const dotY = cy + cellH - cp - 3;
            const dotR = Math.max(2.5, unit * 0.0045);
            if (isHoliday) {
              ctx.beginPath();
              ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
              ctx.fillStyle = palette.accent;
              ctx.fill();
              dotX += dotR * 2.8;
            }
            if (isSelected) {
              ctx.beginPath();
              ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
              ctx.fillStyle = palette.blue;
              ctx.fill();
              dotX += dotR * 2.8;
            }
            if (hasScheduled) {
              ctx.beginPath();
              ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
              ctx.fillStyle = palette.emerald;
              ctx.fill();
            }
          }
        }

        // Exact bottom dot legend
        const legY = area.y + area.h - ip - legendH / 2;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${Math.round(unit * 0.017)}px ${SANS}`;
        ctx.fillStyle = palette.accent;
        ctx.fillText('● Holiday', area.x + ip, legY);
        ctx.fillStyle = palette.blue;
        ctx.fillText('● Birthday / Event', area.x + ip + Math.round(iw * 0.28), legY);
        ctx.fillStyle = palette.emerald;
        ctx.fillText('● Scheduled Call', area.x + ip + Math.round(iw * 0.65), legY);
        ctx.restore();
      }

      // =========================================================================
      // 09. BIRTHDAY NOTIFICATIONS & WISH COMPOSER (Matches RemindersModal + WishComposerModal)
      // =========================================================================
      if (scene.id === 'birthdayWish') {
        const area = drawAppShell(
          'Calendar',
          'Wish Composer',
          'Morning birthday alerts & one-tap multi-channel greetings',
          ['Action', 'Wishes', 'Quiet', 'Reports'],
          1,
          'Birthday Alerts & Multi-App Wishes',
          'BIRTHDAY & WISHES',
        );
        const gap = Math.round(unit * 0.016);
        const notifH = Math.round(area.h * 0.26);
        const wishH = area.h - notifH - gap;

        // Top Birthday Alert Banner
        ctx.save();
        roundRectPath(ctx, area.x, area.y, area.w, notifH, Math.round(unit * 0.022));
        ctx.fillStyle = palette.cardBg;
        ctx.fill();
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.clip();

        const ip = Math.round(unit * 0.02);
        const iw = area.w - ip * 2;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = palette.accent;
        drawFittedLine(ctx, 'NOTIFICATION · 8:00 AM BIRTHDAY ALERT', area.x + ip, area.y + ip, iw, 700, Math.round(unit * 0.017), SANS);
        ctx.fillStyle = palette.textPrimary;
        drawFittedLine(ctx, 'Hanna Girma\'s Birthday Today (Hidar 15 EC)', area.x + ip, area.y + ip + Math.round(unit * 0.025), iw, 700, Math.round(unit * 0.024), SANS);
        ctx.restore();

        // Wish Composer Card
        const wy = area.y + notifH + gap;
        ctx.save();
        roundRectPath(ctx, area.x, wy, area.w, wishH, Math.round(unit * 0.024));
        ctx.fillStyle = palette.cardBg;
        ctx.fill();
        ctx.strokeStyle = palette.cardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.clip();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = palette.textPrimary;
        drawFittedLine(ctx, 'Compose Birthday Wish · Amharic / English', area.x + ip, wy + ip, iw * 0.72, 700, Math.round(unit * 0.021), SANS);
        ctx.textAlign = 'right';
        ctx.fillStyle = palette.emerald;
        drawFittedLine(ctx, '1 SMS part', area.x + ip + iw, wy + ip, iw * 0.26, 700, Math.round(unit * 0.018), MONO);

        const msgTop = wy + ip + Math.round(unit * 0.036);
        const btnH = Math.round(unit * 0.048);
        const msgH = Math.max(48, wishH - (msgTop - wy) - ip - btnH - Math.round(unit * 0.018));
        roundRectPath(ctx, area.x + ip, msgTop, iw, msgH, Math.round(unit * 0.018));
        ctx.fillStyle = palette.elevatedBg;
        ctx.fill();

        const fullWish = 'Melkam Lidet Hanna! Wishing you joy, health, and success this year.';
        const vis = Math.max(10, Math.floor(fullWish.length * easeOutCubic(clamp01((localT - 0.1) / 0.55))));
        ctx.textAlign = 'left';
        ctx.fillStyle = palette.textPrimary;
        ctx.font = `500 ${Math.round(unit * 0.023)}px ${SANS}`;
        drawWrappedBlock(ctx, fullWish.slice(0, vis), area.x + ip * 1.4, msgTop + ip * 0.8, iw - ip * 0.8, Math.round(unit * 0.031), 3);

        const channels = ['WhatsApp', 'SMS', 'Telegram', 'Instagram'];
        const bGap = Math.round(unit * 0.01);
        const bW = (iw - bGap * 3) / 4;
        const bY = wy + wishH - ip - btnH;
        channels.forEach((ch, idx) => {
          const bx = area.x + ip + idx * (bW + bGap);
          const act = Math.floor(localT * 4) % 4 === idx;
          roundRectPath(ctx, bx, bY, bW, btnH, Math.round(btnH * 0.28));
          ctx.fillStyle = act ? palette.accent : palette.elevatedBg;
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = act ? '#FFFFFF' : palette.textPrimary;
          drawFittedLine(ctx, ch, bx + bW / 2, bY + btnH / 2, bW - 8, 700, Math.round(unit * 0.018), SANS);
        });
        ctx.restore();
      }

      // =========================================================================
      // 10. MISSED-CALL REMINDERS & QUIET RECONNECTS (Matches RemindersModal)
      // =========================================================================
      if (scene.id === 'missedReminders') {
        const area = drawAppShell(
          'Calls',
          'Alerts & Reminders',
          'Missed-call callback nudges & weekly quiet-contact reconnects',
          ['Action (2)', 'Wishes', 'Quiet', 'Reports'],
          0,
          'Never Miss a Callback or Reconnect',
          'CALLBACK & QUIET',
        );
        const gap = Math.round(unit * 0.018);

        const rows = [
          {
            badge: 'MISSED-CALL TIMER · 5 / 7 / 10 MIN',
            color: palette.accent,
            title: 'Dawit Bekele · Missed 7 min ago',
            sub: 'Saved contacts only · SIM 1 (Ethio Telecom) · Quiet hours respected',
            actions: ['Call Back', 'Schedule', 'Dismiss'],
          },
          {
            badge: 'QUIET CONTACT · WEEKLY GOAL 2 / 3',
            color: palette.blue,
            title: 'Mom · Last talked 18 days ago',
            sub: 'Reconnect before ties fade · Respects 10 PM – 7 AM quiet hours',
            actions: ['Call Now', 'Send Wish', 'Snooze'],
          },
        ];

        rows.forEach((row, idx) => {
          const rw = isLandscape ? (area.w - gap) / 2 : area.w;
          const rh = isLandscape ? area.h : (area.h - gap) / 2;
          const rx = isLandscape ? area.x + idx * (rw + gap) : area.x;
          const ry = isLandscape ? area.y : area.y + idx * (rh + gap);
          const rev = easeOutCubic(clamp01((localT - idx * 0.14) / 0.35));

          ctx.save();
          ctx.globalAlpha *= rev;
          roundRectPath(ctx, rx, ry, rw, rh, Math.round(unit * 0.024));
          ctx.fillStyle = palette.cardBg;
          ctx.fill();
          ctx.strokeStyle = row.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.clip();

          const ip = Math.round(unit * 0.022);
          const iw = rw - ip * 2;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = row.color;
          drawFittedLine(ctx, row.badge, rx + ip, ry + ip, iw, 700, Math.round(unit * 0.017), SANS);

          ctx.fillStyle = palette.textPrimary;
          drawFittedLine(ctx, row.title, rx + ip, ry + ip + Math.round(unit * 0.026), iw, 700, Math.round(unit * 0.025), SANS);

          ctx.fillStyle = palette.textSecondary;
          ctx.font = `500 ${Math.round(unit * 0.019)}px ${SANS}`;
          drawWrappedBlock(ctx, row.sub, rx + ip, ry + ip + Math.round(unit * 0.062), iw, Math.round(unit * 0.025), 2);

          const btnH = Math.round(unit * 0.044);
          const btnY = ry + rh - ip - btnH;
          const bGap = Math.round(unit * 0.01);
          const bW = (iw - bGap * 2) / 3;
          row.actions.forEach((act, aIdx) => {
            const bx = rx + ip + aIdx * (bW + bGap);
            roundRectPath(ctx, bx, btnY, bW, btnH, Math.round(btnH * 0.28));
            ctx.fillStyle = aIdx === 0 ? row.color : palette.elevatedBg;
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = aIdx === 0 ? '#FFFFFF' : palette.textPrimary;
            drawFittedLine(ctx, act, bx + bW / 2, btnY + btnH / 2, bW - 8, 700, Math.round(unit * 0.017), SANS);
          });
          ctx.restore();
        });
      }

      // =========================================================================
      // 11. PDF REPORTS, CSV & BACKUPS (Matches AnalyticsTab Export + Settings Backup)
      // =========================================================================
      if (scene.id === 'reports') {
        const area = drawAppShell(
          'Settings',
          'Export & Backup',
          'Formatted PDF charts, HTML statements, CSV & JSON backup',
          ['PDF Report', 'CSV / HTML', 'JSON Backup'],
          0,
          'Export Reports & Back Up Anytime',
          'REPORTS & BACKUP',
        );
        const gap = Math.round(unit * 0.016);
        const exportsList = [
          { tag: 'PDF', title: 'PDF Report (with charts)', sub: 'Dual-SIM spend, Top Callers & trends', color: palette.accent },
          { tag: 'CSV', title: 'CSV & Printable HTML Statement', sub: 'Filter by date range, SIM & tag', color: palette.blue },
          { tag: 'JSON', title: 'Full JSON Backup & Restore', sub: 'Contacts, birthdays, milestones & events', color: palette.emerald },
        ];
        const cols = isLandscape ? 3 : 1;
        const iw = cols === 3 ? (area.w - gap * 2) / 3 : area.w;
        const ih = cols === 3 ? area.h : (area.h - gap * 2) / 3;

        exportsList.forEach((it, idx) => {
          const ix = cols === 3 ? area.x + idx * (iw + gap) : area.x;
          const iy = cols === 3 ? area.y : area.y + idx * (ih + gap);
          const rev = easeOutCubic(clamp01((localT - idx * 0.13) / 0.35));

          ctx.save();
          ctx.globalAlpha *= rev;
          roundRectPath(ctx, ix, iy, iw, ih, Math.round(unit * 0.022));
          ctx.fillStyle = palette.cardBg;
          ctx.fill();
          ctx.strokeStyle = palette.cardBorder;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.clip();

          const ip = Math.round(unit * 0.02);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillStyle = it.color;
          drawFittedLine(ctx, it.tag, ix + ip, iy + ip, iw - ip * 2, 800, Math.round(unit * 0.024), MONO);
          ctx.fillStyle = palette.textPrimary;
          drawFittedLine(ctx, it.title, ix + ip, iy + ip + Math.round(unit * 0.032), iw - ip * 2, 700, Math.round(unit * 0.023), SANS);
          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(ctx, it.sub, ix + ip, iy + ih - ip - Math.round(unit * 0.022), iw - ip * 2, 500, Math.round(unit * 0.017), SANS);
          ctx.restore();
        });
      }

      // =========================================================================
      // 12. PRIVACY, APP PIN LOCK & CTA
      // =========================================================================
      if (scene.id === 'privacy') {
        const centerX = W / 2;
        const cardH = Math.round(stageH * (isPortrait ? 0.78 : 0.88));
        const cardY = stageTop + (stageH - cardH) / 2;

        ctx.save();
        roundRectPath(ctx, padX, cardY, contentW, cardH, Math.round(unit * 0.036));
        ctx.fillStyle = palette.cardBg;
        ctx.fill();
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.clip();

        const innerW = contentW - Math.round(unit * 0.08);
        const emblemS = Math.round(unit * (isPortrait ? 0.14 : 0.12));
        const emblemY = cardY + Math.round(cardH * 0.1);
        if (logoImgRef.current && logoLoaded) {
          roundRectPath(ctx, centerX - emblemS / 2, emblemY, emblemS, emblemS, Math.round(emblemS * 0.24));
          ctx.save();
          ctx.clip();
          ctx.drawImage(logoImgRef.current, centerX - emblemS / 2, emblemY, emblemS, emblemS);
          ctx.restore();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const privacyY = emblemY + emblemS + Math.round(unit * 0.035);
        ctx.fillStyle = palette.emerald;
        drawFittedLine(
          ctx,
          '100% ON-DEVICE PRIVACY · 4-DIGIT APP PIN LOCK',
          centerX,
          privacyY,
          innerW,
          700,
          Math.round(unit * 0.022),
          SANS,
        );

        ctx.fillStyle = palette.textPrimary;
        drawFittedLine(
          ctx,
          APP_NAME,
          centerX,
          privacyY + Math.round(unit * 0.036),
          innerW,
          800,
          Math.round(unit * 0.054),
          SANS,
        );

        // 4 PIN dots row matching AppLockOverlay
        const dotY = privacyY + Math.round(unit * 0.112);
        const dotR = Math.round(unit * 0.011);
        const dotGap = Math.round(unit * 0.042);
        for (let d = 0; d < 4; d += 1) {
          const dx = centerX + (d - 1.5) * dotGap;
          ctx.beginPath();
          ctx.arc(dx, dotY, dotR, 0, Math.PI * 2);
          if (d < 3) {
            ctx.fillStyle = palette.accent;
            ctx.fill();
          } else {
            ctx.strokeStyle = palette.textMuted;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }

        const ctaW = Math.min(innerW, Math.round(unit * 0.72));
        const ctaH = Math.round(unit * 0.088);
        const ctaX = centerX - ctaW / 2;
        const ctaY = dotY + Math.round(unit * 0.046);
        roundRectPath(ctx, ctaX, ctaY, ctaW, ctaH, Math.round(ctaH * 0.28));
        ctx.fillStyle = palette.accent;
        ctx.fill();

        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        drawFittedLine(
          ctx,
          ctaText.trim() || `Download v${APP_VERSION}`,
          centerX,
          ctaY + ctaH / 2,
          ctaW - 32,
          800,
          Math.round(unit * 0.03),
          SANS,
        );

        if (socialHandle.trim()) {
          ctx.textBaseline = 'top';
          ctx.fillStyle = palette.textSecondary;
          drawFittedLine(
            ctx,
            socialHandle.trim(),
            centerX,
            ctaY + ctaH + Math.round(unit * 0.03),
            innerW,
            600,
            Math.round(unit * 0.025),
            MONO,
          );
        }
        ctx.restore();
      }

      ctx.restore();

      // Bottom Footer Indicator
      const footerY = H - Math.round(H * 0.03);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = outerSubColor;
      drawFittedLine(
        ctx,
        `${scene.indexLabel} / ${String(activeScenes.length).padStart(2, '0')}  ${scene.shortTitle}`,
        padX,
        footerY,
        contentW * 0.56,
        600,
        Math.round(unit * 0.019),
        MONO,
      );

      ctx.textAlign = 'right';
      drawFittedLine(
        ctx,
        socialHandle.trim() || APP_NAME,
        W - padX,
        footerY,
        contentW * 0.38,
        600,
        Math.round(unit * 0.019),
        MONO,
      );
      ctx.restore();
    },
    [
      activeScenes,
      aspectCfg.height,
      aspectCfg.width,
      ctaText,
      headline,
      logoLoaded,
      palette,
      paletteKey,
      socialHandle,
      totalDurationSec,
    ],
  );

  useEffect(() => {
    renderFrame(timeRef.current);
  }, [renderFrame]);

  useEffect(() => {
    if (!playing || exporting) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameTsRef.current = null;
      return;
    }

    const tick = (now: number) => {
      const prev = lastFrameTsRef.current ?? now;
      const dtSec = Math.min(0.1, Math.max(0, (now - prev) / 1000));
      lastFrameTsRef.current = now;
      const next = (timeRef.current + dtSec) % totalDurationSec;
      timeRef.current = next;
      setCurrentTimeSec(next);
      renderFrame(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameTsRef.current = null;
    };
  }, [exporting, playing, renderFrame, totalDurationSec]);

  const handleSeek = useCallback(
    (nextSec: number) => {
      const clamped = Math.max(0, Math.min(totalDurationSec - 0.01, nextSec));
      timeRef.current = clamped;
      setCurrentTimeSec(clamped);
      renderFrame(clamped);
    },
    [renderFrame, totalDurationSec],
  );

  const setReadyExportAsset = useCallback((next: ReadyExportAsset | null) => {
    if (readyExportUrlRef.current && readyExportUrlRef.current !== next?.url) {
      URL.revokeObjectURL(readyExportUrlRef.current);
    }
    readyExportUrlRef.current = next?.url ?? null;
    setReadyExport(next);
    if (next) {
      window.setTimeout(() => {
        readyCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    }
  }, []);

  const deliverExportBlob = useCallback(
    async (asset: ReadyExportAsset, openShareOnNative: boolean) => {
      setExportError(null);
      if (!isNativeCapacitor()) {
        try {
          triggerDirectWebDownload(asset.url, asset.filename);
          showNotice(
            `${asset.kind === 'video' ? 'Video' : 'PNG'} ready (${asset.sizeLabel}). If your browser blocked auto-download, tap Save below.`,
            'success',
          );
          return;
        } catch {
          // fall through to saveAndShareBytes
        }
      }
      try {
        const bytes = new Uint8Array(await asset.blob.arrayBuffer());
        const result = await saveAndShareBytes(
          asset.filename,
          bytes,
          asset.mimeType,
          asset.filename,
          openShareOnNative,
        );
        if (result === 'native') {
          const folderLabel =
            asset.kind === 'video' ? 'Movies / Gallery' : 'Pictures / Gallery';
          showNotice(`Saved ${asset.filename} to ${folderLabel}.`, 'success');
        } else if (result === 'shared') {
          showNotice(`Ready to share ${asset.filename}.`, 'success');
        } else {
          showNotice(
            `${asset.kind === 'video' ? 'Promo video' : 'Poster PNG'} ready (${asset.sizeLabel}). If it didn't auto-save, tap Save below.`,
            'success',
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save file.';
        setExportError(`${msg} Use Save or Share below.`);
        showNotice(`${msg} Use Save below.`);
      }
    },
    [showNotice],
  );

  const handleShareReadyExport = useCallback(async () => {
    if (!readyExport) return;
    triggerHaptic('tap');
    if (isNativeCapacitor()) {
      await deliverExportBlob(readyExport, true);
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([readyExport.blob], readyExport.filename, {
          type: readyExport.mimeType.split(';')[0] || readyExport.mimeType,
        });
        if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${APP_NAME} Promo`,
          });
          return;
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }
    try {
      await Share.share({
        title: `${APP_NAME} Promo`,
        text: `${APP_NAME} social promo (${aspect})`,
      });
    } catch {
      showNotice('Tap Save File to download to your device.');
    }
  }, [aspect, deliverExportBlob, readyExport, showNotice]);

  const handleDownloadPoster = useCallback(async () => {
    triggerHaptic('tap');
    setExportError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      renderFrame(timeRef.current);
      const blob = await canvasToPngBlob(canvas);
      const url = URL.createObjectURL(blob);
      const filename = `call-analyzer-promo-${aspect.replace(':', 'x')}.png`;
      const asset: ReadyExportAsset = {
        kind: 'image',
        url,
        blob,
        filename,
        mimeType: 'image/png',
        sizeLabel: formatBytesLabel(blob.size),
      };
      setReadyExportAsset(asset);
      await deliverExportBlob(asset, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not export PNG cover.';
      setExportError(msg);
      showNotice(msg);
    }
  }, [aspect, deliverExportBlob, renderFrame, setReadyExportAsset, showNotice]);

  const handleCancelExport = useCallback(() => {
    exportCancelledRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (activeEncoderRef.current) {
      try {
        if (activeEncoderRef.current.state !== 'closed') {
          activeEncoderRef.current.close();
        }
      } catch {
        // ignore close error
      }
      activeEncoderRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    } else {
      setExporting(false);
      setExportProgress(0);
    }
    showNotice('Promo video export cancelled.');
  }, [showNotice]);

  const startMediaRecorderExport = useCallback(
    (
      canvas: HTMLCanvasElement,
      durationSnapshot: number,
      captureFps: number,
      targetBitrate: number,
    ) => {
      if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
        setExporting(false);
        const msg =
          'Direct video recording is not supported in this browser/WebView. Open in Chrome or use Save PNG Cover.';
        setExportError(msg);
        showNotice(msg);
        return;
      }

      setExportStageLabel('Recording');
      const candidates = getSupportedRecorderMimeCandidates();

      let stream: MediaStream;
      try {
        stream = canvas.captureStream(captureFps);
      } catch {
        setExporting(false);
        const msg = 'Could not capture canvas video stream on this device. Try Save PNG Cover or Screen Record.';
        setExportError(msg);
        showNotice(msg);
        return;
      }

      let recorder: MediaRecorder | null = null;
      let chosenMime = '';
      for (const candidate of candidates) {
        try {
          recorder = candidate.mimeType
            ? new MediaRecorder(stream, { mimeType: candidate.mimeType, videoBitsPerSecond: targetBitrate })
            : new MediaRecorder(stream);
          chosenMime = recorder.mimeType || candidate.mimeType;
          break;
        } catch {
          if (candidate.mimeType) {
            try {
              recorder = new MediaRecorder(stream, { mimeType: candidate.mimeType });
              chosenMime = recorder.mimeType || candidate.mimeType;
              break;
            } catch {
              // try next candidate
            }
          }
        }
      }

      if (!recorder) {
        stream.getTracks().forEach((tr) => tr.stop());
        setExporting(false);
        const msg =
          'Video encoder could not initialize on this device. Try 720p quality or Fullscreen + Screen Record.';
        setExportError(msg);
        showNotice(msg);
        return;
      }

      const activeRecorder = recorder;
      const chunks: Blob[] = [];
      recorderRef.current = activeRecorder;

      activeRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      activeRecorder.onerror = () => {
        if (stopTimeoutRef.current !== null) {
          window.clearTimeout(stopTimeoutRef.current);
          stopTimeoutRef.current = null;
        }
        stream.getTracks().forEach((tr) => tr.stop());
        recorderRef.current = null;
        if (!mountedRef.current) return;
        setExporting(false);
        setExportProgress(0);
        const msg =
          'Video encoding failed on this device. Try 720p quality, Chrome browser, or Fullscreen + Screen Record.';
        setExportError(msg);
        showNotice(msg);
      };
      activeRecorder.onstop = () => {
        if (stopTimeoutRef.current !== null) {
          window.clearTimeout(stopTimeoutRef.current);
          stopTimeoutRef.current = null;
        }
        stream.getTracks().forEach((tr) => tr.stop());
        recorderRef.current = null;
        if (!mountedRef.current) return;
        setExporting(false);
        if (exportCancelledRef.current) {
          setExportProgress(0);
          return;
        }
        setExportProgress(100);
        if (chunks.length === 0) {
          const msg =
            'No video frames were captured in this browser/WebView. Try Quick Reel (15s) or Chrome.';
          setExportError(msg);
          showNotice(msg);
          return;
        }
        const actualMime = activeRecorder.mimeType || chosenMime || 'video/webm';
        const actualExt: 'mp4' | 'webm' = actualMime.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type: actualMime });
        const url = URL.createObjectURL(blob);
        const filename = `call-analyzer-promo-${aspect.replace(':', 'x')}.${actualExt}`;
        const asset: ReadyExportAsset = {
          kind: 'video',
          url,
          blob,
          filename,
          mimeType: actualMime,
          sizeLabel: formatBytesLabel(blob.size),
        };
        setReadyExportAsset(asset);
        void deliverExportBlob(asset, true);
      };

      timeRef.current = 0;
      setCurrentTimeSec(0);
      renderFrame(0);

      try {
        activeRecorder.start(250);
      } catch {
        stream.getTracks().forEach((tr) => tr.stop());
        recorderRef.current = null;
        setExporting(false);
        const msg = 'Could not start video recording in this browser.';
        setExportError(msg);
        showNotice(msg);
        return;
      }

      const videoTrack = stream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;

      const startWall = performance.now();
      const pump = (now: number) => {
        if (!mountedRef.current || exportCancelledRef.current) return;
        const elapsedSec = (now - startWall) / 1000;
        const clamped = Math.min(durationSnapshot, elapsedSec);
        timeRef.current = clamped;
        setCurrentTimeSec(clamped);
        setExportProgress(Math.round((clamped / durationSnapshot) * 100));
        renderFrame(clamped);
        videoTrack?.requestFrame?.();

        if (elapsedSec < durationSnapshot) {
          rafRef.current = requestAnimationFrame(pump);
        } else if (activeRecorder.state === 'recording') {
          try {
            activeRecorder.requestData();
          } catch {
            // ignore requestData errors
          }
          stopTimeoutRef.current = window.setTimeout(() => {
            stopTimeoutRef.current = null;
            if (activeRecorder.state !== 'inactive') {
              activeRecorder.stop();
            }
          }, 60);
        }
      };
      rafRef.current = requestAnimationFrame(pump);
    },
    [aspect, deliverExportBlob, renderFrame, setReadyExportAsset, showNotice],
  );

  const handleExportVideo = useCallback(async () => {
    setExportError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;

    triggerHaptic('tap');
    exportCancelledRef.current = false;
    setPlaying(false);
    setExporting(true);
    setExportProgress(0);
    setExportStageLabel('Encoding MP4');

    const durationSnapshot = totalDurationSec;
    const captureFps = exportQuality === '720p' ? 24 : 30;
    const targetBitrate = exportQuality === '720p' ? 1_400_000 : 2_800_000;

    timeRef.current = 0;
    setCurrentTimeSec(0);
    renderFrame(0);

    // Primary fast offline MP4 engine (WebCodecs + mp4-muxer, ~10x faster than real-time)
    const avcConfig = await findSupportedAvcConfig(
      canvas.width,
      canvas.height,
      captureFps,
      targetBitrate,
    );

    if (!mountedRef.current || exportCancelledRef.current) {
      setExporting(false);
      setExportProgress(0);
      return;
    }

    if (avcConfig) {
      let encoder: VideoEncoder | null = null;
      let encoderError: Error | null = null;
      let encodedChunkCount = 0;

      try {
        const muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: {
            codec: 'avc',
            width: avcConfig.width,
            height: avcConfig.height,
            frameRate: captureFps,
          },
          fastStart: 'in-memory',
          firstTimestampBehavior: 'offset',
        });

        encoder = new VideoEncoder({
          output: (chunk, meta) => {
            encodedChunkCount += 1;
            muxer.addVideoChunk(chunk, meta);
          },
          error: (err) => {
            encoderError = err instanceof Error ? err : new Error(String(err));
          },
        });
        activeEncoderRef.current = encoder;
        encoder.configure(avcConfig);

        const totalFrames = Math.max(1, Math.round(durationSnapshot * captureFps));
        const frameDurationUs = Math.round(1_000_000 / captureFps);
        const keyframeInterval = captureFps * 2;
        let lastUiYield = performance.now();

        for (let frameIdx = 0; frameIdx < totalFrames; frameIdx += 1) {
          if (!mountedRef.current || exportCancelledRef.current || encoderError) break;

          while (encoder.encodeQueueSize >= 6) {
            if (!mountedRef.current || exportCancelledRef.current || encoderError) break;
            await new Promise((r) => window.setTimeout(r, 8));
          }
          if (!mountedRef.current || exportCancelledRef.current || encoderError) break;

          const tSec = Math.min(durationSnapshot, frameIdx / captureFps);
          renderFrame(tSec);

          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(frameIdx * frameDurationUs),
            duration: frameDurationUs,
          });
          try {
            encoder.encode(frame, { keyFrame: frameIdx % keyframeInterval === 0 });
          } finally {
            frame.close();
          }

          if (frameIdx % 4 === 0 || frameIdx === totalFrames - 1 || performance.now() - lastUiYield > 28) {
            timeRef.current = tSec;
            setCurrentTimeSec(tSec);
            setExportProgress(Math.min(98, Math.round(((frameIdx + 1) / totalFrames) * 98)));
            await new Promise((r) => window.setTimeout(r, 0));
            lastUiYield = performance.now();
          }
        }

        if (!mountedRef.current || exportCancelledRef.current) {
          try {
            if (encoder.state !== 'closed') encoder.close();
          } catch {
            // ignore
          }
          activeEncoderRef.current = null;
          if (mountedRef.current) {
            setExporting(false);
            setExportProgress(0);
          }
          return;
        }

        await encoder.flush();
        try {
          if (encoder.state !== 'closed') encoder.close();
        } catch {
          // ignore
        }
        activeEncoderRef.current = null;

        if (encoderError || encodedChunkCount === 0) {
          throw encoderError ?? new Error('No video chunks encoded.');
        }

        muxer.finalize();
        const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
        if (blob.size <= 0) {
          throw new Error('Generated MP4 file was empty.');
        }

        const url = URL.createObjectURL(blob);
        const filename = `call-analyzer-promo-${aspect.replace(':', 'x')}.mp4`;
        const asset: ReadyExportAsset = {
          kind: 'video',
          url,
          blob,
          filename,
          mimeType: 'video/mp4',
          sizeLabel: formatBytesLabel(blob.size),
        };
        setExportProgress(100);
        setExporting(false);
        setReadyExportAsset(asset);
        await deliverExportBlob(asset, true);
        return;
      } catch {
        if (encoder) {
          try {
            if (encoder.state !== 'closed') encoder.close();
          } catch {
            // ignore
          }
        }
        activeEncoderRef.current = null;
        if (!mountedRef.current || exportCancelledRef.current) {
          if (mountedRef.current) {
            setExporting(false);
            setExportProgress(0);
          }
          return;
        }
        // Fall through cleanly to MediaRecorder if WebCodecs fails
      }
    }

    startMediaRecorderExport(canvas, durationSnapshot, captureFps, targetBitrate);
  }, [
    aspect,
    deliverExportBlob,
    exportQuality,
    renderFrame,
    setReadyExportAsset,
    startMediaRecorderExport,
    totalDurationSec,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      exportCancelledRef.current = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (stopTimeoutRef.current !== null) {
        window.clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      if (activeEncoderRef.current) {
        try {
          if (activeEncoderRef.current.state !== 'closed') {
            activeEncoderRef.current.close();
          }
        } catch {
          // ignore
        }
        activeEncoderRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (readyExportUrlRef.current) {
        URL.revokeObjectURL(readyExportUrlRef.current);
        readyExportUrlRef.current = null;
      }
    };
  }, []);

  const currentSceneIdx = useMemo(
    () => getActiveSceneProgress(currentTimeSec, activeScenes, totalDurationSec).sceneIndex,
    [activeScenes, currentTimeSec, totalDurationSec],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Preview Stage */}
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 bg-[#0B0D12] p-4 sm:p-6 flex flex-col items-center justify-center gap-4'
              : 'lg:col-span-7 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 sm:p-5 space-y-4'
          }
        >
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              <span className="font-semibold text-[#08246B] dark:text-white">
                {aspectCfg.label}
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {aspectCfg.width}×{aspectCfg.height}
              </span>
              <span className="mx-1.5 hidden sm:inline" aria-hidden="true">·</span>
              <span className="hidden sm:inline">{aspectCfg.platformHint}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                setIsFullscreen((v) => !v);
              }}
              aria-label={isFullscreen ? 'Exit fullscreen preview' : 'Open fullscreen preview'}
              className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] inline-flex items-center gap-1.5 transition-colors"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>

          <div className="w-full flex justify-center items-center rounded-xl bg-[#0B0D12] p-3 overflow-hidden">
            <canvas
              ref={canvasRef}
              className="rounded-lg shadow-lg max-w-full"
              style={{
                aspectRatio: `${aspectCfg.width} / ${aspectCfg.height}`,
                maxHeight: isFullscreen ? '72vh' : aspect === '9:16' ? '520px' : '420px',
                width: 'auto',
                height: 'auto',
              }}
            />
          </div>

          {/* Playback & Timeline */}
          <div className="w-full max-w-2xl mx-auto space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    triggerHaptic('tap');
                    setPlaying((p) => !p);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                >
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                  {playing ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    triggerHaptic('tap');
                    handleSeek(0);
                    setPlaying(true);
                  }}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={14} />
                  Restart
                </button>
              </div>

              <span className="text-xs font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                {currentTimeSec.toFixed(1)}s / {totalDurationSec.toFixed(1)}s
              </span>
            </div>

            <input
              type="range"
              aria-label="Promo timeline scrubber"
              min={0}
              max={Math.max(0.1, totalDurationSec - 0.05)}
              step={0.05}
              disabled={exporting}
              value={Math.min(currentTimeSec, totalDurationSec)}
              onChange={(e) => {
                setPlaying(false);
                handleSeek(Number(e.target.value));
              }}
              className="w-full accent-[#FF6A00] cursor-pointer"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {activeScenes.map((sc, idx) => {
                const active = currentSceneIdx === idx;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    disabled={exporting}
                    onClick={() => {
                      triggerHaptic('tap');
                      handleSeek(sc.startSec + 0.4);
                    }}
                    className={`min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-semibold truncate text-left transition-colors ${
                      active
                        ? 'bg-[#FF6A00] text-white'
                        : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                    }`}
                  >
                    {sc.indexLabel}. {sc.shortTitle}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Customization & Export Controls */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 sm:p-5 space-y-3.5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#08246B] dark:text-white flex items-center gap-2">
              <Film size={16} className="text-[#FF6A00]" />
              Choose Features &amp; Export
            </h3>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Video scenes mirror the live app UI. Expand sections below to customize.
            </p>
          </div>

          {/* Collapsible: Features Included in Video */}
          <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] overflow-hidden">
            <button
              type="button"
              aria-expanded={featuresOpen}
              onClick={() => {
                triggerHaptic('tap');
                setFeaturesOpen((v) => !v);
              }}
              className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
            >
              <span className="text-xs font-semibold text-[#08246B] dark:text-white">
                Features Included in Video
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  {activeScenes.length}/{FEATURE_CATALOG.length} · {totalDurationSec.toFixed(1)}s
                </span>
                <ChevronDown
                  size={15}
                  className={`text-[#4B5563] dark:text-[var(--dark-text-secondary)] transition-transform ${
                    featuresOpen ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            {featuresOpen && (
              <div className="px-3.5 pb-3.5 pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2.5 bg-white dark:bg-[var(--dark-surface)]">
                <div className="grid grid-cols-2 gap-1.5">
                  {PROMO_PRESETS.map((preset) => {
                    const isMatch =
                      preset.features.length === selectedFeatures.length &&
                      preset.features.every((id) => selectedFeatures.includes(id));
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={exporting}
                        onClick={() => applyPreset(preset.features)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          isMatch
                            ? 'bg-[#08246B] text-white'
                            : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {FEATURE_CATALOG.map((feat) => {
                    const checked = selectedFeatures.includes(feat.id);
                    return (
                      <button
                        key={feat.id}
                        type="button"
                        aria-pressed={checked}
                        disabled={exporting}
                        onClick={() => toggleFeature(feat.id)}
                        className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between gap-1.5 text-left transition-colors border ${
                          checked
                            ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00]/50 text-[#08246B] dark:text-white'
                            : 'bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] opacity-75 hover:opacity-100'
                        }`}
                      >
                        <span className="truncate">{feat.shortTitle}</span>
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                            checked
                              ? 'bg-[#FF6A00] text-white'
                              : 'bg-[#DDE4EA] dark:bg-[var(--dark-border)] text-transparent'
                          }`}
                        >
                          <Check size={11} strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Collapsible: Video Format */}
          <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] overflow-hidden">
            <button
              type="button"
              aria-expanded={formatOpen}
              onClick={() => {
                triggerHaptic('tap');
                setFormatOpen((v) => !v);
              }}
              className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
            >
              <span className="text-xs font-semibold text-[#08246B] dark:text-white">
                Video Format
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  {aspect} · {aspectCfg.width}×{aspectCfg.height}
                </span>
                <ChevronDown
                  size={15}
                  className={`text-[#4B5563] dark:text-[var(--dark-text-secondary)] transition-transform ${
                    formatOpen ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            {formatOpen && (
              <div className="px-3.5 pb-3.5 pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2.5 bg-white dark:bg-[var(--dark-surface)]">
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                  {(['9:16', '1:1', '16:9'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={exporting}
                      onClick={() => {
                        triggerHaptic('tap');
                        setAspect(k);
                      }}
                      className={`min-h-[36px] px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        aspect === k
                          ? 'bg-[#FF6A00] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                  {(
                    [
                      { key: '720p', label: '720p Fast (Mobile)' },
                      { key: '1080p', label: '1080p Full HD' },
                    ] as const
                  ).map((q) => (
                    <button
                      key={q.key}
                      type="button"
                      disabled={exporting}
                      onClick={() => {
                        triggerHaptic('tap');
                        setExportQuality(q.key);
                      }}
                      className={`min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        exportQuality === q.key
                          ? 'bg-[#08246B] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  {aspectCfg.platformHint}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#08246B] dark:text-white">
              Visual Style
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
              {(['navy', 'obsidian', 'bright'] as const).map((pk) => (
                <button
                  key={pk}
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    triggerHaptic('tap');
                    setPaletteKey(pk);
                  }}
                  className={`min-h-[36px] px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    paletteKey === pk
                      ? 'bg-[#FF6A00] text-white'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  {PALETTES[pk].label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="space-y-1">
              <label
                htmlFor="promo-headline"
                className="block text-xs font-semibold text-[#08246B] dark:text-white"
              >
                Opening Hook Headline
              </label>
              <input
                id="promo-headline"
                type="text"
                maxLength={80}
                disabled={exporting}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label
                  htmlFor="promo-cta"
                  className="block text-xs font-semibold text-[#08246B] dark:text-white"
                >
                  CTA Button Text
                </label>
                <input
                  id="promo-cta"
                  type="text"
                  maxLength={48}
                  disabled={exporting}
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="promo-handle"
                  className="block text-xs font-semibold text-[#08246B] dark:text-white"
                >
                  Channel Handle / Link
                </label>
                <input
                  id="promo-handle"
                  type="text"
                  maxLength={48}
                  disabled={exporting}
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={exporting}
                onClick={() => void handleExportVideo()}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-70 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
              >
                <Download size={15} />
                {exporting
                  ? `${exportStageLabel} (${exportProgress}%)`
                  : `Export ${totalDurationSec.toFixed(0)}s Video (${aspect})`}
              </button>

              {exporting && (
                <button
                  type="button"
                  onClick={handleCancelExport}
                  aria-label="Cancel video export"
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] inline-flex items-center gap-1 transition-colors"
                >
                  <X size={14} />
                  Cancel
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleDownloadPoster()}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              <Camera size={15} className="text-[#FF6A00]" />
              Save Current Frame as PNG Cover
            </button>

            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Fast MP4 export ({exportQuality === '720p' ? '720p · 24fps' : '1080p · 30fps'}). Pick Quick Reel (15s) under Features for ~2.5 MB.
            </p>

            {exportError && (
              <div className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 px-3 py-2 text-xs text-[#DC2626] dark:text-[#F28B82]">
                {exportError}
              </div>
            )}

            {readyExport && (
              <div
                ref={readyCardRef}
                className="rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#08246B] dark:text-white truncate">
                    {readyExport.filename}
                  </span>
                  <span className="font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0">
                    {readyExport.sizeLabel}
                  </span>
                </div>

                {readyExport.kind === 'video' ? (
                  <video
                    src={readyExport.url}
                    controls
                    playsInline
                    loop
                    className="w-full max-h-48 rounded-lg bg-black"
                  />
                ) : (
                  <img
                    src={readyExport.url}
                    alt="Exported promo poster preview"
                    className="w-full max-h-44 object-contain rounded-lg bg-[#0B0D12]"
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={readyExport.url}
                    download={readyExport.filename}
                    onClick={(e) => {
                      if (isNativeCapacitor()) {
                        e.preventDefault();
                        void deliverExportBlob(readyExport, false);
                      }
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-lg bg-[#08246B] hover:bg-[#0B308E] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download size={14} />
                    {readyExport.kind === 'video' ? 'Save Video' : 'Save PNG'}
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleShareReadyExport()}
                    className="min-h-[40px] px-3 py-2 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Share2 size={14} className="text-[#FF6A00]" />
                    Share
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
