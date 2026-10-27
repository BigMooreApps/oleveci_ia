import { LocationCoordinates, Post, Business, DayScheduleRow, ValiditySchedule } from '../src/types';

/**
 * Colombian Timezone and Date Utilities (UTC-5 / America/Bogota)
 */
export const COLOMBIA_TIMEZONE_OFFSET_HOURS = -5;

/**
 * Converts a Date to Colombian Local Date components (Year, Month, Day, DayOfWeek, Hour, Minute)
 */
export function getColombiaLocalDate(referenceDate: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hours: number;
  minutes: number;
  dateStr: string; // "YYYY-MM-DD"
  timeStr: string; // "HH:MM"
} {
  // Convert UTC time to Colombia time (UTC-5)
  const utcMillis = referenceDate.getTime() + referenceDate.getTimezoneOffset() * 60000;
  const colMillis = utcMillis + COLOMBIA_TIMEZONE_OFFSET_HOURS * 3600000;
  const colDate = new Date(colMillis);

  const year = colDate.getFullYear();
  const month = colDate.getMonth() + 1;
  const day = colDate.getDate();
  const dayOfWeek = colDate.getDay();
  const hours = colDate.getHours();
  const minutes = colDate.getMinutes();

  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;
  const timeStr = `${pad(hours)}:${pad(minutes)}`;

  return { year, month, day, dayOfWeek, hours, minutes, dateStr, timeStr };
}

/**
 * Parses user prompt for relative or explicit day reference and returns estimated target date
 */
export function resolveTargetDateFromPrompt(prompt: string, referenceDate: Date = new Date()): {
  targetDate: Date;
  dayName: string;
  dayOfWeek: number;
  isSpecificDayMentioned: boolean;
} {
  const p = prompt.toLowerCase();
  const col = getColombiaLocalDate(referenceDate);
  const base = new Date(referenceDate);

  if (p.includes('hoy') || p.includes('esta tarde') || p.includes('esta noche')) {
    return { targetDate: base, dayName: 'hoy', dayOfWeek: col.dayOfWeek, isSpecificDayMentioned: true };
  }

  if (p.includes('mañana')) {
    const nextDay = new Date(base.getTime() + 24 * 3600000);
    const nextCol = getColombiaLocalDate(nextDay);
    return { targetDate: nextDay, dayName: 'mañana', dayOfWeek: nextCol.dayOfWeek, isSpecificDayMentioned: true };
  }

  // Days of week mapping (0=Sunday ... 6=Saturday)
  const daysMap: Array<{ name: string; aliases: string[]; dayIndex: number }> = [
    { name: 'domingo', aliases: ['domingo', 'dominguear'], dayIndex: 0 },
    { name: 'lunes', aliases: ['lunes'], dayIndex: 1 },
    { name: 'martes', aliases: ['martes'], dayIndex: 2 },
    { name: 'miércoles', aliases: ['miércoles', 'miercoles'], dayIndex: 3 },
    { name: 'jueves', aliases: ['jueves'], dayIndex: 4 },
    { name: 'viernes', aliases: ['viernes'], dayIndex: 5 },
    { name: 'sábado', aliases: ['sábado', 'sabado'], dayIndex: 6 },
  ];

  for (const d of daysMap) {
    if (d.aliases.some((a) => p.includes(a))) {
      // Calculate how many days until this day of the week
      let diff = d.dayIndex - col.dayOfWeek;
      if (diff < 0) diff += 7; // Next occurrence
      const target = new Date(base.getTime() + diff * 24 * 3600000);
      return { targetDate: target, dayName: `el ${d.name}`, dayOfWeek: d.dayIndex, isSpecificDayMentioned: true };
    }
  }

  if (p.includes('fin de semana') || p.includes('finde')) {
    // Target next Saturday or Sunday
    let diff = 6 - col.dayOfWeek;
    if (diff < 0) diff += 7;
    const target = new Date(base.getTime() + diff * 24 * 3600000);
    return { targetDate: target, dayName: 'el fin de semana', dayOfWeek: 6, isSpecificDayMentioned: true };
  }

  return { targetDate: base, dayName: 'el fin de semana', dayOfWeek: col.dayOfWeek, isSpecificDayMentioned: false };
}

