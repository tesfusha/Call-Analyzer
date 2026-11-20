import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  cancelNativeNotification,
  fetchNativeRecentCalls,
  getNativeNotificationPermission,
  hasNativeCallLogPlugin,
  hasNativeGoogleAuth,
  hasNativeNotificationsPlugin,
  isNativeCapacitor,
  requestNativeNotificationPermission,
  runNativeGoogleSignIn,
  runNativeSignOut,
  scheduleNativeNotification,
  showNativeNotification,
  subscribeNativeCallLog,
  syncNativeStatusBar,
} from '@/src/lib/capacitor';
import {
  buildSampleContactProfiles,
  decodeIfQuotedPrintableText,
  getContactKey,
} from '@/src/lib/contacts';
import {
  DEFAULT_SIM_LABELS,
  DEFAULT_TARIFFS,
  DEFAULT_VOICE_BUNDLES,
  formatCarrierShort,
  normaliseEthPhone,
  type TariffConfig,
} from '@/src/lib/ethiopia';
import {
  OperationType,
  auth,
  clampStr,
  db,
  googleProvider,
  handleFirestoreError,
  toFirestoreDocId,
} from '@/src/lib/firebase';
import { buildSampleCalls, makeCallId } from '@/src/lib/import';
import { isWithinQuietHours } from '@/src/lib/reminders';
import { hashPin, verifyPin } from '@/src/lib/security';
import { triggerHaptic, type HapticKind } from '@/src/lib/haptics';
import type {
  AuthProviderType,
  CalendarPrefs,
  CallDirection,
  CallPatch,
  CallRecord,
  ContactProfile,
  RegisteredUserRecord,
  ReminderPrefs,
  ScheduledCall,
  SimLabels,
  SimSlot,
  VoiceBundleSlot,
  VoiceBundles,
} from '@/src/types/call';

const THEME_KEY = 'callanalyzer.theme.v3';
const LEGACY_THEME_KEY = 'callanalyzer.theme.v2';
const LEGACY_PREFERRED_DARK_THEME_KEY = 'callanalyzer.preferredDarkTheme.v1';
const FONT_SCALE_KEY = 'callanalyzer.fontSize.v1';
const ADMIN_EMAIL = 'tesfutilahun33@gmail.com';

const LEGACY_UNSCOPED_KEYS = [
  'callanalyzer.calls.v1',
  'callanalyzer.favorites.v1',
  'callanalyzer.profile.v1',
  'callanalyzer.tariffs.v1',
  'callanalyzer.dismissedMissed.v1',
  'callanalyzer.contacts.v1',
  'callanalyzer.notifications.v1',
  'callanalyzer.scheduledCalls.v1',
  'callanalyzer.simLabels.v1',
  'callanalyzer.calendarPrefs.v1',
  'callanalyzer.reminderPrefs.v1',
  'callanalyzer.privacyMode.v1',
  'callanalyzer.pinHash.v1',
  'callanalyzer.voiceBundles.v1',
  'callanalyzer.welcomeDismissed.v2',
] as const;

const SCOPED_SUFFIXES = [
  'calls',
  'contacts',
  'scheduledCalls',
  'favorites',
  'dismissedMissed',
  'tariffs',
  'simLabels',
  'calendarPrefs',
  'reminderPrefs',
  'voiceBundles',
  'profile',
  'notifications',
  'privacyMode',
  'pinHash',
  'welcomeDismissed',
  'pendingRegistration',
] as const;

function userStorageKey(uid: string, suffix: (typeof SCOPED_SUFFIXES)[number]): string {
  return `callanalyzer.u.${uid}.${suffix}`;
}

export type ThemePreference = 'system' | 'light' | 'dark-gray';
export type ThemeMode = 'light' | 'dark-gray';
export type FontSizeScale = 'default' | 'large' | 'xlarge';
export type NotificationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';
export type SyncStatus = 'signed-out' | 'guest' | 'unverified' | 'syncing' | 'synced' | 'error';
export type AuthPromptMode = 'closed' | 'signin' | 'signup';

export type CreateAccountInput = {
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  passwordHint: string;
  agreedToTerms: boolean;
};

export type AuthActionResult = {
  ok: boolean;
  error?: string;
};

type PendingRegistration = {
  phone: string;
  passwordHint: string;
  termsAccepted: boolean;
  termsAcceptedAt: number;
};

function detectAuthProvider(user: User): AuthProviderType {
  return user.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'password';
}

function mapFirebaseAuthError(error: unknown, fallback: string): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Check your details or use Forgot password.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled yet in Firebase Console Authentication.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/network-request-failed':
      return isNativeCapacitor()
        ? 'Network error connecting to Firebase. Check your Wi-Fi/mobile data and confirm INTERNET permission is enabled in the APK.'
        : 'Network error. Check your connection and try again.';
    default:
      return fallback;
  }
}

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  defaultLang: 'english',
  defaultGeezNumerals: false,
  dateDisplay: 'ec-first',
};

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  callbackDelayMinutes: 15,
  eventLeadDays: 7,
  quietContactDays: 30,
  quietHoursEnabled: false,
  quietStartHour: 22,
  quietEndHour: 7,
};

export type ImportCounts = {
  added: number;
  duplicates: number;
};

export type ScheduleCallInput = {
  number: string;
  name?: string | null;
  scheduledFor: number;
  note?: string | null;
  sourceCallId?: string | null;
};

type CallsContextValue = {
  calls: CallRecord[];
  contacts: Record<string, ContactProfile>;
  scheduledCalls: ScheduledCall[];
  favorites: Set<string>;
  dismissedMissedIds: Set<string>;
  tariffs: TariffConfig;
  simLabels: SimLabels;
  calendarPrefs: CalendarPrefs;
  reminderPrefs: ReminderPrefs;
  voiceBundles: VoiceBundles;
  theme: ThemeMode;
  themePreference: ThemePreference;
  systemIsDark: boolean;
  fontSizeScale: FontSizeScale;
  setFontSizeScale: (scale: FontSizeScale) => void;
  profileName: string;
  notificationsEnabled: boolean;
  notificationPermission: NotificationPermissionStatus;
  refreshNotificationPermission: () => Promise<NotificationPermissionStatus>;
  requestAlertPermissions: () => Promise<NotificationPermissionStatus>;
  sendTestAlertNotification: (customBody?: string) => Promise<boolean>;
  privacyMode: boolean;
  pinEnabled: boolean;
  isLocked: boolean;
  authUser: User | null;
  authLoading: boolean;
  isGuest: boolean;
  needsEmailVerification: boolean;
  authProvider: AuthProviderType | null;
  userPhone: string | null;
  passwordHint: string | null;
  authPromptMode: AuthPromptMode;
  authPromptReason: string | null;
  openAuthPrompt: (mode?: 'signin' | 'signup', reason?: string) => void;
  closeAuthPrompt: () => void;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  isAdmin: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  notice: string | null;
  showNotice: (msg: string, haptic?: HapticKind | false) => void;
  signInWithGoogle: () => Promise<AuthActionResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  createAccountWithEmail: (input: CreateAccountInput) => Promise<AuthActionResult>;
  resendVerificationEmail: () => Promise<AuthActionResult>;
  checkEmailVerification: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  signOutAccount: () => Promise<void>;
  syncNow: () => Promise<void>;
  canSyncPhoneCalls: boolean;
  syncPhoneCalls: (options?: { fullResync?: boolean }) => Promise<void>;
  fetchRegisteredUsers: () => Promise<RegisteredUserRecord[]>;
  setAppPin: (pin: string) => Promise<void>;
  clearAppPin: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  setPrivacyMode: (enabled: boolean) => void;
  togglePrivacyMode: () => void;
  importCalls: (records: CallRecord[]) => ImportCounts;
  loadSampleData: () => ImportCounts;
  patchCall: (id: string, patch: CallPatch) => void;
  removeCall: (id: string) => void;
  clearCalls: () => void;
  mergeContacts: (sourceNumber: string, targetNumber: string, targetName: string) => void;
  upsertContactProfile: (profile: ContactProfile) => void;
  removeContactProfile: (keyOrNumber: string) => void;
  importContactProfiles: (profiles: ContactProfile[]) => { added: number; updated: number };
  getContactProfile: (number: string) => ContactProfile | null;
  scheduleCall: (input: ScheduleCallInput) => ScheduledCall;
  completeScheduledCall: (id: string) => void;
  snoozeScheduledCall: (id: string, minutes: number) => void;
  removeScheduledCall: (id: string) => void;
  dismissMissedCall: (id: string) => void;
  setTariffs: (next: TariffConfig) => void;
  setSimLabels: (next: SimLabels) => void;
  setCalendarPrefs: (next: CalendarPrefs) => void;
  setReminderPrefs: (next: ReminderPrefs) => void;
  setVoiceBundles: (next: VoiceBundles) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  toggleFavorite: (number: string) => void;
  setThemeMode: (mode: ThemePreference) => void;
  toggleTheme: () => void;
};

const CallsContext = createContext<CallsContextValue | null>(null);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function removeStorageKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function clearLegacyUnscopedKeys() {
  LEGACY_UNSCOPED_KEYS.forEach(removeStorageKey);
}

function clearUserScopedStorage(uid: string) {
  SCOPED_SUFFIXES.forEach((suffix) => removeStorageKey(userStorageKey(uid, suffix)));
}

type ScopedUserSnapshot = {
  calls: CallRecord[];
  contacts: Record<string, ContactProfile>;
  scheduledCalls: ScheduledCall[];
  favoritesArray: string[];
  dismissedMissedArray: string[];
  tariffs: TariffConfig;
  simLabels: SimLabels;
  calendarPrefs: CalendarPrefs;
  reminderPrefs: ReminderPrefs;
  voiceBundles: VoiceBundles;
  profileName: string;
  notificationsEnabled: boolean;
  privacyMode: boolean;
  pinHash: string;
};

function createEmptySnapshot(): ScopedUserSnapshot {
  return {
    calls: [],
    contacts: {},
    scheduledCalls: [],
    favoritesArray: [],
    dismissedMissedArray: [],
    tariffs: { ...DEFAULT_TARIFFS },
    simLabels: { ...DEFAULT_SIM_LABELS },
    calendarPrefs: { ...DEFAULT_CALENDAR_PREFS },
    reminderPrefs: { ...DEFAULT_REMINDER_PREFS },
    voiceBundles: sanitizeVoiceBundles(DEFAULT_VOICE_BUNDLES),
    profileName: '',
    notificationsEnabled: true,
    privacyMode: false,
    pinHash: '',
  };
}

function readScopedUserState(uid: string): ScopedUserSnapshot {
  const rawContacts = readJson<Record<string, ContactProfile>>(userStorageKey(uid, 'contacts'), {});
  const healedContacts: Record<string, ContactProfile> = {};
  Object.entries(rawContacts).forEach(([k, profile]) => {
    healedContacts[k] = healContactProfile(profile);
  });

  return {
    calls: readJson<CallRecord[]>(userStorageKey(uid, 'calls'), []).map(healCallRecord),
    contacts: healedContacts,
    scheduledCalls: readJson<ScheduledCall[]>(userStorageKey(uid, 'scheduledCalls'), []).map(
      healScheduledCall,
    ),
    favoritesArray: readJson<string[]>(userStorageKey(uid, 'favorites'), []),
    dismissedMissedArray: readJson<string[]>(userStorageKey(uid, 'dismissedMissed'), []),
    tariffs: sanitizeTariffs({
      ...DEFAULT_TARIFFS,
      ...readJson<Partial<TariffConfig>>(userStorageKey(uid, 'tariffs'), {}),
    }),
    simLabels: sanitizeSimLabels({
      ...DEFAULT_SIM_LABELS,
      ...readJson<Partial<SimLabels>>(userStorageKey(uid, 'simLabels'), {}),
    }),
    calendarPrefs: sanitizeCalendarPrefs({
      ...DEFAULT_CALENDAR_PREFS,
      ...readJson<Partial<CalendarPrefs>>(userStorageKey(uid, 'calendarPrefs'), {}),
    }),
    reminderPrefs: sanitizeReminderPrefs({
      ...DEFAULT_REMINDER_PREFS,
      ...readJson<Partial<ReminderPrefs>>(userStorageKey(uid, 'reminderPrefs'), {}),
    }),
    voiceBundles: sanitizeVoiceBundles(
      readJson<Partial<VoiceBundles>>(userStorageKey(uid, 'voiceBundles'), DEFAULT_VOICE_BUNDLES),
    ),
    profileName: readJson<string>(userStorageKey(uid, 'profile'), ''),
    notificationsEnabled: readJson<boolean>(userStorageKey(uid, 'notifications'), true),
    privacyMode: readJson<boolean>(userStorageKey(uid, 'privacyMode'), false),
    pinHash: readJson<string>(userStorageKey(uid, 'pinHash'), ''),
  };
}

function sanitizeTariffs(t: TariffConfig): TariffConfig {
  return {
    sim1RatePerMin: Math.max(0, Math.min(1000, Number(t.sim1RatePerMin) || 0)),
    sim2RatePerMin: Math.max(0, Math.min(1000, Number(t.sim2RatePerMin) || 0)),
    billingMode: t.billingMode === 'per-minute' ? 'per-minute' : 'per-second',
    monthlyBudgetEtb: Math.max(0, Math.min(1000000, Number(t.monthlyBudgetEtb) || 0)),
  };
}

