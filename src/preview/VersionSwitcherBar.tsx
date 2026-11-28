import { useState } from 'react';
import { ArrowLeft, ChevronDown, Eye, Layers, X } from 'lucide-react';
import {
  setDesignVersion,
  useDesignVersion,
  type DesignVersion,
} from '@/src/preview/designVersion';
import { useCalls } from '@/src/store/CallsContext';

const UNSLOP_PASSES = [
  '1. Spacing: Generous editorial rhythm, consistent padding, calmer 12px radii',
  '2. Color (60-30-10): Warm alabaster/obsidian canvas, charcoal ink, restrained saffron accent',
  '3. Icons: Removed loud orange tinting from secondary controls & toast dots',
  '4. Copy & Hierarchy: Editorial numbered landing ledger, tighter headings',
  '5. Typography: Bricolage Grotesque display paired with Plus Jakarta Sans & JetBrains Mono',
  '6. Layout: Quiet paper-segmented category tabs & unboxed sidebar utility rows',
  '7. Details: Crisp hairline rules, clean focus rings, frosted mobile bottom bar',
  '8. Visuals: Single-elevation cards & cleaner chart/modal framing',
  '9. Motion: Crisp 160ms deceleration curves with subtle press feedback',
] as const;

const V106_HIGHLIGHTS = [
  'Simple 5-tab layout: Calls, People, Insights, Calendar, Settings (no duplicate sub-tabs)',
  'Upgraded Trend Chart: 7D / 14D / 30D / 90D / All with Daily/Weekly/Monthly auto-grouping',
  'Switch chart between Talk Time, Calls, and ETB Spend + previous-period comparison',
  'Cleaner Call rows: 4 calm scannable items + slide-up Filter bottom sheet',
  'Unified People hub: Contacts, VIPs, Quiet friends, and Birthdays in one place',
  'Plain-English Insights: Monthly spend budget bar, talk time, and top person up front',
] as const;

const V107_HIGHLIGHTS = [
  'Work vs Personal split: Business SIM scope, working days/hours & personal contact exclusion',
  'Lead Queue & SLA: Unreturned missed leads, First-Time New Inquiries, avg callback speed & SLA %',
  'Phone-First Mini-CRM: Pipeline stages (New Lead → Follow-Up → Active → Won), ETB deal values & outcomes',
  'Business Analytics: Answer rate %, 24h peak customer hours, 7D–All trend chart & business airtime spend',
  'Executive Reports: 1-tap WhatsApp/Telegram summary copy, sanitized Business CSV & printable HTML report',
] as const;

const V110_HIGHLIGHTS = [
  'Emil Kowalski Design Eng: critically damped spring indicators on tabs & segmented filters',
  'Tactile press physics: immediate scale(0.97) on pointerdown with touch-safe hover gating',
  'UI Cheatsheet details: relative-to-absolute timestamps after 7d, tabular-nums & Intl.PluralRules',
  'Mobile-native craft: 100dvh safe-area shell, Vaul-style filter sheet & concentric nested radii',
  'Instant keyboard shortcuts: press / to search or 1–6 to jump tabs with zero artificial delay',
] as const;