/**
 * Converts a time string in 12h or 24h format ("1:00 PM", "13:00", "08:30 am", "8 PM") into total minutes from midnight (0..1439)
 */
export function parseTimeToMinutes(t?: string | null): number | null {
  if (!t || typeof t !== 'string') return null;
  const clean = t.trim().toUpperCase();
  if (clean.includes('24 HORAS') || clean === '24H' || clean === '24 HORAS.') return 0;

  // 12h format: e.g. "08:00 AM", "8:00 PM", "8 PM", "8:30am", "1:00 PM"
  const m12 = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = m12[2] ? parseInt(m12[2], 10) : 0;
    const isPm = m12[3].toUpperCase() === 'PM';
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return h * 60 + m;
  }

  // 24h format: e.g. "14:00", "08:30", "13:45"
  const m24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    return h * 60 + m;
  }

  return null;
}

/**
 * Format total minutes into friendly 12h string (e.g. 780 -> "1:00 PM")
 */
export function formatMinutesTo12h(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
}

function normalizeDayNameToDia(name: string): DayScheduleRow['dia'] | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (n.startsWith('lun')) return 'Lunes';
  if (n.startsWith('mar')) return 'Martes';
  if (n.startsWith('mi') || n.startsWith('mí')) return 'Miércoles';
  if (n.startsWith('jue')) return 'Jueves';
  if (n.startsWith('vie')) return 'Viernes';
  if (n.startsWith('s') || n.startsWith('sab') || n.startsWith('sáb')) return 'Sábado';
  if (n.startsWith('dom')) return 'Domingo';
  return null;
}

function setRowsRangeInPlace(
  rows: DayScheduleRow[],
  startDay: DayScheduleRow['dia'],
  endDay: DayScheduleRow['dia'],
  active: boolean,
  horaInicio: string,
  horaFin: string
) {
  const dayNames: DayScheduleRow['dia'][] = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo',
  ];
  const idx1 = dayNames.indexOf(startDay);
  const idx2 = dayNames.indexOf(endDay);
  if (idx1 === -1 || idx2 === -1) return;

  const min = Math.min(idx1, idx2);
  const max = Math.max(idx1, idx2);

  for (let i = min; i <= max; i++) {
    const targetName = dayNames[i];
    const row = rows.find((r) => r.dia === targetName);
    if (row) {
      row.active = active;
      if (active) {
        row.horaInicio = horaInicio;
        row.horaFin = horaFin;
      }
    }
  }
}

/**
 * Parses a business's schedule string (e.g. "Lun - Dom: 8:00 AM - 9:00 PM" or "Lun - Sáb: 8:00 AM - 7:00 PM | Dom: Cerrado")
 * into DayScheduleRow[] matching the structure shown in the business operating hours table
 */
