import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Delete,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { BrandLogo } from '@/src/components/BrandLogo';
import { triggerHaptic } from '@/src/lib/haptics';

type LockActionResult = {
  ok: boolean;
  error?: string;
};

type RecoveryStage = 'none' | 'verify' | 'reset';

export function AppLockOverlay({
  onVerifyPin,
  onResetPin,
  onSetNewPin,
  onVerifyAccountPassword,
  onVerifyGoogleAccount,
  onSendPasswordReset,
  authEmail,
  authProvider,
  lockUntil = 0,
  pinEnabled = true,
  biometricEnabled = false,
  onVerifyBiometric,
  onSignOut,
}: {
  onVerifyPin: (pin: string) => Promise<boolean>;
  onResetPin: () => void;
  onSetNewPin?: (pin: string) => Promise<void>;
  onVerifyAccountPassword?: (password: string) => Promise<LockActionResult>;
  onVerifyGoogleAccount?: () => Promise<LockActionResult>;
  onSendPasswordReset?: (email: string) => Promise<LockActionResult>;
  authEmail?: string | null;
  authProvider?: 'google' | 'password' | null;
  lockUntil?: number;
  pinEnabled?: boolean;
  biometricEnabled?: boolean;
  onVerifyBiometric?: () => Promise<boolean>;
  onSignOut?: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [showPinPad, setShowPinPad] = useState(!biometricEnabled && pinEnabled);
  const [now, setNow] = useState(() => Date.now());
  const autoPromptedRef = useRef(false);

  // Verified Forgot PIN recovery state
  const [recoveryStage, setRecoveryStage] = useState<RecoveryStage>('none');
  const [accountPassword, setAccountPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [resetEmailBusy, setResetEmailBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [savingNewPin, setSavingNewPin] = useState(false);

  const remainingMs = Math.max(0, lockUntil - now);
  const isCoolingDown = remainingMs > 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    setNow(Date.now());
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockUntil) {
        window.clearInterval(id);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  const handleBiometricPrompt = useCallback(async () => {
    if (!biometricEnabled || !onVerifyBiometric || bioBusy) return;
    setBioBusy(true);
    setError('');
    try {
      const ok = await onVerifyBiometric();
      if (!ok && pinEnabled) {
        setShowPinPad(true);
      }
    } finally {
      setBioBusy(false);
    }
  }, [biometricEnabled, bioBusy, onVerifyBiometric, pinEnabled]);

  useEffect(() => {
    if (biometricEnabled && !autoPromptedRef.current && recoveryStage === 'none') {
      autoPromptedRef.current = true;
      void handleBiometricPrompt();
    }
  }, [biometricEnabled, handleBiometricPrompt, recoveryStage]);

  const handleDigit = (d: string) => {
    if (checking || isCoolingDown) return;
    if (digits.length >= 4) return;
    triggerHaptic('tap');
    const next = digits + d;
    setDigits(next);
    setError('');

    if (next.length === 4) {
      setChecking(true);
      void onVerifyPin(next).then((ok) => {
        setChecking(false);
        if (!ok) {
          setError('Incorrect PIN. Try again.');
          setDigits('');
        }
      });
    }
  };

  const handleBackspace = () => {
    if (checking || isCoolingDown) return;
    triggerHaptic('tap');
    setDigits((prev) => prev.slice(0, -1));
    setError('');
  };

  const openForgotPin = () => {
    setRecoveryStage('verify');
    setAccountPassword('');
    setRecoveryError('');
    setRecoveryInfo('');
    setNewPin('');
    setConfirmNewPin('');
  };

  const closeRecovery = () => {
    setRecoveryStage('none');
    setAccountPassword('');
    setRecoveryError('');
    setRecoveryInfo('');
    setNewPin('');
    setConfirmNewPin('');
  };

  const handleVerifyIdentity = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setRecoveryError('');
    setRecoveryInfo('');
    setVerifyBusy(true);
    try {
      const res =
        authProvider === 'google'
          ? onVerifyGoogleAccount
            ? await onVerifyGoogleAccount()
            : { ok: false, error: 'Google verification unavailable.' }
          : onVerifyAccountPassword
            ? await onVerifyAccountPassword(accountPassword)
            : { ok: false, error: 'Password verification unavailable.' };

      if (!res.ok) {
        setRecoveryError(res.error || 'Verification failed. Please try again.');
        return;
      }
      triggerHaptic('success');
      setAccountPassword('');
      setRecoveryStage('reset');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleForgotPasswordEmail = async () => {
    if (!authEmail || !onSendPasswordReset || resetEmailBusy) return;
    setRecoveryError('');
    setRecoveryInfo('');
    setResetEmailBusy(true);
    try {
      const res = await onSendPasswordReset(authEmail);
      if (!res.ok) {
        setRecoveryError(res.error || 'Could not send password reset email.');
        return;
      }
      setRecoveryInfo(
        `Password reset link sent to ${authEmail}. Reset your password from your inbox, then enter your new password here to reset your PIN.`,
      );
    } finally {
      setResetEmailBusy(false);
    }
  };

  const handleSaveReplacementPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    if (!/^\d{4}$/.test(newPin)) {
      setRecoveryError('Enter a new 4-digit PIN.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setRecoveryError('PIN confirmation does not match.');
      return;
    }
    if (!onSetNewPin) {
      onResetPin();
      return;
    }
    setSavingNewPin(true);
    try {
      await onSetNewPin(newPin);
      closeRecovery();
    } finally {
      setSavingNewPin(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={biometricEnabled && !showPinPad ? 'App Lock - Fingerprint' : 'App Lock PIN'}
      className="fixed inset-0 z-50 bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] flex flex-col items-center justify-center px-6 py-8 overflow-y-auto overscroll-contain pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
      <div className="w-full max-w-xs space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo size={46} />
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-[#08246B] dark:text-white flex items-center justify-center gap-2">
              {recoveryStage !== 'none' ? (
                <KeyRound size={17} className="text-[#FF6A00]" />
              ) : biometricEnabled && !showPinPad ? (
                <Fingerprint size={18} className="text-[#FF6A00]" />
              ) : (
                <Lock size={17} className="text-[#FF6A00]" />
              )}
              {recoveryStage === 'verify'
                ? 'Verify Your Identity'
                : recoveryStage === 'reset'
                  ? 'Reset Your PIN'
                  : 'Call Analyzer - ETH'}
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              {recoveryStage === 'verify'
                ? authProvider === 'google'
                  ? 'Confirm your Google account to set a new PIN or remove PIN lock'
                  : `Verify password for ${authEmail || 'your account'} to reset your PIN`
                : recoveryStage === 'reset'
                  ? 'Identity verified. Set a new 4-digit PIN or remove PIN lock.'
                  : biometricEnabled && !showPinPad
                    ? 'Touch the fingerprint sensor to unlock your calls and contacts'
                    : 'Enter your 4-digit PIN to unlock'}
            </p>
          </div>
        </div>

        {/* Recovery Stage 1: Verify Identity (Password + Forgot Password, or Google Re-Auth) */}
        {recoveryStage === 'verify' ? (
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 text-left space-y-3.5 shadow-sm">
            {recoveryError && (
              <p className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 px-3 py-2 text-xs font-medium text-[#DC2626] dark:text-[#F28B82]">
                {recoveryError}
              </p>
            )}
            {recoveryInfo && (
              <p className="rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 px-3 py-2 text-xs font-medium text-[#059669] dark:text-[#34D399]">
                {recoveryInfo}
              </p>
            )}

            {authProvider === 'google' ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={verifyBusy}
                  onClick={() => void handleVerifyIdentity()}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck size={16} />
                  {verifyBusy ? 'Verifying with Google...' : 'Verify with Google Account'}
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void handleVerifyIdentity(e)} className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Account password
                  </span>
                  <div className="relative">
                    <input
                      type={showAccountPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="Enter your account password"
                      className="w-full min-h-[44px] pl-3 pr-10 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccountPassword((v) => !v)}
                      aria-label={showAccountPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-[#8A93A0]"
                    >
                      {showAccountPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={verifyBusy}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck size={15} />
                  {verifyBusy ? 'Verifying...' : 'Verify & Reset PIN'}
                </button>

                {authEmail && onSendPasswordReset && (
                  <button
                    type="button"
                    disabled={resetEmailBusy}
                    onClick={() => void handleForgotPasswordEmail()}
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] text-xs font-semibold text-[#08246B] dark:text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Mail size={14} className="text-[#FF6A00]" />
                    {resetEmailBusy ? 'Sending reset link...' : 'Forgot password? Send reset email'}
                  </button>
                )}
              </form>
            )}

            <button
              type="button"
              onClick={closeRecovery}
              className="w-full min-h-[40px] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Back to lock screen
            </button>
          </div>
        ) : recoveryStage === 'reset' ? (
          /* Recovery Stage 2: Verified — Set New 4-Digit PIN or Remove PIN */
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 text-left space-y-3.5 shadow-sm">
            {recoveryError && (
              <p className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 px-3 py-2 text-xs font-medium text-[#DC2626] dark:text-[#F28B82]">
                {recoveryError}
              </p>
            )}

            <form onSubmit={(e) => void handleSaveReplacementPin(e)} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  New 4-digit PIN
                </span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm font-mono tracking-widest text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Confirm new PIN
                </span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm font-mono tracking-widest text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </label>

              <button
                type="submit"
                disabled={savingNewPin}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <Check size={15} />
                {savingNewPin ? 'Saving PIN...' : 'Save new PIN & Unlock'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                onResetPin();
                closeRecovery();
              }}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#DC2626]/35 text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 transition-colors"
            >
              Remove PIN lock &amp; Unlock
            </button>
          </div>
        ) : biometricEnabled && !showPinPad ? (
          /* Fingerprint Primary Screen */
          <div className="space-y-4">
            <button
              type="button"
              disabled={bioBusy}
              onClick={() => void handleBiometricPrompt()}
              className="mx-auto w-24 h-24 rounded-full bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-2 border-[#FF6A00]/60 text-[#FF6A00] hover:bg-[#FF6A00]/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-60"
              aria-label="Unlock with fingerprint"
            >
              <Fingerprint size={44} className={bioBusy ? 'animate-pulse' : ''} />
            </button>

            <button
              type="button"
              disabled={bioBusy}
              onClick={() => void handleBiometricPrompt()}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Fingerprint size={18} />
              {bioBusy ? 'Waiting for fingerprint...' : 'Unlock with Fingerprint'}
            </button>

            {pinEnabled && (
              <button
                type="button"
                onClick={() => setShowPinPad(true)}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] transition-colors"
              >
                Use 4-digit PIN instead
              </button>
            )}

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="min-h-[40px] mx-auto px-3 text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#DC2626] dark:hover:text-[#F28B82] flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut size={13} />
                Sign out &amp; switch account
              </button>
            )}
          </div>
        ) : (
          /* 4-Digit PIN Pad Screen */
          <>
            <div className="flex items-center justify-center gap-4 py-1" aria-live="polite">
              {[0, 1, 2, 3].map((idx) => (
                <span
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-colors ${
                    idx < digits.length
                      ? 'bg-[#FF6A00] border-[#FF6A00]'
                      : 'border-[#8A93A0] dark:border-[#6B7280]'
                  }`}
                />
              ))}
            </div>

            {isCoolingDown ? (
              <p className="text-xs font-medium text-[#D97706] dark:text-[#F59E0B] tabular-nums">
                Too many incorrect attempts. Try again in {remainingSec}s.
              </p>
            ) : error ? (
              <p className="text-xs font-medium text-[#DC2626] dark:text-[#F28B82]">{error}</p>
            ) : (
              <p className="text-xs text-transparent select-none">Ready</p>
            )}

            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={checking || isCoolingDown}
                  onClick={() => handleDigit(d)}
                  className="h-14 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] active:scale-95 text-lg font-mono font-bold text-[#08246B] dark:text-white transition-all disabled:opacity-45"
                >
                  {d}
                </button>
              ))}
              {biometricEnabled ? (
                <button
                  type="button"
                  disabled={bioBusy}
                  onClick={() => {
                    setShowPinPad(false);
                    void handleBiometricPrompt();
                  }}
                  aria-label="Unlock with fingerprint"
                  className="h-14 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border border-[#FF6A00]/40 text-[#FF6A00] active:scale-95 transition-all flex items-center justify-center disabled:opacity-45"
                >
                  <Fingerprint size={22} />
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                disabled={checking || isCoolingDown}
                onClick={() => handleDigit('0')}
                className="h-14 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] active:scale-95 text-lg font-mono font-bold text-[#08246B] dark:text-white transition-all disabled:opacity-45"
              >
                0
              </button>
              <button
                type="button"
                disabled={checking || isCoolingDown}
                onClick={handleBackspace}
                aria-label="Delete digit"
                className="h-14 rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] active:scale-95 text-[#08246B] dark:text-white transition-all flex items-center justify-center disabled:opacity-45"
              >
                <Delete size={20} />
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={openForgotPin}
                className="min-h-[42px] px-3 text-xs font-semibold text-[#FF6A00] hover:underline transition-colors"
              >
                Forgot PIN? Verify account to reset
              </button>

              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="min-h-[38px] mx-auto px-3 text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#DC2626] dark:hover:text-[#F28B82] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <LogOut size={13} />
                  Sign out &amp; switch account
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
