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
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  type NotificationActionEvent,
  type NotificationMeta,
  acknowledgeNativeSyncedCalls,
  cancelNativeNotification,
  fetchNativeRecentCalls,
  getCallLogSyncPermissionStatus,
  getNativeNotificationPermission,
  hasNativeCallLogPlugin,
  hasNativeCallLogSyncPlugin,
  hasNativeGoogleAuth,
  hasNativeNotificationsPlugin,
  isNativeCapacitor,
  requestNativeNotificationPermission,
  runNativeGoogleSignIn,
  runNativeSignOut,
  scheduleNativeNotification,
  showNativeNotification,
  subscribeNativeCallLog,
  subscribeNativeNotificationActions,
  syncNativeCallLogIncremental,
  syncNativeStatusBar,
  updateNativeMissedCallSettings,
} from '@/src/lib/capacitor';
import {
  DEFAULT_RELATIONSHIP_TAGS,
  buildSampleContactProfiles,
  getContactKey,
  getUpcomingContactEvents,
  mergeTagOptions,
} from '@/src/lib/contacts';
import {
  buildBirthdayWish,
  buildHolidayWish,
  getHolidaysInGregorianYearOrUpcoming,
} from '@/src/lib/ethiopianCalendar';
import {
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
} from '@/src/lib/firebase';
import {
  buildCallDedupKey,
  buildSampleCalls,
  mergeCallWithoutOverwrite,
  type ParsedImportPackage,
} from '@/src/lib/import';
import {
  applyDailyAppOpen,
  computeContactStatuses,
  computeScoreFromHistory,
  createTagOrNotePointEntry,
  detectQuickMissedCallbacks,
  eatDateDiffDays,
  getEffectiveStreak,
  mergePointsHistory,
  reconcileBadges,
  reconcileContactMilestones,
  toEatDateString,
} from '@/src/lib/gamification';
import { POINTS_CONFIG } from '@/src/lib/gamificationConstants';
import {
  getEatWeekKey,
  isWithinQuietHours,
  quietContacts,
  quietMessage,
} from '@/src/lib/reminders';
import {
  clearPinLockoutState,
  formatDisplayNameOrPhone,
  getPinLockoutDelayMs,
  hashPin,
  readPinLockoutState,
  verifyPin,
  writePinLockoutState,
} from '@/src/lib/security';
import { GUIDE_SEEN_KEY, WHATS_NEW_SEEN_KEY } from '@/src/lib/appInfo';
import {
  clearLegacyUserLocalStorage,
  idbClearUser,
  idbDeleteScoped,
  idbGetScoped,
  idbSetScoped,
  migrateUserLocalStorageToIdb,
  getScopedWithLegacyMigration,
} from '@/src/lib/idbStorage';
import { triggerHaptic, type HapticKind } from '@/src/lib/haptics';
import {
  DEFAULT_ALERT_TYPE_PREFS,
  DEFAULT_CALENDAR_PREFS,
  DEFAULT_CALLS_TAB_STATE,
  DEFAULT_RECONNECT_PROGRESS,
  DEFAULT_REMINDER_PREFS,
  DEFAULT_SETTINGS_SECTIONS,
  DEFAULT_SIM_LABELS,
  DEFAULT_STREAKS,
  DEFAULT_TARIFFS,
  DEFAULT_VOICE_BUNDLES,
} from '@/src/store/defaults';
import {
  healCallRecord,
  healContactProfile,
  healScheduledCall,
  sanitizeAlertTypePrefs,
  sanitizeBadges,
  sanitizeCalendarPrefs,
  sanitizeCallsTabState,
  sanitizeContactMilestones,
  sanitizeExpandedSettingsSections,
  sanitizePointsHistory,
  sanitizeReconnectProgress,
  sanitizeReminderPrefs,
  sanitizeSentWishes,
  sanitizeSimLabels,
  sanitizeSnoozedQuietUntil,
  sanitizeStreaks,
  sanitizeTariffs,
  sanitizeVoiceBundles,
  sanitizeWishTemplates,
} from '@/src/store/sanitizers';
import type {
  AlertTypePrefs,
  AuthProviderType,
  BadgeRecord,
  CalendarPrefs,
  CallPatch,
  CallRecord,
  CallsTabState,
  ContactMilestoneRecord,
  ContactProfile,
  ContactStreakStatus,
  DailyActiveRecord,
  PointsHistoryEntry,
  ReconnectProgressRecord,
  RegisteredUserRecord,
  ReminderPrefs,
  ScheduledCall,
  SentWishRecord,
  SettingsSectionId,
  SimLabels,
  StreakRecord,
  TabKey,
  VoiceBundles,
  WishChannel,
  WishComposerContext,
  WishTemplateMap,
} from '@/src/types/call';

export { DEFAULT_ALERT_TYPE_PREFS, DEFAULT_CALENDAR_PREFS, DEFAULT_REMINDER_PREFS };

const THEME_KEY = 'callanalyzer.theme.v3';
const LEGACY_THEME_KEY = 'callanalyzer.theme.v2';
const LEGACY_PREFERRED_DARK_THEME_KEY = 'callanalyzer.preferredDarkTheme.v1';
const FONT_SCALE_KEY = 'callanalyzer.fontSize.v1';
const CUSTOM_TAGS_KEY = 'callanalyzer.customTags.v1';

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
  'mutedAlerts',
  'tariffs',
  'simLabels',
  'calendarPrefs',
  'reminderPrefs',
  'voiceBundles',
  'profile',
  'photoUrl',
  'notifications',
  'privacyMode',
  'pinHash',
  'pinLockout',
  'welcomeDismissed',
  'pendingRegistration',
  'streaks',
  'badges',
  'pointsHistory',
  'contactMilestones',
  'callsTabState',
  'wishTemplates',
  'sentWishes',
  'snoozedQuietUntil',
  'reconnectProgress',
  'expandedSettingsSections',
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
  agreedToTerms: boolean;
};

export type AuthActionResult = {
  ok: boolean;
  error?: string;
};

