export type HelpFaqCategory =
  | 'getting-started'
  | 'reminders'
  | 'tariffs'
  | 'calendar'
  | 'analytics'
  | 'privacy'
  | 'appearance';

export type HelpFaqEntry = {
  id: string;
  category: HelpFaqCategory;
  title: string;
  shortLabel: string;
  whereToFind: string;
  answer: string;
  steps?: string[];
  keywords: string[];
  followUps: string[];
};

export const HELP_FAQ_CATEGORIES: Array<{
  key: HelpFaqCategory;
  label: string;
}> = [
  { key: 'getting-started', label: 'Sync & Basics' },
  { key: 'reminders', label: 'Reminders & Alerts' },
  { key: 'tariffs', label: 'SIM & ETB Costs' },
  { key: 'calendar', label: 'Ethiopian Calendar' },
  { key: 'analytics', label: 'Stats & Contacts' },
  { key: 'privacy', label: 'Privacy & Backup' },
  { key: 'appearance', label: 'Theme & Header' },
];

export const HELP_FAQ_ENTRIES: HelpFaqEntry[] = [
  {
    id: 'tour-overview',
    category: 'getting-started',
    title: 'Full App Tour — What Can Call Analyzer - ETH Do?',
    shortLabel: 'Full App Tour',
    whereToFind: 'Bottom Navigation (Calls · Analytics · Usage · Calendar · Settings)',
    answer:
      'Call Analyzer - ETH turns your phone call history into clear Ethiopian insights—while keeping 100% of your call logs and contacts private on your device.',
    steps: [
      'Calls: Browse synced calls, filter by SIM/direction, view missed callbacks, VIPs, and dial Ethiopian USSD/emergency codes.',
      'Analytics: Track talk time, call counts, Ethio Telecom / Safaricom ETB spend, peak hours, and top contacts.',
      'Usage: Compare SIM 1 vs SIM 2 airtime, voice bundle usage, and monthly budget progress.',
      'Calendar: Full Ethiopian & Gregorian calendar with holidays, contact birthdays, and 1-tap SMS/Telegram/WhatsApp wishes.',
      'Settings: Customize theme, font size, header date placement, SIM tariffs, 4-digit PIN lock, and full JSON/CSV/PDF backups.',
    ],
    keywords: [
      'tour',
      'overview',
      'how does it work',
      'how it works',
      'what can it do',
      'features',
      'all features',
      'everything',
      'start',
      'guide',
      'help',
      'menu',
      'possible',
    ],
    followUps: ['sync-calls', 'schedule-reminder', 'ethiopian-calendar', 'sim-tariffs'],
  },
  {
    id: 'sync-calls',
    category: 'getting-started',
    title: 'How to Sync Phone Calls on Android',
    shortLabel: 'Sync Android Calls',
    whereToFind: 'Calls tab → Sync button (or pull down to refresh)',
    answer:
      'On the Android APK, Call Analyzer - ETH reads your phone call log locally after you grant Call Log and Contacts permissions. New calls sync automatically when you open the app or tap Sync.',
    steps: [
      'Tap Settings → Reminders / Android Setup to verify Call Log, Contacts, and Notification permissions.',
      'On the Calls tab, pull down or tap Refresh/Sync to pull the latest calls immediately.',
      'Using the Web version? You can import a JSON/CSV backup from Settings → Contacts & Call History Backup.',
    ],
    keywords: [
      'sync',
      'import',
      'call log',
      'android',
      'permission',
      'calls not showing',
      'refresh',
      'missing calls',
      'load calls',
      'apk',
    ],
    followUps: ['missed-alerts', 'backup-export', 'privacy-local'],
  },
  {
    id: 'schedule-reminder',
    category: 'reminders',
    title: 'How to Schedule an Exact-Minute Call Reminder',
    shortLabel: 'Schedule Call Reminder',
    whereToFind: 'Bell icon → Action tab, or tap any Call / Contact → Schedule Callback',
    answer:
      'You can schedule a callback for any exact date and minute. On Android, reminders use exact alarms so they ring right on time even when your phone screen is off.',
    steps: [
      'Open the Bell icon (top right) or tap any call/contact and press Schedule.',
      'Pick the exact date, hour, and minute, add an optional note, and tap Save.',
      'If notifications are delayed on Xiaomi/Tecno/Samsung phones, allow "Alarms & reminders" and disable battery optimization for Call Analyzer - ETH.',
    ],
    keywords: [
      'schedule',
      'reminder',
      'alarm',
      'callback',
      'call back',
      'exact time',
      'not ringing',
      'notification',
      'notify',
      'ሪማይንደር',
      'ማስታወሻ',
    ],
    followUps: ['missed-alerts', 'quiet-hours', 'troubleshoot-notifications'],
  },
  {
    id: 'missed-alerts',
    category: 'reminders',
    title: 'Missed Call Follow-Up Alerts',
    shortLabel: 'Missed Call Alerts',
    whereToFind: 'Bell icon (top right) · Configure in Settings → Reminders & Alerts',
    answer:
      'When you miss a call and have not called the person back, the app highlights it in your Action queue and sends a reminder after your chosen delay (5, 7, or 10 minutes).',
    steps: [
      'Tap the Bell icon to see unreturned missed calls and tap Call Back directly.',
      'Once you return the call or tap Dismiss, the alert clears automatically.',
      'In Settings → Reminders, you can limit alerts to saved contacts only or change the delay timer.',
    ],
    keywords: [
      'missed',
      'unreturned',
      'bell',
      'badge',
      'delay',
      '5 min',
      '7 min',
      '10 min',
      'mute alert',
      'follow up',
    ],
    followUps: ['schedule-reminder', 'quiet-hours', 'long-gap-quiet'],
  },
  {
    id: 'quiet-hours',
    category: 'reminders',
    title: 'Quiet Hours & Snoozing Alerts',
    shortLabel: 'Quiet Hours & Snooze',
    whereToFind: 'Settings → Reminders, Alerts & Reconnect Goal',
    answer:
      'Quiet Hours pause non-urgent missed-call and daily wish notifications overnight while still letting your manually scheduled exact-time call reminders ring.',
    steps: [
      'Open Settings → Reminders, Alerts & Reconnect Goal.',
      'Enable Quiet Hours and pick your start and end hours (e.g., 10 PM to 7 AM).',
      'You can also snooze all badge alerts for today from the Bell modal.',
    ],
    keywords: ['quiet hours', 'sleep', 'night', 'snooze', 'mute', 'do not disturb', 'dnd'],
    followUps: ['missed-alerts', 'schedule-reminder'],
  },
  {
    id: 'sim-tariffs',
    category: 'tariffs',
    title: 'SIM 1 / SIM 2 Labels, Ethio Telecom & Safaricom Tariffs',
    shortLabel: 'SIM & ETB Tariffs',
    whereToFind: 'Settings → SIM Labels, Tariffs & Monthly Budget',
    answer:
      'Call Analyzer - ETH estimates your call spending in Ethiopian Birr (ETB) for both Ethio Telecom (ETC) and Safaricom Ethiopia (SFC) with per-second or per-minute billing.',
    steps: [
      'Go to Settings → SIM Labels, Tariffs & Monthly Budget.',
      'Rename SIM 1 and SIM 2 (for example: ETC Personal, Safaricom Work).',
      'Pick a carrier preset or enter your custom ETB/min rate and monthly budget.',
      'Track voice package minutes under the Usage tab.',
    ],
    keywords: [
      'sim',
      'sim1',
      'sim2',
      'tariff',
      'cost',
      'etb',
      'birr',
      'ethio telecom',
      'safaricom',
      'etc',
      'sfc',
      'budget',
      'bundle',
      'package',
      'voice',
      'ሲም',
      'ብር',
    ],
    followUps: ['analytics-usage', 'ussd-codes'],
  },
  {
    id: 'ussd-codes',
    category: 'tariffs',
    title: 'Ethiopian USSD Codes & Emergency Hotlines',
    shortLabel: 'USSD & Hotlines',
    whereToFind: 'Calls tab → Tools category',
    answer:
      'Quickly dial Ethio Telecom & Safaricom balance/package USSD codes (*804#, *999#, *704#, etc.) and Ethiopian emergency hotlines (991, 907, 939) with one tap.',
    steps: [
      'Open the Calls tab and tap the Tools section.',
      'Choose Ethio Telecom, Safaricom, or Emergency Hotlines.',
      'Tap any code to open your phone dialer immediately.',
    ],
    keywords: ['ussd', 'balance', 'recharge', 'emergency', 'hotline', '991', '804', '999', '704', 'code'],
    followUps: ['sim-tariffs', 'tour-overview'],
  },
  {
    id: 'ethiopian-calendar',
    category: 'calendar',
    title: 'Ethiopian Calendar, Holidays & Dual EC/GC Dates',
    shortLabel: 'Ethiopian Calendar',
    whereToFind: 'Calendar tab · Customize language in Settings → Ethiopian Calendar & Language',
    answer:
      'View a full 13-month Ethiopian calendar (including Pagume) alongside Gregorian dates, Ethiopian national & religious holidays, and your contacts’ birthdays.',
    steps: [
      'Open the Calendar tab to browse any Ethiopian month or jump to Today.',
      'In Settings → Ethiopian Calendar & Language, switch between English and አማርኛ, toggle Ge\'ez numerals, or choose EC-only vs EC + GC dates.',
      'Tap any holiday or birthday to send a ready-made wish.',
    ],
    keywords: [
      'calendar',
      'ethiopian',
      'ec',
      'gc',
      'gregorian',
      'amharic',
      'geez',
      'pagume',
      'holiday',
      'enkutatash',
      'meskel',
      'genna',
      'timket',
      'fasika',
      'ቀን',
      'ካላንደር',
      'በዓል',
    ],
    followUps: ['birthdays-wishes', 'header-date-style'],
  },
  {
    id: 'birthdays-wishes',
    category: 'calendar',
    title: 'Contact Birthdays & 1-Tap Holiday Wishes',
    shortLabel: 'Birthdays & Wishes',
    whereToFind: 'Tap any Contact → Edit Birthday · Bell icon → Wishes tab',
    answer:
      'Save birthdays or anniversaries on any contact (in Ethiopian or Gregorian date) and get daily wish reminders with pre-written Amharic and English templates.',
    steps: [
      'Tap any contact from Calls or Analytics and add their birthday.',
      'Open Bell icon → Wishes or Calendar tab on the day of an event.',
      'Tap Send Wish to open SMS, Telegram, or WhatsApp with your editable greeting.',
    ],
    keywords: ['birthday', 'wish', 'wishes', 'greeting', 'telegram', 'whatsapp', 'sms', 'template', 'anniversary', 'ልደት'],
    followUps: ['ethiopian-calendar', 'contacts-vips'],
  },
  {
    id: 'analytics-usage',
    category: 'analytics',
    title: 'Analytics, Peak Hours & Usage Breakdown',
    shortLabel: 'Analytics & Usage',
    whereToFind: 'Analytics tab & Usage tab in bottom bar',
    answer:
      'See who you talk to most, your busiest calling hours, incoming vs outgoing duration, daily/weekly trends, and SIM 1 vs SIM 2 airtime spend.',
    steps: [
      'Open Analytics to view top contacts, talk-time charts, and peak hours.',
      'Filter by Today, 7 Days, 30 Days, or All Time.',
      'Open Usage to inspect SIM 1 / SIM 2 carrier splits, voice bundles, and budget alerts.',
    ],
    keywords: ['analytics', 'stats', 'chart', 'graph', 'top contact', 'peak hour', 'usage', 'talk time', 'duration', 'report'],
    followUps: ['sim-tariffs', 'long-gap-quiet', 'streaks-badges'],
  },
  {
    id: 'contacts-vips',
    category: 'analytics',
    title: 'VIP Contacts, Call Tags, Notes & Merging Duplicates',
    shortLabel: 'VIPs, Tags & Notes',
    whereToFind: 'Tap any Call or Contact name · Calls tab → VIPs',
    answer:
      'Organize important people with VIP stars, custom relationship tags (Family, Client, Work, Friend), private call notes, and duplicate-contact merging.',
    steps: [
      'Tap any call row to add a note or tag (you can also create your own custom tags).',
      'Tap the Star icon on a contact to pin them in your VIPs list.',
      'Have two numbers for the same person? Open the contact detail to manage or merge profiles.',
    ],
    keywords: ['vip', 'favorite', 'star', 'tag', 'note', 'contact', 'merge', 'duplicate', 'rename', 'profile'],
    followUps: ['long-gap-quiet', 'birthdays-wishes'],
  },
  {
    id: 'long-gap-quiet',
    category: 'analytics',
    title: 'Quiet Contacts & "Back in Touch" (30+ Days)',
    shortLabel: 'Quiet Contacts',
    whereToFind: 'Bell icon → Quiet tab · Settings → Reminders & Reconnect Goal',
    answer:
      'Stay close to people who matter: the Quiet tab surfaces friends or clients you have not spoken to recently, and "Back in Touch" highlights someone who calls after 30+ days of silence.',
    steps: [
      'Open Bell icon → Quiet to see contacts you haven’t called lately.',
      'Set your Weekly Reconnect Goal (e.g., 3 people/week) in Settings → Reminders.',
      'Tap Call or Snooze right from each quiet contact card.',
    ],
    keywords: ['quiet', 'reconnect', 'long gap', '30 days', 'back in touch', 'silence', 'weekly goal'],
    followUps: ['streaks-badges', 'contacts-vips'],
  },
  {
    id: 'streaks-badges',
    category: 'analytics',
    title: 'Daily Streaks, Score, Badges & Contact Milestones',
    shortLabel: 'Streaks & Badges',
    whereToFind: 'Settings → Score & Badges (tap to view Achievements)',
    answer:
      'Earn points and unlock badges for checking in daily, returning missed calls quickly, adding notes/tags, and hitting call milestones with your closest contacts.',
    steps: [
      'Open Settings and tap your Score / Streak summary card at the top.',
      'Track your current streak, unlocked badges, and point history.',
      'Share celebration cards when you hit special milestones with a contact.',
    ],
    keywords: ['streak', 'score', 'points', 'badge', 'achievement', 'milestone', 'trophy', 'gamification'],
    followUps: ['analytics-usage', 'tour-overview'],
  },
  {
    id: 'header-date-style',
    category: 'appearance',
    title: 'Customize Top Header & Date Placement',
    shortLabel: 'Header & Date Style',
    whereToFind: 'Settings → Appearance, Theme & Font Size → Header & Date Placement',
    answer:
      'Choose how your top bar looks: keep only your logo and app name in the top header with a clean Calls Strip or Header Sub-Bar, put the date in the header, or hide it completely.',
    steps: [
      'Open Settings → Appearance, Theme & Font Size.',
      'Scroll to "Header & Date Placement".',
      'Pick Calls Strip (default), Header Sub-Bar, In Top Header, or Hidden.',
      'Tapping the date strip anywhere jumps straight to the Ethiopian Calendar tab.',
    ],
    keywords: ['header', 'top bar', 'date placement', 'banner', 'strip', 'sub-bar', 'hide date', 'logo', 'appearance'],
    followUps: ['theme-font', 'ethiopian-calendar'],
  },
  {
    id: 'theme-font',
    category: 'appearance',
    title: 'Dark Mode, Bright Mode, Font Size & Vibration',
    shortLabel: 'Theme & Font Size',
    whereToFind: 'Settings → Appearance, Theme & Font Size',
    answer:
      'Switch between Auto (follows your phone), Bright, and Dark themes, choose from 3 comfortable text sizes (Default, Larger, Biggest), and toggle haptic vibration feedback.',
    steps: [
      'Open Settings → Appearance, Theme & Font Size.',
      'Select Auto, Bright, or Dark under Theme Style.',
      'Choose Default, Larger, or Biggest under Font Size and preview text live.',
    ],
    keywords: ['theme', 'dark', 'light', 'bright', 'mode', 'font', 'text size', 'bigger', 'smaller', 'vibration', 'haptic'],
    followUps: ['header-date-style', 'pin-lock'],
  },
  {
    id: 'privacy-local',
    category: 'privacy',
    title: 'Privacy — Where Is My Call History Stored?',
    shortLabel: 'Privacy & Storage',
    whereToFind: '100% Local on your phone (IndexedDB)',
    answer:
      'Your call logs, phone numbers, contact names, notes, and scheduled reminders NEVER leave your device. Only your account email, theme, and tariff preferences sync to your account.',
    steps: [
      'All call history and contact profiles stay strictly on your phone.',
      'Before switching phones or uninstalling, export a JSON backup from Settings → Backup.',
      'You can wipe local call data anytime from Settings → Contacts & Call History Backup.',
    ],
    keywords: ['privacy', 'cloud', 'server', 'safe', 'secure', 'local', 'stored', 'data', 'private', 'delete data'],
    followUps: ['backup-export', 'pin-lock'],
  },
  {
    id: 'pin-lock',
    category: 'privacy',
    title: '4-Digit Screen Lock PIN',
    shortLabel: 'Screen Lock PIN',
    whereToFind: 'Settings → Screen Lock PIN',
    answer:
      'Add a 4-digit passcode lock to protect your call analytics from casual glances when someone borrows your phone.',
    steps: [
      'Go to Settings → Screen Lock PIN and set a 4-digit PIN.',
      'Once enabled, tap the Lock icon in the top bar anytime to lock immediately.',
      'Forgot your PIN? You can reset it from the lock screen (requires re-verifying your account).',
    ],
    keywords: ['pin', 'lock', 'password', 'passcode', 'security', 'protect', 'unlock', '4-digit'],
    followUps: ['privacy-local', 'account-updates'],
  },
  {
    id: 'backup-export',
    category: 'privacy',
    title: 'Backup, Restore & Export (JSON, CSV, PDF, HTML, vCard)',
    shortLabel: 'Backup & Export',
    whereToFind: 'Settings → Contacts & Call History Backup',
    answer:
      'Export your complete workspace as a versioned JSON backup (calls, contacts, birthdays, tags, settings), or generate clean CSV spreadsheets, printable PDF/HTML reports, and contact vCards (.vcf).',
    steps: [
      'Open Settings → Contacts & Call History Backup.',
      'Tap Export JSON for a full restorable backup, or CSV / PDF / HTML for reports.',
      'To restore on a new phone, tap Import Backup — duplicates are skipped automatically.',
    ],
    keywords: ['backup', 'export', 'restore', 'import', 'json', 'csv', 'pdf', 'html', 'vcard', 'vcf', 'new phone', 'transfer'],
    followUps: ['privacy-local', 'sync-calls'],
  },
  {
    id: 'account-updates',
    category: 'getting-started',
    title: 'Account Sign-In, Updates & Contacting Admin',
    shortLabel: 'Account & Updates',
    whereToFind: 'Settings → About App, Updates & Contact · Support Chat tab',
    answer:
      'Sign in with Google or Email/Password (with email verification) to keep your settings synced. You can check for new APK versions or chat directly with the admin right inside this Help window.',
    steps: [
      'Open Settings → About App, Updates & Contact and tap "Check for Updates".',
      'Need direct help or want to report an issue? Switch to the "Chat with Admin" tab at the top of this window.',
    ],
    keywords: ['account', 'login', 'sign in', 'google', 'email', 'verify', 'update', 'version', 'admin', 'contact', 'support', 'bug', 'feedback'],
    followUps: ['tour-overview', 'troubleshoot-notifications'],
  },
  {
    id: 'troubleshoot-notifications',
    category: 'reminders',
    title: 'Troubleshooting: Reminders or Sync Not Working',
    shortLabel: 'Troubleshooting',
    whereToFind: 'Settings → Reminders → Test Notification & Android Permissions',
    answer:
      'Most Android sync or notification issues come from missing permissions or aggressive battery savers. You can test and fix both in under a minute.',
    steps: [
      'Open Settings → Reminders and tap "Send Test Notification" to confirm alerts work.',
      'Open Android Settings → Apps → Call Analyzer - ETH → Battery → set to "Unrestricted".',
      'Ensure "Notifications", "Call logs", "Contacts", and "Alarms & reminders" are allowed.',
      'Still stuck? Switch to the "Chat with Admin" tab and tell us your phone model.',
    ],
    keywords: [
      'fix',
      'problem',
      'issue',
      'broken',
      'not working',
      'error',
      'battery',
      'xiaomi',
      'tecno',
      'infinix',
      'samsung',
      'troubleshoot',
      'delay',
    ],
    followUps: ['schedule-reminder', 'sync-calls', 'account-updates'],
  },
];

