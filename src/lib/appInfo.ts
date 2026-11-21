export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION = '2.5.1';
export const APP_RELEASE_LABEL = 'Notification Actions, Profile Modal & Modern Events';
export const GUIDE_SEEN_KEY = 'callanalyzer.guideSeen.v1';
export const WHATS_NEW_SEEN_KEY = 'callanalyzer.whatsNewVersion.v1';

export const APP_PRIVACY_NOTE =
  'Your call logs, contacts, schedules, and notes stay strictly private to your account — no data is seen by or shared with 3rd parties.';

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
    title: 'Dual-SIM Call Sync & Smart Search',
    detail: 'Sync, search, and filter calls across SIM 1 (ETC) and SIM 2 (SFC) with automatic ETB cost estimates.',
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
