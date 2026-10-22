import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Post, Business } from '../types';
import { SimulatedReadyPlan } from '../data/readyPlansData';

const VALID_CATEGORY_IDS = new Set([
  'cat_gastronomia',
  'cat_mercados',
  'cat_artesanias',
  'cat_bienestar',
  'cat_servicios',
]);

export function mapCategoryToExisting(id?: string): string {
  if (!id) return 'cat_servicios';
  if (VALID_CATEGORY_IDS.has(id)) return id;
  if (['cat_restaurantes', 'cat_cafes', 'cat_comida_rapida'].includes(id)) return 'cat_gastronomia';
  if (['cat_belleza', 'cat_salud', 'cat_fitness'].includes(id)) return 'cat_bienestar';
  if (['cat_moda', 'cat_artesanias', 'cat_regalos', 'cat_hogar'].includes(id)) return 'cat_artesanias';
  if (['cat_mercados', 'cat_ferreteria'].includes(id)) return 'cat_mercados';
  return 'cat_servicios';
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
      categoryId: b.category_id || 'cat_gastronomia',
      subCategory: b.sub_category || '',
      address: b.address,
      city: b.city,
      sector: b.sector,
      coordinates: { lat: Number(b.lat), lng: Number(b.lng) },
      hours: b.hours || '8:00 AM - 8:00 PM',
      whatsapp: b.whatsapp,
      phone: b.phone,
      email: b.email,
      socialLinks: b.social_links || {},
      rating: Number(b.rating || 5.0),
      verified: Boolean(b.verified),
      featured: Boolean(b.featured),
      status: b.status || 'active',
      subscription: b.subscription || {
        status: 'active',
        planName: 'Plan Veci Pro',
        priceCOP: 39000,
        billingCycle: 'monthly',
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        autoRenew: true,
      },
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
      aspectRatio: p.aspect_ratio || '9:16',
      mediaBgFill: p.media_bg_fill || 'blur',
      originalPrice: p.original_price ? Number(p.original_price) : undefined,
      promotionalPrice: p.promotional_price ? Number(p.promotional_price) : undefined,
      startsAt: p.starts_at,
      expiresAt: p.expires_at || undefined,
      expiryLabel: p.expiry_label || undefined,
      validitySchedule: p.validity_schedule || undefined,
      categoryId: p.category_id || 'cat_gastronomia',
      planCategoryIds: p.plan_category_ids || [],
      isPlan: Boolean(p.is_plan),
      planData: p.plan_data || undefined,
      featured: Boolean(p.featured),
      tags: p.tags || [],
      status: p.status || 'active',
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
      aspect_ratio: post.aspectRatio || '9:16',
      media_bg_fill: post.mediaBgFill || 'blur',
      original_price: post.originalPrice || null,
      promotional_price: post.promotionalPrice || null,
      starts_at: post.startsAt,
      expires_at: post.expiresAt || null,
      expiry_label: post.expiryLabel || null,
      validity_schedule: post.validitySchedule || null,
      category_id: mapCategoryToExisting(post.categoryId),
      plan_category_ids: post.planCategoryIds || [],
      is_plan: Boolean(post.isPlan),
      plan_data: post.planData || null,
      featured: Boolean(post.featured),
      tags: post.tags || [],
      status: post.status || 'active',
      metrics: post.metrics,
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
      social_links: b.socialLinks || {},
      rating: b.rating,
      verified: b.verified,
      featured: b.featured,
      status: b.status,
      subscription: b.subscription,
      username: b.username || null,
      password: b.password || 'Veci2026',
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
      aspect_ratio: p.aspectRatio || '9:16',
      media_bg_fill: p.mediaBgFill || 'blur',
      original_price: p.originalPrice || null,
      promotional_price: p.promotionalPrice || null,
      starts_at: p.startsAt,
      expires_at: p.expiresAt || null,
      expiry_label: p.expiryLabel || null,
      validity_schedule: p.validitySchedule || null,
      category_id: mapCategoryToExisting(p.categoryId),
      plan_category_ids: p.planCategoryIds || [],
      is_plan: Boolean(p.isPlan),
      plan_data: p.planData || null,
      featured: Boolean(p.featured),
      tags: p.tags || [],
      status: p.status || 'active',
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
      cover_image: pl.coverImage,
      personal_note: pl.personalNote || null,
      estimated_budget: pl.estimatedBudget || 0,
      hide_prices: Boolean(pl.hidePrices),
      card_template: pl.cardTemplate || 'oleveci_brand',
      theme: pl.theme || {},
      bg_layout: pl.bgLayout || 'horizontal',
      post_ids: pl.postIds,
      category: pl.category || 'plan_otros',
      tags: pl.tags || [],
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
