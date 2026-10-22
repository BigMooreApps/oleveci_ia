import { ValiditySchedule, ValidityMode, DayScheduleRow } from '../types';

export interface DayOfWeekItem {
  id: number; // 0 = Domingo, 1 = Lunes, etc.
  short: string;
  name: string;
}

export const DAYS_OF_WEEK: DayOfWeekItem[] = [
  { id: 1, short: 'Lun', name: 'Lunes' },
  { id: 2, short: 'Mar', name: 'Martes' },
  { id: 3, short: 'Mié', name: 'Miércoles' },
  { id: 4, short: 'Jue', name: 'Jueves' },
  { id: 5, short: 'Vie', name: 'Viernes' },
  { id: 6, short: 'Sáb', name: 'Sábado' },
  { id: 0, short: 'Dom', name: 'Domingo' },
];

export const INITIAL_SCHEDULE_TABLE: DayScheduleRow[] = [
  { dia: 'Lunes', dayIndex: 1, active: true, horaInicio: '08:00', horaFin: '21:00' },
  { dia: 'Martes', dayIndex: 2, active: true, horaInicio: '08:00', horaFin: '21:00' },
  { dia: 'Miércoles', dayIndex: 3, active: true, horaInicio: '08:00', horaFin: '21:00' },
  { dia: 'Jueves', dayIndex: 4, active: true, horaInicio: '08:00', horaFin: '21:00' },
  { dia: 'Viernes', dayIndex: 5, active: true, horaInicio: '08:00', horaFin: '21:00' },
  { dia: 'Sábado', dayIndex: 6, active: true, horaInicio: '08:00', horaFin: '21:00' },
  { dia: 'Domingo', dayIndex: 0, active: true, horaInicio: '08:00', horaFin: '21:00' },
];

export const QUICK_PRESETS = [
  { id: 'today_10pm', label: 'Hoy hasta 10 PM', badge: '¡Hoy hasta las 10:00 PM!' },
  { id: 'today_night', label: 'Hoy hasta 11:59 PM', badge: 'Hoy hasta las 11:59 PM' },
  { id: 'tomorrow', label: 'Hasta mañana', badge: 'Vence mañana' },
  { id: 'weekend', label: 'Sáb a Dom', badge: 'Sábado y Domingo' },
  { id: 'fri_sun', label: 'Vie a Dom', badge: 'Viernes a Domingo' },
  { id: '3_days', label: 'Por 3 Días', badge: 'Disponible por 3 días' },
  { id: '7_days', label: 'Por 1 Semana', badge: 'Válido por 7 días' },
] as const;

export const TIME_PRESETS = [
  { label: '☕ Mañanas', start: '08:00', end: '11:30' },
  { label: '🍽️ Almuerzos', start: '12:00', end: '15:00' },
  { label: '🍹 Happy Hour', start: '16:00', end: '19:00' },
  { label: '🌙 Cenas / Noche', start: '19:00', end: '22:30' },
] as const;

export const DAY_PRESETS = [
  { label: 'Lun a Vie', days: [1, 2, 3, 4, 5] },
  { label: 'Fines de semana', days: [6, 0] },
  { label: 'Lun y Mié', days: [1, 3] },
  { label: 'Mar y Jue', days: [2, 4] },
  { label: 'Vie a Dom', days: [5, 6, 0] },
  { label: 'Todos los días', days: [1, 2, 3, 4, 5, 6, 0] },
] as const;

/**
 * Format 24h time to 12h string with AM/PM (e.g. 14:00 -> 2:00 PM)
 */
export function formatTime12h(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1] || '00';
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
}

/**
 * Format an array of weekday numbers into a concise Spanish text
 */
