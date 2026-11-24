import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Award, Check, Download, Flame, Share2, ShieldCheck, Trophy, X } from 'lucide-react';
import { triggerHaptic } from '@/src/lib/haptics';
import {
  downloadMilestoneCardPng,
  drawMilestoneCardCanvas,
  looksLikePhoneNumber,
  shareMilestoneCardImage,
} from '@/src/lib/milestoneShare';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { ContactMilestoneRecord } from '@/src/types/call';

export function ContactMilestoneModal({
  milestone,
  onClose,
}: {
  milestone: ContactMilestoneRecord | null;
  onClose: () => void;
}) {
  useLockBodyScroll(Boolean(milestone));
  const prefersReducedMotion = useReducedMotion();
  const { contactStatuses, contacts, showNotice } = useCalls();

  // Off by default per privacy requirement: never include phone number or real name unless opted in
  const [includeName, setIncludeName] = useState(false);
  const [nickname, setNickname] = useState('');
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const contactStatus = milestone ? contactStatuses[milestone.contactKey] ?? null : null;
  const contactProfile = milestone ? contacts[milestone.contactKey] ?? null : null;

  const relationshipTag = useMemo(() => {
    return (contactProfile?.tag || contactStatus?.tag || '').trim();
  }, [contactProfile?.tag, contactStatus?.tag]);

  const rawSavedName = useMemo(() => {
    const candidate = (contactProfile?.name || contactStatus?.displayName || '').trim();
    if (!candidate || looksLikePhoneNumber(candidate)) return '';
    return candidate;
  }, [contactProfile?.name, contactStatus?.displayName]);

  const headerContactLabel = useMemo(() => {
    if (!milestone) return '';
    const rawDisplay = contactProfile?.name || contactStatus?.displayName || milestone.contactKey;
    const rawNum = contactProfile?.number || contactStatus?.number || milestone.contactKey;
    return formatDisplayNameOrPhone(rawDisplay, rawNum);
  }, [contactProfile?.name, contactProfile?.number, contactStatus?.displayName, contactStatus?.number, milestone]);

  useEffect(() => {
    if (!milestone) return;
    setIncludeName(false);
    setNickname('');
  }, [milestone?.id]);

  useEffect(() => {
    if (!milestone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [milestone, onClose]);

  useBackHandler({
    id: 'contact-milestone-modal',
    active: Boolean(milestone),
    priority: 75,
    onBack: onClose,
  });

  useEffect(() => {
    if (!milestone || !canvasRef.current) return;
    drawMilestoneCardCanvas(canvasRef.current, {
      milestoneDays: milestone.days,
      milestoneTitle: milestone.badgeTitle,
      reachedDate: milestone.reachedDate,
      pointsAwarded: milestone.points,
      includeName,
      contactName: rawSavedName,
      nickname,
      relationshipTag,
    });
  }, [milestone, includeName, rawSavedName, nickname, relationshipTag]);

  const handleShare = async () => {
    if (!milestone || !canvasRef.current || sharing) return;
    triggerHaptic('tap');
    setSharing(true);
    try {
      drawMilestoneCardCanvas(canvasRef.current, {
        milestoneDays: milestone.days,
        milestoneTitle: milestone.badgeTitle,
        reachedDate: milestone.reachedDate,
        pointsAwarded: milestone.points,
        includeName,
        contactName: rawSavedName,
        nickname,
        relationshipTag,
      });
      const filename = `call-analyzer-${milestone.days}d-milestone.png`;
      const result = await shareMilestoneCardImage(canvasRef.current, {
        filename,
        title: `${milestone.badgeTitle} — ${milestone.days} Days`,
        text: `Unlocked ${milestone.badgeTitle} (${milestone.days} consecutive days, +${milestone.points} pts) on Call Analyzer - ETH.`,
      });
      if (result === 'capacitor-share' || result === 'web-share') {
        showNotice('Milestone card shared.', 'success');
      } else if (result === 'downloaded') {
        showNotice('Milestone card PNG saved.', 'success');
      }
    } catch {
      showNotice('Could not share milestone card.');
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = async () => {
    if (!milestone || !canvasRef.current || saving) return;
    triggerHaptic('tap');
    setSaving(true);
    try {
      drawMilestoneCardCanvas(canvasRef.current, {
        milestoneDays: milestone.days,
        milestoneTitle: milestone.badgeTitle,
        reachedDate: milestone.reachedDate,
        pointsAwarded: milestone.points,
        includeName,
        contactName: rawSavedName,
        nickname,
        relationshipTag,
      });
      const delivery = await downloadMilestoneCardPng(
        canvasRef.current,
        `call-analyzer-${milestone.days}d-milestone.png`,
      );
      showNotice(
        delivery === 'native'
          ? 'PNG saved to Pictures/Call Analyzer - ETH.'
          : 'Milestone card image saved.',
        'success',
      );
    } catch {
      showNotice('Could not save milestone card image.', 'warning');
    } finally {
      setSaving(false);
    }
  };

  const canIncludeRealName = Boolean(rawSavedName);

  const modalContent = (
    <AnimatePresence>
      {milestone && (
        <motion.div
          key="contact-milestone-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/60 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
        >
          <motion.div
            key="contact-milestone-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${milestone.badgeTitle} celebration`}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col max-h-[92dvh] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/20 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Trophy size={21} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#FF6A00] tabular-nums">
                    {milestone.days}-Day Streak Milestone · {milestone.reachedDate} EAT
                  </p>
                  <h2 className="text-base font-bold text-[#08246B] dark:text-white truncate">
                    You made {milestone.days} days!
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close milestone celebration"
                className="min-h-[44px] min-w-[44px] rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
              {/* Earned Points & Badge Summary */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#DDE4EA] dark:border-[var(--dark-border)]">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-bold text-[#08246B] dark:text-white truncate">
                    {milestone.badgeTitle}
                  </p>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                    Status with {headerContactLabel}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold tabular-nums text-[#FF6A00] flex items-center justify-end gap-1">
                    <Flame size={14} />
                    <span>+{milestone.points} pts</span>
                  </p>
                  <p className="text-[11px] text-[#10B981] font-semibold flex items-center justify-end gap-1">
                    <Award size={12} />
                    <span>Badge unlocked</span>
                  </p>
                </div>
              </div>

              {/* Canvas Share Card Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#08246B] dark:text-white">
                    Share Card Preview
                  </span>
                  <span className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] flex items-center gap-1">
                    <ShieldCheck size={12} className="text-[#10B981] shrink-0" />
                    <span>Phone number never shown</span>
                  </span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#0D1B3E] flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    className="w-full max-w-[320px] aspect-square block"
                    aria-label={`${milestone.badgeTitle} share card preview`}
                  />
                </div>
              </div>

              {/* Card Customization & Privacy Toggle */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                      Include name
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      {!rawSavedName
                        ? 'No saved contact name — using tag or nickname instead'
                        : 'Off by default so the shared image stays private'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeName}
                    aria-label="Include contact name on share card"
                    disabled={!canIncludeRealName}
                    onClick={() => {
                      triggerHaptic('tap');
                      setIncludeName((prev) => !prev);
                    }}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-45 ${
                      includeName && canIncludeRealName
                        ? 'bg-[#FF6A00]'
                        : 'bg-[#DDE4EA] dark:bg-[var(--dark-border)]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        includeName && canIncludeRealName ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Nickname or relationship label (optional)
                  </span>
                  <input
                    type="text"
                    maxLength={36}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={
                      relationshipTag
                        ? `${relationshipTag} Connection`
                        : 'e.g. Best Friend, Mom, Team Partner'
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                  />
                </label>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/85 dark:bg-[var(--dark-canvas)]/75 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDownload()}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Download size={14} className="text-[#FF6A00]" />
                <span>{saving ? 'Saving…' : 'Save PNG'}</span>
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <Check size={14} />
                  <span>Done</span>
                </button>
                <button
                  type="button"
                  disabled={sharing}
                  onClick={() => void handleShare()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <Share2 size={14} />
                  <span>{sharing ? 'Sharing…' : 'Share Card'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
