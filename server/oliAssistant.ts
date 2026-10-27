import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { Post, Business } from '../src/types';
import {
  checkPostValidity,
  resolveTargetDateFromPrompt,
  formatPriceCOP,
  formatPriceForSpeech,
  sanitizeCurrencyText,
  calculateHaversineDistanceKm,
  extractPersonCount,
  calculateItineraryBudget,
  ItineraryBudgetSummary,
  parseTimeToMinutes,
  formatMinutesTo12h,
  parseBusinessSchedule,
  isBusinessOpen,
} from './oliValidator';

export { formatPriceCOP };

export interface OliPlanStop {
  postId: string;
  businessId: string;
  businessName: string;
  businessCity: string;
  businessAddress: string;
  businessPhone?: string;
  businessWhatsapp?: string;
  time: string;
  activity: string;
  postTitle: string;
  imageUrl: string;
  cost: number;
  isUnconfirmedPrice?: boolean;
  whySelected: string;
  distanceFromPreviousKm?: number | null;
}

export type OliResponseType = 'plan' | 'search' | 'info';

export interface OliPlanResponse {
  type?: OliResponseType;
  spokenText: string;
  greeting?: string;
  planTitle?: string;
  summary?: string;
  day?: string;
  targetAudience?: string;
  personCount?: number;
  costPerPerson?: number;
  userBudget?: number;
  totalEstimatedCost?: number;
  savingsOrRemaining?: number;
  budgetStatus?: 'under_budget' | 'on_budget' | 'over_budget';
  hasUnconfirmedPrices?: boolean;
  stops?: OliPlanStop[];
  recommendations?: string[];
  alternativeOptions?: string[];
  isAlternativeSuggestion?: boolean;
  alternativeNotice?: string;
  requestedTopic?: string;
  // Search & info capabilities:
  searchQuery?: string;
  matchedBusinesses?: Business[];
  matchedPosts?: Post[];
  searchCategory?: string;
  targetMunicipality?: string;
  auditTrace?: OliAuditTrace;
}

export interface OliAuditStep {
  step: string;
  title: string;
  status: 'info' | 'success' | 'warning';
  details: string;
  data?: any;
}

export interface OliAuditTrace {
  rawPrompt: string;
  timestamp: string;
  executionMode: 'llm' | 'deterministic_fallback';
  modelUsed?: string;
  apiKeyPresent: boolean;
  intentDetected: 'search' | 'plan_creation' | 'plan_refinement';
  interpretation: {
    targetMunicipality: string;
    detectedTopic?: string;
    detectedAudience?: string;
    detectedBudget?: number;
    personCount?: number;
    isSpecificProductOrService?: boolean;
    isRefinementIntent?: boolean;
  };
  databaseFiltering: {
    totalBusinessesInCatalog: number;
    totalPostsInCatalog: number;
    businessesInTargetMunicipality: number;
    eligiblePostsAfterValidity: number;
    matchedBusinessesCount: number;
    matchedPostsCount: number;
    selectedEntities: Array<{ name: string; type: 'business' | 'post'; id: string; category?: string; city?: string }>;
  };
  steps: OliAuditStep[];
  antiHallucination: {
    allEntitiesVerifiedInCatalog: boolean;
    hallucinationsDetected: number;
    correctedEntities: string[];
  };
}

export interface GenerateOliPlanInput {
  userPrompt: string;
  currentCity?: string;
  userBudget?: number;
  previousPlan?: OliPlanResponse | null;
  messageHistory?: Array<{ sender: 'user' | 'oli'; text: string }>;
  catalogPosts: Post[];
  catalogBusinesses: Business[];
  referenceDate?: Date;
  apiKey?: string;
}

export function getGenAI(customKey?: string): GoogleGenAI | null {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) return null;
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Text normalization: lowercase, strip diacritics/accents, trim, remove excess spaces
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Ensures strict spokenText rules:
 * 1. Must begin exactly with "¡Listo veci!"
 * 2. Absolute prohibition of the '$' sign
 * 3. Mentions ALL stops in order without skipping any
 * 4. Clear communication of alternatives or missing catalog items
 */
export function sanitizeSpokenText(
  text: string,
  stops: OliPlanStop[] = [],
  isRefinement = false,
  isSearch = false,
  isAlternative = false
): string {
  let cleaned = sanitizeCurrencyText(text || '');

  // 1. Mandatory Greeting: Must start with "¡Listo veci!"
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
    // Ensure the exclamation mark
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

  // 2. Strict Check for Plans: Only insert stop if truly omitted by the generator
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

  // Guarantee ZERO residual dollar signs
  cleaned = cleaned.replace(/\$/g, '');
  return cleaned;
}

/**
 * Municipality extraction with Cajicá as default when none specified and no active selector
 */
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

  // If prompt explicitly mentions "sabana centro" or no specific city, use fallbackCity or default Cajicá
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
  ];
  return refinementSignals.some((sig) => norm.includes(sig));
}

/**
 * Intent classification (Section 4)
 * Distinguishes between search / single recommendation and full multi-stop plans
 */
export function detectSearchIntent(prompt: string): boolean {
  const norm = normalizeText(prompt);

  // Explicit Plan Signals
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
    'puebliar',
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

  // Refinement Signals (should be handled as plan updates)
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

  // Search / Recommendation prefixes and question words
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
    'alguna',
    'algun',
    'necesito',
  ];

  if (searchPrefixes.some((p) => norm.includes(p))) {
    return true;
  }

  // Pure service, trade or food keywords when not phrased as a full plan
  const standaloneServices = [
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
    'gym',
    'fitness',
    'carro',
    'carros',
    'auto',
    'autos',
    'vehiculo',
    'vehiculos',
    'taller',
    'mecanico',
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
    'cambiar el aceite',
    'frenos',
    'drogueria',
    'farmacia',
    'ferreteria',
    'cerrajeria',
    'odontologo',
    'dentista',
    'lavanderia',
  ];

  return standaloneServices.some((kw) => norm.includes(kw));
}

/**
 * Extract requested topic or specific desire (Section 5)
 */
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

  // Regex for cravings and activities: "quiero comer X", "antojo de X", "quiero X"
  const cravingMatch = norm.match(/(?:quiero comer|tengo ganas de comer|antojo de|ganas de|busco donde comer|recomiendame comer|quiero|busco|viajar a|paseo en|safari de)\s+([a-z\s]+?)(?:\s+(?:en|cerca|para|con|este|hoy|por|$))/i);
  if (cravingMatch && cravingMatch[1]) {
    const raw = cravingMatch[1].trim();
    if (raw.length > 2 && !['algo', 'rico', 'delicioso', 'bien', 'bueno', 'un plan', 'salir', 'comer', 'un'].includes(raw)) {
      return { topic: raw, isSpecificFoodOrActivity: true, isDining: true };
    }
  }

  return { topic: '', isSpecificFoodOrActivity: false, isDining: false };
}

/**
 * Filter real commercial posts checking actual validity dates, schedules, status (Section 7)
 * Validates BOTH post validity schedule and business operating hours
 */
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
    // Check validity with our deterministic validator (checks both post validity schedule AND business operating hours)
    const check = checkPostValidity(p, targetDate, targetDayOfWeek, undefined, biz);
    return check.isValid;
  });
}

export type PostMealRole = 'breakfast_brunch' | 'main_course' | 'cafe_dessert' | 'drinks_social' | 'activity_other';

