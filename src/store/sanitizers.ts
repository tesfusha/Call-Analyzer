import { decodeIfQuotedPrintableText } from '@/src/lib/contacts';
import { formatCarrierShort, type TariffConfig } from '@/src/lib/ethiopia';
import { clampStr } from '@/src/lib/firebase';
import { toEatDateString } from '@/src/lib/gamification';
import { getEatWeekKey } from '@/src/lib/reminders';
import { sanitizeSocialUsername } from '@/src/lib/security';
import {
  DEFAULT_ALERT_TYPE_PREFS,
  DEFAULT_CALLS_TAB_STATE,
  DEFAULT_RECONNECT_PROGRESS,
  DEFAULT_SIM_LABELS,
  DEFAULT_STREAKS,
  DEFAULT_VOICE_BUNDLES,
} from '@/src/store/defaults';
import type {
  AlertTypePrefs,
  BadgeRecord,
  CalendarPrefs,
  CallDirection,
  CallRecord,
  CallsTabState,
  ContactMilestoneRecord,
  ContactProfile,
  PointsHistoryEntry,
  PointsReason,
  ReconnectProgressRecord,
  ReminderPrefs,
  ScheduledCall,
  SentWishRecord,
  SettingsSectionId,
  SimLabels,
  StreakRecord,
  VoiceBundleSlot,
  VoiceBundles,
  WishChannel,
  WishTemplateMap,
} from '@/src/types/call';

const VALID_SETTINGS_SECTIONS = new Set<SettingsSectionId>([
  'score_badges',
  'appearance',
  'security',
  'sim_tariffs',
  'reminders',
  'calendar',
  'backup',
  'about',
]);

const VALID_POINTS_REASONS = new Set<PointsReason>([
  'daily_open',
  'quick_callback',
  'call_tag_or_note',
  'streak_bonus',
  'contact_milestone',
  'wish_opened',
  'reconnect_contact',
]);

const VALID_WISH_CHANNELS = new Set<WishChannel>([
  'sms',
  'whatsapp',
  'telegram',
  'instagram',
  'copy',
]);

const VALID_DIRECTIONS = new Set<CallDirection>([
  'incoming',
  'outgoing',
  'missed',
  'rejected',
  'blocked',
  'voicemail',
]);

export function sanitizeTariffs(t: Partial<TariffConfig> | undefined): TariffConfig {
  const sim1 = Number(t?.sim1RatePerMin);
  const sim2 = Number(t?.sim2RatePerMin);
  const budget = Number(t?.monthlyBudgetEtb);
  return {
    sim1RatePerMin: Math.max(0, Math.min(1000, Number.isFinite(sim1) ? sim1 : 0)),
    sim2RatePerMin: Math.max(0, Math.min(1000, Number.isFinite(sim2) ? sim2 : 0)),
    billingMode: t?.billingMode === 'per-minute' ? 'per-minute' : 'per-second',
    monthlyBudgetEtb: Math.max(0, Math.min(1_000_000, Number.isFinite(budget) ? budget : 0)),
  };
}

export function sanitizeSimLabels(s: Partial<SimLabels> | undefined): SimLabels {
  const raw1 =
    typeof s?.sim1Label === 'string' && s.sim1Label.trim()
      ? s.sim1Label.trim()
      : DEFAULT_SIM_LABELS.sim1Label;
  const raw2 =
    typeof s?.sim2Label === 'string' && s.sim2Label.trim()
      ? s.sim2Label.trim()
      : DEFAULT_SIM_LABELS.sim2Label;
  const label1 = clampStr(formatCarrierShort(raw1) || raw1, 40) || DEFAULT_SIM_LABELS.sim1Label;
  const label2 = clampStr(formatCarrierShort(raw2) || raw2, 40) || DEFAULT_SIM_LABELS.sim2Label;
  return {
    sim1Label: label1,
    sim2Label: label2,
  };
}

export function sanitizeCalendarPrefs(c: Partial<CalendarPrefs> | undefined): CalendarPrefs {
  return {
    defaultLang: c?.defaultLang === 'amharic' ? 'amharic' : 'english',
    defaultGeezNumerals: Boolean(c?.defaultGeezNumerals),
    dateDisplay: c?.dateDisplay === 'both' ? 'both' : 'ec-first',
  };
}

