export type PromoMusicPresetId = 'none' | 'ethio-groove' | 'upbeat-tech' | 'calm-lofi' | 'custom';

export type AddisLanguageCode = 'am' | 'om' | 'ti' | 'sw' | 'ha' | 'sid' | 'wal';

export interface AddisVoiceOption {
  id: string;
  name: string;
  language: string;
  gender?: string;
}

export const ADDIS_LANGUAGES: ReadonlyArray<{ code: AddisLanguageCode; label: string; nativeLabel: string }> = [
  { code: 'am', label: 'Amharic', nativeLabel: 'አማርኛ' },
  { code: 'om', label: 'Afaan Oromo', nativeLabel: 'Afaan Oromoo' },
  { code: 'ti', label: 'Tigrinya', nativeLabel: 'ትግርኛ' },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili' },
  { code: 'ha', label: 'Hausa', nativeLabel: 'Hausa' },
  { code: 'sid', label: 'Sidama', nativeLabel: 'Sidaamu Afoo' },
  { code: 'wal', label: 'Wolaytta', nativeLabel: 'Wolayttatto' },
];

export const PROMO_MUSIC_PRESETS: ReadonlyArray<{
  id: Exclude<PromoMusicPresetId, 'custom'>;
  label: string;
  hint: string;
}> = [
  { id: 'none', label: 'No Music', hint: 'Silent or narration only' },
  { id: 'ethio-groove', label: 'Ethio Groove', hint: 'Warm pentatonic keys · 104 BPM' },
  { id: 'upbeat-tech', label: 'Upbeat Tech', hint: 'Crisp startup pulse · 118 BPM' },
  { id: 'calm-lofi', label: 'Calm Lo-Fi', hint: 'Soft warm chords · 86 BPM' },
];

const AMHARIC_SCENE_LINES: Record<string, string> = {
  hook: 'እያንዳንዱን ጥሪ እና ወጪ በግልጽ ይቆጣጠሩ። ኮል አናላይዘር ኢትዮጵያ።',
  tariffs: 'የኢትዮ ቴሌኮም እና የሳፋሪኮም ሲሞችዎን የጥሪ ጊዜና የብር ወጪ በአንድ ቦታ ይከታተሉ።',
  topCallers: 'በብዛት የሚደውሉልዎትን እና የሚያናግሯቸውን ሰዎች በቀላሉ ይለዩ።',
  trends: 'የሳምንቱን እና የወሩን የጥሪ ጊዜ አዝማሚያ በግልጽ ግራፍ ይመልከቱ።',
  ussd: 'የኢትዮ ቴሌኮም እና ሳፋሪኮም USSD ኮዶችን በአንድ ንክኪ ይጠቀሙ።',
  hotlines: 'የአደጋ ጊዜ ቁጥሮችን 991 እና 907 በፍጥነት ያግኙ።',
  streaks: 'የዕለት ተዕለት የጥሪ ልምድዎን እና ስኬቶችዎን ይከታተሉ።',
  calendar: 'የኢትዮጵያ ካላንደር እና ዋና ዋና በዓላትን ሁልጊዜ ያስታውሱ።',
  birthdayWish: 'ለቤተሰብ እና ለጓደኞች የልደት እና የበዓል መልካም ምኞት በአማርኛ ይላኩ።',
  missedReminders: 'ያመለጡ ጥሪዎችን እና ረጅም ጊዜ ያላገኟቸውን ወዳጆች እንዳይረሱ ያስታውስዎታል።',
  reports: 'የጥሪ ሪፖርትዎን በPDF እና CSV በቀላሉ ያውርዱ።',
  privacy: 'መረጃዎ ሙሉ በሙሉ በስልክዎ ላይ በሚስጥር ይቀመጣል። አሁኑኑ ይጫኑት።',
};

