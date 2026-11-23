import { getContactKey } from '@/src/lib/contacts';
import { normaliseEthPhone } from '@/src/lib/ethiopia';
import {
  BADGE_DEFINITIONS,
  CONTACT_BADGE_DEFINITIONS,
  CONTACT_MILESTONE_DAYS,
  CONTACT_POINTS_CONFIG,
  CONTACT_STREAK_DAY_RULE,
  EAT_UTC_OFFSET_MS,
  ORGANIZED_CALLS_BADGE_TARGET,
  POINTS_CONFIG,
  QUICK_CALLBACK_BADGE_TARGET,
  STREAK_BONUS_DAYS,
} from '@/src/lib/gamificationConstants';
import type {
  BadgeRecord,
  CallRecord,
  ContactBadgeItem,
  ContactMilestoneRecord,
  ContactMilestoneRun,
  ContactProfile,
  ContactStreakStatus,
  PointsHistoryEntry,
  StreakRecord,
} from '@/src/types/call';

const DAY_MS = 86_400_000;

export function toEatDateString(timestampMs: number = Date.now()): string {
  const shifted = new Date(timestampMs + EAT_UTC_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseEatDateToUtcMidnight(eatDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eatDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day);
}

export function eatDateDiffDays(fromEatDate: string, toEatDate: string): number {
  const fromMs = parseEatDateToUtcMidnight(fromEatDate);
  const toMs = parseEatDateToUtcMidnight(toEatDate);
  if (fromMs === null || toMs === null) return Number.NaN;
  return Math.round((toMs - fromMs) / DAY_MS);
}

export function getEffectiveStreak(
  streaks: StreakRecord,
  nowMs: number = Date.now(),
): StreakRecord {
  if (!streaks.lastActiveDate) {
    return {
      currentStreak: 0,
      longestStreak: Math.max(0, streaks.longestStreak),
      lastActiveDate: null,
      totalActiveDays: Math.max(0, streaks.totalActiveDays ?? 0),
    };
  }
  const todayEat = toEatDateString(nowMs);
  const diff = eatDateDiffDays(streaks.lastActiveDate, todayEat);
  if (!Number.isFinite(diff) || diff > 1) {
    return {
      currentStreak: 0,
      longestStreak: Math.max(0, streaks.longestStreak),
      lastActiveDate: streaks.lastActiveDate,
      totalActiveDays: Math.max(0, streaks.totalActiveDays ?? 0),
    };
  }
  return {
    currentStreak: Math.max(0, streaks.currentStreak),
    longestStreak: Math.max(streaks.currentStreak, streaks.longestStreak),
    lastActiveDate: streaks.lastActiveDate,
    totalActiveDays: Math.max(0, streaks.totalActiveDays ?? 0),
  };
}

export function computeScoreFromHistory(history: PointsHistoryEntry[]): number {
  return history.reduce((sum, entry) => sum + (Number.isFinite(entry.points) ? entry.points : 0), 0);
}

export function mergePointsHistory(
  existing: PointsHistoryEntry[],
  incoming: PointsHistoryEntry[],
): { merged: PointsHistoryEntry[]; added: PointsHistoryEntry[] } {
  if (incoming.length === 0) {
    return { merged: existing, added: [] };
  }
  const byId = new Map<string, PointsHistoryEntry>();
  existing.forEach((entry) => {
    if (entry && entry.id) byId.set(entry.id, entry);
  });
  const added: PointsHistoryEntry[] = [];
  incoming.forEach((entry) => {
    if (!entry || !entry.id) return;
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
      added.push(entry);
    }
  });
  if (added.length === 0) {
    return { merged: existing, added: [] };
  }
  const merged = Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
  return { merged, added };
}