export function formatDaysOfWeek(days?: number[]): string {
  if (!days || days.length === 0) return '';
  if (days.length === 7) return 'Todos los días';

  const sorted = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));

  if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d) => sorted.includes(d))) {
    return 'Lunes a Viernes';
  }
  if (sorted.length === 2 && sorted.includes(6) && sorted.includes(0)) {
    return 'Fines de semana (Sáb y Dom)';
  }
  if (sorted.length === 3 && sorted.includes(5) && sorted.includes(6) && sorted.includes(0)) {
    return 'Viernes a Domingo';
  }
  if (sorted.length === 2 && sorted.includes(1) && sorted.includes(3)) {
    return 'Lunes y Miércoles';
  }
  if (sorted.length === 2 && sorted.includes(2) && sorted.includes(4)) {
    return 'Martes y Jueves';
  }

  const dayNames = sorted.map((d) => DAYS_OF_WEEK.find((item) => item.id === d)?.name || '');
  if (dayNames.length === 1) return `Solo los ${dayNames[0]}`;
  if (dayNames.length === 2) return `${dayNames[0]} y ${dayNames[1]}`;

  const shortNames = sorted.map((d) => DAYS_OF_WEEK.find((item) => item.id === d)?.short || '');
  const last = shortNames.pop();
  return `${shortNames.join(', ')} y ${last}`;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Generate human-friendly badge text and calculated ISO expiration date
 */