const ENGLISH_SCENE_LINES: Record<string, string> = {
  hook: 'Understand every call and every Birr spent with Call Analyzer Ethiopia.',
  tariffs: 'Track Ethio Telecom and Safaricom talk time, airtime spend, and voice bundles in one view.',
  topCallers: 'See your most frequent callers and longest conversations at a glance.',
  trends: 'Explore daily and weekly talk-time trends with clear interactive charts.',
  ussd: 'Launch Ethio Telecom and Safaricom USSD balance and package codes in one tap.',
  hotlines: 'Access Ethiopian emergency hotlines like 991 and 907 instantly when it matters.',
  streaks: 'Stay consistent with calling streaks and relationship milestones.',
  calendar: 'Keep Ethiopian calendar dates and upcoming holidays right beside your calls.',
  birthdayWish: 'Send warm Amharic or English birthday and holiday wishes in seconds.',
  missedReminders: 'Never miss a callback or forget to reconnect with quiet contacts.',
  reports: 'Export clean PDF statements, CSV files, and private backups anytime.',
  privacy: 'Your call logs and contacts stay strictly on your device. Download today.',
};

export function buildAutoPromoScript(sceneIds: string[], lang: 'am' | 'en'): string {
  const dict = lang === 'am' ? AMHARIC_SCENE_LINES : ENGLISH_SCENE_LINES;
  const lines = sceneIds
    .map((id) => dict[id])
    .filter((line): line is string => Boolean(line));
  return lines.join(' ');
}

export async function decodeAudioBlobToBuffer(blob: Blob): Promise<AudioBuffer> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

function schedulePluck(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  duration: number,
  gainAmount: number,
  type: OscillatorType = 'triangle',
): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(4800, freq * 5.2), time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(320, freq * 1.4), time + duration);

  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(gainAmount, time + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(filter);
  filter.connect(env);
  env.connect(dest);

  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function scheduleSoftKick(ctx: OfflineAudioContext, dest: AudioNode, time: number, level: number): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(128, time);
  osc.frequency.exponentialRampToValueAtTime(44, time + 0.13);
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(level, time + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, time + 0.17);
  osc.connect(env);
  env.connect(dest);
  osc.start(time);
  osc.stop(time + 0.19);
}

function scheduleShaker(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  noiseBuffer: AudioBuffer,
  time: number,
  level: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(5500, time);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(level, time + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
  src.connect(hp);
  hp.connect(env);
  env.connect(dest);
  src.start(time);
  src.stop(time + 0.065);
}

function createNoiseBuffer(ctx: OfflineAudioContext, sampleRate: number): AudioBuffer {
  const len = Math.floor(sampleRate * 0.08);
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

export async function synthesizeMusicBed(
  preset: Exclude<PromoMusicPresetId, 'none' | 'custom'>,
  durationSec: number,
  sampleRate = 48000,
): Promise<AudioBuffer> {
  const safeDuration = Math.max(1, durationSec);
  const totalSamples = Math.ceil(safeDuration * sampleRate);
  const ctx = new OfflineAudioContext(2, totalSamples, sampleRate);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.85, 0);
  master.connect(ctx.destination);

  const noiseBuf = createNoiseBuffer(ctx, sampleRate);

  if (preset === 'ethio-groove') {
    // Tizita major pentatonic (C D E G A) inspired warm Ethiopian groove at 104 BPM
    const bpm = 104;
    const step = 60 / bpm / 2; // eighth note
    const melody = [
      261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 329.63,
      523.25, 440.0, 392.0, 329.63, 293.66, 392.0, 329.63, 261.63,
    ];
    const bass = [130.81, 130.81, 98.0, 98.0, 110.0, 110.0, 146.83, 98.0];

    const totalSteps = Math.ceil(safeDuration / step);
    for (let i = 0; i < totalSteps; i += 1) {
      const t = i * step;
      if (t >= safeDuration) break;

      const melFreq = melody[i % melody.length];
      if (i % 2 === 0 || i % 8 === 3 || i % 8 === 7) {
        schedulePluck(ctx, master, melFreq, t, step * 1.9, 0.14, 'triangle');
      }
      if (i % 4 === 0) {
        const bFreq = bass[Math.floor(i / 4) % bass.length];
        schedulePluck(ctx, master, bFreq, t, step * 3.6, 0.18, 'sine');
      }
      if (i % 4 === 0 || i % 8 === 6) {
        scheduleSoftKick(ctx, master, t, 0.2);
      }
      if (i % 2 === 1) {
        scheduleShaker(ctx, master, noiseBuf, t, 0.045);
      }
    }
  } else if (preset === 'upbeat-tech') {
    // Crisp modern startup pulse at 118 BPM
    const bpm = 118;
    const step = 60 / bpm / 2;
    const chords = [
      [261.63, 329.63, 392.0],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
    ];
    const arpOrder = [0, 1, 2, 1, 2, 0, 1, 2];
    const totalSteps = Math.ceil(safeDuration / step);

    for (let i = 0; i < totalSteps; i += 1) {
      const t = i * step;
      if (t >= safeDuration) break;
      const chord = chords[Math.floor(i / 8) % chords.length];
      const noteFreq = chord[arpOrder[i % arpOrder.length]] * (i % 8 === 6 ? 2 : 1);
      schedulePluck(ctx, master, noteFreq, t, step * 1.4, 0.11, 'triangle');

      if (i % 8 === 0) {
        for (const f of chord) {
          schedulePluck(ctx, master, f * 0.5, t, step * 7.5, 0.06, 'sine');
        }
      }
      if (i % 4 === 0) {
        scheduleSoftKick(ctx, master, t, 0.22);
      }
      if (i % 2 === 1) {
        scheduleShaker(ctx, master, noiseBuf, t, 0.05);
      }
    }
  } else {
    // Calm Lo-Fi warm chords at 86 BPM
    const bpm = 86;
    const beat = 60 / bpm;
    const chords = [
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 392.0],
      [164.81, 196.0, 246.94, 293.66],
    ];
    const totalBeats = Math.ceil(safeDuration / beat);
    for (let b = 0; b < totalBeats; b += 1) {
      const t = b * beat;
      if (t >= safeDuration) break;
      if (b % 4 === 0) {
        const chord = chords[Math.floor(b / 4) % chords.length];
        chord.forEach((f, idx) => {
          schedulePluck(ctx, master, f, t + idx * 0.025, beat * 3.8, 0.075, 'sine');
        });
      }
      if (b % 2 === 0) {
        scheduleSoftKick(ctx, master, t, 0.14);
      } else {
        scheduleShaker(ctx, master, noiseBuf, t, 0.03);
      }
    }
  }

  return ctx.startRendering();
}

