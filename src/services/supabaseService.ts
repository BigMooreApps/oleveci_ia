import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Post, Business } from '../types';
import { SimulatedReadyPlan } from '../data/readyPlansData';

const VALID_CATEGORY_IDS = new Set([
  'cat_automoviles',
  'cat_belleza',
  'cat_cafes',
  'cat_comida_rapida',
  'cat_fitness',
  'cat_hogar',
  'cat_mascotas',
  'cat_moda',
  'cat_ninos',
  'cat_regalos',
  'cat_planes_eventos',
  'cat_restaurantes',
  'cat_salud',
  'cat_servicios',
  'cat_tecnologia',
  'cat_educacion',
  'cat_ferreteria',
  'cat_otros',
  // Aliases de compatibilidad
  'cat_gastronomia',
  'cat_mercados',
  'cat_artesanias',
  'cat_bienestar',
]);

export function mapCategoryToExisting(id?: string): string {
  if (!id) return 'cat_otros';
  if (VALID_CATEGORY_IDS.has(id)) return id;
  return 'cat_otros';
}

/**
 * Obtener todos los comercios desde Supabase (si está configurado)
 */
export async function getBusinessesFromSupabase(): Promise<Business[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching businesses from Supabase:', error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logo: b.logo,
      coverImage: b.cover_image,
      description: b.description || '',
      categoryId: b.category_id || 'cat_otros',
      subCategory: b.sub_category || '',
      address: b.address,
      city: b.city,
      sector: b.sector,
      coordinates: { lat: Number(b.lat), lng: Number(b.lng) },
      hours: b.hours || '8:00 AM - 8:00 PM',
      whatsapp: b.whatsapp,
      phone: b.phone,
      email: b.email,
      instagram: b.instagram || b.social_links?.instagram,
      facebook: b.facebook || b.social_links?.facebook,
      tiktok: b.tiktok || b.social_links?.tiktok,
      youtube: b.youtube || b.social_links?.youtube,
      website: b.website || b.social_links?.website,
      twitter: b.twitter || b.social_links?.twitter,
      socialLinks: b.social_links || {},
      rating: Number(b.rating || 5.0),
      verified: Boolean(b.verified),
      featured: Boolean(b.featured),
      status: b.status || 'active',
      suspensionReason: b.suspension_reason || undefined,
      suspendedAt: b.suspended_at || undefined,
      reviewStatus: b.review_status || 'none',
      reviewRequestedAt: b.review_requested_at || undefined,
      correctionNote: b.correction_note || undefined,
      suspensionHistory: b.suspension_history || [],
      subscription: b.subscription || {
        status: 'active',
        planName: 'Plan Veci Pro',
        priceCOP: 39000,
        billingCycle: 'monthly',
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        autoRenew: true,
      },
      billingInfo: b.billing_info || undefined,
      paymentHistory: b.payment_history || [],
      accessPin: b.access_pin || undefined,
      accessEmail: b.access_email || b.email,
      accessPassword: b.access_password || b.password || 'Veci2026',
      username: b.username || undefined,
      password: b.password || 'Veci2026',
      ownerName: b.owner_name || undefined,
      ownerPhone: b.owner_phone || undefined,
      metrics: b.metrics || {
        views: 0,
        whatsappClicks: 0,
        mapsClicks: 0,
        calls: 0,
        shares: 0,
        qrRedemptions: 0,
      },
      createdAt: b.created_at,
    }));
  } catch (err) {
    console.error('Supabase fetch exception:', err);
    return null;
  }
}

/**
 * Guardar o actualizar un comercio en Supabase
 */
