import { motion, useReducedMotion } from 'motion/react';
import { Calendar, ShieldCheck, Wallet } from 'lucide-react';
import { AuthForm } from '@/src/components/AuthForm';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';

const COMPACT_HIGHLIGHTS = [
  {
    icon: Wallet,
    title: 'Dual-SIM Spend & Analytics',
    detail: 'Track Ethio Telecom & Safaricom talk time and Birr costs.',
  },
  {
    icon: Calendar,
    title: 'Ethiopian Calendar & Reminders',
    detail: 'Holidays, birthdays, missed callbacks, and return-call alerts.',
  },
  {
    icon: ShieldCheck,
    title: 'Private On-Device Storage',
    detail: 'Your call logs and contacts stay strictly on your phone.',
  },
] as const;

export function LandingHero({
  onOpenGuide: _onOpenGuide,
}: {
  onOpenGuide: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const todayEc = formatEthiopianShort(new Date());

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
        {/* Compact, calm intro */}
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 space-y-3 sm:space-y-5 text-center lg:text-left"
        >
          <p className="text-xs font-semibold text-[#FF6A00] tabular-nums">
            {todayEc} EC · Ethiopian Call Companion
          </p>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold tracking-tight leading-[1.12] text-[#08246B] dark:text-white [text-wrap:balance]">
              Understand every call and{' '}
              <span className="text-[#FF6A00]">Birr spent</span>, privately.
            </h1>
            <p className="text-xs sm:text-sm text-[#4B5563] dark:text-[var(--dark-text-secondary)] max-w-md mx-auto lg:mx-0 leading-relaxed">
              Dual-SIM call analytics, Ethiopian calendar wishes, and smart follow-up reminders — stored safely on your device.
            </p>
          </div>

          {/* Mobile: ultra-quiet unboxed single-line trust summary */}
          <p className="lg:hidden text-[11px] font-medium text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
            ETC &amp; SFC Spend <span aria-hidden="true" className="mx-1 text-[#8A93A0]">·</span> EC Calendar{' '}
            <span aria-hidden="true" className="mx-1 text-[#8A93A0]">·</span> 100% On-Device
          </p>

          {/* Desktop: clean unboxed hairline list (no heavy cards or clutter) */}
          <div className="hidden lg:block pt-3 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3.5 max-w-md">
            {COMPACT_HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <Icon size={17} className="text-[#FF6A00] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#08246B] dark:text-white leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Primary Focal Anchor: Big, Clear Sign-In Card */}
        <motion.div
          id="hero-auth-card"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.03, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 flex justify-center lg:justify-end"
        >
          <AuthForm allowGuest />
        </motion.div>
      </div>
    </div>
  );
}