export function sanitizeReminderPrefs(r: Partial<ReminderPrefs> | undefined): ReminderPrefs {
  const callbackRaw = Number(r?.callbackDelayMinutes);
  const leadRaw = Number(r?.eventLeadDays);
  const quietDaysRaw = Number(r?.quietContactDays);
  const startRaw = Number(r?.quietStartHour);
  const endRaw = Number(r?.quietEndHour);
  const rawMissedDelay = Number(r?.missedCallReminderDelayMinutes);
  const missedCallReminderDelayMinutes: 5 | 7 | 10 =
    rawMissedDelay === 5 ? 5 : rawMissedDelay === 10 ? 10 : 7;
  const goalRaw = Number(r?.weeklyReconnectGoal);
  const weeklyReconnectGoal = Number.isFinite(goalRaw)
    ? Math.max(1, Math.min(14, Math.round(goalRaw)))
    : 3;

  return {
    callbackDelayMinutes: Math.max(
      5,
      Math.min(1440, Math.round(Number.isFinite(callbackRaw) && callbackRaw > 0 ? callbackRaw : 15)),
    ),
    missedCallReminderEnabled:
      typeof r?.missedCallReminderEnabled === 'boolean' ? r.missedCallReminderEnabled : true,
    missedCallReminderDelayMinutes,
    onlySavedContactsReminder: Boolean(r?.onlySavedContactsReminder),
    weeklyReconnectGoal,
    eventLeadDays: Math.max(0, Math.min(60, Math.round(Number.isFinite(leadRaw) ? leadRaw : 7))),
    quietContactDays: Math.max(
      3,
      Math.min(180, Math.round(Number.isFinite(quietDaysRaw) && quietDaysRaw > 0 ? quietDaysRaw : 30)),
    ),
    quietHoursEnabled: Boolean(r?.quietHoursEnabled),
    quietStartHour: Math.max(0, Math.min(23, Number.isFinite(startRaw) ? Math.round(startRaw) : 22)),
    quietEndHour: Math.max(0, Math.min(23, Number.isFinite(endRaw) ? Math.round(endRaw) : 7)),
  };
}

export function sanitizeAlertTypePrefs(a: Partial<AlertTypePrefs> | undefined): AlertTypePrefs {
  return {
    missedCalls:
      typeof a?.missedCalls === 'boolean' ? a.missedCalls : DEFAULT_ALERT_TYPE_PREFS.missedCalls,
    scheduledCalls:
      typeof a?.scheduledCalls === 'boolean'
        ? a.scheduledCalls
        : DEFAULT_ALERT_TYPE_PREFS.scheduledCalls,
    birthdays:
      typeof a?.birthdays === 'boolean' ? a.birthdays : DEFAULT_ALERT_TYPE_PREFS.birthdays,
    holidays:
      typeof a?.holidays === 'boolean' ? a.holidays : DEFAULT_ALERT_TYPE_PREFS.holidays,
    quietContacts:
      typeof a?.quietContacts === 'boolean'
        ? a.quietContacts
        : DEFAULT_ALERT_TYPE_PREFS.quietContacts,
  };
}

export function sanitizeVoiceBundleSlot(
  slot: Partial<VoiceBundleSlot> | undefined,
  fallback: VoiceBundleSlot,
): VoiceBundleSlot {
  const rawName = typeof slot?.name === 'string' ? slot.name : fallback.name;
  const rawTotal = Number(slot?.totalMinutes ?? fallback.totalMinutes);
  const rawPrice = Number(slot?.priceEtb ?? fallback.priceEtb);
  const rawStarted = Number(slot?.startedAt ?? fallback.startedAt);
  const rawExpires = Number(slot?.expiresAt ?? fallback.expiresAt);
  return {
    enabled: Boolean(slot?.enabled),
    name: clampStr(rawName.trim(), 60),
    totalMinutes: Math.max(0, Math.min(100_000, Number.isFinite(rawTotal) ? rawTotal : 0)),
    priceEtb: Math.max(0, Math.min(1_000_000, Number.isFinite(rawPrice) ? rawPrice : 0)),
    startedAt: Math.max(0, Math.round(Number.isFinite(rawStarted) ? rawStarted : 0)),
    expiresAt: Math.max(0, Math.round(Number.isFinite(rawExpires) ? rawExpires : 0)),
  };
}

export function sanitizeVoiceBundles(vb: Partial<VoiceBundles> | undefined): VoiceBundles {
  return {
    sim1: sanitizeVoiceBundleSlot(vb?.sim1, DEFAULT_VOICE_BUNDLES.sim1),
    sim2: sanitizeVoiceBundleSlot(vb?.sim2, DEFAULT_VOICE_BUNDLES.sim2),
  };
}

export function sanitizeStreaks(raw: unknown): StreakRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_STREAKS };
  const obj = raw as Record<string, unknown>;
  const current = Math.max(0, Math.round(Number(obj.currentStreak) || 0));
  const longest = Math.max(current, Math.round(Number(obj.longestStreak) || 0));
  return {
    currentStreak: current,
    longestStreak: longest,
    lastActiveDate:
      typeof obj.lastActiveDate === 'string' && obj.lastActiveDate.trim()
        ? obj.lastActiveDate.trim()
        : null,
    totalActiveDays:
      typeof obj.totalActiveDays === 'number' && Number.isFinite(obj.totalActiveDays)
        ? Math.max(0, Math.round(obj.totalActiveDays))
        : 0,
  };
}

