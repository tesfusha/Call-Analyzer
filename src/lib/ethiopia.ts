import type { CallRecord, SimLabels, SimSlot, VoiceBundleSlot, VoiceBundles } from '@/src/types/call';

export type CarrierName =
  | 'ETC'
  | 'SFC'
  | 'Landline'
  | 'International / Other';

export function formatCarrierShort(value: string): string {
  const trimmed = value.trim();
  if (/ethio\s*telecom/i.test(trimmed)) return 'ETC';
  if (/safaricom/i.test(trimmed)) return 'SFC';
  return trimmed;
}

export type TariffConfig = {
  sim1RatePerMin: number;
  sim2RatePerMin: number;
  billingMode: 'per-second' | 'per-minute';
  monthlyBudgetEtb: number;
};

export const DEFAULT_TARIFFS: TariffConfig = {
  sim1RatePerMin: 0.5,
  sim2RatePerMin: 0.55,
  billingMode: 'per-second',
  monthlyBudgetEtb: 500,
};

export const DEFAULT_SIM_LABELS: SimLabels = {
  sim1Label: 'ETC',
  sim2Label: 'SFC',
};

export type CarrierPreset = {
  id: string;
  name: string;
  description: string;
  tariffs: TariffConfig;
  simLabels: SimLabels;
};

export const CARRIER_PRESETS: CarrierPreset[] = [
  {
    id: 'ethio-standard',
    name: 'ETC Standard',
    description: '0.50 ETB/min per-second billing on SIM 1',
    tariffs: {
      sim1RatePerMin: 0.5,
      sim2RatePerMin: 0.5,
      billingMode: 'per-second',
      monthlyBudgetEtb: 500,
    },
    simLabels: {
      sim1Label: 'ETC',
      sim2Label: 'SIM 2',
    },
  },
  {
    id: 'safaricom-standard',
    name: 'SFC Standard',
    description: '0.55 ETB/min per-second billing on SIM 1',
    tariffs: {
      sim1RatePerMin: 0.55,
      sim2RatePerMin: 0.55,
      billingMode: 'per-second',
      monthlyBudgetEtb: 500,
    },
    simLabels: {
      sim1Label: 'SFC',
      sim2Label: 'SIM 2',
    },
  },
  {
    id: 'dual-ethio-safaricom',
    name: 'Dual: ETC + SFC',
    description: 'SIM 1 ETC (0.50) · SIM 2 SFC (0.55)',
    tariffs: {
      sim1RatePerMin: 0.5,
      sim2RatePerMin: 0.55,
      billingMode: 'per-second',
      monthlyBudgetEtb: 600,
    },
    simLabels: {
      sim1Label: 'ETC',
      sim2Label: 'SFC',
    },
  },
  {
    id: 'business-heavy',
    name: 'Business / Heavy Caller',
    description: '0.45 / 0.50 ETB/min · 1,200 ETB budget',
    tariffs: {
      sim1RatePerMin: 0.45,
      sim2RatePerMin: 0.5,
      billingMode: 'per-second',
      monthlyBudgetEtb: 1200,
    },
    simLabels: {
      sim1Label: 'ETC Work',
      sim2Label: 'SFC Line',
    },
  },
];

export function formatSimDisplay(sim: SimSlot, labels: SimLabels): string {
  if (!sim) return '';
  const raw = sim === 'SIM 1' ? labels.sim1Label.trim() : labels.sim2Label.trim();
  const custom = formatCarrierShort(raw);
  if (!custom || custom === sim) return sim;
  return `${sim} (${custom})`;
}

/** Normalise Ethiopian numbers to compact digits for carrier matching & contact comparison. */
export function normaliseEthPhone(raw: string): string {
  const cleaned = raw.replace(/[\s()-]/g, '');
  if (cleaned.startsWith('+251')) return `0${cleaned.slice(4)}`;
  if (cleaned.startsWith('251') && cleaned.length >= 12) return `0${cleaned.slice(3)}`;
  if (cleaned.startsWith('00251')) return `0${cleaned.slice(5)}`;
  return cleaned;
}

export function detectCarrier(number: string): CarrierName {
  const local = normaliseEthPhone(number);
  if (/^09\d{8}$/.test(local)) return 'ETC';
  if (/^07\d{8}$/.test(local)) return 'SFC';
  if (/^0[1-5]\d{7,8}$/.test(local)) return 'Landline';
  return 'International / Other';
}

