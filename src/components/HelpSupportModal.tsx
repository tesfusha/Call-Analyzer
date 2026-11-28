import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Fingerprint,
  HelpCircle,
  LogIn,
  MapPin,
  MessageSquare,
  Palette,
  Phone,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { FlaticonIcon } from '@/src/components/FlaticonIcon';
import { useBackHandler } from '@/src/lib/backNavigation';
import { formatDateTime } from '@/src/lib/format';
import { triggerHaptic } from '@/src/lib/haptics';
import {
  HELP_FAQ_CATEGORIES,
  HELP_FAQ_ENTRIES,
  getFaqById,
  getFaqsByCategory,
  matchHelpFaq,
  searchHelpFaqs,
  type HelpFaqAction,
  type HelpFaqCategory,
  type HelpFaqEntry,
} from '@/src/lib/helpBotFaq';
import {
  markThreadReadByUser,
  sendUserSupportMessage,
  subscribeSupportMessages,
  subscribeUserSupportThread,
} from '@/src/lib/supportChat';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';
import type { SupportMessage, SupportThread } from '@/src/types/call';

export type HelpSupportInitialTab = 'bot' | 'admin';

type BotChatItem =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'bot';
      isWelcome?: boolean;
      title?: string;
      text: string;
      whereToFind?: string;
      steps?: string[];
      followUpIds?: string[];
      action?: HelpFaqAction;
      showAdminCta?: boolean;
    };

const QUICK_START_CARDS: Array<{
  faqId: string;
  title: string;
  subtitle: string;
  icon: typeof Compass;
}> = [
  {
    faqId: 'tour-overview',
    title: 'App Tour',
    subtitle: 'See every feature',
    icon: Compass,
  },
  {
    faqId: 'sync-calls',
    title: 'Sync Calls',
    subtitle: 'Android logs & CSV',
    icon: Phone,
  },
  {
    faqId: 'pin-lock',
    title: 'Biometric & PIN',
    subtitle: 'Auto-lock & reset',
    icon: Fingerprint,
  },
  {
    faqId: 'theme-font',
    title: 'Themes & Fonts',
    subtitle: '5 modern styles',
    icon: Palette,
  },
];

const QUICK_POPULAR_TOPICS = [
  'schedule-reminder',
  'sim-tariffs',
  'ethiopian-calendar',
  'backup-export',
  'streaks-badges',
  'troubleshoot-notifications',
] as const;

const ADMIN_STARTER_PROMPTS = [
  'I found a bug to report',
  'I have a feature suggestion',
  'Need help with Android call sync',
  'Question about my account',
] as const;

function createInitialBotMessages(): BotChatItem[] {
  return [
    {
      id: 'welcome-bot',
      role: 'bot',
      isWelcome: true,
      title: 'How can I help you today?',
      text: 'Pick a quick guide below, type any question, or jump straight to the setting you need — works 100% offline.',
      followUpIds: ['schedule-reminder', 'sim-tariffs', 'ethiopian-calendar', 'backup-export'],
    },
  ];
}

function getCategoryIcon(category: HelpFaqCategory) {
  switch (category) {
    case 'getting-started':
      return Compass;
    case 'reminders':
      return Bell;
    case 'tariffs':
      return Smartphone;
    case 'calendar':
      return BookOpen;
    case 'analytics':
      return HelpCircle;
    case 'privacy':
      return ShieldCheck;
    case 'appearance':
      return Palette;
  }
}