export function sanitizeBadges(raw: unknown): BadgeRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is BadgeRecord =>
        Boolean(item && typeof item === 'object' && typeof (item as BadgeRecord).id === 'string'),
    )
    .map((item) => ({
      id: item.id,
      ...(typeof item.title === 'string' ? { title: item.title } : {}),
      ...(typeof item.description === 'string' ? { description: item.description } : {}),
      unlockedAt: Number(item.unlockedAt) || Date.now(),
    }));
}

export function sanitizePointsHistory(raw: unknown): PointsHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, PointsHistoryEntry>();
  raw.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const rec = item as Partial<PointsHistoryEntry>;
    if (typeof rec.id !== 'string' || !rec.id.trim()) return;
    const points = Math.max(0, Math.round(Number(rec.points) || 0));
    if (points <= 0) return;
    const timestamp =
      typeof rec.timestamp === 'number' && Number.isFinite(rec.timestamp) && rec.timestamp > 0
        ? Math.round(rec.timestamp)
        : Date.now();
    const eatDate =
      typeof rec.eatDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.eatDate.trim())
        ? rec.eatDate.trim()
        : toEatDateString(timestamp);
    const reason: PointsReason =
      typeof rec.reason === 'string' && VALID_POINTS_REASONS.has(rec.reason as PointsReason)
        ? (rec.reason as PointsReason)
        : 'daily_open';
    if (!byId.has(rec.id)) {
      byId.set(rec.id, {
        id: rec.id,
        reason,
        points,
        label:
          typeof rec.label === 'string' && rec.label.trim() ? rec.label.trim() : 'Points activity',
        timestamp,
        eatDate,
        ...(typeof rec.meta === 'string' && rec.meta.trim() ? { meta: rec.meta.trim() } : {}),
      });
    }
  });
  return Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function sanitizeContactMilestones(raw: unknown): ContactMilestoneRecord[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, ContactMilestoneRecord>();
  raw.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const rec = item as Partial<ContactMilestoneRecord>;
    if (typeof rec.id !== 'string' || !rec.id.trim()) return;
    if (typeof rec.contactKey !== 'string' || !rec.contactKey.trim()) return;
    const days = Math.round(Number(rec.days) || 0);
    if (!Number.isFinite(days) || days < 1) return;
    const streakStartDate =
      typeof rec.streakStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.streakStartDate.trim())
        ? rec.streakStartDate.trim()
        : '';
    const reachedDate =
      typeof rec.reachedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.reachedDate.trim())
        ? rec.reachedDate.trim()
        : streakStartDate || toEatDateString();
    const awardedAt =
      typeof rec.awardedAt === 'number' && Number.isFinite(rec.awardedAt) && rec.awardedAt > 0
        ? Math.round(rec.awardedAt)
        : Date.now();
    const celebratedAt =
      typeof rec.celebratedAt === 'number' &&
      Number.isFinite(rec.celebratedAt) &&
      rec.celebratedAt > 0
        ? Math.round(rec.celebratedAt)
        : null;
    if (!byId.has(rec.id)) {
      byId.set(rec.id, {
        id: rec.id,
        contactKey: rec.contactKey,
        days,
        streakStartDate: streakStartDate || reachedDate,
        reachedDate,
        badgeId:
          typeof rec.badgeId === 'string' && rec.badgeId.trim()
            ? rec.badgeId.trim()
            : `contact_${days}d`,
        badgeTitle:
          typeof rec.badgeTitle === 'string' && rec.badgeTitle.trim()
            ? rec.badgeTitle.trim()
            : `${days}-Day Milestone`,
        points: Math.max(0, Math.round(Number(rec.points) || 0)),
        awardedAt,
        celebratedAt,
      });
    }
  });
  return Array.from(byId.values()).sort((a, b) => b.awardedAt - a.awardedAt || b.days - a.days);
}

export function sanitizeCallsTabState(raw: unknown): CallsTabState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CALLS_TAB_STATE };
  }
  const obj = raw as Record<string, unknown>;
  const lastOpenedAt =
    typeof obj.lastOpenedAt === 'number' && Number.isFinite(obj.lastOpenedAt) && obj.lastOpenedAt > 0
      ? Math.round(obj.lastOpenedAt)
      : 0;
  const unseenCallIds = Array.isArray(obj.unseenCallIds)
    ? Array.from(
        new Set(
          obj.unseenCallIds.filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0,
          ),
        ),
      ).slice(0, 500)
    : [];
  return { lastOpenedAt, unseenCallIds };
}

