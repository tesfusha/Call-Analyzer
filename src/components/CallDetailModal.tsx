import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Clock, FileText, Phone, Star, Trash2, User, X } from 'lucide-react';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import { DateTimePicker } from '@/src/components/DateTimePicker';
import { DEFAULT_RELATIONSHIP_TAGS } from '@/src/lib/contacts';
import { detectCarrier, estimateCallCostEtb, formatEtb, formatSimDisplay } from '@/src/lib/ethiopia';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { avatarColor, formatDateTime, formatDuration, initials } from '@/src/lib/format';
import { toDateTimeLocalValue, tomorrowAtHour } from '@/src/lib/schedule';
import { maskPhoneNumber } from '@/src/lib/security';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { CallPatch, CallRecord } from '@/src/types/call';

type CallModalCategory = 'details' | 'schedule';

export function CallDetailModal({
  call,
  isFavorite,
  onToggleFavorite,
  onClose,
  onSave,
  onDelete,
  onCallBack,
  onOpenContact,
}: {
  call: CallRecord | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  onSave: (patch: CallPatch) => void;
  onDelete: () => void;
  onCallBack: () => void;
  onOpenContact: (number: string) => void;
}) {
  const { tariffs, simLabels, privacyMode, scheduleCall } = useCalls();
  useLockBodyScroll(Boolean(call));
  const prefersReducedMotion = useReducedMotion();
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<CallModalCategory>('details');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(() =>
    toDateTimeLocalValue(Date.now() + 30 * 60_000),
  );
  const [scheduleNote, setScheduleNote] = useState('');

  useEffect(() => {
    if (!call) return;
    setActiveCategory('details');
    setName(call.name ?? '');
    setNote(call.note ?? '');
    setTag(call.tag ?? '');
    setConfirmDelete(false);
    setScheduleAt(toDateTimeLocalValue(Date.now() + 30 * 60_000));
    setScheduleNote(call.direction === 'missed' ? 'Return missed call' : '');
  }, [call]);

  useEffect(() => {
    if (!call) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [call, onClose]);

  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = 0;
    }
  }, [activeCategory, call]);

  const categories: Array<CategoryItem<CallModalCategory>> = [
    { key: 'details', label: 'Details & Tag', icon: FileText },
    { key: 'schedule', label: 'Schedule Callback', icon: Clock },
  ];

  const activeHeading =
    activeCategory === 'details' ? 'Edit Contact Tag & Call Note' : 'Schedule Follow-up Callback';

  const displayName = call ? call.name?.trim() || maskPhoneNumber(call.number, privacyMode) : '';

  return (
    <AnimatePresence>
      {call && (
        <motion.div
          key="call-detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
          onClick={onClose}
        >
          <motion.div
            key="call-detail-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col h-[82vh] sm:h-[580px] max-h-[90vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Call details for ${displayName}`}
          >
            {/* Pinned Header + Tabs */}
            <div className="shrink-0 p-5 pb-3.5 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenContact(call.number);
                  }}
                  className="flex items-center gap-3 min-w-0 text-left group"
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: avatarColor(call.number) }}
                  >
                    {initials(call.name, call.number)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-[#08246B] dark:text-white truncate group-hover:text-[#FF6A00] transition-colors">
                      {displayName}
                    </h2>
                    <p className="text-xs font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                      {maskPhoneNumber(call.number, privacyMode)}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenContact(call.number);
                    }}
                    aria-label={`Open ${displayName} contact details`}
                    className="min-h-[40px] px-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1 whitespace-nowrap"
                  >
                    <User size={14} className="text-[#FF6A00]" />
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
                  >
                    <Star
                      size={18}
                      className={isFavorite ? 'text-[#FF6A00] fill-[#FF6A00]' : 'text-[#8A93A0] dark:text-[var(--dark-text-secondary)]'}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close details"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] border-y border-[#DDE4EA] dark:border-[var(--dark-border)] py-2.5 tabular-nums">
                <span className="capitalize font-medium text-[#08246B] dark:text-white">{call.direction}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDuration(call.duration)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatDateTime(call.timestamp)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatEthiopianShort(call.timestamp)} EC</span>
                {call.sim && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{formatSimDisplay(call.sim, simLabels)}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{detectCarrier(call.number)}</span>
                {call.direction === 'outgoing' && call.duration > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#FF6A00] font-medium">
                      {formatEtb(estimateCallCostEtb(call, tariffs))}
                    </span>
                  </>
                )}
              </div>

              <CategoryTabs
                items={categories}
                activeKey={activeCategory}
                onChange={setActiveCategory}
                ariaLabel="Call detail categories"
                variant="inset"
              />
            </div>

            {/* Dedicated Scrollable Body */}
            <div ref={bodyScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5">
              <CategoryPanel activeKey={activeCategory} label={activeHeading} transitionStyle="fade">
                <div className="pb-2 border-b border-[#DDE4EA]/70 dark:border-[var(--dark-border)]">
                  <h3 className="text-sm font-bold text-[#08246B] dark:text-white">
                    {activeHeading}
                  </h3>
                </div>
                {activeCategory === 'details' && (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Contact name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional contact name"
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] dark:placeholder:text-[var(--dark-text-muted)] focus:outline-none focus:border-[#FF6A00]"
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Tag or Call Outcome
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    ...DEFAULT_RELATIONSHIP_TAGS,
                    'Follow up',
                    'Quoted ETB',
                    'Paid',
                    'Confirmed',
                    'Urgent',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTag(tag === preset ? '' : preset)}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        tag.toLowerCase() === preset.toLowerCase()
                          ? 'bg-[#FF6A00] text-white'
                          : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Family, Follow up, Paid..."
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] dark:placeholder:text-[var(--dark-text-muted)] focus:outline-none focus:border-[#FF6A00]"
                />
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Note
                </span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add call notes..."
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-sm text-[#08246B] dark:text-white placeholder:text-[#8A93A0] dark:placeholder:text-[var(--dark-text-muted)] focus:outline-none focus:border-[#FF6A00] resize-none"
                />
              </label>
            </div>
          )}

          {activeCategory === 'schedule' && (
            <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#08246B] dark:text-white">
                <Clock size={14} className="text-[#FF6A00]" />
                <span>
                  {call.direction === 'missed' ? 'Callback reminder' : 'Schedule follow-up call'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: 'In 15m', ts: () => Date.now() + 15 * 60_000 },
                  { label: 'In 1h', ts: () => Date.now() + 60 * 60_000 },
                  { label: 'Tomorrow 9 AM', ts: () => tomorrowAtHour(9) },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      scheduleCall({
                        number: call.number,
                        name: name.trim() || call.name,
                        scheduledFor: preset.ts(),
                        note:
                          scheduleNote ||
                          (call.direction === 'missed' ? 'Return missed call' : null),
                        sourceCallId: call.direction === 'missed' ? call.id : null,
                      });
                      onClose();
                    }}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Custom date &amp; time
                </span>
                <DateTimePicker
                  value={scheduleAt}
                  onChange={setScheduleAt}
                  variant="surface"
                  ariaLabel="Callback date and time"
                />
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Callback topic (optional)
                </span>
                <input
                  type="text"
                  value={scheduleNote}
                  onChange={(e) => setScheduleNote(e.target.value)}
                  placeholder="Topic or follow-up note..."
                  className="w-full rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white"
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const parsed = Date.parse(scheduleAt);
                    if (Number.isNaN(parsed)) return;
                    scheduleCall({
                      number: call.number,
                      name: name.trim() || call.name,
                      scheduledFor: parsed,
                      note: scheduleNote || null,
                      sourceCallId: call.direction === 'missed' ? call.id : null,
                    });
                    onClose();
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-xs font-semibold whitespace-nowrap"
                >
                  Set reminder
                </button>
              </div>
            </div>
          )}
        </CategoryPanel>
            </div>

            {/* Pinned Footer Actions */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/80 dark:bg-[var(--dark-canvas)]/70">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-[#DC2626] dark:text-[#F28B82] hover:bg-[#DC2626]/10 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onDelete}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-[#DC2626] text-white whitespace-nowrap shrink-0"
                >
                  Confirm delete
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onCallBack}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Phone size={15} />
                  Call back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSave({
                      name: name.trim() || null,
                      note: note.trim() || null,
                      tag: tag.trim() || null,
                    });
                    onClose();
                  }}
                  className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#E65F00] text-white whitespace-nowrap shrink-0 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
