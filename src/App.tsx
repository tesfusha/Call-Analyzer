import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AndroidPermissionsModal } from '@/src/components/AndroidPermissionsModal';
import { AppGuideModal } from '@/src/components/AppGuideModal';
import { AppLockOverlay } from '@/src/components/AppLockOverlay';
import { AuthForm } from '@/src/components/AuthForm';
import { BrandLogo } from '@/src/components/BrandLogo';
import { CallDetailModal } from '@/src/components/CallDetailModal';
import { CallsTab } from '@/src/components/CallsTab';
import { ContactDetailModal } from '@/src/components/ContactDetailModal';
import { ContactMilestoneModal } from '@/src/components/ContactMilestoneModal';
import { DarkModeToggle } from '@/src/components/DarkModeToggle';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { EthiopianCalendarView } from '@/src/components/EthiopianCalendarView';
import { RemindersModal } from '@/src/components/RemindersModal';
import { SettingsTab } from '@/src/components/SettingsTab';
import { UpdateNoticeModal } from '@/src/components/UpdateNoticeModal';
import { UsageTab } from '@/src/components/UsageTab';
import { WhatsNewModal } from '@/src/components/WhatsNewModal';
import {
  APP_VERSION,
  GUIDE_SEEN_KEY,
  UPDATE_CHECK_INTERVAL_MS,
  WHATS_NEW_SEEN_KEY,
} from '@/src/lib/appInfo';
import {
  checkForAppUpdate,
  dismissUpdateVersionCode,
  isUpdateCheckDue,
} from '@/src/lib/updateChecker';
import {
  getCallLogSyncPermissionStatus,
  hasNativeCallLogSyncPlugin,
  isNativeCapacitor,
  markNativeMissedCallReturned,
} from '@/src/lib/capacitor';
import { getContactKey, getUpcomingContactEvents } from '@/src/lib/contacts';
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
import type { AppUpdateNotice, CallRecord, ContactMilestoneRecord, TabKey } from '@/src/types/call';

