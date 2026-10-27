import assert from 'node:assert';
import { runTest, MOCK_BUSINESSES, MOCK_POSTS } from './testContext';
import {
  getColombiaLocalDate,
  resolveTargetDateFromPrompt,
  parseTimeToMinutes,
  formatMinutesTo12h,
  parseBusinessSchedule,
  isBusinessOpen,
  checkPostValidity,
  COLOMBIA_TIMEZONE_OFFSET_HOURS,
} from '../oliValidator';
import { Business, Post } from '../../src/types';

export function runScheduleValiditySuite() {
  console.log('\n--- SUITE 5: HORARIOS, VIGENCIAS Y FECHAS COLOMBIA UTC-5 (Pruebas 166 a 205) ---');

  // ----------------------------------------------------------------------------
  // Bloque 1: Zona Horaria Colombia (UTC-5) y Resolución de Fechas (Pruebas 166 a 175)
  // ----------------------------------------------------------------------------
  runTest(166, 'Zona Horaria Colombia: El desfase oficial es -5 horas UTC', () => {
    assert.strictEqual(COLOMBIA_TIMEZONE_OFFSET_HOURS, -5);
  });

  runTest(167, 'Resolución de fecha local Colombia a partir de fecha UTC de referencia', () => {
    // 2026-10-27T03:00:00Z UTC son las 22:00 del 2026-10-26 en Colombia (-5h)
    const refUtc = new Date('2026-10-27T03:00:00Z');
    const col = getColombiaLocalDate(refUtc);
    assert.strictEqual(col.hours, 22);
    assert.strictEqual(col.day, 26);
  });

  runTest(168, 'Resolución de prompt: "hoy" devuelve la fecha actual de referencia', () => {
    const ref = new Date('2026-10-24T15:00:00Z'); // Sábado
    const res = resolveTargetDateFromPrompt('Quiero salir hoy a comer', ref);
    assert.strictEqual(res.dayName, 'hoy');
    assert.strictEqual(res.isSpecificDayMentioned, true);
  });

  runTest(169, 'Resolución de prompt: "mañana" incrementa 24 horas', () => {
    const ref = new Date('2026-10-24T15:00:00Z');
    const res = resolveTargetDateFromPrompt('Vamos mañana a almorzar', ref);
    assert.strictEqual(res.dayName, 'mañana');
    assert.strictEqual(res.isSpecificDayMentioned, true);
    assert.ok(res.targetDate.getTime() > ref.getTime());
  });

  runTest(170, 'Resolución de prompt: "el domingo" resuelve a domingo (dayIndex: 0)', () => {
    const ref = new Date('2026-10-21T15:00:00Z'); // Miércoles
    const res = resolveTargetDateFromPrompt('Plan para el domingo con la familia', ref);
    assert.strictEqual(res.dayOfWeek, 0);
    assert.strictEqual(res.isSpecificDayMentioned, true);
  });

  runTest(171, 'Resolución de prompt: "el viernes" resuelve a viernes (dayIndex: 5)', () => {
    const ref = new Date('2026-10-20T15:00:00Z'); // Martes
    const res = resolveTargetDateFromPrompt('Salir este viernes de rumba', ref);
    assert.strictEqual(res.dayOfWeek, 5);
  });

  runTest(172, 'Resolución de prompt: "el sábado" resuelve a sábado (dayIndex: 6)', () => {
    const ref = new Date('2026-10-21T15:00:00Z');
    const res = resolveTargetDateFromPrompt('Plan para el sábado en pareja', ref);
    assert.strictEqual(res.dayOfWeek, 6);
  });

  runTest(173, 'Resolución de prompt: "fin de semana" o "finde" apunta al sábado o domingo', () => {
    const ref = new Date('2026-10-20T15:00:00Z');
    const res = resolveTargetDateFromPrompt('Planes para este finde', ref);
    assert.ok(res.dayOfWeek === 6 || res.dayOfWeek === 0);
  });

  runTest(174, 'Formateo de minutos a 12 horas: formatMinutesTo12h', () => {
    assert.strictEqual(formatMinutesTo12h(0), '12:00 AM');
    assert.strictEqual(formatMinutesTo12h(480), '8:00 AM');
    assert.strictEqual(formatMinutesTo12h(720), '12:00 PM');
    assert.strictEqual(formatMinutesTo12h(810), '1:30 PM');
    assert.strictEqual(formatMinutesTo12h(1320), '10:00 PM');
  });

  runTest(175, 'Resolución de prompt sin mención de día utiliza fin de semana por defecto', () => {
    const res = resolveTargetDateFromPrompt('Quiero recomendaciones ricas');
    assert.strictEqual(res.isSpecificDayMentioned, false);
  });

  // ----------------------------------------------------------------------------
  // Bloque 2: Parser de Horarios y Minutos (Pruebas 176 a 185)
  // ----------------------------------------------------------------------------
  runTest(176, 'parseTimeToMinutes: Formato estándar 12h "8:00 AM"', () => {
    assert.strictEqual(parseTimeToMinutes('8:00 AM'), 480);
    assert.strictEqual(parseTimeToMinutes('08:00 am'), 480);
  });

  runTest(177, 'parseTimeToMinutes: Mediodía "12:00 PM"', () => {
    assert.strictEqual(parseTimeToMinutes('12:00 PM'), 720);
    assert.strictEqual(parseTimeToMinutes('12:00 pm'), 720);
  });

  runTest(178, 'parseTimeToMinutes: Medianoche "12:00 AM"', () => {
    assert.strictEqual(parseTimeToMinutes('12:00 AM'), 0);
  });

  runTest(179, 'parseTimeToMinutes: Tarde "1:30 PM" y "3:45 PM"', () => {
    assert.strictEqual(parseTimeToMinutes('1:30 PM'), 810);
    assert.strictEqual(parseTimeToMinutes('3:45 PM'), 945);
  });

  runTest(180, 'parseTimeToMinutes: Formato 24h militar "14:00" y "22:30"', () => {
    assert.strictEqual(parseTimeToMinutes('14:00'), 840);
    assert.strictEqual(parseTimeToMinutes('22:30'), 1350);
  });

  runTest(181, 'parseTimeToMinutes: Horario 24 Horas devuelve 0 a 1439', () => {
    assert.strictEqual(parseTimeToMinutes('24 horas'), 0);
  });

  runTest(182, 'parseTimeToMinutes: String vacío o nulo devuelve null limpiamente', () => {
    assert.strictEqual(parseTimeToMinutes(''), null);
    assert.strictEqual(parseTimeToMinutes(null), null);
    assert.strictEqual(parseTimeToMinutes(undefined), null);
    assert.strictEqual(parseTimeToMinutes('invalido'), null);
  });

  runTest(183, 'parseTimeToMinutes: Espacios en blanco adicionales "  9:00 PM  "', () => {
    assert.strictEqual(parseTimeToMinutes('  9:00 PM  '), 1260);
  });

  runTest(184, 'parseBusinessSchedule: Texto estándar "Lun - Sáb: 8:00 AM - 7:00 PM"', () => {
    const rows = parseBusinessSchedule('Lun - Sáb: 8:00 AM - 7:00 PM');
    assert.strictEqual(rows.length, 7);
    const monday = rows.find((r) => r.dia === 'Lunes');
    assert.strictEqual(monday?.active, true);
    assert.strictEqual(monday?.horaInicio, '08:00');
    assert.strictEqual(monday?.horaFin, '19:00');
  });

  runTest(185, 'parseBusinessSchedule: Manejo de cierre dominical "Dom: Cerrado"', () => {
    const rows = parseBusinessSchedule('Lun - Sáb: 8:00 AM - 6:00 PM | Dom: Cerrado');
    const sunday = rows.find((r) => r.dia === 'Domingo');
    assert.strictEqual(sunday?.active, false);
  });

  // ----------------------------------------------------------------------------
  // Bloque 3: Validación de Apertura de Comercios (Pruebas 186 a 195)
  // ----------------------------------------------------------------------------
  runTest(186, 'isBusinessOpen: Comercio abierto en horario normal', () => {
    const biz: Partial<Business> = {
      id: 'b_open',
      hours: 'Lun - Dom: 10:00 AM - 10:00 PM',
      status: 'active',
    };
    const res = isBusinessOpen(biz, new Date(), 2, '14:00');
    assert.strictEqual(res.isOpen, true);
  });

  runTest(187, 'isBusinessOpen: Comercio cerrado fuera de horario por la noche', () => {
    const biz: Partial<Business> = {
      id: 'b_closed',
      hours: 'Lun - Sáb: 8:00 AM - 6:00 PM',
      status: 'active',
    };
    const res = isBusinessOpen(biz, new Date(), 1, '20:00');
    assert.strictEqual(res.isOpen, false);
  });

  runTest(188, 'isBusinessOpen: Comercio cerrado el domingo', () => {
    const biz: Partial<Business> = {
      id: 'b_closed_sun',
      hours: 'Lun - Sáb: 8:00 AM - 6:00 PM | Dom: Cerrado',
      status: 'active',
    };
    const res = isBusinessOpen(biz, new Date(), 0, '12:00');
    assert.strictEqual(res.isOpen, false);
  });

  runTest(189, 'isBusinessOpen: Minuto exacto de apertura (8:00 AM)', () => {
    const biz: Partial<Business> = {
      id: 'b_exact_open',
      hours: 'Lun - Sáb: 8:00 AM - 6:00 PM',
      status: 'active',
    };
    const res = isBusinessOpen(biz, new Date(), 1, '08:00');
    assert.strictEqual(res.isOpen, true);
  });

  runTest(190, 'isBusinessOpen: 1 minuto antes del cierre (17:59)', () => {
    const biz: Partial<Business> = {
      id: 'b_almost_close',
      hours: 'Lun - Sáb: 8:00 AM - 6:00 PM',
      status: 'active',
    };
    const res = isBusinessOpen(biz, new Date(), 1, '17:59');
    assert.strictEqual(res.isOpen, true);
  });

  runTest(191, 'isBusinessOpen: 1 minuto después del cierre (18:01)', () => {
    const biz: Partial<Business> = {
      id: 'b_past_close',
      hours: 'Lun - Sáb: 8:00 AM - 6:00 PM',
      status: 'active',
    };
    const res = isBusinessOpen(biz, new Date(), 1, '18:01');
    assert.strictEqual(res.isOpen, false);
  });

  runTest(192, 'isBusinessOpen: Comercio 24 horas siempre abierto', () => {
    const biz: Partial<Business> = {
      id: 'b_24h',
      hours: '24 Horas',
      status: 'active',
    };
    assert.strictEqual(isBusinessOpen(biz, new Date(), 0, '03:00').isOpen, true);
    assert.strictEqual(isBusinessOpen(biz, new Date(), 3, '23:30').isOpen, true);
  });

  runTest(193, 'isBusinessOpen: Comercio sin campo de horario registrado no crashea', () => {
    const biz: Partial<Business> = { id: 'b_no_hours', status: 'active' };
    const res = isBusinessOpen(biz, new Date(), 1, '14:00');
    assert.strictEqual(res.isOpen, true, 'Permisivo cuando no hay datos explícitos');
  });

  runTest(194, 'isBusinessOpen: Horario nocturno que cruza la medianoche (7 PM - 3 AM)', () => {
    const biz: Partial<Business> = {
      id: 'b_night',
      hours: 'Jue - Sáb: 7:00 PM - 3:00 AM',
      status: 'active',
    };
    const res = isBusinessOpen(biz, new Date(), 5, '22:00');
    assert.strictEqual(res.isOpen, true);
  });

  runTest(195, 'isBusinessOpen: Horario corrupto con caracteres especiales no genera excepción', () => {
    const biz: Partial<Business> = { id: 'b_corrupt', hours: '???&&&###', status: 'active' };
    const res = isBusinessOpen(biz, new Date(), 1, '12:00');
    assert.strictEqual(typeof res.isOpen, 'boolean');
  });

  // ----------------------------------------------------------------------------
  // Bloque 4: Validación de Campañas y Publicaciones (Pruebas 196 a 205)
  // ----------------------------------------------------------------------------
  runTest(196, 'checkPostValidity: Campaña con fecha vencida en el pasado', () => {
    const post: Partial<Post> = {
      id: 'p_exp',
      type: 'promotion',
      status: 'active',
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-05-01T00:00:00Z',
    };
    const res = checkPostValidity(post as Post, new Date('2026-10-21T12:00:00Z'));
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.status, 'expired');
  });

  runTest(197, 'checkPostValidity: Campaña con inicio en el futuro', () => {
    const post: Partial<Post> = {
      id: 'p_fut',
      type: 'promotion',
      status: 'active',
      startsAt: '2026-12-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
    };
    const res = checkPostValidity(post as Post, new Date('2026-10-21T12:00:00Z'));
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.status, 'future');
  });

  runTest(198, 'checkPostValidity: Campaña activa dentro del rango de fechas', () => {
    const post: Partial<Post> = {
      id: 'p_act',
      type: 'promotion',
      status: 'active',
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
    };
    const res = checkPostValidity(post as Post, new Date('2026-10-21T12:00:00Z'));
    assert.strictEqual(res.isValid, true);
  });

  runTest(199, 'checkPostValidity: Publicación con status "inactive" es inválida', () => {
    const post: Partial<Post> = {
      id: 'p_inact',
      status: 'inactive' as any,
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
    };
    const res = checkPostValidity(post as Post, new Date('2026-10-21T12:00:00Z'));
    assert.strictEqual(res.isValid, false);
  });

  runTest(200, 'checkPostValidity: Publicación con status "archived" es inválida', () => {
    const post: Partial<Post> = {
      id: 'p_arch',
      status: 'archived' as any,
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
    };
    const res = checkPostValidity(post as Post, new Date('2026-10-21T12:00:00Z'));
    assert.strictEqual(res.isValid, false);
  });

  runTest(201, 'checkPostValidity: Coherencia combinada cuando el post está activo pero el negocio está cerrado', () => {
    const post: Partial<Post> = {
      id: 'p_comb',
      type: 'promotion',
      status: 'active',
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
    };
    const biz: Partial<Business> = {
      id: 'b_closed_sun',
      hours: 'Lun - Sáb: 8:00 AM - 6:00 PM | Dom: Cerrado',
      status: 'active',
    };
    const res = checkPostValidity(post as Post, new Date('2026-10-25T14:00:00Z'), 0, '14:00', biz);
    assert.strictEqual(res.isValid, false, 'No puede ser válido si el local físico está cerrado');
    assert.strictEqual(res.status, 'day_mismatch');
  });

  runTest(202, 'checkPostValidity: Coherencia combinada cuando tanto el post como el negocio están abiertos', () => {
    const post: Partial<Post> = {
      id: 'p_comb_ok',
      type: 'promotion',
      status: 'active',
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
    };
    const biz: Partial<Business> = {
      id: 'b_open_all',
      hours: 'Lun - Dom: 9:00 AM - 9:00 PM',
      status: 'active',
    };
    const res = checkPostValidity(post as Post, new Date('2026-10-25T14:00:00Z'), 0, '14:00', biz);
    assert.strictEqual(res.isValid, true);
  });

  runTest(203, 'checkPostValidity: Publicación sin fechas de vigencia explícitas tiene isGuaranteed en false', () => {
    const post: Partial<Post> = { id: 'p_nodates', status: 'active', type: 'product' };
    const res = checkPostValidity(post as Post, new Date());
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.isGuaranteed, false);
  });

  runTest(204, 'checkPostValidity: Mode "days_of_week" con coincidencia exitosa', () => {
    const post: Partial<Post> = {
      id: 'p_days',
      status: 'active',
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      validitySchedule: { mode: 'days_of_week', daysOfWeek: [5, 6, 0] },
    };
    const resSat = checkPostValidity(post as Post, new Date(), 6);
    assert.strictEqual(resSat.isValid, true);
    const resTue = checkPostValidity(post as Post, new Date(), 2);
    assert.strictEqual(resTue.isValid, false);
  });

  runTest(205, 'checkPostValidity: Table schedule con hora límite de inicio y fin', () => {
    const post: Partial<Post> = {
      id: 'p_tbl',
      status: 'active',
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      validitySchedule: {
        mode: 'table',
        scheduleTable: [
          { dia: 'Sábado', dayIndex: 6, active: true, horaInicio: '14:00', horaFin: '18:00' },
        ],
      },
    };
    assert.strictEqual(checkPostValidity(post as Post, new Date(), 6, '15:00').isValid, true);
    assert.strictEqual(checkPostValidity(post as Post, new Date(), 6, '19:00').isValid, false);
  });
}
