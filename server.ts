import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { INITIAL_POSTS, INITIAL_BUSINESSES } from './src/data/seedData';
import { READY_PLANS_SEED, SimulatedReadyPlan } from './src/data/readyPlansData';
import { Post, Business } from './src/types';
import { renderPostCardImage } from './server/cardRenderer';
import { generateOliPlan, generateOliSpeechAudio } from './server/oliAssistant';
import { processIncomingWhatsAppWebhook, sendWhatsAppMessage } from './server/oliWhatsAppService';
import {
  initBaileysService,
  connectBaileys,
  disconnectBaileys,
  getBaileysState,
} from './server/oliBaileysService';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable reverse proxy trust (Cloud Run, Traefik, Easypanel, Nginx) so HTTPS protocol is detected accurately
app.enable('trust proxy');

app.use(express.json({ limit: '10mb' }));

// In-memory store for instant Open Graph crawler resolution (seeded + runtime sync)
const postStore = new Map<string, Post>();
const businessStore = new Map<string, Business>();
const planStore = new Map<string, SimulatedReadyPlan>();

const DB_POSTS_FILE = path.join(process.cwd(), 'server', 'db_posts.json');
const DB_BUSINESSES_FILE = path.join(process.cwd(), 'server', 'db_businesses.json');
const DB_PLANS_FILE = path.join(process.cwd(), 'server', 'db_plans.json');

let lastPostsSerialized = '';
let savePostsTimer: NodeJS.Timeout | null = null;

// Helper: Save posts to database file on disk with debouncing and change detection
function savePostsToDisk() {
  if (savePostsTimer) clearTimeout(savePostsTimer);
  savePostsTimer = setTimeout(() => {
    try {
      const list = Array.from(postStore.values());
      const serialized = JSON.stringify(list, null, 2);
      if (serialized !== lastPostsSerialized) {
        lastPostsSerialized = serialized;
        fs.writeFileSync(DB_POSTS_FILE, serialized, 'utf-8');
      }
    } catch (err) {
      console.error('Error saving db_posts.json:', err);
    }
  }, 300);
}

let lastBusinessesSerialized = '';
let saveBusinessesTimer: NodeJS.Timeout | null = null;

// Helper: Save businesses to database file on disk with debouncing and change detection
function saveBusinessesToDisk() {
  if (saveBusinessesTimer) clearTimeout(saveBusinessesTimer);
  saveBusinessesTimer = setTimeout(() => {
    try {
      const list = Array.from(businessStore.values());
      const serialized = JSON.stringify(list, null, 2);
      if (serialized !== lastBusinessesSerialized) {
        lastBusinessesSerialized = serialized;
        fs.writeFileSync(DB_BUSINESSES_FILE, serialized, 'utf-8');
      }
    } catch (err) {
      console.error('Error saving db_businesses.json:', err);
    }
  }, 300);
}

let lastPlansSerialized = '';
let savePlansTimer: NodeJS.Timeout | null = null;

// Helper: Save plans to database file on disk with debouncing and change detection
function savePlansToDisk() {
  if (savePlansTimer) clearTimeout(savePlansTimer);
  savePlansTimer = setTimeout(() => {
    try {
      const list = Array.from(planStore.values());
      const serialized = JSON.stringify(list, null, 2);
      if (serialized !== lastPlansSerialized) {
        lastPlansSerialized = serialized;
        fs.writeFileSync(DB_PLANS_FILE, serialized, 'utf-8');
      }
    } catch (err) {
      console.error('Error saving db_plans.json:', err);
    }
  }, 300);
}

// Initialize stores from seeds
INITIAL_POSTS.forEach((p) => postStore.set(p.id, p));
INITIAL_BUSINESSES.forEach((b) => businessStore.set(b.id, b));
READY_PLANS_SEED.forEach((pl) => planStore.set(pl.id, pl));

// Restore persisted database posts from disk if available
try {
  if (fs.existsSync(DB_POSTS_FILE)) {
    const raw = fs.readFileSync(DB_POSTS_FILE, 'utf-8');
    lastPostsSerialized = raw;
    const savedList = JSON.parse(raw);
    if (Array.isArray(savedList)) {
      savedList.forEach((p: Post) => {
        if (p?.id) postStore.set(p.id, p);
      });
    }
  } else {
    savePostsToDisk();
  }
} catch (err) {
  console.error('Error reading db_posts.json:', err);
}

// Restore persisted database businesses from disk if available
try {
  if (fs.existsSync(DB_BUSINESSES_FILE)) {
    const raw = fs.readFileSync(DB_BUSINESSES_FILE, 'utf-8');
    lastBusinessesSerialized = raw;
    const savedList = JSON.parse(raw);
    if (Array.isArray(savedList)) {
      savedList.forEach((b: Business) => {
        if (b?.id) businessStore.set(b.id, b);
      });
    }
  } else {
    saveBusinessesToDisk();
  }
} catch (err) {
  console.error('Error reading db_businesses.json:', err);
}

// Restore persisted database plans from disk if available
try {
  if (fs.existsSync(DB_PLANS_FILE)) {
    const raw = fs.readFileSync(DB_PLANS_FILE, 'utf-8');
    lastPlansSerialized = raw;
    const savedList = JSON.parse(raw);
    if (Array.isArray(savedList)) {
      savedList.forEach((pl: SimulatedReadyPlan) => {
        if (pl?.id) planStore.set(pl.id, pl);
      });
    }
  } else {
    savePlansToDisk();
  }
} catch (err) {
  console.error('Error reading db_plans.json:', err);
}

// Helper: Escape HTML special characters for meta tags
function escapeHtml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Format Colombian Peso
function formatPrice(amount?: number): string {
  if (!amount && amount !== 0) return '';
  return `$${amount.toLocaleString('es-CO')}`;
}

