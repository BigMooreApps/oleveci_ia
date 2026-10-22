import { DailyMetricRecord } from '../types';

/**
 * Formats a Date object as 'YYYY-MM-DD' in local time
 */
export const formatDateKey = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns today's date key in local time 'YYYY-MM-DD'
 */
export const getTodayKey = (): string => formatDateKey(new Date());

/**
 * Returns yesterday's date key in local time 'YYYY-MM-DD'
 */
export const getYesterdayKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateKey(d);
};

/**
 * Returns a date key 'YYYY-MM-DD' N days ago
 */
export const getDaysAgoKey = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDateKey(d);
};

/**
 * Returns the first day of current month 'YYYY-MM-01'
 */
export const getStartOfMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'all' | 'custom';

export interface DateRange {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
}

/**
 * Resolves standard date range [startDate, endDate] for a given preset
 */
export const getDateRangeForPreset = (preset: DatePreset): DateRange => {
  const today = getTodayKey();
  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const yest = getYesterdayKey();
      return { startDate: yest, endDate: yest };
    }
    case '7d':
      return { startDate: getDaysAgoKey(6), endDate: today };
    case '30d':
      return { startDate: getDaysAgoKey(29), endDate: today };
    case 'this_month':
      return { startDate: getStartOfMonthKey(), endDate: today };
    case 'all':
      return { startDate: getDaysAgoKey(44), endDate: today };
    case 'custom':
    default:
      return { startDate: getDaysAgoKey(29), endDate: today };
  }
};

/**
 * Calculates inclusive difference in days between two 'YYYY-MM-DD' strings
 */
export const countCutDays = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
};

/**
 * Generates an array of all date keys 'YYYY-MM-DD' between startDate and endDate (inclusive)
 */
export const getDateKeysInRange = (startDate: string, endDate: string): string[] => {
  const keys: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [startDate || getTodayKey()];
  }

  const cur = new Date(start);
  while (cur <= end) {
    keys.push(formatDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
};

/**
 * Formats a 'YYYY-MM-DD' string to short Spanish display (e.g. 'Hoy', 'Ayer', '3 Oct', 'Lun 3')
 */
export const formatDateLabel = (dateStr: string, includeDayName: boolean = true): string => {
  const today = getTodayKey();
  const yesterday = getYesterdayKey();
  if (dateStr === today) return 'Hoy';
  if (dateStr === yesterday) return 'Ayer';

  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dayName = days[d.getDay()];
      const dayNum = d.getDate();
      const monthName = months[d.getMonth()];
      return includeDayName ? `${dayName} ${dayNum}` : `${dayNum} ${monthName}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
};

/**
 * Generates realistic daily distribution for posts that have total metrics but no dailyMetrics yet
 */
export const generateDailyMetricsForPost = (
  totals: { views: number; whatsappClicks: number; mapsClicks: number; calls: number; shares: number; qrRedemptions?: number },
  daysBack: number = 45
): Record<string, DailyMetricRecord> => {
  const result: Record<string, DailyMetricRecord> = {};
  const today = new Date();

  // Day weights: weekends higher, slight growth trend towards recent days
  const dayWeights: { key: string; weight: number }[] = [];
  let totalWeight = 0;

  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);
    const dayOfWeek = d.getDay(); // 0 is Sun, 6 is Sat
    // Natural day of week curve: weekends & Thursdays/Fridays are higher
    const dowFactors = [1.40, 0.92, 1.05, 1.18, 1.28, 1.55, 1.72];
    const dowFactor = dowFactors[dayOfWeek] ?? 1.1;
    // Recency factor between 0.85 and 1.30
    const recency = 0.85 + ((daysBack - i) / daysBack) * 0.45;
    // Gentle organic sinusoidal wave (deterministic by day index)
    const wave = 1.0 + Math.sin(i * 0.85) * 0.14;
    const weight = Math.max(0.2, dowFactor * recency * wave);
    dayWeights.push({ key, weight });
    totalWeight += weight;
  }

  // Allocate integer values ensuring the exact sum equals totals
  const allocate = (total: number) => {
    if (total <= 0) return dayWeights.map(() => 0);
    const raw = dayWeights.map((dw) => (dw.weight / totalWeight) * total);
    const floored = raw.map((r) => Math.floor(r));
    let remainder = total - floored.reduce((a, b) => a + b, 0);

    // Distribute remainder to highest fractional parts
    const order = raw
      .map((r, idx) => ({ idx, frac: r - floored[idx] }))
      .sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < remainder && i < order.length; i++) {
      floored[order[i].idx] += 1;
    }
    return floored;
  };

  const viewsArr = allocate(totals.views || 0);
  const waArr = allocate(totals.whatsappClicks || 0);
  const mapsArr = allocate(totals.mapsClicks || 0);
  const callsArr = allocate(totals.calls || 0);
  const sharesArr = allocate(totals.shares || 0);
  const qrArr = allocate(totals.qrRedemptions || 0);

  dayWeights.forEach((dw, idx) => {
    result[dw.key] = {
      views: viewsArr[idx] || 0,
      whatsappClicks: waArr[idx] || 0,
      mapsClicks: mapsArr[idx] || 0,
      calls: callsArr[idx] || 0,
      shares: sharesArr[idx] || 0,
      qrRedemptions: qrArr[idx] || 0,
    };
  });

  return result;
};
