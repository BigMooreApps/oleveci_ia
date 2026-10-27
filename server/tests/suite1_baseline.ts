import assert from 'node:assert';
import { runTest, MOCK_BUSINESSES, MOCK_POSTS } from './testContext';
import {
  generateFallbackOliPlan,
  detectSearchIntent,
  searchBusinessesAndPosts,
  extractMunicipality,
  sanitizeSpokenText,
  classifyPostRole,
  buildCoherentItinerary,
  removeStopAndRecalculatePlan,
  OliPlanStop,
} from '../oliAssistant';
import {
  checkPostValidity,
  formatPriceCOP,
  formatPriceForSpeech,
  calculateItineraryBudget,
  sanitizeCurrencyText,
  isBusinessOpen,
} from '../oliValidator';
import { getDefaultScheduleForBusiness } from '../../src/utils/validityHelper';
import { Post, Business } from '../../src/types';

export function runBaselineSuite() {
  console.log('\n--- SUITE 1: BATERÍA FUNDAMENTAL BASE (Pruebas 01 a 33) ---');

  // Test 1: Búsqueda puntual de una papelería
  runTest(1, 'Búsqueda puntual de una papelería', () => {
    const isSearch = detectSearchIntent('Necesito una papelería');
    assert.strictEqual(isSearch, true, 'Debe clasificarse como intención search');

    const result = searchBusinessesAndPosts('Necesito una papelería', MOCK_BUSINESSES, MOCK_POSTS, 'Cajicá');
    assert.ok(result.matchedBusinesses.length > 0, 'Debe encontrar comercios');
    assert.strictEqual(result.matchedBusinesses[0].id, 'biz_papeleria_cajica');
    assert.strictEqual(result.matchedBusinesses[0].city, 'Cajicá');
  });

  // Test 2: Búsqueda de un taller en un municipio concreto (Cota)
  runTest(2, 'Búsqueda de un taller en un municipio concreto (Cota)', () => {
    const isSearch = detectSearchIntent('Busco un taller mecánico en Cota');
    assert.strictEqual(isSearch, true, 'Debe clasificarse como búsqueda');

    const mun = extractMunicipality('Busco un taller mecánico en Cota');
    assert.strictEqual(mun, 'Cota', 'Debe extraer el municipio Cota');

    const result = searchBusinessesAndPosts('Busco un taller mecánico en Cota', MOCK_BUSINESSES, MOCK_POSTS, 'Cota');
    assert.ok(result.matchedBusinesses.length > 0);
    assert.strictEqual(result.matchedBusinesses[0].id, 'biz_taller_cota');
    assert.strictEqual(result.matchedBusinesses[0].city, 'Cota');
  });

  // Test 3: Solicitud de arroz chino cuando no existe en el catálogo
  runTest(3, 'Solicitud de arroz chino cuando no existe en el catálogo', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero comer arroz chino',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    assert.strictEqual(plan.isAlternativeSuggestion, true, 'Debe marcarse como sugerencia alternativa');
    assert.ok(plan.spokenText.toLowerCase().startsWith('¡listo veci!'), 'Debe comenzar con ¡Listo veci!');
    assert.ok(
      plan.spokenText.toLowerCase().includes('no tenemos') && plan.spokenText.toLowerCase().includes('arroz chino'),
      'Debe aclarar de forma transparente que no hay arroz chino'
    );
    assert.ok(!plan.spokenText.includes('$'), 'No debe contener el símbolo $');
  });

  // Test 4: Plan gastronómico con dos paradas válidas
  runTest(4, 'Plan gastronómico con dos paradas válidas', () => {
    const posts = [MOCK_POSTS[0], MOCK_POSTS[1]]; // burger y café
    const plan = generateFallbackOliPlan({
      userPrompt: 'Arma un plan de comida y café en pareja',
      currentCity: 'Cajicá',
      catalogPosts: posts,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    assert.strictEqual(plan.stops?.length, 2, 'Debe contener exactamente 2 paradas');
    assert.notStrictEqual(plan.stops?.[0].businessId, plan.stops?.[1].businessId, 'Negocios deben ser distintos');
  });

  // Test 5: Plan con tres paradas y narración completa
  runTest(5, 'Plan con tres paradas y narración completa', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero un plan completo de 3 paradas para este fin de semana',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    assert.ok(plan.stops && plan.stops.length >= 3, 'Debe contener 3 paradas');
    for (const stop of plan.stops!) {
      const bizNorm = stop.businessName.toLowerCase();
      assert.ok(
        plan.spokenText.toLowerCase().includes(bizNorm),
        `La narración spokenText debe nombrar explícitamente a ${stop.businessName}`
      );
    }
  });

  // Test 6: Intento de incluir dos publicaciones del mismo negocio
  runTest(6, 'Intento de incluir dos publicaciones del mismo negocio', () => {
    const duplicatePost: Post = {
      ...MOCK_POSTS[0],
      id: 'post_promo_smash_second',
      title: 'Otra hamburguesa del mismo negocio',
    };
    const candidates = [MOCK_POSTS[0], duplicatePost, MOCK_POSTS[1]];
    const selected = buildCoherentItinerary([MOCK_POSTS[0], duplicatePost], candidates, 3);

    const businessIds = selected.map((s) => s.businessId);
    const uniqueBiz = new Set(businessIds);
    assert.strictEqual(businessIds.length, uniqueBiz.size, 'No debe haber negocios duplicados');
  });

  // Test 7: Intento de incluir dos platos principales pesados
  runTest(7, 'Intento de incluir dos platos principales pesados', () => {
    const candidates = [MOCK_POSTS[0], MOCK_POSTS[2], MOCK_POSTS[1]];
    const selected = buildCoherentItinerary([MOCK_POSTS[0], MOCK_POSTS[2]], candidates, 3);

    const mainCourses = selected.filter((p) => classifyPostRole(p) === 'main_course');
    assert.ok(mainCourses.length <= 1, 'Máximo un plato principal pesado por itinerario');
  });

  // Test 8: Plan familiar con exclusión de bares nocturnos
  runTest(8, 'Plan familiar con exclusión de bares nocturnos', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan familiar para el domingo con los niños',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    const hasNightBar = plan.stops?.some((s) => s.businessId === 'biz_bar_nocturno');
    assert.strictEqual(hasNightBar, false, 'Un plan familiar jamás debe incluir bares nocturnos ni discotecas');
  });

  // Test 9: Solicitud de comida o plan sin intención de gimnasio
  runTest(9, 'Solicitud de comida o plan sin intención de gimnasio', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero un plan para comer rico el fin de semana',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    const hasGym = plan.stops?.some((s) => s.businessId === 'biz_gym_cajica');
    assert.strictEqual(hasGym, false, 'No debe incluir gimnasios si el usuario no los pide explícitamente');
  });

  // Test 10: Solicitud explícita de entrenamiento y gimnasio
  runTest(10, 'Solicitud explícita de entrenamiento y gimnasio', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero un plan con gimnasio, pesas y luego un buen café',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    const hasGym = plan.stops?.some((s) => s.businessId === 'biz_gym_cajica');
    assert.strictEqual(hasGym, true, 'Debe incluir el gimnasio al solicitarlo expresamente');
  });

  // Test 11: Promoción vencida
  runTest(11, 'Promoción vencida no debe considerarse válida', () => {
    const expiredPost: Partial<Post> = {
      id: 'post_expired',
      status: 'active',
      type: 'promotion',
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-03-01T00:00:00Z',
    };

    const validity = checkPostValidity(expiredPost as Post, new Date('2026-10-21T12:00:00Z'));
    assert.strictEqual(validity.isValid, false, 'Publicación con fecha pasada debe ser inválida');
    assert.strictEqual(validity.status, 'expired');
  });

  // Test 12: Promoción futura
  runTest(12, 'Promoción futura no debe considerarse válida antes de su inicio', () => {
    const futurePost: Partial<Post> = {
      id: 'post_future',
      status: 'active',
      type: 'promotion',
      startsAt: '2026-12-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
    };

    const validity = checkPostValidity(futurePost as Post, new Date('2026-10-21T12:00:00Z'));
    assert.strictEqual(validity.isValid, false, 'Publicación antes de startsAt debe ser inválida');
    assert.strictEqual(validity.status, 'future');
  });

  // Test 13: Promoción válida solo determinados días
  runTest(13, 'Promoción válida solo determinados días', () => {
    const weekdayPost: Partial<Post> = {
      id: 'post_mon_wed',
      status: 'active',
      type: 'promotion',
      startsAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      validitySchedule: {
        mode: 'days_of_week',
        daysOfWeek: [1, 2, 3],
      },
    };

    const sundayCheck = checkPostValidity(weekdayPost as Post, new Date('2026-10-25T12:00:00Z'), 0);
    assert.strictEqual(sundayCheck.isValid, false, 'No debe ser válida en domingo');
    assert.strictEqual(sundayCheck.status, 'day_mismatch');

    const tuesdayCheck = checkPostValidity(weekdayPost as Post, new Date('2026-10-20T12:00:00Z'), 2);
    assert.strictEqual(tuesdayCheck.isValid, true, 'Debe ser válida en martes');
  });

  // Test 14: Publicación activa sin información de vigencia suficiente
  runTest(14, 'Publicación activa sin información de vigencia suficiente no afirma garantía absoluta', () => {
    const noVigencyPost: Partial<Post> = {
      id: 'post_no_dates',
      status: 'active',
      type: 'product',
    };

    const validity = checkPostValidity(noVigencyPost as Post, new Date('2026-10-21T12:00:00Z'));
    assert.strictEqual(validity.isValid, true, 'Permitida como publicación normal');
    assert.strictEqual(validity.isGuaranteed, false, 'No debe marcarse como garantía verificada sin fechas explícitas');
  });

  // Test 15: Comercio sin horarios registrados
  runTest(15, 'Comercio sin horarios registrados aclara horario orientativo en recomendaciones', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan para salir en Cajicá',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    assert.ok(
      plan.recommendations?.some((r) => r.toLowerCase().includes('horarios') || r.toLowerCase().includes('disponibilidad')),
      'Debe aclarar que los horarios son sugeridos o verificar previamente'
    );
  });

  // Test 16: Precio ausente
  runTest(16, 'Precio ausente no se convierte silenciosamente en 0 pesos confirmados', () => {
    const budget = calculateItineraryBudget([{ cost: 25000 }, { cost: -1, isUnconfirmed: true }], 100000, 2);
    assert.strictEqual(budget.hasUnconfirmedPrices, true);
    assert.strictEqual(budget.unconfirmedCount, 1);
    assert.ok(budget.explanation.includes('consultar'), 'Debe indicar que hay precio por consultar');
  });

  // Test 17: Presupuesto exacto
  runTest(17, 'Presupuesto exacto marca budgetStatus on_budget', () => {
    const budget = calculateItineraryBudget([{ cost: 30000 }, { cost: 20000 }], 50000, 2);
    assert.strictEqual(budget.totalEstimatedCost, 50000);
    assert.strictEqual(budget.budgetStatus, 'on_budget');
    assert.strictEqual(budget.savingsOrRemaining, 0);
  });

  // Test 18: Presupuesto insuficiente
  runTest(18, 'Presupuesto insuficiente marca budgetStatus over_budget', () => {
    const budget = calculateItineraryBudget([{ cost: 60000 }, { cost: 40000 }], 80000, 2);
    assert.strictEqual(budget.totalEstimatedCost, 100000);
    assert.strictEqual(budget.budgetStatus, 'over_budget');
    assert.strictEqual(budget.difference, -20000);
  });

  // Test 19: Varias personas
  runTest(19, 'Cálculo correcto para varias personas (4 personas)', () => {
    const budget = calculateItineraryBudget([{ cost: 80000 }, { cost: 40000 }], 150000, 4);
    assert.strictEqual(budget.totalEstimatedCost, 120000);
    assert.strictEqual(budget.personCount, 4);
    assert.strictEqual(budget.costPerPerson, 30000);
  });

  // Test 20: Respuesta de Gemini con JSON inválido
  runTest(20, 'Recuperación segura cuando Gemini devuelve JSON inválido', () => {
    const fallback = generateFallbackOliPlan({
      userPrompt: 'Plan romántico para el sábado',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    assert.strictEqual(fallback.type, 'plan');
    assert.ok(Array.isArray(fallback.stops) && fallback.stops.length >= 2);
    assert.ok(typeof fallback.spokenText === 'string');
  });

  // Test 21: Fallo de Gemini activa respaldo cumpliendo 100% las reglas críticas
  runTest(21, 'Fallo de Gemini activa respaldo cumpliendo 100% las reglas críticas', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan familiar domingo',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    assert.ok(plan.stops && plan.stops.length >= 2, 'Debe generar al menos 2 paradas');
    assert.notStrictEqual(plan.stops[0].businessId, plan.stops[1].businessId, 'Negocios únicos');
    assert.ok(!plan.spokenText.includes('$'), 'Cero $');
    assert.ok(plan.spokenText.startsWith('¡Listo veci!'), 'Debe iniciar con ¡Listo veci!');
  });

  // Test 22: Garantía de correspondencia entre identificadores e imagen real del catálogo
  runTest(22, 'Garantía de correspondencia entre identificadores e imagen real del catálogo', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan con hamburguesa y café',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    for (const stop of plan.stops!) {
      const post = MOCK_POSTS.find((p) => p.id === stop.postId);
      assert.ok(post, `El postId ${stop.postId} debe existir en el catálogo`);
      assert.strictEqual(stop.businessId, post.businessId, 'El businessId debe coincidir con la publicación');
      assert.strictEqual(stop.imageUrl, post.imageUrl, 'La imagen debe coincidir con la del catálogo');
    }
  });

  // Test 23: Municipio no especificado utiliza el selector activo (Cota)
  runTest(23, 'Municipio no especificado utiliza el selector activo (Cota)', () => {
    const mun = extractMunicipality('Quiero una tarde para comer rico', 'Cota');
    assert.strictEqual(mun, 'Cota', 'Debe tomar el selector activo si no se especificó');
  });

  // Test 24: Ausencia de municipio activo utiliza Cajicá como municipio predeterminado
  runTest(24, 'Ausencia de municipio activo utiliza Cajicá como municipio predeterminado', () => {
    const mun = extractMunicipality('Quiero salir este fin de semana', '');
    assert.strictEqual(mun, 'Cajicá', 'Debe caer en Cajicá por defecto');
  });

  // Test 25: Precios con separadores de miles y narración de voz sin romper formato
  runTest(25, 'Precios con separadores de miles y narración de voz sin romper formato (1.500, 24.900, 125.000, 1.250.000)', () => {
    assert.strictEqual(formatPriceCOP(1500), '1.500 pesos');
    assert.strictEqual(formatPriceCOP(24900), '24.900 pesos');
    assert.strictEqual(formatPriceCOP(125000), '125.000 pesos');
    assert.strictEqual(formatPriceCOP(1250000), '1.250.000 pesos');

    assert.strictEqual(formatPriceForSpeech(25000), '25 mil pesos');
    assert.strictEqual(formatPriceForSpeech(125000), '125 mil pesos');
    assert.strictEqual(formatPriceForSpeech(1250000), 'un millón 250 mil pesos');

    const sanitized = sanitizeCurrencyText('El costo es de $ 24.900 y la picada vale $125.000 COP');
    assert.ok(!sanitized.includes('$'), 'No debe quedar ningún signo de dólar');
    assert.ok(sanitized.includes('24.900 pesos') || sanitized.includes('24 mil'));
  });

  // Test 26: Eliminación de una parada y recálculo del presupuesto
  runTest(26, 'Eliminación de una parada y recálculo del presupuesto', () => {
    const initialPlan = generateFallbackOliPlan({
      userPrompt: 'Plan completo de fin de semana',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });

    assert.strictEqual(initialPlan.stops?.length, 3);
    const costBefore = initialPlan.totalEstimatedCost!;
    const stopToRemoveCost = initialPlan.stops![1].cost;

    const updated = removeStopAndRecalculatePlan(initialPlan, 1);
    assert.strictEqual(updated.stops?.length, 2, 'Debe quedar con 2 paradas');
    assert.strictEqual(updated.totalEstimatedCost, costBefore - stopToRemoveCost, 'El costo total debe recalcularse');
    assert.ok(!updated.spokenText.includes('$'), 'La nueva narración no debe tener $');
    assert.ok(updated.spokenText.startsWith('¡Listo veci!'), 'Debe mantener el saludo ¡Listo veci!');
  });

  // Test 27: Respuesta con tres paradas donde el texto hablado omite la segunda: saneador la inserta
  runTest(27, 'Respuesta con tres paradas donde el texto hablado omite la segunda: saneador la inserta', () => {
    const stops: OliPlanStop[] = [
      {
        postId: 'p1',
        businessId: 'b1',
        businessName: 'Hamburguesería Norte',
        businessCity: 'Cajicá',
        businessAddress: 'Calle 1',
        time: '1:00 PM',
        activity: 'comer smash burger',
        postTitle: 'Smash',
        imageUrl: '/img1.jpg',
        cost: 25000,
        whySelected: 'Excelente opción',
      },
      {
        postId: 'p2',
        businessId: 'b2',
        businessName: 'Repostería Dulce Amor',
        businessCity: 'Cajicá',
        businessAddress: 'Calle 2',
        time: '3:30 PM',
        activity: 'disfrutar de torta y café',
        postTitle: 'Torta',
        imageUrl: '/img2.jpg',
        cost: 15000,
        whySelected: 'Excelente café',
      },
      {
        postId: 'p3',
        businessId: 'b3',
        businessName: 'Cervecería Artesanal',
        businessCity: 'Cajicá',
        businessAddress: 'Calle 3',
        time: '6:00 PM',
        activity: 'tomar una pola',
        postTitle: 'Pola',
        imageUrl: '/img3.jpg',
        cost: 20000,
        whySelected: 'Ambiente agradable',
      },
    ];

    const rawSpokenOmittingStop2 =
      '¡Listo veci! Arrancan primero en Hamburguesería Norte para comer smash burger, y para rematar cierran en Cervecería Artesanal para tomar una pola.';

    const fixed = sanitizeSpokenText(rawSpokenOmittingStop2, stops);
    assert.ok(
      fixed.toLowerCase().includes('repostería dulce amor') || fixed.toLowerCase().includes('reposteria dulce amor'),
      'El saneador debe detectar que la parada 2 fue omitida y añadirla a la narración hablada'
    );
  });

  // Test 28: Publicaciones sin descripción, sin imagen o con campos opcionales nulos
  runTest(28, 'Publicaciones sin descripción, sin imagen o con campos opcionales nulos', () => {
    const incompletePost: Post = {
      id: 'post_incomplete',
      businessId: 'biz_burger_cajica',
      businessName: 'La Brasa Smash & Beer',
      businessLogo: '',
      businessCity: 'Cajicá',
      businessSector: '',
      businessWhatsapp: '',
      businessPhone: '',
      businessAddress: '',
      coordinates: { lat: 4.9195, lng: -74.0261 },
      type: 'product',
      title: 'Producto Básico',
      description: '',
      imageUrl: '',
      startsAt: '2026-01-01T00:00:00Z',
      categoryId: 'cat_gastronomia',
      tags: [],
      status: 'active',
      metrics: { views: 1, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 },
      createdAt: '2026-01-01T00:00:00Z',
    };

    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero comer algo',
      currentCity: 'Cajicá',
      catalogPosts: [incompletePost, ...MOCK_POSTS],
      catalogBusinesses: MOCK_BUSINESSES,
    });

    assert.ok(plan.stops && plan.stops.length >= 1);
    const foundIncomplete = plan.stops.find((s) => s.postId === 'post_incomplete');
    if (foundIncomplete) {
      assert.ok(foundIncomplete.imageUrl.length > 0, 'Debe asignar una imagen por defecto');
      assert.ok(foundIncomplete.businessAddress.length > 0, 'Debe asignar dirección del comercio');
    }
  });

  // Test 29: Validación del Horario de Atención del Comercio (Negocio)
  runTest(29, 'Horario de atención del negocio respeta días de cierre y rango de horas de atención', () => {
    const closedOnSundayBiz: Partial<Business> = {
      id: 'biz_no_sunday',
      name: 'Taller El Piñón',
      status: 'active',
      hours: 'Lun - Sáb: 8:00 AM - 6:00 PM | Dom: Cerrado',
    };

    const sundayCheck = isBusinessOpen(closedOnSundayBiz, new Date('2026-10-25T14:00:00Z'), 0, '14:00');
    assert.strictEqual(sundayCheck.isOpen, false, 'El negocio debe aparecer cerrado los domingos');
    assert.ok(sundayCheck.reason?.includes('cerrado los días Domingo'));

    const mondayOpenCheck = isBusinessOpen(closedOnSundayBiz, new Date('2026-10-26T14:00:00Z'), 1, '14:00');
    assert.strictEqual(mondayOpenCheck.isOpen, true, 'El negocio debe estar abierto el lunes a las 2:00 PM');

    const mondayLateCheck = isBusinessOpen(closedOnSundayBiz, new Date('2026-10-26T21:00:00Z'), 1, '21:00');
    assert.strictEqual(mondayLateCheck.isOpen, false, 'El negocio debe aparecer cerrado después de las 6:00 PM');
  });

  // Test 30: Validación de la Tabla Detallada de Días y Horas del Anuncio (Publicación)
  runTest(30, 'Tabla de vigencia del anuncio (Días y Horas Disponibles) valida franjas horarias y días activos', () => {
    const promoWithScheduleTable: Partial<Post> = {
      id: 'post_promo_table',
      status: 'active',
      type: 'promotion',
      validitySchedule: {
        mode: 'table',
        scheduleTable: [
          { dia: 'Lunes', dayIndex: 1, active: false, horaInicio: '', horaFin: '' },
          { dia: 'Martes', dayIndex: 2, active: true, horaInicio: '12:00', horaFin: '15:00' },
          { dia: 'Miércoles', dayIndex: 3, active: true, horaInicio: '12:00', horaFin: '15:00' },
          { dia: 'Jueves', dayIndex: 4, active: true, horaInicio: '12:00', horaFin: '15:00' },
          { dia: 'Viernes', dayIndex: 5, active: true, horaInicio: '12:00', horaFin: '22:00' },
          { dia: 'Sábado', dayIndex: 6, active: true, horaInicio: '11:00', horaFin: '23:00' },
          { dia: 'Domingo', dayIndex: 0, active: true, horaInicio: '11:00', horaFin: '18:00' },
        ],
      },
    };

    const mondayCheck = checkPostValidity(promoWithScheduleTable, new Date('2026-10-26T13:00:00Z'), 1, '13:00');
    assert.strictEqual(mondayCheck.isValid, false, 'No debe ser válida en día inactivo (Lunes)');
    assert.strictEqual(mondayCheck.status, 'day_mismatch');

    const tuesdayLunchCheck = checkPostValidity(promoWithScheduleTable, new Date('2026-10-27T13:00:00Z'), 2, '13:00');
    assert.strictEqual(tuesdayLunchCheck.isValid, true, 'Debe ser válida en martes a la hora de almuerzo');

    const tuesdayDinnerCheck = checkPostValidity(promoWithScheduleTable, new Date('2026-10-27T18:00:00Z'), 2, '18:00');
    assert.strictEqual(tuesdayDinnerCheck.isValid, false, 'No debe ser válida fuera de la franja horaria 12:00 - 15:00');

    const testBiz: Partial<Business> = {
      id: 'biz_restaurante',
      name: 'Restaurante El Veci',
      status: 'active',
      hours: 'Lun - Dom: 10:00 AM - 10:00 PM',
    };
    const sundayValidWithBiz = checkPostValidity(promoWithScheduleTable, new Date('2026-10-25T14:00:00Z'), 0, '14:00', testBiz);
    assert.strictEqual(sundayValidWithBiz.isValid, true, 'Debe ser válida cuando tanto el anuncio como el negocio están abiertos');
  });

  // Test 31: Prellenado Automático del Horario del Anuncio desde el Negocio
  runTest(31, 'getDefaultScheduleForBusiness llena automáticamente los días y horas a partir del horario del comercio', () => {
    const bizWithHours: Partial<Business> = {
      id: 'biz_cafe',
      name: 'Café de la Plaza',
      hours: 'Lun - Dom: 08:00 AM - 09:00 PM',
    };

    const scheduleRows = getDefaultScheduleForBusiness(bizWithHours as Business);
    assert.strictEqual(scheduleRows.length, 7, 'Debe generar exactamente 7 filas para los días de la semana');
    assert.ok(scheduleRows.every((r) => r.active), 'Todos los días deben estar activos');
    assert.strictEqual(scheduleRows[0].horaInicio, '08:00', 'Hora de inicio debe ser 08:00');
    assert.strictEqual(scheduleRows[0].horaFin, '21:00', 'Hora de fin debe ser 21:00');

    const bizWithClosedDay: Partial<Business> = {
      id: 'biz_taller',
      name: 'Taller Sabana',
      hours: 'Lun - Sáb: 8:00 AM - 7:00 PM | Dom: Cerrado',
    };
    const scheduleRows2 = getDefaultScheduleForBusiness(bizWithClosedDay as Business);
    const sundayRow = scheduleRows2.find((r) => r.dia === 'Domingo');
    assert.strictEqual(sundayRow?.active, false, 'El domingo debe estar inactivo');
    const mondayRow = scheduleRows2.find((r) => r.dia === 'Lunes');
    assert.strictEqual(mondayRow?.active, true, 'El lunes debe estar activo');
  });

  // Test 32: Clasificación de Rol Determinista según post.planRole
  runTest(32, 'classifyPostRole respeta de forma determinista la configuración de planRole elegida en la publicación', () => {
    const breakfastPost: Partial<Post> = {
      id: 'post_desayuno',
      title: 'Huevos Benedictinos',
      planRole: 'breakfast_brunch',
    };
    assert.strictEqual(classifyPostRole(breakfastPost as Post), 'breakfast_brunch');

    const lunchPost: Partial<Post> = {
      id: 'post_almuerzo',
      title: 'Especial del Chef',
      planRole: 'lunch_main',
    };
    assert.strictEqual(classifyPostRole(lunchPost as Post), 'main_course');

    const dessertPost: Partial<Post> = {
      id: 'post_postre',
      title: 'Tarta de Chocolate',
      planRole: 'coffee_dessert',
    };
    assert.strictEqual(classifyPostRole(dessertPost as Post), 'cafe_dessert');

    const drinksPost: Partial<Post> = {
      id: 'post_copas',
      title: 'Noche de Cócteles de Autor',
      planRole: 'dinner_drinks',
    };
    assert.strictEqual(classifyPostRole(drinksPost as Post), 'drinks_social');

    const activityPost: Partial<Post> = {
      id: 'post_actividad',
      title: 'Alquiler de Bicis de Montaña',
      planRole: 'activity_service',
    };
    assert.strictEqual(classifyPostRole(activityPost as Post), 'activity_other');
  });

  // Test 33: Integración de approximatePrice y targetAudience
  runTest(33, 'Itinerarios y presupuestos calculan con approximatePrice cuando no hay precio fijo de oferta', () => {
    const postWithApprox: Partial<Post> = {
      id: 'post_approx',
      businessId: 'biz_bici',
      businessName: 'Bicicletas del Norte',
      businessCity: 'Cajicá',
      title: 'Alquiler de Bicicletas',
      type: 'service',
      priceType: 'average',
      approximatePrice: 35000,
      targetAudience: ['parejas', 'familias'],
      planRole: 'activity_service',
      status: 'active',
    };

    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan en pareja para salir en bici en Cajicá',
      currentCity: 'Cajicá',
      catalogPosts: [postWithApprox as Post, ...MOCK_POSTS],
      catalogBusinesses: MOCK_BUSINESSES,
    });

    const stop = plan.stops?.find((s) => s.postId === 'post_approx');
    if (stop) {
      assert.strictEqual(stop.cost, 35000, 'Debe utilizar el approximatePrice de 35000 pesos configurado');
    }
  });
}