export function applyDailyAppOpen(
  currentStreaks: StreakRecord,
  existingHistory: PointsHistoryEntry[],
  nowMs: number = Date.now(),
): {
  streaks: StreakRecord;
  history: PointsHistoryEntry[];
  addedPoints: PointsHistoryEntry[];
  changed: boolean;
} {
  const todayEat = toEatDateString(nowMs);
  const existingIds = new Set(existingHistory.map((item) => item.id));
  const dailyEntryId = `daily_open:${todayEat}`;

  const lastDate = currentStreaks.lastActiveDate;
  const diff = lastDate ? eatDateDiffDays(lastDate, todayEat) : Number.NaN;

  // Guard against clock skew backwards
  if (lastDate && Number.isFinite(diff) && diff < 0) {
    return {
      streaks: currentStreaks,
      history: existingHistory,
      addedPoints: [],
      changed: false,
    };
  }

  let nextStreaks = currentStreaks;
  let streakChanged = false;
  const newEntries: PointsHistoryEntry[] = [];

  if (lastDate !== todayEat) {
    const nextCurrent =
      lastDate && diff === 1 ? Math.max(0, currentStreaks.currentStreak) + 1 : 1;
    const nextLongest = Math.max(currentStreaks.longestStreak, nextCurrent);
    const nextTotal = Math.max(0, currentStreaks.totalActiveDays ?? 0) + 1;
    nextStreaks = {
      currentStreak: nextCurrent,
      longestStreak: nextLongest,
      lastActiveDate: todayEat,
      totalActiveDays: nextTotal,
    };
    streakChanged = true;
  }

  if (!existingIds.has(dailyEntryId)) {
    newEntries.push({
      id: dailyEntryId,
      reason: 'daily_open',
      points: POINTS_CONFIG.DAILY_FIRST_OPEN,
      label: `Daily open (${todayEat} EAT)`,
      timestamp: nowMs,
      eatDate: todayEat,
    });
  }

  for (const milestone of STREAK_BONUS_DAYS) {
    if (nextStreaks.currentStreak >= milestone) {
      const bonusId = `streak_bonus:${milestone}`;
      if (!existingIds.has(bonusId)) {
        newEntries.push({
          id: bonusId,
          reason: 'streak_bonus',
          points: POINTS_CONFIG.STREAK_MILESTONE_BONUS,
          label: `${milestone}-day usage streak bonus`,
          timestamp: nowMs,
          eatDate: todayEat,
          meta: String(milestone),
        });
      }
    }
  }

  if (!streakChanged && newEntries.length === 0) {
    return {
      streaks: currentStreaks,
      history: existingHistory,
      addedPoints: [],
      changed: false,
    };
  }

  const { merged, added } = mergePointsHistory(existingHistory, newEntries);
  return {
    streaks: nextStreaks,
    history: merged,
    addedPoints: added,
    changed: streakChanged || added.length > 0,
  };
}