export function parseBusinessSchedule(raw?: string): DayScheduleRow[] {
  const defaultDays: { dia: DayScheduleRow['dia']; dayIndex: number }[] = [
    { dia: 'Lunes', dayIndex: 1 },
    { dia: 'Martes', dayIndex: 2 },
    { dia: 'Miércoles', dayIndex: 3 },
    { dia: 'Jueves', dayIndex: 4 },
    { dia: 'Viernes', dayIndex: 5 },
    { dia: 'Sábado', dayIndex: 6 },
    { dia: 'Domingo', dayIndex: 0 },
  ];

  const rows: DayScheduleRow[] = defaultDays.map((d) => ({
    dia: d.dia,
    dayIndex: d.dayIndex,
    active: true,
    horaInicio: '08:00',
    horaFin: '21:00',
  }));

  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return rows;
  }

  const clean = raw.trim();

  // 24 hours
  if (/24\s*h/i.test(clean) || /24\s*hora/i.test(clean)) {
    return rows.map((r) => ({
      ...r,
      active: true,
      horaInicio: '00:00',
      horaFin: '23:59',
    }));
  }

  // "Lun - Dom: 8:00 AM - 9:00 PM" or "Todos los días: 8:00 AM - 8:00 PM"
  const allDaysMatch = clean.match(
    /(?:todos los d[ií]as|lun\s*-\s*dom)\s*:\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (allDaysMatch) {
    const sMin = parseTimeToMinutes(allDaysMatch[1]);
    const eMin = parseTimeToMinutes(allDaysMatch[2]);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const s24 = sMin !== null ? `${pad(Math.floor(sMin / 60))}:${pad(sMin % 60)}` : '08:00';
    const e24 = eMin !== null ? `${pad(Math.floor(eMin / 60))}:${pad(eMin % 60)}` : '21:00';
    return rows.map((r) => ({
      ...r,
      active: true,
      horaInicio: s24,
      horaFin: e24,
    }));
  }

  const segments = clean.split(/[|;]/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    // Closed match: "Dom: Cerrado" or "Lun - Mar: Cerrado"
    const closedMatch = seg.match(/([A-Za-zÁ-ú]+)(?:\s*-\s*([A-Za-zÁ-ú]+))?\s*:\s*cerrado/i);
    if (closedMatch) {
      const d1 = normalizeDayNameToDia(closedMatch[1]);
      const d2 = closedMatch[2] ? normalizeDayNameToDia(closedMatch[2]) : d1;
      if (d1 && d2) {
        setRowsRangeInPlace(rows, d1, d2, false, '', '');
      }
      continue;
    }

    // Range match with hours: "Lun - Sáb: 8:00 AM - 7:00 PM"
    const rangeMatch = seg.match(
      /([A-Za-zÁ-ú]+)\s*-\s*([A-Za-zÁ-ú]+)\s*:\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
    );
    if (rangeMatch) {
      const d1 = normalizeDayNameToDia(rangeMatch[1]);
      const d2 = normalizeDayNameToDia(rangeMatch[2]);
      const sMin = parseTimeToMinutes(rangeMatch[3]);
      const eMin = parseTimeToMinutes(rangeMatch[4]);
      if (d1 && d2 && sMin !== null && eMin !== null) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const s24 = `${pad(Math.floor(sMin / 60))}:${pad(sMin % 60)}`;
        const e24 = `${pad(Math.floor(eMin / 60))}:${pad(eMin % 60)}`;
        setRowsRangeInPlace(rows, d1, d2, true, s24, e24);
      }
      continue;
    }

    // Single day with hours: "Dom: 10:00 AM - 4:00 PM"
    const singleMatch = seg.match(
      /([A-Za-zÁ-ú]+)\s*:\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
    );
    if (singleMatch) {
      const d = normalizeDayNameToDia(singleMatch[1]);
      const sMin = parseTimeToMinutes(singleMatch[2]);
      const eMin = parseTimeToMinutes(singleMatch[3]);
      if (d && sMin !== null && eMin !== null) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const s24 = `${pad(Math.floor(sMin / 60))}:${pad(sMin % 60)}`;
        const e24 = `${pad(Math.floor(eMin / 60))}:${pad(eMin % 60)}`;
        setRowsRangeInPlace(rows, d, d, true, s24, e24);
      }
    }
  }

  return rows;
}

/**
 * Checks whether a business is currently open on a specific target day and optional target time
 */
