export type CallDirection =
  | 'incoming'
  | 'outgoing'
  | 'missed'
  | 'rejected'
  | 'blocked'
  | 'voicemail';

export type SimSlot = 'SIM 1' | 'SIM 2' | null;

export type CallRecord = {
  id: string;
  number: string;
  name: string | null;
  direction: CallDirection;
  sim: SimSlot;
  timestamp: number;
  duration: number;
  note: string | null;
  tag: string | null;
};

export type CallPatch = Partial<Pick<CallRecord, 'note' | 'tag' | 'name'>>;

export type TimeRange = 'all' | '7d' | '30d' | '90d' | 'year' | 'custom';

export type DateRangeFilter = {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
} | null;

export type TabKey = 'calls' | 'analytics' | 'usage' | 'calendar' | 'settings' | 'admin';

export type CalendarKind = 'gregorian' | 'ethiopian';

export type ContactBirthday = {
  month: number;
  day: number;
  year?: number;
  calendar: CalendarKind;
};

export type ContactEvent = {
  id: string;
  title: string;
  month: number;
  day: number;
  year?: number;
  calendar: CalendarKind;
};

export type ContactProfile = {
  key: string; // normalised phone key
  number: string;
  name: string;
  tag: string; // Family | Friends | Coworkers | custom
  birthday: ContactBirthday | null;
  events: ContactEvent[];
  notes: string;
  telegramUsername?: string;
  instagramUsername?: string;
  updatedAt: number;
};

export type ScheduledCallStatus = 'pending' | 'completed' | 'dismissed';

export type ScheduledCall = {
  id: string;
  number: string;
  name: string | null;
  scheduledFor: number;
  note: string | null;
  sourceCallId?: string | null;
  status: ScheduledCallStatus;
  notifiedAt?: number | null;
  createdAt: number;
};

export type SimLabels = {
  sim1Label: string;
  sim2Label: string;
};

export type CalendarPrefs = {
  defaultLang: 'english' | 'amharic';
  defaultGeezNumerals: boolean;
  dateDisplay: 'ec-first' | 'both';
};

export type ReminderPrefs = {
  callbackDelayMinutes: number;
  missedCallReminderEnabled: boolean;
  missedCallReminderDelayMinutes: 5 | 7 | 10;
  onlySavedContactsReminder?: boolean;
  weeklyReconnectGoal?: number;
  eventLeadDays: number;
  quietContactDays: number;
  quietHoursEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
};

export type VoiceBundleSlot = {
  enabled: boolean;
  name: string;
  totalMinutes: number;
  priceEtb: number;
  startedAt: number;
  expiresAt: number;
};

export type VoiceBundles = {
  sim1: VoiceBundleSlot;
  sim2: VoiceBundleSlot;
};

export type AuthProviderType = 'google' | 'password';

export type RegisteredUserRecord = {
  uid: string;
  displayName: string;
  email: string;
  phone?: string | null;
  authProvider?: AuthProviderType | null;
  photoURL: string | null;
  registeredAtMs: number;
  lastActiveAtMs: number;
};

export type StreakRecord = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  totalActiveDays?: number;
};

export type BadgeRecord = {
  id: string;
  title?: string;
  description?: string;
  unlockedAt: number;
};

export type PointsReason =
  | 'daily_open'
  | 'quick_callback'
  | 'call_tag_or_note'
  | 'streak_bonus'
  | 'contact_milestone'
  | 'wish_opened'
  | 'reconnect_contact';

export type PointsHistoryEntry = {
  id: string;
  reason: PointsReason;
  points: number;
  label: string;
  timestamp: number;
  eatDate: string;
  meta?: string;
};

export type ContactBadgeItem = {
  id: string;
  days: number;
  title: string;
  description: string;
  points: number;
  earned: boolean;
  unlockedEatDate: string | null;
};

export type ContactMilestoneRun = {
  days: number;
  streakStartDate: string;
  reachedDate: string;
};

export type ContactMilestoneRecord = {
  id: string;
  contactKey: string;
  days: number;
  streakStartDate: string;
  reachedDate: string;
  badgeId: string;
  badgeTitle: string;
  points: number;
  awardedAt: number;
  celebratedAt: number | null;
};

export type ContactStreakStatus = {
  contactKey: string;
  number: string;
  displayName: string;
  tag: string;
  currentStreak: number;
  longestStreak: number;
  totalConnectedDays: number;
  totalConnectedCalls: number;
  quickCallbacksCount: number;
  taggedOrNotedCallsCount: number;
  lastConnectedDate: string | null;
  currentStreakStartDate: string | null;
  milestoneRuns: ContactMilestoneRun[];
  contactScore: number;
  unlockedMilestones: number[];
  nextMilestoneDays: number | null;
  daysToNextMilestone: number;
  statusHeadline: string;
  statusSubtext: string;
  badges: ContactBadgeItem[];
  earnedBadgesCount: number;
};

export type CallsTabState = {
  lastOpenedAt: number;
  unseenCallIds: string[];
};

export type AlertTypePrefs = {
  missedCalls: boolean;
  scheduledCalls: boolean;
  birthdays: boolean;
  holidays: boolean;
  quietContacts: boolean;
};

export type WishChannel = 'sms' | 'whatsapp' | 'telegram' | 'instagram' | 'copy';

export type WishOccasionType = 'holiday' | 'birthday' | 'reconnect';

export type WishTemplateMap = Record<string, string>;

export type SentWishRecord = {
  id: string;
  contactKey: string;
  occasionKey: string;
  year: number;
  channel: WishChannel;
  timestamp: number;
};

export type ReconnectProgressRecord = {
  weekKey: string;
  contactedKeys: string[];
};

export type SettingsSectionId =
  | 'score_badges'
  | 'appearance'
  | 'security'
  | 'sim_tariffs'
  | 'reminders'
  | 'calendar'
  | 'backup'
  | 'about';

export type WishComposerContext = {
  contactNumber: string;
  contactName: string;
  contactKey?: string;
  tag?: string;
  occasionType: WishOccasionType;
  occasionKey: string;
  occasionName: string;
  initialText?: string;
  telegramUsername?: string;
  instagramUsername?: string;
};

export type BackupSettingsSnapshot = {
  tariffs?: {
    sim1RatePerMin: number;
    sim2RatePerMin: number;
    billingMode: 'per-second' | 'per-minute';
    monthlyBudgetEtb: number;
  };
  simLabels?: SimLabels;
  calendarPrefs?: CalendarPrefs;
  reminderPrefs?: ReminderPrefs;
  alertTypePrefs?: AlertTypePrefs;
  voiceBundles?: VoiceBundles;
  notificationsEnabled?: boolean;
  themePreference?: 'system' | 'light' | 'dark-gray';
  fontSizeScale?: 'default' | 'large' | 'xlarge';
  profileName?: string;
  expandedSettingsSections?: SettingsSectionId[];
};

export type DailyActiveRecord = {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD in East Africa Time
  openedAtMs: number;
};

export type AppUpdateNotice = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes: string;
  mandatory: boolean;
};