export function detectQuickMissedCallbacks(
  calls: CallRecord[],
  existingHistory: PointsHistoryEntry[],
  windowMinutes: number,
  nowMs: number = Date.now(),
): {
  history: PointsHistoryEntry[];
  addedPoints: PointsHistoryEntry[];
} {
  if (calls.length < 2) {
    return { history: existingHistory, addedPoints: [] };
  }

  const windowMs = Math.max(1, windowMinutes) * 60_000;
  const existingIds = new Set(existingHistory.map((item) => item.id));

  const byNumber = new Map<string, { missed: CallRecord[]; outgoing: CallRecord[] }>();
  calls.forEach((call) => {
    const norm = normaliseEthPhone(call.number);
    if (!norm) return;
    let bucket = byNumber.get(norm);
    if (!bucket) {
      bucket = { missed: [], outgoing: [] };
      byNumber.set(norm, bucket);
    }
    if (call.direction === 'missed') {
      bucket.missed.push(call);
    } else if (call.direction === 'outgoing') {
      bucket.outgoing.push(call);
    }
  });

  const newEntries: PointsHistoryEntry[] = [];

  byNumber.forEach((bucket) => {
    if (bucket.missed.length === 0 || bucket.outgoing.length === 0) return;
    const missedSorted = [...bucket.missed].sort((a, b) => a.timestamp - b.timestamp);
    const outgoingSorted = [...bucket.outgoing].sort((a, b) => a.timestamp - b.timestamp);
    const matchedMissed = new Set<string>();

    outgoingSorted.forEach((out) => {
      // Match the most recent unmatched missed call returned within the reminder window
      let candidate: CallRecord | null = null;
      for (let i = missedSorted.length - 1; i >= 0; i -= 1) {
        const m = missedSorted[i];
        if (matchedMissed.has(m.id)) continue;
        if (m.timestamp < out.timestamp && out.timestamp - m.timestamp <= windowMs) {
          candidate = m;
          break;
        }
      }
      if (!candidate) return;
      matchedMissed.add(candidate.id);
      const entryId = `quick_callback:${candidate.id}`;
      if (existingIds.has(entryId)) return;
      existingIds.add(entryId);
      const targetName = candidate.name?.trim() || candidate.number;
      newEntries.push({
        id: entryId,
        reason: 'quick_callback',
        points: POINTS_CONFIG.QUICK_MISSED_CALLBACK,
        label: `Quick callback (${targetName})`,
        timestamp: out.timestamp || nowMs,
        eatDate: toEatDateString(out.timestamp || nowMs),
        meta: candidate.id,
      });
    });
  });

  if (newEntries.length === 0) {
    return { history: existingHistory, addedPoints: [] };
  }
  const { merged, added } = mergePointsHistory(existingHistory, newEntries);
  return { history: merged, addedPoints: added };
}

export function createTagOrNotePointEntry(
  call: CallRecord,
  existingHistory: PointsHistoryEntry[],
  nowMs: number = Date.now(),
): PointsHistoryEntry | null {
  const hasAnnotation = Boolean(call.tag?.trim() || call.note?.trim());
  if (!hasAnnotation) return null;
  const entryId = `call_tag_or_note:${call.id}`;
  if (existingHistory.some((item) => item.id === entryId)) {
    return null;
  }
  const targetName = call.name?.trim() || call.number;
  return {
    id: entryId,
    reason: 'call_tag_or_note',
    points: POINTS_CONFIG.CALL_TAG_OR_NOTE,
    label: `Added tag or note (${targetName})`,
    timestamp: nowMs,
    eatDate: toEatDateString(nowMs),
    meta: call.id,
  };
}

export function reconcileBadges(
  streaks: StreakRecord,
  history: PointsHistoryEntry[],
  existingBadges: BadgeRecord[],
  nowMs: number = Date.now(),
): {
  badges: BadgeRecord[];
  newlyUnlocked: BadgeRecord[];
} {
  const byId = new Map<string, BadgeRecord>();
  existingBadges.forEach((b) => {
    if (b && b.id) byId.set(b.id, b);
  });

  const quickCallbacksCount = history.filter((e) => e.reason === 'quick_callback').length;
  const taggedOrNotedCount = history.filter((e) => e.reason === 'call_tag_or_note').length;
  const hasDailyOpen =
    (streaks.totalActiveDays ?? 0) >= 1 ||
    streaks.lastActiveDate !== null ||
    history.some((e) => e.reason === 'daily_open');

  const unlockedCheck: Record<string, boolean> = {
    first_open: hasDailyOpen,
    streak_7: streaks.longestStreak >= 7,
    streak_30: streaks.longestStreak >= 30,
    streak_100: streaks.longestStreak >= 100,
    quick_returner: quickCallbacksCount >= QUICK_CALLBACK_BADGE_TARGET,
    organized_caller: taggedOrNotedCount >= ORGANIZED_CALLS_BADGE_TARGET,
  };

  const newlyUnlocked: BadgeRecord[] = [];
  BADGE_DEFINITIONS.forEach((def) => {
    const existing = byId.get(def.id);
    if (existing) {
      byId.set(def.id, {
        ...existing,
        title: def.title,
        description: def.description,
      });
      return;
    }
    if (unlockedCheck[def.id]) {
      const badge: BadgeRecord = {
        id: def.id,
        title: def.title,
        description: def.description,
        unlockedAt: nowMs,
      };
      byId.set(def.id, badge);
      newlyUnlocked.push(badge);
    }
  });

  return {
    badges: Array.from(byId.values()).sort((a, b) => a.unlockedAt - b.unlockedAt),
    newlyUnlocked,
  };
}

