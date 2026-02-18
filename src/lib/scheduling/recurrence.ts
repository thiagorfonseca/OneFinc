export type RecurrenceOption = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

type RuleParts = Record<string, string>;

type ExpandRecurringParams = {
  recurrenceRule?: string | null;
  startAt: string;
  endAt: string;
  rangeStart: Date;
  rangeEnd: Date;
  maxIterations?: number;
};

type RecurringOccurrence = {
  key: string;
  start_at: string;
  end_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_TOKENS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const WEEKDAY_PT: Record<string, string> = {
  SU: 'domingo',
  MO: 'segunda-feira',
  TU: 'terça-feira',
  WE: 'quarta-feira',
  TH: 'quinta-feira',
  FR: 'sexta-feira',
  SA: 'sábado',
};

const MONDAY_WEEK_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

const isValidDate = (value: Date) => !Number.isNaN(value.getTime());

const normalizeRule = (rule?: string | null) => {
  const trimmed = (rule || '').trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.toUpperCase().startsWith('RRULE:') ? trimmed.slice(6) : trimmed;
  return withoutPrefix.trim().toUpperCase();
};

const parseRuleParts = (rule?: string | null): RuleParts => {
  const normalized = normalizeRule(rule);
  if (!normalized) return {};
  return normalized.split(';').reduce<RuleParts>((acc, chunk) => {
    const [rawKey, ...rawValue] = chunk.split('=');
    const key = (rawKey || '').trim().toUpperCase();
    const value = rawValue.join('=').trim().toUpperCase();
    if (key && value) acc[key] = value;
    return acc;
  }, {});
};

const parsePositiveInt = (value?: string) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePositiveIntList = (value?: string) =>
  (value || '')
    .split(',')
    .map((item) => parsePositiveInt(item.trim()))
    .filter((item): item is number => Boolean(item));

const parseUntilDate = (value?: string) => {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase();
  if (/^\d{8}$/.test(cleaned)) {
    const year = Number(cleaned.slice(0, 4));
    const month = Number(cleaned.slice(4, 6));
    const day = Number(cleaned.slice(6, 8));
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }
  if (/^\d{8}T\d{6}Z$/.test(cleaned)) {
    const year = Number(cleaned.slice(0, 4));
    const month = Number(cleaned.slice(4, 6));
    const day = Number(cleaned.slice(6, 8));
    const hour = Number(cleaned.slice(9, 11));
    const minute = Number(cleaned.slice(11, 13));
    const second = Number(cleaned.slice(13, 15));
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  }
  const parsed = new Date(cleaned);
  return isValidDate(parsed) ? parsed : null;
};

const getWeekdayToken = (date: Date) => WEEKDAY_TOKENS[date.getDay()];

const sortByWeekOrder = (tokens: string[]) =>
  [...tokens].sort((a, b) => MONDAY_WEEK_ORDER.indexOf(a as any) - MONDAY_WEEK_ORDER.indexOf(b as any));

const toMondayIndex = (token: string) => MONDAY_WEEK_ORDER.indexOf(token as any);

const startOfWeekMonday = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const jsDay = date.getDay();
  const mondayIndex = jsDay === 0 ? 6 : jsDay - 1;
  date.setDate(date.getDate() - mondayIndex);
  return date;
};

const addDays = (value: Date, days: number) => new Date(value.getTime() + days * DAY_MS);

const buildRuleFromOption = (option: RecurrenceOption, start: Date) => {
  switch (option) {
    case 'none':
      return null;
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekdays':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${getWeekdayToken(start)}`;
    case 'monthly':
      return `FREQ=MONTHLY;BYMONTHDAY=${start.getDate()}`;
    case 'yearly':
      return `FREQ=YEARLY;BYMONTH=${start.getMonth() + 1};BYMONTHDAY=${start.getDate()}`;
    default:
      return null;
  }
};

const resolveRuleOption = (parts: RuleParts): RecurrenceOption | null => {
  const freq = parts.FREQ;
  if (!freq) return 'none';
  if (freq === 'DAILY') return 'daily';
  if (freq === 'MONTHLY') return 'monthly';
  if (freq === 'YEARLY') return 'yearly';
  if (freq === 'WEEKLY') {
    const byday = sortByWeekOrder(
      (parts.BYDAY || '')
        .split(',')
        .map((token) => token.trim().slice(-2))
        .filter((token) => MONDAY_WEEK_ORDER.includes(token as any)),
    );
    if (byday.join(',') === 'MO,TU,WE,TH,FR') return 'weekdays';
    if (byday.length === 1) return 'weekly';
    return null;
  }
  return null;
};