function sanitizeSimLabels(s: SimLabels): SimLabels {
  return {
    sim1Label: clampStr(formatCarrierShort(s.sim1Label.trim() || 'SIM 1'), 40),
    sim2Label: clampStr(formatCarrierShort(s.sim2Label.trim() || 'SIM 2'), 40),
  };
}

function sanitizeCalendarPrefs(c: CalendarPrefs): CalendarPrefs {
  return {
    defaultLang: c.defaultLang === 'amharic' ? 'amharic' : 'english',
    defaultGeezNumerals: Boolean(c.defaultGeezNumerals),
    dateDisplay: c.dateDisplay === 'both' ? 'both' : 'ec-first',
  };
}

function sanitizeReminderPrefs(r: ReminderPrefs): ReminderPrefs {
  const startRaw = Number(r.quietStartHour);
  const endRaw = Number(r.quietEndHour);
  return {
    callbackDelayMinutes: Math.max(5, Math.min(1440, Math.round(Number(r.callbackDelayMinutes) || 15))),
    eventLeadDays: Math.max(0, Math.min(60, Math.round(Number(r.eventLeadDays) || 7))),
    quietContactDays: Math.max(3, Math.min(180, Math.round(Number(r.quietContactDays) || 30))),
    quietHoursEnabled: Boolean(r.quietHoursEnabled),
    quietStartHour: Math.max(0, Math.min(23, Number.isFinite(startRaw) ? Math.round(startRaw) : 22)),
    quietEndHour: Math.max(0, Math.min(23, Number.isFinite(endRaw) ? Math.round(endRaw) : 7)),
  };
}

function sanitizeVoiceBundleSlot(slot: Partial<VoiceBundleSlot> | undefined, fallback: VoiceBundleSlot): VoiceBundleSlot {
  return {
    enabled: Boolean(slot?.enabled),
    name: clampStr((slot?.name ?? fallback.name).trim(), 60),
    totalMinutes: Math.max(0, Math.min(100000, Number(slot?.totalMinutes ?? fallback.totalMinutes) || 0)),
    priceEtb: Math.max(0, Math.min(1000000, Number(slot?.priceEtb ?? fallback.priceEtb) || 0)),
    startedAt: Math.max(0, Math.round(Number(slot?.startedAt ?? fallback.startedAt) || 0)),
    expiresAt: Math.max(0, Math.round(Number(slot?.expiresAt ?? fallback.expiresAt) || 0)),
  };
}

function sanitizeVoiceBundles(vb: Partial<VoiceBundles> | undefined): VoiceBundles {
  return {
    sim1: sanitizeVoiceBundleSlot(vb?.sim1, DEFAULT_VOICE_BUNDLES.sim1),
    sim2: sanitizeVoiceBundleSlot(vb?.sim2, DEFAULT_VOICE_BUNDLES.sim2),
  };
}

function serializeCallForFirestore(uid: string, call: CallRecord) {
  const docId = toFirestoreDocId(call.id);
  const direction: CallDirection =
    call.direction === 'incoming' || call.direction === 'outgoing' || call.direction === 'missed'
      ? call.direction
      : 'incoming';
  return {
    id: docId,
    ownerUid: uid,
    number: clampStr(call.number.trim() || 'Unknown', 40),
    name: call.name ? clampStr(call.name, 120) : null,
    direction,
    sim: call.sim === 'SIM 1' || call.sim === 'SIM 2' ? call.sim : null,
    timestamp: Math.max(0, Math.round(Number(call.timestamp) || 0)),
    duration: Math.max(0, Math.min(864000, Math.round(Number(call.duration) || 0))),
    note: call.note ? clampStr(call.note, 500) : null,
    tag: call.tag ? clampStr(call.tag, 48) : null,
    syncedAt: serverTimestamp(),
  };
}

function serializeContactForFirestore(uid: string, profile: ContactProfile) {
  const docId = toFirestoreDocId(profile.key || getContactKey(profile.number));
  const birthday = profile.birthday
    ? {
        month: Math.max(1, Math.min(13, Math.round(profile.birthday.month))),
        day: Math.max(1, Math.min(31, Math.round(profile.birthday.day))),
        calendar: profile.birthday.calendar,
        ...(typeof profile.birthday.year === 'number'
          ? { year: Math.max(1900, Math.min(2200, Math.round(profile.birthday.year))) }
          : {}),
      }
    : null;

  const events = profile.events.slice(0, 25).map((evt) => ({
    id: clampStr(evt.id || `evt-${Date.now()}`, 80),
    title: clampStr(evt.title.trim() || 'Event', 100),
    month: Math.max(1, Math.min(13, Math.round(evt.month))),
    day: Math.max(1, Math.min(31, Math.round(evt.day))),
    calendar: evt.calendar,
    ...(typeof evt.year === 'number'
      ? { year: Math.max(1900, Math.min(2200, Math.round(evt.year))) }
      : {}),
  }));

  return {
    key: docId,
    ownerUid: uid,
    number: clampStr(profile.number.trim() || 'Unknown', 40),
    name: clampStr(profile.name, 120),
    tag: clampStr(profile.tag, 48),
    birthday,
    events,
    notes: clampStr(profile.notes, 1000),
    updatedAt: Math.max(0, Math.round(profile.updatedAt || Date.now())),
    syncedAt: serverTimestamp(),
  };
}

function serializeScheduledCallForFirestore(uid: string, item: ScheduledCall) {
  const docId = toFirestoreDocId(item.id);
  return {
    id: docId,
    ownerUid: uid,
    number: clampStr(item.number.trim() || 'Unknown', 40),
    name: item.name ? clampStr(item.name, 120) : null,
    scheduledFor: Math.max(0, Math.round(item.scheduledFor)),
    note: item.note ? clampStr(item.note, 500) : null,
    sourceCallId: item.sourceCallId ? clampStr(item.sourceCallId, 128) : null,
    status: item.status,
    notifiedAt: typeof item.notifiedAt === 'number' ? Math.max(0, Math.round(item.notifiedAt)) : null,
    createdAt: Math.max(0, Math.round(item.createdAt || Date.now())),
    syncedAt: serverTimestamp(),
  };
}

function healCallRecord(call: CallRecord): CallRecord {
  const name = call.name ? decodeIfQuotedPrintableText(call.name) : null;
  const note = call.note ? decodeIfQuotedPrintableText(call.note) : null;
  const tag = call.tag ? decodeIfQuotedPrintableText(call.tag) : null;
  if (name === call.name && note === call.note && tag === call.tag) return call;
  return { ...call, name, note, tag };
}

function healContactProfile(profile: ContactProfile): ContactProfile {
  const name = decodeIfQuotedPrintableText(profile.name);
  const tag = decodeIfQuotedPrintableText(profile.tag);
  const notes = decodeIfQuotedPrintableText(profile.notes);
  if (name === profile.name && tag === profile.tag && notes === profile.notes) return profile;
  return { ...profile, name, tag, notes };
}

function healScheduledCall(item: ScheduledCall): ScheduledCall {
  const name = item.name ? decodeIfQuotedPrintableText(item.name) : null;
  const note = item.note ? decodeIfQuotedPrintableText(item.note) : null;
  if (name === item.name && note === item.note) return item;
  return { ...item, name, note };
}

