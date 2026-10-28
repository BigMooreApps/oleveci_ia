import fs from 'fs';
import path from 'path';

export interface OliCustomRule {
  id: string;
  title: string;
  instruction: string;
  active: boolean;
  category: 'tone' | 'business' | 'itinerary' | 'budget' | 'custom';
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_OLI_RULES: OliCustomRule[] = [
  {
    id: 'rule_tone',
    title: 'Tono y Saludo Oficial',
    instruction: 'Toda respuesta debe iniciar obligatoriamente con "¡Listo veci!", con calidez sabanera, naturalidad y sin formato técnico o markdown roto.',
    active: true,
    category: 'tone',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'rule_no_duplicates',
    title: 'Regla de Cero Comercios Duplicados',
    instruction: 'Un solo itinerario jamás debe repetir el mismo comercio en dos paradas distintas, garantizando variedad comercial y soporte a múltiples vecinos.',
    active: true,
    category: 'business',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'rule_single_main_meal',
    title: 'Una Sola Comida Fuerte',
    instruction: 'Los itinerarios se estructuran cronológicamente (Actividad > Almuerzo > Café/Postre > Cervezas/Relax). Nunca dos comidas pesadas continuas.',
    active: true,
    category: 'itinerary',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'rule_strict_budget',
    title: 'Control Estricto de Presupuesto',
    instruction: 'Si el usuario da un presupuesto, la suma de los precios oficiales no debe superarlo. Si lo supera, se le avisa explícitamente sin inventar cifras.',
    active: true,
    category: 'budget',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'rule_ultra_short',
    title: 'Respuestas Ultra-Cortas y Ejecutivas',
    instruction: 'En spokenText responde en máximo 1 o 2 oraciones cortas directas estilo WhatsApp. NO recites ni listes las paradas una por una porque ya se muestran visualmente abajo.',
    active: true,
    category: 'tone',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'rule_no_dollar_sign',
    title: 'Prohibición del Signo de Dólar ($)',
    instruction: 'Nunca uses el carácter "$" en la respuesta hablada (spokenText). Expresa valores siempre con palabras o números acompañados de "pesos" o "mil pesos".',
    active: true,
    category: 'tone',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
];

const DB_RULES_FILE = path.join(process.cwd(), 'server', 'db_oli_rules.json');

let rulesCache: OliCustomRule[] = [];

/**
 * Load rules from disk or return default rules
 */
export function loadOliRules(): OliCustomRule[] {
  try {
    if (fs.existsSync(DB_RULES_FILE)) {
      const raw = fs.readFileSync(DB_RULES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        rulesCache = parsed;
        return rulesCache;
      }
    }
  } catch (err) {
    console.error('[oliRulesManager] Error leyendo db_oli_rules.json:', err);
  }

  rulesCache = [...DEFAULT_OLI_RULES];
  saveOliRulesToDisk(rulesCache);
  return rulesCache;
}

/**
 * Save rules array to disk and memory cache
 */
export function saveOliRulesToDisk(rules: OliCustomRule[]): boolean {
  try {
    rulesCache = rules;
    fs.writeFileSync(DB_RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[oliRulesManager] Error guardando db_oli_rules.json:', err);
    return false;
  }
}

/**
 * Get active or all rules
 */
export function getOliRules(): OliCustomRule[] {
  if (rulesCache.length === 0) {
    return loadOliRules();
  }
  return rulesCache;
}

/**
 * Add or update rule
 */
export function saveOrUpdateRule(rule: Partial<OliCustomRule> & { title: string; instruction: string }): OliCustomRule[] {
  const current = getOliRules();
  const now = new Date().toISOString();

  if (rule.id) {
    // Update existing
    const idx = current.findIndex((r) => r.id === rule.id);
    if (idx !== -1) {
      current[idx] = {
        ...current[idx],
        ...rule,
        updatedAt: now,
      };
      saveOliRulesToDisk(current);
      return current;
    }
  }

  // Create new
  const newRule: OliCustomRule = {
    id: rule.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: rule.title.trim(),
    instruction: rule.instruction.trim(),
    active: rule.active !== undefined ? rule.active : true,
    category: rule.category || 'custom',
    createdAt: now,
    updatedAt: now,
  };

  current.push(newRule);
  saveOliRulesToDisk(current);
  return current;
}

/**
 * Delete rule by id
 */
export function deleteRule(id: string): OliCustomRule[] {
  const current = getOliRules();
  const next = current.filter((r) => r.id !== id);
  saveOliRulesToDisk(next);
  return next;
}

/**
 * Toggle active state of a rule
 */
export function toggleRuleActive(id: string): OliCustomRule[] {
  const current = getOliRules();
  const target = current.find((r) => r.id === id);
  if (target) {
    target.active = !target.active;
    target.updatedAt = new Date().toISOString();
    saveOliRulesToDisk(current);
  }
  return current;
}

/**
 * Reset rules to system defaults
 */
export function resetToDefaultRules(): OliCustomRule[] {
  const reset = JSON.parse(JSON.stringify(DEFAULT_OLI_RULES));
  saveOliRulesToDisk(reset);
  return reset;
}

/**
 * Build dynamic prompt instruction string from active rules
 * This is injected into the LLM systemInstruction in oliAssistant.ts
 */
export function formatRulesForPrompt(): string {
  const rules = getOliRules().filter((r) => r.active);
  if (rules.length === 0) return '';

  const formatted = rules
    .map((r, idx) => `${idx + 1}. [${r.title.toUpperCase()}]: ${r.instruction}`)
    .join('\n');

  return `\nREGLAS DE NEGOCIO Y POLÍTICAS DEL ADMINISTRADOR (CUMPLIMIENTO ESTRICTO Y OBLIGATORIO):
${formatted}\n`;
}

// Initial load on startup
loadOliRules();
