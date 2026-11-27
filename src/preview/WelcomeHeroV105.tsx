import { RefreshCw, Upload, X } from 'lucide-react';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import type { UpcomingHoliday } from '@/src/lib/ethiopianCalendar';

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const base =
    hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : 'Good evening';
  return name.trim() ? `${base}, ${name.trim()}` : base;
}

export function WelcomeHeroV105({
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
  const greeting = getGreeting(displayName);
  const todayEc = `${formatEthiopianShort(new Date(), defaultLang)} EC`;

  return (
    <section className="pb-3.5 border-b border-[#E6E3DC] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="v105-display text-lg sm:text-xl font-bold tracking-[-0.025em] text-[#16181D] dark:text-[#F3F2EE] truncate">
            {greeting}
          </h2>
          {callsCount > 0 && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss greeting"
              className="sm:hidden w-8 h-8 -mr-1 rounded-lg text-[#5D626E] dark:text-[#989DA8] hover:bg-[#EFECE6] dark:hover:bg-white/[0.06] flex items-center justify-center shrink-0 transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <p className="text-xs text-[#5D626E] dark:text-[#989DA8] tabular-nums flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-mono font-semibold text-[#16181D] dark:text-[#F3F2EE]">
            {todayEc}
          </span>
          {callsCount === 0 ? (
            <>
              <span aria-hidden="true" className="opacity-45">·</span>
              <span>
                {upcomingHoliday
                  ? `${upcomingHoliday.name} ${upcomingHoliday.isToday ? 'today' : `in ${upcomingHoliday.daysUntil}d`}`
                  : 'Sync your phone or import a call file to begin'}
              </span>
            </>
          ) : (
            <>
              <span aria-hidden="true" className="opacity-45">·</span>
              <span className="font-mono">{callsCount.toLocaleString()} calls</span>
              <span aria-hidden="true" className="opacity-45">·</span>
              <span className="font-mono">{savedContactsCount.toLocaleString()} contacts</span>
              {unreturnedCount > 0 && (
                <>
                  <span aria-hidden="true" className="opacity-45">·</span>
                  <span className="font-semibold text-[#D95B16] dark:text-[#F0742B]">
                    {unreturnedCount} callback{unreturnedCount === 1 ? '' : 's'} due
                  </span>
                </>
              )}
            </>
          )}
        </p>
      </div>

      {callsCount === 0 ? (
        <div className="flex items-center gap-2 shrink-0">
          {canSyncPhone && onSyncPhone ? (
            <button
              type="button"
              disabled={syncingPhone}
              onClick={onSyncPhone}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#D95B16] hover:bg-[#BF4D10] dark:bg-[#E06722] dark:hover:bg-[#CC5A19] disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
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
                ? 'min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#E6E3DC] dark:border-white/[0.1] bg-white dark:bg-[#16191E] text-xs font-semibold text-[#16181D] dark:text-[#F3F2EE] hover:bg-[#EFECE6] dark:hover:bg-[#1F232A] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors'
                : 'min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#D95B16] hover:bg-[#BF4D10] dark:bg-[#E06722] dark:hover:bg-[#CC5A19] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors'
            }
          >
            <Upload size={13} className="shrink-0" />
            Import File
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss greeting"
          className="hidden sm:flex w-8 h-8 rounded-lg text-[#5D626E] dark:text-[#989DA8] hover:bg-[#EFECE6] dark:hover:bg-white/[0.06] items-center justify-center shrink-0 transition-colors"
        >
          <X size={15} />
        </button>
      )}
    </section>
  );
}
