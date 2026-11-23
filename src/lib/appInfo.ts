export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION_NAME = '2.5.1';
export const APP_VERSION_CODE = 1;
export const APP_VERSION = APP_VERSION_NAME;
export const APP_RELEASE_LABEL = 'Local-First Storage, Milestones, Update Notices & Privacy';
export const GUIDE_SEEN_KEY = 'callanalyzer.guideSeen.v1';
export const WHATS_NEW_SEEN_KEY = 'callanalyzer.whatsNewVersion.v1';
export const UPDATE_VERSION_URL = 'https://youthful-limiter-kjk7s.web.app/version.json';
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const APP_PRIVACY_NOTE =
  'Your call logs, contacts, schedules, and notes stay strictly on this device in private browser storage — no call data, phone numbers, or contact names are ever sent to the cloud.';

export const LATEST_RELEASE_NOTES = [
  {
    id: 'clean-call-logs',
    title: 'Streamlined Call Log Rows',
    detail:
      'Call logs now show Name/Number · Tag · SIM1(ETC), Call Status · Duration · Time, and a multiple-call count icon, keeping cost and notes in Details.',
  },
  {
    id: 'notification-actions',
    title: 'Instant Notification Action Replies',
    detail:
      'Call, +15 Min, Snooze, Wish, Remind later, View, Clear, and Mute buttons execute directly from the notification shade.',
  },
  {
    id: 'profile-avatars',
    title: 'Profile Editor, Avatars & Quick Contact Share',
    detail:
      'Fixed Edit Profile modal layout, added responsive Account buttons, alohe/avatars collections, password updates, and .vcf contact sharing.',
  },
  {
    id: 'smart-rules',
    title: 'Modern Special Events, Wishes & Quiet Rules',
    detail:
      'One-tap Anniversary & Event presets with Ethiopian/Gregorian Month & Day selectors, Birthday/Holiday-only Wish, and 5-call / 7-day rules.',
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
