import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flame,
  Lock,
  PhoneCall,
  RefreshCw,
  Sparkles,
  Tag,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { avatarColor, initials } from '@/src/lib/format';
import {
  BADGE_DEFINITIONS,
  CONTACT_BADGE_DEFINITIONS,
  CONTACT_POINTS_CONFIG,
  POINTS_CONFIG,
  STREAK_BONUS_DAYS,
  type BadgeDefinition,
} from '@/src/lib/gamificationConstants';
import { triggerHaptic } from '@/src/lib/haptics';
import { formatDisplayNameOrPhone, maskPhoneNumber } from '@/src/lib/security';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';

function BadgeIcon({
  icon,
  earned,
}: {
  icon: BadgeDefinition['icon'];
  earned: boolean;
}) {
  const cls = earned
    ? 'text-[#FF6A00] shrink-0'
    : 'text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0';
  if (icon === 'sparkles') return <Sparkles size={18} className={cls} />;
  if (icon === 'flame') return <Flame size={18} className={cls} />;
  if (icon === 'trophy') return <Trophy size={18} className={cls} />;
  if (icon === 'crown') return <Crown size={18} className={cls} />;
  if (icon === 'phone') return <PhoneCall size={18} className={cls} />;
  return <Tag size={18} className={cls} />;
}

