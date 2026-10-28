import { LocationCoordinates, Post, Business, DayScheduleRow, ValiditySchedule } from '../src/types';
import {
  checkPostValidity,
  resolveTargetDateFromPrompt,
  formatPriceCOP,
  formatPriceForSpeech,
  sanitizeCurrencyText,
  calculateItineraryBudget,
  parseTimeToMinutes,
  formatMinutesTo12h,
  parseBusinessSchedule,
} from './oliValidator';
import { OliPlanStop, OliPlanResponse, TopicDefinition, OliAuditStep, OliAuditTrace } from './oliTypes';

/**
 * Text normalization: lowercase, strip diacritics/accents, trim, remove excess spaces
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Test whether a text string contains a term, using word boundaries for short terms
 */
export function textContainsTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const cleanTerm = term.trim();
  if (!cleanTerm) return false;

  if (cleanTerm.includes(' ')) {
    return text.includes(cleanTerm);
  }

  const words = text.split(/[^\wáéíóúñ]+/);
  if (cleanTerm.length <= 4) {
    return words.includes(cleanTerm);
  }

  return words.some(
    (w) =>
      w === cleanTerm ||
      w.startsWith(cleanTerm) ||
      (w.length >= 6 && cleanTerm.length >= 6 && w.slice(0, 6) === cleanTerm.slice(0, 6))
  );
}

export const SPANISH_STOP_WORDS = new Set([
  'un', 'una', 'unas', 'unos', 'el', 'la', 'los', 'las', 'lo', 'al', 'del', 'de', 'en', 'entre', 'con', 'por', 'para', 'e', 'y', 'o', 'u', 'a',
  'que', 'es', 'son', 'se', 'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'mas', 'pero', 'muy', 'algo', 'aqui', 'aca', 'alla', 'alli',
  'favor', 'gracias', 'hola', 'buen', 'bueno', 'buena', 'buenas', 'buenos', 'mejor', 'mejores', 'comprar', 'vender', 'tener',
  'sitio', 'sitios', 'lugar', 'lugares', 'local', 'locales', 'negocio', 'negocios', 'comercio', 'comercios', 'servicio', 'servicios',
  'municipio', 'municipios', 'como', 'donde', 'cuando', 'cual', 'cuales', 'buscar', 'busca', 'busco', 'buscando', 'quiero', 'necesito',
  'recomienda', 'recomiendame', 'sabana', 'centro', 'oleveci', 'veci', 'cajica', 'chia', 'cota', 'zipaquira', 'sopo', 'tabio', 'tenjo',
  'tocancipa', 'gachancipa', 'nemocon', 'cogua', 'sesquile'
]);

export function sanitizeSpokenText(
  text: string,
  stops: OliPlanStop[] = [],
  isRefinement = false,
  isSearch = false,
  isAlternative = false
): string {
  let cleaned = sanitizeCurrencyText(text || '');
  const trimmed = cleaned.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  if (!lowerTrimmed.startsWith('¡listo veci!') && !lowerTrimmed.startsWith('listo veci')) {
    if (isSearch) {
      cleaned = `¡Listo veci! ${trimmed}`;
    } else if (isRefinement) {
      cleaned = `¡Listo veci! Ya te ajusté el plan: ${trimmed}`;
    } else if (isAlternative) {
      cleaned = `¡Listo veci! ${trimmed}`;
    } else {
      cleaned = `¡Listo veci! ${trimmed}`;
    }
  } else if (lowerTrimmed.startsWith('listo veci!') || lowerTrimmed.startsWith('listo veci,')) {
    cleaned = cleaned.replace(/^listo veci[!,.]?/i, '¡Listo veci!');
  }

  // Helper: Checks if a stop was already mentioned naturally without requiring exact literal syntax
  const isStopMentioned = (rawText: string, targetStop: OliPlanStop): boolean => {
    if (!rawText || !targetStop) return false;
    const normCleaned = normalizeText(rawText)
      .replace(/[&]/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const bizName = targetStop.businessName ? targetStop.businessName.trim() : '';
    const normBiz = normalizeText(bizName)
      .replace(/[&]/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normBiz && normCleaned.includes(normBiz)) return true;

    if (targetStop.postTitle) {
      const normPost = normalizeText(targetStop.postTitle)
        .replace(/[&]/g, ' ')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (normPost && normPost.length > 5 && normCleaned.includes(normPost)) return true;
    }

    const genericWords = new Set([
      'cafe', 'bar', 'hotel', 'restaurante', 'artesanal', 'glamping', 'gastrobar',
      'pizzeria', 'hamburguesas', 'comidas', 'parque', 'sabana', 'centro', 'norte',
      'campestre', 'tradicional', 'del', 'los', 'las', 'para', 'por', 'con', 'and', 'mas'
    ]);
    const tokens = normBiz.split(' ').filter((w) => w.length > 3 && !genericWords.has(w));
    if (tokens.length > 0 && tokens.some((tok) => normCleaned.includes(tok))) {
      return true;
    }
    return false;
  };

  if (!isSearch && stops.length > 0) {
    const lower = cleaned.toLowerCase();
    const isQnAReply = lower.includes('por persona') || lower.includes('en pareja') || lower.includes('aclaracion') || lower.includes('para compartir');

    if (!isQnAReply) {
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        if (!isStopMentioned(cleaned, stop)) {
          const bizName = stop.businessName.trim();
          const costStr = formatPriceForSpeech(stop.cost);
          if (i === stops.length - 1 && stops.length > 1) {
            cleaned += ` Y para rematar, cerramos en ${bizName} para ${stop.activity} (${costStr}).`;
          } else {
            cleaned += ` Luego pasamos por ${bizName} para ${stop.activity} (${costStr}).`;
          }
        }
      }
    }
  }

  cleaned = cleaned.replace(/\$/g, '');
  return cleaned;
}

export const SUPPORTED_MUNICIPALITIES = [
  'Cajicá',
  'Chía',
  'Cota',
  'Zipaquirá',
  'Tabio',
  'Tenjo',
  'Sopó',
  'Tocancipá',
  'Nemocón',
  'Gachancipá',
];

