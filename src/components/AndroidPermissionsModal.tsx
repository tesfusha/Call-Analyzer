import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BatteryCharging,
  BellRing,
  CheckCircle2,
  Clock,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import {
  type NativeCallLogSyncPermissionStatus,
  type NativeDeviceBrandInfo,
  getCallLogSyncPermissionStatus,
  getNativeDeviceBrandInfo,
  openAutostartSettings,
  openBatteryOptimizationSettings,
  openExactAlarmSettings,
  requestCallLogSyncPermissions,
} from '@/src/lib/capacitor';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';

type SetupStep = 'permissions' | 'battery';

function StatusBadge({ granted, label }: { granted: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 ${
        granted
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
      }`}
    >
      {granted ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
      {label ?? (granted ? 'Allowed' : 'Needed')}
    </span>
  );
}

export function AndroidPermissionsModal({
  open,
  initialStep = 'permissions',
  onClose,
  onCompleted,
}: {
  open: boolean;
  initialStep?: SetupStep;
  onClose: () => void;
  onCompleted: () => void;
}) {
  useLockBodyScroll(open);

  const [step, setStep] = useState<SetupStep>(initialStep);
  const [status, setStatus] = useState<NativeCallLogSyncPermissionStatus | null>(null);
  const [brandInfo, setBrandInfo] = useState<NativeDeviceBrandInfo | null>(null);
  const [requesting, setRequesting] = useState(false);

  useBackHandler({
    id: 'android-permissions-modal',
    active: open,
    priority: 65,
    onBack: () => {
      if (step === 'battery') setStep('permissions');
      else onClose();
    },
  });

  const refreshStatus = useCallback(async () => {
    const [permStatus, brand] = await Promise.all([
      getCallLogSyncPermissionStatus(),
      getNativeDeviceBrandInfo(),
    ]);
    if (permStatus) setStatus(permStatus);
    if (brand) setBrandInfo(brand);
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(initialStep);
    void refreshStatus();
  }, [open, initialStep, refreshStatus]);

  useEffect(() => {
    if (!open) return;
    const onFocus = () => {
      void refreshStatus();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refreshStatus();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [open, refreshStatus]);

  if (!open) return null;

  const handleRequestPermissions = async () => {
    setRequesting(true);
    try {
      const next = await requestCallLogSyncPermissions();
      if (next) {
        setStatus(next);
        if (next.allCoreGranted) {
          if (next.exactAlarm !== 'granted') {
            await openExactAlarmSettings();
          } else {
            setStep('battery');
          }
        }
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleOpenExactAlarm = async () => {
    await openExactAlarmSettings();
    await refreshStatus();
  };

  const handleBatteryExemption = async () => {
    await openBatteryOptimizationSettings();
    setTimeout(() => {
      void refreshStatus();
    }, 600);
  };

  const handleAutostart = async () => {
    await openAutostartSettings();
  };

  const handleFinish = () => {
    onCompleted();
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-setup-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 sm:p-6 space-y-5 shadow-xl my-auto max-h-[90dvh] overflow-y-auto overscroll-contain"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              {step === 'permissions' ? <ShieldCheck size={20} /> : <BatteryCharging size={20} />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#FF6A00]">
                {step === 'permissions' ? 'Step 1 of 2 · Permissions' : 'Step 2 of 2 · Background Sync'}
              </p>
              <h2
                id="android-setup-title"
                className="text-base font-bold text-[#08246B] dark:text-white leading-snug"
              >
                {step === 'permissions'
                  ? 'Allow Call Log & Reminder Access'
                  : 'Keep Reminders Reliable in Background'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup"
            className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
          >
            <X size={18} />
          </button>
        </div>

        {step === 'permissions' ? (
          <>
            <p className="text-xs leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              Call Analyzer - ETH syncs your dual-SIM call history privately on your phone and reminds you when a missed call hasn&apos;t been returned — even when the app is closed.
            </p>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <PhoneCall size={16} className="text-[#FF6A00] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                      Call Log (READ_CALL_LOG)
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      Reads incoming, outgoing, missed &amp; rejected calls and checks if you already called back.
                    </p>
                  </div>
                </div>
                <StatusBadge granted={status?.callLog === 'granted'} />
              </div>

              <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Smartphone size={16} className="text-[#FF6A00] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                      Phone State &amp; SIM Info (READ_PHONE_STATE)
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      Detects when a call ends and identifies SIM 1 (ETC) vs SIM 2 (SFC).
                    </p>
                  </div>
                </div>
                <StatusBadge granted={status?.phoneState === 'granted'} />
              </div>

              <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <BellRing size={16} className="text-[#FF6A00] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                      Notifications (POST_NOTIFICATIONS)
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      Shows missed-call callback reminders with one-tap Call back &amp; Dismiss actions.
                    </p>
                  </div>
                </div>
                <StatusBadge granted={status?.notifications === 'granted'} />
              </div>

              <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Clock size={16} className="text-[#FF6A00] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                      Exact Alarms (SCHEDULE_EXACT_ALARM)
                    </p>
                    <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                      Fires missed-call reminders accurately after your 5 or 10 minute delay.
                    </p>
                  </div>
                </div>
                <StatusBadge granted={status?.exactAlarm === 'granted'} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('battery')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white transition-colors"
              >
                Next: Battery Setup
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {status && status.exactAlarm !== 'granted' && (
                  <button
                    type="button"
                    onClick={() => void handleOpenExactAlarm()}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#FF6A00] text-xs font-semibold text-[#FF6A00] hover:bg-[#FFF0E6] dark:hover:bg-[#FF6A00]/15 transition-colors"
                  >
                    Allow Exact Alarms
                  </button>
                )}
                <button
                  type="button"
                  disabled={requesting}
                  onClick={() => void handleRequestPermissions()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white transition-colors"
                >
                  {requesting
                    ? 'Requesting...'
                    : status?.allCoreGranted
                      ? 'Continue'
                      : 'Allow Permissions'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-[#FF6A00]/30 bg-[#FFF0E6]/70 dark:bg-[#FF6A00]/12 p-3.5 space-y-1.5">
              <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                {brandInfo
                  ? `Detected phone: ${brandInfo.oemFamily}${brandInfo.model ? ` (${brandInfo.model})` : ''}`
                  : 'Important on Tecno, Infinix, itel, Xiaomi & Samsung'}
              </p>
              <p className="text-xs leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                Phones from <strong>Tecno, Infinix, itel, Xiaomi, and Samsung</strong> aggressively stop background listeners and alarms when an app is swiped away. Exempt Call Analyzer - ETH from battery optimization and enable Autostart / Unrestricted background activity so missed-call reminders still fire on time.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    1. Battery Optimization Exemption
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Allow &quot;Unrestricted&quot; or &quot;Don&apos;t optimize&quot; battery usage.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge
                    granted={Boolean(status?.batteryOptimizationIgnored)}
                    label={status?.batteryOptimizationIgnored ? 'Exempt' : 'Restricted'}
                  />
                  <button
                    type="button"
                    onClick={() => void handleBatteryExemption()}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap transition-colors"
                  >
                    Allow Exemption
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F8FAFC] dark:bg-[var(--dark-canvas)] p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                    2. Autostart &amp; Background Protection
                  </p>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    Turn on Autostart (HiOS/XOS/MIUI) or remove from Samsung Sleeping apps.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAutostart()}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] hover:border-[#FF6A00] text-xs font-semibold text-[#08246B] dark:text-white whitespace-nowrap transition-colors"
                >
                  Open Autostart
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('permissions')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