export function CallsProvider({ children }: { children: ReactNode }) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [contacts, setContacts] = useState<Record<string, ContactProfile>>({});
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [favoritesArray, setFavoritesArray] = useState<string[]>([]);
  const [dismissedMissedArray, setDismissedMissedArray] = useState<string[]>([]);
  const [tariffs, setTariffsState] = useState<TariffConfig>({ ...DEFAULT_TARIFFS });
  const [simLabels, setSimLabelsState] = useState<SimLabels>({ ...DEFAULT_SIM_LABELS });
  const [calendarPrefs, setCalendarPrefsState] = useState<CalendarPrefs>({
    ...DEFAULT_CALENDAR_PREFS,
  });
  const [reminderPrefs, setReminderPrefsState] = useState<ReminderPrefs>({
    ...DEFAULT_REMINDER_PREFS,
  });
  const [voiceBundles, setVoiceBundlesState] = useState<VoiceBundles>(() =>
    sanitizeVoiceBundles(DEFAULT_VOICE_BUNDLES),
  );
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    removeStorageKey(LEGACY_THEME_KEY);
    removeStorageKey(LEGACY_PREFERRED_DARK_THEME_KEY);
    const saved = readJson<string | null>(THEME_KEY, null);
    if (saved === 'light') return 'light';
    if (saved === 'dark' || saved === 'dark-gray') return 'dark-gray';
    if (saved === 'system') return 'system';
    return 'system';
  });
  const [fontSizeScale, setFontSizeScaleState] = useState<FontSizeScale>(() => {
    try {
      const saved = localStorage.getItem(FONT_SCALE_KEY);
      if (saved === 'large' || saved === 'xlarge' || saved === 'default') return saved;
    } catch {
      // ignore
    }
    return 'default';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e?: MediaQueryListEvent) => {
      setSystemIsDark(e ? e.matches : mql.matches);
    };
    handleChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontScale = fontSizeScale;
    root.style.fontSize =
      fontSizeScale === 'xlarge' ? '19px' : fontSizeScale === 'large' ? '17.5px' : '16px';
    try {
      localStorage.setItem(FONT_SCALE_KEY, fontSizeScale);
    } catch {
      // ignore
    }
  }, [fontSizeScale]);

  const setFontSizeScale = useCallback((scale: FontSizeScale) => {
    triggerHaptic('tap');
    setFontSizeScaleState(scale);
  }, []);

  const theme: ThemeMode = useMemo(() => {
    if (themePreference === 'system') {
      return systemIsDark ? 'dark-gray' : 'light';
    }
    return themePreference;
  }, [themePreference, systemIsDark]);
  const themePreferenceRef = useRef<ThemePreference>(themePreference);
  useEffect(() => {
    themePreferenceRef.current = themePreference;
  }, [themePreference]);
  const [profileName, setProfileNameState] = useState<string>('');
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(true);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionStatus>('prompt');
  const [privacyMode, setPrivacyModeState] = useState<boolean>(false);
  const [pinHash, setPinHash] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const isGuestRef = useRef<boolean>(false);
  const [verifyRefreshKey, setVerifyRefreshKey] = useState<number>(0);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const accountMetaRef = useRef<{
    phone: string | null;
    passwordHint: string | null;
    termsAccepted: boolean | null;
    termsAcceptedAt: number | null;
  }>({
    phone: null,
    passwordHint: null,
    termsAccepted: null,
    termsAcceptedAt: null,
  });
  const [authPromptMode, setAuthPromptMode] = useState<AuthPromptMode>('closed');
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);
  const hydratedUidRef = useRef<string | null>(null);
  const workspaceReadyRef = useRef<{ uid: string; promise: Promise<void> } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('signed-out');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [noticeState, setNoticeState] = useState<{ text: string; id: number } | null>(null);
  const notice = noticeState?.text ?? null;

  useEffect(() => {
    isGuestRef.current = isGuest;
  }, [isGuest]);

  // Refs to read latest local state inside auth bootstrap & action writers
  const stateRef = useRef({
    calls,
    contacts,
    scheduledCalls,
    favoritesArray,
    dismissedMissedArray,
    tariffs,
    simLabels,
    calendarPrefs,
    reminderPrefs,
    voiceBundles,
    theme,
    profileName,
    notificationsEnabled,
    privacyMode,
  });

  useEffect(() => {
    stateRef.current = {
      calls,
      contacts,
      scheduledCalls,
      favoritesArray,
      dismissedMissedArray,
      tariffs,
      simLabels,
      calendarPrefs,
      reminderPrefs,
      voiceBundles,
      theme,
      profileName,
      notificationsEnabled,
      privacyMode,
    };
  }, [
    calls,
    contacts,
    scheduledCalls,
    favoritesArray,
    dismissedMissedArray,
    tariffs,
    simLabels,
    calendarPrefs,
    reminderPrefs,
    voiceBundles,
    theme,
    profileName,
    notificationsEnabled,
    privacyMode,
  ]);

  useEffect(() => {
    const isDark = theme === 'dark-gray';
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('dark-gray', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';

    const activeColor = isDark ? '#111214' : '#FFFFFF';
    void syncNativeStatusBar(isDark, activeColor);

    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (themePreference === 'system') {
      metas.forEach((meta) => {
        const media = meta.getAttribute('media') || '';
        if (media.includes('light')) {
          meta.setAttribute('content', '#FFFFFF');
        } else if (media.includes('dark')) {
          meta.setAttribute('content', '#111214');
        } else {
          meta.setAttribute('content', activeColor);
        }
      });
      removeStorageKey(THEME_KEY);
    } else {
      metas.forEach((meta) => {
        meta.setAttribute('content', activeColor);
      });
      writeJson(THEME_KEY, themePreference);
    }
  }, [theme, themePreference]);

  const applySnapshotToState = useCallback((snap: ScopedUserSnapshot) => {
    setCalls(snap.calls);
    setContacts(snap.contacts);
    setScheduledCalls(snap.scheduledCalls);
    setFavoritesArray(snap.favoritesArray);
    setDismissedMissedArray(snap.dismissedMissedArray);
    setTariffsState(snap.tariffs);
    setSimLabelsState(snap.simLabels);
    setCalendarPrefsState(snap.calendarPrefs);
    setReminderPrefsState(snap.reminderPrefs);
    setVoiceBundlesState(snap.voiceBundles);
    setProfileNameState(snap.profileName);
    setNotificationsEnabledState(snap.notificationsEnabled);
    setPrivacyModeState(snap.privacyMode);
    setPinHash(snap.pinHash);
    setIsLocked(Boolean(snap.pinHash));
    stateRef.current = {
      calls: snap.calls,
      contacts: snap.contacts,
      scheduledCalls: snap.scheduledCalls,
      favoritesArray: snap.favoritesArray,
      dismissedMissedArray: snap.dismissedMissedArray,
      tariffs: snap.tariffs,
      simLabels: snap.simLabels,
      calendarPrefs: snap.calendarPrefs,
      reminderPrefs: snap.reminderPrefs,
      voiceBundles: snap.voiceBundles,
      theme: stateRef.current.theme,
      profileName: snap.profileName,
      notificationsEnabled: snap.notificationsEnabled,
      privacyMode: snap.privacyMode,
    };
  }, []);

  const canPersistScoped = (uid: string | null): uid is string =>
    Boolean(uid && hydratedUidRef.current === uid && auth.currentUser?.uid === uid);

  useEffect(() => {
    if (!canPersistScoped(hydratedUid)) return;
    const uid = hydratedUid;
    const timer = window.setTimeout(() => {
      writeJson(userStorageKey(uid, 'calls'), calls);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [calls, hydratedUid]);
  useEffect(() => {
    if (!canPersistScoped(hydratedUid)) return;
    const uid = hydratedUid;
    const timer = window.setTimeout(() => {
      writeJson(userStorageKey(uid, 'contacts'), contacts);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [contacts, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'scheduledCalls'), scheduledCalls);
    }
  }, [scheduledCalls, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'favorites'), favoritesArray);
    }
  }, [favoritesArray, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'dismissedMissed'), dismissedMissedArray);
    }
  }, [dismissedMissedArray, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) writeJson(userStorageKey(hydratedUid, 'tariffs'), tariffs);
  }, [tariffs, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'simLabels'), simLabels);
    }
  }, [simLabels, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'calendarPrefs'), calendarPrefs);
    }
  }, [calendarPrefs, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'reminderPrefs'), reminderPrefs);
    }
  }, [reminderPrefs, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'voiceBundles'), voiceBundles);
    }
  }, [voiceBundles, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'profile'), profileName);
    }
  }, [profileName, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'notifications'), notificationsEnabled);
    }
  }, [notificationsEnabled, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      writeJson(userStorageKey(hydratedUid, 'privacyMode'), privacyMode);
    }
  }, [privacyMode, hydratedUid]);

  useEffect(() => {
    if (!noticeState) return;
    const timer = setTimeout(() => setNoticeState(null), 3000);
    return () => clearTimeout(timer);
  }, [noticeState]);

  const showNotice = useCallback((msg: string, haptic: HapticKind | false = 'tap') => {
    if (haptic !== false) triggerHaptic(haptic);
    setNoticeState({ text: msg, id: Date.now() + Math.random() });
  }, []);

  const syncUserRegistry = useCallback(
    async (user: User, preferredDisplayName?: string, phoneOverride?: string | null) => {
      const regRef = doc(db, 'userRegistry', user.uid);
      const displayName = clampStr(preferredDisplayName || user.displayName || '', 120);
      const email = clampStr(user.email || '', 254);
      const photoURL = user.photoURL ? clampStr(user.photoURL, 500) : null;
      const authProvider = detectAuthProvider(user);
      const cleanPhone =
        phoneOverride !== undefined
          ? phoneOverride
            ? clampStr(phoneOverride.trim(), 40)
            : null
          : accountMetaRef.current.phone;
      try {
        const regSnap = await getDoc(regRef);
        if (!regSnap.exists()) {
          await setDoc(regRef, {
            uid: user.uid,
            displayName,
            email,
            phone: cleanPhone ?? null,
            authProvider,
            photoURL,
            registeredAt: serverTimestamp(),
            lastActiveAt: serverTimestamp(),
          });
        } else {
          const existingData = regSnap.data() as Record<string, unknown>;
          const existingPhone =
            typeof existingData.phone === 'string' && existingData.phone.trim()
              ? existingData.phone
              : null;
          await updateDoc(regRef, {
            displayName,
            email,
            phone: cleanPhone ?? existingPhone ?? null,
            authProvider,
            photoURL,
            lastActiveAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `userRegistry/${user.uid}`);
      }
    },
    [],
  );

  const persistWorkspaceToCloud = useCallback(
    async (
      user: User,
      overrides?: Partial<{
        theme: ThemeMode;
        profileName: string;
        phone: string | null;
        passwordHint: string | null;
        termsAccepted: boolean;
        termsAcceptedAt: number | null;
        notificationsEnabled: boolean;
        privacyMode: boolean;
        tariffs: TariffConfig;
        simLabels: SimLabels;
        calendarPrefs: CalendarPrefs;
        reminderPrefs: ReminderPrefs;
        voiceBundles: VoiceBundles;
        favoritesArray: string[];
        dismissedMissedArray: string[];
      }>,
    ) => {
      const s = stateRef.current;
      const meta = accountMetaRef.current;
      const nextPhone = overrides?.phone !== undefined ? overrides.phone : meta.phone;
      const nextHint =
        overrides?.passwordHint !== undefined ? overrides.passwordHint : meta.passwordHint;
      const nextTermsAccepted =
        overrides?.termsAccepted !== undefined ? overrides.termsAccepted : meta.termsAccepted;
      const nextTermsAcceptedAt =
        overrides?.termsAcceptedAt !== undefined
          ? overrides.termsAcceptedAt
          : meta.termsAcceptedAt;

      const path = `users/${user.uid}`;
      try {
        setSyncStatus('syncing');
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          displayName: clampStr(
            overrides?.profileName ?? (s.profileName || user.displayName || ''),
            120,
          ),
          email: clampStr(user.email || '', 254),
          ...(nextPhone !== null ? { phone: clampStr(nextPhone, 40) } : {}),
          ...(nextHint !== null ? { passwordHint: clampStr(nextHint, 120) } : {}),
          ...(typeof nextTermsAccepted === 'boolean' ? { termsAccepted: nextTermsAccepted } : {}),
          ...(typeof nextTermsAcceptedAt === 'number'
            ? { termsAcceptedAt: Math.max(0, Math.round(nextTermsAcceptedAt)) }
            : {}),
          theme: overrides?.theme ?? s.theme,
          notificationsEnabled: overrides?.notificationsEnabled ?? s.notificationsEnabled,
          privacyMode: overrides?.privacyMode ?? s.privacyMode,
          tariffs: sanitizeTariffs(overrides?.tariffs ?? s.tariffs),
          simLabels: sanitizeSimLabels(overrides?.simLabels ?? s.simLabels),
          calendarPrefs: sanitizeCalendarPrefs(overrides?.calendarPrefs ?? s.calendarPrefs),
          reminderPrefs: sanitizeReminderPrefs(overrides?.reminderPrefs ?? s.reminderPrefs),
          voiceBundles: sanitizeVoiceBundles(overrides?.voiceBundles ?? s.voiceBundles),
          favorites: (overrides?.favoritesArray ?? s.favoritesArray)
            .slice(0, 200)
            .map((v) => clampStr(v, 128)),
          dismissedMissedIds: (overrides?.dismissedMissedArray ?? s.dismissedMissedArray)
            .slice(0, 500)
            .map((v) => clampStr(v, 128)),
          syncedAt: serverTimestamp(),
        });
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
      } catch (error) {
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [],
  );

  const commitBatchWrites = useCallback(
    async (
      writes: Array<{ pathSegments: [string, string, string, string]; data: Record<string, unknown> }>,
    ) => {
      const CHUNK = 350;
      for (let i = 0; i < writes.length; i += CHUNK) {
        const chunk = writes.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(({ pathSegments, data }) => {
          batch.set(doc(db, ...pathSegments), data);
        });
        await batch.commit();
      }
    },
    [],
  );

  const ensureWorkspaceReady = useCallback(async (uid: string) => {
    const entry = workspaceReadyRef.current;
    if (entry && entry.uid === uid) {
      await entry.promise;
    }
  }, []);

  const openAuthPrompt = useCallback((mode: 'signin' | 'signup' = 'signin', reason?: string) => {
    setAuthPromptReason(reason ?? null);
    setAuthPromptMode(mode);
  }, []);

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptMode('closed');
    setAuthPromptReason(null);
  }, []);

  const enterGuestMode = useCallback(() => {
    hydratedUidRef.current = null;
    setHydratedUid(null);
    workspaceReadyRef.current = null;
    accountMetaRef.current = {
      phone: null,
      passwordHint: null,
      termsAccepted: null,
      termsAcceptedAt: null,
    };
    setUserPhone(null);
    setPasswordHint(null);

    const sampleCalls = buildSampleCalls();
    const sampleProfiles = buildSampleContactProfiles();
    const sampleContactsMap: Record<string, ContactProfile> = {};
    sampleProfiles.forEach((profile) => {
      sampleContactsMap[profile.key] = profile;
    });
    const now = Date.now();
    const sampleSchedules: ScheduledCall[] = [
      {
        id: 'sched-sample-1',
        number: '+251911248890',
        name: 'Dawit Bekele',
        scheduledFor: now + 90 * 60_000,
        note: 'Confirm invoice payment schedule',
        status: 'pending',
        notifiedAt: null,
        createdAt: now,
      },
      {
        id: 'sched-sample-2',
        number: '+251922310442',
        name: 'Sara Tadesse',
        scheduledFor: now + 20 * 60_000,
        note: 'Return missed call about design sync',
        status: 'pending',
        notifiedAt: null,
        createdAt: now,
      },
    ];

    applySnapshotToState({
      ...createEmptySnapshot(),
      calls: sampleCalls,
      contacts: sampleContactsMap,
      scheduledCalls: sampleSchedules,
      favoritesArray: ['+251911248890', '+251922310442'],
      profileName: 'Guest Preview',
    });
    setIsGuest(true);
    setAuthPromptMode('closed');
    setAuthPromptReason(null);
    setSyncStatus('guest');
    setLastSyncedAt(null);
    showNotice('Viewing sample data in Guest mode.');
  }, [applySnapshotToState, showNotice]);

  const exitGuestMode = useCallback(() => {
    setIsGuest(false);
    setAuthPromptMode('closed');
    setAuthPromptReason(null);
    applySnapshotToState(createEmptySnapshot());
    setSyncStatus('signed-out');
    setLastSyncedAt(null);
  }, [applySnapshotToState]);

  const requireSignedInUser = useCallback(
    (actionReason?: string): User | null => {
      const user = auth.currentUser;
      if (!user || !user.emailVerified) {
        if (isGuestRef.current) {
          openAuthPrompt(
            'signin',
            actionReason ?? 'Login or create an account to save or import your own data.',
          );
        } else {
          showNotice('Sign in to your verified account to modify data.');
        }
        return null;
      }
      return user;
    },
    [openAuthPrompt, showNotice],
  );

  // Firebase Auth listener + strictly isolated UID-scoped hydration + real-time listeners
  useEffect(() => {
    let unsubWorkspace: (() => void) | null = null;
    let unsubCalls: (() => void) | null = null;
    let unsubContacts: (() => void) | null = null;
    let unsubScheduled: (() => void) | null = null;
    let cancelled = false;
    let activeRun = 0;

    const cleanupListeners = () => {
      unsubWorkspace?.();
      unsubCalls?.();
      unsubContacts?.();
      unsubScheduled?.();
      unsubWorkspace = null;
      unsubCalls = null;
      unsubContacts = null;
      unsubScheduled = null;
    };

    clearLegacyUnscopedKeys();

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      const myRun = ++activeRun;
      cleanupListeners();

      if (!user) {
        hydratedUidRef.current = null;
        setHydratedUid(null);
        workspaceReadyRef.current = null;
        accountMetaRef.current = {
          phone: null,
          passwordHint: null,
          termsAccepted: null,
          termsAcceptedAt: null,
        };
        setUserPhone(null);
        setPasswordHint(null);
        if (!isGuestRef.current) {
          applySnapshotToState(createEmptySnapshot());
          setSyncStatus('signed-out');
        }
        clearLegacyUnscopedKeys();
        setLastSyncedAt(null);
        setAuthUser(null);
        setAuthLoading(false);
        return;
      }

      if (!user.emailVerified) {
        hydratedUidRef.current = null;
        setHydratedUid(null);
        workspaceReadyRef.current = null;
        setIsGuest(false);
        setAuthPromptMode('closed');
        setAuthPromptReason(null);
        applySnapshotToState(createEmptySnapshot());
        setSyncStatus('unverified');
        setAuthUser(user);
        setAuthLoading(false);
        return;
      }

      const uid = user.uid;
      hydratedUidRef.current = null;
      setHydratedUid(null);
      setIsGuest(false);
      setAuthPromptMode('closed');
      setAuthPromptReason(null);
      clearLegacyUnscopedKeys();

      // Clear any previous/guest state first, then hydrate ONLY this logged-in user's scoped cache
      applySnapshotToState(createEmptySnapshot());
      const scoped = readScopedUserState(uid);
      applySnapshotToState(scoped);
      const pendingReg = readJson<PendingRegistration | null>(
        userStorageKey(uid, 'pendingRegistration'),
        null,
      );
      accountMetaRef.current = {
        phone: pendingReg?.phone ?? null,
        passwordHint: pendingReg?.passwordHint ?? null,
        termsAccepted: pendingReg ? pendingReg.termsAccepted : null,
        termsAcceptedAt: pendingReg ? pendingReg.termsAcceptedAt : null,
      };
      setUserPhone(pendingReg?.phone ?? null);
      setPasswordHint(pendingReg?.passwordHint ?? null);

      hydratedUidRef.current = uid;
      setHydratedUid(uid);
      setAuthUser(user);
      setAuthLoading(false);
      setSyncStatus('syncing');

      let resolveWorkspaceReady!: () => void;
      const readyPromise = new Promise<void>((resolve) => {
        resolveWorkspaceReady = resolve;
      });
      workspaceReadyRef.current = { uid, promise: readyPromise };

      let currentOp: OperationType = OperationType.GET;
      let currentPath = `users/${uid}`;

      try {
        const local = stateRef.current;
        const userDocRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userDocRef);

        if (cancelled || myRun !== activeRun) {
          resolveWorkspaceReady();
          return;
        }

        if (!userSnap.exists()) {
          currentOp = OperationType.CREATE;
          currentPath = `users/${uid}`;
          await persistWorkspaceToCloud(user, {
            profileName: local.profileName || user.displayName || '',
            ...(pendingReg
              ? {
                  phone: pendingReg.phone,
                  passwordHint: pendingReg.passwordHint,
                  termsAccepted: pendingReg.termsAccepted,
                  termsAcceptedAt: pendingReg.termsAcceptedAt,
                }
              : {}),
          });
          await syncUserRegistry(
            user,
            local.profileName || user.displayName || '',
            pendingReg?.phone ?? null,
          );
          if (pendingReg) {
            removeStorageKey(userStorageKey(uid, 'pendingRegistration'));
          }
        } else {
          const data = userSnap.data() as Record<string, unknown>;
          const mergedFavs = Array.from(
            new Set([
              ...(Array.isArray(data.favorites) ? (data.favorites as string[]) : []),
              ...local.favoritesArray,
            ]),
          ).slice(0, 200);
          const mergedDismissed = Array.from(
            new Set([
              ...(Array.isArray(data.dismissedMissedIds)
                ? (data.dismissedMissedIds as string[])
                : []),
              ...local.dismissedMissedArray,
            ]),
          ).slice(0, 500);

          const rawTheme = data.theme;
          const nextTheme: ThemeMode =
            themePreferenceRef.current !== 'system' &&
            (rawTheme === 'dark' || rawTheme === 'dark-gray' || rawTheme === 'light')
              ? rawTheme === 'light'
                ? 'light'
                : 'dark-gray'
              : local.theme;
          const nextName =
            typeof data.displayName === 'string' && data.displayName
              ? data.displayName
              : local.profileName || user.displayName || '';
          const nextNotifs =
            typeof data.notificationsEnabled === 'boolean'
              ? data.notificationsEnabled
              : local.notificationsEnabled;
          const nextPrivacy =
            typeof data.privacyMode === 'boolean' ? data.privacyMode : local.privacyMode;
          const nextTariffs =
            data.tariffs && typeof data.tariffs === 'object'
              ? sanitizeTariffs(data.tariffs as TariffConfig)
              : local.tariffs;
          const nextSimLabels =
            data.simLabels && typeof data.simLabels === 'object'
              ? sanitizeSimLabels(data.simLabels as SimLabels)
              : local.simLabels;
          const nextCalPrefs =
            data.calendarPrefs && typeof data.calendarPrefs === 'object'
              ? sanitizeCalendarPrefs(data.calendarPrefs as CalendarPrefs)
              : local.calendarPrefs;
          const nextRemPrefs =
            data.reminderPrefs && typeof data.reminderPrefs === 'object'
              ? sanitizeReminderPrefs(data.reminderPrefs as ReminderPrefs)
              : local.reminderPrefs;
          const nextBundles =
            data.voiceBundles && typeof data.voiceBundles === 'object'
              ? sanitizeVoiceBundles(data.voiceBundles as Partial<VoiceBundles>)
              : local.voiceBundles;

          const resolvedPhone =
            pendingReg?.phone ??
            (typeof data.phone === 'string' && data.phone.trim() ? data.phone : null);
          const resolvedHint =
            pendingReg?.passwordHint ??
            (typeof data.passwordHint === 'string' && data.passwordHint.trim()
              ? data.passwordHint
              : null);
          const resolvedTerms =
            pendingReg?.termsAccepted ??
            (typeof data.termsAccepted === 'boolean' ? data.termsAccepted : null);
          const resolvedTermsAt =
            pendingReg?.termsAcceptedAt ??
            (typeof data.termsAcceptedAt === 'number' ? data.termsAcceptedAt : null);

          accountMetaRef.current = {
            phone: resolvedPhone,
            passwordHint: resolvedHint,
            termsAccepted: resolvedTerms,
            termsAcceptedAt: resolvedTermsAt,
          };
          setUserPhone(resolvedPhone);
          setPasswordHint(resolvedHint);

          if (themePreferenceRef.current !== 'system') {
            setThemePreferenceState(nextTheme);
          }
          if (nextName) setProfileNameState(nextName);
          setNotificationsEnabledState(nextNotifs);
          setPrivacyModeState(nextPrivacy);
          setTariffsState(nextTariffs);
          setSimLabelsState(nextSimLabels);
          setCalendarPrefsState(nextCalPrefs);
          setReminderPrefsState(nextRemPrefs);
          setVoiceBundlesState(nextBundles);
          setFavoritesArray(mergedFavs);
          setDismissedMissedArray(mergedDismissed);

          if (
            Boolean(pendingReg) ||
            mergedFavs.length !== ((data.favorites as string[] | undefined)?.length ?? 0) ||
            mergedDismissed.length !==
              ((data.dismissedMissedIds as string[] | undefined)?.length ?? 0)
          ) {
            currentOp = OperationType.UPDATE;
            currentPath = `users/${uid}`;
            await persistWorkspaceToCloud(user, {
              theme: nextTheme,
              profileName: nextName,
              phone: resolvedPhone,
              passwordHint: resolvedHint,
              ...(typeof resolvedTerms === 'boolean' ? { termsAccepted: resolvedTerms } : {}),
              termsAcceptedAt: resolvedTermsAt,
              notificationsEnabled: nextNotifs,
              privacyMode: nextPrivacy,
              tariffs: nextTariffs,
              simLabels: nextSimLabels,
              calendarPrefs: nextCalPrefs,
              reminderPrefs: nextRemPrefs,
              voiceBundles: nextBundles,
              favoritesArray: mergedFavs,
              dismissedMissedArray: mergedDismissed,
            });
          }

          await syncUserRegistry(user, nextName, resolvedPhone);
          if (pendingReg) {
            removeStorageKey(userStorageKey(uid, 'pendingRegistration'));
          }
        }

        resolveWorkspaceReady();

        if (cancelled || myRun !== activeRun) return;

        // Queries must explicitly constrain ownerUid == uid to satisfy Firestore list rules
        const callsQuery = query(
          collection(db, 'users', uid, 'calls'),
          where('ownerUid', '==', uid),
        );
        const contactsQuery = query(
          collection(db, 'users', uid, 'contacts'),
          where('ownerUid', '==', uid),
        );
        const scheduledQuery = query(
          collection(db, 'users', uid, 'scheduledCalls'),
          where('ownerUid', '==', uid),
        );

        currentOp = OperationType.LIST;
        currentPath = `users/${uid}/calls`;
        const cloudCallsSnap = await getDocs(callsQuery);

        currentPath = `users/${uid}/contacts`;
        const cloudContactsSnap = await getDocs(contactsQuery);

        currentPath = `users/${uid}/scheduledCalls`;
        const cloudSchedSnap = await getDocs(scheduledQuery);

        if (cancelled || myRun !== activeRun) return;

        const existingCallIds = new Set(cloudCallsSnap.docs.map((d) => d.id));
        const existingContactIds = new Set(cloudContactsSnap.docs.map((d) => d.id));
        const existingSchedIds = new Set(cloudSchedSnap.docs.map((d) => d.id));

        const pendingBatchWrites: Array<{
          pathSegments: [string, string, string, string];
          data: Record<string, unknown>;
        }> = [];

        local.calls.forEach((call) => {
          const docId = toFirestoreDocId(call.id);
          if (!existingCallIds.has(docId)) {
            pendingBatchWrites.push({
              pathSegments: ['users', uid, 'calls', docId],
              data: serializeCallForFirestore(uid, call),
            });
          }
        });

        Object.values(local.contacts).forEach((profile) => {
          const docId = toFirestoreDocId(profile.key || getContactKey(profile.number));
          if (!existingContactIds.has(docId)) {
            pendingBatchWrites.push({
              pathSegments: ['users', uid, 'contacts', docId],
              data: serializeContactForFirestore(uid, profile),
            });
          }
        });

        local.scheduledCalls.forEach((item) => {
          const docId = toFirestoreDocId(item.id);
          if (!existingSchedIds.has(docId)) {
            pendingBatchWrites.push({
              pathSegments: ['users', uid, 'scheduledCalls', docId],
              data: serializeScheduledCallForFirestore(uid, item),
            });
          }
        });

        if (pendingBatchWrites.length > 0) {
          currentOp = OperationType.WRITE;
          currentPath = `users/${uid}`;
          await commitBatchWrites(pendingBatchWrites);
        }

        if (cancelled || myRun !== activeRun) return;

        // Attach real-time listeners
        unsubWorkspace = onSnapshot(
          userDocRef,
          (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() as Record<string, unknown>;
            if (
              themePreferenceRef.current !== 'system' &&
              (data.theme === 'dark' || data.theme === 'dark-gray' || data.theme === 'light')
            ) {
              setThemePreferenceState(data.theme === 'light' ? 'light' : 'dark-gray');
            }
            if (typeof data.displayName === 'string') setProfileNameState(data.displayName);
            if (typeof data.phone === 'string') {
              accountMetaRef.current.phone = data.phone;
              setUserPhone(data.phone);
            }
            if (typeof data.passwordHint === 'string') {
              accountMetaRef.current.passwordHint = data.passwordHint;
              setPasswordHint(data.passwordHint);
            }
            if (typeof data.termsAccepted === 'boolean') {
              accountMetaRef.current.termsAccepted = data.termsAccepted;
            }
            if (typeof data.termsAcceptedAt === 'number') {
              accountMetaRef.current.termsAcceptedAt = data.termsAcceptedAt;
            }
            if (typeof data.notificationsEnabled === 'boolean') {
              setNotificationsEnabledState(data.notificationsEnabled);
            }
            if (typeof data.privacyMode === 'boolean') setPrivacyModeState(data.privacyMode);
            if (data.tariffs && typeof data.tariffs === 'object') {
              setTariffsState(sanitizeTariffs(data.tariffs as TariffConfig));
            }
            if (data.simLabels && typeof data.simLabels === 'object') {
              setSimLabelsState(sanitizeSimLabels(data.simLabels as SimLabels));
            }
            if (data.calendarPrefs && typeof data.calendarPrefs === 'object') {
              setCalendarPrefsState(sanitizeCalendarPrefs(data.calendarPrefs as CalendarPrefs));
            }
            if (data.reminderPrefs && typeof data.reminderPrefs === 'object') {
              setReminderPrefsState(sanitizeReminderPrefs(data.reminderPrefs as ReminderPrefs));
            }
            if (data.voiceBundles && typeof data.voiceBundles === 'object') {
              setVoiceBundlesState(sanitizeVoiceBundles(data.voiceBundles as Partial<VoiceBundles>));
            }
            if (Array.isArray(data.favorites)) setFavoritesArray(data.favorites as string[]);
            if (Array.isArray(data.dismissedMissedIds)) {
              setDismissedMissedArray(data.dismissedMissedIds as string[]);
            }
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
          },
          (error) => {
            setSyncStatus('error');
            handleFirestoreError(error, OperationType.GET, `users/${uid}`);
          },
        );

        unsubCalls = onSnapshot(
          callsQuery,
          (snap) => {
            const repairs: Array<{
              pathSegments: [string, string, string, string];
              data: Record<string, unknown>;
            }> = [];
            const list: CallRecord[] = snap.docs
              .map((d) => {
                const raw = d.data() as Record<string, unknown>;
                const initial: CallRecord = {
                  id: String(raw.id || d.id),
                  number: String(raw.number || ''),
                  name: typeof raw.name === 'string' ? raw.name : null,
                  direction: raw.direction as CallDirection,
                  sim: (raw.sim === 'SIM 1' ? 'SIM 1' : raw.sim === 'SIM 2' ? 'SIM 2' : null) as SimSlot,
                  timestamp: Number(raw.timestamp) || 0,
                  duration: Number(raw.duration) || 0,
                  note: typeof raw.note === 'string' ? raw.note : null,
                  tag: typeof raw.tag === 'string' ? raw.tag : null,
                };
                const healed = healCallRecord(initial);
                if (healed !== initial) {
                  repairs.push({
                    pathSegments: ['users', uid, 'calls', toFirestoreDocId(healed.id)],
                    data: serializeCallForFirestore(uid, healed),
                  });
                }
                return healed;
              })
              .sort((a, b) => b.timestamp - a.timestamp);
            setCalls(list);
            if (repairs.length > 0) {
              void commitBatchWrites(repairs).catch(() => {});
            }
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
          },
          (error) => {
            setSyncStatus('error');
            handleFirestoreError(error, OperationType.LIST, `users/${uid}/calls`);
          },
        );

        unsubContacts = onSnapshot(
          contactsQuery,
          (snap) => {
            const map: Record<string, ContactProfile> = {};
            const repairs: Array<{
              pathSegments: [string, string, string, string];
              data: Record<string, unknown>;
            }> = [];
            snap.docs.forEach((d) => {
              const raw = d.data() as Record<string, unknown>;
              const number = String(raw.number || '');
              const key = getContactKey(number) || String(raw.key || d.id);
              const initial: ContactProfile = {
                key,
                number,
                name: String(raw.name || number),
                tag: String(raw.tag || ''),
                birthday: (raw.birthday as ContactProfile['birthday']) ?? null,
                events: Array.isArray(raw.events) ? (raw.events as ContactProfile['events']) : [],
                notes: String(raw.notes || ''),
                updatedAt: Number(raw.updatedAt) || Date.now(),
              };
              const healed = healContactProfile(initial);
              if (healed !== initial) {
                repairs.push({
                  pathSegments: ['users', uid, 'contacts', toFirestoreDocId(key)],
                  data: serializeContactForFirestore(uid, healed),
                });
              }
              map[key] = healed;
            });
            setContacts(map);
            if (repairs.length > 0) {
              void commitBatchWrites(repairs).catch(() => {});
            }
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
          },
          (error) => {
            setSyncStatus('error');
            handleFirestoreError(error, OperationType.LIST, `users/${uid}/contacts`);
          },
        );

        unsubScheduled = onSnapshot(
          scheduledQuery,
          (snap) => {
            const repairs: Array<{
              pathSegments: [string, string, string, string];
              data: Record<string, unknown>;
            }> = [];
            const list: ScheduledCall[] = snap.docs
              .map((d) => {
                const raw = d.data() as Record<string, unknown>;
                const initial: ScheduledCall = {
                  id: String(raw.id || d.id),
                  number: String(raw.number || ''),
                  name: typeof raw.name === 'string' ? raw.name : null,
                  scheduledFor: Number(raw.scheduledFor) || 0,
                  note: typeof raw.note === 'string' ? raw.note : null,
                  sourceCallId: typeof raw.sourceCallId === 'string' ? raw.sourceCallId : null,
                  status: (raw.status as ScheduledCall['status']) || 'pending',
                  notifiedAt: typeof raw.notifiedAt === 'number' ? raw.notifiedAt : null,
                  createdAt: Number(raw.createdAt) || Date.now(),
                };
                const healed = healScheduledCall(initial);
                if (healed !== initial) {
                  repairs.push({
                    pathSegments: ['users', uid, 'scheduledCalls', toFirestoreDocId(healed.id)],
                    data: serializeScheduledCallForFirestore(uid, healed),
                  });
                }
                return healed;
              })
              .sort((a, b) => a.scheduledFor - b.scheduledFor);
            setScheduledCalls(list);
            if (repairs.length > 0) {
              void commitBatchWrites(repairs).catch(() => {});
            }
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
          },
          (error) => {
            setSyncStatus('error');
            handleFirestoreError(error, OperationType.LIST, `users/${uid}/scheduledCalls`);
          },
        );
      } catch (error) {
        resolveWorkspaceReady();
        setSyncStatus('error');
        if (error instanceof Error && error.message.startsWith('{"error":')) {
          throw error;
        }
        handleFirestoreError(error, currentOp, currentPath);
      }
    });

    return () => {
      cancelled = true;
      cleanupListeners();
      unsubAuth();
    };
  }, [applySnapshotToState, commitBatchWrites, persistWorkspaceToCloud, showNotice, syncUserRegistry, verifyRefreshKey]);

  const refreshNotificationPermission =
    useCallback(async (): Promise<NotificationPermissionStatus> => {
      if (isNativeCapacitor()) {
        if (!hasNativeNotificationsPlugin()) {
          setNotificationPermission('unsupported');
          return 'unsupported';
        }
        const st = await getNativeNotificationPermission();
        setNotificationPermission(st);
        return st;
      }
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const p = Notification.permission;
        const mapped: NotificationPermissionStatus =
          p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';
        setNotificationPermission(mapped);
        return mapped;
      }
      setNotificationPermission('unsupported');
      return 'unsupported';
    }, []);

  useEffect(() => {
    void refreshNotificationPermission();
    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void refreshNotificationPermission();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refreshNotificationPermission]);

  const requestAlertPermissions =
    useCallback(async (): Promise<NotificationPermissionStatus> => {
      if (isNativeCapacitor()) {
        if (!hasNativeNotificationsPlugin()) {
          showNotice(
            'Native notification plugin missing in APK. Add NotificationsPlugin.java to enable phone alerts.',
            'warning',
          );
          setNotificationPermission('unsupported');
          return 'unsupported';
        }
        const st = await requestNativeNotificationPermission();
        setNotificationPermission(st);
        if (st === 'granted') {
          setNotificationsEnabledState(true);
          const user = auth.currentUser;
          if (user) void persistWorkspaceToCloud(user, { notificationsEnabled: true });
          showNotice('Phone notifications allowed.', 'success');
        } else if (st === 'denied') {
          showNotice(
            'Notification permission is off. Enable it in Phone Settings -> Apps -> Call Analyzer -> Notifications.',
            'warning',
          );
        }
        return st;
      }

      if (typeof window !== 'undefined' && 'Notification' in window) {
        let perm = Notification.permission;
        if (perm === 'default') {
          perm = await Notification.requestPermission();
        }
        const mapped: NotificationPermissionStatus =
          perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt';
        setNotificationPermission(mapped);
        if (mapped === 'granted') {
          setNotificationsEnabledState(true);
          const user = auth.currentUser;
          if (user) void persistWorkspaceToCloud(user, { notificationsEnabled: true });
          showNotice('Browser alerts allowed.', 'success');
        } else if (mapped === 'denied') {
          showNotice('Browser notification permission is blocked in browser settings.', 'warning');
        }
        return mapped;
      }

      setNotificationPermission('unsupported');
      showNotice('Notifications unavailable here; in-app alerts stay active.');
      return 'unsupported';
    }, [persistWorkspaceToCloud, showNotice]);

  const deliverSystemNotification = useCallback(
    async (idKey: string, title: string, body: string): Promise<boolean> => {
      if (isNativeCapacitor()) {
        if (!hasNativeNotificationsPlugin()) return false;
        return showNativeNotification(idKey, title, body);
      }
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification(title, { body });
        return true;
      }
      return false;
    },
    [],
  );

  const sendTestAlertNotification = useCallback(
    async (customBody?: string): Promise<boolean> => {
      const status = await requestAlertPermissions();
      if (status !== 'granted') return false;
      const body =
        customBody?.trim() ||
        'Callback reminders, missed call alerts, and Ethiopian holiday wishes are active.';
      const sent = await deliverSystemNotification('test-alert', 'Call Analyzer - ETH', body);
      if (sent) {
        showNotice('Notification sent.', 'success');
      } else {
        showNotice('Could not display system notification.');
      }
      return sent;
    },
    [deliverSystemNotification, requestAlertPermissions, showNotice],
  );

  // Periodically check due scheduled calls and fire alerts respecting Quiet Hours
  useEffect(() => {
    const checkDue = () => {
      const now = Date.now();
      const dueUnnotified = scheduledCalls.filter(
        (item) => item.status === 'pending' && item.scheduledFor <= now && !item.notifiedAt,
      );
      if (dueUnnotified.length === 0) return;

      const updatedItems: ScheduledCall[] = dueUnnotified.map((item) => ({
        ...item,
        notifiedAt: now,
      }));
      const updatedMap = new Map(updatedItems.map((i) => [i.id, i]));
      setScheduledCalls((prev) => prev.map((item) => updatedMap.get(item.id) ?? item));

      const user = auth.currentUser;
      if (user) {
        updatedItems.forEach((item) => {
          const docId = toFirestoreDocId(item.id);
          void setDoc(
            doc(db, 'users', user.uid, 'scheduledCalls', docId),
            serializeScheduledCallForFirestore(user.uid, item),
          ).catch((err) =>
            handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/scheduledCalls/${docId}`),
          );
        });
      }

      const first = dueUnnotified[0];
      const label = first.name?.trim() || first.number;
      showNotice(`Scheduled call reminder: ${label}`);

      if (notificationsEnabled && !isWithinQuietHours(reminderPrefs)) {
        void deliverSystemNotification(
          first.id,
          `Call reminder: ${label}`,
          first.note?.trim() || `Scheduled call to ${first.number}`,
        );
      }
    };

    checkDue();
    const timer = setInterval(checkDue, 5_000);
    return () => clearInterval(timer);
  }, [
    scheduledCalls,
    notificationsEnabled,
    reminderPrefs,
    showNotice,
    deliverSystemNotification,
  ]);

  const signInWithGoogle = useCallback(async (): Promise<AuthActionResult> => {
    try {
      if (isNativeCapacitor()) {
        if (!hasNativeGoogleAuth()) {
          const msg =
            'Google Sign-In is not enabled in this Android APK yet. Use Email Login or Create Account below.';
          showNotice(msg);
          return { ok: false, error: msg };
        }
        const nativeCred = await runNativeGoogleSignIn();
        if (!nativeCred.idToken && !nativeCred.accessToken) {
          const msg =
            'Google Sign-In returned no ID token. Confirm google-services.json includes Web OAuth Client (client_type: 3) and try again.';
          showNotice(msg);
          return { ok: false, error: msg };
        }
        const credential = GoogleAuthProvider.credential(
          nativeCred.idToken,
          nativeCred.accessToken,
        );
        const res = await signInWithCredential(auth, credential);
        setIsGuest(false);
        setAuthPromptMode('closed');
        setAuthPromptReason(null);
        showNotice(`Signed in as ${res.user.displayName || res.user.email || 'Google user'}.`);
        return { ok: true };
      }

      const res = await signInWithPopup(auth, googleProvider);
      setIsGuest(false);
      setAuthPromptMode('closed');
      setAuthPromptReason(null);
      showNotice(`Signed in as ${res.user.displayName || res.user.email || 'Google user'}.`);
      return { ok: true };
    } catch (error) {
      const code = (error as { code?: string | number })?.code ?? '';
      const rawMsg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : String((error as { message?: string })?.message ?? '');
      const lower = `${code} ${rawMsg}`.toLowerCase();

      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        lower.includes('12501') ||
        lower.includes('cancel')
      ) {
        showNotice('Sign-in cancelled.');
        return { ok: false, error: 'Sign-in was cancelled.' };
      }
      if (code === 'auth/popup-blocked') {
        const msg = 'Popup was blocked by your browser. Allow popups for this site and try again.';
        showNotice(msg);
        return { ok: false, error: msg };
      }
      if (code === 'auth/unauthorized-domain') {
        const msg =
          'This domain is not authorized for Google Sign-In. Add it in Firebase Auth or sign in with Email below.';
        showNotice(msg);
        return { ok: false, error: msg };
      }
      if (code === 'auth/network-request-failed' || lower.includes('network')) {
        const msg = 'Network error during Google Sign-In. Check your Wi-Fi or mobile data and try again.';
        showNotice(msg);
        return { ok: false, error: msg };
      }
      if (isNativeCapacitor() && (lower.includes('10:') || lower.includes('12500') || lower.includes('developer'))) {
        const msg =
          'Google Sign-In is missing your Android SHA-1 or google-services.json setup in Firebase Console.';
        showNotice(msg);
        return { ok: false, error: msg };
      }
      const detail =
        isNativeCapacitor() && rawMsg
          ? ` (${rawMsg.slice(0, 120)})`
          : code
            ? ` (${String(code)})`
            : '';
      const msg = `Could not complete Google Sign-In${detail}. Please try Email Login below.`;
      showNotice(msg);
      return { ok: false, error: msg };
    }
  }, [showNotice]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const cleanEmail = email.trim();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { ok: false, error: 'Enter a valid email address.' };
      }
      if (!password) {
        return { ok: false, error: 'Enter your password.' };
      }
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        setIsGuest(false);
        setAuthPromptMode('closed');
        setAuthPromptReason(null);
        if (cred.user.emailVerified) {
          showNotice(`Signed in as ${cred.user.email || 'user'}.`);
        } else {
          showNotice('Verify your email address to unlock your cloud workspace.');
        }
        return { ok: true };
      } catch (error) {
        const msg = mapFirebaseAuthError(error, 'Could not sign in with email and password.');
        showNotice(msg);
        return { ok: false, error: msg };
      }
    },
    [showNotice],
  );

  const createAccountWithEmail = useCallback(
    async (input: CreateAccountInput): Promise<AuthActionResult> => {
      const cleanEmail = input.email.trim();
      const cleanPhone = input.phone.trim();
      const cleanHint = input.passwordHint.trim();

      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { ok: false, error: 'Enter a valid email address.' };
      }
      if (cleanPhone.replace(/\D/g, '').length < 7) {
        return { ok: false, error: 'Enter a valid phone number.' };
      }
      if (input.password.length < 6) {
        return { ok: false, error: 'Password must be at least 6 characters.' };
      }
      if (input.password !== input.confirmPassword) {
        return { ok: false, error: 'Password and confirm password do not match.' };
      }
      if (cleanHint.length < 2) {
        return { ok: false, error: 'Enter a short password hint to help you remember.' };
      }
      if (cleanHint.toLowerCase() === input.password.toLowerCase()) {
        return { ok: false, error: 'Password hint must not match your password.' };
      }
      if (!input.agreedToTerms) {
        return {
          ok: false,
          error: 'Please agree to the privacy terms before creating an account.',
        };
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, input.password);
        const pending: PendingRegistration = {
          phone: clampStr(cleanPhone, 40),
          passwordHint: clampStr(cleanHint, 120),
          termsAccepted: true,
          termsAcceptedAt: Date.now(),
        };
        writeJson(userStorageKey(cred.user.uid, 'pendingRegistration'), pending);
        try {
          await sendEmailVerification(cred.user);
          showNotice('Account created! Verification email sent.');
        } catch {
          showNotice('Account created! Tap Resend email if you did not receive verification.');
        }
        return { ok: true };
      } catch (error) {
        const msg = mapFirebaseAuthError(error, 'Could not create your account right now.');
        showNotice(msg);
        return { ok: false, error: msg };
      }
    },
    [showNotice],
  );

  const resendVerificationEmail = useCallback(async (): Promise<AuthActionResult> => {
    const current = auth.currentUser;
    if (!current) {
      return { ok: false, error: 'No pending account found.' };
    }
    try {
      await sendEmailVerification(current);
      showNotice(`Verification email resent to ${current.email ?? 'your inbox'}.`);
      return { ok: true };
    } catch (error) {
      const msg = mapFirebaseAuthError(error, 'Could not resend verification email right now.');
      showNotice(msg);
      return { ok: false, error: msg };
    }
  }, [showNotice]);

  const checkEmailVerification = useCallback(async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) return false;
    try {
      await current.reload();
      if (current.emailVerified) {
        await current.getIdToken(true);
        setVerifyRefreshKey((k) => k + 1);
        showNotice('Email verified! Opening your private workspace...');
        return true;
      }
      showNotice('Not verified yet. Open the verification link in your email inbox.');
      return false;
    } catch {
      showNotice('Could not check verification status right now.');
      return false;
    }
  }, [showNotice]);

  const sendPasswordReset = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      const cleanEmail = email.trim();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { ok: false, error: 'Enter your account email first to send a reset link.' };
      }
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        showNotice(`Password reset link sent to ${cleanEmail}.`);
        return { ok: true };
      } catch (error) {
        const msg = mapFirebaseAuthError(error, 'Could not send password reset email.');
        showNotice(msg);
        return { ok: false, error: msg };
      }
    },
    [showNotice],
  );

  const signOutAccount = useCallback(async () => {
    const prevUid = auth.currentUser?.uid;
    try {
      hydratedUidRef.current = null;
      setHydratedUid(null);
      workspaceReadyRef.current = null;
      accountMetaRef.current = {
        phone: null,
        passwordHint: null,
        termsAccepted: null,
        termsAcceptedAt: null,
      };
      setUserPhone(null);
      setPasswordHint(null);
      setIsGuest(false);
      setAuthPromptMode('closed');
      setAuthPromptReason(null);
      await signOut(auth);
      await runNativeSignOut();
      if (prevUid) clearUserScopedStorage(prevUid);
      clearLegacyUnscopedKeys();
      applySnapshotToState(createEmptySnapshot());
      setLastSyncedAt(null);
      setSyncStatus('signed-out');
      showNotice('Signed out. Personal data cleared from this device.');
    } catch {
      showNotice('Could not sign out right now.');
    }
  }, [applySnapshotToState, showNotice]);

  const syncNow = useCallback(async () => {
    const user = requireSignedInUser();
    if (!user) return;
    const s = stateRef.current;
    await persistWorkspaceToCloud(user);
    const writes: Array<{
      pathSegments: [string, string, string, string];
      data: Record<string, unknown>;
    }> = [];
    s.calls.forEach((c) => {
      const docId = toFirestoreDocId(c.id);
      writes.push({
        pathSegments: ['users', user.uid, 'calls', docId],
        data: serializeCallForFirestore(user.uid, c),
      });
    });
    Object.values(s.contacts).forEach((p) => {
      const docId = toFirestoreDocId(p.key || getContactKey(p.number));
      writes.push({
        pathSegments: ['users', user.uid, 'contacts', docId],
        data: serializeContactForFirestore(user.uid, p),
      });
    });
    s.scheduledCalls.forEach((sc) => {
      const docId = toFirestoreDocId(sc.id);
      writes.push({
        pathSegments: ['users', user.uid, 'scheduledCalls', docId],
        data: serializeScheduledCallForFirestore(user.uid, sc),
      });
    });
    if (writes.length > 0) {
      try {
        setSyncStatus('syncing');
        await commitBatchWrites(writes);
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
      } catch (err) {
        setSyncStatus('error');
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    }
    showNotice('Cloud workspace synced.');
  }, [commitBatchWrites, persistWorkspaceToCloud, requireSignedInUser, showNotice]);

  const fetchRegisteredUsers = useCallback(async (): Promise<RegisteredUserRecord[]> => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return [];
    }
    const path = 'userRegistry';
    try {
      const snap = await getDocs(collection(db, 'userRegistry'));
      const toMs = (val: unknown): number => {
        if (val instanceof Timestamp) return val.toMillis();
        if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
          return (val as { toMillis: () => number }).toMillis();
        }
        return typeof val === 'number' ? val : Date.now();
      };
      return snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, unknown>;
          return {
            uid: String(raw.uid || d.id),
            displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
            email: typeof raw.email === 'string' ? raw.email : '',
            phone: typeof raw.phone === 'string' ? raw.phone : null,
            authProvider:
              raw.authProvider === 'google' || raw.authProvider === 'password'
                ? (raw.authProvider as AuthProviderType)
                : null,
            photoURL: typeof raw.photoURL === 'string' ? raw.photoURL : null,
            registeredAtMs: toMs(raw.registeredAt),
            lastActiveAtMs: toMs(raw.lastActiveAt),
          };
        })
        .sort((a, b) => b.registeredAtMs - a.registeredAtMs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }, []);

  const setAppPin = useCallback(
    async (pin: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      const clean = pin.trim();
      if (!/^\d{4}$/.test(clean)) {
        showNotice('PIN must be exactly 4 digits.');
        return;
      }
      const hashed = await hashPin(clean);
      setPinHash(hashed);
      writeJson(userStorageKey(user.uid, 'pinHash'), hashed);
      setIsLocked(false);
      showNotice('4-digit App Lock PIN saved.', 'success');
    },
    [requireSignedInUser, showNotice],
  );

  const clearAppPin = useCallback(() => {
    const user = auth.currentUser;
    setPinHash('');
    if (user) {
      writeJson(userStorageKey(user.uid, 'pinHash'), '');
    }
    setIsLocked(false);
    showNotice('App Lock PIN removed.', 'warning');
  }, [showNotice]);

  const unlockWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!pinHash) {
        setIsLocked(false);
        return true;
      }
      const ok = await verifyPin(pin, pinHash);
      if (ok) {
        triggerHaptic('success');
        setIsLocked(false);
      } else {
        triggerHaptic('warning');
      }
      return ok;
    },
    [pinHash],
  );

  const lockApp = useCallback(() => {
    if (!pinHash) {
      showNotice('Set a 4-digit PIN first.');
      return;
    }
    triggerHaptic('tap');
    setIsLocked(true);
  }, [pinHash, showNotice]);

  const setPrivacyMode = useCallback(
    (enabled: boolean) => {
      if (isGuestRef.current && !auth.currentUser) {
        setPrivacyModeState(enabled);
        showNotice(enabled ? 'Privacy mode on — private notes hidden.' : 'Privacy mode off.');
        return;
      }
      const user = requireSignedInUser();
      if (!user) return;
      setPrivacyModeState(enabled);
      void persistWorkspaceToCloud(user, { privacyMode: enabled });
      showNotice(enabled ? 'Privacy mode on — private notes hidden.' : 'Privacy mode off.');
    },
    [persistWorkspaceToCloud, requireSignedInUser, showNotice],
  );

  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode(!stateRef.current.privacyMode);
  }, [setPrivacyMode]);

  const importCalls = useCallback(
    (records: CallRecord[]): ImportCounts => {
      const user = requireSignedInUser(
        'Login or create an account to import your own call history.',
      );
      if (!user) return { added: 0, duplicates: 0 };

      const existing = new Set(stateRef.current.calls.map((c) => c.id));
      const fresh: CallRecord[] = [];
      let dupCount = 0;
      records.forEach((rec) => {
        if (existing.has(rec.id)) {
          dupCount += 1;
        } else {
          existing.add(rec.id);
          fresh.push(rec);
        }
      });

      if (fresh.length > 0) {
        setCalls((prev) => [...fresh, ...prev]);
        const writes = fresh.map((c) => {
          const docId = toFirestoreDocId(c.id);
          return {
            pathSegments: ['users', user.uid, 'calls', docId] as [string, string, string, string],
            data: serializeCallForFirestore(user.uid, c),
          };
        });
        void ensureWorkspaceReady(user.uid)
          .then(() => commitBatchWrites(writes))
          .catch((err) =>
            handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/calls`),
          );
      }

      return { added: fresh.length, duplicates: dupCount };
    },
    [commitBatchWrites, ensureWorkspaceReady, requireSignedInUser],
  );

  const canSyncPhoneCalls = isNativeCapacitor() && hasNativeCallLogPlugin();
  const nativeSyncingRef = useRef(false);

  const runPhoneCallSync = useCallback(
    async ({ fullResync = false, manual = false }: { fullResync?: boolean; manual?: boolean } = {}) => {
      const user = requireSignedInUser(
        'Login and verify your email to sync real call logs from your phone.',
      );
      if (!user) return;
      if (!isNativeCapacitor() || !hasNativeCallLogPlugin()) {
        if (manual) {
          showNotice('Phone call-log sync is only available inside the Android APK.', 'warning');
        }
        return;
      }
      if (nativeSyncingRef.current) return;
      nativeSyncingRef.current = true;
      const syncKey = `callanalyzer.u.${user.uid}.nativeLastCallSync`;

      try {
        const lastSince = fullResync ? 0 : readJson<number>(syncKey, 0);
        const fetched = await fetchNativeRecentCalls(lastSince);
        if (fetched.length === 0) {
          if (manual) {
            showNotice(
              'No calls returned from phone. Check Call Log permission in Android App Info.',
              'warning',
            );
          }
          return;
        }
        const maxTs = fetched.reduce((acc, item) => Math.max(acc, item.timestamp), lastSince);
        const counts = importCalls(fetched);
        writeJson(syncKey, maxTs);
        if (counts.added > 0) {
          showNotice(
            `Synced ${counts.added} call${counts.added === 1 ? '' : 's'} from your phone.`,
            'success',
          );
          const latestNewMissed = fetched.find(
            (c) => c.direction === 'missed' && c.timestamp > lastSince,
          );
          if (
            !manual &&
            latestNewMissed &&
            lastSince > 0 &&
            notificationsEnabled &&
            !isWithinQuietHours(reminderPrefs)
          ) {
            const label = latestNewMissed.name?.trim() || latestNewMissed.number;
            void deliverSystemNotification(
              latestNewMissed.id,
              `Missed call from ${label}`,
              'Open Call Analyzer to call back or schedule a reminder.',
            );
          }
        } else if (manual) {
          showNotice(`Phone call logs up to date (${fetched.length} checked).`, 'tap');
        }
      } catch (err) {
        const rawMsg = err instanceof Error ? err.message : String(err || 'Permission denied');
        showNotice(`Phone call sync failed: ${rawMsg}`, 'warning');
      } finally {
        nativeSyncingRef.current = false;
      }
    },
    [
      deliverSystemNotification,
      importCalls,
      notificationsEnabled,
      reminderPrefs,
      requireSignedInUser,
      showNotice,
    ],
  );

  const syncPhoneCalls = useCallback(
    async (options?: { fullResync?: boolean }) => {
      await runPhoneCallSync({ fullResync: options?.fullResync ?? true, manual: true });
    },
    [runPhoneCallSync],
  );

  // Auto-sync real-time Android call logs when running inside Capacitor with CallLogPlugin installed
  useEffect(() => {
    if (!authUser?.emailVerified || !hydratedUid || hydratedUid !== authUser.uid) return;
    if (!isNativeCapacitor() || !hasNativeCallLogPlugin()) return;

    let cancelled = false;
    let unsubNative: (() => void) | null = null;

    const startSyncAndWatch = async () => {
      await runPhoneCallSync({ fullResync: false, manual: false });
      if (cancelled) return;
      const cleanup = await subscribeNativeCallLog(() => {
        if (!cancelled) {
          void runPhoneCallSync({ fullResync: false, manual: false });
        }
      });
      if (cancelled) {
        cleanup();
      } else {
        unsubNative = cleanup;
      }
    };

    void startSyncAndWatch();

    return () => {
      cancelled = true;
      unsubNative?.();
    };
  }, [authUser, hydratedUid, runPhoneCallSync]);

  const importContactProfiles = useCallback(
    (incoming: ContactProfile[]): { added: number; updated: number } => {
      const user = requireSignedInUser(
        'Login or create an account to import your phone contacts.',
      );
      if (!user) return { added: 0, updated: 0 };

      let added = 0;
      let updated = 0;
      const changedProfiles: ContactProfile[] = [];
      const nextMap = { ...stateRef.current.contacts };

      const incomingByKey = new Map<string, ContactProfile>();
      incoming.forEach((rawItem) => {
        const item = healContactProfile(rawItem);
        const key = item.key || getContactKey(item.number);
        incomingByKey.set(key, item);
        const existing = nextMap[key];
        if (!existing) {
          added += 1;
          const created = { ...item, key };
          nextMap[key] = created;
          changedProfiles.push(created);
        } else {
          updated += 1;
          const mergedEvents = [...existing.events];
          item.events.forEach((evt) => {
            if (
              !mergedEvents.some(
                (e) => e.title === evt.title && e.month === evt.month && e.day === evt.day,
              )
            ) {
              mergedEvents.push(evt);
            }
          });
          const merged: ContactProfile = healContactProfile({
            ...existing,
            name: item.name && item.name !== item.number ? item.name : existing.name,
            tag: item.tag || existing.tag,
            birthday: item.birthday ?? existing.birthday,
            events: mergedEvents,
            notes: item.notes || existing.notes,
            updatedAt: Date.now(),
          });
          nextMap[key] = merged;
          changedProfiles.push(merged);
        }
      });

      setContacts(nextMap);

      const updatedCalls: CallRecord[] = [];
      setCalls((prev) =>
        prev.map((call) => {
          const match = incomingByKey.get(getContactKey(call.number));
          if (!match) return call;
          const nextCall = healCallRecord({
            ...call,
            name: match.name && match.name !== match.number ? match.name : call.name,
            tag: match.tag || call.tag,
          });
          updatedCalls.push(nextCall);
          return nextCall;
        }),
      );

      const writes = [
        ...changedProfiles.map((p) => {
          const docId = toFirestoreDocId(p.key || getContactKey(p.number));
          return {
            pathSegments: ['users', user.uid, 'contacts', docId] as [string, string, string, string],
            data: serializeContactForFirestore(user.uid, p),
          };
        }),
        ...updatedCalls.map((c) => {
          const docId = toFirestoreDocId(c.id);
          return {
            pathSegments: ['users', user.uid, 'calls', docId] as [string, string, string, string],
            data: serializeCallForFirestore(user.uid, c),
          };
        }),
      ];
      if (writes.length > 0) {
        void ensureWorkspaceReady(user.uid)
          .then(() => commitBatchWrites(writes))
          .catch((err) =>
            handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/contacts`),
          );
      }

      return { added, updated };
    },
    [commitBatchWrites, ensureWorkspaceReady, requireSignedInUser],
  );

  const loadSampleData = useCallback((): ImportCounts => {
    const user = requireSignedInUser();
    if (!user) return { added: 0, duplicates: 0 };

    const sample = buildSampleCalls();
    const counts = importCalls(sample);
    const sampleProfiles = buildSampleContactProfiles();
    const currentContacts = stateRef.current.contacts;
    const newProfiles = sampleProfiles.filter((profile) => !currentContacts[profile.key]);

    if (newProfiles.length > 0) {
      setContacts((prev) => {
        const next = { ...prev };
        newProfiles.forEach((profile) => {
          if (!next[profile.key]) next[profile.key] = profile;
        });
        return next;
      });
    }

    const now = Date.now();
    const newSchedules: ScheduledCall[] =
      stateRef.current.scheduledCalls.length === 0
        ? [
            {
              id: 'sched-sample-1',
              number: '+251911248890',
              name: 'Dawit Bekele',
              scheduledFor: now + 90 * 60_000,
              note: 'Confirm invoice payment schedule',
              status: 'pending',
              notifiedAt: null,
              createdAt: now,
            },
            {
              id: 'sched-sample-2',
              number: '+251922310442',
              name: 'Sara Tadesse',
              scheduledFor: now + 20 * 60_000,
              note: 'Return missed call about design sync',
              status: 'pending',
              notifiedAt: null,
              createdAt: now,
            },
          ]
        : [];

    if (newSchedules.length > 0) {
      setScheduledCalls((prev) => (prev.length > 0 ? prev : newSchedules));
    }

    if (newProfiles.length > 0 || newSchedules.length > 0) {
      const writes = [
        ...newProfiles.map((p) => {
          const docId = toFirestoreDocId(p.key);
          return {
            pathSegments: ['users', user.uid, 'contacts', docId] as [string, string, string, string],
            data: serializeContactForFirestore(user.uid, p),
          };
        }),
        ...newSchedules.map((sc) => {
          const docId = toFirestoreDocId(sc.id);
          return {
            pathSegments: ['users', user.uid, 'scheduledCalls', docId] as [string, string, string, string],
            data: serializeScheduledCallForFirestore(user.uid, sc),
          };
        }),
      ];
      void ensureWorkspaceReady(user.uid)
        .then(() => commitBatchWrites(writes))
        .catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`),
        );
    }

    return counts;
  }, [commitBatchWrites, ensureWorkspaceReady, importCalls, requireSignedInUser]);

  const patchCall = useCallback(
    (id: string, patch: CallPatch) => {
      const user = requireSignedInUser();
      if (!user) return;
      triggerHaptic('success');
      const existingCall = stateRef.current.calls.find((c) => c.id === id);
      const updated = existingCall ? { ...existingCall, ...patch } : null;
      setCalls((prev) => prev.map((call) => (call.id === id ? { ...call, ...patch } : call)));
      if (updated) {
        const docId = toFirestoreDocId(id);
        void ensureWorkspaceReady(user.uid)
          .then(() =>
            setDoc(
              doc(db, 'users', user.uid, 'calls', docId),
              serializeCallForFirestore(user.uid, updated),
            ),
          )
          .catch((err) =>
            handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/calls/${docId}`),
          );
      }
    },
    [ensureWorkspaceReady, requireSignedInUser],
  );

  const removeCall = useCallback(
    (id: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      triggerHaptic('warning');
      setCalls((prev) => prev.filter((call) => call.id !== id));
      const docId = toFirestoreDocId(id);
      void ensureWorkspaceReady(user.uid)
        .then(() => deleteDoc(doc(db, 'users', user.uid, 'calls', docId)))
        .catch((err) =>
          handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/calls/${docId}`),
        );
    },
    [ensureWorkspaceReady, requireSignedInUser],
  );

  const clearCalls = useCallback(() => {
    const user = requireSignedInUser();
    if (!user) return;
    const prevCalls = stateRef.current.calls;
    setCalls([]);
    setDismissedMissedArray([]);
    showNotice('Call history cleared.', 'warning');

    void persistWorkspaceToCloud(user, { dismissedMissedArray: [] });
    const CHUNK = 350;
    void (async () => {
      await ensureWorkspaceReady(user.uid);
      for (let i = 0; i < prevCalls.length; i += CHUNK) {
        const batch = writeBatch(db);
        prevCalls.slice(i, i + CHUNK).forEach((c) => {
          batch.delete(doc(db, 'users', user.uid, 'calls', toFirestoreDocId(c.id)));
        });
        await batch.commit();
      }
    })().catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/calls`),
    );
  }, [ensureWorkspaceReady, persistWorkspaceToCloud, requireSignedInUser, showNotice]);

  const mergeContacts = useCallback(
    (sourceNumber: string, targetNumber: string, targetName: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      const sourceNorm = normaliseEthPhone(sourceNumber);
      const cleanTargetNumber = targetNumber.trim();
      const cleanName = targetName.trim() || null;
      const changedCalls: CallRecord[] = [];

      setCalls((prev) =>
        prev.map((call) => {
          if (
            call.number === sourceNumber ||
            normaliseEthPhone(call.number) === sourceNorm
          ) {
            const next = {
              ...call,
              number: cleanTargetNumber,
              name: cleanName ?? call.name,
            };
            changedCalls.push(next);
            return next;
          }
          if (call.number === cleanTargetNumber && cleanName && !call.name) {
            const next = { ...call, name: cleanName };
            changedCalls.push(next);
            return next;
          }
          return call;
        }),
      );

      if (changedCalls.length > 0) {
        const writes = changedCalls.map((c) => ({
          pathSegments: ['users', user.uid, 'calls', toFirestoreDocId(c.id)] as [
            string,
            string,
            string,
            string,
          ],
          data: serializeCallForFirestore(user.uid, c),
        }));
        void ensureWorkspaceReady(user.uid)
          .then(() => commitBatchWrites(writes))
          .catch((err) =>
            handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/calls`),
          );
      }

      showNotice(`Merged into ${cleanName ?? cleanTargetNumber}.`, 'success');
    },
    [commitBatchWrites, ensureWorkspaceReady, requireSignedInUser, showNotice],
  );

  const upsertContactProfile = useCallback(
    (profile: ContactProfile) => {
      const user = requireSignedInUser();
      if (!user) return;
      triggerHaptic('success');
      const key = profile.key || getContactKey(profile.number);
      const cleanProfile: ContactProfile = healContactProfile({
        ...profile,
        key,
        updatedAt: Date.now(),
      });
      setContacts((prev) => ({ ...prev, [key]: cleanProfile }));

      const updatedCalls: CallRecord[] = [];
      setCalls((prev) =>
        prev.map((call) => {
          if (getContactKey(call.number) !== key) return call;
          const next = {
            ...call,
            name: cleanProfile.name.trim() || call.name,
            tag: cleanProfile.tag.trim() || call.tag,
          };
          updatedCalls.push(next);
          return next;
        }),
      );

      const contactDocId = toFirestoreDocId(key);
      void ensureWorkspaceReady(user.uid)
        .then(() =>
          setDoc(
            doc(db, 'users', user.uid, 'contacts', contactDocId),
            serializeContactForFirestore(user.uid, cleanProfile),
          ),
        )
        .catch((err) =>
          handleFirestoreError(
            err,
            OperationType.WRITE,
            `users/${user.uid}/contacts/${contactDocId}`,
          ),
        );
      if (updatedCalls.length > 0) {
        void ensureWorkspaceReady(user.uid)
          .then(() =>
            commitBatchWrites(
              updatedCalls.map((c) => ({
                pathSegments: ['users', user.uid, 'calls', toFirestoreDocId(c.id)],
                data: serializeCallForFirestore(user.uid, c),
              })),
            ),
          )
          .catch((err) =>
            handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/calls`),
          );
      }
    },
    [commitBatchWrites, ensureWorkspaceReady, requireSignedInUser],
  );

  const removeContactProfile = useCallback(
    (keyOrNumber: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      const current = stateRef.current.contacts;
      const key = current[keyOrNumber] ? keyOrNumber : getContactKey(keyOrNumber);
      if (!current[key]) return;

      setContacts((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });

      const contactDocId = toFirestoreDocId(key);
      void ensureWorkspaceReady(user.uid)
        .then(() => deleteDoc(doc(db, 'users', user.uid, 'contacts', contactDocId)))
        .catch((err) =>
          handleFirestoreError(
            err,
            OperationType.DELETE,
            `users/${user.uid}/contacts/${contactDocId}`,
          ),
        );
      showNotice('Contact removed.', 'warning');
    },
    [ensureWorkspaceReady, requireSignedInUser, showNotice],
  );

  const getContactProfile = useCallback(
    (number: string): ContactProfile | null => {
      const key = getContactKey(number);
      return contacts[key] ?? null;
    },
    [contacts],
  );

  const scheduleCall = useCallback(
    (input: ScheduleCallInput): ScheduledCall => {
      const number = input.number.trim();
      const key = getContactKey(number);
      const resolvedName = input.name?.trim() || contacts[key]?.name || null;
      const item: ScheduledCall = {
        id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        number,
        name: resolvedName,
        scheduledFor: input.scheduledFor,
        note: input.note?.trim() || null,
        sourceCallId: input.sourceCallId ?? null,
        status: 'pending',
        notifiedAt: null,
        createdAt: Date.now(),
      };
      const user = requireSignedInUser();
      if (!user) return item;

      setScheduledCalls((prev) =>
        [item, ...prev].sort((a, b) => a.scheduledFor - b.scheduledFor),
      );
      let nextDismissed = stateRef.current.dismissedMissedArray;
      if (input.sourceCallId && !nextDismissed.includes(input.sourceCallId)) {
        nextDismissed = [...nextDismissed, input.sourceCallId];
        setDismissedMissedArray(nextDismissed);
      }

      const docId = toFirestoreDocId(item.id);
      void ensureWorkspaceReady(user.uid)
        .then(() =>
          setDoc(
            doc(db, 'users', user.uid, 'scheduledCalls', docId),
            serializeScheduledCallForFirestore(user.uid, item),
          ),
        )
        .catch((err) =>
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `users/${user.uid}/scheduledCalls/${docId}`,
          ),
        );
      if (input.sourceCallId) {
        void persistWorkspaceToCloud(user, { dismissedMissedArray: nextDismissed });
      }

      if (
        notificationsEnabled &&
        !isWithinQuietHours(reminderPrefs) &&
        isNativeCapacitor() &&
        hasNativeNotificationsPlugin()
      ) {
        void scheduleNativeNotification(
          item.id,
          `Call reminder: ${resolvedName || number}`,
          item.note || `Scheduled call to ${number}`,
          item.scheduledFor,
        );
      }

      showNotice(`Scheduled call with ${resolvedName || number}.`, 'success');
      return item;
    },
    [
      contacts,
      ensureWorkspaceReady,
      notificationsEnabled,
      persistWorkspaceToCloud,
      reminderPrefs,
      requireSignedInUser,
      showNotice,
    ],
  );

  const completeScheduledCall = useCallback(
    (id: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      if (isNativeCapacitor() && hasNativeNotificationsPlugin()) {
        void cancelNativeNotification(id);
      }
      const existingItem = stateRef.current.scheduledCalls.find((item) => item.id === id);
      const updatedItem: ScheduledCall | null = existingItem
        ? { ...existingItem, status: 'completed' }
        : null;
      setScheduledCalls((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'completed' } : item)),
      );
      if (updatedItem) {
        const docId = toFirestoreDocId(id);
        void ensureWorkspaceReady(user.uid)
          .then(() =>
            setDoc(
              doc(db, 'users', user.uid, 'scheduledCalls', docId),
              serializeScheduledCallForFirestore(user.uid, updatedItem),
            ),
          )
          .catch((err) =>
            handleFirestoreError(
              err,
              OperationType.UPDATE,
              `users/${user.uid}/scheduledCalls/${docId}`,
            ),
          );
      }
      showNotice('Scheduled call marked done.', 'success');
    },
    [ensureWorkspaceReady, requireSignedInUser, showNotice],
  );

  const snoozeScheduledCall = useCallback(
    (id: string, minutes: number) => {
      const user = requireSignedInUser();
      if (!user) return;
      const nextTime = Date.now() + minutes * 60_000;
      const existingItem = stateRef.current.scheduledCalls.find((item) => item.id === id);
      const updatedItem: ScheduledCall | null = existingItem
        ? {
            ...existingItem,
            scheduledFor: nextTime,
            status: 'pending' as const,
            notifiedAt: null,
          }
        : null;
      setScheduledCalls((prev) =>
        prev
          .map((item) =>
            item.id === id
              ? {
                  ...item,
                  scheduledFor: nextTime,
                  status: 'pending' as const,
                  notifiedAt: null,
                }
              : item,
          )
          .sort((a, b) => a.scheduledFor - b.scheduledFor),
      );
      if (
        updatedItem &&
        notificationsEnabled &&
        !isWithinQuietHours(reminderPrefs) &&
        isNativeCapacitor() &&
        hasNativeNotificationsPlugin()
      ) {
        void scheduleNativeNotification(
          id,
          `Call reminder: ${updatedItem.name?.trim() || updatedItem.number}`,
          updatedItem.note || `Scheduled call to ${updatedItem.number}`,
          nextTime,
        );
      }
      if (updatedItem) {
        const docId = toFirestoreDocId(id);
        void ensureWorkspaceReady(user.uid)
          .then(() =>
            setDoc(
              doc(db, 'users', user.uid, 'scheduledCalls', docId),
              serializeScheduledCallForFirestore(user.uid, updatedItem),
            ),
          )
          .catch((err) =>
            handleFirestoreError(
              err,
              OperationType.UPDATE,
              `users/${user.uid}/scheduledCalls/${docId}`,
            ),
          );
      }
      showNotice(`Snoozed reminder by ${minutes} minutes.`, 'tap');
    },
    [
      ensureWorkspaceReady,
      notificationsEnabled,
      reminderPrefs,
      requireSignedInUser,
      showNotice,
    ],
  );

  const removeScheduledCall = useCallback(
    (id: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      if (isNativeCapacitor() && hasNativeNotificationsPlugin()) {
        void cancelNativeNotification(id);
      }
      setScheduledCalls((prev) => prev.filter((item) => item.id !== id));
      const docId = toFirestoreDocId(id);
      void ensureWorkspaceReady(user.uid)
        .then(() => deleteDoc(doc(db, 'users', user.uid, 'scheduledCalls', docId)))
        .catch((err) =>
          handleFirestoreError(
            err,
            OperationType.DELETE,
            `users/${user.uid}/scheduledCalls/${docId}`,
          ),
        );
      showNotice('Scheduled call removed.', 'warning');
    },
    [ensureWorkspaceReady, requireSignedInUser, showNotice],
  );

  const dismissMissedCall = useCallback(
    (id: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      const current = stateRef.current.dismissedMissedArray;
      if (current.includes(id)) return;
      triggerHaptic('tap');
      const next = [...current, id];
      setDismissedMissedArray(next);
      void persistWorkspaceToCloud(user, { dismissedMissedArray: next });
    },
    [persistWorkspaceToCloud, requireSignedInUser],
  );

  const setTariffs = useCallback(
    (next: TariffConfig) => {
      const user = requireSignedInUser();
      if (!user) return;
      const clean = sanitizeTariffs(next);
      setTariffsState(clean);
      void persistWorkspaceToCloud(user, { tariffs: clean });
      showNotice('Tariff settings saved.', 'success');
    },
    [persistWorkspaceToCloud, requireSignedInUser, showNotice],
  );

  const setSimLabels = useCallback(
    (next: SimLabels) => {
      const user = requireSignedInUser();
      if (!user) return;
      const clean = sanitizeSimLabels(next);
      setSimLabelsState(clean);
      void persistWorkspaceToCloud(user, { simLabels: clean });
      showNotice('SIM labels saved.', 'success');
    },
    [persistWorkspaceToCloud, requireSignedInUser, showNotice],
  );

  const setCalendarPrefs = useCallback(
    (next: CalendarPrefs) => {
      const user = requireSignedInUser();
      if (!user) return;
      const clean = sanitizeCalendarPrefs(next);
      setCalendarPrefsState(clean);
      void persistWorkspaceToCloud(user, { calendarPrefs: clean });
      showNotice('Calendar defaults saved.', 'success');
    },
    [persistWorkspaceToCloud, requireSignedInUser, showNotice],
  );

  const setReminderPrefs = useCallback(
    (next: ReminderPrefs) => {
      const user = requireSignedInUser();
      if (!user) return;
      const clean = sanitizeReminderPrefs(next);
      setReminderPrefsState(clean);
      void persistWorkspaceToCloud(user, { reminderPrefs: clean });
      showNotice('Reminder timing saved.', 'success');
    },
    [persistWorkspaceToCloud, requireSignedInUser, showNotice],
  );

  const setVoiceBundles = useCallback(
    (next: VoiceBundles) => {
      const user = requireSignedInUser();
      if (!user) return;
      const clean = sanitizeVoiceBundles(next);
      setVoiceBundlesState(clean);
      void persistWorkspaceToCloud(user, { voiceBundles: clean });
      showNotice('Voice bundle tracker updated.', 'success');
    },
    [persistWorkspaceToCloud, requireSignedInUser, showNotice],
  );

  const setNotificationsEnabled = useCallback(
    (enabled: boolean) => {
      const user = requireSignedInUser();
      if (!user) return;
      triggerHaptic('tap');
      setNotificationsEnabledState(enabled);
      void persistWorkspaceToCloud(user, { notificationsEnabled: enabled });
    },
    [persistWorkspaceToCloud, requireSignedInUser],
  );

  const toggleFavorite = useCallback(
    (number: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      triggerHaptic('tap');
      const key = getContactKey(number);
      const prev = stateRef.current.favoritesArray;
      const hasRaw = prev.includes(number);
      const hasKey = prev.some((item) => getContactKey(item) === key);
      const next =
        hasRaw || hasKey
          ? prev.filter((item) => item !== number && getContactKey(item) !== key)
          : [number, ...prev];
      setFavoritesArray(next);
      void persistWorkspaceToCloud(user, { favoritesArray: next });
    },
    [persistWorkspaceToCloud, requireSignedInUser],
  );

  const setThemeMode = useCallback(
    (mode: ThemePreference) => {
      triggerHaptic('tap');
      setThemePreferenceState(mode);
      const resolvedNext: ThemeMode =
        mode === 'system' ? (systemIsDark ? 'dark-gray' : 'light') : mode;
      const user = auth.currentUser;
      if (user) void persistWorkspaceToCloud(user, { theme: resolvedNext });
    },
    [persistWorkspaceToCloud, systemIsDark],
  );

  const toggleTheme = useCallback(() => {
    triggerHaptic('tap');
    const isCurrentlyDark = stateRef.current.theme === 'dark-gray';
    const next: ThemeMode = isCurrentlyDark ? 'light' : 'dark-gray';
    setThemePreferenceState(next);
    const user = auth.currentUser;
    if (user) void persistWorkspaceToCloud(user, { theme: next });
  }, [persistWorkspaceToCloud]);

  const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);
  const dismissedMissedIds = useMemo(
    () => new Set(dismissedMissedArray),
    [dismissedMissedArray],
  );
  const pinEnabled = Boolean(pinHash);
  const needsEmailVerification = Boolean(authUser && !authUser.emailVerified);
  const authProvider = useMemo<AuthProviderType | null>(
    () => (authUser ? detectAuthProvider(authUser) : null),
    [authUser],
  );
  const isAdmin = Boolean(
    authUser?.emailVerified && authUser.email?.toLowerCase() === ADMIN_EMAIL,
  );

  const value = useMemo<CallsContextValue>(
    () => ({
      calls,
      contacts,
      scheduledCalls,
      favorites,
      dismissedMissedIds,
      tariffs,
      simLabels,
      calendarPrefs,
      reminderPrefs,
      voiceBundles,
      theme,
      themePreference,
      systemIsDark,
      fontSizeScale,
      setFontSizeScale,
      profileName,
      notificationsEnabled,
      notificationPermission,
      refreshNotificationPermission,
      requestAlertPermissions,
      sendTestAlertNotification,
      privacyMode,
      pinEnabled,
      isLocked,
      authUser,
      authLoading,
      isGuest,
      needsEmailVerification,
      authProvider,
      userPhone,
      passwordHint,
      authPromptMode,
      authPromptReason,
      openAuthPrompt,
      closeAuthPrompt,
      enterGuestMode,
      exitGuestMode,
      isAdmin,
      syncStatus,
      lastSyncedAt,
      notice,
      showNotice,
      signInWithGoogle,
      signInWithEmail,
      createAccountWithEmail,
      resendVerificationEmail,
      checkEmailVerification,
      sendPasswordReset,
      signOutAccount,
      syncNow,
      canSyncPhoneCalls,
      syncPhoneCalls,
      fetchRegisteredUsers,
      setAppPin,
      clearAppPin,
      unlockWithPin,
      lockApp,
      setPrivacyMode,
      togglePrivacyMode,
      importCalls,
      loadSampleData,
      patchCall,
      removeCall,
      clearCalls,
      mergeContacts,
      upsertContactProfile,
      removeContactProfile,
      importContactProfiles,
      getContactProfile,
      scheduleCall,
      completeScheduledCall,
      snoozeScheduledCall,
      removeScheduledCall,
      dismissMissedCall,
      setTariffs,
      setSimLabels,
      setCalendarPrefs,
      setReminderPrefs,
      setVoiceBundles,
      setNotificationsEnabled,
      toggleFavorite,
      setThemeMode,
      toggleTheme,
    }),
    [
      calls,
      contacts,
      scheduledCalls,
      favorites,
      dismissedMissedIds,
      tariffs,
      simLabels,
      calendarPrefs,
      reminderPrefs,
      voiceBundles,
      theme,
      themePreference,
      systemIsDark,
      fontSizeScale,
      setFontSizeScale,
      profileName,
      notificationsEnabled,
      notificationPermission,
      refreshNotificationPermission,
      requestAlertPermissions,
      sendTestAlertNotification,
      privacyMode,
      pinEnabled,
      isLocked,
      authUser,
      authLoading,
      isGuest,
      needsEmailVerification,
      authProvider,
      userPhone,
      passwordHint,
      authPromptMode,
      authPromptReason,
      openAuthPrompt,
      closeAuthPrompt,
      enterGuestMode,
      exitGuestMode,
      isAdmin,
      syncStatus,
      lastSyncedAt,
      notice,
      showNotice,
      signInWithGoogle,
      signInWithEmail,
      createAccountWithEmail,
      resendVerificationEmail,
      checkEmailVerification,
      sendPasswordReset,
      signOutAccount,
      syncNow,
      canSyncPhoneCalls,
      syncPhoneCalls,
      fetchRegisteredUsers,
      setAppPin,
      clearAppPin,
      unlockWithPin,
      lockApp,
      setPrivacyMode,
      togglePrivacyMode,
      importCalls,
      loadSampleData,
      patchCall,
      removeCall,
      clearCalls,
      mergeContacts,
      upsertContactProfile,
      removeContactProfile,
      importContactProfiles,
      getContactProfile,
      scheduleCall,
      completeScheduledCall,
      snoozeScheduledCall,
      removeScheduledCall,
      dismissMissedCall,
      setTariffs,
      setSimLabels,
      setCalendarPrefs,
      setReminderPrefs,
      setVoiceBundles,
      setNotificationsEnabled,
      toggleFavorite,
      setThemeMode,
      toggleTheme,
    ],
  );

  return <CallsContext.Provider value={value}>{children}</CallsContext.Provider>;
}

export function useCalls(): CallsContextValue {
  const ctx = useContext(CallsContext);
  if (!ctx) throw new Error('useCalls must be used within CallsProvider');
  return ctx;
}
