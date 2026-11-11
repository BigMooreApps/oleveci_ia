import * as Baileys from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { generateOliPlan } from './oliAssistant';
import { formatOliResponseForWhatsApp, getOrCreateSession, extractAndApplyUserPreferences } from './oliWhatsAppService';
import { Business, Post } from '../src/types';

type WASocket = Baileys.WASocket;

// Helper to resolve makeWASocket across both ESM (tsx dev) and CommonJS bundled (esbuild production)
function getMakeWASocket(): typeof Baileys.default {
  const mod = Baileys as any;
  if (typeof mod === 'function') return mod;
  if (mod && typeof mod.default === 'function') return mod.default;
  if (mod && typeof mod.makeWASocket === 'function') return mod.makeWASocket;
  if (mod && mod.default && typeof mod.default.default === 'function') return mod.default.default;
  if (mod && mod.default && typeof mod.default.makeWASocket === 'function') return mod.default.makeWASocket;
  throw new Error('No se pudo encontrar la función constructora makeWASocket en @whiskeysockets/baileys');
}

const useMultiFileAuthState =
  Baileys.useMultiFileAuthState || (Baileys as any).default?.useMultiFileAuthState;
const DisconnectReason =
  Baileys.DisconnectReason || (Baileys as any).default?.DisconnectReason;

export type BaileysStatus = 'disconnected' | 'connecting' | 'waiting_for_qr' | 'connected';

interface BaileysState {
  status: BaileysStatus;
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  lastError: string | null;
}

const AUTH_DIR = path.join(process.cwd(), 'whatsapp_session');

let sock: WASocket | null = null;
let getBusinessesFn: () => Business[] = () => [];
let getPostsFn: () => Post[] = () => [];
let onLogConversationFn: ((entry: any) => void) | null = null;
let isConnecting = false;
let autoReconnect = true;
let reconnectTimer: NodeJS.Timeout | null = null;
let watchdogInterval: NodeJS.Timeout | null = null;

function scheduleReconnect(delayMs = 3000) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (autoReconnect && state.status !== 'connected' && !isConnecting) {
      console.log(`[OLI WhatsApp Web] Reintentando conexión automática tras ${delayMs / 1000}s...`);
      connectBaileys().catch((e) => {
        console.error('[OLI WhatsApp Web] Error en reintento automático:', e);
        scheduleReconnect(Math.min(delayMs * 1.5, 30_000));
      });
    }
  }, delayMs);
}

const state: BaileysState = {
  status: 'disconnected',
  qrCodeDataUrl: null,
  connectedPhone: null,
  connectedName: null,
  lastError: null,
};

// Check if previous session exists on disk
function hasSavedSession(): boolean {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      const files = fs.readdirSync(AUTH_DIR);
      return files.length > 0;
    }
  } catch {
    // Ignore error
  }
  return false;
}

// Minimal silent logger to keep terminal output clean
const silentLogger = {
  level: 'silent',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => silentLogger,
};

export function initBaileysService(
  getBusinesses: () => Business[],
  getPosts: () => Post[],
  onLogConversation?: (entry: any) => void
) {
  getBusinessesFn = getBusinesses;
  getPostsFn = getPosts;
  if (onLogConversation) onLogConversationFn = onLogConversation;

  // Active session Watchdog: Checks every 25s if session files exist and reconnects automatically if dropped
  if (!watchdogInterval) {
    watchdogInterval = setInterval(() => {
      if (autoReconnect && hasSavedSession() && state.status !== 'connected' && !isConnecting) {
        console.log('[OLI WhatsApp Web 🐕 Watchdog] Detectada desconexión con sesión activa. Reconectando...');
        connectBaileys().catch((err) => {
          console.warn('[OLI WhatsApp Web 🐕 Watchdog] Intento de reconexión falló:', err?.message || err);
        });
      }
    }, 25_000);
  }

  // If there is already an existing session, auto-connect on server start
  if (hasSavedSession()) {
    console.log('[OLI WhatsApp Web] Sesión previa encontrada en disco. Reconectando...');
    connectBaileys().catch((err) => {
      console.error('[OLI WhatsApp Web] Error al restaurar sesión previa:', err);
    });
  }
}

export function getBaileysState(): BaileysState {
  return { ...state };
}

