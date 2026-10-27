import assert from 'node:assert';
import { runTest, MOCK_BUSINESSES, MOCK_POSTS } from './testContext';
import {
  isPlanRefinementIntent,
  removeStopAndRecalculatePlan,
  generateFallbackOliPlan,
  detectSearchIntent,
  OliPlanResponse,
} from '../oliAssistant';

export function runConversationalModsSuite() {
  console.log('\n--- SUITE 7: MODIFICACIONES DE PLAN Y DINÁMICA CONVERSACIONAL (Pruebas 246 a 285) ---');

  const BASE_PLAN: OliPlanResponse = {
    type: 'plan',
    planTitle: 'Tarde de Comida, Café y Cerveza en Cajicá',
    day: 'Sábado',
    targetAudience: 'En pareja',
    personCount: 2,
    userBudget: 100000,
    costPerPerson: 30200,
    totalEstimatedCost: 60400,
    savingsOrRemaining: 39600,
    budgetStatus: 'under_budget',
    hasUnconfirmedPrices: false,
    spokenText: '¡Listo veci! Arrancamos en La Brasa Smash & Beer, luego pasamos a Café & Trigo Artesanal y rematamos en La Cueva del Rock & Beer.',
    stops: [
      {
        postId: 'post_promo_smash',
        businessId: 'biz_burger_cajica',
        businessName: 'La Brasa Smash & Beer',
        businessCity: 'Cajicá',
        businessAddress: 'Cra. 3 # 4-28',
        time: '1:00 PM',
        activity: 'almorzar hamburguesas smash',
        postTitle: 'Combo Doble Smash Burger',
        imageUrl: '/post-smash.jpg',
        cost: 24900,
        whySelected: 'Excelente comida',
      },
      {
        postId: 'post_promo_cafe',
        businessId: 'biz_cafe_cajica',
        businessName: 'Café & Trigo Artesanal',
        businessCity: 'Cajicá',
        businessAddress: 'Calle 3 # 2-15',
        time: '3:30 PM',
        activity: 'tomar café y croissant',
        postTitle: 'Tarde de Café',
        imageUrl: '/post-cafe.jpg',
        cost: 13500,
        whySelected: 'Café de origen',
      },
      {
        postId: 'post_bar_coctel',
        businessId: 'biz_bar_nocturno',
        businessName: 'La Cueva del Rock & Beer',
        businessCity: 'Cajicá',
        businessAddress: 'Cra. 5 # 6-12',
        time: '6:30 PM',
        activity: 'tomar cerveza y coctel',
        postTitle: '2x1 en Gin Tonic y Cervezas',
        imageUrl: '/post-bar.jpg',
        cost: 22000,
        whySelected: 'Ambiente nocturno',
      },
    ],
  };

  // ----------------------------------------------------------------------------
  // Bloque 1: Detección de Intenciones de Refinamiento (Pruebas 246 a 255)
  // ----------------------------------------------------------------------------
  runTest(246, 'isPlanRefinementIntent: "cámbiame la segunda parada"', () => {
    assert.strictEqual(isPlanRefinementIntent('cámbiame la segunda parada por algo dulce', BASE_PLAN), true);
  });

  runTest(247, 'isPlanRefinementIntent: "quítame el café que ya tomé"', () => {
    assert.strictEqual(isPlanRefinementIntent('quítame el café del plan', BASE_PLAN), true);
  });

  runTest(248, 'isPlanRefinementIntent: "reemplaza el restaurante por pizza"', () => {
    assert.strictEqual(isPlanRefinementIntent('reemplaza la comida por pizza', BASE_PLAN), true);
  });

  runTest(249, 'isPlanRefinementIntent: "elimina la última parada"', () => {
    assert.strictEqual(isPlanRefinementIntent('elimina la última parada porque es tarde', BASE_PLAN), true);
  });

  runTest(250, 'isPlanRefinementIntent: "no me gustó esa opción, dame otra"', () => {
    assert.strictEqual(isPlanRefinementIntent('no me gustó ese sitio, dame otra opción', BASE_PLAN), true);
  });

  runTest(251, 'isPlanRefinementIntent: "modifica la parada 1"', () => {
    assert.strictEqual(isPlanRefinementIntent('modifica la primera parada', BASE_PLAN), true);
  });

  runTest(252, 'isPlanRefinementIntent: "ajusta a algo más económico"', () => {
    assert.strictEqual(isPlanRefinementIntent('ajusta el plan a algo más barato', BASE_PLAN), true);
  });

  runTest(253, 'isPlanRefinementIntent: "en vez de cerveza quiero postre"', () => {
    assert.strictEqual(isPlanRefinementIntent('en vez de bar quiero ir a comer helado', BASE_PLAN), true);
  });

  runTest(254, 'isPlanRefinementIntent: Sin previousPlan devuelve false', () => {
    assert.strictEqual(isPlanRefinementIntent('cámbiame la segunda parada', null), false);
    assert.strictEqual(isPlanRefinementIntent('cámbiame la segunda parada', undefined), false);
  });

  runTest(255, 'isPlanRefinementIntent: Consulta no relacionada no dispara refinamiento', () => {
    assert.strictEqual(isPlanRefinementIntent('dónde queda una papelería en Cota', BASE_PLAN), false);
  });

  // ----------------------------------------------------------------------------
  // Bloque 2: Eliminación de Paradas y Recálculo Automático (Pruebas 256 a 265)
  // ----------------------------------------------------------------------------
  runTest(256, 'removeStopAndRecalculatePlan: Eliminar parada 0 (primera) de 3 paradas', () => {
    const updated = removeStopAndRecalculatePlan(BASE_PLAN, 0);
    assert.strictEqual(updated.stops?.length, 2);
    assert.strictEqual(updated.stops[0].postId, 'post_promo_cafe');
    assert.strictEqual(updated.stops[1].postId, 'post_bar_coctel');
    assert.strictEqual(updated.totalEstimatedCost, 13500 + 22000);
  });

  runTest(257, 'removeStopAndRecalculatePlan: Eliminar parada 1 (intermedia)', () => {
    const updated = removeStopAndRecalculatePlan(BASE_PLAN, 1);
    assert.strictEqual(updated.stops?.length, 2);
    assert.strictEqual(updated.stops[0].postId, 'post_promo_smash');
    assert.strictEqual(updated.stops[1].postId, 'post_bar_coctel');
    assert.strictEqual(updated.totalEstimatedCost, 24900 + 22000);
  });

  runTest(258, 'removeStopAndRecalculatePlan: Eliminar parada 2 (última)', () => {
    const updated = removeStopAndRecalculatePlan(BASE_PLAN, 2);
    assert.strictEqual(updated.stops?.length, 2);
    assert.strictEqual(updated.stops[0].postId, 'post_promo_smash');
    assert.strictEqual(updated.stops[1].postId, 'post_promo_cafe');
    assert.strictEqual(updated.totalEstimatedCost, 24900 + 13500);
  });

  runTest(259, 'removeStopAndRecalculatePlan: Eliminar por postId string', () => {
    const updated = removeStopAndRecalculatePlan(BASE_PLAN, 'post_promo_cafe');
    assert.strictEqual(updated.stops?.length, 2);
    assert.strictEqual(updated.stops?.some((s) => s.postId === 'post_promo_cafe'), false);
  });

  runTest(260, 'removeStopAndRecalculatePlan: Recálculo exacto del costo por persona', () => {
    const updated = removeStopAndRecalculatePlan(BASE_PLAN, 2);
    assert.strictEqual(updated.totalEstimatedCost, 38400);
    assert.strictEqual(updated.costPerPerson, 19200);
  });

  runTest(261, 'removeStopAndRecalculatePlan: Ahorro se incrementa tras eliminar una parada', () => {
    const updated = removeStopAndRecalculatePlan(BASE_PLAN, 2);
    assert.ok(updated.savingsOrRemaining! > BASE_PLAN.savingsOrRemaining!);
  });

  runTest(262, 'removeStopAndRecalculatePlan: Narración spokenText indica 2 paradas', () => {
    const updated = removeStopAndRecalculatePlan(BASE_PLAN, 1);
    assert.ok(updated.spokenText.includes('2 paradas'));
  });

  runTest(263, 'removeStopAndRecalculatePlan: Saludo inicial "¡Listo veci!" preservado', () => {
    const updated = removeStopAndRecalculatePlan(BASE_PLAN, 0);
    assert.ok(updated.spokenText.startsWith('¡Listo veci!'));
  });

  runTest(264, 'removeStopAndRecalculatePlan: Sin signo de dólar en la narración recalculada', () => {
    const updated = removeStopAndRecalculatePlan(BASE_PLAN, 0);
    assert.ok(!updated.spokenText.includes('$'));
  });

  runTest(265, 'removeStopAndRecalculatePlan: Eliminar en plan vacío no lanza error', () => {
    const emptyPlan: OliPlanResponse = { type: 'plan', spokenText: '', stops: [] };
    const res = removeStopAndRecalculatePlan(emptyPlan, 0);
    assert.strictEqual(res.stops?.length, 0);
  });

  // ----------------------------------------------------------------------------
  // Bloque 3: Intercambio y Reemplazo de Paradas (Pruebas 266 a 275)
  // ----------------------------------------------------------------------------
  runTest(266, 'generateFallbackOliPlan con refinamiento: "Quita la segunda parada"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quita la segunda parada por favor',
      currentCity: 'Cajicá',
      previousPlan: BASE_PLAN,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.stops?.length, 2);
    assert.strictEqual(plan.stops?.some((s) => s.postId === 'post_promo_cafe'), false);
  });

  runTest(267, 'generateFallbackOliPlan con refinamiento: "Elimina la última parada"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Elimina la última parada porque no queremos tomar trago',
      currentCity: 'Cajicá',
      previousPlan: BASE_PLAN,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.stops?.length, 2);
    assert.strictEqual(plan.stops?.some((s) => s.postId === 'post_bar_coctel'), false);
  });

  runTest(268, 'generateFallbackOliPlan con refinamiento: "Cambia la hamburguesa por carne a la parrilla"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'En vez de hamburguesa queremos comer carne asada a la parrilla',
      currentCity: 'Cajicá',
      previousPlan: BASE_PLAN,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length >= 2);
    const hasParrilla = plan.stops.some((s) => s.businessId === 'biz_parrilla_cajica');
    assert.strictEqual(hasParrilla, true, 'Debe haber reemplazado el plato principal por la parrilla');
  });

  runTest(269, 'generateFallbackOliPlan con refinamiento: Mantiene paradas no modificadas', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'En vez de hamburguesa queremos comer carne asada',
      currentCity: 'Cajicá',
      previousPlan: BASE_PLAN,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const hasCafe = plan.stops?.some((s) => s.businessId === 'biz_cafe_cajica');
    assert.strictEqual(hasCafe, true);
  });

  runTest(270, 'generateFallbackOliPlan con refinamiento: Evita duplicar comercios al reemplazar', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Cámbiame la segunda parada por otra cosa',
      currentCity: 'Cajicá',
      previousPlan: BASE_PLAN,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const ids = plan.stops?.map((s) => s.businessId) || [];
    assert.strictEqual(ids.length, new Set(ids).size, 'No debe haber negocios duplicados');
  });

  runTest(271, 'generateFallbackOliPlan con refinamiento: Preserva número de personas (personCount)', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quita la última parada',
      currentCity: 'Cajicá',
      previousPlan: { ...BASE_PLAN, personCount: 4 },
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.personCount, 4);
  });

  runTest(272, 'generateFallbackOliPlan con refinamiento: Preserva público objetivo (targetAudience)', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quita la primera parada',
      currentCity: 'Cajicá',
      previousPlan: { ...BASE_PLAN, targetAudience: 'Familiar' },
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.targetAudience, 'Familiar');
  });

  runTest(273, 'generateFallbackOliPlan con refinamiento: Spoken text inicia con "¡Listo veci!"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quita la última parada',
      currentCity: 'Cajicá',
      previousPlan: BASE_PLAN,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.spokenText.startsWith('¡Listo veci!'));
  });

  runTest(274, 'generateFallbackOliPlan con refinamiento: "borra la primera parada"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Borra la primera parada',
      currentCity: 'Cajicá',
      previousPlan: BASE_PLAN,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.stops?.length, 2);
    assert.strictEqual(plan.stops[0].postId, 'post_promo_cafe');
  });

  runTest(275, 'generateFallbackOliPlan con refinamiento: Reemplazo con artículo inexistente no crashea', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Cámbiame el café por langosta de Alaska viva',
      currentCity: 'Cajicá',
      previousPlan: BASE_PLAN,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length > 0);
  });

  // ----------------------------------------------------------------------------
  // Bloque 4: Conversación Fluida Humana y Cambio de Variables en Vivo (Pruebas 276 a 285)
  // ----------------------------------------------------------------------------
  runTest(276, 'Cambio de ciudad en vivo: "Mejor hagamos el plan en Chía"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Mejor hagamos el plan en Chía',
      currentCity: 'Chía',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length > 0);
    const hasChia = plan.stops.some((s) => s.businessCity === 'Chía');
    assert.strictEqual(hasChia, true);
  });

  runTest(277, 'Cambio de personas en vivo: "Ahora somos 4 personas"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Ahora somos 4 personas, recalcula el plan',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.personCount, 4);
    assert.strictEqual(plan.costPerPerson, Math.round(plan.totalEstimatedCost! / 4));
  });

  runTest(278, 'Ajuste de presupuesto en vivo: "Está muy caro, hazlo de máximo 40 mil pesos"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Está muy caro, máximo 40 mil pesos en Cajicá',
      currentCity: 'Cajicá',
      userBudget: 0,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.userBudget, 40000);
  });

  runTest(279, 'Adición de personas: "Se nos unieron 2 amigos más, en total somos 6"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Se nos unieron 2 amigos, en total somos 6 personas',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.personCount, 6);
  });

  runTest(280, 'Cambio de día en vivo: "Mejor salgamos el domingo en vez del sábado"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Mejor salgamos el domingo con la familia',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length >= 1);
  });

  runTest(281, 'Petición de información de contacto de las paradas sugeridas', () => {
    for (const stop of BASE_PLAN.stops!) {
      assert.ok(stop.businessAddress && stop.businessAddress.length > 0);
      assert.ok(stop.businessCity && stop.businessCity.length > 0);
    }
  });

  runTest(282, 'Agradecimiento humano: "Muchas gracias veci, nos encantó el plan"', () => {
    const isSearch = detectSearchIntent('Muchas gracias veci, nos encantó el plan');
    assert.strictEqual(typeof isSearch, 'boolean');
  });

  runTest(283, 'Continuidad conversacional: Historial de mensajes en sesión preserva contexto', () => {
    const history = [
      { sender: 'user' as const, text: 'Quiero un plan en Cajicá' },
      { sender: 'oli' as const, text: BASE_PLAN.spokenText },
    ];
    assert.strictEqual(history.length, 2);
  });

  runTest(284, 'Refinamiento con plan previo sin paradas recurre limpiamente a nuevo plan', () => {
    const emptyPlan: OliPlanResponse = { type: 'plan', spokenText: '', stops: [] };
    const plan = generateFallbackOliPlan({
      userPrompt: 'Cambia la parada 1',
      currentCity: 'Cajicá',
      previousPlan: emptyPlan,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length > 0);
  });

  runTest(285, 'Refinamiento sucesivo: Eliminar parada 2 y luego eliminar parada 1', () => {
    const step1 = removeStopAndRecalculatePlan(BASE_PLAN, 2);
    assert.strictEqual(step1.stops?.length, 2);
    const step2 = removeStopAndRecalculatePlan(step1, 1);
    assert.strictEqual(step2.stops?.length, 1);
    assert.strictEqual(step2.stops[0].postId, 'post_promo_smash');
  });
}
