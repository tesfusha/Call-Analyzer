import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpDown,
  Award,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Contact,
  Download,
  Edit3,
  ExternalLink,
  FileDown,
  FileText,
  Fingerprint,
  Flame,
  HelpCircle,
  Info,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Minus,
  Palette,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Signal,
  Smartphone,
  Trash2,
  Trophy,
  Type,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AchievementsModal } from '@/src/components/AchievementsModal';
import { BrandLogo } from '@/src/components/BrandLogo';
import { CustomSelect } from '@/src/components/CustomSelect';
import { DarkModeToggle } from '@/src/components/DarkModeToggle';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { ImportPreviewModal, type PendingImportState } from '@/src/components/ImportPreviewModal';
import { PrivacyPolicyModal } from '@/src/components/PrivacyPolicyModal';
import { ProfileEditModal } from '@/src/components/ProfileEditModal';
import { BADGE_DEFINITIONS, POINTS_CONFIG } from '@/src/lib/gamificationConstants';
import {
  APP_CONTACT_EMAIL,
  APP_FEATURES,
  APP_NAME,
  APP_PRIVACY_NOTE,
  APP_RELEASE_LABEL,
  APP_TELEGRAM_HANDLE,
  APP_TELEGRAM_URL,
  APP_VERSION,
  APP_VERSION_CODE,
} from '@/src/lib/appInfo';
import {
  canSyncAllPhoneContacts,
  isContactPickerSupported,
  loadAllPhoneContacts,
  parseCsvContacts,
  parseVCardContacts,
  pickPhoneContacts,
  readUploadedTextFile,
} from '@/src/lib/contacts';
import { CARRIER_PRESETS } from '@/src/lib/ethiopia';
import {
  buildVersionedBackupJson,
  callsToCsv,
  callsToHtmlReport,
  downloadTextFile,
  shareContactVcard,
} from '@/src/lib/export';
import { formatTime } from '@/src/lib/format';
import { isHapticsEnabled, setHapticsEnabledStorage, triggerHaptic } from '@/src/lib/haptics';
import { hasNativeCallLogSyncPlugin, isNativeCapacitor } from '@/src/lib/capacitor';
import { buildImportPreview, parseBackupImport } from '@/src/lib/import';
import { exportCallHistoryPdfReport } from '@/src/lib/pdfExport';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { useCalls } from '@/src/store/CallsContext';
import type { AlertTypePrefs, SettingsSectionId } from '@/src/types/call';

const CALLBACK_DELAY_OPTIONS = [15, 30, 60, 120];
const MISSED_CALL_REMINDER_DELAYS = [5, 7, 10] as const;
const EVENT_LEAD_OPTIONS = [0, 3, 7, 14];
const QUIET_DAYS_OPTIONS = [14, 30, 45];
const WEEKLY_GOAL_PRESETS = [3, 5, 7] as const;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const LONG_GAP_DAY_OPTIONS = [14, 30, 60, 90] as const;

type AlertTypeToggleKey =
  | 'missedCalls'
  | 'scheduledCalls'
  | 'birthdays'
  | 'holidays'
  | 'quietContacts'
  | 'longGapCalls';

const ALERT_TYPE_OPTIONS: Array<{
  key: AlertTypeToggleKey;
  label: string;
  description: string;
}> = [
  {
    key: 'missedCalls',
    label: 'Missed calls',
    description: 'Count in Bell badge and send unreturned missed-call alerts',
  },
  {
    key: 'longGapCalls',
    label: 'Calls after 30+ days',
    description: 'Notify with a Back in Touch card when someone calls after a long silence',
  },
  {
    key: 'scheduledCalls',
    label: 'Scheduled calls',
    description: 'Count in Bell badge and send scheduled callback alerts',
  },
  {
    key: 'birthdays',
    label: 'Birthdays',
    description: 'Send daily wish alerts for contact birthdays & special events',
  },
  {
    key: 'holidays',
    label: 'Holidays',
    description: 'Send daily wish alerts for Ethiopian holidays',
  },
  {
    key: 'quietContacts',
    label: 'Quiet contacts',
    description: 'Surface people to reconnect with inside the Quiet tab',
  },
];

interface AccordionSectionMeta {
  id: SettingsSectionId;
  title: string;
  icon: typeof Palette;
  keywords: string;
}

const ACCORDION_SECTIONS: AccordionSectionMeta[] = [
  {
    id: 'appearance',
    title: 'Appearance, Theme & Font Size',
    icon: Palette,
    keywords: 'appearance theme dark bright auto light font size text scale vibration haptics date header banner strip placement',
  },
  {
    id: 'security',
    title: 'Screen Lock PIN',
    icon: ShieldCheck,
    keywords: 'security screen lock pin 4-digit passcode unlock',
  },
  {
    id: 'sim_tariffs',
    title: 'SIM Labels, Tariffs & Monthly Budget',
    icon: Signal,
    keywords: 'sim etc sfc ethio telecom safaricom tariff rate etb billing per-second per-minute budget',
  },
  {
    id: 'reminders',
    title: 'Reminders, Alerts & Reconnect Goal',
    icon: Bell,
    keywords:
      'reminders alerts notifications missed call delay 5 7 10 saved contacts weekly reconnect goal quiet hours battery permissions test notification bell badge',
  },
  {
    id: 'calendar',
    title: 'Ethiopian Calendar & Language',
    icon: Calendar,
    keywords: 'ethiopian calendar amharic english geez numerals date header ec gc',
  },
  {
    id: 'backup',
    title: 'Contacts & Call History Backup',
    icon: ArrowUpDown,
    keywords:
      'backup export import csv json pdf html vcf vcard contacts birthdays clear history delete local data',
  },
  {
    id: 'about',
    title: 'About App, Help Bot & Support',
    icon: Info,
    keywords: 'about version build updates whats new guide features privacy contact email telegram channel support chatbot faq bot admin chat help',
  },
];

