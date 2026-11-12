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
 * Cleans spoken text specifically for WhatsApp by condensing it into a short, direct lead-in
 */
export function cleanSpokenTextForWhatsApp(text: string, hasItems: boolean = false): string {
  if (!text) return '';

  let clean = text.trim();

  if (hasItems) {
    // Si van a aparecer fichas abajo, condensamos a una sola línea introductoria muy breve
    clean = clean.replace(/¡Listo veci!\s*¡Claro que sí!\s*/i, '¡Listo veci! ');
    clean = clean.replace(/¡Listo veci!\s*¡Por supuesto!\s*/i, '¡Listo veci! ');

    // Si tiene la estructura "¡Listo veci! ... te recomiendo / te super recomiendo"
    const matchTeRecomiendo = clean.match(/^(¡Listo veci!.*?\bte (?:super\s+)?recomiendo)\b/i);
    if (matchTeRecomiendo) {
      return matchTeRecomiendo[1].replace(/te super recomiendo/i, 'te recomiendo');
    }

    const matchSugerencia = clean.match(/^(¡Listo veci!.*?\b(?:te sugiero|te recomiendo))\b/i);
    if (matchSugerencia) {
      return matchSugerencia[1];
    }

    clean = clean
      .replace(/[¡!]?puedes tocar la tarjeta.*?[!\.]/gi, '')
      .replace(/[¡!]?toca la tarjeta.*?[!\.]/gi, '')
      .replace(/abajo te dejo el contacto.*?[!\.]/gi, '')
      .replace(/abajo tienes su contacto.*?[!\.]/gi, '')
      .replace(/en pantalla tienes todos los detalles.*?[!\.]/gi, '')
      .trim();

    const firstSentence = clean.split(/[.\n]/)[0].trim();
    if (firstSentence && firstSentence.length > 10) {
      return firstSentence;
    }
  } else {
    clean = clean
      .replace(/[¡!]?puedes tocar la tarjeta.*?[!\.]/gi, '')
      .replace(/[¡!]?toca la tarjeta.*?[!\.]/gi, '')
      .replace(/en pantalla tienes todos los detalles/gi, 'aquí tienes los detalles')
      .trim();
  }

  return clean;
}

/**
 * Formats Oli's response into clean, natural WhatsApp rich text (*bold*, _italic_, clean emojis)
 * Avoids broken ASCII boxes, repetitive paragraphs, and ugly URL search parameters.
 */