export async function saveBusinessToSupabase(biz: Business): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const payload = {
      id: biz.id,
      name: biz.name,
      slug: biz.slug,
      logo: biz.logo,
      cover_image: biz.coverImage || null,
      description: biz.description || '',
      category_id: mapCategoryToExisting(biz.categoryId),
      sub_category: biz.subCategory || '',
      address: biz.address || '',
      city: biz.city || 'Cajicá',
      sector: biz.sector || 'Centro',
      lat: biz.coordinates?.lat || 4.9192,
      lng: biz.coordinates?.lng || -74.0265,
      hours: biz.hours || 'Lunes a Domingo 8:00 AM - 8:00 PM',
      whatsapp: biz.whatsapp || '',
      phone: biz.phone || '',
      email: biz.email || null,
      social_links: biz.socialLinks || {
        instagram: biz.instagram,
        facebook: biz.facebook,
        tiktok: biz.tiktok,
        youtube: biz.youtube,
        website: biz.website,
        twitter: biz.twitter,
      },
      rating: biz.rating || 4.8,
      verified: Boolean(biz.verified),
      featured: Boolean(biz.featured),
      status: biz.status || 'active',
      suspension_reason: biz.suspensionReason || null,
      suspended_at: biz.suspendedAt || null,
      review_status: biz.reviewStatus || 'none',
      subscription: biz.subscription || { plan: 'free', status: 'active', autoRenew: true },
      billing_info: biz.billingInfo || null,
      payment_history: biz.paymentHistory || [],
      username: biz.username || null,
      password: biz.password || 'Veci2026',
      owner_name: biz.ownerName || null,
      owner_phone: biz.ownerPhone || null,
      access_email: biz.accessEmail || null,
      access_pin: biz.accessPin || null,
      metrics: biz.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 },
    };

    const { error } = await supabase.from('businesses').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Error saving business to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception saving business to Supabase:', err);
    return false;
  }
}

/**
 * Eliminar un comercio de Supabase
 */
export async function deleteBusinessFromSupabase(businessId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase.from('businesses').delete().eq('id', businessId);
    if (error) {
      console.error('Error deleting business from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting business from Supabase:', err);
    return false;
  }
}

/**
 * Obtener todas las publicaciones desde Supabase (si está configurado)
 */
export async function getPostsFromSupabase(): Promise<Post[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching posts from Supabase:', error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((p) => ({
      id: p.id,
      businessId: p.business_id,
      businessName: p.business_name,
      businessLogo: p.business_logo,
      businessCity: p.business_city,
      businessSector: p.business_sector,
      businessWhatsapp: p.business_whatsapp,
      businessPhone: p.business_phone,
      businessAddress: p.business_address,
      coordinates: { lat: Number(p.lat), lng: Number(p.lng) },
      type: p.type,
      title: p.title,
      description: p.description,
      imageUrl: p.image_url,
      videoUrl: p.video_url || undefined,
      mediaType: p.media_type || 'image',
      imagePosition: p.image_position || { x: 50, y: 50 },
      imageScale: Number(p.image_scale || 1.0),
      imageFit: p.image_fit || 'cover',
      aspectRatio: p.aspect_ratio || '9:16',
      mediaBgFill: p.media_bg_fill || 'blur',
      originalPrice: p.original_price ? Number(p.original_price) : undefined,
      promotionalPrice: p.promotional_price ? Number(p.promotional_price) : undefined,
      priceScope: p.price_scope || undefined,
      priceType: p.price_type || undefined,
      approximatePrice: p.approximate_price ? Number(p.approximate_price) : undefined,
      startsAt: p.starts_at,
      expiresAt: p.expires_at || undefined,
      expiryLabel: p.expiry_label || undefined,
      validitySchedule: p.validity_schedule || undefined,
      categoryId: p.category_id || 'cat_otros',
      planCategoryId: p.plan_category_id || undefined,
      planCategoryIds: p.plan_category_ids || [],
      planCategoryName: p.plan_category_name || undefined,
      planRole: p.plan_role || undefined,
      planRoles: p.plan_roles || [],
      targetAudience: p.target_audience || [],
      isPlan: Boolean(p.is_plan),
      planData: p.plan_data || undefined,
      featured: Boolean(p.featured),
      tags: p.tags || [],
      status: p.status || 'active',
      suspensionReason: p.suspension_reason || undefined,
      suspendedAt: p.suspended_at || undefined,
      suspensionHistory: p.suspension_history || [],
      createdAt: p.created_at,
      metrics: p.metrics || {
        views: 0,
        whatsappClicks: 0,
        mapsClicks: 0,
        calls: 0,
        shares: 0,
        qrRedemptions: 0,
      },
    }));
  } catch (err) {
    console.error('Supabase posts fetch exception:', err);
    return null;
  }
}

