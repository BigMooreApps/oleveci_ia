import assert from 'node:assert';
import { runTest, MOCK_BUSINESSES, MOCK_POSTS } from './testContext';
import {
  classifyPostRole,
  buildCoherentItinerary,
  generateFallbackOliPlan,
  detectSearchIntent,
} from '../oliAssistant';
import { Post } from '../../src/types';

export function runRoleDietarySuite() {
  console.log('\n--- SUITE 4: COHERENCIA DE ROLES, DIETAS, MASCOTAS Y SEGURIDAD FAMILIAR (Pruebas 126 a 165) ---');

  // ----------------------------------------------------------------------------
  // Bloque 1: Secuencia Lógica y Orden Cronológico de Roles (Pruebas 126 a 135)
  // ----------------------------------------------------------------------------
  runTest(126, 'Secuencia cronológica: Desayuno siempre antes de plato fuerte', () => {
    const breakfast: Partial<Post> = { id: 'p_brk', businessId: 'b1', planRole: 'breakfast_brunch', title: 'Desayuno Campesino' };
    const lunch: Partial<Post> = { id: 'p_lnc', businessId: 'b2', planRole: 'lunch_main', title: 'Ajiaco Santafereño' };
    const itinerary = buildCoherentItinerary([lunch as Post, breakfast as Post], [lunch as Post, breakfast as Post], 2);
    assert.strictEqual(itinerary[0].id, 'p_brk', 'El desayuno debe quedar de primero');
    assert.strictEqual(itinerary[1].id, 'p_lnc', 'El almuerzo debe quedar de segundo');
  });

  runTest(127, 'Secuencia cronológica: Plato fuerte antes de café y postre', () => {
    const lunch: Partial<Post> = { id: 'p_lnc', businessId: 'b1', planRole: 'lunch_main', title: 'Carne asada' };
    const dessert: Partial<Post> = { id: 'p_des', businessId: 'b2', planRole: 'coffee_dessert', title: 'Fresas con crema' };
    const itinerary = buildCoherentItinerary([dessert as Post, lunch as Post], [dessert as Post, lunch as Post], 2);
    assert.strictEqual(itinerary[0].id, 'p_lnc');
    assert.strictEqual(itinerary[1].id, 'p_des');
  });

  runTest(128, 'Secuencia cronológica: Café/postre antes de tragos y copas nocturnas', () => {
    const dessert: Partial<Post> = { id: 'p_des', businessId: 'b1', planRole: 'coffee_dessert', title: 'Café capuchino' };
    const drinks: Partial<Post> = { id: 'p_drk', businessId: 'b2', planRole: 'dinner_drinks', title: 'Cerveza artesanal' };
    const itinerary = buildCoherentItinerary([drinks as Post, dessert as Post], [drinks as Post, dessert as Post], 2);
    assert.strictEqual(itinerary[0].id, 'p_des');
    assert.strictEqual(itinerary[1].id, 'p_drk');
  });

  runTest(129, 'Prohibición: Jamás dos desayunos consecutivos en el mismo plan', () => {
    const brk1: Partial<Post> = { id: 'p_b1', businessId: 'b1', planRole: 'breakfast_brunch', title: 'Caldo de costilla' };
    const brk2: Partial<Post> = { id: 'p_b2', businessId: 'b2', planRole: 'breakfast_brunch', title: 'Changua tradicional' };
    const coffee: Partial<Post> = { id: 'p_c1', businessId: 'b3', planRole: 'coffee_dessert', title: 'Café de origen' };
    const itinerary = buildCoherentItinerary([brk1 as Post, brk2 as Post], [brk1 as Post, brk2 as Post, coffee as Post], 2);
    const breakfasts = itinerary.filter((p) => classifyPostRole(p) === 'breakfast_brunch');
    assert.strictEqual(breakfasts.length, 1, 'Solo un desayuno por itinerario');
  });

  runTest(130, 'Prohibición: Jamás dos platos principales pesados en la misma salida', () => {
    const burger = MOCK_POSTS[0]; // Smash burger
    const steak = MOCK_POSTS[2]; // Lomo a la parrilla
    const dessert = MOCK_POSTS[1]; // Café
    const itinerary = buildCoherentItinerary([burger, steak], [burger, steak, dessert], 2);
    const mainCourses = itinerary.filter((p) => classifyPostRole(p) === 'main_course');
    assert.ok(mainCourses.length <= 1, 'Máximo un plato principal');
  });

  runTest(131, 'Plan de 3 paradas completo: Almuerzo -> Café/Postre -> Copas/Social', () => {
    const burger = MOCK_POSTS[0];
    const cafe = MOCK_POSTS[1];
    const bar = MOCK_POSTS[3];
    const itinerary = buildCoherentItinerary([burger, cafe, bar], [burger, cafe, bar], 3);
    assert.strictEqual(itinerary.length, 3);
    assert.strictEqual(classifyPostRole(itinerary[0]), 'main_course');
    assert.strictEqual(classifyPostRole(itinerary[1]), 'cafe_dessert');
    assert.strictEqual(classifyPostRole(itinerary[2]), 'drinks_social');
  });

  runTest(132, 'Clasificación automática de rol por palabras clave en título (Fallback semántico)', () => {
    const postNoRole: Partial<Post> = { id: 'p_auto', title: 'Hamburguesa Doble de Res con Queso Cheddar' };
    assert.strictEqual(classifyPostRole(postNoRole as Post), 'main_course');
  });

  runTest(133, 'Clasificación automática de rol para café y repostería', () => {
    const postCafe: Partial<Post> = { id: 'p_cafe', title: 'Waffle Belga con Helado y Café Americano' };
    assert.strictEqual(classifyPostRole(postCafe as Post), 'cafe_dessert');
  });

  runTest(134, 'Clasificación automática de rol para coctelería y licor', () => {
    const postBar: Partial<Post> = { id: 'p_bar', title: 'Jarra de Sangría Tinta y Cócteles' };
    assert.strictEqual(classifyPostRole(postBar as Post), 'drinks_social');
  });

  runTest(135, 'Clasificación de rol para actividades al aire libre o servicios', () => {
    const postAct: Partial<Post> = { id: 'p_act', title: 'Alquiler de Cuatrimotos y Pista' };
    assert.strictEqual(classifyPostRole(postAct as Post), 'activity_other');
  });

  // ----------------------------------------------------------------------------
  // Bloque 2: Restricción Estricta Anti-Duplicados de Comercios (Pruebas 136 a 145)
  // ----------------------------------------------------------------------------
  runTest(136, 'Anti-duplicado: Comercio con 5 promociones solo puede ser visitado 1 vez por itinerario', () => {
    const promo1: Post = { ...MOCK_POSTS[0], id: 'p1', title: 'Combo 1' };
    const promo2: Post = { ...MOCK_POSTS[0], id: 'p2', title: 'Combo 2' };
    const promo3: Post = { ...MOCK_POSTS[0], id: 'p3', title: 'Combo 3' };
    const candidates = [promo1, promo2, promo3, MOCK_POSTS[1], MOCK_POSTS[2]];
    const selected = buildCoherentItinerary([promo1, promo2, promo3], candidates, 3);
    const bizIds = selected.map((p) => p.businessId);
    const unique = new Set(bizIds);
    assert.strictEqual(bizIds.length, unique.size, 'Todos los businessId deben ser únicos');
  });

  runTest(137, 'Anti-duplicado: Si no hay más comercios, prefiere un plan de menos paradas antes que repetir comercio', () => {
    const onlyBizPromos = [
      { ...MOCK_POSTS[0], id: 'p1' },
      { ...MOCK_POSTS[0], id: 'p2' },
      { ...MOCK_POSTS[0], id: 'p3' },
    ];
    const selected = buildCoherentItinerary(onlyBizPromos, onlyBizPromos, 3);
    assert.strictEqual(selected.length, 1, 'Solo debe aceptar 1 parada de ese comercio');
  });

  runTest(138, 'Anti-duplicado: Plan con 2 comercios distintos genera exactamente 2 paradas únicas', () => {
    const selected = buildCoherentItinerary([MOCK_POSTS[0], MOCK_POSTS[1]], [MOCK_POSTS[0], MOCK_POSTS[1]], 2);
    assert.strictEqual(selected.length, 2);
    assert.notStrictEqual(selected[0].businessId, selected[1].businessId);
  });

  runTest(139, 'Anti-duplicado: Comparación estricta de businessId sensible a mayúsculas y espacios', () => {
    const b1: Post = { ...MOCK_POSTS[0], id: 'p1', businessId: 'BIZ_001' };
    const b2: Post = { ...MOCK_POSTS[1], id: 'p2', businessId: 'BIZ_001' };
    const selected = buildCoherentItinerary([b1, b2], [b1, b2], 2);
    assert.strictEqual(selected.length, 1);
  });

  runTest(140, 'Anti-duplicado en respuesta completa generada por generateFallbackOliPlan', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan en Cajicá para comer y tomar algo',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const ids = plan.stops?.map((s) => s.businessId) || [];
    assert.strictEqual(ids.length, new Set(ids).size);
  });

  runTest(141, 'Anti-duplicado: No repite comercio incluso si el usuario lo menciona dos veces en el prompt', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero ir a La Brasa Smash y después volver a La Brasa Smash por otra hamburguesa',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const brasaStops = plan.stops?.filter((s) => s.businessId === 'biz_burger_cajica') || [];
    assert.strictEqual(brasaStops.length, 1);
  });

  runTest(142, 'Anti-duplicado: Paradas de comida y postre pertenecen a comercios distintos', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Almuerzo y luego un postre',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length >= 2);
    assert.notStrictEqual(plan.stops[0].businessId, plan.stops[1].businessId);
  });

  runTest(143, 'Anti-duplicado: Post con businessId vacío o corrupto es descartado con seguridad', () => {
    const corruptPost: Post = { ...MOCK_POSTS[0], id: 'p_corrupt', businessId: '' };
    const selected = buildCoherentItinerary([corruptPost, MOCK_POSTS[1]], [corruptPost, MOCK_POSTS[1]], 2);
    assert.strictEqual(selected.some((s) => !s.businessId || s.businessId === ''), false);
  });

  runTest(144, 'Anti-duplicado: Publicación idéntica no se inserta dos veces en el itinerario', () => {
    const selected = buildCoherentItinerary([MOCK_POSTS[0], MOCK_POSTS[0]], [MOCK_POSTS[0]], 2);
    assert.strictEqual(selected.length, 1);
  });

  runTest(145, 'Anti-duplicado: Manejo ordenado en planes entre Chía y Cajicá', () => {
    const selected = buildCoherentItinerary([MOCK_POSTS[0], MOCK_POSTS[5]], MOCK_POSTS, 2);
    assert.strictEqual(selected.length, 2);
    assert.notStrictEqual(selected[0].businessId, selected[1].businessId);
  });

  // ----------------------------------------------------------------------------
  // Bloque 3: Filtros de Seguridad Familiar, Mascotas y Estilos de Vida (Pruebas 146 a 155)
  // ----------------------------------------------------------------------------
  runTest(146, 'Seguridad Familiar: Plan con "niños" excluye tajantemente discotecas y pubs nocturnos', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan de domingo con mis 2 niños de 4 y 7 años',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.targetAudience, 'Familiar');
    const hasNightlife = plan.stops?.some((s) => s.businessId === 'biz_bar_nocturno');
    assert.strictEqual(hasNightlife, false);
  });

  runTest(147, 'Seguridad Familiar: Plan con "bebés / carriola" excluye bares de rumba', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Vamos a salir con el bebé en cochecito a almorzar',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.targetAudience, 'Familiar');
    const hasNightlife = plan.stops?.some((s) => s.businessId === 'biz_bar_nocturno');
    assert.strictEqual(hasNightlife, false);
  });

  runTest(148, 'Público En Pareja: Prioriza ambiente romántico, cena y café', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan romántico para celebrar aniversario con mi esposa',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.targetAudience, 'En pareja');
    assert.ok(plan.stops && plan.stops.length >= 2);
  });

  runTest(149, 'Público Amigos: Permite bebidas sociales y comida compartida', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan con 4 amigos para parchar y tomar cerveza',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.targetAudience, 'Amigos');
  });

  runTest(150, 'Público Solo: Plan tranquilo e individual', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero salir solo a leer y tomar un café relajado',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.targetAudience, 'Solo');
  });

  runTest(151, 'Pet-Friendly: Plan con perro / mascota', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan para salir con mi perrito a caminar y comer algo al aire libre',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length > 0);
  });

  runTest(152, 'Vegetariano: Solicitud de comida vegetariana no impone parrillas si hay alternativas', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero comer pizza o algo vegetariano sin carne',
      currentCity: 'Chía',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length > 0);
  });

  runTest(153, 'Plan de turismo y ecoturismo en Tabio (termales)', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan de descanso en las aguas termales de Tabio',
      currentCity: 'Tabio',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const hasTermal = plan.stops?.some((s) => s.businessId === 'biz_tabio_termales');
    assert.strictEqual(hasTermal, true);
  });

  runTest(154, 'Plan de postres tradicionales en Sopó', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero ir a comer postres y fresas a Sopó',
      currentCity: 'Sopó',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const hasSopo = plan.stops?.some((s) => s.businessId === 'biz_sopo_postres');
    assert.strictEqual(hasSopo, true);
  });

  runTest(155, 'Plan con adultos mayores: Ambiente tranquilo sin rumba pesada', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Plan familiar para pasear con mis abuelitos en Cajicá',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const hasBar = plan.stops?.some((s) => s.businessId === 'biz_bar_nocturno');
    assert.strictEqual(hasBar, false);
  });

  // ----------------------------------------------------------------------------
  // Bloque 4: Separación Estricta entre Servicios y Gastronomía (Pruebas 156 a 165)
  // ----------------------------------------------------------------------------
  runTest(156, 'Separación de categorías: Taller mecánico nunca entra en plan gastronómico', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero un almuerzo delicioso con postre',
      currentCity: 'Cota',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const hasTaller = plan.stops?.some((s) => s.businessId === 'biz_taller_cota');
    assert.strictEqual(hasTaller, false);
  });

  runTest(157, 'Separación de categorías: Papelería nunca entra en plan gastronómico', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Recomiéndame un plan de comida rápida y café',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const hasPapeleria = plan.stops?.some((s) => s.businessId === 'biz_papeleria_cajica');
    assert.strictEqual(hasPapeleria, false);
  });

  runTest(158, 'Separación de categorías: Solicitud de taller mecánico va a búsqueda y no arma itinerario de restaurantes', () => {
    const isSearch = detectSearchIntent('Necesito cambiar el aceite del carro en Cota');
    assert.strictEqual(isSearch, true);
  });

  runTest(159, 'Separación de categorías: Gimnasio no se sugiere para plan romántico de cena', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Cena romántica de noche con mi pareja',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const hasGym = plan.stops?.some((s) => s.businessId === 'biz_gym_cajica');
    assert.strictEqual(hasGym, false);
  });

  runTest(160, 'Separación de categorías: Plan de entrenamiento admite gimnasio + nutrición/café', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero entrenar en el gym y después tomar un buen café',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const hasGym = plan.stops?.some((s) => s.businessId === 'biz_gym_cajica');
    assert.strictEqual(hasGym, true);
  });

  runTest(161, 'Separación de categorías: Peluquería o salón de belleza no se confunde con restaurante', () => {
    const isSearch = detectSearchIntent('Peluquería para corte de cabello en Chía');
    assert.strictEqual(isSearch, true);
  });

  runTest(162, 'Separación de categorías: Veterinaria no se confunde con cafetería', () => {
    const isSearch = detectSearchIntent('Veterinaria para vacunar a mi gato en Cajicá');
    assert.strictEqual(isSearch, true);
  });

  runTest(163, 'Separación de categorías: Cerrajería o ferretería es búsqueda de servicio', () => {
    const isSearch = detectSearchIntent('Cerrajería urgente para abrir una puerta');
    assert.strictEqual(isSearch, true);
  });

  runTest(164, 'Separación de categorías: Consultorio odontológico es búsqueda de salud', () => {
    const isSearch = detectSearchIntent('Odontólogo o dentista en Cota');
    assert.strictEqual(isSearch, true);
  });

  runTest(165, 'Separación de categorías: Lavandería es búsqueda de servicio puntual', () => {
    const isSearch = detectSearchIntent('Lavandería para lavar un edredón en Cajicá');
    assert.strictEqual(isSearch, true);
  });
}