export function computeValidityData(schedule: ValiditySchedule): {
  suggestedLabel: string;
  expiresAt?: string;
} {
  const now = new Date();

  switch (schedule.mode) {
    case 'quick': {
      const preset = schedule.quickPreset || 'today_10pm';
      if (preset === 'today_10pm') {
        const endOf10pm = new Date();
        endOf10pm.setHours(22, 0, 0, 0);
        return {
          suggestedLabel: '¡Hoy hasta las 10:00 PM!',
          expiresAt: endOf10pm.toISOString(),
        };
      }
      if (preset === 'today_night') {
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        return {
          suggestedLabel: 'Hoy hasta las 11:59 PM',
          expiresAt: endOfDay.toISOString(),
        };
      }
      if (preset === 'tomorrow') {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        tomorrow.setHours(23, 59, 59, 999);
        return {
          suggestedLabel: 'Vence mañana',
          expiresAt: tomorrow.toISOString(),
        };
      }
      if (preset === 'weekend') {
        // Next Sunday 23:59:59
        const day = now.getDay();
        const daysUntilSunday = (7 - day) % 7 || 7;
        const sunday = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000);
        sunday.setHours(23, 59, 59, 999);
        return {
          suggestedLabel: 'Fines de semana (Sáb y Dom)',
          expiresAt: sunday.toISOString(),
        };
      }
      if (preset === 'fri_sun') {
        const day = now.getDay();
        const daysUntilSunday = (7 - day) % 7 || 7;
        const sunday = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000);
        sunday.setHours(23, 59, 59, 999);
        return {
          suggestedLabel: 'Viernes a Domingo',
          expiresAt: sunday.toISOString(),
        };
      }
      if (preset === '3_days') {
        const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        in3Days.setHours(23, 59, 59, 999);
        return {
          suggestedLabel: 'Disponible por 3 días',
          expiresAt: in3Days.toISOString(),
        };
      }
      if (preset === '7_days') {
        const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        in7Days.setHours(23, 59, 59, 999);
        return {
          suggestedLabel: 'Válido por 7 días',
          expiresAt: in7Days.toISOString(),
        };
      }
      return {
        suggestedLabel: '¡Hoy hasta las 10:00 PM!',
        expiresAt: new Date(now.setHours(22, 0, 0, 0)).toISOString(),
      };
    }

    case 'days_of_week': {
      const daysText = formatDaysOfWeek(schedule.daysOfWeek) || 'Días seleccionados';
      let label = daysText;

      if (schedule.hasTimeRange && schedule.startTime && schedule.endTime) {
        const s12 = formatTime12h(schedule.startTime);
        const e12 = formatTime12h(schedule.endTime);
        label = `${daysText} (${s12} - ${e12})`;
      }

      // ExpiresAt: If endDate provided, use that. Otherwise, extend 45 days so recurring offer stays fresh
      let expiresAt: string | undefined = undefined;
      if (schedule.endDate) {
        const [year, month, day] = schedule.endDate.split('-').map(Number);
        const exp = new Date(year, month - 1, day, 23, 59, 59, 999);
        expiresAt = exp.toISOString();
      } else {
        const in45Days = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
        in45Days.setHours(23, 59, 59, 999);
        expiresAt = in45Days.toISOString();
      }

      return { suggestedLabel: label, expiresAt };
    }

    case 'happy_hour': {
      const s12 = formatTime12h(schedule.startTime || '16:00');
      const e12 = formatTime12h(schedule.endTime || '19:00');
      let label = `Happy Hour: ${s12} a ${e12}`;

      if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0 && schedule.daysOfWeek.length < 7) {
        const daysText = formatDaysOfWeek(schedule.daysOfWeek);
        label = `${daysText} (${s12} - ${e12})`;
      }

      // Default expiration 45 days recurring
      const in45Days = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
      return { suggestedLabel: label, expiresAt: in45Days.toISOString() };
    }

    case 'specific_date': {
      if (!schedule.specificDate) {
        return {
          suggestedLabel: 'Fecha específica',
          expiresAt: undefined,
        };
      }
      const [y, m, d] = schedule.specificDate.split('-').map(Number);
      const timeStr = schedule.exactTime || '22:00';
      const [hour, minute] = timeStr.split(':').map(Number);
      const targetDate = new Date(y, m - 1, d, hour, minute || 0, 0);

      const monthName = MONTH_NAMES[m - 1] || '';
      const time12 = formatTime12h(timeStr);
      const label = `Hasta el ${d} de ${monthName} (${time12})`;

      return {
        suggestedLabel: label,
        expiresAt: targetDate.toISOString(),
      };
    }

    case 'table': {
      // Calculate expiresAt based on validoHasta or maximum fechaFin in table
      let expiresAt: string | undefined = undefined;
      if (schedule.validoHasta) {
        const timePart = schedule.validoHastaHora || '23:59:59';
        const [y, m, d] = schedule.validoHasta.split('-').map(Number);
        const [hh, mm] = timePart.split(':').map(Number);
        const expDate = new Date(y, m - 1, d, hh || 23, mm || 59, 59, 999);
        expiresAt = expDate.toISOString();
      } else {
        // Find maximum fechaFin from active rows
        const activeRows = (schedule.scheduleTable || []).filter((r) => r.active && r.fechaFin);
        if (activeRows.length > 0) {
          const sorted = activeRows.sort((a, b) => b.fechaFin.localeCompare(a.fechaFin));
          const latestRow = sorted[0];
          const timePart = latestRow.horaFin || '23:59:59';
          const [y, m, d] = latestRow.fechaFin.split('-').map(Number);
          const [hh, mm] = timePart.split(':').map(Number);
          const expDate = new Date(y, m - 1, d, hh || 23, mm || 59, 59, 999);
          expiresAt = expDate.toISOString();
        } else {
          // Default 30 days
          const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          in30Days.setHours(23, 59, 59, 999);
          expiresAt = in30Days.toISOString();
        }
      }

      // Generate suggested label
      const activeRows = (schedule.scheduleTable || []).filter(
        (r) => r.active && (r.horaInicio || r.horaFin || r.fechaInicio || r.fechaFin)
      );

      let label = 'Horario programado';
      if (activeRows.length > 0) {
        const activeDayIndices = activeRows.map((r) => r.dayIndex);
        const daysText = formatDaysOfWeek(activeDayIndices);

        // Check if all have the same hours
        const firstWithHours = activeRows.find((r) => r.horaInicio && r.horaFin);
        const allSameHours =
          firstWithHours &&
          activeRows.every(
            (r) => r.horaInicio === firstWithHours.horaInicio && r.horaFin === firstWithHours.horaFin
          );

        if (allSameHours && firstWithHours) {
          const s12 = formatTime12h(firstWithHours.horaInicio);
          const e12 = formatTime12h(firstWithHours.horaFin);
          label = `${daysText} (${s12} - ${e12})`;
        } else if (daysText) {
          label = `${daysText}`;
        }
      } else if (schedule.validoHasta) {
        const [y, m, d] = schedule.validoHasta.split('-').map(Number);
        const mName = MONTH_NAMES[m - 1] || '';
        label = `Válido hasta el ${d} de ${mName}`;
      }

      // If validity date is set exclusively for today (Solo hoy)
      const todayStr = new Date().toISOString().split('T')[0];
      if (
        schedule.validoDesde &&
        schedule.validoHasta &&
        schedule.validoDesde === schedule.validoHasta &&
        schedule.validoDesde === todayStr
      ) {
        const firstWithHours = activeRows.find((r) => r.horaInicio && r.horaFin);
        if (firstWithHours) {
          const s12 = formatTime12h(firstWithHours.horaInicio);
          const e12 = formatTime12h(firstWithHours.horaFin);
          label = `Solo hoy (${s12} - ${e12})`;
        } else {
          label = 'Solo hoy';
        }
      }

      return { suggestedLabel: label, expiresAt };
    }

    case 'indefinite': {
      const note = schedule.note?.trim() || 'Hasta agotar existencias';
      return {
        suggestedLabel: note,
        expiresAt: undefined,
      };
    }

    default:
      return {
        suggestedLabel: '¡Hoy hasta las 10:00 PM!',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      };
  }
}

