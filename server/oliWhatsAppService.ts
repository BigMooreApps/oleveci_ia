import path from 'path';
import fs from 'fs';
import { OliPlanResponse, GenerateOliPlanInput } from './oliTypes';
import { generateOliPlan } from './oliAssistant';
import { Post, Business } from '../src/types';
import { formatPriceCOP } from './oliValidator';

export interface UserPreferences {
  petFriendly?: boolean;
  vegetarian?: boolean;
  familyWithKids?: boolean;
  budgetPreference?: 'economico' | 'medio' | 'premium';
}

// Conversation session per phone number for conversational continuity with disk persistence
export interface WhatsAppUserSession {
  phoneNumber: string;
  previousPlan?: OliPlanResponse | null;
  lastCity: string;
  lastInteraction: number;
  messageHistory: Array<{ sender: 'user' | 'oli'; text: string }>;
  preferences?: UserPreferences;
}

const DB_SESSIONS_FILE = path.join(process.cwd(), 'server', 'db_oli_sessions.json');

// Load persisted sessions from disk on server launch
function loadPersistedSessions(): Map<string, WhatsAppUserSession> {
  const map = new Map<string, WhatsAppUserSession>();
  try {
    if (fs.existsSync(DB_SESSIONS_FILE)) {
      const raw = fs.readFileSync(DB_SESSIONS_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        data.forEach((s) => {
          if (s && s.phoneNumber) {
            map.set(s.phoneNumber, s);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[OLI WhatsApp Service] No se pudo leer db_oli_sessions.json:', err);
  }
  return map;
}

const userSessions = loadPersistedSessions();

let saveSessionsTimer: NodeJS.Timeout | null = null;
export function debouncedSaveSessions(): void {
  if (saveSessionsTimer) clearTimeout(saveSessionsTimer);
  saveSessionsTimer = setTimeout(() => {
    try {
      const arr = Array.from(userSessions.values());
      fs.writeFileSync(DB_SESSIONS_FILE, JSON.stringify(arr, null, 2), 'utf8');
    } catch (err) {
      console.error('[OLI WhatsApp Service] Error guardando db_oli_sessions.json:', err);
    }
  }, 1200);
}

// Extract human preferences from conversational text to remember for the user
export function extractAndApplyUserPreferences(session: WhatsAppUserSession, text: string): void {
  if (!text) return;
  const lower = text.toLowerCase();
  if (!session.preferences) {
    session.preferences = {};
  }
  if (/perro|mascota|pet-?friendly|canino|gato/.test(lower)) {
    session.preferences.petFriendly = true;
  }
  if (/vegetariano|vegano|sin carne|veggie/.test(lower)) {
    session.preferences.vegetarian = true;
  }
  if (/ni[ñn]os|hijos|bendici[oó]n|familiar|familia/.test(lower)) {
    session.preferences.familyWithKids = true;
  }
  if (/barato|barateli|tres lucas|poco presupuesto|econ[oó]mico/.test(lower)) {
    session.preferences.budgetPreference = 'economico';
  }
}

// Cleanup stale sessions after 24 hours
setInterval(() => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let changed = false;
  for (const [phone, session] of userSessions.entries()) {
    if (now - session.lastInteraction > dayMs) {
      userSessions.delete(phone);
      changed = true;
    }
  }
  if (changed) debouncedSaveSessions();
}, 60 * 60 * 1000);

export function getOrCreateSession(phoneNumber: string): WhatsAppUserSession {
  let session = userSessions.get(phoneNumber);
  if (!session) {
    session = {
      phoneNumber,
      previousPlan: null,
      lastCity: 'Cajicá',
      lastInteraction: Date.now(),
      messageHistory: [],
      preferences: {},
    };
    userSessions.set(phoneNumber, session);
  } else {
    session.lastInteraction = Date.now();
    if (!session.preferences) {
      session.preferences = {};
    }
  }
  debouncedSaveSessions();
  return session;
}

function getCategoryEmoji(bizName: string, subCategory?: string, category?: string): string {
  const text = `${bizName} ${subCategory || ''} ${category || ''}`.toLowerCase();
  if (/barber|corte|peluquer|estil|peinado/.test(text)) return '💈';
  if (/pizza/.test(text)) return '🍕';
  if (/hamburg|burger/.test(text)) return '🍔';
  if (/caf[eé]|coffee|panader|postre|helad/.test(text)) return '☕';
  if (/restaurante|comida|almuerzo|cena|asador|parrilla/.test(text)) return '🍽️';
  if (/cerveza|bar|pub|trago|cocktail|licor/.test(text)) return '🍺';
  if (/auto|carro|lavad|mecanic|moto|detailing/.test(text)) return '🚗';
  if (/veterinari|mascota|pet|perr|canin/.test(text)) return '🐾';
  if (/mercado|fruta|verdura|supermercado|abastos/.test(text)) return '🍎';
  if (/hotel|glamping|hostal|cabaña/.test(text)) return '🏡';
  if (/artesani|papeler|tienda|comercio/.test(text)) return '🛍️';
  return '🏢';
}

/**
 * Formats Oli's response into structured "Text Cards" for WhatsApp
 * with ASCII frame borders, bold headers, highlighted offers, and interactive links.
 */
export function formatOliResponseForWhatsApp(response: OliPlanResponse): string {
  const parts: string[] = [];

  if (response.type === 'search') {
    parts.push(`🤖 *OLI · Asistente Oficial OleVeci*\n`);
    if (response.spokenText) {
      parts.push(`${response.spokenText}\n`);
    }

    if (response.matchedBusinesses && response.matchedBusinesses.length > 0) {
      response.matchedBusinesses.forEach((biz) => {
        const emoji = getCategoryEmoji(biz.name, biz.subCategory, biz.categoryId);
        const verifiedTag = biz.verified ? ' (Verificado ✅)' : '';
        const addressLine = biz.address || (biz.city ? `Sabana Centro (${biz.city})` : 'Sabana Centro');
        const cleanWa = (biz.whatsapp || biz.phone || '').replace(/\D/g, '');
        const mapQuery = encodeURIComponent(`${biz.name} ${biz.address || ''} ${biz.city || ''}`.trim());

        // Structured Box Card
        parts.push(`┌────────────────────────────────┐`);
        parts.push(`${emoji} *${biz.name.toUpperCase()}*${verifiedTag}`);
        parts.push(`📍 ${addressLine}`);
        if (biz.description) {
          parts.push(`✂️ ${biz.description}`);
        }
        parts.push(`└────────────────────────────────┘`);

        // Related or highlighted offers for this business
        const bizPosts = (response.matchedPosts || []).filter((p) => p.businessId === biz.id);
        const topPost = bizPosts[0] || (response.matchedPosts && response.matchedPosts.length > 0 ? response.matchedPosts[0] : null);

        if (topPost) {
          const price = topPost.promotionalPrice || topPost.originalPrice || topPost.approximatePrice;
          parts.push(`🎁 *OFERTA DESTACADA:*`);
          parts.push(`• *${topPost.title}:* ${price ? `${formatPriceCOP(price)} COP` : 'Consultar precio'}`);
          if (topPost.description && topPost.description !== topPost.title) {
            parts.push(`  _${topPost.description.slice(0, 110)}..._`);
          }
        }

        // Action links
        if (cleanWa) {
          parts.push(`💬 *Contactar al negocio:*`);
          parts.push(`https://wa.me/${cleanWa}`);
        }
        parts.push(`📍 *Ver ubicación:*`);
        parts.push(`https://www.google.com/maps/search/?api=1&query=${mapQuery}\n`);
      });
    } else if (response.matchedPosts && response.matchedPosts.length > 0) {
      response.matchedPosts.forEach((post) => {
        const price = post.promotionalPrice || post.originalPrice || post.approximatePrice;
        parts.push(`┌────────────────────────────────┐`);
        parts.push(`🎁 *${post.title.toUpperCase()}*`);
        parts.push(`🏢 *${post.businessName || 'Comercio Local'}*`);
        if (price) {
          parts.push(`💰 Precio: ${formatPriceCOP(price)} COP`);
        }
        if (post.description) {
          parts.push(`📝 ${post.description}`);
        }
        parts.push(`└────────────────────────────────┘`);

        if (post.businessWhatsapp) {
          const cleanWa = post.businessWhatsapp.replace(/\D/g, '');
          parts.push(`💬 *Contactar:* https://wa.me/${cleanWa}\n`);
        }
      });
    }

    parts.push(`_Escríbeme si quieres buscar otro comercio o armar un plan en la Sabana._`);
  } else {
    // Plan response
    parts.push(`🤖 *OLI · Tu Plan en OleVeci*\n`);
    parts.push(`🎉 *${response.planTitle || 'Plan Personalizado en Sabana Centro'}*`);
    parts.push(`📅 ${response.day || 'Fin de semana'} · 👥 ${response.targetAudience || 'En pareja'} (${response.personCount || 1} pers.)\n`);

    if (response.spokenText) {
      parts.push(`${response.spokenText}\n`);
    }

    if (response.stops && response.stops.length > 0) {
      parts.push(`📍 *ITINERARIO PASO A PASO:*\n`);
      response.stops.forEach((stop, idx) => {
        const cleanWa = (stop.businessWhatsapp || stop.businessPhone || '').replace(/\D/g, '');
        const mapQuery = encodeURIComponent(`${stop.businessName} ${stop.businessAddress || ''} ${stop.businessCity || ''}`.trim());

        parts.push(`┌────────────────────────────────┐`);
        parts.push(`${idx + 1}️⃣ *PARADA ${idx + 1} (${stop.time || 'Horario sugerido'})*`);
        parts.push(`🏢 *${stop.businessName}* (${stop.businessCity})`);
        parts.push(`✨ ${stop.postTitle || stop.activity}`);
        parts.push(`💰 Costo: ${formatPriceCOP(stop.cost)} COP`);
        if (stop.businessAddress) {
          parts.push(`📍 ${stop.businessAddress}`);
        }
        parts.push(`└────────────────────────────────┘`);
        if (cleanWa) {
          parts.push(`💬 *WhatsApp:* https://wa.me/${cleanWa}`);
        }
        parts.push(`📍 *Ubicación:* https://www.google.com/maps/search/?api=1&query=${mapQuery}\n`);
      });
    }

    if (response.totalEstimatedCost) {
      parts.push(`💵 *Presupuesto total estimado:* *${formatPriceCOP(response.totalEstimatedCost)} COP*`);
      if (response.personCount && response.personCount > 1 && response.costPerPerson) {
        parts.push(`👤 *Por persona:* *${formatPriceCOP(response.costPerPerson)} COP*`);
      }
    }

    parts.push(`\n_Toca el enlace de cada comercio para contactar o reservar directamente._`);
  }

  return parts.join('\n');
}

export interface WhatsAppInteractiveButton {
  id: string;
  title: string;
}

/**
 * Sends a message back to the user via Meta's WhatsApp Cloud API
 * Supports both standard text and native interactive buttons (Option D)
 */
export async function sendWhatsAppMessage(
  toPhoneNumber: string,
  text: string,
  phoneNumberId?: string,
  accessToken?: string,
  buttons?: WhatsAppInteractiveButton[]
): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = accessToken || process.env.WHATSAPP_TOKEN;
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    return {
      success: false,
      error: 'Variables WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configuradas en el servidor.',
    };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

    let bodyPayload: any;
    if (buttons && buttons.length > 0) {
      bodyPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhoneNumber,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: {
            buttons: buttons.slice(0, 3).map((b) => ({
              type: 'reply',
              reply: {
                id: b.id,
                title: b.title.slice(0, 20),
              },
            })),
          },
        },
      };
    } else {
      bodyPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhoneNumber,
        type: 'text',
        text: { preview_url: true, body: text },
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data?.error?.message || 'Error de Meta API' };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error de red con Meta API' };
  }
}

