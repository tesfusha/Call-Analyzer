import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Film,
  Layers,
  Lightbulb,
  Megaphone,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { CategoryPanel, CategoryTabs } from '@/src/components/CategoryTabs';
import { CollapsibleSection } from '@/src/components/CollapsibleSection';
import { CustomSelect } from '@/src/components/CustomSelect';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { PromoVideoStudio } from '@/src/components/PromoVideoStudio';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { downloadTextFile } from '@/src/lib/export';
import { firstGraphemes, formatDateTime } from '@/src/lib/format';
import { toEatDateString } from '@/src/lib/gamification';
import { triggerHaptic } from '@/src/lib/haptics';
import {
  markThreadReadByAdmin,
  sendAdminSupportReply,
  setSupportThreadStatus,
  subscribeAdminSupportThreads,
  subscribeSupportMessages,
} from '@/src/lib/supportChat';
import {
  setDesignVersion,
  useDesignVersion,
  type DesignVersion,
} from '@/src/preview/designVersion';
import { useCalls } from '@/src/store/CallsContext';
import type {
  BroadcastAudience,
  BroadcastDisplayMode,
  BroadcastKind,
  BroadcastMessage,
  DailyActiveRecord,
  RegisteredUserRecord,
  SupportMessage,
  SupportThread,
} from '@/src/types/call';

type AdminCategory = 'stats' | 'users' | 'chat' | 'broadcasts' | 'promo';
type Granularity = 'daily' | 'weekly' | 'monthly';
type UserPeriodFilter = 'all' | 'today' | '7d' | '30d';
type UserStatusFilter = 'all' | 'today' | '7d' | 'inactive';
type UserSortKey = 'newest' | 'active' | 'name';

type TimeBucket = {
  key: string;
  label: string;
  subLabel: string;
  newUsers: number;
  activeUsers: number;
};

const PREVIEW_VARIANTS: Array<{
  version: DesignVersion;
  label: string;
  tag: string;
  note: string;
}> = [
  {
    version: 'v1.0.3',
    label: 'Main v1.0.4',
    tag: 'Live Production',
    note: 'Default layout seen by all Android APK & web users',
  },
  {
    version: 'v1.0.5',
    label: 'Unslop v1.0.5',
    tag: 'Editorial UI',
    note: 'Warm palette, refined typography & calmer card rhythm',
  },
  {
    version: 'v1.0.6',
    label: 'Simple v1.0.6',
    tag: '5-Tab Modern',
    note: 'Streamlined Calls, People, Insights, Calendar & Settings',
  },
  {
    version: 'v1.0.7',
    label: 'Business v1.0.7',
    tag: 'CRM & Lead SLA',
    note: 'Work vs personal split, lead queue, callback SLA & deals',
  },
];

const ADMIN_QUICK_REPLIES = [
  'Thanks for reaching out! Looking into this right now.',
  'Please make sure you are on the latest APK version and try again.',
  'Glad that worked! Let me know if you need anything else.',
] as const;

const MS_DAY = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function eatDateOffsetFromToday(daysAgo: number, now: Date): string {
  return toEatDateString(now.getTime() - daysAgo * MS_DAY);
}

function formatRelativeAgo(ms: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - ms);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
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

