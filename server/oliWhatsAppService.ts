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
  isClosed?: boolean;
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
  const now = Date.now();
  if (!session) {
    session = {
      phoneNumber,
      previousPlan: null,
      lastCity: 'Cajicá',
      lastInteraction: now,
      messageHistory: [],
      preferences: {},
      isClosed: false,
    };
    userSessions.set(phoneNumber, session);
  } else {
    // Si pasaron más de 60 segundos de inactividad, cerramos el contexto anterior
    if (now - session.lastInteraction > 60 * 1000) {
      session.previousPlan = null;
      session.messageHistory = [];
      session.isClosed = true;
    }
    session.lastInteraction = now;
    if (!session.preferences) {
      session.preferences = {};
    }
  }
  debouncedSaveSessions();
  return session;
}

/**
 * Formats Oli's response into clean, natural WhatsApp rich text (*bold*, _italic_, clean emojis)
 * Avoids broken ASCII boxes and ugly, cluttered URL search parameters.
 */
export function formatOliResponseForWhatsApp(response: OliPlanResponse): string {
  const parts: string[] = [];

  if (response.type === 'search') {
    parts.push(`🤖 *OLI · Asistente Oficial OleVeci*\n`);
    if (response.spokenText) {
      parts.push(`${response.spokenText}\n`);
    }

    if (response.matchedBusinesses && response.matchedBusinesses.length > 0) {
      parts.push(`🏢 *Comercios Recomendados:*`);
      response.matchedBusinesses.forEach((biz, idx) => {
        const verifiedTag = biz.verified ? ' (Verificado ✅)' : '';
        const addressLine = biz.address ? `${biz.address}${biz.city ? ` (${biz.city})` : ''}` : (biz.city || 'Sabana Centro');
        const cleanWa = (biz.whatsapp || biz.phone || '').replace(/\D/g, '');

        parts.push(`\n*${idx + 1}. ${biz.name}*${verifiedTag}`);
        if (addressLine) {
          parts.push(`📍 ${addressLine}`);
        }
        if (biz.subCategory) {
          parts.push(`🏷️ ${biz.subCategory}`);
        }
        if (biz.hours) {
          parts.push(`⏰ ${biz.hours}`);
        }

        // Oferta destacada si existe
        const bizPosts = (response.matchedPosts || []).filter((p) => p.businessId === biz.id);
        const topPost = bizPosts[0] || (response.matchedPosts && response.matchedPosts.length > 0 ? response.matchedPosts[0] : null);
        if (topPost) {
          const price = topPost.promotionalPrice || topPost.originalPrice || topPost.approximatePrice;
          parts.push(`🎁 *Oferta destacada en OleVeci:*`);
          parts.push(`• ${topPost.title}${price ? ` - *${formatPriceCOP(price)}*` : ''}`);
        }

        // Contacto WhatsApp directo y limpio
        if (cleanWa) {
          parts.push(`💬 WhatsApp directo: https://wa.me/${cleanWa}`);
        } else if (biz.phone) {
          parts.push(`📞 Teléfono: ${biz.phone}`);
        }
      });
    } else if (response.matchedPosts && response.matchedPosts.length > 0) {
      parts.push(`🎁 *Ofertas y Planes Encontrados:*`);
      response.matchedPosts.forEach((post, idx) => {
        parts.push(`\n*${idx + 1}. ${post.title}*`);
        if (post.businessName) {
          parts.push(`🏢 ${post.businessName}${post.businessCity ? ` (${post.businessCity})` : ''}`);
        }
        const price = post.promotionalPrice || post.originalPrice || post.approximatePrice;
        if (price) {
          parts.push(`💰 Precio: *${formatPriceCOP(price)}*`);
        }
        if (post.description) {
          parts.push(`📝 ${post.description.slice(0, 120)}...`);
        }
        if (post.businessWhatsapp) {
          const cleanWa = post.businessWhatsapp.replace(/\D/g, '');
          parts.push(`💬 Contacto WhatsApp: https://wa.me/${cleanWa}`);
        }
      });
    }

    if (
      (response.matchedBusinesses && response.matchedBusinesses.length > 0) ||
      (response.matchedPosts && response.matchedPosts.length > 0)
    ) {
      parts.push(`\n_Escríbeme si quieres buscar otro comercio o armar un plan en la Sabana._`);
    }
  } else {
    // Plan response
    parts.push(`🤖 *OLI · Tu Plan en OleVeci*\n`);
    parts.push(`🎉 *${response.planTitle || 'Plan Personalizado en Sabana Centro'}*`);
    parts.push(`📅 ${response.day || 'Fin de semana'} · 👥 ${response.targetAudience || 'En pareja'} (${response.personCount || 1} pers.)\n`);

    if (response.spokenText) {
      parts.push(`${response.spokenText}\n`);
    }

    if (response.stops && response.stops.length > 0) {
      parts.push(`📍 *ITINERARIO PASO A PASO:*`);
      response.stops.forEach((stop, idx) => {
        const cleanWa = (stop.businessWhatsapp || stop.businessPhone || '').replace(/\D/g, '');

        parts.push(`\n*Parada ${idx + 1} (${stop.time || 'Horario sugerido'}):*`);
        parts.push(`🏢 *${stop.businessName}* (${stop.businessCity})`);
        parts.push(`✨ ${stop.postTitle || stop.activity}`);
        parts.push(`💰 Costo: *${formatPriceCOP(stop.cost)}*`);
        if (stop.businessAddress) {
          parts.push(`📌 Dirección: ${stop.businessAddress}`);
        }
        if (cleanWa) {
          parts.push(`💬 Contacto WhatsApp: https://wa.me/${cleanWa}`);
        }
      });
    }

    if (response.totalEstimatedCost) {
      parts.push(`\n💵 *Presupuesto total estimado:* *${formatPriceCOP(response.totalEstimatedCost)}*`);
      if (response.personCount && response.personCount > 1 && response.costPerPerson) {
        parts.push(`👤 *Por persona:* *${formatPriceCOP(response.costPerPerson)}*`);
      }
    }

    parts.push(`\n_Toca el enlace de WhatsApp de cada comercio para confirmar tu visita o reservar._`);
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