/**
 * Guardar una nueva publicación en Supabase
 */
export async function savePostToSupabase(post: Post): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const payload = {
      id: post.id,
      business_id: post.businessId,
      business_name: post.businessName,
      business_logo: post.businessLogo,
      business_city: post.businessCity,
      business_sector: post.businessSector,
      business_whatsapp: post.businessWhatsapp,
      business_phone: post.businessPhone,
      business_address: post.businessAddress,
      lat: post.coordinates?.lat || 4.9192,
      lng: post.coordinates?.lng || -74.0265,
      type: post.type || 'promotion',
      title: post.title,
      description: post.description || '',
      image_url: post.imageUrl,
      video_url: post.videoUrl || null,
      media_type: post.mediaType || (post.videoUrl ? 'video' : 'image'),
      aspect_ratio: post.aspectRatio || '9:16',
      image_fit: post.imageFit || 'cover',
      original_price: post.originalPrice || null,
      promotional_price: post.promotionalPrice || null,
      starts_at: post.startsAt || new Date().toISOString(),
      expires_at: post.expiresAt || null,
      expiry_label: post.expiryLabel || null,
      validity_schedule: post.validitySchedule || null,
      category_id: mapCategoryToExisting(post.categoryId),
      plan_category_id: post.planCategoryId || null,
      plan_category_name: post.planCategoryName || null,
      featured: Boolean(post.featured),
      tags: post.tags || [],
      status: post.status || 'active',
      suspension_reason: post.suspensionReason || null,
      metrics: post.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 },
    };

    const { error } = await supabase.from('posts').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Error saving post to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception saving post to Supabase:', err);
    return false;
  }
}

/**
 * Eliminar una publicación de Supabase
 */
export async function deletePostFromSupabase(postId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) {
      console.error('Error deleting post from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting post from Supabase:', err);
    return false;
  }
}

/**
 * Obtener todos los itinerarios/planes pre-diseñados desde Supabase
 */
export async function getReadyPlansFromSupabase(): Promise<SimulatedReadyPlan[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('ready_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching ready_plans from Supabase:', error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((pl) => {
      if (pl.plan_data && typeof pl.plan_data === 'object') {
        return pl.plan_data as SimulatedReadyPlan;
      }
      return {
        id: pl.id,
        planTitle: pl.title || pl.plan_title || '',
        scheduledTime: pl.duration || pl.scheduled_time || '',
        coverImage: pl.cover_image || undefined,
        personalNote: pl.highlight || pl.personal_note || undefined,
        hidePrices: Boolean(pl.hide_prices),
        cardTemplate: pl.card_template || 'oleveci_brand',
        theme: pl.theme || {},
        bgLayout: pl.bg_layout || 'horizontal',
        postIds: Array.isArray(pl.stops) ? pl.stops : (pl.post_ids || []),
        fallbackPosts: pl.fallback_posts || undefined,
        category: pl.category_id || pl.category || 'plan_otros',
        estimatedBudget: Number(pl.budget_num || pl.estimated_budget || 0),
        municipality: pl.city || pl.municipality || 'Cajicá',
        timeOfDay: pl.time_of_day || 'tarde',
        dayType: pl.day_type || 'weekend',
        tags: pl.tags || [],
      };
    });
  } catch (err) {
    console.error('Supabase ready_plans fetch exception:', err);
    return null;
  }
}

/**
 * Guardar o actualizar un itinerario en Supabase
 */