function safeCsvCell(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

function broadcastKindMeta(kind: BroadcastKind) {
  switch (kind) {
    case 'update':
      return {
        label: 'App Update',
        icon: null,
        flaticon: 'fi-rr-rocket-lunch',
        tileClass: 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] border-[#FF6A00]/30',
        textClass: 'text-[#FF6A00]',
      };
    case 'tip':
      return {
        label: 'Tip',
        icon: Lightbulb,
        flaticon: null,
        tileClass: 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
        textClass: 'text-[#059669] dark:text-[#10B981]',
      };
    case 'urgent':
      return {
        label: 'Urgent',
        icon: AlertTriangle,
        flaticon: null,
        tileClass: 'bg-[#FEF2F2] dark:bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/35',
        textClass: 'text-[#EF4444]',
      };
    default:
      return {
        label: 'Announcement',
        icon: Megaphone,
        flaticon: null,
        tileClass: 'bg-[#EFF6FF] dark:bg-[#4FA3F7]/15 text-[#2563EB] dark:text-[#4FA3F7] border-[#4FA3F7]/35',
        textClass: 'text-[#2563EB] dark:text-[#4FA3F7]',
      };
  }
}

export function AdminTab() {
  const {
    isAdmin,
    profileName,
    fetchRegisteredUsers,
    fetchDailyActiveRecords,
    fetchAllBroadcasts,
    createBroadcast,
    toggleBroadcastActive,
    deleteBroadcast,
    calendarPrefs,
    showNotice,
  } = useCalls();

  const designVersion = useDesignVersion();

  const [activeCategory, setActiveCategory] = useState<AdminCategory>('stats');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [logExpanded, setLogExpanded] = useState<boolean>(false);
  const [showAllDailyLogRows, setShowAllDailyLogRows] = useState<boolean>(false);
  const [previewLabExpanded, setPreviewLabExpanded] = useState<boolean>(false);

  const [users, setUsers] = useState<RegisteredUserRecord[]>([]);
  const [dailyActive, setDailyActive] = useState<DailyActiveRecord[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<UserPeriodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [sortBy, setSortBy] = useState<UserSortKey>('newest');

  // Support Chat Inbox state
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [selectedThreadUid, setSelectedThreadUid] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [chatFilter, setChatFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Broadcast composer state
  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcKind, setBcKind] = useState<BroadcastKind>('update');
  const [bcDisplayMode, setBcDisplayMode] = useState<BroadcastDisplayMode>('banner');
  const [bcAudience, setBcAudience] = useState<BroadcastAudience>('all');
  const [bcActionLabel, setBcActionLabel] = useState('');
  const [bcActionUrl, setBcActionUrl] = useState('');
  const [bcSubmitting, setBcSubmitting] = useState(false);
  const [bcError, setBcError] = useState<string | null>(null);
  const [bcBusyId, setBcBusyId] = useState<string | null>(null);
  const [bcConfirmDeleteId, setBcConfirmDeleteId] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [usersRes, activeRes, broadcastsRes] = await Promise.allSettled([
        fetchRegisteredUsers(),
        fetchDailyActiveRecords(),
        fetchAllBroadcasts(),
      ]);
      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value);
      }
      if (activeRes.status === 'fulfilled') {
        setDailyActive(activeRes.value);
      }
      if (broadcastsRes.status === 'fulfilled') {
        setBroadcasts(broadcastsRes.value);
      }
      if (
        usersRes.status === 'rejected' ||
        activeRes.status === 'rejected' ||
        broadcastsRes.status === 'rejected'
      ) {
        const parts: string[] = [];
        if (usersRes.status === 'rejected') {
          parts.push(`userRegistry: ${parseFirestoreReason(usersRes.reason)}`);
        }
        if (activeRes.status === 'rejected') {
          parts.push(`dailyActive: ${parseFirestoreReason(activeRes.reason)}`);
        }
        if (broadcastsRes.status === 'rejected') {
          parts.push(`broadcasts: ${parseFirestoreReason(broadcastsRes.reason)}`);
        }
        const msg = `Could not load full admin data (${parts.join('; ')}).`;
        setLoadError(msg);
        showNotice('Some admin data failed to load.');
      }
    } catch (err) {
      const msg = `Could not load admin analytics: ${parseFirestoreReason(err)}`;
      setLoadError(msg);
      showNotice('Could not load admin analytics right now.');
    } finally {
      setLoading(false);
    }
  }, [fetchAllBroadcasts, fetchDailyActiveRecords, fetchRegisteredUsers, isAdmin, showNotice]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  // Live subscription to user support chat threads for Admin
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeAdminSupportThreads(
      (threads) => {
        setSupportThreads(threads);
      },
      () => {
        // Ignore transient offline error
      },
    );
    return () => unsub();
  }, [isAdmin]);

  // Subscribe to messages for the currently open support thread
  useEffect(() => {
    if (!isAdmin || !selectedThreadUid) {
      setThreadMessages([]);
      return;
    }
    const unsub = subscribeSupportMessages(
      selectedThreadUid,
      { asAdmin: true },
      (msgs) => {
        setThreadMessages(msgs);
      },
    );
    return () => unsub();
  }, [isAdmin, selectedThreadUid]);

  const selectedThread = useMemo(
    () => supportThreads.find((t) => t.uid === selectedThreadUid) ?? null,
    [supportThreads, selectedThreadUid],
  );

  // Mark thread read by admin when opened with unread messages
  useEffect(() => {
    if (activeCategory === 'chat' && selectedThread && selectedThread.unreadByAdmin) {
      void markThreadReadByAdmin(selectedThread.uid);
    }
  }, [activeCategory, selectedThread]);

  useEffect(() => {
    if (activeCategory === 'chat' && selectedThreadUid) {
      chatScrollRef.current?.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [threadMessages, activeCategory, selectedThreadUid]);

  const unreadSupportCount = useMemo(
    () => supportThreads.filter((t) => t.unreadByAdmin).length,
    [supportThreads],
  );

  const activeBroadcastCount = useMemo(
    () => broadcasts.filter((b) => b.active).length,
    [broadcasts],
  );

  const adminCategories = useMemo(
    () => [
      {
        key: 'stats' as AdminCategory,
        label: 'Stats',
        description: 'Active clients, retention health, growth trends, and admin preview lab',
        icon: BarChart3,
      },
      {
        key: 'users' as AdminCategory,
        label: 'Users',
        description: 'Organized account directory with join timeline, activity status, and CSV export',
        icon: Users,
        count: users.length || undefined,
      },
      {
        key: 'chat' as AdminCategory,
        label: 'Inbox',
        description: 'Reply to user questions, bug reports, and feedback in real time',
        icon: MessageSquare,
        count: unreadSupportCount > 0 ? unreadSupportCount : undefined,
      },
      {
        key: 'broadcasts' as AdminCategory,
        label: 'Broadcasts',
        description: 'Publish in-app update notices, tips, and announcements to users',
        icon: Megaphone,
        count: activeBroadcastCount > 0 ? activeBroadcastCount : undefined,
      },
      {
        key: 'promo' as AdminCategory,
        label: 'Promo',
        description: 'Generate & export 9:16, 1:1, and 16:9 social promo animations',
        icon: Film,
      },
    ],
    [users.length, unreadSupportCount, activeBroadcastCount],
  );

  const now = useMemo(() => new Date(), [users, dailyActive, supportThreads]);
  const nowMs = now.getTime();
  const todayStart = useMemo(() => startOfDay(now), [now]);
  const yesterdayStart = todayStart - MS_DAY;
  const weekStart = useMemo(() => nowMs - 7 * MS_DAY, [nowMs]);
  const monthStart = useMemo(() => nowMs - 30 * MS_DAY, [nowMs]);

  const todayEat = useMemo(() => toEatDateString(nowMs), [nowMs]);
  const sevenDaysAgoEat = useMemo(() => eatDateOffsetFromToday(6, now), [now]);
  const thirtyDaysAgoEat = useMemo(() => eatDateOffsetFromToday(29, now), [now]);

  const activeTodayUids = useMemo(() => {
    const s = new Set<string>();
    for (const rec of dailyActive) {
      if (rec.date === todayEat) s.add(rec.uid);
    }
    return s;
  }, [dailyActive, todayEat]);

  const active7dUids = useMemo(() => {
    const s = new Set<string>();
    for (const rec of dailyActive) {
      if (rec.date >= sevenDaysAgoEat && rec.date <= todayEat) s.add(rec.uid);
    }
    return s;
  }, [dailyActive, sevenDaysAgoEat, todayEat]);

  const active30dUids = useMemo(() => {
    const s = new Set<string>();
    for (const rec of dailyActive) {
      if (rec.date >= thirtyDaysAgoEat && rec.date <= todayEat) s.add(rec.uid);
    }
    return s;
  }, [dailyActive, thirtyDaysAgoEat, todayEat]);

  const getUserActivityBucket = useCallback(
    (u: RegisteredUserRecord): 'today' | '7d' | 'inactive' => {
      if (activeTodayUids.has(u.uid) || u.lastActiveAtMs >= todayStart) return 'today';
      if (active7dUids.has(u.uid) || u.lastActiveAtMs >= weekStart) return '7d';
      return 'inactive';
    },
    [activeTodayUids, active7dUids, todayStart, weekStart],
  );

  const summary = useMemo(() => {
    const total = users.length;
    const newDaily = users.filter((u) => u.registeredAtMs >= todayStart).length;
    const newWeekly = users.filter((u) => u.registeredAtMs >= weekStart).length;
    const newMonthly = users.filter((u) => u.registeredAtMs >= monthStart).length;

    const activeToday = activeTodayUids.size;
    const active7d = active7dUids.size;
    const active30d = active30dUids.size;

    const stickinessPct =
      active30d > 0 ? Math.min(100, Math.round((activeToday / active30d) * 100)) : 0;
    const active7dRatePct =
      total > 0 ? Math.min(100, Math.round((active7d / total) * 100)) : 0;
    const dormant30d = users.filter(
      (u) => !active30dUids.has(u.uid) && u.lastActiveAtMs < monthStart,
    ).length;

    return {
      total,
      newDaily,
      activeToday,
      newWeekly,
      active7d,
      newMonthly,
      active30d,
      stickinessPct,
      active7dRatePct,
      dormant30d,
    };
  }, [
    users,
    todayStart,
    weekStart,
    monthStart,
    activeTodayUids,
    active7dUids,
    active30dUids,
  ]);

  const statusCounts = useMemo(() => {
    let today = 0;
    let week = 0;
    let inactive = 0;
    for (const u of users) {
      const b = getUserActivityBucket(u);
      if (b === 'today') today += 1;
      else if (b === '7d') week += 1;
      else inactive += 1;
    }
    return { all: users.length, today, week, inactive };
  }, [users, getUserActivityBucket]);

  const buckets = useMemo(
    () => buildBuckets(users, dailyActive, granularity, now),
    [users, dailyActive, granularity, now],
  );

  const maxBucketVal = useMemo(
    () => Math.max(1, ...buckets.map((b) => Math.max(b.newUsers, b.activeUsers))),
    [buckets],
  );

  const latestBucket = buckets[buckets.length - 1] ?? null;

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = users.filter((u) => {
      if (periodFilter === 'today' && u.registeredAtMs < todayStart) return false;
      if (periodFilter === '7d' && u.registeredAtMs < weekStart) return false;
      if (periodFilter === '30d' && u.registeredAtMs < monthStart) return false;
      if (statusFilter !== 'all' && getUserActivityBucket(u) !== statusFilter) return false;
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
  }, [
    users,
    searchQuery,
    periodFilter,
    statusFilter,
    sortBy,
    todayStart,
    weekStart,
    monthStart,
    getUserActivityBucket,
  ]);

  const groupedUsers = useMemo(() => {
    if (sortBy !== 'newest') {
      return [
        {
          key: 'flat',
          label: sortBy === 'active' ? 'Sorted by Recently Active' : 'Sorted A–Z',
          items: filteredUsers,
        },
      ];
    }
    const groups: Array<{ key: string; label: string; items: RegisteredUserRecord[] }> = [
      { key: 'today', label: 'Joined Today', items: [] },
      { key: 'yesterday', label: 'Joined Yesterday', items: [] },
      { key: 'week', label: 'This Week (Last 7 Days)', items: [] },
      { key: 'month', label: 'This Month (Last 30 Days)', items: [] },
      { key: 'earlier', label: 'Earlier', items: [] },
    ];
    for (const u of filteredUsers) {
      if (u.registeredAtMs >= todayStart) groups[0].items.push(u);
      else if (u.registeredAtMs >= yesterdayStart) groups[1].items.push(u);
      else if (u.registeredAtMs >= weekStart) groups[2].items.push(u);
      else if (u.registeredAtMs >= monthStart) groups[3].items.push(u);
      else groups[4].items.push(u);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [filteredUsers, sortBy, todayStart, yesterdayStart, weekStart, monthStart]);

  const filteredThreads = useMemo(() => {
    if (chatFilter === 'all') return supportThreads;
    return supportThreads.filter((t) => t.status === chatFilter);
  }, [supportThreads, chatFilter]);

  const handleExportUsersCsv = async () => {
    if (filteredUsers.length === 0) {
      showNotice('No users to export.');
      return;
    }
    triggerHaptic('tap');
    const headers = ['Name', 'Email', 'Provider', 'Status', 'Joined (ISO)', 'Last Active (ISO)'];
    const rows = filteredUsers.map((u) => {
      const status = getUserActivityBucket(u);
      const statusLabel = status === 'today' ? 'Today' : status === '7d' ? '7d' : 'Inactive';
      return [
        safeCsvCell(u.displayName.trim() || 'Registered User'),
        safeCsvCell(u.email),
        safeCsvCell(u.authProvider === 'google' ? 'Google' : 'Email'),
        safeCsvCell(statusLabel),
        safeCsvCell(new Date(u.registeredAtMs).toISOString()),
        safeCsvCell(new Date(u.lastActiveAtMs).toISOString()),
      ].join(',');
    });
    const csv = `\uFEFF${headers.join(',')}\n${rows.join('\n')}`;
    const filename = `call-analyzer-users-${todayEat}.csv`;
    try {
      await downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
      showNotice(`Exported ${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'} to CSV.`, 'success');
    } catch {
      showNotice('Could not export users CSV.');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadUid || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      await sendAdminSupportReply({
        threadUid: selectedThreadUid,
        text: replyText.trim(),
        adminName: profileName || 'Admin Support',
      });
      setReplyText('');
      triggerHaptic('success');
    } catch (err) {
      showNotice(`Reply failed: ${parseFirestoreReason(err)}`);
    } finally {
      setSendingReply(false);
    }
  };

  const handleToggleThreadStatus = async (thread: SupportThread) => {
    const nextStatus = thread.status === 'resolved' ? 'open' : 'resolved';
    try {
      await setSupportThreadStatus(thread.uid, nextStatus);
      showNotice(nextStatus === 'resolved' ? 'Marked thread as resolved.' : 'Reopened support thread.');
    } catch (err) {
      showNotice(`Failed to update status: ${parseFirestoreReason(err)}`);
    }
  };

  const handlePublishBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBcError(null);
    const title = bcTitle.trim();
    const message = bcMessage.trim();
    const actionLabel = bcActionLabel.trim();
    const actionUrl = bcActionUrl.trim();

    if (title.length < 2) {
      setBcError('Title must be at least 2 characters.');
      return;
    }
    if (message.length < 4) {
      setBcError('Message must be at least 4 characters.');
      return;
    }
    if (actionUrl && !/^https:\/\/\S+$/i.test(actionUrl)) {
      setBcError('Optional link must start with https://');
      return;
    }

    setBcSubmitting(true);
    try {
      const created = await createBroadcast({
        title,
        message,
        kind: bcKind,
        displayMode: bcDisplayMode,
        audience: bcAudience,
        actionLabel: actionLabel || null,
        actionUrl: actionUrl || null,
        active: true,
      });
      setBroadcasts((prev) => [created, ...prev]);
      setBcTitle('');
      setBcMessage('');
      setBcActionLabel('');
      setBcActionUrl('');
      triggerHaptic('success');
      showNotice('Broadcast published to users.', 'success');
    } catch (err) {
      setBcError(parseFirestoreReason(err));
    } finally {
      setBcSubmitting(false);
    }
  };

  const handleToggleBroadcast = async (item: BroadcastMessage) => {
    setBcBusyId(item.id);
    try {
      const nextActive = !item.active;
      await toggleBroadcastActive(item.id, nextActive);
      setBroadcasts((prev) =>
        prev.map((b) =>
          b.id === item.id ? { ...b, active: nextActive, updatedAtMs: Date.now() } : b,
        ),
      );
      showNotice(nextActive ? 'Broadcast activated.' : 'Broadcast paused.');
    } catch (err) {
      showNotice(`Failed to update broadcast: ${parseFirestoreReason(err)}`);
    } finally {
      setBcBusyId(null);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    setBcBusyId(id);
    try {
      await deleteBroadcast(id);
      setBroadcasts((prev) => prev.filter((b) => b.id !== id));
      setBcConfirmDeleteId(null);
      showNotice('Broadcast deleted.');
    } catch (err) {
      showNotice(`Failed to delete broadcast: ${parseFirestoreReason(err)}`);
    } finally {
      setBcBusyId(null);
    }
  };

  const activeMeta =
    adminCategories.find((cat) => cat.key === activeCategory) ?? adminCategories[0];

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
          {activeCategory !== 'promo' && activeCategory !== 'chat' && (
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
          items={adminCategories}
          activeKey={activeCategory}
          onChange={setActiveCategory}
          showIcons
          ariaLabel="Admin categories"
        />
      </div>

      {activeCategory !== 'promo' && loadError && (
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

      <CategoryPanel activeKey={activeCategory} label={activeMeta.label}>
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

            {/* Retention & Health Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Stickiness (DAU / MAU)
                  </p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#08246B] dark:text-white">
                    {summary.stickinessPct}%
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
                  <TrendingUp size={17} />
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    7-Day Active Rate
                  </p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#08246B] dark:text-white">
                    {summary.active7dRatePct}%
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] dark:bg-[#4FA3F7]/15 text-[#4FA3F7] flex items-center justify-center shrink-0">
                  <Activity size={17} />
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Dormant (30d+ inactive)
                  </p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#08246B] dark:text-white">
                    {summary.dormant30d}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] flex items-center justify-center shrink-0">
                  <UserX size={17} />
                </div>
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
                            style={{
                              height: `${b.newUsers > 0 ? Math.max(8, newH) : 3}%`,
                              opacity: b.newUsers > 0 ? 1 : 0.25,
                            }}
                          />
                          <div
                            title={`${b.label}: ${b.activeUsers} active clients`}
                            className="w-2.5 rounded-t bg-[#4FA3F7] transition-all"
                            style={{
                              height: `${b.activeUsers > 0 ? Math.max(8, actH) : 3}%`,
                              opacity: b.activeUsers > 0 ? 1 : 0.25,
                            }}
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

            {/* Accordion: Daily / Weekly / Monthly Log (collapsed by default to reduce clutter) */}
            <CollapsibleSection
              title={
                granularity === 'daily'
                  ? 'Daily Log'
                  : granularity === 'weekly'
                    ? 'Weekly Log'
                    : 'Monthly Log'
              }
              summary={
                latestBucket
                  ? `${latestBucket.label}: +${latestBucket.newUsers} new · ${latestBucket.activeUsers} active · ${buckets.length} periods`
                  : `${buckets.length} periods`
              }
              icon={CalendarDays}
              open={logExpanded}
              onToggle={() => setLogExpanded((v) => !v)}
              rightHint={logExpanded ? 'Collapse' : 'Expand'}
              contentClassName="px-4 sm:px-5 pb-3"
            >
              {(() => {
                const orderedBuckets = [...buckets].reverse();
                const canTrimDaily = granularity === 'daily' && orderedBuckets.length > 7;
                const displayedBuckets =
                  canTrimDaily && !showAllDailyLogRows
                    ? orderedBuckets.slice(0, 7)
                    : orderedBuckets;
                return (
                  <>
                    <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)]">
                      {displayedBuckets.map((b) => (
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
                    {canTrimDaily && (
                      <div className="pt-2 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            setShowAllDailyLogRows((v) => !v);
                          }}
                          className="min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 transition-colors"
                        >
                          {showAllDailyLogRows
                            ? 'Show latest 7 days'
                            : `Show all ${orderedBuckets.length} days`}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </CollapsibleSection>

            {/* Accordion: Admin-Only UI Preview Lab */}
            <CollapsibleSection
              title="UI Preview Lab (Admin Only)"
              summary={`Active: ${PREVIEW_VARIANTS.find((v) => v.version === designVersion)?.label ?? 'Main v1.0.4'} · Hidden from normal users & APK`}
              icon={Layers}
              open={previewLabExpanded}
              onToggle={() => setPreviewLabExpanded((v) => !v)}
              rightHint={previewLabExpanded ? 'Hide' : 'Open'}
              contentClassName="px-4 sm:px-5 pb-4 pt-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PREVIEW_VARIANTS.map((variant) => {
                  const active = designVersion === variant.version;
                  return (
                    <button
                      key={variant.version}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setDesignVersion(variant.version);
                        showNotice(`Switched admin preview to ${variant.label}.`, 'tap');
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? 'border-[#FF6A00] bg-[#FFF0E6]/70 dark:bg-[#FF6A00]/15'
                          : 'border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] hover:border-[#FF6A00]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#08246B] dark:text-white flex items-center gap-1.5">
                          <Eye size={13} className={active ? 'text-[#FF6A00]' : 'text-[#8A93A0]'} />
                          {variant.label}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                            active
                              ? 'bg-[#FF6A00] text-white'
                              : 'bg-[#EEF2F6] dark:bg-[var(--dark-surface)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                          }`}
                        >
                          {active ? 'Active' : variant.tag}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] leading-snug">
                        {variant.note}
                      </p>
                    </button>
                  );
                })}
              </div>
            </CollapsibleSection>
          </>
        )}

        {activeCategory === 'users' && (
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 sm:p-5 space-y-4">
            {/* Header Row with Clean Non-Clipping Export Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EEF2F6] dark:border-[var(--dark-border)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                  <Users size={17} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#08246B] dark:text-white truncate">
                    Registered Directory
                  </h2>
                  <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Showing {filteredUsers.length} of {users.length} account{users.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={filteredUsers.length === 0}
                onClick={() => void handleExportUsersCsv()}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] hover:border-[#FF6A00] disabled:opacity-40 text-xs font-semibold text-[#08246B] dark:text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Download size={14} className="text-[#FF6A00]" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Search & Responsive Controls (Never Clips on Mobile) */}
            <div className="space-y-2.5">
              <div className="relative">
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

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                <CustomSelect
                  value={periodFilter}
                  onChange={(v) => setPeriodFilter(v as UserPeriodFilter)}
                  ariaLabel="Filter users by registration date"
                  className="w-full sm:w-auto"
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
                  className="w-full sm:w-auto"
                  options={[
                    { value: 'newest', label: 'Newest joined' },
                    { value: 'active', label: 'Recently active' },
                    { value: 'name', label: 'Name A–Z' },
                  ]}
                />
              </div>

              {/* Activity Status Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'all', label: 'All', count: statusCounts.all },
                    { key: 'today', label: 'Active Today', count: statusCounts.today },
                    { key: '7d', label: '7d Active', count: statusCounts.week },
                    { key: 'inactive', label: 'Inactive', count: statusCounts.inactive },
                  ] as const
                ).map((chip) => {
                  const selected = statusFilter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setStatusFilter(chip.key);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                        selected
                          ? 'bg-[#FF6A00] text-white border-[#FF6A00]'
                          : 'bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:border-[#FF6A00]/60'
                      }`}
                    >
                      <span>{chip.label}</span>
                      <span
                        className={`font-mono tabular-nums text-[10px] ${
                          selected ? 'text-white/90' : 'text-[#8A93A0]'
                        }`}
                      >
                        {chip.count}
                      </span>
                    </button>
                  );
                })}
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
              <div className="space-y-4">
                {groupedUsers.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        {group.label}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums font-semibold text-[#FF6A00]">
                        {group.items.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((u) => {
                        const regDate = new Date(u.registeredAtMs);
                        const ecShort = formatEthiopianShort(regDate, calendarPrefs.defaultLang);
                        const gcShort = regDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });
                        const display = u.displayName.trim() || 'Registered User';
                        const status = getUserActivityBucket(u);
                        const statusTextClass =
                          status === 'today'
                            ? 'text-[#059669] dark:text-[#6EE7B7]'
                            : status === '7d'
                              ? 'text-[#2563EB] dark:text-[#93C5FD]'
                              : 'text-[#6B7280] dark:text-[var(--dark-text-secondary)]';
                        const statusLabel =
                          status === 'today'
                            ? 'Active today'
                            : status === '7d'
                              ? 'Active 7d'
                              : 'Inactive';
                        const providerLabel = u.authProvider
                          ? u.authProvider === 'google'
                            ? 'Google'
                            : 'Email'
                          : null;

                        return (
                          <div
                            key={u.uid}
                            className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-center gap-2.5 min-w-0">
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
                                  <p className="text-xs sm:text-sm font-semibold text-[#08246B] dark:text-white truncate">
                                    {display}
                                  </p>
                                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                                    {u.email}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap shrink-0">
                                {providerLabel && (
                                  <>
                                    <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] font-medium">
                                      {providerLabel}
                                    </span>
                                    <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#4B5563]">
                                      ·
                                    </span>
                                  </>
                                )}
                                <span className={statusTextClass}>{statusLabel}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-[#E5EBF1] dark:border-[var(--dark-border)]/70 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CalendarDays size={12} className="text-[#FF6A00] shrink-0" />
                                <span className="truncate">
                                  Joined {ecShort} EC · {gcShort} ({formatRelativeAgo(u.registeredAtMs, nowMs)})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:justify-end min-w-0">
                                <Clock size={12} className="text-[#4FA3F7] shrink-0" />
                                <span className="truncate">
                                  Active {formatRelativeAgo(u.lastActiveAtMs, nowMs)} · {formatDateTime(u.lastActiveAtMs)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'chat' && (
          <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
              {/* Thread List Pane */}
              <div
                className={`lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col ${
                  selectedThreadUid ? 'hidden lg:flex' : 'flex'
                }`}
              >
                <div className="p-4 border-b border-[#EEF2F6] dark:border-[var(--dark-border)] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                        <MessageSquare size={17} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-bold text-[#08246B] dark:text-white truncate">
                          User Support Inbox
                        </h2>
                        <p className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          {unreadSupportCount} unread · {supportThreads.length} total
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { key: 'all', label: 'All' },
                        { key: 'open', label: 'Open' },
                        { key: 'resolved', label: 'Resolved' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setChatFilter(f.key)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          chatFilter === f.key
                            ? 'bg-[#FF6A00] text-white'
                            : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[#EEF2F6] dark:divide-[var(--dark-border)] max-h-[500px]">
                  {filteredThreads.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <MessageSquare size={22} className="mx-auto text-[#8A93A0]" />
                      <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                        No support messages yet
                      </p>
                      <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        When users send a message via Chat with Admin, their thread appears here live.
                      </p>
                    </div>
                  ) : (
                    filteredThreads.map((t) => {
                      const active = t.uid === selectedThreadUid;
                      return (
                        <button
                          key={t.uid}
                          type="button"
                          onClick={() => {
                            triggerHaptic('tap');
                            setSelectedThreadUid(t.uid);
                          }}
                          className={`w-full p-3.5 text-left flex items-start gap-2.5 transition-colors ${
                            active
                              ? 'bg-[#FFF0E6]/70 dark:bg-[#FF6A00]/12'
                              : 'hover:bg-[#F8FAFC] dark:hover:bg-[var(--dark-elevated)]/60'
                          }`}
                        >
                          <div className="relative shrink-0">
                            {t.userPhotoUrl ? (
                              <img
                                src={t.userPhotoUrl}
                                alt={t.userName}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-full object-cover border border-[#DDE4EA] dark:border-[var(--dark-border)]"
                              />
                            ) : (
                              <span className="w-9 h-9 rounded-full bg-[#FF6A00]/15 text-[#FF6A00] text-xs font-bold flex items-center justify-center">
                                {firstGraphemes(t.userName || t.userEmail || 'U', 1).toLocaleUpperCase()}
                              </span>
                            )}
                            {t.unreadByAdmin && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF6A00] ring-2 ring-white dark:ring-[var(--dark-surface)]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                                {t.userName}
                              </p>
                              <span className="text-[10px] font-mono tabular-nums text-[#8A93A0] shrink-0">
                                {formatRelativeAgo(t.lastMessageAtMs, nowMs)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                              {t.lastMessageSender === 'admin' ? 'You: ' : ''}
                              {t.lastMessageText || 'Started a conversation'}
                            </p>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                  t.status === 'resolved'
                                    ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#10B981]'
                                    : 'bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00]'
                                }`}
                              >
                                {t.status === 'resolved' ? 'Resolved' : 'Open'}
                              </span>
                              <span className="text-[10px] text-[#8A93A0] truncate">
                                {t.userEmail}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Conversation Detail Pane */}
              <div
                className={`lg:col-span-7 flex flex-col ${
                  selectedThreadUid ? 'flex' : 'hidden lg:flex'
                }`}
              >
                {!selectedThread ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
                    <div className="w-11 h-11 rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#8A93A0] flex items-center justify-center">
                      <MessageSquare size={20} />
                    </div>
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                      Select a conversation
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] max-w-xs">
                      Choose a user thread from the left to read messages and send a live reply.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Thread Header */}
                    <div className="px-4 py-3 border-b border-[#EEF2F6] dark:border-[var(--dark-border)] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedThreadUid(null)}
                          aria-label="Back to threads"
                          className="lg:hidden w-8 h-8 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-center text-[#08246B] dark:text-white shrink-0"
                        >
                          <ArrowLeft size={15} />
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                            {selectedThread.userName}
                          </p>
                          <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                            {selectedThread.userEmail}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleThreadStatus(selectedThread)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors ${
                          selectedThread.status === 'resolved'
                            ? 'border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00]'
                            : 'border-[#10B981]/40 bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#059669] dark:text-[#6EE7B7]'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>{selectedThread.status === 'resolved' ? 'Reopen' : 'Resolve'}</span>
                      </button>
                    </div>

                    {/* Messages */}
                    <div
                      ref={chatScrollRef}
                      className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F5F7FA]/60 dark:bg-[var(--dark-canvas)]/50 max-h-[360px]"
                    >
                      {threadMessages.map((m) => {
                        const isAdminMsg = m.senderRole === 'admin';
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isAdminMsg ? 'items-end' : 'items-start'}`}
                          >
                            <span className="mb-1 px-1 text-[10px] font-semibold text-[#8A93A0] inline-flex items-center gap-1">
                              {isAdminMsg && <ShieldCheck size={10} className="text-[#FF6A00]" />}
                              {isAdminMsg ? 'Admin' : m.senderName}
                            </span>
                            <div
                              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words shadow-xs ${
                                isAdminMsg
                                  ? 'rounded-br-sm bg-[#FF6A00] text-white'
                                  : 'rounded-tl-sm bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white'
                              }`}
                            >
                              {m.text}
                            </div>
                            <span className="mt-1 px-1 text-[10px] font-mono tabular-nums text-[#8A93A0]">
                              {formatDateTime(m.createdAtMs)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Replies + Composer */}
                    <div className="p-3 border-t border-[#EEF2F6] dark:border-[var(--dark-border)] space-y-2">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {ADMIN_QUICK_REPLIES.map((qr) => (
                          <button
                            key={qr}
                            type="button"
                            onClick={() => setReplyText(qr)}
                            className="px-2.5 py-1 rounded-lg bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 text-[10px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] whitespace-nowrap shrink-0 transition-colors"
                          >
                            {qr}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleSendReply} className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={800}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply to ${selectedThread.userName}...`}
                          className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                        />
                        <button
                          type="submit"
                          disabled={sendingReply || !replyText.trim()}
                          aria-label="Send admin reply"
                          className="min-h-[40px] px-3.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-40 text-xs font-semibold text-white inline-flex items-center gap-1.5 shrink-0 transition-colors"
                        >
                          <Send size={14} />
                          <span>Send</span>
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeCategory === 'broadcasts' && (
          <div className="space-y-4">
            {/* Compose Broadcast Form */}
            <form
              onSubmit={handlePublishBroadcast}
              className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                    <Megaphone size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#08246B] dark:text-white">
                      New Broadcast Message
                    </h3>
                    <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      Users see active broadcasts on launch until they dismiss them
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-[#FF6A00] font-semibold shrink-0">
                  {activeBroadcastCount} live
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Category
                  </label>
                  <CustomSelect
                    fullWidth
                    value={bcKind}
                    onChange={(v) => setBcKind(v as BroadcastKind)}
                    ariaLabel="Broadcast category"
                    options={[
                      { value: 'update', label: 'App Update' },
                      { value: 'announcement', label: 'Announcement' },
                      { value: 'tip', label: 'Helpful Tip' },
                      { value: 'urgent', label: 'Urgent Notice' },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Display Style
                  </label>
                  <CustomSelect
                    fullWidth
                    value={bcDisplayMode}
                    onChange={(v) => setBcDisplayMode(v as BroadcastDisplayMode)}
                    ariaLabel="Broadcast display style"
                    options={[
                      { value: 'banner', label: 'Top Banner' },
                      { value: 'popup', label: 'Popup Modal' },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Target Audience
                  </label>
                  <CustomSelect
                    fullWidth
                    value={bcAudience}
                    onChange={(v) => setBcAudience(v as BroadcastAudience)}
                    ariaLabel="Broadcast audience"
                    options={[
                      { value: 'all', label: 'All Users' },
                      { value: 'android', label: 'Android APK Only' },
                      { value: 'web', label: 'Web Only' },
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <label
                    htmlFor="admin-bc-title"
                    className="font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                  >
                    Title
                  </label>
                  <span className="font-mono tabular-nums text-[#8A93A0]">
                    {bcTitle.length}/100
                  </span>
                </div>
                <input
                  id="admin-bc-title"
                  type="text"
                  maxLength={100}
                  value={bcTitle}
                  onChange={(e) => setBcTitle(e.target.value)}
                  placeholder="e.g. Call Analyzer v1.0.5 is now available"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <label
                    htmlFor="admin-bc-message"
                    className="font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                  >
                    Message
                  </label>
                  <span className="font-mono tabular-nums text-[#8A93A0]">
                    {bcMessage.length}/500
                  </span>
                </div>
                <textarea
                  id="admin-bc-message"
                  rows={3}
                  maxLength={500}
                  value={bcMessage}
                  onChange={(e) => setBcMessage(e.target.value)}
                  placeholder="Write a concise update or announcement for your users..."
                  className="w-full p-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00] resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label
                    htmlFor="admin-bc-action-label"
                    className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                  >
                    Action Button Label (optional)
                  </label>
                  <input
                    id="admin-bc-action-label"
                    type="text"
                    maxLength={40}
                    value={bcActionLabel}
                    onChange={(e) => setBcActionLabel(e.target.value)}
                    placeholder="e.g. Download APK / Join Telegram"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="admin-bc-action-url"
                    className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                  >
                    Action Link (optional, https:// only)
                  </label>
                  <input
                    id="admin-bc-action-url"
                    type="url"
                    maxLength={300}
                    value={bcActionUrl}
                    onChange={(e) => setBcActionUrl(e.target.value)}
                    placeholder="https://t.me/..."
                    className="w-full min-h-[40px] px-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                  />
                </div>
              </div>

              {bcError && (
                <p className="text-xs font-medium text-[#DC2626] dark:text-[#FCA5A5]">
                  {bcError}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={bcSubmitting}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                >
                  <Send size={14} />
                  {bcSubmitting ? 'Publishing...' : 'Publish Broadcast'}
                </button>
              </div>
            </form>

            {/* Broadcast History */}
            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#08246B] dark:text-white">
                  Published Broadcasts ({broadcasts.length})
                </h3>
                <span className="text-[11px] font-mono tabular-nums text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  {activeBroadcastCount} active · {broadcasts.length - activeBroadcastCount} paused
                </span>
              </div>

              {broadcasts.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                  No broadcasts published yet. Create one above to notify all app users.
                </p>
              ) : (
                <div className="divide-y divide-[#DDE4EA] dark:divide-[var(--dark-border)]">
                  {broadcasts.map((item) => {
                    const meta = broadcastKindMeta(item.kind);
                    const KindIcon = meta.icon;
                    const busy = bcBusyId === item.id;
                    const confirmingDelete = bcConfirmDeleteId === item.id;

                    return (
                      <div key={item.id} className="py-3.5 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${meta.tileClass}`}
                            >
                              {meta.flaticon ? (
                                <FlaticonIcon name={meta.flaticon} className="text-[17px]" />
                              ) : (
                                KindIcon && <KindIcon size={17} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                <span className={`font-semibold ${meta.textClass}`}>
                                  {meta.label}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{item.displayMode === 'popup' ? 'Popup' : 'Banner'}</span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {item.audience === 'all'
                                    ? 'All users'
                                    : item.audience === 'android'
                                      ? 'Android'
                                      : 'Web'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`font-semibold ${
                                    item.active ? 'text-[#059669] dark:text-[#10B981]' : 'text-[#8A93A0]'
                                  }`}
                                >
                                  {item.active ? 'Live' : 'Paused'}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-[#08246B] dark:text-white break-words">
                                {item.title}
                              </p>
                              <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] whitespace-pre-line break-words">
                                {item.message}
                              </p>
                              {item.actionUrl && /^https:\/\/\S+$/i.test(item.actionUrl) && (
                                <a
                                  href={item.actionUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF6A00] hover:underline"
                                >
                                  <span>{item.actionLabel || item.actionUrl}</span>
                                  <ExternalLink size={11} />
                                </a>
                              )}
                              <p className="text-[10px] font-mono tabular-nums text-[#8A93A0]">
                                Created {formatDateTime(item.createdAtMs)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggleBroadcast(item)}
                              className="min-h-[34px] px-2.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] hover:border-[#FF6A00] disabled:opacity-50 text-[11px] font-semibold text-[#08246B] dark:text-white inline-flex items-center gap-1 transition-colors"
                            >
                              {item.active ? (
                                <>
                                  <PauseCircle size={13} className="text-[#F59E0B]" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <PlayCircle size={13} className="text-[#10B981]" />
                                  Activate
                                </>
                              )}
                            </button>

                            {confirmingDelete ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleDeleteBroadcast(item.id)}
                                  className="min-h-[34px] px-2.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 text-[11px] font-semibold text-white transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setBcConfirmDeleteId(null)}
                                  className="min-h-[34px] px-2 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setBcConfirmDeleteId(item.id)}
                                aria-label={`Delete broadcast ${item.title}`}
                                className="min-h-[34px] w-8 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-[#EF4444]/15 disabled:opacity-50 flex items-center justify-center transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeCategory === 'promo' && <PromoVideoStudio />}
      </CategoryPanel>
    </div>
  );
}