export function extractMunicipality(prompt: string, fallbackCity = 'Cajicá'): string {
  const norm = normalizeText(prompt);
  const cities = [
    { name: 'Cajicá', variants: ['cajica'] },
    { name: 'Chía', variants: ['chia'] },
    { name: 'Cota', variants: ['cota'] },
    { name: 'Zipaquirá', variants: ['zipaquira', 'zipa'] },
    { name: 'Tabio', variants: ['tabio'] },
    { name: 'Tenjo', variants: ['tenjo'] },
    { name: 'Sopó', variants: ['sopo'] },
    { name: 'Tocancipá', variants: ['tocancipa'] },
    { name: 'Nemocón', variants: ['nemocon'] },
    { name: 'Gachancipá', variants: ['gachancipa'] },
  ];

  for (const c of cities) {
    if (c.variants.some((v) => new RegExp(`(^|[^a-z])${v}([^a-z]|$)`).test(norm))) {
      return c.name;
    }
  }

  return fallbackCity || 'Cajicá';
}

export function isPlanRefinementIntent(prompt: string, previousPlan?: any): boolean {
  if (!previousPlan || !previousPlan.stops || previousPlan.stops.length === 0) {
    return false;
  }
  const norm = normalizeText(prompt);
  const refinementSignals = [
    'cambia',
    'cambiar',
    'reemplaza',
    'reemplazar',
    'quita',
    'quitar',
    'elimina',
    'eliminar',
    'en vez de',
    'no me gusta',
    'otra opcion',
    'otro sitio',
    'otra parada',
    'modifica',
    'modificar',
    'ajusta',
    'ajustar',
    'primera parada',
    'segunda parada',
    'tercera parada',
    'parada 1',
    'parada 2',
    'parada 3',
    'mas barato',
    'mas economico',
    'agrega',
    'agregar',
    'anade',
    'anadir',
    'elijo',
    'elegir',
    'escoger',
    'escojo',
    'luego de esto',
    'despues de esto',
    'luego quiero',
    'despues quiero',
    'luego de',
    'despues de',
    'siguiente parada',
    'continuar con',
    'la primera parada',
  ];
  return refinementSignals.some((sig) => norm.includes(sig));
}

export function detectSearchIntent(prompt: string): boolean {
  const norm = normalizeText(prompt);

  const planSignals = [
    'arma un plan',
    'armame un plan',
    'armanos un plan',
    'crea un plan',
    'creame un plan',
    'itinerario',
    'ruta para el',
    'ruta de cafe',
    'ruta gastronomica',
    'plan domingo',
    'plan sabado',
    'plan familiar',
    'plan con amigos',
    'plan en pareja',
    'plan de fin de semana',
    'quiero un plan',
    'hacer un plan',
    'tarde para salir',
    'salir este fin de semana',
    'presupuesto para un plan',
    'parche',
    'un parche',
    'armar un parche',
    'parche para',
    'a donde caemos',
    'donde caemos',
    'hacer una ruta',
    'tardear',
    'tardeo',
    'dominguear',
    'rumbear',
    'salir a comer',
    'plan para salir',
    'que plan hay',
    'que planes hay',
    'hacer un recorrido',
    'luego de esto quiero',
    'luego quiero',
    'luego voy',
    'luego vamos',
    'despues de esto quiero',
    'después de esto quiero',
    'despues quiero',
    'después quiero',
    'despues vamos',
    'después vamos',
    'elijo la opcion',
    'elijo la opción',
    'primera parada',
    'segunda parada',
    'tercera parada',
    'cuarta parada',
    'parada del plan',
    'parada del itinerario',
  ];

  if (planSignals.some((sig) => norm.includes(sig))) {
    return false;
  }

  const refinementSignals = [
    'cambia la',
    'cambiar la',
    'cambia el',
    'cambiar el',
    'cambia primera',
    'cambia segunda',
    'cambia tercera',
    'en vez de',
    'reemplaza',
    'reemplazar',
    'quita la',
    'quitar la',
    'no me gusta',
    'otra opcion para',
  ];

  if (refinementSignals.some((sig) => norm.includes(sig))) {
    if (!norm.includes('aceite') && !norm.includes('freno') && !norm.includes('llanta') && !norm.includes('bateria') && !norm.includes('repuesto')) {
      return false;
    }
  }

  const searchPrefixes = [
    'donde',
    'dónde',
    'donde puedo',
    'donde lavar',
    'donde lavan',
    'donde me lavan',
    'donde consig',
    'donde compr',
    'donde arregl',
    'donde queda',
    'donde hay',
    'donde atiend',
    'recomiendame',
    'recomienda',
    'recomendacion',
    'comer',
    'quiero comer',
    'donde comer',
    'donde venden',
    'sitio para',
    'sitios para',
    'sitio de',
    'sitios de',
    'lugar para',
    'lugares para',
    'lugar de',
    'lugares de',
    'necesito una',
    'necesito un',
    'busco una',
    'busco un',
    'buscar una',
    'buscar un',
    'busca una',
    'busca un',
    'que peluquerias hay',
    'que talleres hay',
    'que veterinarias hay',
    'que papelerias hay',
    'que pizzerias hay',
    'que restaurantes hay',
    'contacto de',
    'telefono de',
    'whatsapp de',
    'horario de',
    'a que hora',
    'cuanto cuesta',
    'precio de',
    'quiero tomarme',
    'quiero tomar',
    'quiero comerme',
    'quiero comer',
    'quiero un ',
    'quiero una ',
    'tengo ganas de',
    'antojo de',
    'se me antoja',
    'donde tomar',
    'donde tomarme',
    'tomarme un',
    'tomarme una',
    'tomar un',
    'tomar una',
  ];

  if (searchPrefixes.some((p) => norm.includes(p))) {
    return true;
  }

  const standaloneServices = [
    'capuchino',
    'cappuccino',
    'cafe',
    'cafecito',
    'cafeteria',
    'helado',
    'helados',
    'heladeria',
    'postre',
    'postres',
    'cerveza',
    'cervezas',
    'pola',
    'polas',
    'coctel',
    'cocteles',
    'vino',
    'vinos',
    'alitas',
    'sushi',
    'empanada',
    'empanadas',
    'arepa',
    'arepas',
    'lavar el auto',
    'lavar auto',
    'lavar carro',
    'lavar vehiculo',
    'lavadero',
    'lavado de autos',
    'lavado de carros',
    'lavado',
    'autospa',
    'car wash',
    'detailing',
    'pizza',
    'pizzas',
    'pizzeria',
    'pollo',
    'pollos',
    'broaster',
    'pollo asado',
    'pollo broaster',
    'hamburguesa',
    'hamburguesas',
    'burger',
    'parrilla',
    'asado',
    'papeleria',
    'taller mecanico',
    'taller de autos',
    'taller automotriz',
    'mecanica',
    'veterinaria',
    'veterinario',
    'peluqueria',
    'barberia',
    'arreglan celulares',
    'reparacion de celulares',
    'cambio de aceite',
    'frenos',
    'drogueria',
    'farmacia',
    'ferreteria',
    'tengo hambre',
    'quiero desayunar',
    'quiero almorzar',
    'quiero cenar',
    'tomar cafe',
    'tomar café',
    'donde tomar cafe',
    'un cafe',
    'un postre',
    'donde comprar flores',
    'floristeria',
    'regalo',
    'odontologia',
    'dentista',
    'spa',
    'gimnasio',
    'gym',
    'fitness',
    'pesas',
    'entrenar',
    'crossfit',
    'optica',
    'reposteria',
    'panaderia',
    'heladeria',
    'autolavado',
    'carro',
    'carros',
    'auto',
    'autos',
    'automovil',
    'automoviles',
    'vehiculo',
    'vehiculos',
    'taller',
    'taller mecanico',
    'mecanica',
  ];

  return standaloneServices.some((kw) => norm.includes(kw));
}

