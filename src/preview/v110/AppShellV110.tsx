import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  Bell,
  Calendar,
  HelpCircle,
  Lock,
  LogIn,
  Phone,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { AdminTab } from '@/src/components/AdminTab';
import { BrandLogo } from '@/src/components/BrandLogo';
import { BroadcastBanners } from '@/src/components/BroadcastOverlay';
import { DarkModeToggle } from '@/src/components/DarkModeToggle';
import { EthiopianCalendarView } from '@/src/components/EthiopianCalendarView';
import { SettingsTab } from '@/src/components/SettingsTab';
import { firstGraphemes } from '@/src/lib/format';
import { InsightsViewV106 } from '@/src/preview/v106/InsightsViewV106';
import { PeopleViewV106 } from '@/src/preview/v106/PeopleViewV106';
import { CallsCraftV110 } from '@/src/preview/v110/CallsCraftV110';
import { useCalls } from '@/src/store/CallsContext';
import type { CallRecord } from '@/src/types/call';

type V110Tab = 'calls' | 'people' | 'insights' | 'calendar' | 'settings' | 'admin';

const BASE_TABS: Array<{ key: V110Tab; label: string; icon: typeof Phone; shortcut: string }> = [
  { key: 'calls', label: 'Calls', icon: Phone, shortcut: '1' },
  { key: 'people', label: 'People', icon: Users, shortcut: '2' },
  { key: 'insights', label: 'Insights', icon: BarChart3, shortcut: '3' },
  { key: 'calendar', label: 'Calendar', icon: Calendar, shortcut: '4' },
  { key: 'settings', label: 'Settings', icon: Settings, shortcut: '5' },
];