export function formatOliResponseForWhatsApp(response: OliPlanResponse): string {
  const parts: string[] = [];

  if (response.type === 'search') {
    const hasBusinesses = response.matchedBusinesses && response.matchedBusinesses.length > 0;
    const hasPosts = response.matchedPosts && response.matchedPosts.length > 0;
    const hasItems = hasBusinesses || hasPosts;

    if (!hasItems) {
      // Saludo puro ("¡Hola Veci! Soy Oli...") o respuesta de texto sin fichas
      return cleanSpokenTextForWhatsApp(response.spokenText || '', false);
    }

    // Intro ultra corta y directa (ej: "¡Listo veci! Para que te tomes una buena cervecita, te recomiendo")
    const cleanSpoken = cleanSpokenTextForWhatsApp(response.spokenText || '', true);
    if (cleanSpoken) {
      parts.push(cleanSpoken);
    }

    if (hasBusinesses) {
      // Mostramos máximo 2 comercios para mantener el mensaje corto y ejecutivo en WhatsApp
      response.matchedBusinesses.slice(0, 2).forEach((biz, idx) => {
        const addressLine = biz.address ? `${biz.address}${biz.city ? ` (${biz.city})` : ''}` : (biz.city || 'Sabana Centro');
        const cleanWa = (biz.whatsapp || biz.phone || '').replace(/\D/g, '');

        const bizLines: string[] = [];
        bizLines.push(`*${idx + 1}. ${biz.name}*`);
        if (addressLine) {
          bizLines.push(`📍 ${addressLine}`);
        }
        if (biz.subCategory) {
          bizLines.push(`🏷️ ${biz.subCategory}`);
        }
        if (biz.hours) {
          bizLines.push(`⏰ ${biz.hours}`);
        }

        // Oferta destacada si existe y pertenece estrictamente a este comercio
        const bizPosts = (response.matchedPosts || []).filter((p) => p.businessId === biz.id);
        const topPost = bizPosts[0];
        if (topPost) {
          const price = topPost.promotionalPrice || topPost.originalPrice || topPost.approximatePrice;
          bizLines.push(`\n🎁 *Oferta destacada en OleVeci:*`);
          bizLines.push(`• ${topPost.title}${price ? ` - *${formatPriceCOP(price)}*` : ''}`);
        }

        // Contacto directo limpio sin previews
        if (cleanWa) {
          bizLines.push(`💬 WhatsApp directo: ${cleanWa}`);
        } else if (biz.phone) {
          bizLines.push(`📞 Teléfono: ${biz.phone}`);
        }

        parts.push(bizLines.join('\n'));
      });
    } else if (hasPosts) {
      response.matchedPosts.slice(0, 2).forEach((post, idx) => {
        const cleanWa = (post.businessWhatsapp || '').replace(/\D/g, '');
        const price = post.promotionalPrice || post.originalPrice || post.approximatePrice;

        const postLines: string[] = [];
        postLines.push(`*${idx + 1}. ${post.title}*`);
        if (post.businessName) {
          postLines.push(`🏢 ${post.businessName}${post.businessCity ? ` (${post.businessCity})` : ''}`);
        }
        if (price) {
          postLines.push(`💰 Precio: *${formatPriceCOP(price)}*`);
        }
        if (cleanWa) {
          postLines.push(`💬 WhatsApp directo: ${cleanWa}`);
        }
        parts.push(postLines.join('\n'));
      });
    }

    parts.push(`_Si quieres buscar otro comercio o armar otro plan, hazmelo saber_`);
    return parts.join('\n\n');
  } else {
    // Plan / Itinerario simplificado y conciso para WhatsApp
    parts.push(`🎉 *${response.planTitle || 'Plan Personalizado en Sabana Centro'}*`);
    parts.push(`📅 ${response.day || 'Fin de semana'} · 👥 ${response.targetAudience || 'En pareja'} (${response.personCount || 1} pers.)`);

    if (response.stops && response.stops.length > 0) {
      response.stops.forEach((stop, idx) => {
        const cleanWa = (stop.businessWhatsapp || stop.businessPhone || '').replace(/\D/g, '');
        const stopLines: string[] = [];
        stopLines.push(`*Parada ${idx + 1} (${stop.time || 'Horario sugerido'}): ${stop.businessName}* (${stop.businessCity})`);
        stopLines.push(`✨ ${stop.postTitle || stop.activity}`);
        stopLines.push(`💰 Costo: *${formatPriceCOP(stop.cost)}*`);
        if (stop.businessAddress) {
          stopLines.push(`📌 Dirección: ${stop.businessAddress}`);
        }
        if (cleanWa) {
          stopLines.push(`💬 WhatsApp directo: ${cleanWa}`);
        }
        parts.push(stopLines.join('\n'));
      });
    }

    if (response.totalEstimatedCost) {
      let costLine = `💵 *Presupuesto total estimado:* *${formatPriceCOP(response.totalEstimatedCost)}*`;
      if (response.personCount && response.personCount > 1 && response.costPerPerson) {
        costLine += ` · *${formatPriceCOP(response.costPerPerson)}* / persona`;
      }
      parts.push(costLine);
    }

    parts.push(`_Si quieres buscar otro comercio o armar otro plan, hazmelo saber_`);
    return parts.join('\n\n');
  }
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
      channel: 'whatsapp',
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