export function isBusinessOpen(
  business?: Partial<Business> | null,
  targetDate: Date = new Date(),
  targetDayOfWeek?: number,
  targetTimeStr?: string
): { isOpen: boolean; reason?: string; dayRow?: DayScheduleRow } {
  if (!business) {
    return { isOpen: true };
  }
  if (business.status && business.status !== 'active') {
    return { isOpen: false, reason: `Negocio no activo (${business.status})` };
  }

  const col = getColombiaLocalDate(targetDate);
  const dayOfWeek = targetDayOfWeek !== undefined ? targetDayOfWeek : col.dayOfWeek;
  const targetMin = targetTimeStr ? parseTimeToMinutes(targetTimeStr) : null;

  const scheduleRows = parseBusinessSchedule(business.hours);
  const dayRow = scheduleRows.find((r) => r.dayIndex === dayOfWeek);

  if (dayRow && !dayRow.active) {
    return {
      isOpen: false,
      reason: `${business.name || 'El comercio'} se encuentra cerrado los días ${dayRow.dia}`,
      dayRow,
    };
  }

  if (dayRow && dayRow.active && targetMin !== null && dayRow.horaInicio && dayRow.horaFin) {
    const startMin = parseTimeToMinutes(dayRow.horaInicio);
    const endMin = parseTimeToMinutes(dayRow.horaFin);
    if (startMin !== null && endMin !== null) {
      const isWithinHours = endMin >= startMin ? (targetMin >= startMin && targetMin <= endMin) : (targetMin >= startMin || targetMin <= endMin);
      if (!isWithinHours) {
        return {
          isOpen: false,
          reason: `${business.name || 'El comercio'} atiende de ${dayRow.horaInicio} a ${dayRow.horaFin} los ${dayRow.dia}`,
          dayRow,
        };
      }
    }
  }

  return { isOpen: true, dayRow };
}

/**
 * Strict validity checker for posts and promotions (Section 7)
 * Evaluates BOTH Post-level validity schedule (table and dates) AND Business-level operating hours
 */
export interface ValidityCheckResult {
  isValid: boolean;
  isPromotion: boolean;
  status: 'active' | 'expired' | 'future' | 'day_mismatch' | 'suspended' | 'incomplete_data';
  reason?: string;
  isGuaranteed: boolean;
}