export function estimateCallCostEtb(
  call: Pick<CallRecord, 'direction' | 'duration' | 'sim'>,
  tariffs: TariffConfig,
): number {
  if (call.direction !== 'outgoing' || call.duration <= 0) return 0;
  const rate =
    call.sim === 'SIM 2' ? tariffs.sim2RatePerMin : tariffs.sim1RatePerMin;
  if (rate <= 0) return 0;
  const minutes =
    tariffs.billingMode === 'per-minute'
      ? Math.ceil(call.duration / 60)
      : call.duration / 60;
  return Number((minutes * rate).toFixed(2));
}

export function formatEtb(amount: number): string {
  return `${amount.toFixed(2)} ETB`;
}

export function simRateForSlot(sim: SimSlot, tariffs: TariffConfig): number {
  return sim === 'SIM 2' ? tariffs.sim2RatePerMin : tariffs.sim1RatePerMin;
}

export const DEFAULT_VOICE_BUNDLES: VoiceBundles = {
  sim1: {
    enabled: false,
    name: 'ETC Weekly 100 Min',
    totalMinutes: 100,
    priceEtb: 45,
    startedAt: 0,
    expiresAt: 0,
  },
  sim2: {
    enabled: false,
    name: 'SFC Weekly 120 Min',
    totalMinutes: 120,
    priceEtb: 50,
    startedAt: 0,
    expiresAt: 0,
  },
};

export type VoiceBundlePreset = {
  id: string;
  carrier: 'ETC' | 'SFC';
  name: string;
  totalMinutes: number;
  priceEtb: number;
  days: number;
};

export const VOICE_BUNDLE_PRESETS: VoiceBundlePreset[] = [
  {
    id: 'ethio-daily-25',
    carrier: 'ETC',
    name: 'ETC Daily 25 Min',
    totalMinutes: 25,
    priceEtb: 15,
    days: 1,
  },
  {
    id: 'ethio-weekly-100',
    carrier: 'ETC',
    name: 'ETC Weekly 100 Min',
    totalMinutes: 100,
    priceEtb: 45,
    days: 7,
  },
  {
    id: 'ethio-monthly-500',
    carrier: 'ETC',
    name: 'ETC Monthly 500 Min',
    totalMinutes: 500,
    priceEtb: 180,
    days: 30,
  },
  {
    id: 'safaricom-weekly-120',
    carrier: 'SFC',
    name: 'SFC Weekly 120 Min',
    totalMinutes: 120,
    priceEtb: 50,
    days: 7,
  },
  {
    id: 'safaricom-monthly-450',
    carrier: 'SFC',
    name: 'SFC Monthly 450 Min',
    totalMinutes: 450,
    priceEtb: 175,
    days: 30,
  },
];

export type BundleStatus = {
  usedMinutes: number;
  remainingMinutes: number;
  percentRemaining: number;
  daysLeft: number;
  isExpired: boolean;
  effectiveRatePerMin: number;
};

export function computeBundleStatus(
  slot: 'SIM 1' | 'SIM 2',
  bundle: VoiceBundleSlot,
  calls: CallRecord[],
  billingMode: 'per-second' | 'per-minute',
  now: number = Date.now(),
): BundleStatus {
  const start = bundle.startedAt || 0;
  const end = bundle.expiresAt || Number.POSITIVE_INFINITY;

  let usedMinutes = 0;
  calls.forEach((call) => {
    if (call.direction !== 'outgoing' || call.duration <= 0) return;
    if (call.sim !== slot) return;
    if (call.timestamp < start || call.timestamp > end) return;
    usedMinutes +=
      billingMode === 'per-minute' ? Math.ceil(call.duration / 60) : call.duration / 60;
  });

  const roundedUsed = Number(usedMinutes.toFixed(1));
  const total = Math.max(1, bundle.totalMinutes);
  const remaining = Math.max(0, Number((bundle.totalMinutes - usedMinutes).toFixed(1)));
  const percentRemaining = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
  const isExpired = bundle.expiresAt > 0 && now > bundle.expiresAt;
  const daysLeft =
    bundle.expiresAt > 0
      ? Math.max(0, Math.ceil((bundle.expiresAt - now) / 86_400_000))
      : 0;
  const effectiveRatePerMin =
    bundle.priceEtb > 0 && total > 0 ? Number((bundle.priceEtb / total).toFixed(2)) : 0;

  return {
    usedMinutes: roundedUsed,
    remainingMinutes: remaining,
    percentRemaining,
    daysLeft,
    isExpired,
    effectiveRatePerMin,
  };
}

