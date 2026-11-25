import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Calendar,
  Clock,
  Flame,
  PhoneCall,
  Play,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { AuthForm } from '@/src/components/AuthForm';
import { BrandLogo } from '@/src/components/BrandLogo';
import { formatEthiopianShort } from '@/src/lib/ethiopianCalendar';
import { useCalls } from '@/src/store/CallsContext';

const HERO_SIGNAL_BARS = [
  { delay: 0, heights: [0.35, 0.95, 0.5, 0.85, 0.35] },
  { delay: 0.14, heights: [0.65, 0.4, 1, 0.55, 0.65] },
  { delay: 0.28, heights: [0.45, 0.9, 0.38, 0.95, 0.45] },
  { delay: 0.42, heights: [0.8, 0.45, 0.78, 0.4, 0.8] },
  { delay: 0.56, heights: [0.5, 1, 0.6, 0.82, 0.5] },
];

const CORE_CAPABILITIES = [
  {
    num: '01',
    title: 'Dual-SIM ETC & SFC Costing',
    detail: 'Track Ethio Telecom & Safaricom Birr spend per call, day, and contact.',
    icon: Wallet,
  },
  {
    num: '02',
    title: 'Missed Call & Quiet Alerts',
    detail: 'Spot unreturned calls fast and reconnect with contacts going quiet.',
    icon: PhoneCall,
  },
  {
    num: '03',
    title: 'Ethiopian Calendar & Wishes',
    detail: 'EC dates, holiday countdowns, birthdays, and one-tap greeting wishes.',
    icon: Calendar,
  },
  {
    num: '04',
    title: 'Daily Streaks & Share Cards',
    detail: 'Build connection milestones and export private PNG streak cards.',
    icon: Flame,
  },
];

export function LandingHero({
  onOpenGuide,
}: {
  onOpenGuide: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const { enterGuestMode } = useCalls();
  const todayEc = formatEthiopianShort(new Date());

  const scrollToAuth = () => {
    const el = document.getElementById('hero-auth-card');
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8 lg:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-center">
        {/* Left Hero Column */}
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7 space-y-5 sm:space-y-6"
        >
          {/* Kicker (unboxed metadata per zero-pill discipline) */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#FF6A00]">
            <span>Ethiopian Dual-SIM Call Intelligence</span>
            <span aria-hidden="true" className="text-[#8A93A0]">·</span>
            <span className="text-[#4B5563] dark:text-[var(--dark-text-secondary)] tabular-nums">
              {todayEc} EC · UTC+3
            </span>
          </div>

          {/* Headline + Concrete Value Proposition */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-[3rem] font-extrabold tracking-tight leading-[1.08] text-[#08246B] dark:text-white [text-wrap:balance]">
              Every call,{' '}
              <span className="text-[#FF6A00]">Birr spent</span>, and{' '}
              <span className="text-[#FF6A00]">connection streak</span> in one place.
            </h1>
            <p className="text-sm sm:text-base text-[#4B5563] dark:text-[var(--dark-text-secondary)] max-w-xl leading-relaxed">
              Sync Android call logs or import backups to analyze Ethio Telecom and Safaricom airtime, catch missed callbacks, celebrate Ethiopian calendar holidays and birthdays, and stay connected with the people who matter.
            </p>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={enterGuestMode}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-sm font-semibold text-white flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <span>Explore Live Sample</span>
              <ArrowRight size={16} className="shrink-0" />
            </button>

            <button
              type="button"
              onClick={onOpenGuide}
              className="min-h-[46px] px-4 py-2.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] hover:border-[#FF6A00] text-sm font-semibold text-[#08246B] dark:text-white flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Play size={14} className="text-[#FF6A00] shrink-0" />
              <span>Animated Tour</span>
            </button>

            <button
              type="button"
              onClick={scrollToAuth}
              className="lg:hidden min-h-[46px] px-4 py-2.5 rounded-xl text-sm font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-surface)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <span>Sign In</span>
            </button>
          </div>

          {/* Showcase Panel */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#08246B] via-[#0D1B3E] to-[#111214] text-white p-5 sm:p-6 border border-white/12 shadow-xl space-y-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#FF6A00]/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-[#4FA3F7]/15 blur-3xl"
            />

            {/* Showcase Top Strip */}
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-xl p-1 bg-white/10 border border-white/15 shrink-0">
                  <BrandLogo size={32} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    Private Call &amp; Contact Workspace
                  </p>
                  <p className="text-[11px] text-white/70 truncate">
                    Android Direct Sync · CSV / JSON / TXT Import
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-end gap-0.5 h-4" aria-hidden="true">
                  {HERO_SIGNAL_BARS.map((bar, idx) => (
                    <motion.span
                      key={idx}
                      className="w-1 h-full rounded-full bg-[#FF8A33] origin-bottom"
                      animate={
                        prefersReducedMotion ? { scaleY: 0.7 } : { scaleY: bar.heights }
                      }
                      transition={
                        prefersReducedMotion
                          ? undefined
                          : {
                              duration: 1.5,
                              delay: bar.delay,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }
                      }
                    />
                  ))}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-white/80">
                  {todayEc} EC
                </span>
              </div>
            </div>

            {/* 4-Capability Grid */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-white/12">
              {CORE_CAPABILITIES.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.num}
                    className="rounded-2xl bg-white/[0.06] border border-white/10 p-3.5 flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#FF6A00]/20 text-[#FF8A33] flex items-center justify-center shrink-0">
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-bold text-white truncate">
                        <span className="font-mono text-[#FF8A33] mr-1.5">{cap.num}.</span>
                        {cap.title}
                      </p>
                      <p className="text-[11px] leading-relaxed text-white/70">
                        {cap.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Privacy & Schedule Highlights */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10 text-[11px] text-white/75">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#10B981] shrink-0" />
                <span>Private per-account storage · Phone numbers never shared</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-white/80">
                <Clock size={13} className="text-[#FF8A33] shrink-0" />
                <span>Scheduled callbacks &amp; calendar (.ics)</span>
              </span>
            </div>
          </div>
        </motion.section>

        {/* Right Auth Column */}
        <motion.div
          id="hero-auth-card"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 flex justify-center lg:justify-end"
        >
          <AuthForm allowGuest onOpenGuide={onOpenGuide} />
        </motion.div>
      </div>
    </div>
  );
}
