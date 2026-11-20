import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Bell,
  Calendar,
  CheckCircle2,
  Cloud,
  Contact,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  HelpCircle,
  Info,
  Lock,
  LogIn,
  LogOut,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Signal,
  Smartphone,
  Trash2,
  Upload,
  User,
  UserPlus,
} from 'lucide-react';
import { BrandLogo } from '@/src/components/BrandLogo';
import { CategoryPanel, CategoryTabs } from '@/src/components/CategoryTabs';
import { CustomSelect } from '@/src/components/CustomSelect';
import { DarkModeToggle } from '@/src/components/DarkModeToggle';
import { PWAInstallButton } from '@/src/components/PWAInstallButton';
import {
  APP_FEATURES,
  APP_NAME,
  APP_PRIVACY_NOTE,
  APP_RELEASE_LABEL,
  APP_VERSION,
} from '@/src/lib/appInfo';
import {
  isContactPickerSupported,
  parseCsvContacts,
  parseVCardContacts,
  pickPhoneContacts,
  readUploadedTextFile,
} from '@/src/lib/contacts';
import { CARRIER_PRESETS } from '@/src/lib/ethiopia';
import { callsToCsv, callsToHtmlReport, callsToJson, downloadTextFile } from '@/src/lib/export';
import { formatTime } from '@/src/lib/format';
import { isHapticsEnabled, setHapticsEnabledStorage, triggerHaptic } from '@/src/lib/haptics';
import { parseCallImport } from '@/src/lib/import';
import { exportCallHistoryPdfReport } from '@/src/lib/pdfExport';
import { useCalls } from '@/src/store/CallsContext';

const CALLBACK_DELAY_OPTIONS = [15, 30, 60, 120];
const EVENT_LEAD_OPTIONS = [0, 3, 7, 14];
const QUIET_DAYS_OPTIONS = [14, 30, 45];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

type SettingsCategory = 'profile' | 'security' | 'sim' | 'alerts' | 'import-export';

const SETTINGS_CATEGORIES: Array<{
  key: SettingsCategory;
  label: string;
  heading: string;
  description: string;
  icon: typeof User;
}> = [
  {
    key: 'profile',
    label: 'General',
    heading: 'General, Appearance & About',
    description: 'Account sync, theme style, app install, version & features',
    icon: User,
  },
  {
    key: 'security',
    label: 'Security',
    heading: 'App Lock PIN & Privacy Mode',
    description: '4-digit app lock PIN and private note masking',
    icon: ShieldCheck,
  },
  {
    key: 'sim',
    label: 'SIMs',
    heading: 'SIM Labels, Tariffs & Monthly Budget',
    description: 'Ethio Telecom & Safaricom presets, rates, and monthly budget',
    icon: Signal,
  },
  {
    key: 'alerts',
    label: 'Alerts',
    heading: 'Reminders & Ethiopian Calendar',
    description: 'Ethiopian calendar defaults, reminders, and quiet hours',
    icon: Bell,
  },
  {
    key: 'import-export',
    label: 'Backup',
    heading: 'Contacts & Call History Backup',
    description: 'Phone contacts (.vcf / .csv) and call log backup files',
    icon: ArrowUpDown,
  },
];

