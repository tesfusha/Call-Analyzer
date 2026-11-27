import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Cake,
  Clock,
  RefreshCw,
  Search,
  Tag,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CustomSelect } from '@/src/components/CustomSelect';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { QuickScheduleModal } from '@/src/components/QuickScheduleModal';
import { SavedContactFormModal } from '@/src/components/SavedContactFormModal';
import {
  canSyncAllPhoneContacts,
  daysUntilAnnualDate,
  getContactKey,
  isContactPickerSupported,
  loadAllPhoneContacts,
  mergeTagOptions,
  parseCsvContacts,
  parseVCardContacts,
  pickPhoneContacts,
  readUploadedTextFile,
} from '@/src/lib/contacts';
import { detectCarrier } from '@/src/lib/ethiopia';
import { getEthiopianMonthName, getHolidaysInGregorianYearOrUpcoming } from '@/src/lib/ethiopianCalendar';
import { avatarColor, formatDuration, initials } from '@/src/lib/format';
import { triggerHaptic } from '@/src/lib/haptics';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { useCalls } from '@/src/store/CallsContext';
import type { ContactProfile } from '@/src/types/call';

type TagFilter = string;
type ContactSort = 'name' | 'calls' | 'recent';

const CONTACT_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base' });
const CONTACTS_PAGE_SIZE = 40;