export function checkPostValidity(
  post: Partial<Post>,
  targetDate: Date = new Date(),
  targetDayOfWeek?: number,
  targetTimeStr?: string,
  business?: Partial<Business>
): ValidityCheckResult {
  if (!post) {
    return { isValid: false, isPromotion: false, status: 'incomplete_data', reason: 'Publicación no definida', isGuaranteed: false };
  }

  // 1. Post Status Check
  if (post.status && post.status !== 'active') {
    return {
      isValid: false,
      isPromotion: Boolean(post.promotionalPrice && post.originalPrice && post.promotionalPrice < post.originalPrice),
      status: 'suspended',
      reason: `La publicación se encuentra en estado ${post.status}`,
      isGuaranteed: false,
    };
  }

  const isPromotion = Boolean(
    post.type === 'promotion' ||
    (post.promotionalPrice && post.originalPrice && post.promotionalPrice < post.originalPrice)
  );

  const col = getColombiaLocalDate(targetDate);
  const dayOfWeek = targetDayOfWeek !== undefined ? targetDayOfWeek : col.dayOfWeek;
  const targetDateStr = col.dateStr;
  const effectiveTimeStr = targetTimeStr;
  const targetTimeMillis = targetDate.getTime();

  // 2. Check startsAt
  if (post.startsAt) {
    const startsAtMillis = new Date(post.startsAt).getTime();
    if (!isNaN(startsAtMillis) && targetTimeMillis < startsAtMillis) {
      return {
        isValid: false,
        isPromotion,
        status: 'future',
        reason: `La publicación inicia en una fecha futura (${post.startsAt})`,
        isGuaranteed: false,
      };
    }
  }

  // 3. Check expiresAt
  if (post.expiresAt) {
    const expiresAtMillis = new Date(post.expiresAt).getTime();
    if (!isNaN(expiresAtMillis) && targetTimeMillis > expiresAtMillis) {
      return {
        isValid: false,
        isPromotion,
        status: 'expired',
        reason: `La publicación venció el ${post.expiresAt}`,
        isGuaranteed: false,
      };
    }
  }

  // 4. Check ValiditySchedule if present
  const schedule = post.validitySchedule;
  if (schedule) {
    // Mode: specific_date
    if (schedule.mode === 'specific_date' && schedule.specificDate) {
      if (schedule.specificDate !== targetDateStr) {
        return {
          isValid: false,
          isPromotion,
          status: 'day_mismatch',
          reason: `Válido únicamente el día ${schedule.specificDate}`,
          isGuaranteed: false,
        };
      }
    }

    // Date range: validoDesde and validoHasta
    if (schedule.validoDesde && targetDateStr < schedule.validoDesde) {
      return {
        isValid: false,
        isPromotion,
        status: 'future',
        reason: `Válido a partir de ${schedule.validoDesde}`,
        isGuaranteed: false,
      };
    }
    if (schedule.validoHasta && targetDateStr > schedule.validoHasta) {
      return {
        isValid: false,
        isPromotion,
        status: 'expired',
        reason: `Venció el ${schedule.validoHasta}`,
        isGuaranteed: false,
      };
    }

    // Days of week: daysOfWeek array (0 = Sunday, 1 = Monday, ...)
    if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0) {
      if (!schedule.daysOfWeek.includes(dayOfWeek)) {
        return {
          isValid: false,
          isPromotion,
          status: 'day_mismatch',
          reason: `No aplica en este día de la semana (días válidos: ${schedule.daysOfWeek.join(', ')})`,
          isGuaranteed: false,
        };
      }
    }

    // Schedule table check (Post-level Días y Horas Disponibles)
    if (schedule.mode === 'table' && Array.isArray(schedule.scheduleTable) && schedule.scheduleTable.length > 0) {
      const dayRow = schedule.scheduleTable.find((row) => row.dayIndex === dayOfWeek);
      if (dayRow && !dayRow.active) {
        return {
          isValid: false,
          isPromotion,
          status: 'day_mismatch',
          reason: `No disponible los días ${dayRow.dia}`,
          isGuaranteed: false,
        };
      }

      // Check specific hour window from post schedule table if targetTimeStr is provided
      if (dayRow && dayRow.active && targetTimeStr && dayRow.horaInicio && dayRow.horaFin) {
        const postStart = parseTimeToMinutes(dayRow.horaInicio);
        const postEnd = parseTimeToMinutes(dayRow.horaFin);
        const targetMin = parseTimeToMinutes(effectiveTimeStr);
        if (postStart !== null && postEnd !== null && targetMin !== null) {
          if (targetMin < postStart || targetMin > postEnd) {
            return {
              isValid: false,
              isPromotion,
              status: 'day_mismatch',
              reason: `Publicación disponible de ${dayRow.horaInicio} a ${dayRow.horaFin} los días ${dayRow.dia}`,
              isGuaranteed: false,
            };
          }
        }
      }
    }

    // Check specific startTime and endTime in post validity schedule if present
    if (targetTimeStr && (schedule.startTime || schedule.endTime)) {
      const postStart = schedule.startTime ? parseTimeToMinutes(schedule.startTime) : null;
      const postEnd = schedule.endTime ? parseTimeToMinutes(schedule.endTime) : null;
      const targetMin = parseTimeToMinutes(effectiveTimeStr);
      if (targetMin !== null) {
        if (postStart !== null && targetMin < postStart) {
          return {
            isValid: false,
            isPromotion,
            status: 'day_mismatch',
            reason: `Válido a partir de las ${schedule.startTime}`,
            isGuaranteed: false,
          };
        }
        if (postEnd !== null && targetMin > postEnd) {
          return {
            isValid: false,
            isPromotion,
            status: 'day_mismatch',
            reason: `Válido hasta las ${schedule.endTime}`,
            isGuaranteed: false,
          };
        }
      }
    }
  }

  // 5. Check Business-level Operating Schedule if business profile provided
  if (business) {
    const bizCheck = isBusinessOpen(business, targetDate, dayOfWeek, effectiveTimeStr);
    if (!bizCheck.isOpen) {
      return {
        isValid: false,
        isPromotion,
        status: 'day_mismatch',
        reason: bizCheck.reason || 'El comercio no se encuentra en horario de atención',
        isGuaranteed: false,
      };
    }
  }

  // If active with no explicit expiration or within valid window
  return {
    isValid: true,
    isPromotion,
    status: 'active',
    isGuaranteed: Boolean(post.expiresAt || schedule?.validoHasta || post.startsAt),
  };
}

