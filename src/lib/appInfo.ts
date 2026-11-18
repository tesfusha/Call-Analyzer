export const APP_NAME = 'Call Analyzer - ETH';
export const APP_VERSION = '2.4.0';
export const APP_RELEASE_LABEL = 'Dual-SIM Analytics & Ethiopian Calendar';
export const GUIDE_SEEN_KEY = 'callanalyzer.guideSeen.v1';

export const APP_PRIVACY_NOTE =
  'Your call logs, contacts, schedules, and notes stay strictly private to your account — no data is seen by or shared with 3rd parties.';

export const APP_FEATURES = [
  {
    title: 'Dual-SIM Call Tracking & Live Timer',
    detail: 'Log, search, filter, and time calls across SIM 1 (Ethio Telecom) and SIM 2 (Safaricom) with automatic ETB cost estimates.',
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
