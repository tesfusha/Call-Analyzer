import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronRight,
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
import { BroadcastBanners, BroadcastPopupModal } from '@/src/components/BroadcastOverlay';
import { CallDetailModal } from '@/src/components/CallDetailModal';
import { CallsTab } from '@/src/components/CallsTab';
import { ContactDetailModal } from '@/src/components/ContactDetailModal';
import { ContactMilestoneModal } from '@/src/components/ContactMilestoneModal';
import { DarkModeToggle } from '@/src/components/DarkModeToggle';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { EthiopianCalendarView } from '@/src/components/EthiopianCalendarView';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import {
  HelpSupportModal,
  type HelpSupportInitialTab,
} from '@/src/components/HelpSupportModal';
import { LandingHero } from '@/src/components/LandingHero';
import { NotificationPopToast } from '@/src/components/NotificationPopToast';
import { RemindersModal } from '@/src/components/RemindersModal';
import { SettingsTab } from '@/src/components/SettingsTab';
import { UpdateNoticeModal } from '@/src/components/UpdateNoticeModal';
import { UsageTab } from '@/src/components/UsageTab';
import { WhatsNewModal } from '@/src/components/WhatsNewModal';
import { WishComposerModal } from '@/src/components/WishComposerModal';
import { useDesignVersion } from '@/src/preview/designVersion';
import { LandingHeroV105 } from '@/src/preview/LandingHeroV105';
import { VersionSwitcherBar } from '@/src/preview/VersionSwitcherBar';
import { AppShellV106 } from '@/src/preview/v106/AppShellV106';
import { AppShellV107 } from '@/src/preview/v107/AppShellV107';
import { App as CapacitorApp } from '@capacitor/app';
import { DiscardChangesModal } from '@/src/components/DiscardChangesModal';
import {
  APP_VERSION,
  UPDATE_CHECK_INTERVAL_MS,
} from '@/src/lib/appInfo';
import {
  dispatchBackNavigation,
  resetExitBackTimer,
  useBackHandler,
  useDiscardPrompt,
} from '@/src/lib/backNavigation';
import {
  checkForAppUpdate,
  checkForAppUpdateDetailed,
  dismissUpdateVersionCode,
  isUpdateCheckDue,
} from '@/src/lib/updateChecker';
import {
  getCallLogSyncPermissionStatus,
  hasNativeCallLogSyncPlugin,
  isNativeCapacitor,
  markNativeMissedCallReturned,
} from '@/src/lib/capacitor';
import { getContactKey } from '@/src/lib/contacts';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { firstGraphemes } from '@/src/lib/format';
import { triggerHaptic } from '@/src/lib/haptics';
import { findLongGapReturnCalls, unreturnedMissedCalls } from '@/src/lib/reminders';
import {
  subscribeAdminSupportThreads,
  subscribeUserSupportThread,
} from '@/src/lib/supportChat';
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
    alertTypePrefs,
    isAlertsSnoozedToday,
    readAlertSet,
    calendarPrefs,
    guideSeen,
    whatsNewSeenVersion,
    seenMetaReady,
    markGuideSeen,
    markWhatsNewSeen,
    theme,
    themePreference,
    setThemeMode,
    toggleTheme,
    dateHeaderStyle,
    pinEnabled,
    isLocked,
    pinLockoutUntil,
    unlockWithPin,
    clearAppPin,
    lockApp,
    biometricUnlockEnabled,
    unlockWithBiometric,
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
    notificationsEnabled,
    deliverSystemNotification,
    popNotifications,
    pushPopNotification,
    dismissPopNotification,
    setPendingAdminChatThreadUid,
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
  const rawDesignVersion = useDesignVersion();
  const designVersion = isAdmin ? rawDesignVersion : 'v1.0.3';
  useEffect(() => {
    document.documentElement.dataset.designVersion = designVersion;
  }, [designVersion]);
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
  const [helpSupportOpen, setHelpSupportOpen] = useState(false);
  const [helpSupportTab, setHelpSupportTab] = useState<HelpSupportInitialTab>('bot');
  const [hasUnreadAdminReply, setHasUnreadAdminReply] = useState(false);
  const [unreadAdminSupportCount, setUnreadAdminSupportCount] = useState(0);
  const [androidSetupOpen, setAndroidSetupOpen] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<AppUpdateNotice | null>(null);
  const [checkingVerify, setCheckingVerify] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const discardPrompt = useDiscardPrompt();
  const tabHistoryRef = useRef<TabKey[]>(['calls']);
  const activeTabRef = useRef<TabKey>(activeTab);
  activeTabRef.current = activeTab;
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const canUseMainTabs = Boolean(
    !authLoading && !needsEmailVerification && !isLocked && (authUser || isGuest),
  );
  const canUseMainTabsRef = useRef(canUseMainTabs);
  canUseMainTabsRef.current = canUseMainTabs;
  const exitingWebRef = useRef(false);

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
    const result = await checkForAppUpdateDetailed({ force: true, ignoreDismissed: true });
    if (result.status === 'update-available') {
      setUpdateNotice(result.notice);
    } else if (result.status === 'up-to-date') {
      showNotice(`You are on the latest version (v${APP_VERSION}).`, 'tap');
    } else if (result.status === 'offline') {
      showNotice('You are offline. Connect to the internet to check for updates.', 'warning');
    } else {
      showNotice(
        'Update check unavailable — host version.json at your update URL or use Admin Broadcasts.',
        'warning',
      );
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
    tabHistoryRef.current = ['calls'];
    resetExitBackTimer();
  }, [authUid, isGuest]);

  const verifiedUserUid = authUser && authUser.emailVerified ? authUser.uid : null;
  const helpSupportOpenRef = useRef(helpSupportOpen);
  helpSupportOpenRef.current = helpSupportOpen;
  const helpSupportTabRef = useRef(helpSupportTab);
  helpSupportTabRef.current = helpSupportTab;
  const notificationsEnabledRef = useRef(notificationsEnabled);
  notificationsEnabledRef.current = notificationsEnabled;
  const prevUserReplyAtRef = useRef(0);
  const seenAdminThreadAtRef = useRef<Map<string, number>>(new Map());
  const adminThreadsSeededRef = useRef(false);

  useEffect(() => {
    prevUserReplyAtRef.current = 0;
    if (!verifiedUserUid) {
      setHasUnreadAdminReply(false);
      return;
    }
    const unsub = subscribeUserSupportThread(verifiedUserUid, (thread) => {
      const hasUnread = Boolean(thread?.unreadByUser);
      setHasUnreadAdminReply(hasUnread);
      if (
        thread &&
        thread.unreadByUser &&
        thread.lastMessageSender === 'admin' &&
        thread.lastMessageAtMs > prevUserReplyAtRef.current
      ) {
        prevUserReplyAtRef.current = thread.lastMessageAtMs;
        if (!(helpSupportOpenRef.current && helpSupportTabRef.current === 'admin')) {
          const preview = thread.lastMessageText || 'New reply from Admin Support';
          pushPopNotification({
            id: `inbox-user-${thread.lastMessageAtMs}`,
            kind: 'inbox-user',
            badgeLabel: 'Admin Reply',
            title: 'Admin Support',
            body: preview,
            actionLabel: 'Reply',
          });
          if (notificationsEnabledRef.current) {
            void deliverSystemNotification(
              `support-reply-${thread.lastMessageAtMs}`,
              'Admin Support',
              preview,
              { category: 'other' },
            );
          }
        }
      }
    });
    return () => unsub();
  }, [verifiedUserUid, pushPopNotification, deliverSystemNotification]);

  useEffect(() => {
    seenAdminThreadAtRef.current.clear();
    adminThreadsSeededRef.current = false;
    if (!isAdmin || !verifiedUserUid) {
      setUnreadAdminSupportCount(0);
      return;
    }
    const unsub = subscribeAdminSupportThreads(
      (threads) => {
        setUnreadAdminSupportCount(threads.filter((t) => t.unreadByAdmin).length);
        if (!adminThreadsSeededRef.current) {
          adminThreadsSeededRef.current = true;
          for (const t of threads) {
            seenAdminThreadAtRef.current.set(t.uid, t.lastMessageAtMs);
          }
          const newestUnread = threads
            .filter((t) => t.unreadByAdmin && t.lastMessageSender === 'user')
            .sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs)[0];
          if (newestUnread && activeTabRef.current !== 'admin') {
            const sender = newestUnread.userName || 'User Message';
            const preview = newestUnread.lastMessageText || 'New message in Support Inbox';
            pushPopNotification({
              id: `inbox-admin-${newestUnread.uid}-${newestUnread.lastMessageAtMs}`,
              kind: 'inbox-admin',
              badgeLabel: 'Support Inbox',
              title: sender,
              body: preview,
              senderPhotoUrl: newestUnread.userPhotoUrl,
              actionLabel: 'Reply',
              threadUid: newestUnread.uid,
            });
          }
          return;
        }

        for (const t of threads) {
          const prevAt = seenAdminThreadAtRef.current.get(t.uid) ?? 0;
          if (
            t.unreadByAdmin &&
            t.lastMessageSender === 'user' &&
            t.lastMessageAtMs > prevAt
          ) {
            seenAdminThreadAtRef.current.set(t.uid, t.lastMessageAtMs);
            const sender = t.userName || 'User Message';
            const preview = t.lastMessageText || 'New message in Support Inbox';
            pushPopNotification({
              id: `inbox-admin-${t.uid}-${t.lastMessageAtMs}`,
              kind: 'inbox-admin',
              badgeLabel: 'Support Inbox',
              title: sender,
              body: preview,
              senderPhotoUrl: t.userPhotoUrl,
              actionLabel: 'Reply',
              threadUid: t.uid,
            });
            if (notificationsEnabledRef.current) {
              void deliverSystemNotification(
                `support-admin-${t.uid}-${t.lastMessageAtMs}`,
                `${sender} · Support Inbox`,
                preview,
                { category: 'other' },
              );
            }
          } else if (t.lastMessageAtMs > prevAt) {
            seenAdminThreadAtRef.current.set(t.uid, t.lastMessageAtMs);
          }
        }
      },
      () => {
        // Ignore transient offline errors
      },
    );
    return () => unsub();
  }, [isAdmin, verifiedUserUid, pushPopNotification, deliverSystemNotification]);

  const handleOpenHelpSupport = useCallback((initialTab: HelpSupportInitialTab = 'bot') => {
    triggerHaptic('tap');
    setHelpSupportTab(initialTab);
    setHelpSupportOpen(true);
  }, []);

  const handleCloseGuide = useCallback(() => {
    setGuideOpen(false);
    markGuideSeen();
    markWhatsNewSeen(APP_VERSION);
  }, [markGuideSeen, markWhatsNewSeen]);

  const handleCloseWhatsNew = useCallback(() => {
    setWhatsNewOpen(false);
    markWhatsNewSeen(APP_VERSION);
  }, [markWhatsNewSeen]);

  useEffect(() => {
    if (!seenMetaReady || authLoading || needsEmailVerification || isLocked) return;
    if (!authUser && !isGuest) return;
    if (!guideSeen) {
      setGuideOpen(true);
      markGuideSeen();
      markWhatsNewSeen(APP_VERSION);
    } else if (whatsNewSeenVersion !== APP_VERSION) {
      setWhatsNewOpen(true);
      markWhatsNewSeen(APP_VERSION);
    }
  }, [
    seenMetaReady,
    authLoading,
    needsEmailVerification,
    isLocked,
    authUser,
    isGuest,
    guideSeen,
    whatsNewSeenVersion,
    markGuideSeen,
    markWhatsNewSeen,
  ]);

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

  useBackHandler({
    id: 'auth-prompt-modal',
    active: authPromptMode !== 'closed',
    priority: 60,
    onBack: closeAuthPrompt,
  });

  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      tabHistoryRef.current = ['calls'];
      setActiveTab('calls');
    }
  }, [activeTab, isAdmin]);

  const handleSwitchTab = useCallback(
    (nextTab: TabKey, options?: { fromBack?: boolean }) => {
      triggerHaptic('tap');
      resetExitBackTimer();
      if (!options?.fromBack) {
        const hist = tabHistoryRef.current;
        if (hist[hist.length - 1] !== nextTab) {
          hist.push(nextTab);
          if (hist.length > 20) {
            hist.splice(0, hist.length - 20);
          }
        }
      }
      setVisitedTabs((prev) => {
        if (prev.has(nextTab)) return prev;
        const next = new Set(prev);
        next.add(nextTab);
        return next;
      });
      setActiveTab(nextTab);
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [],
  );

  // Native Android hardware Back button (Capacitor App plugin)
  useEffect(() => {
    if (!isNativeCapacitor()) return;
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      dispatchBackNavigation({
        isLocked: isLockedRef.current,
        onMinimizeApp: () => {
          void CapacitorApp.minimizeApp();
        },
        canStepBackTab: () =>
          canUseMainTabsRef.current &&
          (tabHistoryRef.current.length > 1 || activeTabRef.current !== 'calls'),
        stepBackTab: () => {
          const history = tabHistoryRef.current;
          if (history.length > 1) {
            history.pop();
            const prevTab = history[history.length - 1] ?? 'calls';
            handleSwitchTab(prevTab, { fromBack: true });
          } else if (activeTabRef.current !== 'calls') {
            tabHistoryRef.current = ['calls'];
            handleSwitchTab('calls', { fromBack: true });
          }
        },
        showExitToast: () => showNotice('Press back again to exit', 'tap'),
        onExitApp: () => {
          void CapacitorApp.exitApp();
        },
      });
    });
    return () => {
      void listenerPromise.then((handle) => handle.remove());
    };
  }, [handleSwitchTab, showNotice]);

  // Web browser Back parity via History sentinel + popstate
  useEffect(() => {
    if (isNativeCapacitor() || typeof window === 'undefined') return;
    const ensureSentinel = () => {
      if (exitingWebRef.current) return;
      if (window.history.state?.__caSentinel !== true) {
        try {
          window.history.pushState({ __caSentinel: true }, '');
        } catch {
          // ignore history errors in restricted frames
        }
      }
    };
    if (canUseMainTabs || guideOpen || whatsNewOpen || authPromptMode !== 'closed') {
      ensureSentinel();
    }

    const onPopState = () => {
      if (exitingWebRef.current) {
        exitingWebRef.current = false;
        return;
      }
      const result = dispatchBackNavigation({
        isLocked: isLockedRef.current,
        onMinimizeApp: () => showNotice('Enter your 4-digit PIN to unlock.', 'tap'),
        canStepBackTab: () =>
          canUseMainTabsRef.current &&
          (tabHistoryRef.current.length > 1 || activeTabRef.current !== 'calls'),
        stepBackTab: () => {
          const history = tabHistoryRef.current;
          if (history.length > 1) {
            history.pop();
            const prevTab = history[history.length - 1] ?? 'calls';
            handleSwitchTab(prevTab, { fromBack: true });
          } else if (activeTabRef.current !== 'calls') {
            tabHistoryRef.current = ['calls'];
            handleSwitchTab('calls', { fromBack: true });
          }
        },
        showExitToast: () => showNotice('Press back again to exit', 'tap'),
        onExitApp: () => {
          exitingWebRef.current = true;
        },
      });
      if (result !== 'exit-now') {
        ensureSentinel();
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [canUseMainTabs, guideOpen, whatsNewOpen, authPromptMode, handleSwitchTab, showNotice]);

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
        if ((atTop && stepY > 0 && activeTabRef.current !== 'calls') || (atBottom && stepY < 0)) {
          pullAnchorY = y;
        } else {
          return;
        }
      }

      const rawPull = y - pullAnchorY;
      if ((atTop && rawPull > 0 && activeTabRef.current !== 'calls') || (atBottom && rawPull < 0)) {
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
    if (isAlertsSnoozedToday) return 0;
    const missedCount = alertTypePrefs.missedCalls
      ? unreturnedMissedCalls(calls, dismissedMissedIds).filter(
          (m) =>
            !mutedAlertSet.has(`missed:${getContactKey(m.number)}`) &&
            !readAlertSet.has(`missed:${m.id}`),
        ).length
      : 0;
    const scheduledCount = alertTypePrefs.scheduledCalls
      ? scheduledCalls.filter(
          (s) =>
            s.status === 'pending' &&
            !mutedAlertSet.has(`sched:${s.id}`) &&
            !readAlertSet.has(`sched:${s.id}:${s.scheduledFor}`),
        ).length
      : 0;
    const longGapCount =
      alertTypePrefs.longGapCalls !== false
        ? findLongGapReturnCalls(calls, {
            contacts,
            favorites: Array.from(favorites),
            minGapDays: alertTypePrefs.longGapDays ?? 30,
            maxAgeDays: 7,
          }).filter(
            (item) =>
              !dismissedMissedIds.has(`longgap:${item.id}`) &&
              !mutedAlertSet.has(`longgap:${item.contactKey}`) &&
              !readAlertSet.has(`longgap:${item.id}`),
          ).length
        : 0;
    return missedCount + scheduledCount + longGapCount;
  }, [
    isAlertsSnoozedToday,
    alertTypePrefs.missedCalls,
    alertTypePrefs.scheduledCalls,
    alertTypePrefs.longGapCalls,
    alertTypePrefs.longGapDays,
    calls,
    contacts,
    favorites,
    scheduledCalls,
    dismissedMissedIds,
    mutedAlertSet,
    readAlertSet,
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
      showNotice(`Dialing ${number}...`, false);
    },
    [showNotice],
  );

  const headerDates = useMemo(() => {
    const now = new Date();
    const ec = `${formatEthiopianShort(now, calendarPrefs.defaultLang)} EC`;
    const gc = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return {
      ec,
      gc: calendarPrefs.dateDisplay === 'both' ? gc : null,
    };
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
          <DarkModeToggle isDark={isDark} mode={themePreference} onToggle={toggleTheme} compact />
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
              <div
                data-unslop-toast="true"
                className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-[var(--dark-elevated)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-1.5 text-xs font-medium text-[#08246B] dark:text-white shadow-md"
              >
                <span data-unslop-toast-dot="true" className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shrink-0" />
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
        <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={34} />
            <span className="text-base font-bold tracking-tight text-[#08246B] dark:text-white whitespace-nowrap truncate">
              Call Analyzer - ETH
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              aria-label="Open app guide"
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <HelpCircle size={15} className="text-[#FF6A00]" />
              <span>Guide</span>
            </button>
            <DarkModeToggle isDark={isDark} mode={themePreference} onToggle={toggleTheme} compact />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center pb-10">
          {designVersion === 'v1.0.5' || designVersion === 'v1.0.6' || designVersion === 'v1.0.7' ? (
            <LandingHeroV105 onOpenGuide={() => setGuideOpen(true)} />
          ) : (
            <LandingHero onOpenGuide={() => setGuideOpen(true)} />
          )}
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
              <div
                data-unslop-toast="true"
                className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-[var(--dark-elevated)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-1.5 text-xs font-medium text-[#08246B] dark:text-white shadow-md"
              >
                <span data-unslop-toast-dot="true" className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shrink-0" />
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
        pinEnabled={pinEnabled}
        biometricEnabled={biometricUnlockEnabled}
        onVerifyBiometric={unlockWithBiometric}
        onSignOut={() => void signOutAccount()}
      />
    );
  }

  return (
    <>
      {designVersion === 'v1.0.7' ? (
        <AppShellV107
          headerDates={headerDates}
          pendingFollowUps={pendingFollowUps}
          onSelectCall={handleSelectCall}
          onSelectContact={handleSelectContact}
          onCallBack={handleCallBack}
          onOpenReminders={handleOpenReminders}
          onOpenWishes={handleOpenWishes}
          onOpenGuide={handleOpenGuide}
          onOpenWhatsNew={handleOpenWhatsNew}
          onOpenAndroidSetup={() => setAndroidSetupOpen(true)}
          onCheckForUpdates={handleManualUpdateCheck}
        />
      ) : designVersion === 'v1.0.6' ? (
        <AppShellV106
          headerDates={headerDates}
          pendingFollowUps={pendingFollowUps}
          onSelectCall={handleSelectCall}
          onSelectContact={handleSelectContact}
          onCallBack={handleCallBack}
          onOpenReminders={handleOpenReminders}
          onOpenWishes={handleOpenWishes}
          onOpenGuide={handleOpenGuide}
          onOpenWhatsNew={handleOpenWhatsNew}
          onOpenAndroidSetup={() => setAndroidSetupOpen(true)}
          onCheckForUpdates={handleManualUpdateCheck}
        />
      ) : (
        <div className="min-h-screen bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-white flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside
        data-unslop-sidebar="true"
        className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 lg:w-64 md:shrink-0 md:flex-col md:overflow-y-auto border-r border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] p-4 justify-between gap-4"
      >
        <div className="space-y-5">
          <div className="px-1 pt-1 space-y-1">
            <div className="flex items-center gap-2.5">
              <BrandLogo size={34} />
              <span className="text-base font-bold tracking-tight text-[#08246B] dark:text-white whitespace-nowrap truncate">
                Call Analyzer - ETH
              </span>
            </div>
            {dateHeaderStyle !== 'hidden' && (
              <button
                type="button"
                onClick={() => handleSwitchTab('calendar')}
                className="pl-[44px] space-y-0.5 text-left hover:opacity-80 transition-opacity"
                aria-label="Open Ethiopian Calendar"
              >
                <p className="text-[11px] font-mono font-semibold tabular-nums text-[#FF6A00] leading-tight">
                  {headerDates.ec}
                </p>
                {headerDates.gc && (
                  <p className="text-[10px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] leading-tight">
                    {headerDates.gc}
                  </p>
                )}
              </button>
            )}
          </div>

          <nav className="space-y-1" aria-label="Primary navigation">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              const showNewBadge =
                tab.key === 'calls' && unseenNewCallIds.length > 0 && activeTab !== 'calls';
              const showAdminUnreadBadge =
                tab.key === 'admin' && unreadAdminSupportCount > 0 && activeTab !== 'admin';
              return (
                <button
                  key={tab.key}
                  type="button"
                  data-unslop-nav-active={active ? 'true' : undefined}
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
                  {showAdminUnreadBadge && (
                    <span className="ml-auto px-1.5 py-0.5 rounded bg-[#FF6A00] text-white text-[10px] font-mono font-bold tabular-nums leading-none shrink-0">
                      {unreadAdminSupportCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div data-unslop-sidebar-footer="true" className="space-y-2">
          <DarkModeToggle
            isDark={isDark}
            mode={themePreference}
            onToggle={toggleTheme}
            onSelectAuto={() => setThemeMode('system')}
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

          {(pinEnabled || biometricUnlockEnabled) && (
            <button
              type="button"
              onClick={lockApp}
              aria-label="Lock screen"
              title="Lock screen"
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center gap-2 transition-colors"
            >
              <Lock size={14} className="text-[#FF6A00]" />
              Lock screen
            </button>
          )}

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
            onClick={() => handleOpenHelpSupport(hasUnreadAdminReply ? 'admin' : 'bot')}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-between gap-2 whitespace-nowrap transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <FlaticonIcon name="fi-rr-chatbot-speech-bubble" className="text-[16px] text-[#FF6A00]" />
              Help Bot &amp; Support
            </span>
            {hasUnreadAdminReply && (
              <span className="w-2 h-2 rounded-full bg-[#FF6A00] shrink-0" />
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
        data-unslop-mobile-header="true"
        className={`md:hidden sticky top-0 z-30 pt-[env(safe-area-inset-top)] border-b border-[#DDE4EA] dark:border-[var(--dark-border)] ${
          isDark ? 'bg-[#111214]' : 'bg-white dark:bg-[var(--dark-surface)]'
        }`}
      >
        <div className="min-h-[56px] px-3 sm:px-4 py-1.5 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo size={32} />
            <div className="min-w-0">
              <span className="block text-[14.5px] font-bold tracking-tight text-[#08246B] dark:text-white whitespace-nowrap truncate leading-tight">
                Call Analyzer - ETH
              </span>
              {dateHeaderStyle === 'header' && (
                <>
                  <span className="block text-[11px] font-mono font-semibold tabular-nums text-[#FF6A00] leading-tight truncate">
                    {headerDates.ec}
                  </span>
                  {headerDates.gc && (
                    <span className="block text-[10px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] leading-tight truncate">
                      {headerDates.gc}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {(pinEnabled || biometricUnlockEnabled) && (
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
              onClick={() => handleOpenHelpSupport(hasUnreadAdminReply ? 'admin' : 'bot')}
              aria-label="Help Bot and Chat with Admin"
              className="relative min-h-[44px] min-w-[38px] flex items-center justify-center rounded-xl text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] shrink-0"
            >
              <FlaticonIcon name="fi-rr-chatbot-speech-bubble" className="text-[18px]" />
              {hasUnreadAdminReply && (
                <span className="absolute top-2 right-1.5 w-2 h-2 rounded-full bg-[#FF6A00]" />
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

        {dateHeaderStyle === 'sub-bar' && activeTab === 'calls' && (
          <button
            type="button"
            onClick={() => handleSwitchTab('calendar')}
            aria-label="Open Ethiopian Calendar"
            className="w-full px-4 py-1.5 border-t border-[#EEF2F6] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)]/70 flex items-center justify-between gap-2 text-left active:opacity-80 transition-opacity"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Calendar size={13} className="text-[#FF6A00] shrink-0" />
              <span className="text-[11px] font-mono font-semibold tabular-nums text-[#FF6A00] truncate">
                {headerDates.ec}
              </span>
              {headerDates.gc && (
                <>
                  <span className="text-[#CBD5E1] dark:text-[var(--dark-border)] text-[10px]">•</span>
                  <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    {headerDates.gc}
                  </span>
                </>
              )}
            </span>
            <ChevronRight size={13} className="text-[#8A93A0] shrink-0" />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-8 overflow-x-clip">
        <div
          ref={mainContentRef}
          className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-7"
        >
          <BroadcastBanners />

          {isGuest && (
            <div className="mb-4 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/12 border border-[#FF6A00]/35 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                  Guest Preview · Temporary demo
                </p>
                <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Demo calls clear automatically when you sign in — no sample contacts are ever saved.
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

          {visitedTabs.has('calls') && (
            <div className={activeTab === 'calls' ? 'block' : 'hidden'}>
              {dateHeaderStyle === 'calls-strip' && (
                <button
                  type="button"
                  onClick={() => handleSwitchTab('calendar')}
                  aria-label="Open Ethiopian Calendar"
                  className="md:hidden mb-3 w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]/60 flex items-center justify-between gap-2 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Calendar size={14} className="text-[#FF6A00] shrink-0" />
                    <span className="text-xs font-mono font-semibold tabular-nums text-[#08246B] dark:text-white truncate">
                      {headerDates.ec}
                    </span>
                    {headerDates.gc && (
                      <>
                        <span className="text-[#CBD5E1] dark:text-[var(--dark-border)] text-xs">·</span>
                        <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                          {headerDates.gc}
                        </span>
                      </>
                    )}
                  </span>
                  <ChevronRight size={14} className="text-[#8A93A0] shrink-0" />
                </button>
              )}
              <CallsTab
                isActive={activeTab === 'calls'}
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
                onOpenHelpSupport={handleOpenHelpSupport}
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
        data-unslop-bottom-nav="true"
        aria-label="Mobile navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] pb-[env(safe-area-inset-bottom)] ${
          isDark ? 'bg-[#111214]' : 'bg-white dark:bg-[var(--dark-surface)]'
        }`}
      >
        <div
          className={`h-16 grid items-center px-0.5 ${
            visibleTabs.length === 6 ? 'grid-cols-6' : 'grid-cols-5'
          }`}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            const showNewBadge =
              tab.key === 'calls' && unseenNewCallIds.length > 0 && activeTab !== 'calls';
            const showAdminUnreadBadge =
              tab.key === 'admin' && unreadAdminSupportCount > 0 && activeTab !== 'admin';
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleSwitchTab(tab.key)}
                className={`relative h-14 min-w-0 px-0.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                  active ? 'text-[#FF6A00]' : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 left-2.5 right-2.5 h-[3px] max-h-[3px] rounded-full bg-[#FF6A00]"
                  />
                )}
                {showNewBadge && (
                  <span className="pointer-events-none absolute top-1.5 right-1.5 px-1 py-[1px] rounded bg-[#FF6A00] text-white text-[8px] font-bold uppercase tracking-wider leading-none">
                    NEW
                  </span>
                )}
                {showAdminUnreadBadge && (
                  <span className="pointer-events-none absolute top-1.5 right-1.5 min-w-[16px] px-1 py-[1px] rounded bg-[#FF6A00] text-white text-[9px] font-mono font-bold tabular-nums leading-none text-center">
                    {unreadAdminSupportCount}
                  </span>
                )}
                <Icon size={18} className="shrink-0" />
                <span
                  className={`${
                    visibleTabs.length === 6 ? 'text-[9.5px] tracking-tight' : 'text-[10px]'
                  } font-semibold leading-none whitespace-nowrap truncate max-w-full`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
        </div>
      )}

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

      <WishComposerModal />

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

      <BroadcastPopupModal />

      <NotificationPopToast
        item={popNotifications[0] ?? null}
        onDismiss={dismissPopNotification}
        onAction={(item) => {
          dismissPopNotification(item.id);
          if (item.kind === 'inbox-user') {
            handleOpenHelpSupport('admin');
          } else if (item.kind === 'inbox-admin') {
            setPendingAdminChatThreadUid(item.threadUid ?? null);
            handleSwitchTab('admin');
          }
        }}
      />

      <HelpSupportModal
        open={helpSupportOpen}
        initialTab={helpSupportTab}
        onClose={() => setHelpSupportOpen(false)}
      />

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

      <DiscardChangesModal prompt={discardPrompt} />

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
            <div
              data-unslop-toast="true"
              className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-[var(--dark-elevated)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-1.5 text-xs font-medium text-[#08246B] dark:text-white shadow-md"
            >
              <span data-unslop-toast-dot="true" className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] shrink-0" />
              <span className="truncate">{notice}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CallsProvider>
        <AppShell />
        <VersionSwitcherBar />
      </CallsProvider>
    </ErrorBoundary>
  );
}