/**
 * Number & Colombian Peso Price Formatter (Section 3 & 9)
 * Reliable handling of amounts without breaking on thousands dots (e.g. 1.500, 24.900, 125.000, 1.250.000)
 */
export function formatPriceCOP(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Precio por confirmar';
  }
  // Standard Colombian format: 24.900 pesos (without $)
  const formatted = Math.round(amount).toLocaleString('es-CO');
  return `${formatted} pesos`;
}

/**
 * Express price in natural spoken words for TTS (Section 3 & 12)
 * Examples:
 * 1500 -> "1.500 pesos"
 * 24900 -> "24.900 pesos"
 * 25000 -> "25 mil pesos"
 * 125000 -> "125 mil pesos"
 * 1250000 -> "un millón 250 mil pesos"
 */
export function formatPriceForSpeech(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'precio por consultar';
  }
  const clean = Math.round(amount);
  if (clean === 0) return 'gratis';

  if (clean >= 1000000) {
    const millions = Math.floor(clean / 1000000);
    const rem = clean % 1000000;
    const millonWord = millions === 1 ? 'un millón' : `${millions} millones`;
    if (rem === 0) return `${millonWord} de pesos`;
    if (rem >= 1000) {
      const thousands = Math.round(rem / 1000);
      return `${millonWord} ${thousands} mil pesos`;
    }
    return `${millonWord} ${rem} pesos`;
  }

  if (clean >= 1000 && clean % 1000 === 0) {
    const thousands = clean / 1000;
    return `${thousands} mil pesos`;
  }

  return `${clean.toLocaleString('es-CO')} pesos`;
}

/**
 * Cleans text removing all instances of '$' and converting monetary expressions safely
 */
export function sanitizeCurrencyText(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Replace $ 25.000 or $25000 with properly phrased pesos
  // Handle numbers with optional dot/comma thousands separators
  cleaned = cleaned.replace(/\$\s*(\d{1,3}(?:\.\d{3})+)(?:\s*(?:COP|pesos))?/gi, '$1 pesos');
  cleaned = cleaned.replace(/\$\s*(\d+)(?:\s*(?:COP|pesos))?/gi, (match, digits) => {
    const num = parseInt(digits, 10);
    return !isNaN(num) ? formatPriceForSpeech(num) : `${digits} pesos`;
  });

  // Guarantee ZERO residual dollar signs
  cleaned = cleaned.replace(/\$/g, '');
  return cleaned;
}

/**
 * Haversine formula for distance between 2 GPS coordinates in Kilometers (Section 8)
 */