export function buildEmptyContactStatus(
  contactKey: string,
  number: string,
  displayName: string,
  tag = '',
): ContactStreakStatus {
  const badges: ContactBadgeItem[] = CONTACT_BADGE_DEFINITIONS.map((def) => ({
    id: def.id,
    days: def.days,
    title: def.title,
    description: def.description,
    points: def.points,
    earned: false,
    unlockedEatDate: null,
  }));
  return {
    contactKey,
    number,
    displayName: displayName || number,
    tag,
    currentStreak: 0,
    longestStreak: 0,
    totalConnectedDays: 0,
    totalConnectedCalls: 0,
    quickCallbacksCount: 0,
    taggedOrNotedCallsCount: 0,
    lastConnectedDate: null,
    currentStreakStartDate: null,
    milestoneRuns: [],
    contactScore: 0,
    unlockedMilestones: [],
    nextMilestoneDays: CONTACT_MILESTONE_DAYS[0],
    daysToNextMilestone: CONTACT_MILESTONE_DAYS[0],
    statusHeadline: 'No streak yet',
    statusSubtext: 'Call or answer (incoming or outgoing) to start',
    badges,
    earnedBadgesCount: 0,
  };
}

export function computeContactStatuses(
  calls: CallRecord[],
  contacts: Record<string, ContactProfile>,
  quickCallbackWindowMinutes: number,
  nowMs: number = Date.now(),
): Record<string, ContactStreakStatus> {
  const todayEat = toEatDateString(nowMs);
  const windowMs = Math.max(1, quickCallbackWindowMinutes) * 60_000;

  type ContactAccumulator = {
    contactKey: string;
    number: string;
    latestCallName: string;
    latestCallTimestamp: number;
    dayDirections: Map<string, { incoming: boolean; outgoing: boolean }>;
    totalConnectedCalls: number;
    taggedOrNotedCallsCount: number;
    missedCalls: CallRecord[];
    outgoingCalls: CallRecord[];
  };

  const buckets = new Map<string, ContactAccumulator>();

  const ensureBucket = (contactKey: string, fallbackNumber: string): ContactAccumulator => {
    let bucket = buckets.get(contactKey);
    if (!bucket) {
      bucket = {
        contactKey,
        number: fallbackNumber,
        latestCallName: '',
        latestCallTimestamp: -1,
        dayDirections: new Map(),
        totalConnectedCalls: 0,
        taggedOrNotedCallsCount: 0,
        missedCalls: [],
        outgoingCalls: [],
      };
      buckets.set(contactKey, bucket);
    }
    return bucket;
  };

  Object.values(contacts).forEach((profile) => {
    const key = profile.key || getContactKey(profile.number);
    if (!key) return;
    ensureBucket(key, profile.number);
  });

  calls.forEach((call) => {
    const key = getContactKey(call.number);
    if (!key) return;
    const bucket = ensureBucket(key, call.number);

    if (call.timestamp >= bucket.latestCallTimestamp) {
      bucket.latestCallTimestamp = call.timestamp;
      bucket.number = call.number || bucket.number;
      if (call.name?.trim()) {
        bucket.latestCallName = call.name.trim();
      }
    } else if (!bucket.latestCallName && call.name?.trim()) {
      bucket.latestCallName = call.name.trim();
    }

    if (call.tag?.trim() || call.note?.trim()) {
      bucket.taggedOrNotedCallsCount += 1;
    }

    if (call.direction === 'missed') {
      bucket.missedCalls.push(call);
    } else if (call.direction === 'outgoing') {
      bucket.outgoingCalls.push(call);
    }

    if (call.direction === 'incoming' || call.direction === 'outgoing') {
      bucket.totalConnectedCalls += 1;
      const eatDate = toEatDateString(call.timestamp);
      const flags = bucket.dayDirections.get(eatDate) ?? { incoming: false, outgoing: false };
      if (call.direction === 'incoming') flags.incoming = true;
      if (call.direction === 'outgoing') flags.outgoing = true;
      bucket.dayDirections.set(eatDate, flags);
    }
  });

  const result: Record<string, ContactStreakStatus> = {};

  buckets.forEach((bucket, key) => {
    const profile = contacts[key];
    const displayName =
      profile?.name?.trim() || bucket.latestCallName || profile?.number || bucket.number || key;
    const contactNumber = profile?.number || bucket.number || key;
    const tag = profile?.tag?.trim() || '';

    const qualifyingDates = Array.from(bucket.dayDirections.entries())
      .filter(([, flags]) =>
        CONTACT_STREAK_DAY_RULE === 'both_directions'
          ? flags.incoming && flags.outgoing
          : flags.incoming || flags.outgoing,
      )
      .map(([date]) => date)
      .sort();

    let longestStreak = 0;
    let run = 0;
    let runStartDate: string | null = null;
    let prevDate: string | null = null;
    const milestoneDates = new Map<number, string>();
    const milestoneRuns: ContactMilestoneRun[] = [];
    const seenRunMilestones = new Set<string>();

    qualifyingDates.forEach((date) => {
      if (prevDate && eatDateDiffDays(prevDate, date) === 1) {
        run += 1;
      } else {
        run = 1;
        runStartDate = date;
      }
      if (run > longestStreak) {
        longestStreak = run;
      }
      if (runStartDate) {
        for (const m of CONTACT_MILESTONE_DAYS) {
          if (run >= m) {
            if (!milestoneDates.has(m)) {
              milestoneDates.set(m, date);
            }
            const runKey = `${m}:${runStartDate}`;
            if (!seenRunMilestones.has(runKey)) {
              seenRunMilestones.add(runKey);
              milestoneRuns.push({
                days: m,
                streakStartDate: runStartDate,
                reachedDate: date,
              });
            }
          }
        }
      }
      prevDate = date;
    });

    const lastConnectedDate = qualifyingDates.length > 0 ? qualifyingDates[qualifyingDates.length - 1] : null;
    let currentStreak = 0;
    let currentStreakStartDate: string | null = null;
    if (lastConnectedDate) {
      const diffToToday = eatDateDiffDays(lastConnectedDate, todayEat);
      if (Number.isFinite(diffToToday) && (diffToToday === 0 || diffToToday === 1)) {
        currentStreak = run;
        currentStreakStartDate = runStartDate;
      }
    }

    // Count quick missed callbacks returned to this contact within reminder window
    let quickCallbacksCount = 0;
    if (bucket.missedCalls.length > 0 && bucket.outgoingCalls.length > 0) {
      const missedSorted = [...bucket.missedCalls].sort((a, b) => a.timestamp - b.timestamp);
      const outgoingSorted = [...bucket.outgoingCalls].sort((a, b) => a.timestamp - b.timestamp);
      const matchedMissed = new Set<string>();
      outgoingSorted.forEach((out) => {
        for (let i = missedSorted.length - 1; i >= 0; i -= 1) {
          const m = missedSorted[i];
          if (matchedMissed.has(m.id)) continue;
          if (m.timestamp < out.timestamp && out.timestamp - m.timestamp <= windowMs) {
            matchedMissed.add(m.id);
            quickCallbacksCount += 1;
            break;
          }
        }
      });
    }

    const badges: ContactBadgeItem[] = CONTACT_BADGE_DEFINITIONS.map((def) => {
      const earned = longestStreak >= def.days;
      return {
        id: def.id,
        days: def.days,
        title: def.title,
        description: def.description,
        points: def.points,
        earned,
        unlockedEatDate: earned ? milestoneDates.get(def.days) ?? lastConnectedDate : null,
      };
    });

    const unlockedMilestones = badges.filter((b) => b.earned).map((b) => b.days);
    const milestonePoints = badges.reduce((sum, b) => sum + (b.earned ? b.points : 0), 0);
    const totalConnectedDays = qualifyingDates.length;

    const contactScore =
      totalConnectedDays * CONTACT_POINTS_CONFIG.CONNECTED_DAY +
      quickCallbacksCount * CONTACT_POINTS_CONFIG.QUICK_CALLBACK +
      bucket.taggedOrNotedCallsCount * CONTACT_POINTS_CONFIG.CALL_TAG_OR_NOTE +
      milestonePoints;

    const nextMilestoneDays =
      CONTACT_MILESTONE_DAYS.find((m) => m > currentStreak) ?? null;
    const daysToNextMilestone =
      nextMilestoneDays !== null ? Math.max(0, nextMilestoneDays - currentStreak) : 0;

    const highestEarnedBadge = [...badges].reverse().find((b) => b.earned) ?? null;
    const highestCurrentBadge =
      [...badges].reverse().find((b) => currentStreak >= b.days) ?? null;

    let statusHeadline = 'No streak yet';
    let statusSubtext = 'Call or answer (incoming or outgoing) to start';

    if (currentStreak >= 3) {
      statusHeadline = `You made ${currentStreak} days!`;
      statusSubtext = highestCurrentBadge
        ? `Active ${currentStreak}-day streak · ${highestCurrentBadge.title}`
        : `Active ${currentStreak}-day streak`;
    } else if (currentStreak > 0) {
      const needed = 3 - currentStreak;
      statusHeadline = `${currentStreak} day${currentStreak === 1 ? '' : 's'} active`;
      statusSubtext = `${needed} more day${needed === 1 ? '' : 's'} to unlock 3 Days Connected`;
    } else if (longestStreak >= 3) {
      statusHeadline = `Best: ${longestStreak} days`;
      statusSubtext = highestEarnedBadge
        ? `${highestEarnedBadge.title} earned · Call today to restart`
        : 'Streak paused · Call today to restart';
    } else if (totalConnectedDays > 0) {
      statusHeadline = `${totalConnectedDays} connected day${totalConnectedDays === 1 ? '' : 's'}`;
      statusSubtext = 'Call consecutive days to unlock 3 Days Connected';
    }

    result[key] = {
      contactKey: key,
      number: contactNumber,
      displayName,
      tag,
      currentStreak,
      longestStreak,
      totalConnectedDays,
      totalConnectedCalls: bucket.totalConnectedCalls,
      quickCallbacksCount,
      taggedOrNotedCallsCount: bucket.taggedOrNotedCallsCount,
      lastConnectedDate,
      currentStreakStartDate,
      milestoneRuns,
      contactScore,
      unlockedMilestones,
      nextMilestoneDays,
      daysToNextMilestone,
      statusHeadline,
      statusSubtext,
      badges,
      earnedBadgesCount: unlockedMilestones.length,
    };
  });

  return result;
}

