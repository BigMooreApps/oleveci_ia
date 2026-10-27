import assert from 'node:assert';
import { runTest, MOCK_BUSINESSES, MOCK_POSTS } from './testContext';
import {
  extractMunicipality,
  detectSearchIntent,
  normalizeText,
  generateFallbackOliPlan,
} from '../oliAssistant';

export function runSlangSuite() {
  console.log('\n--- SUITE 2: JERGA COLOMBIANA, ERRORES TIPOGRÁFICOS Y MUNICIPIOS (Pruebas 34 a 75) ---');

  // ----------------------------------------------------------------------------
  // Bloque 1: Expresiones Populares y Jerga Sabanera (Pruebas 34 a 45)
  // ----------------------------------------------------------------------------
  runTest(34, 'Jerga colombiana: "un parche melo" se clasifica como plan y no como búsqueda aislada', () => {
    const isSearch = detectSearchIntent('Quiero armar un parche bien melo este sábado');
    assert.strictEqual(isSearch, false, 'Un "parche melo" es un plan de salida, no búsqueda puntual de un local');
  });

  runTest(35, 'Jerga colombiana: "oncesitas de la tarde" identifica intención de café y postre', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Veci, recomiéndeme unas oncesitas ricas con café y algo dulce en Cajicá',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length >= 1);
    const hasCafe = plan.stops.some((s) => s.businessId === 'biz_cafe_cajica');
    assert.strictEqual(hasCafe, true, 'Debe sugerir Café & Trigo para unas oncesitas');
  });

  runTest(36, 'Jerga colombiana: "unas polas pa hablar paja con los panas"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero salir por unas polas pa hablar paja con los panas en la noche',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length >= 1);
    const hasDrinks = plan.stops.some((s) => s.businessId === 'biz_bar_nocturno' || s.businessId === 'biz_burger_cajica');
    assert.strictEqual(hasDrinks, true, 'Debe incluir opciones de cerveza o ambiente social nocturno');
  });

  runTest(37, 'Jerga colombiana: "desenguayabe" para recuperar energía el domingo', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Veci un plan de desenguayabe para comer algo calientito este domingo',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length >= 1);
    assert.ok(plan.spokenText.startsWith('¡Listo veci!'));
  });

  runTest(38, 'Jerga colombiana: "piqueteadero tradicional y carne asada"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero carne asada o comida campesina tipo piqueteadero en Cajicá',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    const hasParrilla = plan.stops?.some((s) => s.businessId === 'biz_parrilla_cajica');
    assert.strictEqual(hasParrilla, true, 'Debe sugerir el Fogón Sabanero');
  });

  runTest(39, 'Jerga colombiana: "plan barateli / tengo poco presupuesto"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Un plan barateli, que no salga tan costoso',
      currentCity: 'Cajicá',
      userBudget: 30000,
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.totalEstimatedCost !== undefined);
    assert.ok(plan.stops && plan.stops.length > 0);
  });

  runTest(40, 'Jerga colombiana: "tengo tres lucas / tengo 40 lucas para armar un parche"', () => {
    const norm = normalizeText('tengo 40 lucas para armar un parche');
    assert.ok(norm.includes('40 lucas'));
    const isSearch = detectSearchIntent('veci tengo 40 lucas para armar un parche');
    assert.strictEqual(isSearch, false);
  });

  runTest(41, 'Jerga colombiana: "plan con la bendición" (clasifica como público familiar con niños)', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Veci qué plan hay para salir con la bendición este sábado por la tarde',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.targetAudience, 'Familiar');
    const hasNightBar = plan.stops?.some((s) => s.businessId === 'biz_bar_nocturno');
    assert.strictEqual(hasNightBar, false, 'No debe llevar a la bendición a un bar');
  });

  runTest(42, 'Jerga colombiana: "plan con la suegra y la familia"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Arma un plan familiar para llevar a la suegra a almorzar rico',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.targetAudience, 'Familiar');
    const hasNightBar = plan.stops?.some((s) => s.businessId === 'biz_bar_nocturno');
    assert.strictEqual(hasNightBar, false);
  });

  runTest(43, 'Jerga colombiana: "plan con la tóxica / con mi pareja"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Un plan romántico para salir con mi novia a cenar y café',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.strictEqual(plan.targetAudience, 'En pareja');
    assert.ok(plan.stops && plan.stops.length >= 2);
  });

  runTest(44, 'Jerga colombiana: "puebliar por la sabana el domingo"', () => {
    const isSearch = detectSearchIntent('Queremos salir a puebliar este domingo');
    assert.strictEqual(isSearch, false, 'Puebliar es una intención clara de plan/recorrido');
  });

  runTest(45, 'Jerga colombiana: "algo pa picar rápido"', () => {
    const plan = generateFallbackOliPlan({
      userPrompt: 'Quiero algo pa picar rico y luego café',
      currentCity: 'Cajicá',
      catalogPosts: MOCK_POSTS,
      catalogBusinesses: MOCK_BUSINESSES,
    });
    assert.ok(plan.stops && plan.stops.length >= 1);
  });

  // ----------------------------------------------------------------------------
  // Bloque 2: Extracción y Normalización de Municipios de Sabana Centro (Pruebas 46 a 60)
  // ----------------------------------------------------------------------------
  runTest(46, 'Extracción de municipio: Cajicá con tilde y sin tilde', () => {
    assert.strictEqual(extractMunicipality('Planes en Cajicá este fin'), 'Cajicá');
    assert.strictEqual(extractMunicipality('Restaurante en cajica centro'), 'Cajicá');
    assert.strictEqual(extractMunicipality('CAJICÁ norte'), 'Cajicá');
  });

  runTest(47, 'Extracción de municipio: Chía con tilde, sin tilde y mayúsculas', () => {
    assert.strictEqual(extractMunicipality('Quiero ir a Chía a cenar'), 'Chía');
    assert.strictEqual(extractMunicipality('vamos para chia'), 'Chía');
    assert.strictEqual(extractMunicipality('CHÍA Valvanera'), 'Chía');
  });

  runTest(48, 'Extracción de municipio: Zipaquirá y abreviatura sabanera "Zipa"', () => {
    assert.strictEqual(extractMunicipality('Almuerzo en Zipaquirá catedral'), 'Zipaquirá');
    assert.strictEqual(extractMunicipality('vamos para zipaquira hoy'), 'Zipaquirá');
    assert.strictEqual(extractMunicipality('un plan en zipa'), 'Zipaquirá');
    assert.strictEqual(extractMunicipality('ZIPAQUIRA'), 'Zipaquirá');
  });

  runTest(49, 'Extracción de municipio: Cota con variantes', () => {
    assert.strictEqual(extractMunicipality('Taller o comida en Cota'), 'Cota');
    assert.strictEqual(extractMunicipality('en cota cundinamarca'), 'Cota');
    assert.strictEqual(extractMunicipality('COTA'), 'Cota');
  });

  runTest(50, 'Extracción de municipio: Sopó con y sin tilde', () => {
    assert.strictEqual(extractMunicipality('Postres en Sopó'), 'Sopó');
    assert.strictEqual(extractMunicipality('vamos a sopo a comer fresas'), 'Sopó');
    assert.strictEqual(extractMunicipality('SOPO'), 'Sopó');
  });

  runTest(51, 'Extracción de municipio: Tabio', () => {
    assert.strictEqual(extractMunicipality('Termales en Tabio'), 'Tabio');
    assert.strictEqual(extractMunicipality('vamos pa tabio'), 'Tabio');
    assert.strictEqual(extractMunicipality('TABIO'), 'Tabio');
  });

  runTest(52, 'Extracción de municipio: Tenjo', () => {
    assert.strictEqual(extractMunicipality('Caminata en Tenjo'), 'Tenjo');
    assert.strictEqual(extractMunicipality('un restaurante campestre en tenjo'), 'Tenjo');
  });

  runTest(53, 'Extracción de municipio: Nemocón', () => {
    assert.strictEqual(extractMunicipality('Visita a Nemocón mina de sal'), 'Nemocón');
    assert.strictEqual(extractMunicipality('plan en nemocon'), 'Nemocón');
  });

  runTest(54, 'Extracción de municipio: Tocancipá', () => {
    assert.strictEqual(extractMunicipality('Autódromo en Tocancipá'), 'Tocancipá');
    assert.strictEqual(extractMunicipality('parque jaime duque en tocancipa'), 'Tocancipá');
  });

  runTest(55, 'Extracción de municipio: Gachancipá', () => {
    assert.strictEqual(extractMunicipality('Restaurante en Gachancipá'), 'Gachancipá');
    assert.strictEqual(extractMunicipality('gachancipa cundinamarca'), 'Gachancipá');
  });

  runTest(56, 'Municipio no mencionado utiliza fallback proporcionado', () => {
    assert.strictEqual(extractMunicipality('Quiero comer pizza', 'Sopó'), 'Sopó');
    assert.strictEqual(extractMunicipality('Recomiéndame una papelería', 'Chía'), 'Chía');
  });

  runTest(57, 'Municipio no mencionado y fallback vacío retorna Cajicá', () => {
    assert.strictEqual(extractMunicipality('Quiero un buen helado', ''), 'Cajicá');
  });

  runTest(58, 'Mención de múltiples municipios toma el primero que hace match', () => {
    const mun = extractMunicipality('¿Es mejor ir a Chía o a Cajicá?');
    assert.ok(mun === 'Chía' || mun === 'Cajicá');
  });

  runTest(59, 'Palabra que contiene "chia" como subcadena no debe disparar falso positivo erróneo', () => {
    const text1 = 'quiero un cafe macchiato';
    const norm = normalizeText(text1);
    const mun = extractMunicipality(norm, 'Cajicá');
    assert.strictEqual(mun, 'Cajicá');
  });

  runTest(60, 'Municipio con signos de interrogación o exclamación alrededor', () => {
    assert.strictEqual(extractMunicipality('¿¿¿Cota???'), 'Cota');
    assert.strictEqual(extractMunicipality('¡¡¡Zipaquirá!!!'), 'Zipaquirá');
  });

  // ----------------------------------------------------------------------------
  // Bloque 3: Errores Tipográficos y Contracciones de Chat Humano (Pruebas 61 a 75)
  // ----------------------------------------------------------------------------
  runTest(61, 'Chat informal: "kiero un plan en chia" detecta Chía y no es búsqueda puntual', () => {
    const prompt = 'kiero un plan en chia para este finde';
    assert.strictEqual(extractMunicipality(prompt), 'Chía');
    assert.strictEqual(detectSearchIntent(prompt), false);
  });

  runTest(62, 'Chat informal: "resstaurante rico y barato en cota"', () => {
    const prompt = 'resstaurante rico y barato en cota';
    assert.strictEqual(extractMunicipality(prompt), 'Cota');
  });

  runTest(63, 'Chat informal: "vamos a cota pa comer postre"', () => {
    const prompt = 'vamos a cota pa comer postre';
    assert.strictEqual(extractMunicipality(prompt), 'Cota');
  });

  runTest(64, 'Chat informal: "q hay pa hacer hoy en cajica"', () => {
    const prompt = 'q hay pa hacer hoy en cajica';
    assert.strictEqual(extractMunicipality(prompt), 'Cajicá');
  });

  runTest(65, 'Chat informal: "alguna cafeteria rica xfa"', () => {
    const isSearch = detectSearchIntent('alguna cafeteria rica xfa');
    assert.strictEqual(isSearch, true);
  });

  runTest(66, 'Chat informal: vocales alargadas "hoolaaa veciiiii"', () => {
    const norm = normalizeText('hoolaaa veciiiii');
    assert.ok(norm.length > 0);
  });

  runTest(67, 'Chat informal: signos de exclamación e interrogación múltiples "hola!!??.. plan??"', () => {
    const norm = normalizeText('hola!!??.. plan??');
    assert.ok(norm.includes('hola') && norm.includes('plan'));
  });

  runTest(68, 'Chat informal: "donde venden hamburguesas" detecta búsqueda gastronómica', () => {
    const isSearch = detectSearchIntent('donde venden hamburguesas en cajica');
    assert.strictEqual(isSearch, true);
  });

  runTest(69, 'Chat informal: "a donde caemos hoy" detecta plan de salida', () => {
    const isSearch = detectSearchIntent('veci a donde caemos hoy con los amigos');
    assert.strictEqual(isSearch, false, '"A donde caemos" es plan de salida');
  });

  runTest(70, 'Chat informal: "tardear en sopo" detecta plan en Sopó', () => {
    const prompt = 'vamos a tardear en sopo este domingo';
    assert.strictEqual(extractMunicipality(prompt), 'Sopó');
    assert.strictEqual(detectSearchIntent(prompt), false, 'Tardear es intención de plan');
  });

  runTest(71, 'Chat informal: "dominguear en familia"', () => {
    const prompt = 'un plan para dominguear en familia por cajica';
    assert.strictEqual(detectSearchIntent(prompt), false, 'Dominguear es plan');
  });

  runTest(72, 'Chat informal: "rumbear el sabado por la noche"', () => {
    const prompt = 'sitio para rumbear este sabado en la noche';
    assert.strictEqual(detectSearchIntent(prompt), false, 'Rumbear es plan nocturno');
  });

  runTest(73, 'Chat informal: "contacto de una veterinaria"', () => {
    const isSearch = detectSearchIntent('el contacto de una veterinaria en cota');
    assert.strictEqual(isSearch, true, 'Contacto de servicio es búsqueda');
  });

  runTest(74, 'Chat informal: "telefono de la papeleria"', () => {
    const isSearch = detectSearchIntent('telefono de la papeleria el estudiante');
    assert.strictEqual(isSearch, true);
  });

  runTest(75, 'Chat informal: "horario de atencion del taller"', () => {
    const isSearch = detectSearchIntent('a que hora abren el taller de cota');
    assert.strictEqual(isSearch, true);
  });
}
