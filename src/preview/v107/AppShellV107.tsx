import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  Flame,
  HelpCircle,
  Lock,
  LogIn,
  Phone,
  Settings,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { AdminTab } from '@/src/components/AdminTab';
import { BrandLogo } from '@/src/components/BrandLogo';
import { DarkModeToggle } from '@/src/components/DarkModeToggle';
import { EthiopianCalendarView } from '@/src/components/EthiopianCalendarView';
import { firstGraphemes } from '@/src/lib/format';
import { BusinessCallsV107 } from '@/src/preview/v107/BusinessCallsV107';
import { BusinessLeadsV107 } from '@/src/preview/v107/BusinessLeadsV107';
import { BusinessOverviewV107 } from '@/src/preview/v107/BusinessOverviewV107';
import { BusinessPipelineV107 } from '@/src/preview/v107/BusinessPipelineV107';
import { BusinessSetupV107 } from '@/src/preview/v107/BusinessSetupV107';
import {
  loadBusinessState,
  saveBusinessState,
  type BusinessConfig,
  type BusinessStage,
  type BusinessStateSnapshot,
  type CrmContactMeta,
} from '@/src/preview/v107/businessStore';
import { useCalls } from '@/src/store/CallsContext';
import type { CallRecord } from '@/src/types/call';

type V107Tab = 'overview' | 'leads' | 'pipeline' | 'calls' | 'setup' | 'calendar' | 'admin';

const MOBILE_TABS: Array<{ key: V107Tab; label: string; icon: typeof BarChart3 }> = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'leads', label: 'Leads', icon: Flame },
  { key: 'pipeline', label: 'Pipeline', icon: Briefcase },
  { key: 'calls', label: 'Calls', icon: Phone },
  { key: 'setup', label: 'Setup', icon: Settings },
];