export function reconcileContactMilestones(
  contactStatuses: Record<string, ContactStreakStatus>,
  existingMilestones: ContactMilestoneRecord[],
  existingHistory: PointsHistoryEntry[],
  nowMs: number = Date.now(),
): {
  milestones: ContactMilestoneRecord[];
  newlyUnlocked: ContactMilestoneRecord[];
  history: PointsHistoryEntry[];
  addedPoints: PointsHistoryEntry[];
} {
  const todayEat = toEatDateString(nowMs);
  const byId = new Map<string, ContactMilestoneRecord>();
  existingMilestones.forEach((m) => {
    if (m && m.id) byId.set(m.id, m);
  });

  const existingPointIds = new Set(existingHistory.map((item) => item.id));
  const newPointEntries: PointsHistoryEntry[] = [];
  const newlyUnlocked: ContactMilestoneRecord[] = [];
  const badgeDefByDays = new Map(CONTACT_BADGE_DEFINITIONS.map((d) => [d.days, d]));

  Object.values(contactStatuses).forEach((status) => {
    if (!status.milestoneRuns || status.milestoneRuns.length === 0) return;

    const pendingForContact: ContactMilestoneRecord[] = [];

    status.milestoneRuns.forEach((run) => {
      const def = badgeDefByDays.get(run.days);
      if (!def) return;

      const milestoneId = `${status.contactKey}:${run.days}:${run.streakStartDate}`;
      const legacyPointId = `contact_milestone:${status.contactKey}:${run.days}`;
      const runPointId = `contact_milestone:${status.contactKey}:${run.days}:${run.streakStartDate}`;

      const hasLegacyPoint = existingPointIds.has(legacyPointId);
      const hasRunPoint = existingPointIds.has(runPointId);

      const parsedUtc = parseEatDateToUtcMidnight(run.reachedDate);
      const reachedTs =
        parsedUtc !== null ? parsedUtc + 12 * 3_600_000 - EAT_UTC_OFFSET_MS : nowMs;

      // Never award points twice for the same streak run (and honor Step 5 legacy IDs)
      if (!hasLegacyPoint && !hasRunPoint && !byId.has(milestoneId)) {
        existingPointIds.add(runPointId);
        newPointEntries.push({
          id: runPointId,
          reason: 'contact_milestone',
          points: def.points,
          label: `${def.days}-day streak (${status.displayName})`,
          timestamp: reachedTs,
          eatDate: run.reachedDate,
          meta: status.contactKey,
        });
      }

      if (byId.has(milestoneId)) return;

      const diffFromToday = eatDateDiffDays(run.reachedDate, todayEat);
      const isRecentOrActive =
        status.currentStreak > 0 &&
        status.currentStreakStartDate === run.streakStartDate &&
        Number.isFinite(diffFromToday) &&
        diffFromToday <= 1;

      const legacyEntry = hasLegacyPoint
        ? existingHistory.find((item) => item.id === legacyPointId)
        : undefined;

      const record: ContactMilestoneRecord = {
        id: milestoneId,
        contactKey: status.contactKey,
        days: run.days,
        streakStartDate: run.streakStartDate,
        reachedDate: run.reachedDate,
        badgeId: def.id,
        badgeTitle: def.title,
        points: def.points,
        awardedAt: legacyEntry?.timestamp ?? reachedTs,
        celebratedAt: hasLegacyPoint
          ? (legacyEntry?.timestamp ?? reachedTs)
          : isRecentOrActive
            ? null
            : nowMs,
      };

      byId.set(milestoneId, record);
      newlyUnlocked.push(record);
      if (record.celebratedAt === null) {
        pendingForContact.push(record);
      }
    });

    // If a single import/sync unlocked multiple active milestones for the same contact,
    // only celebrate the highest one and mark lower ones in the same batch as celebrated.
    if (pendingForContact.length > 1) {
      pendingForContact.sort((a, b) => b.days - a.days);
      for (let i = 1; i < pendingForContact.length; i += 1) {
        const lower = pendingForContact[i];
        const updated: ContactMilestoneRecord = {
          ...lower,
          celebratedAt: nowMs,
        };
        byId.set(lower.id, updated);
      }
    }
  });

  const milestones = Array.from(byId.values()).sort(
    (a, b) => b.awardedAt - a.awardedAt || b.days - a.days,
  );

  if (newPointEntries.length === 0) {
    return {
      milestones,
      newlyUnlocked,
      history: existingHistory,
      addedPoints: [],
    };
  }

  const { merged, added } = mergePointsHistory(existingHistory, newPointEntries);
  return {
    milestones,
    newlyUnlocked,
    history: merged,
    addedPoints: added,
  };
}

export function detectContactMilestonePoints(
  contactStatuses: Record<string, ContactStreakStatus>,
  existingHistory: PointsHistoryEntry[],
  nowMs: number = Date.now(),
): {
  history: PointsHistoryEntry[];
  addedPoints: PointsHistoryEntry[];
} {
  const res = reconcileContactMilestones(contactStatuses, [], existingHistory, nowMs);
  return {
    history: res.history,
    addedPoints: res.addedPoints,
  };
}

