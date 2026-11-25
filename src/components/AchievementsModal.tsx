import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  Flame,
  Lock,
  PhoneCall,
  RefreshCw,
  Share2,
  Sparkles,
  Tag,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { ContactMilestoneModal } from '@/src/components/ContactMilestoneModal';
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
import { buildContactMilestoneShareRecord } from '@/src/lib/milestoneShare';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { ContactMilestoneRecord } from '@/src/types/call';

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
  useBackHandler({
    id: 'achievements-modal',
    active: open,
    priority: 55,
    onBack: onClose,
  });
  const prefersReducedMotion = useReducedMotion();
  const {
    effectiveStreaks,
    score,
    badges,
    pointsHistory,
    topContactStatuses,
    contactMilestones,
    rebuildScore,
    calendarPrefs,
    reminderPrefs,
    showNotice,
  } = useCalls();

const INITIAL_LIST_LIMIT = 8;
const LIST_PAGE_STEP = 12;

  const [tab, setTab] = useState<'general' | 'contacts'>(initialTab);
  const [pointsLimit, setPointsLimit] = useState(INITIAL_LIST_LIMIT);
  const [contactsLimit, setContactsLimit] = useState(INITIAL_LIST_LIMIT);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [expandedContacts, setExpandedContacts] = useState<Record<string, boolean>>({});
  const [shareMilestone, setShareMilestone] = useState<ContactMilestoneRecord | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setPointsLimit(INITIAL_LIST_LIMIT);
      setContactsLimit(INITIAL_LIST_LIMIT);
      setHowItWorksOpen(false);
      setExpandedContacts({});
      setShareMilestone(null);
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

  const formatHistoryLabel = (entry: (typeof sortedHistory)[number]) => entry.label;

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
                      <div className="space-y-2">
                        <div className="rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] overflow-hidden bg-white dark:bg-[var(--dark-canvas)]">
                          {sortedHistory.slice(0, pointsLimit).map((entry) => (
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

                        {sortedHistory.length > INITIAL_LIST_LIMIT && (
                          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                            <span className="text-[11px] font-mono tabular-nums text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                              Showing {Math.min(pointsLimit, sortedHistory.length)} of {sortedHistory.length}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {pointsLimit < sortedHistory.length && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('tap');
                                      setPointsLimit((prev) =>
                                        Math.min(sortedHistory.length, prev + LIST_PAGE_STEP),
                                      );
                                    }}
                                    className="min-h-[34px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#FF6A00] hover:border-[#FF6A00] transition-colors"
                                  >
                                    Show more (+{Math.min(LIST_PAGE_STEP, sortedHistory.length - pointsLimit)})
                                  </button>
                                  {sortedHistory.length - pointsLimit > LIST_PAGE_STEP && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        triggerHaptic('tap');
                                        setPointsLimit(sortedHistory.length);
                                      }}
                                      className="min-h-[34px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] transition-colors"
                                    >
                                      Show all
                                    </button>
                                  )}
                                </>
                              )}
                              {pointsLimit > INITIAL_LIST_LIMIT && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('tap');
                                    setPointsLimit(INITIAL_LIST_LIMIT);
                                  }}
                                  className="min-h-[34px] px-2.5 rounded-xl text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00] transition-colors"
                                >
                                  Show less
                                </button>
                              )}
                            </div>
                          </div>
                        )}
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

                  {/* Contact Milestone Badges Legend (Collapsible) */}
                  <div className="rounded-2xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={howItWorksOpen}
                      onClick={() => {
                        triggerHaptic('tap');
                        setHowItWorksOpen((prev) => !prev);
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-[#EEF2F6]/70 dark:hover:bg-[var(--dark-elevated)]/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-[#08246B] dark:text-white">
                          How Per-Contact Streaks &amp; Badges Work
                        </h3>
                        {!howItWorksOpen && (
                          <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                            Daily EAT calls · Milestones: {CONTACT_BADGE_DEFINITIONS.map((b) => `${b.days}d`).join(' · ')}
                          </p>
                        )}
                      </div>
                      <ChevronDown
                        size={15}
                        className={`text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0 transition-transform duration-200 ${
                          howItWorksOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {howItWorksOpen && (
                        <motion.div
                          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3.5 pt-1 border-t border-[#DDE4EA]/70 dark:border-[var(--dark-border)]">
                            <p className="text-[11px] leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              A day counts with a contact when you have at least one incoming or outgoing call (East Africa Time UTC+3). Milestones unlock at{' '}
                              <span className="font-mono font-semibold text-[#08246B] dark:text-white">
                                {CONTACT_BADGE_DEFINITIONS.map((b) => `${b.days}d`).join(' · ')}
                              </span>
                              .
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Contact Status List */}
                  {topContactStatuses.length === 0 ? (
                    <div className="rounded-xl bg-[#EEF2F6]/70 dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 text-center text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      No contact streaks yet. Incoming or outgoing calls will start building streaks, scores, and badges for each contact.
                    </div>
                  ) : (() => {
                    const visibleStatuses = topContactStatuses.slice(0, contactsLimit);
                    const allVisibleExpanded =
                      visibleStatuses.length > 0 &&
                      visibleStatuses.every((s) => Boolean(expandedContacts[s.contactKey]));
                    return (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <h3 className="text-xs font-bold text-[#08246B] dark:text-white">
                          Individual Contact Status ({topContactStatuses.length})
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            if (allVisibleExpanded) {
                              setExpandedContacts({});
                            } else {
                              const next: Record<string, boolean> = {};
                              visibleStatuses.forEach((s) => {
                                next[s.contactKey] = true;
                              });
                              setExpandedContacts(next);
                            }
                          }}
                          className="min-h-[28px] px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[11px] font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] transition-colors"
                        >
                          {allVisibleExpanded ? 'Collapse all' : 'Expand all'}
                        </button>
                      </div>

                      <div className="rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] overflow-hidden bg-white dark:bg-[var(--dark-canvas)]">
                        {visibleStatuses.map((status) => {
                          const shownName = formatDisplayNameOrPhone(
                            status.displayName,
                            status.number,
                          );
                          const shownNumber = status.number;
                          const earnedBadges = status.badges.filter((b) => b.earned);
                          const canOpen = Boolean(onSelectContact);
                          const isExpanded = Boolean(expandedContacts[status.contactKey]);
                          return (
                            <div key={status.contactKey} className="bg-white dark:bg-[var(--dark-canvas)]">
                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                onClick={() => {
                                  triggerHaptic('tap');
                                  setExpandedContacts((prev) => ({
                                    ...prev,
                                    [status.contactKey]: !prev[status.contactKey],
                                  }));
                                }}
                                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
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
                                      {earnedBadges.length}/{status.badges.length} badges · {status.totalConnectedDays} connected day{status.totalConnectedDays === 1 ? '' : 's'}
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
                                  <ChevronDown
                                    size={15}
                                    className={`text-[#8A93A0] dark:text-[var(--dark-text-muted)] shrink-0 transition-transform duration-200 ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                </div>
                              </button>

                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                    transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-4 pb-3.5 pt-2.5 border-t border-[#DDE4EA]/70 dark:border-[var(--dark-border)] bg-[#F5F7FA]/65 dark:bg-[var(--dark-surface)]/45 space-y-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                        <span className="font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                          {shownNumber}
                                        </span>
                                        <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                                          {status.statusSubtext}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] py-2 text-center">
                                        <div>
                                          <p className="text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                                            {status.currentStreak}d
                                          </p>
                                          <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                            Current Streak
                                          </p>
                                        </div>
                                        <div className="border-x border-[#DDE4EA] dark:border-[var(--dark-border)]">
                                          <p className="text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                                            {status.longestStreak}d
                                          </p>
                                          <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                            Best Streak
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                                            {status.totalConnectedDays}d
                                          </p>
                                          <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                            Connected Days
                                          </p>
                                        </div>
                                      </div>

                                      {status.nextMilestoneDays !== null && (
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                                            <span>Next goal: {status.nextMilestoneDays}-Day Badge</span>
                                            <span className="font-mono font-semibold text-[#08246B] dark:text-white">
                                              {Math.min(status.currentStreak, status.nextMilestoneDays)}/{status.nextMilestoneDays}d
                                            </span>
                                          </div>
                                          <div className="h-1.5 w-full rounded-full bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA]/60 dark:border-[var(--dark-border)] overflow-hidden">
                                            <div
                                              className="h-full rounded-full bg-[#FF6A00] transition-all duration-200"
                                              style={{
                                                width: `${Math.min(
                                                  100,
                                                  Math.round(
                                                    (status.currentStreak / status.nextMilestoneDays) * 100,
                                                  ),
                                                )}%`,
                                              }}
                                            />
                                          </div>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-4 gap-1.5">
                                        {status.badges.map((badge) => {
                                          const badgeShareRecord = badge.earned
                                            ? buildContactMilestoneShareRecord(
                                                status,
                                                contactMilestones,
                                                badge,
                                              )
                                            : null;
                                          return (
                                            <button
                                              key={badge.id}
                                              type="button"
                                              disabled={!badgeShareRecord}
                                              onClick={() => {
                                                if (!badgeShareRecord) return;
                                                triggerHaptic('tap');
                                                setShareMilestone(badgeShareRecord);
                                              }}
                                              className={`rounded-lg border px-2 py-1.5 text-center transition-colors ${
                                                badge.earned
                                                  ? 'bg-white dark:bg-[var(--dark-surface)] border-[#FF6A00]/45 hover:border-[#FF6A00]'
                                                  : 'bg-white/50 dark:bg-[var(--dark-surface)]/40 border-[#DDE4EA] dark:border-[var(--dark-border)] opacity-65 cursor-default'
                                              }`}
                                            >
                                              <div className="flex items-center justify-center gap-1">
                                                <span className="text-[11px] font-mono font-bold tabular-nums text-[#08246B] dark:text-white">
                                                  {badge.days}d
                                                </span>
                                                {badge.earned ? (
                                                  <CheckCircle2 size={10} className="text-[#10B981] shrink-0" />
                                                ) : (
                                                  <Lock size={9} className="text-[#8A93A0] shrink-0" />
                                                )}
                                              </div>
                                              <p className="text-[9px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                                                {badge.title}
                                              </p>
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {(() => {
                                        const shareRecord = buildContactMilestoneShareRecord(
                                          status,
                                          contactMilestones,
                                        );
                                        if (!shareRecord && !canOpen) return null;
                                        return (
                                          <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
                                            {shareRecord && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  triggerHaptic('tap');
                                                  setShareMilestone(shareRecord);
                                                }}
                                                className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] hover:border-[#FF6A00] text-[#08246B] dark:text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                                              >
                                                <Share2 size={13} className="text-[#FF6A00] shrink-0" />
                                                <span>Share Card</span>
                                              </button>
                                            )}
                                            {canOpen && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!onSelectContact) return;
                                                  triggerHaptic('tap');
                                                  onClose();
                                                  onSelectContact(status.number);
                                                }}
                                                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                                              >
                                                <span>Open Contact</span>
                                                <ChevronRight size={14} />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>

                      {topContactStatuses.length > INITIAL_LIST_LIMIT && (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                          <span className="text-[11px] font-mono tabular-nums text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                            Showing {Math.min(contactsLimit, topContactStatuses.length)} of {topContactStatuses.length}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {contactsLimit < topContactStatuses.length && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('tap');
                                    setContactsLimit((prev) =>
                                      Math.min(topContactStatuses.length, prev + LIST_PAGE_STEP),
                                    );
                                  }}
                                  className="min-h-[34px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#FF6A00] hover:border-[#FF6A00] transition-colors"
                                >
                                  Show more (+{Math.min(LIST_PAGE_STEP, topContactStatuses.length - contactsLimit)})
                                </button>
                                {topContactStatuses.length - contactsLimit > LIST_PAGE_STEP && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('tap');
                                      setContactsLimit(topContactStatuses.length);
                                    }}
                                    className="min-h-[34px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] transition-colors"
                                  >
                                    Show all
                                  </button>
                                )}
                              </>
                            )}
                            {contactsLimit > INITIAL_LIST_LIMIT && (
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('tap');
                                  setContactsLimit(INITIAL_LIST_LIMIT);
                                }}
                                className="min-h-[34px] px-2.5 rounded-xl text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#FF6A00] transition-colors"
                              >
                                Show less
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })()}
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

  if (typeof document === 'undefined') {
    return (
      <>
        {modalContent}
        <ContactMilestoneModal
          milestone={shareMilestone}
          onClose={() => setShareMilestone(null)}
        />
      </>
    );
  }
  return (
    <>
      {createPortal(modalContent, document.body)}
      <ContactMilestoneModal
        milestone={shareMilestone}
        onClose={() => setShareMilestone(null)}
      />
    </>
  );
}
