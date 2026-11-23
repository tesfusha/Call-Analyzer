export const EAT_UTC_OFFSET_HOURS = 3;
export const EAT_UTC_OFFSET_MS = EAT_UTC_OFFSET_HOURS * 60 * 60 * 1000;

export const POINTS_CONFIG = {
  DAILY_FIRST_OPEN: 5,
  QUICK_MISSED_CALLBACK: 10,
  CALL_TAG_OR_NOTE: 3,
  STREAK_MILESTONE_BONUS: 20,
} as const;

export const STREAK_BONUS_DAYS = [7, 30, 100] as const;

export const QUICK_CALLBACK_BADGE_TARGET = 5;
export const ORGANIZED_CALLS_BADGE_TARGET = 5;

export type BadgeDefinition = {
  id:
    | 'first_open'
    | 'streak_7'
    | 'streak_30'
    | 'streak_100'
    | 'quick_returner'
    | 'organized_caller';
  title: string;
  description: string;
  requirementLabel: string;
  icon: 'sparkles' | 'flame' | 'trophy' | 'crown' | 'phone' | 'tag';
};

export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    id: 'first_open',
    title: 'First Open',
    description: 'Opened Call Analyzer - ETH and started tracking locally.',
    requirementLabel: '1 active day (EAT)',
    icon: 'sparkles',
  },
  {
    id: 'streak_7',
    title: '7-Day Streak',
    description: 'Used the app 7 consecutive calendar days in East Africa Time.',
    requirementLabel: '7-day daily streak',
    icon: 'flame',
  },
  {
    id: 'streak_30',
    title: '30-Day Streak',
    description: 'Maintained a 30-day usage streak and earned +20 bonus points.',
    requirementLabel: '30-day daily streak',
    icon: 'trophy',
  },
  {
    id: 'streak_100',
    title: '100-Day Streak',
    description: 'Reached 100 consecutive days of daily usage in EAT (UTC+3).',
    requirementLabel: '100-day daily streak',
    icon: 'crown',
  },
  {
    id: 'quick_returner',
    title: 'Quick Returner',
    description: 'Returned 5 missed calls within your chosen reminder window.',
    requirementLabel: `${QUICK_CALLBACK_BADGE_TARGET} quick callbacks`,
    icon: 'phone',
  },
  {
    id: 'organized_caller',
    title: 'Organized Caller',
    description: 'Added notes or tags to 5 calls for clean follow-up tracking.',
    requirementLabel: `${ORGANIZED_CALLS_BADGE_TARGET} tagged/noted calls`,
    icon: 'tag',
  },
] as const;

/**
 * Single constant governing whether a contact-streak day (EAT UTC+3) requires:
 * - 'any_connected': at least one incoming or outgoing call on that day
 * - 'both_directions': both an incoming and an outgoing call on that day
 */
export const CONTACT_STREAK_DAY_RULE: 'any_connected' | 'both_directions' = 'any_connected';

export const CONTACT_MILESTONE_DAYS = [3, 7, 14, 30, 60, 100, 200, 365] as const;

export const CONTACT_POINTS_CONFIG = {
  CONNECTED_DAY: 2,
  QUICK_CALLBACK: 10,
  CALL_TAG_OR_NOTE: 3,
  MILESTONE_BONUS: {
    3: 15,
    7: 30,
    14: 50,
    30: 100,
    60: 175,
    100: 300,
    200: 500,
    365: 1000,
  } as Record<number, number>,
} as const;

export type ContactBadgeDefinition = {
  id: string;
  days: number;
  title: string;
  description: string;
  points: number;
};

export const CONTACT_BADGE_DEFINITIONS: readonly ContactBadgeDefinition[] = [
  {
    id: 'contact_3d',
    days: 3,
    title: '3 Days Connected',
    description: 'You made 3 consecutive days of connected calls.',
    points: CONTACT_POINTS_CONFIG.MILESTONE_BONUS[3],
  },
  {
    id: 'contact_7d',
    days: 7,
    title: '7-Day Bond',
    description: 'Connected 7 consecutive EAT days with this contact.',
    points: CONTACT_POINTS_CONFIG.MILESTONE_BONUS[7],
  },
  {
    id: 'contact_14d',
    days: 14,
    title: '14-Day Rhythm',
    description: 'Two full weeks of consecutive daily calls.',
    points: CONTACT_POINTS_CONFIG.MILESTONE_BONUS[14],
  },
  {
    id: 'contact_30d',
    days: 30,
    title: '30-Day Circle',
    description: 'Connected 30 straight calendar days.',
    points: CONTACT_POINTS_CONFIG.MILESTONE_BONUS[30],
  },
  {
    id: 'contact_60d',
    days: 60,
    title: '60-Day Trust',
    description: 'Maintained a 60-day consecutive call streak.',
    points: CONTACT_POINTS_CONFIG.MILESTONE_BONUS[60],
  },
  {
    id: 'contact_100d',
    days: 100,
    title: '100-Day Milestone',
    description: 'Reached 100 consecutive days in touch.',
    points: CONTACT_POINTS_CONFIG.MILESTONE_BONUS[100],
  },
  {
    id: 'contact_200d',
    days: 200,
    title: '200-Day Pillar',
    description: '200 consecutive days of staying connected.',
    points: CONTACT_POINTS_CONFIG.MILESTONE_BONUS[200],
  },
  {
    id: 'contact_365d',
    days: 365,
    title: '365-Day Year',
    description: 'A full year of consecutive daily calls.',
    points: CONTACT_POINTS_CONFIG.MILESTONE_BONUS[365],
  },
] as const;