export function SettingsTab({
  onOpenReminders,
  onOpenGuide,
  onOpenWhatsNew,
  onOpenAndroidSetup,
  onSelectContact,
  onCheckForUpdates,
  onOpenHelpSupport,
}: {
  onOpenReminders: () => void;
  onOpenGuide?: () => void;
  onOpenWhatsNew?: () => void;
  onOpenAndroidSetup?: () => void;
  onSelectContact?: (number: string) => void;
  onCheckForUpdates?: () => Promise<void>;
  onOpenHelpSupport?: (initialTab?: 'bot' | 'admin') => void;
}) {
  const {
    calls,
    contacts,
    scheduledCalls,
    favorites,
    dismissedMissedIds,
    mutedAlertKeys,
    tariffs,
    setTariffs,
    simLabels,
    setSimLabels,
    calendarPrefs,
    setCalendarPrefs,
    reminderPrefs,
    setReminderPrefs,
    alertTypePrefs,
    setAlertTypePrefs,
    voiceBundles,
    theme,
    themePreference,
    systemIsDark,
    setThemeMode,
    toggleTheme,
    fontSizeScale,
    setFontSizeScale,
    fontFamily,
    setFontFamily,
    dateHeaderStyle,
    setDateHeaderStyle,
    notificationsEnabled,
    setNotificationsEnabled,
    notificationPermission,
    requestAlertPermissions,
    sendTestAlertNotification,
    pinEnabled,
    autoLockMinutes,
    setAutoLockMinutes,
    setAppPin,
    clearAppPin,
    lockApp,
    biometricAvailable,
    biometricUnlockEnabled,
    biometricSavedLogin,
    toggleBiometricUnlock,
    enableBiometricLogin,
    disableBiometricLogin,
    authUser,
    authLoading,
    isGuest,
    authProvider,
    profileName,
    userPhotoUrl,
    userPhone,
    openAuthPrompt,
    exitGuestMode,
    syncStatus,
    lastSyncedAt,
    signOutAccount,
    deleteAllLocalData,
    deleteUserAccount,
    syncNow,
    canSyncPhoneCalls,
    availableTags,
    customTags,
    streaks,
    effectiveStreaks,
    badges,
    pointsHistory,
    score,
    topContactStatuses,
    contactMilestones,
    wishTemplates,
    sentWishes,
    snoozedQuietUntil,
    reconnectProgress,
    expandedSettingsSections,
    setExpandedSettingsSections,
    rebuildScore,
    importBackupPackage,
    importContactProfiles,
    clearCalls,
    showNotice,
  } = useCalls();

  const prefersReducedMotion = useReducedMotion();

  const [sim1Label, setSim1Label] = useState(simLabels.sim1Label);
  const [sim2Label, setSim2Label] = useState(simLabels.sim2Label);
  const [sim1Rate, setSim1Rate] = useState(String(tariffs.sim1RatePerMin));
  const [sim2Rate, setSim2Rate] = useState(String(tariffs.sim2RatePerMin));
  const [budgetEtb, setBudgetEtb] = useState(String(tariffs.monthlyBudgetEtb));
  const [billingMode, setBillingMode] = useState(tariffs.billingMode);

  const [settingsQuery, setSettingsQuery] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [achievementsTab, setAchievementsTab] = useState<'general' | 'contacts'>('general');
  const [pendingImport, setPendingImport] = useState<PendingImportState | null>(null);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => isHapticsEnabled());
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [showBiometricPwdPrompt, setShowBiometricPwdPrompt] = useState(false);
  const [biometricPwd, setBiometricPwd] = useState('');
  const [biometricPwdError, setBiometricPwdError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contactsFileInputRef = useRef<HTMLInputElement>(null);
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  useEffect(() => {
    setSim1Label(simLabels.sim1Label);
    setSim2Label(simLabels.sim2Label);
  }, [simLabels]);

  useEffect(() => {
    setSim1Rate(String(tariffs.sim1RatePerMin));
    setSim2Rate(String(tariffs.sim2RatePerMin));
    setBudgetEtb(String(tariffs.monthlyBudgetEtb));
    setBillingMode(tariffs.billingMode);
  }, [tariffs]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readUploadedTextFile(file);
      const pkg = parseBackupImport(text, file.name);
      const preview = buildImportPreview(file.name, pkg, {
        calls,
        contacts,
        availableTags,
        scheduledCalls,
      });
      if (
        preview.totalRowsEvaluated === 0 &&
        !preview.isBackup &&
        preview.problems.length > 0
      ) {
        showNotice(preview.problems[0]);
        return;
      }
      setPendingImport({ pkg, preview });
    } catch {
      showNotice('Could not read the selected file.');
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    const counts = importBackupPackage(pendingImport.pkg);
    setPendingImport(null);
    const parts: string[] = [];
    if (counts.callsAdded > 0) {
      parts.push(`Imported ${counts.callsAdded} call${counts.callsAdded === 1 ? '' : 's'}`);
    } else if (counts.callsMerged > 0) {
      parts.push(
        `Merged notes/tags on ${counts.callsMerged} existing call${counts.callsMerged === 1 ? '' : 's'}`,
      );
    } else if (counts.restoredSections.length > 0) {
      parts.push(`Restored ${counts.restoredSections.join(', ')}`);
    } else {
      parts.push('No new calls added');
    }
    if (counts.callsDuplicates > 0) {
      parts.push(
        `${counts.callsDuplicates} duplicate${counts.callsDuplicates === 1 ? '' : 's'} skipped`,
      );
    }
    showNotice(
      parts.join(' · '),
      counts.callsAdded > 0 || counts.restoredSections.length > 0 ? 'success' : 'tap',
    );
  };

  const handleContactsFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readUploadedTextFile(file);
      const lower = file.name.toLowerCase();
      const parsed =
        lower.endsWith('.vcf') || text.includes('BEGIN:VCARD')
          ? parseVCardContacts(text)
          : parseCsvContacts(text);
      if (parsed.length === 0) {
        showNotice('No contacts with phone numbers found in that file.');
        return;
      }
      const counts = importContactProfiles(parsed);
      showNotice(
        `Synced ${counts.added + counts.updated} contacts (${counts.added} new, ${counts.updated} updated).`,
      );
    } catch {
      showNotice('Could not read the contacts file.');
    }
  };

  const triggerCallImport = () => {
    if (isGuest || !authUser) {
      openAuthPrompt('signin', 'Login or create an account to import your call history.');
      return;
    }
    fileInputRef.current?.click();
  };

  const triggerContactsFileImport = () => {
    if (isGuest || !authUser) {
      openAuthPrompt('signin', 'Login or create an account to import phone contacts.');
      return;
    }
    contactsFileInputRef.current?.click();
  };

  const [syncingPhoneContacts, setSyncingPhoneContacts] = useState(false);

  const handleLoadAllPhoneContacts = async () => {
    if (isGuest || !authUser) {
      openAuthPrompt('signin', 'Login or create an account to load phone contacts.');
      return;
    }
    setSyncingPhoneContacts(true);
    try {
      const res = await loadAllPhoneContacts();
      if (!res.supported || !res.granted) {
        showNotice(res.error ?? 'Could not load phone contacts.');
        return;
      }
      if (res.contacts.length === 0) {
        showNotice('No saved phone contacts with numbers found on this device.');
        return;
      }
      const counts = importContactProfiles(res.contacts);
      showNotice(
        `Loaded ${res.contacts.length} phone contact${res.contacts.length === 1 ? '' : 's'} (${counts.added} added, ${counts.updated} updated).`,
        'success',
      );
    } finally {
      setSyncingPhoneContacts(false);
    }
  };

  const handlePhoneContactsPick = async () => {
    if (isGuest || !authUser) {
      openAuthPrompt('signin', 'Login or create an account to import phone contacts.');
      return;
    }
    const res = await pickPhoneContacts();
    if (!res.supported || res.error) {
      showNotice(res.error ?? 'Phone contact picker unavailable here.');
      return;
    }
    if (res.contacts.length === 0) {
      showNotice('No contacts selected.');
      return;
    }
    const counts = importContactProfiles(res.contacts);
    showNotice(
      `Imported ${counts.added + counts.updated} phone contact${counts.added + counts.updated === 1 ? '' : 's'}.`,
    );
  };

  const handleAlertSetup = async () => {
    if (notificationPermission === 'granted') {
      await sendTestAlertNotification(
        'Callback, birthday, and Ethiopian holiday alerts are active.',
      );
      return;
    }
    const nextPermission = await requestAlertPermissions();
    if (nextPermission === 'granted') {
      setNotificationsEnabled(true);
      await sendTestAlertNotification(
        'Callback, birthday, and Ethiopian holiday alerts are active.',
      );
    }
  };

  const handleDelayedTestNotification = async () => {
    if (notificationPermission !== 'granted') {
      const nextPermission = await requestAlertPermissions();
      if (nextPermission !== 'granted') return;
      setNotificationsEnabled(true);
    }
    await sendTestAlertNotification(undefined, 10);
  };

  const handleSavePin = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      showNotice('Enter a 4-digit numeric PIN.');
      return;
    }
    if (newPin !== confirmPin) {
      showNotice('PIN confirmation does not match.');
      return;
    }
    await setAppPin(newPin);
    setNewPin('');
    setConfirmPin('');
  };

  const contactCount = Object.keys(contacts).length;
  const birthdayCount = Object.values(contacts).filter((c) => c.birthday !== null).length;
  const isDark = theme === 'dark-gray';
  const effectivePhotoUrl = userPhotoUrl || authUser?.photoURL || null;
  const effectiveDisplayName =
    profileName || authUser?.displayName || authUser?.email || 'Signed-in Account';
  const weeklyGoal = Math.min(14, Math.max(1, Math.round(reminderPrefs.weeklyReconnectGoal ?? 3)));

  const handleShareMyContact = async () => {
    if (!authUser) return;
    try {
      const delivery = await shareContactVcard({
        name: effectiveDisplayName,
        number: userPhone || '',
        email: authUser.email || null,
      });
      if (delivery === 'native') {
        showNotice('Contact card (.vcf) saved to Downloads & ready to share.');
      } else if (delivery === 'shared') {
        showNotice('Contact card ready to share.');
      } else {
        showNotice('Contact details copied to clipboard.');
      }
    } catch {
      showNotice('Could not share your contact card.');
    }
  };

  const sectionSummaries: Record<SettingsSectionId, string> = useMemo(
    () => ({
      score_badges: `${score} pts · ${effectiveStreaks.currentStreak}d streak · ${badges.length}/${BADGE_DEFINITIONS.length} badges`,
      appearance: `${
        themePreference === 'system' ? 'Auto' : isDark ? 'Dark' : 'Bright'
      } · ${
        fontFamily === 'outfit'
          ? 'Outfit'
          : fontFamily === 'manrope'
            ? 'Manrope'
            : fontFamily === 'space'
              ? 'Space Grotesk'
              : fontFamily === 'dm'
                ? 'DM Sans'
                : 'Plus Jakarta'
      } · ${
        fontSizeScale === 'default'
          ? 'Standard'
          : fontSizeScale === 'large'
            ? 'Larger'
            : 'Biggest'
      } text`,
      security:
        pinEnabled && biometricUnlockEnabled
          ? 'PIN + Fingerprint lock active'
          : biometricUnlockEnabled
            ? 'Fingerprint lock active'
            : pinEnabled
              ? '4-digit lock active'
              : biometricSavedLogin?.uid && authUser?.uid && biometricSavedLogin.uid === authUser.uid
                ? 'Fingerprint sign-in active'
                : 'No screen lock set',
      sim_tariffs: `${simLabels.sim1Label} / ${simLabels.sim2Label} · ${tariffs.billingMode}`,
      reminders: `${notificationsEnabled ? 'Alerts on' : 'Alerts off'} · ${
        reminderPrefs.missedCallReminderDelayMinutes
      }m delay · Goal ${weeklyGoal}/wk`,
      calendar: `${calendarPrefs.defaultLang === 'amharic' ? 'አማርኛ' : 'English'} · ${
        calendarPrefs.dateDisplay === 'both' ? 'EC + GC' : 'EC only'
      }`,
      backup: `${calls.length} call${calls.length === 1 ? '' : 's'} · ${contactCount} saved contact${
        contactCount === 1 ? '' : 's'
      }`,
      about: `v${APP_VERSION} · build ${APP_VERSION_CODE}`,
    }),
    [
      score,
      effectiveStreaks.currentStreak,
      badges.length,
      themePreference,
      isDark,
      fontFamily,
      fontSizeScale,
      dateHeaderStyle,
      pinEnabled,
      biometricUnlockEnabled,
      biometricSavedLogin?.uid,
      authUser?.uid,
      simLabels.sim1Label,
      simLabels.sim2Label,
      tariffs.billingMode,
      notificationsEnabled,
      reminderPrefs.missedCallReminderDelayMinutes,
      weeklyGoal,
      calendarPrefs.defaultLang,
      calendarPrefs.dateDisplay,
      calls.length,
      contactCount,
    ],
  );

  const normalizedQuery = settingsQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const visibleSections = useMemo(() => {
    if (!isSearching) return ACCORDION_SECTIONS;
    return ACCORDION_SECTIONS.filter(
      (sec) =>
        sec.title.toLowerCase().includes(normalizedQuery) ||
        sec.keywords.includes(normalizedQuery) ||
        sectionSummaries[sec.id].toLowerCase().includes(normalizedQuery),
    );
  }, [isSearching, normalizedQuery, sectionSummaries]);

  const toggleSection = (id: SettingsSectionId) => {
    triggerHaptic('tap');
    const isOpen = expandedSettingsSections.includes(id);
    if (isOpen) {
      setExpandedSettingsSections(expandedSettingsSections.filter((item) => item !== id));
    } else {
      setExpandedSettingsSections([...expandedSettingsSections, id]);
    }
  };

  const renderSectionBody = (id: SettingsSectionId) => {
    switch (id) {
      case 'appearance':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#08246B] dark:text-white">Theme</h3>
                <div className="flex items-center gap-1.5" aria-label="Brand and theme colors">
                  <span className="w-4 h-4 rounded-full bg-[#111214] border border-[#DDE4EA] dark:border-white/30" title="Dark #111214" />
                  <span className="w-4 h-4 rounded-full bg-[#08246B] border border-[#DDE4EA] dark:border-white/30" title="Navy #08246B" />
                  <span className="w-4 h-4 rounded-full bg-[#FF6A00]" title="Orange #FF6A00" />
                  <span className="w-4 h-4 rounded-full bg-white border border-[#DDE4EA]" title="White #FFFFFF" />
                </div>
              </div>

              <div className="flex items-center gap-3 pb-2 border-b border-[#DDE4EA] dark:border-[var(--dark-border)]">
                <BrandLogo size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                    Call Analyzer - ETH
                  </p>
                  <p className="text-xs font-mono text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                    #111214 · #08246B · #FF6A00 · #FFFFFF
                  </p>
                </div>
              </div>

              <DarkModeToggle
                isDark={isDark}
                mode={themePreference}
                onToggle={toggleTheme}
                onSelectAuto={() => setThemeMode('system')}
                label={
                  themePreference === 'system'
                    ? systemIsDark
                      ? 'Auto · Dark'
                      : 'Auto · Bright'
                    : isDark
                      ? 'Dark Active'
                      : 'Bright Active'
                }
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Theme Style
                  </span>
                  <span className="text-[11px] font-medium text-[#FF6A00]">
                    {themePreference === 'system'
                      ? `Following device (${systemIsDark ? 'Dark' : 'Bright'})`
                      : `Manual (${isDark ? 'Dark' : 'Bright'})`}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center gap-1 p-1 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                  {(
                    [
                      { key: 'system', label: 'Auto' },
                      { key: 'light', label: 'Bright' },
                      { key: 'dark-gray', label: 'Dark' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setThemeMode(opt.key)}
                      className={`min-h-[38px] px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        themePreference === opt.key
                          ? 'bg-[#FF6A00] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Use Auto to match your device or tap Bright / Dark anytime to switch manually.
                </p>
              </div>

              <div className="pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    Vibration Feedback
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Subtle haptic pulse when toggling, syncing, or saving changes
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hapticsEnabled}
                  onClick={() => {
                    const next = !hapticsEnabled;
                    setHapticsEnabled(next);
                    setHapticsEnabledStorage(next);
                    if (next) {
                      triggerHaptic('success');
                      showNotice('Vibration feedback enabled.', false);
                    } else {
                      showNotice('Vibration feedback muted.', false);
                    }
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    hapticsEnabled
                      ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                      : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white bg-white dark:bg-[var(--dark-surface)]'
                  }`}
                >
                  {hapticsEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Type size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#08246B] dark:text-white">
                    Font Size
                  </h3>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Adjust reading size across lists, stats, and dialogs
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 items-center gap-1 p-1 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                {(
                  [
                    { key: 'default', label: 'Default', hint: 'Standard' },
                    { key: 'large', label: 'Larger', hint: 'Medium+' },
                    { key: 'xlarge', label: 'Biggest', hint: 'Large' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      triggerHaptic('tap');
                      setFontSizeScale(opt.key);
                    }}
                    className={`min-h-[46px] px-2 py-1.5 rounded-lg text-center transition-colors ${
                      fontSizeScale === opt.key
                        ? 'bg-[#FF6A00] text-white'
                        : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                    }`}
                  >
                    <span className="block text-xs font-semibold whitespace-nowrap">
                      {opt.label}
                    </span>
                    <span
                      className={`block text-[10px] whitespace-nowrap ${
                        fontSizeScale === opt.key
                          ? 'text-white/85'
                          : 'text-[#8A93A0] dark:text-[var(--dark-text-muted)]'
                      }`}
                    >
                      {opt.hint}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                    Abebe Kebede · አበበ ከበደ
                  </span>
                  <span className="text-xs font-mono tabular-nums text-[#FF6A00] shrink-0">
                    12m 40s
                  </span>
                </div>
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Preview text &amp; Ethiopian dates scale smoothly while keeping icons crisp.
                </p>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-xl bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Type size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#08246B] dark:text-white">
                    Modern Font Style
                  </h3>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Choose from 5 clean modern typefaces (all paired with crisp Ethiopic &amp; numeric support)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {(
                  [
                    {
                      key: 'jakarta',
                      label: 'Plus Jakarta',
                      tag: 'Default',
                      desc: 'Clean geometric',
                      familyCss: "'Plus Jakarta Sans', 'Noto Sans Ethiopic', sans-serif",
                    },
                    {
                      key: 'outfit',
                      label: 'Outfit',
                      tag: 'Rounded',
                      desc: 'Smooth & friendly',
                      familyCss: "'Outfit', 'Noto Sans Ethiopic', sans-serif",
                    },
                    {
                      key: 'manrope',
                      label: 'Manrope',
                      tag: 'Minimal',
                      desc: 'Sharp & balanced',
                      familyCss: "'Manrope', 'Noto Sans Ethiopic', sans-serif",
                    },
                    {
                      key: 'space',
                      label: 'Space Grotesk',
                      tag: 'Editorial',
                      desc: 'Bold modern tech',
                      familyCss: "'Space Grotesk', 'Noto Sans Ethiopic', sans-serif",
                    },
                    {
                      key: 'dm',
                      label: 'DM Sans',
                      tag: 'Sleek',
                      desc: 'Effortless reading',
                      familyCss: "'DM Sans', 'Noto Sans Ethiopic', sans-serif",
                    },
                  ] as const
                ).map((opt) => {
                  const active = fontFamily === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setFontFamily(opt.key);
                        showNotice(`Font switched to ${opt.label}.`, false);
                      }}
                      aria-pressed={active}
                      style={{ fontFamily: opt.familyCss }}
                      className={`min-h-[78px] px-3 py-2.5 rounded-xl border text-left transition-colors flex flex-col justify-between gap-1.5 ${
                        active
                          ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 border-[#FF6A00] text-[#08246B] dark:text-white'
                          : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]/60'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-1.5">
                        <span className="text-lg font-bold leading-none text-[#FF6A00]">
                          Aa
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            active
                              ? 'text-[#FF6A00]'
                              : 'text-[#8A93A0] dark:text-[var(--dark-text-muted)]'
                          }`}
                        >
                          {opt.tag}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold truncate">
                          {opt.label}
                        </span>
                        <span className="block text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-xl bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Calendar size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#08246B] dark:text-white">
                    Header &amp; Date Placement
                  </h3>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Keep the top bar clean with Logo + Name or choose where today&apos;s Ethiopian date appears
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    {
                      key: 'calls-strip',
                      label: 'Calls Strip',
                      tag: 'Default',
                      desc: 'Clean Logo + Name in top bar; tappable date strip at top of Calls.',
                    },
                    {
                      key: 'sub-bar',
                      label: 'Header Sub-Bar',
                      tag: 'Compact',
                      desc: 'Clean Logo + Name in top bar; slim date bar tucked right below.',
                    },
                    {
                      key: 'header',
                      label: 'In Top Header',
                      tag: 'Classic',
                      desc: 'Stack Ethiopian & Gregorian dates right below the app name.',
                    },
                    {
                      key: 'hidden',
                      label: 'Hidden',
                      tag: 'Minimal',
                      desc: 'Logo + Name only; view dates anytime inside the Calendar tab.',
                    },
                  ] as const
                ).map((opt) => {
                  const selected = dateHeaderStyle === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDateHeaderStyle(opt.key)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? 'border-[#FF6A00] bg-white dark:bg-[var(--dark-surface)] ring-1 ring-[#FF6A00]/30'
                          : 'border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white/70 dark:bg-[var(--dark-surface)]/60 hover:border-[#FF6A00]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#08246B] dark:text-white">
                          {opt.label}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                            selected
                              ? 'bg-[#FF6A00] text-white'
                              : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                          }`}
                        >
                          {selected ? 'Active' : opt.tag}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'security': {
        const isBiometricLoginForThisAccount = Boolean(
          authUser?.uid && biometricSavedLogin?.uid === authUser.uid,
        );
        const handleEnableBiometricLoginClick = async () => {
          setBiometricPwdError('');
          setBiometricBusy(true);
          try {
            const res = await enableBiometricLogin();
            if (!res.ok && res.error) {
              if (res.error.toLowerCase().includes('password')) {
                setShowBiometricPwdPrompt(true);
                setBiometricPwdError('');
              } else {
                setBiometricPwdError(res.error);
              }
            } else if (res.ok) {
              setShowBiometricPwdPrompt(false);
              setBiometricPwd('');
            }
          } finally {
            setBiometricBusy(false);
          }
        };

        const handleConfirmBiometricPassword = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!biometricPwd.trim()) {
            setBiometricPwdError('Enter your current password to confirm.');
            return;
          }
          setBiometricPwdError('');
          setBiometricBusy(true);
          try {
            const res = await enableBiometricLogin(biometricPwd);
            if (res.ok) {
              setShowBiometricPwdPrompt(false);
              setBiometricPwd('');
            } else if (res.error) {
              setBiometricPwdError(res.error);
            }
          } finally {
            setBiometricBusy(false);
          }
        };

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                  4-Digit Screen Lock PIN · {pinEnabled ? 'Active on this device' : 'Optional backup'}
                </p>
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Quick numeric PIN lock on this device (also works as a backup if you turn on Fingerprint App Lock)
                </p>
              </div>
              {(pinEnabled || biometricUnlockEnabled) && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={lockApp}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Lock size={13} />
                    Lock screen
                  </button>
                  {pinEnabled && (
                    <button
                      type="button"
                      onClick={clearAppPin}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 whitespace-nowrap shrink-0 transition-colors"
                    >
                      Remove PIN
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder={pinEnabled ? 'New 4-digit PIN' : 'Enter 4-digit PIN'}
                aria-label="New 4-digit screen lock PIN"
                className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm font-mono tracking-widest text-[#08246B] dark:text-white placeholder:text-[#8A93A0] placeholder:tracking-normal focus:outline-none focus:border-[#FF6A00]"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Confirm PIN"
                aria-label="Confirm 4-digit screen lock PIN"
                className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm font-mono tracking-widest text-[#08246B] dark:text-white placeholder:text-[#8A93A0] placeholder:tracking-normal focus:outline-none focus:border-[#FF6A00]"
              />
              <button
                type="button"
                onClick={() => void handleSavePin()}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0 transition-colors"
              >
                {pinEnabled ? 'Update PIN' : 'Enable screen lock'}
              </button>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-2.5">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                  Auto-Lock After Inactivity
                </p>
                <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Automatically locks the app after idle time or leaving so you unlock with Fingerprint or PIN (default: 5 minutes).
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { value: 0, label: 'Immediately' },
                    { value: 1, label: '1 minute' },
                    { value: 5, label: '5 min (Default)' },
                    { value: 15, label: '15 minutes' },
                  ] as const
                ).map((opt) => {
                  const active = autoLockMinutes === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAutoLockMinutes(opt.value)}
                      aria-pressed={active}
                      className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                          : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Fingerprint size={19} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#08246B] dark:text-white">
                    Fingerprint Unlock &amp; Sign-In
                  </h3>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Protected by Android Keystore hardware encryption
                  </p>
                </div>
              </div>

              {!isNativeCapacitor() ? (
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Fingerprint unlock &amp; sign-in are available when running the Android APK.
                </p>
              ) : !biometricAvailable ? (
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  No fingerprint is enrolled on this phone yet. Add a fingerprint in Android Settings → Security, then return here.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Option 1: Standalone Fingerprint App Lock */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                        Fingerprint App Lock
                      </p>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        {biometricUnlockEnabled && pinEnabled
                          ? 'Locks app on launch & after leaving (4-digit PIN works as backup)'
                          : biometricUnlockEnabled
                            ? 'Locks app on launch & after leaving using your fingerprint'
                            : 'Require your fingerprint to open the app — works with or without a PIN'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={biometricUnlockEnabled}
                      disabled={biometricBusy}
                      onClick={() => void toggleBiometricUnlock(!biometricUnlockEnabled)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                        biometricUnlockEnabled
                          ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                          : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white bg-white dark:bg-[var(--dark-surface)]'
                      }`}
                    >
                      {biometricUnlockEnabled ? 'On' : 'Off'}
                    </button>
                  </div>

                  {/* Option 2: Sign in with Fingerprint */}
                  {authUser && !isGuest && (
                    <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                            Sign in with Fingerprint
                          </p>
                          <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] break-words">
                            {isBiometricLoginForThisAccount
                              ? `Enabled for ${authUser.email}`
                              : biometricSavedLogin
                                ? `Currently linked to ${biometricSavedLogin.email} on this device`
                                : 'Sign back in after logging out with a single fingerprint touch'}
                          </p>
                        </div>
                        {isBiometricLoginForThisAccount ? (
                          <button
                            type="button"
                            disabled={biometricBusy}
                            onClick={() => void disableBiometricLogin()}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 whitespace-nowrap shrink-0 transition-colors"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={biometricBusy}
                            onClick={() => void handleEnableBiometricLoginClick()}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#08246B] hover:bg-[#0B308E] dark:bg-[#FF6A00] dark:hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                          >
                            {biometricBusy ? 'Verifying...' : 'Enable Fingerprint Sign-In'}
                          </button>
                        )}
                      </div>

                      {showBiometricPwdPrompt && !isBiometricLoginForThisAccount && (
                        <form
                          onSubmit={(e) => void handleConfirmBiometricPassword(e)}
                          className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-2.5"
                        >
                          <p className="text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            Confirm your account password once to seal it with Android Keystore fingerprint protection:
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="password"
                              autoComplete="current-password"
                              value={biometricPwd}
                              onChange={(e) => setBiometricPwd(e.target.value)}
                              placeholder="Current account password"
                              className="flex-1 min-h-[40px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="submit"
                                disabled={biometricBusy}
                                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white disabled:opacity-50"
                              >
                                {biometricBusy ? 'Saving...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowBiometricPwdPrompt(false);
                                  setBiometricPwd('');
                                  setBiometricPwdError('');
                                }}
                                className="min-h-[40px] px-3 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </form>
                      )}

                      {biometricPwdError && (
                        <p className="text-[11px] font-medium text-[#DC2626] dark:text-[#F28B82]">
                          {biometricPwdError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'sim_tariffs':
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Name your SIM slots, apply Ethiopian carrier presets, and track your 30-day ETB budget
              </p>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                {(['per-second', 'per-minute'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      triggerHaptic('tap');
                      setBillingMode(mode);
                    }}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap shrink-0 transition-colors ${
                      billingMode === mode
                        ? 'bg-[#FF6A00] text-white'
                        : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CARRIER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSim1Label(preset.simLabels.sim1Label);
                    setSim2Label(preset.simLabels.sim2Label);
                    setSim1Rate(String(preset.tariffs.sim1RatePerMin));
                    setSim2Rate(String(preset.tariffs.sim2RatePerMin));
                    setBillingMode(preset.tariffs.billingMode);
                    setBudgetEtb(String(preset.tariffs.monthlyBudgetEtb));
                    setSimLabels(preset.simLabels);
                    setTariffs(preset.tariffs);
                    showNotice(`Applied ${preset.name} preset.`);
                  }}
                  className="min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] bg-[#EEF2F6]/60 dark:bg-[var(--dark-canvas)] text-left transition-colors"
                >
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    {preset.name}
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">SIM 1 Name</span>
                <input
                  type="text"
                  maxLength={40}
                  value={sim1Label}
                  onChange={(e) => setSim1Label(e.target.value)}
                  placeholder="ETC"
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-sm text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">SIM 2 Name</span>
                <input
                  type="text"
                  maxLength={40}
                  value={sim2Label}
                  onChange={(e) => setSim2Label(e.target.value)}
                  placeholder="SFC"
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-sm text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">SIM 1 (ETB/min)</span>
                <input
                  type="number"
                  min={0}
                  step="0.05"
                  value={sim1Rate}
                  onChange={(e) => setSim1Rate(e.target.value)}
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-sm font-mono tabular-nums text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">SIM 2 (ETB/min)</span>
                <input
                  type="number"
                  min={0}
                  step="0.05"
                  value={sim2Rate}
                  onChange={(e) => setSim2Rate(e.target.value)}
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-sm font-mono tabular-nums text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">30-day budget (ETB)</span>
                <input
                  type="number"
                  min={0}
                  step="10"
                  value={budgetEtb}
                  onChange={(e) => setBudgetEtb(e.target.value)}
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-sm font-mono tabular-nums text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSimLabels({ sim1Label, sim2Label });
                  setTariffs({
                    sim1RatePerMin: Math.max(0, Number(sim1Rate) || 0),
                    sim2RatePerMin: Math.max(0, Number(sim2Rate) || 0),
                    billingMode,
                    monthlyBudgetEtb: Math.max(0, Number(budgetEtb) || 0),
                  });
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
              >
                Save SIM &amp; tariff settings
              </button>
            </div>
          </div>
        );

      case 'reminders':
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Permission:{' '}
                <span className="font-semibold text-[#08246B] dark:text-white">
                  {notificationPermission === 'granted'
                    ? 'Allowed'
                    : notificationPermission === 'denied'
                      ? 'Blocked — enable in Phone Settings → Apps → Call Analyzer → Notifications'
                      : notificationPermission === 'unsupported'
                        ? 'Update APK native plugin or browser unavailable'
                        : 'Not requested yet'}
                </span>
              </p>

              <div className="w-full sm:w-auto min-w-0 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAlertSetup()}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0 transition-colors"
                >
                  {notificationPermission === 'granted' ? 'Send test alert' : 'Allow Notifications'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelayedTestNotification()}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] whitespace-nowrap shrink-0 transition-colors"
                >
                  Test notification (10s)
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    notificationsEnabled
                      ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                      : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white'
                  }`}
                >
                  Alerts: {notificationsEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Quick Callback Delay
                </span>
                <div className="flex flex-wrap gap-1">
                  {CALLBACK_DELAY_OPTIONS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        setReminderPrefs({ ...reminderPrefs, callbackDelayMinutes: mins })
                      }
                      className={`min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors ${
                        reminderPrefs.callbackDelayMinutes === mins
                          ? 'bg-[#FF6A00] text-white'
                          : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Birthday &amp; Holiday Notice
                </span>
                <div className="flex flex-wrap gap-1">
                  {EVENT_LEAD_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setReminderPrefs({ ...reminderPrefs, eventLeadDays: days })}
                      className={`min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors ${
                        reminderPrefs.eventLeadDays === days
                          ? 'bg-[#FF6A00] text-white'
                          : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {days === 0 ? 'Same day' : `${days}d`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Quiet Contact Threshold
                </span>
                <div className="flex flex-wrap gap-1">
                  {QUIET_DAYS_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() =>
                        setReminderPrefs({ ...reminderPrefs, quietContactDays: days })
                      }
                      className={`min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors ${
                        reminderPrefs.quietContactDays === days
                          ? 'bg-[#FF6A00] text-white'
                          : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    Missed-Call Reminder Notification
                  </p>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Exact alert after 5, 7 or 10 minutes if a missed call isn&apos;t returned (works when app is closed)
                  </p>
                </div>
                <div className="w-full sm:w-auto min-w-0 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setReminderPrefs({
                        ...reminderPrefs,
                        missedCallReminderEnabled: !reminderPrefs.missedCallReminderEnabled,
                      })
                    }
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                      reminderPrefs.missedCallReminderEnabled
                        ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                        : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white'
                    }`}
                  >
                    {reminderPrefs.missedCallReminderEnabled ? 'Missed Alerts: On' : 'Missed Alerts: Off'}
                  </button>

                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                    {MISSED_CALL_REMINDER_DELAYS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        disabled={!reminderPrefs.missedCallReminderEnabled}
                        onClick={() =>
                          setReminderPrefs({
                            ...reminderPrefs,
                            missedCallReminderDelayMinutes: mins,
                          })
                        }
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors disabled:opacity-50 ${
                          reminderPrefs.missedCallReminderDelayMinutes === mins
                            ? 'bg-[#FF6A00] text-white'
                            : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/70 dark:bg-[var(--dark-canvas)] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    Only remind for saved contacts
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Skip missed-call reminder notifications for unknown numbers not in your saved contacts
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(reminderPrefs.onlySavedContactsReminder)}
                  aria-label="Only remind for saved contacts"
                  onClick={() =>
                    setReminderPrefs({
                      ...reminderPrefs,
                      onlySavedContactsReminder: !reminderPrefs.onlySavedContactsReminder,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                    reminderPrefs.onlySavedContactsReminder
                      ? 'bg-[#FF6A00] border-[#FF6A00]'
                      : 'bg-[#DDE4EA] dark:bg-[var(--dark-elevated)] border-[#CBD5E1] dark:border-[var(--dark-border)]'
                  }`}
                >
                  <span
                    className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${
                      reminderPrefs.onlySavedContactsReminder ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/70 dark:bg-[var(--dark-canvas)] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    Weekly reconnect goal
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    How many quiet contacts to catch up with each week (1–14)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    {WEEKLY_GOAL_PRESETS.map((goal) => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() =>
                          setReminderPrefs({ ...reminderPrefs, weeklyReconnectGoal: goal })
                        }
                        className={`min-h-[32px] px-2.5 rounded-lg text-xs font-mono font-semibold tabular-nums transition-colors ${
                          weeklyGoal === goal
                            ? 'bg-[#FF6A00] text-white'
                            : 'bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                        }`}
                      >
                        {goal}/wk
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                    <button
                      type="button"
                      disabled={weeklyGoal <= 1}
                      onClick={() =>
                        setReminderPrefs({
                          ...reminderPrefs,
                          weeklyReconnectGoal: Math.max(1, weeklyGoal - 1),
                        })
                      }
                      aria-label="Decrease weekly reconnect goal"
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center text-[#08246B] dark:text-white disabled:opacity-40"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="px-2 text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                      {weeklyGoal}
                    </span>
                    <button
                      type="button"
                      disabled={weeklyGoal >= 14}
                      onClick={() =>
                        setReminderPrefs({
                          ...reminderPrefs,
                          weeklyReconnectGoal: Math.min(14, weeklyGoal + 1),
                        })
                      }
                      aria-label="Increase weekly reconnect goal"
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center text-[#08246B] dark:text-white disabled:opacity-40"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <div>
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    Alert Types &amp; Bell Badge
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Choose which alerts trigger notifications. Only Missed calls and Scheduled calls show in the main Bell badge.
                  </p>
                </div>
                <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/70 dark:bg-[var(--dark-canvas)] overflow-hidden">
                  {ALERT_TYPE_OPTIONS.map((item) => {
                    const enabled =
                      item.key === 'longGapCalls'
                        ? alertTypePrefs.longGapCalls !== false
                        : Boolean(alertTypePrefs[item.key]);
                    return (
                      <div
                        key={item.key}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                            {item.label}
                          </p>
                          <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            {item.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`Toggle ${item.label} alerts`}
                          onClick={() =>
                            setAlertTypePrefs({
                              ...alertTypePrefs,
                              [item.key]: !enabled,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                            enabled
                              ? 'bg-[#FF6A00] border-[#FF6A00]'
                              : 'bg-[#DDE4EA] dark:bg-[var(--dark-elevated)] border-[#CBD5E1] dark:border-[var(--dark-border)]'
                          }`}
                        >
                          <span
                            className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${
                              enabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                  {alertTypePrefs.longGapCalls !== false && (
                    <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-white/60 dark:bg-[var(--dark-surface)]/40">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                          Long-gap call threshold
                        </p>
                        <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          Trigger Back in Touch alerts when someone calls after this many days
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {LONG_GAP_DAY_OPTIONS.map((days) => {
                          const activeDays = alertTypePrefs.longGapDays ?? 30;
                          return (
                            <button
                              key={days}
                              type="button"
                              onClick={() =>
                                setAlertTypePrefs({
                                  ...alertTypePrefs,
                                  longGapDays: days,
                                })
                              }
                              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors ${
                                activeDays === days
                                  ? 'bg-[#FF6A00] text-white'
                                  : 'bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                              }`}
                            >
                              {days}d
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {onOpenAndroidSetup && (isNativeCapacitor() || hasNativeCallLogSyncPlugin()) && (
                <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                      Android Permissions &amp; Battery Optimization
                    </p>
                    <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      Manage Call Log access, Exact Alarms, and Tecno/Infinix/itel/Xiaomi/Samsung Autostart settings
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenAndroidSetup}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] text-xs font-semibold text-[#08246B] dark:text-white whitespace-nowrap shrink-0 transition-colors"
                  >
                    Permissions &amp; Battery Setup
                  </button>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                  Overnight Quiet Hours
                </p>
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Silence device notification popups during sleep hours
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setReminderPrefs({
                      ...reminderPrefs,
                      quietHoursEnabled: !reminderPrefs.quietHoursEnabled,
                    })
                  }
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                    reminderPrefs.quietHoursEnabled
                      ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                      : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white'
                  }`}
                >
                  {reminderPrefs.quietHoursEnabled ? 'Quiet Hours: On' : 'Quiet Hours: Off'}
                </button>
                {reminderPrefs.quietHoursEnabled && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <CustomSelect
                      ariaLabel="Quiet hours start"
                      value={String(reminderPrefs.quietStartHour)}
                      variant="inset"
                      compact
                      options={HOURS.map((h) => ({
                        value: String(h),
                        label: `${String(h).padStart(2, '0')}:00`,
                      }))}
                      onChange={(val) =>
                        setReminderPrefs({
                          ...reminderPrefs,
                          quietStartHour: Number(val),
                        })
                      }
                    />
                    <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">to</span>
                    <CustomSelect
                      ariaLabel="Quiet hours end"
                      value={String(reminderPrefs.quietEndHour)}
                      variant="inset"
                      compact
                      options={HOURS.map((h) => ({
                        value: String(h),
                        label: `${String(h).padStart(2, '0')}:00`,
                      }))}
                      onChange={(val) =>
                        setReminderPrefs({
                          ...reminderPrefs,
                          quietEndHour: Number(val),
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'calendar':
        return (
          <div className="space-y-3">
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Choose default calendar language, Ge&apos;ez numerals, and header date style
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Calendar Language
                </span>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                  {(['english', 'amharic'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setCalendarPrefs({ ...calendarPrefs, defaultLang: lang })}
                      className={`flex-1 min-h-[38px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        calendarPrefs.defaultLang === lang
                          ? 'bg-[#FF6A00] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {lang === 'english' ? 'English' : 'አማርኛ'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Day Numerals
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarPrefs({
                      ...calendarPrefs,
                      defaultGeezNumerals: !calendarPrefs.defaultGeezNumerals,
                    })
                  }
                  className={`w-full min-h-[48px] px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                    calendarPrefs.defaultGeezNumerals
                      ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                      : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white bg-[#EEF2F6]/60 dark:bg-[var(--dark-canvas)]'
                  }`}
                >
                  <span>Ge&apos;ez Numerals (፩፪፫)</span>
                  <span>{calendarPrefs.defaultGeezNumerals ? 'On' : 'Off'}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Header Date Format
                </span>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                  {([
                    { key: 'ec-first', label: 'EC only' },
                    { key: 'both', label: 'EC + GC' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setCalendarPrefs({ ...calendarPrefs, dateDisplay: opt.key })}
                      className={`flex-1 min-h-[38px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        calendarPrefs.dateDisplay === opt.key
                          ? 'bg-[#FF6A00] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'backup':
        return (
          <div className="space-y-5">
            {/* Phone Contacts & Birthdays */}
            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                    <Contact size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#08246B] dark:text-white">
                      Phone Contacts &amp; Birthdays
                    </h3>
                    <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                      {contactCount} saved contacts · {birthdayCount} birthdays tracked
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenReminders}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Bell size={14} className="text-[#FF6A00]" />
                  Wishes &amp; Alerts
                </button>
              </div>

              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Once Contacts permission is granted on Android, your phonebook syncs automatically on launch and resume (including multiple numbers under one contact). You can also refresh immediately, pick individual contacts, or import .vcf / CSV files — stored strictly on your device.
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                {canSyncAllPhoneContacts() && (
                  <button
                    type="button"
                    disabled={syncingPhoneContacts}
                    onClick={() => void handleLoadAllPhoneContacts()}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <RefreshCw size={15} className={syncingPhoneContacts ? 'animate-spin' : ''} />
                    {syncingPhoneContacts ? 'Loading phone contacts...' : 'Load all phone contacts'}
                  </button>
                )}

                <button
                  type="button"
                  disabled={syncingPhoneContacts}
                  onClick={() => void handlePhoneContactsPick()}
                  className={
                    canSyncAllPhoneContacts()
                      ? 'min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors'
                      : 'min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors'
                  }
                >
                  <Contact size={15} />
                  {isContactPickerSupported() ? 'Pick from phone contacts' : 'Phone contact picker'}
                </button>

                <button
                  type="button"
                  onClick={triggerContactsFileImport}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Upload size={15} />
                  Import Contacts (.vcf / .csv)
                </button>
              </div>
            </div>

            {/* Import & Export */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#08246B] dark:text-white">
                    Import &amp; Export Call History &amp; Backups
                  </h3>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                    {calls.length} call{calls.length === 1 ? '' : 's'} currently stored
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Smartphone size={18} />
                </div>
              </div>

              {!canSyncPhoneCalls && (
                <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  <Smartphone size={15} className="text-[#FF6A00] mt-0.5 shrink-0" />
                  <span>
                    <span className="font-semibold text-[#08246B] dark:text-white">
                      Android-only auto-sync:
                    </span>{' '}
                    Automatic call-log fetching works on Android only. Use CSV, JSON, or TXT import on Web and iOS.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={triggerCallImport}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Upload size={15} />
                  Import CSV / JSON / TXT
                </button>

                <button
                  type="button"
                  disabled={calls.length === 0}
                  onClick={async () => {
                    try {
                      const delivery = await downloadTextFile(
                        'call-log-export.csv',
                        callsToCsv(calls),
                        'text/csv;charset=utf-8',
                        'Call Log Export (CSV)',
                      );
                      showNotice(
                        delivery === 'native'
                          ? 'CSV saved to Downloads & ready to share.'
                          : 'CSV exported.',
                      );
                    } catch {
                      showNotice('Could not export CSV report.');
                    }
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Download size={15} />
                  Export CSV
                </button>

                <button
                  type="button"
                  disabled={
                    calls.length === 0 &&
                    contactCount === 0 &&
                    scheduledCalls.length === 0 &&
                    customTags.length === 0 &&
                    pointsHistory.length === 0 &&
                    badges.length === 0 &&
                    contactMilestones.length === 0
                  }
                  onClick={async () => {
                    try {
                      const jsonBackup = buildVersionedBackupJson({
                        calls,
                        tags: customTags,
                        contacts: Object.values(contacts),
                        settings: {
                          tariffs,
                          simLabels,
                          calendarPrefs,
                          reminderPrefs,
                          alertTypePrefs,
                          voiceBundles,
                          notificationsEnabled,
                          themePreference,
                          fontSizeScale,
                          fontFamily,
                          profileName,
                          expandedSettingsSections,
                        },
                        streaks,
                        score,
                        pointsHistory,
                        badges,
                        contactMilestones,
                        scheduledCalls,
                        favorites: Array.from(favorites),
                        dismissedMissedIds: Array.from(dismissedMissedIds),
                        mutedAlertKeys,
                        wishTemplates,
                        sentWishes,
                        snoozedQuietUntil,
                        reconnectProgress,
                      });
                      const delivery = await downloadTextFile(
                        'call-analyzer-backup.json',
                        jsonBackup,
                        'application/json;charset=utf-8',
                        'Call Analyzer Backup (JSON)',
                      );
                      showNotice(
                        delivery === 'native'
                          ? 'Versioned backup (.json) saved to Downloads & ready to share.'
                          : 'Versioned backup (.json) exported.',
                      );
                    } catch {
                      showNotice('Could not export JSON backup.');
                    }
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Download size={15} />
                  Export Backup (.json)
                </button>

                <button
                  type="button"
                  disabled={calls.length === 0 || exportingPdf}
                  onClick={async () => {
                    setExportingPdf(true);
                    try {
                      const delivery = await exportCallHistoryPdfReport({
                        calls,
                        tariffs,
                        simLabels,
                      });
                      showNotice(
                        delivery === 'native'
                          ? 'PDF saved to Downloads & ready to share.'
                          : 'Formatted PDF report with charts exported.',
                      );
                    } catch {
                      showNotice('Could not generate PDF report.');
                    } finally {
                      setExportingPdf(false);
                    }
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#08246B] hover:bg-[#0D328E] dark:bg-[#FF6A00] dark:hover:bg-[#E65F00] disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <FileDown size={15} />
                  {exportingPdf ? 'Generating PDF...' : 'Export PDF Report'}
                </button>

                <button
                  type="button"
                  disabled={calls.length === 0}
                  onClick={async () => {
                    try {
                      const delivery = await downloadTextFile(
                        'call-statement.html',
                        callsToHtmlReport(calls, tariffs, simLabels),
                        'text/html;charset=utf-8',
                        'Call Statement Report',
                      );
                      showNotice(
                        delivery === 'native'
                          ? 'Statement (.html) saved to Downloads & ready to share.'
                          : 'Printable statement (.html) exported.',
                      );
                    } catch {
                      showNotice('Could not export HTML statement.');
                    }
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <FileText size={15} className="text-[#FF6A00]" />
                  Export Statement (.html)
                </button>
              </div>

              {calls.length > 0 && (
                <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Remove all call records belonging to this account
                  </span>
                  {!confirmClear ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Trash2 size={15} />
                      Clear history
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="min-h-[40px] px-3 rounded-xl text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearCalls();
                          setConfirmClear(false);
                        }}
                        className="min-h-[40px] px-3.5 rounded-xl bg-[#DC2626] text-xs font-semibold text-white whitespace-nowrap shrink-0"
                      >
                        Confirm clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {authUser && (
                <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-[200px] flex-1">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                      Delete all my data on this device
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      Permanently erases your calls, contacts, schedules, streaks, score, badges, wishes, and PIN from this device. Signing out keeps your local data intact.
                    </p>
                  </div>
                  {!confirmDeleteAll ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAll(true)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DC2626]/40 text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Trash2 size={15} />
                      Delete all my data on this device
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAll(false)}
                        className="min-h-[44px] px-3 rounded-xl text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteAllLocalData();
                          setConfirmDeleteAll(false);
                        }}
                        className="min-h-[44px] px-3.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
                      >
                        Yes, delete all local data
                      </button>
                    </div>
                  )}
                </div>
              )}

              {authUser && (
                <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-[200px] flex-1">
                      <p className="text-xs font-semibold text-[#DC2626] dark:text-[#F28B82]">
                        Delete my account permanently
                      </p>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Permanently removes your Firebase account, cloud preferences, and all local data on this device. This cannot be undone.
                      </p>
                    </div>
                    {!confirmDeleteAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteAccount(true);
                          setDeleteAccountPassword('');
                          setDeleteAccountError('');
                        }}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DC2626]/50 text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <Trash2 size={15} />
                        Delete account
                      </button>
                    )}
                  </div>

                  {confirmDeleteAccount && (
                    <div className="rounded-xl bg-[#FEE2E2]/60 dark:bg-[#EF4444]/10 border border-[#FCA5A5] dark:border-[#EF4444]/35 p-3.5 space-y-2.5">
                      <p className="text-xs font-semibold text-[#991B1B] dark:text-[#FCA5A5]">
                        {authProvider === 'google'
                          ? 'You will be asked to confirm your Google account before permanent deletion.'
                          : 'Enter your account password to confirm permanent account deletion:'}
                      </p>
                      {authProvider !== 'google' && (
                        <input
                          type="password"
                          autoComplete="current-password"
                          value={deleteAccountPassword}
                          onChange={(e) => setDeleteAccountPassword(e.target.value)}
                          placeholder="Current account password"
                          className="w-full min-h-[42px] rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#DC2626]"
                        />
                      )}
                      {deleteAccountError && (
                        <p className="text-xs font-medium text-[#DC2626] dark:text-[#FCA5A5]">
                          {deleteAccountError}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={deleteAccountBusy}
                          onClick={() => {
                            setConfirmDeleteAccount(false);
                            setDeleteAccountPassword('');
                            setDeleteAccountError('');
                          }}
                          className="min-h-[42px] px-3.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deleteAccountBusy}
                          onClick={async () => {
                            setDeleteAccountError('');
                            setDeleteAccountBusy(true);
                            try {
                              const res = await deleteUserAccount(
                                authProvider === 'google' ? undefined : deleteAccountPassword,
                              );
                              if (!res.ok) {
                                setDeleteAccountError(
                                  res.error || 'Could not delete account right now.',
                                );
                                return;
                              }
                              setConfirmDeleteAccount(false);
                              setDeleteAccountPassword('');
                            } finally {
                              setDeleteAccountBusy(false);
                            }
                          }}
                          className="min-h-[42px] px-4 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 text-xs font-semibold text-white whitespace-nowrap transition-colors"
                        >
                          {deleteAccountBusy ? 'Deleting account...' : 'Permanently delete account'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-full sm:basis-auto">
                <BrandLogo size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-xs font-bold text-[#08246B] dark:text-white">
                      {APP_NAME}
                    </h3>
                    <span className="text-[10px] font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00]">
                      v{APP_VERSION} · build {APP_VERSION_CODE}
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {APP_RELEASE_LABEL}
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-auto min-w-0 flex flex-wrap items-center gap-2">
                {onCheckForUpdates && (
                  <button
                    type="button"
                    disabled={checkingUpdate}
                    onClick={async () => {
                      setCheckingUpdate(true);
                      try {
                        await onCheckForUpdates();
                      } finally {
                        setCheckingUpdate(false);
                      }
                    }}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] hover:border-[#FF6A00] disabled:opacity-50 text-xs font-semibold text-[#08246B] dark:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <RefreshCw size={14} className={`text-[#FF6A00] ${checkingUpdate ? 'animate-spin' : ''}`} />
                    {checkingUpdate ? 'Checking...' : 'Check Updates'}
                  </button>
                )}
                {onOpenWhatsNew && (
                  <button
                    type="button"
                    onClick={onOpenWhatsNew}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] hover:border-[#FF6A00] text-xs font-semibold text-[#08246B] dark:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <FlaticonIcon name="fi-rr-rocket-lunch" className="text-[14px] text-[#FF6A00]" />
                    What&apos;s New
                  </button>
                )}
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <PlayCircle size={14} />
                    Launch App Guide
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {APP_FEATURES.map((feat) => (
                <div
                  key={feat.title}
                  className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 space-y-0.5"
                >
                  <p className="text-[11px] font-semibold text-[#08246B] dark:text-white flex items-center gap-1.5 leading-tight">
                    <CheckCircle2 size={12} className="text-[#FF6A00] shrink-0" />
                    <span>{feat.title}</span>
                  </p>
                  <p className="text-[10px] leading-snug text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {feat.detail}
                  </p>
                </div>
              ))}
            </div>

            {onOpenHelpSupport && (
              <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-[#08246B] dark:text-white">
                    Help Bot &amp; Admin Support
                  </p>
                  <span className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Offline guide or direct chat
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenHelpSupport('bot')}
                    className="min-h-[46px] rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] px-3 py-2 flex items-center gap-2.5 text-left transition-colors group"
                  >
                    <span className="w-8 h-8 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                      <FlaticonIcon name="fi-rr-chatbot-speech-bubble" className="text-[16px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-[#08246B] dark:text-white group-hover:text-[#FF6A00] transition-colors">
                        App Helper Bot
                      </p>
                      <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                        Interactive FAQ &amp; quick guide
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenHelpSupport('admin')}
                    className="min-h-[46px] rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] px-3 py-2 flex items-center gap-2.5 text-left transition-colors group"
                  >
                    <span className="w-8 h-8 rounded-lg bg-[#EEF2F6] dark:bg-[#08246B]/35 text-[#08246B] dark:text-[#7FA6FF] flex items-center justify-center shrink-0">
                      <FlaticonIcon name="fi-rr-user-headset" className="text-[16px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-[#08246B] dark:text-white group-hover:text-[#FF6A00] transition-colors">
                        Chat with Admin
                      </p>
                      <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                        Direct support chat
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-[#08246B] dark:text-white">
                  Contact &amp; Community
                </p>
                <span className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Support &amp; APK updates
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={`mailto:${APP_CONTACT_EMAIL}`}
                  className="min-h-[44px] rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] px-3 py-2 flex items-center justify-between gap-2 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                      <Mail size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Email
                      </p>
                      <p className="text-[11px] font-semibold text-[#08246B] dark:text-white truncate">
                        {APP_CONTACT_EMAIL}
                      </p>
                    </div>
                  </div>
                  <ExternalLink
                    size={13}
                    className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] group-hover:text-[#FF6A00] shrink-0 transition-colors"
                  />
                </a>

                <a
                  href={APP_TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] px-3 py-2 flex items-center justify-between gap-2 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[#EEF2F6] dark:bg-[#08246B]/35 text-[#08246B] dark:text-[#7FA6FF] flex items-center justify-center shrink-0">
                      <Send size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Telegram Channel
                      </p>
                      <p className="text-[11px] font-semibold text-[#08246B] dark:text-white truncate">
                        {APP_TELEGRAM_HANDLE}
                      </p>
                    </div>
                  </div>
                  <ExternalLink
                    size={13}
                    className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] group-hover:text-[#FF6A00] shrink-0 transition-colors"
                  />
                </a>
              </div>
            </div>

            <div className="rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-2.5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-start gap-2 min-w-[200px] flex-1">
                <Info size={14} className="text-[#FF6A00] mt-0.5 shrink-0" />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[#08246B] dark:text-white leading-tight">
                    Privacy &amp; Device Storage
                  </p>
                  <p className="text-[10px] leading-snug text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {APP_PRIVACY_NOTE}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPrivacyPolicyOpen(true)}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[11px] font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <ShieldCheck size={13} className="text-[#10B981]" />
                  Privacy Policy
                </button>
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="min-h-[36px] px-2.5 py-1 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[11px] font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <HelpCircle size={13} className="text-[#FF6A00]" />
                    How it works
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      case 'score_badges':
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,.txt,text/csv,application/json,text/plain"
        className="hidden"
        onChange={handleImport}
      />
      <input
        ref={contactsFileInputRef}
        type="file"
        accept=".vcf,.csv,text/vcard,text/x-vcard,text/csv"
        className="hidden"
        onChange={handleContactsFileImport}
      />

      <div>
        <h1 className="text-xl font-bold text-[#08246B] dark:text-white">Settings</h1>
        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
          Manage your account, preferences, alerts, and local backups
        </p>
      </div>

      {/* Pinned Card 1: Account & Cloud Sync */}
      <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex items-start gap-3.5 min-w-0">
          {effectivePhotoUrl ? (
            <img
              src={effectivePhotoUrl}
              alt={effectiveDisplayName}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover border border-[#DDE4EA] dark:border-[var(--dark-border)] shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              <Cloud size={22} />
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-[#08246B] dark:text-white truncate">
              {authLoading
                ? 'Checking account...'
                : authUser
                  ? effectiveDisplayName
                  : isGuest
                    ? 'Guest Mode (Sample Preview)'
                    : 'Sign in required'}
            </h2>
            <p className="text-xs leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              {authUser ? (
                <>
                  <span className="font-medium text-[#08246B] dark:text-white/90 break-all sm:break-normal">
                    {authUser.email}
                  </span>
                  {userPhone ? ` · ${userPhone}` : ''}
                  {authProvider ? ` · ${authProvider === 'google' ? 'Google' : 'Email'}` : ''}
                  {' · '}
                  {syncStatus === 'syncing'
                    ? 'Syncing...'
                    : syncStatus === 'error'
                      ? 'Sync attention needed'
                      : lastSyncedAt
                        ? `Synced ${formatTime(lastSyncedAt)}`
                        : 'Preferences cloud sync active'}
                  {' · Calls & contacts stay local on this device'}
                </>
              ) : isGuest ? (
                'Viewing sample calls & contacts. Login or create an account to import your own data and sync preferences.'
              ) : (
                'Sign in or create an account to access your private calls, contacts, schedules, and settings.'
              )}
            </p>
          </div>
        </div>

        <div
          className={
            authUser
              ? 'pt-1 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2'
              : 'pt-1 flex flex-wrap items-center gap-2'
          }
        >
          {authUser ? (
            <>
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Edit3 size={14} />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => void handleShareMyContact()}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Share2 size={14} className="text-[#FF6A00]" />
                Share Contact
              </button>
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={syncStatus === 'syncing'}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                Sync now
              </button>
              <button
                type="button"
                onClick={() => void signOutAccount()}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={authLoading}
                onClick={() => openAuthPrompt('signin')}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <LogIn size={15} />
                Login
              </button>
              <button
                type="button"
                disabled={authLoading}
                onClick={() => openAuthPrompt('signup')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <UserPlus size={15} />
                Create Account
              </button>
              {isGuest && (
                <button
                  type="button"
                  onClick={exitGuestMode}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white whitespace-nowrap shrink-0 transition-colors"
                >
                  Exit Guest
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Collapsible Card 2: General Score & Badges */}
      {!isGuest && authUser && (() => {
        const topContact = topContactStatuses[0] ?? null;
        const activeContactCount = topContactStatuses.filter((c) => c.currentStreak > 0).length;
        const milestoneContactsCount = topContactStatuses.filter((c) => c.longestStreak >= 3).length;
        const topContactName = topContact
          ? formatDisplayNameOrPhone(topContact.displayName, topContact.number)
          : '';
        const scoreMatchesSearch =
          isSearching &&
          ('general score & badges streaks points badges'.includes(normalizedQuery) ||
            sectionSummaries.score_badges.toLowerCase().includes(normalizedQuery));
        const isScoreOpen = scoreMatchesSearch || expandedSettingsSections.includes('score_badges');

        if (isSearching && !scoreMatchesSearch) return null;

        return (
          <section className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (isSearching) {
                  setSettingsQuery('');
                  if (!expandedSettingsSections.includes('score_badges')) {
                    setExpandedSettingsSections([...expandedSettingsSections, 'score_badges']);
                  }
                  return;
                }
                toggleSection('score_badges');
              }}
              aria-expanded={isScoreOpen}
              aria-controls="settings-section-score_badges"
              className="w-full min-h-[60px] px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F8FAFC] dark:hover:bg-[var(--dark-elevated-60)] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Trophy size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                    General Score &amp; Badges
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate tabular-nums">
                    {sectionSummaries.score_badges}
                  </p>
                </div>
              </div>
              <ChevronDown
                size={17}
                className={`text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0 transition-transform duration-200 ${
                  isScoreOpen ? 'rotate-180 text-[#FF6A00]' : ''
                }`}
              />
            </button>

            <AnimatePresence initial={false}>
              {isScoreOpen && (
                <motion.div
                  id="settings-section-score_badges"
                  key="section-body-score_badges"
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0.1 : 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="overflow-hidden"
                >
                  <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Stored locally in IndexedDB · East Africa Time (UTC+3)
                      </p>
                      <div className="w-full sm:w-auto min-w-0 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            const rebuilt = rebuildScore();
                            showNotice(`Score rebuilt: ${rebuilt} pts.`, 'success');
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <RefreshCw size={13} className="text-[#FF6A00]" />
                          Rebuild
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            setAchievementsTab('general');
                            setAchievementsOpen(true);
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <Award size={14} />
                          View History &amp; Badges
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                        <p className="text-lg font-mono font-bold tabular-nums text-[#FF6A00]">
                          {score}
                        </p>
                        <p className="text-[11px] font-semibold text-[#08246B] dark:text-white">
                          General Score (pts)
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                        <p className="text-lg font-mono font-bold tabular-nums text-[#08246B] dark:text-white flex items-center justify-center gap-1">
                          <Flame size={15} className="text-[#FF6A00]" />
                          <span>{effectiveStreaks.currentStreak}d</span>
                        </p>
                        <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          Daily Streak (Best {effectiveStreaks.longestStreak}d)
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                        <p className="text-lg font-mono font-bold tabular-nums text-[#10B981]">
                          {badges.length}/{BADGE_DEFINITIONS.length}
                        </p>
                        <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          General Badges
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BADGE_DEFINITIONS.map((def) => {
                        const earned = badges.some((b) => b.id === def.id);
                        return (
                          <div
                            key={def.id}
                            className={`rounded-xl border px-3 py-2 flex items-center gap-2 min-w-0 ${
                              earned
                                ? 'bg-[#FFF0E6]/65 dark:bg-[#FF6A00]/12 border-[#FF6A00]/40 text-[#08246B] dark:text-white'
                                : 'bg-[#EEF2F6]/60 dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] opacity-75'
                            }`}
                          >
                            {earned ? (
                              <Award size={14} className="text-[#FF6A00] shrink-0" />
                            ) : (
                              <Lock size={13} className="text-[#8A93A0] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">{def.title}</p>
                              <p className="text-[10px] truncate opacity-80">{def.requirementLabel}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#FF6A00] flex items-center justify-center shrink-0 mt-0.5">
                          <Users size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                            Contact Streaks &amp; Badges
                          </p>
                          {topContact ? (
                            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums truncate">
                              Status with {topContactName}:{' '}
                              <span className="font-semibold text-[#FF6A00]">
                                {topContact.statusHeadline}
                              </span>{' '}
                              · {topContact.contactScore} pts · {activeContactCount} active ·{' '}
                              {milestoneContactsCount} reached 3d+
                            </p>
                          ) : (
                            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              Connect with any contact on consecutive EAT days to unlock 3d–365d badges.
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('tap');
                          setAchievementsTab('contacts');
                          setAchievementsOpen(true);
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors tabular-nums"
                      >
                        <Users size={13} className="text-[#FF6A00]" />
                        <span>Contact Streaks ({topContactStatuses.length})</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      Points: +{POINTS_CONFIG.DAILY_FIRST_OPEN} daily open · +{POINTS_CONFIG.QUICK_MISSED_CALLBACK} quick callback (&le;{reminderPrefs.missedCallReminderDelayMinutes}m) · +{POINTS_CONFIG.CALL_TAG_OR_NOTE} tag/note · +{POINTS_CONFIG.STREAK_MILESTONE_BONUS} at 7/30/100d streaks + contact 3d–365d milestones.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })()}

      {/* Search & Collapse All Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
          />
          <input
            type="search"
            value={settingsQuery}
            onChange={(e) => setSettingsQuery(e.target.value)}
            placeholder="Search settings (PIN, SIM, reminders, backup...)"
            aria-label="Search settings"
            className="w-full min-h-[42px] pl-9 pr-9 py-2 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] dark:placeholder:text-[var(--dark-text-muted)] focus:outline-none focus:border-[#FF6A00]"
          />
          {settingsQuery && (
            <button
              type="button"
              onClick={() => setSettingsQuery('')}
              aria-label="Clear settings search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] flex items-center justify-center text-[#8A93A0] hover:text-[#08246B] dark:hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {(expandedSettingsSections.length > 0 || isSearching) && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('tap');
              setSettingsQuery('');
              setExpandedSettingsSections([]);
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] whitespace-nowrap shrink-0 transition-colors"
          >
            Collapse all
          </button>
        )}
      </div>

      {/* Collapsible Accordion Sections */}
      {visibleSections.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-[#08246B] dark:text-white">
            No matching settings
          </p>
          <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            Try searching for PIN, SIM, reminders, calendar, backup, or updates.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleSections.map((sec) => {
            const Icon = sec.icon;
            const isOpen = isSearching || expandedSettingsSections.includes(sec.id);
            return (
              <section
                key={sec.id}
                className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isSearching) {
                      setSettingsQuery('');
                      if (!expandedSettingsSections.includes(sec.id)) {
                        setExpandedSettingsSections([...expandedSettingsSections, sec.id]);
                      }
                      return;
                    }
                    toggleSection(sec.id);
                  }}
                  aria-expanded={isOpen}
                  aria-controls={`settings-section-${sec.id}`}
                  className="w-full min-h-[60px] px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F8FAFC] dark:hover:bg-[var(--dark-elevated-60)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                        {sec.title}
                      </h2>
                      <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate tabular-nums">
                        {sectionSummaries[sec.id]}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={17}
                    className={`text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#FF6A00]' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`settings-section-${sec.id}`}
                      key={`section-body-${sec.id}`}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{
                        duration: prefersReducedMotion ? 0.1 : 0.2,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)]">
                        {renderSectionBody(sec.id)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      )}

      <ProfileEditModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />

      <ImportPreviewModal
        pending={pendingImport}
        onClose={() => setPendingImport(null)}
        onConfirm={handleConfirmImport}
      />

      <AchievementsModal
        open={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        initialTab={achievementsTab}
        onSelectContact={onSelectContact}
      />

      <PrivacyPolicyModal
        open={privacyPolicyOpen}
        onClose={() => setPrivacyPolicyOpen(false)}
      />
    </div>
  );
}
