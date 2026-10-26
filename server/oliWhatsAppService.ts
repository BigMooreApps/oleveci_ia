import { OliPlanResponse, GenerateOliPlanInput } from './oliTypes';
import { generateOliPlan } from './oliAssistant';
import { Post, Business } from '../src/types';
import { formatPriceCOP } from './oliValidator';

// In-memory conversation session per phone number for conversational continuity
interface WhatsAppUserSession {
  phoneNumber: string;
  previousPlan?: OliPlanResponse | null;
  lastCity: string;
  lastInteraction: number;
  messageHistory: Array<{ sender: 'user' | 'oli'; text: string }>;
}

const userSessions = new Map<string, WhatsAppUserSession>();

// Cleanup stale sessions after 24 hours
setInterval(() => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  for (const [phone, session] of userSessions.entries()) {
    if (now - session.lastInteraction > dayMs) {
      userSessions.delete(phone);
    }
  }
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
    };
    userSessions.set(phoneNumber, session);
  } else {
    session.lastInteraction = Date.now();
  }
  return session;
}

/**
 * Formats Oli's response into WhatsApp-friendly markdown (*bold*, _italic_, clean emojis)
 */
export function formatOliResponseForWhatsApp(response: OliPlanResponse): string {
  const parts: string[] = [];

  if (response.type === 'search') {
    parts.push(`🤖 *OLI · Asistente Oficial OleVeci*\n`);
    parts.push(response.spokenText);

    if (response.matchedBusinesses && response.matchedBusinesses.length > 0) {
      parts.push(`\n🏢 *Comercios Recomendados:*`);
      response.matchedBusinesses.forEach((biz, idx) => {
        parts.push(`\n*${idx + 1}. ${biz.name}*`);
        if (biz.city || biz.address) {
          parts.push(`📍 ${biz.address || ''}${biz.city ? ` (${biz.city})` : ''}`);
        }
        if (biz.subCategory) {
          parts.push(`🏷️ ${biz.subCategory}`);
        }
        if (biz.hours) {
          parts.push(`⏰ ${biz.hours}`);
        }
        if (biz.whatsapp) {
          const cleanWa = biz.whatsapp.replace(/\D/g, '');
          parts.push(`💬 WhatsApp directo: https://wa.me/${cleanWa}`);
        }
        if (biz.phone && biz.phone !== biz.whatsapp) {
          parts.push(`📞 Teléfono: ${biz.phone}`);
        }
      });
    }

    if (response.matchedPosts && response.matchedPosts.length > 0) {
      const topPromo = response.matchedPosts[0];
      const price = topPromo.promotionalPrice || topPromo.originalPrice || topPromo.approximatePrice;
      parts.push(`\n🎁 *Oferta destacada en OleVeci:*`);
      parts.push(`• *${topPromo.title}*`);
      if (price) {
        parts.push(`  Precio: *${formatPriceCOP(price)}*`);
      }
    }

    parts.push(`\n_Escríbeme si quieres buscar otro comercio o armar un plan en la Sabana._`);
  } else {
    // Plan response
    parts.push(`🤖 *OLI · Tu Plan en OleVeci*\n`);
    parts.push(`🎉 *${response.planTitle || 'Plan Personalizado en Sabana Centro'}*`);
    parts.push(`📅 ${response.day || 'Fin de semana'} · 👥 ${response.targetAudience || 'En pareja'} (${response.personCount || 1} pers.)\n`);

    if (response.spokenText) {
      parts.push(response.spokenText);
    }

    if (response.stops && response.stops.length > 0) {
      parts.push(`\n📍 *ITINERARIO PASO A PASO:*`);
      response.stops.forEach((stop, idx) => {
        parts.push(`\n*Parada ${idx + 1} (${stop.time || 'Horario sugerido'}):*`);
        parts.push(`🏢 *${stop.businessName}* (${stop.businessCity})`);
        parts.push(`✨ ${stop.postTitle || stop.activity}`);
        parts.push(`💰 Costo: *${formatPriceCOP(stop.cost)}*`);
        if (stop.businessAddress) {
          parts.push(`📌 Dirección: ${stop.businessAddress}`);
        }
        if (stop.businessWhatsapp) {
          const cleanWa = stop.businessWhatsapp.replace(/\D/g, '');
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

/**
 * Sends a message back to the user via Meta's WhatsApp Cloud API
 */
export async function sendWhatsAppMessage(
  toPhoneNumber: string,
  text: string,
  phoneNumberId?: string,
  accessToken?: string
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
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhoneNumber,
        type: 'text',
        text: { preview_url: true, body: text },
      }),
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
