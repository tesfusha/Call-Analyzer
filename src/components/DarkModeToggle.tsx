import { Moon, Sun } from 'lucide-react';

export function DarkModeToggle({
  isDark,
  onToggle,
  compact = false,
  label = 'Dark Mode',
}: {
  isDark: boolean;
  onToggle: () => void;
  compact?: boolean;
  label?: string;
}) {
  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
        title={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
        onClick={onToggle}
        className="min-h-[44px] px-1.5 flex items-center justify-center rounded-xl hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors shrink-0"
      >
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200 ${
            isDark
              ? 'bg-[#A9A9A9] border-[#A9A9A9]'
              : 'bg-[#E5E9F0] border-[#A9A9A9]'
          }`}
        >
          <span
            className={`inline-flex h-4.5 w-4.5 transform items-center justify-center rounded-full transition-transform duration-200 shadow-sm ${
              isDark
                ? 'translate-x-5.5 bg-[#1E2024] text-[#A9A9A9]'
                : 'translate-x-0.5 bg-white text-[#08246B]'
            }`}
          >
            {isDark ? <Moon size={11} /> : <Sun size={11} className="text-[#FF6A00]" />}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Disable dark mode' : 'Enable dark mode'}
      onClick={onToggle}
      className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-between gap-2 whitespace-nowrap transition-colors"
    >
      <span className="flex items-center gap-2">
        {isDark ? (
          <Moon size={15} className="text-[#A9A9A9]" />
        ) : (
          <Sun size={15} className="text-[#FF6A00]" />
        )}
        {label}
      </span>
      <span
        className={`relative inline-flex h-5.5 w-10 items-center rounded-full border transition-colors duration-200 shrink-0 ${
          isDark
            ? 'bg-[#A9A9A9] border-[#A9A9A9]'
            : 'bg-[#E5E9F0] border-[#A9A9A9]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 shadow-sm ${
            isDark ? 'translate-x-5 bg-[#1E2024]' : 'translate-x-0.5 bg-white'
          }`}
        />
      </span>
    </button>
  );
}