/**
 * Main Webhook Event Processor for incoming WhatsApp messages
 */
export async function processIncomingWhatsAppWebhook(
  payload: any,
  catalogPosts: Post[],
  catalogBusinesses: Business[]
): Promise<{ processed: boolean; replyText?: string; recipientPhone?: string; error?: string }> {
  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') {
      return { processed: false };
    }

    const fromPhone = message.from; // e.g. "573101234567"
    const userText = message.text?.body?.trim();

    if (!fromPhone || !userText) {
      return { processed: false };
    }

    const session = getOrCreateSession(fromPhone);
    extractAndApplyUserPreferences(session, userText);

    // Call Oli Agent with user text and previous session context
    const oliResponse = await generateOliPlan({
      userPrompt: userText,
      currentCity: session.lastCity || 'Cajicá',
      previousPlan: session.previousPlan,
      catalogPosts,
      catalogBusinesses,
      messageHistory: session.messageHistory,
    });

    // Update session state
    if (oliResponse.type === 'plan' && oliResponse.stops && oliResponse.stops.length > 0) {
      session.previousPlan = oliResponse;
    } else if (oliResponse.type === 'search') {
      session.previousPlan = null;
    }

    const formattedReply = formatOliResponseForWhatsApp(oliResponse);

    session.messageHistory.push({ sender: 'user', text: userText });
    session.messageHistory.push({ sender: 'oli', text: formattedReply });
    if (session.messageHistory.length > 10) {
      session.messageHistory = session.messageHistory.slice(-10);
    }

    // Send outgoing message through Meta Graph API if credentials are set
    await sendWhatsAppMessage(fromPhone, formattedReply);

    return {
      processed: true,
      replyText: formattedReply,
      recipientPhone: fromPhone,
    };
  } catch (error: any) {
    console.error('Error procesando webhook de WhatsApp:', error);
    return { processed: false, error: error?.message };
  }
}