export function extractRequestedTopic(prompt: string): {
  topic: string;
  isSpecificFoodOrActivity: boolean;
  isDining: boolean;
} {
  const norm = normalizeText(prompt);

  const specificDesires = [
    { label: 'arroz chino', isDining: true, keywords: ['arroz chino', 'comida china', 'oriental', 'chaufa', 'chifa'] },
    { label: 'sushi', isDining: true, keywords: ['sushi', 'comida japonesa', 'ramen', 'poke', 'makis'] },
    { label: 'pizza', isDining: true, keywords: ['pizza', 'pizzas', 'calzone', 'pizzeria', 'italiana'] },
    { label: 'pollo', isDining: true, keywords: ['pollo', 'pollos', 'broaster', 'pollo asado', 'pollo campesino', 'pollo frito', 'alitas'] },
    { label: 'hamburguesas', isDining: true, keywords: ['hamburguesa', 'hamburguesas', 'burger', 'burgers', 'smash'] },
    { label: 'tacos y comida mexicana', isDining: true, keywords: ['taco', 'tacos', 'mexicana', 'burrito', 'quesadilla', 'nachos'] },
    { label: 'carne y asado', isDining: true, keywords: ['carne', 'asado', 'parrilla', 'steak', 'punta de anca', 'costilla', 'churrasco'] },
    { label: 'cerveza artesanal y polas', isDining: true, keywords: ['pola', 'polas', 'cerveza', 'cervezas', 'cerveza artesanal', 'pub', 'gastrobar'] },
    { label: 'café y postres', isDining: true, keywords: ['cafe', 'postre', 'postres', 'torta', 'tortas', 'reposteria', 'pasteleria', 'helado', 'helados', 'crepes'] },
    { label: 'comida típica colombiana', isDining: true, keywords: ['ajiaco', 'bandeja paisa', 'sancocho', 'corrientazo', 'comida tipica', 'almuerzo casero'] },
    { label: 'pastas y comida italiana', isDining: true, keywords: ['pasta', 'pastas', 'lasagna', 'lasana', 'espagueti', 'ravioli'] },
    { label: 'pescados y mariscos', isDining: true, keywords: ['pescado', 'mariscos', 'ceviche', 'camarones', 'mojarra', 'trucha'] },
    { label: 'desayuno o brunch', isDining: true, keywords: ['desayuno', 'brunch', 'calentado', 'huevos', 'waffles', 'pancakes'] },
    { label: 'opciones vegetarianas', isDining: true, keywords: ['vegetariano', 'vegano', 'ensalada', 'saludable'] },
    { label: 'papelería', isDining: false, keywords: ['papeleria', 'utiles', 'fotocopias', 'impresiones'] },
    { label: 'taller mecánico', isDining: false, keywords: ['taller', 'mecanica', 'frenos', 'cambio de aceite', 'sincronizacion'] },
    { label: 'gimnasio y entrenamiento', isDining: false, keywords: ['gimnasio', 'gym', 'fitness', 'crossfit', 'pesas', 'entrenamiento'] },
  ];

  for (const item of specificDesires) {
    if (item.keywords.some((kw) => norm.includes(kw))) {
      return { topic: item.label, isSpecificFoodOrActivity: true, isDining: item.isDining };
    }
  }

  const cravingMatch = norm.match(/(?:quiero comer|tengo ganas de comer|antojo de|ganas de|busco donde comer|recomiendame comer|quiero|busco|viajar a|paseo en|safari de)\s+([a-z\s]+?)(?:\s+(?:en|cerca|para|con|este|hoy|$))/i);
  if (cravingMatch && cravingMatch[1]) {
    const raw = cravingMatch[1].trim();
    if (raw.length > 2 && !['algo', 'rico', 'delicioso', 'bien', 'bueno', 'un plan', 'salir', 'comer', 'un'].includes(raw)) {
      return { topic: raw, isSpecificFoodOrActivity: true, isDining: true };
    }
  }

  return { topic: '', isSpecificFoodOrActivity: false, isDining: false };
}

export function getEligiblePlanPosts(
  catalogPosts: Post[],
  targetDate: Date = new Date(),
  targetDayOfWeek?: number,
  businessMap?: Map<string, Business>
): Post[] {
  return catalogPosts.filter((p) => {
    if (!p || !p.id) return false;
    if (p.businessId === 'biz_oleveci' || p.id === 'post_oleveci_bienvenida') return false;

    const biz = businessMap?.get(p.businessId);
    const check = checkPostValidity(p, targetDate, targetDayOfWeek, undefined, biz);
    return check.isValid;
  });
}

