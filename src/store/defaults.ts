import { DEFAULT_TARIFFS, type TariffConfig } from '@/src/lib/ethiopia';
import type {
  AlertTypePrefs,
  CalendarPrefs,
  CallsTabState,
  ReconnectProgressRecord,
  ReminderPrefs,
  SettingsSectionId,
  SimLabels,
  StreakRecord,
  VoiceBundles,
} from '@/src/types/call';

export { DEFAULT_TARIFFS };

export const DEFAULT_SIM_LABELS: SimLabels = {
  sim1Label: 'ETC',
  sim2Label: 'SFC',
};

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  defaultLang: 'english',
  defaultGeezNumerals: false,
  dateDisplay: 'ec-first',
};

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  callbackDelayMinutes: 15,
  missedCallReminderEnabled: true,
  missedCallReminderDelayMinutes: 7,
  onlySavedContactsReminder: false,
  weeklyReconnectGoal: 3,
  eventLeadDays: 7,
  quietContactDays: 30,
  quietHoursEnabled: false,
  quietStartHour: 22,
  quietEndHour: 7,
};

export const DEFAULT_ALERT_TYPE_PREFS: AlertTypePrefs = {
  missedCalls: true,
  scheduledCalls: true,
  birthdays: true,
  holidays: true,
  quietContacts: false,
  longGapCalls: true,
  longGapDays: 30,
};

export const DEFAULT_VOICE_BUNDLES: VoiceBundles = {
  sim1: {
    enabled: false,
    name: 'SIM 1 Monthly Package',
    totalMinutes: 200,
    priceEtb: 100,
    startedAt: 0,
    expiresAt: 0,
  },
  sim2: {
    enabled: false,
    name: 'SIM 2 Monthly Package',
    totalMinutes: 150,
    priceEtb: 85,
    startedAt: 0,
    expiresAt: 0,
  },
};

export const DEFAULT_STREAKS: StreakRecord = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  totalActiveDays: 0,
};

export const DEFAULT_CALLS_TAB_STATE: CallsTabState = {
  lastOpenedAt: 0,
  unseenCallIds: [],
};

export const DEFAULT_RECONNECT_PROGRESS: ReconnectProgressRecord = {
  weekKey: '',
  contactedKeys: [],
};

export const DEFAULT_SETTINGS_SECTIONS: SettingsSectionId[] = [];

export const DEFAULT_TARIFF_CONFIG: TariffConfig = DEFAULT_TARIFFS;