export function AchievementsModal({
  open,
  onClose,
  onSelectContact,
  initialTab = 'general',
}: {
  open: boolean;
  onClose: () => void;
  onSelectContact?: (number: string) => void;
  initialTab?: 'general' | 'contacts';
}) {
  useLockBodyScroll(open);
  const prefersReducedMotion = useReducedMotion();
  const {
    effectiveStreaks,
    score,
    badges,
    pointsHistory,
    topContactStatuses,
    contactStatuses,
    privacyMode,
    rebuildScore,
    calendarPrefs,
    reminderPrefs,
    showNotice,
  } = useCalls();

  const [tab, setTab] = useState<'general' | 'contacts'>(initialTab);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const earnedMap = new Map(badges.map((b) => [b.id, b]));
  const earnedCount = BADGE_DEFINITIONS.filter((def) => earnedMap.has(def.id)).length;
  const sortedHistory = useMemo(
    () => [...pointsHistory].sort((a, b) => b.timestamp - a.timestamp),
    [pointsHistory],
  );

  const contactSummary = useMemo(() => {
    let activeStreaks = 0;
    let reached3Plus = 0;
    let totalContactBadges = 0;
    topContactStatuses.forEach((s) => {
      if (s.currentStreak > 0) activeStreaks += 1;
      if (s.longestStreak >= 3) reached3Plus += 1;
      totalContactBadges += s.earnedBadgesCount;
    });
    return {
      activeStreaks,
      reached3Plus,
      totalContactBadges,
    };
  }, [topContactStatuses]);

  const formatHistoryLabel = (entry: (typeof sortedHistory)[number]) => {
    if (!privacyMode) return entry.label;
    if (entry.reason === 'contact_milestone' && entry.meta) {
      const st = contactStatuses[entry.meta];
      const daysMatch = /^contact_milestone:.*:(\d+)$/.exec(entry.id);
      const days = daysMatch ? daysMatch[1] : '';
      const maskedName = st
        ? formatDisplayNameOrPhone(st.displayName, st.number, true)
        : 'contact';
      return `${days ? `${days}-day streak` : 'Contact streak'} (${maskedName})`;
    }
    if (entry.reason === 'quick_callback') {
      return 'Quick missed-call callback';
    }
    if (entry.reason === 'call_tag_or_note') {
      return 'Added tag or note to a call';
    }
    return entry.label;
  };

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="achievements-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
        >
          <motion.div
            key="achievements-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Streaks, Score and Achievements"
            className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col max-h-[88dvh] overflow-hidden shadow-xl"
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                    <Trophy size={20} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-[#08246B] dark:text-white truncate">
                      Score, Streaks &amp; Badges
                    </h2>
                    <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                      General &amp; per-contact status · East Africa Time (UTC+3)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close achievements"
                  className="min-h-[40px] min-w-[40px] rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Segmented Tabs: General vs Contact Status */}
              <div
                role="tablist"
                aria-label="Achievements view"
                className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'general'}
                  onClick={() => {
                    triggerHaptic('tap');
                    setTab('general');
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                    tab === 'general'
                      ? 'bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white shadow-sm'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  <Trophy size={13} className={tab === 'general' ? 'text-[#FF6A00]' : ''} />
                  <span>General Score &amp; Badges</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'contacts'}
                  onClick={() => {
                    triggerHaptic('tap');
                    setTab('contacts');
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                    tab === 'contacts'
                      ? 'bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white shadow-sm'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  <Users size={13} className={tab === 'contacts' ? 'text-[#FF6A00]' : ''} />
                  <span>Contact Streaks ({topContactStatuses.length})</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto overscroll-contain space-y-5 flex-1 min-h-0">
              {tab === 'general' ? (
                <>
                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                      <p className="text-lg font-mono font-bold tabular-nums text-[#FF6A00]">
                        {score}
                      </p>
                      <p className="text-[11px] font-semibold text-[#08246B] dark:text-white">
                        General Score (pts)
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                      <p className="text-lg font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                        {effectiveStreaks.currentStreak}d
                      </p>
                      <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Daily Streak
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                      <p className="text-lg font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                        {effectiveStreaks.longestStreak}d
                      </p>
                      <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Longest Streak
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                      <p className="text-lg font-mono font-bold tabular-nums text-[#10B981]">
                        {earnedCount}/{BADGE_DEFINITIONS.length}
                      </p>
                      <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        General Badges
                      </p>
                    </div>
                  </div>

                  {/* Points Rules + Rebuild */}
                  <div className="rounded-2xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-[#08246B] dark:text-white">
                          How General Points Are Earned
                        </h3>
                        <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          Days follow East Africa Time (UTC+3)
                          {effectiveStreaks.lastActiveDate
                            ? ` · Last active ${effectiveStreaks.lastActiveDate}`
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('tap');
                          const rebuilt = rebuildScore();
                          showNotice(`Score rebuilt from local history: ${rebuilt} pts.`, 'success');
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                      >
                        <RefreshCw size={13} className="text-[#FF6A00]" />
                        Rebuild Score
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          First app open each day
                        </span>
                        <span className="font-mono font-bold text-[#FF6A00] shrink-0">
                          +{POINTS_CONFIG.DAILY_FIRST_OPEN}
                        </span>
                      </div>
                      <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          Missed call returned (&le;{reminderPrefs.missedCallReminderDelayMinutes}m)
                        </span>
                        <span className="font-mono font-bold text-[#FF6A00] shrink-0">
                          +{POINTS_CONFIG.QUICK_MISSED_CALLBACK}
                        </span>
                      </div>
                      <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          Adding a tag or note to a call
                        </span>
                        <span className="font-mono font-bold text-[#FF6A00] shrink-0">
                          +{POINTS_CONFIG.CALL_TAG_OR_NOTE}
                        </span>
                      </div>
                      <div className="rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          Usage milestones ({STREAK_BONUS_DAYS.join('/')}d) &amp; contact 3d+
                        </span>
                        <span className="font-mono font-bold text-[#FF6A00] shrink-0">
                          +{POINTS_CONFIG.STREAK_MILESTONE_BONUS} / +{CONTACT_POINTS_CONFIG.MILESTONE_BONUS[3]}+
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* General Badges */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-[#08246B] dark:text-white flex items-center gap-1.5">
                        <Award size={14} className="text-[#FF6A00]" />
                        General Badges ({earnedCount} earned · {BADGE_DEFINITIONS.length - earnedCount} locked)
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {BADGE_DEFINITIONS.map((def) => {
                        const unlocked = earnedMap.get(def.id);
                        const isEarned = Boolean(unlocked);
                        const unlockedDate = unlocked
                          ? new Date(unlocked.unlockedAt)
                          : null;
                        return (
                          <div
                            key={def.id}
                            className={`rounded-xl border p-3.5 flex items-start gap-3 transition-colors ${
                              isEarned
                                ? 'bg-[#FFF0E6]/55 dark:bg-[#FF6A00]/10 border-[#FF6A00]/45'
                                : 'bg-[#EEF2F6]/65 dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] opacity-80'
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                isEarned
                                  ? 'bg-white dark:bg-[var(--dark-surface)] border border-[#FF6A00]/30'
                                  : 'bg-white/70 dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)]'
                              }`}
                            >
                              <BadgeIcon icon={def.icon} earned={isEarned} />
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                                  {def.title}
                                </p>
                                {isEarned ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#10B981] shrink-0">
                                    <CheckCircle2 size={12} />
                                    Earned
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0">
                                    <Lock size={11} />
                                    Locked
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                {def.description}
                              </p>
                              <p className="text-[10px] font-mono tabular-nums text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                                {unlockedDate
                                  ? `Unlocked ${formatEthiopianShort(unlockedDate, calendarPrefs.defaultLang)} EC`
                                  : `Goal: ${def.requirementLabel}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Points History */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-[#08246B] dark:text-white">
                        Points History ({sortedHistory.length})
                      </h3>
                      <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Total: {score} pts
                      </span>
                    </div>

                    {sortedHistory.length === 0 ? (
                      <div className="rounded-xl bg-[#EEF2F6]/70 dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 text-center text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        No points recorded yet. Open the app daily, connect across consecutive days with contacts, tag or note calls, and return missed calls within {reminderPrefs.missedCallReminderDelayMinutes} minutes.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] overflow-hidden bg-white dark:bg-[var(--dark-canvas)]">
                        {sortedHistory.slice(0, 40).map((entry) => (
                          <div
                            key={entry.id}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-[#08246B] dark:text-white truncate">
                                {formatHistoryLabel(entry)}
                              </p>
                              <p className="text-[11px] font-mono tabular-nums text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                                {entry.eatDate} EAT · {formatEthiopianShort(new Date(entry.timestamp), calendarPrefs.defaultLang)} EC
                              </p>
                            </div>
                            <span className="font-mono font-bold tabular-nums text-[#FF6A00] shrink-0">
                              +{entry.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Contact Streaks Summary */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                      <p className="text-lg font-mono font-bold tabular-nums text-[#FF6A00]">
                        {contactSummary.activeStreaks}
                      </p>
                      <p className="text-[11px] font-semibold text-[#08246B] dark:text-white">
                        Active Streaks
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                      <p className="text-lg font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                        {contactSummary.reached3Plus}
                      </p>
                      <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        3+ Day Contacts
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 text-center">
                      <p className="text-lg font-mono font-bold tabular-nums text-[#10B981]">
                        {contactSummary.totalContactBadges}
                      </p>
                      <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Contact Badges
                      </p>
                    </div>
                  </div>

                  {/* Contact Milestone Badges Legend */}
                  <div className="rounded-2xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-2">
                    <h3 className="text-xs font-bold text-[#08246B] dark:text-white">
                      How Per-Contact Streaks &amp; Badges Work
                    </h3>
                    <p className="text-[11px] leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      A day counts with a contact when you have at least one incoming or outgoing call (East Africa Time UTC+3). Milestones unlock at{' '}
                      <span className="font-mono font-semibold text-[#08246B] dark:text-white">
                        {CONTACT_BADGE_DEFINITIONS.map((b) => `${b.days}d`).join(' · ')}
                      </span>
                      .
                    </p>
                  </div>

                  {/* Contact Status List */}
                  {topContactStatuses.length === 0 ? (
                    <div className="rounded-xl bg-[#EEF2F6]/70 dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 text-center text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      No contact streaks yet. Incoming or outgoing calls will start building streaks, scores, and badges for each contact.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] overflow-hidden bg-white dark:bg-[var(--dark-canvas)]">
                      {topContactStatuses.slice(0, 60).map((status) => {
                        const shownName = formatDisplayNameOrPhone(
                          status.displayName,
                          status.number,
                          privacyMode,
                        );
                        const shownNumber = maskPhoneNumber(status.number, privacyMode);
                        const earnedBadges = status.badges.filter((b) => b.earned);
                        const canOpen = Boolean(onSelectContact);
                        return (
                          <button
                            key={status.contactKey}
                            type="button"
                            disabled={!canOpen}
                            onClick={() => {
                              if (!onSelectContact) return;
                              triggerHaptic('tap');
                              onClose();
                              onSelectContact(status.number);
                            }}
                            className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors ${
                              canOpen
                                ? 'hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] cursor-pointer'
                                : 'cursor-default'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                style={{ backgroundColor: avatarColor(status.number) }}
                              >
                                {initials(shownName, status.number)}
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                                    {shownName}
                                  </p>
                                  {status.tag && (
                                    <span className="text-[10px] font-semibold text-[#FF6A00] shrink-0">
                                      · {status.tag}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] font-medium text-[#FF6A00] truncate">
                                  {status.statusHeadline}
                                </p>
                                <p className="text-[10px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                                  {shownNumber} · Best {status.longestStreak}d ·{' '}
                                  {earnedBadges.length > 0
                                    ? `Badges: ${earnedBadges.map((b) => `${b.days}d`).join(', ')}`
                                    : `${status.totalConnectedDays} connected day${status.totalConnectedDays === 1 ? '' : 's'}`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <p className="text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white flex items-center justify-end gap-1">
                                  <Flame
                                    size={12}
                                    className={
                                      status.currentStreak >= 3
                                        ? 'text-[#FF6A00]'
                                        : 'text-[#8A93A0]'
                                    }
                                  />
                                  <span>{status.currentStreak}d</span>
                                </p>
                                <p className="text-[11px] font-mono font-semibold tabular-nums text-[#FF6A00]">
                                  {status.contactScore} pts
                                </p>
                              </div>
                              {canOpen && (
                                <ChevronRight
                                  size={15}
                                  className="text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0"
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/80 dark:bg-[var(--dark-canvas)]/70 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
