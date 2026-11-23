export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION_NAME = '2.5.5';
export const APP_VERSION_CODE = 5;
export const APP_VERSION = APP_VERSION_NAME;
export const APP_RELEASE_LABEL = 'Native Android Notifications & 50K+ Call Log Sync';
export const GUIDE_SEEN_KEY = 'callanalyzer.guideSeen.v1';
export const WHATS_NEW_SEEN_KEY = 'callanalyzer.whatsNewVersion.v1';
export const UPDATE_VERSION_URL = 'https://youthful-limiter-kjk7s.web.app/version.json';
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const APP_PRIVACY_NOTE =
  'Your call logs, contacts, schedules, and notes stay strictly on this device in private browser storage — no call data, phone numbers, or contact names are ever sent to the cloud.';

export const LATEST_RELEASE_NOTES = [
  {
    id: 'brand-launcher',
    title: 'Native Android Notifications Plugin',
    detail:
      'Added native AppNotifications Android plugin with permission prompts, scheduled reminder alarms, interactive Call / +15m / Send Wish / Mute actions, and reboot persistence.',
  },
  {
    id: 'clean-call-logs',
    title: 'High-Volume 50K+ Call Log Sync',
    detail:
      'Upgraded incremental Android CallLog pagination (2,000 entries per page, up to 2M+ capacity), streaming memory mapping, and live scan progress notices.',
  },
  {
    id: 'streak-counting',
    title: 'Calls Filter Dropdown & Corner Search',
    detail:
      'Switch between All calls, Follow-ups, VIP, and Tools from the Calls dropdown, and search phone numbers, contact names, and tags.',
  },
  {
    id: 'mobile-modals',
    title: 'Compact Achievements & Streaks',
    detail:
      'Points History and Contact Streaks start compact with Show more, Show all, and Show less controls.',
  },
] as const;

export const APP_FEATURES = [
  {
    title: 'Dual-SIM Call Sync, Preview Import & Backups',
    detail: 'Auto-sync call history on Android, import CSV/JSON/TXT with preview & deduplication, and export versioned JSON backups.',
  },
  {
    title: 'Interactive Usage Charts & PDF Statements',
    detail: 'Inspect call volume, airtime spend, peak hours, and carrier split with hover tooltips and export formatted PDF or HTML reports.',
  },
  {
    title: 'Voice Bundles & Carrier USSD Tools',
    detail: 'Track active SIM voice minute packages, expiry countdowns, and launch Ethiopian USSD codes in one tap.',
  },
  {
    title: 'Ethiopian Calendar, Wishes & Follow-ups',
    detail: 'Track Ethiopian holidays, saved contact birthdays, quiet contacts, and callback reminders — protected with optional 4-digit PIN lock.',
  },
] as const;