export const buildRecurrenceRule = (option: RecurrenceOption, startAt?: string | Date | null) => {
  const start = startAt ? new Date(startAt) : new Date();
  if (!isValidDate(start)) return null;
  return buildRuleFromOption(option, start);
};

export const resolveRecurrenceOption = (rule?: string | null): RecurrenceOption => {
  const option = resolveRuleOption(parseRuleParts(rule));
  return option || 'none';
};

export const describeRecurrenceOption = (option: RecurrenceOption, startAt?: string | Date | null) => {
  const start = startAt ? new Date(startAt) : new Date();
  const safeDate = isValidDate(start) ? start : new Date();
  const weekday = WEEKDAY_PT[getWeekdayToken(safeDate)] || 'dia da semana';
  const monthDay = safeDate.getDate();
  const yearLabel = safeDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

  switch (option) {
    case 'none':
      return 'Não se repete';
    case 'daily':
      return 'Todos os dias';
    case 'weekdays':
      return 'Todos os dias da semana (segunda a sexta)';
    case 'weekly':
      return `Semanal: toda ${weekday}`;
    case 'monthly':
      return `Mensal: dia ${monthDay}`;
    case 'yearly':
      return `Anual: ${yearLabel}`;
    default:
      return 'Não se repete';
  }
};

export const describeRecurrenceRule = (rule?: string | null, startAt?: string | Date | null) => {
  const option = resolveRuleOption(parseRuleParts(rule));
  if (option) return describeRecurrenceOption(option, startAt);
  if (!rule) return 'Não se repete';
  return 'Recorrência personalizada';
};

export const toGoogleRecurrence = (rule?: string | null) => {
  const normalized = normalizeRule(rule);
  return normalized ? [`RRULE:${normalized}`] : null;
};