export async function saveReadyPlanToSupabase(plan: SimulatedReadyPlan): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const payload = {
      id: plan.id,
      title: plan.planTitle || 'Itinerario Sabana',
      slug: plan.id,
      category_id: plan.category || 'plan_comer_algo',
      city: plan.municipality || 'Cajicá',
      budget: plan.estimatedBudget ? `$${plan.estimatedBudget.toLocaleString('es-CO')} COP` : '$50.000 COP',
      budget_num: plan.estimatedBudget || 50000,
      duration: plan.scheduledTime || '2 a 3 horas',
      highlight: plan.personalNote || '',
      cover_image: plan.coverImage || '',
      stops: plan.postIds || [],
      is_active: true,
      plan_data: plan,
    };

    const { error } = await supabase.from('ready_plans').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Error saving ready_plan to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception saving ready_plan to Supabase:', err);
    return false;
  }
}

/**
 * Eliminar un itinerario de Supabase
 */
export async function deleteReadyPlanFromSupabase(planId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const { error } = await supabase.from('ready_plans').delete().eq('id', planId);
    if (error) {
      console.error('Error deleting ready_plan from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting ready_plan from Supabase:', err);
    return false;
  }
}

/**
 * Cargar datos iniciales desde el frontend hacia Supabase (Semilla masiva)
 */
export async function seedInitialDataToSupabase(
  businesses: Business[],
  posts: Post[],
  plans: SimulatedReadyPlan[]
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Supabase no está configurado aún con las claves en .env' };
  }

  try {
    // 1. Insertar Comercios
    const bizPayload = businesses.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logo: b.logo,
      cover_image: b.coverImage || null,
      description: b.description || '',
      category_id: mapCategoryToExisting(b.categoryId),
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
      social_links: b.socialLinks || {
        instagram: b.instagram,
        facebook: b.facebook,
        tiktok: b.tiktok,
        youtube: b.youtube,
        website: b.website,
        twitter: b.twitter,
      },
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
      metrics: b.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 },
    }));

    const { error: bizErr } = await supabase
      .from('businesses')
      .upsert(bizPayload, { onConflict: 'id' });

    if (bizErr) throw new Error(`Error subiendo comercios: ${bizErr.message}`);

    // 2. Insertar Publicaciones
    const postPayload = posts.map((p) => ({
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
      category_id: mapCategoryToExisting(p.categoryId),
      plan_category_id: p.planCategoryId || null,
      plan_category_name: p.planCategoryName || null,
      featured: Boolean(p.featured),
      tags: p.tags || [],
      status: p.status || 'active',
      suspension_reason: p.suspensionReason || null,
      metrics: p.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 },
    }));

    // Upsert posts in batches of 25
    for (let i = 0; i < postPayload.length; i += 25) {
      const batch = postPayload.slice(i, i + 25);
      const { error: postErr } = await supabase.from('posts').upsert(batch, { onConflict: 'id' });
      if (postErr) throw new Error(`Error subiendo anuncios lote ${i}: ${postErr.message}`);
    }

    // 3. Insertar Itinerarios
    const planPayload = plans.map((pl) => ({
      id: pl.id,
      title: pl.planTitle || 'Itinerario Sabana',
      slug: pl.id,
      category_id: pl.category || 'plan_comer_algo',
      city: pl.municipality || 'Cajicá',
      budget: pl.estimatedBudget ? `${pl.estimatedBudget.toLocaleString('es-CO')} COP` : '$50.000 COP',
      budget_num: pl.estimatedBudget || 50000,
      duration: pl.scheduledTime || '2 a 3 horas',
      highlight: pl.personalNote || '',
      cover_image: pl.coverImage || '',
      stops: pl.postIds || [],
      is_active: true,
      plan_data: pl,
    }));

    const { error: planErr } = await supabase
      .from('ready_plans')
      .upsert(planPayload, { onConflict: 'id' });

    if (planErr) throw new Error(`Error subiendo itinerarios: ${planErr.message}`);

    return {
      success: true,
      message: `¡Base de datos en Supabase sincronizada con éxito! (${businesses.length} comercios, ${posts.length} anuncios y ${plans.length} itinerarios).`,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error durante la sincronización' };
  }
}
