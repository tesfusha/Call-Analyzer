import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Clock, Search, X } from 'lucide-react';
import { SimpleScheduleTimePicker } from '@/src/components/SimpleScheduleTimePicker';
import { avatarColor, initials } from '@/src/lib/format';
import { triggerHaptic } from '@/src/lib/haptics';
import { toDateTimeLocalValue } from '@/src/lib/schedule';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { useBackHandler } from '@/src/lib/backNavigation';
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
  const { contacts, scheduleCall, showNotice } = useCalls();

  const [pickedContact, setPickedContact] = useState<ContactProfile | null>(null);
  const [queryOrNumber, setQueryOrNumber] = useState('');
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
    setQueryOrNumber('');
    setPickedContact(contact ?? null);
    setName(contact ? contact.name : '');
  }, [contact, isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isVisible, onClose]);

  useBackHandler({
    id: 'quick-schedule-modal',
    active: isVisible,
    priority: 55,
    onBack: onClose,
    hasUnsavedChanges: () =>
      Boolean((!contact && (queryOrNumber.trim() || name.trim())) || note.trim()),
    unsavedMessage: 'Discard scheduled callback draft?',
  });

  const savedList = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    return Object.values(contacts).sort((a, b) => collator.compare(a.name, b.name));
  }, [contacts]);

  const matchingContacts = useMemo(() => {
    const q = queryOrNumber.trim().toLowerCase();
    if (!q) return savedList.slice(0, 5);
    return savedList
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.number.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [savedList, queryOrNumber]);

  const activeContact = contact ?? pickedContact;
  const trimmedInput = queryOrNumber.trim();
  const looksLikePhone = /[0-9+]/.test(trimmedInput) && trimmedInput.replace(/\D/g, '').length >= 3;

  const targetNumber = activeContact ? activeContact.number : trimmedInput;
  const targetName = activeContact ? activeContact.name : name.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNumber) {
      showNotice('Pick a contact or enter a phone number.');
      return;
    }
    const parsed = Date.parse(scheduledAt);
    if (Number.isNaN(parsed)) {
      showNotice('Choose a valid date and time.');
      return;
    }
    triggerHaptic('success');
    scheduleCall({
      number: targetNumber,
      name: targetName || null,
      scheduledFor: parsed,
      note: note.trim() || null,
    });
    onClose();
  };

  const modalContent = (
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
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={activeContact ? `Schedule call with ${activeContact.name}` : 'Schedule call'}
          >
            <div className="w-10 h-1 rounded-full bg-[#DDE4EA] dark:bg-[var(--dark-border)] mx-auto sm:hidden" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Clock size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[#08246B] dark:text-white truncate">
                    Schedule Call
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Pick who and when — takes 2 taps
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close schedule dialog"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Who */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-[#08246B] dark:text-white">
                  Who to call
                </span>

                {activeContact ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: avatarColor(activeContact.number) }}
                      >
                        {initials(activeContact.name, activeContact.number)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                          {formatDisplayNameOrPhone(activeContact.name, activeContact.number)}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                          {activeContact.number}
                        </p>
                      </div>
                    </div>
                    {!contact && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickedContact(null);
                          setQueryOrNumber('');
                          setName('');
                        }}
                        className="min-h-[34px] px-2.5 rounded-lg text-xs font-semibold text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 shrink-0"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
                      />
                      <input
                        type="text"
                        value={queryOrNumber}
                        onChange={(e) => setQueryOrNumber(e.target.value)}
                        placeholder={
                          savedList.length > 0
                            ? 'Search contact or enter phone (+251...)'
                            : 'Enter phone number (+251...)'
                        }
                        className="w-full min-h-[44px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] pl-9 pr-3 py-2 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                      />
                    </div>

                    {matchingContacts.length > 0 && (
                      <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)] overflow-hidden">
                        {matchingContacts.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => {
                              triggerHaptic('tap');
                              setPickedContact(c);
                              setQueryOrNumber(c.number);
                              setName(c.name);
                            }}
                            className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-left bg-white dark:bg-[var(--dark-surface)] hover:bg-[#EEF2F6]/70 dark:hover:bg-[var(--dark-elevated)] transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                style={{ backgroundColor: avatarColor(c.number) }}
                              >
                                {initials(c.name, c.number)}
                              </div>
                              <span className="text-xs font-semibold text-[#08246B] dark:text-white truncate">
                                {c.name}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0">
                              {c.number}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {(looksLikePhone || savedList.length === 0) && (
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contact name (optional)"
                        className="w-full min-h-[42px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: When */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-[#08246B] dark:text-white">
                  When
                </span>
                <SimpleScheduleTimePicker
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  variant="inset"
                  resetKey={isVisible ? 'open' : 'closed'}
                />
              </div>

              {/* Step 3: Optional Note */}
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note or topic (optional)"
                aria-label="Reminder note"
                className="w-full min-h-[42px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3 py-2 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
              />

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[46px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[46px] flex-1 px-5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap"
                >
                  Schedule Call
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