export interface MixPromoAudioOptions {
  durationSec: number;
  musicPreset: PromoMusicPresetId;
  customMusicBuffer: AudioBuffer | null;
  musicVolume: number; // 0..1
  narrationBuffer: AudioBuffer | null;
  narrationVolume: number; // 0..1
  autoDuck: boolean;
  sampleRate?: number;
}

export async function mixPromoAudioToBuffer(options: MixPromoAudioOptions): Promise<AudioBuffer | null> {
  const {
    durationSec,
    musicPreset,
    customMusicBuffer,
    musicVolume,
    narrationBuffer,
    narrationVolume,
    autoDuck,
    sampleRate = 48000,
  } = options;

  const hasMusic =
    musicVolume > 0.005 &&
    (musicPreset === 'custom' ? Boolean(customMusicBuffer) : musicPreset !== 'none');
  const hasNarration = narrationVolume > 0.005 && Boolean(narrationBuffer);

  if (!hasMusic && !hasNarration) return null;

  const safeDuration = Math.max(0.5, durationSec);
  const totalSamples = Math.ceil(safeDuration * sampleRate);

  let musicBuffer: AudioBuffer | null = null;
  if (hasMusic) {
    if (musicPreset === 'custom') {
      musicBuffer = customMusicBuffer;
    } else if (musicPreset !== 'none') {
      musicBuffer = await synthesizeMusicBed(musicPreset, safeDuration, sampleRate);
    }
  }

  const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

  // Schedule music with loop, fade-in/out, and automatic ducking under narration
  if (musicBuffer && musicVolume > 0.005) {
    const musicGain = offline.createGain();
    const fadeIn = Math.min(0.6, safeDuration * 0.15);
    const fadeOut = Math.min(1.2, safeDuration * 0.25);
    const baseGain = Math.max(0.0001, Math.min(1, musicVolume));

    musicGain.gain.setValueAtTime(0.0001, 0);
    musicGain.gain.linearRampToValueAtTime(baseGain, fadeIn);

    if (autoDuck && narrationBuffer && hasNarration) {
      const ch0 = narrationBuffer.getChannelData(0);
      const winSec = 0.08;
      const winSamples = Math.max(1, Math.floor(narrationBuffer.sampleRate * winSec));
      const narLenSec = Math.min(safeDuration, narrationBuffer.duration);
      const duckedGain = Math.max(0.0001, baseGain * 0.28);

      for (let t = fadeIn; t < narLenSec; t += winSec) {
        const startIdx = Math.floor(t * narrationBuffer.sampleRate);
        const endIdx = Math.min(ch0.length, startIdx + winSamples);
        let sumSq = 0;
        for (let s = startIdx; s < endIdx; s += 1) {
          sumSq += ch0[s] * ch0[s];
        }
        const rms = Math.sqrt(sumSq / Math.max(1, endIdx - startIdx));
        const target = rms > 0.018 ? duckedGain : baseGain;
        musicGain.gain.setTargetAtTime(target, t, 0.09);
      }
      if (narLenSec < safeDuration - fadeOut) {
        musicGain.gain.setTargetAtTime(baseGain, narLenSec + 0.05, 0.18);
      }
    }

    const fadeOutStart = Math.max(fadeIn, safeDuration - fadeOut);
    musicGain.gain.setValueAtTime(baseGain, fadeOutStart);
    musicGain.gain.linearRampToValueAtTime(0.0001, safeDuration);
    musicGain.connect(offline.destination);

    let offset = 0;
    const clipLen = Math.max(0.25, musicBuffer.duration);
    while (offset < safeDuration) {
      const src = offline.createBufferSource();
      src.buffer = musicBuffer;
      src.connect(musicGain);
      src.start(offset);
      offset += clipLen;
    }
  }

  // Schedule narration starting at 0.25s so the opening frame breathes cleanly
  if (narrationBuffer && hasNarration) {
    const narGain = offline.createGain();
    narGain.gain.setValueAtTime(Math.max(0.0001, Math.min(1.25, narrationVolume)), 0);
    narGain.connect(offline.destination);

    const src = offline.createBufferSource();
    src.buffer = narrationBuffer;
    src.connect(narGain);
    src.start(0.25);
  }

  return offline.startRendering();
}

