export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION_NAME = '1.0.2';
export const APP_VERSION_CODE = 10;
export const APP_VERSION = APP_VERSION_NAME;
export const APP_RELEASE_LABEL = 'Back in Touch Alerts, UI Polish & Promo Export';
export const APP_CONTACT_EMAIL = 'tesfutilahun33@gmail.com';
export const APP_TELEGRAM_HANDLE = 't.me/callanalyzer_eth';
export const APP_TELEGRAM_URL = 'https://t.me/callanalyzer_eth';
export const GUIDE_SEEN_KEY = 'callanalyzer.guideSeen.v1';
export const WHATS_NEW_SEEN_KEY = 'callanalyzer.whatsNewVersion.v1';
export const UPDATE_VERSION_URL = 'https://youthful-limiter-kjk7s.web.app/version.json';
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const APP_PRIVACY_NOTE =
  'Your call logs, contacts, schedules, wish templates, and notes stay strictly on this device in private local storage — no call data, phone numbers, usernames, or contact names are ever sent to the cloud.';

export const LATEST_RELEASE_NOTES = [
  {
    id: 'notification-actions',
    title: 'Back in Touch Return-Call Alerts (30+ Days)',
    detail:
      'Get notified when someone calls after 30+ days (configurable 14d–90d), review them in Wishes & Alerts, and see a compact gap-days reconnect badge inside their profile.',
  },
  {
    id: 'mobile-modals',
    title: 'Header Calendar, Charts & Compact Wish Composer',
    detail:
      'Stacked Ethiopian & Gregorian header date, clearer Talk-Time chart axes, cleaner Quiet Contacts cards, and single-row Wish Composer send buttons.',
  },
  {
    id: 'clean-call-logs',
    title: 'Dual-SIM Sync, Costing & Fast Promo Video Export',
    detail:
      'Sync Ethio Telecom and Safaricom call logs on Android, export clean PDF statements, and render promo videos faster on Web & Android.',
  },
  {
    id: 'brand-launcher',
    title: 'On-Device Privacy & 4-Digit Screen Lock',
    detail:
      'All call history and contact details stay strictly on your phone, protected with optional PBKDF2-hashed 4-digit PIN lock and encrypted local storage.',
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