// Helper: Injects Open Graph & Twitter meta tags into HTML
function injectOgMeta(
  html: string,
  meta: {
    title: string;
    description: string;
    image?: string;
    video?: string;
    url: string;
    type?: string;
  }
): string {
  let output = html;

  // Replace Title
  output = output.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtml(meta.title)}</title>`
  );

  // Replace Meta Description
  if (output.includes('name="description"')) {
    output = output.replace(
      /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`
    );
  }

  // Replace og:title
  if (output.includes('property="og:title"')) {
    output = output.replace(
      /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
    );
  }

  // Replace og:description
  if (output.includes('property="og:description"')) {
    output = output.replace(
      /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
      `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
    );
  }

  // Remove existing static og:type and twitter:card so dynamic ones take effect cleanly
  output = output.replace(/<meta\s+property="og:type"\s+content=".*?"\s*\/?>/i, '');
  output = output.replace(/<meta\s+name="twitter:card"\s+content=".*?"\s*\/?>/i, '');

  // Build full social card tags
  const ogImage = meta.image || '/Logo_OleVeci.png';
  const videoMetaTags = meta.video
    ? `
    <meta property="og:video" content="${escapeHtml(meta.video)}" />
    <meta property="og:video:secure_url" content="${escapeHtml(meta.video)}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="1200" />
    <meta property="og:video:height" content="630" />
    <meta name="twitter:player:stream" content="${escapeHtml(meta.video)}" />
    <meta name="twitter:player:stream:content_type" content="video/mp4" />
  `
    : '';

  const socialTags = `
    <!-- Dynamic Social Share & WhatsApp OpenGraph Card -->
    <meta property="og:site_name" content="OleVeci" />
    <meta property="og:locale" content="es_CO" />
    <meta property="og:type" content="${escapeHtml(meta.type || (meta.video ? 'video.other' : 'website'))}" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:type" content="${ogImage.endsWith('.png') ? 'image/png' : 'image/jpeg'}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(meta.title)}" />
    ${videoMetaTags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  `;

  output = output.replace('</head>', `${socialTags}\n  </head>`);
  return output;
}

// Claves de Wompi Colombia (configurables vía variables de entorno o valores de prueba/sandbox autorizados)
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || 'pub_test_JAtNkfPRS3E9HnQrw6DNbKQoEhPLDOCb';
const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY || 'prv_test_pceMdDuhgzbGb1mMTM5DQjn8owHDqk2D';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || 'test_integrity_BVNqrZB4SzW85EwjB9nvk4knLesN6KwS';
const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET || 'test_events_YLv4k58YATWgD3jHcTwXPz7tmf42qDcF';

// API Routes FIRST

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'OleVeci Server', timestamp: new Date().toISOString() });
});

// Obtener configuración pública de Wompi
app.get('/api/wompi/config', (_req, res) => {
  res.json({
    publicKey: WOMPI_PUBLIC_KEY,
    currency: 'COP',
  });
});

// Generar firma de integridad SHA256 en el backend para máxima seguridad
app.post('/api/wompi/signature', (req, res) => {
  try {
    const { reference, amountInCents, currency = 'COP', expirationTime } = req.body;

    if (!reference || amountInCents === undefined) {
      return res.status(400).json({ error: 'Parámetros reference y amountInCents requeridos' });
    }

    // Fórmula Wompi: SHA256(reference + amountInCents + currency + [expirationTime] + integritySecret)
    const rawString = `${reference}${amountInCents}${currency}${expirationTime || ''}${WOMPI_INTEGRITY_SECRET}`;
    const signature = crypto.createHash('sha256').update(rawString).digest('hex');

    return res.json({
      signature,
      reference,
      amountInCents,
      currency,
      publicKey: WOMPI_PUBLIC_KEY,
    });
  } catch (error) {
    console.error('Error calculando firma Wompi:', error);
    return res.status(500).json({ error: 'Error al generar firma de integridad' });
  }
});

// Consultar estado de una transacción directamente en Wompi API
app.get('/api/wompi/transaction/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isSandbox = WOMPI_PUBLIC_KEY.startsWith('pub_test_') || WOMPI_PRIVATE_KEY.startsWith('prv_test_');
    const wompiBaseUrl = isSandbox ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1';

    const response = await fetch(`${wompiBaseUrl}/transactions/${id}`, {
      headers: {
        Authorization: `Bearer ${WOMPI_PRIVATE_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('Error consultando transacción Wompi:', error);
    return res.status(500).json({ error: 'Error al consultar Wompi' });
  }
});

// Webhook para eventos de Wompi (transacciones aprobadas/rechazadas)
app.post('/api/wompi/webhook', (req, res) => {
  try {
    const event = req.body;
    const checksumHeader = req.headers['x-event-checksum'] as string;

    // Validación opcional de firma del evento
    if (checksumHeader && event?.data?.transaction && event?.signature?.properties) {
      const properties: string[] = event.signature.properties;
      let concatenated = '';

      for (const prop of properties) {
        const parts = prop.split('.');
        let val: any = event.data;
        for (const p of parts) {
          val = val?.[p];
        }
        concatenated += val !== undefined ? String(val) : '';
      }

      concatenated += String(event.timestamp);
      concatenated += WOMPI_EVENTS_SECRET;

      const calculatedChecksum = crypto.createHash('sha256').update(concatenated).digest('hex');
      if (calculatedChecksum !== checksumHeader) {
        console.warn('Wompi Webhook: Checksum mismatch');
        return res.status(401).json({ error: 'Firma de webhook inválida' });
      }
    }

    console.log('Wompi Webhook recibido:', event?.event, event?.data?.transaction?.id, event?.data?.transaction?.status);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error procesando webhook de Wompi:', error);
    return res.status(500).json({ error: 'Error al procesar webhook' });
  }
});

// Endpoint para sincronizar publicaciones y comercios en memoria para que WhatsApp las previsualice
app.post('/api/posts/sync', (req, res) => {
  try {
    const { posts, businesses, post, business } = req.body;
    let postsChanged = false;
    let businessesChanged = false;

    if (post?.id) {
      postStore.set(post.id, post);
      postsChanged = true;
    }
    if (business?.id) {
      businessStore.set(business.id, business);
      businessesChanged = true;
    }
    if (Array.isArray(posts)) {
      posts.forEach((p: Post) => {
        if (p?.id) {
          const existing = postStore.get(p.id);
          if (
            !existing ||
            existing.title !== p.title ||
            existing.description !== p.description ||
            existing.promotionalPrice !== p.promotionalPrice ||
            existing.originalPrice !== p.originalPrice ||
            existing.imageUrl !== p.imageUrl
          ) {
            postStore.set(p.id, p);
            postsChanged = true;
          }
        }
      });
    }
    if (Array.isArray(businesses)) {
      businesses.forEach((b: Business) => {
        if (b?.id) {
          const existing = businessStore.get(b.id);
          if (
            !existing ||
            existing.name !== b.name ||
            existing.description !== b.description ||
            existing.address !== b.address ||
            existing.rating !== b.rating ||
            existing.logo !== b.logo
          ) {
            businessStore.set(b.id, b);
            businessesChanged = true;
          }
        }
      });
    }
    if (postsChanged) savePostsToDisk();
    if (businessesChanged) saveBusinessesToDisk();
    return res.json({ ok: true, totalPosts: postStore.size, totalBusinesses: businessStore.size });
  } catch (error) {
    return res.status(500).json({ error: 'Sync failed' });
  }
});

// Endpoint para consultar todas las publicaciones
app.get('/api/posts', (_req, res) => {
  return res.json(Array.from(postStore.values()));
});

// Endpoint para consultar todos los comercios
app.get('/api/businesses', (_req, res) => {
  return res.json(Array.from(businessStore.values()));
});

// Endpoint para consultar todos los itinerarios / planes
app.get('/api/plans', (_req, res) => {
  return res.json(Array.from(planStore.values()));
});

// Endpoint para consultar un itinerario específico
app.get('/api/plans/:id', (req, res) => {
  const rawId = req.params.id;
  const cleanId = rawId.startsWith('itinerary_') ? rawId.replace('itinerary_', '') : rawId;
  const plan = planStore.get(cleanId) || planStore.get(rawId) || READY_PLANS_SEED.find((p) => p.id === cleanId || p.id === rawId);
  if (!plan) return res.status(404).json({ error: 'Itinerario no encontrado' });
  return res.json(plan);
});