export function AppShellV107({
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
    showNotice,
  } = useCalls();

  const uid = authUser?.uid ?? null;
  const [activeTab, setActiveTab] = useState<V107Tab>('overview');
  const [bizState, setBizState] = useState<BusinessStateSnapshot>(() => loadBusinessState(uid));

  useEffect(() => {
    setBizState(loadBusinessState(uid));
  }, [uid]);

  useEffect(() => {
    if (isAdmin && pendingAdminChatThreadUid) {
      setActiveTab('admin');
    }
  }, [isAdmin, pendingAdminChatThreadUid]);

  const updateBizState = useCallback(
    (updater: (prev: BusinessStateSnapshot) => BusinessStateSnapshot) => {
      setBizState((prev) => {
        const next = updater(prev);
        saveBusinessState(uid, next);
        return next;
      });
    },
    [uid],
  );

  const handleUpdateConfig = useCallback(
    (patch: Partial<BusinessConfig>) => {
      updateBizState((prev) => ({
        ...prev,
        config: { ...prev.config, ...patch },
      }));
    },
    [updateBizState],
  );

  const handleUpdateCrm = useCallback(
    (contactKey: string, patch: Partial<CrmContactMeta>) => {
      updateBizState((prev) => {
        const existing: CrmContactMeta = prev.crm[contactKey] ?? {
          stage: 'lead',
          dealValueEtb: 0,
          company: '',
          lastOutcome: '',
          updatedAt: Date.now(),
        };
        return {
          ...prev,
          crm: {
            ...prev.crm,
            [contactKey]: { ...existing, ...patch, updatedAt: Date.now() },
          },
        };
      });
    },
    [updateBizState],
  );

  const handleSetStage = useCallback(
    (contactKey: string, stage: BusinessStage) => {
      handleUpdateCrm(contactKey, { stage });
      showNotice(`Stage updated to ${stage}.`);
    },
    [handleUpdateCrm, showNotice],
  );

  const handleSetCallOutcome = useCallback(
    (callId: string, contactKey: string, outcome: string) => {
      updateBizState((prev) => {
        const nextOutcomes = { ...prev.callOutcomes };
        if (outcome) nextOutcomes[callId] = outcome;
        else delete nextOutcomes[callId];

        const existingCrm = prev.crm[contactKey];
        const nextCrm = outcome
          ? {
              ...prev.crm,
              [contactKey]: {
                stage: existingCrm?.stage ?? 'lead',
                dealValueEtb: existingCrm?.dealValueEtb ?? 0,
                company: existingCrm?.company ?? '',
                lastOutcome: outcome,
                updatedAt: Date.now(),
              },
            }
          : prev.crm;

        return { ...prev, callOutcomes: nextOutcomes, crm: nextCrm };
      });
      showNotice(outcome ? `Logged outcome: ${outcome}` : 'Call outcome cleared.');
    },
    [updateBizState, showNotice],
  );

  const isDark = theme === 'dark-gray';

  const desktopTabs: Array<{ key: V107Tab; label: string; icon: typeof BarChart3 }> = [
    ...MOBILE_TABS,
    { key: 'calendar', label: 'Calendar', icon: Calendar },
    ...(isAdmin ? [{ key: 'admin' as V107Tab, label: 'Admin', icon: ShieldCheck }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F6F7F8] dark:bg-[#0D1014] text-[#14161A] dark:text-[#F4F4F1] flex flex-col md:flex-row">
      {/* Executive Desktop Sidebar */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto border-r border-[#E2E5EA] dark:border-white/[0.08] bg-white dark:bg-[#151921] p-5 justify-between gap-6">
        <div className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <BrandLogo size={32} />
              <div className="min-w-0">
                <span
                  className="block text-base font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1] whitespace-nowrap truncate leading-tight"
                  style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
                >
                  Call Analyzer
                </span>
                <span className="block text-[11px] font-medium text-[#E45A0D] dark:text-[#F4762C]">
                  Business Suite
                </span>
              </div>
            </div>
            <p className="pl-[42px] text-[11px] font-mono tabular-nums text-[#626874] dark:text-[#989EA9]">
              {headerDates.ec}
            </p>
          </div>

          <nav className="space-y-1" aria-label="Business navigation">
            {desktopTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full min-h-[42px] px-3 rounded-xl flex items-center gap-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#0F2544] dark:bg-white/[0.1] text-white font-semibold'
                      : 'text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1] hover:bg-[#F6F7F8] dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon
                    size={17}
                    className={
                      active ? 'text-[#F4762C] shrink-0' : 'shrink-0'
                    }
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1.5 pt-4 border-t border-[#E2E5EA] dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onOpenReminders}
            className="w-full min-h-[38px] px-3 rounded-xl text-xs font-medium text-[#14161A] dark:text-[#F4F4F1] hover:bg-[#F6F7F8] dark:hover:bg-white/[0.06] flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2.5">
              <Bell size={14} className="text-[#626874]" />
              Alerts &amp; Wishes
            </span>
            {pendingFollowUps > 0 && (
              <span className="font-mono text-xs font-semibold tabular-nums text-[#E45A0D]">
                {pendingFollowUps}
              </span>
            )}
          </button>

          {pinEnabled && (
            <button
              type="button"
              onClick={lockApp}
              className="w-full min-h-[38px] px-3 rounded-xl text-xs font-medium text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-white hover:bg-[#F6F7F8] dark:hover:bg-white/[0.06] flex items-center gap-2.5"
            >
              <Lock size={14} />
              Lock screen
            </button>
          )}

          <button
            type="button"
            onClick={onOpenGuide}
            className="w-full min-h-[38px] px-3 rounded-xl text-xs font-medium text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-white hover:bg-[#F6F7F8] dark:hover:bg-white/[0.06] flex items-center gap-2.5"
          >
            <HelpCircle size={14} />
            Guide
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
              onClick={() => setActiveTab('setup')}
              className="w-full mt-2 px-2.5 py-2 rounded-xl hover:bg-[#F6F7F8] dark:hover:bg-white/[0.06] flex items-center gap-2.5 text-left"
            >
              {userPhotoUrl || authUser.photoURL ? (
                <img
                  src={userPhotoUrl || authUser.photoURL || ''}
                  alt={profileName || authUser.displayName || 'Account'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-[#0F2544] text-white text-xs font-bold flex items-center justify-center shrink-0">
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
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#E45A0D] hover:bg-[#C94D09] text-xs font-semibold text-white flex items-center justify-center gap-2"
              >
                <LogIn size={14} />
                Sign in
              </button>
              <button
                type="button"
                onClick={exitGuestMode}
                className="w-full min-h-[34px] px-3 rounded-xl text-[11px] font-medium text-[#626874] dark:text-[#989EA9]"
              >
                Exit demo
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Compact Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-[#F6F7F8]/92 dark:bg-[#0D1014]/92 backdrop-blur-md border-b border-[#E2E5EA] dark:border-white/[0.08]">
        <div className="h-[52px] px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={28} />
            <div className="min-w-0">
              <span
                className="block text-sm font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1] truncate leading-tight"
                style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
              >
                {bizState.config.businessName || 'Call Analyzer'}
              </span>
              <span className="block text-[10px] font-medium text-[#E45A0D] dark:text-[#F4762C] leading-tight truncate">
                Business · {headerDates.ec}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              aria-label="Ethiopian calendar"
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeTab === 'calendar'
                  ? 'text-[#E45A0D]'
                  : 'text-[#626874] dark:text-[#989EA9]'
              }`}
            >
              <Calendar size={17} />
            </button>
            <button
              type="button"
              onClick={onOpenReminders}
              aria-label="Alerts and wishes"
              className="min-w-[40px] h-10 px-2 rounded-xl text-[#14161A] dark:text-[#F4F4F1] flex items-center justify-center gap-1"
            >
              <Bell size={17} />
              {pendingFollowUps > 0 && (
                <span className="text-xs font-mono font-bold tabular-nums text-[#E45A0D]">
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
            <div className="mb-5 rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1]">
                  Business Demo Mode
                </p>
                <p className="text-[11px] text-[#626874] dark:text-[#989EA9]">
                  Sign in to analyze your own business calls and save CRM stages privately.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openAuthPrompt('signin')}
                  className="min-h-[36px] px-3.5 rounded-xl bg-[#0F2544] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] text-xs font-semibold flex items-center gap-1.5"
                >
                  <LogIn size={13} />
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuthPrompt('signup')}
                  className="min-h-[36px] px-3 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1] flex items-center gap-1.5"
                >
                  <UserPlus size={13} />
                  Sign up
                </button>
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <BusinessOverviewV107
              config={bizState.config}
              crm={bizState.crm}
              callOutcomes={bizState.callOutcomes}
              onCallBack={onCallBack}
              onOpenLeadsTab={() => setActiveTab('leads')}
              onSelectContact={onSelectContact}
            />
          )}

          {activeTab === 'leads' && (
            <BusinessLeadsV107
              config={bizState.config}
              crm={bizState.crm}
              onSetStage={handleSetStage}
              onCallBack={onCallBack}
              onSelectContact={onSelectContact}
            />
          )}

          {activeTab === 'pipeline' && (
            <BusinessPipelineV107
              config={bizState.config}
              crm={bizState.crm}
              onUpdateCrm={handleUpdateCrm}
              onSelectContact={onSelectContact}
              onCallBack={onCallBack}
            />
          )}

          {activeTab === 'calls' && (
            <BusinessCallsV107
              config={bizState.config}
              crm={bizState.crm}
              callOutcomes={bizState.callOutcomes}
              onSetCallOutcome={handleSetCallOutcome}
              onSelectCall={onSelectCall}
              onSelectContact={onSelectContact}
              onCallBack={onCallBack}
            />
          )}

          {activeTab === 'calendar' && (
            <EthiopianCalendarView
              onSelectContact={onSelectContact}
              onOpenWishes={onOpenWishes}
            />
          )}

          {activeTab === 'setup' && (
            <BusinessSetupV107
              config={bizState.config}
              onUpdateConfig={handleUpdateConfig}
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

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Business mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/94 dark:bg-[#151921]/94 backdrop-blur-md border-t border-[#E2E5EA] dark:border-white/[0.08] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="h-[60px] grid grid-cols-5 items-center px-1">
          {MOBILE_TABS.map((tab) => {
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