const SPRING_NAV = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.8 };
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function AppShellV110({
  headerDates,
  pendingFollowUps,
  onSelectCall,
  onSelectContact,
  onCallBack,
  onOpenReminders,
  onOpenWishes,
  onOpenGuide,
  onOpenWhatsNew,
  onOpenAndroidSetup,
  onCheckForUpdates,
}: {
  headerDates: { ec: string; gc: string | null };
  pendingFollowUps: number;
  onSelectCall: (call: CallRecord) => void;
  onSelectContact: (number: string) => void;
  onCallBack: (number: string) => void;
  onOpenReminders: () => void;
  onOpenWishes: () => void;
  onOpenGuide: () => void;
  onOpenWhatsNew: () => void;
  onOpenAndroidSetup: () => void;
  onCheckForUpdates: () => Promise<void>;
}) {
  const {
    theme,
    themePreference,
    setThemeMode,
    toggleTheme,
    pinEnabled,
    biometricUnlockEnabled,
    lockApp,
    authUser,
    isGuest,
    profileName,
    userPhotoUrl,
    openAuthPrompt,
    exitGuestMode,
    isAdmin,
    pendingAdminChatThreadUid,
  } = useCalls();

  const prefersReducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<V110Tab>('calls');
  const isDark = theme === 'dark-gray';

  useEffect(() => {
    if (isAdmin && pendingAdminChatThreadUid) {
      setActiveTab('admin');
    }
  }, [isAdmin, pendingAdminChatThreadUid]);

  const tabs = isAdmin
    ? [...BASE_TABS, { key: 'admin' as V110Tab, label: 'Admin', icon: ShieldCheck, shortcut: '6' }]
    : BASE_TABS;

  // Instant keyboard tab switching (1–6): no delay, respects input focus
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const match = tabs.find((t) => t.shortcut === event.key);
      if (match) {
        setActiveTab(match.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tabs]);

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] dark:bg-[#0A0A0B] text-[#111214] dark:text-[#F5F6F8] flex flex-col md:flex-row">
      {/* Desktop Precision Sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-[100dvh] md:w-[244px] md:shrink-0 md:flex-col md:overflow-y-auto overscroll-contain border-r border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#111215] px-4 py-5 justify-between gap-6">
        <div className="space-y-6">
          <div className="px-1 space-y-1">
            <div className="flex items-center gap-2.5">
              <BrandLogo size={30} />
              <span className="text-[15px] font-bold tracking-[-0.02em] text-[#111214] dark:text-[#F5F6F8] whitespace-nowrap truncate">
                Call Analyzer
              </span>
            </div>
            <p className="pl-[40px] text-[11px] font-mono tabular-nums text-[#6B7280] dark:text-[#8E95A0]">
              {headerDates.ec}
              {headerDates.gc ? ` · ${headerDates.gc}` : ''}
            </p>
          </div>

          <nav className="space-y-1" aria-label="Primary navigation">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`v110-press relative w-full min-h-[40px] px-3 rounded-[10px] flex items-center justify-between gap-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-[#111214] dark:text-[#F5F6F8] font-semibold'
                      : 'text-[#5C616B] dark:text-[#969CA6] v110-hover-ink v110-hover-subtle'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="v110-sidebar-active"
                      transition={prefersReducedMotion ? { duration: 0.1 } : SPRING_NAV}
                      className="absolute inset-0 rounded-[10px] bg-black/[0.055] dark:bg-white/[0.08]"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                    <Icon
                      size={16}
                      className={
                        active
                          ? 'text-[#E45A0D] dark:text-[#F4762C] shrink-0'
                          : 'shrink-0'
                      }
                    />
                    <span className="truncate">{tab.label}</span>
                  </span>
                  <kbd className="relative z-10 text-[10px] font-mono text-[#8A909B] opacity-70">
                    {tab.shortcut}
                  </kbd>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1 pt-4 border-t border-black/[0.06] dark:border-white/[0.07]">
          <button
            type="button"
            onClick={onOpenReminders}
            className="v110-press w-full min-h-[38px] px-3 rounded-[10px] text-[12px] font-medium text-[#111214] dark:text-[#F5F6F8] v110-hover-subtle flex items-center justify-between gap-2 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Bell size={14} className="text-[#6B7280] dark:text-[#8E95A0]" />
              Reminders &amp; Wishes
            </span>
            {pendingFollowUps > 0 && (
              <span className="font-mono text-[11px] font-semibold tabular-nums text-[#E45A0D] dark:text-[#F4762C]">
                {pendingFollowUps}
              </span>
            )}
          </button>

          {(pinEnabled || biometricUnlockEnabled) && (
            <button
              type="button"
              onClick={lockApp}
              className="v110-press w-full min-h-[38px] px-3 rounded-[10px] text-[12px] font-medium text-[#5C616B] dark:text-[#969CA6] v110-hover-ink v110-hover-subtle flex items-center gap-2.5 transition-colors"
            >
              <Lock size={14} />
              Lock screen
            </button>
          )}

          <button
            type="button"
            onClick={onOpenGuide}
            className="v110-press w-full min-h-[38px] px-3 rounded-[10px] text-[12px] font-medium text-[#5C616B] dark:text-[#969CA6] v110-hover-ink v110-hover-subtle flex items-center gap-2.5 transition-colors"
          >
            <HelpCircle size={14} />
            Help &amp; Guide
          </button>

          <div className="pt-1.5">
            <DarkModeToggle
              isDark={isDark}
              mode={themePreference}
              onToggle={toggleTheme}
              onSelectAuto={() => setThemeMode('system')}
              label={
                themePreference === 'system'
                  ? isDark
                    ? 'Auto · Dark'
                    : 'Auto · Light'
                  : isDark
                    ? 'Dark'
                    : 'Light'
              }
            />
          </div>

          {authUser ? (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="v110-press w-full mt-2 px-2.5 py-2 rounded-[10px] v110-hover-subtle flex items-center gap-2.5 text-left transition-colors"
            >
              {userPhotoUrl || authUser.photoURL ? (
                <img
                  src={userPhotoUrl || authUser.photoURL || ''}
                  alt={profileName || authUser.displayName || 'Account'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-[#111214] dark:bg-[#F5F6F8] text-white dark:text-[#111214] text-xs font-bold flex items-center justify-center shrink-0">
                  {firstGraphemes(
                    profileName || authUser.displayName || authUser.email || 'U',
                    1,
                  ).toLocaleUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-[#111214] dark:text-[#F5F6F8] truncate">
                  {profileName || authUser.displayName || authUser.email?.split('@')[0] || 'Account'}
                </p>
                <p className="text-[10px] text-[#6B7280] dark:text-[#8E95A0] truncate">
                  {authUser.email}
                </p>
              </div>
            </button>
          ) : (
            <div className="pt-2 space-y-1.5">
              <button
                type="button"
                onClick={() => openAuthPrompt('signin')}
                className="v110-press w-full min-h-[40px] px-3 rounded-[10px] bg-[#E45A0D] text-[12px] font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <LogIn size={14} />
                Sign in
              </button>
              <button
                type="button"
                onClick={exitGuestMode}
                className="v110-press w-full min-h-[34px] px-3 rounded-[10px] text-[11px] font-medium text-[#5C616B] dark:text-[#969CA6]"
              >
                Exit demo
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Compact Mobile Top Bar (52px height, edge-to-edge safe-area) */}
      <header className="md:hidden sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-[#FAFAFA]/88 dark:bg-[#0A0A0B]/88 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.07]">
        <div className="h-[52px] px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={26} />
            <div className="min-w-0">
              <span className="block text-[14px] font-bold tracking-[-0.02em] text-[#111214] dark:text-[#F5F6F8] truncate leading-tight">
                Call Analyzer
              </span>
              <span className="block text-[10px] font-mono tabular-nums text-[#6B7280] dark:text-[#8E95A0] leading-tight truncate">
                {headerDates.ec}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {(pinEnabled || biometricUnlockEnabled) && (
              <button
                type="button"
                onClick={lockApp}
                aria-label="Lock screen"
                className="v110-press w-11 h-11 rounded-[12px] text-[#5C616B] dark:text-[#969CA6] flex items-center justify-center"
              >
                <Lock size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenReminders}
              aria-label="Reminders and wishes"
              className="v110-press min-w-[44px] h-11 px-2 rounded-[12px] text-[#111214] dark:text-[#F5F6F8] flex items-center justify-center gap-1"
            >
              <Bell size={18} />
              {pendingFollowUps > 0 && (
                <span className="text-[12px] font-mono font-bold tabular-nums text-[#E45A0D] dark:text-[#F4762C]">
                  {pendingFollowUps}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Scroll Canvas */}
      <main className="flex-1 min-w-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10 overflow-x-clip">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
          <BroadcastBanners />

          {isGuest && (
            <div className="mb-5 rounded-[14px] bg-white dark:bg-[#121316] border border-black/[0.07] dark:border-white/[0.08] px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#111214] dark:text-[#F5F6F8]">
                  Guest demo mode
                </p>
                <p className="text-[12px] text-[#5C616B] dark:text-[#969CA6]">
                  Sample calls clear automatically when you sign in.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openAuthPrompt('signin')}
                  className="v110-press min-h-[38px] px-3.5 rounded-[10px] bg-[#E45A0D] text-[12px] font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                >
                  <LogIn size={13} />
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuthPrompt('signup')}
                  className="v110-press min-h-[38px] px-3 rounded-[10px] border border-black/[0.09] dark:border-white/[0.1] text-[12px] font-semibold text-[#111214] dark:text-[#F5F6F8] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <UserPlus size={13} />
                  Sign up
                </button>
              </div>
            </div>
          )}

          {/* Crisp non-jarring tab view transition (compositor opacity only, 140ms) */}
          <motion.div
            key={activeTab}
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
          >
            {activeTab === 'calls' && (
              <CallsCraftV110
                onSelectCall={onSelectCall}
                onSelectContact={onSelectContact}
                onCallBack={onCallBack}
                onOpenReminders={onOpenReminders}
              />
            )}

            {activeTab === 'people' && (
              <PeopleViewV106
                onSelectContact={onSelectContact}
                onCallBack={onCallBack}
              />
            )}

            {activeTab === 'insights' && (
              <InsightsViewV106 onSelectContact={onSelectContact} />
            )}

            {activeTab === 'calendar' && (
              <EthiopianCalendarView
                onSelectContact={onSelectContact}
                onOpenWishes={onOpenWishes}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                onOpenReminders={onOpenReminders}
                onOpenGuide={onOpenGuide}
                onOpenWhatsNew={onOpenWhatsNew}
                onOpenAndroidSetup={onOpenAndroidSetup}
                onSelectContact={onSelectContact}
                onCheckForUpdates={onCheckForUpdates}
              />
            )}

            {isAdmin && activeTab === 'admin' && <AdminTab />}
          </motion.div>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar with Spring-Gliding Indicator */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 dark:bg-[#111215]/92 backdrop-blur-md border-t border-black/[0.06] dark:border-white/[0.08] pb-[env(safe-area-inset-bottom)]"
      >
        <div
          className={`h-[60px] grid items-center px-1.5 ${
            tabs.length === 6 ? 'grid-cols-6' : 'grid-cols-5'
          }`}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`v110-press relative h-12 flex flex-col items-center justify-center gap-1 rounded-[12px] transition-colors ${
                  active
                    ? 'text-[#E45A0D] dark:text-[#F4762C]'
                    : 'text-[#6B7280] dark:text-[#8E95A0]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="v110-mobile-tab-active"
                    transition={prefersReducedMotion ? { duration: 0.1 } : SPRING_NAV}
                    className="absolute inset-x-1 inset-y-0.5 rounded-[10px] bg-[#E45A0D]/[0.09] dark:bg-[#F4762C]/[0.14]"
                  />
                )}
                <Icon size={19} className="relative z-10 shrink-0" />
                <span className="relative z-10 text-[10px] font-semibold leading-none whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