const ANDROID_SETUP_SEEN_KEY = 'callanalyzer.androidSetupSeen.v1';

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
    mutedAlertSet,
    calendarPrefs,
    reminderPrefs,
    theme,
    themePreference,
    toggleTheme,
    privacyMode,
    togglePrivacyMode,
    pinEnabled,
    isLocked,
    pinLockoutUntil,
    unlockWithPin,
    clearAppPin,
    lockApp,
    authUser,
    authLoading,
    isGuest,
    profileName,
    userPhotoUrl,
    needsEmailVerification,
    notificationActionTarget,
    clearNotificationActionTarget,
    authPromptMode,
    authPromptReason,
    openAuthPrompt,
    closeAuthPrompt,
    exitGuestMode,
    resendVerificationEmail,
    checkEmailVerification,
    signOutAccount,
    isAdmin,
    syncPhoneCalls,
    toggleFavorite,
    patchCall,
    removeCall,
    unseenNewCallIds,
    markCallsTabOpened,
    clearSessionNewCalls,
    pendingMilestoneCelebration,
    markContactMilestoneCelebrated,
    notice,
    showNotice,
  } = useCalls();

  const isDark = theme === 'dark-gray';
  const prefersReducedMotion = useReducedMotion();
  useLockBodyScroll(authPromptMode !== 'closed');

  const [activeTab, setActiveTab] = useState<TabKey>('calls');
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => new Set(['calls']));
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedContactNumber, setSelectedContactNumber] = useState<string | null>(null);
  const [manualMilestone, setManualMilestone] = useState<ContactMilestoneRecord | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [remindersInitialCategory, setRemindersInitialCategory] = useState<
    'action' | 'wishes' | 'quiet' | 'reports'
  >('action');
  const [guideOpen, setGuideOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [androidSetupOpen, setAndroidSetupOpen] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<AppUpdateNotice | null>(null);
  const [checkingVerify, setCheckingVerify] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Check remote version.json on app start and once every 24 hours (fails silently offline)
  useEffect(() => {
    let cancelled = false;
    const runCheck = async () => {
      const result = await checkForAppUpdate();
      if (!cancelled && result) {
        setUpdateNotice(result);
      }
    };
    void runCheck();

    const intervalId = window.setInterval(() => {
      if (isUpdateCheckDue()) {
        void runCheck();
      }
    }, UPDATE_CHECK_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible' && isUpdateCheckDue()) {
        void runCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const handleDismissUpdate = useCallback(() => {
    setUpdateNotice((prev) => {
      if (!prev || prev.mandatory) return prev;
      dismissUpdateVersionCode(prev.versionCode);
      return null;
    });
  }, []);

  const handleManualUpdateCheck = useCallback(async () => {
    const result = await checkForAppUpdate({ force: true, ignoreDismissed: true });
    if (result) {
      setUpdateNotice(result);
    } else {
      showNotice(`You are on the latest version (v${APP_VERSION}).`, 'tap');
    }
  }, [showNotice]);

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
    setManualMilestone(null);
    setRemindersOpen(false);
    setActiveTab('calls');
    setVisitedTabs(new Set(['calls']));
  }, [authUid, isGuest]);

  const handleCloseGuide = useCallback(() => {
    setGuideOpen(false);
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, '1');
      localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleCloseWhatsNew = useCallback(() => {
    setWhatsNewOpen(false);
    try {
      localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);
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
        localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);
      } else if (localStorage.getItem(WHATS_NEW_SEEN_KEY) !== APP_VERSION) {
        setWhatsNewOpen(true);
        localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);
      }
    } catch {
      // ignore storage errors
    }
  }, [authLoading, needsEmailVerification, isLocked, authUser, isGuest]);

  useEffect(() => {
    if (authLoading || needsEmailVerification || isLocked || !authUser) return;
    if (!isNativeCapacitor() || !hasNativeCallLogSyncPlugin()) return;
    let cancelled = false;
    const checkAndroidSetup = async () => {
      try {
        const seen = localStorage.getItem(ANDROID_SETUP_SEEN_KEY) === '1';
        const status = await getCallLogSyncPermissionStatus();
        if (cancelled) return;
        if (!seen || (status && !status.allCoreGranted)) {
          setAndroidSetupOpen(true);
        }
      } catch {
        // ignore setup check error
      }
    };
    void checkAndroidSetup();
    return () => {
      cancelled = true;
    };
  }, [authLoading, needsEmailVerification, isLocked, authUser]);

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
    setVisitedTabs((prev) => {
      if (prev.has(nextTab)) return prev;
      const next = new Set(prev);
      next.add(nextTab);
      return next;
    });
    setActiveTab(nextTab);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const prevActiveTabRef = useRef<TabKey>(activeTab);
  useEffect(() => {
    const prev = prevActiveTabRef.current;
    prevActiveTabRef.current = activeTab;
    if (activeTab === 'calls') {
      markCallsTabOpened();
    } else if (prev === 'calls') {
      clearSessionNewCalls();
    }
  }, [activeTab, markCallsTabOpened, clearSessionNewCalls]);

  useEffect(() => {
    if (!notificationActionTarget) return;
    if (notificationActionTarget.contactNumber) {
      setSelectedContactNumber(notificationActionTarget.contactNumber);
    } else if (notificationActionTarget.openReminders) {
      setRemindersInitialCategory(notificationActionTarget.openReminders);
      setRemindersOpen(true);
    } else if (notificationActionTarget.tab) {
      handleSwitchTab(notificationActionTarget.tab);
    }
    clearNotificationActionTarget();
  }, [notificationActionTarget, clearNotificationActionTarget, handleSwitchTab]);

  useEffect(() => {
    if (prefersReducedMotion || authLoading || needsEmailVerification || isLocked) return;
    if (!authUser && !isGuest) return;

    const modalOpen =
      Boolean(detailId) ||
      Boolean(selectedContactNumber) ||
      remindersOpen ||
      guideOpen ||
      whatsNewOpen ||
      authPromptMode !== 'closed';
    if (modalOpen) return;

    let lastY = 0;
    let pullAnchorY: number | null = null;
    let currentOffset = 0;
    let wasAtBottom = false;
    let clearTransformTimer: number | null = null;

    const clearInlineTransform = () => {
      if (clearTransformTimer !== null) {
        window.clearTimeout(clearTransformTimer);
        clearTransformTimer = null;
      }
      const el = mainContentRef.current;
      if (el) {
        el.style.transform = '';
        el.style.transition = '';
      }
    };

    const resetTransform = () => {
      const el = mainContentRef.current;
      if (!el || currentOffset === 0) {
        pullAnchorY = null;
        return;
      }
      if (clearTransformTimer !== null) {
        window.clearTimeout(clearTransformTimer);
      }
      el.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
      currentOffset = 0;
      pullAnchorY = null;
      clearTransformTimer = window.setTimeout(() => {
        clearTransformTimer = null;
        const target = mainContentRef.current;
        if (target && currentOffset === 0) {
          target.style.transform = '';
          target.style.transition = '';
        }
      }, 280);
    };

    const isOverlayActive = (target?: EventTarget | null) => {
      if (document.body.style.position === 'fixed') return true;
      if (target instanceof Element && target.closest('[role="dialog"], [aria-modal="true"]')) {
        return true;
      }
      return false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isOverlayActive(e.target)) return;
      lastY = e.touches[0].clientY;
      pullAnchorY = null;
      if (clearTransformTimer !== null) {
        window.clearTimeout(clearTransformTimer);
        clearTransformTimer = null;
      }
      const el = mainContentRef.current;
      if (el) el.style.transition = 'none';
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (isOverlayActive(e.target)) {
        if (currentOffset !== 0) resetTransform();
        return;
      }
      const el = mainContentRef.current;
      if (!el) return;

      const y = e.touches[0].clientY;
      const stepY = y - lastY;
      lastY = y;

      const docEl = document.documentElement;
      const scrollY = window.scrollY;
      const maxScroll = Math.max(0, docEl.scrollHeight - window.innerHeight);
      const atTop = scrollY <= 1;
      const atBottom = maxScroll > 0 && scrollY >= maxScroll - 2;

      if (pullAnchorY === null) {
        if ((atTop && stepY > 0) || (atBottom && stepY < 0)) {
          pullAnchorY = y;
        } else {
          return;
        }
      }

      const rawPull = y - pullAnchorY;
      if ((atTop && rawPull > 0) || (atBottom && rawPull < 0)) {
        const damped = Math.sign(rawPull) * Math.min(28, Math.pow(Math.abs(rawPull), 0.72) * 1.25);
        currentOffset = damped;
        el.style.transition = 'none';
        el.style.transform = `translate3d(0, ${damped.toFixed(1)}px, 0)`;
      } else if (currentOffset !== 0) {
        resetTransform();
      }
    };

    const onScroll = () => {
      if (isOverlayActive()) return;
      const docEl = document.documentElement;
      const maxScroll = Math.max(0, docEl.scrollHeight - window.innerHeight);
      const atBottomNow = maxScroll > 120 && window.scrollY >= maxScroll - 2;

      if (atBottomNow && !wasAtBottom && currentOffset === 0) {
        const el = mainContentRef.current;
        if (el && typeof el.animate === 'function') {
          el.animate(
            [
              { transform: 'translate3d(0, 0, 0)' },
              { transform: 'translate3d(0, -7px, 0)' },
              { transform: 'translate3d(0, 0, 0)' },
            ],
            { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          );
        }
      }
      wasAtBottom = maxScroll > 120 && window.scrollY >= maxScroll - 24;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', resetTransform, { passive: true });
    window.addEventListener('touchcancel', resetTransform, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', resetTransform);
      window.removeEventListener('touchcancel', resetTransform);
      window.removeEventListener('scroll', onScroll);
      clearInlineTransform();
    };
  }, [
    prefersReducedMotion,
    authLoading,
    needsEmailVerification,
    isLocked,
    authUser,
    isGuest,
    detailId,
    selectedContactNumber,
    remindersOpen,
    guideOpen,
    whatsNewOpen,
    authPromptMode,
  ]);

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
    setRemindersInitialCategory('action');
    setRemindersOpen(true);
  }, []);

  const handleOpenWishes = useCallback(() => {
    triggerHaptic('tap');
    setRemindersInitialCategory('wishes');
    setRemindersOpen(true);
  }, []);

  const handleOpenAnalytics = useCallback(() => {
    handleSwitchTab('analytics');
  }, [handleSwitchTab]);

  const handleOpenGuide = useCallback(() => {
    triggerHaptic('tap');
    setGuideOpen(true);
  }, []);

  const handleOpenWhatsNew = useCallback(() => {
    triggerHaptic('tap');
    setWhatsNewOpen(true);
  }, []);

  const pendingFollowUps = useMemo(() => {
    const missedCount = unreturnedMissedCalls(calls, dismissedMissedIds).filter(
      (m) => !mutedAlertSet.has(`missed:${getContactKey(m.number)}`),
    ).length;
    const scheduledCount = scheduledCalls.filter(
      (s) => s.status === 'pending' && !mutedAlertSet.has(`sched:${s.id}`),
    ).length;
    const quietCount = quietContacts(calls, new Date(), reminderPrefs.quietContactDays).filter(
      (q) => !mutedAlertSet.has(`quiet:${getContactKey(q.number)}`),
    ).length;
    const eventsCount = getUpcomingContactEvents(
      contacts,
      calls,
      reminderPrefs.eventLeadDays,
    ).filter((evt) => !mutedAlertSet.has(`bday:${evt.contactKey}`)).length;
    const holidaysCount = getHolidaysInGregorianYearOrUpcoming(
      new Date(),
      reminderPrefs.eventLeadDays,
      calendarPrefs.defaultLang,
    ).filter((h) => !mutedAlertSet.has(`holiday:${h.key}`)).length;
    return missedCount + scheduledCount + quietCount + eventsCount + holidaysCount;
  }, [
    calls,
    contacts,
    scheduledCalls,
    dismissedMissedIds,
    mutedAlertSet,
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
      void markNativeMissedCallReturned(number);
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
      <div className="min-h-screen bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-white flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
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
              <div className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-[var(--dark-elevated)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-1.5 text-xs font-medium text-[#08246B] dark:text-white shadow-md">
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
      <div className="min-h-screen bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-white flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
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
        <UpdateNoticeModal update={updateNotice} onDismiss={handleDismissUpdate} />

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
              <div className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-[var(--dark-elevated)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-1.5 text-xs font-medium text-[#08246B] dark:text-white shadow-md">
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
        lockUntil={pinLockoutUntil}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-white flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 lg:w-64 md:shrink-0 md:flex-col md:overflow-y-auto border-r border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] p-4 justify-between gap-4">
        <div className="space-y-5">
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
              const showNewBadge =
                tab.key === 'calls' && unseenNewCallIds.length > 0 && activeTab !== 'calls';
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleSwitchTab(tab.key)}
                  className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00]'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span>{tab.label}</span>
                  {showNewBadge && (
                    <span className="ml-auto px-1.5 py-0.5 rounded bg-[#FF6A00] text-white text-[9px] font-bold uppercase tracking-wider leading-none shrink-0">
                      NEW
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2">
          <DarkModeToggle
            isDark={isDark}
            onToggle={toggleTheme}
            label={
              themePreference === 'system'
                ? isDark
                  ? 'Auto · Dark'
                  : 'Auto · Bright'
                : isDark
                  ? 'Dark'
                  : 'Bright'
            }
          />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePrivacyMode}
              title={privacyMode ? 'Show phone numbers and notes' : 'Mask phone numbers and private notes'}
              className={`flex-1 min-h-[40px] px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                privacyMode
                  ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                  : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]'
              }`}
            >
              {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
              {privacyMode ? 'Privacy on' : 'Privacy'}
            </button>
            {pinEnabled && (
              <button
                type="button"
                onClick={lockApp}
                aria-label="Lock screen"
                title="Lock screen with PIN"
                className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center transition-colors"
              >
                <Lock size={14} className="text-[#FF6A00]" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenReminders}
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
              onClick={() => handleSwitchTab('settings')}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center gap-2.5 text-left hover:border-[#FF6A00] transition-colors"
            >
              {(userPhotoUrl || authUser.photoURL) ? (
                <img
                  src={userPhotoUrl || authUser.photoURL || ''}
                  alt={profileName || authUser.displayName || 'Account'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-[#FF6A00] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {firstGraphemes(profileName || authUser.displayName || authUser.email || 'U', 1).toLocaleUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                  {profileName || authUser.displayName || authUser.email?.split('@')[0] || 'Account'}
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
      <header
        className={`md:hidden sticky top-0 z-30 pt-[env(safe-area-inset-top)] border-b border-[#DDE4EA] dark:border-[var(--dark-border)] ${
          isDark ? 'bg-[#111214]' : 'bg-white dark:bg-[var(--dark-surface)]'
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between gap-2">
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
              aria-label="Lock screen"
              className="min-h-[44px] min-w-[38px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
            >
              <Lock size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSwitchTab('settings')}
            aria-label={authUser ? 'Account settings' : 'Sign in or open settings'}
            className="min-h-[44px] min-w-[38px] flex items-center justify-center rounded-xl text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
          >
            {(userPhotoUrl || authUser?.photoURL) ? (
              <img
                src={userPhotoUrl || authUser?.photoURL || ''}
                alt={profileName || authUser?.displayName || 'Account'}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-full object-cover border border-[#DDE4EA] dark:border-[var(--dark-border)]"
              />
            ) : (
              <LogIn size={17} className={authUser ? 'text-[#10B981]' : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'} />
            )}
          </button>
          <button
            type="button"
            onClick={handleOpenReminders}
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-8 overflow-x-clip">
        <div
          ref={mainContentRef}
          className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-7"
        >
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

          {privacyMode && (
            <div className="mb-4 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/12 border border-[#FF6A00]/35 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <EyeOff size={15} className="text-[#FF6A00] shrink-0" />
                <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                  Privacy Mode is on · Phone numbers are masked
                </p>
              </div>
              <button
                type="button"
                onClick={togglePrivacyMode}
                className="min-h-[34px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Eye size={13} />
                Show full numbers
              </button>
            </div>
          )}

          {visitedTabs.has('calls') && (
            <div className={activeTab === 'calls' ? 'block' : 'hidden'}>
              <CallsTab
                onSelectCall={handleSelectCall}
                onSelectContact={handleSelectContact}
                onCallBack={handleCallBack}
                onOpenReminders={handleOpenReminders}
                onOpenAnalytics={handleOpenAnalytics}
              />
            </div>
          )}
          {visitedTabs.has('analytics') && (
            <div className={activeTab === 'analytics' ? 'block' : 'hidden'}>
              <AnalyticsTab onSelectContact={handleSelectContact} />
            </div>
          )}
          {visitedTabs.has('usage') && (
            <div className={activeTab === 'usage' ? 'block' : 'hidden'}>
              <UsageTab
                onSelectCall={handleSelectCall}
                onSelectContact={handleSelectContact}
              />
            </div>
          )}
          {visitedTabs.has('calendar') && (
            <div className={activeTab === 'calendar' ? 'block' : 'hidden'}>
              <EthiopianCalendarView
                onSelectCall={handleSelectCall}
                onSelectContact={handleSelectContact}
                onOpenWishes={handleOpenWishes}
              />
            </div>
          )}
          {visitedTabs.has('settings') && (
            <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
              <SettingsTab
                onOpenReminders={handleOpenReminders}
                onOpenGuide={handleOpenGuide}
                onOpenWhatsNew={handleOpenWhatsNew}
                onOpenAndroidSetup={() => setAndroidSetupOpen(true)}
                onSelectContact={handleSelectContact}
                onCheckForUpdates={handleManualUpdateCheck}
              />
            </div>
          )}
          {isAdmin && visitedTabs.has('admin') && (
            <div className={activeTab === 'admin' ? 'block' : 'hidden'}>
              <AdminTab />
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] pb-[env(safe-area-inset-bottom)] ${
          isDark ? 'bg-[#111214]' : 'bg-white dark:bg-[var(--dark-surface)]'
        }`}
      >
        <div
          className={`h-16 grid items-center px-1 ${
            visibleTabs.length === 6 ? 'grid-cols-6' : 'grid-cols-5'
          }`}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            const showNewBadge =
              tab.key === 'calls' && unseenNewCallIds.length > 0 && activeTab !== 'calls';
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleSwitchTab(tab.key)}
                className={`relative h-14 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                  active ? 'text-[#FF6A00]' : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 left-3 right-3 h-[3px] max-h-[3px] rounded-full bg-[#FF6A00]"
                  />
                )}
                {showNewBadge && (
                  <span className="pointer-events-none absolute top-1.5 right-2 px-1 py-[1px] rounded bg-[#FF6A00] text-white text-[8px] font-bold uppercase tracking-wider leading-none">
                    NEW
                  </span>
                )}
                <Icon size={19} className="shrink-0" />
                <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <CallDetailModal
        call={detailCall}
        isFavorite={detailCall ? favorites.has(detailCall.number) : false}
        onToggleFavorite={() => detailCall && toggleFavorite(detailCall.number)}
        onClose={() => setDetailId(null)}
        onSave={(patch, options) => {
          if (!detailCall) return;
          patchCall(detailCall.id, patch, options);
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
        onShareMilestone={(m) => {
          setSelectedContactNumber(null);
          setManualMilestone(m);
        }}
      />

      <ContactMilestoneModal
        milestone={manualMilestone ?? pendingMilestoneCelebration}
        onClose={() => {
          if (manualMilestone) {
            setManualMilestone(null);
          } else if (pendingMilestoneCelebration) {
            markContactMilestoneCelebrated(pendingMilestoneCelebration.id);
          }
        }}
      />

      <RemindersModal
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        onCallBack={(number) => {
          setRemindersOpen(false);
          handleCallBack(number);
        }}
        onSelectContact={handleSelectContact}
        initialCategory={remindersInitialCategory}
      />

      <AppGuideModal open={guideOpen} onClose={handleCloseGuide} />

      <WhatsNewModal
        open={whatsNewOpen}
        onClose={handleCloseWhatsNew}
        onOpenGuide={handleOpenGuide}
      />

      <AndroidPermissionsModal
        open={androidSetupOpen}
        onClose={() => setAndroidSetupOpen(false)}
        onCompleted={() => {
          try {
            localStorage.setItem(ANDROID_SETUP_SEEN_KEY, '1');
          } catch {
            // ignore storage errors
          }
          void syncPhoneCalls({ fullResync: false });
        }}
      />

      <UpdateNoticeModal update={updateNotice} onDismiss={handleDismissUpdate} />

      <AnimatePresence>
        {authPromptMode !== 'closed' && (
          <motion.div
            key="auth-prompt-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
            onClick={closeAuthPrompt}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
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

      <AnimatePresence>
        {notice && (
          <motion.div
            role="alert"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[calc(100vw-2rem)]"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-[var(--dark-elevated)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-1.5 text-xs font-medium text-[#08246B] dark:text-white shadow-md">
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
