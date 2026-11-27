import { useMemo, useState } from 'react';
import { Cake, Phone, Search, Star, X } from 'lucide-react';
import { getContactKey, getUpcomingContactEvents } from '@/src/lib/contacts';
import { avatarColor, formatDuration, initials } from '@/src/lib/format';
import { quietContacts, quietMessage } from '@/src/lib/reminders';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { contactStats } from '@/src/lib/stats';
import { useCalls } from '@/src/store/CallsContext';

type PeopleSegment = 'all' | 'vip' | 'quiet' | 'birthdays';

export function PeopleViewV106({
  onSelectContact,
  onCallBack,
}: {
  onSelectContact: (number: string) => void;
  onCallBack: (number: string) => void;
}) {
  const { calls, contacts: savedProfiles, favorites, toggleFavorite, reminderPrefs } = useCalls();
  const [segment, setSegment] = useState<PeopleSegment>('all');
  const [query, setQuery] = useState('');

  const allStats = useMemo(() => contactStats(calls), [calls]);

  const unifiedPeople = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        number: string;
        name: string;
        count: number;
        duration: number;
        lastTimestamp: number;
        isVip: boolean;
        tag?: string;
      }
    >();

    for (const stat of allStats) {
      const k = getContactKey(stat.number);
      const prof = savedProfiles[k];
      map.set(k, {
        key: k,
        number: stat.number,
        name: prof?.name?.trim() || formatDisplayNameOrPhone(stat.name, stat.number),
        count: stat.count,
        duration: stat.duration,
        lastTimestamp: stat.lastTimestamp,
        isVip: favorites.has(stat.number) || favorites.has(k),
        tag: prof?.tag,
      });
    }

    for (const prof of Object.values(savedProfiles)) {
      const k = getContactKey(prof.number);
      if (map.has(k)) continue;
      map.set(k, {
        key: k,
        number: prof.number,
        name: prof.name?.trim() || formatDisplayNameOrPhone(null, prof.number),
        count: 0,
        duration: 0,
        lastTimestamp: 0,
        isVip: favorites.has(prof.number) || favorites.has(k),
        tag: prof.tag,
      });
    }

    return [...map.values()].sort(
      (a, b) => Number(b.isVip) - Number(a.isVip) || b.count - a.count || a.name.localeCompare(b.name),
    );
  }, [allStats, savedProfiles, favorites]);

  const quietList = useMemo(
    () => quietContacts(calls, new Date(), reminderPrefs.quietContactDays || 30),
    [calls, reminderPrefs.quietContactDays],
  );

  const upcomingEvents = useMemo(
    () => getUpcomingContactEvents(savedProfiles, calls, 60),
    [savedProfiles, calls],
  );

  const q = query.trim().toLowerCase();

  const filteredPeople = useMemo(() => {
    const base = segment === 'vip' ? unifiedPeople.filter((p) => p.isVip) : unifiedPeople;
    if (!q) return base;
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.number.toLowerCase().includes(q) ||
        (p.tag ?? '').toLowerCase().includes(q),
    );
  }, [unifiedPeople, segment, q]);

  const filteredQuiet = useMemo(() => {
    if (!q) return quietList;
    return quietList.filter(
      (c) => c.name.toLowerCase().includes(q) || c.number.toLowerCase().includes(q),
    );
  }, [quietList, q]);

  const filteredEvents = useMemo(() => {
    if (!q) return upcomingEvents;
    return upcomingEvents.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.number.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q),
    );
  }, [upcomingEvents, q]);

  const vipCount = useMemo(() => unifiedPeople.filter((p) => p.isVip).length, [unifiedPeople]);

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
          style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
        >
          People
        </h1>
        <p className="text-xs text-[#626874] dark:text-[#989EA9]">
          Contacts, VIPs, quiet friends, and upcoming birthdays in one place
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B92A0]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by name or number…"
          aria-label="Search people"
          className="w-full h-11 pl-10 pr-9 rounded-xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] text-sm text-[#14161A] dark:text-[#F4F4F1] placeholder:text-[#8B92A0] focus:outline-none focus:border-[#E45A0D]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-[#8B92A0] flex items-center justify-center"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Clean Segmented Tabs */}
      <div
        role="group"
        aria-label="People category"
        className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EDEBE6] dark:bg-[#15181D]"
      >
        {(
          [
            { key: 'all', label: `All (${unifiedPeople.length})` },
            { key: 'vip', label: `VIP (${vipCount})` },
            { key: 'quiet', label: `Quiet (${quietList.length})` },
            { key: 'birthdays', label: `Birthdays (${upcomingEvents.length})` },
          ] as Array<{ key: PeopleSegment; label: string }>
        ).map((tab) => {
          const active = segment === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSegment(tab.key)}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-white dark:bg-[#232730] text-[#14161A] dark:text-[#F4F4F1] shadow-xs'
                  : 'text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* List Body */}
      {segment === 'quiet' ? (
        filteredQuiet.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-8 text-center">
            <p className="text-sm font-medium text-[#14161A] dark:text-[#F4F4F1]">
              You are caught up with everyone
            </p>
            <p className="mt-1 text-xs text-[#626874] dark:text-[#989EA9]">
              People you normally call who have gone quiet will show up here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] divide-y divide-[#F0EEE9] dark:divide-white/[0.06] overflow-hidden">
            {filteredQuiet.map((person) => {
              const displayName = formatDisplayNameOrPhone(person.name, person.number);
              return (
                <div
                  key={person.number}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAF9F6] dark:hover:bg-white/[0.02]"
                >
                  <button
                    type="button"
                    onClick={() => onSelectContact(person.number)}
                    className="w-10 h-10 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: avatarColor(person.number) }}
                  >
                    {initials(person.name, person.number)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectContact(person.number)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-[#626874] dark:text-[#989EA9] truncate">
                      {quietMessage(person)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCallBack(person.number)}
                    aria-label={`Call ${displayName}`}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#E45A0D] hover:bg-[#C94D09] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Call
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : segment === 'birthdays' ? (
        filteredEvents.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-8 text-center">
            <p className="text-sm font-medium text-[#14161A] dark:text-[#F4F4F1]">
              No birthdays in the next 60 days
            </p>
            <p className="mt-1 text-xs text-[#626874] dark:text-[#989EA9]">
              Tap any contact to add their Ethiopian or Gregorian birthday.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] divide-y divide-[#F0EEE9] dark:divide-white/[0.06] overflow-hidden">
            {filteredEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAF9F6] dark:hover:bg-white/[0.02]"
              >
                <div className="w-10 h-10 rounded-full bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C] flex items-center justify-center shrink-0">
                  <Cake size={17} />
                </div>
                <button
                  type="button"
                  onClick={() => onSelectContact(ev.number)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] truncate">
                    {ev.name}
                  </p>
                  <p className="text-xs text-[#626874] dark:text-[#989EA9] truncate">
                    {ev.title} · {ev.isToday ? 'Today' : `In ${ev.daysUntil} days`}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onCallBack(ev.number)}
                  aria-label={`Call ${ev.name}`}
                  className="w-11 h-11 rounded-full text-[#626874] dark:text-[#989EA9] hover:text-[#E45A0D] flex items-center justify-center shrink-0"
                >
                  <Phone size={17} />
                </button>
              </div>
            ))}
          </div>
        )
      ) : filteredPeople.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] p-8 text-center">
          <p className="text-sm font-medium text-[#14161A] dark:text-[#F4F4F1]">
            {segment === 'vip' ? 'No VIP contacts starred yet' : 'No people found'}
          </p>
          <p className="mt-1 text-xs text-[#626874] dark:text-[#989EA9]">
            {segment === 'vip'
              ? 'Tap the star next to any contact to pin them here.'
              : 'Your callers and saved phone contacts appear here.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] divide-y divide-[#F0EEE9] dark:divide-white/[0.06] overflow-hidden">
          {filteredPeople.slice(0, 80).map((person) => (
            <div
              key={person.key}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF9F6] dark:hover:bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => onSelectContact(person.number)}
                className="w-10 h-10 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                style={{ backgroundColor: avatarColor(person.number) }}
              >
                {initials(person.name, person.number)}
              </button>

              <button
                type="button"
                onClick={() => onSelectContact(person.number)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] truncate">
                  {person.name}
                </p>
                <p className="text-xs text-[#626874] dark:text-[#989EA9] truncate tabular-nums">
                  {person.count > 0
                    ? `${person.count} calls · ${formatDuration(person.duration)}`
                    : person.number}
                  {person.tag ? ` · ${person.tag}` : ''}
                </p>
              </button>

              <button
                type="button"
                onClick={() => toggleFavorite(person.number)}
                aria-label={person.isVip ? `Remove ${person.name} from VIP` : `Star ${person.name} as VIP`}
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  person.isVip
                    ? 'text-[#E45A0D] dark:text-[#F4762C]'
                    : 'text-[#B0B6C2] dark:text-[#555C69] hover:text-[#E45A0D]'
                }`}
              >
                <Star size={16} fill={person.isVip ? 'currentColor' : 'none'} />
              </button>

              <button
                type="button"
                onClick={() => onCallBack(person.number)}
                aria-label={`Call ${person.name}`}
                className="w-11 h-11 rounded-full text-[#626874] dark:text-[#989EA9] hover:text-[#E45A0D] dark:hover:text-[#F4762C] hover:bg-[#FFF5EE] dark:hover:bg-[#E45A0D]/12 flex items-center justify-center shrink-0"
              >
                <Phone size={17} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