export async function connectBaileys(): Promise<BaileysState> {
  if (state.status === 'connected') {
    return { ...state };
  }

  if (isConnecting) {
    return { ...state };
  }

  isConnecting = true;
  state.status = 'connecting';
  state.lastError = null;

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    // Clean up previous socket if any before creating a new one
    if (sock) {
      try {
        sock.ev.removeAllListeners('connection.update');
        sock.ev.removeAllListeners('creds.update');
        sock.ev.removeAllListeners('messages.upsert');
      } catch {}
      sock = null;
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const makeWASocket = getMakeWASocket();
    sock = makeWASocket({
      auth: authState,
      printQRInTerminal: false,
      logger: silentLogger as any,
      browser: ['OleVeci Asistente IA', 'Chrome', '1.0.0'],
      keepAliveIntervalMs: 25_000,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            scale: 8,
            color: {
              dark: '#075E54',
              light: '#FFFFFF',
            },
          });
          state.status = 'waiting_for_qr';
          state.qrCodeDataUrl = qrDataUrl;
          console.log('[OLI WhatsApp Web] Nuevo código QR de vinculación generado');
        } catch (qrErr) {
          console.error('[OLI WhatsApp Web] Error generando QR data URL:', qrErr);
        }
      }

      if (connection === 'open') {
        const rawUser = sock?.user?.id || '';
        const phone = rawUser.split(':')[0] || rawUser.split('@')[0];
        state.status = 'connected';
        state.qrCodeDataUrl = null;
        state.connectedPhone = phone;
        state.connectedName = sock?.user?.name || 'OleVeci Bot';
        state.lastError = null;
        isConnecting = false;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        console.log(`[OLI WhatsApp Web] ✅ Conectado exitosamente como +${phone}`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && autoReconnect;
        console.log(
          `[OLI WhatsApp Web] Conexión cerrada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`
        );

        state.status = 'disconnected';
        state.qrCodeDataUrl = null;
        isConnecting = false;

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('[OLI WhatsApp Web] Sesión cerrada desde el celular. Limpiando credenciales...');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch {}
          state.connectedPhone = null;
          state.connectedName = null;
        } else if (shouldReconnect) {
          const delay = statusCode === DisconnectReason.restartRequired ? 1000 : 3000;
          scheduleReconnect(delay);
        }
      }
    });

    // Listen for incoming messages and reply with OLI
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' || !messages || messages.length === 0) return;

      for (const msg of messages) {
        try {
          await handleIncomingMessage(msg);
        } catch (err) {
          console.error('[OLI WhatsApp Web] Error procesando mensaje entrante:', err);
        }
      }
    });

    return { ...state };
  } catch (err: any) {
    isConnecting = false;
    state.status = 'disconnected';
    state.lastError = err?.message || 'Error al iniciar conexión de WhatsApp';
    console.error('[OLI WhatsApp Web] Error al conectar:', err);
    return { ...state };
  }
}

async function transcribeVoiceNoteWithGroq(
  audioBuffer: Buffer,
  mimetype = 'audio/ogg'
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;

  try {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimetype });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'es');
    formData.append('response_format', 'text');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: formData,
    });

    if (!res.ok) {
      console.warn('[OLI Baileys] Groq Whisper retornó HTTP', res.status, await res.text());
      return null;
    }

    const transcribed = (await res.text()).trim();
    return transcribed || null;
  } catch (err: any) {
    console.warn('[OLI Baileys] Error llamando a Groq Whisper:', err?.message || err);
    return null;
  }
}