export function HelpSupportModal({
  open,
  initialTab = 'bot',
  onClose,
  onNavigate,
}: {
  open: boolean;
  initialTab?: HelpSupportInitialTab;
  onClose: () => void;
  onNavigate?: (action: HelpFaqAction) => void;
}) {
  const {
    authUser,
    profileName,
    userPhotoUrl,
    openAuthPrompt,
  } = useCalls();

  const prefersReducedMotion = useReducedMotion();
  useLockBodyScroll(open);

  const [tab, setTab] = useState<HelpSupportInitialTab>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<HelpFaqCategory | 'all'>('all');
  const [showTopicsDrawer, setShowTopicsDrawer] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');

  // Offline FAQ Bot state
  const [botInput, setBotInput] = useState('');
  const [botMessages, setBotMessages] = useState<BotChatItem[]>(createInitialBotMessages);
  const [feedbackByMsgId, setFeedbackByMsgId] = useState<Record<string, 'up' | 'down'>>({});

  // Live Admin Chat state
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [adminInput, setAdminInput] = useState('');
  const [sendingAdmin, setSendingAdmin] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const botScrollRef = useRef<HTMLDivElement>(null);
  const adminScrollRef = useRef<HTMLDivElement>(null);
  const categoryRailRef = useRef<HTMLDivElement>(null);
  const [canScrollCatLeft, setCanScrollCatLeft] = useState(false);
  const [canScrollCatRight, setCanScrollCatRight] = useState(false);

  const syncCategoryScrollHints = () => {
    const el = categoryRailRef.current;
    if (!el) return;
    setCanScrollCatLeft(el.scrollLeft > 4);
    setCanScrollCatRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    if (!open || tab !== 'bot') return;
    const raf = window.requestAnimationFrame(syncCategoryScrollHints);
    window.addEventListener('resize', syncCategoryScrollHints);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', syncCategoryScrollHints);
    };
  }, [open, tab, showTopicsDrawer, selectedCategory]);

  const scrollCategoryRail = (direction: -1 | 1) => {
    const el = categoryRailRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * 170,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setChatError(null);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useBackHandler({
    id: 'help-support-modal',
    active: open,
    priority: 65,
    onBack: onClose,
  });

  // Subscribe to user's support thread + messages when modal is open & signed in
  const verifiedUid = authUser && authUser.emailVerified ? authUser.uid : null;
  useEffect(() => {
    if (!open || !verifiedUid) {
      setThread(null);
      setChatMessages([]);
      return;
    }
    const unsubThread = subscribeUserSupportThread(verifiedUid, (next) => {
      setThread(next);
    });
    const unsubMsgs = subscribeSupportMessages(
      verifiedUid,
      { asAdmin: false },
      (msgs) => {
        setChatMessages(msgs);
      },
    );
    return () => {
      unsubThread();
      unsubMsgs();
    };
  }, [open, verifiedUid]);

  // Clear unread badge when user views Admin Chat tab
  useEffect(() => {
    if (open && tab === 'admin' && verifiedUid && thread?.unreadByUser) {
      void markThreadReadByUser(verifiedUid);
    }
  }, [open, tab, verifiedUid, thread?.unreadByUser]);

  // Auto-scroll chat panes
  useEffect(() => {
    if (tab === 'bot' && !showTopicsDrawer) {
      botScrollRef.current?.scrollTo({
        top: botScrollRef.current.scrollHeight,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  }, [botMessages, tab, open, showTopicsDrawer, prefersReducedMotion]);

  useEffect(() => {
    if (tab === 'admin') {
      adminScrollRef.current?.scrollTo({
        top: adminScrollRef.current.scrollHeight,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  }, [chatMessages, tab, open, prefersReducedMotion]);

  const liveSuggestions = useMemo(() => {
    if (botInput.trim().length < 2) return [];
    return searchHelpFaqs(botInput, 3);
  }, [botInput]);

  const pushFaqReply = (entry: HelpFaqEntry, userPromptLabel?: string) => {
    triggerHaptic('tap');
    setShowTopicsDrawer(false);
    setBotInput('');
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setBotMessages((prev) => [
      ...prev,
      ...(userPromptLabel
        ? [{ id: `u_${stamp}`, role: 'user' as const, text: userPromptLabel }]
        : []),
      {
        id: `b_${stamp}`,
        role: 'bot',
        title: entry.title,
        text: entry.answer,
        whereToFind: entry.whereToFind,
        steps: entry.steps,
        followUpIds: entry.followUps,
        action: entry.action,
      },
    ]);
  };

  const handleResetBotChat = () => {
    triggerHaptic('tap');
    setShowTopicsDrawer(false);
    setTopicSearch('');
    setBotInput('');
    setFeedbackByMsgId({});
    setBotMessages(createInitialBotMessages());
  };

  const handleActionClick = (action: HelpFaqAction) => {
    triggerHaptic('tap');
    if (action.kind === 'admin-chat') {
      setTab('admin');
      return;
    }
    if (onNavigate) {
      onNavigate(action);
      onClose();
    }
  };

  const handleBotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = botInput.trim();
    if (!raw) return;
    setBotInput('');
    setShowTopicsDrawer(false);
    triggerHaptic('tap');

    const result = matchHelpFaq(raw);
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (result.matched) {
      const followIds = [
        ...result.matched.followUps,
        ...result.related.map((r) => r.id),
      ]
        .filter((v, idx, arr) => arr.indexOf(v) === idx)
        .slice(0, 4);

      setBotMessages((prev) => [
        ...prev,
        { id: `u_${stamp}`, role: 'user', text: raw },
        {
          id: `b_${stamp}`,
          role: 'bot',
          title: result.matched!.title,
          text: result.matched!.answer,
          whereToFind: result.matched!.whereToFind,
          steps: result.matched!.steps,
          followUpIds: followIds,
          action: result.matched!.action,
        },
      ]);
      return;
    }

    if (result.isGreeting) {
      setBotMessages((prev) => [
        ...prev,
        { id: `u_${stamp}`, role: 'user', text: raw },
        {
          id: `b_${stamp}`,
          role: 'bot',
          title: 'Selam! How can I help today?',
          text: 'Pick a quick guide below or tap "All Topics" to explore every feature in Call Analyzer - ETH.',
          followUpIds: result.related.map((r) => r.id),
        },
      ]);
      return;
    }

    setBotMessages((prev) => [
      ...prev,
      { id: `u_${stamp}`, role: 'user', text: raw },
      {
        id: `b_${stamp}`,
        role: 'bot',
        title: "I didn't find an exact match for that",
        text: 'Try keywords like "sync", "biometric", "fonts", "SIM tariff", "Ethiopian calendar", or "backup" — or message the Admin directly.',
        followUpIds: result.related.map((r) => r.id),
        showAdminCta: true,
      },
    ]);
  };

  const handleSendAdminMessage = async (rawText?: string) => {
    const text = (rawText ?? adminInput).trim();
    if (!text || sendingAdmin) return;
    setChatError(null);
    setSendingAdmin(true);
    try {
      await sendUserSupportMessage({
        text,
        userName: profileName || authUser?.displayName || null,
        userPhotoUrl: userPhotoUrl || authUser?.photoURL || null,
      });
      if (!rawText) setAdminInput('');
      triggerHaptic('success');
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Could not send message right now.');
    } finally {
      setSendingAdmin(false);
    }
  };

  const browseEntries = useMemo(() => {
    const trimmed = topicSearch.trim();
    const base =
      selectedCategory === 'all' ? HELP_FAQ_ENTRIES : getFaqsByCategory(selectedCategory);
    if (!trimmed) return base;
    const matchedIds = new Set(searchHelpFaqs(trimmed, HELP_FAQ_ENTRIES.length).map((e) => e.id));
    return base.filter((e) => matchedIds.has(e.id));
  }, [selectedCategory, topicSearch]);

  const hasConversationStarted = botMessages.length > 1;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="help-support-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-support-title"
            className="w-full sm:max-w-lg h-[90dvh] sm:h-[660px] max-h-[92dvh] rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-2xl overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] shrink-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                    {tab === 'bot' ? (
                      <FlaticonIcon name="fi-rr-chatbot-speech-bubble" className="text-[19px]" />
                    ) : (
                      <FlaticonIcon name="fi-rr-user-headset" className="text-[18px]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="help-support-title"
                      className="text-sm font-bold text-[#08246B] dark:text-white truncate"
                    >
                      {tab === 'bot' ? 'App Helper & FAQ Bot' : 'Chat with Admin'}
                    </h2>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                      {tab === 'bot'
                        ? 'Instant offline answers & one-tap shortcuts'
                        : 'Direct support from the Call Analyzer - ETH team'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {tab === 'bot' && hasConversationStarted && (
                    <button
                      type="button"
                      onClick={handleResetBotChat}
                      aria-label="Start new chat"
                      title="New chat"
                      className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
                    >
                      <RotateCcw size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close help and support"
                    className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* 2-Tab Switcher */}
              <div
                role="tablist"
                aria-label="Help & Support mode"
                className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'bot'}
                  onClick={() => {
                    triggerHaptic('tap');
                    setTab('bot');
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    tab === 'bot'
                      ? 'bg-[#FF6A00] text-white shadow-xs'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  <FlaticonIcon name="fi-rr-chatbot-speech-bubble" className="text-[14px]" />
                  <span>App Helper Bot</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'admin'}
                  onClick={() => {
                    triggerHaptic('tap');
                    setTab('admin');
                  }}
                  className={`relative min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    tab === 'admin'
                      ? 'bg-[#FF6A00] text-white shadow-xs'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  <FlaticonIcon name="fi-rr-user-headset" className="text-[14px]" />
                  <span>Chat with Admin</span>
                  {thread?.unreadByUser && tab !== 'admin' && (
                    <span className="w-2 h-2 rounded-full bg-[#FF6A00] shrink-0" />
                  )}
                </button>
              </div>
            </div>

            {/* TAB 1: Offline Interactive FAQ Bot */}
            {tab === 'bot' && (
              <>
                {/* Organized Mode Switcher & Single-Row Scrollable Category Rail */}
                <div className="px-4 py-2 border-b border-[#EEF2F6] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)]/70 space-y-2 shrink-0">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setShowTopicsDrawer(false);
                      }}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition-colors whitespace-nowrap ${
                        !showTopicsDrawer
                          ? 'bg-[#08246B] dark:bg-[#FF6A00] text-white border-transparent shadow-xs'
                          : 'bg-white dark:bg-[var(--dark-surface)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00] hover:text-[#08246B] dark:hover:text-white'
                      }`}
                    >
                      <MessageSquare size={12} />
                      <span>Assistant</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setSelectedCategory('all');
                        setShowTopicsDrawer(true);
                      }}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition-colors whitespace-nowrap ${
                        showTopicsDrawer && selectedCategory === 'all'
                          ? 'bg-[#08246B] dark:bg-[#FF6A00] text-white border-transparent shadow-xs'
                          : 'bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]'
                      }`}
                    >
                      <Compass size={12} />
                      <span>All Guides ({HELP_FAQ_ENTRIES.length})</span>
                    </button>
                  </div>

                  <div className="relative flex items-center gap-1">
                    {canScrollCatLeft && (
                      <button
                        type="button"
                        onClick={() => scrollCategoryRail(-1)}
                        aria-label="Scroll categories left"
                        className="w-7 h-7 rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center justify-center shrink-0 shadow-xs transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                    )}

                    <div
                      ref={categoryRailRef}
                      onScroll={syncCategoryScrollHints}
                      onWheel={(e) => {
                        const el = categoryRailRef.current;
                        if (!el) return;
                        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
                          el.scrollLeft += e.deltaY;
                        }
                      }}
                      className="flex-1 min-w-0 flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x scroll-smooth"
                    >
                      {HELP_FAQ_CATEGORIES.map((cat) => {
                        const active = showTopicsDrawer && selectedCategory === cat.key;
                        const CatIcon = getCategoryIcon(cat.key);
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={(e) => {
                              triggerHaptic('tap');
                              setSelectedCategory(cat.key);
                              setShowTopicsDrawer(true);
                              e.currentTarget.scrollIntoView({
                                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                                inline: 'center',
                                block: 'nearest',
                              });
                            }}
                            className={`h-7 px-2.5 rounded-lg text-[10.5px] inline-flex items-center gap-1.5 border whitespace-nowrap shrink-0 transition-colors ${
                              active
                                ? 'bg-[#08246B] dark:bg-[#FF6A00] text-white border-transparent font-semibold'
                                : 'bg-white dark:bg-[var(--dark-surface)] border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] font-medium hover:border-[#FF6A00] hover:text-[#08246B] dark:hover:text-white'
                            }`}
                          >
                            <CatIcon size={11} className={active ? 'text-white' : 'text-[#FF6A00]'} />
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {canScrollCatRight && (
                      <button
                        type="button"
                        onClick={() => scrollCategoryRail(1)}
                        aria-label="Scroll categories right"
                        className="w-7 h-7 rounded-lg bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center justify-center shrink-0 shadow-xs transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Browse All Topics Directory OR Assistant Chat */}
                {showTopicsDrawer ? (
                  <div className="flex-1 min-h-0 flex flex-col bg-[#F5F7FA]/60 dark:bg-[var(--dark-canvas)]/40">
                    {/* Directory Search Input */}
                    <div className="px-4 pt-3 pb-2 shrink-0 space-y-2">
                      <div className="relative">
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A0] pointer-events-none"
                        />
                        <input
                          type="text"
                          value={topicSearch}
                          onChange={(e) => setTopicSearch(e.target.value)}
                          placeholder="Search guides (e.g. PIN, biometric, fonts, SIM, sync)..."
                          className="w-full min-h-[38px] pl-8 pr-8 rounded-xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                        />
                        {topicSearch && (
                          <button
                            type="button"
                            onClick={() => setTopicSearch('')}
                            aria-label="Clear topic search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#8A93A0] hover:text-[#08246B] dark:hover:text-white"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        <span>
                          {browseEntries.length} {browseEntries.length === 1 ? 'guide' : 'guides'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTopicsDrawer(false)}
                          className="font-semibold text-[#FF6A00] hover:underline"
                        >
                          Back to Assistant
                        </button>
                      </div>
                    </div>

                    {/* Topic Cards List */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2">
                      {browseEntries.length === 0 ? (
                        <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 text-center space-y-2.5">
                          <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                            No guides match "{topicSearch}"
                          </p>
                          <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            Try another keyword or ask the Admin directly.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setTab('admin');
                              setAdminInput(topicSearch.trim());
                            }}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#FF6A00] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <MessageSquare size={13} />
                            <span>Ask Admin</span>
                          </button>
                        </div>
                      ) : (
                        browseEntries.map((entry) => {
                          const CatIcon = getCategoryIcon(entry.category);
                          return (
                            <div
                              key={entry.id}
                              className="rounded-2xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] p-3.5 space-y-2 hover:border-[#FF6A00]/70 transition-colors"
                            >
                              <button
                                type="button"
                                onClick={() => pushFaqReply(entry, entry.shortLabel)}
                                className="w-full text-left flex items-start gap-2.5"
                              >
                                <div className="w-8 h-8 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0 mt-0.5">
                                  <CatIcon size={15} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-[#08246B] dark:text-white leading-snug">
                                    {entry.title}
                                  </p>
                                  <p className="mt-1 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] line-clamp-2 leading-relaxed">
                                    {entry.answer}
                                  </p>
                                </div>
                              </button>
                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#EEF2F6] dark:border-[var(--dark-border)]">
                                <span className="text-[10px] text-[#8A93A0] truncate flex items-center gap-1 min-w-0">
                                  <MapPin size={10} className="text-[#FF6A00] shrink-0" />
                                  <span className="truncate">{entry.whereToFind}</span>
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {entry.action && onNavigate && (
                                    <button
                                      type="button"
                                      onClick={() => handleActionClick(entry.action!)}
                                      className="px-2.5 py-1 rounded-lg bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] hover:bg-[#FF6A00] hover:text-white text-[11px] font-semibold text-[#08246B] dark:text-white inline-flex items-center gap-1 transition-colors"
                                    >
                                      <span>Open</span>
                                      <ArrowUpRight size={11} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => pushFaqReply(entry, entry.shortLabel)}
                                    className="px-2.5 py-1 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[11px] font-semibold text-[#FF6A00] hover:bg-[#FF6A00] hover:text-white transition-colors"
                                  >
                                    Read Steps
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    ref={botScrollRef}
                    className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 bg-[#F5F7FA]/60 dark:bg-[var(--dark-canvas)]/50"
                  >
                    {botMessages.map((msg) => {
                      if (msg.role === 'user') {
                        return (
                          <motion.div
                            key={msg.id}
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.14 }}
                            className="flex justify-end"
                          >
                            <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-[#FF6A00] text-white px-3.5 py-2 text-xs font-medium leading-relaxed shadow-xs">
                              {msg.text}
                            </div>
                          </motion.div>
                        );
                      }

                      if (msg.isWelcome) {
                        return (
                          <div key={msg.id} className="space-y-3">
                            <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 space-y-3 shadow-xs">
                              <div className="flex items-start gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                                  <FlaticonIcon name="fi-rr-chatbot-speech-bubble" className="text-[18px]" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-[#08246B] dark:text-white">
                                    {msg.title}
                                  </p>
                                  <p className="mt-0.5 text-xs leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                    {msg.text}
                                  </p>
                                </div>
                              </div>

                              {/* 2x2 Quick Start Grid */}
                              <div className="grid grid-cols-2 gap-2">
                                {QUICK_START_CARDS.map((card) => {
                                  const entry = getFaqById(card.faqId);
                                  if (!entry) return null;
                                  const Icon = card.icon;
                                  return (
                                    <button
                                      key={card.faqId}
                                      type="button"
                                      onClick={() => pushFaqReply(entry, entry.shortLabel)}
                                      className="min-h-[56px] rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] hover:border-[#FF6A00] p-2.5 text-left flex items-center gap-2.5 transition-colors"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
                                        <Icon size={15} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-[#08246B] dark:text-white truncate">
                                          {card.title}
                                        </p>
                                        <p className="text-[10px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                                          {card.subtitle}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Popular Questions Strip */}
                              <div className="pt-1 border-t border-[#EEF2F6] dark:border-[var(--dark-border)] space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                    Popular questions
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('tap');
                                      setSelectedCategory('all');
                                      setShowTopicsDrawer(true);
                                    }}
                                    className="text-[11px] font-semibold text-[#FF6A00] hover:underline"
                                  >
                                    Browse all {HELP_FAQ_ENTRIES.length} →
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {QUICK_POPULAR_TOPICS.map((fid) => {
                                    const target = getFaqById(fid);
                                    if (!target) return null;
                                    return (
                                      <button
                                        key={fid}
                                        type="button"
                                        onClick={() => pushFaqReply(target, target.shortLabel)}
                                        className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] hover:border-[#FF6A00] text-[11px] font-semibold text-[#08246B] dark:text-white text-left truncate transition-colors"
                                      >
                                        {target.shortLabel}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const feedback = feedbackByMsgId[msg.id];
                      const showEscalation = msg.showAdminCta || feedback === 'down';

                      return (
                        <motion.div
                          key={msg.id}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                          className="flex items-start gap-2"
                        >
                          <div className="w-7 h-7 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0 mt-0.5">
                            <FlaticonIcon name="fi-rr-chatbot-speech-bubble" className="text-[14px]" />
                          </div>
                          <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-3 space-y-2.5 shadow-xs">
                            {msg.title && (
                              <p className="text-xs font-bold text-[#08246B] dark:text-white leading-snug">
                                {msg.title}
                              </p>
                            )}
                            <p className="text-xs leading-relaxed text-[#374151] dark:text-[var(--dark-text-secondary)]">
                              {msg.text}
                            </p>

                            {msg.whereToFind && (
                              <div className="flex items-start gap-1.5 text-[11px] font-medium text-[#FF6A00] bg-[#FFF0E6]/70 dark:bg-[#FF6A00]/10 rounded-lg px-2.5 py-1.5">
                                <MapPin size={12} className="shrink-0 mt-0.5" />
                                <span>{msg.whereToFind}</span>
                              </div>
                            )}

                            {msg.steps && msg.steps.length > 0 && (
                              <ul className="space-y-1.5 text-[11px] leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                {msg.steps.map((step, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="w-4 h-4 rounded-full bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[10px] font-mono font-bold text-[#FF6A00] flex items-center justify-center shrink-0 mt-0.5">
                                      {i + 1}
                                    </span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {/* Direct Action + Helpful Feedback */}
                            {(msg.action || msg.steps || showEscalation) && (
                              <div className="pt-1.5 border-t border-[#EEF2F6] dark:border-[var(--dark-border)] flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {msg.action && onNavigate && (
                                    <button
                                      type="button"
                                      onClick={() => handleActionClick(msg.action!)}
                                      className="min-h-[34px] px-3 py-1 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                                    >
                                      <span>{msg.action.label}</span>
                                      <ArrowUpRight size={13} />
                                    </button>
                                  )}
                                  {showEscalation && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        triggerHaptic('tap');
                                        setTab('admin');
                                      }}
                                      className="min-h-[34px] px-3 py-1 rounded-xl bg-[#08246B] dark:bg-[var(--dark-elevated)] hover:opacity-90 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition-opacity"
                                    >
                                      <MessageSquare size={12} />
                                      <span>Ask Admin directly</span>
                                    </button>
                                  )}
                                </div>

                                {!msg.showAdminCta && (
                                  <div className="flex items-center gap-1 ml-auto">
                                    <span className="text-[10px] text-[#8A93A0] mr-0.5">
                                      {feedback === 'up'
                                        ? 'Helpful!'
                                        : feedback === 'down'
                                          ? 'Ask Admin?'
                                          : 'Helpful?'}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label="Mark answer helpful"
                                      onClick={() => {
                                        triggerHaptic('tap');
                                        setFeedbackByMsgId((prev) => ({
                                          ...prev,
                                          [msg.id]: 'up',
                                        }));
                                      }}
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                        feedback === 'up'
                                          ? 'bg-[#10B981]/15 text-[#059669] dark:text-[#34D399]'
                                          : 'text-[#8A93A0] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-canvas)] hover:text-[#08246B] dark:hover:text-white'
                                      }`}
                                    >
                                      <ThumbsUp size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Mark answer not helpful"
                                      onClick={() => {
                                        triggerHaptic('tap');
                                        setFeedbackByMsgId((prev) => ({
                                          ...prev,
                                          [msg.id]: 'down',
                                        }));
                                      }}
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                        feedback === 'down'
                                          ? 'bg-[#FFF0E6] dark:bg-[#FF6A00]/20 text-[#FF6A00]'
                                          : 'text-[#8A93A0] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-canvas)] hover:text-[#08246B] dark:hover:text-white'
                                      }`}
                                    >
                                      <ThumbsDown size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {msg.followUpIds && msg.followUpIds.length > 0 && (
                              <div className="pt-0.5 flex flex-wrap gap-1.5">
                                {msg.followUpIds.map((fid) => {
                                  const target = getFaqById(fid);
                                  if (!target) return null;
                                  return (
                                    <button
                                      key={fid}
                                      type="button"
                                      onClick={() => pushFaqReply(target, target.shortLabel)}
                                      className="min-h-[30px] px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] hover:border-[#FF6A00] text-[11px] font-semibold text-[#08246B] dark:text-white transition-colors"
                                    >
                                      {target.shortLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Live Typeahead Suggestions + Bot Input Bar */}
                <div className="border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] shrink-0">
                  {liveSuggestions.length > 0 && !showTopicsDrawer && (
                    <div className="px-3 pt-2 pb-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-[#8A93A0] shrink-0">
                        Quick match:
                      </span>
                      {liveSuggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => pushFaqReply(item, item.shortLabel)}
                          className="px-2.5 py-1 rounded-lg bg-[#FFF0E6]/80 dark:bg-[#FF6A00]/15 border border-[#FF6A00]/30 text-[11px] font-semibold text-[#FF6A00] hover:bg-[#FF6A00] hover:text-white transition-colors"
                        >
                          {item.shortLabel}
                        </button>
                      ))}
                    </div>
                  )}

                  <form
                    onSubmit={handleBotSubmit}
                    className="px-3 py-2.5 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={botInput}
                      onChange={(e) => setBotInput(e.target.value)}
                      placeholder="Ask anything (e.g. biometric, fonts, SIM, sync)..."
                      className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                    />
                    <button
                      type="submit"
                      disabled={!botInput.trim()}
                      aria-label="Ask App Helper Bot"
                      className="min-h-[42px] min-w-[42px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
                    >
                      <Send size={15} />
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* TAB 2: Direct User <-> Admin Support Chat */}
            {tab === 'admin' && (
              <>
                {!verifiedUid ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center">
                      <MessageSquare size={22} />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <p className="text-sm font-bold text-[#08246B] dark:text-white">
                        Sign in to chat with Admin
                      </p>
                      <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Sign in with a verified account so the admin can reply directly to your thread.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        openAuthPrompt('signin', 'Sign in to chat with Admin Support.');
                      }}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                    >
                      <LogIn size={14} />
                      <span>Login / Create Account</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {thread?.status === 'resolved' && (
                      <div className="px-4 py-2 bg-[#ECFDF5] dark:bg-[#10B981]/10 border-b border-[#10B981]/25 flex items-center gap-2 text-[11px] font-medium text-[#047857] dark:text-[#6EE7B7] shrink-0">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Marked resolved by Admin. Send a message anytime to reopen.</span>
                      </div>
                    )}

                    <div
                      ref={adminScrollRef}
                      className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#F5F7FA]/60 dark:bg-[var(--dark-canvas)]/50"
                    >
                      {chatMessages.length === 0 ? (
                        <div className="py-6 text-center space-y-4">
                          <div className="w-11 h-11 mx-auto rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center">
                            <ShieldCheck size={20} />
                          </div>
                          <div className="space-y-1 max-w-xs mx-auto">
                            <p className="text-xs font-bold text-[#08246B] dark:text-white">
                              Message the Call Analyzer - ETH Admin
                            </p>
                            <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                              Report an issue, request a feature, or ask for help. Your conversation stays private between you and the admin.
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {ADMIN_STARTER_PROMPTS.map((prompt) => (
                              <button
                                key={prompt}
                                type="button"
                                disabled={sendingAdmin}
                                onClick={() => setAdminInput(prompt)}
                                className="min-h-[34px] px-3 py-1.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] hover:border-[#FF6A00] text-[11px] font-medium text-[#08246B] dark:text-white transition-colors"
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        chatMessages.map((m) => {
                          const mine = m.senderRole === 'user';
                          return (
                            <div
                              key={m.id}
                              className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                            >
                              {!mine && (
                                <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#FF6A00] px-1">
                                  <ShieldCheck size={11} />
                                  Admin Support
                                </span>
                              )}
                              <div
                                className={`max-w-[84%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words shadow-xs ${
                                  mine
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
                        })
                      )}
                    </div>

                    {chatError && (
                      <div className="px-4 py-1.5 bg-[#FEF2F2] dark:bg-[#EF4444]/10 text-[11px] font-medium text-[#DC2626] dark:text-[#FCA5A5] shrink-0">
                        {chatError}
                      </div>
                    )}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSendAdminMessage();
                      }}
                      className="px-3 py-2.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] flex items-center gap-2 shrink-0"
                    >
                      <input
                        type="text"
                        maxLength={800}
                        value={adminInput}
                        onChange={(e) => setAdminInput(e.target.value)}
                        placeholder="Write a message to Admin..."
                        className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                      />
                      <button
                        type="submit"
                        disabled={sendingAdmin || !adminInput.trim()}
                        aria-label="Send message to Admin"
                        className="min-h-[42px] min-w-[42px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
                      >
                        <Send size={15} />
                      </button>
                    </form>
                  </>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
