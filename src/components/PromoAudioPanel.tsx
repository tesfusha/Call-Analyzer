import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Loader2,
  Mic,
  Music,
  Pause,
  Play,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { auth } from '@/src/lib/firebase';
import { triggerHaptic } from '@/src/lib/haptics';
import {
  ADDIS_LANGUAGES,
  PROMO_MUSIC_PRESETS,
  buildAutoPromoScript,
  decodeAudioBlobToBuffer,
  type AddisLanguageCode,
  type AddisVoiceOption,
  type PromoMusicPresetId,
} from '@/src/lib/promoAudio';

type VoiceSourceTab = 'addis' | 'mic' | 'upload';

export interface PromoAudioPanelProps {
  disabled: boolean;
  selectedFeatureIds: string[];
  videoDurationSec: number;
  musicPreset: PromoMusicPresetId;
  onMusicPresetChange: (preset: PromoMusicPresetId) => void;
  customMusicName: string | null;
  onCustomMusicLoaded: (buffer: AudioBuffer, name: string) => void;
  onClearCustomMusic: () => void;
  musicVolume: number;
  onMusicVolumeChange: (val: number) => void;
  autoDuck: boolean;
  onAutoDuckChange: (val: boolean) => void;
  narrationBuffer: AudioBuffer | null;
  narrationLabel: string | null;
  onNarrationLoaded: (buffer: AudioBuffer, label: string, audioBlob: Blob) => void;
  onClearNarration: () => void;
  narrationVolume: number;
  onNarrationVolumeChange: (val: number) => void;
  onNotify: (msg: string, haptic?: 'success' | false) => void;
}