// Endpoint para guardar o sincronizar un itinerario personalizado
app.post('/api/plans', (req, res) => {
  try {
    const plan = req.body as SimulatedReadyPlan;
    if (!plan || !plan.id) {
      return res.status(400).json({ error: 'Datos de itinerario incompletos' });
    }
    planStore.set(plan.id, plan);
    savePlansToDisk();
    return res.json({ ok: true, plan });
  } catch (error) {
    console.error('Error guardando itinerario:', error);
    return res.status(500).json({ error: 'Error guardando itinerario' });
  }
});

// ==============================================================================
// Oli - Asistente Inteligente y de Voz Oficial de OleVeci
// ==============================================================================
app.post('/api/oli/plan', async (req, res) => {
  try {
    const {
      userPrompt,
      currentCity = 'Cajicá',
      userBudget = 100000,
      previousPlan = null,
      messageHistory = [],
      apiKey,
    } = req.body;

    if (!userPrompt || typeof userPrompt !== 'string') {
      return res.status(400).json({ error: 'El parámetro userPrompt es requerido' });
    }

    const posts = Array.from(postStore.values());
    const businesses = Array.from(businessStore.values());

    const plan = await generateOliPlan({
      userPrompt,
      currentCity,
      userBudget: typeof userBudget === 'number' ? userBudget : parseInt(userBudget, 10) || 100000,
      previousPlan,
      messageHistory,
      catalogPosts: posts,
      catalogBusinesses: businesses,
      apiKey: apiKey || process.env.GEMINI_API_KEY,
    });

    return res.json(plan);
  } catch (error) {
    console.error('Error generando plan con Oli:', error);
    return res.status(500).json({ error: 'Error procesando solicitud con Oli' });
  }
});

app.get('/api/oli/config', (_req, res) => {
  return res.json({
    hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
  });
});

app.post('/api/oli/set-key', (req, res) => {
  try {
    const { apiKey } = req.body;
    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
      process.env.GEMINI_API_KEY = apiKey.trim();
      return res.json({ success: true, hasApiKey: true });
    }
    return res.status(400).json({ error: 'Clave API inválida' });
  } catch (error) {
    return res.status(500).json({ error: 'Error configurando clave API' });
  }
});

// ==============================================================================
// WhatsApp Bot Integration - Meta Cloud API Webhook & Live Simulator
// ==============================================================================

// Verification endpoint for Meta Webhook setup
app.get(['/api/whatsapp/webhook', '/webhook/whatsapp'], (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'oleveci_token_2026';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verificado con éxito por Meta');
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Forbidden: Token de verificación incorrecto');
});

// Incoming message listener from Meta WhatsApp Cloud API
app.post(['/api/whatsapp/webhook', '/webhook/whatsapp'], async (req, res) => {
  try {
    // Acknowledge receipt to Meta immediately within 3s
    res.status(200).send('EVENT_RECEIVED');

    const posts = Array.from(postStore.values());
    const businesses = Array.from(businessStore.values());
    await processIncomingWhatsAppWebhook(req.body, posts, businesses);
  } catch (err) {
    console.error('[WhatsApp Webhook Error]:', err);
  }
});

// WhatsApp Bot Simulator (allows testing from web UI without Meta account)
app.post('/api/whatsapp/simulate', async (req, res) => {
  try {
    const { userPrompt, phoneNumber = '573001234567' } = req.body;
    if (!userPrompt || typeof userPrompt !== 'string') {
      return res.status(400).json({ error: 'El parámetro userPrompt es requerido' });
    }

    const posts = Array.from(postStore.values());
    const businesses = Array.from(businessStore.values());

    const mockPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: phoneNumber,
                    type: 'text',
                    text: { body: userPrompt.trim() },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = await processIncomingWhatsAppWebhook(mockPayload, posts, businesses);
    return res.json(result);
  } catch (err: any) {
    console.error('Error en simulador de WhatsApp:', err);
    return res.status(500).json({ error: err?.message || 'Error simulando mensaje' });
  }
});

// Get WhatsApp Bot Configuration & Status
app.get('/api/whatsapp/config', (_req, res) => {
  const hasToken = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_TOKEN.trim().length > 0);
  const hasPhoneId = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_PHONE_NUMBER_ID.trim().length > 0);
  const botNumber = process.env.WHATSAPP_BOT_NUMBER || '573245168762';
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'oleveci_token_2026';

  return res.json({
    isConfigured: hasToken && hasPhoneId,
    hasToken,
    hasPhoneId,
    botNumber,
    verifyToken,
    webhookUrl: `${_req.protocol}://${_req.get('host')}/api/whatsapp/webhook`,
  });
});

