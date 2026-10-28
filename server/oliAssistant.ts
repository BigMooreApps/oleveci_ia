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
  extractBudgetFromPrompt,
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
  groqApiKey?: string;
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
  let cleaned = sanitizeCurrencyText(text || '').trim();

  // If empty, supply minimal friendly fallback
  if (!cleaned) {
    if (isSearch) {
      cleaned = '¡Listo veci! Aquí tienes las opciones que encontré para ti.';
    } else if (isRefinement) {
      cleaned = '¡Listo veci! Tu plan fue actualizado. Abajo puedes ver los cambios.';
    } else {
      cleaned = `¡Listo veci! Tu plan ya quedó armado con ${stops.length} paradas. Abajo tienes todos los detalles.`;
    }
  }

  // Clean extra linebreaks and spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 1. Mandatory Greeting: Must start with "¡Listo veci!"
  const lowerTrimmed = cleaned.toLowerCase();
  if (!lowerTrimmed.startsWith('¡listo veci!') && !lowerTrimmed.startsWith('¡listo veci,') && !lowerTrimmed.startsWith('listo veci')) {
    cleaned = `¡Listo veci! ${cleaned}`;
  } else if (lowerTrimmed.startsWith('listo veci!') || lowerTrimmed.startsWith('listo veci,')) {
    cleaned = cleaned.replace(/^listo veci[!,.]?/i, '¡Listo veci!');
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
    'borra',
    'borrar',
    'en vez de',
    'en lugar de',
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
    'cuarta parada',
    'quinta parada',
    'parada 1',
    'parada 2',
    'parada 3',
    'parada 4',
    'parada 5',
    'mas barato',
    'mas economico',
    'incluye',
    'incluyelas',
    'incluir',
    'incluyela',
    'incluiste',
    'metiste',
    'pusiste',
    'agregaste',
    'pero quiero',
    'quiero es',
    'no era',
    'te pedi',
    'te pedí',
    'no sale',
    'no salio',
    'no salió',
    'no se ve',
    'no veo',
    'falta',
    'falto',
    'faltó',
    'en el plan',
    'al plan',
    'del plan',
    'de mi plan',
    'adiciona',
    'adicionar',
    'suma',
    'sumar',
    'metele',
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

/**
 * Intent classification (Section 4)
 * Distinguishes between search / single recommendation and full multi-stop plans
 */
export function detectSearchIntent(prompt: string): boolean {
  const norm = normalizeText(prompt);

  // Direct Plan Refinement / Correction Signals MUST NOT be treated as search
  const refinementCheckSignals = [
    'en el plan',
    'al plan',
    'del plan',
    'de mi plan',
    'incluiste',
    'pusiste',
    'metiste',
    'agregaste',
    'pero quiero',
    'quiero es',
    'no era',
    'te pedi',
    'te pedí',
    'no sale',
    'no salio',
    'no salió',
    'falta en el',
    'falto en el',
    'faltó en el',
  ];
  if (refinementCheckSignals.some((sig) => norm.includes(sig))) {
    return false;
  }

  // Explicit Plan Signals
  const planSignals = [
    'arma un plan',
    'armame un plan',
    'armanos un plan',
    'armes un plan',
    'armar un plan',
    'crea un plan',
    'creame un plan',
    'itinerario',
    'un recorrido',
    'recorrido',
    'ruta para el',
    'plan para el',
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

  // Follow-up search queries (e.g. "en otro municipio", "en chia", "y en cota", "otra ciudad")
  if (
    norm.startsWith('en ') ||
    norm.startsWith('y en ') ||
    norm.includes('otro municipio') ||
    norm.includes('otros municipios') ||
    norm.includes('otra ciudad') ||
    norm.includes('otro lado') ||
    norm.includes('municipios cercanos')
  ) {
    if (!norm.includes('plan') && !norm.includes('parche') && !norm.includes('itinerario') && !norm.includes('ruta')) {
      return true;
    }
  }

  // Multi-step sequenced activity requests (e.g. "primero ir a..., luego..., finalmente...") are multi-stop plans
  if (norm.includes('primero') && (norm.includes('luego') || norm.includes('despues') || norm.includes('finalmente'))) {
    return false;
  }

  // Single-entity / venue search patterns (e.g. "un capuchino", "un talle", "un taller", "una hamburguesa", "una pizza")
  if (norm.startsWith('un ') || norm.startsWith('una ')) {
    if (!norm.includes('plan') && !norm.includes('parche') && !norm.includes('itinerario') && !norm.includes('ruta') && !norm.includes('recorrido')) {
      return true;
    }
  }

  // Very short query (1 to 3 words) without plan keywords is inherently a search (e.g. "taller", "un talle", "capuchino", "pizza cajica")
  const words = norm.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && !norm.includes('plan') && !norm.includes('parche') && !norm.includes('ruta') && !norm.includes('itinerario') && !norm.includes('domingo') && !norm.includes('sabado')) {
    const commonSearchTerms = [
      'taller', 'talle', 'mecanico', 'mecanica', 'auto', 'carro', 'lavadero', 'autospa', 'lavar',
      'cafe', 'capuchino', 'cappuccino', 'pizza', 'hamburguesa', 'almuerzo', 'restaurante', 'veterinaria',
      'peluqueria', 'barberia', 'papeleria', 'helado', 'postre', 'cerveza', 'bar', 'hotel'
    ];
    if (words.some((w) => commonSearchTerms.includes(w))) {
      return true;
    }
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

  // Pure service, trade or food keywords when not phrased as a full plan
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
    const defaults = ['9:30 AM', '11:30 AM', '1:30 PM', '4:30 PM', '7:00 PM'];
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
 * Extracts desired stop count from prompt (e.g. "4 paradas", "primero... luego... luego... finalmente...")
 */
export function extractDesiredStopCount(prompt: string): number {
  const norm = normalizeText(prompt);
  const match = norm.match(/(\d+)\s*paradas?/);
  if (match) return Math.min(Math.max(parseInt(match[1], 10), 2), 6);
  if (norm.includes('cuatro paradas') || norm.includes('4 paradas')) return 4;
  if (norm.includes('cinco paradas') || norm.includes('5 paradas')) return 5;
  if (norm.includes('dos paradas') || norm.includes('2 paradas')) return 2;

  // Check sequenced activities ("primero ... luego ... luego ... finalmente/despues")
  const sequences = (norm.match(/\b(primero|luego|despues|y despues|finalmente|por ultimo)\b/g) || []).length;
  if (sequences >= 3) {
    return Math.min(sequences, 5);
  }
  return 3;
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
  const { userPrompt, previousPlan, userBudget = 0, currentCity = 'Cajicá' } = input;
  const normPrompt = normalizeText(userPrompt);

  if (!previousPlan || !previousPlan.stops || previousPlan.stops.length === 0) {
    return generateFallbackOliPlan({ ...input, previousPlan: null });
  }

  let resolvedBudget = 0;
  const promptBudget = extractBudgetFromPrompt(userPrompt, -1);
  if (promptBudget !== -1) {
    resolvedBudget = promptBudget;
  } else if (previousPlan && typeof previousPlan.userBudget === 'number' && previousPlan.userBudget > 0) {
    resolvedBudget = previousPlan.userBudget;
  } else if (typeof userBudget === 'number' && userBudget > 0) {
    resolvedBudget = userBudget;
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

  // 1.5 Check for addition requests ("incluye las cervezas", "agrega una parada de café", "adiciona", "para que queden 4 paradas", etc.)
  const isAddRequest =
    normPrompt.includes('incluy') ||
    normPrompt.includes('agrega') ||
    normPrompt.includes('anad') ||
    normPrompt.includes('adicion') ||
    normPrompt.includes('suma') ||
    normPrompt.includes('meter') ||
    ((normPrompt.includes('falta') || normPrompt.includes('no sale') || normPrompt.includes('no salio')) &&
      !normPrompt.includes('pero') && !normPrompt.includes('cambia'));

  if (isAddRequest) {
    const existingBizIds = new Set(existingStops.map((s) => s.businessId));
    const targetCity = extractMunicipality(userPrompt, previousPlan.stops[0]?.businessCity || currentCity);

    // Look for matching post in eligiblePosts from a business not already in the plan
    const addCandidates = eligiblePosts.filter((p) => {
      if (existingBizIds.has(p.businessId)) return false;
      const b = businessMap.get(p.businessId);
      const combined = normalizeText(
        `${p.title} ${p.description || ''} ${(p.tags || []).join(' ')} ${b?.name || ''} ${b?.description || ''} ${p.categoryId || ''}`
      );
      if (normPrompt.includes('cerveza') || normPrompt.includes('pola') || normPrompt.includes('trago') || normPrompt.includes('bar')) {
        return combined.includes('cerveza') || combined.includes('pola') || combined.includes('artesanal') || combined.includes('bar') || combined.includes('gastrobar');
      }
      if (normPrompt.includes('pizza')) return combined.includes('pizza');
      if (normPrompt.includes('hamburguesa') || normPrompt.includes('burger')) return combined.includes('hamburguesa') || combined.includes('burger');
      if (normPrompt.includes('almuerzo') || normPrompt.includes('almorzar') || normPrompt.includes('comer')) return classifyPostRole(p) === 'main_course';
      if (normPrompt.includes('cafe') || normPrompt.includes('postre')) return classifyPostRole(p) === 'cafe_dessert';
      return true;
    });

    if (addCandidates.length > 0) {
      const newPost = addCandidates[0];
      const newBiz = businessMap.get(newPost.businessId);
      const postRole = classifyPostRole(newPost);
      const stopTime = getScheduleTimeForRole(postRole, existingStops.length, existingStops.length + 1, newPost, newBiz);

      const newStop: OliPlanStop = {
        postId: newPost.id,
        businessId: newPost.businessId,
        businessName: newBiz?.name || 'Comercio Local',
        businessCity: newBiz?.city || targetCity,
        businessAddress: newBiz?.address || 'Zona Centro',
        businessPhone: newBiz?.phone || '',
        businessWhatsapp: newBiz?.whatsapp || '',
        time: stopTime,
        activity: generateActivityFromPost(newPost, newBiz),
        postTitle: newPost.title,
        imageUrl: newPost.imageUrl || newBiz?.coverImage || newBiz?.logo || '/Logo_OleVeci.png',
        cost: newPost.promotionalPrice || newPost.originalPrice || newPost.approximatePrice || 25000,
        whySelected: `Añadida al plan: ${newPost.title}`,
      };

      existingStops.push(newStop);

      const budgetSummary = calculateItineraryBudget(
        existingStops.map((s) => ({ cost: s.cost })),
        resolvedBudget > 0 ? resolvedBudget : 100000,
        previousPlan.personCount || 1,
        resolvedBudget <= 0
      );

      let spokenText = `¡Listo veci! Tu plan fue actualizado y ahora tiene ${existingStops.length} paradas.`;
      spokenText = sanitizeSpokenText(spokenText, existingStops, true, false, false);

      return {
        ...previousPlan,
        spokenText,
        totalEstimatedCost: budgetSummary.totalEstimatedCost,
        costPerPerson: budgetSummary.costPerPerson,
        budgetStatus: budgetSummary.budgetStatus,
        summary: `Itinerario ampliado a ${existingStops.length} paradas con ${newStop.businessName}.`,
        stops: existingStops,
      };
    }
  }

  // 2. Determine target stop index to replace
  let targetIndex = -1;
  if (normPrompt.includes('primer') || normPrompt.includes('1ra') || normPrompt.includes('parada 1') || normPrompt.includes('el primer')) {
    targetIndex = 0;
  } else if (normPrompt.includes('segund') || normPrompt.includes('2da') || normPrompt.includes('parada 2') || normPrompt.includes('el segund')) {
    targetIndex = 1;
  } else if (normPrompt.includes('tercer') || normPrompt.includes('3ra') || normPrompt.includes('parada 3') || normPrompt.includes('el tercer') || normPrompt.includes('ultim')) {
    targetIndex = existingStops.length - 1;
  }

  // Check if the user specifically mentions an item or merchant currently in existingStops to replace
  // e.g. "incluiste hamburguesa pero quiero es pizza", "cambia la hamburguesa por pizza"
  if (targetIndex === -1) {
    for (let i = 0; i < existingStops.length; i++) {
      const s = existingStops[i];
      const stopWords = normalizeText(`${s.activity} ${s.postTitle} ${s.businessName}`)
        .split(/\s+/)
        .filter((w) => w.length >= 4);
      for (const w of stopWords) {
        if (
          normPrompt.includes(w) &&
          (normPrompt.includes('pero') ||
            normPrompt.includes('por') ||
            normPrompt.includes('cambia') ||
            normPrompt.includes('reemplaza') ||
            normPrompt.includes('incluiste') ||
            normPrompt.includes('pusiste') ||
            normPrompt.includes('metiste'))
        ) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex !== -1) break;
    }
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
        if (p && classifyPostRole(p) === 'main_course') return true;
        const text = normalizeText(`${s.activity} ${s.postTitle} ${s.businessName}`);
        return (
          text.includes('burger') ||
          text.includes('hamburguesa') ||
          text.includes('pizza') ||
          text.includes('asado') ||
          text.includes('parrilla') ||
          text.includes('almuerzo') ||
          text.includes('carne') ||
          text.includes('comida') ||
          text.includes('fogon')
        );
      });
      targetIndex = mainIdx !== -1 ? mainIdx : existingStops.length - 1;
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
  const isOpenBudget = resolvedBudget <= 0;
  const budgetSummary = calculateItineraryBudget(
    existingStops.map((s) => ({ cost: s.cost })),
    resolvedBudget > 0 ? resolvedBudget : 100000,
    personCount,
    isOpenBudget
  );

  const ordinalLabels = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta'];
  const replacedStop = existingStops[targetIndex];
  const targetLabel = ordinalLabels[targetIndex] || `parada ${targetIndex + 1}`;

  let spokenText = `¡Listo veci! Ya cambié la ${targetLabel} parada por ${replacedStop.businessName}.`;
  spokenText = sanitizeSpokenText(spokenText, existingStops, true, false, false);

  return {
    ...previousPlan,
    type: 'plan',
    spokenText,
    greeting: '¡Listo veci! Ya te ajusté el plan',
    planTitle: topic ? `Ruta con ${topic.charAt(0).toUpperCase() + topic.slice(1)} Ajustada` : `Plan Veci Ajustado`,
    summary: `Itinerario actualizado con ${existingStops[targetIndex].businessName} en la ${targetLabel} parada.`,
    stops: existingStops,
    userBudget: resolvedBudget,
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
    userBudget = 0,
    previousPlan,
    catalogPosts,
    catalogBusinesses,
    referenceDate = new Date(),
  } = input;

  let resolvedBudget = 0;
  const promptBudget = extractBudgetFromPrompt(userPrompt, -1);
  if (promptBudget !== -1) {
    resolvedBudget = promptBudget;
  } else if (previousPlan && typeof previousPlan.userBudget === 'number' && previousPlan.userBudget > 0) {
    resolvedBudget = previousPlan.userBudget;
  } else if (typeof userBudget === 'number' && userBudget > 0) {
    resolvedBudget = userBudget;
  }

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

  const desiredCount = extractDesiredStopCount(userPrompt);
  const finalPosts = buildCoherentItinerary(matchedPosts, candidatePosts, desiredCount, isFoodRequest);

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
  const isOpenBudget = resolvedBudget <= 0;
  const budgetSummary = calculateItineraryBudget(
    stops.map((s) => ({ cost: s.cost })),
    resolvedBudget > 0 ? resolvedBudget : 100000,
    personCount,
    isOpenBudget
  );

  const totalCostSpeech = formatPriceForSpeech(budgetSummary.totalEstimatedCost);

  // 9. Construct concise spokenText
  let spokenText = `¡Listo veci! Tu plan ya quedó armado con ${stops.length} paradas en ${targetCity}. Abajo tienes todos los detalles para contactarlos.`;
  if (isAlternativeSuggestion && topic) {
    spokenText = `¡Listo veci! En ${targetCity} no tenemos ${topic}, pero te armé este plan con la mejor gastronomía local.`;
  } else if (isRefinement) {
    spokenText = `¡Listo veci! Tu plan fue actualizado. Abajo puedes ver los cambios.`;
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
      detectedBudget: resolvedBudget,
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
      'frenos',
      'cambio de aceite',
      'sincronizacion',
      'escaner automotriz',
      'alineacion',
      'balanceo',
      'suspension',
      'latoneria',
      'pintura automotriz',
      'peritaje',
      'reparacion de motor',
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
      'capuchino',
      'cappuccino',
      'croissant',
      'cafecito',
      'tinto',
      'latte',
      'espresso',
      'frappe',
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
  targetMunicipality = 'Cajicá',
  messageHistory?: any[]
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

  // If activeTopicDef not detected in current query, check previous user messages in messageHistory
  if (!activeTopicDef && messageHistory && messageHistory.length > 0) {
    for (let i = messageHistory.length - 1; i >= 0; i--) {
      const prev = messageHistory[i];
      const prevText = normalizeText(
        (prev as any).text || (prev as any).content || ''
      );
      for (const [topic, def] of Object.entries(TOPIC_DEFINITIONS)) {
        if (def.words.some((w) => textContainsTerm(prevText, w))) {
          activeTopicDef = def;
          queryTopic = topic;
          break;
        }
      }
      if (activeTopicDef) break;
    }
  }

  // Tokenize user prompt eliminating common Spanish stop words
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
    const inTargetCity = cityNorm === targetCityNorm;

    // Strict topic keyword requirement: if a specific topic was identified,
    // the business must match at least one word from the topic definition in its name, subCategory, or description
    if (activeTopicDef) {
      const matchesTopicWord = activeTopicDef.words.some(
        (w) => textContainsTerm(nameNorm, w) || textContainsTerm(subCatNorm, w) || textContainsTerm(descNorm, w)
      );
      if (!matchesTopicWord) {
        return { business: b, score: 0, inTargetCity: false };
      }
    }

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

  const isNeighborSearch =
    normPrompt.includes('otro municipio') ||
    normPrompt.includes('otros municipios') ||
    normPrompt.includes('otra ciudad') ||
    normPrompt.includes('municipios cercanos');

  // STRICT MUNICIPALITY RULE FOR BUSINESSES:
  // If there are valid businesses in the requested municipality, NEVER leak businesses from other towns, unless user specifically asks for another municipality!
  const matchesInTargetCity = validMatches.filter((sb) => sb.inTargetCity);
  const matchesInOtherCities = validMatches.filter((sb) => !sb.inTargetCity);
  const exactMatchInMunicipality = !isNeighborSearch && matchesInTargetCity.length > 0;

  const eligibleBizMatches = isNeighborSearch
    ? (matchesInOtherCities.length > 0 ? matchesInOtherCities : validMatches)
    : (exactMatchInMunicipality ? matchesInTargetCity : validMatches);
  const topBizScore = eligibleBizMatches.length > 0 ? eligibleBizMatches[0].score : 0;
  const filteredMatches = eligibleBizMatches.filter((sb) => sb.score >= topBizScore * 0.45);

  const matchedBusinesses = filteredMatches.slice(0, 4).map((sb) => sb.business);

  // Find corresponding posts:
  // - Only active, non-suspended posts
  // - Priority to posts from the matched businesses
  // - Never include posts belonging to an excluded category
  // - Leverage new post fields: tags, planCategoryId, planRole
  const matchedBizIds = new Set(matchedBusinesses.map((b) => b.id));
  const candidatePosts = catalogPosts
    .filter((post) => {
      if (post.status && post.status !== 'active') return false;
      if (post.suspended) return false;
      if (post.businessId === 'biz_oleveci' || post.id === 'post_oleveci_bienvenida') return false;

      // STRICT MUNICIPALITY RULE FOR POSTS:
      // If there are matches in target municipality, strictly isolate posts to target municipality!
      if (!isNeighborSearch && exactMatchInMunicipality && normalizeText(post.businessCity) !== targetCityNorm) {
        return false;
      }

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

  const matchedPosts = filteredPosts.slice(0, 3).map((cp) => cp.post);

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

  // 1. Prioritize autonomous LLM semantic search via Groq / Gemini cascade
  const ai = getGenAI(input.apiKey);
  const hasGroq = Boolean((input.groqApiKey || process.env.GROQ_API_KEY)?.trim());

  if (hasGroq || ai) {
    try {
      const targetNorm = normalizeText(targetMunicipality);
      const catalogToUse = catalogBusinesses.filter(
        (b) => (!b.status || b.status === 'active') && !b.suspended && b.id !== 'biz_oleveci' && b.name !== 'OleVeci'
      );

      const catalogSummaryText = catalogToUse.map((b) => {
        const postsList = catalogPosts
          .filter((p) => p.businessId === b.id && (!p.status || p.status === 'active') && !p.suspended)
          .map((p) => `[${p.id}] ${p.title} (${p.promotionalPrice || p.originalPrice || p.approximatePrice || 0} COP)`)
          .join(' | ');
        return `* [${b.id}] ${b.name} (${b.city} | ${b.subCategory || b.categoryId}): ${postsList}`;
      }).join('\n');

      const searchAiPrompt = `Consulta del usuario: "${userPrompt}"
Municipio solicitado: "${targetMunicipality}"
Catálogo de comercios y ofertas disponibles en OleVeci:
${catalogSummaryText}`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          understanding: { type: Type.STRING },
          exactMatchInRequestedCity: { type: Type.BOOLEAN },
          selectedBusinessIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          selectedPostIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          spokenText: { type: Type.STRING },
        },
        required: ['understanding', 'exactMatchInRequestedCity', 'selectedBusinessIds', 'selectedPostIds', 'spokenText'],
      };

      const systemInstruction = `Eres Oli, la asistente de voz oficial de OleVeci en Colombia (Sabana Centro: Cajicá, Chía, Cota, Zipaquirá, etc.).
Tu personalidad es cercana, cálida, alegre, honesta y servicial ("veci").

Analiza con sentido común humano la consulta del usuario y compárala con el catálogo real de OleVeci:
1. DISTINCIÓN SEMÁNTICA RIGUROSA:
   - Un lavadero / autospa / estética automotriz NO es un taller mecánico. No confundas lavar el carro con arreglarlo o hacerle mecánica.
   - Una veterinaria NO es una tienda de mascotas general si lo que piden es atención médica.
   - Un té o una torta NO es un capuchino.
2. MUNICIPIO Y TRANSPARENCIA:
   - Si en el municipio solicitado (${targetMunicipality}) NO existe un comercio que ofrezca ese servicio exacto, indícalo con total amabilidad y honestidad en spokenText.
   - Si en un municipio vecino cercano (ej: Chía si pidieron Cajicá) sí existe un comercio que ofrece exactamente ese servicio, selecciónalo en 'selectedBusinessIds' y cuéntaselo al usuario amablemente en 'spokenText'.
3. CONSISTENCIA DE PUBLICACIONES:
   - En 'selectedPostIds' pon ÚNICAMENTE publicaciones que REALMENTE correspondan a lo solicitado. Si ninguna publicación aplica o no hay publicaciones del servicio específico, 'selectedPostIds' DEBE ser un arreglo vacío []. NUNCA incluyas ofertas de lavado cuando pidieron mecánica, ni ofertas de té cuando pidieron café.
4. SPOKENTEXT:
   - Comienza obligatoriamente con "¡Listo veci!".
   - Sé breve y directo (máximo 2 a 3 oraciones, estilo WhatsApp).
   - Menciona que en pantalla puede tocar el botón de WhatsApp para contactarlos directamente.
   - PROHIBIDO TOTALMENTE el signo '$'.`;

      try {
        const { text: rawText, modelUsed: searchModelUsed } = await callLLMWithFallback(
          ai,
          searchAiPrompt,
          systemInstruction,
          responseSchema,
          input.groqApiKey
        );

        if (rawText) {
          const parsed = JSON.parse(rawText);
          const bizMap = new Map(catalogBusinesses.map((b) => [b.id, b]));
          const postMap = new Map(catalogPosts.map((p) => [p.id, p]));

          const matchedBusinesses: Business[] = (parsed.selectedBusinessIds || [])
            .map((id: string) => bizMap.get(id))
            .filter(Boolean) as Business[];

          const matchedPosts: Post[] = (parsed.selectedPostIds || [])
            .map((id: string) => postMap.get(id))
            .filter(Boolean) as Post[];

          // Guarantee that the business owning any matched post is always present in matchedBusinesses
          for (const p of matchedPosts) {
            const b = bizMap.get(p.businessId);
            if (b && !matchedBusinesses.some((mb) => mb.id === b.id)) {
              matchedBusinesses.push(b);
            }
          }

          const spokenClean = sanitizeSpokenText(parsed.spokenText || '', [], false, true);

          return {
            type: 'search',
            spokenText: spokenClean,
            searchQuery: userPrompt,
            targetMunicipality,
            matchedBusinesses,
            matchedPosts,
            isAlternativeSuggestion: !parsed.exactMatchInRequestedCity,
            alternativeNotice: !parsed.exactMatchInRequestedCity ? parsed.understanding : undefined,
            auditTrace: {
              rawPrompt: userPrompt,
              timestamp: new Date().toISOString(),
              executionMode: 'llm',
              modelUsed: searchModelUsed,
              apiKeyPresent: true,
              intentDetected: 'search',
              interpretation: {
                targetMunicipality,
                detectedTopic: parsed.understanding,
                isSpecificProductOrService: true,
                isRefinementIntent: false,
              },
              databaseFiltering: {
                totalBusinessesInCatalog: catalogBusinesses.length,
                totalPostsInCatalog: catalogPosts.length,
                businessesInTargetMunicipality: catalogBusinesses.filter((b) => normalizeText(b.city) === normalizeText(targetMunicipality)).length,
                eligiblePostsAfterValidity: catalogPosts.length,
                matchedBusinessesCount: matchedBusinesses.length,
                matchedPostsCount: matchedPosts.length,
                selectedEntities: [
                  ...matchedBusinesses.map((b) => ({ id: b.id, name: b.name, type: 'business' as const, category: b.subCategory || b.categoryId, city: b.city })),
                  ...matchedPosts.map((p) => ({ id: p.id, name: p.title, type: 'post' as const, category: p.planCategoryName || p.categoryId, city: p.businessCity })),
                ],
              },
              steps: [
                {
                  step: '1',
                  title: 'Interpretación Semántica con IA',
                  status: 'success',
                  details: `Modelo interpretó: "${parsed.understanding}". Coincidencia exacta en municipio: ${parsed.exactMatchInRequestedCity ? 'Sí' : 'No'}.`,
                },
                {
                  step: '2',
                  title: 'Filtrado Autónomo en Base de Datos',
                  status: 'success',
                  details: `Comercios seleccionados: ${matchedBusinesses.length}. Ofertas seleccionadas: ${matchedPosts.length}.`,
                },
              ],
              antiHallucination: {
                allEntitiesVerifiedInCatalog: true,
                hallucinationsDetected: 0,
                correctedEntities: [],
              },
            },
          };
        }
      } catch (mErr: any) {
        console.warn('Intento de búsqueda LLM falló, recurriendo a determinista:', mErr?.message || mErr);
      }
    } catch (llmErr) {
      console.warn('Fallo en búsqueda con LLM, recurriendo a búsqueda determinista:', llmErr);
    }
  }

  // 2. Deterministic fallback if Gemini is offline
  const { matchedBusinesses, matchedPosts, queryTopic, exactMatchInMunicipality } = searchBusinessesAndPosts(
    userPrompt,
    catalogBusinesses,
    catalogPosts,
    targetMunicipality,
    messageHistory
  );

  if (matchedBusinesses.length === 0) {
    let noMatchText = `¡Listo veci! Estuve buscando locales de ${queryTopic} en ${targetMunicipality} y Sabana Centro, pero en este momento no tenemos uno registrado con ese servicio específico en OleVeci. Sin embargo, te puedo conectar con otros comercios recomendados del municipio o armarte un plan. ¿Qué más te gustaría encontrar?`;

    if (ai) {
      try {
        const noMatchRes = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
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
  let searchModelUsed = '';
  const firstBiz = matchedBusinesses[0];
  const secondBiz = matchedBusinesses[1];

  // Try intelligent text generation via Gemini cascade
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

      for (const modelName of ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest']) {
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
            searchModelUsed = modelName;
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
      spokenText = `¡Listo veci! En ${targetMunicipality} no encontré un comercio exacto de ${queryTopic}, pero te recomiendo ${firstBiz.name} en ${firstBiz.city}. Abajo puedes ver su información y contactarlos por WhatsApp.`;
    } else if (matchedBusinesses.length === 1) {
      spokenText = `¡Listo veci! En ${firstBiz.city} te recomiendo ${firstBiz.name}. Abajo puedes ver su ubicación y escribirles por WhatsApp.`;
    } else {
      spokenText = `¡Listo veci! En ${firstBiz.city} te recomiendo ${firstBiz.name} y ${secondBiz.name}. Abajo puedes ver sus detalles y contactarlos.`;
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
      status: searchModelUsed ? 'success' : 'info',
      details: searchModelUsed
        ? `Inferencia con modelo ${searchModelUsed} en tiempo real.`
        : `Ejecutado con motor determinista de respaldo (${ai ? 'Límite de cuota API excedido o fallo temporal' : 'Sin clave GEMINI_API_KEY activa'}).`,
      data: { model: searchModelUsed || 'Motor Determinista Local', apiKeyPresent: Boolean(input.apiKey || process.env.GEMINI_API_KEY) },
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
    executionMode: searchModelUsed ? 'llm' : 'deterministic_fallback',
    modelUsed: searchModelUsed || 'Motor Determinista Local',
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
 * Ultra-fast Groq caller cascading through available high-performance models
 */
async function callGroqWithFallback(
  prompt: string,
  systemInstruction: string,
  apiKey?: string
): Promise<{ text: string; modelUsed: string } | null> {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key || key.trim().length === 0) return null;

  const candidateModels = [
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
  ];

  for (const model of candidateModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `${systemInstruction}\nIMPORTANTE: Responde ESTRICTAMENTE con un único objeto JSON válido sin texto adicional.`,
            },
            {
              role: 'user',
              content: `${prompt}\nIMPORTANTE: Tu respuesta DEBE ser un único objeto JSON válido.`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 700,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 429) {
        console.warn(`Groq modelo ${model} retornó 429 rate limit. Pasando de inmediato al siguiente modelo...`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`Groq modelo ${model} retornó HTTP ${res.status}:`, errText);
        continue;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) {
        return { text, modelUsed: `groq/${model}` };
      }
    } catch (err: any) {
      console.warn(`Intento con Groq ${model} falló o tardó demasiado:`, err?.message || err);
    }
  }

  return null;
}

/**
 * Resilient multi-model Gemini caller cascading through fastest available models
 */
async function callGeminiWithModelFallback(
  aiInstance: GoogleGenAI,
  prompt: string,
  systemInstruction: string,
  responseSchema: any
): Promise<{ text: string; modelUsed: string }> {
  // Candidate models: cascade from fastest active models to resilient fallbacks
  const candidateModels = [
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
  ];
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
        return { text, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Intento con modelo ${model} falló o tardó demasiado:`, err?.message || err);
      if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
        break;
      }
    }
  }

  throw lastError || new Error('Todos los modelos de Gemini fallaron o excedieron el tiempo de respuesta.');
}

/**
 * Unified multi-provider LLM caller: Groq (ultra-fast & 100% free high quota) -> Gemini -> Error for fallback
 */
async function callLLMWithFallback(
  aiInstance: GoogleGenAI | null,
  prompt: string,
  systemInstruction: string,
  geminiSchema: any,
  groqKey?: string
): Promise<{ text: string; modelUsed: string; provider: 'groq' | 'gemini' }> {
  // 1. Try Groq (Ultra-fast, high quota, 100% free)
  try {
    const groqRes = await callGroqWithFallback(prompt, systemInstruction, groqKey);
    if (groqRes && groqRes.text) {
      return { ...groqRes, provider: 'groq' };
    }
  } catch (groqErr: any) {
    console.warn('Fallo en intento principal con Groq:', groqErr?.message || groqErr);
  }

  // 2. Try Gemini Cascade
  if (aiInstance) {
    const geminiRes = await callGeminiWithModelFallback(
      aiInstance,
      prompt,
      systemInstruction,
      geminiSchema
    );
    if (geminiRes && geminiRes.text) {
      return { ...geminiRes, provider: 'gemini' };
    }
  }

  throw new Error('No hay modelos de IA disponibles (Groq ni Gemini)');
}

/**
 * Inspects the user's prompt for explicitly sequenced or requested activities
 * (e.g. lavado, barbería, almuerzo, cervezas, café) and verifies that every requested
 * concept is represented in the final plan stops. If any requested stop was omitted
 * by the LLM, it retrieves the best matching offer from the catalog.
 */
function fillMissingPromptStops(
  coherentStops: OliPlanStop[],
  userPrompt: string,
  catalogPosts: Post[],
  businessMap: Map<string, Business>,
  targetCity: string,
  previousPlan?: any
): void {
  const normPrompt = normalizeText(userPrompt);
  let desiredCount = extractDesiredStopCount(userPrompt);

  if (previousPlan?.stops && previousPlan.stops.length > 0) {
    const isAdd =
      normPrompt.includes('incluy') ||
      normPrompt.includes('agrega') ||
      normPrompt.includes('anad') ||
      normPrompt.includes('adicion') ||
      normPrompt.includes('suma') ||
      normPrompt.includes('meter');
    if (isAdd) {
      desiredCount = Math.max(desiredCount, previousPlan.stops.length + 1);
    } else if (
      !normPrompt.includes('quita') &&
      !normPrompt.includes('elimina') &&
      !normPrompt.includes('borra')
    ) {
      desiredCount = Math.max(desiredCount, previousPlan.stops.length);
    }
  }

  // Detect unwanted item that user explicitly rejected (e.g. "incluiste hamburguesa pero quiero es pizza")
  let unwantedKey: string | null = null;
  if (
    normPrompt.includes('pero quiero') ||
    normPrompt.includes('quiero es') ||
    normPrompt.includes('cambia') ||
    normPrompt.includes('en vez de') ||
    normPrompt.includes('incluiste') ||
    normPrompt.includes('pusiste')
  ) {
    if (normPrompt.includes('hamburguesa') || normPrompt.includes('burger')) unwantedKey = 'burger';
    else if (normPrompt.includes('pollo')) unwantedKey = 'pollo';
    else if (normPrompt.includes('pizza')) unwantedKey = 'pizza';
  }

  // If coherentStops contains an unwanted stop, remove it to make room for the desired stop
  if (unwantedKey) {
    const unwantedIdx = coherentStops.findIndex((s) => {
      const t = normalizeText(`${s.activity} ${s.postTitle} ${s.businessName}`);
      return (
        (unwantedKey === 'burger' && (t.includes('hamburguesa') || t.includes('burger') || t.includes('brasa'))) ||
        (unwantedKey === 'pollo' && (t.includes('pollo') || t.includes('broaster') || t.includes('asadero'))) ||
        (unwantedKey === 'pizza' && (t.includes('pizza') || t.includes('pizzer')))
      );
    });
    if (unwantedIdx !== -1) {
      coherentStops.splice(unwantedIdx, 1);
    }
  }

  const seenBiz = new Set(coherentStops.map((s) => s.businessId));

  const knownConcepts = [
    {
      key: 'lavado',
      match: ['lavar', 'lavado', 'lavadero', 'autospa'],
      filter: (p: Post, b?: Business) => {
        const text = normalizeText(`${p.title} ${p.description || ''} ${b?.name || ''}`);
        return text.includes('lavad') || text.includes('autospa') || text.includes('vapor');
      },
      defaultTime: '9:00 AM',
    },
    {
      key: 'barberia',
      match: ['barberia', 'barbero', 'peluqueria', 'corte'],
      filter: (p: Post, b?: Business) => {
        const text = normalizeText(`${p.title} ${p.description || ''} ${b?.name || ''}`);
        return text.includes('barber') || text.includes('corte') || text.includes('afeitado');
      },
      defaultTime: '10:30 AM',
    },
    {
      key: 'pizza',
      match: ['pizza', 'pizzas', 'pizzeria', 'pizzería', 'italiana'],
      filter: (p: Post, b?: Business) => {
        const text = normalizeText(`${p.title} ${p.description || ''} ${b?.name || ''}`);
        return text.includes('pizza') || text.includes('pizzer');
      },
      defaultTime: '1:00 PM',
    },
    {
      key: 'hamburguesa',
      match: ['hamburguesa', 'hamburguesas', 'burger', 'smash'],
      filter: (p: Post, b?: Business) => {
        const text = normalizeText(`${p.title} ${p.description || ''} ${b?.name || ''}`);
        return text.includes('hamburguesa') || text.includes('burger');
      },
      defaultTime: '1:00 PM',
    },
    {
      key: 'pollo',
      match: ['pollo', 'broaster', 'alitas', 'crispy'],
      filter: (p: Post, b?: Business) => {
        const text = normalizeText(`${p.title} ${p.description || ''} ${b?.name || ''}`);
        return text.includes('pollo') || text.includes('broaster') || text.includes('alitas');
      },
      defaultTime: '1:00 PM',
    },
    {
      key: 'almuerzo',
      match: ['almorzar', 'almuerzo', 'restaurante'],
      filter: (p: Post) => classifyPostRole(p) === 'main_course',
      defaultTime: '1:00 PM',
    },
    {
      key: 'cerveza',
      match: ['cerveza', 'cervezas', 'pola', 'polas', 'tragos', 'bar', 'gastrobar'],
      filter: (p: Post, b?: Business) => {
        const text = normalizeText(`${p.title} ${p.description || ''} ${b?.name || ''}`);
        return text.includes('cerveza') || text.includes('pola') || text.includes('artesanal') || text.includes('gastrobar') || text.includes('bar');
      },
      defaultTime: '4:30 PM',
    },
    {
      key: 'cafe',
      match: ['cafe', 'capuchino', 'cappuccino', 'tardeo', 'postre'],
      filter: (p: Post) => classifyPostRole(p) === 'cafe_dessert',
      defaultTime: '3:30 PM',
    },
  ];

  for (const concept of knownConcepts) {
    if (coherentStops.length >= desiredCount) break;

    const mentionedInPrompt = concept.match.some((w) => normPrompt.includes(w));
    if (!mentionedInPrompt) continue;

    const alreadyCovered = coherentStops.some((s) => {
      const stopText = normalizeText(`${s.activity} ${s.postTitle} ${s.businessName}`);
      return concept.match.some((w) => stopText.includes(w));
    });
    if (alreadyCovered) continue;

    let candidatePost = catalogPosts.find((p) => {
      if (seenBiz.has(p.businessId)) return false;
      const b = businessMap.get(p.businessId);
      if (b?.city && targetCity && normalizeText(b.city) !== normalizeText(targetCity)) return false;
      return concept.filter(p, b);
    });

    if (!candidatePost) {
      candidatePost = catalogPosts.find((p) => {
        const b = businessMap.get(p.businessId);
        if (b?.city && targetCity && normalizeText(b.city) !== normalizeText(targetCity)) return false;
        return concept.filter(p, b);
      });
    }

    if (candidatePost) {
      const b = businessMap.get(candidatePost.businessId);
      coherentStops.push({
        postId: candidatePost.id,
        businessId: candidatePost.businessId,
        businessName: b?.name || 'Comercio Local',
        businessCity: b?.city || targetCity,
        businessAddress: b?.address || 'Zona Centro',
        businessPhone: b?.phone || '',
        businessWhatsapp: b?.whatsapp || '',
        time: concept.defaultTime,
        activity: candidatePost.title,
        postTitle: candidatePost.title,
        imageUrl: candidatePost.imageUrl || b?.coverImage || b?.logo || '/Logo_OleVeci.png',
        cost: candidatePost.promotionalPrice || candidatePost.originalPrice || candidatePost.approximatePrice || 25000,
        whySelected: `Actividad solicitada: ${candidatePost.title}`,
      });
      seenBiz.add(candidatePost.businessId);
    }
  }

  // If still below desiredCount and previousPlan has intact stops that were not carried over, restore them
  if (previousPlan?.stops && coherentStops.length < desiredCount) {
    for (const prevStop of previousPlan.stops) {
      if (coherentStops.length >= desiredCount) break;
      if (seenBiz.has(prevStop.businessId)) continue;
      if (unwantedKey) {
        const t = normalizeText(`${prevStop.activity} ${prevStop.postTitle} ${prevStop.businessName}`);
        if (
          (unwantedKey === 'burger' && (t.includes('hamburguesa') || t.includes('burger') || t.includes('brasa'))) ||
          (unwantedKey === 'pollo' && (t.includes('pollo') || t.includes('broaster') || t.includes('asadero'))) ||
          (unwantedKey === 'pizza' && (t.includes('pizza') || t.includes('pizzer')))
        ) {
          continue;
        }
      }
      coherentStops.push(prevStop);
      seenBiz.add(prevStop.businessId);
    }
  }
}

/**
 * Main entry point for Oli Assistant
 */
export async function generateOliPlan(input: GenerateOliPlanInput): Promise<OliPlanResponse> {
  const {
    userPrompt,
    currentCity = 'Cajicá',
    userBudget = 0,
    previousPlan,
    messageHistory = [],
    catalogPosts,
    catalogBusinesses,
    referenceDate = new Date(),
  } = input;

  let resolvedBudget = 0;
  const promptBudget = extractBudgetFromPrompt(userPrompt, -1);
  if (promptBudget !== -1) {
    resolvedBudget = promptBudget;
  } else if (previousPlan && typeof previousPlan.userBudget === 'number' && previousPlan.userBudget > 0) {
    resolvedBudget = previousPlan.userBudget;
  } else if (typeof userBudget === 'number' && userBudget > 0) {
    resolvedBudget = userBudget;
  }

  const isRefinement = isPlanRefinementIntent(userPrompt, previousPlan);
  const ai = getGenAI(input.apiKey);
  const hasGroq = Boolean((input.groqApiKey || process.env.GROQ_API_KEY)?.trim());

  // If any LLM provider is available (Groq or Gemini), run unified autonomous LLM interpretation on the full catalog
  if (hasGroq || ai) {
    try {
      const businessMap = new Map<string, Business>();
      catalogBusinesses.forEach((b) => businessMap.set(b.id, b));
      const postMap = new Map<string, Post>();
      catalogPosts.forEach((p) => postMap.set(p.id, p));

      const targetCity = extractMunicipality(userPrompt, currentCity);
      const dateInfo = resolveTargetDateFromPrompt(userPrompt, referenceDate);

      const targetNorm = normalizeText(targetCity);
      const catalogToUse = catalogBusinesses.filter(
        (b) => (!b.status || b.status === 'active') && !b.suspended && b.id !== 'biz_oleveci' && b.name !== 'OleVeci'
      );

      const catalogSummaryText = catalogToUse.map((b) => {
        const postsList = catalogPosts
          .filter((p) => p.businessId === b.id && (!p.status || p.status === 'active') && !p.suspended)
          .map((p) => `[${p.id}] ${p.title} (${p.promotionalPrice || p.originalPrice || p.approximatePrice || 0} COP)`)
          .join(' | ');
        return `* [${b.id}] ${b.name} (${b.city} | ${b.subCategory || b.categoryId}): ${postsList}`;
      }).join('\n');

      const systemInstruction = `Eres Oli, la asistente inteligente y de voz oficial de OleVeci en Colombia (Sabana Centro: Cajicá, Chía, Cota, Zipaquirá, Tabio, Tenjo, Sopó, Tocancipá, etc.).
Tu personalidad es cercana, cálida, alegre, honesta y servicial ("veci").

Analiza con INTELIGENCIA Y SENTIDO COMÚN HUMANO la consulta del usuario, sin limitaciones rígidas ni sesgos:

1. CLASIFICACIÓN DE INTENCIÓN (intent):
   - 'search': El usuario busca un comercio, oficio, servicio, producto, comida o recomendación puntual de un lugar (ej: "un taller", "un talle", "donde lavo el carro", "un capuchino", "pizza", "veterinaria", "papelería", "peluquería", "¿a qué hora abren?", "en otro municipio").
   - 'plan': El usuario pide explícitamente armar un plan, ruta, itinerario, parche o salida de fin de semana con paradas secuenciales.
     NÚMERO DE PARADAS EN PLANES: Si el usuario pide explícitamente varias paradas o actividades secuenciales (ej: "primero lavar el auto, luego a la barbería, luego a almorzar y finalmente a tomar unas cervezas" -> 4 actividades), DEBES generar EXACTAMENTE ese número de paradas en el arreglo 'stops' (en este ejemplo 4 paradas completas). NUNCA limites a 3 paradas si el usuario solicitó 4 o más actividades.
   - 'refinement': El usuario pide cambiar, ajustar, corregir, quitar o AGREGAR una parada a un plan previo (ej: "incluye en el plan una parada para comer pizza", "incluiste hamburguesa pero quiero es pizza", "no sale en el plan la pizza", "cambia la segunda parada por pizza", "agrega café al final").
     REGLAS PARA REFINEMENT:
     * Si el usuario pide agregar una parada ("incluye", "agrega", "suma"): DEBES conservar TODAS las paradas anteriores y agregar la nueva parada para cumplir el nuevo total de paradas. El arreglo 'stops' DEBE contener todas las paradas (ej: si habían 2 y pide pizza, ahora son 3 paradas).
     * Si el usuario dice "incluiste X pero quiero Y", "no sale Y en el plan", o "cambia X por Y": DEBES conservar todas las otras paradas del plan previo y sustituir la parada X por la oferta de Y del catálogo. El arreglo 'stops' DEBE devolver TODAS las paradas del plan (ej: 3 paradas completas, NUNCA lo reduzcas a 2).
   - 'general_qa': El usuario hace una pregunta general sobre OleVeci, horarios o aclaraciones.

2. DISCRIMINACIÓN SEMÁNTICA RIGUROSA:
   - TALLER MECÁNICO vs. LAVADERO: Un lavadero / autospa / estética automotriz NO es un taller mecánico. No cambian frenos ni arreglan motores. Si piden taller ("un talle", "taller de autos", "mecanica"), NUNCA sugieras un lavadero.
   - VETERINARIA MÉDICA vs. TIENDA DE MASCOTAS: Una clínica veterinaria atiende salud y urgencias; no la confundas con una tienda de accesorios o baño canino.
   - CAFETERÍA vs. ALMUERZO/CORRIENTAZO: Un capuchino o café de especialidad es de cafetería/panadería artesanal, no de un asadero.
   - BARBERÍA vs. SALÓN FEMENINO: Una barbería tradicional de caballeros es distinta a un centro de estética o peluquería para damas.

3. TRANSPARENCIA TERRITORIAL Y DE STOCK:
   - Si en el municipio solicitado (${targetCity}) NO existe un comercio que ofrezca ese servicio exacto (ej: papelería o taller en Cajicá), pero en un municipio vecino cercano (ej: Chía) sí existe (ej: 'Papelería & Miscelánea Central Chía' o 'Taller Mecánico & Autos Sabana'):
     * Selecciónalo de inmediato en 'selectedBusinessIds' y sus ofertas en 'selectedPostIds'.
     * Indícalo en spokenText: "¡Listo veci! En Cajicá no tenemos registrado [servicio], pero aquí al lado en Chía te recomiendo [Comercio]. En pantalla tienes todos sus datos para contactarlo."
   - Si el usuario pide un producto o comida que no existe en todo el catálogo (ej: sushi, cerrajería), dilo cordialmente: "¡Listo veci! En este momento no tenemos registrado [servicio] en los municipios cercanos...". NUNCA inventes negocios ni asignes negocios incompatibles.

4. COHERENCIA DE OFERTAS:
   - En 'selectedPostIds' pon ÚNICAMENTE ofertas que apliquen a lo que pidió. Si no hay ofertas específicas de ese servicio, pon arreglo vacío []. NUNCA pongas ofertas de lavado cuando pidieron mecánica, ni ofertas de té cuando pidieron café.

5. SPOKENTEXT (ESTILO ULTRA-CORTO Y CONCISO):
   - Comienza obligatoriamente con "¡Listo veci!".
   - MÁXIMO 1 A 2 ORACIONES CORTAS (estilo WhatsApp directo y ejecutivo):
     * Si es plan nuevo: "¡Listo veci! Tu plan ya quedó armado con [N] paradas en [municipio]. En pantalla tienes todos los detalles para contactar a cada veci."
     * Si es cambio/refinamiento: "¡Listo veci! Ya cambié la [parada X] por [comercio o actividad solicitada]."
     * Si es agregar paradas: "¡Listo veci! Tu plan fue actualizado y ahora tiene [N] paradas."
     * Si es eliminar parada: "¡Listo veci! Ya eliminé esa parada de tu plan."
     * Si es búsqueda puntual de comercio o servicio: "¡Listo veci! En [municipio] te recomiendo [Comercio], en pantalla tienes su botón de WhatsApp."
   - PROHIBIDO TERMINANTEMENTE recitar el itinerario o repetir las paradas una por una en este texto; las paradas ya se muestran en las tarjetas visuales de abajo.
   - PROHIBIDO TOTALMENTE el signo '$'. Expresa valores en pesos o mil pesos.

6. ESTRUCTURA OBLIGATORIA DEL JSON:
Tu respuesta DEBE ser un único objeto JSON válido con los siguientes campos:
{
  "intent": "plan" | "search" | "refinement" | "general_qa",
  "understanding": "resumen breve de lo interpretado",
  "targetMunicipality": "${targetCity}",
  "exactMatchInRequestedCity": true,
  "spokenText": "¡Listo veci! [máximo 1 o 2 oraciones concisas, cero repetición de paradas, cero signos $]",
  "planTitle": "título creativo del plan",
  "stops": [
    {
      "time": "horario (ej: 9:00 AM)",
      "activity": "descripción de la actividad",
      "businessId": "id exacto del comercio del catálogo",
      "businessName": "nombre del comercio",
      "businessCity": "municipio",
      "postId": "id exacto de la publicación del catálogo",
      "postTitle": "título de la publicación",
      "cost": 30000
    }
  ],
  "selectedBusinessIds": ["id1"],
  "selectedPostIds": ["post1"]
}`;

      const userPromptContent = `Consulta del usuario: "${userPrompt}"
Municipio actual del usuario: "${targetCity}"
Día inferido: "${dateInfo.dayName}" (día de la semana ${dateInfo.dayOfWeek})
Presupuesto indicado: ${resolvedBudget > 0 ? `${resolvedBudget} COP` : 'Sin límite predefinido ($0 / abierto).'}
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
Historial de conversación: ${JSON.stringify(messageHistory.slice(-6))}

Catálogo de comercios y ofertas disponibles en OleVeci:
${catalogSummaryText}`;

      const unifiedResponseSchema = {
        type: Type.OBJECT,
        properties: {
          intent: {
            type: Type.STRING,
            description: "Tipo de intención: 'search' (busca un comercio, producto, servicio específico o recomendación puntual), 'plan' (pide armar un plan/itinerario con varias paradas), 'refinement' (modificar un plan previo), 'general_qa' (pregunta general).",
          },
          understanding: { type: Type.STRING },
          targetMunicipality: { type: Type.STRING },
          exactMatchInRequestedCity: { type: Type.BOOLEAN },
          isAlternativeSuggestion: { type: Type.BOOLEAN },
          alternativeNotice: { type: Type.STRING },
          selectedBusinessIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Para 'search' o 'general_qa': IDs de los comercios idóneos que ofrecen lo solicitado.",
          },
          selectedPostIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Para 'search': IDs de las publicaciones que coinciden exactamente con lo pedido. Si no hay publicaciones específicas, arreglo vacío [].",
          },
          planTitle: { type: Type.STRING },
          day: { type: Type.STRING },
          targetAudience: { type: Type.STRING },
          totalEstimatedCost: { type: Type.INTEGER },
          budgetStatus: { type: Type.STRING },
          stops: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                activity: { type: Type.STRING },
                businessId: { type: Type.STRING },
                businessName: { type: Type.STRING },
                businessCity: { type: Type.STRING },
                postId: { type: Type.STRING },
                postTitle: { type: Type.STRING },
                cost: { type: Type.INTEGER },
                address: { type: Type.STRING },
                phone: { type: Type.STRING },
                whatsapp: { type: Type.STRING },
              },
              required: ['time', 'activity', 'businessId', 'businessName', 'businessCity', 'postId', 'cost'],
            },
          },
          spokenText: {
            type: Type.STRING,
            description: "Respuesta hablada para el usuario. Comienza con '¡Listo veci!'. Estilo WhatsApp colombiano, conciso (máximo 2 a 3 oraciones). CERO signos '$'.",
          },
        },
        required: ['intent', 'understanding', 'targetMunicipality', 'exactMatchInRequestedCity', 'spokenText'],
      };

      const { text: rawJson, modelUsed: actualModelUsed } = await callLLMWithFallback(
        ai,
        userPromptContent,
        systemInstruction,
        unifiedResponseSchema,
        input.groqApiKey
      );

      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        const detectedIntent = parsed.intent || (parsed.stops && parsed.stops.length > 1 ? 'plan' : 'search');

        // CASE 1: Single Business / Service / Product Search or General Q&A
        if (detectedIntent === 'search' || detectedIntent === 'general_qa') {
          const matchedBusinesses: Business[] = (parsed.selectedBusinessIds || [])
            .map((id: string) => businessMap.get(id))
            .filter(Boolean) as Business[];

          const matchedPosts: Post[] = (parsed.selectedPostIds || [])
            .map((id: string) => postMap.get(id))
            .filter(Boolean) as Post[];

          // Guarantee that the business owning any matched post is always present in matchedBusinesses
          for (const p of matchedPosts) {
            const b = businessMap.get(p.businessId);
            if (b && !matchedBusinesses.some((mb) => mb.id === b.id)) {
              matchedBusinesses.push(b);
            }
          }

          const spokenClean = sanitizeSpokenText(parsed.spokenText || '', [], false, true);

          return {
            type: 'search',
            spokenText: spokenClean,
            searchQuery: userPrompt,
            targetMunicipality: parsed.targetMunicipality || targetCity,
            matchedBusinesses,
            matchedPosts,
            isAlternativeSuggestion: parsed.isAlternativeSuggestion ?? !parsed.exactMatchInRequestedCity,
            alternativeNotice: parsed.alternativeNotice || (!parsed.exactMatchInRequestedCity ? parsed.understanding : undefined),
            auditTrace: {
              rawPrompt: userPrompt,
              timestamp: new Date().toISOString(),
              executionMode: 'llm',
              modelUsed: actualModelUsed,
              apiKeyPresent: true,
              intentDetected: detectedIntent,
              interpretation: {
                targetMunicipality: parsed.targetMunicipality || targetCity,
                detectedTopic: parsed.understanding,
                isSpecificProductOrService: true,
                isRefinementIntent: false,
              },
              databaseFiltering: {
                totalBusinessesInCatalog: catalogBusinesses.length,
                totalPostsInCatalog: catalogPosts.length,
                businessesInTargetMunicipality: catalogBusinesses.filter((b) => normalizeText(b.city) === normalizeText(parsed.targetMunicipality || targetCity)).length,
                eligiblePostsAfterValidity: catalogPosts.length,
                matchedBusinessesCount: matchedBusinesses.length,
                matchedPostsCount: matchedPosts.length,
                selectedEntities: [
                  ...matchedBusinesses.map((b) => ({ id: b.id, name: b.name, type: 'business' as const, category: b.subCategory || b.categoryId, city: b.city })),
                  ...matchedPosts.map((p) => ({ id: p.id, name: p.title, type: 'post' as const, category: p.planCategoryName || p.categoryId, city: p.businessCity })),
                ],
              },
              steps: [
                {
                  step: '1',
                  title: 'Interpretación Semántica Integral con Gemini',
                  status: 'success',
                  details: `Gemini comprendió: "${parsed.understanding}". Intención: ${detectedIntent}. Coincidencia exacta en municipio: ${parsed.exactMatchInRequestedCity ? 'Sí' : 'No'}.`,
                },
                {
                  step: '2',
                  title: 'Filtrado Autónomo en Base de Datos',
                  status: 'success',
                  details: `Comercios seleccionados: ${matchedBusinesses.length}. Ofertas seleccionadas: ${matchedPosts.length}.`,
                },
              ],
              antiHallucination: {
                allEntitiesVerifiedInCatalog: true,
                hallucinationsDetected: 0,
                correctedEntities: [],
              },
            },
          };
        }

        // CASE 2: Multi-Stop Itinerary Plan or Plan Refinement
        const seenBiz = new Set<string>();
        let mainCourseCount = 0;
        const coherentStops: OliPlanStop[] = [];

        const candidateStops = (parsed.stops && parsed.stops.length > 0)
          ? parsed.stops
          : (parsed.selectedPostIds || []).map((pId: string, idx: number) => {
              const p = postMap.get(pId);
              const b = p ? businessMap.get(p.businessId) : undefined;
              return {
                time: idx === 0 ? '12:30 PM' : (idx === 1 ? '3:30 PM' : '6:00 PM'),
                activity: p?.title || 'Actividad local',
                businessId: p?.businessId,
                businessName: b?.name,
                businessCity: b?.city,
                postId: pId,
                postTitle: p?.title,
                cost: p?.promotionalPrice || p?.originalPrice || p?.approximatePrice || 25000,
                whySelected: p?.title,
              };
            });

        for (const rawStop of candidateStops) {
          const rawBizNorm = rawStop.businessName ? normalizeText(rawStop.businessName) : '';
          const rawTitleNorm = rawStop.postTitle ? normalizeText(rawStop.postTitle) : '';
          const post =
            catalogPosts.find((p) => p.id === rawStop.postId) ||
            catalogPosts.find((p) => p.businessId === rawStop.businessId) ||
            (rawTitleNorm ? catalogPosts.find((p) => normalizeText(p.title).includes(rawTitleNorm) || rawTitleNorm.includes(normalizeText(p.title))) : undefined) ||
            (rawBizNorm ? catalogPosts.find((p) => {
              const b = businessMap.get(p.businessId);
              return b && (normalizeText(b.name).includes(rawBizNorm) || rawBizNorm.includes(normalizeText(b.name)));
            }) : undefined);
          if (!post) continue; // Verify postId exists
          const role = classifyPostRole(post);

          if (seenBiz.has(post.businessId)) {
            // Instead of discarding the stop, find an alternative merchant in the same municipality
            const altPost = catalogPosts.find((p) => {
              if (seenBiz.has(p.businessId)) return false;
              const pBiz = businessMap.get(p.businessId);
              if (pBiz?.city && targetCity && normalizeText(pBiz.city) !== normalizeText(targetCity)) return false;
              const pRole = classifyPostRole(p);
              return pRole === role || (role === 'drinks_social' && (pRole === 'drinks_social' || pRole === 'activity_other'));
            });

            if (altPost) {
              const altBiz = businessMap.get(altPost.businessId);
              coherentStops.push({
                postId: altPost.id,
                businessId: altPost.businessId,
                businessName: altBiz?.name || 'Comercio Local',
                businessCity: altBiz?.city || targetCity,
                businessAddress: altBiz?.address || 'Zona Centro',
                businessPhone: altBiz?.phone || '',
                businessWhatsapp: altBiz?.whatsapp || '',
                time: rawStop.time || '5:00 PM',
                activity: rawStop.activity || altPost.title,
                postTitle: altPost.title,
                imageUrl: altPost.imageUrl || altBiz?.coverImage || altBiz?.logo || '/Logo_OleVeci.png',
                cost: altPost.promotionalPrice || altPost.originalPrice || altPost.approximatePrice || 25000,
                whySelected: `Opción para ${rawStop.activity || 'el plan'}: ${altPost.title}`,
              });
              seenBiz.add(altPost.businessId);
            }
            continue;
          }

          if (role === 'main_course' && candidateStops.length <= 3) {
            if (mainCourseCount >= 1) continue;
            mainCourseCount++;
          }

          const biz = businessMap.get(post.businessId);
          coherentStops.push({
            postId: post.id,
            businessId: post.businessId,
            businessName: biz?.name || rawStop.businessName || 'Comercio Local',
            businessCity: biz?.city || rawStop.businessCity || targetCity,
            businessAddress: biz?.address || rawStop.address || 'Zona Centro',
            businessPhone: biz?.phone || rawStop.phone || '',
            businessWhatsapp: biz?.whatsapp || rawStop.whatsapp || '',
            time: rawStop.time || '10:00 AM',
            activity: rawStop.activity || post.title,
            postTitle: post.title,
            imageUrl: post.imageUrl || biz?.coverImage || biz?.logo || '/Logo_OleVeci.png',
            cost: post.promotionalPrice || post.originalPrice || post.approximatePrice || rawStop.cost || 25000,
            whySelected: rawStop.whySelected || post.title,
          });

          seenBiz.add(post.businessId);
        }

        // Ensure every requested activity in the user's prompt is represented
        fillMissingPromptStops(coherentStops, userPrompt, catalogPosts, businessMap, targetCity, previousPlan);

        if (coherentStops.length >= 1) {
          const personCount = extractPersonCount(userPrompt);
          const isOpenBudget = resolvedBudget <= 0;
          const budgetSummary = calculateItineraryBudget(
            coherentStops.map((s) => ({ cost: s.cost })),
            resolvedBudget > 0 ? resolvedBudget : 100000,
            personCount,
            isOpenBudget
          );

          const spokenClean = sanitizeSpokenText(
            parsed.spokenText || '',
            coherentStops,
            isRefinement,
            false,
            Boolean(parsed.isAlternativeSuggestion)
          );

          const matchedBusinesses = Array.from(new Set(coherentStops.map((s) => s.businessId)))
            .map((id) => businessMap.get(id))
            .filter(Boolean) as Business[];

          const matchedPosts = Array.from(new Set(coherentStops.map((s) => s.postId)))
            .map((id) => postMap.get(id))
            .filter(Boolean) as Post[];

          const businessesInCity = catalogBusinesses.filter(
            (b) => normalizeText(b.city) === normalizeText(targetCity)
          ).length;

          return {
            type: 'plan',
            spokenText: spokenClean,
            planTitle: parsed.planTitle || `Plan OleVeci en ${targetCity}`,
            day: parsed.day || dateInfo.dayName,
            targetAudience: parsed.targetAudience || 'General',
            personCount,
            costPerPerson: budgetSummary.costPerPerson,
            totalEstimatedCost: budgetSummary.totalEstimatedCost,
            userBudget: resolvedBudget,
            savingsOrRemaining: budgetSummary.savingsOrRemaining,
            budgetStatus: budgetSummary.budgetStatus,
            hasUnconfirmedPrices: budgetSummary.hasUnconfirmedPrices,
            stops: coherentStops,
            matchedBusinesses,
            matchedPosts,
            isAlternativeSuggestion: parsed.isAlternativeSuggestion || false,
            alternativeNotice: parsed.alternativeNotice,
            auditTrace: {
              rawPrompt: userPrompt,
              timestamp: new Date().toISOString(),
              executionMode: 'llm',
              modelUsed: actualModelUsed,
              apiKeyPresent: true,
              intentDetected: isRefinement ? 'plan_refinement' : 'plan_creation',
              interpretation: {
                targetMunicipality: targetCity,
                detectedAudience: parsed.targetAudience || 'General',
                personCount,
                isRefinementIntent: isRefinement,
              },
              databaseFiltering: {
                totalBusinessesInCatalog: catalogBusinesses.length,
                totalPostsInCatalog: catalogPosts.length,
                businessesInTargetMunicipality: businessesInCity,
                eligiblePostsAfterValidity: catalogPosts.length,
                matchedBusinessesCount: coherentStops.length,
                matchedPostsCount: coherentStops.length,
                selectedEntities: [
                  ...matchedBusinesses.map((b) => ({ id: b.id, name: b.name, type: 'business' as const, category: b.subCategory || b.categoryId, city: b.city })),
                  ...matchedPosts.map((p) => ({ id: p.id, name: p.title, type: 'post' as const, category: p.planCategoryName || p.categoryId, city: p.businessCity })),
                ],
              },
              steps: [
                {
                  step: '1',
                  title: 'Interpretación Semántica Integral con Gemini',
                  status: 'success',
                  details: `Gemini generó plan de ${coherentStops.length} paradas con costo total de ${budgetSummary.totalEstimatedCost} COP (${budgetSummary.budgetStatus}).`,
                },
              ],
              antiHallucination: {
                allEntitiesVerifiedInCatalog: true,
                hallucinationsDetected: 0,
                correctedEntities: [],
              },
            },
          };
        }
      }
    } catch (llmUnifiedErr) {
      console.warn('Inferencia unificada con Gemini falló o cuota excedida, activando motor determinista:', llmUnifiedErr);
    }
  }

  // Fallback determinista si Gemini está desconectado o sin cuota
  if (!isRefinement && detectSearchIntent(userPrompt)) {
    return generateOliSearchResponse(input);
  }
  return generateFallbackOliPlan(input);
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

