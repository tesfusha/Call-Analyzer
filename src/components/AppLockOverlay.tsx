import { useEffect, useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { BrandLogo } from '@/src/components/BrandLogo';

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

export function AppLockOverlay({
  onVerifyPin,
  onResetPin,
  lockUntil = 0,
}: {
  onVerifyPin: (pin: string) => Promise<boolean>;
  onResetPin: () => void;
  lockUntil?: number;
}) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const remainingSeconds =
    lockUntil > nowMs ? Math.max(1, Math.ceil((lockUntil - nowMs) / 1000)) : 0;
  const isLockedOut = remainingSeconds > 0;

  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (current >= lockUntil) {
        window.clearInterval(id);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  const submitPin = async (code: string) => {
    if (isLockedOut) return;
    setChecking(true);
    setError('');
    try {
      const ok = await onVerifyPin(code);
      if (!ok) {
        setError('Incorrect PIN. Please try again.');
        setDigits('');
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (digits.length === 4 && !checking && !isLockedOut) {
      void submitPin(digits);
    }
  }, [digits, isLockedOut]);

  const handleDigit = (d: string) => {
    if (checking || isLockedOut || digits.length >= 4) return;
    setError('');
    setDigits((prev) => `${prev}${d}`);
  };

  const handleBackspace = () => {
    if (checking || isLockedOut) return;
    setError('');
    setDigits((prev) => prev.slice(0, -1));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Screen lock PIN prompt"
      className="fixed inset-0 z-50 bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-6 space-y-6 text-center shadow-2xl">
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2.5">
            <BrandLogo size={38} />
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF6A00]">
            <Lock size={14} />
            <span>Screen Locked</span>
          </div>
          <h1 className="text-lg font-bold text-[#08246B] dark:text-white">
            Enter 4-digit PIN
          </h1>
          <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            Casual screen lock on this device to hide calls and contacts from view
          </p>
        </div>

        <div className="flex items-center justify-center gap-3.5 py-1" aria-hidden="true">
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < digits.length;
            return (
              <span
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                  filled
                    ? 'bg-[#FF6A00] border-[#FF6A00]'
                    : 'border-[#CBD5E1] dark:border-[var(--dark-border-strong)] bg-transparent'
                }`}
              />
            );
          })}
        </div>

        {isLockedOut ? (
          <p className="text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] font-mono tabular-nums">
            Too many wrong attempts. Try again in {formatCountdown(remainingSeconds)}.
          </p>
        ) : (
          error && (
            <p className="text-xs font-medium text-[#DC2626] dark:text-[#F28B82]">{error}</p>
          )
        )}

        <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={checking || isLockedOut}
              onClick={() => handleDigit(num)}
              className="h-14 rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] hover:bg-[#DDE4EA] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 text-lg font-bold font-mono tabular-nums text-[#08246B] dark:text-white transition-colors active:scale-95"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={checking || isLockedOut || digits.length === 0}
            onClick={() => {
              setDigits('');
              setError('');
            }}
            className="h-14 rounded-2xl text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={checking || isLockedOut}
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] hover:bg-[#DDE4EA] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 text-lg font-bold font-mono tabular-nums text-[#08246B] dark:text-white transition-colors active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            disabled={checking || isLockedOut || digits.length === 0}
            onClick={handleBackspace}
            aria-label="Backspace"
            className="h-14 rounded-2xl flex items-center justify-center text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 transition-colors"
          >
            <Delete size={20} />
          </button>
        </div>

        <button
          type="button"
          onClick={onResetPin}
          className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00] transition-colors"
        >
          Forgot PIN? Remove screen lock on this device
        </button>
      </div>
    </div>
  );
}
