export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION_NAME = '1.0.7';
export const APP_VERSION_CODE = 15;
export const APP_VERSION = APP_VERSION_NAME;
export const APP_RELEASE_LABEL = 'Auto-Lock, 5 Fonts & Multi-Number Sync';
export const APP_CONTACT_EMAIL = 'tesfutilahun33@gmail.com';
export const APP_TELEGRAM_HANDLE = 't.me/callanalyzer_eth';
export const APP_TELEGRAM_URL = 'https://t.me/callanalyzer_eth';
export const GUIDE_SEEN_KEY = 'callanalyzer.guideSeen.v1';
export const WHATS_NEW_SEEN_KEY = 'callanalyzer.whatsNewVersion.v1';
export const UPDATE_VERSION_URL = 'https://youthful-limiter-kjk7s.web.app/version.json';
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const APP_PRIVACY_NOTE =
  'Call logs, contacts, schedules, wishes, and notes stay strictly local on your device.';

export const LATEST_RELEASE_NOTES = [
  {
    id: 'biometric-autolock',
    title: 'Biometric & PIN Auto-Lock',
    detail: 'Locks after 5 min idle with Fingerprint, PIN, and recovery.',
  },
  {
    id: 'modern-fonts',
    title: '5 Modern Fonts & Streak Cards',
    detail: 'Switch between 5 fonts and compact Day & Contact Streak headers.',
  },
  {
    id: 'interactive-faq-bot',
    title: 'Interactive FAQ & Helper Bot',
    detail: 'Live topic search, quick-start cards, and 1-tap Settings jumps.',
  },
  {
    id: 'broadcast-samples-edit',
    title: 'Auto Contact Sync & Clean Avatars',
    detail: 'Multi-number contact sync, user icons for phone-only rows, plus broadcast edit.',
  },
  {
    id: 'startup-sync-reliability',
    title: 'Animated Session Check & Sync Fix',
    detail: 'Smoother launch loader and hardened cloud preference permissions.',
  },
] as const;

export const APP_FEATURES = [
  {
    title: 'Dual-SIM Auto Sync & Backups',
    detail: 'Auto-sync Android calls & contacts, import CSV/JSON/vCard, and backup.',
  },
  {
    title: 'Usage Charts & PDF Reports',
    detail: 'Inspect call volume, ETB spend, and carrier splits with PDF export.',
  },
  {
    title: 'Voice Bundles & Carrier USSD',
    detail: 'Track SIM minute packages, expiry, and dial USSD shortcodes fast.',
  },
  {
    title: 'Ethiopian Calendar & Privacy',
    detail: 'Track holidays, birthdays, and follow-ups with 4-digit PIN lock.',
  },
] as const;