export type UssdShortcut = {
  id: string;
  carrier: 'ETC' | 'SFC';
  label: string;
  code: string;
  description: string;
};

export const ETHIOPIAN_USSD_CODES: UssdShortcut[] = [
  {
    id: 'ethio-bal',
    carrier: 'ETC',
    label: 'Check Balance',
    code: '*804#',
    description: 'View airtime & bonus balance',
  },
  {
    id: 'ethio-pkg',
    carrier: 'ETC',
    label: 'Packages Menu',
    code: '*999#',
    description: 'Voice, data & holiday bundles',
  },
  {
    id: 'ethio-cmb',
    carrier: 'ETC',
    label: 'Call Me Back',
    code: '*806#',
    description: 'Send free call-me-back request',
  },
  {
    id: 'ethio-transfer',
    carrier: 'ETC',
    label: 'Transfer Airtime',
    code: '*808#',
    description: 'Share balance with another line',
  },
  {
    id: 'ethio-care',
    carrier: 'ETC',
    label: 'Customer Care',
    code: '994',
    description: 'ETC helpline',
  },
  {
    id: 'safari-bal',
    carrier: 'SFC',
    label: 'Check Balance',
    code: '*704#',
    description: 'View SFC airtime & bundles',
  },
  {
    id: 'safari-pkg',
    carrier: 'SFC',
    label: 'Bundles & Offers',
    code: '*777#',
    description: 'Buy voice or data packages',
  },
  {
    id: 'safari-cmb',
    carrier: 'SFC',
    label: 'Call Me Back',
    code: '*707#',
    description: 'Request callback when out of credit',
  },
  {
    id: 'safari-care',
    carrier: 'SFC',
    label: 'Customer Care',
    code: '700',
    description: 'SFC support',
  },
];

/** Encode `#` as `%23` so mobile phone dialers preserve USSD hashes. */
export function toDialableUssdHref(code: string): string {
  return `tel:${code.trim().replace(/#/g, '%23')}`;
}

/** Convert Ethiopian or international phone number to wa.me digit format. */
export function toWhatsAppPhoneDigits(raw: string): string {
  const local = normaliseEthPhone(raw);
  if (/^0[79]\d{8}$/.test(local)) {
    return `251${local.slice(1)}`;
  }
  return raw.replace(/\D/g, '');
}

export type EmergencyCategory = 'safety' | 'medical' | 'utility';

export type EmergencyHotline = {
  id: string;
  label: string;
  amharicLabel: string;
  number: string;
  category: EmergencyCategory;
  description: string;
};

export const ETHIOPIAN_EMERGENCY_HOTLINES: EmergencyHotline[] = [
  {
    id: 'police',
    label: 'Police Emergency',
    amharicLabel: 'ፖሊስ',
    number: '991',
    category: 'safety',
    description: 'Federal & local police emergency dispatch',
  },
  {
    id: 'fire',
    label: 'Fire & Disaster',
    amharicLabel: 'እሳትና ድንገተኛ',
    number: '939',
    category: 'safety',
    description: 'Fire brigade & rescue emergency response',
  },
  {
    id: 'ambulance',
    label: 'Ambulance (Red Cross)',
    amharicLabel: 'አምቡላንስ (ቀይ መስቀል)',
    number: '907',
    category: 'medical',
    description: 'Ethiopian Red Cross 24/7 medical dispatch',
  },
  {
    id: 'national-911',
    label: 'National Emergency',
    amharicLabel: 'አጠቃላይ ድንገተኛ',
    number: '911',
    category: 'safety',
    description: 'General emergency routing across major networks',
  },
  {
    id: 'traffic-police',
    label: 'Traffic Police',
    amharicLabel: 'ትራፊክ ፖሊስ',
    number: '945',
    category: 'safety',
    description: 'Road accidents & traffic emergency assistance',
  },
  {
    id: 'electric',
    label: 'Electric Utility (EEU)',
    amharicLabel: 'ኤሌክትሪክ',
    number: '905',
    category: 'utility',
    description: 'Power outage & electrical hazard reporting',
  },
  {
    id: 'water',
    label: 'Water & Sewerage',
    amharicLabel: 'ውሃና ፍሳሽ',
    number: '906',
    category: 'utility',
    description: 'Water supply leaks & main line emergencies',
  },
  {
    id: 'health-info',
    label: 'Public Health Helpline',
    amharicLabel: 'የጤና መረጃ',
    number: '952',
    category: 'medical',
    description: 'Health information, guidance & referrals',
  },
];