export interface SupportedWebCodecsAudio {
  muxerCodec: 'aac' | 'opus';
  encoderConfig: AudioEncoderConfig;
}

export async function findSupportedWebCodecsAudio(
  sampleRate = 48000,
  numberOfChannels = 2,
): Promise<SupportedWebCodecsAudio | null> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') {
    return null;
  }

  const candidates: Array<{ muxerCodec: 'aac' | 'opus'; codec: string; bitrate: number }> = [
    { muxerCodec: 'aac', codec: 'mp4a.40.2', bitrate: 128_000 },
    { muxerCodec: 'opus', codec: 'opus', bitrate: 128_000 },
  ];

  for (const cand of candidates) {
    try {
      const cfg: AudioEncoderConfig = {
        codec: cand.codec,
        sampleRate,
        numberOfChannels,
        bitrate: cand.bitrate,
      };
      const support = await AudioEncoder.isConfigSupported(cfg);
      if (support.supported) {
        return { muxerCodec: cand.muxerCodec, encoderConfig: cfg };
      }
    } catch {
      // try next codec
    }
  }
  return null;
}

export async function encodeAudioBufferToMuxer(
  audioBuffer: AudioBuffer,
  audioConfig: SupportedWebCodecsAudio,
  onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void,
): Promise<void> {
  let encoderError: Error | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      onChunk(chunk, meta);
    },
    error: (err) => {
      encoderError = err instanceof Error ? err : new Error(String(err));
    },
  });

  encoder.configure(audioConfig.encoderConfig);

  const sampleRate = audioBuffer.sampleRate;
  const numChannels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
  const totalFrames = audioBuffer.length;
  const chunkFrames = 4096;

  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

  try {
    for (let offset = 0; offset < totalFrames; offset += chunkFrames) {
      if (encoderError) throw encoderError;
      const frameCount = Math.min(chunkFrames, totalFrames - offset);
      const planar = new Float32Array(frameCount * numChannels);
      planar.set(left.subarray(offset, offset + frameCount), 0);
      if (numChannels > 1) {
        planar.set(right.subarray(offset, offset + frameCount), frameCount);
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frameCount,
        numberOfChannels: numChannels,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data: planar,
      });
      try {
        encoder.encode(audioData);
      } finally {
        audioData.close();
      }

      if (encoder.encodeQueueSize > 16) {
        await new Promise((r) => window.setTimeout(r, 4));
      }
    }

    await encoder.flush();
    if (encoderError) throw encoderError;
  } finally {
    try {
      if (encoder.state !== 'closed') encoder.close();
    } catch {
      // ignore close error
    }
  }
}