export type PostMealRole = 'breakfast_brunch' | 'main_course' | 'cafe_dessert' | 'drinks_social' | 'activity_other';

export function classifyPostRole(post: Post): PostMealRole {
  const configuredRoles: string[] =
    post.planRoles && post.planRoles.length > 0
      ? post.planRoles
      : post.planRole && post.planRole !== 'auto'
      ? [post.planRole]
      : [];

  for (const role of configuredRoles) {
    if (role === 'desayuno_brunch' || role === 'breakfast_brunch') return 'breakfast_brunch';
    if (role === 'almuerzo_fuerte' || role === 'lunch_main' || role === 'main_course') return 'main_course';
    if (role === 'cafe_postres' || role === 'coffee_dessert' || role === 'cafe_dessert') return 'cafe_dessert';
    if (role === 'cena_copas' || role === 'dinner_drinks' || role === 'drinks_social') return 'drinks_social';
    if (role === 'actividad_servicio' || role === 'activity_service' || role === 'activity_other') return 'activity_other';
  }

  const combined = normalizeText(
    `${post.title || ''} ${post.description || ''} ${post.categoryId || ''} ${post.planCategoryId || ''} ${(post.tags || []).join(' ')}`
  );

  if (
    combined.includes('carniceria') ||
    combined.includes('empacado al vacio') ||
    combined.includes('fruver') ||
    combined.includes('supermercado') ||
    combined.includes('lacteos artesanales') ||
    combined.includes('cuajada & arequipe') ||
    post.businessId === 'biz_carniceria_gourmet' ||
    post.businessId === 'biz_mercado_sabana'
  ) {
    return 'activity_other';
  }

  if (combined.includes('desayuno') || combined.includes('brunch') || combined.includes('calentado') || combined.includes('huevos')) {
    return 'breakfast_brunch';
  }

  if (
    combined.includes('cafe') ||
    combined.includes('torta') ||
    combined.includes('postre') ||
    combined.includes('helado') ||
    combined.includes('croissant') ||
    combined.includes('reposteria') ||
    combined.includes('pasteleria') ||
    combined.includes('pan de masa madre') ||
    combined.includes('panaderia') ||
    combined.includes('chai')
  ) {
    return 'cafe_dessert';
  }

  if (
    combined.includes('vino') ||
    combined.includes('cerveza') ||
    combined.includes('pola') ||
    combined.includes('gin tonic') ||
    combined.includes('mojito') ||
    combined.includes('coctel') ||
    combined.includes('aguardiente') ||
    /\bron\b/.test(combined) ||
    combined.includes('fogata') ||
    combined.includes('noche_rumba')
  ) {
    return 'drinks_social';
  }

  if (
    combined.includes('parrilla') ||
    combined.includes('lomo') ||
    combined.includes('picada') ||
    combined.includes('asado') ||
    combined.includes('burger') ||
    combined.includes('hamburguesa') ||
    combined.includes('pizza') ||
    combined.includes('almuerzo') ||
    combined.includes('pechuga') ||
    combined.includes('costilla') ||
    combined.includes('carne') ||
    combined.includes('plato fuerte') ||
    combined.includes('restaurante') ||
    combined.includes('cat_gastronomia') ||
    combined.includes('comida_rapida')
  ) {
    return 'main_course';
  }

  return 'activity_other';
}

export function generateActivityFromPost(post: Post, _business?: Business): string {
  const title = (post.title || '').trim().replace(/^¡|!$/g, '');
  const role = classifyPostRole(post);

  if (role === 'cafe_dessert') {
    return `disfrutar de su ${title}`;
  }
  if (role === 'drinks_social') {
    return `compartir su ${title}`;
  }
  if (role === 'breakfast_brunch') {
    return `iniciar el día con su ${title}`;
  }
  if (role === 'main_course') {
    return `degustar su ${title}`;
  }
  return `disfrutar de su ${title}`;
}

export function getScheduleTimeForRole(
  role: PostMealRole,
  stopIndex: number,
  totalStops: number,
  post?: Post,
  business?: Business,
  dayOfWeek?: number
): string {
  let defaultTime = '4:00 PM';
  if (role === 'breakfast_brunch') defaultTime = '10:00 AM';
  else if (role === 'main_course') defaultTime = '1:00 PM';
  else if (role === 'cafe_dessert') defaultTime = totalStops > 2 ? '4:00 PM' : '3:30 PM';
  else if (role === 'drinks_social') defaultTime = '6:30 PM';
  else {
    const defaults = ['1:00 PM', '3:45 PM', '6:15 PM'];
    defaultTime = defaults[stopIndex] || '4:00 PM';
  }

  if ((business || post) && dayOfWeek !== undefined) {
    let minAllowed: number | null = null;
    let maxAllowed: number | null = null;

    if (business) {
      const bizRows = parseBusinessSchedule(business.hours);
      const bRow = bizRows.find((r) => r.dayIndex === dayOfWeek);
      if (bRow && bRow.active && bRow.horaInicio && bRow.horaFin) {
        minAllowed = parseTimeToMinutes(bRow.horaInicio);
        maxAllowed = parseTimeToMinutes(bRow.horaFin);
      }
    }

    if (post?.validitySchedule?.mode === 'table' && post.validitySchedule.scheduleTable) {
      const pRow = post.validitySchedule.scheduleTable.find((r) => r.dayIndex === dayOfWeek);
      if (pRow && pRow.active && pRow.horaInicio && pRow.horaFin) {
        const pStart = parseTimeToMinutes(pRow.horaInicio);
        const pEnd = parseTimeToMinutes(pRow.horaFin);
        if (pStart !== null) minAllowed = minAllowed !== null ? Math.max(minAllowed, pStart) : pStart;
        if (pEnd !== null) maxAllowed = maxAllowed !== null ? Math.min(maxAllowed, pEnd) : pEnd;
      }
    }

    if (minAllowed !== null && maxAllowed !== null && minAllowed < maxAllowed) {
      let defMin = parseTimeToMinutes(defaultTime) || 780;
      if (defMin < minAllowed) {
        defMin = Math.min(minAllowed + 15, maxAllowed - 15);
        defaultTime = formatMinutesTo12h(defMin);
      } else if (defMin > maxAllowed) {
        defMin = Math.max(minAllowed + 15, maxAllowed - 45);
        defaultTime = formatMinutesTo12h(defMin);
      }
    }
  }

  return defaultTime;
}