export function getFaqById(id: string): HelpFaqEntry | undefined {
  return HELP_FAQ_ENTRIES.find((item) => item.id === id);
}

export function getFaqsByCategory(category: HelpFaqCategory): HelpFaqEntry[] {
  return HELP_FAQ_ENTRIES.filter((item) => item.category === category);
}

function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type HelpBotMatchResult = {
  matched: HelpFaqEntry | null;
  related: HelpFaqEntry[];
  isGreeting: boolean;
};

const GREETING_WORDS = new Set([
  'hi',
  'hello',
  'hey',
  'selam',
  'ሰላም',
  'good morning',
  'good afternoon',
  'good evening',
  'thanks',
  'thank you',
  'ameseginalehu',
]);

export function matchHelpFaq(rawQuery: string): HelpBotMatchResult {
  const norm = normalizeQuery(rawQuery);
  if (!norm) {
    return {
      matched: getFaqById('tour-overview') ?? HELP_FAQ_ENTRIES[0],
      related: HELP_FAQ_ENTRIES.slice(1, 5),
      isGreeting: true,
    };
  }

  if (GREETING_WORDS.has(norm)) {
    return {
      matched: null,
      related: [
        getFaqById('tour-overview')!,
        getFaqById('sync-calls')!,
        getFaqById('schedule-reminder')!,
        getFaqById('ethiopian-calendar')!,
      ].filter(Boolean),
      isGreeting: true,
    };
  }

  const tokens = norm.split(' ').filter((t) => t.length >= 2);
  const scored = HELP_FAQ_ENTRIES.map((entry) => {
    let score = 0;
    const titleNorm = normalizeQuery(entry.title);
    const answerNorm = normalizeQuery(entry.answer);

    // Exact phrase matches on keywords get high priority
    for (const kw of entry.keywords) {
      const kwNorm = normalizeQuery(kw);
      if (!kwNorm) continue;
      if (norm === kwNorm) {
        score += 20;
      } else if (norm.includes(kwNorm)) {
        score += kwNorm.includes(' ') ? 12 : 8;
      } else if (tokens.some((tok) => kwNorm.includes(tok) && tok.length >= 3)) {
        score += 4;
      }
    }

    for (const tok of tokens) {
      if (titleNorm.includes(tok)) score += 5;
      if (answerNorm.includes(tok)) score += 2;
    }

    return { entry, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      matched: null,
      related: [
        getFaqById('tour-overview')!,
        getFaqById('sync-calls')!,
        getFaqById('schedule-reminder')!,
        getFaqById('sim-tariffs')!,
      ].filter(Boolean),
      isGreeting: false,
    };
  }

  const best = scored[0].entry;
  const related = scored
    .slice(1, 4)
    .map((s) => s.entry)
    .filter((e) => e.id !== best.id);

  return {
    matched: best,
    related,
    isGreeting: false,
  };
}
