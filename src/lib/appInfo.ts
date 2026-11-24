export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION_NAME = '2.6.0';
export const APP_VERSION_CODE = 7;
export const APP_VERSION = APP_VERSION_NAME;
export const APP_RELEASE_LABEL = 'Wish Composer, Smarter Reconnects & Collapsible Settings';
export const GUIDE_SEEN_KEY = 'callanalyzer.guideSeen.v1';
export const WHATS_NEW_SEEN_KEY = 'callanalyzer.whatsNewVersion.v1';
export const UPDATE_VERSION_URL = 'https://youthful-limiter-kjk7s.web.app/version.json';
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const APP_PRIVACY_NOTE =
  'Your call logs, contacts, schedules, wish templates, and notes stay strictly on this device in private local storage — no call data, phone numbers, usernames, or contact names are ever sent to the cloud.';

export const LATEST_RELEASE_NOTES = [
  {
    id: 'smart-rules',
    title: 'Wish Composer & Saved Templates',
    detail:
      'Write and customize birthday, holiday, and follow-up wishes with live GSM-7/Unicode SMS counting, save templates per occasion, and send via SMS, WhatsApp, Telegram, Instagram, or Copy.',
  },
  {
    id: 'notification-actions',
    title: 'Smarter Quiet Contacts & Weekly Reconnect Goal',
    detail:
      'Quiet suggestions now learn real call rhythms, separate Dormant contacts, support swipe-to-call and swipe-to-snooze, and track your weekly reconnect goal without cluttering the main bell badge.',
  },
  {
    id: 'mobile-modals',
    title: 'Collapsible Settings & 5/7/10m Missed-Call Alerts',
    detail:
      'Settings sections now collapse cleanly with live summaries and search, alongside 5/7/10-minute missed-call delays, "Only remind for saved contacts", and a 10-second test alert.',
  },
  {
    id: 'brand-launcher',
    title: 'Hardened Screen Lock & Full Call Types',
    detail:
      '4-digit screen lock now uses salted PBKDF2 hashing with lockout backoff, while Calls and Usage clearly distinguish Rejected, Blocked, and Voicemail entries.',
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