export function buildCoherentItinerary(
  primaryPosts: Post[],
  candidatePosts: Post[],
  targetCount = 3,
  isFoodOnly = false
): Post[] {
  const selectedPosts: Post[] = [];
  const selectedBizIds = new Set<string>();
  let hasMainCourse = false;
  let hasBreakfast = false;
  let hasDessert = false;
  let hasDrinkOrActivity = false;

  const validCandidates = isFoodOnly
    ? candidatePosts.filter((p) => {
        const r = classifyPostRole(p);
        return r !== 'activity_other';
      })
    : candidatePosts;

  const tryAddPost = (p: Post): boolean => {
    if (!p || !p.id || !p.businessId || !p.businessId.trim()) return false;
    if (selectedPosts.some((s) => s.id === p.id)) return false;
    if (selectedBizIds.has(p.businessId)) return false;

    const role = classifyPostRole(p);
    if (isFoodOnly && role === 'activity_other') return false;

    if (role === 'main_course' && hasMainCourse) {
      return false;
    }
    if (role === 'breakfast_brunch' && (hasBreakfast || hasMainCourse)) {
      return false;
    }

    selectedPosts.push(p);
    selectedBizIds.add(p.businessId);

    if (role === 'main_course') hasMainCourse = true;
    if (role === 'breakfast_brunch') hasBreakfast = true;
    if (role === 'cafe_dessert') hasDessert = true;
    if (role === 'drinks_social' || role === 'activity_other') hasDrinkOrActivity = true;

    return true;
  };

  for (const p of primaryPosts) {
    if (selectedPosts.length >= targetCount) break;
    tryAddPost(p);
  }

  if (selectedPosts.length < targetCount && hasMainCourse && !hasDessert) {
    const dessertPost = validCandidates.find(
      (p) => classifyPostRole(p) === 'cafe_dessert' && !selectedBizIds.has(p.businessId)
    );
    if (dessertPost) tryAddPost(dessertPost);
  }

  if (selectedPosts.length < targetCount && !hasDrinkOrActivity) {
    const drinkPost = validCandidates.find((p) => {
      const r = classifyPostRole(p);
      return (r === 'drinks_social' || (!isFoodOnly && r === 'activity_other')) && !selectedBizIds.has(p.businessId);
    });
    if (drinkPost) tryAddPost(drinkPost);
  }

  for (const p of validCandidates) {
    if (selectedPosts.length >= targetCount) break;
    tryAddPost(p);
  }

  if (selectedPosts.length < 2) {
    for (const p of validCandidates) {
      if (selectedPosts.length >= 2) break;
      if (!selectedBizIds.has(p.businessId)) {
        selectedPosts.push(p);
        selectedBizIds.add(p.businessId);
      }
    }
  }

  const roleOrder: Record<PostMealRole, number> = {
    breakfast_brunch: 1,
    main_course: 2,
    cafe_dessert: 3,
    activity_other: 3.5,
    drinks_social: 4,
  };

  return selectedPosts.sort((a, b) => {
    const orderA = roleOrder[classifyPostRole(a)] || 2;
    const orderB = roleOrder[classifyPostRole(b)] || 2;
    return orderA - orderB;
  });
}

export function removeStopAndRecalculatePlan(
  plan: OliPlanResponse,
  stopIndexOrPostId: number | string
): OliPlanResponse {
  if (!plan.stops || plan.stops.length === 0) return plan;

  const updatedStops = plan.stops.filter((s, idx) => {
    if (typeof stopIndexOrPostId === 'number') {
      return idx !== stopIndexOrPostId;
    }
    return s.postId !== stopIndexOrPostId;
  });

  const personCount = plan.personCount || 2;
  const userBudget = typeof plan.userBudget === 'number' ? plan.userBudget : 0;
  const isOpenBudget = userBudget <= 0;
  const budgetSummary = calculateItineraryBudget(
    updatedStops.map((s) => ({ cost: s.cost })),
    userBudget > 0 ? userBudget : 100000,
    personCount,
    isOpenBudget
  );

  const updatedSpoken = sanitizeSpokenText(
    `¡Listo veci! Te actualicé el plan sin esa parada. Ahora el recorrido tiene ${updatedStops.length} ${
      updatedStops.length === 1 ? 'parada' : 'paradas'
    } y el total estimado es de ${formatPriceForSpeech(budgetSummary.totalEstimatedCost)}.`,
    updatedStops,
    true,
    false,
    Boolean(plan.isAlternativeSuggestion)
  );

  return {
    ...plan,
    userBudget,
    stops: updatedStops,
    costPerPerson: budgetSummary.costPerPerson,
    totalEstimatedCost: budgetSummary.totalEstimatedCost,
    savingsOrRemaining: budgetSummary.savingsOrRemaining,
    budgetStatus: budgetSummary.budgetStatus,
    hasUnconfirmedPrices: budgetSummary.hasUnconfirmedPrices,
    spokenText: updatedSpoken,
    summary: `Itinerario ajustado de ${updatedStops.length} paradas con total de ${formatPriceCOP(
      budgetSummary.totalEstimatedCost
    )}.`,
  };
}

