import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Clock, Search, X } from 'lucide-react';
import { getContactKey } from '@/src/lib/contacts';
import { toDateTimeLocalValue, tomorrowAtHour } from '@/src/lib/schedule';
import { maskPhoneNumber } from '@/src/lib/security';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { ContactProfile } from '@/src/types/call';

export function QuickScheduleModal({
  contact,
  open = false,
  onClose,
}: {
  contact: ContactProfile | null;
  open?: boolean;
  onClose: () => void;
}) {
  const { contacts, privacyMode, scheduleCall, showNotice } = useCalls();

  const [contactQuery, setContactQuery] = useState('');
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() =>
    toDateTimeLocalValue(Date.now() + 60 * 60_000),
  );
  const [note, setNote] = useState('');

  const isVisible = Boolean(contact) || open;
  useLockBodyScroll(isVisible);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isVisible) return;
    setScheduledAt(toDateTimeLocalValue(Date.now() + 60 * 60_000));
    setNote('');
    setContactQuery('');
    if (contact) {
      setNumber(contact.number);
      setName(contact.name);
    } else {
      setNumber('');
      setName('');
    }
  }, [contact, isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isVisible, onClose]);

  const savedContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    const list = Object.values(contacts);
    const filtered = !q
      ? list
      : list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.number.toLowerCase().includes(q) ||
            c.tag.toLowerCase().includes(q),
        );
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    return filtered.slice(0, 60).sort((a, b) => collator.compare(a.name, b.name));
  }, [contacts, contactQuery]);

  const targetNumber = (contact ? contact.number : number).trim();
  const targetName = (contact ? contact.name : name).trim();

  const schedulePreset = (timestamp: number) => {
    if (!targetNumber) {
      showNotice('Enter a phone number or pick a contact first.');
      return;
    }
    scheduleCall({
      number: targetNumber,
      name: targetName || null,
      scheduledFor: timestamp,
      note: note.trim() || null,
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Date.parse(scheduledAt);
    if (Number.isNaN(parsed)) {
      showNotice('Choose a valid date and time.');
      return;
    }
    schedulePreset(parsed);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="quick-schedule-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
          onClick={onClose}
        >
          <motion.div
            key="quick-schedule-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={contact ? `Schedule call with ${contact.name}` : 'Schedule new call'}
          >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[#08246B] dark:text-white truncate">
                {contact ? `Schedule call with ${contact.name}` : 'Schedule new call'}
              </h2>
              {contact ? (
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] font-mono tabular-nums truncate">
                  {maskPhoneNumber(contact.number, privacyMode)}
                  {contact.tag ? ` · ${contact.tag}` : ''}
                </p>
              ) : (
                <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Pick a saved contact or enter a number
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close schedule dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
          >
            <X size={18} />
          </button>
        </div>

        {!contact && Object.keys(contacts).length > 0 && (
          <div className="space-y-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
              />
              <input
                type="search"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search saved contacts..."
                className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] pl-8 pr-3 py-2 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
              />
            </div>
            <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1.5">
              {savedContacts.length === 0 ? (
                <span className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                  No saved contacts match.
                </span>
              ) : (
                savedContacts.slice(0, 12).map((c) => {
                  const selected =
                    getContactKey(number) === c.key && number.trim() !== '';
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setNumber(c.number);
                        setName(c.name);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        selected
                          ? 'bg-[#FF6A00] border-[#FF6A00] text-white'
                          : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {!contact && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs font-mono text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Contact name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional name"
                  className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                />
              </label>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Quick presets
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: 'In 15m', ts: () => Date.now() + 15 * 60_000 },
                { label: 'In 1h', ts: () => Date.now() + 60 * 60_000 },
                { label: 'Tomorrow 9 AM', ts: () => tomorrowAtHour(9) },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => schedulePreset(preset.ts())}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Date & time
            </span>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-xs font-mono text-[#08246B] dark:text-white"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Topic / reminder note (optional)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Confirm holiday plans or follow-up"
              className="w-full rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5 text-xs text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
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
              Save schedule
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
