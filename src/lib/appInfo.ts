export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION_NAME = '2.5.2';
export const APP_VERSION_CODE = 2;
export const APP_VERSION = APP_VERSION_NAME;
export const APP_RELEASE_LABEL = 'Brand Logo, Mobile Modal Safe-Area & Contact Streak Fixes';
export const GUIDE_SEEN_KEY = 'callanalyzer.guideSeen.v1';
export const WHATS_NEW_SEEN_KEY = 'callanalyzer.whatsNewVersion.v1';
export const UPDATE_VERSION_URL = 'https://youthful-limiter-kjk7s.web.app/version.json';
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const APP_PRIVACY_NOTE =
  'Your call logs, contacts, schedules, and notes stay strictly on this device in private browser storage — no call data, phone numbers, or contact names are ever sent to the cloud.';

export const LATEST_RELEASE_NOTES = [
  {
    id: 'streak-counting',
    title: 'Accurate Daily & Contact Streaks',
    detail:
      'Contact streaks now count consecutive days for all incoming and outgoing calls (including short or 0s answered/placed calls), while keeping missed calls excluded.',
  },
  {
    id: 'mobile-modals',
    title: 'Mobile Scroll, Score & Safe-Area Fixes',
    detail:
      'Portaled Score, Contact Streaks, and detail sheets above scrolled content and added bottom safe-area spacing to stay clear of Android navigation buttons.',
  },
  {
    id: 'brand-launcher',
    title: 'Official App Logo & Dark Header Contrast',
    detail:
      'Replaced the Android launcher icon and splash screen with the Call Analyzer - ETH emblem and added a subtle border for dark mode visibility.',
  },
  {
    id: 'notification-actions',
    title: 'Instant Notification Replies & Privacy',
    detail:
      'One-tap callback and reminder actions, local-first IndexedDB storage, Privacy Mode masking, and shareable contact milestone cards.',
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
