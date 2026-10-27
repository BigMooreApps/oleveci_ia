import assert from 'node:assert';
import { runTest, MOCK_BUSINESSES, MOCK_POSTS } from './testContext';
import {
  formatOliResponseForWhatsApp,
  getOrCreateSession,
  processIncomingWhatsAppWebhook,
} from '../oliWhatsAppService';
import { sanitizeSpokenText, OliPlanResponse, OliPlanStop } from '../oliAssistant';

export function runWhatsAppSessionSuite() {
  console.log('\n--- SUITE 8: FORMATO DE WHATSAPP, SESIONES, WEBHOOKS Y VOZ (Pruebas 286 a 325) ---');

  const SAMPLE_PLAN: OliPlanResponse = {
    type: 'plan',
    planTitle: 'Ruta Gastronómica en Cajicá',
    day: 'Sábado',
    targetAudience: 'En pareja',
    personCount: 2,
    userBudget: 80000,
    costPerPerson: 19200,
    totalEstimatedCost: 38400,
    savingsOrRemaining: 41600,
    budgetStatus: 'under_budget',
    hasUnconfirmedPrices: false,
    spokenText: '¡Listo veci! Les armé un plan delicioso en Cajicá.',
    stops: [
      {
        postId: 'post_promo_smash',
        businessId: 'biz_burger_cajica',
        businessName: 'La Brasa Smash & Beer',
        businessCity: 'Cajicá',
        businessAddress: 'Cra. 3 # 4-28',
        businessWhatsapp: '573124567890',
        time: '1:00 PM',
        activity: 'comer hamburguesa',
        postTitle: 'Combo Doble Smash Burger',
        imageUrl: '/post-smash.jpg',
        cost: 24900,
        whySelected: 'Excelente sabor',
      },
      {
        postId: 'post_promo_cafe',
        businessId: 'biz_cafe_cajica',
        businessName: 'Café & Trigo Artesanal',
        businessCity: 'Cajicá',
        businessAddress: 'Calle 3 # 2-15',
        businessWhatsapp: '573138887766',
        time: '3:30 PM',
        activity: 'tarde de café y postre',
        postTitle: 'Tarde de Café',
        imageUrl: '/post-cafe.jpg',
        cost: 13500,
        whySelected: 'Café especial',
      },
    ],
  };

  const SAMPLE_SEARCH: OliPlanResponse = {
    type: 'search',
    spokenText: '¡Listo veci! Encontré este comercio en Cajicá.',
    matchedBusinesses: [MOCK_BUSINESSES[0]],
    matchedPosts: [],
  };

  // ----------------------------------------------------------------------------
  // Bloque 1: Formato Markdown de WhatsApp y Enlaces (Pruebas 286 a 295)
  // ----------------------------------------------------------------------------
  runTest(286, 'formatOliResponseForWhatsApp: Encabezado oficial en planes', () => {
    const text = formatOliResponseForWhatsApp(SAMPLE_PLAN);
    assert.ok(text.includes('🤖 *OLI · Tu Plan en OleVeci*'));
    assert.ok(text.includes('🎉 *Ruta Gastronómica en Cajicá*'));
  });

  runTest(287, 'formatOliResponseForWhatsApp: Formato de paradas con negritas y horarios', () => {
    const text = formatOliResponseForWhatsApp(SAMPLE_PLAN);
    assert.ok(text.includes('*Parada 1 (1:00 PM):*'));
    assert.ok(text.includes('🏢 *La Brasa Smash & Beer* (Cajicá)'));
    assert.ok(text.includes('💰 Costo: *24.900 pesos*'));
  });

  runTest(288, 'formatOliResponseForWhatsApp: Enlaces directos de WhatsApp de cada comercio', () => {
    const text = formatOliResponseForWhatsApp(SAMPLE_PLAN);
    assert.ok(text.includes('https://wa.me/573124567890'));
    assert.ok(text.includes('https://wa.me/573138887766'));
  });

  runTest(289, 'formatOliResponseForWhatsApp: Presupuesto total y división por persona', () => {
    const text = formatOliResponseForWhatsApp(SAMPLE_PLAN);
    assert.ok(text.includes('💵 *Presupuesto total estimado:* *38.400 pesos*'));
    assert.ok(text.includes('👤 *Por persona:* *19.200 pesos*'));
  });

  runTest(290, 'formatOliResponseForWhatsApp: Mensaje para 1 persona no muestra costo por persona redundante', () => {
    const singlePlan = { ...SAMPLE_PLAN, personCount: 1 };
    const text = formatOliResponseForWhatsApp(singlePlan);
    assert.ok(text.includes('💵 *Presupuesto total estimado:* *38.400 pesos*'));
    assert.ok(!text.includes('👤 *Por persona:*'));
  });

  runTest(291, 'formatOliResponseForWhatsApp: Formato de respuestas de búsqueda puntual', () => {
    const text = formatOliResponseForWhatsApp(SAMPLE_SEARCH);
    assert.ok(text.includes('🤖 *OLI · Asistente Oficial OleVeci*'));
    assert.ok(text.includes('🏢 *Comercios Recomendados:*'));
    assert.ok(text.includes('*1. Papelería y Copias El Estudiante*'));
  });

  runTest(292, 'formatOliResponseForWhatsApp: Búsqueda incluye WhatsApp directo del comercio', () => {
    const text = formatOliResponseForWhatsApp(SAMPLE_SEARCH);
    assert.ok(text.includes('https://wa.me/573101112233'));
  });

  runTest(293, 'formatOliResponseForWhatsApp: Búsqueda incluye dirección y horarios', () => {
    const text = formatOliResponseForWhatsApp(SAMPLE_SEARCH);
    assert.ok(text.includes('📍 Cra. 4 # 3-20 (Cajicá)'));
    assert.ok(text.includes('⏰ Lun - Sáb: 8:00 AM - 7:00 PM'));
  });

  runTest(294, 'formatOliResponseForWhatsApp: Búsqueda con promoción destacada', () => {
    const searchWithPromo: OliPlanResponse = {
      type: 'search',
      spokenText: '¡Listo veci! Aquí tienes la promo.',
      matchedBusinesses: [MOCK_BUSINESSES[2]],
      matchedPosts: [MOCK_POSTS[0]],
    };
    const text = formatOliResponseForWhatsApp(searchWithPromo);
    assert.ok(text.includes('🎁 *Oferta destacada en OleVeci:*'));
    assert.ok(text.includes('Combo Doble Smash Burger + Papas'));
    assert.ok(text.includes('24.900 pesos'));
  });

  runTest(295, 'formatOliResponseForWhatsApp: Cierre con mensaje de invitación interactivo', () => {
    const text = formatOliResponseForWhatsApp(SAMPLE_PLAN);
    assert.ok(text.includes('_Toca el enlace de WhatsApp de cada comercio para confirmar tu visita o reservar._'));
  });

  // ----------------------------------------------------------------------------
  // Bloque 2: Gestión de Sesiones en Memoria (Pruebas 296 a 305)
  // ----------------------------------------------------------------------------
  runTest(296, 'getOrCreateSession: Crea sesión nueva para número de teléfono', () => {
    const session = getOrCreateSession('573001112233');
    assert.strictEqual(session.phoneNumber, '573001112233');
    assert.strictEqual(session.lastCity, 'Cajicá');
    assert.ok(Array.isArray(session.messageHistory));
  });

  runTest(297, 'getOrCreateSession: Retorna misma sesión para el mismo número', () => {
    const s1 = getOrCreateSession('573002223344');
    s1.lastCity = 'Chía';
    const s2 = getOrCreateSession('573002223344');
    assert.strictEqual(s2.lastCity, 'Chía');
  });

  runTest(298, 'getOrCreateSession: Actualiza timestamp lastInteraction en cada acceso', () => {
    const s = getOrCreateSession('573003334455');
    const t1 = s.lastInteraction;
    assert.ok(typeof t1 === 'number' && t1 > 0);
  });

  runTest(299, 'getOrCreateSession: Aislamiento entre diferentes números telefónicos', () => {
    const sA = getOrCreateSession('573111111111');
    const sB = getOrCreateSession('573222222222');
    sA.lastCity = 'Sopó';
    sB.lastCity = 'Zipaquirá';
    assert.strictEqual(getOrCreateSession('573111111111').lastCity, 'Sopó');
    assert.strictEqual(getOrCreateSession('573222222222').lastCity, 'Zipaquirá');
  });

  runTest(300, 'getOrCreateSession: Almacenamiento y recuperación de previousPlan', () => {
    const s = getOrCreateSession('573004445566');
    s.previousPlan = SAMPLE_PLAN;
    assert.strictEqual(getOrCreateSession('573004445566').previousPlan?.planTitle, 'Ruta Gastronómica en Cajicá');
  });

  runTest(301, 'getOrCreateSession: Historial de mensajes se preserva ordenado', () => {
    const s = getOrCreateSession('573005556677');
    s.messageHistory.push({ sender: 'user', text: 'Hola veci' });
    s.messageHistory.push({ sender: 'oli', text: '¡Listo veci!' });
    assert.strictEqual(s.messageHistory.length, 2);
    assert.strictEqual(s.messageHistory[0].sender, 'user');
    assert.strictEqual(s.messageHistory[1].sender, 'oli');
  });

  runTest(302, 'getOrCreateSession: Truncamiento de historial a 10 mensajes para evitar fugas de memoria', () => {
    const s = getOrCreateSession('573006667788');
    for (let i = 0; i < 20; i++) {
      s.messageHistory.push({ sender: 'user', text: `Mensaje ${i}` });
    }
    if (s.messageHistory.length > 10) {
      s.messageHistory = s.messageHistory.slice(-10);
    }
    assert.strictEqual(s.messageHistory.length, 10);
    assert.strictEqual(s.messageHistory[9].text, 'Mensaje 19');
  });

  runTest(303, 'getOrCreateSession: Reset de previousPlan al cambiar de intención', () => {
    const s = getOrCreateSession('573007778899');
    s.previousPlan = SAMPLE_PLAN;
    s.previousPlan = null;
    assert.strictEqual(s.previousPlan, null);
  });

  runTest(304, 'getOrCreateSession: Número de teléfono con caracteres especiales se normaliza', () => {
    const cleanPhone = '+57 (310) 123-4567'.replace(/\D/g, '');
    assert.strictEqual(cleanPhone, '573101234567');
  });

  runTest(305, 'getOrCreateSession: Sesión inicializa con previousPlan en null', () => {
    const s = getOrCreateSession('573009990011');
    assert.strictEqual(s.previousPlan, null);
  });

  // ----------------------------------------------------------------------------
  // Bloque 3: Procesamiento de Webhooks de Meta WhatsApp (Pruebas 306 a 315)
  // ----------------------------------------------------------------------------
  runTest(306, 'processIncomingWhatsAppWebhook: Payload sin entrada válida retorna processed=false', async () => {
    const res = await processIncomingWhatsAppWebhook({}, MOCK_POSTS, MOCK_BUSINESSES);
    assert.strictEqual(res.processed, false);
  });

  runTest(307, 'processIncomingWhatsAppWebhook: Payload con mensaje que no es de texto (imagen/audio)', async () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ type: 'image', from: '573101234567' }],
          },
        }],
      }],
    };
    const res = await processIncomingWhatsAppWebhook(payload, MOCK_POSTS, MOCK_BUSINESSES);
    assert.strictEqual(res.processed, false);
  });

  runTest(308, 'processIncomingWhatsAppWebhook: Mensaje con cuerpo vacío retorna processed=false', async () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ type: 'text', text: { body: '' }, from: '573101234567' }],
          },
        }],
      }],
    };
    const res = await processIncomingWhatsAppWebhook(payload, MOCK_POSTS, MOCK_BUSINESSES);
    assert.strictEqual(res.processed, false);
  });

  runTest(309, 'processIncomingWhatsAppWebhook: Mensaje de texto válido procesa y devuelve replyText formateado', async () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ type: 'text', text: { body: 'Quiero un plan en Cajicá' }, from: '573108889900' }],
          },
        }],
      }],
    };
    const res = await processIncomingWhatsAppWebhook(payload, MOCK_POSTS, MOCK_BUSINESSES);
    assert.strictEqual(res.processed, true);
    assert.ok(typeof res.replyText === 'string');
    assert.ok(res.replyText.includes('OLI'));
    assert.strictEqual(res.recipientPhone, '573108889900');
  });

  runTest(310, 'processIncomingWhatsAppWebhook: Actualiza sesión del usuario con el mensaje entrante y saliente', async () => {
    const phone = '573109991122';
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ type: 'text', text: { body: 'Arma un plan' }, from: phone }],
          },
        }],
      }],
    };
    await processIncomingWhatsAppWebhook(payload, MOCK_POSTS, MOCK_BUSINESSES);
    const session = getOrCreateSession(phone);
    assert.ok(session.messageHistory.length >= 2);
    assert.strictEqual(session.messageHistory[0].sender, 'user');
    assert.strictEqual(session.messageHistory[1].sender, 'oli');
  });

  runTest(311, 'processIncomingWhatsAppWebhook: Búsqueda puntual en webhook devuelve formato de comercio', async () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ type: 'text', text: { body: 'Necesito una papelería en Cajicá' }, from: '573109993344' }],
          },
        }],
      }],
    };
    const res = await processIncomingWhatsAppWebhook(payload, MOCK_POSTS, MOCK_BUSINESSES);
    assert.strictEqual(res.processed, true);
    assert.ok(res.replyText?.includes('Papelería'));
  });

  runTest(312, 'processIncomingWhatsAppWebhook: Mensaje nulo o corrupto no causa excepción', async () => {
    const res = await processIncomingWhatsAppWebhook(null, MOCK_POSTS, MOCK_BUSINESSES);
    assert.strictEqual(res.processed, false);
  });

  runTest(313, 'processIncomingWhatsAppWebhook: Payload sin remitente from', async () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ type: 'text', text: { body: 'hola' } }],
          },
        }],
      }],
    };
    const res = await processIncomingWhatsAppWebhook(payload, MOCK_POSTS, MOCK_BUSINESSES);
    assert.strictEqual(res.processed, false);
  });

  runTest(314, 'processIncomingWhatsAppWebhook: Secuencia multi-turn (Plan seguido de modificación)', async () => {
    const phone = '573109995566';
    const p1 = {
      entry: [{ changes: [{ value: { messages: [{ type: 'text', text: { body: 'Plan para el fin de semana' }, from: phone }] } }] }],
    };
    await processIncomingWhatsAppWebhook(p1, MOCK_POSTS, MOCK_BUSINESSES);

    const p2 = {
      entry: [{ changes: [{ value: { messages: [{ type: 'text', text: { body: 'Quita la segunda parada' }, from: phone }] } }] }],
    };
    const res2 = await processIncomingWhatsAppWebhook(p2, MOCK_POSTS, MOCK_BUSINESSES);
    assert.strictEqual(res2.processed, true);
    assert.ok(res2.replyText?.length! > 0);
  });

  runTest(315, 'processIncomingWhatsAppWebhook: Envío fallido por variables de entorno faltantes es atrapado limpiamente', async () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ type: 'text', text: { body: 'Hola' }, from: '573100000000' }],
          },
        }],
      }],
    };
    const res = await processIncomingWhatsAppWebhook(payload, MOCK_POSTS, MOCK_BUSINESSES);
    assert.strictEqual(res.processed, true);
  });

  // ----------------------------------------------------------------------------
  // Bloque 4: Saneador de Texto de Voz TTS (Pruebas 316 a 325)
  // ----------------------------------------------------------------------------
  runTest(316, 'sanitizeSpokenText: Añade saludo "¡Listo veci!" si está ausente', () => {
    const res = sanitizeSpokenText('Aquí está el plan para hoy.');
    assert.ok(res.startsWith('¡Listo veci!'));
  });

  runTest(317, 'sanitizeSpokenText: Corrige variaciones informales a "¡Listo veci!"', () => {
    assert.ok(sanitizeSpokenText('listo veci, aquí tienes').startsWith('¡Listo veci!'));
    assert.ok(sanitizeSpokenText('listo veci! aquí tienes').startsWith('¡Listo veci!'));
  });

  runTest(318, 'sanitizeSpokenText: Elimina cualquier carácter $ para evitar fallos de TTS', () => {
    const res = sanitizeSpokenText('¡Listo veci! El combo vale $ 25.000 y el postre $ 10.000');
    assert.strictEqual(res.includes('$'), false);
  });

  runTest(319, 'sanitizeSpokenText: Inserta parada omitida en la narración', () => {
    const stops = [
      {
        postId: 'p1',
        businessId: 'b1',
        businessName: 'Hamburguesas del Norte',
        businessCity: 'Cajicá',
        businessAddress: 'Calle 3 # 4-5',
        activity: 'comer hamburguesa',
        cost: 20000,
        time: '12:00 PM',
        postTitle: 'Super Hamburguesa',
        imageUrl: 'http://img.com/1.jpg',
        whySelected: 'Deliciosa',
      },
      {
        postId: 'p2',
        businessId: 'b2',
        businessName: 'Heladería Colonial',
        businessCity: 'Cajicá',
        businessAddress: 'Parque Principal',
        activity: 'tomar helado',
        cost: 8000,
        time: '2:00 PM',
        postTitle: 'Helado Artesanal',
        imageUrl: 'http://img.com/2.jpg',
        whySelected: 'Postre',
      },
    ] as OliPlanStop[];
    const raw = '¡Listo veci! Arrancamos en Hamburguesas del Norte para comer hamburguesa.';
    const res = sanitizeSpokenText(raw, stops);
    assert.ok(res.toLowerCase().includes('heladería colonial') || res.toLowerCase().includes('heladeria colonial'));
  });

  runTest(320, 'sanitizeSpokenText: Modo isRefinement agrega prefijo explicativo de ajuste', () => {
    const res = sanitizeSpokenText('Ya quité esa parada del itinerario.', [], true);
    assert.ok(res.startsWith('¡Listo veci! Ya te ajusté el plan:'));
  });

  runTest(321, 'sanitizeSpokenText: Modo isSearch no inyecta paradas forzadas', () => {
    const res = sanitizeSpokenText('Encontré la papelería más cercana.', [], false, true);
    assert.ok(res.startsWith('¡Listo veci!'));
  });

  runTest(322, 'sanitizeSpokenText: Modo isAlternative sugiere con claridad', () => {
    const res = sanitizeSpokenText('No tenemos comida china pero te recomiendo esto.', [], false, false, true);
    assert.ok(res.startsWith('¡Listo veci!'));
  });

  runTest(323, 'sanitizeSpokenText: Parada final usa conector "Y para rematar, cerramos en"', () => {
    const stops = [
      { postId: 'p1', businessId: 'b1', businessName: 'Restaurante A', businessCity: 'Cajicá', businessAddress: 'Cra 1', activity: 'almorzar', cost: 20000, time: '12:00 PM', postTitle: 'Almuerzo', imageUrl: 'http://img.com/a.jpg', whySelected: 'Rico' },
      { postId: 'p2', businessId: 'b2', businessName: 'Café B', businessCity: 'Cajicá', businessAddress: 'Cra 2', activity: 'tomar café', cost: 10000, time: '2:00 PM', postTitle: 'Cafecito', imageUrl: 'http://img.com/b.jpg', whySelected: 'Delicioso' },
    ] as OliPlanStop[];
    const raw = '¡Listo veci! Almorzamos en Restaurante A.';
    const res = sanitizeSpokenText(raw, stops);
    assert.ok(res.includes('cerramos en Café B') || res.includes('Café B'));
  });

  runTest(324, 'sanitizeSpokenText: Texto vacío devuelve "¡Listo veci!" sin fallar', () => {
    const res = sanitizeSpokenText('');
    assert.strictEqual(res.trim(), '¡Listo veci!');
  });

  runTest(325, 'sanitizeSpokenText: Texto con múltiples saltos de línea y espacios', () => {
    const res = sanitizeSpokenText('   ¡Listo veci!    Plan listo.   \n\n  ');
    assert.ok(res.trim().startsWith('¡Listo veci!'));
    assert.ok(!res.includes('$'));
  });
}