// Save WhatsApp Bot Configuration
app.post('/api/whatsapp/config', (req, res) => {
  try {
    const { token, phoneNumberId, botNumber, verifyToken } = req.body;

    if (token) process.env.WHATSAPP_TOKEN = token.trim();
    if (phoneNumberId) process.env.WHATSAPP_PHONE_NUMBER_ID = phoneNumberId.trim();
    if (botNumber) process.env.WHATSAPP_BOT_NUMBER = botNumber.trim();
    if (verifyToken) process.env.WHATSAPP_VERIFY_TOKEN = verifyToken.trim();

    return res.json({
      success: true,
      isConfigured: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error guardando configuración' });
  }
});

// WhatsApp Web (Baileys) Linking endpoints
app.get('/api/whatsapp/baileys/status', (_req, res) => {
  return res.json(getBaileysState());
});

app.post('/api/whatsapp/baileys/connect', async (_req, res) => {
  const result = await connectBaileys();
  return res.json(result);
});

app.post('/api/whatsapp/baileys/disconnect', async (_req, res) => {
  const result = await disconnectBaileys();
  return res.json(result);
});

app.post('/api/oli/tts', async (req, res) => {
  try {
    const { spokenText } = req.body;
    if (!spokenText || typeof spokenText !== 'string') {
      return res.status(400).json({ error: 'El parámetro spokenText es requerido' });
    }

    const audioBuffer = await generateOliSpeechAudio(spokenText);
    if (!audioBuffer) {
      return res.json({ fallback: true, spokenText });
    }

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', audioBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(audioBuffer);
  } catch (error) {
    console.error('Error generando voz de Oli:', error);
    return res.status(500).json({ error: 'Error generando voz' });
  }
});

// Servir archivos estáticos de videos con redirección preventiva para enlaces legados .webm
app.get('/videos/bienvenida_oleveci.webm', (_req, res) => {
  res.redirect(302, '/videos/bienvenida_oleveci.mp4');
});
app.use('/videos', express.static(path.join(process.cwd(), 'public', 'videos')));

// Endpoint para consultar datos de un anuncio específico
app.get('/api/posts/:id', (req, res) => {
  const post = postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post no encontrado' });
  return res.json(post);
});

// Endpoint para servir la imagen exacta del anuncio para WhatsApp y Open Graph (1200x630, historia 9:16 o feed 4:5)
app.get(['/api/og/card/:id.png', '/api/og/card/:id.jpg', '/api/og/card/:id'], async (req, res) => {
  try {
    const rawId = req.params.id || '';
    const postId = rawId.replace(/\.(png|jpg|jpeg)$/i, '');
    const post = postStore.get(postId);
    if (!post) {
      const defaultLogo = path.join(process.cwd(), 'public', 'Logo_OleVeci.png');
      if (fs.existsSync(defaultLogo)) {
        res.setHeader('Content-Type', 'image/png');
        return res.sendFile(defaultLogo);
      }
      return res.status(404).send('Post no encontrado');
    }
    const business = businessStore.get(post.businessId);
    const format = req.query.format === 'story' ? 'story' : req.query.format === 'feed' ? 'feed' : 'card';
    const cardBuffer = await renderPostCardImage(post, business, format);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', cardBuffer.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
    return res.status(200).send(cardBuffer);
  } catch (error) {
    console.error('Error generando tarjeta de anuncio:', error);
    const rawId = req.params.id || '';
    const postId = rawId.replace(/\.(png|jpg|jpeg)$/i, '');
    const fallbackPost = postStore.get(postId);
    if (fallbackPost?.imageUrl && fallbackPost.imageUrl.startsWith('http')) {
      return res.redirect(302, fallbackPost.imageUrl);
    }
    return res.status(500).send('Error generando imagen de tarjeta');
  }
});

// Endpoint dedicado para descargar o compartir la historia vertical 9:16 (1080x1920) para WhatsApp Status, Instagram Stories y TikTok
app.get(['/api/og/story/:id.png', '/api/og/story/:id.jpg', '/api/og/story/:id'], async (req, res) => {
  try {
    const rawId = req.params.id || '';
    const postId = rawId.replace(/\.(png|jpg|jpeg)$/i, '');
    const post = postStore.get(postId);
    if (!post) {
      return res.status(404).send('Post no encontrado');
    }
    const business = businessStore.get(post.businessId);
    const cardBuffer = await renderPostCardImage(post, business, 'story');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', cardBuffer.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
    return res.status(200).send(cardBuffer);
  } catch (error) {
    console.error('Error generando historia de anuncio:', error);
    return res.status(500).send('Error generando imagen de historia');
  }
});

// Endpoint dedicado para descargar o compartir la publicación vertical 4:5 (1080x1350) para muro de Facebook y feed de Instagram
app.get(['/api/og/feed/:id.png', '/api/og/feed/:id.jpg', '/api/og/feed/:id'], async (req, res) => {
  try {
    const rawId = req.params.id || '';
    const postId = rawId.replace(/\.(png|jpg|jpeg)$/i, '');
    const post = postStore.get(postId);
    if (!post) {
      return res.status(404).send('Post no encontrado');
    }
    const business = businessStore.get(post.businessId);
    const cardBuffer = await renderPostCardImage(post, business, 'feed');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', cardBuffer.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
    return res.status(200).send(cardBuffer);
  } catch (error) {
    console.error('Error generando publicación para muro:', error);
    return res.status(500).send('Error generando imagen de publicación');
  }
});

// En-memory cache for resolved Instagram video streams
const igVideoCache = new Map<string, { mp4Url: string; expiresAt: number }>();
const tiktokVideoCache = new Map<string, { mp4Url: string; posterUrl?: string; expiresAt: number }>();

async function resolveInstagramVideoUrl(reelId: string): Promise<string | null> {
  const cached = igVideoCache.get(reelId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.mp4Url;
  }

  try {
    const res = await fetch(`https://www.instagram.com/reel/${reelId}/embed/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'es,es-ES;q=0.9,en;q=0.8',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Microsoft Edge";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!res.ok) return null;
    const text = await res.text();
    let mp4Url: string | null = null;

    // Pattern 1: Escaped quotes inside ServerJS payload (e.g. video_url\": \"https:\\\/\\\/...
    const idx = text.indexOf('video_url');
    if (idx !== -1) {
      const chunk = text.slice(idx, idx + 2500);
      const httpIdx = chunk.indexOf('https:');
      if (httpIdx !== -1) {
        let end = httpIdx;
        while (end < chunk.length && chunk[end] !== '"' && chunk[end] !== "'") {
          end++;
        }
        const raw = chunk.slice(httpIdx, end);
        mp4Url = raw.replace(/\\+\//g, '/').replace(/\\u0026/g, '&').replace(/\\/g, '');
      }
    }

    // Pattern 2: Standard JSON
    if (!mp4Url) {
      const jsonMatch = text.match(/"video_url":\s*"([^"]+)"/);
      if (jsonMatch) {
        mp4Url = jsonMatch[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
      }
    }

    if (mp4Url && mp4Url.startsWith('https://')) {
      igVideoCache.set(reelId, {
        mp4Url,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
      });
      return mp4Url;
    }
  } catch (err) {
    console.error('Error resolving Instagram reel video:', err);
  }
  return null;
}

async function resolveTikTokVideoUrl(rawUrl: string): Promise<string | null> {
  const info = await resolveTikTokVideoInfo(rawUrl);
  return info.mp4Url;
}

async function resolveTikTokVideoInfo(rawUrl: string): Promise<{ mp4Url: string | null; posterUrl?: string | null }> {
  const cached = tiktokVideoCache.get(rawUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return { mp4Url: cached.mp4Url, posterUrl: cached.posterUrl };
  }

  let videoId: string | null = null;
  const tiktokIdMatch =
    rawUrl.match(/tiktok\.com\/(?:@[\w.-]+\/video|v|embed|embed\/v2)\/(\d+)/i) ||
    rawUrl.match(/tiktok\.com\/.*?(\d{15,22})/i);

  if (tiktokIdMatch && tiktokIdMatch[1]) {
    videoId = tiktokIdMatch[1];
  } else {
    // Expand short mobile links if needed (vt.tiktok.com, vm.tiktok.com, /t/)
    try {
      const resp = await fetch(rawUrl, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
        },
      });
      const finalUrl = resp.url;
      const m = finalUrl.match(/tiktok\.com\/(?:@[\w.-]+\/video|v|embed|embed\/v2)\/(\d+)/i) ||
                finalUrl.match(/tiktok\.com\/.*?(\d{15,22})/i);
      if (m && m[1]) videoId = m[1];
    } catch (e: any) {
      console.warn('Could not expand TikTok short URL:', e.message);
    }
  }

  let mp4Url: string | null = null;
  let posterUrl: string | null = null;

  // Strategy 1: Fetch TikTok embed v2 page directly
  if (videoId) {
    try {
      const embedRes = await fetch(`https://www.tiktok.com/embed/v2/${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es,en;q=0.9',
        },
      });
      if (embedRes.ok) {
        const html = await embedRes.text();
        const videoMatch = html.match(/<video[^>]*src="([^"]+)"/i);
        const posterMatch = html.match(/<video[^>]*poster="([^"]+)"/i) || html.match(/"originCover":"([^"]+)"/i);
        if (videoMatch && videoMatch[1]) {
          mp4Url = videoMatch[1].replace(/&amp;/g, '&');
        } else {
          const playMatch = html.match(/"playAddr":"([^"]+)"/);
          if (playMatch && playMatch[1]) {
            mp4Url = playMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
          }
        }
        if (posterMatch && posterMatch[1]) {
          posterUrl = posterMatch[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\/g, '');
        }
      }
    } catch (e: any) {
      console.warn('TikTok Strategy 1 failed:', e.message);
    }
  }

  // Strategy 2: TikWM API fallback
  if (!mp4Url) {
    try {
      const apiRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(rawUrl)}`);
      if (apiRes.ok) {
        const data: any = await apiRes.json();
        if (data.code === 0 && data.data) {
          mp4Url = data.data.play || data.data.wmplay || null;
          if (data.data.cover) {
            posterUrl = data.data.cover;
          }
        }
      }
    } catch (e: any) {
      console.warn('TikTok Strategy 2 failed:', e.message);
    }
  }

  if (mp4Url && mp4Url.startsWith('http')) {
    const entry = {
      mp4Url,
      posterUrl: posterUrl || undefined,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours cache
    };
    tiktokVideoCache.set(rawUrl, entry);
    if (videoId) {
      tiktokVideoCache.set(videoId, entry);
    }
    return { mp4Url, posterUrl };
  }

  return { mp4Url: null, posterUrl: null };
}

// -------------------------------------------------------------
// YouTube Shorts & Facebook Reels High-Speed Native Stream Resolvers
// -------------------------------------------------------------
const isWin = process.platform === 'win32';
const YTDLP_BIN_NAME = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const YTDLP_BIN_DIR = path.join(process.cwd(), 'server', 'bin');
const YTDLP_PATH = path.join(YTDLP_BIN_DIR, YTDLP_BIN_NAME);

async function ensureYtDlpBinary(): Promise<string | null> {
  try {
    // 1. Try global yt-dlp if installed in system PATH
    try {
      const hasGlobal = await new Promise<boolean>((resolve) => {
        execFile('yt-dlp', ['--version'], (err, stdout) => {
          if (!err && stdout && stdout.trim().length > 0) resolve(true);
          else resolve(false);
        });
      });
      if (hasGlobal) {
        return 'yt-dlp';
      }
    } catch {}

    // 2. Check local binary in server/bin/
    if (fs.existsSync(YTDLP_PATH) && fs.statSync(YTDLP_PATH).size > 1000000) {
      if (!isWin) {
        try { fs.chmodSync(YTDLP_PATH, 0o755); } catch {}
      }
      return YTDLP_PATH;
    }

    const fallbackPath = path.join(process.cwd(), 'scratch', 'bin', YTDLP_BIN_NAME);
    if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).size > 1000000) {
      if (!fs.existsSync(YTDLP_BIN_DIR)) fs.mkdirSync(YTDLP_BIN_DIR, { recursive: true });
      fs.copyFileSync(fallbackPath, YTDLP_PATH);
      if (!isWin) {
        try { fs.chmodSync(YTDLP_PATH, 0o755); } catch {}
      }
      return YTDLP_PATH;
    }

    // 3. Download official release binary for the current OS (Linux or Windows)
    if (!fs.existsSync(YTDLP_BIN_DIR)) fs.mkdirSync(YTDLP_BIN_DIR, { recursive: true });
    const downloadUrl = isWin
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

    console.log(`[OleVeci Video] Downloading ${YTDLP_BIN_NAME} for ${process.platform}...`);
    const res = await fetch(downloadUrl);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(YTDLP_PATH, buf);
      if (!isWin) {
        try { fs.chmodSync(YTDLP_PATH, 0o755); } catch {}
      }
      console.log(`[OleVeci Video] ${YTDLP_BIN_NAME} downloaded successfully, size:`, buf.length);
      return YTDLP_PATH;
    }
  } catch (err: any) {
    console.warn('[OleVeci Video] Failed to ensure yt-dlp binary:', err.message);
  }
  return fs.existsSync(YTDLP_PATH) ? YTDLP_PATH : null;
}

function runYtDlp(args: string[]): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const bin = await ensureYtDlpBinary();
    if (!bin) return reject(new Error('yt-dlp binary not available'));
    execFile(bin, args, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

const VIDEO_CACHE_FILE = path.join(process.cwd(), 'server', 'db_video_cache.json');

interface CachedVideoEntry {
  mp4Url: string;
  posterUrl?: string;
  platform: string;
  updatedAt: number;
  expiresAt: number;
}

const persistentVideoCache = new Map<string, CachedVideoEntry>();

function loadVideoCacheFromDisk(): void {
  try {
    if (fs.existsSync(VIDEO_CACHE_FILE)) {
      const raw = fs.readFileSync(VIDEO_CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const now = Date.now();
      let loaded = 0;
      for (const [key, val] of Object.entries(data)) {
        const entry = val as CachedVideoEntry;
        if (entry && entry.mp4Url && entry.expiresAt > now) {
          persistentVideoCache.set(key, entry);
          loaded++;
        }
      }
      console.log(`[OleVeci Video] Loaded ${loaded} cached videos from disk.`);
    }
  } catch (err: any) {
    console.warn('[OleVeci Video] Error loading video cache from disk:', err?.message);
  }
}

let saveCacheTimeout: NodeJS.Timeout | null = null;
function saveVideoCacheToDisk(): void {
  if (saveCacheTimeout) clearTimeout(saveCacheTimeout);
  saveCacheTimeout = setTimeout(() => {
    try {
      const obj: Record<string, CachedVideoEntry> = {};
      const now = Date.now();
      for (const [key, val] of persistentVideoCache.entries()) {
        if (val.expiresAt > now) {
          obj[key] = val;
        }
      }
      const dir = path.dirname(VIDEO_CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(VIDEO_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[OleVeci Video] Error saving video cache to disk:', err?.message);
    }
  }, 1000);
}

function getCachedVideo(key: string): CachedVideoEntry | null {
  const entry = persistentVideoCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry;
  }
  return null;
}

function setCachedVideo(key: string, data: { mp4Url: string; posterUrl?: string; platform: string }, ttlMs = 24 * 60 * 60 * 1000): void {
  const entry: CachedVideoEntry = {
    mp4Url: data.mp4Url,
    posterUrl: data.posterUrl,
    platform: data.platform,
    updatedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  persistentVideoCache.set(key, entry);
  saveVideoCacheToDisk();
}

function invalidateVideoCache(key: string): void {
  persistentVideoCache.delete(key);
  saveVideoCacheToDisk();
}

// Load cache immediately
loadVideoCacheFromDisk();

async function resolveFacebookReelVideoInfo(rawUrl: string, forceFresh = false): Promise<{ mp4Url: string | null; posterUrl?: string | null }> {
  if (!forceFresh) {
    const cached = getCachedVideo(rawUrl);
    if (cached) {
      return { mp4Url: cached.mp4Url, posterUrl: cached.posterUrl };
    }
  }

  let mp4Url: string | null = null;
  let posterUrl: string | null = null;

  // Strategy 1: Fast direct stream URL extraction (-g)
  try {
    const directUrlOut = await runYtDlp(['-g', '--no-playlist', '--no-warnings', '--no-check-certificates', rawUrl]);
    const firstLine = directUrlOut.split('\n')[0].trim();
    if (firstLine.startsWith('http')) {
      mp4Url = firstLine;
    }
  } catch (e: any) {
    console.warn('[OleVeci Video] Facebook yt-dlp -g strategy failed, trying -j:', e.message);
  }

  // Strategy 2: yt-dlp metadata extraction (-j)
  if (!mp4Url) {
    try {
      const jsonStr = await runYtDlp(['-j', '--no-warnings', '--no-playlist', rawUrl]);
      const data = JSON.parse(jsonStr);
      if (data.url && data.url.startsWith('http')) {
        mp4Url = data.url;
      } else if (data.formats && Array.isArray(data.formats)) {
        const best = data.formats
          .filter((f: any) => f.url && (f.ext === 'mp4' || f.vcodec !== 'none'))
          .sort((a: any, b: any) => (b.height || 0) - (a.height || 0))[0];
        if (best?.url) mp4Url = best.url;
      }
      if (data.thumbnail) {
        posterUrl = data.thumbnail;
      }
    } catch (err: any) {
      console.warn('[OleVeci Video] Facebook yt-dlp -j strategy failed:', err.message);
    }
  }

  // Strategy 3: HTML scraping fallback
  if (!mp4Url) {
    try {
      const res = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      if (res.ok) {
        const text = await res.text();
        const hd = text.match(/"browser_native_hd_url":"([^"]+)"/) || text.match(/"playable_url_quality_hd":"([^"]+)"/);
        const sd = text.match(/"browser_native_sd_url":"([^"]+)"/) || text.match(/"playable_url":"([^"]+)"/);
        const match = hd || sd;
        if (match && match[1]) {
          const raw = match[1].replace(/\\u0025/g, '%').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
          mp4Url = decodeURIComponent(raw);
        }
        const thumbMatch = text.match(/"preferred_thumbnail":{"image":{"uri":"([^"]+)"/);
        if (thumbMatch && thumbMatch[1]) {
          posterUrl = thumbMatch[1].replace(/\\\//g, '/');
        }
      }
    } catch (e: any) {
      console.warn('[OleVeci Video] Facebook HTML scraping strategy failed:', e.message);
    }
  }

  if (mp4Url && mp4Url.startsWith('http')) {
    // Facebook CDN links generally expire in 24-72 hours. Cache for 24 hours.
    setCachedVideo(rawUrl, { mp4Url, posterUrl: posterUrl || undefined, platform: 'facebook' }, 24 * 60 * 60 * 1000);
    return { mp4Url, posterUrl };
  }

  return { mp4Url: null, posterUrl: null };
}

const VIDEO_MEDIA_CACHE_DIR = path.join(process.cwd(), 'server', 'cache', 'videos');
if (!fs.existsSync(VIDEO_MEDIA_CACHE_DIR)) {
  try { fs.mkdirSync(VIDEO_MEDIA_CACHE_DIR, { recursive: true }); } catch {}
}
const isDownloadingVideoMap = new Set<string>();

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return m ? m[1] : null;
}

async function resolveYouTubeShortsVideoInfo(rawUrl: string, _forceFresh = false): Promise<{ mp4Url: string | null; posterUrl?: string | null }> {
  const videoId = extractYouTubeId(rawUrl);

  // Check if locally merged MP4 already exists on disk
  if (videoId) {
    const localMp4 = path.join(VIDEO_MEDIA_CACHE_DIR, `${videoId}.mp4`);
    if (fs.existsSync(localMp4) && fs.statSync(localMp4).size > 50000) {
      return { mp4Url: `LOCAL_FILE:${localMp4}`, posterUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
    }
  }

  // YouTube strictly blocks direct stream scraping from cloud datacenter IPs ("Sign in to confirm you're not a bot").
  // YouTube videos are cleanly rendered using responsive iframe embeds (https://www.youtube-nocookie.com/embed/{id}).
  return {
    mp4Url: null,
    posterUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
  };
}

// Endpoint para obtener o redirigir a la miniatura/poster oficial del video
app.get('/api/video/poster', async (req, res) => {
  try {
    const rawUrl = (req.query.url as string) || '';
    if (!rawUrl) return res.status(400).send('Missing url parameter');

    const isTikTok = Boolean(rawUrl.match(/(?:tiktok\.com|(?:vt|vm)\.tiktok\.com)/i));
    const isFacebook = Boolean(rawUrl.match(/(?:facebook\.com\/(?:share\/r\/|reel\/|reels\/|watch\/?\?v=|.*?\/videos\/)|fb\.watch\/)/i));
    const ytId = extractYouTubeId(rawUrl);

    if (ytId) {
      const thumbUrl = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      try {
        const upstream = await fetch(thumbUrl, { signal: AbortSignal.timeout(3000) });
        if (upstream.ok && upstream.body) {
          res.status(200);
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const reader = upstream.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          return res.end();
        }
      } catch {}
      return res.redirect(302, thumbUrl);
    } else if (isTikTok) {
      const info = await resolveTikTokVideoInfo(rawUrl);
      if (info?.posterUrl) {
        try {
          const upstream = await fetch(info.posterUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.tiktok.com/',
            },
          });
          if (upstream.ok && upstream.body) {
            res.status(200);
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            const reader = upstream.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            return res.end();
          }
        } catch (streamErr) {
          console.warn('Failed to stream tiktok poster:', streamErr);
        }
        return res.redirect(info.posterUrl);
      }
    } else if (isFacebook) {
      const info = await resolveFacebookReelVideoInfo(rawUrl);
      if (info?.posterUrl) {
        try {
          const upstream = await fetch(info.posterUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Referer': 'https://www.facebook.com/',
            },
          });
          if (upstream.ok && upstream.body) {
            res.status(200);
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            const reader = upstream.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            return res.end();
          }
        } catch (streamErr) {
          console.warn('Failed to stream facebook poster:', streamErr);
        }
        return res.redirect(info.posterUrl);
      }
    }
    return res.status(404).send('Poster not found');
  } catch (err: any) {
    return res.status(500).send('Poster error');
  }
});

// Endpoint para streaming de video directo sin marcas ni elementos de Instagram / TikTok / Facebook / YouTube
app.all('/api/video/stream', async (req, res) => {
  try {
    const rawUrl = (req.query.url as string) || '';
    if (!rawUrl) {
      return res.status(400).send('Missing url parameter');
    }

    let mp4Url: string | null = null;
    let referer = 'https://www.instagram.com/';

    const isInstagram = Boolean(rawUrl.match(/instagram\.com\/(?:share\/)?(?:reel|reels|p|tv|r)\/([a-zA-Z0-9_-]+)/i));
    const isTikTok = Boolean(rawUrl.match(/(?:tiktok\.com|(?:vt|vm)\.tiktok\.com)/i));
    const isFacebook = Boolean(rawUrl.match(/(?:facebook\.com\/(?:share\/r\/|reel\/|reels\/|watch\/?\?v=|.*?\/videos\/)|fb\.watch\/)/i));
    const isYouTube = Boolean(rawUrl.match(/(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i));

    if (isInstagram) {
      const match = rawUrl.match(/instagram\.com\/(?:share\/)?(?:reel|reels|p|tv|r)\/([a-zA-Z0-9_-]+)/i);
      if (!match) return res.status(400).send('Invalid Instagram URL');
      const reelId = match[1];
      mp4Url = await resolveInstagramVideoUrl(reelId);
      referer = 'https://www.instagram.com/';
    } else if (isTikTok) {
      mp4Url = await resolveTikTokVideoUrl(rawUrl);
      referer = 'https://www.tiktok.com/';
    } else if (isFacebook) {
      const info = await resolveFacebookReelVideoInfo(rawUrl);
      mp4Url = info.mp4Url;
      referer = 'https://www.facebook.com/';
    } else if (isYouTube) {
      const ytId = extractYouTubeId(rawUrl);
      const localMp4 = ytId ? path.join(VIDEO_MEDIA_CACHE_DIR, `${ytId}.mp4`) : null;
      if (localMp4 && fs.existsSync(localMp4) && fs.statSync(localMp4).size > 50000) {
        return res.sendFile(localMp4);
      }
      return res.status(400).json({
        error: 'YouTube requires official embedded player',
        platform: 'youtube',
        videoId: ytId,
        embedUrl: ytId ? `https://www.youtube-nocookie.com/embed/${ytId}` : null,
      });
    } else {
      return res.status(400).send('Unsupported video platform');
    }

    if (!mp4Url) {
      return res.status(404).send('Could not extract direct video');
    }

    if (mp4Url.startsWith('LOCAL_FILE:')) {
      const localFilePath = mp4Url.replace('LOCAL_FILE:', '');
      if (fs.existsSync(localFilePath)) {
        return res.sendFile(localFilePath);
      }
    }

    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
      'Referer': referer,
    };

    if (req.headers.range) {
      upstreamHeaders['Range'] = req.headers.range as string;
    }

    let upstream = await fetch(mp4Url, { headers: upstreamHeaders });

    // Auto-recovery if expired CDN token (403 or 410)
    if (upstream.status === 403 || upstream.status === 410) {
      console.warn(`[OleVeci Video] Upstream returned ${upstream.status}, invalidating cache and re-resolving:`, rawUrl);
      invalidateVideoCache(rawUrl);
      if (isFacebook) {
        const fresh = await resolveFacebookReelVideoInfo(rawUrl, true);
        if (fresh.mp4Url) {
          mp4Url = fresh.mp4Url;
          upstream = await fetch(mp4Url, { headers: upstreamHeaders });
        }
      } else if (isYouTube) {
        const fresh = await resolveYouTubeShortsVideoInfo(rawUrl, true);
        if (fresh.mp4Url) {
          mp4Url = fresh.mp4Url;
          upstream = await fetch(mp4Url, { headers: upstreamHeaders });
        }
      }
    }

    res.status(upstream.status);
    upstream.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (['content-type', 'content-length', 'content-range', 'accept-ranges'].includes(lower)) {
        res.setHeader(key, val);
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Handle HEAD requests immediately without transferring body
    if (req.method === 'HEAD' || !upstream.body) {
      return res.end();
    }

    const reader = upstream.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (streamErr) {
        // Stream aborted by client (e.g. video scrubbed or closed) - safe to ignore
      } finally {
        res.end();
      }
    };

    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

    await pump();
  } catch (err: any) {
    if (err.name !== 'AbortError' && !res.headersSent) {
      console.error('Error streaming video:', err);
      res.status(500).send('Video stream error');
    }
  }
});