export const expandRecurringOccurrences = (params: ExpandRecurringParams): RecurringOccurrence[] => {
  const ruleParts = parseRuleParts(params.recurrenceRule);
  const freq = (ruleParts.FREQ || '').toUpperCase();
  if (!freq) return [];

  const seedStart = new Date(params.startAt);
  const seedEnd = new Date(params.endAt);
  if (!isValidDate(seedStart) || !isValidDate(seedEnd) || seedEnd <= seedStart) return [];
  if (!isValidDate(params.rangeStart) || !isValidDate(params.rangeEnd) || params.rangeEnd <= params.rangeStart) return [];

  const durationMs = seedEnd.getTime() - seedStart.getTime();
  const interval = parsePositiveInt(ruleParts.INTERVAL) || 1;
  const countLimit = parsePositiveInt(ruleParts.COUNT) || Infinity;
  const until = parseUntilDate(ruleParts.UNTIL);
  const maxIterations = Math.max(1000, params.maxIterations ?? 20000);
  const occurrences: RecurringOccurrence[] = [];

  let emittedCount = 0;

  const registerOccurrence = (candidateStart: Date) => {
    if (candidateStart < seedStart) return true;
    if (until && candidateStart > until) return false;
    if (emittedCount >= countLimit) return false;

    emittedCount += 1;
    const candidateEnd = new Date(candidateStart.getTime() + durationMs);
    if (candidateEnd > params.rangeStart && candidateStart < params.rangeEnd) {
      occurrences.push({
        key: `${candidateStart.getTime()}`,
        start_at: candidateStart.toISOString(),
        end_at: candidateEnd.toISOString(),
      });
    }
    return true;
  };

  if (freq === 'DAILY') {
    let cursor = new Date(seedStart);
    if (!Number.isFinite(countLimit) && !until && params.rangeStart > seedStart) {
      const distanceDays = Math.floor((params.rangeStart.getTime() - seedStart.getTime()) / DAY_MS);
      const jumpSteps = Math.max(0, Math.floor(distanceDays / interval) - 1);
      cursor = addDays(seedStart, jumpSteps * interval);
    }

    for (let i = 0; i < maxIterations && cursor < params.rangeEnd; i += 1) {
      const shouldContinue = registerOccurrence(cursor);
      if (!shouldContinue) break;
      cursor = addDays(cursor, interval);
    }
    return occurrences;
  }

  if (freq === 'WEEKLY') {
    const bydayTokens = sortByWeekOrder(
      (ruleParts.BYDAY || getWeekdayToken(seedStart))
        .split(',')
        .map((token) => token.trim().slice(-2))
        .filter((token) => MONDAY_WEEK_ORDER.includes(token as any)),
    );
    if (!bydayTokens.length) return occurrences;

    const bydayIndexes = bydayTokens.map((token) => toMondayIndex(token)).filter((index) => index >= 0);
    const seedWeekStart = startOfWeekMonday(seedStart);
    const rangeWeekStart = startOfWeekMonday(params.rangeStart);
    const weekDelta = Math.floor((rangeWeekStart.getTime() - seedWeekStart.getTime()) / (7 * DAY_MS));
    const firstWeekOffset = Number.isFinite(countLimit)
      ? 0
      : weekDelta > 0
        ? Math.max(0, Math.floor(weekDelta / interval) * interval)
        : 0;

    for (let i = 0, weekOffset = firstWeekOffset; i < maxIterations; i += 1, weekOffset += interval) {
      const weekStart = addDays(seedWeekStart, weekOffset * 7);
      if (weekStart >= params.rangeEnd && (!until || weekStart > until)) break;

      for (const dayIndex of bydayIndexes) {
        const candidate = new Date(weekStart);
        candidate.setDate(candidate.getDate() + dayIndex);
        candidate.setHours(
          seedStart.getHours(),
          seedStart.getMinutes(),
          seedStart.getSeconds(),
          seedStart.getMilliseconds(),
        );
        const shouldContinue = registerOccurrence(candidate);
        if (!shouldContinue) return occurrences;
      }
    }
    return occurrences;
  }

  if (freq === 'MONTHLY') {
    const monthDays = parsePositiveIntList(ruleParts.BYMONTHDAY);
    const dayList = monthDays.length ? monthDays : [seedStart.getDate()];
    const sortedDays = [...dayList].sort((a, b) => a - b);
    const monthDelta = (params.rangeStart.getFullYear() - seedStart.getFullYear()) * 12
      + (params.rangeStart.getMonth() - seedStart.getMonth());
    const firstMonthOffset = Number.isFinite(countLimit)
      ? 0
      : monthDelta > 0
        ? Math.max(0, Math.floor(monthDelta / interval) * interval)
        : 0;

    for (let i = 0, monthOffset = firstMonthOffset; i < maxIterations; i += 1, monthOffset += interval) {
      const anchor = new Date(seedStart.getFullYear(), seedStart.getMonth() + monthOffset, 1);
      if (anchor >= params.rangeEnd && (!until || anchor > until)) break;

      for (const day of sortedDays) {
        const candidate = new Date(
          anchor.getFullYear(),
          anchor.getMonth(),
          day,
          seedStart.getHours(),
          seedStart.getMinutes(),
          seedStart.getSeconds(),
          seedStart.getMilliseconds(),
        );
        if (candidate.getMonth() !== anchor.getMonth()) continue;
        const shouldContinue = registerOccurrence(candidate);
        if (!shouldContinue) return occurrences;
      }
    }
    return occurrences;
  }

  if (freq === 'YEARLY') {
    const months = parsePositiveIntList(ruleParts.BYMONTH).filter((month) => month >= 1 && month <= 12);
    const monthList = months.length ? months : [seedStart.getMonth() + 1];
    const days = parsePositiveIntList(ruleParts.BYMONTHDAY);
    const dayList = days.length ? days : [seedStart.getDate()];
    const yearDelta = params.rangeStart.getFullYear() - seedStart.getFullYear();
    const firstYearOffset = Number.isFinite(countLimit)
      ? 0
      : yearDelta > 0
        ? Math.max(0, Math.floor(yearDelta / interval) * interval)
        : 0;

    for (let i = 0, yearOffset = firstYearOffset; i < maxIterations; i += 1, yearOffset += interval) {
      const year = seedStart.getFullYear() + yearOffset;
      const yearAnchor = new Date(
        year,
        0,
        1,
        seedStart.getHours(),
        seedStart.getMinutes(),
        seedStart.getSeconds(),
        seedStart.getMilliseconds(),
      );
      if (yearAnchor >= params.rangeEnd && (!until || yearAnchor > until)) break;

      for (const month of monthList) {
        for (const day of dayList) {
          const candidate = new Date(
            year,
            month - 1,
            day,
            seedStart.getHours(),
            seedStart.getMinutes(),
            seedStart.getSeconds(),
            seedStart.getMilliseconds(),
          );
          if (candidate.getMonth() !== month - 1) continue;
          const shouldContinue = registerOccurrence(candidate);
          if (!shouldContinue) return occurrences;
        }
      }
    }
    return occurrences;
  }

  return occurrences;
};
