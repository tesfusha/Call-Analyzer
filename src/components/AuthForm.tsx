import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  LogIn,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { hasNativeGoogleAuth, isNativeCapacitor } from '@/src/lib/capacitor';
import { useCalls } from '@/src/store/CallsContext';

type AuthFormMode = 'signin' | 'signup';

export function AuthForm({
  allowGuest = true,
  initialMode = 'signin',
  reason,
  onClose,
  onOpenGuide,
}: {
  allowGuest?: boolean;
  initialMode?: AuthFormMode;
  reason?: string | null;
  onClose?: () => void;
  onOpenGuide?: () => void;
}) {
  const {
    signInWithGoogle,
    signInWithEmail,
    createAccountWithEmail,
    sendPasswordReset,
    enterGuestMode,
  } = useCalls();

  const prefersReducedMotion = useReducedMotion();
  const isNative = isNativeCapacitor();
  const showGoogleButton = !isNative || hasNativeGoogleAuth();
  const [mode, setMode] = useState<AuthFormMode>(initialMode);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setFormError(null);
    setFormInfo(null);
    setGoogleBusy(false);
  }, [initialMode]);

  // Recover automatically if an OAuth popup fails to resolve after returning to the app
  useEffect(() => {
    if (!googleBusy) return;
    let recoveryTimer: number | null = null;
    const scheduleReset = () => {
      if (recoveryTimer) window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => {
        setGoogleBusy(false);
      }, 2500);
    };
    const onFocus = () => scheduleReset();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleReset();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (recoveryTimer) window.clearTimeout(recoveryTimer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [googleBusy]);

  const handleGoogle = async () => {
    setFormError(null);
    setFormInfo(null);
    setGoogleBusy(true);
    try {
      const res = await signInWithGoogle();
      if (!res.ok && res.error) setFormError(res.error);
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormInfo(null);
    setGoogleBusy(false);
    setEmailBusy(true);
    try {
      if (mode === 'signin') {
        const res = await signInWithEmail(email, password);
        if (!res.ok && res.error) setFormError(res.error);
      } else {
        const res = await createAccountWithEmail({
          email,
          phone,
          password,
          confirmPassword,
          passwordHint,
          agreedToTerms,
        });
        if (!res.ok && res.error) setFormError(res.error);
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setFormError(null);
    setFormInfo(null);
    setResetBusy(true);
    try {
      const res = await sendPasswordReset(email);
      if (!res.ok && res.error) {
        setFormError(res.error);
      } else {
        setFormInfo(`Password reset link sent to ${email.trim()}. Check your inbox.`);
      }
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-[#08246B] dark:text-white">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your private account'}
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Call Analyzer - ETH · Private per-user workspace
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login prompt"
            className="min-h-[40px] min-w-[40px] rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {reason && (
        <div className="rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/12 border border-[#FF6A00]/35 px-3.5 py-2.5 text-xs font-medium text-[#08246B] dark:text-white">
          {reason}
        </div>
      )}

      {/* Primary Option 1: Google Login (hidden in Android APK unless native Google Auth plugin is installed) */}
      {showGoogleButton && (
        <>
          <button
            type="button"
            disabled={googleBusy || emailBusy}
            onClick={() => void handleGoogle()}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn size={17} />
            {googleBusy ? 'Connecting Google...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            <span className="h-px flex-1 bg-[#DDE4EA] dark:bg-[var(--dark-border)]" />
            <span>or use email</span>
            <span className="h-px flex-1 bg-[#DDE4EA] dark:bg-[var(--dark-border)]" />
          </div>
        </>
      )}

      {/* Mode Switcher: Email Login vs Create Account */}
      <div
        role="tablist"
        aria-label="Account sign-in or registration"
        className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          onClick={() => {
            setMode('signin');
            setFormError(null);
            setFormInfo(null);
            setGoogleBusy(false);
          }}
          className={`relative min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            mode === 'signin'
              ? 'text-[#08246B] dark:text-white'
              : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
          }`}
        >
          {mode === 'signin' && (
            <motion.span
              layoutId="auth-mode-active-pill"
              transition={
                prefersReducedMotion
                  ? { duration: 0.05 }
                  : { type: 'spring', stiffness: 680, damping: 44, mass: 0.5 }
              }
              aria-hidden="true"
              className="absolute inset-0 rounded-lg bg-white dark:bg-[var(--dark-surface)] shadow-xs"
            />
          )}
          <LogIn size={14} className="relative z-10" />
          <span className="relative z-10">Email Login</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          onClick={() => {
            setMode('signup');
            setFormError(null);
            setFormInfo(null);
            setGoogleBusy(false);
          }}
          className={`relative min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            mode === 'signup'
              ? 'text-[#08246B] dark:text-white'
              : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
          }`}
        >
          {mode === 'signup' && (
            <motion.span
              layoutId="auth-mode-active-pill"
              transition={
                prefersReducedMotion
                  ? { duration: 0.05 }
                  : { type: 'spring', stiffness: 680, damping: 44, mass: 0.5 }
              }
              aria-hidden="true"
              className="absolute inset-0 rounded-lg bg-white dark:bg-[var(--dark-surface)] shadow-xs"
            />
          )}
          <UserPlus size={14} className="relative z-10" />
          <span className="relative z-10">Create Account</span>
        </button>
      </div>

      <motion.div
        key={mode}
        initial={prefersReducedMotion ? false : { opacity: 0.75 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0.04 : 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            Email
          </span>
          <div className="relative">
            <Mail
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
            />
            <input
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
            />
          </div>
        </label>

        {mode === 'signup' && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Phone
            </span>
            <div className="relative">
              <Phone
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
              />
              <input
                type="tel"
                required
                autoComplete="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 911 248 890"
                className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
              />
            </div>
          </label>
        )}

        <label className="block space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Password
            </span>
            {mode === 'signin' && (
              <button
                type="button"
                disabled={resetBusy || emailBusy}
                onClick={() => void handleForgotPassword()}
                className="text-[11px] font-semibold text-[#FF6A00] hover:underline disabled:opacity-50"
              >
                {resetBusy ? 'Sending...' : 'Forgot password?'}
              </button>
            )}
          </div>
          <div className="relative">
            <Lock
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
              className="w-full min-h-[44px] pl-9 pr-10 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-[#8A93A0] hover:text-[#08246B] dark:hover:text-white"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </label>

        {mode === 'signup' && (
          <>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Confirm Password
              </span>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
                />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full min-h-[44px] pl-9 pr-10 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center text-[#8A93A0] hover:text-[#08246B] dark:hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Password hint
              </span>
              <div className="relative">
                <HelpCircle
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
                />
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={passwordHint}
                  onChange={(e) => setPasswordHint(e.target.value)}
                  placeholder="Short clue only (never your real password)"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                />
              </div>
            </label>

            <label className="flex items-start gap-2.5 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-[#FF6A00] shrink-0"
              />
              <span className="text-xs leading-relaxed text-[#08246B] dark:text-white">
                <strong className="font-semibold">Agreed to terms:</strong>{' '}
                <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Your call logs, contacts, and personal records remain strictly private to your account — no data is seen or shared with 3rd parties.
                </span>
              </span>
            </label>
          </>
        )}

        {formError && (
          <p className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 px-3 py-2 text-xs font-medium text-[#DC2626] dark:text-[#F28B82]">
            {formError}
          </p>
        )}

        {formInfo && (
          <p className="rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 px-3 py-2 text-xs font-medium text-[#059669] dark:text-[#34D399]">
            {formInfo}
          </p>
        )}

        <button
          type="submit"
          disabled={emailBusy}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {mode === 'signin' ? <LogIn size={16} /> : <UserPlus size={16} />}
          {emailBusy
            ? mode === 'signin'
              ? 'Signing in...'
              : 'Creating account...'
            : mode === 'signin'
              ? 'Sign in with Email'
              : 'Create Account'}
        </button>
      </form>
      </motion.div>

      {allowGuest && (
        <div className="pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2">
          <button
            type="button"
            disabled={emailBusy}
            onClick={enterGuestMode}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center gap-2 transition-colors"
          >
            <Users size={15} className="text-[#FF6A00]" />
            Log as guest (Explore samples)
          </button>
          <p className="text-[11px] text-center text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            Guests can browse sample calls &amp; charts. Sign in or create an account to import data.
          </p>
        </div>
      )}

      {onOpenGuide && (
        <button
          type="button"
          onClick={onOpenGuide}
          className="w-full min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/12 flex items-center justify-center gap-1.5 transition-colors"
        >
          <HelpCircle size={14} />
          See how it works · Animated App Guide
        </button>
      )}
    </div>
  );
}