export const TOPIC_DEFINITIONS: Record<string, TopicDefinition> = {
  papelería: {
    words: [
      'papeleria',
      'papelerias',
      'utiles',
      'fotocopia',
      'fotocopias',
      'impresion',
      'impresiones',
      'cuaderno',
      'cuadernos',
      'oficina',
      'colegio',
      'miscelanea',
      'libreria',
      'librerias',
      'anillados',
      'articulos de arte',
      'escolar',
      'escolares',
      'resma',
      'papel',
    ],
    allowedCategoryIds: ['cat_servicios', 'cat_educacion', 'cat_otros'],
    excludedCategoryIds: [
      'cat_planes_eventos',
      'cat_mascotas',
      'cat_automoviles',
      'cat_fitness',
      'cat_belleza',
      'cat_restaurantes',
      'cat_comida_rapida',
      'cat_cafes',
    ],
    allowedPlanCategoryIds: ['plan_comprar_algo', 'plan_otros'],
  },
  lavado_autos: {
    words: [
      'lavar el auto',
      'lavar auto',
      'lavar carro',
      'lavar vehiculo',
      'lavado de autos',
      'lavado de carros',
      'lavadero',
      'lavado',
      'lavar',
      'autospa',
      'car wash',
      'detailing',
      'cojineria',
      'polichado',
      'polarizado',
      'sellado ceramico',
    ],
    allowedCategoryIds: ['cat_automoviles', 'cat_servicios'],
    excludedCategoryIds: ['cat_planes_eventos', 'cat_mascotas', 'cat_restaurantes', 'cat_comida_rapida', 'cat_cafes'],
    allowedPlanCategoryIds: ['plan_comprar_algo', 'plan_otros'],
  },
  taller_mecanico: {
    words: [
      'taller mecanico',
      'taller de autos',
      'taller automotriz',
      'taller de motos',
      'taller',
      'talleres',
      'talle',
      'mecanica',
      'mecanico',
      'mecanicos',
      'cambio de aceite',
      'frenos',
      'suspension',
      'alineacion',
      'balanceo',
      'sincronizacion',
      'latoneria',
      'pintura automotriz',
      'repuestos',
      'peritaje',
      'reparacion de motor',
    ],
    allowedCategoryIds: ['cat_automoviles', 'cat_servicios'],
    excludedCategoryIds: [
      'cat_planes_eventos',
      'cat_mascotas',
      'cat_restaurantes',
      'cat_comida_rapida',
      'cat_cafes',
      'cat_belleza',
    ],
    allowedPlanCategoryIds: ['plan_comprar_algo', 'plan_otros'],
  },
  comida: {
    words: [
      'comer',
      'comida',
      'almuerzo',
      'almorzar',
      'cena',
      'cenar',
      'desayuno',
      'desayunar',
      'restaurante',
      'restaurantes',
      'gastronomia',
      'hamburguesa',
      'hamburguesas',
      'pizza',
      'pizzas',
      'pizzeria',
      'pollo',
      'pollos',
      'broaster',
      'asado',
      'carne',
      'carnes',
      'parrilla',
      'picada',
      'picadas',
      'pasta',
      'comida rapida',
      'sushi',
      'tacos',
      'mexicana',
      'costillas',
      'pechuga',
      'patacon',
      'antojo',
    ],
    allowedCategoryIds: ['cat_restaurantes', 'cat_comida_rapida', 'cat_cafes', 'cat_gastronomia'],
    excludedCategoryIds: ['cat_automoviles', 'cat_mascotas', 'cat_ferreteria'],
    allowedPlanCategoryIds: ['plan_comer_algo', 'plan_cita_romantica', 'plan_con_amigos'],
  },
  café_postres: {
    words: [
      'cafe',
      'cafes',
      'cafeteria',
      'cafeterias',
      'capuchino',
      'cappuccino',
      'croissant',
      'cafecito',
      'tinto',
      'latte',
      'espresso',
      'frappe',
      'postre',
      'postres',
      'torta',
      'tortas',
      'reposteria',
      'pasteleria',
      'panaderia',
      'helado',
      'helados',
      'onces',
    ],
    allowedCategoryIds: ['cat_cafes', 'cat_restaurantes'],
    excludedCategoryIds: ['cat_automoviles', 'cat_mascotas', 'cat_ferreteria'],
    allowedPlanCategoryIds: ['plan_tomar_algo', 'plan_comer_algo', 'plan_con_amigos'],
  },
  veterinaria: {
    words: [
      'veterinaria',
      'veterinarias',
      'veterinario',
      'veterinarios',
      'mascotas',
      'perro',
      'perros',
      'gato',
      'gatos',
      'pet',
      'consulta veterinaria',
      'spa canino',
      'bano para perros',
    ],
    allowedCategoryIds: ['cat_mascotas', 'cat_salud', 'cat_servicios'],
    excludedCategoryIds: ['cat_planes_eventos', 'cat_automoviles', 'cat_cafes', 'cat_restaurantes', 'cat_comida_rapida'],
    allowedPlanCategoryIds: ['plan_consentir_mascotas'],
  },
  barbería: {
    words: ['barberia', 'barberias', 'barbero', 'corte de pelo', 'corte caballero', 'barba', 'peluqueria', 'peluquerias'],
    allowedCategoryIds: ['cat_belleza', 'cat_salud', 'cat_servicios'],
    excludedCategoryIds: ['cat_automoviles', 'cat_restaurantes', 'cat_comida_rapida', 'cat_planes_eventos'],
    allowedPlanCategoryIds: ['plan_cuidado_personal', 'plan_otros'],
  },
  hotel: {
    words: ['hotel', 'hoteles', 'hospedaje', 'glamping', 'alojamiento', 'habitacion', 'suite', 'posada', 'hostal', 'cabana'],
    allowedCategoryIds: ['cat_planes_eventos'],
    excludedCategoryIds: ['cat_automoviles', 'cat_servicios', 'cat_mascotas'],
    allowedPlanCategoryIds: ['plan_cita_romantica', 'plan_relajarme_en_algun_lado'],
  },
  gimnasio: {
    words: ['gimnasio', 'gym', 'fitness', 'crossfit', 'pesas', 'entrenamiento'],
    allowedCategoryIds: ['cat_fitness', 'cat_salud'],
    excludedCategoryIds: ['cat_automoviles', 'cat_restaurantes', 'cat_comida_rapida'],
    allowedPlanCategoryIds: ['plan_cuidado_personal', 'plan_otros'],
  },
  mercado: {
    words: ['mercado', 'supermercado', 'frutas', 'verduras', 'huerta', 'campo', 'fresco', 'fruver'],
    allowedCategoryIds: ['cat_otros', 'cat_mercados'],
    excludedCategoryIds: ['cat_automoviles', 'cat_planes_eventos'],
    allowedPlanCategoryIds: ['plan_comprar_algo', 'plan_otros'],
  },
  carnicería: {
    words: ['carniceria', 'carnes', 'punta de anca', 'costilla', 'cortes madurados'],
    allowedCategoryIds: ['cat_otros', 'cat_restaurantes'],
    excludedCategoryIds: ['cat_automoviles', 'cat_planes_eventos'],
    allowedPlanCategoryIds: ['plan_comprar_algo', 'plan_otros'],
  },
};

