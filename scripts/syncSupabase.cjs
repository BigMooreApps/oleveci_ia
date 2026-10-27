const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gpdqjihnnjetoxxfsfxh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZzcuTOB4mcU1ZMC0lFiMEw_vpCm-ZuX';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/oleveci-media/posts/`;

async function main() {
  console.log('=== INICIANDO SINCRONIZACIÓN Y AUDITORÍA INTEGRAL DE SUPABASE ===\n');

  // 1. CARGAR DATOS LOCALES
  const dbPosts = JSON.parse(fs.readFileSync('server/db_posts.json', 'utf8'));
  const dbBiz = JSON.parse(fs.readFileSync('server/db_businesses.json', 'utf8'));
  const dbPlans = JSON.parse(fs.readFileSync('server/db_plans.json', 'utf8'));

  console.log(`Leídos localmente: ${dbBiz.length} comercios, ${dbPosts.length} publicaciones, ${dbPlans.length} itinerarios.`);

  // 2. SUBIR PORTADAS DE REELS A SUPABASE STORAGE
  console.log('\n--- 1. Subiendo portadas de anuncios con video a Supabase Storage ---');

  if (fs.existsSync('public/uploads/cover_volley.jpg')) {
    const buf = fs.readFileSync('public/uploads/cover_volley.jpg');
    const { error } = await sb.storage.from('oleveci-media').upload('posts/cover_volley.jpg', buf, {
      contentType: 'image/jpeg',
      upsert: true
    });
    console.log('✓ cover_volley.jpg:', error ? error.message : 'OK');
  }

  const brockePost = dbPosts.find(p => p.id === 'post_1791227041739_g4srz');
  if (brockePost && brockePost.imageUrl.startsWith('data:image/')) {
    const base64Data = brockePost.imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const buf = Buffer.from(base64Data, 'base64');
    const { error } = await sb.storage.from('oleveci-media').upload('posts/cover_brocke_microfono.png', buf, {
      contentType: 'image/png',
      upsert: true
    });
    console.log('✓ cover_brocke_microfono.png:', error ? error.message : 'OK');
  }

  if (fs.existsSync('public/uploads/cover_nuevo_servicio.jpg')) {
    const buf = fs.readFileSync('public/uploads/cover_nuevo_servicio.jpg');
    const { error } = await sb.storage.from('oleveci-media').upload('posts/cover_nuevo_servicio.jpg', buf, {
      contentType: 'image/jpeg',
      upsert: true
    });
    console.log('✓ cover_nuevo_servicio.jpg:', error ? error.message : 'OK');
  }

  if (fs.existsSync('public/uploads/cover_cafe_sello_rojo.jpg')) {
    const buf = fs.readFileSync('public/uploads/cover_cafe_sello_rojo.jpg');
    const { error } = await sb.storage.from('oleveci-media').upload('posts/cover_cafe_sello_rojo.jpg', buf, {
      contentType: 'image/jpeg',
      upsert: true
    });
    console.log('✓ cover_cafe_sello_rojo.jpg:', error ? error.message : 'OK');
  }

  // 3. NORMALIZAR URLs DE IMÁGENES EN LAS PUBLICACIONES
  dbPosts.forEach(p => {
    if (p.id === 'post_1791221143310_zvu6i') {
      p.imageUrl = `${STORAGE_PREFIX}cover_volley.jpg`;
    } else if (p.id === 'post_1791227041739_g4srz') {
      p.imageUrl = `${STORAGE_PREFIX}cover_brocke_microfono.png`;
    } else if (p.id === 'post_1791231179361_xngwj') {
      p.imageUrl = `${STORAGE_PREFIX}cover_nuevo_servicio.jpg`;
    } else if (p.id === 'post_1791236006956_ih5xg') {
      p.imageUrl = `${STORAGE_PREFIX}cover_cafe_sello_rojo.jpg`;
    } else if (p.id === 'post_oleveci_bienvenida') {
      p.videoUrl = `${STORAGE_PREFIX}bienvenida_oleveci.mp4`;
      p.imageUrl = `${STORAGE_PREFIX}poster_bienvenida_oli.jpg`;
    }
  });

  fs.writeFileSync('server/db_posts.json', JSON.stringify(dbPosts, null, 2), 'utf8');

  // Actualizar también en seedData.ts las URLs de cover_volley, cover_brocke, cover_nuevo_servicio, cover_cafe_sello_rojo
  let seedContent = fs.readFileSync('src/data/seedData.ts', 'utf8');
  seedContent = seedContent.replace(/\/uploads\/cover_volley\.jpg/g, `${STORAGE_PREFIX}cover_volley.jpg`);
  seedContent = seedContent.replace(/\/uploads\/cover_nuevo_servicio\.jpg/g, `${STORAGE_PREFIX}cover_nuevo_servicio.jpg`);
  seedContent = seedContent.replace(/\/uploads\/cover_cafe_sello_rojo\.jpg/g, `${STORAGE_PREFIX}cover_cafe_sello_rojo.jpg`);
  // Reemplazar base64 de Brocke con la URL de Supabase
  seedContent = seedContent.replace(/"imageUrl":\s*"data:image\/png;base64,[^"]+"/g, `"imageUrl": "${STORAGE_PREFIX}cover_brocke_microfono.png"`);
  fs.writeFileSync('src/data/seedData.ts', seedContent, 'utf8');
  console.log('✓ seedData.ts y db_posts.json actualizados con URLs limpias de Supabase Storage.');

  // 4. MAPEO DE CATEGORÍAS VÁLIDAS EN SUPABASE
  const VALID_CATEGORIES = new Set([
    'cat_gastronomia', 'cat_cafes_panaderias', 'cat_bares_vida_nocturna',
    'cat_servicios', 'cat_belleza_estetica', 'cat_salud_bienestar',
    'cat_turismo_hospedaje', 'cat_mascotas', 'cat_automotriz',
    'cat_mercado_compras', 'cat_deportes_fitness', 'cat_planes_eventos',
    'cat_profesionales', 'cat_hogar_construccion', 'cat_educacion_cultura',
    'cat_moda_accesorios', 'cat_tecnologia', 'cat_otros'
  ]);

  function mapCategory(cat) {
    if (!cat) return 'cat_servicios';
    if (VALID_CATEGORIES.has(cat)) return cat;
    const lower = cat.toLowerCase();
    if (lower.includes('gastro') || lower.includes('comida') || lower.includes('restaurante')) return 'cat_gastronomia';
    if (lower.includes('cafe') || lower.includes('panad')) return 'cat_cafes_panaderias';
    if (lower.includes('bar') || lower.includes('licor') || lower.includes('coctel')) return 'cat_bares_vida_nocturna';
    if (lower.includes('hotel') || lower.includes('glamping') || lower.includes('turismo')) return 'cat_turismo_hospedaje';
    if (lower.includes('pet') || lower.includes('veterin') || lower.includes('mascota')) return 'cat_mascotas';
    if (lower.includes('auto') || lower.includes('car') || lower.includes('taller') || lower.includes('mecanic')) return 'cat_automotriz';
    if (lower.includes('fit') || lower.includes('gym') || lower.includes('deport')) return 'cat_deportes_fitness';
    if (lower.includes('barber') || lower.includes('estetic') || lower.includes('belleza')) return 'cat_belleza_estetica';
    if (lower.includes('mercado') || lower.includes('fruta') || lower.includes('carne')) return 'cat_mercado_compras';
    if (lower.includes('plan') || lower.includes('evento')) return 'cat_planes_eventos';
    return 'cat_servicios';
  }

  // 5. SINCRONIZAR COMERCIOS (Payload exacto a las columnas de Supabase)
  console.log('\n--- 2. Sincronizando Comercios en Supabase ---');
  const bizPayload = dbBiz.map(b => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    logo: b.logo,
    cover_image: b.coverImage || null,
    description: b.description || '',
    category_id: mapCategory(b.categoryId),
    sub_category: b.subCategory || '',
    address: b.address || '',
    city: b.city || 'Cajicá',
    sector: b.sector || 'Centro',
    lat: b.coordinates?.lat || 4.9192,
    lng: b.coordinates?.lng || -74.0265,
    hours: b.hours || 'Lunes a Domingo 8:00 AM - 8:00 PM',
    whatsapp: b.whatsapp || '',
    phone: b.phone || '',
    email: b.email || null,
    social_links: b.socialLinks || {},
    rating: b.rating || 4.8,
    verified: Boolean(b.verified),
    featured: Boolean(b.featured),
    status: b.status || 'active',
    suspension_reason: b.suspensionReason || null,
    suspended_at: b.suspendedAt || null,
    review_status: b.reviewStatus || 'none',
    subscription: b.subscription || { plan: 'free', status: 'active', autoRenew: true },
    billing_info: b.billingInfo || null,
    payment_history: b.paymentHistory || [],
    username: b.username || null,
    password: b.password || 'Veci2026',
    owner_name: b.ownerName || null,
    owner_phone: b.ownerPhone || null,
    access_email: b.accessEmail || null,
    access_pin: b.accessPin || null,
    metrics: b.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 }
  }));

  const { error: bizErr } = await sb.from('businesses').upsert(bizPayload, { onConflict: 'id' });
  if (bizErr) {
    console.error('Error sincronizando comercios:', bizErr.message);
  } else {
    console.log(`✓ ${bizPayload.length} comercios sincronizados con éxito.`);
  }

  // 6. SINCRONIZAR PUBLICACIONES (Payload exacto a las columnas de Supabase)
  console.log('\n--- 3. Sincronizando Publicaciones en Supabase ---');
  const postPayload = dbPosts.map(p => ({
    id: p.id,
    business_id: p.businessId,
    business_name: p.businessName,
    business_logo: p.businessLogo,
    business_city: p.businessCity,
    business_sector: p.businessSector,
    business_whatsapp: p.businessWhatsapp,
    business_phone: p.businessPhone,
    business_address: p.businessAddress,
    lat: p.coordinates?.lat || 4.9192,
    lng: p.coordinates?.lng || -74.0265,
    type: p.type || 'promotion',
    title: p.title,
    description: p.description || '',
    image_url: p.imageUrl,
    video_url: p.videoUrl || null,
    media_type: p.mediaType || (p.videoUrl ? 'video' : 'image'),
    aspect_ratio: p.aspectRatio || '9:16',
    image_fit: p.imageFit || 'cover',
    original_price: p.originalPrice || null,
    promotional_price: p.promotionalPrice || null,
    starts_at: p.startsAt || new Date().toISOString(),
    expires_at: p.expiresAt || null,
    expiry_label: p.expiryLabel || null,
    validity_schedule: p.validitySchedule || null,
    category_id: mapCategory(p.categoryId),
    plan_category_id: p.planCategoryId || null,
    plan_category_name: p.planCategoryName || null,
    featured: Boolean(p.featured),
    tags: p.tags || [],
    status: p.status || 'active',
    suspension_reason: p.suspensionReason || null,
    metrics: p.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 }
  }));

  for (let i = 0; i < postPayload.length; i += 25) {
    const batch = postPayload.slice(i, i + 25);
    const { error: postErr } = await sb.from('posts').upsert(batch, { onConflict: 'id' });
    if (postErr) {
      console.error(`Error sincronizando lote ${i}-${i + batch.length}:`, postErr.message);
    } else {
      console.log(`✓ Lote ${i + 1} a ${i + batch.length} de ${postPayload.length} publicaciones sincronizado.`);
    }
  }

  // 7. SINCRONIZAR ITINERARIOS (Payload exacto a las columnas de Supabase)
  console.log('\n--- 4. Sincronizando Itinerarios en Supabase ---');
  const planPayload = dbPlans.map(pl => ({
    id: pl.id,
    title: pl.planTitle || pl.title || 'Itinerario Sabana',
    slug: pl.id,
    category_id: pl.category || 'plan_comer_algo',
    city: pl.municipality || pl.city || 'Cajicá',
    budget: pl.estimatedBudget ? `$${pl.estimatedBudget.toLocaleString('es-CO')} COP` : '$50.000 COP',
    budget_num: pl.estimatedBudget || 50000,
    duration: pl.scheduledTime || '2 a 3 horas',
    highlight: pl.personalNote || pl.description || '',
    cover_image: pl.coverImage || '',
    stops: pl.postIds || pl.stops || [],
    is_active: true,
    plan_data: pl
  }));

  const { error: planErr } = await sb.from('ready_plans').upsert(planPayload, { onConflict: 'id' });
  if (planErr) {
    console.error('Error sincronizando itinerarios:', planErr.message);
  } else {
    console.log(`✓ ${planPayload.length} itinerarios sincronizados.`);
  }

  // 8. AUDITORÍA FINAL DIRECTA SOBRE SUPABASE
  console.log('\n=== REPORTE DE AUDITORÍA FINAL DE SUPABASE ===');
  const { data: finalPosts } = await sb.from('posts').select('id, title, video_url, image_url, media_type, status, business_name, city:business_city');
  const { data: finalBiz } = await sb.from('businesses').select('id, name, username, city');
  const { data: finalPlans } = await sb.from('ready_plans').select('id, title, city');

  console.log(`Total Publicaciones en Supabase: ${finalPosts.length} / 45`);
  console.log(`Total Comercios en Supabase: ${finalBiz.length} / 17`);
  console.log(`Total Itinerarios en Supabase: ${finalPlans.length} / 14`);

  console.log('\n--- Resumen de Publicaciones con Video en Supabase ---');
  finalPosts.filter(p => p.video_url).forEach(p => {
    console.log(`• [${p.id}] "${p.title}" (${p.business_name} - ${p.city})`);
    console.log(`    Video:   ${p.video_url}`);
    console.log(`    Portada: ${p.image_url}`);
  });
}

main().catch(console.error);