/**
 * Evaluates whether a scheduled post applies today and in the current time window
 */
export function getScheduleStatus(schedule?: ValiditySchedule): {
  appliesToday: boolean;
  isWithinTimeWindow: boolean;
  statusBadgeText: string;
  statusColor: 'green' | 'amber' | 'blue' | 'slate';
} {
  if (!schedule) {
    return {
      appliesToday: true,
      isWithinTimeWindow: true,
      statusBadgeText: 'Vigente',
      statusColor: 'green',
    };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Dom, 1 = Lun, etc.
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (schedule.mode === 'table' && schedule.scheduleTable) {
    const todayISO = now.toISOString().split('T')[0];

    // Check if overall validoDesde has not arrived yet
    if (schedule.validoDesde && todayISO < schedule.validoDesde) {
      return {
        appliesToday: false,
        isWithinTimeWindow: false,
        statusBadgeText: `Inicia el ${schedule.validoDesde}`,
        statusColor: 'amber',
      };
    }

    // Check if overall validoHasta is exceeded
    if (schedule.validoHasta && todayISO > schedule.validoHasta) {
      return {
        appliesToday: false,
        isWithinTimeWindow: false,
        statusBadgeText: 'Vencido',
        statusColor: 'slate',
      };
    }

    const todayRow = schedule.scheduleTable.find((r) => r.dayIndex === currentDay);

    if (!todayRow || !todayRow.active) {
      const activeRows = schedule.scheduleTable.filter((r) => r.active);
      const nextDayName = getNextUpcomingDay(activeRows.map((r) => r.dayIndex), currentDay);
      return {
        appliesToday: false,
        isWithinTimeWindow: false,
        statusBadgeText: nextDayName ? `Próximo: ${nextDayName}` : 'Días programados',
        statusColor: 'amber',
      };
    }

    // Check date range of todayRow if set
    if (todayRow.fechaInicio && todayISO < todayRow.fechaInicio) {
      return {
        appliesToday: false,
        isWithinTimeWindow: false,
        statusBadgeText: `Inicia el ${todayRow.fechaInicio}`,
        statusColor: 'amber',
      };
    }
    if (todayRow.fechaFin && todayISO > todayRow.fechaFin) {
      return {
        appliesToday: false,
        isWithinTimeWindow: false,
        statusBadgeText: 'Finalizó este ciclo',
        statusColor: 'slate',
      };
    }

    // Check time range if set
    if (todayRow.horaInicio && todayRow.horaFin) {
      const [sh, sm] = todayRow.horaInicio.split(':').map(Number);
      const [eh, em] = todayRow.horaFin.split(':').map(Number);
      const startMin = sh * 60 + (sm || 0);
      const endMin = eh * 60 + (em || 0);

      if (currentMinutes < startMin) {
        return {
          appliesToday: true,
          isWithinTimeWindow: false,
          statusBadgeText: `Inicia hoy a las ${formatTime12h(todayRow.horaInicio)}`,
          statusColor: 'amber',
        };
      }
      if (currentMinutes > endMin) {
        return {
          appliesToday: true,
          isWithinTimeWindow: false,
          statusBadgeText: 'Finalizó por hoy',
          statusColor: 'amber',
        };
      }
      return {
        appliesToday: true,
        isWithinTimeWindow: true,
        statusBadgeText: '¡Aplica hoy!',
        statusColor: 'green',
      };
    }

    return {
      appliesToday: true,
      isWithinTimeWindow: true,
      statusBadgeText: '¡Aplica hoy!',
      statusColor: 'green',
    };
  }

  let appliesToday = true;
  if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
    appliesToday = schedule.daysOfWeek.includes(currentDay);
  }

  let isWithinTimeWindow = true;
  if (schedule.hasTimeRange && schedule.startTime && schedule.endTime) {
    const [sh, sm] = schedule.startTime.split(':').map(Number);
    const [eh, em] = schedule.endTime.split(':').map(Number);
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    isWithinTimeWindow = currentMinutes >= startMin && currentMinutes <= endMin;
  }

  if (schedule.mode === 'indefinite') {
    return {
      appliesToday: true,
      isWithinTimeWindow: true,
      statusBadgeText: 'Permanente',
      statusColor: 'blue',
    };
  }

  if (!appliesToday) {
    const nextDayName = getNextUpcomingDay(schedule.daysOfWeek, currentDay);
    return {
      appliesToday: false,
      isWithinTimeWindow: false,
      statusBadgeText: nextDayName ? `Próximo: ${nextDayName}` : 'Días programados',
      statusColor: 'amber',
    };
  }

  if (schedule.hasTimeRange && !isWithinTimeWindow) {
    const [sh] = (schedule.startTime || '00:00').split(':').map(Number);
    const isBefore = currentMinutes < sh * 60;
    return {
      appliesToday: true,
      isWithinTimeWindow: false,
      statusBadgeText: isBefore ? `Inicia a las ${formatTime12h(schedule.startTime)}` : 'Finalizó por hoy',
      statusColor: 'amber',
    };
  }

  return {
    appliesToday: true,
    isWithinTimeWindow: true,
    statusBadgeText: '¡Aplica hoy!',
    statusColor: 'green',
  };
}