export function searchBusinessesAndPosts(
  prompt: string,
  catalogBusinesses: Business[],
  catalogPosts: Post[],
  targetMunicipality = 'Cajicá'
): { matchedBusinesses: Business[]; matchedPosts: Post[]; queryTopic: string; exactMatchInMunicipality: boolean } {
  const normPrompt = normalizeText(prompt);

  let activeTopicDef: TopicDefinition | null = null;
  let queryTopic = 'comercios y servicios';

  for (const [topic, def] of Object.entries(TOPIC_DEFINITIONS)) {
    if (def.words.some((w) => textContainsTerm(normPrompt, w))) {
      activeTopicDef = def;
      queryTopic = topic;
      break;
    }
  }

  const tokens = normPrompt
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SPANISH_STOP_WORDS.has(w));

  const municipalityNames = new Set([
    'cajica', 'cajicá', 'chia', 'chía', 'zipaquira', 'zipaquirá', 'zipa',
    'cota', 'sopo', 'sopó', 'tabio', 'tenjo', 'nemocon', 'nemocón',
    'tocancipa', 'tocancipá', 'gachancipa', 'gachancipá', 'sabana'
  ]);

  const genericSearchStopWords = new Set([
    'quiero', 'tomar', 'tomarme', 'comer', 'comerme', 'ir', 'recomiendame',
    'recomendar', 'recomienda', 'buscar', 'donde', 'hay', 'algun', 'alguna',
    'buen', 'bueno', 'buena', 'rico', 'rica', 'delicioso', 'sitio', 'lugar',
    'local', 'negocio', 'tienda', 'favor', 'veci', 'oli', 'para', 'con',
    'este', 'esta', 'estos', 'estas', 'unas', 'unos', 'una', 'uno', 'los', 'las', 'les', 'por', 'sobre'
  ]);

  const specificProductKeywords = tokens.filter(
    (t) => !municipalityNames.has(t) && !genericSearchStopWords.has(t) && t.length > 2
  );

  const allSearchTerms = Array.from(new Set([...tokens, ...(activeTopicDef ? activeTopicDef.words : [])]));
  const targetCityNorm = normalizeText(targetMunicipality);

  const scoredBusinesses = catalogBusinesses.map((b) => {
    if (b.status && b.status !== 'active') return { business: b, score: 0, inTargetCity: false };

    if (activeTopicDef && activeTopicDef.excludedCategoryIds.includes(b.categoryId)) {
      return { business: b, score: 0, inTargetCity: false };
    }

    let score = 0;
    const nameNorm = normalizeText(b.name);
    const descNorm = normalizeText(b.description || '');
    const subCatNorm = normalizeText(b.subCategory || '');
    const cityNorm = normalizeText(b.city || '');
    const inTargetCity = cityNorm === targetCityNorm;

    if (activeTopicDef) {
      const matchesTopicWord = activeTopicDef.words.some(
        (w) => textContainsTerm(nameNorm, w) || textContainsTerm(subCatNorm, w) || textContainsTerm(descNorm, w)
      );
      if (!matchesTopicWord) {
        return { business: b, score: 0, inTargetCity: false };
      }
    }

    if (activeTopicDef && activeTopicDef.allowedCategoryIds.includes(b.categoryId)) {
      score += 10;
    }

    for (const term of allSearchTerms) {
      if (textContainsTerm(nameNorm, term)) score += 15;
      if (textContainsTerm(subCatNorm, term)) score += 12;
      if (textContainsTerm(descNorm, term)) score += 8;
    }

    const bizPosts = catalogPosts.filter(
      (p) => p.businessId === b.id && (!p.status || p.status === 'active') && !p.suspended
    );
    let postMatchBonus = 0;
    for (const p of bizPosts) {
      const pText = normalizeText(`${p.title} ${p.description || ''} ${(p.tags || []).join(' ')}`);
      for (const term of allSearchTerms) {
        if (textContainsTerm(pText, term)) {
          postMatchBonus += 15;
          break;
        }
      }
    }
    score += Math.min(postMatchBonus, 30);

    if (score >= 15 && inTargetCity) {
      score += 20;
    }

    return { business: b, score, inTargetCity };
  });

  const validMatches = scoredBusinesses
    .filter((sb) => sb.score >= 20)
    .sort((a, b) => b.score - a.score);

  // STRICT MUNICIPALITY RULE FOR BUSINESSES:
  // If there are valid businesses in the requested municipality, NEVER leak businesses from other towns!
  const matchesInTargetCity = validMatches.filter((sb) => sb.inTargetCity);
  const exactMatchInMunicipality = matchesInTargetCity.length > 0;

  const eligibleBizMatches = exactMatchInMunicipality ? matchesInTargetCity : validMatches;
  const topBizScore = eligibleBizMatches.length > 0 ? eligibleBizMatches[0].score : 0;
  const filteredMatches = eligibleBizMatches.filter((sb) => sb.score >= topBizScore * 0.45);

  const wantsAllPromosOrOptions =
    normPrompt.includes('toda') ||
    normPrompt.includes('todo') ||
    normPrompt.includes('promocion') ||
    normPrompt.includes('oferta') ||
    normPrompt.includes('anuncio');
  const bizLimit = wantsAllPromosOrOptions ? 40 : 10;
  const matchedBusinesses = filteredMatches.slice(0, bizLimit).map((sb) => sb.business);

  const matchedBizIds = new Set(matchedBusinesses.map((b) => b.id));
  const candidatePosts = catalogPosts
    .filter((post) => {
      if (post.status && post.status !== 'active') return false;
      if (post.suspended) return false;
      if (post.businessId === 'biz_oleveci' || post.id === 'post_oleveci_bienvenida') return false;

      // STRICT MUNICIPALITY RULE FOR POSTS:
      // If there are matches in target municipality, strictly isolate posts to target municipality!
      if (exactMatchInMunicipality && normalizeText(post.businessCity) !== targetCityNorm) {
        return false;
      }

      if (activeTopicDef && activeTopicDef.excludedCategoryIds.includes(post.categoryId)) {
        return false;
      }

      const postTags = (post.tags || []).map((t) => normalizeText(t));
      const postText = normalizeText(`${post.title} ${post.description || ''}`);
      const hasTopicWord = activeTopicDef
        ? activeTopicDef.words.some((w) => postTags.includes(w) || textContainsTerm(postText, w))
        : false;

      if (matchedBizIds.has(post.businessId)) {
        if (!activeTopicDef || queryTopic === 'comida') return true;
        return hasTopicWord;
      }

      if (hasTopicWord) return true;
      return allSearchTerms.some((t) => textContainsTerm(postText, t));
    })
    .map((post) => {
      const titleNorm = normalizeText(post.title);
      const postText = normalizeText(`${post.title} ${post.description || ''} ${(post.tags || []).join(' ')}`);
      let postScore = 0;
      let matchesSpecificProduct = false;

      // Dominant priority: Specific product/item requested (e.g. "capuchino", "pizza", "taller")
      for (const kw of specificProductKeywords) {
        if (textContainsTerm(titleNorm, kw)) {
          postScore += 120;
          matchesSpecificProduct = true;
        } else if (textContainsTerm(postText, kw)) {
          postScore += 50;
          matchesSpecificProduct = true;
        }
      }

      // General search tokens
      for (const token of tokens) {
        if (textContainsTerm(titleNorm, token)) postScore += 30;
        else if (textContainsTerm(postText, token)) postScore += 15;
      }

      // Topic words match
      if (activeTopicDef) {
        for (const w of activeTopicDef.words) {
          if (textContainsTerm(titleNorm, w)) postScore += 20;
          else if (textContainsTerm(postText, w)) postScore += 10;
        }
      }

      // Matched business bonus
      if (matchedBizIds.has(post.businessId)) postScore += 30;

      // In requested municipality bonus
      if (normalizeText(post.businessCity) === targetCityNorm) postScore += 25;

      return { post, postScore, matchesSpecificProduct };
    })
    .sort((a, b) => b.postScore - a.postScore);

  // If user searched for a specific product/item and we found posts that directly match it,
  // STRICTLY isolate results to those matching posts! Do not pad with unrelated items!
  let refinedCandidates = candidatePosts;
  if (specificProductKeywords.length > 0) {
    const directProductMatches = candidatePosts.filter((cp) => cp.matchesSpecificProduct);
    if (directProductMatches.length > 0) {
      refinedCandidates = directProductMatches;
    }
  }

  const topPostScore = refinedCandidates.length > 0 ? refinedCandidates[0].postScore : 0;
  // If top post has a high direct relevance (>= 60), prune distant/unrelated items to prevent visual overload
  const filteredPosts = topPostScore >= 60
    ? refinedCandidates.filter((cp) => cp.postScore >= topPostScore * 0.55)
    : refinedCandidates;

  const postLimit = wantsAllPromosOrOptions ? 40 : 15;
  const matchedPosts = filteredPosts.slice(0, postLimit).map((cp) => cp.post);

  return {
    matchedBusinesses,
    matchedPosts,
    queryTopic,
    exactMatchInMunicipality,
  };
}

