import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Cake, CalendarPlus, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { CustomSelect } from '@/src/components/CustomSelect';
import { DEFAULT_RELATIONSHIP_TAGS, getContactKey } from '@/src/lib/contacts';
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
  const { contacts, upsertContactProfile, showNotice } = useCalls();
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

    const mergedEvents = existing
      ? [
          ...existing.events,
          ...events.filter(
            (evt) =>
              !existing.events.some(
                (old) => old.title === evt.title && old.month === evt.month && old.day === evt.day,
              ),
          ),
        ]
      : events;

    const profile: ContactProfile = {
      key,
      number: cleanNumber,
      name: name.trim() || existing?.name || cleanNumber,
      tag: tag.trim() || existing?.tag || '',
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

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Relationship tag
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {DEFAULT_RELATIONSHIP_TAGS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTag(tag === preset ? '' : preset)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    tag.toLowerCase() === preset.toLowerCase()
                      ? 'bg-[#FF6A00] text-white'
                      : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Custom tag..."
                className="flex-1 min-w-[110px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
              />
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

          {/* Special Events */}
          <div className="space-y-2 pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)]">
            <div className="flex items-center gap-2">
              <CalendarPlus size={15} className="text-[#FF6A00]" />
              <span className="text-xs font-semibold text-[#08246B] dark:text-white">
                Special events ({events.length})
              </span>
            </div>

            {events.length > 0 && (
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)]">
                {events.map((evt) => (
                  <div key={evt.id} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#08246B] dark:text-white font-medium truncate">
                      {evt.title} ·{' '}
                      <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                        {evt.calendar === 'ethiopian'
                          ? `${getEthiopianMonthName(evt.month, 'english')} ${evt.day} EC`
                          : `${GREGORIAN_MONTHS[evt.month - 1]} ${evt.day}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEvents((prev) => prev.filter((item) => item.id !== evt.id))}
                      aria-label={`Remove ${evt.title}`}
                      className="p-1 text-[#DC2626] dark:text-[#F28B82]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2">
              <input
                type="text"
                value={newEvtTitle}
                onChange={(e) => setNewEvtTitle(e.target.value)}
                placeholder="Event title (e.g. Anniversary)"
                className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-2 text-xs text-[#08246B] dark:text-white"
              />
              <CustomSelect
                ariaLabel="Event calendar"
                value={newEvtCalendar}
                variant="inset"
                compact
                options={[
                  { value: 'ethiopian', label: 'EC' },
                  { value: 'gregorian', label: 'GC' },
                ]}
                onChange={(val) => {
                  const nextCal = val as CalendarKind;
                  setNewEvtCalendar(nextCal);
                  if (nextCal === 'gregorian' && newEvtMonth > 12) setNewEvtMonth(12);
                }}
              />
              <CustomSelect
                ariaLabel="Event month"
                value={String(newEvtMonth)}
                variant="inset"
                compact
                options={Array.from({ length: maxEvtMonth }, (_, idx) => idx + 1).map((m) => ({
                  value: String(m),
                  label:
                    newEvtCalendar === 'ethiopian'
                      ? getEthiopianMonthName(m, 'english')
                      : GREGORIAN_MONTHS[m - 1],
                }))}
                onChange={(val) => setNewEvtMonth(Number(val))}
              />
              <input
                type="number"
                min={1}
                max={newEvtCalendar === 'ethiopian' ? 30 : 31}
                value={newEvtDay}
                onChange={(e) => setNewEvtDay(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Event day"
                className="w-16 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-2.5 py-2 text-xs font-mono tabular-nums text-[#08246B] dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddEvent}
                className="min-h-[38px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#FF6A00] hover:text-white flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>

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