function getNextUpcomingDay(daysOfWeek?: number[], currentDay: number = 0): string | null {
  if (!daysOfWeek || daysOfWeek.length === 0) return null;
  for (let offset = 1; offset <= 7; offset++) {
    const checkDay = (currentDay + offset) % 7;
    if (daysOfWeek.includes(checkDay)) {
      return DAYS_OF_WEEK.find((d) => d.id === checkDay)?.name || null;
    }
  }
  return null;
}

/**
 * Converts a time string in 12h or 24h format ("1:00 PM", "13:00", "08:30 am", "8 PM") into total minutes from midnight (0..1439)
 */
export function parseTimeToMinutes(t?: string | null): number | null {
  if (!t || typeof t !== 'string') return null;
  const clean = t.trim().toUpperCase();

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

export function normalizeDayNameToDia(name: string): DayScheduleRow['dia'] | null {
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
 * Returns a complete DayScheduleRow[] pre-filled with the business's actual operating hours.
 * If the post already has active rows with valid hours, returns them. Otherwise, defaults to the business schedule.
 */
export function getDefaultScheduleForBusiness(
  business?: { hours?: string } | null,
  existingRows?: DayScheduleRow[]
): DayScheduleRow[] {
  // If existing rows have valid hours configured for at least one active day, preserve them
  if (existingRows && existingRows.length === 7) {
    const hasConfiguredHours = existingRows.some((r) => r.active && r.horaInicio && r.horaFin);
    if (hasConfiguredHours) {
      return existingRows.map((r) => ({ ...r }));
    }
  }

  // Pre-fill from business hours if available
  if (business?.hours) {
    return parseBusinessSchedule(business.hours);
  }

  return INITIAL_SCHEDULE_TABLE.map((r) => ({ ...r }));
}