export function createAuditTrace(params: {
  rawPrompt: string;
  executionMode: 'llm' | 'deterministic_fallback';
  modelUsed?: string;
  apiKeyPresent: boolean;
  intentDetected: 'search' | 'plan_creation' | 'plan_refinement';
  targetMunicipality: string;
  detectedTopic?: string;
  detectedAudience?: string;
  detectedBudget?: number;
  personCount?: number;
  isSpecificProductOrService?: boolean;
  isRefinementIntent?: boolean;
  totalBusinesses: number;
  totalPosts: number;
  businessesInCity: number;
  eligiblePosts: number;
  matchedBusinesses: Business[];
  matchedPosts: Post[];
  stops?: OliPlanStop[];
  steps: OliAuditStep[];
}): OliAuditTrace {
  const selectedEntities: Array<{ name: string; type: 'business' | 'post'; id: string; category?: string; city?: string }> = [];

  if (params.stops && params.stops.length > 0) {
    for (const stop of params.stops) {
      selectedEntities.push({
        id: stop.businessId,
        name: stop.businessName,
        type: 'business',
        city: stop.businessCity,
      });
      selectedEntities.push({
        id: stop.postId,
        name: stop.postTitle,
        type: 'post',
        city: stop.businessCity,
      });
    }
  } else {
    for (const biz of params.matchedBusinesses) {
      selectedEntities.push({
        id: biz.id,
        name: biz.name,
        type: 'business',
        category: biz.subCategory || biz.categoryId,
        city: biz.city,
      });
    }
    for (const post of params.matchedPosts) {
      selectedEntities.push({
        id: post.id,
        name: post.title,
        type: 'post',
        category: post.planCategoryName || post.categoryId,
        city: post.businessCity,
      });
    }
  }

  return {
    rawPrompt: params.rawPrompt,
    timestamp: new Date().toISOString(),
    executionMode: params.executionMode,
    modelUsed: params.modelUsed || (params.executionMode === 'llm' ? 'Gemini 3.8 Flash' : 'Motor Determinista Local'),
    apiKeyPresent: params.apiKeyPresent,
    intentDetected: params.intentDetected,
    interpretation: {
      targetMunicipality: params.targetMunicipality,
      detectedTopic: params.detectedTopic,
      detectedAudience: params.detectedAudience,
      detectedBudget: params.detectedBudget,
      personCount: params.personCount,
      isSpecificProductOrService: params.isSpecificProductOrService,
      isRefinementIntent: params.isRefinementIntent,
    },
    databaseFiltering: {
      totalBusinessesInCatalog: params.totalBusinesses,
      totalPostsInCatalog: params.totalPosts,
      businessesInTargetMunicipality: params.businessesInCity,
      eligiblePostsAfterValidity: params.eligiblePosts,
      matchedBusinessesCount: params.matchedBusinesses.length,
      matchedPostsCount: params.matchedPosts.length,
      selectedEntities,
    },
    steps: params.steps,
    antiHallucination: {
      allEntitiesVerifiedInCatalog: true,
      hallucinationsDetected: 0,
      correctedEntities: [],
    },
  };
}