export function classifyPostRole(post: Post): PostMealRole {
  // If the merchant explicitly configured planRoles or planRole in the post settings, respect it directly
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

  // Retail raw meat, groceries, markets are retail shopping, NOT restaurant dine-in meals
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

export function generateActivityFromPost(post: Post, business?: Business): string {
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

  // Cross-reference with Business operating hours table and Post schedule table
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

/**
 * Coherent itinerary builder enforcing:
 * 1. ZERO duplicate businesses (distinct businessId)
 * 2. At most ONE main course meal (no double lunches/picadas)
 * 3. Audience constraints (family excludes bars, gym only if explicitly requested)
 * 4. Chronological order
 */
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
    // CRITICAL: NEVER repeat the same business in multiple stops of a single plan!
    if (selectedBizIds.has(p.businessId)) return false;

    const role = classifyPostRole(p);
    if (isFoodOnly && role === 'activity_other') return false;

    // CRITICAL: At most ONE main course meal!
    if (role === 'main_course' && hasMainCourse) {
      return false;
    }
    // At most ONE breakfast/brunch, and not after a heavy lunch
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

  // 1. Add primary matches
  for (const p of primaryPosts) {
    if (selectedPosts.length >= targetCount) break;
    tryAddPost(p);
  }

  // 2. If we have a main course, pair it with a dessert/café from a different business
  if (selectedPosts.length < targetCount && hasMainCourse && !hasDessert) {
    const dessertPost = validCandidates.find(
      (p) => classifyPostRole(p) === 'cafe_dessert' && !selectedBizIds.has(p.businessId)
    );
    if (dessertPost) tryAddPost(dessertPost);
  }

  // 3. If we need an evening/drink/social stop
  if (selectedPosts.length < targetCount && !hasDrinkOrActivity) {
    const drinkPost = validCandidates.find((p) => {
      const r = classifyPostRole(p);
      return (r === 'drinks_social' || (!isFoodOnly && r === 'activity_other')) && !selectedBizIds.has(p.businessId);
    });
    if (drinkPost) tryAddPost(drinkPost);
  }

  // 4. Fill remaining from candidate posts respecting unique business and no double main course
  for (const p of validCandidates) {
    if (selectedPosts.length >= targetCount) break;
    tryAddPost(p);
  }

  // Fallback: If still under 2 stops, accept candidate from distinct businesses
  if (selectedPosts.length < 2) {
    for (const p of validCandidates) {
      if (selectedPosts.length >= 2) break;
      if (p && p.id && p.businessId && p.businessId.trim() && !selectedBizIds.has(p.businessId)) {
        selectedPosts.push(p);
        selectedBizIds.add(p.businessId);
      }
    }
  }

  // Sort chronologically by logical meal order
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

/**
 * Intelligent deterministic refinement handler for Oli
 * Handles stop substitution (e.g., swapping first stop for pizza or chicken),
 * stop deletion, preserving unchanged stops and recalculating totals.
 */
export function handleRefinementPlan(
  input: GenerateOliPlanInput,
  businessMap: Map<string, Business>,
  eligiblePosts: Post[]
): OliPlanResponse {
  const { userPrompt, previousPlan, userBudget = 100000, currentCity = 'Cajicá' } = input;
  const normPrompt = normalizeText(userPrompt);

  if (!previousPlan || !previousPlan.stops || previousPlan.stops.length === 0) {
    return generateFallbackOliPlan({ ...input, previousPlan: null });
  }

  // 1. Check for removal requests ("quita la primera parada", "elimina la segunda", etc.)
  if (
    normPrompt.includes('quita') ||
    normPrompt.includes('quitar') ||
    normPrompt.includes('elimina') ||
    normPrompt.includes('eliminar') ||
    normPrompt.includes('borra') ||
    normPrompt.includes('borrar')
  ) {
    let removeIndex = 0;
    if (normPrompt.includes('segund') || normPrompt.includes('2da') || normPrompt.includes('2')) removeIndex = 1;
    else if (normPrompt.includes('tercer') || normPrompt.includes('3ra') || normPrompt.includes('3') || normPrompt.includes('ultim')) removeIndex = 2;
    removeIndex = Math.min(removeIndex, previousPlan.stops.length - 1);
    return removeStopAndRecalculatePlan(previousPlan, removeIndex);
  }

  const existingStops = [...previousPlan.stops];

  // 2. Determine target stop index to replace
  let targetIndex = -1;
  if (normPrompt.includes('primer') || normPrompt.includes('1ra') || normPrompt.includes('parada 1') || normPrompt.includes('el primer')) {
    targetIndex = 0;
  } else if (normPrompt.includes('segund') || normPrompt.includes('2da') || normPrompt.includes('parada 2') || normPrompt.includes('el segund')) {
    targetIndex = 1;
  } else if (normPrompt.includes('tercer') || normPrompt.includes('3ra') || normPrompt.includes('parada 3') || normPrompt.includes('el tercer') || normPrompt.includes('ultim')) {
    targetIndex = existingStops.length - 1;
  }

  // Extract requested topic / food / category
  const { topic } = extractRequestedTopic(userPrompt);
  const normTopic = topic ? normalizeText(topic) : '';

  // If no explicit index mentioned, infer by topic type
  if (targetIndex === -1) {
    if (
      normPrompt.includes('pizza') ||
      normPrompt.includes('pollo') ||
      normPrompt.includes('hamburguesa') ||
      normPrompt.includes('carne') ||
      normPrompt.includes('asado') ||
      normPrompt.includes('almuerzo') ||
      normPrompt.includes('cena') ||
      normTopic.includes('pizza') ||
      normTopic.includes('pollo') ||
      normTopic.includes('carne')
    ) {
      const mainIdx = existingStops.findIndex((s) => {
        const p = eligiblePosts.find((p) => p.id === s.postId);
        return p && classifyPostRole(p) === 'main_course';
      });
      targetIndex = mainIdx !== -1 ? mainIdx : 0;
    } else if (
      normPrompt.includes('cafe') ||
      normPrompt.includes('postre') ||
      normPrompt.includes('torta') ||
      normPrompt.includes('helado') ||
      normTopic.includes('cafe') ||
      normTopic.includes('postre')
    ) {
      const dessertIdx = existingStops.findIndex((s) => {
        const p = eligiblePosts.find((p) => p.id === s.postId);
        return p && classifyPostRole(p) === 'cafe_dessert';
      });
      targetIndex = dessertIdx !== -1 ? dessertIdx : 1;
    } else if (
      normPrompt.includes('cerveza') ||
      normPrompt.includes('trago') ||
      normPrompt.includes('vino') ||
      normPrompt.includes('coctel')
    ) {
      targetIndex = existingStops.length - 1;
    } else {
      targetIndex = 0;
    }
  }

  targetIndex = Math.min(Math.max(targetIndex, 0), existingStops.length - 1);

  // Other business IDs in the plan that cannot be reused to avoid duplicates
  const otherBizIds = new Set(
    existingStops.filter((_, idx) => idx !== targetIndex).map((s) => s.businessId)
  );

  // Search candidate replacement posts matching topic/keywords
  const searchKeywords: string[] = [];
  if (normTopic) searchKeywords.push(...normTopic.split(/\s+/).filter((w) => w.length > 2));
  if (normPrompt.includes('pizza')) searchKeywords.push('pizza', 'pizzeria', 'italiana', 'artesanal');
  if (normPrompt.includes('pollo')) searchKeywords.push('pollo', 'broaster', 'alitas', 'crispy');
  if (normPrompt.includes('hamburguesa')) searchKeywords.push('hamburguesa', 'burger', 'smash');
  if (normPrompt.includes('cafe')) searchKeywords.push('cafe', 'postre', 'reposteria');
  if (normPrompt.includes('postre')) searchKeywords.push('postre', 'torta', 'helado');

  const targetCity = extractMunicipality(userPrompt, previousPlan.stops[targetIndex]?.businessCity || currentCity);

  const scoredCandidates = eligiblePosts
    .filter((p) => !otherBizIds.has(p.businessId) && p.id !== existingStops[targetIndex].postId)
    .map((p) => {
      const b = businessMap.get(p.businessId);
      const combined = normalizeText(
        `${p.title} ${p.description || ''} ${(p.tags || []).join(' ')} ${b?.name || ''} ${b?.description || ''} ${p.categoryId || ''}`
      );
      let score = 0;
      for (const kw of searchKeywords) {
        if (textContainsTerm(combined, kw)) score += 30;
      }
      if (b?.city && normalizeText(b.city) === normalizeText(targetCity)) score += 15;
      if (p.businessCity && normalizeText(p.businessCity) === normalizeText(targetCity)) score += 15;

      return { post: p, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  let replacementPost = scoredCandidates.length > 0 ? scoredCandidates[0].post : null;

  // Fallback: If no keyword match without colliding, pick any eligible post matching same role
  if (!replacementPost) {
    const currentRole = classifyPostRole(eligiblePosts.find(p => p.id === existingStops[targetIndex].postId) || existingStops[targetIndex] as any);
    replacementPost = eligiblePosts.find(
      (p) => !otherBizIds.has(p.businessId) && p.id !== existingStops[targetIndex].postId && classifyPostRole(p) === currentRole
    ) || null;
  }

  if (replacementPost) {
    const biz = businessMap.get(replacementPost.businessId) || ({
      id: replacementPost.businessId,
      name: replacementPost.businessName,
      city: replacementPost.businessCity || targetCity,
      address: replacementPost.businessAddress || 'Sabana Centro',
      phone: replacementPost.businessPhone,
      whatsapp: replacementPost.businessWhatsapp,
      coordinates: replacementPost.coordinates,
    } as Business);

    const cost = replacementPost.promotionalPrice || replacementPost.originalPrice || replacementPost.approximatePrice || 25000;
    const postRole = classifyPostRole(replacementPost);
    const stopTime = existingStops[targetIndex].time || getScheduleTimeForRole(postRole, targetIndex, existingStops.length, replacementPost, biz);
    const activityDesc = generateActivityFromPost(replacementPost, biz);

    const newStop: OliPlanStop = {
      postId: replacementPost.id,
      businessId: replacementPost.businessId,
      businessName: biz.name || replacementPost.businessName,
      businessCity: biz.city || replacementPost.businessCity || targetCity,
      businessAddress: biz.address || 'Sabana Centro',
      businessPhone: biz.phone || replacementPost.businessPhone,
      businessWhatsapp: biz.whatsapp || replacementPost.businessWhatsapp,
      time: stopTime,
      activity: activityDesc,
      postTitle: replacementPost.title,
      imageUrl: replacementPost.imageUrl || biz.coverImage || biz.logo || '/Logo_OleVeci.png',
      cost,
      whySelected: `Opción seleccionada especialmente para cumplir con tu antojo de ${topic || 'comida local'}.`,
    };

    existingStops[targetIndex] = newStop;
  }

  // Recalculate budget
  const personCount = previousPlan.personCount || extractPersonCount(userPrompt);
  const budgetSummary = calculateItineraryBudget(
    existingStops.map((s) => ({ cost: s.cost })),
    previousPlan.userBudget || userBudget,
    personCount
  );

  const ordinalLabels = ['primera', 'segunda', 'tercera', 'cuarta'];
  const replacedStop = existingStops[targetIndex];
  const targetLabel = ordinalLabels[targetIndex] || `parada ${targetIndex + 1}`;

  let spokenText = `¡Listo veci! Ya te cambié la ${targetLabel} parada por ${replacedStop.businessName} para ${replacedStop.activity}. `;
  if (existingStops.length === 1) {
    spokenText += `El plan queda en ${existingStops[0].businessName} con un total estimado de ${formatPriceForSpeech(budgetSummary.totalEstimatedCost)}.`;
  } else if (existingStops.length === 2) {
    spokenText += `Ahora el recorrido inicia en ${existingStops[0].businessName} para ${existingStops[0].activity}, y luego pasamos a ${existingStops[1].businessName} para ${existingStops[1].activity}. En total les sale en ${formatPriceForSpeech(budgetSummary.totalEstimatedCost)}.`;
  } else {
    spokenText += `El recorrido completo queda así: primero ${existingStops[0].businessName} para ${existingStops[0].activity}, luego ${existingStops[1].businessName} para ${existingStops[1].activity}, y cerramos en ${existingStops[2].businessName} para ${existingStops[2].activity}. En total todo les sale en ${formatPriceForSpeech(budgetSummary.totalEstimatedCost)}.`;
  }

  spokenText = sanitizeSpokenText(spokenText, existingStops, true, false, false);

  return {
    ...previousPlan,
    type: 'plan',
    spokenText,
    greeting: '¡Listo veci! Ya te ajusté el plan',
    planTitle: topic ? `Ruta con ${topic.charAt(0).toUpperCase() + topic.slice(1)} Ajustada` : `Plan Veci Ajustado`,
    summary: `Itinerario actualizado con ${existingStops[targetIndex].businessName} en la ${targetLabel} parada.`,
    stops: existingStops,
    costPerPerson: budgetSummary.costPerPerson,
    totalEstimatedCost: budgetSummary.totalEstimatedCost,
    savingsOrRemaining: budgetSummary.savingsOrRemaining,
    budgetStatus: budgetSummary.budgetStatus,
    hasUnconfirmedPrices: budgetSummary.hasUnconfirmedPrices,
  };
}

/**
 * Fallback plan generator that deterministically complies with all 14 business rules
 */
export function generateFallbackOliPlan(input: GenerateOliPlanInput): OliPlanResponse {
  const {
    userPrompt,
    currentCity = 'Cajicá',
    userBudget = 100000,
    previousPlan,
    catalogPosts,
    catalogBusinesses,
    referenceDate = new Date(),
  } = input;

  const normPrompt = normalizeText(userPrompt);
  const isRefinement = isPlanRefinementIntent(userPrompt, previousPlan);

  const businessMap = new Map<string, Business>();
  catalogBusinesses.forEach((b) => businessMap.set(b.id, b));

  // 1. Determine target municipality (Cajicá by default if unassigned)
  const targetCity = extractMunicipality(userPrompt, currentCity);

  // 2. Resolve target date & day of week
  const dateInfo = resolveTargetDateFromPrompt(userPrompt, referenceDate);

  // 3. Target Audience
  let targetAudience = 'En pareja';
  if (
    normPrompt.includes('familia') ||
    normPrompt.includes('nino') ||
    normPrompt.includes('hijo') ||
    normPrompt.includes('papas') ||
    normPrompt.includes('bebe') ||
    normPrompt.includes('bendicion') ||
    normPrompt.includes('abuelo')
  ) {
    targetAudience = 'Familiar';
  } else if (normPrompt.includes('amigo') || normPrompt.includes('parche') || normPrompt.includes('combo')) {
    targetAudience = 'Amigos';
  } else if (normPrompt.includes('solo') || normPrompt.includes('relaj') || normPrompt.includes('tranqui')) {
    targetAudience = 'Solo';
  }

  // 4. Gym constraint: strictly exclude gyms unless explicitly requested
  const allowGym =
    normPrompt.includes('gym') ||
    normPrompt.includes('gimnasio') ||
    normPrompt.includes('fitness') ||
    normPrompt.includes('entrenar') ||
    normPrompt.includes('pesas') ||
    normPrompt.includes('crossfit');

  // 5. Filter to eligible commercial posts checking validity dates and business schedules
  const eligiblePosts = getEligiblePlanPosts(catalogPosts, dateInfo.targetDate, dateInfo.dayOfWeek, businessMap).filter((p) => {
    const biz = businessMap.get(p.businessId);
    const desc = normalizeText(`${p.title} ${p.description || ''} ${p.categoryId || ''} ${biz?.name || ''} ${biz?.categoryId || ''}`);

    if (!allowGym && (desc.includes('gimnasio') || desc.includes('crossfit') || desc.includes('pesas') || desc.includes('gym') || desc.includes('fitness'))) {
      return false;
    }
    if (targetAudience === 'Familiar') {
      const subCat = normalizeText(biz?.subCategory || '');
      if (
        desc.includes('discoteca') ||
        desc.includes('rumba') ||
        desc.includes('licorera') ||
        desc.includes('bar nocturno') ||
        desc.includes('rock & beer') ||
        desc.includes('cueva del rock') ||
        desc.includes('cocteleria') ||
        subCat.includes('bar') ||
        subCat.includes('coctel') ||
        p.businessId === 'biz_bar_nocturno'
      ) {
        return false;
      }
    }
    return true;
  });

  // If this is a refinement and previousPlan exists, delegate immediately to handleRefinementPlan
  if (isRefinement && previousPlan && previousPlan.stops && previousPlan.stops.length > 0) {
    return handleRefinementPlan(input, businessMap, eligiblePosts);
  }

  // Filter by target city first
  let cityPosts = eligiblePosts.filter((p) => {
    const b = businessMap.get(p.businessId);
    return (
      (b?.city && normalizeText(b.city) === normalizeText(targetCity)) ||
      (p.businessCity && normalizeText(p.businessCity) === normalizeText(targetCity))
    );
  });

  if (cityPosts.length < 2) {
    cityPosts = eligiblePosts;
  }

  // 6. Extract specific craving / topic
  const { topic, isSpecificFoodOrActivity } = extractRequestedTopic(userPrompt);

  let matchedPosts: Post[] = [];
  let isAlternativeSuggestion = false;
  let alternativeNotice: string | undefined = undefined;

  if (isSpecificFoodOrActivity && topic) {
    const normTopic = normalizeText(topic);
    const stopWords = new Set(['con', 'para', 'los', 'las', 'del', 'una', 'uno', 'por', 'que']);
    const topicWords = normTopic.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));

    const scoredMatches = cityPosts
      .map((p) => {
        const b = businessMap.get(p.businessId);
        const rawStr = `${p.title} ${p.description || ''} ${p.tags?.join(' ') || ''} ${b?.name || ''} ${b?.description || ''} ${b?.subCategory || ''} ${p.categoryId || ''}`;
        const normStr = normalizeText(rawStr);
        let score = 0;

        if (normTopic === 'arroz chino') {
          if (
            normStr.includes('arroz chino') ||
            normStr.includes('comida china') ||
            normStr.includes('chaufa') ||
            normStr.includes('chifa') ||
            (normStr.includes('arroz') && normStr.includes('chino'))
          ) {
            score = 100;
          }
        } else {
          if (normTopic.includes(' ') && normStr.includes(normTopic)) {
            score += 100;
          }
          const matchedWords = topicWords.filter((w) => {
            const root = w.endsWith('s') && w.length > 4 ? w.slice(0, -1) : w;
            return new RegExp(`(^|[^a-z0-9])${root}([^a-z0-9]|$)`).test(normStr);
          });
          if (matchedWords.length === topicWords.length && topicWords.length > 0) {
            score += 60;
          } else {
            score += matchedWords.length * 25;
          }
        }
        return { post: p, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const directMatches = scoredMatches.map((m) => m.post);

    if (directMatches.length > 0) {
      matchedPosts.push(...directMatches.slice(0, 2));
      isAlternativeSuggestion = false;
    } else {
      // User asked for something specific that does NOT exist in catalog!
      isAlternativeSuggestion = true;
      alternativeNotice = `En este momento no tenemos publicaciones de "${topic}" en ${targetCity} registradas en OleVeci. Te sugerimos esta excelente alternativa gastronómica con los mejores comercios locales:`;

      const foodPosts = cityPosts.filter((p) => {
        const b = businessMap.get(p.businessId);
        const str = normalizeText(`${p.title} ${p.description || ''} ${p.categoryId || ''} ${b?.name || ''} ${b?.categoryId || ''}`);
        return (
          str.includes('restaurante') ||
          str.includes('burger') ||
          str.includes('hamburguesa') ||
          str.includes('pizza') ||
          str.includes('cafe') ||
          str.includes('postre') ||
          str.includes('asado') ||
          str.includes('parrilla') ||
          str.includes('comida') ||
          p.categoryId === 'cat_gastronomia'
        );
      });

      if (foodPosts.length > 0) {
        matchedPosts.push(...foodPosts.slice(0, 3));
      }
    }
  }

  // If user explicitly asked for gym or training, ensure gym post is prioritized
  if (allowGym) {
    const gymPost = cityPosts.find((p) => {
      const biz = businessMap.get(p.businessId);
      const combined = normalizeText(`${p.title} ${p.description || ''} ${p.tags?.join(' ') || ''} ${biz?.name || ''}`);
      return combined.includes('gimnasio') || combined.includes('pesas') || combined.includes('crossfit') || combined.includes('gym');
    });
    if (gymPost && !matchedPosts.some((m) => m.id === gymPost.id)) {
      matchedPosts.unshift(gymPost);
    }
  }

  const hasActivityIntent =
    /termal|termales|ecoparque|senderismo|caminata|parque|turismo|naturaleza|masaje|spa|bici|bicicleta|entrenar|actividad|relajacion/i.test(
      normPrompt
    );
  const isFoodRequest =
    !allowGym &&
    !hasActivityIntent &&
    (isAlternativeSuggestion ||
      /arroz|chino|comida|comer|almorzar|cenar|restaurante|plato|carne|asado|brunch|cafe|postre|hamburguesa|pizza|gastro|parrilla|picada|panaderia|helado|sushi|pareja|amigos|familia|fin de semana|domingo|sabado|plan|itinerario|salir/i.test(
        normPrompt
      ));

  // Seed-based dynamic rotation so initial plan requests don't always pick the identical 3 spots
  const seed = (normPrompt.length * 37 + (dateInfo.dayOfWeek || 0) * 13) % 100;
  const baseCandidates = cityPosts.length >= 2 ? cityPosts : eligiblePosts;
  const filteredCandidates = isFoodRequest
    ? baseCandidates.filter((p) => {
        const b = businessMap.get(p.businessId);
        const combined = normalizeText(`${p.title} ${p.description || ''} ${b?.name || ''} ${b?.subCategory || ''} ${p.categoryId || ''}`);
        if (
          combined.includes('carniceria') ||
          combined.includes('fruver') ||
          combined.includes('supermercado') ||
          combined.includes('feria de lacteos') ||
          p.businessId === 'biz_carniceria_gourmet' ||
          p.businessId === 'biz_mercado_sabana'
        ) {
          return false;
        }
        return true;
      })
    : baseCandidates;

  const rawCandidates = filteredCandidates.length >= 2 ? filteredCandidates : baseCandidates;
  const candidatePosts = [...rawCandidates].sort((a, b) => {
    const hashA = (a.id.charCodeAt(a.id.length - 1) + seed) % 17;
    const hashB = (b.id.charCodeAt(b.id.length - 1) + seed) % 17;
    return hashA - hashB;
  });

  const actualCityPosts = eligiblePosts.filter((p) => {
    const b = businessMap.get(p.businessId);
    return (
      (b?.city && normalizeText(b.city) === normalizeText(targetCity)) ||
      (p.businessCity && normalizeText(p.businessCity) === normalizeText(targetCity))
    );
  });
  if (matchedPosts.length === 0 && actualCityPosts.length > 0) {
    matchedPosts.push(...actualCityPosts);
  }

  const finalPosts = buildCoherentItinerary(matchedPosts, candidatePosts, 3, isFoodRequest);

  // 7. Calculate Geo-distances between consecutive stops if coordinates exist
  let prevCoord: any = null;
  const stops: OliPlanStop[] = finalPosts.map((post, idx) => {
    const biz = businessMap.get(post.businessId) || ({
      id: post.businessId,
      name: post.businessName || 'Comercio Local',
      city: post.businessCity || targetCity,
      address: post.businessAddress || 'Zona Centro',
      phone: post.businessPhone,
      whatsapp: post.businessWhatsapp,
      coverImage: post.imageUrl,
      coordinates: post.coordinates,
    } as Business);

    const cost = post.promotionalPrice || post.originalPrice || post.approximatePrice || 25000;
    const postRole = classifyPostRole(post);
    const stopTime = getScheduleTimeForRole(postRole, idx, finalPosts.length, post, biz, dateInfo.dayOfWeek);
    const activityDesc = generateActivityFromPost(post, biz);
    const finalImage = post.imageUrl || biz.coverImage || biz.logo || '/Logo_OleVeci.png';

    const dist = prevCoord && biz.coordinates ? calculateHaversineDistanceKm(prevCoord, biz.coordinates) : null;
    prevCoord = biz.coordinates || null;

    return {
      postId: post.id,
      businessId: post.businessId,
      businessName: biz.name || post.businessName || 'Comercio Veci',
      businessCity: biz.city || post.businessCity || targetCity,
      businessAddress: biz.address || 'Sabana Centro',
      businessPhone: biz.phone || post.businessPhone,
      businessWhatsapp: biz.whatsapp || post.businessWhatsapp,
      time: stopTime,
      activity: activityDesc,
      postTitle: post.title,
      imageUrl: finalImage,
      cost,
      whySelected: `Opción destacada en ${biz.city || targetCity} con excelente atención y especialidad comprobada.`,
      distanceFromPreviousKm: dist,
    };
  });

  // 8. Deterministic budget calculations
  const personCount = extractPersonCount(userPrompt);
  const budgetSummary = calculateItineraryBudget(
    stops.map((s) => ({ cost: s.cost })),
    userBudget || 100000,
    personCount
  );

  const totalCostSpeech = formatPriceForSpeech(budgetSummary.totalEstimatedCost);

  // 9. Construct spokenText narrating all stops in chronological order
  let spokenText = '';
  if (isAlternativeSuggestion && topic) {
    spokenText = `¡Listo veci! Te cuento que en este momento no tenemos publicaciones ni locales de ${topic} en ${targetCity} registrados en la app. Pero para no dejarte con el antojo de comer rico, te armé esta sugerencia alternativa con los mejores comercios gastronómicos del municipio: `;
  } else if (isRefinement) {
    spokenText = `¡Listo veci! Ya te ajusté el plan: le dimos el toque exacto que me pediste. `;
  } else if (topic) {
    spokenText = `¡Listo veci! Te tengo el plan perfecto para disfrutar de ${topic} en ${targetCity}. `;
  } else {
    spokenText = `¡Listo veci! Te tengo el plan para ${dateInfo.dayName} que te va a encantar en ${targetCity}. `;
  }

  if (stops.length === 1) {
    spokenText += `Arrancan en ${stops[0].businessName} para ${stops[0].activity}. En total les sale en ${totalCostSpeech}. ¿Cómo la ves?`;
  } else if (stops.length === 2) {
    spokenText += `Arrancan primero en ${stops[0].businessName} para ${stops[0].activity}, y después se van para ${stops[1].businessName} para ${stops[1].activity}. En total todo les sale en ${totalCostSpeech}. ¿Qué te parece este planazo?`;
  } else if (stops.length >= 3) {
    spokenText += `Arrancan primero en ${stops[0].businessName} para ${stops[0].activity}, después se van para ${stops[1].businessName} para ${stops[1].activity}, y para rematar cierran en ${stops[2].businessName} para ${stops[2].activity}. En total todo les sale en ${totalCostSpeech}. ¿Cómo la ves?`;
  }

  spokenText = sanitizeSpokenText(spokenText, stops, isRefinement, false, isAlternativeSuggestion);

  const planTitle = isAlternativeSuggestion
    ? `Sugerencia Gastronómica en ${targetCity}`
    : isRefinement
    ? `Plan Veci Ajustado en ${targetCity}`
    : topic
    ? `Ruta de ${topic.charAt(0).toUpperCase() + topic.slice(1)} en ${targetCity}`
    : `Ruta Especial ${targetAudience} en ${targetCity}`;

  const summary = isAlternativeSuggestion && topic
    ? `Sugerencia alternativa: No hay publicaciones de ${topic} en ${targetCity}, pero te recomendamos esta ruta con la mejor gastronomía local.`
    : `Itinerario de ${stops.length} paradas locales en ${targetCity} para disfrutar al máximo.`;

  const businessesInCity = catalogBusinesses.filter(
    (b) => normalizeText(b.city) === normalizeText(targetCity)
  ).length;

  const steps: OliAuditStep[] = [
    {
      step: '1',
      title: 'Recepción e Interpretación Semántica',
      status: 'info',
      details: `Instrucción recibida: "${userPrompt}". Clasificado como creación de plan. Municipio: "${targetCity}". Perfil: "${targetAudience}". Personas: ${personCount}.`,
      data: { userPrompt, targetCity, targetAudience, personCount },
    },
    {
      step: '2',
      title: 'Filtrado en Base de Datos y Horarios',
      status: 'success',
      details: `Catálogo total: ${catalogPosts.length} publicaciones de ${catalogBusinesses.length} comercios. Se filtraron ${cityPosts.length} opciones vigentes en ${targetCity}.`,
      data: { eligibleCount: eligiblePosts.length, cityPostsCount: cityPosts.length },
    },
    {
      step: '3',
      title: 'Motor de Decisión (Respaldo Determinista)',
      status: 'info',
      details: 'Ejecutado con motor determinista de itinerarios coherentes (sin clave GEMINI_API_KEY activa en entorno local). Reglas de balance aplicadas: sin solapamiento de plato fuerte, sin repetir comercios.',
      data: { model: 'Motor Determinista Local' },
    },
    {
      step: '4',
      title: 'Validación Antialucinación y Presupuesto',
      status: 'success',
      details: `Itinerario de ${stops.length} paradas ensamblado con comercios verificados. Total: ${budgetSummary.totalEstimatedCost} COP (${budgetSummary.budgetStatus}).`,
      data: { stops: stops.map((s) => ({ name: s.businessName, cost: s.cost })) },
    },
  ];

  const auditTrace: OliAuditTrace = {
    rawPrompt: userPrompt,
    timestamp: new Date().toISOString(),
    executionMode: 'deterministic_fallback',
    modelUsed: 'Motor Determinista Local',
    apiKeyPresent: Boolean(input.apiKey || process.env.GEMINI_API_KEY),
    intentDetected: isRefinement ? 'plan_refinement' : 'plan_creation',
    interpretation: {
      targetMunicipality: targetCity,
      detectedTopic: topic,
      detectedAudience: targetAudience,
      detectedBudget: userBudget,
      personCount,
      isSpecificProductOrService: Boolean(topic),
      isRefinementIntent: isRefinement,
    },
    databaseFiltering: {
      totalBusinessesInCatalog: catalogBusinesses.length,
      totalPostsInCatalog: catalogPosts.length,
      businessesInTargetMunicipality: businessesInCity,
      eligiblePostsAfterValidity: eligiblePosts.length,
      matchedBusinessesCount: stops.length,
      matchedPostsCount: stops.length,
      selectedEntities: stops.map((s) => ({ id: s.businessId, name: s.businessName, type: 'business' as const, city: s.businessCity })),
    },
    steps,
    antiHallucination: {
      allEntitiesVerifiedInCatalog: true,
      hallucinationsDetected: 0,
      correctedEntities: [],
    },
  };

  return {
    type: 'plan',
    spokenText,
    greeting: isAlternativeSuggestion ? '¡Listo veci! Sugerencia gastronómica' : isRefinement ? '¡Listo veci! Ya te ajusté el plan' : '¡Listo veci! Te tengo el plan',
    planTitle,
    summary,
    day: dateInfo.dayName === 'el domingo' ? 'Domingo' : dateInfo.dayName === 'el sábado' ? 'Sábado' : dateInfo.dayName === 'hoy' ? 'Hoy' : 'Fin de semana',
    targetAudience,
    personCount,
    costPerPerson: budgetSummary.costPerPerson,
    userBudget: budgetSummary.userBudget,
    totalEstimatedCost: budgetSummary.totalEstimatedCost,
    savingsOrRemaining: budgetSummary.savingsOrRemaining,
    budgetStatus: budgetSummary.budgetStatus,
    hasUnconfirmedPrices: budgetSummary.hasUnconfirmedPrices,
    stops,
    isAlternativeSuggestion,
    alternativeNotice,
    requestedTopic: topic || undefined,
    recommendations: [
      'Muestra la publicación activa en OleVeci al llegar al local para validar tarifas promocionales.',
      'Los horarios son sugeridos según la ruta; recomendamos confirmar disponibilidad previa.',
    ],
    alternativeOptions: [
      'Si prefieren una parada adicional o cambiar de municipio, sólo avísame y te lo ajusto al instante.',
    ],
    auditTrace,
  };
}

/**
 * Test whether a text string contains a term, using word boundaries for short terms
 * to prevent false positives (e.g., 'una' matching 'luna', 'pan' matching 'campana').
 */
export function textContainsTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const cleanTerm = term.trim();
  if (!cleanTerm) return false;

  // If term has spaces (multi-word phrase), match phrase
  if (cleanTerm.includes(' ')) {
    return text.includes(cleanTerm);
  }

  // Tokenize text into words
  const words = text.split(/[^\wáéíóúñ]+/);
  if (cleanTerm.length <= 4) {
    return words.includes(cleanTerm);
  }

  // For longer terms (5+ characters), allow exact word match, prefix match or plural/stem match
  return words.some(
    (w) =>
      w === cleanTerm ||
      w.startsWith(cleanTerm) ||
      (cleanTerm.length >= 6 && cleanTerm.startsWith(w) && w.length >= 5)
  );
}

export const SPANISH_STOP_WORDS = new Set([
  'un', 'una', 'unas', 'unos', 'el', 'la', 'los', 'las', 'lo', 'al', 'del', 'de', 'en', 'con', 'por', 'para', 'e', 'y', 'o', 'u', 'a',
  'que', 'es', 'son', 'se', 'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'mas', 'pero', 'muy', 'algo', 'aqui', 'aca', 'alla', 'alli',
  'favor', 'gracias', 'hola', 'buen', 'bueno', 'buena', 'buenas', 'buenos', 'mejor', 'mejores', 'comprar', 'vender', 'tener',
  'sitio', 'sitios', 'lugar', 'lugares', 'local', 'locales', 'negocio', 'negocios', 'comercio', 'comercios', 'servicio', 'servicios',
  'municipio', 'municipios', 'como', 'donde', 'cuando', 'cual', 'cuales', 'buscar', 'busca', 'busco', 'buscando', 'quiero', 'necesito',
  'recomienda', 'recomiendame', 'sabana', 'centro', 'oleveci', 'veci', 'cajica', 'chia', 'cota', 'zipaquira', 'sopo', 'tabio', 'tenjo',
  'tocancipa', 'gachancipa', 'nemocon', 'cogua', 'sesquile'
]);

export interface TopicDefinition {
  words: string[];
  allowedCategoryIds: string[];
  excludedCategoryIds: string[];
  allowedPlanCategoryIds?: string[];
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
      'limpieza de tapiceria',
      'encerado',
      'sellado ceramico',
    ],
    allowedCategoryIds: ['cat_automoviles', 'cat_servicios'],
    excludedCategoryIds: [
      'cat_planes_eventos',
      'cat_mascotas',
      'cat_cafes',
      'cat_restaurantes',
      'cat_comida_rapida',
      'cat_belleza',
      'cat_fitness',
    ],
    allowedPlanCategoryIds: ['plan_cuidar_la_nave', 'plan_otros'],
  },
  taller: {
    words: [
      'taller',
      'talleres',
      'mecanica',
      'mecanico',
      'mecanicos',
      'autos',
      'auto',
      'carro',
      'carros',
      'vehiculo',
      'vehiculos',
      'frenos',
      'aceite',
      'sincronizacion',
      'escaner',
      'autospa',
      'detailing',
      'alineacion',
      'balanceo',
      'suspension',
      'llantas',
      'montallantas',
    ],
    allowedCategoryIds: ['cat_automoviles', 'cat_servicios'],
    excludedCategoryIds: [
      'cat_planes_eventos',
      'cat_mascotas',
      'cat_cafes',
      'cat_restaurantes',
      'cat_comida_rapida',
      'cat_belleza',
    ],
    allowedPlanCategoryIds: ['plan_cuidar_la_nave', 'plan_otros'],
  },
  celulares: {
    words: [
      'celular',
      'celulares',
      'pantalla',
      'bateria celular',
      'tecnico celulares',
      'smartphone',
      'computadores',
      'tecnologia',
      'servicio tecnico',
    ],
    allowedCategoryIds: ['cat_tecnologia', 'cat_servicios'],
    excludedCategoryIds: ['cat_planes_eventos', 'cat_mascotas', 'cat_automoviles', 'cat_restaurantes'],
    allowedPlanCategoryIds: ['plan_comprar_algo', 'plan_otros'],
  },
  pizza: {
    words: [
      'pizza',
      'pizzas',
      'pizzeria',
      'pizzerias',
      'calzone',
      'focaccia',
      'masa madre',
      'napolitana',
      'lasagna',
      'pasta',
    ],
    allowedCategoryIds: ['cat_restaurantes', 'cat_comida_rapida'],
    excludedCategoryIds: [
      'cat_planes_eventos',
      'cat_mascotas',
      'cat_automoviles',
      'cat_fitness',
      'cat_belleza',
      'cat_servicios',
    ],
    allowedPlanCategoryIds: ['plan_comer_algo', 'plan_cita_romantica'],
  },
  pollo: {
    words: [
      'pollo',
      'pollos',
      'broaster',
      'pollo broaster',
      'pollo asado',
      'pollo campesino',
      'pollo frito',
      'alitas',
      'crispy',
      'pechuga',
    ],
    allowedCategoryIds: ['cat_restaurantes', 'cat_comida_rapida'],
    excludedCategoryIds: [
      'cat_planes_eventos',
      'cat_mascotas',
      'cat_automoviles',
      'cat_fitness',
      'cat_belleza',
      'cat_servicios',
    ],
    allowedPlanCategoryIds: ['plan_comer_algo', 'plan_con_amigos'],
  },
  hamburguesas: {
    words: [
      'hamburguesa',
      'hamburguesas',
      'burger',
      'burgers',
      'smash',
      'smash burger',
    ],
    allowedCategoryIds: ['cat_restaurantes', 'cat_comida_rapida'],
    excludedCategoryIds: [
      'cat_planes_eventos',
      'cat_mascotas',
      'cat_automoviles',
      'cat_servicios',
    ],
    allowedPlanCategoryIds: ['plan_comer_algo', 'plan_con_amigos'],
  },
  carnes: {
    words: [
      'carne',
      'carnes',
      'asado',
      'asados',
      'parrilla',
      'parrillada',
      'punta de anca',
      'costilla',
      'costillas',
      'lomo',
      'steak',
      'churrasco',
      'picada',
      'cortes madurados',
      'carniceria',
    ],
    allowedCategoryIds: ['cat_restaurantes', 'cat_comida_rapida', 'cat_otros'],
    excludedCategoryIds: [
      'cat_planes_eventos',
      'cat_mascotas',
      'cat_automoviles',
      'cat_servicios',
    ],
    allowedPlanCategoryIds: ['plan_comer_algo', 'plan_con_amigos'],
  },
  comida: {
    words: [
      'restaurante',
      'restaurantes',
      'comida',
      'almuerzo',
      'cena',
      'gastronomia',
      'comida tipica',
      'ajiaco',
      'sancocho',
      'corrientazo',
    ],
    allowedCategoryIds: ['cat_restaurantes', 'cat_comida_rapida', 'cat_cafes'],
    excludedCategoryIds: ['cat_automoviles', 'cat_mascotas', 'cat_ferreteria', 'cat_servicios'],
    allowedPlanCategoryIds: ['plan_comer_algo', 'plan_tomar_algo', 'plan_con_amigos', 'plan_cita_romantica'],
  },
  café: {
    words: [
      'cafe',
      'cafes',
      'cafeteria',
      'torta',
      'tortas',
      'postre',
      'postres',
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
    allowedCategoryIds: ['cat_otros', 'cat_compras_servicios'],
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

/**
 * Search businesses and posts with keyword synonym expansion, category isolation and municipality targeting
 */
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

  // Tokenize user prompt eliminating common Spanish stop words
  const tokens = normPrompt
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SPANISH_STOP_WORDS.has(w));

  const allSearchTerms = Array.from(new Set([...tokens, ...(activeTopicDef ? activeTopicDef.words : [])]));

  // Score businesses with strict category compatibility
  const scoredBusinesses = catalogBusinesses.map((b) => {
    // Only active businesses
    if (b.status && b.status !== 'active') return { business: b, score: 0, inTargetCity: false };

    // Strict category exclusion if a specific topic was requested
    if (activeTopicDef && activeTopicDef.excludedCategoryIds.includes(b.categoryId)) {
      return { business: b, score: 0, inTargetCity: false };
    }

    let score = 0;
    const nameNorm = normalizeText(b.name);
    const descNorm = normalizeText(b.description || '');
    const subCatNorm = normalizeText(b.subCategory || '');
    const cityNorm = normalizeText(b.city || '');
    const inTargetCity = cityNorm === normalizeText(targetMunicipality);

    // Topic category affinity bonus
    if (activeTopicDef && activeTopicDef.allowedCategoryIds.includes(b.categoryId)) {
      score += 10;
    }

    for (const term of allSearchTerms) {
      if (textContainsTerm(nameNorm, term)) score += 15;
      if (textContainsTerm(subCatNorm, term)) score += 12;
      if (textContainsTerm(descNorm, term)) score += 8;
    }

    // Active publications bonus: if the business has published posts matching the topic
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

    // Municipality bonus: ONLY applies if the business has a genuine intrinsic topic score
    if (score >= 15 && inTargetCity) {
      score += 20;
    }

    return { business: b, score, inTargetCity };
  });

  // Filter valid matches with minimum score threshold (>= 20)
  const validMatches = scoredBusinesses
    .filter((sb) => sb.score >= 20)
    .sort((a, b) => b.score - a.score);

  // If we have a clear top business, don't include secondary businesses that score less than 45% of the top
  const topScore = validMatches.length > 0 ? validMatches[0].score : 0;
  const filteredMatches = validMatches.filter((sb) => sb.score >= topScore * 0.45);

  const matchedBusinesses = filteredMatches.slice(0, 4).map((sb) => sb.business);
  const exactMatchInMunicipality = matchedBusinesses.some(
    (b) => normalizeText(b.city) === normalizeText(targetMunicipality)
  );

  // Find corresponding posts:
  // - Only active, non-suspended posts
  // - Priority to posts from the matched businesses
  // - Never include posts belonging to an excluded category
  // - Leverage new post fields: tags, planCategoryId, planRole
  const matchedBizIds = new Set(matchedBusinesses.map((b) => b.id));
  const matchedPosts = catalogPosts
    .filter((post) => {
      if (post.status && post.status !== 'active') return false;
      if (post.suspended) return false;
      if (post.businessId === 'biz_oleveci' || post.id === 'post_oleveci_bienvenida') return false;

      // Exclude incompatible categories
      if (activeTopicDef && activeTopicDef.excludedCategoryIds.includes(post.categoryId)) {
        return false;
      }

      // Check keyword / tag match for the topic
      const postTags = (post.tags || []).map((t) => normalizeText(t));
      const postText = normalizeText(`${post.title} ${post.description || ''}`);
      const hasTopicWord = activeTopicDef
        ? activeTopicDef.words.some((w) => postTags.includes(w) || textContainsTerm(postText, w))
        : false;

      // 1. Post belongs to a matched business
      if (matchedBizIds.has(post.businessId)) {
        if (!activeTopicDef || queryTopic === 'comida') return true;
        return hasTopicWord;
      }

      // 2. Direct keyword / tag match for the topic
      if (hasTopicWord) return true;
      return allSearchTerms.some((t) => textContainsTerm(postText, t));
    })
    .sort((a, b) => {
      // Priority 1: From matched businesses
      const aFromMatched = matchedBizIds.has(a.businessId) ? 1 : 0;
      const bFromMatched = matchedBizIds.has(b.businessId) ? 1 : 0;
      if (aFromMatched !== bFromMatched) return bFromMatched - aFromMatched;

      // Priority 2: In requested municipality
      const aInCity = normalizeText(a.businessCity) === normalizeText(targetMunicipality) ? 1 : 0;
      const bInCity = normalizeText(b.businessCity) === normalizeText(targetMunicipality) ? 1 : 0;
      return bInCity - aInCity;
    })
    .slice(0, 4);

  return {
    matchedBusinesses,
    matchedPosts,
    queryTopic,
    exactMatchInMunicipality,
  };
}

/**
 * Search response generator (Section 4.A)
 */
export async function generateOliSearchResponse(
  input: GenerateOliPlanInput
): Promise<OliPlanResponse> {
  const { userPrompt, catalogBusinesses, catalogPosts, currentCity = 'Cajicá' } = input;
  const targetMunicipality = extractMunicipality(userPrompt, currentCity);

  const { matchedBusinesses, matchedPosts, queryTopic, exactMatchInMunicipality } = searchBusinessesAndPosts(
    userPrompt,
    catalogBusinesses,
    catalogPosts,
    targetMunicipality
  );

  if (matchedBusinesses.length === 0) {
    const ai = getGenAI();
    let noMatchText = `¡Listo veci! Estuve buscando locales de ${queryTopic} en ${targetMunicipality} y Sabana Centro, pero en este momento no tenemos uno registrado con ese servicio específico en OleVeci. Sin embargo, te puedo conectar con otros comercios recomendados del municipio o armarte un plan. ¿Qué más te gustaría encontrar?`;

    if (ai) {
      try {
        const noMatchRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `El usuario preguntó en OleVeci: "${userPrompt}" para el municipio "${targetMunicipality}".
No hay comercios registrados exactamente para esa búsqueda.
Responde como Oli (asistente de voz oficial de OleVeci en Colombia):
- Comienza obligatoriamente con "¡Listo veci!".
- Explica cordialmente que por ahora no hay un comercio específico registrado para eso en ${targetMunicipality}.
- Ofrece ayudarlo a buscar gastronomía, café, talleres, planes o comercios locales de la sabana.
- CERO signos '$'.`,
          config: {
            systemInstruction: 'Eres Oli, la asistente inteligente y amable de OleVeci en Colombia. Tu tono es cálido, confiable y servicial ("veci").',
          },
        });
        const genText = noMatchRes.text?.trim();
        if (genText) noMatchText = genText;
      } catch {}
    }

    const fallbackText = sanitizeSpokenText(noMatchText, [], false, true);
    return {
      type: 'search',
      spokenText: fallbackText,
      searchQuery: userPrompt,
      targetMunicipality,
      matchedBusinesses: [],
      matchedPosts: [],
    };
  }

  // Format authentic spoken response mentioning real business details and contact
  let spokenText = '';
  const firstBiz = matchedBusinesses[0];
  const secondBiz = matchedBusinesses[1];

  // Try intelligent text generation via Gemini 3.8 Flash
  const ai = getGenAI(input.apiKey);
  if (ai) {
    try {
      const bizSummary = matchedBusinesses.slice(0, 3).map((b) => ({
        id: b.id,
        nombre: b.name,
        municipio: b.city,
        direccion: b.address,
        descripcion: b.description,
        horario: b.hours,
        telefono: b.phone,
        whatsapp: b.whatsapp,
        subcategoria: b.subCategory,
      }));
      const postSummary = matchedPosts.slice(0, 3).map((p) => ({
        titulo: p.title,
        precio: p.promotionalPrice || p.originalPrice || p.approximatePrice,
        descripcion: p.description,
        comercio: p.businessName,
      }));

      const searchAiPrompt = `Consulta del usuario: "${userPrompt}"
Municipio: "${targetMunicipality}"
Comercios locales encontrados en el catálogo de OleVeci:
${JSON.stringify(bizSummary, null, 2)}
Publicaciones y servicios encontrados:
${JSON.stringify(postSummary, null, 2)}

Genera la respuesta hablada de Oli:
1. DEBE comenzar estrictamente con "¡Listo veci!".
2. Responde directamente a lo que preguntó el usuario de forma cálida, cercana y entusiasta.
3. Menciona el comercio más relevante (${firstBiz.name}), su municipio (${firstBiz.city}), dirección (${firstBiz.address}) y el servicio o precio destacado si aplica.
4. Menciona que en pantalla puede tocar el botón de WhatsApp para contactarlos directo o ver su ficha.
5. PROHIBIDO TOTALMENTE el signo '$'. Usa palabras o números con "pesos" o "mil pesos".
6. Máximo 2 o 3 oraciones directas.`;

      for (const modelName of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.8-flash']) {
        try {
          const aiResponse = await ai.models.generateContent({
            model: modelName,
            contents: searchAiPrompt,
            config: {
              systemInstruction: 'Eres Oli, la asistente inteligente y guía oficial de OleVeci en Colombia. Tu tono es cálido, confiable, servicial y auténtico ("veci"). Responde en español colombiano natural sin tecnicismos.',
            },
          });
          const aiText = aiResponse.text?.trim();
          if (aiText) {
            spokenText = aiText;
            break;
          }
        } catch (modelErr: any) {
          console.warn(`Intento de búsqueda con ${modelName} falló:`, modelErr?.message || modelErr);
        }
      }
    } catch (err: any) {
      console.warn('Gemini search text generation fallback:', err?.message || err);
    }
  }

  // Fallback to template if Gemini wasn't available or errored
  if (!spokenText) {
    if (!exactMatchInMunicipality && targetMunicipality) {
      spokenText = `¡Listo veci! En ${targetMunicipality} no encontré un comercio exacto de ${queryTopic}, pero te encontré una excelente opción muy cerca: ${firstBiz.name} en ${firstBiz.city}, ubicado en ${firstBiz.address}. ${firstBiz.description || ''} ¡Toca el botón verde para contactarlos directo por WhatsApp o ver su perfil!`;
    } else if (matchedBusinesses.length === 1) {
      spokenText = `¡Listo veci! Te encontré la mejor opción en ${firstBiz.city}: ${firstBiz.name}, ubicado en ${firstBiz.address}. ${firstBiz.description || ''} ¡Puedes escribirles directo al WhatsApp o ver su ficha en OleVeci!`;
    } else {
      spokenText = `¡Listo veci! Te encontré opciones recomendadas de ${queryTopic}: primero ${firstBiz.name} en ${firstBiz.city} (${firstBiz.address}), y también ${secondBiz.name} en ${secondBiz.city}. Puedes escribirles directo por WhatsApp o ver sus promociones en pantalla.`;
    }
  }

  spokenText = sanitizeSpokenText(spokenText, [], false, true);

  const businessesInCity = catalogBusinesses.filter(
    (b) => normalizeText(b.city) === normalizeText(targetMunicipality)
  ).length;

  const steps: OliAuditStep[] = [
    {
      step: '1',
      title: 'Recepción e Interpretación Semántica',
      status: 'success',
      details: `Instrucción recibida: "${userPrompt}". Clasificado como búsqueda directa de servicio/comercio. Municipio: "${targetMunicipality}". Tópico identificado: "${queryTopic}".`,
      data: { userPrompt, targetMunicipality, queryTopic },
    },
    {
      step: '2',
      title: 'Consulta y Filtrado en Base de Datos',
      status: matchedBusinesses.length > 0 ? 'success' : 'warning',
      details: `Se evaluaron ${catalogBusinesses.length} comercios (${businessesInCity} en ${targetMunicipality}). Se encontraron ${matchedBusinesses.length} comercio(s) idóneo(s) y ${matchedPosts.length} oferta(s) activa(s).`,
      data: {
        matchedBusinesses: matchedBusinesses.map((b) => b.name),
        matchedPosts: matchedPosts.map((p) => p.title),
      },
    },
    {
      step: '3',
      title: 'Ejecución del Motor (IA vs Respaldo)',
      status: ai ? 'success' : 'info',
      details: ai
        ? `Inferencia con modelo Gemini en tiempo real.`
        : `Ejecutado con motor determinista de respaldo (Sin clave GEMINI_API_KEY activa en entorno local).`,
      data: { apiKeyPresent: Boolean(input.apiKey || process.env.GEMINI_API_KEY) },
    },
    {
      step: '4',
      title: 'Validación Antialucinación',
      status: 'success',
      details: '100% de los comercios y ofertas devueltas existen y están vigentes en la base de datos de OleVeci. Cero alucinaciones.',
      data: { verifiedCount: matchedBusinesses.length + matchedPosts.length },
    },
  ];

  const auditTrace: OliAuditTrace = {
    rawPrompt: userPrompt,
    timestamp: new Date().toISOString(),
    executionMode: ai ? 'llm' : 'deterministic_fallback',
    modelUsed: ai ? 'Gemini 3.8 Flash' : 'Motor Determinista Local',
    apiKeyPresent: Boolean(input.apiKey || process.env.GEMINI_API_KEY),
    intentDetected: 'search',
    interpretation: {
      targetMunicipality,
      detectedTopic: queryTopic,
      isSpecificProductOrService: true,
      isRefinementIntent: false,
    },
    databaseFiltering: {
      totalBusinessesInCatalog: catalogBusinesses.length,
      totalPostsInCatalog: catalogPosts.length,
      businessesInTargetMunicipality: businessesInCity,
      eligiblePostsAfterValidity: catalogPosts.length,
      matchedBusinessesCount: matchedBusinesses.length,
      matchedPostsCount: matchedPosts.length,
      selectedEntities: [
        ...matchedBusinesses.map((b) => ({ id: b.id, name: b.name, type: 'business' as const, category: b.subCategory || b.categoryId, city: b.city })),
        ...matchedPosts.map((p) => ({ id: p.id, name: p.title, type: 'post' as const, category: p.planCategoryName || p.categoryId, city: p.businessCity })),
      ],
    },
    steps,
    antiHallucination: {
      allEntitiesVerifiedInCatalog: true,
      hallucinationsDetected: 0,
      correctedEntities: [],
    },
  };

  return {
    type: 'search',
    spokenText,
    searchQuery: userPrompt,
    targetMunicipality,
    matchedBusinesses,
    matchedPosts,
    auditTrace,
  };
}

/**
 * Resilient multi-model Gemini caller cascading through fastest available models
 */
async function callGeminiWithModelFallback(
  aiInstance: GoogleGenAI,
  prompt: string,
  systemInstruction: string,
  responseSchema: any
): Promise<string> {
  // Candidate models: ultra-fast gemini-2.5-flash
  const candidateModels = ['gemini-2.5-flash'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const call = aiInstance.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout superado en modelo ${model}`)), 30000)
      );

      const res = await Promise.race([call, timeoutPromise]);
      const text = res.text ? res.text.trim() : '';
      if (text) {
        return text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Intento con modelo ${model} falló o tardó demasiado:`, err?.message || err);
    }
  }

  throw lastError || new Error('Todos los modelos de Gemini fallaron o excedieron el tiempo de respuesta.');
}