// Vite middleware & Dynamic Open Graph Static Serving
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  let vite: any = null;

  app.use(express.static(path.join(process.cwd(), 'public'), {
    maxAge: isDev ? 0 : '7d',
    etag: true,
  }));

  if (isDev) {
    vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/server/**',
            '**/server/db_*.json',
            '**/server/db_posts.json',
            '**/server/db_businesses.json',
            '**/dist/**',
            '**/.git/**',
          ],
        },
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false,
    }));
  }

  // Interceptor para servir HTML con Open Graph enriquecido para WhatsApp y redes
  app.get('*', async (req, res, next) => {
    try {
      const urlPath = req.path;
      const forwardedProto = req.headers['x-forwarded-proto'];
      const proto = (typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : '') ||
        (req.secure ? 'https' : req.protocol) || 'https';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'oleveci.com';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      const effectiveProto = isLocalhost ? proto : 'https';
      const origin = `${effectiveProto}://${host}`;
      let ogMeta: { title: string; description: string; image?: string; video?: string; url: string; type?: string } | null = null;

      // 0. Detectar si es un itinerario / plan (/plan/:id, /itinerario/:id, ?plan=:id, ?itinerario=:id)
      let planId = '';
      if (urlPath.startsWith('/plan/')) {
        planId = urlPath.replace('/plan/', '').split('/')[0];
      } else if (urlPath.startsWith('/itinerario/')) {
        planId = urlPath.replace('/itinerario/', '').split('/')[0];
      } else if (req.query.plan) {
        planId = String(req.query.plan);
      } else if (req.query.itinerario) {
        planId = String(req.query.itinerario);
      }

      if (planId) {
        const cleanPlanId = planId.startsWith('itinerary_') ? planId.replace('itinerary_', '') : planId;
        const matchedPlan =
          planStore.get(cleanPlanId) ||
          planStore.get(planId) ||
          READY_PLANS_SEED.find((p) => p.id === cleanPlanId || p.id === planId);

        if (matchedPlan) {
          ogMeta = {
            title: `🗺️ ${matchedPlan.planTitle} · OleVeci`,
            description: `${matchedPlan.personalNote || 'Ruta e itinerario armado en OleVeci'}. ${matchedPlan.scheduledTime ? `Cuándo: ${matchedPlan.scheduledTime}. ` : ''}${matchedPlan.estimatedBudget ? `Presupuesto estimado: ${formatPrice(matchedPlan.estimatedBudget)} COP. ` : ''}¡Abre la invitación interactiva y ruta en OleVeci!`,
            image: matchedPlan.coverImage || `${origin}/Logo_OleVeci.png`,
            url: `${origin}/plan/${matchedPlan.id}`,
            type: 'article',
          };
        }
      }

      // 1. Detectar si es un reel (/reel/:id o ?reel=:id) o un anuncio (/anuncio/:id o ?post=:id)
      let postId = '';
      let isReel = false;
      if (urlPath.startsWith('/reel/')) {
        postId = urlPath.replace('/reel/', '').split('/')[0];
        isReel = true;
      } else if (req.query.reel) {
        postId = String(req.query.reel);
        isReel = true;
      } else if (urlPath.startsWith('/anuncio/')) {
        postId = urlPath.replace('/anuncio/', '').split('/')[0];
      } else if (urlPath.startsWith('/p/')) {
        postId = urlPath.replace('/p/', '').split('/')[0];
      } else if (req.query.post) {
        postId = String(req.query.post);
      }

      // 1a. Si es un itinerario compartido como reel (ej: itinerary_plan_romantico_fogata)
      if (!ogMeta && postId) {
        const cleanPlanId = postId.startsWith('itinerary_') ? postId.replace('itinerary_', '') : postId;
        const matchedPlan =
          planStore.get(cleanPlanId) ||
          planStore.get(postId) ||
          READY_PLANS_SEED.find((p) => p.id === cleanPlanId || p.id === postId);

        if (matchedPlan) {
          ogMeta = {
            title: `🎬 Itinerario: ${matchedPlan.planTitle} · OleVeci`,
            description: `${matchedPlan.personalNote || 'Ruta e itinerario recomendado'}. Presupuesto estimado: ${formatPrice(matchedPlan.estimatedBudget)} COP. ¡Descubre este plan en OleVeci!`,
            image: matchedPlan.coverImage || `${origin}/Logo_OleVeci.png`,
            url: isReel ? `${origin}/reel/${postId}` : `${origin}/plan/${matchedPlan.id}`,
            type: isReel ? 'video.other' : 'article',
          };
        } else if (postStore.has(postId)) {
          const post = postStore.get(postId)!;
          const priceStr = post.promotionalPrice
            ? `${formatPrice(post.promotionalPrice)} COP`
            : post.originalPrice
            ? `${formatPrice(post.originalPrice)} COP`
            : '';
          const discountStr =
            post.originalPrice && post.promotionalPrice && post.originalPrice > post.promotionalPrice
              ? ` (${Math.round(((post.originalPrice - post.promotionalPrice) / post.originalPrice) * 100)}% OFF)`
              : '';

          const cacheBuster = post.createdAt ? new Date(post.createdAt).getTime() : Date.now();
          let videoStreamUrl: string | undefined = undefined;
          if (post.videoUrl) {
            if (post.videoUrl.startsWith('http')) {
              videoStreamUrl = post.videoUrl;
            } else if (post.videoUrl.startsWith('/')) {
              videoStreamUrl = `${origin}${post.videoUrl}`;
            } else {
              videoStreamUrl = `${origin}/api/video/stream?url=${encodeURIComponent(post.videoUrl)}`;
            }
          }

          const cleanDesc = post.description ? post.description.trim() : '';
          const metaDesc = cleanDesc
            ? `${cleanDesc}${priceStr ? ` · 💰 ${priceStr}${discountStr}` : ''} — ${post.businessName} (${post.businessCity || 'Sabana Centro'})`
            : `${post.businessName} (${post.businessCity || 'Sabana Centro'})${priceStr ? ` · 💰 ${priceStr}${discountStr}` : ''}. ¡Ver oferta en OleVeci!`;

          if (isReel || post.videoUrl) {
            ogMeta = {
              title: `🎬 ${post.title} · ${post.businessName} | OleVeci`,
              description: metaDesc,
              image: `${origin}/api/og/card/${post.id}.jpg`,
              video: videoStreamUrl,
              url: `${origin}/reel/${post.id}`,
              type: 'video.other',
            };
          } else {
            ogMeta = {
              title: `${post.title} · ${post.businessName} | OleVeci`,
              description: metaDesc,
              image: `${origin}/api/og/card/${post.id}.jpg`,
              video: videoStreamUrl,
              url: `${origin}/anuncio/${post.id}`,
              type: 'article',
            };
          }
        }
      }

      // 2. Detectar si es un comercio (/comercio/:id o ?biz=:id)
      let bizId = '';
      if (urlPath.startsWith('/comercio/')) {
        bizId = urlPath.replace('/comercio/', '').split('/')[0];
      } else if (req.query.biz) {
        bizId = String(req.query.biz);
      }

      if (!ogMeta && bizId && businessStore.has(bizId)) {
        const biz = businessStore.get(bizId)!;
        ogMeta = {
          title: `${biz.name} · Negocio Local en ${biz.city}`,
          description: `${biz.subCategory || 'Comercio verificado'} — ${biz.description || biz.name}. ${biz.address}, ${biz.city}.`,
          image: biz.coverImage || biz.logo || `${origin}/Logo_OleVeci.png`,
          url: `${origin}/comercio/${biz.id}`,
          type: 'profile',
        };
      }

      // Leer index.html base
      let html = '';
      if (isDev) {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        html = fs.readFileSync(indexPath, 'utf-8');
      } else {
        const distIndexPath = path.resolve(process.cwd(), 'dist', 'index.html');
        html = fs.readFileSync(distIndexPath, 'utf-8');
      }

      // Asignar metadatos por defecto para rutas como /explorer, / y demás
      if (!ogMeta) {
        ogMeta = {
          title: 'OleVeci - Negocios locales, más cerca de ti',
          description: 'Descubre qué hay hoy cerca de ti en OleVeci: promociones, planes, eventos, productos y servicios de comercios locales en tu municipio.',
          image: `${origin}/Logo_OleVeci.png`,
          url: `${origin}${urlPath}`,
          type: 'website',
        };
      }

      html = injectOgMeta(html, ogMeta);

      if (isDev && vite) {
        html = await vite.transformIndexHtml(req.originalUrl, html);
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch (error) {
      console.error('Error procesando OpenGraph HTML:', error);
      next(error);
    }
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`OleVeci Server running on http://0.0.0.0:${PORT}`);
    // Initialize WhatsApp Web (Baileys) Bot Service
    initBaileysService(
      () => Array.from(businessStore.values()),
      () => Array.from(postStore.values())
    );
    // Pre-warm database video posts in background after server is up
    setTimeout(warmUpDatabaseVideos, 1500);
  });

  // Bind to port 80 as well if explicitly enabled (e.g. Docker container in root)
  if (PORT !== 80 && process.env.ENABLE_PORT_80 === 'true') {
    try {
      const altServer = app.listen(80, '0.0.0.0', () => {
        console.log('OleVeci Server also listening on http://0.0.0.0:80');
      });
      altServer.on('error', () => {
        // Port 80 unavailable or restricted in development - safely ignore
      });
    } catch {
      // Ignored
    }
  }
}

