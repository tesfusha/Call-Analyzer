import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  Bell,
  Calendar,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  Settings,
  ShieldCheck,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import { AdminTab } from '@/src/components/AdminTab';
import { AnalyticsTab } from '@/src/components/AnalyticsTab';
import { AppGuideModal } from '@/src/components/AppGuideModal';
import { AppLockOverlay } from '@/src/components/AppLockOverlay';
import { AuthForm } from '@/src/components/AuthForm';
import { BrandLogo } from '@/src/components/BrandLogo';
import { CallDetailModal } from '@/src/components/CallDetailModal';
import { CallsTab } from '@/src/components/CallsTab';
import { ContactDetailModal } from '@/src/components/ContactDetailModal';
import { DarkModeToggle } from '@/src/components/DarkModeToggle';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { EthiopianCalendarView } from '@/src/components/EthiopianCalendarView';
import { OfflineIndicator, PWAInstallButton } from '@/src/components/PWAInstallButton';
import { RemindersModal } from '@/src/components/RemindersModal';
import { SettingsTab } from '@/src/components/SettingsTab';
import { UsageTab } from '@/src/components/UsageTab';
import { GUIDE_SEEN_KEY } from '@/src/lib/appInfo';
import { getUpcomingContactEvents } from '@/src/lib/contacts';
import {
  formatEthiopianShort,
  getHolidaysInGregorianYearOrUpcoming,
} from '@/src/lib/ethiopianCalendar';
import { firstGraphemes } from '@/src/lib/format';
import { triggerHaptic } from '@/src/lib/haptics';
import { quietContacts, unreturnedMissedCalls } from '@/src/lib/reminders';
import { maskPhoneNumber } from '@/src/lib/security';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { CallsProvider, useCalls } from '@/src/store/CallsContext';
import type { CallRecord, TabKey } from '@/src/types/call';

