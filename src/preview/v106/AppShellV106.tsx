import { useEffect, useState } from 'react';
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
import { DarkModeToggle } from '@/src/components/DarkModeToggle';
import { EthiopianCalendarView } from '@/src/components/EthiopianCalendarView';
import { SettingsTab } from '@/src/components/SettingsTab';
import { firstGraphemes } from '@/src/lib/format';
import { CallsHomeV106 } from '@/src/preview/v106/CallsHomeV106';
import { InsightsViewV106 } from '@/src/preview/v106/InsightsViewV106';
import { PeopleViewV106 } from '@/src/preview/v106/PeopleViewV106';
import { useCalls } from '@/src/store/CallsContext';
import type { CallRecord } from '@/src/types/call';

type V106Tab = 'calls' | 'people' | 'insights' | 'calendar' | 'settings' | 'admin';

const BASE_TABS: Array<{ key: V106Tab; label: string; icon: typeof Phone }> = [
  { key: 'calls', label: 'Calls', icon: Phone },
  { key: 'people', label: 'People', icon: Users },
  { key: 'insights', label: 'Insights', icon: BarChart3 },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export function AppShellV106({
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

  const [activeTab, setActiveTab] = useState<V106Tab>('calls');
  const isDark = theme === 'dark-gray';

  useEffect(() => {
    if (isAdmin && pendingAdminChatThreadUid) {
      setActiveTab('admin');
    }
  }, [isAdmin, pendingAdminChatThreadUid]);

  const tabs = isAdmin
    ? [...BASE_TABS, { key: 'admin' as V106Tab, label: 'Admin', icon: ShieldCheck }]
    : BASE_TABS;

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-[#0E1013] text-[#14161A] dark:text-[#F4F4F1] flex flex-col md:flex-row">
      {/* Calm Desktop Sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto border-r border-[#E5E2DC] dark:border-white/[0.08] bg-white dark:bg-[#15181D] p-5 justify-between gap-6">
        <div className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <BrandLogo size={32} />
              <span
                className="text-base font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1] whitespace-nowrap truncate"
                style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
              >
                Call Analyzer
              </span>
            </div>
            <p className="pl-[42px] text-[11px] font-mono tabular-nums text-[#626874] dark:text-[#989EA9]">
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
                  className={`w-full min-h-[42px] px-3 rounded-xl flex items-center gap-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#F2F0EC] dark:bg-white/[0.08] text-[#14161A] dark:text-[#F4F4F1] font-semibold'
                      : 'text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1] hover:bg-[#FAF9F6] dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon
                    size={18}
                    className={active ? 'text-[#E45A0D] dark:text-[#F4762C] shrink-0' : 'shrink-0'}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1.5 pt-4 border-t border-[#E5E2DC] dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onOpenReminders}
            className="w-full min-h-[40px] px-3 rounded-xl text-xs font-medium text-[#14161A] dark:text-[#F4F4F1] hover:bg-[#F2F0EC] dark:hover:bg-white/[0.06] flex items-center justify-between gap-2 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Bell size={15} className="text-[#626874] dark:text-[#989EA9]" />
              Reminders &amp; Wishes
            </span>
            {pendingFollowUps > 0 && (
              <span className="font-mono text-xs font-semibold tabular-nums text-[#E45A0D] dark:text-[#F4762C]">
                {pendingFollowUps}
              </span>
            )}
          </button>

          {pinEnabled && (
            <button
              type="button"
              onClick={lockApp}
              className="w-full min-h-[38px] px-3 rounded-xl text-xs font-medium text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1] hover:bg-[#F2F0EC] dark:hover:bg-white/[0.06] flex items-center gap-2.5 transition-colors"
            >
              <Lock size={14} />
              Lock screen
            </button>
          )}

          <button
            type="button"
            onClick={onOpenGuide}
            className="w-full min-h-[38px] px-3 rounded-xl text-xs font-medium text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1] hover:bg-[#F2F0EC] dark:hover:bg-white/[0.06] flex items-center gap-2.5 transition-colors"
          >
            <HelpCircle size={14} />
            Help &amp; Guide
          </button>

          <div className="pt-1">
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
              className="w-full mt-2 px-2.5 py-2 rounded-xl hover:bg-[#F2F0EC] dark:hover:bg-white/[0.06] flex items-center gap-2.5 text-left transition-colors"
            >
              {userPhotoUrl || authUser.photoURL ? (
                <img
                  src={userPhotoUrl || authUser.photoURL || ''}
                  alt={profileName || authUser.displayName || 'Account'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-[#14161A] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] text-xs font-bold flex items-center justify-center shrink-0">
                  {firstGraphemes(
                    profileName || authUser.displayName || authUser.email || 'U',
                    1,
                  ).toLocaleUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1] truncate">
                  {profileName || authUser.displayName || authUser.email?.split('@')[0] || 'Account'}
                </p>
                <p className="text-[10px] text-[#626874] dark:text-[#989EA9] truncate">
                  {authUser.email}
                </p>
              </div>
            </button>
          ) : (
            <div className="pt-2 space-y-1.5">
              <button
                type="button"
                onClick={() => openAuthPrompt('signin')}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#E45A0D] hover:bg-[#C94D09] text-xs font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
              >
                <LogIn size={14} />
                Sign in
              </button>
              <button
                type="button"
                onClick={exitGuestMode}
                className="w-full min-h-[34px] px-3 rounded-xl text-[11px] font-medium text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-white"
              >
                Exit demo
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Compact Mobile Top Bar (<= 54px) */}
      <header className="md:hidden sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-[#F7F7F5]/92 dark:bg-[#0E1013]/92 backdrop-blur-md border-b border-[#E5E2DC] dark:border-white/[0.08]">
        <div className="h-[52px] px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={28} />
            <div className="min-w-0">
              <span
                className="block text-sm font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1] truncate leading-tight"
                style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
              >
                Call Analyzer
              </span>
              <span className="block text-[10px] font-mono tabular-nums text-[#626874] dark:text-[#989EA9] leading-tight truncate">
                {headerDates.ec}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {pinEnabled && (
              <button
                type="button"
                onClick={lockApp}
                aria-label="Lock screen"
                className="w-10 h-10 rounded-xl text-[#626874] dark:text-[#989EA9] flex items-center justify-center"
              >
                <Lock size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenReminders}
              aria-label="Reminders and wishes"
              className="min-w-[40px] h-10 px-2 rounded-xl text-[#14161A] dark:text-[#F4F4F1] flex items-center justify-center gap-1"
            >
              <Bell size={18} />
              {pendingFollowUps > 0 && (
                <span className="text-xs font-mono font-bold tabular-nums text-[#E45A0D] dark:text-[#F4762C]">
                  {pendingFollowUps}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-10 overflow-x-clip">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
          {isGuest && (
            <div className="mb-5 rounded-2xl bg-white dark:bg-[#15181D] border border-[#E5E2DC] dark:border-white/[0.08] px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1]">
                  Guest demo mode
                </p>
                <p className="text-[11px] text-[#626874] dark:text-[#989EA9]">
                  Sample calls clear automatically when you sign in.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openAuthPrompt('signin')}
                  className="min-h-[36px] px-3.5 rounded-xl bg-[#E45A0D] hover:bg-[#C94D09] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                >
                  <LogIn size={13} />
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuthPrompt('signup')}
                  className="min-h-[36px] px-3 rounded-xl border border-[#E5E2DC] dark:border-white/[0.1] text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <UserPlus size={13} />
                  Sign up
                </button>
              </div>
            </div>
          )}

          {activeTab === 'calls' && (
            <CallsHomeV106
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
        </div>
      </main>

      {/* Clean Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/94 dark:bg-[#15181D]/94 backdrop-blur-md border-t border-[#E5E2DC] dark:border-white/[0.08] pb-[env(safe-area-inset-bottom)]"
      >
        <div
          className={`h-[60px] grid items-center px-1 ${
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
                className={`h-13 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                  active
                    ? 'text-[#E45A0D] dark:text-[#F4762C]'
                    : 'text-[#626874] dark:text-[#989EA9]'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
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
