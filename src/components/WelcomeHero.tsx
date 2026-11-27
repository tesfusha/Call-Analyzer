import { RefreshCw, Upload, X } from 'lucide-react';
import { BrandLogo } from '@/src/components/BrandLogo';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import type { UpcomingHoliday } from '@/src/lib/ethiopianCalendar';
import { useDesignVersion } from '@/src/preview/designVersion';
import { WelcomeHeroV105 } from '@/src/preview/WelcomeHeroV105';

function getTimeGreeting(name: string): string {
  const hour = new Date().getHours();
  const base =
    hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : 'Good evening';
  return name.trim() ? `${base}, ${name.trim()}` : `Selam · ${base}`;
}

export function WelcomeHero({
  displayName,
  callsCount,
  savedContactsCount,
  unreturnedCount,
  upcomingHoliday,
  defaultLang,
  canSyncPhone,
  syncingPhone,
  onSyncPhone,
  onImportFile,
  onDismiss,
}: {
  displayName: string;
  callsCount: number;
  savedContactsCount: number;
  unreturnedCount: number;
  upcomingHoliday: UpcomingHoliday | null;
  defaultLang: 'english' | 'amharic';
  canSyncPhone?: boolean;
  syncingPhone?: boolean;
  onSyncPhone?: () => void;
  onImportFile: () => void;
  onDismiss: () => void;
}) {
  const designVersion = useDesignVersion();
  if (designVersion === 'v1.0.5') {
    return (
      <WelcomeHeroV105
        displayName={displayName}
        callsCount={callsCount}
        savedContactsCount={savedContactsCount}
        unreturnedCount={unreturnedCount}
        upcomingHoliday={upcomingHoliday}
        defaultLang={defaultLang}
        canSyncPhone={canSyncPhone}
        syncingPhone={syncingPhone}
        onSyncPhone={onSyncPhone}
        onImportFile={onImportFile}
        onDismiss={onDismiss}
      />
    );
  }

  const greeting = getTimeGreeting(displayName);
  const todayEc = `${formatEthiopianShort(new Date(), defaultLang)} EC`;

  return (
    <section className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-center shrink-0">
          <BrandLogo size={26} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#08246B] dark:text-white tracking-tight truncate">
              {greeting}
            </h2>
            {callsCount > 0 && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss greeting"
                className="sm:hidden w-8 h-8 -mr-1 rounded-lg text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center justify-center shrink-0 transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <p className="text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums truncate">
            <span className="text-[#FF6A00] font-semibold">{todayEc}</span>
            {callsCount === 0 ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>
                  {upcomingHoliday
                    ? `${upcomingHoliday.name} ${upcomingHoliday.isToday ? 'today' : `in ${upcomingHoliday.daysUntil}d`}`
                    : 'Sync calls or import a file to get started'}
                </span>
              </>
            ) : (
              <>
                <span aria-hidden="true"> · </span>
                <span>{callsCount.toLocaleString()} calls</span>
                <span aria-hidden="true"> · </span>
                <span>{savedContactsCount.toLocaleString()} contacts</span>
                {unreturnedCount > 0 && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="text-[#FF6A00] font-semibold">
                      {unreturnedCount} callback{unreturnedCount === 1 ? '' : 's'} due
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      {callsCount === 0 ? (
        <div className="flex items-center gap-2 shrink-0">
          {canSyncPhone && onSyncPhone ? (
            <button
              type="button"
              disabled={syncingPhone}
              onClick={onSyncPhone}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <RefreshCw size={13} className={syncingPhone ? 'animate-spin' : ''} />
              {syncingPhone ? 'Syncing...' : 'Sync Phone'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onImportFile}
            className={
              canSyncPhone && onSyncPhone
                ? 'min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors'
                : 'min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors'
            }
          >
            <Upload size={13} className={canSyncPhone && onSyncPhone ? 'text-[#FF6A00] shrink-0' : 'shrink-0'} />
            Import File
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss greeting"
          className="hidden sm:flex w-8 h-8 rounded-lg text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] items-center justify-center shrink-0 transition-colors"
        >
          <X size={15} />
        </button>
      )}
    </section>
  );
}
