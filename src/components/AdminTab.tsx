import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Film,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { CategoryPanel, CategoryTabs } from '@/src/components/CategoryTabs';
import { CustomSelect } from '@/src/components/CustomSelect';
import { PromoVideoStudio } from '@/src/components/PromoVideoStudio';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { firstGraphemes, formatDateTime } from '@/src/lib/format';
import { toEatDateString } from '@/src/lib/gamification';
import { useCalls } from '@/src/store/CallsContext';
import type { DailyActiveRecord, RegisteredUserRecord } from '@/src/types/call';

type AdminCategory = 'stats' | 'users' | 'promo';
type Granularity = 'daily' | 'weekly' | 'monthly';
type UserPeriodFilter = 'all' | 'today' | '7d' | '30d';
type UserSortKey = 'newest' | 'active' | 'name';

type TimeBucket = {
  key: string;
  label: string;
  subLabel: string;
  newUsers: number;
  activeUsers: number;
};

const ADMIN_CATEGORIES: Array<{
  key: AdminCategory;
  label: string;
  description: string;
  icon: typeof BarChart3;
}> = [
  {
    key: 'stats',
    label: 'Active Clients & Stats',
    description: 'Active clients per day/7d/30d from dailyActive and registered user totals',
    icon: BarChart3,
  },
  {
    key: 'users',
    label: 'Registered Users',
    description: 'Basic account directory (no customer contacts or call data)',
    icon: Users,
  },
  {
    key: 'promo',
    label: 'Promo Video',
    description: 'Generate & export 9:16, 1:1, and 16:9 social promo animations',
    icon: Film,
  },
];

const MS_DAY = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function eatDateOffsetFromToday(daysAgo: number, now: Date): string {
  return toEatDateString(now.getTime() - daysAgo * MS_DAY);
}

function countDistinctActiveUidsInRange(
  records: DailyActiveRecord[],
  startEatDate: string,
  endEatDateInclusive: string,
): number {
  const uids = new Set<string>();
  for (const rec of records) {
    if (rec.date >= startEatDate && rec.date <= endEatDateInclusive) {
      uids.add(rec.uid);
    }
  }
  return uids.size;
}