export function VersionSwitcherBar() {
  const { isAdmin } = useCalls();
  const version = useDesignVersion();
  const [notesOpen, setNotesOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Strictly admin-only and hidden in the default v1.0.4 production shell
  if (!isAdmin || version === 'v1.0.3') {
    return null;
  }

  const handleSelect = (next: DesignVersion) => {
    setDesignVersion(next);
  };

  if (minimized) {
    return (
      <div
        data-version-switcher="true"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 right-3 sm:right-4 z-50 flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={() => handleSelect('v1.0.3')}
          aria-label="Exit UI preview and return to v1.0.4"
          className="h-9 px-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-white text-[11px] font-semibold shadow-md flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={12} />
          <span>Exit</span>
        </button>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Open admin preview switcher"
          className="h-9 px-3 rounded-lg border border-[#D8D4CB] dark:border-white/[0.14] bg-white/95 dark:bg-[#16191E]/95 backdrop-blur-md text-[11px] font-mono font-semibold text-[#16181D] dark:text-[#F3F2EE] shadow-md flex items-center gap-1.5 hover:border-[#D95B16] transition-colors"
        >
          <Eye size={13} className="text-[#D95B16] dark:text-[#F0742B]" />
          <span>{version}</span>
        </button>
      </div>
    );
  }

  const activeNotes =
    version === 'v1.1.0'
      ? V110_HIGHLIGHTS
      : version === 'v1.0.7'
        ? V107_HIGHLIGHTS
        : version === 'v1.0.6'
          ? V106_HIGHLIGHTS
          : UNSLOP_PASSES;
  const activeTitle =
    version === 'v1.1.0'
      ? 'Craft V1.1.0 — Emil Design Eng'
      : version === 'v1.0.7'
        ? 'Business Call Analysis V1.0.7'
        : version === 'v1.0.6'
          ? 'Simple & Modern V1.0.6 Preview'
          : 'Unslop V1.0.5 — 9 Passes';

  return (
    <div
      data-version-switcher="true"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 right-3 sm:right-4 z-50 flex flex-col items-end gap-2 max-w-[calc(100vw-1.5rem)]"
    >
      {notesOpen && (
        <div className="w-[310px] sm:w-[340px] rounded-xl border border-[#E6E3DC] dark:border-white/[0.12] bg-white/98 dark:bg-[#16191E]/98 backdrop-blur-md shadow-xl p-3.5 space-y-2.5 text-left">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E6E3DC] dark:border-white/[0.08]">
            <div>
              <p className="text-xs font-semibold text-[#16181D] dark:text-[#F3F2EE]">
                {activeTitle}
              </p>
              <p className="text-[11px] text-[#5D626E] dark:text-[#989DA8]">
                Admin Preview Lab · hidden from regular users
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              aria-label="Close preview notes"
              className="w-7 h-7 rounded-md text-[#5D626E] dark:text-[#989DA8] hover:bg-[#EFECE6] dark:hover:bg-white/[0.08] flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {activeNotes.map((line) => (
              <li
                key={line}
                className="text-[11px] leading-snug text-[#3F444E] dark:text-[#C5C9D1]"
              >
                • {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-[#D8D4CB] dark:border-white/[0.14] bg-white/95 dark:bg-[#16191E]/95 backdrop-blur-md shadow-lg">
        <button
          type="button"
          onClick={() => handleSelect('v1.0.3')}
          title="Return to Main v1.0.4"
          className="h-8 px-2.5 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-[11px] font-semibold text-white flex items-center gap-1 whitespace-nowrap transition-colors"
        >
          <ArrowLeft size={12} />
          <span>v1.0.4</span>
        </button>

        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          aria-expanded={notesOpen}
          title="View preview changes"
          className="h-8 px-2 rounded-lg text-[11px] font-medium text-[#5D626E] dark:text-[#989DA8] hover:text-[#16181D] dark:hover:text-[#F3F2EE] hover:bg-[#EFECE6] dark:hover:bg-white/[0.06] flex items-center gap-1 whitespace-nowrap transition-colors"
        >
          <Layers size={12} />
          <span className="hidden sm:inline">Notes</span>
        </button>

        <div
          role="group"
          aria-label="Admin preview design version"
          className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#EFECE6] dark:bg-[#0E1013]"
        >
          {(['v1.0.5', 'v1.0.6', 'v1.0.7', 'v1.1.0'] as const).map((ver) => {
            const active = version === ver;
            return (
              <button
                key={ver}
                type="button"
                onClick={() => handleSelect(ver)}
                aria-pressed={active}
                className={`h-7 px-2 rounded-md text-[11px] font-mono font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? ver === 'v1.1.0'
                      ? 'bg-[#111214] dark:bg-[#F5F6F8] text-white dark:text-[#111214] shadow-xs'
                      : ver === 'v1.0.7'
                        ? 'bg-[#0F2544] dark:bg-[#F4762C] text-white shadow-xs'
                        : ver === 'v1.0.6'
                          ? 'bg-[#E45A0D] text-white shadow-xs'
                          : 'bg-[#16181D] dark:bg-[#F3F2EE] text-white dark:text-[#16181D] shadow-xs'
                    : 'text-[#5D626E] dark:text-[#989DA8] hover:text-[#16181D] dark:hover:text-[#F3F2EE]'
                }`}
              >
                {ver}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setNotesOpen(false);
            setMinimized(true);
          }}
          aria-label="Minimize preview bar"
          className="w-7 h-8 rounded-lg text-[#5D626E] dark:text-[#989DA8] hover:text-[#16181D] dark:hover:text-[#F3F2EE] hover:bg-[#EFECE6] dark:hover:bg-white/[0.06] flex items-center justify-center transition-colors"
        >
          <ChevronDown size={13} />
        </button>
      </div>
    </div>
  );
}