async function handleIncomingMessage(msg: Baileys.proto.IWebMessageInfo) {
  if (!sock) return;

  // Ignore outgoing messages sent by the bot
  if (msg.key.fromMe) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  // Ignore status updates and system broadcasts
  if (remoteJid.endsWith('@broadcast') || remoteJid === 'status@broadcast') return;

  // Extract phone number from JID
  const senderPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/:\d+/, '');

  // Extract text from regular conversation or extended text
  let text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    '';

  let isVoiceNote = false;

  // Check if incoming message is an audio / voice note
  if (!text.trim() && (msg.message?.audioMessage || (msg.message as any)?.voiceMessage)) {
    try {
      const downloadMedia =
        (Baileys as any).downloadMediaMessage || (Baileys as any).default?.downloadMediaMessage;
      if (typeof downloadMedia === 'function') {
        const audioMsg = msg.message?.audioMessage || (msg.message as any)?.voiceMessage;
        console.log(`[OLI WhatsApp Web] 🎙️ Nota de voz recibida de +${senderPhone}. Descargando y transcribiendo con Whisper...`);
        const buffer = await downloadMedia(msg, 'buffer', {});
        if (buffer && buffer.length > 0) {
          const transcribed = await transcribeVoiceNoteWithGroq(
            buffer,
            audioMsg?.mimetype || 'audio/ogg'
          );
          if (transcribed) {
            text = transcribed;
            isVoiceNote = true;
            console.log(`[OLI WhatsApp Web] 🎙️ Nota de voz transcrita con éxito: "${transcribed}"`);
          }
        }
      }
    } catch (audioErr: any) {
      console.warn('[OLI WhatsApp Web] Error transcribiendo nota de voz:', audioErr?.message || audioErr);
    }
  }

  const cleanText = text.trim();
  if (!cleanText) return;

  console.log(`[OLI WhatsApp Web] 📩 Mensaje de +${senderPhone}${isVoiceNote ? ' (Nota de voz)' : ''}: "${cleanText}"`);

  // Simulate typing indicator in WhatsApp
  try {
    await sock.readMessages([msg.key]);
    await sock.sendPresenceUpdate('composing', remoteJid);
  } catch {}

  // Get or initialize conversational session
  const session = getOrCreateSession(senderPhone);
  extractAndApplyUserPreferences(session, cleanText);

  const businesses = getBusinessesFn();
  const posts = getPostsFn();

  // Call Oli core engine
  const oliResponse = await generateOliPlan({
    userPrompt: cleanText,
    currentCity: session.lastCity || 'Cajicá',
    userBudget: 100000,
    previousPlan: session.previousPlan || null,
    messageHistory: session.messageHistory,
    catalogBusinesses: businesses,
    catalogPosts: posts,
  });

  // Update session state
  if (oliResponse.targetAudience) {
    session.lastCity = oliResponse.targetAudience;
  }
  if (oliResponse.stops && oliResponse.stops.length > 0) {
    session.previousPlan = oliResponse;
  }

  // Format into WhatsApp markdown
  let replyMarkdown = formatOliResponseForWhatsApp(oliResponse);
  if (isVoiceNote) {
    replyMarkdown = `🎙️ _(Escuché tu nota de voz: "${cleanText}")_\n\n${replyMarkdown}`;
  }

  // Update conversation history
  session.messageHistory.push({ sender: 'user', text: cleanText });
  session.messageHistory.push({ sender: 'oli', text: replyMarkdown });
  if (session.messageHistory.length > 20) {
    session.messageHistory = session.messageHistory.slice(-20);
  }

  // Stop typing indicator and send response
  try {
    await sock.sendPresenceUpdate('paused', remoteJid);

    // Option D: Prepare native interactive buttons if commerce data is available
    const firstBiz = (oliResponse.matchedBusinesses && oliResponse.matchedBusinesses[0]) || null;
    const cleanWa = firstBiz ? (firstBiz.whatsapp || firstBiz.phone || '').replace(/\D/g, '') : '';
    const mapQuery = firstBiz ? encodeURIComponent(`${firstBiz.name} ${firstBiz.address || ''} ${firstBiz.city || ''}`.trim()) : '';

    const buttons: any[] = [];
    if (cleanWa) {
      buttons.push({
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: '💬 Contactar Comercio',
          url: `https://wa.me/${cleanWa}`,
          merchant_url: `https://wa.me/${cleanWa}`,
        }),
      });
    }
    if (firstBiz) {
      buttons.push({
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: '📍 Ver Ubicación',
          url: `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
          merchant_url: `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
        }),
      });
      buttons.push({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: '🎁 Ver Ofertas',
          id: `ofertas_${firstBiz.id}`,
        }),
      });
    }

    let sentSuccessfully = false;
    const generateWAMessage =
      (Baileys as any).generateWAMessageFromContent ||
      (Baileys as any).default?.generateWAMessageFromContent;

    if (buttons.length > 0 && typeof generateWAMessage === 'function') {
      try {
        const interactiveMsg = generateWAMessage(
          remoteJid,
          {
            viewOnceMessage: {
              message: {
                interactiveMessage: {
                  body: { text: replyMarkdown },
                  footer: { text: 'OleVeci · Sabana Centro' },
                  header: {
                    title: firstBiz?.name || 'OleVeci',
                    hasMediaAttachment: false,
                  },
                  nativeFlowMessage: {
                    buttons,
                  },
                },
              },
            },
          },
          { userJid: sock.user?.id }
        );

        if (sock.relayMessage && interactiveMsg?.message) {
          await sock.relayMessage(remoteJid, interactiveMsg.message, {
            messageId: interactiveMsg.key?.id,
          });
          sentSuccessfully = true;
          console.log(`[OLI WhatsApp Web] 🚀 Tarjeta interactiva con botones enviada exitosamente a +${senderPhone}`);
        }
      } catch (interactiveErr) {
        console.warn('[OLI WhatsApp Web] Fallback a mensaje estándar de texto:', interactiveErr);
      }
    }

    if (!sentSuccessfully) {
      await sock.sendMessage(remoteJid, { text: replyMarkdown });
      console.log(`[OLI WhatsApp Web] 🚀 Respuesta con tarjeta de texto enviada a +${senderPhone}`);
    }

    // Record session conversation log
    if (onLogConversationFn) {
      try {
        onLogConversationFn({
          sessionId: `wa_${senderPhone}`,
          city: session.lastCity || 'Cajicá',
          userPrompt: cleanText,
          budget: 100000,
          plan: oliResponse,
        });
      } catch (logErr) {
        console.warn('Error recording WhatsApp conversation log:', logErr);
      }
    }
  } catch (sendErr) {
    console.error(`[OLI WhatsApp Web] Error enviando respuesta a +${senderPhone}:`, sendErr);
  }
}

export async function disconnectBaileys(): Promise<BaileysState> {
  autoReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try {
      await sock.logout();
    } catch {}
    try {
      sock.end(undefined);
    } catch {}
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('messages.upsert');
    } catch {}
    sock = null;
  }

  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch {}

  state.status = 'disconnected';
  state.qrCodeDataUrl = null;
  state.connectedPhone = null;
  state.connectedName = null;
  state.lastError = null;
  isConnecting = false;
  autoReconnect = true;

  console.log('[OLI WhatsApp Web] Dispositivo desvinculado.');
  return { ...state };
}