export function SettingsTab({
  onOpenReminders,
  onOpenGuide,
}: {
  onOpenReminders: () => void;
  onOpenGuide?: () => void;
}) {
  const {
    calls,
    contacts,
    tariffs,
    setTariffs,
    simLabels,
    setSimLabels,
    calendarPrefs,
    setCalendarPrefs,
    reminderPrefs,
    setReminderPrefs,
    theme,
    themePreference,
    systemIsDark,
    preferredDarkVariant,
    setThemeMode,
    setPreferredDarkVariant,
    toggleTheme,
    profileName,
    setProfileName,
    notificationsEnabled,
    setNotificationsEnabled,
    privacyMode,
    togglePrivacyMode,
    pinEnabled,
    setAppPin,
    clearAppPin,
    lockApp,
    authUser,
    authLoading,
    isGuest,
    authProvider,
    userPhone,
    passwordHint,
    openAuthPrompt,
    exitGuestMode,
    syncStatus,
    lastSyncedAt,
    signOutAccount,
    syncNow,
    importCalls,
    importContactProfiles,
    loadSampleData,
    clearCalls,
    showNotice,
  } = useCalls();

  const [draftName, setDraftName] = useState(profileName);
  const [sim1Label, setSim1Label] = useState(simLabels.sim1Label);
  const [sim2Label, setSim2Label] = useState(simLabels.sim2Label);
  const [sim1Rate, setSim1Rate] = useState(String(tariffs.sim1RatePerMin));
  const [sim2Rate, setSim2Rate] = useState(String(tariffs.sim2RatePerMin));
  const [budgetEtb, setBudgetEtb] = useState(String(tariffs.monthlyBudgetEtb));
  const [billingMode, setBillingMode] = useState(tariffs.billingMode);

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('profile');

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => isHapticsEnabled());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contactsFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(profileName);
  }, [profileName]);

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
      const result = parseCallImport(text, file.name);
      if (result.calls.length === 0) {
        showNotice(result.problems[0] ?? 'No valid calls found.');
        return;
      }
      const counts = importCalls(result.calls);
      showNotice(
        `Imported ${counts.added} call${counts.added === 1 ? '' : 's'}${
          counts.duplicates > 0 ? ` · ${counts.duplicates} duplicates skipped` : ''
        }`,
      );
    } catch {
      showNotice('Could not read the selected file.');
    }
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

  const handleBrowserNotifySetup = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showNotice('Browser notifications are unavailable here; in-app reminders stay active.');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    if (perm === 'granted') {
      setNotificationsEnabled(true);
      new Notification('Call Analyzer - ETH', {
        body: 'Callback, birthday, and Ethiopian holiday alerts are active.',
      });
      showNotice('Browser alerts enabled and test sent.');
    } else {
      showNotice('Browser notification permission is blocked in browser settings.');
    }
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
  const browserNotifyPermission =
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported';

  const activeMeta =
    SETTINGS_CATEGORIES.find((cat) => cat.key === activeCategory) ?? SETTINGS_CATEGORIES[0];

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
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

      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-bold text-[#08246B] dark:text-white">Settings</h1>
          <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            {activeMeta.description}
          </p>
        </div>

        <CategoryTabs
          items={SETTINGS_CATEGORIES}
          activeKey={activeCategory}
          onChange={setActiveCategory}
          ariaLabel="Settings categories"
        />
      </div>

      <CategoryPanel activeKey={activeCategory} label={activeMeta.heading}>
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-bold text-[#08246B] dark:text-white">
            {activeMeta.heading}
          </h2>
        </div>
        {activeCategory === 'profile' && (
            <>
              {/* Account & Cloud Sync */}
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {authUser?.photoURL ? (
              <img
                src={authUser.photoURL}
                alt={authUser.displayName || 'Account avatar'}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border border-[#DDE4EA] dark:border-[var(--dark-border)] shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                <Cloud size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white break-words">
                {authLoading
                  ? 'Checking account...'
                  : authUser
                    ? authUser.displayName || authUser.email || 'Signed-in Account'
                    : isGuest
                      ? 'Guest Mode (Sample Preview)'
                      : 'Sign in required'}
              </h2>
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] break-words">
                {authUser ? (
                  <>
                    {authUser.email}
                    {userPhone ? ` · ${userPhone}` : ''}
                    {authProvider ? ` · ${authProvider === 'google' ? 'Google' : 'Email'}` : ''}
                    {' · '}
                    {syncStatus === 'syncing'
                      ? 'Syncing...'
                      : syncStatus === 'error'
                        ? 'Sync attention needed'
                        : lastSyncedAt
                          ? `Synced ${formatTime(lastSyncedAt)}`
                          : 'Cloud sync active'}
                    {' · All data & contacts belong to this account'}
                  </>
                ) : isGuest ? (
                  'Viewing sample calls & contacts. Login or create an account to import your own data and save across devices.'
                ) : (
                  'Sign in or create an account to access your private calls, contacts, schedules, and settings.'
                )}
              </p>
              {authUser && passwordHint && (
                <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] mt-1">
                  Password hint: <span className="font-medium text-[#08246B] dark:text-white">{passwordHint}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {authUser ? (
              <>
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  disabled={syncStatus === 'syncing'}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                  Sync now
                </button>
                <button
                  type="button"
                  onClick={() => void signOutAccount()}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
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
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <LogIn size={15} />
                  Login
                </button>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => openAuthPrompt('signup')}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <UserPlus size={15} />
                  Create Account
                </button>
                {isGuest && (
                  <button
                    type="button"
                    onClick={exitGuestMode}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white whitespace-nowrap shrink-0 transition-colors"
                  >
                    Exit Guest
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Appearance & Display Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">Appearance</h2>
            <div className="flex items-center gap-1.5" aria-label="Brand and theme colors">
              <span className="w-4 h-4 rounded-full bg-[#111214] border border-[#DDE4EA] dark:border-white/30" title="System Dark #111214" />
              <span className="w-4 h-4 rounded-full bg-[#08246B] border border-[#DDE4EA] dark:border-white/30" title="Navy #08246B" />
              <span className="w-4 h-4 rounded-full bg-[#FF6A00]" title="Orange #FF6A00" />
              <span className="w-4 h-4 rounded-full bg-white border border-[#DDE4EA]" title="White #FFFFFF" />
            </div>
          </div>

          <div className="flex items-center gap-3 pb-2 border-b border-[#DDE4EA] dark:border-[var(--dark-border)]">
            <BrandLogo size={38} />
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
            isDark={theme === 'dark' || theme === 'dark-gray'}
            onToggle={toggleTheme}
            label={
              themePreference === 'system'
                ? `Auto · ${systemIsDark ? (preferredDarkVariant === 'dark' ? 'Dark Navy' : 'OLED Dark') : 'Bright'}`
                : theme === 'dark-gray'
                  ? 'OLED Dark Active'
                  : theme === 'dark'
                    ? 'Dark Navy Active'
                    : 'Bright Mode Active'
            }
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Theme Style
              </span>
              {themePreference === 'system' && (
                <span className="text-[11px] font-medium text-[#FF6A00]">
                  Following device ({systemIsDark ? 'Dark' : 'Light'})
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
              {(
                [
                  { key: 'system', label: 'Auto' },
                  { key: 'light', label: 'Bright' },
                  { key: 'dark-gray', label: 'OLED Dark' },
                  { key: 'dark', label: 'Dark Navy' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setThemeMode(opt.key)}
                  className={`min-h-[38px] px-1.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors ${
                    themePreference === opt.key
                      ? 'bg-[#FF6A00] text-white'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {themePreference === 'system' && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Dark mode palette
                </span>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]">
                  {(
                    [
                      { key: 'dark-gray', label: 'OLED Dark' },
                      { key: 'dark', label: 'Dark Navy' },
                    ] as const
                  ).map((variant) => (
                    <button
                      key={variant.key}
                      type="button"
                      onClick={() => setPreferredDarkVariant(variant.key)}
                      className={`min-h-[30px] px-2.5 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        preferredDarkVariant === variant.key
                          ? 'bg-[#FF6A00] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {variant.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                Vibration Feedback
              </p>
              <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Subtle haptic pulse when logging calls, toggling, or saving changes
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
                  : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white bg-[#EEF2F6] dark:bg-[var(--dark-canvas)]'
              }`}
            >
              {hapticsEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">Display Name</h2>
          <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            Used for personalized greeting and synced across devices when signed in
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Your name (optional)"
              className="flex-1 min-w-0 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
            />
            <button
              type="button"
              onClick={() => setProfileName(draftName)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Install App on Phone (PWA) */}
      <PWAInstallButton variant="card" />

      {/* About App, Version & Features */}
      <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-[#08246B] dark:text-white">
                  {APP_NAME}
                </h2>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00]">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                {APP_RELEASE_LABEL}
              </p>
            </div>
          </div>

          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <PlayCircle size={15} />
              Launch App Guide
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {APP_FEATURES.map((feat) => (
            <div
              key={feat.title}
              className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 space-y-1"
            >
              <p className="text-xs font-semibold text-[#08246B] dark:text-white flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-[#FF6A00] shrink-0" />
                <span>{feat.title}</span>
              </p>
              <p className="text-[11px] leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                {feat.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Info size={16} className="text-[#FF6A00] mt-0.5 shrink-0" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                Privacy &amp; Account Ownership
              </p>
              <p className="text-[11px] leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                {APP_PRIVACY_NOTE}
              </p>
            </div>
          </div>

          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <HelpCircle size={14} className="text-[#FF6A00]" />
              How it works
            </button>
          )}
        </div>
      </div>
            </>
          )}

          {activeCategory === 'security' && (
            <>
              {/* Security & Privacy Mode */}
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                App Lock PIN & Privacy Mode
              </h2>
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Hide private call and contact notes on shared screens or lock the app with a 4-digit PIN
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={togglePrivacyMode}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              privacyMode
                ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                : 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]'
            }`}
          >
            {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
            Privacy Mode: {privacyMode ? 'On' : 'Off'}
          </button>
        </div>

        <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                4-Digit App Lock PIN · {pinEnabled ? 'Active on this device' : 'Not set'}
              </p>
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Requires PIN when opening the app on this device
              </p>
            </div>
            {pinEnabled && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={lockApp}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Lock size={13} />
                  Lock now
                </button>
                <button
                  type="button"
                  onClick={clearAppPin}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 whitespace-nowrap shrink-0 transition-colors"
                >
                  Remove PIN
                </button>
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
              aria-label="New 4-digit PIN"
              className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm font-mono tracking-widest text-[#08246B] dark:text-white placeholder:text-[#8A93A0] placeholder:tracking-normal focus:outline-none focus:border-[#FF6A00]"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Confirm PIN"
              aria-label="Confirm 4-digit PIN"
              className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm font-mono tracking-widest text-[#08246B] dark:text-white placeholder:text-[#8A93A0] placeholder:tracking-normal focus:outline-none focus:border-[#FF6A00]"
            />
            <button
              type="button"
              onClick={() => void handleSavePin()}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0 transition-colors"
            >
              {pinEnabled ? 'Update PIN' : 'Enable PIN'}
            </button>
          </div>
        </div>
      </div>
            </>
          )}

          {activeCategory === 'sim' && (
            <>
              {/* Ethio Telecom & Safaricom SIM Presets & Tariffs */}
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
              Ethio Telecom & Safaricom SIM Presets & Tariffs
            </h2>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Name your SIM slots, apply Ethiopian carrier presets, and track your 30-day ETB budget
            </p>
          </div>
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
              placeholder="Ethio Telecom"
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
              placeholder="Safaricom Ethiopia"
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
            Save SIM & tariff settings
          </button>
        </div>
      </div>
            </>
          )}

          {activeCategory === 'alerts' && (
            <>
              {/* Ethiopian Calendar & Language Defaults */}
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
              Ethiopian Calendar & Amharic Defaults
            </h2>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Choose default calendar language, Ge&apos;ez numerals, and header date style
            </p>
          </div>
        </div>

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

      {/* Reminders & Browser Notifications */}
      <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              <Bell size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Reminder Timing & Browser Notifications
              </h2>
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Browser status: {browserNotifyPermission === 'granted' ? 'Allowed' : browserNotifyPermission === 'denied' ? 'Blocked' : browserNotifyPermission === 'default' ? 'Not requested yet' : 'In-app only'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleBrowserNotifySetup()}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0 transition-colors"
            >
              {browserNotifyPermission === 'granted' ? 'Send test alert' : 'Enable browser alerts'}
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
              Birthday & Holiday Notice
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

        <div className="pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#08246B] dark:text-white">
              Overnight Quiet Hours
            </p>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Silence browser notification popups during sleep hours
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
            </>
          )}

          {activeCategory === 'import-export' && (
            <>
              {/* Phone Contacts Sync */}
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              <Contact size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                Phone Contacts & Birthdays
              </h2>
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                {contactCount} saved contacts · {birthdayCount} birthdays tracked
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenReminders}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Bell size={14} className="text-[#FF6A00]" />
            Wishes & Alerts
          </button>
        </div>

        <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
          Fetch caller names, phone numbers, birthdays, and tags (Family, Friends, Coworkers) from Android Chrome&apos;s Contact Picker or import a phone contacts .vcf / CSV export.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handlePhoneContactsPick()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Contact size={15} />
            {isContactPickerSupported() ? 'Pick from phone contacts' : 'Phone contact picker'}
          </button>

          <button
            type="button"
            onClick={triggerContactsFileImport}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Upload size={15} />
            Import Contacts (.vcf / .csv)
          </button>
        </div>
      </div>

      {/* Import & Export */}
      <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
              Import & Export Call History
            </h2>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
              {calls.length} call{calls.length === 1 ? '' : 's'} currently stored
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
            <Smartphone size={18} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={triggerCallImport}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Upload size={15} />
            Import CSV / JSON
          </button>

          <button
            type="button"
            onClick={() => {
              const counts = loadSampleData();
              showNotice(
                counts.added > 0
                  ? `Loaded ${counts.added} sample calls.`
                  : 'Sample calls are already loaded.',
              );
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] whitespace-nowrap shrink-0 transition-colors"
          >
            Load sample data
          </button>

          <button
            type="button"
            disabled={calls.length === 0}
            onClick={() => {
              downloadTextFile('call-log-export.csv', callsToCsv(calls), 'text/csv;charset=utf-8');
              showNotice('CSV exported.');
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download size={15} />
            Export CSV
          </button>

          <button
            type="button"
            disabled={calls.length === 0}
            onClick={() => {
              downloadTextFile(
                'call-log-export.json',
                callsToJson(calls),
                'application/json;charset=utf-8',
              );
              showNotice('JSON exported.');
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download size={15} />
            Export JSON
          </button>

          <button
            type="button"
            disabled={calls.length === 0 || exportingPdf}
            onClick={async () => {
              setExportingPdf(true);
              try {
                await exportCallHistoryPdfReport({
                  calls,
                  tariffs,
                  simLabels,
                  privacyMode,
                });
                showNotice('Formatted PDF report with charts exported.');
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
            onClick={() => {
              downloadTextFile(
                'call-statement.html',
                callsToHtmlReport(calls, tariffs, simLabels),
                'text/html;charset=utf-8',
              );
              showNotice('Printable statement (.html) exported.');
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileText size={15} className="text-[#FF6A00]" />
            Export Statement (.html)
          </button>
        </div>

        {calls.length > 0 && (
          <div className="pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-3">
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
      </div>
            </>
          )}
      </CategoryPanel>
    </div>
  );
}