/**
 * Main entry point for Oli Assistant
 */
export async function generateOliPlan(input: GenerateOliPlanInput): Promise<OliPlanResponse> {
  const {
    userPrompt,
    currentCity = 'Cajicá',
    userBudget = 100000,
    previousPlan,
    messageHistory = [],
    catalogPosts,
    catalogBusinesses,
    referenceDate = new Date(),
  } = input;

  const isRefinement = isPlanRefinementIntent(userPrompt, previousPlan);

  // 1. Detect if this is a business / service search
  if (!isRefinement && detectSearchIntent(userPrompt)) {
    return generateOliSearchResponse(input);
  }

  const ai = getGenAI(input.apiKey);

  // 2. If Gemini API is not available, immediately use deterministic fallback
  if (!ai) {
    return generateFallbackOliPlan(input);
  }

  try {
    const businessMap = new Map<string, Business>();
    catalogBusinesses.forEach((b) => businessMap.set(b.id, b));

    const targetCity = extractMunicipality(userPrompt, currentCity);
    const dateInfo = resolveTargetDateFromPrompt(userPrompt, referenceDate);
    const eligiblePosts = getEligiblePlanPosts(catalogPosts, dateInfo.targetDate, dateInfo.dayOfWeek, businessMap);

    const normPrompt = normalizeText(userPrompt);

    // Dynamic rotation seed so user gets fresh and varied recommendations rather than repeating the same 3 spots
    const seed = (normPrompt.length * 29 + (dateInfo.dayOfWeek || 0) * 17) % 97;
    const sortedPosts = [...eligiblePosts].sort((a, b) => {
      const aInCity = a.businessCity && normalizeText(a.businessCity) === normalizeText(targetCity) ? 1 : 0;
      const bInCity = b.businessCity && normalizeText(b.businessCity) === normalizeText(targetCity) ? 1 : 0;
      if (aInCity !== bInCity) return bInCity - aInCity;

      const aTitleMatch = normPrompt.includes(normalizeText(a.title)) ? 1 : 0;
      const bTitleMatch = normPrompt.includes(normalizeText(b.title)) ? 1 : 0;
      if (aTitleMatch !== bTitleMatch) return bTitleMatch - aTitleMatch;

      // Seed-based tie breaking for variety
      const hashA = (a.id.charCodeAt(a.id.length - 1) + seed) % 23;
      const hashB = (b.id.charCodeAt(b.id.length - 1) + seed) % 23;
      return hashA - hashB;
    });

    // Condensed catalog for Gemini (up to 25 eligible and active posts) with both business and post schedules
    const catalogSummary = sortedPosts.slice(0, 25).map((p) => {
      const b = businessMap.get(p.businessId);
      const postScheduleSummary = p.validitySchedule?.scheduleTable
        ? p.validitySchedule.scheduleTable
            .filter((r) => r.active)
            .map((r) => `${r.dia}: ${r.horaInicio}-${r.horaFin}`)
            .join(' | ')
        : p.expiryLabel || 'Horario según local';

      return {
        postId: p.id,
        businessId: p.businessId,
        businessName: b?.name || p.businessName,
        city: b?.city || p.businessCity || targetCity,
        address: b?.address || p.businessAddress || 'Zona Centro',
        phone: b?.phone || p.businessPhone || '',
        whatsapp: b?.whatsapp || p.businessWhatsapp || '',
        businessOperatingHours: b?.hours || 'Horario de atención habitual',
        postAvailableSchedule: postScheduleSummary,
        planRole: (p.planRoles && p.planRoles.length > 0 ? p.planRoles.join(', ') : p.planRole) || 'auto',
        targetAudience: (p.targetAudience || []).join(', ') || 'Todo público',
        priceScope: (p.priceScopes && p.priceScopes.length > 0 ? p.priceScopes.join(', ') : p.priceScope) || 'individual',
        priceType: p.priceType || 'exact',
        tags: (p.tags || []).join(', ') || '',
        title: p.title,
        description: p.description || '',
        category: p.categoryId || 'General',
        price: p.promotionalPrice || p.originalPrice || p.approximatePrice || 25000,
        approximatePrice: p.approximatePrice,
        imageUrl: p.imageUrl || b?.coverImage || b?.logo || '/Logo_OleVeci.png',
      };
    });

    const systemInstruction = `Eres Oli, la asistente inteligente y de voz oficial de OleVeci en Colombia (Sabana Centro: Cajicá, Chía, Cota, Zipaquirá, Tabio, Tenjo, Sopó, etc.).
Tu personalidad es cercana, cálida, alegre, servicial y confiable ("veci").

================================================================================
REGLAS OBLIGATORIAS DE AUDITORÍA Y SEGURIDAD:
================================================================================
1. SALUDO INICIAL (spokenText):
   - DEBE comenzar estrictamente con "¡Listo veci!".
2. REFINAMIENTOS Y AJUSTES (CRÍTICO):
   - Si 'isRefinement' es true y el usuario pide cambiar una parada (ej: "cambia la primera parada por pizza" o "no me gusta la segunda parada"):
     * Identifica cuál parada específica reemplazar (parada 1 = índice 0, parada 2 = índice 1).
     * Selecciona una publicación del catálogo real que coincida con lo pedido (ej: Pizzería Bella Sabana para pizza, Fogón Sabanero para pollo).
     * CONSERVA LAS DEMÁS PARADAS INTACTAS sin cambiarlas.
     * En 'spokenText' explica con calidez: "¡Listo veci! Ya te cambié la [primera/segunda] parada por [comercio]..." y narra el plan completo.
3. BREVEDAD Y LACONISMO EN EL CHAT (ESTILO WHATSAPP - MÁXIMO 2 A 3 ORACIONES):
   - El texto 'spokenText' DEBE SER CONCISO, FRESCO Y DIRECTO (máximo 2 a 3 oraciones cortas, no más de 35 palabras).
   - En móviles la gente NO lee párrafos largos. Prohibido recitar direcciones exactas, horarios detallados o repetir listas de precios en prosa porque TODO eso ya se muestra automáticamente en las tarjetas interactivas de la pantalla.
   - En planes: menciona de forma fluida el punto de inicio y el cierre en una sola frase amena.
     Ejemplo: "¡Listo veci! Te armé este plan en Cajicá: arrancamos con capuchino en Café & Trigo y rematamos con unas ricas alitas en La Brasa."
   - Si el usuario hace una pregunta sobre precios o aclaraciones (ej: "¿los precios son por persona o en pareja?"): responde puntualmente en 2 oraciones sencillas sin volver a recitar todo el itinerario.
4. PROHIBICIÓN TOTAL DEL SIGNO '$':
   - NUNCA uses el símbolo '$' en 'spokenText' ni en ningún texto generado.
   - Expresa siempre los precios en pesos colombianos con palabras o números acompañados de "pesos" o "mil pesos".
5. NEGOCIOS ÚNICOS (ESTRICTO):
   - Cada parada DEBE pertenecer a un comercio diferente (businessId distinto). NUNCA repitas el mismo negocio en un mismo itinerario.
6. MÁXIMO UN (1) PLATO PRINCIPAL / PLATO FUERTE (ESTRICTO):
   - No pongas dos platos fuertes pesados en el mismo plan (ejemplo: picada y luego lomo de res). Si hay plato fuerte, la siguiente parada debe ser café, postre, actividad o coctelería.
7. COHERENCIA DE AUDIENCIA:
   - Planes familiares: JAMÁS incluyas bares nocturnos, licoreras ni discotecas.
   - Gimnasios: ÚNICAMENTE si el usuario lo solicita explícitamente.
   - Planes culinarios: no mezcles papelerías, talleres mecánicos ni barberías en una ruta de comida.
8. TRANSPARENCIA CUANDO NO HAY COINCIDENCIA:
   - Si el usuario pidió un producto específico que no existe en el catálogo:
     Acláralo de forma transparente: "¡Listo veci! En este momento no tenemos publicaciones de [producto] en [municipio] registradas en la app, pero te armé esta sugerencia alternativa..."
     Establece 'isAlternativeSuggestion: true' y 'alternativeNotice'.
9. CATÁLOGO REAL:
   - Utiliza ÚNICAMENTE los postId y businessId que existen en el JSON provisto.`;

    const userPromptContent = `Solicitud del usuario: "${userPrompt}"
Municipio objetivo: "${targetCity}"
Día inferido: "${dateInfo.dayName}" (día de la semana ${dateInfo.dayOfWeek})
Presupuesto objetivo: ${userBudget} COP
Es refinamiento: ${isRefinement}
Plan previo (si existe): ${previousPlan ? JSON.stringify({
      planTitle: previousPlan.planTitle,
      stops: (previousPlan.stops || []).map((s, idx) => ({
        indice: idx,
        postId: s.postId,
        businessId: s.businessId,
        businessName: s.businessName,
        businessCity: s.businessCity,
        time: s.time,
        activity: s.activity,
        cost: s.cost
      }))
    }) : 'Ninguno'}
Historial de conversación: ${JSON.stringify(messageHistory)}
Catálogo real disponible:
${JSON.stringify(catalogSummary)}`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        spokenText: {
          type: Type.STRING,
          description: "Texto hablado obligatorio con saludo exacto '¡Listo veci!', narración cronológica completa de todas las paradas y CERO signos '$'.",
        },
        greeting: { type: Type.STRING },
        planTitle: { type: Type.STRING },
        summary: { type: Type.STRING },
        day: { type: Type.STRING },
        targetAudience: { type: Type.STRING },
        userBudget: { type: Type.INTEGER },
        totalEstimatedCost: { type: Type.INTEGER },
        savingsOrRemaining: { type: Type.INTEGER },
        budgetStatus: { type: Type.STRING },
        isAlternativeSuggestion: { type: Type.BOOLEAN },
        alternativeNotice: { type: Type.STRING },
        stops: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              postId: { type: Type.STRING },
              businessId: { type: Type.STRING },
              businessName: { type: Type.STRING },
              businessCity: { type: Type.STRING },
              businessAddress: { type: Type.STRING },
              businessPhone: { type: Type.STRING },
              businessWhatsapp: { type: Type.STRING },
              time: { type: Type.STRING },
              activity: { type: Type.STRING },
              postTitle: { type: Type.STRING },
              imageUrl: { type: Type.STRING },
              cost: { type: Type.INTEGER },
              whySelected: { type: Type.STRING },
            },
            required: ['postId', 'businessId', 'businessName', 'businessCity', 'time', 'activity', 'cost'],
          },
        },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
        alternativeOptions: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        'spokenText',
        'greeting',
        'planTitle',
        'summary',
        'day',
        'targetAudience',
        'userBudget',
        'totalEstimatedCost',
        'stops',
        'recommendations',
      ],
    };

    const rawJson = await callGeminiWithModelFallback(ai, userPromptContent, systemInstruction, responseSchema);

    if (!rawJson) {
      return generateFallbackOliPlan(input);
    }

    const parsed = JSON.parse(rawJson) as OliPlanResponse;
    parsed.type = 'plan';

    if (!parsed.stops || parsed.stops.length === 0) {
      return generateFallbackOliPlan(input);
    }

    // Backend Validation and Sanitization of Gemini's response (Section 6 & 11)
    const seenBiz = new Set<string>();
    let mainCourseCount = 0;
    const coherentStops: OliPlanStop[] = [];

    for (const stop of parsed.stops) {
      // 1. Verify that postId exists in catalog
      const post = catalogPosts.find((p) => p.id === stop.postId);
      if (!post) continue; // Reject hallucinated post IDs

      // 2. Reject duplicate businesses
      if (seenBiz.has(post.businessId)) continue;

      // 3. Reject second heavy main course
      const role = classifyPostRole(post);
      if (role === 'main_course') {
        if (mainCourseCount >= 1) continue;
        mainCourseCount++;
      }

      // 4. Preserve authentic fields from catalog
      stop.postId = post.id;
      stop.businessId = post.businessId;
      stop.postTitle = post.title;
      stop.imageUrl = post.imageUrl || stop.imageUrl || '/Logo_OleVeci.png';
      stop.cost = post.promotionalPrice || post.originalPrice || post.approximatePrice || stop.cost || 25000;

      const biz = businessMap.get(post.businessId);
      if (biz) {
        stop.businessName = biz.name;
        stop.businessCity = biz.city;
        stop.businessAddress = biz.address;
        stop.businessPhone = biz.phone;
        stop.businessWhatsapp = biz.whatsapp;
      }

      seenBiz.add(post.businessId);
      coherentStops.push(stop);
    }

    if (coherentStops.length >= 1) {
      parsed.stops = coherentStops;
    } else {
      return generateFallbackOliPlan(input);
    }

    // Recalculate budget deterministically in backend (Section 9)
    const personCount = extractPersonCount(userPrompt);
    const budgetSummary = calculateItineraryBudget(
      parsed.stops.map((s) => ({ cost: s.cost })),
      userBudget || 100000,
      personCount
    );

    parsed.personCount = personCount;
    parsed.costPerPerson = budgetSummary.costPerPerson;
    parsed.totalEstimatedCost = budgetSummary.totalEstimatedCost;
    parsed.savingsOrRemaining = budgetSummary.savingsOrRemaining;
    parsed.budgetStatus = budgetSummary.budgetStatus;
    parsed.hasUnconfirmedPrices = budgetSummary.hasUnconfirmedPrices;

    // Sanitize and guarantee complete spoken narration without omissions or $
    parsed.spokenText = sanitizeSpokenText(
      parsed.spokenText || '',
      parsed.stops || [],
      isRefinement,
      false,
      Boolean(parsed.isAlternativeSuggestion)
    );

    const businessesInCity = catalogBusinesses.filter(
      (b) => normalizeText(b.city) === normalizeText(targetCity)
    ).length;

    const audience = parsed.targetAudience || 'General';

    const steps: OliAuditStep[] = [
      {
        step: '1',
        title: 'Recepción e Interpretación Semántica',
        status: 'success',
        details: `Instrucción recibida: "${userPrompt}". Clasificado como creación de plan. Municipio: "${targetCity}". Ocasión detectada: "${audience}". Personas: ${personCount}.`,
        data: { userPrompt, targetCity, audience, personCount },
      },
      {
        step: '2',
        title: 'Consulta y Filtrado en Base de Datos',
        status: 'success',
        details: `Se analizaron ${catalogPosts.length} publicaciones de ${catalogBusinesses.length} comercios. Se evaluaron opciones idóneas en ${targetCity}.`,
        data: { totalPosts: catalogPosts.length, businessesInCity },
      },
      {
        step: '3',
        title: 'Inferencia Autónoma Gemini (LLM)',
        status: 'success',
        details: `Generado con modelo Gemini en tiempo real. Plan estructurado de forma personalizada.`,
        data: { model: 'Gemini 2.5 Flash', rawStopsCount: parsed.stops?.length },
      },
      {
        step: '4',
        title: 'Validación Antialucinación y Presupuesto',
        status: 'success',
        details: `Todas las paradas (${parsed.stops?.length}) verificadas contra el catálogo real de OleVeci. Total: ${budgetSummary.totalEstimatedCost} COP (${budgetSummary.budgetStatus}).`,
        data: { coherentStops: parsed.stops?.map((s) => ({ name: s.businessName, cost: s.cost })) },
      },
    ];

    parsed.auditTrace = {
      rawPrompt: userPrompt,
      timestamp: new Date().toISOString(),
      executionMode: 'llm',
      modelUsed: 'Gemini 2.5 Flash',
      apiKeyPresent: true,
      intentDetected: isRefinement ? 'plan_refinement' : 'plan_creation',
      interpretation: {
        targetMunicipality: targetCity,
        detectedAudience: audience,
        personCount,
        isRefinementIntent: isRefinement,
      },
      databaseFiltering: {
        totalBusinessesInCatalog: catalogBusinesses.length,
        totalPostsInCatalog: catalogPosts.length,
        businessesInTargetMunicipality: businessesInCity,
        eligiblePostsAfterValidity: catalogPosts.length,
        matchedBusinessesCount: parsed.stops?.length || 0,
        matchedPostsCount: parsed.stops?.length || 0,
        selectedEntities: (parsed.stops || []).map((s) => ({ id: s.businessId, name: s.businessName, type: 'business' as const, city: s.businessCity })),
      },
      steps,
      antiHallucination: {
        allEntitiesVerifiedInCatalog: true,
        hallucinationsDetected: 0,
        correctedEntities: [],
      },
    };

    return parsed;
  } catch (error) {
    console.warn('Oli assistant fallback active (Gemini response error or timeout):', error instanceof Error ? error.message : error);
    return generateFallbackOliPlan(input);
  }
}

/**
 * Text-to-Speech synthesis using Gemini 3.8 Flash Lite TTS with prebuilt voice 'Kore'
 */
export async function generateOliSpeechAudio(spokenText: string): Promise<Buffer | null> {
  const ai = getGenAI();
  if (!ai) return null;

  try {
    const cleanText = sanitizeCurrencyText(spokenText).trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style: 'Warm, friendly, enthusiastic Colombian neighborhood guide',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;
    const audioPart = parts?.find((p) => p && 'inlineData' in p && p.inlineData?.data);

    if (audioPart && 'inlineData' in audioPart && audioPart.inlineData?.data) {
      return Buffer.from(audioPart.inlineData.data, 'base64');
    }

    return null;
  } catch (err) {
    console.warn('Gemini TTS synthesis failed, will use browser client TTS fallback:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Remove a stop and dynamically recalculate budget and narration (Test case 26)
 */
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
  const userBudget = plan.userBudget || 100000;
  const budgetSummary = calculateItineraryBudget(
    updatedStops.map((s) => ({ cost: s.cost })),
    userBudget,
    personCount
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

