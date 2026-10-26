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
      cover_image: biz.coverImage,
      description: biz.description,
      category_id: mapCategoryToExisting(biz.categoryId),
      sub_category: biz.subCategory,
      address: biz.address,
      city: biz.city,
      sector: biz.sector,
      lat: biz.coordinates.lat,
      lng: biz.coordinates.lng,
      hours: biz.hours,
      whatsapp: biz.whatsapp,
      phone: biz.phone,
      email: biz.email || null,
      instagram: biz.instagram || null,
      facebook: biz.facebook || null,
      tiktok: biz.tiktok || null,
      youtube: biz.youtube || null,
      website: biz.website || null,
      twitter: biz.twitter || null,
      social_links: biz.socialLinks || {
        instagram: biz.instagram,
        facebook: biz.facebook,
        tiktok: biz.tiktok,
        youtube: biz.youtube,
        website: biz.website,
        twitter: biz.twitter,
      },
      rating: biz.rating,
      verified: biz.verified,
      featured: biz.featured,
      status: biz.status,
      suspension_reason: biz.suspensionReason || null,
      suspended_at: biz.suspendedAt || null,
      review_status: biz.reviewStatus || 'none',
      review_requested_at: biz.reviewRequestedAt || null,
      correction_note: biz.correctionNote || null,
      suspension_history: biz.suspensionHistory || [],
      subscription: biz.subscription,
      billing_info: biz.billingInfo || null,
      payment_history: biz.paymentHistory || [],
      username: biz.username || null,
      password: biz.password || 'Veci2026',
      access_email: biz.accessEmail || null,
      access_pin: biz.accessPin || null,
      access_password: biz.accessPassword || biz.password || 'Veci2026',
      owner_name: biz.ownerName || null,
      owner_phone: biz.ownerPhone || null,
      metrics: biz.metrics,
      updated_at: new Date().toISOString(),
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
      lat: post.coordinates.lat,
      lng: post.coordinates.lng,
      type: post.type,
      title: post.title,
      description: post.description,
      image_url: post.imageUrl,
      video_url: post.videoUrl || null,
      media_type: post.mediaType || 'image',
      image_position: post.imagePosition || { x: 50, y: 50 },
      image_scale: post.imageScale || 1.0,
      image_fit: post.imageFit || 'cover',
      aspect_ratio: post.aspectRatio || '9:16',
      media_bg_fill: post.mediaBgFill || 'blur',
      original_price: post.originalPrice || null,
      promotional_price: post.promotionalPrice || null,
      price_scope: post.priceScope || null,
      price_type: post.priceType || null,
      approximate_price: post.approximatePrice || null,
      starts_at: post.startsAt,
      expires_at: post.expiresAt || null,
      expiry_label: post.expiryLabel || null,
      validity_schedule: post.validitySchedule || null,
      category_id: mapCategoryToExisting(post.categoryId),
      plan_category_id: post.planCategoryId || null,
      plan_category_ids: post.planCategoryIds || [],
      plan_category_name: post.planCategoryName || null,
      plan_role: post.planRole || null,
      plan_roles: post.planRoles || [],
      target_audience: post.targetAudience || [],
      is_plan: Boolean(post.isPlan),
      plan_data: post.planData || null,
      featured: Boolean(post.featured),
      tags: post.tags || [],
      status: post.status || 'active',
      suspension_reason: post.suspensionReason || null,
      suspended_at: post.suspendedAt || null,
      suspension_history: post.suspensionHistory || [],
      metrics: post.metrics,
      updated_at: new Date().toISOString(),
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

    return data.map((pl) => ({
      id: pl.id,
      planTitle: pl.plan_title,
      scheduledTime: pl.scheduled_time || '',
      coverImage: pl.cover_image || undefined,
      personalNote: pl.personal_note || undefined,
      hidePrices: Boolean(pl.hide_prices),
      cardTemplate: pl.card_template || 'oleveci_brand',
      theme: pl.theme || {},
      bgLayout: pl.bg_layout || 'horizontal',
      postIds: pl.post_ids || [],
      fallbackPosts: pl.fallback_posts || undefined,
      category: pl.category || 'plan_otros',
      estimatedBudget: Number(pl.estimated_budget || 0),
      municipality: pl.municipality || 'Cajicá',
      timeOfDay: pl.time_of_day || 'tarde',
      dayType: pl.day_type || 'weekend',
      tags: pl.tags || [],
    }));
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
      plan_title: plan.planTitle,
      municipality: plan.municipality || 'Cajicá',
      scheduled_time: plan.scheduledTime,
      cover_image: plan.coverImage || null,
      personal_note: plan.personalNote || null,
      estimated_budget: plan.estimatedBudget || 0,
      hide_prices: Boolean(plan.hidePrices),
      card_template: plan.cardTemplate || 'oleveci_brand',
      theme: plan.theme || {},
      bg_layout: plan.bgLayout || 'horizontal',
      post_ids: plan.postIds || [],
      fallback_posts: plan.fallbackPosts || [],
      category: plan.category || 'plan_otros',
      tags: plan.tags || [],
      time_of_day: plan.timeOfDay || 'tarde',
      day_type: plan.dayType || 'weekend',
      updated_at: new Date().toISOString(),
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
      cover_image: b.coverImage,
      description: b.description,
      category_id: mapCategoryToExisting(b.categoryId),
      sub_category: b.subCategory,
      address: b.address,
      city: b.city,
      sector: b.sector,
      lat: b.coordinates.lat,
      lng: b.coordinates.lng,
      hours: b.hours,
      whatsapp: b.whatsapp,
      phone: b.phone,
      email: b.email || null,
      instagram: b.instagram || null,
      facebook: b.facebook || null,
      tiktok: b.tiktok || null,
      youtube: b.youtube || null,
      website: b.website || null,
      twitter: b.twitter || null,
      social_links: b.socialLinks || {
        instagram: b.instagram,
        facebook: b.facebook,
        tiktok: b.tiktok,
        youtube: b.youtube,
        website: b.website,
        twitter: b.twitter,
      },
      rating: b.rating,
      verified: b.verified,
      featured: b.featured,
      status: b.status,
      suspension_reason: b.suspensionReason || null,
      suspended_at: b.suspendedAt || null,
      review_status: b.reviewStatus || 'none',
      review_requested_at: b.reviewRequestedAt || null,
      correction_note: b.correctionNote || null,
      suspension_history: b.suspensionHistory || [],
      subscription: b.subscription,
      billing_info: b.billingInfo || null,
      payment_history: b.paymentHistory || [],
      username: b.username || null,
      password: b.password || 'Veci2026',
      access_email: b.accessEmail || null,
      access_pin: b.accessPin || null,
      access_password: b.accessPassword || b.password || 'Veci2026',
      owner_name: b.ownerName || null,
      owner_phone: b.ownerPhone || null,
      metrics: b.metrics,
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
      lat: p.coordinates.lat,
      lng: p.coordinates.lng,
      type: p.type,
      title: p.title,
      description: p.description,
      image_url: p.imageUrl,
      video_url: p.videoUrl || null,
      media_type: p.mediaType || 'image',
      image_position: p.imagePosition || { x: 50, y: 50 },
      image_scale: p.imageScale || 1.0,
      image_fit: p.imageFit || 'cover',
      aspect_ratio: p.aspectRatio || '9:16',
      media_bg_fill: p.mediaBgFill || 'blur',
      original_price: p.originalPrice || null,
      promotional_price: p.promotionalPrice || null,
      price_scope: p.priceScope || null,
      price_type: p.priceType || null,
      approximate_price: p.approximatePrice || null,
      starts_at: p.startsAt,
      expires_at: p.expiresAt || null,
      expiry_label: p.expiryLabel || null,
      validity_schedule: p.validitySchedule || null,
      category_id: mapCategoryToExisting(p.categoryId),
      plan_category_id: p.planCategoryId || null,
      plan_category_ids: p.planCategoryIds || [],
      plan_category_name: p.planCategoryName || null,
      plan_role: p.planRole || null,
      plan_roles: p.planRoles || [],
      target_audience: p.targetAudience || [],
      is_plan: Boolean(p.isPlan),
      plan_data: p.planData || null,
      featured: Boolean(p.featured),
      tags: p.tags || [],
      status: p.status || 'active',
      suspension_reason: p.suspensionReason || null,
      suspended_at: p.suspendedAt || null,
      suspension_history: p.suspensionHistory || [],
      metrics: p.metrics,
    }));

    const { error: postErr } = await supabase
      .from('posts')
      .upsert(postPayload, { onConflict: 'id' });

    if (postErr) throw new Error(`Error subiendo anuncios: ${postErr.message}`);

    // 3. Insertar Itinerarios
    const planPayload = plans.map((pl) => ({
      id: pl.id,
      plan_title: pl.planTitle,
      municipality: pl.municipality || 'Cajicá',
      scheduled_time: pl.scheduledTime,
      cover_image: pl.coverImage || null,
      personal_note: pl.personalNote || null,
      estimated_budget: pl.estimatedBudget || 0,
      hide_prices: Boolean(pl.hidePrices),
      card_template: pl.cardTemplate || 'oleveci_brand',
      theme: pl.theme || {},
      bg_layout: pl.bgLayout || 'horizontal',
      post_ids: pl.postIds || [],
      fallback_posts: pl.fallbackPosts || [],
      category: pl.category || 'plan_otros',
      tags: pl.tags || [],
      time_of_day: pl.timeOfDay || 'tarde',
      day_type: pl.dayType || 'weekend',
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
