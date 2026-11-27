import { useMemo, useState } from 'react';
import { Briefcase, Pencil, Phone, Search, X } from 'lucide-react';
import { getContactKey } from '@/src/lib/contacts';
import { formatEtb } from '@/src/lib/ethiopia';
import { avatarColor, formatDuration, initials } from '@/src/lib/format';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { contactStats } from '@/src/lib/stats';
import {
  BUSINESS_STAGES,
  QUICK_CALL_OUTCOMES,
  isBusinessCall,
  type BusinessConfig,
  type BusinessStage,
  type CrmContactMeta,
} from '@/src/preview/v107/businessStore';
import { useCalls } from '@/src/store/CallsContext';

type StageFilter = 'all' | BusinessStage;

export function BusinessPipelineV107({
  config,
  crm,
  onUpdateCrm,
  onSelectContact,
  onCallBack,
}: {
  config: BusinessConfig;
  crm: Record<string, CrmContactMeta>;
  onUpdateCrm: (contactKey: string, patch: Partial<CrmContactMeta>) => void;
  onSelectContact: (number: string) => void;
  onCallBack: (number: string) => void;
}) {
  const { calls, contacts: savedProfiles } = useCalls();
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{
    key: string;
    name: string;
    number: string;
  } | null>(null);

  const [draftStage, setDraftStage] = useState<BusinessStage>('lead');
  const [draftDeal, setDraftDeal] = useState('');
  const [draftCompany, setDraftCompany] = useState('');
  const [draftOutcome, setDraftOutcome] = useState('');

  const people = useMemo(() => {
    const bizCalls = calls.filter((c) => isBusinessCall(c, config, crm) || Boolean(crm[getContactKey(c.number)]));
    const stats = contactStats(bizCalls);
    const map = new Map<
      string,
      {
        key: string;
        number: string;
        name: string;
        count: number;
        duration: number;
        lastTimestamp: number;
        meta: CrmContactMeta;
      }
    >();

    for (const s of stats) {
      const k = getContactKey(s.number);
      const prof = savedProfiles[k];
      const meta: CrmContactMeta = crm[k] ?? {
        stage: 'lead',
        dealValueEtb: 0,
        company: '',
        lastOutcome: '',
        updatedAt: 0,
      };
      map.set(k, {
        key: k,
        number: s.number,
        name: prof?.name?.trim() || formatDisplayNameOrPhone(s.name, s.number),
        count: s.count,
        duration: s.duration,
        lastTimestamp: s.lastTimestamp,
        meta,
      });
    }

    return [...map.values()].sort(
      (a, b) =>
        (b.meta.dealValueEtb || 0) - (a.meta.dealValueEtb || 0) ||
        b.count - a.count,
    );
  }, [calls, config, crm, savedProfiles]);

  const stageCounts = useMemo(() => {
    const counts: Record<StageFilter, number> = {
      all: 0,
      lead: 0,
      followup: 0,
      client: 0,
      won: 0,
      supplier: 0,
      personal: 0,
    };
    for (const p of people) {
      counts[p.meta.stage] += 1;
      if (p.meta.stage !== 'personal') counts.all += 1;
    }
    return counts;
  }, [people]);

  const totals = useMemo(() => {
    let openValue = 0;
    let wonValue = 0;
    for (const p of people) {
      const val = p.meta.dealValueEtb || 0;
      if (p.meta.stage === 'won') wonValue += val;
      else if (p.meta.stage !== 'personal' && p.meta.stage !== 'supplier') openValue += val;
    }
    return { openValue, wonValue };
  }, [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (stageFilter === 'all' && p.meta.stage === 'personal') return false;
      if (stageFilter !== 'all' && p.meta.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.number.toLowerCase().includes(q) ||
        p.meta.company.toLowerCase().includes(q) ||
        p.meta.lastOutcome.toLowerCase().includes(q)
      );
    });
  }, [people, stageFilter, query]);

  const openEditor = (p: (typeof people)[number]) => {
    setEditing({ key: p.key, name: p.name, number: p.number });
    setDraftStage(p.meta.stage);
    setDraftDeal(p.meta.dealValueEtb > 0 ? String(p.meta.dealValueEtb) : '');
    setDraftCompany(p.meta.company);
    setDraftOutcome(p.meta.lastOutcome);
  };

  const saveEditor = () => {
    if (!editing) return;
    const numericDeal = Math.max(0, Number(draftDeal.replace(/[^\d.]/g, '')) || 0);
    onUpdateCrm(editing.key, {
      stage: draftStage,
      dealValueEtb: numericDeal,
      company: draftCompany.trim().slice(0, 60),
      lastOutcome: draftOutcome.trim().slice(0, 80),
      updatedAt: Date.now(),
    });
    setEditing(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
            style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
          >
            Sales Pipeline
          </h1>
          <p className="text-xs text-[#626874] dark:text-[#989EA9]">
            Phone-first mini-CRM — track lead stage, deal value (ETB), and call outcomes
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <div>
            <span className="text-[#626874] dark:text-[#989EA9]">Open: </span>
            <span className="font-bold text-[#14161A] dark:text-[#F4F4F1]">
              {formatEtb(totals.openValue)}
            </span>
          </div>
          <div>
            <span className="text-[#626874] dark:text-[#989EA9]">Won: </span>
            <span className="font-bold text-[#16A34A] dark:text-[#4ADE80]">
              {formatEtb(totals.wonValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B92A0]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lead, company, number, or outcome…"
          aria-label="Search pipeline"
          className="w-full h-11 pl-10 pr-9 rounded-xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] text-sm text-[#14161A] dark:text-[#F4F4F1] placeholder:text-[#8B92A0] focus:outline-none focus:border-[#E45A0D]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-[#8B92A0] flex items-center justify-center"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Stage Filter Segmented Strip */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          role="group"
          aria-label="Filter pipeline by stage"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EAECEF] dark:bg-[#151921]"
        >
          {(
            [
              { key: 'all', label: `All (${stageCounts.all})` },
              ...BUSINESS_STAGES.map((st) => ({
                key: st.key,
                label: `${st.shortLabel} (${stageCounts[st.key]})`,
              })),
            ] as Array<{ key: StageFilter; label: string }>
          ).map((item) => {
            const active = stageFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setStageFilter(item.key)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-white dark:bg-[#232936] text-[#14161A] dark:text-[#F4F4F1] shadow-xs'
                    : 'text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-[#F4F4F1]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CRM Contact List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-10 text-center space-y-1.5">
          <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1]">
            No contacts in this stage
          </p>
          <p className="text-xs text-[#626874] dark:text-[#989EA9]">
            Assign stages or deal values to any business caller to build your sales pipeline.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] divide-y divide-[#EEF0F4] dark:divide-white/[0.06] overflow-hidden">
          {filtered.slice(0, 75).map((p) => {
            const stageInfo =
              BUSINESS_STAGES.find((s) => s.key === p.meta.stage) ?? BUSINESS_STAGES[0];
            return (
              <div
                key={p.key}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFBFC] dark:hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectContact(p.number)}
                    className="w-10 h-10 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: avatarColor(p.number) }}
                  >
                    {initials(p.name, p.number)}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditor(p)}
                    className="min-w-0 text-left"
                  >
                    <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] truncate">
                      {p.name}
                      {p.meta.company ? (
                        <span className="font-normal text-[#626874] dark:text-[#989EA9]">
                          {' '}
                          · {p.meta.company}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[#626874] dark:text-[#989EA9] truncate tabular-nums">
                      <span className={`font-semibold ${stageInfo.accentClass}`}>
                        {stageInfo.label}
                      </span>
                      {p.meta.dealValueEtb > 0 ? ` · ${formatEtb(p.meta.dealValueEtb)}` : ''}
                      {p.meta.lastOutcome ? ` · ${p.meta.lastOutcome}` : ''}
                      {` · ${p.count} calls (${formatDuration(p.duration)})`}
                    </p>
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-13 sm:pl-0">
                  <select
                    aria-label={`Stage for ${p.name}`}
                    value={p.meta.stage}
                    onChange={(e) =>
                      onUpdateCrm(p.key, {
                        stage: e.target.value as BusinessStage,
                        updatedAt: Date.now(),
                      })
                    }
                    className="h-9 px-2.5 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] bg-[#F6F7F8] dark:bg-[#0D1014] text-xs font-medium text-[#14161A] dark:text-[#F4F4F1]"
                  >
                    {BUSINESS_STAGES.map((st) => (
                      <option key={st.key} value={st.key}>
                        {st.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => openEditor(p)}
                    aria-label={`Edit deal for ${p.name}`}
                    className="w-9 h-9 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-white flex items-center justify-center"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onCallBack(p.number)}
                    aria-label={`Call ${p.name}`}
                    className="w-9 h-9 rounded-xl bg-[#0F2544] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] flex items-center justify-center"
                  >
                    <Phone size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-Up Deal & CRM Editor Sheet */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center"
          onClick={() => setEditing(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit business contact"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#151921] border-t sm:border border-[#E2E5EA] dark:border-white/[0.1] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Briefcase size={16} className="text-[#E45A0D] shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#14161A] dark:text-[#F4F4F1] truncate">
                    {editing.name}
                  </h2>
                  <p className="text-xs font-mono text-[#626874] dark:text-[#989EA9]">
                    {editing.number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close editor"
                className="w-9 h-9 rounded-xl text-[#626874] hover:bg-[#EAECEF] dark:hover:bg-white/[0.06] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
                  Stage
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {BUSINESS_STAGES.map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setDraftStage(st.key)}
                      className={`min-h-[38px] px-2 rounded-xl border text-xs font-medium transition-colors ${
                        draftStage === st.key
                          ? 'border-[#E45A0D] bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C]'
                          : 'border-[#E2E5EA] dark:border-white/[0.08] text-[#14161A] dark:text-[#F4F4F1]'
                      }`}
                    >
                      {st.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
                    Deal value (ETB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={draftDeal}
                    onChange={(e) => setDraftDeal(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full h-10 px-3 rounded-xl bg-[#F6F7F8] dark:bg-[#0D1014] border border-[#E2E5EA] dark:border-white/[0.1] text-sm font-mono text-[#14161A] dark:text-[#F4F4F1] focus:outline-none focus:border-[#E45A0D]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
                    Company / Shop
                  </label>
                  <input
                    type="text"
                    value={draftCompany}
                    onChange={(e) => setDraftCompany(e.target.value)}
                    placeholder="Optional"
                    className="w-full h-10 px-3 rounded-xl bg-[#F6F7F8] dark:bg-[#0D1014] border border-[#E2E5EA] dark:border-white/[0.1] text-sm text-[#14161A] dark:text-[#F4F4F1] focus:outline-none focus:border-[#E45A0D]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#626874] dark:text-[#989EA9]">
                  Last call outcome
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CALL_OUTCOMES.map((outcome) => (
                    <button
                      key={outcome}
                      type="button"
                      onClick={() => setDraftOutcome(outcome)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                        draftOutcome === outcome
                          ? 'border-[#E45A0D] bg-[#FFF5EE] dark:bg-[#E45A0D]/15 text-[#E45A0D] dark:text-[#F4762C]'
                          : 'border-[#E2E5EA] dark:border-white/[0.08] text-[#626874] dark:text-[#989EA9]'
                      }`}
                    >
                      {outcome}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={draftOutcome}
                  onChange={(e) => setDraftOutcome(e.target.value)}
                  placeholder="Or type custom outcome…"
                  className="w-full h-10 px-3 rounded-xl bg-[#F6F7F8] dark:bg-[#0D1014] border border-[#E2E5EA] dark:border-white/[0.1] text-sm text-[#14161A] dark:text-[#F4F4F1] focus:outline-none focus:border-[#E45A0D]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] text-xs font-semibold text-[#14161A] dark:text-[#F4F4F1]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditor}
                className="flex-1 min-h-[44px] rounded-xl bg-[#0F2544] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] text-xs font-semibold"
              >
                Save deal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
