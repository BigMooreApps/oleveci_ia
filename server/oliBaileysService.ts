import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { generateOliPlan } from './oliAssistant';
import { formatOliResponseForWhatsApp, getOrCreateSession } from './oliWhatsAppService';
import { Business, Post } from '../src/types';

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
let isConnecting = false;
let autoReconnect = true;

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
  getPosts: () => Post[]
) {
  getBusinessesFn = getBusinesses;
  getPostsFn = getPosts;

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

    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: authState,
      printQRInTerminal: false,
      logger: silentLogger as any,
      browser: ['OleVeci Asistente IA', 'Chrome', '1.0.0'],
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
          setTimeout(() => {
            connectBaileys().catch((e) => console.error('[OLI WhatsApp Web] Reconnect error:', e));
          }, 3000);
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

async function handleIncomingMessage(msg: proto.IWebMessageInfo) {
  if (!sock) return;

  // Ignore outgoing messages sent by the bot
  if (msg.key.fromMe) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  // Ignore status updates and system broadcasts
  if (remoteJid.endsWith('@broadcast') || remoteJid === 'status@broadcast') return;

  // Extract text from regular conversation or extended text
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    '';

  const cleanText = text.trim();
  if (!cleanText) return;

  // Extract phone number from JID
  const senderPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/:\d+/, '');
  console.log(`[OLI WhatsApp Web] 📩 Mensaje de +${senderPhone}: "${cleanText}"`);

  // Simulate typing indicator in WhatsApp
  try {
    await sock.readMessages([msg.key]);
    await sock.sendPresenceUpdate('composing', remoteJid);
  } catch {}

  // Get or initialize conversational session
  const session = getOrCreateSession(senderPhone);

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
  const replyMarkdown = formatOliResponseForWhatsApp(oliResponse);

  // Update conversation history
  session.messageHistory.push({ sender: 'user', text: cleanText });
  session.messageHistory.push({ sender: 'oli', text: replyMarkdown });
  if (session.messageHistory.length > 20) {
    session.messageHistory = session.messageHistory.slice(-20);
  }

  // Stop typing indicator and send response
  try {
    await sock.sendPresenceUpdate('paused', remoteJid);
    await sock.sendMessage(remoteJid, { text: replyMarkdown });
    console.log(`[OLI WhatsApp Web] 🚀 Respuesta enviada exitosamente a +${senderPhone}`);
  } catch (sendErr) {
    console.error(`[OLI WhatsApp Web] Error enviando respuesta a +${senderPhone}:`, sendErr);
  }
}

export async function disconnectBaileys(): Promise<BaileysState> {
  autoReconnect = false;
  if (sock) {
    try {
      await sock.logout();
    } catch {}
    try {
      sock.end(undefined);
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
