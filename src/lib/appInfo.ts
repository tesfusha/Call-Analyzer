export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION_NAME = '2.5.3';
export const APP_VERSION_CODE = 3;
export const APP_VERSION = APP_VERSION_NAME;
export const APP_RELEASE_LABEL = 'Full Call Log Sync, Save PNG & Mobile Layout Fixes';
export const GUIDE_SEEN_KEY = 'callanalyzer.guideSeen.v1';
export const WHATS_NEW_SEEN_KEY = 'callanalyzer.whatsNewVersion.v1';
export const UPDATE_VERSION_URL = 'https://youthful-limiter-kjk7s.web.app/version.json';
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const APP_PRIVACY_NOTE =
  'Your call logs, contacts, schedules, and notes stay strictly on this device in private browser storage — no call data, phone numbers, or contact names are ever sent to the cloud.';

export const LATEST_RELEASE_NOTES = [
  {
    id: 'clean-call-logs',
    title: 'Complete Android Call Log Sync',
    detail:
      'Fixed Android 11+ call log query paging so older call history loads completely without stopping early on restricted or empty-number entries.',
  },
  {
    id: 'streak-counting',
    title: 'Save Streak Milestone PNGs to Pictures',
    detail:
      'Added native Android file saving so tapping Save PNG on 3-day and higher streak cards saves directly into Pictures/Call Analyzer - ETH.',
  },
  {
    id: 'mobile-modals',
    title: 'Clean Mobile Button Wrapping & Layout',
    detail:
      'Fixed the Launch App Guide button placement in Settings and wrapped action button groups neatly on compact phone screens.',
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
