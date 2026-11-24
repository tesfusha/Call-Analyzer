import { Moon, Sun } from 'lucide-react';

export function DarkModeToggle({
  isDark,
  onToggle,
  compact = false,
  label = 'Dark Mode',
  mode,
  onSelectAuto,
}: {
  isDark: boolean;
  onToggle: () => void;
  compact?: boolean;
  label?: string;
  mode?: 'system' | 'light' | 'dark-gray';
  onSelectAuto?: () => void;
}) {
  const isAuto = mode === 'system';
  const nextManualLabel = isDark ? 'Bright' : 'Dark';
  const compactTitle = isAuto
    ? `Auto (${isDark ? 'Dark' : 'Bright'}) · Tap to switch to ${nextManualLabel}`
    : `Switch to ${nextManualLabel} theme`;

  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={compactTitle}
        title={compactTitle}
        onClick={onToggle}
        className="min-h-[44px] px-1.5 flex items-center justify-center rounded-xl hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors shrink-0"
      >
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-100 shrink-0 ${
            isDark
              ? 'bg-[#2A2D34] border-[#FF6A00]/60'
              : 'bg-[#E5E9F0] border-[#A9A9A9]'
          }`}
        >
          <span
            className={`inline-flex h-4.5 w-4.5 transform items-center justify-center rounded-full transition-transform duration-100 shadow-sm ${
              isDark
                ? 'translate-x-5.5 bg-[#111214] text-[#FF6A00]'
                : 'translate-x-0.5 bg-white text-[#08246B]'
            }`}
          >
            {isDark ? <Moon size={11} className="shrink-0" /> : <Sun size={11} className="text-[#FF6A00] shrink-0" />}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="w-full flex items-center gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={`Switch to ${nextManualLabel} theme`}
        onClick={onToggle}
        className="flex-1 min-w-0 min-h-[42px] px-3 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-between gap-2 whitespace-nowrap transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          {isDark ? (
            <Moon size={15} className="text-[#FF6A00] shrink-0" />
          ) : (
            <Sun size={15} className="text-[#FF6A00] shrink-0" />
          )}
          <span className="truncate">{label}</span>
        </span>
        <span
          className={`relative inline-flex h-5.5 w-10 items-center rounded-full border transition-colors duration-100 shrink-0 ${
            isDark
              ? 'bg-[#2A2D34] border-[#FF6A00]/60'
              : 'bg-[#E5E9F0] border-[#A9A9A9]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-100 shadow-sm ${
              isDark ? 'translate-x-5 bg-[#FF6A00]' : 'translate-x-0.5 bg-white'
            }`}
          />
        </span>
      </button>

      {onSelectAuto && (
        <button
          type="button"
          onClick={onSelectAuto}
          aria-pressed={isAuto}
          title={isAuto ? 'Following device theme' : 'Follow device theme (Auto)'}
          className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
            isAuto
              ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
              : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:border-[#FF6A00] hover:text-[#08246B] dark:hover:text-white'
          }`}
        >
          Auto
        </button>
      )}
    </div>
  );
}
