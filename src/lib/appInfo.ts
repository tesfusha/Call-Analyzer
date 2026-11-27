export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION_NAME = '1.0.6';
export const APP_VERSION_CODE = 14;
export const APP_VERSION = APP_VERSION_NAME;
export const APP_RELEASE_LABEL = 'Fingerprint App Lock & Broadcast Ticker Styles';
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
    id: 'fingerprint-app-lock',
    title: 'Standalone Fingerprint App Lock',
    detail:
      'Turn on Fingerprint App Lock directly in Settings → Security without requiring a 4-digit PIN first. Automatically locks on launch and when returning after leaving the app.',
  },
  {
    id: 'broadcast-ticker',
    title: 'Scrolling Ticker Bar & Accent Strip Broadcasts',
    detail:
      'Added new high-contrast Scrolling Ticker Bar and Compact Accent Strip display styles with edge-fade marquee animation and live Admin preview.',
  },
  {
    id: 'inbox-pops',
    title: 'Notification-Style Support Inbox Alerts',
    detail:
      'Receive floating heads-up pop alerts and Android notifications whenever Admin replies or a user sends a new Inbox message, with direct one-tap Reply into the thread.',
  },
  {
    id: 'native-google-auth',
    title: 'Permanent Native Android Google Sign-In',
    detail:
      'Google Sign-In runs via the built-in native Android bridge alongside Email & Fingerprint sign-in.',
  },
  {
    id: 'no-zoom-polish',
    title: 'Locked App Viewport & Update Diagnostics',
    detail:
      'Locked pinch-zoom/double-tap zoom across WebView and improved manual update-check status reporting.',
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
