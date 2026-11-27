import { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Fingerprint, Lock } from 'lucide-react';
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
  pinEnabled = true,
  biometricEnabled = false,
  onVerifyBiometric,
  onSignOut,
}: {
  onVerifyPin: (pin: string) => Promise<boolean>;
  onResetPin: () => void;
  lockUntil?: number;
  pinEnabled?: boolean;
  biometricEnabled?: boolean;
  onVerifyBiometric?: () => Promise<boolean>;
  onSignOut?: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const autoPromptedRef = useRef(false);

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

  const handleBiometric = useCallback(async () => {
    if (checking || isLockedOut || !onVerifyBiometric) return;
    setChecking(true);
    setError('');
    try {
      const ok = await onVerifyBiometric();
      if (!ok) {
        setError('Fingerprint not verified. Tap the button below to try again.');
      }
    } finally {
      setChecking(false);
    }
  }, [checking, isLockedOut, onVerifyBiometric]);

  useEffect(() => {
    if (!biometricEnabled || !onVerifyBiometric || isLockedOut) return;
    if (autoPromptedRef.current) return;
    autoPromptedRef.current = true;
    void handleBiometric();
  }, [biometricEnabled, onVerifyBiometric, isLockedOut, handleBiometric]);

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
    if (pinEnabled && digits.length === 4 && !checking && !isLockedOut) {
      void submitPin(digits);
    }
  }, [pinEnabled, digits, isLockedOut]);

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

  const fingerprintOnly = !pinEnabled && biometricEnabled && Boolean(onVerifyBiometric);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fingerprintOnly ? 'Fingerprint app lock prompt' : 'Screen lock PIN prompt'}
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
            {fingerprintOnly
              ? 'Unlock with Fingerprint'
              : biometricEnabled && onVerifyBiometric
                ? 'Verify Fingerprint or PIN'
                : 'Enter 4-digit PIN'}
          </h1>
          <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            {fingerprintOnly
              ? 'Touch your fingerprint sensor to view your calls and contacts'
              : 'Casual screen lock on this device to hide calls and contacts from view'}
          </p>
        </div>

        {fingerprintOnly ? (
          <div className="space-y-4">
            <button
              type="button"
              disabled={checking || isLockedOut}
              onClick={() => void handleBiometric()}
              aria-label="Unlock app with fingerprint"
              className="mx-auto w-20 h-20 rounded-3xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-2 border-[#FF6A00]/45 hover:border-[#FF6A00] text-[#FF6A00] flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            >
              <Fingerprint size={38} strokeWidth={1.8} />
            </button>

            {error && (
              <p className="text-xs font-medium text-[#DC2626] dark:text-[#F28B82]">{error}</p>
            )}

            <button
              type="button"
              disabled={checking || isLockedOut}
              onClick={() => void handleBiometric()}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Fingerprint size={17} />
              {checking ? 'Verifying fingerprint...' : 'Unlock with Fingerprint'}
            </button>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00] transition-colors"
              >
                Sign out &amp; switch account
              </button>
            )}
          </div>
        ) : (
          <>
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

            {biometricEnabled && onVerifyBiometric && !isLockedOut && (
              <button
                type="button"
                disabled={checking}
                onClick={() => void handleBiometric()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border border-[#FF6A00]/35 hover:border-[#FF6A00] text-xs font-semibold text-[#FF6A00] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Fingerprint size={16} />
                Unlock with Fingerprint
              </button>
            )}

            <button
              type="button"
              onClick={onResetPin}
              className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00] transition-colors"
            >
              Forgot PIN? Remove PIN lock on this device
            </button>
          </>
        )}
      </div>
    </div>
  );
}