const TABS: Array<{ key: TabKey; label: string; icon: typeof Phone }> = [
  { key: 'calls', label: 'Calls', icon: Phone },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'usage', label: 'Usage', icon: Smartphone },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function AppShell() {
  const {
    calls,
    contacts,
    scheduledCalls,
    favorites,
    dismissedMissedIds,
    calendarPrefs,
    reminderPrefs,
    theme,
    themePreference,
    toggleTheme,
    privacyMode,
    togglePrivacyMode,
    pinEnabled,
    isLocked,
    unlockWithPin,
    clearAppPin,
    lockApp,
    authUser,
    authLoading,
    isGuest,
    needsEmailVerification,
    authPromptMode,
    authPromptReason,
    openAuthPrompt,
    closeAuthPrompt,
    exitGuestMode,
    resendVerificationEmail,
    checkEmailVerification,
    signOutAccount,
    isAdmin,
    toggleFavorite,
    patchCall,
    removeCall,
    notice,
    showNotice,
  } = useCalls();

  const isDark = theme === 'dark' || theme === 'dark-gray';
  const prefersReducedMotion = useReducedMotion();
  useLockBodyScroll(authPromptMode !== 'closed');

  const [activeTab, setActiveTab] = useState<TabKey>('calls');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedContactNumber, setSelectedContactNumber] = useState<string | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [checkingVerify, setCheckingVerify] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);

  const visibleTabs = useMemo(
    () =>
      isAdmin
        ? [...TABS, { key: 'admin' as TabKey, label: 'Admin', icon: ShieldCheck }]
        : TABS,
    [isAdmin],
  );

  const authUid = authUser?.uid ?? null;
  useEffect(() => {
    setDetailId(null);
    setSelectedContactNumber(null);
    setRemindersOpen(false);
    setActiveTab('calls');
  }, [authUid, isGuest]);

  const handleCloseGuide = useCallback(() => {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, '1');
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (authLoading || needsEmailVerification || isLocked) return;
    if (!authUser && !isGuest) return;
    try {
      if (localStorage.getItem(GUIDE_SEEN_KEY) !== '1') {
        setGuideOpen(true);
        localStorage.setItem(GUIDE_SEEN_KEY, '1');
      }
    } catch {
      // ignore storage errors
    }
  }, [authLoading, needsEmailVerification, isLocked, authUser, isGuest]);

  useEffect(() => {
    if (authPromptMode === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAuthPrompt();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authPromptMode, closeAuthPrompt]);

  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('calls');
    }
  }, [activeTab, isAdmin]);

  const handleSwitchTab = useCallback((nextTab: TabKey) => {
    triggerHaptic('tap');
    setActiveTab(nextTab);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const handleSelectCall = useCallback((call: CallRecord) => {
    triggerHaptic('tap');
    setDetailId(call.id);
  }, []);

  const handleSelectContact = useCallback((number: string) => {
    triggerHaptic('tap');
    setSelectedContactNumber(number);
  }, []);

  const handleOpenReminders = useCallback(() => {
    triggerHaptic('tap');
    setRemindersOpen(true);
  }, []);

  const handleOpenAnalytics = useCallback(() => {
    handleSwitchTab('analytics');
  }, [handleSwitchTab]);

  const handleOpenGuide = useCallback(() => {
    triggerHaptic('tap');
    setGuideOpen(true);
  }, []);

  const pendingFollowUps = useMemo(() => {
    const missedCount = unreturnedMissedCalls(calls, dismissedMissedIds).length;
    const scheduledCount = scheduledCalls.filter((s) => s.status === 'pending').length;
    const quietCount = quietContacts(calls, new Date(), reminderPrefs.quietContactDays).length;
    const eventsCount = getUpcomingContactEvents(
      contacts,
      calls,
      reminderPrefs.eventLeadDays,
    ).length;
    const holidaysCount = getHolidaysInGregorianYearOrUpcoming(
      new Date(),
      reminderPrefs.eventLeadDays,
      calendarPrefs.defaultLang,
    ).length;
    return missedCount + scheduledCount + quietCount + eventsCount + holidaysCount;
  }, [
    calls,
    contacts,
    scheduledCalls,
    dismissedMissedIds,
    reminderPrefs.quietContactDays,
    reminderPrefs.eventLeadDays,
    calendarPrefs.defaultLang,
  ]);

  const detailCall = useMemo<CallRecord | null>(
    () => (detailId ? (calls.find((c) => c.id === detailId) ?? null) : null),
    [calls, detailId],
  );

  const handleCallBack = useCallback(
    (number: string) => {
      triggerHaptic('tap');
      window.location.href = `tel:${number}`;
      showNotice(`Dialing ${maskPhoneNumber(number, privacyMode)}...`, false);
    },
    [privacyMode, showNotice],
  );

  const headerDateText = useMemo(() => {
    const now = new Date();
    const ec = `${formatEthiopianShort(now, calendarPrefs.defaultLang)} EC`;
    if (calendarPrefs.dateDisplay === 'both') {
      const gc = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${ec} · ${gc}`;
    }
    return ec;
  }, [calendarPrefs.defaultLang, calendarPrefs.dateDisplay]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-white flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo size={46} />
          <p className="text-sm font-semibold text-[#08246B] dark:text-white">
            Call Analyzer - ETH
          </p>
          <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            Verifying your account session...
          </p>
        </div>
      </div>
    );
  }

  if (authUser && needsEmailVerification) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-white flex flex-col">
        <header className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={34} />
            <span className="text-base font-bold tracking-tight text-[#08246B] dark:text-white truncate">
              Call Analyzer - ETH
            </span>
          </div>
          <DarkModeToggle isDark={isDark} onToggle={toggleTheme} compact />
        </header>

        <main className="flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-6 sm:p-7 space-y-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                <Mail size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-[#08246B] dark:text-white">
                  Verify your email
                </h1>
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                  {authUser.email}
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              We sent a verification link to your inbox. Confirm your email address so your private call logs and contacts stay strictly protected under your verified account.
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={checkingVerify}
                onClick={async () => {
                  setCheckingVerify(true);
                  try {
                    await checkEmailVerification();
                  } finally {
                    setCheckingVerify(false);
                  }
                }}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={16} className={checkingVerify ? 'animate-spin' : ''} />
                {checkingVerify ? 'Checking status...' : "I've verified — Continue"}
              </button>

              <button
                type="button"
                disabled={resendingVerify}
                onClick={async () => {
                  setResendingVerify(true);
                  try {
                    await resendVerificationEmail();
                  } finally {
                    setResendingVerify(false);
                  }
                }}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-50 text-xs font-semibold text-[#08246B] dark:text-white transition-colors"
              >
                {resendingVerify ? 'Sending...' : 'Resend verification email'}
              </button>

              <button
                type="button"
                onClick={() => void signOutAccount()}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut size={14} />
                Use another login option
              </button>
            </div>
          </div>
        </main>

        <OfflineIndicator />

        <AnimatePresence>
          {notice && (
            <motion.div
              role="alert"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[calc(100vw-2rem)]"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-white/95 dark:bg-[var(--dark-elevated)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-1.5 text-xs font-medium text-[#08246B] dark:text-white shadow-md backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shrink-0" />
                <span className="truncate">{notice}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (!authUser && !isGuest) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-white flex flex-col">
        <header className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={34} />
            <span className="text-base font-bold tracking-tight text-[#08246B] dark:text-white truncate">
              Call Analyzer - ETH
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              aria-label="Open app guide"
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap"
            >
              <HelpCircle size={15} className="text-[#FF6A00]" />
              Guide
            </button>
            <DarkModeToggle isDark={isDark} onToggle={toggleTheme} compact />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 pb-10">
          <AuthForm allowGuest onOpenGuide={() => setGuideOpen(true)} />
        </main>

        <AppGuideModal open={guideOpen} onClose={handleCloseGuide} />

        <OfflineIndicator />

        <AnimatePresence>
          {notice && (
            <motion.div
              role="alert"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[calc(100vw-2rem)]"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-white/95 dark:bg-[var(--dark-elevated)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-1.5 text-xs font-medium text-[#08246B] dark:text-white shadow-md backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shrink-0" />
                <span className="truncate">{notice}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (isLocked) {
    return (
      <AppLockOverlay
        onVerifyPin={unlockWithPin}
        onResetPin={clearAppPin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-white flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] p-4 justify-between">
        <div className="space-y-6">
          <div className="px-1 pt-1 space-y-1">
            <div className="flex items-center gap-2.5">
              <BrandLogo size={34} />
              <span className="text-base font-bold tracking-tight text-[#08246B] dark:text-white whitespace-nowrap truncate">
                Call Analyzer - ETH
              </span>
            </div>
            <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] pl-[44px]">
              {headerDateText}
            </p>
          </div>

          <nav className="space-y-1" aria-label="Primary navigation">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleSwitchTab(tab.key)}
                  className={`relative w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'text-[#FF6A00]'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="desktop-nav-active-pill"
                      transition={
                        prefersReducedMotion
                          ? { duration: 0.08 }
                          : { type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }
                      }
                      aria-hidden="true"
                      className="absolute inset-0 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 z-0"
                    />
                  )}
                  <Icon size={18} className="relative z-10" />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2">
          <PWAInstallButton variant="button" />
          <DarkModeToggle
            isDark={isDark}
            onToggle={toggleTheme}
            label={
              themePreference === 'system'
                ? `Auto · ${theme === 'dark' ? 'Navy' : theme === 'dark-gray' ? 'Gray' : 'Bright'}`
                : theme === 'dark'
                  ? 'Dark Navy'
                  : theme === 'dark-gray'
                    ? 'Dark Gray'
                    : 'Bright Mode'
            }
          />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePrivacyMode}
              title={privacyMode ? 'Show private notes' : 'Hide private notes'}
              className={`flex-1 min-h-[40px] px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                privacyMode
                  ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                  : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]'
              }`}
            >
              {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
              {privacyMode ? 'Notes hidden' : 'Privacy'}
            </button>
            {pinEnabled && (
              <button
                type="button"
                onClick={lockApp}
                aria-label="Lock app"
                title="Lock app with PIN"
                className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center transition-colors"
              >
                <Lock size={14} className="text-[#FF6A00]" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setRemindersOpen(true)}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-between gap-2 whitespace-nowrap transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Bell size={16} className="text-[#FF6A00]" />
              Wishes & Alerts
            </span>
            {pendingFollowUps > 0 && (
              <span className="font-mono text-xs tabular-nums text-[#FF6A00]">
                {pendingFollowUps}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-2.5 whitespace-nowrap transition-colors"
          >
            <HelpCircle size={15} className="text-[#FF6A00]" />
            App Guide &amp; About
          </button>

          {authUser ? (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center gap-2.5 text-left hover:border-[#FF6A00] transition-colors"
            >
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={authUser.displayName || 'Account'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-[#FF6A00] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {firstGraphemes(authUser.displayName || authUser.email || 'U', 1).toLocaleUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                  {authUser.displayName || authUser.email?.split('@')[0] || 'Account'}
                </p>
                <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                  {authUser.email}
                </p>
              </div>
            </button>
          ) : (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => openAuthPrompt('signin')}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
              >
                <LogIn size={15} />
                Login / Create Account
              </button>
              <button
                type="button"
                onClick={exitGuestMode}
                className="w-full min-h-[36px] px-3 py-1 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white transition-colors"
              >
                Exit Guest Preview
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-30 h-13 px-4 flex items-center justify-between gap-2 bg-white/95 dark:bg-[var(--dark-surface-95)] backdrop-blur-md border-b border-[#DDE4EA] dark:border-[var(--dark-border)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandLogo size={30} />
          <div className="min-w-0">
            <span className="block text-sm font-bold tracking-tight text-[#08246B] dark:text-white whitespace-nowrap truncate leading-tight">
              Call Analyzer - ETH
            </span>
            <span className="block text-[10px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] leading-tight">
              {headerDateText}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <PWAInstallButton variant="compact" />
          <DarkModeToggle isDark={isDark} onToggle={toggleTheme} compact />
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            aria-label="Open interactive app guide"
            className="min-h-[44px] min-w-[36px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
          >
            <HelpCircle size={17} />
          </button>
          {pinEnabled && (
            <button
              type="button"
              onClick={lockApp}
              aria-label="Lock app"
              className="min-h-[44px] min-w-[38px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
            >
              <Lock size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            aria-label={authUser ? 'Account settings' : 'Sign in or open settings'}
            className="min-h-[44px] min-w-[38px] flex items-center justify-center rounded-xl text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
          >
            {authUser?.photoURL ? (
              <img
                src={authUser.photoURL}
                alt={authUser.displayName || 'Account'}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-full object-cover border border-[#DDE4EA] dark:border-[var(--dark-border)]"
              />
            ) : (
              <LogIn size={17} className={authUser ? 'text-[#10B981]' : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setRemindersOpen(true)}
            aria-label="Notifications, wishes, and follow-ups"
            className="min-h-[44px] px-2 flex items-center justify-center gap-1 rounded-xl text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 shrink-0"
          >
            <Bell size={18} />
            {pendingFollowUps > 0 && (
              <span className="text-xs font-mono font-bold tabular-nums">
                {pendingFollowUps}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
          {isGuest && (
            <div className="mb-4 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/12 border border-[#FF6A00]/35 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                  Guest Preview · Viewing sample data
                </p>
                <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Sign in or create an account to import call logs, sync contacts, and save your own data.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openAuthPrompt('signin')}
                  className="min-h-[36px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <LogIn size={13} />
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => openAuthPrompt('signup')}
                  className="min-h-[36px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <UserPlus size={13} />
                  Create account
                </button>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.994 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.996 }}
              transition={{
                duration: prefersReducedMotion ? 0.1 : 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {activeTab === 'calls' && (
                <CallsTab
                  onSelectCall={handleSelectCall}
                  onSelectContact={handleSelectContact}
                  onCallBack={handleCallBack}
                  onOpenReminders={handleOpenReminders}
                  onOpenAnalytics={handleOpenAnalytics}
                />
              )}
              {activeTab === 'analytics' && (
                <AnalyticsTab
                  onSelectCall={handleSelectCall}
                  onSelectContact={handleSelectContact}
                />
              )}
              {activeTab === 'usage' && (
                <UsageTab
                  onSelectCall={handleSelectCall}
                  onSelectContact={handleSelectContact}
                />
              )}
              {activeTab === 'calendar' && (
                <EthiopianCalendarView
                  onSelectCall={handleSelectCall}
                  onSelectContact={handleSelectContact}
                  onOpenWishes={handleOpenReminders}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsTab
                  onOpenReminders={handleOpenReminders}
                  onOpenGuide={handleOpenGuide}
                />
              )}
              {activeTab === 'admin' && isAdmin && <AdminTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-[var(--dark-surface-95)] backdrop-blur-md border-t border-[#DDE4EA] dark:border-[var(--dark-border)] grid items-center px-1 ${
          visibleTabs.length === 6 ? 'grid-cols-6' : 'grid-cols-5'
        }`}
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleSwitchTab(tab.key)}
              className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                active ? 'text-[#FF6A00]' : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-top-bar"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0.08 }
                      : { type: 'spring', stiffness: 440, damping: 34, mass: 0.75 }
                  }
                  aria-hidden="true"
                  className="absolute top-0 left-3 right-3 h-0.5 rounded-full bg-[#FF6A00]"
                />
              )}
              <Icon size={19} />
              <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <CallDetailModal
        call={detailCall}
        isFavorite={detailCall ? favorites.has(detailCall.number) : false}
        onToggleFavorite={() => detailCall && toggleFavorite(detailCall.number)}
        onClose={() => setDetailId(null)}
        onSave={(patch) => {
          if (!detailCall) return;
          patchCall(detailCall.id, patch);
          showNotice('Saved.');
        }}
        onDelete={() => {
          if (!detailCall) return;
          removeCall(detailCall.id);
          setDetailId(null);
          showNotice('Call deleted.');
        }}
        onCallBack={() => detailCall && handleCallBack(detailCall.number)}
        onOpenContact={handleSelectContact}
      />

      <ContactDetailModal
        contactNumber={selectedContactNumber}
        onClose={() => setSelectedContactNumber(null)}
        onSelectCall={(call) => {
          setSelectedContactNumber(null);
          handleSelectCall(call);
        }}
        onCallBack={handleCallBack}
      />

      <RemindersModal
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        onCallBack={(number) => {
          setRemindersOpen(false);
          handleCallBack(number);
        }}
        onSelectContact={handleSelectContact}
      />

      <AppGuideModal open={guideOpen} onClose={handleCloseGuide} />

      <AnimatePresence>
        {authPromptMode !== 'closed' && (
          <motion.div
            key="auth-prompt-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
            onClick={closeAuthPrompt}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md my-auto"
            >
              <AuthForm
                allowGuest={false}
                initialMode={authPromptMode === 'signup' ? 'signup' : 'signin'}
                reason={authPromptReason}
                onClose={closeAuthPrompt}
                onOpenGuide={() => {
                  closeAuthPrompt();
                  setGuideOpen(true);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <OfflineIndicator />

      <AnimatePresence>
        {notice && (
          <motion.div
            role="alert"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[calc(100vw-2rem)]"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-white/95 dark:bg-[var(--dark-elevated)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-1.5 text-xs font-medium text-[#08246B] dark:text-white shadow-md backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shrink-0" />
              <span className="truncate">{notice}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CallsProvider>
        <AppShell />
      </CallsProvider>
    </ErrorBoundary>
  );
}
