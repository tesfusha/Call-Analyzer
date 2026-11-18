export type CallDirection = 'incoming' | 'outgoing' | 'missed';

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