export function sanitizeWishTemplates(raw: unknown): WishTemplateMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: WishTemplateMap = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, val]) => {
    if (typeof val !== 'string') return;
    const cleanKey = clampStr(key.trim(), 120);
    const cleanVal = clampStr(val.trim(), 1000);
    if (cleanKey && cleanVal) {
      out[cleanKey] = cleanVal;
    }
  });
  return out;
}

export function sanitizeSentWishes(raw: unknown): SentWishRecord[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, SentWishRecord>();
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const rec = item as Partial<SentWishRecord>;
    const contactKey =
      typeof rec.contactKey === 'string' ? clampStr(rec.contactKey.trim(), 64) : '';
    const occasionKey =
      typeof rec.occasionKey === 'string' ? clampStr(rec.occasionKey.trim(), 120) : '';
    const year = Math.round(Number(rec.year) || 0);
    if (!contactKey || !occasionKey || year < 1900 || year > 2500) return;
    const channel: WishChannel =
      typeof rec.channel === 'string' && VALID_WISH_CHANNELS.has(rec.channel as WishChannel)
        ? (rec.channel as WishChannel)
        : 'copy';
    const timestamp =
      typeof rec.timestamp === 'number' && Number.isFinite(rec.timestamp) && rec.timestamp > 0
        ? Math.round(rec.timestamp)
        : Date.now();
    const id =
      typeof rec.id === 'string' && rec.id.trim()
        ? clampStr(rec.id.trim(), 160)
        : `${contactKey}|${occasionKey}|${year}|${index}`;
    if (!byId.has(id)) {
      byId.set(id, { id, contactKey, occasionKey, year, channel, timestamp });
    }
  });
  return Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export function sanitizeSnoozedQuietUntil(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, val]) => {
    const cleanKey = clampStr(key.trim(), 64);
    const until = Number(val);
    if (cleanKey && Number.isFinite(until) && until > 0) {
      out[cleanKey] = Math.round(until);
    }
  });
  return out;
}

export function sanitizeReconnectProgress(raw: unknown): ReconnectProgressRecord {
  const currentWeek = getEatWeekKey();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_RECONNECT_PROGRESS, weekKey: currentWeek };
  }
  const obj = raw as Record<string, unknown>;
  const rawWeekKey = typeof obj.weekKey === 'string' ? obj.weekKey.trim().slice(0, 16) : '';
  if (!rawWeekKey || rawWeekKey !== currentWeek) {
    return { weekKey: currentWeek, contactedKeys: [] };
  }
  const contactedKeys = Array.isArray(obj.contactedKeys)
    ? Array.from(
        new Set(
          obj.contactedKeys
            .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
            .map((k) => clampStr(k.trim(), 64)),
        ),
      ).slice(0, 200)
    : [];
  return { weekKey: rawWeekKey, contactedKeys };
}

export function sanitizeExpandedSettingsSections(raw: unknown): SettingsSectionId[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw.filter(
        (v): v is SettingsSectionId =>
          typeof v === 'string' && VALID_SETTINGS_SECTIONS.has(v as SettingsSectionId),
      ),
    ),
  );
}

export function healCallRecord(call: CallRecord): CallRecord {
  const name = call.name ? decodeIfQuotedPrintableText(call.name) : null;
  const note = call.note ? decodeIfQuotedPrintableText(call.note) : null;
  const tag = call.tag ? decodeIfQuotedPrintableText(call.tag) : null;
  const direction: CallDirection = VALID_DIRECTIONS.has(call.direction)
    ? call.direction
    : 'missed';
  if (
    name === call.name &&
    note === call.note &&
    tag === call.tag &&
    direction === call.direction
  ) {
    return call;
  }
  return { ...call, name, note, tag, direction };
}

export function healContactProfile(profile: ContactProfile): ContactProfile {
  const name = decodeIfQuotedPrintableText(profile.name);
  const tag = decodeIfQuotedPrintableText(profile.tag);
  const notes = decodeIfQuotedPrintableText(profile.notes);
  const telegramUsername = sanitizeSocialUsername(profile.telegramUsername ?? '');
  const instagramUsername = sanitizeSocialUsername(profile.instagramUsername ?? '');
  const next: ContactProfile = {
    ...profile,
    name,
    tag,
    notes,
  };
  if (telegramUsername) {
    next.telegramUsername = telegramUsername;
  } else {
    delete next.telegramUsername;
  }
  if (instagramUsername) {
    next.instagramUsername = instagramUsername;
  } else {
    delete next.instagramUsername;
  }
  return next;
}

export function healScheduledCall(item: ScheduledCall): ScheduledCall {
  const name = item.name ? decodeIfQuotedPrintableText(item.name) : null;
  const note = item.note ? decodeIfQuotedPrintableText(item.note) : null;
  if (name === item.name && note === item.note) return item;
  return { ...item, name, note };
}
