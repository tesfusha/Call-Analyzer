import { motion, useReducedMotion } from 'motion/react';
import { AuthForm } from '@/src/components/AuthForm';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';

const LEDGER_PILLARS = [
  {
    index: '01',
    title: 'Dual-SIM airtime & Birr ledger',
    detail:
      'Break down Ethio Telecom and Safaricom call time, per-caller totals, and monthly voice spend.',
  },
  {
    index: '02',
    title: 'Ethiopian calendar & callbacks',
    detail:
      'Track 13-month holidays, contact birthdays, missed callbacks, and long-gap return calls.',
  },
  {
    index: '03',
    title: 'Private by architecture',
    detail:
      'Call logs and saved contacts stay on your device, with optional PIN lock and local backup.',
  },
] as const;

export function LandingHeroV105({
  onOpenGuide: _onOpenGuide,
}: {
  onOpenGuide: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const now = new Date();
  const todayEc = formatEthiopianShort(now);
  const todayGc = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-5 sm:px-8 py-4 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Left editorial column */}
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 space-y-6 text-left"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono tabular-nums text-[#5D626E] dark:text-[#989DA8]">
            <span className="font-semibold text-[#D95B16] dark:text-[#F0742B]">
              {todayEc} EC
            </span>
            <span aria-hidden="true">·</span>
            <span>{todayGc}</span>
            <span aria-hidden="true">·</span>
            <span>Ethiopian Call Ledger</span>
          </div>

          <div className="space-y-3.5">
            <h1 className="v105-display text-3xl sm:text-4xl lg:text-[2.85rem] font-bold tracking-[-0.03em] leading-[1.08] text-[#16181D] dark:text-[#F3F2EE] [text-wrap:balance]">
              Every call and Birr spent, accounted for privately.
            </h1>
            <p className="text-sm sm:text-[15px] text-[#5D626E] dark:text-[#989DA8] max-w-lg leading-relaxed">
              A quiet personal ledger for dual-SIM call analytics, Ethiopian calendar wishes, and missed-call follow-ups—kept strictly on your device.
            </p>
          </div>

          {/* Mobile compact unboxed summary */}
          <p className="lg:hidden text-xs font-medium text-[#5D626E] dark:text-[#989DA8] pt-1 border-t border-[#E6E3DC] dark:border-white/[0.08]">
            Ethio Telecom &amp; Safaricom
            <span aria-hidden="true" className="mx-1.5 opacity-50">·</span>
            13-Month EC Calendar
            <span aria-hidden="true" className="mx-1.5 opacity-50">·</span>
            On-Device Privacy
          </p>

          {/* Desktop editorial hairline ledger */}
          <ol className="hidden lg:block pt-2 border-t border-[#E6E3DC] dark:border-white/[0.08] divide-y divide-[#E6E3DC] dark:divide-white/[0.08] max-w-lg">
            {LEDGER_PILLARS.map((item) => (
              <li
                key={item.index}
                className="py-3.5 first:pt-4 last:pb-0 grid grid-cols-[2rem_1fr] gap-3 items-baseline"
              >
                <span className="font-mono text-xs font-semibold tabular-nums text-[#8B8F99] dark:text-[#6E7480]">
                  {item.index}
                </span>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold text-[#16181D] dark:text-[#F3F2EE] leading-snug">
                    {item.title}
                  </p>
                  <p className="text-[13px] text-[#5D626E] dark:text-[#989DA8] leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </motion.section>

        {/* Right focal anchor: Sign-in card */}
        <motion.div
          id="hero-auth-card"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.03, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 flex justify-center lg:justify-end"
        >
          <AuthForm allowGuest />
        </motion.div>
      </div>
    </div>
  );
}
