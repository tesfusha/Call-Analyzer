import { useMemo, useState } from 'react';
import { MessageSquare, Phone } from 'lucide-react';
import { ContactAvatar } from '@/src/components/ContactAvatar';
import { getContactKey } from '@/src/lib/contacts';
import { normaliseEthPhone } from '@/src/lib/ethiopia';
import { formatDateTime, formatDuration } from '@/src/lib/format';
import { quietContacts, quietMessage } from '@/src/lib/reminders';
import { formatDisplayNameOrPhone } from '@/src/lib/security';
import { filterCallsForInsightsRange } from '@/src/preview/v106/TrendChartV106';
import {
  BUSINESS_STAGES,
  computeBusinessMetrics,
  formatMinutesCompact,
  isBusinessCall,
  type BusinessConfig,
  type BusinessStage,
  type CrmContactMeta,
} from '@/src/preview/v107/businessStore';
import { useCalls } from '@/src/store/CallsContext';

type LeadQueueTab = 'unreturned' | 'inquiries' | 'cooling';

function buildSmsHref(rawNumber: string, text: string): string {
  const clean = rawNumber.replace(/[^\d+]/g, '');
  return `sms:${clean}?body=${encodeURIComponent(text)}`;
}

export function BusinessLeadsV107({
  config,
  crm,
  onSetStage,
  onCallBack,
  onSelectContact,
}: {
  config: BusinessConfig;
  crm: Record<string, CrmContactMeta>;
  onSetStage: (contactKey: string, stage: BusinessStage) => void;
  onCallBack: (number: string) => void;
  onSelectContact: (number: string) => void;
}) {
  const { calls, tariffs, reminderPrefs } = useCalls();
  const [tab, setTab] = useState<LeadQueueTab>('unreturned');

  const last30Calls = useMemo(() => filterCallsForInsightsRange(calls, '30d'), [calls]);
  const metrics = useMemo(
    () => computeBusinessMetrics(calls, last30Calls, config, tariffs, crm),
    [calls, last30Calls, config, tariffs, crm],
  );

  const coolingClients = useMemo(() => {
    const bizCalls = calls.filter((c) => isBusinessCall(c, config, crm));
    return quietContacts(bizCalls, new Date(), reminderPrefs.quietContactDays || 30);
  }, [calls, config, crm, reminderPrefs.quietContactDays]);

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-[#14161A] dark:text-[#F4F4F1]"
          style={{ fontFamily: '"Bricolage Grotesque", "Plus Jakarta Sans", sans-serif' }}
        >
          Lead Queue
        </h1>
        <p className="text-xs text-[#626874] dark:text-[#989EA9]">
          Missed leads to call back, first-time inquiries (30d), and cooling regular clients
        </p>
      </div>

      {/* Queue Segment Bar */}
      <div
        role="group"
        aria-label="Lead queue category"
        className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EAECEF] dark:bg-[#151921]"
      >
        {(
          [
            { key: 'unreturned', label: `Unreturned (${metrics.unreturnedLeads.length})` },
            { key: 'inquiries', label: `New inquiries (${metrics.newInquiries.length})` },
            { key: 'cooling', label: `Cooling clients (${coolingClients.length})` },
          ] as Array<{ key: LeadQueueTab; label: string }>
        ).map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`min-h-[36px] px-3.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
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

      {/* Tab 1: Unreturned Missed Leads */}
      {tab === 'unreturned' &&
        (metrics.unreturnedLeads.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-10 text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#16A34A] dark:text-[#4ADE80]">
              Zero unreturned leads
            </p>
            <p className="text-xs text-[#626874] dark:text-[#989EA9]">
              Every missed business call in the last 30 days has been returned.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] divide-y divide-[#EEF0F4] dark:divide-white/[0.06] overflow-hidden">
            {metrics.unreturnedLeads.map((lead) => {
              const currentStage = crm[lead.contactKey]?.stage ?? 'lead';
              const followUpMsg = `Hello, we noticed your missed call to ${config.businessName || 'us'}. How can we help you today?`;
              return (
                <div
                  key={lead.call.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFBFC] dark:hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectContact(lead.call.number)}
                      className="rounded-full shrink-0"
                      aria-label={`Open contact ${lead.displayName}`}
                    >
                      <ContactAvatar name={lead.call.name} number={lead.call.number} size="md" />
                    </button>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectContact(lead.call.number)}
                        className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] hover:text-[#E45A0D] truncate block text-left"
                      >
                        {lead.displayName}
                      </button>
                      <p className="text-xs text-[#626874] dark:text-[#989EA9] truncate tabular-nums">
                        <span className="font-semibold text-[#DC2626] dark:text-[#F87171]">
                          Waiting {formatMinutesCompact(lead.waitMinutes)}
                        </span>
                        {' · '}
                        {lead.isNewInquiry ? 'First-time inquiry' : 'Repeat caller'}
                        {lead.missedAttempts > 1 ? ` · ${lead.missedAttempts} missed` : ''}
                        {lead.afterHours ? ' · After hours' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-13 sm:pl-0">
                    <select
                      aria-label={`CRM stage for ${lead.displayName}`}
                      value={currentStage}
                      onChange={(e) => onSetStage(lead.contactKey, e.target.value as BusinessStage)}
                      className="h-9 px-2.5 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] bg-[#F6F7F8] dark:bg-[#0D1014] text-xs font-medium text-[#14161A] dark:text-[#F4F4F1]"
                    >
                      {BUSINESS_STAGES.map((st) => (
                        <option key={st.key} value={st.key}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                    <a
                      href={buildSmsHref(lead.call.number, followUpMsg)}
                      aria-label={`Send SMS to ${lead.displayName}`}
                      className="w-9 h-9 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] text-[#626874] dark:text-[#989EA9] hover:text-[#14161A] dark:hover:text-white flex items-center justify-center"
                    >
                      <MessageSquare size={15} />
                    </a>
                    <button
                      type="button"
                      onClick={() => onCallBack(lead.call.number)}
                      className="h-9 px-3.5 rounded-xl bg-[#E45A0D] hover:bg-[#C94D09] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Phone size={13} />
                      <span>Call</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* Tab 2: New First-Time Inquiries (30d) */}
      {tab === 'inquiries' &&
        (metrics.newInquiries.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-10 text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1]">
              No first-time callers in the last 30 days
            </p>
            <p className="text-xs text-[#626874] dark:text-[#989EA9]">
              Brand-new numbers calling your business line will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] divide-y divide-[#EEF0F4] dark:divide-white/[0.06] overflow-hidden">
            {metrics.newInquiries.slice(0, 60).map((inq) => {
              const currentStage = crm[inq.contactKey]?.stage ?? 'lead';
              return (
                <div
                  key={inq.contactKey}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFBFC] dark:hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectContact(inq.number)}
                      className="rounded-full shrink-0"
                      aria-label={`Open contact ${inq.displayName}`}
                    >
                      <ContactAvatar name={inq.displayName} number={inq.number} size="md" />
                    </button>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectContact(inq.number)}
                        className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] hover:text-[#E45A0D] truncate block text-left"
                      >
                        {inq.displayName}
                      </button>
                      <p className="text-xs text-[#626874] dark:text-[#989EA9] truncate tabular-nums">
                        First call {formatDateTime(inq.firstCall.timestamp)} · {inq.totalCallsInPeriod}{' '}
                        {inq.totalCallsInPeriod === 1 ? 'call' : 'calls'} ·{' '}
                        {inq.wasAnswered ? formatDuration(inq.totalDurationInPeriod) : 'Not answered yet'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-13 sm:pl-0">
                    <select
                      aria-label={`CRM stage for ${inq.displayName}`}
                      value={currentStage}
                      onChange={(e) => onSetStage(inq.contactKey, e.target.value as BusinessStage)}
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
                      onClick={() => onCallBack(inq.number)}
                      aria-label={`Call ${inq.displayName}`}
                      className="w-9 h-9 rounded-xl bg-[#0F2544] dark:bg-[#F4F4F1] text-white dark:text-[#14161A] flex items-center justify-center"
                    >
                      <Phone size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* Tab 3: Cooling Clients (Win-Back) */}
      {tab === 'cooling' &&
        (coolingClients.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] p-10 text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1]">
              No cooling clients right now
            </p>
            <p className="text-xs text-[#626874] dark:text-[#989EA9]">
              Repeat customers who normally call regularly and have gone silent will appear here for win-back follow-up.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-[#151921] border border-[#E2E5EA] dark:border-white/[0.08] divide-y divide-[#EEF0F4] dark:divide-white/[0.06] overflow-hidden">
            {coolingClients.map((client) => {
              const displayName = formatDisplayNameOrPhone(client.name, client.number);
              const cKey = getContactKey(normaliseEthPhone(client.number) || client.number);
              const winBackMsg = `Hello ${displayName.split(' ')[0]}, checking in from ${config.businessName || 'our team'}! Let us know if you need anything this week.`;
              return (
                <div
                  key={cKey}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-[#FAFBFC] dark:hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectContact(client.number)}
                      className="rounded-full shrink-0"
                      aria-label={`Open contact ${displayName}`}
                    >
                      <ContactAvatar name={client.name} number={client.number} size="md" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectContact(client.number)}
                      className="min-w-0 text-left"
                    >
                      <p className="text-sm font-semibold text-[#14161A] dark:text-[#F4F4F1] truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-[#626874] dark:text-[#989EA9] truncate">
                        {quietMessage(client)}
                      </p>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={buildSmsHref(client.number, winBackMsg)}
                      aria-label={`Message ${displayName}`}
                      className="w-9 h-9 rounded-xl border border-[#E2E5EA] dark:border-white/[0.1] text-[#626874] dark:text-[#989EA9] flex items-center justify-center"
                    >
                      <MessageSquare size={15} />
                    </a>
                    <button
                      type="button"
                      onClick={() => onCallBack(client.number)}
                      className="h-9 px-3.5 rounded-xl bg-[#E45A0D] hover:bg-[#C94D09] text-white text-xs font-semibold whitespace-nowrap"
                    >
                      Check in
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