function buildBuckets(
  users: RegisteredUserRecord[],
  dailyActive: DailyActiveRecord[],
  granularity: Granularity,
  now: Date,
): TimeBucket[] {
  const buckets: TimeBucket[] = [];

  if (granularity === 'daily') {
    const todayStart = startOfDay(now);
    for (let i = 13; i >= 0; i -= 1) {
      const start = todayStart - i * MS_DAY;
      const end = start + MS_DAY;
      const d = new Date(start);
      const eatDate = eatDateOffsetFromToday(i, now);
      const newUsers = users.filter(
        (u) => u.registeredAtMs >= start && u.registeredAtMs < end,
      ).length;
      const activeUsers = countDistinctActiveUidsInRange(dailyActive, eatDate, eatDate);
      buckets.push({
        key: `d-${eatDate}`,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        subLabel: formatEthiopianShort(d, 'english'),
        newUsers,
        activeUsers,
      });
    }
    return buckets;
  }

  if (granularity === 'weekly') {
    const todayStart = startOfDay(now);
    for (let i = 7; i >= 0; i -= 1) {
      const end = todayStart + MS_DAY - i * 7 * MS_DAY;
      const start = end - 7 * MS_DAY;
      const dStart = new Date(start);
      const dEnd = new Date(end - MS_DAY);
      const endEat = eatDateOffsetFromToday(i * 7, now);
      const startEat = eatDateOffsetFromToday(i * 7 + 6, now);
      const newUsers = users.filter(
        (u) => u.registeredAtMs >= start && u.registeredAtMs < end,
      ).length;
      const activeUsers = countDistinctActiveUidsInRange(dailyActive, startEat, endEat);
      buckets.push({
        key: `w-${startEat}`,
        label: dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        subLabel: `to ${dEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        newUsers,
        activeUsers,
      });
    }
    return buckets;
  }

  // monthly (last 6 months)
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const monthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const newUsers = users.filter(
      (u) => u.registeredAtMs >= start && u.registeredAtMs < end,
    ).length;
    const monthUids = new Set<string>();
    for (const rec of dailyActive) {
      if (rec.date.startsWith(monthPrefix)) {
        monthUids.add(rec.uid);
      }
    }
    buckets.push({
      key: `m-${monthPrefix}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      subLabel: String(d.getFullYear()),
      newUsers,
      activeUsers: monthUids.size,
    });
  }
  return buckets;
}

function parseFirestoreReason(reason: unknown): string {
  const raw = reason instanceof Error ? reason.message : String(reason || '');
  try {
    const parsed = JSON.parse(raw) as { error?: string; path?: string; operationType?: string };
    if (parsed?.error) {
      const target = parsed.path ? ` (${parsed.operationType || 'read'} ${parsed.path})` : '';
      return `${parsed.error}${target}`;
    }
  } catch {
    // not JSON
  }
  return raw || 'Unknown error';
}

export function AdminTab() {
  const {
    isAdmin,
    fetchRegisteredUsers,
    fetchDailyActiveRecords,
    calendarPrefs,
    showNotice,
  } = useCalls();

  const [activeCategory, setActiveCategory] = useState<AdminCategory>('stats');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [users, setUsers] = useState<RegisteredUserRecord[]>([]);
  const [dailyActive, setDailyActive] = useState<DailyActiveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<UserPeriodFilter>('all');
  const [sortBy, setSortBy] = useState<UserSortKey>('newest');

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [usersRes, activeRes] = await Promise.allSettled([
        fetchRegisteredUsers(),
        fetchDailyActiveRecords(),
      ]);
      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value);
      }
      if (activeRes.status === 'fulfilled') {
        setDailyActive(activeRes.value);
      }
      if (usersRes.status === 'rejected' || activeRes.status === 'rejected') {
        const parts: string[] = [];
        if (usersRes.status === 'rejected') {
          parts.push(`userRegistry: ${parseFirestoreReason(usersRes.reason)}`);
        }
        if (activeRes.status === 'rejected') {
          parts.push(`dailyActive: ${parseFirestoreReason(activeRes.reason)}`);
        }
        const msg = `Could not load full admin analytics (${parts.join('; ')}).`;
        setLoadError(msg);
        showNotice('Some admin analytics failed to load.');
      }
    } catch (err) {
      const msg = `Could not load admin analytics: ${parseFirestoreReason(err)}`;
      setLoadError(msg);
      showNotice('Could not load admin analytics right now.');
    } finally {
      setLoading(false);
    }
  }, [fetchDailyActiveRecords, fetchRegisteredUsers, isAdmin, showNotice]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const now = useMemo(() => new Date(), [users, dailyActive]);
  const todayStart = useMemo(() => startOfDay(now), [now]);
  const weekStart = useMemo(() => now.getTime() - 7 * MS_DAY, [now]);
  const monthStart = useMemo(() => now.getTime() - 30 * MS_DAY, [now]);

  const summary = useMemo(() => {
    const todayEat = toEatDateString(now.getTime());
    const sevenDaysAgoEat = eatDateOffsetFromToday(6, now);
    const thirtyDaysAgoEat = eatDateOffsetFromToday(29, now);

    const total = users.length;
    const newDaily = users.filter((u) => u.registeredAtMs >= todayStart).length;
    const newWeekly = users.filter((u) => u.registeredAtMs >= weekStart).length;
    const newMonthly = users.filter((u) => u.registeredAtMs >= monthStart).length;

    const activeToday = countDistinctActiveUidsInRange(dailyActive, todayEat, todayEat);
    const active7d = countDistinctActiveUidsInRange(dailyActive, sevenDaysAgoEat, todayEat);
    const active30d = countDistinctActiveUidsInRange(dailyActive, thirtyDaysAgoEat, todayEat);

    return {
      total,
      newDaily,
      activeToday,
      newWeekly,
      active7d,
      newMonthly,
      active30d,
    };
  }, [users, dailyActive, now, todayStart, weekStart, monthStart]);

  const buckets = useMemo(
    () => buildBuckets(users, dailyActive, granularity, now),
    [users, dailyActive, granularity, now],
  );

  const maxBucketVal = useMemo(
    () => Math.max(1, ...buckets.map((b) => Math.max(b.newUsers, b.activeUsers))),
    [buckets],
  );

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = users.filter((u) => {
      if (periodFilter === 'today' && u.registeredAtMs < todayStart) return false;
      if (periodFilter === '7d' && u.registeredAtMs < weekStart) return false;
      if (periodFilter === '30d' && u.registeredAtMs < monthStart) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'active') return b.lastActiveAtMs - a.lastActiveAtMs;
      if (sortBy === 'name') {
        const nameA = (a.displayName || a.email).toLowerCase();
        const nameB = (b.displayName || b.email).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return b.registeredAtMs - a.registeredAtMs;
    });
  }, [users, searchQuery, periodFilter, sortBy, todayStart, weekStart, monthStart]);

  const activeMeta =
    ADMIN_CATEGORIES.find((cat) => cat.key === activeCategory) ?? ADMIN_CATEGORIES[0];

  if (!isAdmin) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-6 text-center text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[#08246B] dark:text-white">
              Admin Insights
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              {activeMeta.description}
            </p>
          </div>
          {activeCategory !== 'promo' && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadAdminData()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </div>

        <CategoryTabs
          items={ADMIN_CATEGORIES}
          activeKey={activeCategory}
          onChange={setActiveCategory}
          ariaLabel="Admin categories"
        />
      </div>

      {activeCategory !== 'promo' && (
        <>
          {/* Customer-PII Isolation Notice */}
          <div className="rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/10 border border-[#FF6A00]/30 px-4 py-3 flex items-start gap-2.5 text-xs text-[#08246B] dark:text-white">
            <ShieldCheck size={16} className="text-[#FF6A00] shrink-0 mt-0.5" />
            <span>
              Privacy enforced: Active client counts come from minimal daily open pings (UID + date only) and registered totals from the account registry. No call logs, phone numbers, or contact names are stored in the cloud.
            </span>
          </div>

          {loadError && (
            <div className="rounded-2xl bg-[#FEF2F2] dark:bg-[#EF4444]/10 border border-[#EF4444]/35 px-4 py-3 flex items-center justify-between gap-2 text-xs text-[#B91C1C] dark:text-[#FCA5A5]">
              <span className="break-words">{loadError}</span>
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadAdminData()}
                className="min-h-[32px] px-3 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 text-white font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}

      <CategoryPanel activeKey={activeCategory} label={activeMeta.label}>
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-bold text-[#08246B] dark:text-white">
            {activeMeta.label}
          </h2>
        </div>
        {activeCategory === 'stats' && (
          <>
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  <span>Registered Users</span>
                  <Users size={15} className="text-[#FF6A00]" />
                </div>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#08246B] dark:text-white">
                  {summary.total}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  Total in registry
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  <span>Active Today</span>
                  <Activity size={15} className="text-[#10B981]" />
                </div>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#08246B] dark:text-white">
                  {summary.activeToday}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  +{summary.newDaily} new today
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  <span>Active (Last 7d)</span>
                  <CalendarDays size={15} className="text-[#4FA3F7]" />
                </div>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#08246B] dark:text-white">
                  {summary.active7d}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  +{summary.newWeekly} new in 7d
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  <span>Active (Last 30d)</span>
                  <UserCheck size={15} className="text-[#FF6A00]" />
                </div>
                <p className="text-2xl font-bold font-mono tabular-nums text-[#08246B] dark:text-white">
                  {summary.active30d}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  +{summary.newMonthly} new in 30d
                </p>
              </div>
            </div>

            {/* Granularity Chart */}
            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                    Active Clients &amp; Signups Trend
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {granularity === 'daily'
                      ? 'Last 14 EAT days (unique active clients & new signups)'
                      : granularity === 'weekly'
                        ? 'Last 8 weeks (unique active clients & new signups)'
                        : 'Last 6 months (unique active clients & new signups)'}
                  </p>
                </div>

                <div
                  role="tablist"
                  aria-label="Stats timeframe"
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]"
                >
                  {(
                    [
                      { key: 'daily', label: 'Daily' },
                      { key: 'weekly', label: 'Weekly' },
                      { key: 'monthly', label: 'Monthly' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      role="tab"
                      aria-selected={granularity === opt.key}
                      onClick={() => setGranularity(opt.key)}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        granularity === opt.key
                          ? 'bg-[#FF6A00] text-white'
                          : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FF6A00]" />
                  New signups
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#4FA3F7]" />
                  Active clients
                </span>
              </div>

              <div className="overflow-x-auto pb-1">
                <div
                  className="grid gap-2 items-end h-44 min-w-[440px]"
                  style={{
                    gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))`,
                  }}
                >
                  {buckets.map((b) => {
                    const newH = Math.round((b.newUsers / maxBucketVal) * 100);
                    const actH = Math.round((b.activeUsers / maxBucketVal) * 100);
                    return (
                      <div
                        key={b.key}
                        className="flex flex-col items-center gap-1.5 h-full justify-end"
                      >
                        <div className="w-full flex items-end justify-center gap-1 h-32">
                          <div
                            title={`${b.label}: ${b.newUsers} new signups`}
                            className="w-2.5 rounded-t bg-[#FF6A00] transition-all"
                            style={{ height: `${b.newUsers > 0 ? Math.max(8, newH) : 3}%`, opacity: b.newUsers > 0 ? 1 : 0.25 }}
                          />
                          <div
                            title={`${b.label}: ${b.activeUsers} active clients`}
                            className="w-2.5 rounded-t bg-[#4FA3F7] transition-all"
                            style={{ height: `${b.activeUsers > 0 ? Math.max(8, actH) : 3}%`, opacity: b.activeUsers > 0 ? 1 : 0.25 }}
                          />
                        </div>
                        <div className="text-center leading-tight">
                          <span className="block text-[10px] font-semibold text-[#08246B] dark:text-white whitespace-nowrap">
                            {b.label}
                          </span>
                          <span className="block text-[9px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] whitespace-nowrap">
                            +{b.newUsers}/{b.activeUsers}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Period Breakdown Table */}
            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
                {granularity === 'daily'
                  ? 'Daily Log'
                  : granularity === 'weekly'
                    ? 'Weekly Log'
                    : 'Monthly Log'}
              </h2>
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)]">
                {[...buckets].reverse().map((b) => (
                  <div
                    key={b.key}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[#08246B] dark:text-white">
                        {b.label}
                      </span>
                      <span className="ml-2 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        {b.subLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                      <span className="text-[#FF6A00] font-semibold">
                        +{b.newUsers} new
                      </span>
                      <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        {b.activeUsers} active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeCategory === 'users' && (
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563] dark:text-[var(--dark-text-secondary)] pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search registered name or email..."
                  className="w-full min-h-[42px] pl-9 pr-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <CustomSelect
                  value={periodFilter}
                  onChange={(v) => setPeriodFilter(v as UserPeriodFilter)}
                  ariaLabel="Filter users by registration date"
                  options={[
                    { value: 'all', label: 'All time' },
                    { value: 'today', label: 'Joined today' },
                    { value: '7d', label: 'Last 7 days' },
                    { value: '30d', label: 'Last 30 days' },
                  ]}
                />
                <CustomSelect
                  value={sortBy}
                  onChange={(v) => setSortBy(v as UserSortKey)}
                  ariaLabel="Sort registered users"
                  options={[
                    { value: 'newest', label: 'Newest joined' },
                    { value: 'active', label: 'Recently active' },
                    { value: 'name', label: 'Name A–Z' },
                  ]}
                />
              </div>
            </div>

            {loading && users.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Loading registered accounts...
              </p>
            ) : filteredUsers.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                No registered users match this filter yet.
              </p>
            ) : (
              <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)]">
                {filteredUsers.map((u) => {
                  const regDate = new Date(u.registeredAtMs);
                  const ecShort = formatEthiopianShort(regDate, calendarPrefs.defaultLang);
                  const display = u.displayName.trim() || 'Registered User';
                  return (
                    <div
                      key={u.uid}
                      className="py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={display}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover border border-[#DDE4EA] dark:border-[var(--dark-border)] shrink-0"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-full bg-[#FF6A00]/15 text-[#FF6A00] text-xs font-bold flex items-center justify-center shrink-0">
                            {firstGraphemes(display || u.email || 'U', 1).toLocaleUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-semibold text-[#08246B] dark:text-white truncate">
                              {display}
                            </p>
                            {u.authProvider && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[10px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0">
                                {u.authProvider === 'google' ? 'Google' : 'Email'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                            {u.email}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)] shrink-0">
                        <p className="text-[#08246B] dark:text-white font-medium">
                          Joined {ecShort} EC
                        </p>
                        <p>Active {formatDateTime(u.lastActiveAtMs)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'promo' && <PromoVideoStudio />}
      </CategoryPanel>
    </div>
  );
}
