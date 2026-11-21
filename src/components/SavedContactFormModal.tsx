import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Cake, Check, Plus, Tag, UserPlus, X } from 'lucide-react';
import { CustomSelect } from '@/src/components/CustomSelect';
import { SpecialEventsEditor } from '@/src/components/SpecialEventsEditor';
import { getContactKey, mergeTagOptions } from '@/src/lib/contacts';
import { getEthiopianMonthName } from '@/src/lib/ethiopianCalendar';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type {
  CalendarKind,
  ContactBirthday,
  ContactEvent,
  ContactProfile,
} from '@/src/types/call';

const GREGORIAN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function SavedContactFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (profile: ContactProfile) => void;
}) {
  const { contacts, availableTags, addCustomTag, upsertContactProfile, showNotice } = useCalls();
  useLockBodyScroll(open);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [tag, setTag] = useState('');
  const [notes, setNotes] = useState('');
  const [hasBirthday, setHasBirthday] = useState(false);
  const [bdayCalendar, setBdayCalendar] = useState<CalendarKind>('ethiopian');
  const [bdayMonth, setBdayMonth] = useState(1);
  const [bdayDay, setBdayDay] = useState(1);
  const [bdayYear, setBdayYear] = useState('');
  const [events, setEvents] = useState<ContactEvent[]>([]);
  const [newEvtTitle, setNewEvtTitle] = useState('');
  const [newEvtCalendar, setNewEvtCalendar] = useState<CalendarKind>('ethiopian');
  const [newEvtMonth, setNewEvtMonth] = useState(1);
  const [newEvtDay, setNewEvtDay] = useState(1);

  const maxBdayMonth = bdayCalendar === 'ethiopian' ? 13 : 12;
  const maxEvtMonth = newEvtCalendar === 'ethiopian' ? 13 : 12;

  const resetForm = () => {
    setName('');
    setNumber('');
    setTag('');
    setNotes('');
    setHasBirthday(false);
    setBdayCalendar('ethiopian');
    setBdayMonth(1);
    setBdayDay(1);
    setBdayYear('');
    setEvents([]);
    setNewEvtTitle('');
  };

  const handleAddEvent = () => {
    if (!newEvtTitle.trim()) return;
    setEvents((prev) => [
      ...prev,
      {
        id: `evt-${Date.now()}-${prev.length + 1}`,
        title: newEvtTitle.trim(),
        calendar: newEvtCalendar,
        month: Math.max(1, Math.min(maxEvtMonth, newEvtMonth)),
        day: Math.max(1, Math.min(newEvtCalendar === 'ethiopian' ? 30 : 31, newEvtDay)),
      },
    ]);
    setNewEvtTitle('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = number.trim();
    if (!cleanNumber) {
      showNotice('Enter a phone number.');
      return;
    }

    const key = getContactKey(cleanNumber);
    const existing = contacts[key];
    const birthday: ContactBirthday | null = hasBirthday
      ? {
          calendar: bdayCalendar,
          month: Math.max(1, Math.min(maxBdayMonth, bdayMonth)),
          day: Math.max(1, Math.min(bdayCalendar === 'ethiopian' ? 30 : 31, bdayDay)),
          year: bdayYear.trim() ? Number(bdayYear) || undefined : undefined,
        }
      : existing?.birthday ?? null;

    const pendingDraftEvent: ContactEvent[] = newEvtTitle.trim()
      ? [
          {
            id: `evt-${Date.now()}-${events.length + 1}`,
            title: newEvtTitle.trim(),
            calendar: newEvtCalendar,
            month: Math.max(1, Math.min(maxEvtMonth, newEvtMonth)),
            day: Math.max(1, Math.min(newEvtCalendar === 'ethiopian' ? 30 : 31, newEvtDay)),
          },
        ]
      : [];

    const combinedEvents = [...events, ...pendingDraftEvent];

    const mergedEvents = existing
      ? [
          ...existing.events,
          ...combinedEvents.filter(
            (evt) =>
              !existing.events.some(
                (old) => old.title === evt.title && old.month === evt.month && old.day === evt.day,
              ),
          ),
        ]
      : combinedEvents;

    const cleanTag = tag.trim() || existing?.tag || '';
    if (cleanTag) addCustomTag(cleanTag);

    const profile: ContactProfile = {
      key,
      number: cleanNumber,
      name: name.trim() || existing?.name || cleanNumber,
      tag: cleanTag,
      birthday,
      events: mergedEvents,
      notes: notes.trim() || existing?.notes || '',
      updatedAt: Date.now(),
    };

    upsertContactProfile(profile);
    showNotice(`Saved ${profile.name} to contacts.`);
    onSaved?.(profile);
    resetForm();
    onClose();
  };

  const displayedTags = useMemo(
    () => mergeTagOptions(availableTags, tag.trim() ? [tag.trim()] : []),
    [availableTags, tag],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="saved-contact-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
          onClick={onClose}
        >
          <motion.div
            key="saved-contact-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4 max-h-[92vh] overflow-y-auto overscroll-contain shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Add saved contact"
          >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#08246B] dark:text-white">
                Add saved contact
              </h2>
              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Save for call scheduling, birthdays, and Ethiopian holiday wishes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add contact form"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Full name
              </span>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Selamawit Abebe"
                className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Phone number *
              </span>
              <input
                type="tel"
                required
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="+251911..."
                className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-sm font-mono text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Relationship / role tag
              </span>
              {tag.trim() ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF6A00]">
                  <Tag size={12} className="shrink-0" />
                  <span>Selected: {tag.trim()}</span>
                </span>
              ) : (
                <span className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                  Optional
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {displayedTags.map((preset) => {
                const selected = tag.trim().toLowerCase() === preset.toLowerCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTag(selected ? '' : preset)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                      selected
                        ? 'bg-[#FF6A00] text-white'
                        : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white'
                    }`}
                  >
                    <Tag size={11} className="shrink-0" />
                    <span>{preset}</span>
                    {selected && <Check size={11} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tag.trim()) {
                    e.preventDefault();
                    const saved = addCustomTag(tag);
                    if (saved) setTag(saved);
                  }
                }}
                placeholder="Type custom tag (e.g. Graphics Designer)..."
                className="flex-1 min-w-0 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
              />
              <button
                type="button"
                disabled={!tag.trim()}
                onClick={() => {
                  const saved = addCustomTag(tag);
                  if (saved) setTag(saved);
                }}
                className="min-h-[38px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] disabled:opacity-45 text-xs font-semibold text-[#FF6A00] flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Plus size={13} />
                Add tag
              </button>
            </div>
          </div>

          {/* Birthday */}
          <div className="space-y-2 pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cake size={15} className="text-[#FF6A00]" />
                <span className="text-xs font-semibold text-[#08246B] dark:text-white">
                  Birthday reminder
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHasBirthday((prev) => !prev)}
                className="min-h-[36px] px-3 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-xs font-semibold text-[#08246B] dark:text-white whitespace-nowrap"
              >
                {hasBirthday ? 'Remove' : 'Set birthday'}
              </button>
            </div>

            {hasBirthday && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <CustomSelect
                  ariaLabel="Birthday calendar system"
                  value={bdayCalendar}
                  variant="inset"
                  fullWidth
                  compact
                  options={[
                    { value: 'ethiopian', label: 'Ethiopian' },
                    { value: 'gregorian', label: 'Gregorian' },
                  ]}
                  onChange={(val) => {
                    const nextCal = val as CalendarKind;
                    setBdayCalendar(nextCal);
                    if (nextCal === 'gregorian' && bdayMonth > 12) setBdayMonth(12);
                  }}
                />
                <CustomSelect
                  ariaLabel="Birthday month"
                  value={String(bdayMonth)}
                  variant="inset"
                  fullWidth
                  compact
                  options={Array.from({ length: maxBdayMonth }, (_, idx) => idx + 1).map((m) => ({
                    value: String(m),
                    label:
                      bdayCalendar === 'ethiopian'
                        ? getEthiopianMonthName(m, 'english')
                        : GREGORIAN_MONTHS[m - 1],
                  }))}
                  onChange={(val) => setBdayMonth(Number(val))}
                />
                <input
                  type="number"
                  min={1}
                  max={bdayCalendar === 'ethiopian' ? 30 : 31}
                  value={bdayDay}
                  onChange={(e) => setBdayDay(Math.max(1, Number(e.target.value) || 1))}
                  aria-label="Birthday day"
                  placeholder="Day"
                  className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-2 text-xs font-mono tabular-nums text-[#08246B] dark:text-white"
                />
                <input
                  type="number"
                  value={bdayYear}
                  onChange={(e) => setBdayYear(e.target.value)}
                  aria-label="Birth year optional"
                  placeholder="Year (opt.)"
                  className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-2 text-xs font-mono tabular-nums text-[#08246B] dark:text-white"
                />
              </div>
            )}
          </div>

          <SpecialEventsEditor
            events={events}
            onRemoveEvent={(id) => setEvents((prev) => prev.filter((item) => item.id !== id))}
            newTitle={newEvtTitle}
            onNewTitleChange={setNewEvtTitle}
            newCalendar={newEvtCalendar}
            onNewCalendarChange={setNewEvtCalendar}
            newMonth={newEvtMonth}
            onNewMonthChange={setNewEvtMonth}
            newDay={newEvtDay}
            onNewDayChange={setNewEvtDay}
            onAddEvent={handleAddEvent}
            variant="inset"
          />

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Notes
            </span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context for wishes, callbacks, or work..."
              className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white resize-none focus:outline-none focus:border-[#FF6A00]"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap"
            >
              Save contact
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