export function PromoAudioPanel({
  disabled,
  selectedFeatureIds,
  videoDurationSec,
  musicPreset,
  onMusicPresetChange,
  customMusicName,
  onCustomMusicLoaded,
  onClearCustomMusic,
  musicVolume,
  onMusicVolumeChange,
  autoDuck,
  onAutoDuckChange,
  narrationBuffer,
  narrationLabel,
  onNarrationLoaded,
  onClearNarration,
  narrationVolume,
  onNarrationVolumeChange,
  onNotify,
}: PromoAudioPanelProps) {
  const [open, setOpen] = useState(false);
  const [voiceTab, setVoiceTab] = useState<VoiceSourceTab>('addis');
  const [addisLang, setAddisLang] = useState<AddisLanguageCode>('am');
  const [voices, setVoices] = useState<AddisVoiceOption[]>([
    { id: 'am-hamen', name: 'Hamen (Amharic)', language: 'am' },
  ]);
  const [voiceId, setVoiceId] = useState<string>('am-hamen');
  const [addisConfigured, setAddisConfigured] = useState<boolean | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [scriptText, setScriptText] = useState<string>(() =>
    buildAutoPromoScript(selectedFeatureIds, 'am'),
  );

  // Mic recording state
  const [recordingMic, setRecordingMic] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micTimerRef = useRef<number | null>(null);

  // Voice-only quick preview playback
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewUrlRef = useRef<string | null>(null);

  const musicFileRef = useRef<HTMLInputElement | null>(null);
  const voiceFileRef = useRef<HTMLInputElement | null>(null);

  const getBearerHeader = useCallback(async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      const token = await user.getIdToken();
      return token ? `Bearer ${token}` : null;
    } catch {
      return null;
    }
  }, []);

  // Load Addis AI voices when panel opens or language changes
  useEffect(() => {
    if (!open || voiceTab !== 'addis') return;
    let cancelled = false;
    const loadVoices = async () => {
      const bearer = await getBearerHeader();
      if (!bearer || cancelled) return;
      setLoadingVoices(true);
      try {
        const res = await fetch(`/api/tts/addis/voices?language=${encodeURIComponent(addisLang)}`, {
          headers: { Authorization: bearer },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          configured?: boolean;
          voices?: AddisVoiceOption[];
        };
        if (cancelled) return;
        if (typeof data.configured === 'boolean') {
          setAddisConfigured(data.configured);
        }
        if (Array.isArray(data.voices) && data.voices.length > 0) {
          setVoices(data.voices);
          setVoiceId((prev) =>
            data.voices?.some((v) => v.id === prev) ? prev : data.voices![0].id,
          );
        }
      } catch {
        // Keep fallback voice list silently
      } finally {
        if (!cancelled) setLoadingVoices(false);
      }
    };
    void loadVoices();
    return () => {
      cancelled = true;
    };
  }, [addisLang, getBearerHeader, open, voiceTab]);

  // Cleanup mic & preview audio on unmount
  useEffect(() => {
    return () => {
      if (micTimerRef.current !== null) window.clearInterval(micTimerRef.current);
      if (micRecorderRef.current && micRecorderRef.current.state !== 'inactive') {
        micRecorderRef.current.stop();
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (voicePreviewAudioRef.current) {
        voicePreviewAudioRef.current.pause();
        voicePreviewAudioRef.current = null;
      }
      if (voicePreviewUrlRef.current) {
        URL.revokeObjectURL(voicePreviewUrlRef.current);
        voicePreviewUrlRef.current = null;
      }
    };
  }, []);

  const stopVoicePreview = useCallback(() => {
    if (voicePreviewAudioRef.current) {
      voicePreviewAudioRef.current.pause();
      voicePreviewAudioRef.current.currentTime = 0;
    }
    setPreviewingVoice(false);
  }, []);

  const setVoicePreviewBlob = useCallback(
    (blob: Blob | null) => {
      stopVoicePreview();
      if (voicePreviewUrlRef.current) {
        URL.revokeObjectURL(voicePreviewUrlRef.current);
        voicePreviewUrlRef.current = null;
      }
      if (blob) {
        voicePreviewUrlRef.current = URL.createObjectURL(blob);
      }
    },
    [stopVoicePreview],
  );

  const handleToggleVoicePreview = useCallback(() => {
    if (!voicePreviewUrlRef.current) return;
    if (previewingVoice) {
      stopVoicePreview();
      return;
    }
    const audio = new Audio(voicePreviewUrlRef.current);
    audio.onended = () => setPreviewingVoice(false);
    audio.onerror = () => setPreviewingVoice(false);
    voicePreviewAudioRef.current = audio;
    setPreviewingVoice(true);
    void audio.play().catch(() => setPreviewingVoice(false));
  }, [previewingVoice, stopVoicePreview]);

  const handleMusicFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVoiceError(null);
    try {
      const buffer = await decodeAudioBlobToBuffer(file);
      onCustomMusicLoaded(buffer, file.name);
      onMusicPresetChange('custom');
      onNotify(`Loaded music track: ${file.name} (${buffer.duration.toFixed(1)}s)`, 'success');
    } catch {
      onNotify('Could not decode that audio file. Try an MP3, WAV, or M4A track.');
    }
  };

  const handleVoiceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVoiceError(null);
    try {
      const buffer = await decodeAudioBlobToBuffer(file);
      setVoicePreviewBlob(file);
      onNarrationLoaded(buffer, file.name, file);
      onNotify(`Loaded narration: ${file.name} (${buffer.duration.toFixed(1)}s)`, 'success');
    } catch {
      setVoiceError('Could not decode that voice file. Try MP3, WAV, or M4A.');
    }
  };

  const handleGenerateAddisVoice = async () => {
    const text = scriptText.trim();
    if (!text) {
      setVoiceError('Write or auto-fill a script first.');
      return;
    }
    const bearer = await getBearerHeader();
    if (!bearer) {
      setVoiceError('Sign in to generate Addis AI voice narration.');
      return;
    }
    triggerHaptic('tap');
    setVoiceError(null);
    setGeneratingVoice(true);
    try {
      const res = await fetch('/api/tts/addis/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer,
        },
        body: JSON.stringify({
          text,
          language: addisLang,
          voiceId,
        }),
      });

      const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
      if (!res.ok) {
        let msg = `Voice generation failed (${res.status}).`;
        if (contentType.includes('application/json')) {
          const errBody = (await res.json()) as { error?: string; code?: string };
          if (errBody.code === 'KEY_NOT_CONFIGURED') {
            setAddisConfigured(false);
          }
          if (errBody.error) msg = errBody.error;
        }
        setVoiceError(msg);
        return;
      }

      const audioBlob = await res.blob();
      const buffer = await decodeAudioBlobToBuffer(audioBlob);
      const langName = ADDIS_LANGUAGES.find((l) => l.code === addisLang)?.label ?? addisLang.toUpperCase();
      const label = `Addis AI · ${langName}`;
      setAddisConfigured(true);
      setVoicePreviewBlob(audioBlob);
      onNarrationLoaded(buffer, label, audioBlob);
      onNotify(`Generated ${langName} narration (${buffer.duration.toFixed(1)}s).`, 'success');
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : 'Could not generate Addis AI voice right now.',
      );
    } finally {
      setGeneratingVoice(false);
    }
  };

  const handleStartMicRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Microphone recording is not supported in this browser.');
      return;
    }
    setVoiceError(null);
    triggerHaptic('tap');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      micRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        if (micTimerRef.current !== null) {
          window.clearInterval(micTimerRef.current);
          micTimerRef.current = null;
        }
        setRecordingMic(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        void decodeAudioBlobToBuffer(blob)
          .then((buffer) => {
            setVoicePreviewBlob(blob);
            onNarrationLoaded(buffer, 'Mic Recording', blob);
            onNotify(`Recorded voiceover (${buffer.duration.toFixed(1)}s).`, 'success');
          })
          .catch(() => {
            setVoiceError('Could not decode microphone recording.');
          });
      };

      setMicSeconds(0);
      setRecordingMic(true);
      recorder.start(250);
      micTimerRef.current = window.setInterval(() => {
        setMicSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setVoiceError('Microphone permission was denied or unavailable.');
    }
  };

  const handleStopMicRecording = () => {
    triggerHaptic('tap');
    if (micRecorderRef.current && micRecorderRef.current.state !== 'inactive') {
      micRecorderRef.current.stop();
    }
  };

  const summaryLabel = (() => {
    const parts: string[] = [];
    if (musicPreset === 'custom' && customMusicName) {
      parts.push('Custom music');
    } else if (musicPreset !== 'none') {
      const found = PROMO_MUSIC_PRESETS.find((p) => p.id === musicPreset);
      if (found) parts.push(found.label);
    }
    if (narrationBuffer) {
      parts.push(`Voice ${narrationBuffer.duration.toFixed(1)}s`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Optional';
  })();

  const narrationOverflows = Boolean(
    narrationBuffer && narrationBuffer.duration + 0.25 > videoDurationSec + 0.4,
  );

  return (
    <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] overflow-hidden">
      <input
        ref={musicFileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => void handleMusicFileChange(e)}
      />
      <input
        ref={voiceFileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => void handleVoiceFileChange(e)}
      />

      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          triggerHaptic('tap');
          setOpen((v) => !v);
        }}
        className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
      >
        <span className="text-xs font-semibold text-[#08246B] dark:text-white flex items-center gap-1.5">
          <Music size={14} className="text-[#FF6A00]" />
          Music &amp; Voice Narration
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            {summaryLabel}
          </span>
          <ChevronDown
            size={15}
            className={`text-[#4B5563] dark:text-[var(--dark-text-secondary)] transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-4 bg-white dark:bg-[var(--dark-surface)]">
          {/* Background Music */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#08246B] dark:text-white">
                Background Music
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => musicFileRef.current?.click()}
                className="text-[11px] font-semibold text-[#FF6A00] hover:underline inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Upload size={12} />
                Upload MP3/WAV
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {PROMO_MUSIC_PRESETS.map((preset) => {
                const active = musicPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      triggerHaptic('tap');
                      onMusicPresetChange(preset.id);
                    }}
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-left transition-colors border ${
                      active
                        ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00]/50 text-[#08246B] dark:text-white'
                        : 'bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                    }`}
                  >
                    <p className="text-[11px] font-semibold leading-tight">{preset.label}</p>
                    <p className="text-[10px] opacity-80 truncate">{preset.hint}</p>
                  </button>
                );
              })}
            </div>

            {customMusicName && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/12 border border-[#FF6A00]/35 px-2.5 py-1.5 text-[11px]">
                <span className="truncate font-medium text-[#08246B] dark:text-white">
                  Custom: {customMusicName}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onClearCustomMusic}
                  aria-label="Remove custom music"
                  className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#EF4444] p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}

            {musicPreset !== 'none' && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  <span className="inline-flex items-center gap-1">
                    <Volume2 size={12} />
                    Music Volume
                  </span>
                  <span className="font-mono tabular-nums">{Math.round(musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  aria-label="Music volume"
                  min={0.05}
                  max={1}
                  step={0.05}
                  disabled={disabled}
                  value={musicVolume}
                  onChange={(e) => onMusicVolumeChange(Number(e.target.value))}
                  className="w-full accent-[#FF6A00] cursor-pointer"
                />
                <label className="flex items-center gap-2 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoDuck}
                    disabled={disabled}
                    onChange={(e) => onAutoDuckChange(e.target.checked)}
                    className="rounded border-[#DDE4EA] accent-[#FF6A00]"
                  />
                  <span>Auto-duck music softly while narrator speaks</span>
                </label>
              </div>
            )}
          </div>

          {/* Voice Narration */}
          <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2.5">
            <span className="block text-xs font-semibold text-[#08246B] dark:text-white">
              Voice Narration
            </span>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
              {(
                [
                  { id: 'addis', label: 'Addis AI' },
                  { id: 'mic', label: 'Record Mic' },
                  { id: 'upload', label: 'Upload File' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    triggerHaptic('tap');
                    setVoiceError(null);
                    setVoiceTab(tab.id);
                  }}
                  className={`min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    voiceTab === tab.id
                      ? 'bg-[#FF6A00] text-white'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {voiceTab === 'addis' && (
              <div className="space-y-2">
                {addisConfigured === false && (
                  <p className="rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/12 border border-[#FF6A00]/35 px-2.5 py-2 text-[11px] text-[#08246B] dark:text-white leading-relaxed">
                    Add <span className="font-mono font-semibold">ADDIS_API_KEY</span> in{' '}
                    <strong>Settings → Secrets</strong> to generate Addis AI voices directly here.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="addis-lang-select"
                      className="block text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                    >
                      Language
                    </label>
                    <select
                      id="addis-lang-select"
                      disabled={disabled || generatingVoice}
                      value={addisLang}
                      onChange={(e) => setAddisLang(e.target.value as AddisLanguageCode)}
                      className="w-full min-h-[36px] px-2.5 rounded-lg bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                    >
                      {ADDIS_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label} ({lang.nativeLabel})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="addis-voice-select"
                      className="block text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                    >
                      Voice {loadingVoices ? '…' : ''}
                    </label>
                    <select
                      id="addis-voice-select"
                      disabled={disabled || generatingVoice || loadingVoices}
                      value={voiceId}
                      onChange={(e) => setVoiceId(e.target.value)}
                      className="w-full min-h-[36px] px-2.5 rounded-lg bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                    >
                      {voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Narration Script
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={disabled || generatingVoice}
                      onClick={() => {
                        triggerHaptic('tap');
                        setAddisLang('am');
                        setScriptText(buildAutoPromoScript(selectedFeatureIds, 'am'));
                      }}
                      className="text-[11px] font-semibold text-[#FF6A00] hover:underline"
                    >
                      Auto-fill Amharic
                    </button>
                    <span className="text-[#DDE4EA] dark:text-[var(--dark-border)]">|</span>
                    <button
                      type="button"
                      disabled={disabled || generatingVoice}
                      onClick={() => {
                        triggerHaptic('tap');
                        setScriptText(buildAutoPromoScript(selectedFeatureIds, 'en'));
                      }}
                      className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white"
                    >
                      English
                    </button>
                  </div>
                </div>

                <textarea
                  rows={3}
                  maxLength={2500}
                  disabled={disabled || generatingVoice}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="የቪዲዮውን ማብራሪያ እዚህ ይጻፉ..."
                  className="w-full p-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00] resize-y leading-relaxed"
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {scriptText.trim().length} / 2500 chars
                  </span>
                  <button
                    type="button"
                    disabled={disabled || generatingVoice || !scriptText.trim()}
                    onClick={() => void handleGenerateAddisVoice()}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#08246B] hover:bg-[#0B308E] disabled:opacity-50 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                  >
                    {generatingVoice ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} className="text-[#FF6A00]" />
                    )}
                    {generatingVoice ? 'Generating Voice...' : 'Generate Addis AI Voice'}
                  </button>
                </div>
              </div>
            )}

            {voiceTab === 'mic' && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    {recordingMic
                      ? `Recording... ${String(Math.floor(micSeconds / 60)).padStart(2, '0')}:${String(micSeconds % 60).padStart(2, '0')}`
                      : 'Record your own voiceover'}
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Speak in Amharic or English — mixed automatically on export.
                  </p>
                </div>
                {recordingMic ? (
                  <button
                    type="button"
                    onClick={handleStopMicRecording}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-xs font-semibold text-white inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Square size={13} />
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleStartMicRecording()}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Mic size={14} />
                    Record
                  </button>
                )}
              </div>
            )}

            {voiceTab === 'upload' && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => voiceFileRef.current?.click()}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-dashed border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] text-xs font-semibold text-[#08246B] dark:text-white inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Upload size={14} className="text-[#FF6A00]" />
                Choose Voiceover File (MP3, WAV, M4A)
              </button>
            )}

            {voiceError && (
              <p className="rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 px-2.5 py-2 text-[11px] text-[#DC2626] dark:text-[#F28B82]">
                {voiceError}
              </p>
            )}

            {narrationBuffer && (
              <div className="rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                      {narrationLabel || 'Voice Narration'}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      {narrationBuffer.duration.toFixed(1)}s · Video {videoDurationSec.toFixed(1)}s
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={handleToggleVoicePreview}
                      aria-label={previewingVoice ? 'Stop voice preview' : 'Play voice preview'}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center justify-center"
                    >
                      {previewingVoice ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setVoicePreviewBlob(null);
                        onClearNarration();
                      }}
                      aria-label="Remove narration"
                      className="w-8 h-8 rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] hover:text-[#EF4444] flex items-center justify-center"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0">
                    Voice Vol
                  </span>
                  <input
                    type="range"
                    aria-label="Narration volume"
                    min={0.2}
                    max={1.25}
                    step={0.05}
                    disabled={disabled}
                    value={narrationVolume}
                    onChange={(e) => onNarrationVolumeChange(Number(e.target.value))}
                    className="flex-1 accent-[#FF6A00] cursor-pointer"
                  />
                  <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] w-9 text-right">
                    {Math.round(narrationVolume * 100)}%
                  </span>
                </div>

                {narrationOverflows && (
                  <p className="text-[11px] text-[#FF6A00]">
                    Voice is longer than the selected video ({videoDurationSec.toFixed(0)}s) — add more scenes or shorten the script so the end isn&apos;t clipped.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