export function calculateHaversineDistanceKm(
  coord1?: LocationCoordinates | null,
  coord2?: LocationCoordinates | null
): number | null {
  if (!coord1 || !coord2 || typeof coord1.lat !== 'number' || typeof coord2.lat !== 'number') {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Detect person count from prompt (Section 9)
 * e.g. "para 2 personas", "en pareja", "con 3 amigos", "para 4 personas"
 */
export function extractPersonCount(prompt: string): number {
  const p = prompt.toLowerCase();
  const matchNum = p.match(/(?:para|con|de|somos)\s+(\d+)\s*(?:personas|amigos|familiares|veces|pelados|chicos)?/i);
  if (matchNum && matchNum[1]) {
    const n = parseInt(matchNum[1], 10);
    if (!isNaN(n) && n > 0 && n <= 30) return n;
  }

  if (p.includes('en pareja') || p.includes('dos personas') || p.includes('mi novia') || p.includes('mi novio') || p.includes('mi esposo') || p.includes('mi esposa')) {
    return 2;
  }
  if (p.includes('familiar') || p.includes('con mi familia') || p.includes('con los niños')) {
    return 3;
  }
  if (p.includes('solo') || p.includes('para mi solo') || p.includes('para mí')) {
    return 1;
  }
  return 2; // Default reasonable pair
}

/**
 * Extracts explicit user budget from natural language prompt.
 * Examples:
 * - "tengo 40 lucas", "100 lucas" -> 40.000, 100.000 COP
 * - "50k", "80k", "100 k" -> 50.000, 80.000, 100.000 COP
 * - "50 mil", "80 mil pesos", "100 mil barras" -> 50.000, 80.000, 100.000 COP
 * - "presupuesto de 80.000", "con 60000", "máximo 40 mil" -> 80.000, 60.000, 40.000 COP
 * - "sin límite", "sin presupuesto", "ilimitado", "abierto" -> 0 (explicitly resets budget)
 * If no budget is mentioned in the prompt, returns fallbackBudget (default 0).
 */
export function extractBudgetFromPrompt(prompt: string, fallbackBudget: number = 0): number {
  if (!prompt || typeof prompt !== 'string') return fallbackBudget;
  const p = prompt.toLowerCase();

  // Explicit unconstrained / reset budget
  if (
    p.includes('sin limite') ||
    p.includes('sin límite') ||
    p.includes('sin presupuesto') ||
    p.includes('ilimitado') ||
    p.includes('presupuesto abierto') ||
    p.includes('no importa el presupuesto') ||
    p.includes('no importa la plata') ||
    p.includes('sin restriccion de presupuesto') ||
    p.includes('sin restricción de presupuesto')
  ) {
    return 0;
  }

  // 1. "40 lucas", "100 lucas"
  const lucasMatch = p.match(/(?:tengo|con|de|hasta|maximo|máximo|presupuesto\s+(?:de)?|alrededor\s+de)?\s*(\d+)\s*lucas?\b/i);
  if (lucasMatch && lucasMatch[1]) {
    const val = parseInt(lucasMatch[1], 10);
    if (!isNaN(val) && val > 0) return val * 1000;
  }

  // 2. "50k", "100k", "80 k"
  const kMatch = p.match(/(?:presupuesto\s*(?:de)?|tengo|con|maximo|máximo|hasta|gastar|alrededor\s+de)?\s*\$?\s*(\d+)\s*k\b/i);
  if (kMatch && kMatch[1]) {
    const val = parseInt(kMatch[1], 10);
    if (!isNaN(val) && val > 0) return val * 1000;
  }

  // 3. "50 mil", "80 mil pesos", "100 mil barras"
  const milMatch = p.match(/(?:presupuesto\s*(?:de)?|tengo|con|maximo|máximo|hasta|gastar|de|alrededor\s+de)?\s*\$?\s*(\d+)\s*mil\b/i);
  if (milMatch && milMatch[1]) {
    const val = parseInt(milMatch[1], 10);
    if (!isNaN(val) && val > 0) return val * 1000;
  }

  // 4. Formatted COP numbers like "$50.000", "50.000 pesos", "presupuesto de 80.000", "maximo 60000"
  const explicitNumberMatch = p.match(
    /(?:presupuesto\s*(?:de)?|tengo|con|maximo\s*(?:de)?|máximo\s*(?:de)?|hasta|gastar|\$)\s*\$?\s*(\d{1,3}(?:\.\d{3})+|\d{4,7})\s*(?:pesos|cop)?\b/i
  );
  if (explicitNumberMatch && explicitNumberMatch[1]) {
    const rawNum = explicitNumberMatch[1].replace(/\./g, '');
    const val = parseInt(rawNum, 10);
    if (!isNaN(val) && val >= 5000 && val <= 10000000) return val;
  }

  // 5. Standalone number with "pesos": "40000 pesos", "50.000 pesos"
  const pesosMatch = p.match(/(\d{1,3}(?:\.\d{3})+|\d{4,7})\s*pesos\b/i);
  if (pesosMatch && pesosMatch[1]) {
    const rawNum = pesosMatch[1].replace(/\./g, '');
    const val = parseInt(rawNum, 10);
    if (!isNaN(val) && val >= 5000 && val <= 10000000) return val;
  }

  return fallbackBudget;
}

/**
 * Budget calculator for an itinerary (Section 9)
 */
export interface ItineraryBudgetSummary {
  personCount: number;
  costPerPerson: number;
  totalEstimatedCost: number;
  userBudget: number;
  difference: number;
  savingsOrRemaining: number;
  budgetStatus: 'under_budget' | 'on_budget' | 'over_budget';
  hasUnconfirmedPrices: boolean;
  unconfirmedCount: number;
  explanation: string;
}

export function calculateItineraryBudget(
  stopCosts: Array<{ cost: number; isUnconfirmed?: boolean }>,
  userBudget: number = 100000,
  personCount: number = 2,
  isOpenBudget: boolean = false
): ItineraryBudgetSummary {
  let totalCost = 0;
  let unconfirmedCount = 0;

  for (const item of stopCosts) {
    if (item.isUnconfirmed || item.cost === undefined || item.cost === null || item.cost < 0 || isNaN(item.cost)) {
      unconfirmedCount++;
    } else {
      totalCost += item.cost;
    }
  }

  const costPerPerson = personCount > 0 ? Math.round(totalCost / personCount) : totalCost;

  if (isOpenBudget) {
    const explanation = unconfirmedCount > 0
      ? `Presupuesto estimado de ${formatPriceCOP(totalCost)} (${unconfirmedCount} parada con precio a consultar).`
      : `El costo total estimado del itinerario es de ${formatPriceCOP(totalCost)}.`;
    return {
      personCount,
      costPerPerson,
      totalEstimatedCost: totalCost,
      userBudget: 0,
      difference: 0,
      savingsOrRemaining: 0,
      budgetStatus: 'on_budget',
      hasUnconfirmedPrices: unconfirmedCount > 0,
      unconfirmedCount,
      explanation,
    };
  }

  const difference = userBudget - totalCost;
  const savingsOrRemaining = Math.max(0, difference);

  let budgetStatus: 'under_budget' | 'on_budget' | 'over_budget' = 'on_budget';
  if (totalCost < userBudget) {
    budgetStatus = 'under_budget';
  } else if (totalCost > userBudget) {
    budgetStatus = 'over_budget';
  }

  let explanation = '';
  if (unconfirmedCount > 0) {
    explanation = `Presupuesto estimado de ${formatPriceCOP(totalCost)} (${unconfirmedCount} parada con precio a consultar).`;
  } else if (budgetStatus === 'under_budget') {
    explanation = `El plan cuesta ${formatPriceCOP(totalCost)}, quedando ${formatPriceCOP(savingsOrRemaining)} a favor de tu presupuesto de ${formatPriceCOP(userBudget)}.`;
  } else if (budgetStatus === 'over_budget') {
    explanation = `El plan suma ${formatPriceCOP(totalCost)}, superando el presupuesto sugerido de ${formatPriceCOP(userBudget)} en ${formatPriceCOP(Math.abs(difference))}.`;
  } else {
    explanation = `El plan se ajusta exactamente al presupuesto de ${formatPriceCOP(userBudget)}.`;
  }

  return {
    personCount,
    costPerPerson,
    totalEstimatedCost: totalCost,
    userBudget,
    difference,
    savingsOrRemaining,
    budgetStatus,
    hasUnconfirmedPrices: unconfirmedCount > 0,
    unconfirmedCount,
    explanation,
  };
}
