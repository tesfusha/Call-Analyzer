export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION_NAME = '1.0.5';
export const APP_VERSION_CODE = 13;
export const APP_VERSION = APP_VERSION_NAME;
export const APP_RELEASE_LABEL = 'Fingerprint Login, Inbox Popups & Live Broadcasts';
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
    id: 'fingerprint-auth',
    title: 'Fingerprint Screen Unlock & Quick Sign-In',
    detail:
      'Unlock the app screen with your fingerprint (with 4-digit PIN backup) and enable one-touch Sign in with Fingerprint sealed by Android Keystore encryption in Settings → Security.',
  },
  {
    id: 'inbox-pops',
    title: 'Notification-Style Support Inbox Alerts',
    detail:
      'Receive floating heads-up pop alerts and Android notifications whenever Admin replies or a user sends a new Inbox message, with direct one-tap Reply into the thread.',
  },
  {
    id: 'live-broadcasts',
    title: 'Live Broadcasts for Verified Accounts',
    detail:
      'Announcements, update notices, and tips now sync live in real time and refresh on app resume with heads-up pop alerts for verified signed-in users.',
  },
  {
    id: 'native-google-auth',
    title: 'Permanent Native Android Google Sign-In',
    detail:
      'Google Sign-In now runs via a built-in native Android bridge so app updates and syncs stay reliable alongside Email & Fingerprint login.',
  },
  {
    id: 'no-zoom-polish',
    title: 'Locked App Viewport & Cleaner Navigation',
    detail:
      'Disabled accidental pinch-zoom and double-tap zoom across WebView and touch layouts so scrolling, charts, and modals feel crisp and steady.',
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