type PendingRegistration = {
  phone: string;
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

const DEVICE_META_SCOPE = '__device__';

type AppSeenMeta = {
  guideSeen: boolean;
  whatsNewVersion: string | null;
};

export type ImportCounts = {
  added: number;
  duplicates: number;
  merged?: number;
  addedIds?: string[];
};

export type BackupRestoreCounts = {
  callsAdded: number;
  callsDuplicates: number;
  callsMerged: number;
  contactsAdded: number;
  contactsUpdated: number;
  scheduledAdded: number;
  tagsAdded: number;
  restoredSections: string[];
};

export type ScheduleCallInput = {
  number: string;
  name?: string | null;
  scheduledFor: number;
  note?: string | null;
  sourceCallId?: string | null;
};

export type UpdateUserProfileInput = {
  displayName: string;
  phone?: string | null;
  photoURL?: string | null;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type NotificationActionTarget = {
  tab?: TabKey;
  openReminders?: 'action' | 'wishes' | 'quiet';
  contactNumber?: string;
};

type CallsContextValue = {
  calls: CallRecord[];
  contacts: Record<string, ContactProfile>;
  scheduledCalls: ScheduledCall[];
  favorites: Set<string>;
  dismissedMissedIds: Set<string>;
  mutedAlertKeys: string[];
  mutedAlertSet: Set<string>;
  tariffs: TariffConfig;
  simLabels: SimLabels;
  calendarPrefs: CalendarPrefs;
  reminderPrefs: ReminderPrefs;
  alertTypePrefs: AlertTypePrefs;
  setAlertTypePrefs: (next: AlertTypePrefs) => void;
  alertSnoozedDate: string | null;
  isAlertsSnoozedToday: boolean;
  snoozeAlertsForToday: () => void;
  resumeSnoozedAlertsToday: () => void;
  readAlertKeys: string[];
  readAlertSet: Set<string>;
  markAllAlertsRead: (keys: string[]) => void;
  guideSeen: boolean;
  whatsNewSeenVersion: string | null;
  seenMetaReady: boolean;
  markGuideSeen: () => void;
  markWhatsNewSeen: (version: string) => void;
  voiceBundles: VoiceBundles;
  theme: ThemeMode;
  themePreference: ThemePreference;
  systemIsDark: boolean;
  fontSizeScale: FontSizeScale;
  setFontSizeScale: (scale: FontSizeScale) => void;
  profileName: string;
  userPhotoUrl: string | null;
  notificationsEnabled: boolean;
  notificationPermission: NotificationPermissionStatus;
  refreshNotificationPermission: () => Promise<NotificationPermissionStatus>;
  requestAlertPermissions: () => Promise<NotificationPermissionStatus>;
  sendTestAlertNotification: (customBody?: string, delaySeconds?: number) => Promise<boolean>;
  pinEnabled: boolean;
  isLocked: boolean;
  pinLockoutUntil: number;
  authUser: User | null;
  authLoading: boolean;
  isGuest: boolean;
  needsEmailVerification: boolean;
  authProvider: AuthProviderType | null;
  userPhone: string | null;
  notificationActionTarget: NotificationActionTarget | null;
  clearNotificationActionTarget: () => void;
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
  deleteAllLocalData: () => Promise<void>;
  syncNow: () => Promise<void>;
  canSyncPhoneCalls: boolean;
  syncPhoneCalls: (options?: { fullResync?: boolean }) => Promise<void>;
  fetchRegisteredUsers: () => Promise<RegisteredUserRecord[]>;
  fetchDailyActiveRecords: () => Promise<DailyActiveRecord[]>;
  setAppPin: (pin: string) => Promise<void>;
  clearAppPin: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lockApp: () => void;
  availableTags: string[];
  customTags: string[];
  streaks: StreakRecord;
  effectiveStreaks: StreakRecord;
  badges: BadgeRecord[];
  pointsHistory: PointsHistoryEntry[];
  score: number;
  contactStatuses: Record<string, ContactStreakStatus>;
  topContactStatuses: ContactStreakStatus[];
  contactMilestones: ContactMilestoneRecord[];
  pendingMilestoneCelebration: ContactMilestoneRecord | null;
  markContactMilestoneCelebrated: (milestoneId: string) => void;
  dismissAllPendingMilestones: () => void;
  rebuildScore: () => number;
  unseenNewCallIds: string[];
  sessionNewCallIds: Set<string>;
  markCallsTabOpened: () => void;
  markCallSeen: (callId: string) => void;
  clearSessionNewCalls: () => void;
  addCustomTag: (tag: string) => string;
  importCalls: (records: CallRecord[]) => ImportCounts;
  importBackupPackage: (pkg: ParsedImportPackage) => BackupRestoreCounts;
  loadSampleData: () => ImportCounts;
  patchCall: (id: string, patch: CallPatch, options?: { applyTagToContact?: boolean }) => void;
  removeCall: (id: string) => void;
  clearCalls: () => void;
  mergeContacts: (sourceNumber: string, targetNumber: string, targetName: string) => void;
  upsertContactProfile: (profile: ContactProfile) => void;
  removeContactProfile: (keyOrNumber: string) => void;
  importContactProfiles: (profiles: ContactProfile[]) => { added: number; updated: number };
  getContactProfile: (number: string) => ContactProfile | null;
  scheduleCall: (input: ScheduleCallInput) => ScheduledCall;
  completeScheduledCall: (id: string) => void;
  snoozeScheduledCall: (
    id: string,
    minutes: number,
    customNextTime?: number,
    skipNativeAlarm?: boolean,
  ) => void;
  removeScheduledCall: (id: string) => void;
  dismissMissedCall: (id: string) => void;
  muteAlertKey: (key: string) => void;
  unmuteAlertKey: (key: string) => void;
  updateUserProfile: (input: UpdateUserProfileInput) => Promise<AuthActionResult>;
  changeUserPassword: (input: ChangePasswordInput) => Promise<AuthActionResult>;
  setTariffs: (next: TariffConfig) => void;
  setSimLabels: (next: SimLabels) => void;
  setCalendarPrefs: (next: CalendarPrefs) => void;
  setReminderPrefs: (next: ReminderPrefs) => void;
  setVoiceBundles: (next: VoiceBundles) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  toggleFavorite: (number: string) => void;
  setThemeMode: (mode: ThemePreference) => void;
  toggleTheme: () => void;
  wishTemplates: WishTemplateMap;
  sentWishes: SentWishRecord[];
  snoozedQuietUntil: Record<string, number>;
  reconnectProgress: ReconnectProgressRecord;
  expandedSettingsSections: SettingsSectionId[];
  setExpandedSettingsSections: (sections: SettingsSectionId[]) => void;
  wishComposerRequest: WishComposerContext | null;
  openWishComposer: (ctx: WishComposerContext) => void;
  closeWishComposer: () => void;
  saveWishTemplate: (templateKey: string, templateText: string) => void;
  recordWishOpened: (input: {
    contactKey: string;
    occasionKey: string;
    year: number;
    channel: WishChannel;
    occasionName?: string;
    contactName?: string;
  }) => { awardedPoints: number };
  snoozeQuietContact: (contactKey: string, durationMs: number | null) => void;
  recordQuietReconnect: (contactKey: string, contactLabel?: string) => { awardedPoints: number };
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

async function clearUserScopedStorage(uid: string): Promise<void> {
  await idbClearUser(uid);
  clearLegacyUserLocalStorage(uid);
  SCOPED_SUFFIXES.forEach((suffix) => removeStorageKey(userStorageKey(uid, suffix)));
}

type ScopedUserSnapshot = {
  calls: CallRecord[];
  contacts: Record<string, ContactProfile>;
  scheduledCalls: ScheduledCall[];
  favoritesArray: string[];
  dismissedMissedArray: string[];
  mutedAlertKeys: string[];
  tariffs: TariffConfig;
  simLabels: SimLabels;
  calendarPrefs: CalendarPrefs;
  reminderPrefs: ReminderPrefs;
  alertTypePrefs: AlertTypePrefs;
  alertSnoozedDate: string | null;
  readAlertKeys: string[];
  voiceBundles: VoiceBundles;
  profileName: string;
  userPhotoUrl: string | null;
  notificationsEnabled: boolean;
  pinHash: string;
  streaks: StreakRecord;
  badges: BadgeRecord[];
  pointsHistory: PointsHistoryEntry[];
  contactMilestones: ContactMilestoneRecord[];
  callsTabState: CallsTabState;
  wishTemplates: WishTemplateMap;
  sentWishes: SentWishRecord[];
  snoozedQuietUntil: Record<string, number>;
  reconnectProgress: ReconnectProgressRecord;
  expandedSettingsSections: SettingsSectionId[];
};

type HydratedScopedUserData = {
  snapshot: ScopedUserSnapshot;
  pendingReg: PendingRegistration | null;
};

function createEmptySnapshot(): ScopedUserSnapshot {
  return {
    calls: [],
    contacts: {},
    scheduledCalls: [],
    favoritesArray: [],
    dismissedMissedArray: [],
    mutedAlertKeys: [],
    tariffs: { ...DEFAULT_TARIFFS },
    simLabels: { ...DEFAULT_SIM_LABELS },
    calendarPrefs: { ...DEFAULT_CALENDAR_PREFS },
    reminderPrefs: { ...DEFAULT_REMINDER_PREFS },
    alertTypePrefs: { ...DEFAULT_ALERT_TYPE_PREFS },
    alertSnoozedDate: null,
    readAlertKeys: [],
    voiceBundles: sanitizeVoiceBundles(DEFAULT_VOICE_BUNDLES),
    profileName: '',
    userPhotoUrl: null,
    notificationsEnabled: true,
    pinHash: '',
    streaks: { ...DEFAULT_STREAKS },
    badges: [],
    pointsHistory: [],
    contactMilestones: [],
    callsTabState: { ...DEFAULT_CALLS_TAB_STATE },
    wishTemplates: {},
    sentWishes: [],
    snoozedQuietUntil: {},
    reconnectProgress: { ...DEFAULT_RECONNECT_PROGRESS, weekKey: getEatWeekKey() },
    expandedSettingsSections: [...DEFAULT_SETTINGS_SECTIONS],
  };
}

async function readScopedUserStateAsync(uid: string): Promise<HydratedScopedUserData> {
  const data = await migrateUserLocalStorageToIdb(uid);
  const pick = <T,>(key: string, fallback: T): T =>
    Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined
      ? (data[key] as T)
      : fallback;

  const rawContacts = pick<Record<string, ContactProfile>>('contacts', {});
  const healedContacts: Record<string, ContactProfile> = {};
  if (rawContacts && typeof rawContacts === 'object') {
    Object.entries(rawContacts).forEach(([k, profile]) => {
      if (profile && typeof profile === 'object') {
        healedContacts[k] = healContactProfile(profile);
      }
    });
  }

  const rawCalls = pick<CallRecord[]>('calls', []);
  const rawScheduled = pick<ScheduledCall[]>('scheduledCalls', []);
  const rawFavorites = pick<string[]>('favorites', []);
  const rawDismissed = pick<string[]>('dismissedMissed', []);
  const rawMuted = pick<string[]>('mutedAlerts', []);
  const rawProfile = pick<string>('profile', '');
  const rawPhoto = pick<string | null>('photoUrl', null);
  const rawPinHash = pick<string>('pinHash', '');
  const rawStreaks = pick<StreakRecord>('streaks', DEFAULT_STREAKS);
  const rawBadges = pick<BadgeRecord[]>('badges', []);
  const rawPointsHistory = pick<PointsHistoryEntry[]>('pointsHistory', []);
  const rawContactMilestones = pick<ContactMilestoneRecord[]>('contactMilestones', []);
  const rawCallsTabState = pick<CallsTabState>('callsTabState', DEFAULT_CALLS_TAB_STATE);
  const rawAlertTypePrefs = pick<Partial<AlertTypePrefs>>('alertTypePrefs', {});
  const rawAlertSnoozedDate = pick<string | null>('alertSnoozedDate', null);
  const rawReadAlertKeys = pick<string[]>('readAlertKeys', []);
  const rawWishTemplates = pick<WishTemplateMap>('wishTemplates', {});
  const rawSentWishes = pick<SentWishRecord[]>('sentWishes', []);
  const rawSnoozedQuietUntil = pick<Record<string, number>>('snoozedQuietUntil', {});
  const rawReconnectProgress = pick<ReconnectProgressRecord>(
    'reconnectProgress',
    DEFAULT_RECONNECT_PROGRESS,
  );
  const rawExpandedSections = pick<SettingsSectionId[]>(
    'expandedSettingsSections',
    DEFAULT_SETTINGS_SECTIONS,
  );
  const rawPendingReg = pick<PendingRegistration | null>('pendingRegistration', null);
  const pendingReg =
    rawPendingReg && typeof rawPendingReg === 'object' && typeof rawPendingReg.phone === 'string'
      ? rawPendingReg
      : null;

  return {
    snapshot: {
      calls: Array.isArray(rawCalls) ? rawCalls.map(healCallRecord) : [],
      contacts: healedContacts,
      scheduledCalls: Array.isArray(rawScheduled) ? rawScheduled.map(healScheduledCall) : [],
      favoritesArray: Array.isArray(rawFavorites) ? rawFavorites : [],
      dismissedMissedArray: Array.isArray(rawDismissed) ? rawDismissed : [],
      mutedAlertKeys: Array.isArray(rawMuted) ? rawMuted : [],
      tariffs: sanitizeTariffs({
        ...DEFAULT_TARIFFS,
        ...(pick<Partial<TariffConfig>>('tariffs', {}) || {}),
      }),
      simLabels: sanitizeSimLabels({
        ...DEFAULT_SIM_LABELS,
        ...(pick<Partial<SimLabels>>('simLabels', {}) || {}),
      }),
      calendarPrefs: sanitizeCalendarPrefs({
        ...DEFAULT_CALENDAR_PREFS,
        ...(pick<Partial<CalendarPrefs>>('calendarPrefs', {}) || {}),
      }),
      reminderPrefs: sanitizeReminderPrefs({
        ...DEFAULT_REMINDER_PREFS,
        ...(pick<Partial<ReminderPrefs>>('reminderPrefs', {}) || {}),
      }),
      alertTypePrefs: sanitizeAlertTypePrefs(rawAlertTypePrefs),
      alertSnoozedDate:
        typeof rawAlertSnoozedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawAlertSnoozedDate)
          ? rawAlertSnoozedDate
          : null,
      readAlertKeys: Array.isArray(rawReadAlertKeys)
        ? Array.from(
            new Set(
              rawReadAlertKeys.filter((k): k is string => typeof k === 'string' && k.trim().length > 0),
            ),
          ).slice(0, 600)
        : [],
      voiceBundles: sanitizeVoiceBundles(
        pick<Partial<VoiceBundles>>('voiceBundles', DEFAULT_VOICE_BUNDLES),
      ),
      profileName: typeof rawProfile === 'string' ? rawProfile : '',
      userPhotoUrl: typeof rawPhoto === 'string' ? rawPhoto : null,
      notificationsEnabled: Boolean(pick<boolean>('notifications', true)),
      pinHash: typeof rawPinHash === 'string' ? rawPinHash : '',
      streaks: sanitizeStreaks(rawStreaks),
      badges: sanitizeBadges(rawBadges),
      pointsHistory: sanitizePointsHistory(rawPointsHistory),
      contactMilestones: sanitizeContactMilestones(rawContactMilestones),
      callsTabState: sanitizeCallsTabState(rawCallsTabState),
      wishTemplates: sanitizeWishTemplates(rawWishTemplates),
      sentWishes: sanitizeSentWishes(rawSentWishes),
      snoozedQuietUntil: sanitizeSnoozedQuietUntil(rawSnoozedQuietUntil),
      reconnectProgress: sanitizeReconnectProgress(rawReconnectProgress),
      expandedSettingsSections: sanitizeExpandedSettingsSections(rawExpandedSections),
    },
    pendingReg,
  };
}

export function CallsProvider({ children }: { children: ReactNode }) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [contacts, setContacts] = useState<Record<string, ContactProfile>>({});
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [favoritesArray, setFavoritesArray] = useState<string[]>([]);
  const [dismissedMissedArray, setDismissedMissedArray] = useState<string[]>([]);
  const [mutedAlertKeys, setMutedAlertKeys] = useState<string[]>([]);
  const [tariffs, setTariffsState] = useState<TariffConfig>({ ...DEFAULT_TARIFFS });
  const [simLabels, setSimLabelsState] = useState<SimLabels>({ ...DEFAULT_SIM_LABELS });
  const [calendarPrefs, setCalendarPrefsState] = useState<CalendarPrefs>({
    ...DEFAULT_CALENDAR_PREFS,
  });
  const [reminderPrefs, setReminderPrefsState] = useState<ReminderPrefs>({
    ...DEFAULT_REMINDER_PREFS,
  });
  const [alertTypePrefs, setAlertTypePrefsState] = useState<AlertTypePrefs>({
    ...DEFAULT_ALERT_TYPE_PREFS,
  });
  const [alertSnoozedDate, setAlertSnoozedDate] = useState<string | null>(null);
  const [readAlertKeys, setReadAlertKeys] = useState<string[]>([]);
  const [todayEat, setTodayEat] = useState<string>(() => toEatDateString());
  const [seenMetaReady, setSeenMetaReady] = useState<boolean>(false);
  const [guideSeen, setGuideSeen] = useState<boolean>(false);
  const [whatsNewSeenVersion, setWhatsNewSeenVersion] = useState<string | null>(null);
  const [voiceBundles, setVoiceBundlesState] = useState<VoiceBundles>(() =>
    sanitizeVoiceBundles(DEFAULT_VOICE_BUNDLES),
  );
  const [streaks, setStreaksState] = useState<StreakRecord>({ ...DEFAULT_STREAKS });
  const [badges, setBadgesState] = useState<BadgeRecord[]>([]);
  const [pointsHistory, setPointsHistoryState] = useState<PointsHistoryEntry[]>([]);
  const [contactMilestones, setContactMilestonesState] = useState<ContactMilestoneRecord[]>([]);
  const [callsTabState, setCallsTabState] = useState<CallsTabState>({ ...DEFAULT_CALLS_TAB_STATE });
  const [wishTemplates, setWishTemplatesState] = useState<WishTemplateMap>({});
  const [sentWishes, setSentWishesState] = useState<SentWishRecord[]>([]);
  const [snoozedQuietUntil, setSnoozedQuietUntilState] = useState<Record<string, number>>({});
  const [reconnectProgress, setReconnectProgressState] = useState<ReconnectProgressRecord>(() => ({
    ...DEFAULT_RECONNECT_PROGRESS,
    weekKey: getEatWeekKey(),
  }));
  const [expandedSettingsSections, setExpandedSettingsSectionsState] = useState<SettingsSectionId[]>(
    () => [...DEFAULT_SETTINGS_SECTIONS],
  );
  const [wishComposerRequest, setWishComposerRequest] = useState<WishComposerContext | null>(null);
  const [sessionNewCallIdsList, setSessionNewCallIdsList] = useState<string[]>([]);
  const prevCallsTabOpenedAtRef = useRef<number>(0);
  const callsTabActiveRef = useRef<boolean>(true);
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
      const nextSystemDark = e ? e.matches : mql.matches;
      setSystemIsDark(nextSystemDark);
      if (themePreferenceRef.current === 'system') {
        stateRef.current = {
          ...stateRef.current,
          theme: nextSystemDark ? 'dark-gray' : 'light',
        };
      }
    };
    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        handleChange();
      }
    };
    handleChange();
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => {
        mql.removeEventListener('change', handleChange);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      };
    }
    mql.addListener(handleChange);
    return () => {
      mql.removeListener(handleChange);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
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

  const [customTags, setCustomTags] = useState<string[]>(() =>
    readJson<string[]>(CUSTOM_TAGS_KEY, []).filter(
      (item) => typeof item === 'string' && item.trim().length > 0,
    ),
  );

  const addCustomTag = useCallback((rawTag: string): string => {
    const clean = clampStr(rawTag, 48);
    if (!clean) return '';
    setCustomTags((prev) => {
      const next = mergeTagOptions(prev, [clean]);
      writeJson(CUSTOM_TAGS_KEY, next);
      return next;
    });
    return clean;
  }, []);

  const availableTags = useMemo(
    () =>
      mergeTagOptions(
        DEFAULT_RELATIONSHIP_TAGS,
        customTags,
        Object.values(contacts).map((c) => c.tag),
        calls.map((c) => c.tag),
      ),
    [calls, contacts, customTags],
  );

  const theme: ThemeMode = useMemo(() => {
    if (themePreference === 'system') {
      return systemIsDark ? 'dark-gray' : 'light';
    }
    return themePreference;
  }, [themePreference, systemIsDark]);
  const themePreferenceRef = useRef<ThemePreference>(themePreference);
  const lastLocalThemeChangeAtRef = useRef<number>(0);
  useEffect(() => {
    themePreferenceRef.current = themePreference;
  }, [themePreference]);
  const [profileName, setProfileNameState] = useState<string>('');
  const [userPhotoUrl, setUserPhotoUrlState] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(true);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionStatus>('prompt');
  const [pinHash, setPinHash] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [pinLockoutUntil, setPinLockoutUntil] = useState<number>(0);
  const [notificationActionTarget, setNotificationActionTarget] =
    useState<NotificationActionTarget | null>(null);
  const clearNotificationActionTarget = useCallback(() => {
    setNotificationActionTarget(null);
  }, []);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const isGuestRef = useRef<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const isAdminRef = useRef<boolean>(false);
  const [verifyRefreshKey, setVerifyRefreshKey] = useState<number>(0);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const accountMetaRef = useRef<{
    phone: string | null;
    photoURL: string | null;
    termsAccepted: boolean | null;
    termsAcceptedAt: number | null;
  }>({
    phone: null,
    photoURL: null,
    termsAccepted: null,
    termsAcceptedAt: null,
  });
  const userDocDiagRef = useRef<{
    exists: boolean;
    hasUid: boolean;
    uidMatches: boolean;
    emailMatches: boolean;
    existingKeys: string[];
    hasLegacyKeys: boolean;
  }>({
    exists: false,
    hasUid: false,
    uidMatches: false,
    emailMatches: false,
    existingKeys: [],
    hasLegacyKeys: false,
  });
  const [authPromptMode, setAuthPromptMode] = useState<AuthPromptMode>('closed');
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);
  const hydratedUidRef = useRef<string | null>(null);
  const workspaceReadyRef = useRef<{ uid: string; promise: Promise<void> } | null>(null);
  const dailyAlertCacheRef = useRef<{ key: string; ids: Set<string> } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('signed-out');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [noticeState, setNoticeState] = useState<{ text: string; id: number } | null>(null);
  const notice = noticeState?.text ?? null;

  useEffect(() => {
    isGuestRef.current = isGuest;
  }, [isGuest]);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  // Refs to read latest local state inside auth bootstrap & action writers
  const stateRef = useRef({
    calls,
    contacts,
    scheduledCalls,
    favoritesArray,
    dismissedMissedArray,
    mutedAlertKeys,
    tariffs,
    simLabels,
    calendarPrefs,
    reminderPrefs,
    alertTypePrefs,
    alertSnoozedDate,
    readAlertKeys,
    voiceBundles,
    theme,
    profileName,
    userPhotoUrl,
    notificationsEnabled,
    streaks,
    badges,
    pointsHistory,
    contactMilestones,
    callsTabState,
    wishTemplates,
    sentWishes,
    snoozedQuietUntil,
    reconnectProgress,
    expandedSettingsSections,
  });

  useEffect(() => {
    stateRef.current = {
      calls,
      contacts,
      scheduledCalls,
      favoritesArray,
      dismissedMissedArray,
      mutedAlertKeys,
      tariffs,
      simLabels,
      calendarPrefs,
      reminderPrefs,
      alertTypePrefs,
      alertSnoozedDate,
      readAlertKeys,
      voiceBundles,
      theme,
      profileName,
      userPhotoUrl,
      notificationsEnabled,
      streaks,
      badges,
      pointsHistory,
      contactMilestones,
      callsTabState,
      wishTemplates,
      sentWishes,
      snoozedQuietUntil,
      reconnectProgress,
      expandedSettingsSections,
    };
  }, [
    calls,
    contacts,
    scheduledCalls,
    favoritesArray,
    dismissedMissedArray,
    mutedAlertKeys,
    tariffs,
    simLabels,
    calendarPrefs,
    reminderPrefs,
    alertTypePrefs,
    alertSnoozedDate,
    readAlertKeys,
    voiceBundles,
    theme,
    profileName,
    userPhotoUrl,
    notificationsEnabled,
    streaks,
    badges,
    pointsHistory,
    contactMilestones,
    callsTabState,
    wishTemplates,
    sentWishes,
    snoozedQuietUntil,
    reconnectProgress,
    expandedSettingsSections,
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
      writeJson(THEME_KEY, 'system');
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
    setMutedAlertKeys(snap.mutedAlertKeys);
    setTariffsState(snap.tariffs);
    setSimLabelsState(snap.simLabels);
    setCalendarPrefsState(snap.calendarPrefs);
    setReminderPrefsState(snap.reminderPrefs);
    setAlertTypePrefsState(snap.alertTypePrefs);
    setAlertSnoozedDate(snap.alertSnoozedDate);
    setReadAlertKeys(snap.readAlertKeys);
    setVoiceBundlesState(snap.voiceBundles);
    setProfileNameState(snap.profileName);
    setUserPhotoUrlState(snap.userPhotoUrl);
    setNotificationsEnabledState(snap.notificationsEnabled);
    setPinHash(snap.pinHash);
    setIsLocked(Boolean(snap.pinHash));
    setStreaksState(snap.streaks);
    setBadgesState(snap.badges);
    setPointsHistoryState(snap.pointsHistory);
    setContactMilestonesState(snap.contactMilestones);
    setCallsTabState(snap.callsTabState);
    setWishTemplatesState(snap.wishTemplates);
    setSentWishesState(snap.sentWishes);
    setSnoozedQuietUntilState(snap.snoozedQuietUntil);
    setReconnectProgressState(snap.reconnectProgress);
    setExpandedSettingsSectionsState(snap.expandedSettingsSections);
    prevCallsTabOpenedAtRef.current = snap.callsTabState.lastOpenedAt;
    setSessionNewCallIdsList(snap.callsTabState.unseenCallIds);
    stateRef.current = {
      calls: snap.calls,
      contacts: snap.contacts,
      scheduledCalls: snap.scheduledCalls,
      favoritesArray: snap.favoritesArray,
      dismissedMissedArray: snap.dismissedMissedArray,
      mutedAlertKeys: snap.mutedAlertKeys,
      tariffs: snap.tariffs,
      simLabels: snap.simLabels,
      calendarPrefs: snap.calendarPrefs,
      reminderPrefs: snap.reminderPrefs,
      alertTypePrefs: snap.alertTypePrefs,
      alertSnoozedDate: snap.alertSnoozedDate,
      readAlertKeys: snap.readAlertKeys,
      voiceBundles: snap.voiceBundles,
      theme: stateRef.current.theme,
      profileName: snap.profileName,
      userPhotoUrl: snap.userPhotoUrl,
      notificationsEnabled: snap.notificationsEnabled,
      streaks: snap.streaks,
      badges: snap.badges,
      pointsHistory: snap.pointsHistory,
      contactMilestones: snap.contactMilestones,
      callsTabState: snap.callsTabState,
      wishTemplates: snap.wishTemplates,
      sentWishes: snap.sentWishes,
      snoozedQuietUntil: snap.snoozedQuietUntil,
      reconnectProgress: snap.reconnectProgress,
      expandedSettingsSections: snap.expandedSettingsSections,
    };
  }, []);

  const canPersistScoped = (uid: string | null): uid is string =>
    Boolean(uid && hydratedUidRef.current === uid && auth.currentUser?.uid === uid);

  useEffect(() => {
    if (!canPersistScoped(hydratedUid)) return;
    const uid = hydratedUid;
    const timer = window.setTimeout(() => {
      if (canPersistScoped(uid)) {
        void idbSetScoped(uid, 'calls', calls);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [calls, hydratedUid]);
  useEffect(() => {
    if (!canPersistScoped(hydratedUid)) return;
    const uid = hydratedUid;
    const timer = window.setTimeout(() => {
      if (canPersistScoped(uid)) {
        void idbSetScoped(uid, 'contacts', contacts);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [contacts, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'scheduledCalls', scheduledCalls);
    }
  }, [scheduledCalls, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'favorites', favoritesArray);
    }
  }, [favoritesArray, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'dismissedMissed', dismissedMissedArray);
    }
  }, [dismissedMissedArray, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'mutedAlerts', mutedAlertKeys);
    }
  }, [mutedAlertKeys, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'tariffs', tariffs);
    }
  }, [tariffs, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'simLabels', simLabels);
    }
  }, [simLabels, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'calendarPrefs', calendarPrefs);
    }
  }, [calendarPrefs, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'reminderPrefs', reminderPrefs);
    }
  }, [reminderPrefs, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'voiceBundles', voiceBundles);
    }
  }, [voiceBundles, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'profile', profileName);
    }
  }, [profileName, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'photoUrl', userPhotoUrl);
    }
  }, [userPhotoUrl, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'notifications', notificationsEnabled);
    }
  }, [notificationsEnabled, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'streaks', streaks);
    }
  }, [streaks, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'badges', badges);
    }
  }, [badges, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'pointsHistory', pointsHistory);
    }
  }, [pointsHistory, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'contactMilestones', contactMilestones);
    }
  }, [contactMilestones, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'callsTabState', callsTabState);
    }
  }, [callsTabState, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'alertTypePrefs', alertTypePrefs);
    }
  }, [alertTypePrefs, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'alertSnoozedDate', alertSnoozedDate);
    }
  }, [alertSnoozedDate, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'readAlertKeys', readAlertKeys);
    }
  }, [readAlertKeys, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'wishTemplates', wishTemplates);
    }
  }, [wishTemplates, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'sentWishes', sentWishes);
    }
  }, [sentWishes, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'snoozedQuietUntil', snoozedQuietUntil);
    }
  }, [snoozedQuietUntil, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'reconnectProgress', reconnectProgress);
    }
  }, [reconnectProgress, hydratedUid]);
  useEffect(() => {
    if (canPersistScoped(hydratedUid)) {
      void idbSetScoped(hydratedUid, 'expandedSettingsSections', expandedSettingsSections);
    }
  }, [expandedSettingsSections, hydratedUid]);

  // Keep EAT today date fresh so "Snooze for today" automatically resets at EAT midnight
  useEffect(() => {
    const syncToday = () => setTodayEat(toEatDateString());
    syncToday();
    const intervalId = window.setInterval(syncToday, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncToday();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Load & migrate Guide / What's New seen flags from IndexedDB (and legacy localStorage)
  useEffect(() => {
    let cancelled = false;
    const hydrateSeenMeta = async () => {
      try {
        const stored = await idbGetScoped<AppSeenMeta>(DEVICE_META_SCOPE, 'appSeenMeta');
        let legacyGuide = false;
        let legacyWhatsNew: string | null = null;
        try {
          legacyGuide = localStorage.getItem(GUIDE_SEEN_KEY) === '1';
          const v = localStorage.getItem(WHATS_NEW_SEEN_KEY);
          if (v && v.trim()) legacyWhatsNew = v.trim();
        } catch {
          // ignore localStorage errors
        }
        const resolved: AppSeenMeta = {
          guideSeen: Boolean(stored?.guideSeen || legacyGuide),
          whatsNewVersion: stored?.whatsNewVersion || legacyWhatsNew || null,
        };
        if (
          !stored ||
          stored.guideSeen !== resolved.guideSeen ||
          stored.whatsNewVersion !== resolved.whatsNewVersion
        ) {
          await idbSetScoped(DEVICE_META_SCOPE, 'appSeenMeta', resolved);
        }
        if (legacyGuide) removeStorageKey(GUIDE_SEEN_KEY);
        if (legacyWhatsNew) removeStorageKey(WHATS_NEW_SEEN_KEY);
        if (!cancelled) {
          setGuideSeen(resolved.guideSeen);
          setWhatsNewSeenVersion(resolved.whatsNewVersion);
          setSeenMetaReady(true);
        }
      } catch {
        if (!cancelled) {
          setSeenMetaReady(true);
        }
      }
    };
    void hydrateSeenMeta();
    return () => {
      cancelled = true;
    };
  }, []);

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
    async (
      user: User,
      preferredDisplayName?: string,
      phoneOverride?: string | null,
      photoOverride?: string | null,
    ) => {
      const regRef = doc(db, 'userRegistry', user.uid);
      const displayName = clampStr(preferredDisplayName || user.displayName || '', 120);
      const email = clampStr(user.email || '', 254);
      const resolvedPhotoRaw =
        photoOverride !== undefined
          ? photoOverride
          : accountMetaRef.current.photoURL ?? user.photoURL ?? null;
      const photoURL = resolvedPhotoRaw ? clampStr(resolvedPhotoRaw, 500) : null;
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

  const dailyActiveRecordedRef = useRef<string | null>(null);

  const recordDailyActiveClient = useCallback(async (user: User) => {
    if (!user || !user.emailVerified) return;
    const todayEat = toEatDateString();
    const cacheVal = `${user.uid}:${todayEat}`;
    if (dailyActiveRecordedRef.current === cacheVal) return;

    const storageKey = `callanalyzer.dailyActiveDate.${user.uid}`;
    try {
      if (localStorage.getItem(storageKey) === todayEat) {
        dailyActiveRecordedRef.current = cacheVal;
        return;
      }
    } catch {
      // ignore storage errors
    }

    dailyActiveRecordedRef.current = cacheVal;
    const docId = `${todayEat}_${user.uid}`;
    try {
      await setDoc(doc(db, 'dailyActive', docId), {
        uid: user.uid,
        date: todayEat,
        openedAt: serverTimestamp(),
      });
      try {
        localStorage.setItem(storageKey, todayEat);
      } catch {
        // ignore storage errors
      }
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'permission-denied') {
        // Document already exists for today (updates are disallowed by rules).
        try {
          localStorage.setItem(storageKey, todayEat);
        } catch {
          // ignore storage errors
        }
      } else {
        // Offline or transient error: allow retry on next app open.
        if (dailyActiveRecordedRef.current === cacheVal) {
          dailyActiveRecordedRef.current = null;
        }
      }
    }
  }, []);

  const persistWorkspaceToCloud = useCallback(
    async (
      user: User,
      overrides?: Partial<{
        theme: ThemeMode;
        profileName: string;
        phone: string | null;
        photoURL: string | null;
        termsAccepted: boolean;
        termsAcceptedAt: number | null;
        notificationsEnabled: boolean;
        tariffs: TariffConfig;
        simLabels: SimLabels;
        calendarPrefs: CalendarPrefs;
        reminderPrefs: ReminderPrefs;
        voiceBundles: VoiceBundles;
      }>,
    ) => {
      if (!user || !user.emailVerified) return;

      const s = stateRef.current;
      const meta = accountMetaRef.current;
      const nextPhone = overrides?.phone !== undefined ? overrides.phone : meta.phone;
      const nextPhotoURL =
        overrides?.photoURL !== undefined
          ? overrides.photoURL
          : meta.photoURL ?? s.userPhotoUrl ?? user.photoURL ?? null;
      const nextTermsAccepted =
        overrides?.termsAccepted !== undefined ? overrides.termsAccepted : meta.termsAccepted;
      const nextTermsAcceptedAt =
        overrides?.termsAcceptedAt !== undefined
          ? overrides.termsAcceptedAt
          : meta.termsAcceptedAt;

      const rawDisplayName = overrides?.profileName ?? (s.profileName || user.displayName || '');
      const rawTheme = overrides?.theme ?? s.theme;
      const safeTheme: ThemeMode = rawTheme === 'light' ? 'light' : 'dark-gray';
      const cleanEmail = clampStr((user.email || '').trim(), 254);
      const cleanDisplayName = clampStr(
        typeof rawDisplayName === 'string' ? rawDisplayName : '',
        120,
      );
      const cleanPhone =
        typeof nextPhone === 'string' && nextPhone.trim().length > 0
          ? clampStr(nextPhone.trim(), 40)
          : undefined;
      const cleanPhotoURL =
        typeof nextPhotoURL === 'string' && nextPhotoURL.trim().length > 0
          ? clampStr(nextPhotoURL.trim(), 500)
          : undefined;
      const cleanTermsAccepted =
        typeof nextTermsAccepted === 'boolean' ? nextTermsAccepted : undefined;
      const cleanTermsAcceptedAt =
        typeof nextTermsAcceptedAt === 'number' &&
        Number.isFinite(nextTermsAcceptedAt) &&
        nextTermsAcceptedAt >= 0
          ? Math.round(nextTermsAcceptedAt)
          : undefined;
      const cleanTariffs = sanitizeTariffs(overrides?.tariffs ?? s.tariffs);
      const cleanSimLabels = sanitizeSimLabels(overrides?.simLabels ?? s.simLabels);
      const cleanCalendarPrefs = sanitizeCalendarPrefs(overrides?.calendarPrefs ?? s.calendarPrefs);
      const cleanReminderPrefs = sanitizeReminderPrefs(overrides?.reminderPrefs ?? s.reminderPrefs);
      const cleanVoiceBundles = sanitizeVoiceBundles(overrides?.voiceBundles ?? s.voiceBundles);
      const cleanNotificationsEnabled = Boolean(
        overrides?.notificationsEnabled ?? s.notificationsEnabled,
      );

      const payload = {
        uid: user.uid,
        displayName: cleanDisplayName,
        email: cleanEmail,
        ...(cleanPhone !== undefined ? { phone: cleanPhone } : {}),
        ...(cleanPhotoURL !== undefined ? { photoURL: cleanPhotoURL } : {}),
        ...(cleanTermsAccepted !== undefined ? { termsAccepted: cleanTermsAccepted } : {}),
        ...(cleanTermsAcceptedAt !== undefined ? { termsAcceptedAt: cleanTermsAcceptedAt } : {}),
        theme: safeTheme,
        notificationsEnabled: cleanNotificationsEnabled,
        tariffs: cleanTariffs,
        simLabels: cleanSimLabels,
        calendarPrefs: cleanCalendarPrefs,
        reminderPrefs: cleanReminderPrefs,
        voiceBundles: cleanVoiceBundles,
        syncedAt: serverTimestamp(),
      };

      const path = `users/${user.uid}`;
      const userDocRef = doc(db, 'users', user.uid);
      const diag = userDocDiagRef.current;
      const useUpdateDoc = diag.exists && !diag.hasLegacyKeys && diag.hasUid && diag.uidMatches;
      let writeMode: 'updateDoc' | 'setDoc' = useUpdateDoc ? 'updateDoc' : 'setDoc';

      try {
        setSyncStatus('syncing');
        if (useUpdateDoc) {
          try {
            await updateDoc(userDocRef, payload);
          } catch (updateErr) {
            const code = (updateErr as { code?: string })?.code ?? '';
            if (code === 'not-found') {
              writeMode = 'setDoc';
              await setDoc(userDocRef, payload);
            } else {
              throw updateErr;
            }
          }
        } else {
          await setDoc(userDocRef, payload);
        }
        userDocDiagRef.current = {
          exists: true,
          hasUid: true,
          uidMatches: true,
          emailMatches: true,
          existingKeys: Object.keys(payload),
          hasLegacyKeys: false,
        };
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
      } catch (error) {
        const preflightFailures: string[] = [];
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(user.uid)) preflightFailures.push('uidPattern');
        if (auth.currentUser?.uid !== user.uid) preflightFailures.push('authUidMismatch');
        if (!user.emailVerified) preflightFailures.push('emailNotVerified');
        if (!cleanSimLabels.sim1Label || cleanSimLabels.sim1Label.length > 40) {
          preflightFailures.push('sim1Label');
        }
        if (!cleanSimLabels.sim2Label || cleanSimLabels.sim2Label.length > 40) {
          preflightFailures.push('sim2Label');
        }
        if (![5, 7, 10].includes(cleanReminderPrefs.missedCallReminderDelayMinutes)) {
          preflightFailures.push('missedCallReminderDelayMinutes');
        }
        console.error(
          'Workspace write diagnostic:',
          JSON.stringify({
            writeMode,
            docDiag: userDocDiagRef.current,
            payloadKeys: Object.keys(payload),
            preflightFailures,
            theme: safeTheme,
            emailLen: cleanEmail.length,
            displayNameLen: cleanDisplayName.length,
            hasPhone: cleanPhone !== undefined,
            hasPhoto: cleanPhotoURL !== undefined,
            hasTerms: cleanTermsAccepted !== undefined,
            hasTermsAt: cleanTermsAcceptedAt !== undefined,
            tariffs: cleanTariffs,
            simLabelsLens: [cleanSimLabels.sim1Label.length, cleanSimLabels.sim2Label.length],
            calendarPrefs: cleanCalendarPrefs,
            reminderPrefs: cleanReminderPrefs,
            voiceBundleEnabled: [cleanVoiceBundles.sim1.enabled, cleanVoiceBundles.sim2.enabled],
          }),
        );
        setSyncStatus('error');
        handleFirestoreError(error, OperationType.WRITE, path);
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
    isAdminRef.current = false;
    setIsAdmin(false);
    setPinLockoutUntil(0);
    accountMetaRef.current = {
      phone: null,
      photoURL: null,
      termsAccepted: null,
      termsAcceptedAt: null,
    };
    userDocDiagRef.current = {
      exists: false,
      hasUid: false,
      uidMatches: false,
      emailMatches: false,
      existingKeys: [],
      hasLegacyKeys: false,
    };
    setUserPhone(null);

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

  // Firebase Auth listener + strictly isolated UID-scoped IndexedDB hydration + account settings sync
  useEffect(() => {
    let unsubWorkspace: (() => void) | null = null;
    let unsubAdmin: (() => void) | null = null;
    let cancelled = false;
    let activeRun = 0;

    const cleanupListeners = () => {
      unsubWorkspace?.();
      unsubWorkspace = null;
      unsubAdmin?.();
      unsubAdmin = null;
    };

    clearLegacyUnscopedKeys();

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      const myRun = ++activeRun;
      cleanupListeners();

      if (!user) {
        hydratedUidRef.current = null;
        setHydratedUid(null);
        workspaceReadyRef.current = null;
        isAdminRef.current = false;
        setIsAdmin(false);
        setPinLockoutUntil(0);
        accountMetaRef.current = {
          phone: null,
          photoURL: null,
          termsAccepted: null,
          termsAcceptedAt: null,
        };
        userDocDiagRef.current = {
          exists: false,
          hasUid: false,
          uidMatches: false,
          emailMatches: false,
          existingKeys: [],
          hasLegacyKeys: false,
        };
        setUserPhone(null);
        setUserPhotoUrlState(null);
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
        isAdminRef.current = false;
        setIsAdmin(false);
        setPinLockoutUntil(0);
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
      isAdminRef.current = false;
      setIsAdmin(false);
      setIsGuest(false);
      setAuthPromptMode('closed');
      setAuthPromptReason(null);
      clearLegacyUnscopedKeys();

      // Clear any previous/guest state first, then hydrate ONLY this logged-in user's IndexedDB cache
      applySnapshotToState(createEmptySnapshot());
      const { snapshot: scoped, pendingReg } = await readScopedUserStateAsync(uid);
      if (cancelled || myRun !== activeRun || auth.currentUser?.uid !== uid) {
        return;
      }
      applySnapshotToState(scoped);
      const storedLockout = readPinLockoutState(userStorageKey(uid, 'pinLockout'));
      setPinLockoutUntil(storedLockout.lockUntil > Date.now() ? storedLockout.lockUntil : 0);
      accountMetaRef.current = {
        phone: pendingReg?.phone ?? null,
        photoURL: user.photoURL ?? scoped.userPhotoUrl ?? null,
        termsAccepted: pendingReg ? pendingReg.termsAccepted : null,
        termsAcceptedAt: pendingReg ? pendingReg.termsAcceptedAt : null,
      };
      setUserPhone(pendingReg?.phone ?? null);
      setUserPhotoUrlState(user.photoURL ?? scoped.userPhotoUrl ?? null);

      hydratedUidRef.current = uid;
      setHydratedUid(uid);
      setAuthUser(user);
      setAuthLoading(false);
      setSyncStatus('syncing');

      // Request persistent browser storage so IndexedDB is protected from eviction.
      if (
        typeof navigator !== 'undefined' &&
        navigator.storage &&
        typeof navigator.storage.persist === 'function'
      ) {
        void navigator.storage.persist().catch(() => {});
      }

      // Record once-per-day active client open in /dailyActive/{yyyy-MM-dd}_{uid}.
      void recordDailyActiveClient(user);

      let resolveWorkspaceReady!: () => void;
      const readyPromise = new Promise<void>((resolve) => {
        resolveWorkspaceReady = resolve;
      });
      workspaceReadyRef.current = { uid, promise: readyPromise };

      // Verify /admins/{uid} allowlist from Firestore server & keep synced live
      const adminDocRef = doc(db, 'admins', uid);
      void getDocFromServer(adminDocRef)
        .catch(() => getDoc(adminDocRef))
        .then((adminSnap) => {
          if (!cancelled && myRun === activeRun) {
            const exists = adminSnap.exists();
            isAdminRef.current = exists;
            setIsAdmin(exists);
          }
        })
        .catch(() => {
          if (!cancelled && myRun === activeRun) {
            isAdminRef.current = false;
            setIsAdmin(false);
          }
        });

      unsubAdmin = onSnapshot(
        adminDocRef,
        (adminSnap) => {
          if (cancelled || myRun !== activeRun) return;
          const exists = adminSnap.exists();
          isAdminRef.current = exists;
          setIsAdmin(exists);
        },
        () => {
          // Ignore snapshot listener error if offline or denied; getDocFromServer handles initial check.
        },
      );

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
            void idbDeleteScoped(uid, 'pendingRegistration');
            removeStorageKey(userStorageKey(uid, 'pendingRegistration'));
          }
        } else {
          const data = userSnap.data() as Record<string, unknown>;

          const rawTheme = data.theme;
          const recentlyChangedThemeLocally = Date.now() - lastLocalThemeChangeAtRef.current < 5000;
          const nextTheme: ThemeMode =
            !recentlyChangedThemeLocally &&
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
          const resolvedPhotoURL =
            typeof data.photoURL === 'string' && data.photoURL.trim()
              ? data.photoURL.trim()
              : user.photoURL ?? local.userPhotoUrl ?? null;
          const resolvedTerms =
            pendingReg?.termsAccepted ??
            (typeof data.termsAccepted === 'boolean' ? data.termsAccepted : null);
          const resolvedTermsAt =
            pendingReg?.termsAcceptedAt ??
            (typeof data.termsAcceptedAt === 'number' ? data.termsAcceptedAt : null);
          const allowedWorkspaceKeys = new Set([
            'uid',
            'displayName',
            'email',
            'phone',
            'photoURL',
            'termsAccepted',
            'termsAcceptedAt',
            'theme',
            'notificationsEnabled',
            'tariffs',
            'simLabels',
            'calendarPrefs',
            'reminderPrefs',
            'voiceBundles',
            'syncedAt',
          ]);
          const existingKeys = Object.keys(data);
          const hasLegacyFields = existingKeys.some((k) => !allowedWorkspaceKeys.has(k));
          userDocDiagRef.current = {
            exists: true,
            hasUid: Object.prototype.hasOwnProperty.call(data, 'uid'),
            uidMatches: data.uid === uid,
            emailMatches:
              typeof data.email === 'string' &&
              typeof user.email === 'string' &&
              data.email.toLowerCase() === user.email.toLowerCase(),
            existingKeys,
            hasLegacyKeys: hasLegacyFields,
          };

          accountMetaRef.current = {
            phone: resolvedPhone,
            photoURL: resolvedPhotoURL,
            termsAccepted: resolvedTerms,
            termsAcceptedAt: resolvedTermsAt,
          };
          setUserPhone(resolvedPhone);
          setUserPhotoUrlState(resolvedPhotoURL);

          if (themePreferenceRef.current !== 'system' && Date.now() - lastLocalThemeChangeAtRef.current >= 5000) {
            setThemePreferenceState(nextTheme);
          }
          if (nextName) setProfileNameState(nextName);
          setNotificationsEnabledState(nextNotifs);
          setTariffsState(nextTariffs);
          setSimLabelsState(nextSimLabels);
          setCalendarPrefsState(nextCalPrefs);
          setReminderPrefsState(nextRemPrefs);
          setVoiceBundlesState(nextBundles);
          stateRef.current = {
            ...stateRef.current,
            tariffs: nextTariffs,
            simLabels: nextSimLabels,
            calendarPrefs: nextCalPrefs,
            reminderPrefs: nextRemPrefs,
            voiceBundles: nextBundles,
            theme:
              themePreferenceRef.current !== 'system' && Date.now() - lastLocalThemeChangeAtRef.current >= 5000
                ? nextTheme
                : stateRef.current.theme,
            profileName: nextName || stateRef.current.profileName,
            userPhotoUrl: resolvedPhotoURL,
            notificationsEnabled: nextNotifs,
          };

          if (Boolean(pendingReg) || hasLegacyFields) {
            currentOp = OperationType.UPDATE;
            currentPath = `users/${uid}`;
            await persistWorkspaceToCloud(user, {
              theme: nextTheme,
              profileName: nextName,
              phone: resolvedPhone,
              photoURL: resolvedPhotoURL,
              ...(typeof resolvedTerms === 'boolean' ? { termsAccepted: resolvedTerms } : {}),
              termsAcceptedAt: resolvedTermsAt,
              notificationsEnabled: nextNotifs,
              tariffs: nextTariffs,
              simLabels: nextSimLabels,
              calendarPrefs: nextCalPrefs,
              reminderPrefs: nextRemPrefs,
              voiceBundles: nextBundles,
            });
          }

          await syncUserRegistry(user, nextName, resolvedPhone, resolvedPhotoURL);
          if (pendingReg) {
            void idbDeleteScoped(uid, 'pendingRegistration');
            removeStorageKey(userStorageKey(uid, 'pendingRegistration'));
          }
        }

        resolveWorkspaceReady();

        if (cancelled || myRun !== activeRun) return;

        // Real-time listener for account settings only (calls, contacts & schedules stay local in IndexedDB)
        unsubWorkspace = onSnapshot(
          userDocRef,
          (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() as Record<string, unknown>;
            const recentlyChangedThemeLocally = Date.now() - lastLocalThemeChangeAtRef.current < 5000;
            if (
              !snap.metadata.hasPendingWrites &&
              !recentlyChangedThemeLocally &&
              themePreferenceRef.current !== 'system' &&
              (data.theme === 'dark' || data.theme === 'dark-gray' || data.theme === 'light')
            ) {
              const incomingTheme: ThemeMode = data.theme === 'light' ? 'light' : 'dark-gray';
              themePreferenceRef.current = incomingTheme;
              stateRef.current = { ...stateRef.current, theme: incomingTheme };
              setThemePreferenceState(incomingTheme);
            }
            if (typeof data.displayName === 'string') setProfileNameState(data.displayName);
            if (typeof data.phone === 'string') {
              accountMetaRef.current.phone = data.phone;
              setUserPhone(data.phone);
            }
            if (typeof data.photoURL === 'string') {
              accountMetaRef.current.photoURL = data.photoURL;
              setUserPhotoUrlState(data.photoURL);
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
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
          },
          (error) => {
            setSyncStatus('error');
            handleFirestoreError(error, OperationType.GET, `users/${uid}`);
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
  }, [applySnapshotToState, persistWorkspaceToCloud, recordDailyActiveClient, showNotice, syncUserRegistry, verifyRefreshKey]);

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
            'Native AppNotifications plugin is missing in this APK build. Rebuild and install the latest APK to enable phone alerts.',
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
          if (user && user.emailVerified) {
            await ensureWorkspaceReady(user.uid);
            void persistWorkspaceToCloud(user, { notificationsEnabled: true });
          }
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
          if (user && user.emailVerified) {
            await ensureWorkspaceReady(user.uid);
            void persistWorkspaceToCloud(user, { notificationsEnabled: true });
          }
          showNotice('Browser alerts allowed.', 'success');
        } else if (mapped === 'denied') {
          showNotice('Browser notification permission is blocked in browser settings.', 'warning');
        }
        return mapped;
      }

      setNotificationPermission('unsupported');
      showNotice('Notifications unavailable here; in-app alerts stay active.');
      return 'unsupported';
    }, [ensureWorkspaceReady, persistWorkspaceToCloud, showNotice]);

  const deliverSystemNotification = useCallback(
    async (
      idKey: string,
      title: string,
      body: string,
      meta?: NotificationMeta,
    ): Promise<boolean> => {
      if (isNativeCapacitor()) {
        if (!hasNativeNotificationsPlugin()) return false;
        return showNativeNotification(idKey, title, body, meta);
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
    async (customBody?: string, delaySeconds = 0): Promise<boolean> => {
      const status = await requestAlertPermissions();
      if (status !== 'granted') return false;
      const body =
        customBody?.trim() ||
        'Missed call 7 minutes ago · Tap to call back or view details.';
      if (delaySeconds > 0) {
        const triggerAt = Date.now() + Math.round(delaySeconds * 1000);
        if (isNativeCapacitor() && hasNativeNotificationsPlugin()) {
          const scheduled = await scheduleNativeNotification(
            `test-alert-${triggerAt}`,
            'Test Contact',
            body,
            triggerAt,
            {
              category: 'schedule',
              number: '0911000000',
              contactKey: '911000000',
              muteKey: 'test-alert',
            },
          );
          if (scheduled) {
            showNotice(
              `Test notification scheduled in ${Math.round(delaySeconds)}s — you can close the app to test.`,
              'success',
            );
            return true;
          }
        }
        window.setTimeout(() => {
          void deliverSystemNotification(`test-alert-${triggerAt}`, 'Test Contact', body, {
            category: 'schedule',
            number: '0911000000',
            contactKey: '911000000',
            muteKey: 'test-alert',
          });
        }, Math.round(delaySeconds * 1000));
        showNotice(
          `Test notification scheduled in ${Math.round(delaySeconds)}s.`,
          'success',
        );
        return true;
      }

      const sent = await deliverSystemNotification('test-alert', 'Call Analyzer - ETH', body, {
        category: 'other',
        muteKey: 'test-alert',
      });
      if (sent) {
        showNotice('Notification sent.', 'success');
      } else {
        showNotice('Could not display system notification.');
      }
      return sent;
    },
    [deliverSystemNotification, requestAlertPermissions, showNotice],
  );

  const isAlertsSnoozedToday = useMemo(
    () => Boolean(alertSnoozedDate && alertSnoozedDate === todayEat),
    [alertSnoozedDate, todayEat],
  );

  // Trigger callback reminders (toast + system notification) when scheduled time arrives
  useEffect(() => {
    const mutedSet = new Set(mutedAlertKeys);
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

      if (!alertTypePrefs.scheduledCalls || isAlertsSnoozedToday) return;

      const first = dueUnnotified.find(
        (item) =>
          !mutedSet.has(`sched:${item.id}`) &&
          !mutedSet.has(`contact:${getContactKey(item.number)}`),
      );
      if (!first) return;

      const label = formatDisplayNameOrPhone(first.name, first.number);
      showNotice(`Scheduled call reminder: ${label}`);

      if (notificationsEnabled && !isWithinQuietHours(reminderPrefs)) {
        void deliverSystemNotification(
          first.id,
          `Call reminder: ${label}`,
          first.note?.trim() || `Scheduled call to ${first.number}`,
          {
            category: 'schedule',
            number: first.number,
            contactKey: getContactKey(first.number),
            eventId: first.id,
            muteKey: `sched:${first.id}`,
          },
        );
      }
    };

    checkDue();
    const timer = setInterval(checkDue, 5_000);
    return () => clearInterval(timer);
  }, [
    scheduledCalls,
    mutedAlertKeys,
    notificationsEnabled,
    reminderPrefs,
    alertTypePrefs.scheduledCalls,
    isAlertsSnoozedToday,
    showNotice,
    deliverSystemNotification,
  ]);

  // Daily check for Birthday today, Ethiopian Holiday today, and Quiet contacts (respecting Mute, Switches & Today Snooze)
  useEffect(() => {
    if (!authUser?.emailVerified || !hydratedUid || hydratedUid !== authUser.uid) return;
    if (!notificationsEnabled || isWithinQuietHours(reminderPrefs) || isAlertsSnoozedToday) return;

    const uid = authUser.uid;
    let effectCancelled = false;
    const now = new Date();
    const todayDateEat = toEatDateString(now.getTime());
    const dailySuffix = `dailyAlerts.${todayDateEat}`;
    const cacheKey = `${uid}:${todayDateEat}`;

    const runDailyAlerts = async () => {
      const stored = await getScopedWithLegacyMigration<string[]>(uid, dailySuffix, []);
      if (effectCancelled || auth.currentUser?.uid !== uid || hydratedUidRef.current !== uid) {
        return;
      }

      const cachedSet =
        dailyAlertCacheRef.current?.key === cacheKey ? dailyAlertCacheRef.current.ids : null;
      const alreadySent = new Set<string>([
        ...(Array.isArray(stored) ? stored : []),
        ...(cachedSet ? Array.from(cachedSet) : []),
      ]);
      const mutedSet = new Set(mutedAlertKeys);
      const newlySent: string[] = [];

      // 1. Contact Birthdays / Special Events today
      if (alertTypePrefs.birthdays) {
        const todaysEvents = getUpcomingContactEvents(contacts, calls, 0).filter((e) => e.isToday);
        for (const evt of todaysEvents.slice(0, 2)) {
          const muteKey = `bday:${evt.contactKey}`;
          const idKey = `daily-bday-${evt.id}-${todayDateEat}`;
          if (mutedSet.has(muteKey) || alreadySent.has(idKey)) continue;
          newlySent.push(idKey);
          const wishText = buildBirthdayWish(
            evt.name,
            evt.title,
            evt.tag,
            calendarPrefs.defaultLang,
          );
          void deliverSystemNotification(
            idKey,
            `${evt.title} today: ${evt.name}`,
            `Send a birthday wish or call ${evt.name} today.`,
            {
              category: 'birthday',
              number: evt.number,
              contactKey: evt.contactKey,
              eventId: evt.id,
              muteKey,
              wishText,
              occasionType: 'birthday',
              occasionKey: evt.id,
            },
          );
        }
      }

      // 2. Ethiopian Holiday today
      if (alertTypePrefs.holidays) {
        const todaysHoliday = getHolidaysInGregorianYearOrUpcoming(
          now,
          0,
          calendarPrefs.defaultLang,
        ).find((h) => h.isToday);
        if (todaysHoliday) {
          const muteKey = `holiday:${todaysHoliday.key}`;
          const idKey = `daily-holiday-${todaysHoliday.key}-${todayDateEat}`;
          if (!mutedSet.has(muteKey) && !alreadySent.has(idKey)) {
            newlySent.push(idKey);
            void deliverSystemNotification(
              idKey,
              `Happy ${todaysHoliday.name}!`,
              todaysHoliday.description || 'Send Ethiopian holiday wishes to your contacts.',
              {
                category: 'holiday',
                eventId: todaysHoliday.key,
                muteKey,
                wishText: buildHolidayWish(
                  todaysHoliday.name,
                  'friend',
                  undefined,
                  calendarPrefs.defaultLang,
                ),
                occasionType: 'holiday',
                occasionKey: todaysHoliday.key,
              },
            );
          }
        }
      }

      // 3. Top Quiet Contact
      if (alertTypePrefs.quietContacts) {
        const quiet = quietContacts(calls, now, reminderPrefs.quietContactDays);
        const nowMs = now.getTime();
        const topQuiet = quiet.find((q) => {
          const key = getContactKey(q.number);
          const snoozedUntil = stateRef.current.snoozedQuietUntil[key] ?? 0;
          return !mutedSet.has(`quiet:${key}`) && snoozedUntil <= nowMs;
        });
        if (topQuiet) {
          const cKey = getContactKey(topQuiet.number);
          const muteKey = `quiet:${cKey}`;
          const idKey = `daily-quiet-${cKey}-${todayDateEat}`;
          if (!alreadySent.has(idKey)) {
            newlySent.push(idKey);
            const quietLabel = formatDisplayNameOrPhone(topQuiet.name, topQuiet.number);
            void deliverSystemNotification(
              idKey,
              `Check in with ${quietLabel}`,
              quietMessage(topQuiet),
              {
                category: 'other',
                number: topQuiet.number,
                contactKey: cKey,
                muteKey,
                occasionType: 'reconnect',
                occasionKey: `reconnect:${cKey}`,
              },
            );
          }
        }
      }

      if (newlySent.length > 0) {
        const merged = Array.from(new Set([...alreadySent, ...newlySent]));
        dailyAlertCacheRef.current = { key: cacheKey, ids: new Set(merged) };
        await idbSetScoped(uid, dailySuffix, merged);
      }
    };

    void runDailyAlerts();
    return () => {
      effectCancelled = true;
    };
  }, [
    authUser,
    hydratedUid,
    calls,
    contacts,
    calendarPrefs.defaultLang,
    mutedAlertKeys,
    notificationsEnabled,
    reminderPrefs,
    alertTypePrefs,
    isAlertsSnoozedToday,
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
      if (!input.agreedToTerms) {
        return {
          ok: false,
          error: 'Please agree to the privacy terms before creating an account.',
        };
      }

      try {
        // Exit any Guest sample preview immediately so newly created accounts start completely fresh
        setIsGuest(false);
        applySnapshotToState(createEmptySnapshot());

        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, input.password);
        await idbClearUser(cred.user.uid);
        clearLegacyUserLocalStorage(cred.user.uid);

        const pending: PendingRegistration = {
          phone: clampStr(cleanPhone, 40),
          termsAccepted: true,
          termsAcceptedAt: Date.now(),
        };
        await idbSetScoped(cred.user.uid, 'pendingRegistration', pending);
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
    [applySnapshotToState, showNotice],
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
    try {
      hydratedUidRef.current = null;
      setHydratedUid(null);
      workspaceReadyRef.current = null;
      setIsAdmin(false);
      setPinLockoutUntil(0);
      accountMetaRef.current = {
        phone: null,
        photoURL: null,
        termsAccepted: null,
        termsAcceptedAt: null,
      };
      setUserPhone(null);
      setUserPhotoUrlState(null);
      setIsGuest(false);
      setAuthPromptMode('closed');
      setAuthPromptReason(null);
      await signOut(auth);
      await runNativeSignOut();
      dailyAlertCacheRef.current = null;
      clearLegacyUnscopedKeys();
      applySnapshotToState(createEmptySnapshot());
      setLastSyncedAt(null);
      setSyncStatus('signed-out');
      showNotice('Signed out. Your local data stays saved on this device for when you sign back in.');
    } catch {
      showNotice('Could not sign out right now.');
    }
  }, [applySnapshotToState, showNotice]);

  const deleteAllLocalData = useCallback(async () => {
    const user = requireSignedInUser();
    if (!user) return;
    try {
      await clearUserScopedStorage(user.uid);
      dailyAlertCacheRef.current = null;
      setSessionNewCallIdsList([]);
      setPinLockoutUntil(0);
      applySnapshotToState(createEmptySnapshot());
      showNotice('All local data on this device has been deleted.', 'warning');
    } catch {
      showNotice('Could not delete local data right now.', 'warning');
    }
  }, [applySnapshotToState, requireSignedInUser, showNotice]);

  const syncNow = useCallback(async () => {
    const user = requireSignedInUser();
    if (!user) return;
    await persistWorkspaceToCloud(user);
    await syncUserRegistry(user, stateRef.current.profileName || user.displayName || '');
    showNotice('Account settings synced. Calls & contacts stay local on this device.');
  }, [persistWorkspaceToCloud, requireSignedInUser, showNotice, syncUserRegistry]);

  const fetchRegisteredUsers = useCallback(async (): Promise<RegisteredUserRecord[]> => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified || !isAdminRef.current) {
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

  const fetchDailyActiveRecords = useCallback(async (): Promise<DailyActiveRecord[]> => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified || !isAdminRef.current) {
      return [];
    }
    const path = 'dailyActive';
    try {
      const snap = await getDocs(collection(db, 'dailyActive'));
      const toMs = (val: unknown): number => {
        if (val instanceof Timestamp) return val.toMillis();
        if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
          return (val as { toMillis: () => number }).toMillis();
        }
        return typeof val === 'number' ? val : 0;
      };
      return snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, unknown>;
          const date = typeof raw.date === 'string' ? raw.date : '';
          const uid = typeof raw.uid === 'string' ? raw.uid : '';
          return {
            id: d.id,
            uid,
            date,
            openedAtMs: toMs(raw.openedAt),
          };
        })
        .filter((item) => Boolean(item.uid) && /^\d{4}-\d{2}-\d{2}$/.test(item.date))
        .sort((a, b) => b.date.localeCompare(a.date) || b.openedAtMs - a.openedAtMs);
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
      try {
        const hashed = await hashPin(clean);
        setPinHash(hashed);
        await idbSetScoped(user.uid, 'pinHash', hashed);
        removeStorageKey(userStorageKey(user.uid, 'pinHash'));
        clearPinLockoutState(userStorageKey(user.uid, 'pinLockout'));
        setPinLockoutUntil(0);
        setIsLocked(false);
        showNotice('4-digit screen lock PIN saved.', 'success');
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Web Crypto is unavailable here. Screen lock PIN cannot be enabled.';
        showNotice(msg, 'warning');
      }
    },
    [requireSignedInUser, showNotice],
  );

  const clearAppPin = useCallback(() => {
    const user = auth.currentUser;
    setPinHash('');
    setPinLockoutUntil(0);
    if (user) {
      void idbSetScoped(user.uid, 'pinHash', '');
      removeStorageKey(userStorageKey(user.uid, 'pinHash'));
      clearPinLockoutState(userStorageKey(user.uid, 'pinLockout'));
    } else {
      clearPinLockoutState('callanalyzer.guest.pinLockout');
    }
    setIsLocked(false);
    showNotice('Screen lock PIN removed.', 'warning');
  }, [showNotice]);

  const unlockWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const user = auth.currentUser;
      const lockoutKey = user
        ? userStorageKey(user.uid, 'pinLockout')
        : 'callanalyzer.guest.pinLockout';
      const lockout = readPinLockoutState(lockoutKey);
      const now = Date.now();
      if (lockout.lockUntil > now) {
        setPinLockoutUntil(lockout.lockUntil);
        triggerHaptic('warning');
        return false;
      }
      const ok = await verifyPin(pin, pinHash);
      if (ok) {
        clearPinLockoutState(lockoutKey);
        setPinLockoutUntil(0);
        triggerHaptic('success');
        setIsLocked(false);
        return true;
      }
      const nextAttempts = lockout.failedAttempts + 1;
      const delay = getPinLockoutDelayMs(nextAttempts);
      const nextLockUntil = delay > 0 ? Date.now() + delay : 0;
      writePinLockoutState(lockoutKey, {
        failedAttempts: nextAttempts,
        lockUntil: nextLockUntil,
      });
      setPinLockoutUntil(nextLockUntil);
      triggerHaptic('warning');
      return false;
    },
    [pinHash],
  );

  const lockApp = useCallback(() => {
    if (!pinHash) {
      showNotice('Set a 4-digit screen lock PIN first.');
      return;
    }
    triggerHaptic('tap');
    setIsLocked(true);
  }, [pinHash, showNotice]);

  // Internal addCall workhorse used by both native Android sync and file/backup imports.
  // Deduplicates by normalized number + timestamp + duration (and ID) and merges
  // empty local tag/note/name/sim fields without overwriting non-empty local values.
  const addCall = useCallback(
    (input: CallRecord | CallRecord[]): ImportCounts => {
      const user = requireSignedInUser(
        'Login or create an account to import your own call history.',
      );
      if (!user) return { added: 0, duplicates: 0, merged: 0 };

      const records = Array.isArray(input) ? input : [input];
      if (records.length === 0) return { added: 0, duplicates: 0, merged: 0 };

      const nextCalls = [...stateRef.current.calls];
      const indexById = new Map<string, number>();
      const indexByDedup = new Map<string, number>();
      nextCalls.forEach((c, idx) => {
        indexById.set(c.id, idx);
        indexByDedup.set(buildCallDedupKey(c), idx);
      });

      const contactsMap = stateRef.current.contacts;
      const fresh: CallRecord[] = [];
      const updatedExistingMap = new Map<string, CallRecord>();
      let dupCount = 0;

      records.forEach((rawRec) => {
        const rec = healCallRecord(rawRec);
        const dedupKey = buildCallDedupKey(rec);
        const matchIdx = indexById.get(rec.id) ?? indexByDedup.get(dedupKey);

        if (matchIdx !== undefined) {
          dupCount += 1;
          const currentRec = nextCalls[matchIdx];
          const { merged, changed } = mergeCallWithoutOverwrite(currentRec, rec);
          if (changed) {
            nextCalls[matchIdx] = merged;
            updatedExistingMap.set(merged.id, merged);
          }
          return;
        }

        const contact = contactsMap[getContactKey(rec.number)];
        const inheritedTag = rec.tag?.trim() || contact?.tag?.trim() || null;
        const inheritedName =
          rec.name?.trim() ||
          (contact?.name?.trim() && contact.name.trim() !== contact.number
            ? contact.name.trim()
            : null);
        const cleanRec: CallRecord =
          inheritedTag !== rec.tag || inheritedName !== rec.name
            ? { ...rec, tag: inheritedTag, name: inheritedName }
            : rec;

        if (cleanRec.tag) {
          addCustomTag(cleanRec.tag);
        }

        const insertIdx = nextCalls.length;
        nextCalls.push(cleanRec);
        indexById.set(cleanRec.id, insertIdx);
        indexByDedup.set(dedupKey, insertIdx);
        fresh.push(cleanRec);
      });

      const updatedExisting = Array.from(updatedExistingMap.values());
      if (fresh.length > 0 || updatedExisting.length > 0) {
        const orderedCalls = [...nextCalls].sort((a, b) => b.timestamp - a.timestamp);
        stateRef.current = { ...stateRef.current, calls: orderedCalls };
        setCalls(orderedCalls);
      }

      return {
        added: fresh.length,
        duplicates: dupCount,
        merged: updatedExisting.length,
        addedIds: fresh.map((c) => c.id),
      };
    },
    [addCustomTag, requireSignedInUser],
  );

  const importCalls = useCallback(
    (records: CallRecord[]): ImportCounts => addCall(records),
    [addCall],
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
      const syncSuffix = 'nativeLastCallSync';

      try {
        if (hasNativeCallLogSyncPlugin()) {
          const perm = await getCallLogSyncPermissionStatus();
          if (perm && perm.callLog !== 'granted') {
            if (manual) {
              showNotice(
                'Allow Call Log permission first to sync calls from your phone.',
                'warning',
              );
            }
            return;
          }

          const hasFullHistorySynced = await getScopedWithLegacyMigration<boolean>(
            user.uid,
            'fullHistorySyncedV3',
            false,
          );
          const effectiveFullResync = fullResync || !hasFullHistorySynced;

          let lastProgressNoticeAt = 0;
          const result = await syncNativeCallLogIncremental({
            fullResync: effectiveFullResync,
            onProgress: (loadedCount, pageNum) => {
              if (manual && pageNum >= 2 && loadedCount - lastProgressNoticeAt >= 10_000) {
                lastProgressNoticeAt = loadedCount;
                showNotice(
                  `Syncing phone call logs… ${loadedCount.toLocaleString()} scanned so far`,
                  'tap',
                );
              }
            },
          });
          let counts: ImportCounts = { added: 0, duplicates: 0, merged: 0 };
          if (result.calls.length > 0) {
            counts = addCall(result.calls);
            if (result.maxCallId > 0) {
              await acknowledgeNativeSyncedCalls(result.maxCallId);
            }
          }
          if (!hasFullHistorySynced && (result.calls.length > 0 || perm?.callLog === 'granted')) {
            await idbSetScoped(user.uid, 'fullHistorySyncedV3', true);
          }

          if (result.returnedCallIds.length > 0) {
            const currentDismissed = stateRef.current.dismissedMissedArray;
            const currentSet = new Set(currentDismissed);
            const newlyReturned = result.returnedCallIds.filter((id) => !currentSet.has(id));
            if (newlyReturned.length > 0) {
              const merged = Array.from(new Set([...newlyReturned, ...currentDismissed])).slice(0, 500);
              setDismissedMissedArray(merged);
            }
          }

          if (counts.added > 0 && counts.addedIds && counts.addedIds.length > 0) {
            const cutoff = prevCallsTabOpenedAtRef.current || stateRef.current.callsTabState.lastOpenedAt;
            const fetchedIdSet = new Set(counts.addedIds);
            const eligibleNewIds =
              cutoff > 0
                ? result.calls
                    .filter((c) => fetchedIdSet.has(c.id) && c.timestamp > cutoff)
                    .map((c) => c.id)
                : !effectiveFullResync
                  ? counts.addedIds
                  : [];

            if (eligibleNewIds.length > 0) {
              setSessionNewCallIdsList((prev) =>
                Array.from(new Set([...eligibleNewIds, ...prev])).slice(0, 500),
              );
              if (!callsTabActiveRef.current) {
                setCallsTabState((prev) => ({
                  ...prev,
                  unseenCallIds: Array.from(
                    new Set([...eligibleNewIds, ...prev.unseenCallIds]),
                  ).slice(0, 500),
                }));
              }
            }
          }

          if (counts.added > 0) {
            showNotice(
              `Synced ${counts.added.toLocaleString()} call${counts.added === 1 ? '' : 's'} from your phone (${stateRef.current.calls.length.toLocaleString()} total).`,
              'success',
            );
          } else if (manual) {
            showNotice(
              result.calls.length > 0
                ? `Phone call logs up to date (${result.calls.length.toLocaleString()} checked · ${stateRef.current.calls.length.toLocaleString()} in app).`
                : 'Phone call logs are already up to date.',
              'tap',
            );
          }
          return;
        }

        const lastSince = fullResync
          ? 0
          : await getScopedWithLegacyMigration<number>(user.uid, syncSuffix, 0);
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
        const counts = addCall(fetched);
        await idbSetScoped(user.uid, syncSuffix, maxTs);
        if (counts.added > 0 && counts.addedIds && counts.addedIds.length > 0) {
          const cutoff = prevCallsTabOpenedAtRef.current || stateRef.current.callsTabState.lastOpenedAt;
          const fetchedIdSet = new Set(counts.addedIds);
          const eligibleNewIds =
            cutoff > 0
              ? fetched
                  .filter((c) => fetchedIdSet.has(c.id) && c.timestamp > cutoff)
                  .map((c) => c.id)
              : !fullResync
                ? counts.addedIds
                : [];
          if (eligibleNewIds.length > 0) {
            setSessionNewCallIdsList((prev) =>
              Array.from(new Set([...eligibleNewIds, ...prev])).slice(0, 500),
            );
            if (!callsTabActiveRef.current) {
              setCallsTabState((prev) => ({
                ...prev,
                unseenCallIds: Array.from(
                  new Set([...eligibleNewIds, ...prev.unseenCallIds]),
                ).slice(0, 500),
              }));
            }
          }
        }
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
            reminderPrefs.missedCallReminderEnabled &&
            stateRef.current.alertTypePrefs.missedCalls &&
            stateRef.current.alertSnoozedDate !== toEatDateString() &&
            !isWithinQuietHours(reminderPrefs)
          ) {
            const cKey = getContactKey(latestNewMissed.number);
            const muteKey = `missed:${cKey}`;
            if (!stateRef.current.mutedAlertKeys.includes(muteKey)) {
              const label = latestNewMissed.name?.trim() || latestNewMissed.number;
              void deliverSystemNotification(
                latestNewMissed.id,
                `Missed call from ${label}`,
                'Open Call Analyzer to call back or schedule a reminder.',
                {
                  category: 'other',
                  number: latestNewMissed.number,
                  contactKey: cKey,
                  eventId: latestNewMissed.id,
                  muteKey,
                },
              );
            }
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
      addCall,
      deliverSystemNotification,
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

  // Sync missed-call reminder preferences (toggle, 5/7/10 min delay, saved-contacts filter, quiet hours) to native Android CallLogSync
  useEffect(() => {
    if (!isNativeCapacitor() || !hasNativeCallLogSyncPlugin()) return;
    void updateNativeMissedCallSettings({
      enabled:
        notificationsEnabled &&
        reminderPrefs.missedCallReminderEnabled &&
        alertTypePrefs.missedCalls &&
        !isAlertsSnoozedToday,
      delayMinutes: reminderPrefs.missedCallReminderDelayMinutes,
      quietHoursEnabled: reminderPrefs.quietHoursEnabled,
      quietStartHour: reminderPrefs.quietStartHour,
      quietEndHour: reminderPrefs.quietEndHour,
      onlySavedContacts: Boolean(reminderPrefs.onlySavedContactsReminder),
      savedNumberKeys: Array.from(new Set(Object.keys(contacts))).slice(0, 5000),
    });
  }, [
    notificationsEnabled,
    reminderPrefs.missedCallReminderEnabled,
    reminderPrefs.missedCallReminderDelayMinutes,
    reminderPrefs.onlySavedContactsReminder,
    reminderPrefs.quietHoursEnabled,
    reminderPrefs.quietStartHour,
    reminderPrefs.quietEndHour,
    alertTypePrefs.missedCalls,
    isAlertsSnoozedToday,
    contacts,
  ]);

  // Auto-sync real-time Android call logs when running inside Capacitor with CallLogSync / CallLog installed
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
            telegramUsername: existing.telegramUsername || item.telegramUsername || undefined,
            instagramUsername: existing.instagramUsername || item.instagramUsername || undefined,
            updatedAt: Date.now(),
          });
          nextMap[key] = merged;
          changedProfiles.push(merged);
        }
      });

      setContacts(nextMap);

      setCalls((prev) =>
        prev.map((call) => {
          const match = incomingByKey.get(getContactKey(call.number));
          if (!match) return call;
          return healCallRecord({
            ...call,
            name: match.name && match.name !== match.number ? match.name : call.name,
            tag: match.tag || call.tag,
          });
        }),
      );

      return { added, updated };
    },
    [requireSignedInUser],
  );

  const importBackupPackage = useCallback(
    (pkg: ParsedImportPackage): BackupRestoreCounts => {
      const user = requireSignedInUser(
        'Login or create an account to import calls and backups.',
      );
      if (!user) {
        return {
          callsAdded: 0,
          callsDuplicates: 0,
          callsMerged: 0,
          contactsAdded: 0,
          contactsUpdated: 0,
          scheduledAdded: 0,
          tagsAdded: 0,
          restoredSections: [],
        };
      }

      const restoredSections: string[] = [];
      let tagsAdded = 0;

      if (pkg.tags.length > 0) {
        const existingLower = new Set(customTags.map((t) => t.trim().toLowerCase()));
        pkg.tags.forEach((tag) => {
          if (!existingLower.has(tag.trim().toLowerCase())) {
            existingLower.add(tag.trim().toLowerCase());
            tagsAdded += 1;
          }
          addCustomTag(tag);
        });
        if (tagsAdded > 0) restoredSections.push('Tags');
      }

      // Merge contacts without overwriting existing non-empty local values
      let contactsAdded = 0;
      let contactsUpdated = 0;
      if (pkg.contacts.length > 0) {
        const mergedContactsMap = { ...stateRef.current.contacts };
        const changedContacts: ContactProfile[] = [];
        pkg.contacts.forEach((rawItem) => {
          const item = healContactProfile(rawItem);
          const key = item.key || getContactKey(item.number);
          const existing = mergedContactsMap[key];
          if (!existing) {
            contactsAdded += 1;
            const created = { ...item, key };
            mergedContactsMap[key] = created;
            changedContacts.push(created);
          } else {
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
            const nextName =
              existing.name.trim() && existing.name.trim() !== existing.number
                ? existing.name
                : item.name && item.name !== item.number
                  ? item.name
                  : existing.name;
            const nextTag = existing.tag.trim() ? existing.tag : item.tag;
            const nextNotes = existing.notes.trim() ? existing.notes : item.notes;
            const nextBirthday = existing.birthday ?? item.birthday;
            const nextTelegram = existing.telegramUsername || item.telegramUsername || undefined;
            const nextInstagram = existing.instagramUsername || item.instagramUsername || undefined;

            if (
              nextName !== existing.name ||
              nextTag !== existing.tag ||
              nextNotes !== existing.notes ||
              nextBirthday !== existing.birthday ||
              nextTelegram !== existing.telegramUsername ||
              nextInstagram !== existing.instagramUsername ||
              mergedEvents.length !== existing.events.length
            ) {
              contactsUpdated += 1;
              const updatedProfile = healContactProfile({
                ...existing,
                name: nextName,
                tag: nextTag,
                notes: nextNotes,
                birthday: nextBirthday,
                events: mergedEvents,
                telegramUsername: nextTelegram,
                instagramUsername: nextInstagram,
                updatedAt: Date.now(),
              });
              mergedContactsMap[key] = updatedProfile;
              changedContacts.push(updatedProfile);
            }
          }
        });

        if (changedContacts.length > 0) {
          stateRef.current = { ...stateRef.current, contacts: mergedContactsMap };
          setContacts(mergedContactsMap);
          restoredSections.push('Contacts');
        }
      }

      // Import calls (normalized dedup + non-overwriting merge)
      const callCounts = addCall(pkg.calls);
      if (callCounts.added > 0 || (callCounts.merged ?? 0) > 0) {
        restoredSections.push('Calls');
      }

      // Merge scheduled calls (preserving status & deduplicating by contact + timestamp)
      let scheduledAdded = 0;
      if (pkg.scheduledCalls.length > 0) {
        const existingSched = stateRef.current.scheduledCalls;
        const existingKeys = new Set(
          existingSched.map((s) => `${getContactKey(s.number)}|${Math.round(s.scheduledFor)}`),
        );
        const freshScheduled: ScheduledCall[] = [];
        pkg.scheduledCalls.forEach((item) => {
          const sKey = `${getContactKey(item.number)}|${Math.round(item.scheduledFor)}`;
          if (existingKeys.has(sKey)) return;
          existingKeys.add(sKey);
          freshScheduled.push(healScheduledCall(item));
        });
        if (freshScheduled.length > 0) {
          scheduledAdded = freshScheduled.length;
          const nextScheduled = [...freshScheduled, ...existingSched].sort(
            (a, b) => a.scheduledFor - b.scheduledFor,
          );
          stateRef.current = { ...stateRef.current, scheduledCalls: nextScheduled };
          setScheduledCalls(nextScheduled);
          restoredSections.push('Scheduled Calls');
        }
      }

      // Merge local workspace sets (kept in IndexedDB only) & account settings
      const workspaceOverrides: Record<string, unknown> = {};
      if (pkg.favorites.length > 0) {
        const mergedFavs = Array.from(
          new Set([...stateRef.current.favoritesArray, ...pkg.favorites]),
        ).slice(0, 200);
        if (mergedFavs.length !== stateRef.current.favoritesArray.length) {
          setFavoritesArray(mergedFavs);
        }
      }
      if (pkg.dismissedMissedIds.length > 0) {
        const mergedDismissed = Array.from(
          new Set([...stateRef.current.dismissedMissedArray, ...pkg.dismissedMissedIds]),
        ).slice(0, 500);
        if (mergedDismissed.length !== stateRef.current.dismissedMissedArray.length) {
          setDismissedMissedArray(mergedDismissed);
        }
      }
      if (pkg.mutedAlertKeys.length > 0) {
        const mergedMuted = Array.from(
          new Set([...stateRef.current.mutedAlertKeys, ...pkg.mutedAlertKeys]),
        ).slice(0, 200);
        if (mergedMuted.length !== stateRef.current.mutedAlertKeys.length) {
          setMutedAlertKeys(mergedMuted);
        }
      }

      if (pkg.settings) {
        if (pkg.settings.tariffs) {
          const cleanTariffs = sanitizeTariffs(pkg.settings.tariffs);
          setTariffsState(cleanTariffs);
          workspaceOverrides.tariffs = cleanTariffs;
        }
        if (pkg.settings.simLabels) {
          const cleanSimLabels = sanitizeSimLabels(pkg.settings.simLabels);
          setSimLabelsState(cleanSimLabels);
          workspaceOverrides.simLabels = cleanSimLabels;
        }
        if (pkg.settings.calendarPrefs) {
          const cleanCal = sanitizeCalendarPrefs(pkg.settings.calendarPrefs);
          setCalendarPrefsState(cleanCal);
          workspaceOverrides.calendarPrefs = cleanCal;
        }
        if (pkg.settings.reminderPrefs) {
          const cleanRem = sanitizeReminderPrefs(pkg.settings.reminderPrefs);
          setReminderPrefsState(cleanRem);
          workspaceOverrides.reminderPrefs = cleanRem;
        }
        if (pkg.settings.alertTypePrefs) {
          const cleanAlertTypes = sanitizeAlertTypePrefs(pkg.settings.alertTypePrefs);
          setAlertTypePrefsState(cleanAlertTypes);
        }
        if (pkg.settings.voiceBundles) {
          const cleanBundles = sanitizeVoiceBundles(pkg.settings.voiceBundles);
          setVoiceBundlesState(cleanBundles);
          workspaceOverrides.voiceBundles = cleanBundles;
        }
        if (typeof pkg.settings.notificationsEnabled === 'boolean') {
          setNotificationsEnabledState(pkg.settings.notificationsEnabled);
          workspaceOverrides.notificationsEnabled = pkg.settings.notificationsEnabled;
        }
        if (pkg.settings.themePreference) {
          setThemePreferenceState(pkg.settings.themePreference);
          const resolvedTheme: ThemeMode =
            pkg.settings.themePreference === 'system'
              ? systemIsDark
                ? 'dark-gray'
                : 'light'
              : pkg.settings.themePreference;
          workspaceOverrides.theme = resolvedTheme;
        }
        if (pkg.settings.fontSizeScale) {
          setFontSizeScaleState(pkg.settings.fontSizeScale);
        }
        if (pkg.settings.profileName && !stateRef.current.profileName.trim()) {
          setProfileNameState(pkg.settings.profileName);
          workspaceOverrides.profileName = pkg.settings.profileName;
        }
        if (Array.isArray(pkg.settings.expandedSettingsSections)) {
          const cleanSections = sanitizeExpandedSettingsSections(pkg.settings.expandedSettingsSections);
          setExpandedSettingsSectionsState(cleanSections);
          stateRef.current = { ...stateRef.current, expandedSettingsSections: cleanSections };
        }
        restoredSections.push('Settings');
      }

      if (Object.keys(workspaceOverrides).length > 0) {
        void ensureWorkspaceReady(user.uid)
          .then(() => persistWorkspaceToCloud(user, workspaceOverrides))
          .catch(() => {});
      }

      let nextStreaksState = stateRef.current.streaks;
      if (pkg.streaks) {
        const current = stateRef.current.streaks;
        const incomingLast = pkg.streaks.lastActiveDate;
        const currentLast = current.lastActiveDate;
        let newestLastDate = currentLast || incomingLast || null;
        let mergedCurrentStreak = Math.max(current.currentStreak, pkg.streaks.currentStreak);
        if (incomingLast && currentLast) {
          const diff = eatDateDiffDays(currentLast, incomingLast);
          if (Number.isFinite(diff) && diff > 0) {
            newestLastDate = incomingLast;
            mergedCurrentStreak = pkg.streaks.currentStreak;
          } else if (Number.isFinite(diff) && diff < 0) {
            newestLastDate = currentLast;
            mergedCurrentStreak = current.currentStreak;
          }
        } else if (incomingLast && !currentLast) {
          newestLastDate = incomingLast;
          mergedCurrentStreak = pkg.streaks.currentStreak;
        }

        nextStreaksState = getEffectiveStreak({
          currentStreak: mergedCurrentStreak,
          longestStreak: Math.max(current.longestStreak, pkg.streaks.longestStreak),
          lastActiveDate: newestLastDate,
          totalActiveDays: Math.max(
            current.totalActiveDays ?? 0,
            pkg.streaks.totalActiveDays ?? 0,
          ),
        });
        stateRef.current = { ...stateRef.current, streaks: nextStreaksState };
        setStreaksState(nextStreaksState);
        restoredSections.push('Streaks');
      }

      let nextHistoryState = stateRef.current.pointsHistory;
      if (pkg.pointsHistory.length > 0) {
        const merged = mergePointsHistory(stateRef.current.pointsHistory, pkg.pointsHistory);
        nextHistoryState = merged.merged;
        stateRef.current = { ...stateRef.current, pointsHistory: nextHistoryState };
        setPointsHistoryState(nextHistoryState);
        restoredSections.push('Score');
      } else if (
        pkg.importedScore !== null &&
        pkg.importedScore > 0 &&
        stateRef.current.pointsHistory.length === 0
      ) {
        const baselineEntry: PointsHistoryEntry = {
          id: `restored_score:${pkg.importedScore}`,
          reason: 'daily_open',
          points: pkg.importedScore,
          label: 'Restored backup score',
          timestamp: Date.now(),
          eatDate: toEatDateString(),
        };
        nextHistoryState = [baselineEntry];
        stateRef.current = { ...stateRef.current, pointsHistory: nextHistoryState };
        setPointsHistoryState(nextHistoryState);
        restoredSections.push('Score');
      }

      const byBadgeId = new Map<string, BadgeRecord>();
      stateRef.current.badges.forEach((b) => byBadgeId.set(b.id, b));
      pkg.badges.forEach((b) => {
        const existing = byBadgeId.get(b.id);
        if (!existing || b.unlockedAt < existing.unlockedAt) {
          byBadgeId.set(b.id, b);
        }
      });
      const reconciled = reconcileBadges(
        nextStreaksState,
        nextHistoryState,
        Array.from(byBadgeId.values()),
      );
      if (reconciled.badges.length > 0 || pkg.badges.length > 0) {
        stateRef.current = { ...stateRef.current, badges: reconciled.badges };
        setBadgesState(reconciled.badges);
        if (pkg.badges.length > 0 || reconciled.newlyUnlocked.length > 0) {
          restoredSections.push('Badges');
        }
      }

      if (pkg.contactMilestones.length > 0) {
        const byMilestoneId = new Map<string, ContactMilestoneRecord>();
        stateRef.current.contactMilestones.forEach((m) => byMilestoneId.set(m.id, m));
        pkg.contactMilestones.forEach((m) => {
          const existing = byMilestoneId.get(m.id);
          if (!existing) {
            byMilestoneId.set(m.id, m);
          } else {
            byMilestoneId.set(m.id, {
              ...existing,
              awardedAt: Math.min(existing.awardedAt, m.awardedAt),
              celebratedAt: existing.celebratedAt ?? m.celebratedAt,
            });
          }
        });
        const mergedMilestones = Array.from(byMilestoneId.values()).sort(
          (a, b) => b.awardedAt - a.awardedAt || b.days - a.days,
        );
        stateRef.current = { ...stateRef.current, contactMilestones: mergedMilestones };
        setContactMilestonesState(mergedMilestones);
        restoredSections.push('Milestones');
      }

      if (Object.keys(pkg.wishTemplates).length > 0) {
        const mergedTemplates = sanitizeWishTemplates({
          ...pkg.wishTemplates,
          ...stateRef.current.wishTemplates,
        });
        stateRef.current = { ...stateRef.current, wishTemplates: mergedTemplates };
        setWishTemplatesState(mergedTemplates);
        restoredSections.push('Wishes');
      }

      if (pkg.sentWishes.length > 0) {
        const byWishId = new Map<string, SentWishRecord>();
        stateRef.current.sentWishes.forEach((w) => byWishId.set(w.id, w));
        pkg.sentWishes.forEach((w) => {
          if (!byWishId.has(w.id)) byWishId.set(w.id, w);
        });
        const mergedSentWishes = Array.from(byWishId.values()).sort(
          (a, b) => b.timestamp - a.timestamp,
        );
        stateRef.current = { ...stateRef.current, sentWishes: mergedSentWishes };
        setSentWishesState(mergedSentWishes);
        if (!restoredSections.includes('Wishes')) restoredSections.push('Wishes');
      }

      if (Object.keys(pkg.snoozedQuietUntil).length > 0) {
        const nowMs = Date.now();
        const mergedSnoozed: Record<string, number> = { ...stateRef.current.snoozedQuietUntil };
        Object.entries(pkg.snoozedQuietUntil).forEach(([k, until]) => {
          if (until > nowMs) {
            mergedSnoozed[k] = Math.max(mergedSnoozed[k] ?? 0, until);
          }
        });
        const cleanSnoozed = sanitizeSnoozedQuietUntil(mergedSnoozed);
        stateRef.current = { ...stateRef.current, snoozedQuietUntil: cleanSnoozed };
        setSnoozedQuietUntilState(cleanSnoozed);
        restoredSections.push('Reconnect Progress');
      }

      if (pkg.reconnectProgress && pkg.reconnectProgress.weekKey === getEatWeekKey()) {
        const current = sanitizeReconnectProgress(stateRef.current.reconnectProgress);
        const mergedKeys = Array.from(
          new Set([...current.contactedKeys, ...pkg.reconnectProgress.contactedKeys]),
        ).slice(0, 200);
        const nextReconnect: ReconnectProgressRecord = {
          weekKey: current.weekKey,
          contactedKeys: mergedKeys,
        };
        stateRef.current = { ...stateRef.current, reconnectProgress: nextReconnect };
        setReconnectProgressState(nextReconnect);
        if (!restoredSections.includes('Reconnect Progress')) {
          restoredSections.push('Reconnect Progress');
        }
      }

      return {
        callsAdded: callCounts.added,
        callsDuplicates: callCounts.duplicates,
        callsMerged: callCounts.merged ?? 0,
        contactsAdded,
        contactsUpdated,
        scheduledAdded,
        tagsAdded,
        restoredSections,
      };
    },
    [
      addCall,
      addCustomTag,
      customTags,
      ensureWorkspaceReady,
      persistWorkspaceToCloud,
      requireSignedInUser,
      systemIsDark,
    ],
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

    return counts;
  }, [importCalls, requireSignedInUser]);

  const patchCall = useCallback(
    (id: string, patch: CallPatch, options?: { applyTagToContact?: boolean }) => {
      const user = requireSignedInUser();
      if (!user) return;
      triggerHaptic('success');
      const existingCall = stateRef.current.calls.find((c) => c.id === id);
      if (!existingCall) return;

      const cleanTag = patch.tag !== undefined ? (patch.tag?.trim() || null) : existingCall.tag;
      if (cleanTag) {
        addCustomTag(cleanTag);
      }

      const applyToContact = Boolean(options?.applyTagToContact && patch.tag !== undefined);
      const targetKey = getContactKey(existingCall.number);

      setCalls((prev) =>
        prev.map((call) => {
          if (call.id === id) {
            return { ...call, ...patch, tag: cleanTag };
          }
          if (applyToContact && getContactKey(call.number) === targetKey) {
            return {
              ...call,
              tag: cleanTag,
              name: patch.name !== undefined ? patch.name || call.name : call.name,
            };
          }
          return call;
        }),
      );

      if (applyToContact) {
        const prevProfile = stateRef.current.contacts[targetKey];
        const nextProfile: ContactProfile = healContactProfile({
          key: targetKey,
          number: prevProfile?.number || existingCall.number,
          name:
            (patch.name !== undefined ? patch.name?.trim() : '') ||
            prevProfile?.name ||
            existingCall.name ||
            existingCall.number,
          tag: cleanTag ?? '',
          birthday: prevProfile?.birthday ?? null,
          events: prevProfile?.events ?? [],
          notes: prevProfile?.notes ?? '',
          updatedAt: Date.now(),
        });
        setContacts((prev) => ({ ...prev, [targetKey]: nextProfile }));
      }

      const updatedCall = { ...existingCall, ...patch, tag: cleanTag };
      const tagNotePoint = createTagOrNotePointEntry(updatedCall, stateRef.current.pointsHistory);
      if (tagNotePoint) {
        const mergedHistory = mergePointsHistory(stateRef.current.pointsHistory, [tagNotePoint]).merged;
        stateRef.current = { ...stateRef.current, pointsHistory: mergedHistory };
        setPointsHistoryState(mergedHistory);
        const badgeResult = reconcileBadges(
          stateRef.current.streaks,
          mergedHistory,
          stateRef.current.badges,
        );
        if (badgeResult.badges.length !== stateRef.current.badges.length || badgeResult.newlyUnlocked.length > 0) {
          stateRef.current = { ...stateRef.current, badges: badgeResult.badges };
          setBadgesState(badgeResult.badges);
        }
        showNotice(`+${POINTS_CONFIG.CALL_TAG_OR_NOTE} pts earned for tagging/noting a call`, 'success');
      }
    },
    [addCustomTag, requireSignedInUser, showNotice],
  );

  const removeCall = useCallback(
    (id: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      triggerHaptic('warning');
      setCalls((prev) => prev.filter((call) => call.id !== id));
    },
    [requireSignedInUser],
  );

  const clearCalls = useCallback(() => {
    const user = requireSignedInUser();
    if (!user) return;
    setCalls([]);
    setDismissedMissedArray([]);
    showNotice('Call history cleared.', 'warning');
  }, [requireSignedInUser, showNotice]);

  const mergeContacts = useCallback(
    (sourceNumber: string, targetNumber: string, targetName: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      const sourceNorm = normaliseEthPhone(sourceNumber);
      const cleanTargetNumber = targetNumber.trim();
      const cleanName = targetName.trim() || null;

      setCalls((prev) =>
        prev.map((call) => {
          if (
            call.number === sourceNumber ||
            normaliseEthPhone(call.number) === sourceNorm
          ) {
            return {
              ...call,
              number: cleanTargetNumber,
              name: cleanName ?? call.name,
            };
          }
          if (call.number === cleanTargetNumber && cleanName && !call.name) {
            return { ...call, name: cleanName };
          }
          return call;
        }),
      );

      showNotice(`Merged into ${cleanName ?? cleanTargetNumber}.`, 'success');
    },
    [requireSignedInUser, showNotice],
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
      if (cleanProfile.tag.trim()) {
        addCustomTag(cleanProfile.tag);
      }
      setContacts((prev) => ({ ...prev, [key]: cleanProfile }));

      const nextTag = cleanProfile.tag.trim() || null;
      setCalls((prev) =>
        prev.map((call) => {
          if (getContactKey(call.number) !== key) return call;
          const nextName =
            cleanProfile.name.trim() && cleanProfile.name.trim() !== cleanProfile.number
              ? cleanProfile.name.trim()
              : call.name;
          if (call.name === nextName && (call.tag || null) === nextTag) return call;
          return {
            ...call,
            name: nextName,
            tag: nextTag,
          };
        }),
      );
    },
    [addCustomTag, requireSignedInUser],
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
      showNotice('Contact removed.', 'warning');
    },
    [requireSignedInUser, showNotice],
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

      const notifyLabel = formatDisplayNameOrPhone(resolvedName, number);

      if (
        notificationsEnabled &&
        !isWithinQuietHours(reminderPrefs) &&
        isNativeCapacitor() &&
        hasNativeNotificationsPlugin()
      ) {
        void scheduleNativeNotification(
          item.id,
          `Call reminder: ${notifyLabel}`,
          item.note || `Scheduled call to ${number}`,
          item.scheduledFor,
          {
            category: 'schedule',
            number: item.number,
            contactKey: getContactKey(item.number),
            eventId: item.id,
            muteKey: `sched:${item.id}`,
          },
        );
      }

      showNotice(`Scheduled call with ${notifyLabel}.`, 'success');
      return item;
    },
    [
      contacts,
      notificationsEnabled,
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
      setScheduledCalls((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'completed' } : item)),
      );
      showNotice('Scheduled call marked done.', 'success');
    },
    [requireSignedInUser, showNotice],
  );

  const snoozeScheduledCall = useCallback(
    (id: string, minutes: number, customNextTime?: number, skipNativeAlarm?: boolean) => {
      const user = requireSignedInUser();
      if (!user) return;
      const nextTime =
        typeof customNextTime === 'number' && customNextTime > 0
          ? customNextTime
          : Date.now() + minutes * 60_000;
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
        !skipNativeAlarm &&
        updatedItem &&
        notificationsEnabled &&
        !isWithinQuietHours(reminderPrefs) &&
        isNativeCapacitor() &&
        hasNativeNotificationsPlugin()
      ) {
        const snoozeLabel = formatDisplayNameOrPhone(updatedItem.name, updatedItem.number);
        void scheduleNativeNotification(
          id,
          `Call reminder: ${snoozeLabel}`,
          updatedItem.note || `Scheduled call to ${updatedItem.number}`,
          nextTime,
          {
            category: 'schedule',
            number: updatedItem.number,
            contactKey: getContactKey(updatedItem.number),
            eventId: id,
            muteKey: `sched:${id}`,
          },
        );
      }
      showNotice(`Snoozed reminder by ${minutes} minutes.`, 'tap');
    },
    [
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
      showNotice('Scheduled call removed.', 'warning');
    },
    [requireSignedInUser, showNotice],
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
    },
    [requireSignedInUser],
  );

  const muteAlertKey = useCallback(
    (rawKey: string) => {
      const key = clampStr(rawKey.trim(), 128);
      if (!key) return;
      const user = requireSignedInUser();
      if (!user) return;
      const current = stateRef.current.mutedAlertKeys;
      if (current.includes(key)) return;
      triggerHaptic('tap');
      const next = [key, ...current].slice(0, 200);
      setMutedAlertKeys(next);
      showNotice('Muted alerts for this contact/event.');
    },
    [requireSignedInUser, showNotice],
  );

  const unmuteAlertKey = useCallback(
    (rawKey: string) => {
      const key = rawKey.trim();
      if (!key) return;
      const user = requireSignedInUser();
      if (!user) return;
      triggerHaptic('tap');
      const next = stateRef.current.mutedAlertKeys.filter((item) => item !== key);
      setMutedAlertKeys(next);
      showNotice('Alerts unmuted.', 'success');
    },
    [requireSignedInUser, showNotice],
  );

  const updateUserProfile = useCallback(
    async (input: UpdateUserProfileInput): Promise<AuthActionResult> => {
      const user = requireSignedInUser('Sign in to update your profile.');
      if (!user) return { ok: false, error: 'Sign in required.' };

      const cleanName = clampStr(input.displayName.trim(), 120);
      if (!cleanName) {
        return { ok: false, error: 'Display name cannot be empty.' };
      }
      const cleanPhone = input.phone !== undefined
        ? (input.phone?.trim() ? clampStr(input.phone.trim(), 40) : null)
        : accountMetaRef.current.phone;
      const cleanPhoto =
        input.photoURL !== undefined
          ? (input.photoURL?.trim() ? clampStr(input.photoURL.trim(), 500) : null)
          : accountMetaRef.current.photoURL ?? user.photoURL ?? null;

      try {
        await updateProfile(user, {
          displayName: cleanName,
          ...(cleanPhoto !== undefined ? { photoURL: cleanPhoto } : {}),
        });
      } catch {
        // Continue syncing workspace + userRegistry even if Auth profile update throws on edge webview
      }

      accountMetaRef.current = {
        ...accountMetaRef.current,
        phone: cleanPhone,
        photoURL: cleanPhoto,
      };
      setProfileNameState(cleanName);
      setUserPhone(cleanPhone);
      setUserPhotoUrlState(cleanPhoto);

      await persistWorkspaceToCloud(user, {
        profileName: cleanName,
        phone: cleanPhone,
        photoURL: cleanPhoto,
      });
      await syncUserRegistry(user, cleanName, cleanPhone, cleanPhoto);
      showNotice('Profile updated.', 'success');
      return { ok: true };
    },
    [persistWorkspaceToCloud, requireSignedInUser, showNotice, syncUserRegistry],
  );

  const changeUserPassword = useCallback(
    async (input: ChangePasswordInput): Promise<AuthActionResult> => {
      const user = requireSignedInUser('Sign in to change your password.');
      if (!user || !user.email) return { ok: false, error: 'Sign in required.' };

      if (detectAuthProvider(user) === 'google') {
        return {
          ok: false,
          error: 'Google accounts manage their password directly in Google Account settings.',
        };
      }
      if (!input.currentPassword) {
        return { ok: false, error: 'Enter your current password.' };
      }
      if (input.newPassword.length < 6) {
        return { ok: false, error: 'New password must be at least 6 characters.' };
      }
      if (input.newPassword !== input.confirmPassword) {
        return { ok: false, error: 'New password and confirmation do not match.' };
      }

      try {
        const cred = EmailAuthProvider.credential(user.email, input.currentPassword);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, input.newPassword);
        showNotice('Password updated successfully.', 'success');
        return { ok: true };
      } catch (error) {
        const code = (error as { code?: string })?.code ?? '';
        if (
          code === 'auth/wrong-password' ||
          code === 'auth/invalid-credential'
        ) {
          return { ok: false, error: 'Current password is incorrect.' };
        }
        if (code === 'auth/requires-recent-login') {
          return { ok: false, error: 'Please sign out and sign in again before changing password.' };
        }
        return {
          ok: false,
          error: mapFirebaseAuthError(error, 'Could not update password right now.'),
        };
      }
    },
    [requireSignedInUser, showNotice],
  );

  // Listen to native notification action button taps (Call, +15m, Snooze, Wish, Remind later, View, Clear, Mute)
  useEffect(() => {
    if (!isNativeCapacitor() || !hasNativeNotificationsPlugin()) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    const handleAction = (event: NotificationActionEvent) => {
      const action = event.actionId;
      const targetId = event.eventId || event.idKey || '';
      const number = event.number?.trim() || '';

      if (action === 'call') {
        if (targetId && stateRef.current.scheduledCalls.some((s) => s.id === targetId)) {
          completeScheduledCall(targetId);
        }
        if (number) {
          if (!event.handledNatively) {
            window.location.href = `tel:${number}`;
          }
        } else {
          setNotificationActionTarget({ openReminders: 'action' });
        }
        return;
      }

      if (action === 'snooze_15m' || action === 'snooze_60m') {
        const mins = action === 'snooze_15m' ? 15 : 60;
        const baseTs =
          event.timestamp && event.timestamp > 0 ? event.timestamp : Date.now();
        const snoozeUntil = baseTs + mins * 60_000;
        if (event.handledNatively && snoozeUntil <= Date.now()) {
          return;
        }
        if (targetId && stateRef.current.scheduledCalls.some((s) => s.id === targetId)) {
          snoozeScheduledCall(targetId, mins, snoozeUntil, Boolean(event.handledNatively));
        } else if (number && !event.handledNatively) {
          scheduleCall({
            number,
            scheduledFor: snoozeUntil,
            note: event.title || 'Follow-up call',
          });
        }
        return;
      }

      if (action === 'remind_later') {
        if (!event.handledNatively) {
          const nextMs = Date.now() + 2 * 60 * 60_000;
          const idKey = `${event.idKey || event.eventId || 'remind'}-later-${nextMs}`;
          void scheduleNativeNotification(
            idKey,
            event.title || 'Reminder',
            event.body || 'Tap to view reminder details.',
            nextMs,
            {
              category: event.category ?? 'other',
              number: event.number ?? null,
              contactKey: event.contactKey ?? null,
              eventId: event.eventId ?? null,
              muteKey: event.muteKey ?? null,
              wishText: event.wishText ?? null,
              occasionType: event.occasionType ?? null,
              occasionKey: event.occasionKey ?? null,
            },
          );
        }
        showNotice('Reminder postponed by 2 hours.');
        return;
      }

      if (action === 'wish') {
        if (number) {
          const cKey = event.contactKey || getContactKey(number);
          const profile = stateRef.current.contacts[cKey];
          const resolvedName =
            profile?.name?.trim() ||
            formatDisplayNameOrPhone(event.title, number) ||
            number;
          const occasionType =
            event.occasionType ??
            (event.category === 'birthday'
              ? 'birthday'
              : event.category === 'holiday'
                ? 'holiday'
                : 'birthday');
          setWishComposerRequest({
            contactNumber: number,
            contactName: resolvedName,
            contactKey: cKey,
            tag: profile?.tag || undefined,
            occasionType,
            occasionKey: event.occasionKey || event.eventId || occasionType,
            occasionName: event.title || (occasionType === 'birthday' ? 'Birthday' : 'Celebration'),
            initialText: event.wishText || undefined,
            telegramUsername: profile?.telegramUsername,
            instagramUsername: profile?.instagramUsername,
          });
        } else {
          setNotificationActionTarget({ openReminders: 'wishes' });
        }
        return;
      }

      if (action === 'clear') {
        if (targetId && stateRef.current.scheduledCalls.some((s) => s.id === targetId)) {
          completeScheduledCall(targetId);
        } else if (targetId) {
          dismissMissedCall(targetId);
        }
        if (event.idKey) void cancelNativeNotification(event.idKey);
        showNotice('Reminder cleared.');
        return;
      }

      if (action === 'mute') {
        const mKey =
          event.muteKey ||
          (event.contactKey ? `contact:${event.contactKey}` : event.idKey || '');
        if (mKey) {
          muteAlertKey(mKey);
        }
        if (targetId && stateRef.current.scheduledCalls.some((s) => s.id === targetId)) {
          completeScheduledCall(targetId);
        }
        if (event.idKey) void cancelNativeNotification(event.idKey);
        return;
      }

      // Default 'view' / 'open'
      if (event.category === 'holiday') {
        setNotificationActionTarget({ openReminders: 'wishes' });
      } else if (number) {
        setNotificationActionTarget({ contactNumber: number });
      } else if (event.category === 'birthday') {
        setNotificationActionTarget({ openReminders: 'wishes' });
      } else {
        setNotificationActionTarget({ openReminders: 'action' });
      }
    };

    void subscribeNativeNotificationActions((event) => {
      if (!cancelled) handleAction(event);
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unsub = cleanup;
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [completeScheduledCall, dismissMissedCall, muteAlertKey, scheduleCall, showNotice, snoozeScheduledCall]);

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

  const setAlertTypePrefs = useCallback(
    (next: AlertTypePrefs) => {
      triggerHaptic('tap');
      const clean = sanitizeAlertTypePrefs(next);
      setAlertTypePrefsState(clean);
      showNotice('Alert type preferences saved.', 'success');
    },
    [showNotice],
  );

  const snoozeAlertsForToday = useCallback(() => {
    triggerHaptic('tap');
    const eatDay = toEatDateString();
    setTodayEat(eatDay);
    setAlertSnoozedDate(eatDay);
    showNotice('Alerts snoozed for today.');
  }, [showNotice]);

  const resumeSnoozedAlertsToday = useCallback(() => {
    triggerHaptic('tap');
    setAlertSnoozedDate(null);
    showNotice('Alerts resumed for today.', 'success');
  }, [showNotice]);

  const markAllAlertsRead = useCallback(
    (keys: string[]) => {
      const cleanIncoming = keys.map((k) => k.trim()).filter(Boolean);
      if (cleanIncoming.length === 0) return;
      triggerHaptic('tap');
      setReadAlertKeys((prev) => Array.from(new Set([...cleanIncoming, ...prev])).slice(0, 600));
      showNotice('All alerts marked as read.');
    },
    [showNotice],
  );

  const markGuideSeen = useCallback(() => {
    setGuideSeen(true);
    setWhatsNewSeenVersion((prev) => {
      const nextMeta: AppSeenMeta = {
        guideSeen: true,
        whatsNewVersion: prev,
      };
      void idbSetScoped(DEVICE_META_SCOPE, 'appSeenMeta', nextMeta);
      return prev;
    });
  }, []);

  const markWhatsNewSeen = useCallback((version: string) => {
    const clean = version.trim();
    if (!clean) return;
    setWhatsNewSeenVersion(clean);
    setGuideSeen((prevGuide) => {
      const nextMeta: AppSeenMeta = {
        guideSeen: prevGuide,
        whatsNewVersion: clean,
      };
      void idbSetScoped(DEVICE_META_SCOPE, 'appSeenMeta', nextMeta);
      return prevGuide;
    });
  }, []);

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
    },
    [requireSignedInUser],
  );

  const setThemeMode = useCallback(
    (mode: ThemePreference) => {
      triggerHaptic('tap');
      const liveSystemDark =
        typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : systemIsDark;
      const resolvedNext: ThemeMode =
        mode === 'system' ? (liveSystemDark ? 'dark-gray' : 'light') : mode;
      lastLocalThemeChangeAtRef.current = Date.now();
      themePreferenceRef.current = mode;
      stateRef.current = { ...stateRef.current, theme: resolvedNext };
      setSystemIsDark(liveSystemDark);
      setThemePreferenceState(mode);
      const user = auth.currentUser;
      if (user && user.emailVerified) {
        void ensureWorkspaceReady(user.uid).then(() =>
          persistWorkspaceToCloud(user, { theme: resolvedNext }),
        );
      }
    },
    [ensureWorkspaceReady, persistWorkspaceToCloud, systemIsDark],
  );

  const toggleTheme = useCallback(() => {
    triggerHaptic('tap');
    const isCurrentlyDark = stateRef.current.theme === 'dark-gray';
    const next: ThemeMode = isCurrentlyDark ? 'light' : 'dark-gray';
    lastLocalThemeChangeAtRef.current = Date.now();
    themePreferenceRef.current = next;
    stateRef.current = { ...stateRef.current, theme: next };
    setThemePreferenceState(next);
    const user = auth.currentUser;
    if (user && user.emailVerified) {
      void ensureWorkspaceReady(user.uid).then(() =>
        persistWorkspaceToCloud(user, { theme: next }),
      );
    }
  }, [ensureWorkspaceReady, persistWorkspaceToCloud]);

  const setExpandedSettingsSections = useCallback((sections: SettingsSectionId[]) => {
    const clean = sanitizeExpandedSettingsSections(sections);
    stateRef.current = { ...stateRef.current, expandedSettingsSections: clean };
    setExpandedSettingsSectionsState(clean);
  }, []);

  const openWishComposer = useCallback((ctx: WishComposerContext) => {
    triggerHaptic('tap');
    setWishComposerRequest(ctx);
  }, []);

  const closeWishComposer = useCallback(() => {
    setWishComposerRequest(null);
  }, []);

  const saveWishTemplate = useCallback(
    (templateKey: string, templateText: string) => {
      const user = requireSignedInUser();
      if (!user) return;
      const cleanKey = clampStr(templateKey.trim(), 120);
      const cleanText = clampStr(templateText.trim(), 1000);
      if (!cleanKey || !cleanText) return;
      const next = { ...stateRef.current.wishTemplates, [cleanKey]: cleanText };
      stateRef.current = { ...stateRef.current, wishTemplates: next };
      setWishTemplatesState(next);
      showNotice('Saved as your default wish template.', 'success');
    },
    [requireSignedInUser, showNotice],
  );

  const recordWishOpened = useCallback(
    (input: {
      contactKey: string;
      occasionKey: string;
      year: number;
      channel: WishChannel;
      occasionName?: string;
      contactName?: string;
    }): { awardedPoints: number } => {
      const now = Date.now();
      const contactKey = clampStr(input.contactKey.trim(), 64);
      const occasionKey = clampStr(input.occasionKey.trim(), 120);
      const year = Math.round(input.year || new Date(now).getFullYear());
      if (!contactKey || !occasionKey) return { awardedPoints: 0 };

      const record: SentWishRecord = {
        id: `${contactKey}|${occasionKey}|${year}|${now}`,
        contactKey,
        occasionKey,
        year,
        channel: input.channel,
        timestamp: now,
      };
      const nextSent = [record, ...stateRef.current.sentWishes].slice(0, 500);
      stateRef.current = { ...stateRef.current, sentWishes: nextSent };
      setSentWishesState(nextSent);

      if (!auth.currentUser?.emailVerified || isGuestRef.current) {
        return { awardedPoints: 0 };
      }

      const pointId = `wish_opened:${contactKey}:${occasionKey}:${year}`;
      if (stateRef.current.pointsHistory.some((e) => e.id === pointId)) {
        return { awardedPoints: 0 };
      }

      const pointEntry: PointsHistoryEntry = {
        id: pointId,
        reason: 'wish_opened',
        points: POINTS_CONFIG.WISH_OPENED,
        label: `Sent ${input.occasionName || 'wish'} to ${input.contactName || contactKey}`,
        timestamp: now,
        eatDate: toEatDateString(now),
        meta: `${contactKey}:${occasionKey}:${year}`,
      };
      const merged = mergePointsHistory(stateRef.current.pointsHistory, [pointEntry]).merged;
      stateRef.current = { ...stateRef.current, pointsHistory: merged };
      setPointsHistoryState(merged);

      const badgeResult = reconcileBadges(
        stateRef.current.streaks,
        merged,
        stateRef.current.badges,
      );
      if (
        badgeResult.newlyUnlocked.length > 0 ||
        badgeResult.badges.length !== stateRef.current.badges.length
      ) {
        stateRef.current = { ...stateRef.current, badges: badgeResult.badges };
        setBadgesState(badgeResult.badges);
      }

      return { awardedPoints: POINTS_CONFIG.WISH_OPENED };
    },
    [],
  );

  const snoozeQuietContact = useCallback(
    (contactKey: string, durationMs: number | null) => {
      const cleanKey = clampStr(contactKey.trim(), 64);
      if (!cleanKey) return;
      triggerHaptic('tap');
      const next = { ...stateRef.current.snoozedQuietUntil };
      if (durationMs === null) {
        delete next[cleanKey];
      } else {
        next[cleanKey] = Date.now() + Math.max(60_000, Math.round(durationMs));
      }
      const clean = sanitizeSnoozedQuietUntil(next);
      stateRef.current = { ...stateRef.current, snoozedQuietUntil: clean };
      setSnoozedQuietUntilState(clean);
    },
    [],
  );

  const recordQuietReconnect = useCallback(
    (contactKey: string, contactLabel?: string): { awardedPoints: number } => {
      const now = Date.now();
      const cleanKey = clampStr(contactKey.trim(), 64);
      if (!cleanKey) return { awardedPoints: 0 };

      const weekKey = getEatWeekKey(now);
      const current =
        stateRef.current.reconnectProgress.weekKey === weekKey
          ? stateRef.current.reconnectProgress
          : { weekKey, contactedKeys: [] };

      if (!current.contactedKeys.includes(cleanKey)) {
        const nextProgress: ReconnectProgressRecord = {
          weekKey,
          contactedKeys: [cleanKey, ...current.contactedKeys].slice(0, 200),
        };
        stateRef.current = { ...stateRef.current, reconnectProgress: nextProgress };
        setReconnectProgressState(nextProgress);
      }

      if (!auth.currentUser?.emailVerified || isGuestRef.current) {
        return { awardedPoints: 0 };
      }

      const pointId = `reconnect_contact:${weekKey}:${cleanKey}`;
      if (stateRef.current.pointsHistory.some((e) => e.id === pointId)) {
        return { awardedPoints: 0 };
      }

      const pointEntry: PointsHistoryEntry = {
        id: pointId,
        reason: 'reconnect_contact',
        points: POINTS_CONFIG.RECONNECT_CONTACT,
        label: `Reconnected with ${contactLabel || cleanKey}`,
        timestamp: now,
        eatDate: toEatDateString(now),
        meta: cleanKey,
      };
      const merged = mergePointsHistory(stateRef.current.pointsHistory, [pointEntry]).merged;
      stateRef.current = { ...stateRef.current, pointsHistory: merged };
      setPointsHistoryState(merged);

      const badgeResult = reconcileBadges(
        stateRef.current.streaks,
        merged,
        stateRef.current.badges,
      );
      if (
        badgeResult.newlyUnlocked.length > 0 ||
        badgeResult.badges.length !== stateRef.current.badges.length
      ) {
        stateRef.current = { ...stateRef.current, badges: badgeResult.badges };
        setBadgesState(badgeResult.badges);
      }

      return { awardedPoints: POINTS_CONFIG.RECONNECT_CONTACT };
    },
    [],
  );

  const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);
  const dismissedMissedIds = useMemo(
    () => new Set(dismissedMissedArray),
    [dismissedMissedArray],
  );
  const mutedAlertSet = useMemo(() => new Set(mutedAlertKeys), [mutedAlertKeys]);
  const readAlertSet = useMemo(() => new Set(readAlertKeys), [readAlertKeys]);
  const pinEnabled = Boolean(pinHash);
  const needsEmailVerification = Boolean(authUser && !authUser.emailVerified);
  const recordDailyAppOpen = useCallback(() => {
    if (!authUser?.emailVerified || hydratedUidRef.current !== authUser.uid || isGuestRef.current) {
      return;
    }
    void recordDailyActiveClient(authUser);
    const openResult = applyDailyAppOpen(stateRef.current.streaks, stateRef.current.pointsHistory);
    let nextStreaks = stateRef.current.streaks;
    let nextHistory = stateRef.current.pointsHistory;
    if (openResult.changed) {
      nextStreaks = openResult.streaks;
      nextHistory = openResult.history;
      stateRef.current = {
        ...stateRef.current,
        streaks: nextStreaks,
        pointsHistory: nextHistory,
      };
      setStreaksState(nextStreaks);
      setPointsHistoryState(nextHistory);
    }

    const badgeResult = reconcileBadges(nextStreaks, nextHistory, stateRef.current.badges);
    if (
      badgeResult.newlyUnlocked.length > 0 ||
      badgeResult.badges.length !== stateRef.current.badges.length
    ) {
      stateRef.current = { ...stateRef.current, badges: badgeResult.badges };
      setBadgesState(badgeResult.badges);
    }
  }, [authUser, recordDailyActiveClient]);

  // Record EAT daily usage streak + daily open points when hydrated user enters the app
  useEffect(() => {
    if (!authUser?.emailVerified || !hydratedUid || hydratedUid !== authUser.uid || isGuest || isLocked) {
      return;
    }
    recordDailyAppOpen();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        recordDailyAppOpen();
      }
    };
    const onFocus = () => {
      recordDailyAppOpen();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [authUser, hydratedUid, isGuest, isLocked, recordDailyAppOpen]);

  const contactStatuses = useMemo(
    () =>
      computeContactStatuses(
        calls,
        contacts,
        reminderPrefs.missedCallReminderDelayMinutes,
      ),
    [calls, contacts, reminderPrefs.missedCallReminderDelayMinutes],
  );

  const topContactStatuses = useMemo(
    () =>
      Object.values(contactStatuses)
        .filter((s) => s.totalConnectedDays > 0 || s.contactScore > 0)
        .sort(
          (a, b) =>
            b.currentStreak - a.currentStreak ||
            b.longestStreak - a.longestStreak ||
            b.contactScore - a.contactScore,
        ),
    [contactStatuses],
  );

  // Automatically award points for quick missed callbacks and contact streak milestones
  useEffect(() => {
    if (!authUser?.emailVerified || !hydratedUid || hydratedUid !== authUser.uid || isGuest) {
      return;
    }
    const detectedQuick = detectQuickMissedCallbacks(
      calls,
      stateRef.current.pointsHistory,
      reminderPrefs.missedCallReminderDelayMinutes,
    );
    const reconciledMilestones = reconcileContactMilestones(
      contactStatuses,
      stateRef.current.contactMilestones,
      detectedQuick.history,
    );

    const hasNewPoints =
      detectedQuick.addedPoints.length > 0 || reconciledMilestones.addedPoints.length > 0;
    const hasNewMilestones = reconciledMilestones.newlyUnlocked.length > 0;

    if (!hasNewPoints && !hasNewMilestones) {
      return;
    }

    const nextHistory = reconciledMilestones.history;
    const nextMilestones = reconciledMilestones.milestones;

    stateRef.current = {
      ...stateRef.current,
      pointsHistory: nextHistory,
      contactMilestones: nextMilestones,
    };
    if (hasNewPoints) {
      setPointsHistoryState(nextHistory);
    }
    if (hasNewMilestones) {
      setContactMilestonesState(nextMilestones);
    }

    const badgeResult = reconcileBadges(
      stateRef.current.streaks,
      nextHistory,
      stateRef.current.badges,
    );
    if (
      badgeResult.newlyUnlocked.length > 0 ||
      badgeResult.badges.length !== stateRef.current.badges.length
    ) {
      stateRef.current = { ...stateRef.current, badges: badgeResult.badges };
      setBadgesState(badgeResult.badges);
    }
  }, [authUser, hydratedUid, isGuest, calls, contactStatuses, reminderPrefs.missedCallReminderDelayMinutes]);

  const pendingMilestoneCelebration = useMemo(() => {
    if (isGuest || !authUser?.emailVerified || isLocked) return null;
    const uncelebrated = contactMilestones.filter((m) => m.celebratedAt === null);
    if (uncelebrated.length === 0) return null;
    return [...uncelebrated].sort(
      (a, b) => b.days - a.days || b.awardedAt - a.awardedAt,
    )[0] ?? null;
  }, [authUser?.emailVerified, contactMilestones, isGuest, isLocked]);

  const markContactMilestoneCelebrated = useCallback((milestoneId: string) => {
    if (!milestoneId) return;
    const now = Date.now();
    const next = stateRef.current.contactMilestones.map((m) =>
      m.id === milestoneId && m.celebratedAt === null ? { ...m, celebratedAt: now } : m,
    );
    stateRef.current = { ...stateRef.current, contactMilestones: next };
    setContactMilestonesState(next);
  }, []);

  const dismissAllPendingMilestones = useCallback(() => {
    const now = Date.now();
    const next = stateRef.current.contactMilestones.map((m) =>
      m.celebratedAt === null ? { ...m, celebratedAt: now } : m,
    );
    stateRef.current = { ...stateRef.current, contactMilestones: next };
    setContactMilestonesState(next);
  }, []);

  const score = useMemo(() => computeScoreFromHistory(pointsHistory), [pointsHistory]);
  const effectiveStreaks = useMemo(() => getEffectiveStreak(streaks), [streaks]);

  const rebuildScore = useCallback((): number => {
    const detectedQuick = detectQuickMissedCallbacks(
      stateRef.current.calls,
      stateRef.current.pointsHistory,
      stateRef.current.reminderPrefs.missedCallReminderDelayMinutes,
    );
    const freshStatuses = computeContactStatuses(
      stateRef.current.calls,
      stateRef.current.contacts,
      stateRef.current.reminderPrefs.missedCallReminderDelayMinutes,
    );
    const reconciledMilestones = reconcileContactMilestones(
      freshStatuses,
      stateRef.current.contactMilestones,
      detectedQuick.history,
    );
    const nextHistory = reconciledMilestones.history;
    const nextMilestones = reconciledMilestones.milestones;
    if (
      detectedQuick.addedPoints.length > 0 ||
      reconciledMilestones.addedPoints.length > 0 ||
      reconciledMilestones.newlyUnlocked.length > 0
    ) {
      stateRef.current = {
        ...stateRef.current,
        pointsHistory: nextHistory,
        contactMilestones: nextMilestones,
      };
      setPointsHistoryState(nextHistory);
      if (reconciledMilestones.newlyUnlocked.length > 0) {
        setContactMilestonesState(nextMilestones);
      }
    }
    const badgeResult = reconcileBadges(
      stateRef.current.streaks,
      nextHistory,
      stateRef.current.badges,
    );
    if (
      badgeResult.newlyUnlocked.length > 0 ||
      badgeResult.badges.length !== stateRef.current.badges.length
    ) {
      stateRef.current = { ...stateRef.current, badges: badgeResult.badges };
      setBadgesState(badgeResult.badges);
    }
    return computeScoreFromHistory(nextHistory);
  }, []);

  const sessionNewCallIds = useMemo(
    () => new Set(sessionNewCallIdsList),
    [sessionNewCallIdsList],
  );

  const markCallsTabOpened = useCallback(() => {
    callsTabActiveRef.current = true;
    const activeUser = auth.currentUser;
    if (
      !activeUser?.emailVerified ||
      hydratedUidRef.current !== activeUser.uid ||
      isGuestRef.current
    ) {
      return;
    }
    const currentTabState = stateRef.current.callsTabState;
    if (currentTabState.lastOpenedAt > 0 && prevCallsTabOpenedAtRef.current === 0) {
      prevCallsTabOpenedAtRef.current = currentTabState.lastOpenedAt;
    }
    if (currentTabState.unseenCallIds.length > 0) {
      setSessionNewCallIdsList((prev) =>
        Array.from(new Set([...currentTabState.unseenCallIds, ...prev])).slice(0, 500),
      );
    }
    const now = Date.now();
    const nextTabState: CallsTabState = {
      lastOpenedAt: now,
      unseenCallIds: [],
    };
    stateRef.current = { ...stateRef.current, callsTabState: nextTabState };
    setCallsTabState(nextTabState);
  }, []);

  useEffect(() => {
    if (
      authUser?.emailVerified &&
      hydratedUid &&
      hydratedUid === authUser.uid &&
      !isGuest &&
      !isLocked &&
      callsTabActiveRef.current
    ) {
      markCallsTabOpened();
    }
  }, [authUser, hydratedUid, isGuest, isLocked, markCallsTabOpened]);

  const markCallSeen = useCallback((callId: string) => {
    setSessionNewCallIdsList((prev) => prev.filter((id) => id !== callId));
    setCallsTabState((prev) => {
      if (!prev.unseenCallIds.includes(callId)) return prev;
      return {
        ...prev,
        unseenCallIds: prev.unseenCallIds.filter((id) => id !== callId),
      };
    });
  }, []);

  const clearSessionNewCalls = useCallback(() => {
    callsTabActiveRef.current = false;
    setSessionNewCallIdsList([]);
  }, []);

  const authProvider = useMemo<AuthProviderType | null>(
    () => (authUser ? detectAuthProvider(authUser) : null),
    [authUser],
  );

  const value = useMemo<CallsContextValue>(
    () => ({
      calls,
      contacts,
      scheduledCalls,
      favorites,
      dismissedMissedIds,
      mutedAlertKeys,
      mutedAlertSet,
      tariffs,
      simLabels,
      calendarPrefs,
      reminderPrefs,
      alertTypePrefs,
      setAlertTypePrefs,
      alertSnoozedDate,
      isAlertsSnoozedToday,
      snoozeAlertsForToday,
      resumeSnoozedAlertsToday,
      readAlertKeys,
      readAlertSet,
      markAllAlertsRead,
      guideSeen,
      whatsNewSeenVersion,
      seenMetaReady,
      markGuideSeen,
      markWhatsNewSeen,
      voiceBundles,
      theme,
      themePreference,
      systemIsDark,
      fontSizeScale,
      setFontSizeScale,
      profileName,
      userPhotoUrl,
      notificationsEnabled,
      notificationPermission,
      refreshNotificationPermission,
      requestAlertPermissions,
      sendTestAlertNotification,
      pinEnabled,
      isLocked,
      pinLockoutUntil,
      authUser,
      authLoading,
      isGuest,
      needsEmailVerification,
      authProvider,
      userPhone,
      notificationActionTarget,
      clearNotificationActionTarget,
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
      deleteAllLocalData,
      syncNow,
      canSyncPhoneCalls,
      syncPhoneCalls,
      fetchRegisteredUsers,
      fetchDailyActiveRecords,
      setAppPin,
      clearAppPin,
      unlockWithPin,
      lockApp,
      availableTags,
      customTags,
      streaks,
      effectiveStreaks,
      badges,
      pointsHistory,
      score,
      contactStatuses,
      topContactStatuses,
      contactMilestones,
      pendingMilestoneCelebration,
      markContactMilestoneCelebrated,
      dismissAllPendingMilestones,
      rebuildScore,
      unseenNewCallIds: callsTabState.unseenCallIds,
      sessionNewCallIds,
      markCallsTabOpened,
      markCallSeen,
      clearSessionNewCalls,
      addCustomTag,
      importCalls,
      importBackupPackage,
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
      muteAlertKey,
      unmuteAlertKey,
      updateUserProfile,
      changeUserPassword,
      setTariffs,
      setSimLabels,
      setCalendarPrefs,
      setReminderPrefs,
      setVoiceBundles,
      setNotificationsEnabled,
      toggleFavorite,
      setThemeMode,
      toggleTheme,
      wishTemplates,
      sentWishes,
      snoozedQuietUntil,
      reconnectProgress,
      expandedSettingsSections,
      setExpandedSettingsSections,
      wishComposerRequest,
      openWishComposer,
      closeWishComposer,
      saveWishTemplate,
      recordWishOpened,
      snoozeQuietContact,
      recordQuietReconnect,
    }),
    [
      calls,
      contacts,
      scheduledCalls,
      favorites,
      dismissedMissedIds,
      mutedAlertKeys,
      mutedAlertSet,
      tariffs,
      simLabels,
      calendarPrefs,
      reminderPrefs,
      alertTypePrefs,
      setAlertTypePrefs,
      alertSnoozedDate,
      isAlertsSnoozedToday,
      snoozeAlertsForToday,
      resumeSnoozedAlertsToday,
      readAlertKeys,
      readAlertSet,
      markAllAlertsRead,
      guideSeen,
      whatsNewSeenVersion,
      seenMetaReady,
      markGuideSeen,
      markWhatsNewSeen,
      voiceBundles,
      theme,
      themePreference,
      systemIsDark,
      fontSizeScale,
      setFontSizeScale,
      profileName,
      userPhotoUrl,
      notificationsEnabled,
      notificationPermission,
      refreshNotificationPermission,
      requestAlertPermissions,
      sendTestAlertNotification,
      pinEnabled,
      isLocked,
      pinLockoutUntil,
      authUser,
      authLoading,
      isGuest,
      needsEmailVerification,
      authProvider,
      userPhone,
      notificationActionTarget,
      clearNotificationActionTarget,
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
      deleteAllLocalData,
      syncNow,
      canSyncPhoneCalls,
      syncPhoneCalls,
      fetchRegisteredUsers,
      fetchDailyActiveRecords,
      setAppPin,
      clearAppPin,
      unlockWithPin,
      lockApp,
      availableTags,
      customTags,
      streaks,
      effectiveStreaks,
      badges,
      pointsHistory,
      score,
      contactStatuses,
      topContactStatuses,
      contactMilestones,
      pendingMilestoneCelebration,
      markContactMilestoneCelebrated,
      dismissAllPendingMilestones,
      rebuildScore,
      callsTabState.unseenCallIds,
      sessionNewCallIds,
      markCallsTabOpened,
      markCallSeen,
      clearSessionNewCalls,
      addCustomTag,
      importCalls,
      importBackupPackage,
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
      muteAlertKey,
      unmuteAlertKey,
      updateUserProfile,
      changeUserPassword,
      setTariffs,
      setSimLabels,
      setCalendarPrefs,
      setReminderPrefs,
      setVoiceBundles,
      setNotificationsEnabled,
      toggleFavorite,
      setThemeMode,
      toggleTheme,
      wishTemplates,
      sentWishes,
      snoozedQuietUntil,
      reconnectProgress,
      expandedSettingsSections,
      setExpandedSettingsSections,
      wishComposerRequest,
      openWishComposer,
      closeWishComposer,
      saveWishTemplate,
      recordWishOpened,
      snoozeQuietContact,
      recordQuietReconnect,
    ],
  );

  return <CallsContext.Provider value={value}>{children}</CallsContext.Provider>;
}

export function useCalls(): CallsContextValue {
  const ctx = useContext(CallsContext);
  if (!ctx) throw new Error('useCalls must be used within CallsProvider');
  return ctx;
}
