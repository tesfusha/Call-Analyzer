import Kenat, {
  MonthGrid,
  getHolidaysForYear,
  monthNames,
  toEC,
  toGC,
  toGeez,
  type EthiopianDate,
  type GregorianDate,
  type Holiday,
} from 'kenat';

export type CalendarLang = 'english' | 'amharic';

export type UpcomingHoliday = {
  key: string;
  name: string;
  description: string;
  tags: string[];
  ethiopian: EthiopianDate;
  gregorian: GregorianDate;
  daysUntil: number;
  isToday: boolean;
};

export type CalendarGridCell = {
  ethiopian: EthiopianDate;
  ethiopianDisplayDay: string;
  gregorian: GregorianDate;
  weekday: number;
  weekdayName: string;
  isToday: boolean;
  holidays: Array<{
    key: string;
    name: string;
    description: string;
    tags: string[];
  }>;
};

export type CalendarGridData = {
  year: number;
  yearDisplay: string;
  month: number;
  monthName: string;
  headers: string[];
  days: Array<CalendarGridCell | null>;
};

const MS_PER_DAY = 86_400_000;

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function toEthiopianDate(input: number | Date = new Date()): EthiopianDate {
  const d = input instanceof Date ? input : new Date(input);
  return toEC(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function toGregorianDate(ethYear: number, ethMonth: number, ethDay: number): GregorianDate {
  return toGC(ethYear, ethMonth, ethDay);
}

export function toGregorianJsDate(ethYear: number, ethMonth: number, ethDay: number): Date {
  const gc = toGC(ethYear, ethMonth, ethDay);
  return new Date(gc.year, gc.month - 1, gc.day);
}

export function getEthiopianMonthName(month: number, lang: CalendarLang = 'english'): string {
  const names = lang === 'amharic' ? monthNames.amharic : monthNames.english;
  return names[month - 1] ?? `Month ${month}`;
}

export function formatEthiopianDate(
  input: number | Date = new Date(),
  options: { lang?: CalendarLang; showWeekday?: boolean; useGeez?: boolean } = {},
): string {
  const { lang = 'english', showWeekday = false, useGeez = false } = options;
  const d = input instanceof Date ? input : new Date(input);
  try {
    const k = new Kenat(d);
    return k.format({
      calendar: 'ethiopian',
      lang,
      showWeekday,
      useGeez: lang === 'amharic' ? useGeez : false,
    });
  } catch {
    const ec = toEthiopianDate(d);
    return `${getEthiopianMonthName(ec.month, lang)} ${ec.day}, ${ec.year}`;
  }
}

export function formatEthiopianShort(
  input: number | Date = new Date(),
  lang: CalendarLang = 'english',
): string {
  const ec = toEthiopianDate(input);
  return `${getEthiopianMonthName(ec.month, lang)} ${ec.day}, ${ec.year}`;
}

export function formatIsoDateDual(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return isoDate;
  const [y, m, d] = parts;
  const ec = toEC(y, m, d);
  return `${getEthiopianMonthName(ec.month, 'english')} ${ec.day}, ${ec.year} EC`;
}

export function toIsoYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getEthiopianMonthGregorianBounds(
  ethYear: number,
  ethMonth: number,
): { start: string; end: string; label: string } {
  const maxDay = ethMonth === 13 ? (ethYear % 4 === 3 ? 6 : 5) : 30;
  const startGc = toGC(ethYear, ethMonth, 1);
  const endGc = toGC(ethYear, ethMonth, maxDay);
  const start = `${startGc.year}-${String(startGc.month).padStart(2, '0')}-${String(startGc.day).padStart(2, '0')}`;
  const end = `${endGc.year}-${String(endGc.month).padStart(2, '0')}-${String(endGc.day).padStart(2, '0')}`;
  const label = `${getEthiopianMonthName(ethMonth, 'english')} ${ethYear} EC`;
  return { start, end, label };
}

export function getEthiopianMonthCalendar(
  year: number,
  month: number,
  options: { lang?: CalendarLang; useGeez?: boolean; weekStart?: number } = {},
): CalendarGridData {
  const { lang = 'english', useGeez = false, weekStart = 1 } = options;
  const grid = MonthGrid.create({
    year,
    month,
    weekdayLang: lang,
    useGeez: false,
    weekStart,
  });

  const days: Array<CalendarGridCell | null> = grid.days.map((cell) => {
    if (!cell) return null;
    const ecDay = Number(cell.ethiopian.day);
    const ecMonth = Number(cell.ethiopian.month);
    const ecYear = Number(cell.ethiopian.year);

    // Fetch localized holiday names cleanly
    const holidays = cell.holidays.map((h) => ({
      key: h.key,
      name: h.name ?? h.key,
      description: h.description ?? '',
      tags: h.tags ?? [],
    }));

    return {
      ethiopian: { year: ecYear, month: ecMonth, day: ecDay },
      ethiopianDisplayDay: useGeez ? safeGeez(ecDay) : String(ecDay),
      gregorian: cell.gregorian,
      weekday: cell.weekday,
      weekdayName: cell.weekdayName,
      isToday: cell.isToday,
      holidays,
    };
  });

  return {
    year,
    yearDisplay: useGeez ? safeGeez(year) : String(year),
    month,
    monthName: getEthiopianMonthName(month, lang),
    headers: grid.headers,
    days,
  };
}

function safeGeez(num: number): string {
  try {
    return toGeez(num);
  } catch {
    return String(num);
  }
}

export function getHolidaysInGregorianYearOrUpcoming(
  fromDate: Date = new Date(),
  withinDays = 90,
  lang: CalendarLang = 'english',
): UpcomingHoliday[] {
  const todayStart = startOfDayMs(fromDate);
  const currentEc = toEthiopianDate(fromDate);
  const years = [currentEc.year, currentEc.year + 1];

  const seen = new Set<string>();
  const upcoming: UpcomingHoliday[] = [];

  years.forEach((ethYear) => {
    let holidays: Holiday[] = [];
    try {
      holidays = getHolidaysForYear(ethYear, { lang });
    } catch {
      holidays = [];
    }
    holidays.forEach((h) => {
      const gc = h.gregorian ?? toGC(h.ethiopian.year, h.ethiopian.month, h.ethiopian.day);
      const gcMs = new Date(gc.year, gc.month - 1, gc.day).getTime();
      const diffDays = Math.round((gcMs - todayStart) / MS_PER_DAY);
      const uniqueKey = `${h.key}-${h.ethiopian.year}-${h.ethiopian.month}-${h.ethiopian.day}`;
      if (diffDays >= 0 && diffDays <= withinDays && !seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        upcoming.push({
          key: h.key,
          name: h.name ?? h.key,
          description: h.description ?? '',
          tags: h.tags ?? [],
          ethiopian: h.ethiopian,
          gregorian: gc,
          daysUntil: diffDays,
          isToday: diffDays === 0,
        });
      }
    });
  });

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function getHolidaysForGregorianDate(
  date: Date,
  lang: CalendarLang = 'english',
): Holiday[] {
  try {
    const k = new Kenat(date);
    return k.isHoliday({ lang });
  } catch {
    return [];
  }
}

export function buildHolidayWish(
  holidayName: string,
  contactName: string,
  tag?: string,
  lang: CalendarLang = 'english',
): string {
  const firstName = contactName.split(/\s+/)[0] || contactName;
  const cleanTag = (tag ?? '').toLowerCase();
  if (lang === 'amharic') {
    if (cleanTag === 'family') {
      return `መልካም ${holidayName} ${firstName}! ለእርስዎና ለመላው ቤተሰብ ሰላም፣ ጤናና ደስታን እመኛለሁ።`;
    }
    if (cleanTag === 'coworkers' || cleanTag === 'work' || cleanTag === 'business') {
      return `መልካም ${holidayName} ${firstName}! መልካም በዓልና የስራ ስኬት እመኝልዎታለሁ።`;
    }
    return `መልካም ${holidayName} ${firstName}! በዓሉን በሰላም፣ በጤናና በደስታ እንዲያሳልፉ እመኛለሁ።`;
  }
  if (cleanTag === 'family') {
    return `Melkam ${holidayName}, ${firstName}! Wishing you and our whole family peace, health, and joy.`;
  }
  if (cleanTag === 'coworkers' || cleanTag === 'work' || cleanTag === 'business') {
    return `Happy ${holidayName}, ${firstName}! Wishing you a joyful celebration and continued success.`;
  }
  return `Melkam ${holidayName}, ${firstName}! Wishing you a wonderful celebration filled with peace and happiness.`;
}

export function buildBirthdayWish(
  contactName: string,
  eventTitle = 'Birthday',
  tag?: string,
  lang: CalendarLang = 'english',
): string {
  const firstName = contactName.split(/\s+/)[0] || contactName;
  const lowerEvent = eventTitle.toLowerCase();
  const cleanTag = (tag ?? '').toLowerCase();

  if (lang === 'amharic') {
    if (lowerEvent === 'birthday' || lowerEvent.includes('birthday') || eventTitle.includes('ልደት')) {
      if (cleanTag === 'family') {
        return `መልካም ልደት ${firstName}! ረጅም ዕድሜ፣ ጤናና ደስታ ይብዛልህ።`;
      }
      if (cleanTag === 'coworkers' || cleanTag === 'work' || cleanTag === 'business') {
        return `መልካም ልደት ${firstName}! መልካም አመት፣ ጤናና ስኬት እመኝልዎታለሁ።`;
      }
      return `መልካም ልደት ${firstName}! ዘመንህ በደስታና በጤና የተሞላ ይሁን።`;
    }
    return `መልካም ${eventTitle} ${firstName}! ሁልጊዜ ሰላምና ደስታ ይከተልዎት።`;
  }

  if (lowerEvent === 'birthday' || lowerEvent.includes('birthday')) {
    if (cleanTag === 'family') {
      return `Melkam Lidet, ${firstName}! Wishing you abundant health, joy, and blessings on your birthday.`;
    }
    if (cleanTag === 'coworkers' || cleanTag === 'work' || cleanTag === 'business') {
      return `Happy Birthday, ${firstName}! Wishing you a great year ahead filled with success and good health.`;
    }
    return `Happy Birthday, ${firstName}! Wishing you an amazing year ahead filled with joy and laughter.`;
  }

  return `Warm wishes on your ${eventTitle}, ${firstName}! Wishing you all the best today and always.`;
}

export type OtherWishPresetKey =
  | 'greeting'
  | 'checkin'
  | 'thanks'
  | 'congrats'
  | 'getwell'
  | 'custom';

export const OTHER_WISH_PRESETS: Array<{
  key: OtherWishPresetKey;
  label: string;
  occasionEn: string;
  occasionAm: string;
  english: string;
  amharic: string;
}> = [
  {
    key: 'greeting',
    label: 'Warm Greeting',
    occasionEn: 'Warm Greetings',
    occasionAm: 'ሰላምታ',
    english: 'Selam {name}! Wishing you peace, good health, and a wonderful day ahead.',
    amharic: 'ሰላም {name}! ዛሬ መልካም ቀን፣ ጤናና ደስታ እንዲሆንልዎት እመኛለሁ።',
  },
  {
    key: 'checkin',
    label: 'Check-in',
    occasionEn: 'Check-in',
    occasionAm: 'ሰላምታ',
    english: 'Hey {name}, just checking in to say hello and hope you are doing well!',
    amharic: 'ሰላም {name}፣ እንዴት ነዎት? ሁሉም ነገር ደህና ነው? ትንሽ ልጠይቅዎት ብዬ ነው።',
  },
  {
    key: 'thanks',
    label: 'Thank You',
    occasionEn: 'Thank You',
    occasionAm: 'ምስጋና',
    english: 'Thank you so much, {name}! Truly appreciate your kindness and support.',
    amharic: 'እጅግ በጣም አመሰግናለሁ {name}! ለመልካምነትዎና ለድጋፍዎ ሁሉ ምስጋናዬ የላቀ ነው።',
  },
  {
    key: 'congrats',
    label: 'Congrats',
    occasionEn: 'Congratulations',
    occasionAm: 'እንኳን ደስ ያለዎት',
    english: 'Congratulations, {name}! Wishing you continued success and happiness.',
    amharic: 'እንኳን ደስ ያለዎት {name}! ሁልጊዜ ስኬትና ደስታ እንዲከተልዎት እመኛለሁ።',
  },
  {
    key: 'getwell',
    label: 'Get Well',
    occasionEn: 'Get Well Soon',
    occasionAm: 'ፈጣን ፈውስ',
    english: 'Wishing you a quick and full recovery, {name}. Take good care of yourself!',
    amharic: '{name} ፈጣን ፈውስና ሙሉ ጤንነት እመኝልዎታለሁ። እራስዎን ይጠብቁ።',
  },
  {
    key: 'custom',
    label: 'Custom',
    occasionEn: 'Special Day',
    occasionAm: 'መልካም ምኞት',
    english: 'Warm wishes for {occasion}, {name}! Wishing you all the very best today and always.',
    amharic: 'መልካም {occasion} {name}! ሁልጊዜ ሰላም፣ ጤናና ደስታ ይብዛልዎት።',
  },
];

export function getOtherWishTemplate(
  presetKey: OtherWishPresetKey = 'greeting',
  lang: CalendarLang = 'english',
  tag?: string,
): string {
  const cleanTag = (tag ?? '').toLowerCase();
  if (
    presetKey === 'checkin' &&
    (cleanTag === 'business' || cleanTag === 'work' || cleanTag === 'coworkers')
  ) {
    return getBusinessReconnectTemplate(lang);
  }
  const found = OTHER_WISH_PRESETS.find((p) => p.key === presetKey) ?? OTHER_WISH_PRESETS[0];
  return lang === 'amharic' ? found.amharic : found.english;
}

export function getBusinessReconnectTemplate(lang: CalendarLang = 'english'): string {
  if (lang === 'amharic') {
    return 'ሰላም {name}፣ እንዴት ነዎት? ሁሉም ነገር ደህና ነው? የሚያስፈልግዎት ነገር ካለ ያሳውቁኝ።';
  }
  return 'Hello {name}, just checking in. Do you need anything?';
}

export function getDefaultWishTemplate({
  occasionType,
  tag,
  lang = 'english',
  otherPreset = 'greeting',
}: {
  occasionType: 'holiday' | 'birthday' | 'other' | 'reconnect';
  tag?: string;
  lang?: CalendarLang;
  otherPreset?: OtherWishPresetKey;
}): string {
  const cleanTag = (tag ?? '').toLowerCase();
  if (occasionType === 'reconnect') {
    if (cleanTag === 'business' || cleanTag === 'work' || cleanTag === 'coworkers') {
      return getBusinessReconnectTemplate(lang);
    }
    if (lang === 'amharic') {
      return 'ሰላም {name}፣ ቆየን ከተገናኘን! እንዴት ነህ/ነሽ? ትንሽ ልጠይቅህ ብዬ ነው።';
    }
    return 'Hey {name}, it has been a while! Just checking in to say hello and hope you are doing well.';
  }

  if (occasionType === 'other') {
    return getOtherWishTemplate(otherPreset, lang, tag);
  }

  if (occasionType === 'birthday') {
    if (lang === 'amharic') {
      if (cleanTag === 'family') {
        return 'መልካም {occasion} {name}! ረጅም ዕድሜ፣ ጤናና ደስታ ይብዛልህ።';
      }
      return 'መልካም {occasion} {name}! አዲሱ አመት የጤና፣ የሰላምና የስኬት ይሁንልህ።';
    }
    if (cleanTag === 'family') {
      return 'Melkam {occasion}, {name}! Wishing you abundant health, joy, and blessings today.';
    }
    return 'Happy {occasion}, {name}! Wishing you an amazing year ahead filled with joy and good health.';
  }

  if (lang === 'amharic') {
    if (cleanTag === 'family') {
      return 'መልካም {occasion} {name}! ለእርስዎና ለመላው ቤተሰብ ሰላም፣ ጤናና ደስታን እመኛለሁ።';
    }
    return 'መልካም {occasion} {name}! በዓሉን በሰላም፣ በጤናና በደስታ እንዲያሳልፉ እመኛለሁ።';
  }
  if (cleanTag === 'family') {
    return 'Melkam {occasion}, {name}! Wishing you and our whole family peace, health, and joy.';
  }
  if (cleanTag === 'coworkers' || cleanTag === 'work' || cleanTag === 'business') {
    return 'Happy {occasion}, {name}! Wishing you a joyful celebration and continued success.';
  }
  return 'Melkam {occasion}, {name}! Wishing you a wonderful celebration filled with peace and happiness.';
}

export function resolveWishTemplatePlaceholders(
  template: string,
  { name, occasion }: { name: string; occasion: string },
): string {
  const cleanName = name.trim() || 'Friend';
  const cleanOccasion = occasion.trim() || 'Celebration';
  return template
    .replace(/\{name\}/gi, cleanName)
    .replace(/\{occasion\}/gi, cleanOccasion);
}