async function warmUpDatabaseVideos(): Promise<void> {
  try {
    const postsPath = path.join(process.cwd(), 'server', 'db_posts.json');
    if (!fs.existsSync(postsPath)) return;
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
    const videoPosts = posts.filter((p: any) => p.videoUrl && typeof p.videoUrl === 'string' && p.videoUrl.startsWith('http'));
    console.log(`[OleVeci Video] Background pre-warming ${videoPosts.length} post videos...`);
    for (const post of videoPosts) {
      const url = post.videoUrl.trim();
      const cached = getCachedVideo(url);
      if (cached) continue;

      const isFb = Boolean(url.match(/(?:facebook\.com\/(?:share\/r\/|reel\/|reels\/|watch\/?\?v=|.*?\/videos\/)|fb\.watch\/)/i));
      const isYt = Boolean(url.match(/(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i));
      const isTt = Boolean(url.match(/(?:tiktok\.com|(?:vt|vm)\.tiktok\.com)/i));
      const isIg = Boolean(url.match(/instagram\.com\/(?:share\/)?(?:reel|reels|p|tv|r)\/([a-zA-Z0-9_-]+)/i));

      try {
        if (isFb) {
          console.log(`[OleVeci Video] Pre-resolving Facebook video for post ${post.id}`);
          await resolveFacebookReelVideoInfo(url);
        } else if (isYt) {
          console.log(`[OleVeci Video] Pre-resolving YouTube video for post ${post.id}`);
          await resolveYouTubeShortsVideoInfo(url);
        } else if (isTt) {
          console.log(`[OleVeci Video] Pre-resolving TikTok video for post ${post.id}`);
          await resolveTikTokVideoUrl(url);
        } else if (isIg) {
          const match = url.match(/instagram\.com\/(?:share\/)?(?:reel|reels|p|tv|r)\/([a-zA-Z0-9_-]+)/i);
          if (match) {
            console.log(`[OleVeci Video] Pre-resolving Instagram video for post ${post.id}`);
            await resolveInstagramVideoUrl(match[1]);
          }
        }
      } catch (err: any) {
        console.warn(`[OleVeci Video] Pre-warming failed for ${post.id}:`, err?.message);
      }
    }
    console.log('[OleVeci Video] Video pre-warming completed.');
  } catch (err: any) {
    console.warn('[OleVeci Video] Video pre-warming failed:', err?.message);
  }
}

startServer();