export function SavedContactsSection({
  onSelectContact,
}: {
  onSelectContact: (number: string) => void;
}) {
  const {
    calls,
    contacts,
    availableTags,
    contactStatuses,
    authUser,
    isGuest,
    openAuthPrompt,
    calendarPrefs,
    openWishComposer,
    importContactProfiles,
    showNotice,
  } = useCalls();

  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<TagFilter>('all');
  const [sortBy, setSortBy] = useState<ContactSort>('name');
  const [visibleCount, setVisibleCount] = useState(CONTACTS_PAGE_SIZE);
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<ContactProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const pickerAvailable = useMemo(() => isContactPickerSupported(), []);
  const bulkSyncAvailable = useMemo(() => canSyncAllPhoneContacts(), []);
  const [syncingPhoneContacts, setSyncingPhoneContacts] = useState(false);
  const upcomingHoliday = useMemo(
    () => getHolidaysInGregorianYearOrUpcoming(new Date(), 366, calendarPrefs.defaultLang)[0] ?? null,
    [calendarPrefs.defaultLang],
  );

  const callSummaryByKey = useMemo(() => {
    const map = new Map<string, { count: number; duration: number }>();
    calls.forEach((c) => {
      const k = getContactKey(c.number);
      const existing = map.get(k);
      if (!existing) {
        map.set(k, { count: 1, duration: c.duration });
      } else {
        existing.count += 1;
        existing.duration += c.duration;
      }
    });
    return map;
  }, [calls]);

  const allSaved = useMemo(() => {
    const list = Object.values(contacts);
    if (sortBy === 'calls') {
      return list.sort((a, b) => {
        const diff = (callSummaryByKey.get(b.key)?.count ?? 0) - (callSummaryByKey.get(a.key)?.count ?? 0);
        return diff !== 0 ? diff : CONTACT_COLLATOR.compare(a.name, b.name);
      });
    }
    if (sortBy === 'recent') {
      return list.sort((a, b) => {
        const diff = (b.updatedAt || 0) - (a.updatedAt || 0);
        return diff !== 0 ? diff : CONTACT_COLLATOR.compare(a.name, b.name);
      });
    }
    return list.sort((a, b) => CONTACT_COLLATOR.compare(a.name, b.name));
  }, [contacts, sortBy, callSummaryByKey]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSaved.filter((p) => {
      if (tagFilter === 'events') {
        if (!p.birthday && p.events.length === 0) return false;
      } else if (tagFilter !== 'all') {
        if (p.tag.toLowerCase() !== tagFilter.toLowerCase()) return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.number.toLowerCase().includes(q) ||
        p.tag.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q)
      );
    });
  }, [allSaved, tagFilter, search]);

  useEffect(() => {
    setVisibleCount(CONTACTS_PAGE_SIZE);
  }, [search, tagFilter, sortBy]);

  const visibleContacts = useMemo(
    () => filteredContacts.slice(0, visibleCount),
    [filteredContacts, visibleCount],
  );
  const hasMoreContacts = visibleContacts.length < filteredContacts.length;
  const filterTags = useMemo(
    () => mergeTagOptions(availableTags, allSaved.map((p) => p.tag)),
    [allSaved, availableTags],
  );

  useEffect(() => {
    if (!hasMoreContacts) return;
    const target = loadMoreRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => prev + CONTACTS_PAGE_SIZE);
        }
      },
      { rootMargin: '220px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreContacts, visibleContacts.length]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readUploadedTextFile(file);
      const lower = file.name.toLowerCase();
      const parsed =
        lower.endsWith('.csv') && !text.includes('BEGIN:VCARD')
          ? parseCsvContacts(text)
          : parseVCardContacts(text);
      if (parsed.length === 0) {
        showNotice('No valid contacts found in that file.');
        return;
      }
      const res = importContactProfiles(parsed);
      showNotice(`Imported ${res.added} new and updated ${res.updated} contacts.`);
    } catch {
      showNotice('Could not read that contact file.');
    }
  };

  const triggerContactFileImport = () => {
    if (isGuest || !authUser) {
      openAuthPrompt('signin', 'Login or create an account to import phone contacts.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handlePickFromPhone = async () => {
    if (isGuest || !authUser) {
      openAuthPrompt('signin', 'Login or create an account to import phone contacts.');
      return;
    }
    const res = await pickPhoneContacts();
    if (!res.supported) {
      showNotice(res.error ?? 'Use .vcf or CSV import on this browser.');
      return;
    }
    if (res.contacts.length === 0) {
      if (res.error) showNotice(res.error);
      return;
    }
    const counts = importContactProfiles(res.contacts);
    showNotice(`Added ${counts.added} and updated ${counts.updated} phone contacts.`);
  };

  const handleLoadAllFromPhone = async () => {
    if (isGuest || !authUser) {
      openAuthPrompt('signin', 'Login or create an account to load phone contacts.');
      return;
    }
    triggerHaptic('tap');
    setSyncingPhoneContacts(true);
    try {
      const res = await loadAllPhoneContacts();
      if (!res.supported || !res.granted) {
        showNotice(res.error ?? 'Could not load phone contacts.');
        return;
      }
      if (res.contacts.length === 0) {
        showNotice('No saved phone contacts with numbers found on this device.');
        return;
      }
      const counts = importContactProfiles(res.contacts);
      showNotice(
        `Loaded ${res.contacts.length} phone contact${res.contacts.length === 1 ? '' : 's'} (${counts.added} added, ${counts.updated} updated).`,
        'success',
      );
    } finally {
      setSyncingPhoneContacts(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,.vcard,.csv,text/vcard,text/csv"
        onChange={(e) => void handleImportFile(e)}
        className="hidden"
      />

      {/* Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
              Saved contacts directory
            </h2>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
              {allSaved.length} saved contact{allSaved.length === 1 ? '' : 's'} for scheduling & wishes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {bulkSyncAvailable && (
              <button
                type="button"
                disabled={syncingPhoneContacts}
                onClick={() => void handleLoadAllFromPhone()}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#08246B] hover:bg-[#0B308E] disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <RefreshCw size={14} className={syncingPhoneContacts ? 'animate-spin' : ''} />
                {syncingPhoneContacts ? 'Loading contacts...' : 'Load phone contacts'}
              </button>
            )}
            {pickerAvailable && (
              <button
                type="button"
                disabled={syncingPhoneContacts}
                onClick={() => void handlePickFromPhone()}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Users size={14} className="text-[#FF6A00]" />
                Pick one contact
              </button>
            )}
            <button
              type="button"
              onClick={triggerContactFileImport}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload size={14} className="text-[#FF6A00]" />
              Import .vcf / CSV
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <UserPlus size={14} />
              Add contact
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved contacts by name, phone, tag, or note..."
              className="w-full min-h-[42px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] pl-9 pr-9 py-2 text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  setSearch('');
                }}
                aria-label="Clear saved contacts search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] flex items-center justify-center text-[#8A93A0] hover:text-[#08246B] dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-x-auto no-scrollbar sm:flex-1">
              {(
                [
                  { value: 'all', label: 'All' },
                  ...filterTags.map((t) => ({ value: t, label: t })),
                  { value: 'events', label: 'Birthdays' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    triggerHaptic('tap');
                    setTagFilter(opt.value);
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    tagFilter === opt.value
                      ? 'bg-[#FF6A00] text-white'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <CustomSelect
              value={sortBy}
              icon={ArrowUpDown}
              ariaLabel="Sort saved contacts"
              variant="inset"
              compact
              fullWidth
              className="sm:w-auto shrink-0"
              activeHighlight={sortBy !== 'name'}
              options={[
                { value: 'name', label: 'Sort: A–Z' },
                { value: 'calls', label: 'Most Calls' },
                { value: 'recent', label: 'Recent' },
              ]}
              onChange={(val) => {
                triggerHaptic('tap');
                setSortBy(val as ContactSort);
              }}
            />
          </div>
        </div>
      </div>

      {/* Contact List / Empty State */}
      {allSaved.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center mx-auto">
            <Users size={22} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-[#08246B] dark:text-white">
              No saved contacts yet
            </h3>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Save contacts here with birthdays, tags, and notes so you can schedule calls or send Ethiopian holiday wishes anytime.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap"
            >
              Add first contact
            </button>
          </div>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-6 text-center">
          <p className="text-sm text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
            No saved contacts match your current search or filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
            {visibleContacts.map((profile) => {
              const callStat = callSummaryByKey.get(profile.key);
              const bdayDays = profile.birthday
                ? daysUntilAnnualDate(
                    profile.birthday.month,
                    profile.birthday.day,
                    profile.birthday.calendar,
                  )
                : null;

              const bdayLabel = profile.birthday
                ? profile.birthday.calendar === 'ethiopian'
                  ? `${getEthiopianMonthName(profile.birthday.month, 'english')} ${profile.birthday.day} EC`
                  : `${profile.birthday.month}/${profile.birthday.day} GC`
                : null;
              const contactStatus = contactStatuses[profile.key];
              const hasStatusMeta =
                contactStatus &&
                (contactStatus.currentStreak > 0 ||
                  contactStatus.longestStreak >= 3 ||
                  contactStatus.contactScore > 0);

              return (
                <div
                  key={profile.key}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[var(--dark-surface)] border-b border-[#DDE4EA] dark:border-[var(--dark-border)] last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => onSelectContact(profile.number)}
                    className="flex items-start gap-3 min-w-0 flex-1 text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: avatarColor(profile.number) }}
                    >
                      {initials(profile.name, profile.number)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-[#08246B] dark:text-white break-words">
                          {formatDisplayNameOrPhone(profile.name, profile.number)}
                        </span>
                        {profile.tag && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#FF6A00] shrink-0">
                            <Tag size={11} className="shrink-0" />
                            <span>{profile.tag}</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] break-all">
                        {profile.number} · {detectCarrier(profile.number)}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
                        {bdayLabel && bdayDays !== null && (
                          <span className="inline-flex items-center gap-1 text-[#FF6A00] font-medium">
                            <Cake size={12} />
                            {bdayLabel} ({bdayDays === 0 ? 'Today!' : `in ${bdayDays}d`})
                          </span>
                        )}
                        {profile.events.length > 0 && (
                          <span>
                            {bdayLabel ? '· ' : ''}
                            {profile.events.length} event{profile.events.length === 1 ? '' : 's'}
                          </span>
                        )}
                        {callStat ? (
                          <span>
                            {bdayLabel || profile.events.length > 0 ? '· ' : ''}
                            {callStat.count} call{callStat.count === 1 ? '' : 's'} ({formatDuration(callStat.duration)})
                          </span>
                        ) : (
                          <span>
                            {bdayLabel || profile.events.length > 0 ? '· ' : ''}
                            No calls logged yet
                          </span>
                        )}
                        {hasStatusMeta && (
                          <span className="text-[#FF6A00] font-semibold font-mono tabular-nums">
                            ·{' '}
                            {contactStatus.currentStreak > 0
                              ? `${contactStatus.currentStreak}d streak`
                              : contactStatus.longestStreak >= 3
                                ? `Best ${contactStatus.longestStreak}d`
                                : `${contactStatus.totalConnectedDays}d connected`}
                            {contactStatus.contactScore > 0
                              ? ` · ${contactStatus.contactScore} pts`
                              : ''}
                            {contactStatus.earnedBadgesCount > 0
                              ? ` · ${contactStatus.earnedBadgesCount} badge${contactStatus.earnedBadgesCount === 1 ? '' : 's'}`
                              : ''}
                          </span>
                        )}
                      </div>

                      {profile.notes && (
                        <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] truncate">
                          {profile.notes}
                        </p>
                      )}
                    </div>
                  </button>

                  <div className="w-full sm:w-auto min-w-0 flex flex-wrap items-center gap-1.5 sm:pl-2">
                    <button
                      type="button"
                      onClick={() => setScheduleTarget(profile)}
                      className="min-h-[38px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Clock size={13} className="text-[#FF6A00]" />
                      Schedule
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const isBirthdaySoon = bdayDays !== null && bdayDays <= 7;
                        openWishComposer({
                          contactKey: profile.key,
                          contactName: profile.name || profile.number,
                          contactNumber: profile.number,
                          tag: profile.tag,
                          telegramUsername: profile.telegramUsername,
                          instagramUsername: profile.instagramUsername,
                          occasionType: isBirthdaySoon
                            ? 'birthday'
                            : upcomingHoliday
                              ? 'holiday'
                              : 'reconnect',
                          occasionKey: isBirthdaySoon
                            ? 'birthday'
                            : upcomingHoliday
                              ? upcomingHoliday.key
                              : 'reconnect',
                          occasionName: isBirthdaySoon
                            ? 'Birthday'
                            : upcomingHoliday
                              ? upcomingHoliday.name
                              : 'Check-in',
                        });
                      }}
                      className="min-h-[38px] px-3 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <FlaticonIcon name="fi-rr-gift" className="text-[13px] text-[#FF6A00]" />
                      Wish
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectContact(profile.number)}
                      aria-label={`View ${profile.name} details`}
                      className="min-h-[38px] px-3 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <User size={13} className="text-[#FF6A00]" />
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMoreContacts && (
            <div ref={loadMoreRef} className="flex items-center justify-center pt-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  setVisibleCount((prev) => prev + CONTACTS_PAGE_SIZE);
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] tabular-nums"
              >
                Show more ({filteredContacts.length - visibleContacts.length} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      <SavedContactFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      <QuickScheduleModal contact={scheduleTarget} onClose={() => setScheduleTarget(null)} />
    </div>
  );
}
