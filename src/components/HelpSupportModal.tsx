import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CheckCircle2,
  Compass,
  LogIn,
  MessageSquare,
  Send,
  ShieldCheck,
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
      title?: string;
      text: string;
      whereToFind?: string;
      steps?: string[];
      followUpIds?: string[];
      showAdminCta?: boolean;
    };

const ADMIN_STARTER_PROMPTS = [
  'I found a bug to report',
  'I have a feature suggestion',
  'Need help with Android call sync',
  'Question about my account',
] as const;

export function HelpSupportModal({
  open,
  initialTab = 'bot',
  onClose,
}: {
  open: boolean;
  initialTab?: HelpSupportInitialTab;
  onClose: () => void;
}) {
  const {
    authUser,
    profileName,
    userPhotoUrl,
    openAuthPrompt,
    showNotice,
  } = useCalls();

  const prefersReducedMotion = useReducedMotion();
  useLockBodyScroll(open);

  const [tab, setTab] = useState<HelpSupportInitialTab>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<HelpFaqCategory | 'all'>('all');
  const [showTopicsDrawer, setShowTopicsDrawer] = useState(false);

  // Offline FAQ Bot state
  const [botInput, setBotInput] = useState('');
  const [botMessages, setBotMessages] = useState<BotChatItem[]>(() => [
    {
      id: 'welcome-bot',
      role: 'bot',
      title: 'Welcome to Call Analyzer - ETH Assistant',
      text: 'Ask me anything about how the app works, or tap any topic below for a guided walkthrough—no internet or AI key needed.',
      followUpIds: ['tour-overview', 'sync-calls', 'schedule-reminder', 'ethiopian-calendar'],
    },
  ]);

  // Live Admin Chat state
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [adminInput, setAdminInput] = useState('');
  const [sendingAdmin, setSendingAdmin] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const botScrollRef = useRef<HTMLDivElement>(null);
  const adminScrollRef = useRef<HTMLDivElement>(null);

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
    if (tab === 'bot') {
      botScrollRef.current?.scrollTo({
        top: botScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [botMessages, tab, open]);

  useEffect(() => {
    if (tab === 'admin') {
      adminScrollRef.current?.scrollTo({
        top: adminScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatMessages, tab, open]);

  const pushFaqReply = (entry: HelpFaqEntry, userPromptLabel?: string) => {
    triggerHaptic('tap');
    setShowTopicsDrawer(false);
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
      },
    ]);
  };

  const handleBotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = botInput.trim();
    if (!raw) return;
    setBotInput('');
    triggerHaptic('tap');

    const result = matchHelpFaq(raw);
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (result.matched) {
      const followIds = [
        ...result.matched.followUps,
        ...result.related.map((r) => r.id),
      ].filter((v, idx, arr) => arr.indexOf(v) === idx).slice(0, 4);

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
        text: 'Try asking with keywords like "sync", "reminder", "SIM tariff", "Ethiopian calendar", "backup", or "PIN lock" — or send your question straight to the Admin!',
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
    if (selectedCategory === 'all') return HELP_FAQ_ENTRIES;
    return getFaqsByCategory(selectedCategory);
  }, [selectedCategory]);

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
          className="fixed inset-0 z-50 bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-support-title"
            className="w-full sm:max-w-lg h-[88dvh] sm:h-[640px] max-h-[90dvh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] shadow-2xl overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]"
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
                        ? 'Instant offline guide for every feature'
                        : 'Direct support from the Call Analyzer - ETH team'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close help and support"
                  className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] shrink-0 transition-colors"
                >
                  <X size={18} />
                </button>
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
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    tab === 'bot'
                      ? 'bg-[#FF6A00] text-white shadow-xs'
                      : 'text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                  }`}
                >
                  <FlaticonIcon name="fi-rr-chatbot-speech-bubble" className="text-[14px]" />
                  <span>App Guide Bot</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'admin'}
                  onClick={() => {
                    triggerHaptic('tap');
                    setTab('admin');
                  }}
                  className={`relative min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
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
                {/* Quick Topic Explorer Strip */}
                <div className="px-4 py-2 border-b border-[#EEF2F6] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)]/70 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setShowTopicsDrawer((v) => !v);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 border transition-colors ${
                        showTopicsDrawer
                          ? 'bg-[#08246B] dark:bg-[#FF6A00] text-white border-transparent'
                          : 'bg-white dark:bg-[var(--dark-surface)] text-[#08246B] dark:text-white border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]'
                      }`}
                    >
                      <Compass size={12} />
                      <span>All Topics ({HELP_FAQ_ENTRIES.length})</span>
                    </button>
                    {HELP_FAQ_CATEGORIES.slice(0, 4).map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => {
                          triggerHaptic('tap');
                          setSelectedCategory(cat.key);
                          setShowTopicsDrawer(true);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:border-[#FF6A00] hover:text-[#08246B] dark:hover:text-white transition-colors"
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Browse All Topics Drawer OR Chat Transcript */}
                {showTopicsDrawer ? (
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#08246B] dark:text-white">
                        Explore Everything in Call Analyzer - ETH
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowTopicsDrawer(false)}
                        className="text-[11px] font-semibold text-[#FF6A00] hover:underline"
                      >
                        Back to chat
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          selectedCategory === 'all'
                            ? 'bg-[#FF6A00] text-white'
                            : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                        }`}
                      >
                        All ({HELP_FAQ_ENTRIES.length})
                      </button>
                      {HELP_FAQ_CATEGORIES.map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setSelectedCategory(cat.key)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                            selectedCategory === cat.key
                              ? 'bg-[#FF6A00] text-white'
                              : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {browseEntries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => pushFaqReply(entry, entry.shortLabel)}
                          className="w-full rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] hover:border-[#FF6A00] p-3 text-left transition-colors"
                        >
                          <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                            {entry.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)] line-clamp-2">
                            {entry.answer}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    ref={botScrollRef}
                    className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#F5F7FA]/60 dark:bg-[var(--dark-canvas)]/50"
                  >
                    {botMessages.map((msg) =>
                      msg.role === 'user' ? (
                        <div key={msg.id} className="flex justify-end">
                          <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-[#FF6A00] text-white px-3.5 py-2 text-xs leading-relaxed shadow-xs">
                            {msg.text}
                          </div>
                        </div>
                      ) : (
                        <div key={msg.id} className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0 mt-0.5">
                            <FlaticonIcon name="fi-rr-chatbot-speech-bubble" className="text-[14px]" />
                          </div>
                          <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2.5 space-y-2 shadow-xs">
                            {msg.title && (
                              <p className="text-xs font-bold text-[#08246B] dark:text-white">
                                {msg.title}
                              </p>
                            )}
                            <p className="text-xs leading-relaxed text-[#374151] dark:text-[var(--dark-text-secondary)]">
                              {msg.text}
                            </p>
                            {msg.whereToFind && (
                              <p className="text-[11px] font-medium text-[#FF6A00] bg-[#FFF0E6]/70 dark:bg-[#FF6A00]/10 rounded-lg px-2.5 py-1">
                                Where: {msg.whereToFind}
                              </p>
                            )}
                            {msg.steps && msg.steps.length > 0 && (
                              <ul className="space-y-1 text-[11px] leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                                {msg.steps.map((step, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="font-mono font-bold text-[#FF6A00] shrink-0">
                                      {i + 1}.
                                    </span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {msg.followUpIds && msg.followUpIds.length > 0 && (
                              <div className="pt-1 flex flex-wrap gap-1.5">
                                {msg.followUpIds.map((fid) => {
                                  const target = getFaqById(fid);
                                  if (!target) return null;
                                  return (
                                    <button
                                      key={fid}
                                      type="button"
                                      onClick={() => pushFaqReply(target, target.shortLabel)}
                                      className="px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] hover:border-[#FF6A00] text-[11px] font-semibold text-[#08246B] dark:text-white transition-colors"
                                    >
                                      {target.shortLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {msg.showAdminCta && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('tap');
                                    setTab('admin');
                                  }}
                                  className="min-h-[34px] px-3 py-1 rounded-lg bg-[#08246B] dark:bg-[#FF6A00] text-white text-[11px] font-semibold inline-flex items-center gap-1.5"
                                >
                                  <MessageSquare size={12} />
                                  <span>Ask Admin directly</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}

                {/* Bot Input Bar */}
                <form
                  onSubmit={handleBotSubmit}
                  className="px-3 py-2.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={botInput}
                    onChange={(e) => setBotInput(e.target.value)}
                    placeholder="Ask anything (e.g. sync, reminder, SIM, calendar)..."
                    className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                  />
                  <button
                    type="submit"
                    disabled={!botInput.trim()}
                    aria-label="Ask App Guide Bot"
                    className="min-h-[40px] min-w-[40px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <Send size={15} />
                  </button>
                </form>
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
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
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
                                className="px-2.5 py-1.5 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] hover:border-[#FF6A00] text-[11px] font-medium text-[#08246B] dark:text-white transition-colors"
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
                        className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs text-[#08246B] dark:text-white placeholder:text-[#8A93A0] focus:outline-none focus:border-[#FF6A00]"
                      />
                      <button
                        type="submit"
                        disabled={sendingAdmin || !adminInput.trim()}
                        aria-label="Send message to Admin"
                        className="min-h-[40px] min-w-[40px] px-3 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
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
