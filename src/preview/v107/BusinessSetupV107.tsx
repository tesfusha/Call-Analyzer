import { SettingsTab } from '@/src/components/SettingsTab';
import {
  formatHourShort,
  type BusinessConfig,
  type BusinessSimScope,
} from '@/src/preview/v107/businessStore';
import { useCalls } from '@/src/store/CallsContext';

const WEEKDAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

const SLA_OPTIONS = [10, 15, 30, 60];

export function BusinessSetupV107({
  config,
  onUpdateConfig,
  onOpenReminders,
  onOpenGuide,
  onOpenWhatsNew,
  onOpenAndroidSetup,
  onSelectContact,
  onCheckForUpdates,
}: {
  config: BusinessConfig;
  onUpdateConfig: (patch: Partial<BusinessConfig>) => void;
  onOpenReminders: () => void;
  onOpenGuide: () => void;
  onOpenWhatsNew: () => void;
  onOpenAndroidSetup: () => void;
  onSelectContact: (number: string) => void;
  onCheckForUpdates: () => Promise<void>;
}) {
  const { simLabels } = useCalls();

  const toggleWorkDay = (day: number) => {
    const exists = config.workDays.includes(day);
    const next = exists
      ? config.workDays.filter((d) => d !== day)
      : [...config.workDays, day].sort((a, b) => a - b);
    if (next.length > 0) {
      onUpdateConfig({ workDays: next });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
          style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
        >
          Business Setup
        </h1>
        <p className="text-xs text-[#626874] dark:text-[#989EA9]">
          Configure your work SIM, business hours, and callback speed goal (saved locally for V1.0.7 preview)
        </p>
      </div>

      {/* Business Rules Card */}
      <section className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
              Business / Team Name (used on exported reports)
            </label>
            <input
              type="text"
              value={config.businessName}
              onChange={(e) => onUpdateConfig({ businessName: e.target.value.slice(0, 60) })}
              placeholder="e.g. Addis Trading Co."
              className="w-full h-10 px-3 rounded-xl bg-[#F6F7F8] dark:bg-[#0D1014] border border-[#E2E5EA] dark:border-white/[0.1] text-sm text-[#14161A] dark:text-[#F4F4F1] focus:outline-none focus:border-[#E45A0D]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
              Business SIM line
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { key: 'all', label: 'Both SIMs' },
                  { key: 'SIM 1', label: simLabels.sim1Label || 'SIM 1' },
                  { key: 'SIM 2', label: simLabels.sim2Label || 'SIM 2' },
                ] as Array<{ key: BusinessSimScope; label: string }>
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onUpdateConfig({ businessSim: opt.key })}
                  className={`h-10 px-2.5 rounded-xl border text-xs font-medium truncate transition-colors ${
                    config.businessSim === opt.key
                      ? 'border-[#E45A0D] bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C]'
                      : 'border-[#E2E5EA] dark:border-white/[0.08] text-[#14161A] dark:text-[#F4F4F1]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Working Days */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">Working days</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w) => {
              const active = config.workDays.includes(w.day);
              return (
                <button
                  key={w.day}
                  type="button"
                  onClick={() => toggleWorkDay(w.day)}
                  className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                    active
                      ? 'border-[#0F2544] dark:border-[#F4762C] bg-[#0F2544] dark:bg-[#F4762C] text-white'
                      : 'border-[#E2E5EA] dark:border-white/[0.08] text-[#626874] dark:text-[#989EA9]'
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Working Hours + Callback SLA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
              Opens at
            </label>
            <select
              value={config.workStartHour}
              onChange={(e) => {
                const start = Number(e.target.value);
                onUpdateConfig({
                  workStartHour: start,
                  workEndHour: Math.max(start + 1, config.workEndHour),
                });
              }}
              className="w-full h-10 px-3 rounded-xl bg-[#F6F7F8] dark:bg-[#0D1014] border border-[#E2E5EA] dark:border-white/[0.1] text-sm font-mono text-[#14161A] dark:text-[#F4F4F1]"
            >
              {Array.from({ length: 23 }, (_, h) => (
                <option key={h} value={h}>
                  {formatHourShort(h)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
              Closes at
            </label>
            <select
              value={config.workEndHour}
              onChange={(e) => onUpdateConfig({ workEndHour: Number(e.target.value) })}
              className="w-full h-10 px-3 rounded-xl bg-[#F6F7F8] dark:bg-[#0D1014] border border-[#E2E5EA] dark:border-white/[0.1] text-sm font-mono text-[#14161A] dark:text-[#F4F4F1]"
            >
              {Array.from({ length: 24 - config.workStartHour }, (_, idx) => {
                const h = config.workStartHour + 1 + idx;
                return (
                  <option key={h} value={h}>
                    {h === 24 ? '12 AM (Midnight)' : formatHourShort(h)}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
              Callback speed goal
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {SLA_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => onUpdateConfig({ slaTargetMinutes: mins })}
                  className={`h-10 rounded-xl border text-xs font-mono font-semibold transition-colors ${
                    config.slaTargetMinutes === mins
                      ? 'border-[#E45A0D] bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C]'
                      : 'border-[#E2E5EA] dark:border-white/[0.08] text-[#14161A] dark:text-[#F4F4F1]'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Existing App Settings underneath */}
      <div className="pt-2 border-t border-[#E2E5EA] dark:border-white/[0.08]">
        <SettingsTab
          onOpenReminders={onOpenReminders}
          onOpenGuide={onOpenGuide}
          onOpenWhatsNew={onOpenWhatsNew}
          onOpenAndroidSetup={onOpenAndroidSetup}
          onSelectContact={onSelectContact}
          onCheckForUpdates={onCheckForUpdates}
        />
      </div>
    </div>
  );
}
