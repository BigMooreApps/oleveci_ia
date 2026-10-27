import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  Business,
  BusinessBillingInfo,
  BusinessNotification,
  BusinessPaymentRecord,
  Category,
  CitySector,
  DailyMetricRecord,
  LocationCoordinates,
  Municipality,
  NotificationPreference,
  PlanCategory,
  Post,
  PostTypeConfig,
  RoleMode,
  SuperAdminProfile,
  SuspensionHistoryEntry,
  PlanRoleMaster,
  TargetAudienceMaster,
  PriceScopeMaster,
} from '../types';
import { getTodayKey, generateDailyMetricsForPost } from '../utils/metricsUtils';
import {
  INITIAL_BUSINESSES,
  INITIAL_CATEGORIES,
  INITIAL_MUNICIPALITIES,
  INITIAL_PLAN_CATEGORIES,
  INITIAL_POSTS,
  INITIAL_POST_TYPES,
  INITIAL_SECTORS,
  INITIAL_PLAN_ROLES,
  INITIAL_TARGET_AUDIENCES,
  INITIAL_PRICE_SCOPES,
} from '../data/seedData';
import { APP_CONFIG } from '../config/brand';
import {
  READY_PLANS_SEED,
  SimulatedReadyPlan,
  filterReadyPlans,
} from '../data/readyPlansData';
import {
  DEFAULT_PREDEFINED_PASSWORD,
  getNextConsecutiveUsername,
} from '../utils/credentialUtils';
import { EMOJI_TO_LUCIDE_MAP, isEmoji } from '../utils/postTypeIcons';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  getPostsFromSupabase,
  getBusinessesFromSupabase,
  getReadyPlansFromSupabase,
  savePostToSupabase,
  deletePostFromSupabase,
  saveBusinessToSupabase,
  deleteBusinessFromSupabase,
  saveReadyPlanToSupabase,
  deleteReadyPlanFromSupabase,
  seedInitialDataToSupabase,
} from '../services/supabaseService';

interface AppContextType {
  // State
  businesses: Business[];
  posts: Post[];
  filteredPosts: Post[];
  categories: Category[];
  planCategories: PlanCategory[];
  sectors: CitySector[];
  municipalities: Municipality[];
  postTypes: PostTypeConfig[];
  planRoles: PlanRoleMaster[];
  targetAudiences: TargetAudienceMaster[];
  priceScopes: PriceScopeMaster[];
  currentCity: string;
  currentSector: string;
  selectedCategory: string;
  searchQuery: string;
  selectedPlanType: string;
  maxPlanBudget: number | null;
  feedFilter: string;
  activeFeedFilter: string;
  currentRole: RoleMode;
  currentBusinessId: string;
  authenticatedBusinessId: string | null;
  userLocation: LocationCoordinates | null;
  locationError: string | null;
  isLocationLoading: boolean;
  favorites: string[];
  notificationPrefs: NotificationPreference;
  businessNotifications: BusinessNotification[];
  activeToast: { title: string; body: string; time: string } | null;
  activeNotificationToast: { title: string; body: string; time: string } | null;

  // Setters
  setCurrentCity: (city: string) => void;
  setCurrentSector: (sector: string) => void;
  setSelectedCategory: (catId: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedPlanType: (type: string) => void;
  setMaxPlanBudget: (budget: number | null) => void;
  setFeedFilter: (filter: string) => void;
  setActiveFeedFilter: (filter: string) => void;
  setCurrentRole: (role: RoleMode) => void;
  setCurrentBusinessId: (id: string) => void;
  setUserLocation: (coords: LocationCoordinates | null) => void;
  setNotificationPrefs: React.Dispatch<React.SetStateAction<NotificationPreference>>;
  dismissToast: () => void;
  dismissNotificationToast: () => void;

  // Actions
  requestUserLocation: () => Promise<boolean>;
  getDistanceKm: (coords?: LocationCoordinates | null) => number | null;
  isPostActive: (post: Post) => boolean;
  trackInteraction: (postId: string, type: 'view' | 'whatsapp' | 'maps' | 'call' | 'share') => void;
  trackBusinessInteraction: (businessId: string, type: 'view' | 'whatsapp' | 'maps' | 'call' | 'share') => void;
  redeemPostQR: (
    codeOrPayload: string,
    businessId: string
  ) => { success: boolean; message: string; post?: Post; code?: string };
  toggleFavorite: (postId: string) => void;
  isFavorite: (postId: string) => boolean;
  togglePostFeatured: (postId: string) => void;
  createPost: (post: Omit<Post, 'id' | 'createdAt' | 'metrics'>) => { success: boolean; error?: string; post?: Post };
  updatePost: (postId: string, data: Partial<Post>) => void;
  deletePost: (postId: string) => void;
  suspendPost: (postId: string, reason: string, presetReason?: string) => void;
  reactivatePost: (postId: string) => void;
  submitPostCorrection: (postId: string, data: Partial<Post>, note?: string) => void;
  approvePostReview: (postId: string) => void;
  rejectPostReview: (postId: string, reason: string) => void;
  markBusinessNotificationAsRead: (notificationId: string) => void;
  deleteBusinessNotification: (notificationId: string) => void;
  clearBusinessNotifications: (businessId: string) => void;
  addBusiness: (
    businessData: Omit<Business, 'id' | 'createdAt' | 'metrics'>,
    billingInfo?: BusinessBillingInfo,
    paymentRecord?: BusinessPaymentRecord,
    initialPaymentHistory?: BusinessPaymentRecord[]
  ) => Business;
  addBusinessPaymentRecord: (businessId: string, record: BusinessPaymentRecord) => void;
  createBusinessDirect: (businessData: Omit<Business, 'id' | 'createdAt' | 'metrics'>) => Business;
  loginAsBusiness: (businessId: string) => void;
  logoutBusiness: () => void;
  updateBusiness: (businessId: string, data: Partial<Business>) => void;
  suspendBusiness: (businessId: string, reason: string, presetReason?: string) => void;
  reactivateBusiness: (businessId: string) => void;
  submitBusinessCorrection: (businessId: string, data?: Partial<Business>, note?: string) => void;
  approveBusinessReview: (businessId: string) => void;
  rejectBusinessReview: (businessId: string, reason: string) => void;
  updateBusinessCredentials: (
    businessId: string,
    credentials: {
      accessEmail?: string;
      accessPassword?: string;
      accessPin?: string;
      username?: string;
      password?: string;
      ownerName?: string;
      ownerPhone?: string;
    }
  ) => void;
  requestPasswordReset: (usernameOrEmail: string) => {
    success: boolean;
    message: string;
    email?: string;
    username?: string;
  };
  deleteBusiness: (businessId: string) => void;
  renewBusinessSubscription: (
    businessId: string,
    options?: {
      days?: number;
      planName?: string;
      priceCOP?: number;
      billingCycle?: 'monthly' | 'yearly';
      paymentRecord?: BusinessPaymentRecord;
    }
  ) => void;

  // Municipalities CRUD with Cascade
  addMunicipality: (muni: Omit<Municipality, 'id'>) => Municipality;
  updateMunicipality: (id: string, data: Partial<Municipality>) => void;
  deleteMunicipality: (id: string) => void;

  // Sectors CRUD with Cascade
  addSector: (sector: Omit<CitySector, 'id'>) => CitySector;
  updateSector: (id: string, data: Partial<CitySector>) => void;
  deleteSector: (id: string) => void;

  // Categories CRUD with Cascade
  addCategory: (cat: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  // Plan Categories CRUD (Tipos de Planes / Salidas)
  addPlanCategory: (planCat: Omit<PlanCategory, 'id'>) => PlanCategory;
  updatePlanCategory: (id: string, data: Partial<PlanCategory>) => void;
  deletePlanCategory: (id: string) => void;
  resetPlanCategoriesToDefault: () => void;

  // Platform Ready Plans (Itinerarios Listos creados por el Administrador)
  readyPlans: SimulatedReadyPlan[];
  addReadyPlan: (plan: SimulatedReadyPlan) => void;
  updateReadyPlan: (id: string, data: Partial<SimulatedReadyPlan>) => void;
  deleteReadyPlan: (id: string) => void;
  resetReadyPlansToDefault: () => void;

  // Post Types CRUD with Cascade
  addPostType: (pt: Omit<PostTypeConfig, 'id'>) => PostTypeConfig;
  updatePostType: (id: string, data: Partial<PostTypeConfig>) => void;
  deletePostType: (id: string) => void;

  // Plan Roles (Momentos del Plan) CRUD
  addPlanRole: (item: Omit<PlanRoleMaster, 'id'>) => PlanRoleMaster;
  updatePlanRole: (id: string, data: Partial<PlanRoleMaster>) => void;
  deletePlanRole: (id: string) => void;
  resetPlanRolesToDefault: () => void;

  // Target Audiences (Público Objetivo) CRUD
  addTargetAudience: (item: Omit<TargetAudienceMaster, 'id'>) => TargetAudienceMaster;
  updateTargetAudience: (id: string, data: Partial<TargetAudienceMaster>) => void;
  deleteTargetAudience: (id: string) => void;
  resetTargetAudiencesToDefault: () => void;

  // Price Scopes (Cobertura y Modalidad de Precio) CRUD
  addPriceScope: (item: Omit<PriceScopeMaster, 'id'>) => PriceScopeMaster;
  updatePriceScope: (id: string, data: Partial<PriceScopeMaster>) => void;
  deletePriceScope: (id: string) => void;
  resetPriceScopesToDefault: () => void;

  simulatePushNotification: (title?: string, body?: string) => void;
  resetToInitialData: () => void;

  // SuperAdmin Profile & Authentication
  isAdminAuthenticated: boolean;
  adminProfile: SuperAdminProfile;
  loginAsAdmin: (password?: string) => boolean;
  logoutAdmin: () => void;
  updateAdminProfile: (profile: Partial<SuperAdminProfile>) => void;
  resetAdminProfileToDefault: () => void;
}

export const DEFAULT_SUPERADMIN_PROFILE: SuperAdminProfile = {
  username: 'Admin',
  password: 'Ole2026',
  fullName: 'Administrador General OleVeci',
  phone: '+57 310 555 2026',
  email: 'admin@oleveci.com',
  supportEmail: 'soporte@oleveci.com',
  roleTitle: 'Super Administrador de Plataforma',
  municipality: 'Cajicá / Sabana Centro, Cundinamarca',
  whatsappSupport: '573105552026',
  supportHours: 'Lunes a Sábado: 8:00 AM - 6:00 PM',
  securityNotes: 'Acceso de máxima jerarquía para control territorial, moderación, altas de comercio y auditoría del sistema.',
  lastLoginAt: undefined,
};

const STORAGE_KEYS = {
  BUSINESSES: 'oleveci_businesses_v3',
  POSTS: 'oleveci_posts_v3',
  CATEGORIES: 'oleveci_categories_v3',
  MUNICIPALITIES: 'oleveci_municipalities_v3',
  SECTORS: 'oleveci_sectors_v3',
  POST_TYPES: 'oleveci_post_types_v2',
  FAVORITES: 'oleveci_favorites_v2',
  NOTIFICATIONS: 'oleveci_notifications_v2',
  BUSINESS_NOTIFICATIONS: 'oleveci_business_notifications_v2',
  PLAN_CATEGORIES: 'oleveci_plan_categories_v3',
  PLAN_ROLES: 'oleveci_plan_roles_v1',
  TARGET_AUDIENCES: 'oleveci_target_audiences_v1',
  PRICE_SCOPES: 'oleveci_price_scopes_v1',
  READY_PLANS: 'oleveci_ready_plans_v2',
  ADMIN_AUTH: 'oleveci_admin_authenticated_v1',
  ADMIN_PROFILE: 'oleveci_admin_profile_v1',
  DELETED_BUSINESS_IDS: 'oleveci_deleted_business_ids_v1',
  DELETED_POST_IDS: 'oleveci_deleted_post_ids_v1',
};

const getDeletedBusinessIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_BUSINESS_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const addDeletedBusinessId = (id: string) => {
  try {
    const current = getDeletedBusinessIds();
    if (!current.includes(id)) {
      localStorage.setItem(STORAGE_KEYS.DELETED_BUSINESS_IDS, JSON.stringify([...current, id]));
    }
  } catch {}
};

const getDeletedPostIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_POST_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const addDeletedPostId = (id: string) => {
  try {
    const current = getDeletedPostIds();
    if (!current.includes(id)) {
      localStorage.setItem(STORAGE_KEYS.DELETED_POST_IDS, JSON.stringify([...current, id]));
    }
  } catch {}
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// Haversine formula to compute accurate distance in kilometers
function calculateHaversineDistance(
  coords1?: LocationCoordinates | null,
  coords2?: LocationCoordinates | null
): number {
  if (
    !coords1 ||
    !coords2 ||
    typeof coords1.lat !== 'number' ||
    typeof coords1.lng !== 'number' ||
    typeof coords2.lat !== 'number' ||
    typeof coords2.lng !== 'number' ||
    isNaN(coords1.lat) ||
    isNaN(coords1.lng) ||
    isNaN(coords2.lat) ||
    isNaN(coords2.lng)
  ) {
    return 0;
  }
  const R = 6371; // Earth's radius in km
  const dLat = ((coords2.lat - coords1.lat) * Math.PI) / 180;
  const dLng = ((coords2.lng - coords1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coords1.lat * Math.PI) / 180) *
      Math.cos((coords2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place (e.g. 0.8 km)
}

const normalizeBusiness = (b: Business): Business => {
  let history: SuspensionHistoryEntry[] = Array.isArray(b.suspensionHistory)
    ? [...b.suspensionHistory]
    : [];

  // Seed sample suspension histories for testing if empty
  if (history.length === 0 && b.id === 'biz_barber_camilo') {
    history = [
      {
        id: `hist_barber_seed_1`,
        type: 'suspension',
        title: 'Suspensión del Comercio (1ª Falta)',
        note: 'Información comercial o datos de contacto falsos / engañosos: La dirección indicada no correspondía con el local comercial y el teléfono no respondía.',
        timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        authorRole: 'admin',
        authorName: 'Administración OleVeci',
        badge: '1ª Suspensión',
        incidentNumber: 1,
        reasonPreset: 'Información comercial o datos de contacto falsos / engañosos',
      },
      {
        id: `hist_barber_seed_2`,
        type: 'review_request',
        title: 'Solicitud de Revisión y Corrección',
        note: 'Se actualizó la dirección exacta en Av. Cavelier # 5-40 (Capellanía) y se configuró la línea de WhatsApp verificada del negocio 3187654321. Solicitamos reactivación.',
        timestamp: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
        authorRole: 'business',
        authorName: 'Barbería Don Camilo',
        badge: 'Corrección del Comercio',
        incidentNumber: 1,
      },
      {
        id: `hist_barber_seed_3`,
        type: 'reactivation',
        title: 'Corrección Aprobada y Comercio Reactivado',
        note: 'El equipo de moderación verificó la dirección física en Capellanía y la autenticidad de la línea telefónica. Se aprueba la reactivación.',
        timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        authorRole: 'admin',
        authorName: 'Administración OleVeci',
        badge: 'Aprobado y Reactivado',
        incidentNumber: 1,
      },
    ];
  }

  // If there's no stored history but the business has suspension data, synthesize initial step-by-step history
  if (
    history.length === 0 &&
    (b.status === 'suspended' ||
      b.status === 'pending_review' ||
      b.suspensionReason ||
      b.correctionNote)
  ) {
    const baseTime = b.suspendedAt
      ? new Date(b.suspendedAt).getTime()
      : Date.now() - 3600000 * 4;

    // Step 1: Initial suspension by admin
    if (b.suspensionReason || b.status === 'suspended' || b.status === 'pending_review') {
      history.push({
        id: `hist_init_susp_${b.id}`,
        type: 'suspension',
        title: 'Suspensión del Comercio',
        note: b.suspensionReason || 'Incumplimiento de términos y políticas del servicio.',
        timestamp: b.suspendedAt || new Date(baseTime).toISOString(),
        authorRole: 'admin',
        authorName: 'Administración OleVeci',
        badge: '1ª Suspensión',
        incidentNumber: 1,
      });
    }

    // Step 2: Customer / Merchant correction and review request
    if (b.correctionNote || b.status === 'pending_review' || b.reviewRequestedAt) {
      const reviewTime = b.reviewRequestedAt
        ? new Date(b.reviewRequestedAt).getTime()
        : baseTime + 3600000 * 2;
      history.push({
        id: `hist_init_req_${b.id}`,
        type: 'review_request',
        title: 'Solicitud de Revisión Enviada',
        note: b.correctionNote || 'Corrección y justificación enviada para evaluación.',
        timestamp: b.reviewRequestedAt || new Date(reviewTime).toISOString(),
        authorRole: 'business',
        authorName: b.name || 'Comercio',
        badge: 'Comentario del Cliente',
        incidentNumber: 1,
      });
    }

    // Step 3: Admin rejection observation if reviewStatus was rejected
    if (b.reviewStatus === 'rejected' && b.rejectionReason) {
      const rejectTime = b.lastReviewedAt
        ? new Date(b.lastReviewedAt).getTime()
        : baseTime + 3600000 * 3;
      history.push({
        id: `hist_init_rej_${b.id}`,
        type: 'review_rejection',
        title: 'Observación de Rechazo del Administrador',
        note: b.rejectionReason,
        timestamp: b.lastReviewedAt || new Date(rejectTime).toISOString(),
        authorRole: 'admin',
        authorName: 'Administración OleVeci',
        badge: 'Observación del Admin',
        incidentNumber: 1,
      });
    }
  }

  const fallbackEmail =
    b.email ||
    b.billingInfo?.email ||
    (b.id === 'biz_oleveci'
      ? 'contacto@oleveci.com'
      : b.id === 'biz_barber_camilo'
      ? 'contacto@doncamilobarber.com'
      : b.id === 'biz_brasa_burger'
      ? 'contacto@labrasaburger.com'
      : b.id === 'biz_cafe_sabana'
      ? 'hola@cafeytrigo.com'
      : b.id === 'biz_paws_vet'
      ? 'citas@pawscarevet.com'
      : b.id === 'biz_cava_sabana'
      ? 'reservas@cavasabana.com'
      : b.id === 'biz_powerfit'
      ? 'info@powerfit.com'
      : b.id === 'biz_chia_labalsa_cafe'
      ? 'contacto@cafelabalsa.com'
      : b.id === 'biz_chia_parrilla_centro'
      ? 'pedidos@fogonsabanero.com'
      : undefined);

  const fallbackUsername =
    b.id === 'biz_oleveci'
      ? 'OLE0101'
      : b.id === 'biz_brasa_burger'
      ? 'OLE0102'
      : b.id === 'biz_cafe_sabana'
      ? 'OLE0103'
      : b.id === 'biz_barber_camilo'
      ? 'OLE0104'
      : b.id === 'biz_paws_vet'
      ? 'OLE0105'
      : b.id === 'biz_cava_sabana'
      ? 'OLE0106'
      : b.id === 'biz_powerfit'
      ? 'OLE0107'
      : b.id === 'biz_chia_labalsa_cafe'
      ? 'OLE0108'
      : b.id === 'biz_chia_parrilla_centro'
      ? 'OLE0109'
      : b.id === 'biz_hotel_sabana'
      ? 'OLE0110'
      : b.id === 'biz_autospa_cajica'
      ? 'OLE0111'
      : b.id === 'biz_carniceria_gourmet'
      ? 'OLE0112'
      : b.id === 'biz_mercado_sabana'
      ? 'OLE0113'
      : b.id === 'biz_chia_hotel_colonial'
      ? 'OLE0114'
      : b.username;

  const fallbackPassword = b.password || b.accessPassword || DEFAULT_PREDEFINED_PASSWORD;

  const currentMetrics = b.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
  const dailyM =
    currentMetrics.dailyMetrics && Object.keys(currentMetrics.dailyMetrics).length > 0
      ? currentMetrics.dailyMetrics
      : generateDailyMetricsForPost(currentMetrics, 45);

  return {
    ...b,
    email: fallbackEmail,
    username: fallbackUsername,
    password: fallbackPassword,
    metrics: {
      ...currentMetrics,
      dailyMetrics: dailyM,
    },
    suspensionHistory: history,
    accessEmail: b.accessEmail || `${b.slug || b.id}@oleveci.com`,
    accessPin: b.accessPin || '1234',
    accessPassword: fallbackPassword,
    ownerName: b.ownerName || 'Propietario / Gerente',
    ownerPhone: b.ownerPhone || b.phone || b.whatsapp || '3100000000',
  };
};

export const sortCategories = (list: Category[]): Category[] => {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
};

export const sortPlanCategories = (list: PlanCategory[]): PlanCategory[] => {
  return [...list].sort((a, b) => (a.order || 99) - (b.order || 99) || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
};

export const PREFERRED_POST_TYPE_ORDER: Record<string, number> = {
  promotion: 1,
  event: 2,
  product: 3,
  service: 4,
};

export const sortPostTypes = (list: PostTypeConfig[]): PostTypeConfig[] => {
  return [...list]
    .filter((pt) => pt.id !== 'other' && pt.id !== 'menu' && pt.slug !== 'novedad')
    .map((pt) => {
      if (pt.id === 'service' && (pt.label === 'Servicio & Turnos' || !pt.label)) {
        return { ...pt, label: 'Servicios & Trámites', order: 4 };
      }
      if (pt.id === 'promotion' && !pt.order) return { ...pt, order: 1 };
      if (pt.id === 'event' && !pt.order) return { ...pt, order: 2 };
      if (pt.id === 'product' && !pt.order) return { ...pt, order: 3 };
      if (pt.id === 'service' && !pt.order) return { ...pt, order: 4 };
      return pt;
    })
    .sort((a, b) => {
      const orderA = a.order ?? PREFERRED_POST_TYPE_ORDER[a.id] ?? 99;
      const orderB = b.order ?? PREFERRED_POST_TYPE_ORDER[b.id] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
    });
};

export const sortMunicipalities = (list: Municipality[]): Municipality[] => {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
};

export const sortSectors = (list: CitySector[]): CitySector[] => {
  return [...list].sort((a, b) => {
    const cityComp = a.cityName.localeCompare(b.cityName, 'es', { sensitivity: 'base' });
    if (cityComp !== 0) return cityComp;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Businesses state
  const [businesses, setBusinesses] = useState<Business[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BUSINESSES) || localStorage.getItem('oleveci_businesses_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged: Business[] = [...parsed];
          const deletedBizIds = getDeletedBusinessIds();
          for (const initialBiz of INITIAL_BUSINESSES) {
            if (deletedBizIds.includes(initialBiz.id)) continue;
            const idx = merged.findIndex((b) => b?.id === initialBiz.id);
            if (idx >= 0) {
              // Ensure status, subscription and canonical username are active
              merged[idx] = {
                ...merged[idx],
                username: initialBiz.username || merged[idx].username,
                status: 'active',
                subscription: {
                  ...merged[idx].subscription,
                  priceCOP: initialBiz.subscription.priceCOP,
                  status: 'active' as const,
                  expiresAt: initialBiz.subscription.expiresAt,
                  autoRenew: true,
                },
              };
            } else {
              if (initialBiz.id === 'biz_oleveci') {
                merged.unshift(initialBiz);
              } else {
                merged.push(initialBiz);
              }
            }
          }
          const oleveciIdx = merged.findIndex((b) => b?.id === 'biz_oleveci');
          if (oleveciIdx > 0) {
            const [oleveciBiz] = merged.splice(oleveciIdx, 1);
            merged.unshift(oleveciBiz);
          }
          return merged.filter(Boolean).map(normalizeBusiness);
        }
      }
    } catch {
      // fallback
    }
    const initialDeletedBiz = getDeletedBusinessIds();
    return INITIAL_BUSINESSES.filter((b) => !initialDeletedBiz.includes(b.id)).map(normalizeBusiness);
  });

  // Posts state
  const [posts, setPosts] = useState<Post[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POSTS) || localStorage.getItem('oleveci_posts_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged: Post[] = [...parsed];
          const deletedPostIds = getDeletedPostIds();
          for (const initialPost of INITIAL_POSTS) {
            if (deletedPostIds.includes(initialPost.id)) continue;
            const idx = merged.findIndex((p) => p?.id === initialPost.id);
            if (idx >= 0) {
              // Keep fresh active dates and details from initial post if it was previously expired
              const postExp = merged[idx].expiresAt ? new Date(merged[idx].expiresAt).getTime() : 0;
              if (postExp <= Date.now() || merged[idx].id === 'post_expired_promo_sample' || merged[idx].id === 'post_oleveci_bienvenida') {
                merged[idx] = {
                  ...merged[idx],
                  ...initialPost,
                  videoUrl: initialPost.id === 'post_oleveci_bienvenida' ? initialPost.videoUrl : (initialPost.videoUrl || merged[idx].videoUrl),
                  mediaType: initialPost.mediaType || merged[idx].mediaType,
                };
              }
            } else {
              if (initialPost.id === 'post_oleveci_bienvenida') {
                merged.unshift(initialPost);
              } else {
                merged.push(initialPost);
              }
            }
          }
          const oleveciPostIdx = merged.findIndex((p) => p?.id === 'post_oleveci_bienvenida');
          if (oleveciPostIdx > 0) {
            const [olePost] = merged.splice(oleveciPostIdx, 1);
            merged.unshift(olePost);
          }
          merged.forEach((p, i) => {
            if (p?.id === 'post_oleveci_bienvenida') {
              merged[i] = {
                ...p,
                videoUrl: 'https://gpdqjihnnjetoxxfsfxh.supabase.co/storage/v1/object/public/oleveci-media/posts/bienvenida_oleveci.mp4',
                imageUrl: 'https://gpdqjihnnjetoxxfsfxh.supabase.co/storage/v1/object/public/oleveci-media/posts/poster_bienvenida_oli.jpg'
              };
            }
          });
          const initialTypeMap = new Map(INITIAL_POSTS.map((p) => [p.id, p.type]));
          return merged.filter(Boolean).map((p) => {
            let updated = p;
            if (initialTypeMap.has(p.id)) {
              updated = { ...updated, type: initialTypeMap.get(p.id)! };
            }
            if (updated.type === 'other') {
              updated = { ...updated, type: 'promotion' };
            }
            if (updated.imageUrl && updated.imageUrl.includes('photo-1527477321007-e2a1d3f486c1')) {
              updated = {
                ...updated,
                imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&auto=format&fit=crop&q=80',
              };
            }
            // Ensure Volley, Nuevo Servicio and Cafe Sello Rojo have dedicated covers
            if (updated.id === 'post_1791221143310_zvu6i' || updated.title?.toLowerCase().includes('volley')) {
              updated = {
                ...updated,
                imageUrl: '/uploads/cover_volley.jpg',
                aspectRatio: '9:16',
              };
            }
            if (updated.id === 'post_1791231179361_xngwj' || updated.title?.toLowerCase().includes('nuevo servicio')) {
              updated = {
                ...updated,
                imageUrl: '/uploads/cover_nuevo_servicio.jpg',
                aspectRatio: '9:16',
              };
            }
            if (updated.id === 'post_1791236006956_ih5xg' || updated.title?.toLowerCase().includes('cafe sello rojo')) {
              updated = {
                ...updated,
                imageUrl: '/uploads/cover_cafe_sello_rojo.jpg',
                aspectRatio: '9:16',
              };
            }
            // Enforce uniform 9:16 aspect ratio for all feed posts
            if (updated.aspectRatio !== '9:16') {
              updated = {
                ...updated,
                aspectRatio: '9:16',
              };
            }
            if (!updated.metrics?.dailyMetrics || Object.keys(updated.metrics.dailyMetrics).length === 0) {
              const currentM = updated.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
              updated = {
                ...updated,
                metrics: {
                  ...currentM,
                  dailyMetrics: generateDailyMetricsForPost(currentM, 45),
                },
              };
            }
            return updated;
          });
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_POSTS;
  });


  // Categories state
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with canonical INITIAL_CATEGORIES to ensure updated names, emojis, and all 18 categories
          const merged = INITIAL_CATEGORIES.map((initCat) => {
            const found = parsed.find((c: Category) => c.id === initCat.id);
            const effectiveIcon = found?.iconName && isEmoji(found.iconName) ? found.iconName : initCat.iconName;
            return found ? { ...initCat, ...found, name: initCat.name, iconName: effectiveIcon, emoji: effectiveIcon } : initCat;
          });
          // Also keep any custom categories added by the admin
          const custom = parsed.filter(
            (c: Category) => !INITIAL_CATEGORIES.some((ic) => ic.id === c.id)
          );
          return sortCategories([...merged, ...custom]);
        }
      }
    } catch {
      // fallback
    }
    return sortCategories(INITIAL_CATEGORIES);
  });

  // Plan Categories state (Tipos de Planes / Salidas)
  const [planCategories, setPlanCategories] = useState<PlanCategory[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PLAN_CATEGORIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = INITIAL_PLAN_CATEGORIES.map((initPlan) => {
            const found = parsed.find((p: PlanCategory) => p.id === initPlan.id);
            const effectiveIcon = found?.iconName && isEmoji(found.iconName) ? found.iconName : initPlan.iconName;
            return found
              ? { ...initPlan, ...found, name: initPlan.name, order: initPlan.order, iconName: effectiveIcon, emoji: effectiveIcon }
              : initPlan;
          });
          const custom = parsed.filter(
            (p: PlanCategory) => !INITIAL_PLAN_CATEGORIES.some((ip) => ip.id === p.id)
          );
          return sortPlanCategories([...merged, ...custom]);
        }
      }
    } catch {
      // fallback
    }
    return sortPlanCategories(INITIAL_PLAN_CATEGORIES);
  });

  // Ready Plans state (Itinerarios Listos creados por el Administrador)
  const [readyPlans, setReadyPlans] = useState<SimulatedReadyPlan[]>(() => {
    const normalizeCategory = (cat: string) => {
      if (cat === 'romance') return 'plan_cita_romantica';
      if (cat === 'gastronomia' || cat === 'parrilla') return 'plan_comer_algo';
      if (cat === 'cafe') return 'plan_tomar_algo';
      if (cat === 'wellness') return 'plan_cuidado_personal';
      if (cat === 'amigos') return 'plan_con_amigos';
      if (cat === 'rumba') return 'plan_noche_rumba';
      if (cat === 'naturaleza') return 'plan_planes_eventos_cerca';
      return cat;
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.READY_PLANS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: SimulatedReadyPlan) => ({
            ...p,
            category: normalizeCategory(p.category),
          }));
        }
      }
    } catch {
      // fallback
    }
    return READY_PLANS_SEED;
  });

  // Municipalities state
  const [municipalities, setMunicipalities] = useState<Municipality[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MUNICIPALITIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sortMunicipalities(
            parsed.map((m: Municipality) => ({
              ...m,
              emoji: '📍',
            }))
          );
        }
      }
    } catch {
      // fallback
    }
    return sortMunicipalities(INITIAL_MUNICIPALITIES);
  });

  // Sectors state
  const [sectors, setSectors] = useState<CitySector[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SECTORS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sortSectors(parsed);
        }
      }
    } catch {
      // fallback
    }
    return sortSectors(INITIAL_SECTORS);
  });

  // Post Types state
  const [postTypes, setPostTypes] = useState<PostTypeConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POST_TYPES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(
            (p: PostTypeConfig) => p.id !== 'menu' && p.id !== 'other' && p.slug !== 'novedad'
          );
          if (cleaned.length > 0) {
            return sortPostTypes(
              cleaned.map((pt: PostTypeConfig) => {
                const init = INITIAL_POST_TYPES.find((ip) => ip.id === pt.id);
                const effectiveIcon = pt.iconName && isEmoji(pt.iconName) ? pt.iconName : (init?.iconName || '🏷️');
                return {
                  ...pt,
                  iconName: effectiveIcon,
                  emoji: pt.emoji && isEmoji(pt.emoji) ? pt.emoji : effectiveIcon,
                };
              })
            );
          }
        }
      }
    } catch {
      // fallback
    }
    return sortPostTypes(INITIAL_POST_TYPES);
  });

  // Master Table: Plan Roles (Momentos del Plan)
  const [planRoles, setPlanRoles] = useState<PlanRoleMaster[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PLAN_ROLES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: PlanRoleMaster) => {
            const init = INITIAL_PLAN_ROLES.find((ip) => ip.id === r.id);
            const effectiveEmoji = r.emoji && isEmoji(r.emoji) ? r.emoji : (init?.emoji || '⏰');
            return {
              ...r,
              iconName: r.iconName && isEmoji(r.iconName) ? r.iconName : effectiveEmoji,
              emoji: effectiveEmoji,
            };
          });
        }
      }
    } catch {}
    return INITIAL_PLAN_ROLES;
  });

  // Master Table: Target Audiences (Público Objetivo)
  const [targetAudiences, setTargetAudiences] = useState<TargetAudienceMaster[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TARGET_AUDIENCES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((a: TargetAudienceMaster) => {
            const init = INITIAL_TARGET_AUDIENCES.find((ia) => ia.id === a.id);
            const effectiveEmoji = a.emoji && isEmoji(a.emoji) ? a.emoji : (init?.emoji || '👥');
            return {
              ...a,
              iconName: a.iconName && isEmoji(a.iconName) ? a.iconName : effectiveEmoji,
              emoji: effectiveEmoji,
            };
          });
        }
      }
    } catch {}
    return INITIAL_TARGET_AUDIENCES;
  });

  // Master Table: Price Scopes (Cobertura y Modalidad de Precio)
  const [priceScopes, setPriceScopes] = useState<PriceScopeMaster[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRICE_SCOPES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: PriceScopeMaster) => {
            const init = INITIAL_PRICE_SCOPES.find((ip) => ip.id === p.id);
            const effectiveEmoji = p.emoji && isEmoji(p.emoji) ? p.emoji : (init?.emoji || '🏷️');
            return {
              ...p,
              iconName: p.iconName && isEmoji(p.iconName) ? p.iconName : effectiveEmoji,
              emoji: effectiveEmoji,
            };
          });
        }
      }
    } catch {}
    return INITIAL_PRICE_SCOPES;
  });

  // Filter & Search states
  const [currentCity, setCurrentCityState] = useState<string>(APP_CONFIG.defaultCity);
  const [currentSector, setCurrentSector] = useState<string>('all');

  const setCurrentCity = (city: string) => {
    setCurrentCityState(city);
    setCurrentSector('all');
  };
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlanType, setSelectedPlanType] = useState<string>('all');
  const [maxPlanBudget, setMaxPlanBudget] = useState<number | null>(null);
  const [activeFeedFilter, setActiveFeedFilter] = useState<string>('today');

  // Role Switcher: 'home' (home screen), 'explorer' (regular user / descubrir), 'business' (merchant portal), 'admin' (platform management)
  const [currentRole, setCurrentRole] = useState<RoleMode>(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const roleParam = searchParams.get('tab') || searchParams.get('seccion') || searchParams.get('role');
      if (roleParam === 'descubrir' || roleParam === 'explorer' || window.location.pathname === '/descubrir') {
        return 'explorer';
      }
      if (
        roleParam === 'planes' ||
        roleParam === 'plans' ||
        window.location.pathname === '/planes' ||
        window.location.pathname.startsWith('/plan/') ||
        window.location.pathname.startsWith('/itinerario/') ||
        searchParams.has('plan') ||
        searchParams.has('itinerario')
      ) {
        return 'plans';
      }
      if (roleParam === 'business' || roleParam === 'negocio' || roleParam === 'miespacio') {
        return 'business';
      }
      if (roleParam === 'admin') {
        return 'admin';
      }
    } catch {}
    return 'home';
  });
  const [currentBusinessId, setCurrentBusinessId] = useState<string>(INITIAL_BUSINESSES[0]?.id || '');

  // Authenticated business for merchant portal
  const [authenticatedBusinessId, setAuthenticatedBusinessId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('oleveci_auth_biz_id') || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (authenticatedBusinessId) {
        localStorage.setItem('oleveci_auth_biz_id', authenticatedBusinessId);
      } else {
        localStorage.removeItem('oleveci_auth_biz_id');
      }
    } catch (e) {
      console.warn('Failed to save auth biz to localStorage', e);
    }
  }, [authenticatedBusinessId]);

  // SuperAdmin Profile state
  const [adminProfile, setAdminProfile] = useState<SuperAdminProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_PROFILE);
      if (saved) {
        return { ...DEFAULT_SUPERADMIN_PROFILE, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_SUPERADMIN_PROFILE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_PROFILE, JSON.stringify(adminProfile));
    } catch (e) {
      console.warn('Failed to save admin profile to localStorage', e);
    }
  }, [adminProfile]);

  // Admin authentication state: hidden by default
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isAdminAuthenticated) {
        localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
      }
    } catch (e) {
      console.warn('Failed to save admin auth to localStorage', e);
    }
  }, [isAdminAuthenticated]);

  // Sincronización automática inicial con Supabase (si está configurado)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    (async () => {
      try {
        const [remotePosts, remoteBiz, remotePlans] = await Promise.all([
          getPostsFromSupabase(),
          getBusinessesFromSupabase(),
          getReadyPlansFromSupabase(),
        ]);
        if (!isMounted) return;
        if (remotePosts && remotePosts.length > 0) {
          setPosts((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            remotePosts.forEach((rp) => {
              let sanitized = rp;
              if (sanitized?.id === 'post_oleveci_bienvenida') {
                sanitized = {
                  ...sanitized,
                  videoUrl: 'https://gpdqjihnnjetoxxfsfxh.supabase.co/storage/v1/object/public/oleveci-media/posts/bienvenida_oleveci.mp4',
                  imageUrl: 'https://gpdqjihnnjetoxxfsfxh.supabase.co/storage/v1/object/public/oleveci-media/posts/poster_bienvenida_oli.jpg'
                };
              }
              const existing = map.get(rp.id);
              map.set(rp.id, existing ? (Object.assign({}, existing, sanitized) as Post) : sanitized);
            });
            return Array.from(map.values());
          });
        }
        if (remoteBiz && remoteBiz.length > 0) {
          setBusinesses((prev) => {
            const map = new Map(prev.map((b) => [b.id, b]));
            remoteBiz.forEach((rb) => {
              const existing = map.get(rb.id);
              map.set(rb.id, existing ? (Object.assign({}, existing, rb) as Business) : rb);
            });
            return Array.from(map.values());
          });
        }
        if (remotePlans && remotePlans.length > 0) {
          setReadyPlans((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            remotePlans.forEach((rp) => {
              const existing = map.get(rp.id);
              map.set(rp.id, existing ? (Object.assign({}, existing, rp) as SimulatedReadyPlan) : rp);
            });
            return Array.from(map.values());
          });
        }

        // Si la base de datos de Supabase está vacía, la poblamos automáticamente
        const isDbEmpty = (!remotePosts || remotePosts.length === 0) && (!remoteBiz || remoteBiz.length === 0) && (!remotePlans || remotePlans.length === 0);
        if (isDbEmpty) {
          console.info('Poblando base de datos inicial de Supabase con datos de OleVeci...');
          await seedInitialDataToSupabase(INITIAL_BUSINESSES, INITIAL_POSTS, READY_PLANS_SEED);
        }
      } catch (err) {
        console.warn('Error sincronizando con Supabase:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const loginAsAdmin = (password?: string): boolean => {
    if (password && password !== adminProfile.password) {
      return false;
    }
    setIsAdminAuthenticated(true);
    setAdminProfile((prev) => ({
      ...prev,
      lastLoginAt: new Date().toISOString(),
    }));
    return true;
  };

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false);
    if (currentRole === 'admin') {
      setCurrentRole('explorer');
    }
  };

  const updateAdminProfile = (data: Partial<SuperAdminProfile>) => {
    setAdminProfile((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const resetAdminProfileToDefault = () => {
    setAdminProfile(DEFAULT_SUPERADMIN_PROFILE);
  };

  // Geolocation
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState<boolean>(false);

  // Favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  // Push notifications preferences
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      enabled: false,
      promotions: true,
      events: true,
      newBusinesses: true,
      categories: [],
    };
  });

  // Business direct notifications (policy warnings, suspensions, etc.)
  const [businessNotifications, setBusinessNotifications] = useState<BusinessNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BUSINESS_NOTIFICATIONS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  // In-app Push Simulation Toast
  const [activeToast, setActiveToast] = useState<{ title: string; body: string; time: string } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    } catch (e) {
      console.warn('Failed to save businesses to storage', e);
    }
  }, [businesses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
    } catch (e) {
      console.warn('Failed to save posts to storage', e);
    }
  }, [posts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.warn('Failed to save categories to storage', e);
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAN_CATEGORIES, JSON.stringify(planCategories));
    } catch (e) {
      console.warn('Failed to save planCategories to storage', e);
    }
  }, [planCategories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.READY_PLANS, JSON.stringify(readyPlans));
    } catch (e) {
      console.warn('Failed to save readyPlans to storage', e);
    }
  }, [readyPlans]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MUNICIPALITIES, JSON.stringify(municipalities));
    } catch (e) {
      console.warn('Failed to save municipalities to storage', e);
    }
  }, [municipalities]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SECTORS, JSON.stringify(sectors));
    } catch (e) {
      console.warn('Failed to save sectors to storage', e);
    }
  }, [sectors]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.POST_TYPES, JSON.stringify(postTypes));
    } catch (e) {
      console.warn('Failed to save postTypes to storage', e);
    }
  }, [postTypes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAN_ROLES, JSON.stringify(planRoles));
    } catch (e) {
      console.warn('Failed to save planRoles to storage', e);
    }
  }, [planRoles]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TARGET_AUDIENCES, JSON.stringify(targetAudiences));
    } catch (e) {
      console.warn('Failed to save targetAudiences to storage', e);
    }
  }, [targetAudiences]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRICE_SCOPES, JSON.stringify(priceScopes));
    } catch (e) {
      console.warn('Failed to save priceScopes to storage', e);
    }
  }, [priceScopes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    } catch (e) {
      console.warn('Failed to save favorites to storage', e);
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notificationPrefs));
    } catch (e) {
      console.warn('Failed to save notifications to storage', e);
    }
  }, [notificationPrefs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BUSINESS_NOTIFICATIONS, JSON.stringify(businessNotifications));
    } catch (e) {
      console.warn('Failed to save business notifications to storage', e);
    }
  }, [businessNotifications]);

  // Limpiar notificaciones obsoletas de publicaciones que ya están en revisión o activas para que no se queden pegadas
  useEffect(() => {
    setBusinessNotifications((prev) => {
      let changed = false;
      const updated = prev.filter((n) => {
        if (n.type === 'post_suspended' && n.postId) {
          const targetPost = posts.find((p) => p.id === n.postId);
          if (targetPost && (targetPost.status === 'pending_review' || targetPost.reviewStatus === 'pending' || targetPost.status === 'active')) {
            changed = true;
            return false;
          }
        }
        return true;
      }).map((n) => {
        if (n.type === 'review_requested' && !n.read) {
          changed = true;
          return { ...n, read: true };
        }
        return n;
      });

      return changed ? updated : prev;
    });
  }, [posts]);

  // Request GPS User Location with permission check
  const requestUserLocation = async (): Promise<boolean> => {
    setIsLocationLoading(true);
    setLocationError(null);

    if (!('geolocation' in navigator)) {
      setLocationError('Tu navegador no soporta geolocalización.');
      setIsLocationLoading(false);
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          setIsLocationLoading(false);
          resolve(true);
        },
        (error) => {
          let msg = 'No se pudo obtener tu ubicación actual.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Permiso de ubicación denegado. Puedes seleccionar tu sector manualmente.';
          }
          setLocationError(msg);
          setIsLocationLoading(false);
          // Default to center of Cajicá if user denied GPS so they still experience distance
          setUserLocation(APP_CONFIG.pilotCoordinates);
          resolve(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  };

  // Compute distance from user
  const getDistanceKm = (coords?: LocationCoordinates | null): number | null => {
    const origin = userLocation || APP_CONFIG.pilotCoordinates;
    if (
      !origin ||
      !coords ||
      typeof coords.lat !== 'number' ||
      typeof coords.lng !== 'number' ||
      typeof origin.lat !== 'number' ||
      typeof origin.lng !== 'number'
    ) {
      return null;
    }
    return calculateHaversineDistance(origin, coords);
  };

  // Rule 1: "Una publicación vencida no debe aparecer como activa."
  // Rule 2: "Las promociones vencidas deben desaparecer automáticamente del feed activo."
  // Rule 3: Publicaciones suspendidas o en revisión quedan automáticamente fuera del feed activo
  // Todos los anuncios se mantienen visibles y persistentes hasta que el usuario o comercio decida borrarlos
  const isPostActive = (post: Post): boolean => {
    if (!post || !post.id) return false;
    if (
      post.status === 'suspended' ||
      post.suspended ||
      (post as any).status === 'deleted'
    ) {
      return false; // Excluido por moderación o si fue borrado
    }

    // Verificar comercio si está explícitamente suspendido
    const parentBiz = businesses.find((b) => b.id === post.businessId);
    if (parentBiz && parentBiz.status === 'suspended') return false;

    return true;
  };

  // Track Lead / Action Analytics
  const trackInteraction = (postId: string, type: 'view' | 'whatsapp' | 'maps' | 'call' | 'share') => {
    let targetBizId: string | undefined;
    const todayKey = getTodayKey();

    // 1. Update Post metric
    setPosts((prevPosts) => {
      const nextPosts = prevPosts.map((post) => {
        if (post.id !== postId) return post;
        targetBizId = post.businessId;
        const currentMetrics = post.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
        const currentDaily = currentMetrics.dailyMetrics || {};
        const dayRecord: DailyMetricRecord = currentDaily[todayKey] || {
          views: 0,
          whatsappClicks: 0,
          mapsClicks: 0,
          calls: 0,
          shares: 0,
        };

        const updatedDayRecord: DailyMetricRecord = {
          views: type === 'view' ? (dayRecord.views || 0) + 1 : (dayRecord.views || 0),
          whatsappClicks: type === 'whatsapp' ? (dayRecord.whatsappClicks || 0) + 1 : (dayRecord.whatsappClicks || 0),
          mapsClicks: type === 'maps' ? (dayRecord.mapsClicks || 0) + 1 : (dayRecord.mapsClicks || 0),
          calls: type === 'call' ? (dayRecord.calls || 0) + 1 : (dayRecord.calls || 0),
          shares: type === 'share' ? (dayRecord.shares || 0) + 1 : (dayRecord.shares || 0),
        };

        return {
          ...post,
          metrics: {
            ...currentMetrics,
            views: type === 'view' ? currentMetrics.views + 1 : currentMetrics.views,
            whatsappClicks: type === 'whatsapp' ? currentMetrics.whatsappClicks + 1 : currentMetrics.whatsappClicks,
            mapsClicks: type === 'maps' ? currentMetrics.mapsClicks + 1 : currentMetrics.mapsClicks,
            calls: type === 'call' ? currentMetrics.calls + 1 : currentMetrics.calls,
            shares: type === 'share' ? currentMetrics.shares + 1 : currentMetrics.shares,
            dailyMetrics: {
              ...currentDaily,
              [todayKey]: updatedDayRecord,
            },
          },
        };
      });

      // 2. Immediately synchronize target business metrics to match the exact updated sum of its posts
      if (targetBizId) {
        const bId = targetBizId;
        const bizPosts = nextPosts.filter((p) => p.businessId === bId);
        const aggregatedDaily: Record<string, DailyMetricRecord> = {};
        bizPosts.forEach((p) => {
          if (p.metrics?.dailyMetrics) {
            Object.entries(p.metrics.dailyMetrics).forEach(([dateKey, mVal]) => {
              const dayM = mVal as DailyMetricRecord;
              if (!aggregatedDaily[dateKey]) {
                aggregatedDaily[dateKey] = { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
              }
              aggregatedDaily[dateKey].views += dayM.views || 0;
              aggregatedDaily[dateKey].whatsappClicks += dayM.whatsappClicks || 0;
              aggregatedDaily[dateKey].mapsClicks += dayM.mapsClicks || 0;
              aggregatedDaily[dateKey].calls += dayM.calls || 0;
              aggregatedDaily[dateKey].shares += dayM.shares || 0;
            });
          }
        });

        setBusinesses((prevBizs) =>
          prevBizs.map((biz) => {
            if (biz.id !== bId) return biz;
            return {
              ...biz,
              metrics: {
                views: bizPosts.reduce((acc, p) => acc + (p.metrics?.views || 0), 0),
                whatsappClicks: bizPosts.reduce((acc, p) => acc + (p.metrics?.whatsappClicks || 0), 0),
                mapsClicks: bizPosts.reduce((acc, p) => acc + (p.metrics?.mapsClicks || 0), 0),
                calls: bizPosts.reduce((acc, p) => acc + (p.metrics?.calls || 0), 0),
                shares: bizPosts.reduce((acc, p) => acc + (p.metrics?.shares || 0), 0),
                dailyMetrics: aggregatedDaily,
              },
            };
          })
        );
      }

      return nextPosts;
    });
  };

  // Redeem in-store customer QR code
  const redeemPostQR = (
    codeOrPayload: string,
    businessId: string
  ): { success: boolean; message: string; post?: Post; code?: string } => {
    let parsedPostId: string | null = null;
    let extractedCode = (codeOrPayload || '').trim();

    // 1. Try parsing JSON if payload is from QR scanner
    try {
      if (extractedCode.startsWith('{') && extractedCode.endsWith('}')) {
        const parsed = JSON.parse(extractedCode);
        if (parsed.postId) parsedPostId = parsed.postId;
        if (parsed.code) extractedCode = parsed.code;
      }
    } catch {
      // not json, continue with raw string
    }

    // 2. Find matching post
    const targetPost = posts.find((p) => {
      if (parsedPostId && p.id === parsedPostId) return true;
      const cleanId = p.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
      if (extractedCode.toUpperCase().includes(cleanId)) return true;
      if (p.id.toUpperCase() === extractedCode.toUpperCase()) return true;
      return false;
    });

    if (!targetPost) {
      return {
        success: false,
        message: `Código no reconocido (${extractedCode}). Verifica que pertenezca a una publicación válida.`,
      };
    }

    // 3. Verify that post belongs to the merchant
    if (businessId && targetPost.businessId !== businessId) {
      return {
        success: false,
        message: `Este código QR pertenece a otra publicación o comercio ajeno (${targetPost.businessName || 'otro negocio'}).`,
      };
    }

    const todayKey = getTodayKey();
    const updatedPostId = targetPost.id;
    let updatedTargetPost: Post = targetPost;

    // 4. Increment QR redemptions on Post & Business
    setPosts((prevPosts) => {
      const nextPosts = prevPosts.map((post) => {
        if (post.id !== updatedPostId) return post;
        const currentMetrics = post.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0, qrRedemptions: 0 };
        const currentDaily = currentMetrics.dailyMetrics || {};
        const dayRecord: DailyMetricRecord = currentDaily[todayKey] || {
          views: 0,
          whatsappClicks: 0,
          mapsClicks: 0,
          calls: 0,
          shares: 0,
          qrRedemptions: 0,
        };

        const updatedDayRecord: DailyMetricRecord = {
          ...dayRecord,
          qrRedemptions: (dayRecord.qrRedemptions || 0) + 1,
        };

        const updated: Post = {
          ...post,
          metrics: {
            ...currentMetrics,
            qrRedemptions: (currentMetrics.qrRedemptions || 0) + 1,
            dailyMetrics: {
              ...currentDaily,
              [todayKey]: updatedDayRecord,
            },
          },
        };
        updatedTargetPost = updated;
        return updated;
      });

      // Synchronize business metrics
      const bId = targetPost.businessId;
      const bizPosts = nextPosts.filter((p) => p.businessId === bId);
      const aggregatedDaily: Record<string, DailyMetricRecord> = {};
      bizPosts.forEach((p) => {
        if (p.metrics?.dailyMetrics) {
          Object.entries(p.metrics.dailyMetrics).forEach(([dateKey, mVal]) => {
            const dayM = mVal as DailyMetricRecord;
            if (!aggregatedDaily[dateKey]) {
              aggregatedDaily[dateKey] = { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0, qrRedemptions: 0 };
            }
            aggregatedDaily[dateKey].views = (aggregatedDaily[dateKey].views || 0) + (dayM.views || 0);
            aggregatedDaily[dateKey].whatsappClicks = (aggregatedDaily[dateKey].whatsappClicks || 0) + (dayM.whatsappClicks || 0);
            aggregatedDaily[dateKey].mapsClicks = (aggregatedDaily[dateKey].mapsClicks || 0) + (dayM.mapsClicks || 0);
            aggregatedDaily[dateKey].calls = (aggregatedDaily[dateKey].calls || 0) + (dayM.calls || 0);
            aggregatedDaily[dateKey].shares = (aggregatedDaily[dateKey].shares || 0) + (dayM.shares || 0);
            aggregatedDaily[dateKey].qrRedemptions = (aggregatedDaily[dateKey].qrRedemptions || 0) + (dayM.qrRedemptions || 0);
          });
        }
      });

      setBusinesses((prevBizs) =>
        prevBizs.map((biz) => {
          if (biz.id !== bId) return biz;
          return {
            ...biz,
            metrics: {
              ...biz.metrics,
              qrRedemptions: bizPosts.reduce((acc, p) => acc + (p.metrics?.qrRedemptions || 0), 0),
              dailyMetrics: aggregatedDaily,
            },
          };
        })
      );

      return nextPosts;
    });

    return {
      success: true,
      message: `¡Cliente validado con éxito para "${targetPost.title}"! Se registró +1 cliente real adquirido con QR.`,
      post: updatedTargetPost,
      code: extractedCode,
    };
  };

  // Fetch latest server posts and businesses on mount to ensure cross-session persistence
  useEffect(() => {
    fetch('/api/posts')
      .then((res) => res.json())
      .then((serverPosts) => {
        if (Array.isArray(serverPosts) && serverPosts.length > 0) {
          setPosts((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            serverPosts.forEach((sp) => {
              if (sp?.id) {
                const existing = map.get(sp.id);
                let mergedPost = Object.assign({}, existing, sp) as Post;
                if (mergedPost.id === 'post_1791221143310_zvu6i' || mergedPost.title?.toLowerCase().includes('volley')) {
                  mergedPost.imageUrl = '/uploads/cover_volley.jpg';
                  mergedPost.aspectRatio = '9:16';
                }
                if (mergedPost.id === 'post_1791231179361_xngwj' || mergedPost.title?.toLowerCase().includes('nuevo servicio')) {
                  mergedPost.imageUrl = '/uploads/cover_nuevo_servicio.jpg';
                  mergedPost.aspectRatio = '9:16';
                }
                if (mergedPost.id === 'post_1791236006956_ih5xg' || mergedPost.title?.toLowerCase().includes('cafe sello rojo')) {
                  mergedPost.imageUrl = '/uploads/cover_cafe_sello_rojo.jpg';
                  mergedPost.aspectRatio = '9:16';
                }
                mergedPost.aspectRatio = '9:16';
                map.set(sp.id, mergedPost);
              }
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});

    fetch('/api/businesses')
      .then((res) => res.json())
      .then((serverBiz) => {
        if (Array.isArray(serverBiz) && serverBiz.length > 0) {
          setBusinesses((prev) => {
            const map = new Map(prev.map((b) => [b.id, b]));
            serverBiz.forEach((sb) => {
              if (sb?.id) {
                const existing = map.get(sb.id);
                map.set(sb.id, Object.assign({}, existing, sb) as Business);
              }
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});

    fetch('/api/plans')
      .then((res) => res.json())
      .then((serverPlans) => {
        if (Array.isArray(serverPlans) && serverPlans.length > 0) {
          setReadyPlans((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            serverPlans.forEach((sp: SimulatedReadyPlan) => {
              if (sp?.id) {
                const existing = map.get(sp.id);
                map.set(sp.id, Object.assign({}, existing, sp));
              }
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
  }, []);

  // Synchronize business metrics with their posts on mount and whenever posts change
  useEffect(() => {
    if (posts.length > 0 && businesses.length > 0) {
      setBusinesses((prevBizs) => {
        let changed = false;
        const updated = prevBizs.map((biz) => {
          const bizPosts = posts.filter((p) => p.businessId === biz.id);
          if (bizPosts.length === 0) return biz;
          const currentM = biz.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
          const sViews = bizPosts.reduce((acc, p) => acc + (p.metrics?.views || 0), 0);
          const sWa = bizPosts.reduce((acc, p) => acc + (p.metrics?.whatsappClicks || 0), 0);
          const sMaps = bizPosts.reduce((acc, p) => acc + (p.metrics?.mapsClicks || 0), 0);
          const sCalls = bizPosts.reduce((acc, p) => acc + (p.metrics?.calls || 0), 0);
          const sShares = bizPosts.reduce((acc, p) => acc + (p.metrics?.shares || 0), 0);

          const aggregatedDaily: Record<string, DailyMetricRecord> = {};
          bizPosts.forEach((p) => {
            if (p.metrics?.dailyMetrics) {
              Object.entries(p.metrics.dailyMetrics).forEach(([dateKey, mVal]) => {
                const dayM = mVal as DailyMetricRecord;
                if (!aggregatedDaily[dateKey]) {
                  aggregatedDaily[dateKey] = { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
                }
                aggregatedDaily[dateKey].views += dayM.views || 0;
                aggregatedDaily[dateKey].whatsappClicks += dayM.whatsappClicks || 0;
                aggregatedDaily[dateKey].mapsClicks += dayM.mapsClicks || 0;
                aggregatedDaily[dateKey].calls += dayM.calls || 0;
                aggregatedDaily[dateKey].shares += dayM.shares || 0;
              });
            }
          });

          if (
            currentM.views !== sViews ||
            currentM.whatsappClicks !== sWa ||
            currentM.mapsClicks !== sMaps ||
            currentM.calls !== sCalls ||
            currentM.shares !== sShares ||
            !currentM.dailyMetrics ||
            Object.keys(currentM.dailyMetrics).length !== Object.keys(aggregatedDaily).length
          ) {
            changed = true;
            return {
              ...biz,
              metrics: {
                views: sViews,
                whatsappClicks: sWa,
                mapsClicks: sMaps,
                calls: sCalls,
                shares: sShares,
                dailyMetrics: aggregatedDaily,
              },
            };
          }
          return biz;
        });
        return changed ? updated : prevBizs;
      });
    }
  }, [posts]);

  // Synchronize active posts and businesses with server in-memory store for WhatsApp Open Graph unfurl
  const lastSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (posts.length > 0) {
      if (lastSyncTimerRef.current) clearTimeout(lastSyncTimerRef.current);
      lastSyncTimerRef.current = setTimeout(() => {
        fetch('/api/posts/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posts, businesses }),
        }).catch(() => {});
      }, 500);
    }
    return () => {
      if (lastSyncTimerRef.current) clearTimeout(lastSyncTimerRef.current);
    };
  }, [posts.length, businesses.length]);

  // Track Direct Business Profile Interactions (WhatsApp, Maps, Calls)
  const trackBusinessInteraction = (businessId: string, type: 'view' | 'whatsapp' | 'maps' | 'call' | 'share') => {
    const todayKey = getTodayKey();
    setBusinesses((prev) =>
      prev.map((biz) => {
        if (biz.id !== businessId) return biz;
        const currentMetrics = biz.metrics || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
        const currentDaily = currentMetrics.dailyMetrics || {};
        const dayRecord = currentDaily[todayKey] || { views: 0, whatsappClicks: 0, mapsClicks: 0, calls: 0, shares: 0 };
        const updatedDayRecord: DailyMetricRecord = {
          views: type === 'view' ? (dayRecord.views || 0) + 1 : (dayRecord.views || 0),
          whatsappClicks: type === 'whatsapp' ? (dayRecord.whatsappClicks || 0) + 1 : (dayRecord.whatsappClicks || 0),
          mapsClicks: type === 'maps' ? (dayRecord.mapsClicks || 0) + 1 : (dayRecord.mapsClicks || 0),
          calls: type === 'call' ? (dayRecord.calls || 0) + 1 : (dayRecord.calls || 0),
          shares: type === 'share' ? (dayRecord.shares || 0) + 1 : (dayRecord.shares || 0),
        };
        return {
          ...biz,
          metrics: {
            ...currentMetrics,
            views: type === 'view' ? currentMetrics.views + 1 : currentMetrics.views,
            whatsappClicks: type === 'whatsapp' ? (currentMetrics.whatsappClicks || 0) + 1 : currentMetrics.whatsappClicks,
            mapsClicks: type === 'maps' ? (currentMetrics.mapsClicks || 0) + 1 : currentMetrics.mapsClicks,
            calls: type === 'call' ? (currentMetrics.calls || 0) + 1 : currentMetrics.calls,
            shares: type === 'share' ? (currentMetrics.shares || 0) + 1 : currentMetrics.shares,
            dailyMetrics: {
              ...currentDaily,
              [todayKey]: updatedDayRecord,
            },
          },
        };
      })
    );
  };

  const toggleFavorite = (postId: string) => {
    setFavorites((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  };

  const isFavorite = (postId: string) => favorites.includes(postId);

  const togglePostFeatured = (postId: string) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, featured: !post.featured } : post))
    );
  };

  // Rule: "Un negocio sin suscripción activa no puede publicar nuevas publicaciones."
  const createPost = (
    postData: Omit<Post, 'id' | 'createdAt' | 'metrics'>
  ): { success: boolean; error?: string; post?: Post } => {
    const parentBiz = businesses.find((b) => b.id === postData.businessId);
    if (!parentBiz) {
      return { success: false, error: 'Negocio no encontrado.' };
    }

    if (parentBiz.status === 'suspended') {
      return {
        success: false,
        error: `Tu comercio está suspendido por moderación: "${parentBiz.suspensionReason || 'Incumplimiento de políticas'}". No puedes crear publicaciones mientras continúe la suspensión.`,
      };
    }

    if (parentBiz.subscription.status !== 'active' && parentBiz.subscription.status !== 'trial') {
      return {
        success: false,
        error: 'Tu suscripción está inactiva o vencida. Renueva tu plan de $29.900 COP para publicar ilimitadamente.',
      };
    }

    const todayKey = getTodayKey();
    const newPost: Post = {
      ...postData,
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
      metrics: {
        views: 1,
        whatsappClicks: 0,
        mapsClicks: 0,
        calls: 0,
        shares: 0,
        dailyMetrics: {
          [todayKey]: {
            views: 1,
            whatsappClicks: 0,
            mapsClicks: 0,
            calls: 0,
            shares: 0,
          },
        },
      },
    };

    setPosts((prev) => [newPost, ...prev]);

    if (isSupabaseConfigured) {
      savePostToSupabase(newPost).catch((err) => {
        console.warn('Error guardando publicación en Supabase:', err);
      });
    }

    // Send push notification simulation
    simulatePushNotification(
      `¡Nueva ${postData.type === 'promotion' ? 'promoción' : postData.type === 'event' ? 'plan' : 'novedad'} cerca de ti!`,
      `${postData.businessName}: ${postData.title}`
    );

    return { success: true, post: newPost };
  };

  const updatePost = (postId: string, data: Partial<Post>) => {
    let updatedPostToSave: Post | null = null;
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          const updated = { ...post, ...data };
          updatedPostToSave = updated;
          return updated;
        }
        return post;
      })
    );
    if (updatedPostToSave && isSupabaseConfigured) {
      savePostToSupabase(updatedPostToSave).catch((err) => {
        console.warn('Error sincronizando actualizacion de publicacion en Supabase:', err);
      });
    }
  };

  const deletePost = (postId: string) => {
    addDeletedPostId(postId);
    if (isSupabaseConfigured) {
      deletePostFromSupabase(postId).catch((err) => {
        console.warn('Error eliminando publicacion de Supabase:', err);
      });
    }
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  };

  const suspendPost = (postId: string, reason: string, presetReason?: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const trimmedReason = reason.trim() || 'No cumple con las políticas de contenido y publicación de la plataforma.';
    const nowIso = new Date().toISOString();

    const prevSuspensionCount = (post.suspensionHistory || []).filter((e) => e.type === 'suspension').length;
    const incidentNumber = prevSuspensionCount + 1;
    const isRepeat = incidentNumber > 1;

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'suspension',
      title: isRepeat
        ? `Suspensión de Publicación (Reincidencia #${incidentNumber})`
        : 'Suspensión de Publicación (1ª Falta)',
      note: trimmedReason,
      timestamp: nowIso,
      authorRole: 'admin',
      authorName: 'Administración OleVeci',
      badge: isRepeat ? `Reincidencia #${incidentNumber}` : '1ª Suspensión',
      incidentNumber,
      reasonPreset: presetReason,
    };

    // 1. Mark post as suspended and save history entry
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              status: 'suspended' as const,
              suspended: true,
              suspensionReason: trimmedReason,
              suspendedAt: nowIso,
              suspensionHistory: [...(p.suspensionHistory || []), newEntry],
            }
          : p
      )
    );

    // 2. Dispatch a notification for the business/client
    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId: post.businessId,
      type: 'post_suspended',
      title: 'Publicación suspendida por políticas',
      message: `Tu publicación "${post.title}" fue suspendida por moderación: "${trimmedReason}". Por favor corrígela desde la sección de Mi Negocio para reactivarla.`,
      postId: post.id,
      postTitle: post.title,
      reason: trimmedReason,
      createdAt: nowIso,
      read: false,
    };

    setBusinessNotifications((prev) => [newNotif, ...prev]);

    // 3. Trigger immediate notification toast
    simulatePushNotification(
      '⚠️ Publicación Suspendida',
      `"${post.title}" suspendida: ${trimmedReason}`
    );
  };

  const reactivatePost = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const nowIso = new Date().toISOString();

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'reactivation',
      title: 'Publicación Reactivada por Administrador',
      note: 'El administrador ha reactivado la publicación directamente en la plataforma.',
      timestamp: nowIso,
      authorRole: 'admin',
      authorName: 'Administración OleVeci',
      badge: 'Reactivada',
    };

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              status: 'active' as const,
              suspended: false,
              suspensionReason: undefined,
              suspendedAt: undefined,
              reviewStatus: 'approved' as const,
              rejectionReason: undefined,
              lastReviewedAt: nowIso,
              suspensionHistory: [...(p.suspensionHistory || []), newEntry],
            }
          : p
      )
    );

    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId: post.businessId,
      type: 'post_reactivated',
      title: 'Publicación reactivada',
      message: `Tu publicación "${post.title}" ha sido reactivada exitosamente y ya se encuentra visible en el feed.`,
      postId: post.id,
      postTitle: post.title,
      createdAt: nowIso,
      read: false,
    };

    setBusinessNotifications((prev) => [newNotif, ...prev]);

    simulatePushNotification(
      '✅ Publicación Reactivada',
      `"${post.title}" ya está activa y visible en el feed.`
    );
  };

  // Workflow: Cuando el usuario/comercio envía la corrección de una publicación suspendida
  const submitPostCorrection = (postId: string, data: Partial<Post>, note?: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const nowIso = new Date().toISOString();
    const cleanNote = note?.trim() || undefined;

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'review_request',
      title: 'Solicitud de Revisión tras Corrección',
      note: cleanNote || 'El comercio ha editado el contenido de la publicación y solicitado su reevaluación.',
      timestamp: nowIso,
      authorRole: 'business',
      authorName: data.title || post.title || post.businessName,
      badge: 'Corrección del Comercio',
    };

    // 1. Guardar cambios y colocar la publicación en estado 'pending_review'
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          ...data,
          status: 'pending_review' as const,
          suspended: false,
          reviewStatus: 'pending' as const,
          reviewRequestedAt: nowIso,
          correctionNote: cleanNote,
          suspensionHistory: [...(p.suspensionHistory || []), newEntry],
        };
      })
    );

    // 2. Limpiar las notificaciones de suspensión y rechazo de esta publicación para que no queden pegadas
    const cleanedNotifs = businessNotifications.filter(
      (n) => !(n.postId === postId && (n.type === 'post_suspended' || n.type === 'post_rejected'))
    );

    // 3. Confirmación en el registro de avisos del negocio (ya leída para no inflar la campana)
    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId: post.businessId,
      type: 'review_requested',
      title: 'Corrección enviada a revisión',
      message: `Tu corrección para "${data.title || post.title}" fue enviada exitosamente al administrador. Te notificaremos en cuanto sea aprobada.`,
      postId: post.id,
      postTitle: data.title || post.title,
      createdAt: nowIso,
      read: true,
    };

    setBusinessNotifications([newNotif, ...cleanedNotifs]);

    // 4. Notificación push/toast informativa
    simulatePushNotification(
      '📩 Solicitud de Revisión Enviada',
      `La corrección de "${data.title || post.title}" está en cola de revisión del administrador.`
    );
  };

  // Workflow: Cuando el administrador aprueba la corrección de una publicación suspendida
  const approvePostReview = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const nowIso = new Date().toISOString();

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'reactivation',
      title: 'Corrección Aprobada y Publicación Reactivada',
      note: 'El administrador aprobó las correcciones de la publicación. Vuelve a estar activa en el feed.',
      timestamp: nowIso,
      authorRole: 'admin',
      authorName: 'Administración OleVeci',
      badge: 'Aprobado y Activo',
    };

    // 1. Activar la publicación y limpiar suspensiones
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          status: 'active' as const,
          suspended: false,
          suspensionReason: undefined,
          suspendedAt: undefined,
          reviewStatus: 'approved' as const,
          rejectionReason: undefined,
          lastReviewedAt: nowIso,
          suspensionHistory: [...(p.suspensionHistory || []), newEntry],
        };
      })
    );

    // 2. Notificar al usuario/comercio que la publicación fue aprobada y está activa
    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId: post.businessId,
      type: 'post_approved',
      title: '¡Publicación aprobada y activa!',
      message: `¡Buenas noticias! El administrador aprobó las correcciones de tu publicación "${post.title}". Ya está activa y visible para toda la comunidad en el feed.`,
      postId: post.id,
      postTitle: post.title,
      createdAt: nowIso,
      read: false,
    };

    setBusinessNotifications((prev) => [newNotif, ...prev]);

    // 3. Toast / Push al usuario
    simulatePushNotification(
      '✅ Publicación Aprobada',
      `"${post.title}" fue aprobada por el administrador y ya está activa en el feed.`
    );
  };

  // Workflow: Cuando el administrador rechaza nuevamente la publicación corregida
  const rejectPostReview = (postId: string, reason: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const nowIso = new Date().toISOString();
    const trimmedReason = reason.trim() || 'Aún no cumple con las políticas y normas de la plataforma.';

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'review_rejection',
      title: 'Corrección Rechazada',
      note: trimmedReason,
      timestamp: nowIso,
      authorRole: 'admin',
      authorName: 'Administración OleVeci',
      badge: 'Observación del Admin',
    };

    // 1. Devolver a suspendida con nuevo motivo y estado rechazado
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          status: 'suspended' as const,
          suspended: true,
          suspensionReason: trimmedReason,
          suspendedAt: nowIso,
          reviewStatus: 'rejected' as const,
          rejectionReason: trimmedReason,
          lastReviewedAt: nowIso,
          suspensionHistory: [...(p.suspensionHistory || []), newEntry],
        };
      })
    );

    // 2. Notificar al usuario/comercio con el nuevo motivo de rechazo
    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId: post.businessId,
      type: 'post_rejected',
      title: 'Corrección rechazada por el administrador',
      message: `Tu publicación "${post.title}" fue revisada pero fue rechazada nuevamente: "${trimmedReason}". Por favor realiza los ajustes solicitados para volver a enviarla.`,
      postId: post.id,
      postTitle: post.title,
      reason: trimmedReason,
      createdAt: nowIso,
      read: false,
    };

    setBusinessNotifications((prev) => [newNotif, ...prev]);

    // 3. Toast / Push alert
    simulatePushNotification(
      '❌ Corrección Rechazada',
      `"${post.title}" requiere nuevos ajustes: ${trimmedReason}`
    );
  };

  const markBusinessNotificationAsRead = (notificationId: string) => {
    setBusinessNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const deleteBusinessNotification = (notificationId: string) => {
    setBusinessNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const clearBusinessNotifications = (businessId: string) => {
    setBusinessNotifications((prev) => prev.filter((n) => n.businessId !== businessId));
  };

  const updateBusiness = (businessId: string, data: Partial<Business>) => {
    let updatedBizToSave: Business | null = null;
    setBusinesses((prev) =>
      prev.map((biz) => {
        if (biz.id === businessId) {
          const updated = { ...biz, ...data };
          updatedBizToSave = updated;
          return updated;
        }
        return biz;
      })
    );
    if (updatedBizToSave && isSupabaseConfigured) {
      saveBusinessToSupabase(updatedBizToSave).catch((err) => {
        console.warn('Error sincronizando comercio en Supabase:', err);
      });
    }
    if (
      data.name !== undefined ||
      data.logo !== undefined ||
      data.whatsapp !== undefined ||
      data.phone !== undefined ||
      data.address !== undefined ||
      data.city !== undefined ||
      data.sector !== undefined ||
      data.coordinates !== undefined
    ) {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.businessId !== businessId) return p;
          return {
            ...p,
            businessName: data.name ?? p.businessName,
            businessLogo: data.logo ?? p.businessLogo,
            businessWhatsapp: data.whatsapp ?? p.businessWhatsapp,
            businessPhone: data.phone ?? p.businessPhone,
            businessAddress: data.address ?? p.businessAddress,
            businessCity: data.city ?? p.businessCity,
            businessSector: data.sector ?? p.businessSector,
            coordinates: data.coordinates ?? p.coordinates,
          };
        })
      );
    }
  };

  const suspendBusiness = (businessId: string, reason: string, presetReason?: string) => {
    const biz = businesses.find((b) => b.id === businessId);
    if (!biz) return;

    const trimmedReason = reason.trim() || 'Incumplimiento de términos y normas de la plataforma.';
    const nowIso = new Date().toISOString();

    const prevSuspensionCount = (biz.suspensionHistory || []).filter((e) => e.type === 'suspension').length;
    const incidentNumber = prevSuspensionCount + 1;
    const isRepeat = incidentNumber > 1;

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'suspension',
      title: isRepeat
        ? `Suspensión del Comercio (Reincidencia #${incidentNumber})`
        : 'Suspensión del Comercio (1ª Falta)',
      note: trimmedReason,
      timestamp: nowIso,
      authorRole: 'admin',
      authorName: 'Administración OleVeci',
      badge: isRepeat ? `Reincidencia #${incidentNumber}` : '1ª Suspensión',
      incidentNumber,
      reasonPreset: presetReason,
    };

    setBusinesses((prev) =>
      prev.map((b) =>
        b.id === businessId
          ? {
              ...b,
              status: 'suspended' as const,
              suspensionReason: trimmedReason,
              suspendedAt: nowIso,
              suspensionHistory: [...(b.suspensionHistory || []), newEntry],
            }
          : b
      )
    );

    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId: biz.id,
      type: 'business_suspended',
      title: 'Comercio suspendido por políticas',
      message: `Tu comercio "${biz.name}" ha sido suspendido: "${trimmedReason}". Tus publicaciones han sido pausadas en el feed. Ingresa a Mi Negocio para enviar tus correcciones y solicitar reactivación.`,
      reason: trimmedReason,
      createdAt: nowIso,
      read: false,
    };

    setBusinessNotifications((prev) => [newNotif, ...prev]);

    simulatePushNotification(
      '⚠️ Comercio Suspendido',
      `"${biz.name}" suspendido por políticas: ${trimmedReason}`
    );
  };

  const reactivateBusiness = (businessId: string) => {
    const biz = businesses.find((b) => b.id === businessId);
    if (!biz) return;

    const nowIso = new Date().toISOString();

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'reactivation',
      title: 'Comercio Reactivado por Administrador',
      note: 'El administrador ha reactivado el comercio directamente en la plataforma.',
      timestamp: nowIso,
      authorRole: 'admin',
      authorName: 'Administración OleVeci',
      badge: 'Reactivado',
    };

    setBusinesses((prev) =>
      prev.map((b) =>
        b.id === businessId
          ? {
              ...b,
              status: 'active' as const,
              suspensionReason: undefined,
              suspendedAt: undefined,
              reviewStatus: 'approved' as const,
              rejectionReason: undefined,
              correctionNote: undefined,
              lastReviewedAt: nowIso,
              suspensionHistory: [...(b.suspensionHistory || []), newEntry],
            }
          : b
      )
    );

    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId: biz.id,
      type: 'business_reactivated',
      title: 'Comercio reactivado',
      message: `¡Buenas noticias! Tu comercio "${biz.name}" ha sido reactivado exitosamente. Tus publicaciones válidas vuelven a estar visibles en el feed.`,
      createdAt: nowIso,
      read: false,
    };

    setBusinessNotifications((prev) => [newNotif, ...prev]);

    simulatePushNotification(
      '✅ Comercio Reactivado',
      `"${biz.name}" ha sido reactivado y ya está visible en la plataforma.`
    );
  };

  const submitBusinessCorrection = (
    businessId: string,
    data?: Partial<Business>,
    note?: string
  ) => {
    const biz = businesses.find((b) => b.id === businessId);
    if (!biz) return;

    const nowIso = new Date().toISOString();
    const cleanNote =
      note?.trim() ||
      'Se han actualizado los datos del comercio de acuerdo a las políticas de la plataforma.';

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'review_request',
      title: 'Solicitud de Revisión Enviada',
      note: cleanNote,
      timestamp: nowIso,
      authorRole: 'business',
      authorName: data?.name || biz.name,
      badge: 'Comentario del Cliente',
    };

    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id !== businessId) return b;
        return {
          ...b,
          ...(data || {}),
          status: 'pending_review' as const,
          reviewStatus: 'pending' as const,
          reviewRequestedAt: nowIso,
          lastCorrectionAt: nowIso,
          correctionNote: cleanNote,
          suspensionHistory: [...(b.suspensionHistory || []), newEntry],
        };
      })
    );

    if (
      data &&
      (data.name ||
        data.logo ||
        data.city ||
        data.sector ||
        data.address ||
        data.whatsapp ||
        data.phone ||
        data.coordinates)
    ) {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.businessId !== businessId) return p;
          return {
            ...p,
            businessName: data.name ?? p.businessName,
            businessCity: data.city ?? p.businessCity,
            businessSector: data.sector ?? p.businessSector,
            coordinates: data.coordinates ?? p.coordinates,
          };
        })
      );
    }

    const cleanedNotifs = businessNotifications.filter(
      (n) =>
        !(
          n.businessId === businessId &&
          (n.type === 'business_suspended' || n.type === 'business_rejected')
        )
    );

    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId,
      type: 'business_review_requested',
      title: 'Solicitud de revisión enviada',
      message: `Has solicitado la revisión de la moderación de "${
        data?.name || biz.name
      }". Tu caso está en cola de moderación del administrador.`,
      createdAt: nowIso,
      read: true,
    };

    setBusinessNotifications([newNotif, ...cleanedNotifs]);

    simulatePushNotification(
      '📩 Solicitud de Revisión Enviada',
      `La corrección de "${data?.name || biz.name}" está en cola de revisión del administrador.`
    );
  };

  const approveBusinessReview = (businessId: string) => {
    const biz = businesses.find((b) => b.id === businessId);
    if (!biz) return;

    const nowIso = new Date().toISOString();

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'reactivation',
      title: 'Corrección Aprobada y Comercio Reactivado',
      note: 'El administrador aprobó las justificaciones y correcciones. El comercio y sus publicaciones vuelven a estar activos en la plataforma.',
      timestamp: nowIso,
      authorRole: 'admin',
      authorName: 'Administración OleVeci',
      badge: 'Aprobado',
    };

    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id !== businessId) return b;
        return {
          ...b,
          status: 'active' as const,
          suspensionReason: undefined,
          suspendedAt: undefined,
          reviewStatus: 'approved' as const,
          correctionNote: undefined,
          rejectionReason: undefined,
          lastReviewedAt: nowIso,
          suspensionHistory: [...(b.suspensionHistory || []), newEntry],
        };
      })
    );

    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId,
      type: 'business_approved',
      title: '¡Comercio aprobado y reactivado!',
      message: `¡Buenas noticias! El administrador aprobó las correcciones de tu comercio "${biz.name}". Ya está activo y visible para toda la comunidad.`,
      createdAt: nowIso,
      read: false,
    };

    setBusinessNotifications((prev) => [newNotif, ...prev]);

    simulatePushNotification(
      '✅ Comercio Aprobado',
      `"${biz.name}" fue aprobado por el administrador y ya está activo en OleVeci.`
    );
  };

  const rejectBusinessReview = (businessId: string, reason: string) => {
    const biz = businesses.find((b) => b.id === businessId);
    if (!biz) return;

    const trimmedReason =
      reason.trim() ||
      'Las correcciones enviadas aún no cumplen con las políticas de la plataforma.';
    const nowIso = new Date().toISOString();

    const newEntry: SuspensionHistoryEntry = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'review_rejection',
      title: 'Corrección Rechazada',
      note: trimmedReason,
      timestamp: nowIso,
      authorRole: 'admin',
      authorName: 'Administración OleVeci',
      badge: 'Observación del Admin',
    };

    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id !== businessId) return b;
        return {
          ...b,
          status: 'suspended' as const,
          reviewStatus: 'rejected' as const,
          rejectionReason: trimmedReason,
          suspensionReason: trimmedReason,
          lastReviewedAt: nowIso,
          suspensionHistory: [...(b.suspensionHistory || []), newEntry],
        };
      })
    );

    const newNotif: BusinessNotification = {
      id: `bnotif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId,
      type: 'business_rejected',
      title: 'Corrección rechazada por el administrador',
      message: `Tu comercio "${biz.name}" fue revisado pero fue rechazado nuevamente: "${trimmedReason}". Por favor realiza los ajustes solicitados para volver a enviarlo.`,
      reason: trimmedReason,
      createdAt: nowIso,
      read: false,
    };

    setBusinessNotifications((prev) => [newNotif, ...prev]);

    simulatePushNotification(
      '❌ Corrección Rechazada',
      `"${biz.name}" requiere nuevos ajustes: ${trimmedReason}`
    );
  };

  const renewBusinessSubscription = (
    businessId: string,
    options?: {
      days?: number;
      planName?: string;
      priceCOP?: number;
      billingCycle?: 'monthly' | 'yearly';
      paymentRecord?: BusinessPaymentRecord;
    }
  ) => {
    const daysToAdd = options?.days ?? 30;
    const expiry = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
    setBusinesses((prev) =>
      prev.map((biz) => {
        if (biz.id !== businessId) return biz;
        const updatedPaymentHistory = options?.paymentRecord
          ? [options.paymentRecord, ...(biz.paymentHistory || [])]
          : biz.paymentHistory;
        return {
          ...biz,
          subscription: {
            ...biz.subscription,
            status: 'active',
            planName: options?.planName || biz.subscription.planName || 'Plan Mensual OleVeci',
            priceCOP: options?.priceCOP ?? biz.subscription.priceCOP ?? 29900,
            billingCycle: options?.billingCycle || biz.subscription.billingCycle || 'monthly',
            expiresAt: expiry,
          },
          paymentHistory: updatedPaymentHistory,
        };
      })
    );
  };

  // Push notification simulation
  const simulatePushNotification = (
    title = '🔥 ¡Promoción especial cerca de ti!',
    body = 'Hay una nueva oferta disponible cerca de ti. ¡Aprovéchala antes de que se agote!'
  ) => {
    // 1. In-app toast banner
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }

    setActiveToast({
      title,
      body,
      time: 'Ahora',
    });

    // Auto-dismiss after 6.5 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
      toastTimeoutRef.current = null;
    }, 6500);

    // 2. Real Web Notification API if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
        });
      } catch {
        // notification error
      }
    }
  };

  const dismissToast = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setActiveToast(null);
  };

  const loginAsBusiness = (businessId: string) => {
    setAuthenticatedBusinessId(businessId);
    setCurrentBusinessId(businessId);
    setCurrentRole('business');
  };

  const logoutBusiness = () => {
    setAuthenticatedBusinessId(null);
    setCurrentRole('explorer');
  };

  const addBusinessPaymentRecord = (businessId: string, record: BusinessPaymentRecord) => {
    setBusinesses((prev) =>
      prev.map((biz) => {
        if (biz.id !== businessId) return biz;
        const currentHistory = biz.paymentHistory || [];
        return {
          ...biz,
          paymentHistory: [record, ...currentHistory],
        };
      })
    );
  };

  const addBusiness = (
    businessData: Omit<Business, 'id' | 'createdAt' | 'metrics'>,
    billingInfo?: BusinessBillingInfo,
    paymentRecord?: BusinessPaymentRecord,
    initialPaymentHistory?: BusinessPaymentRecord[]
  ): Business => {
    const newId = `biz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const autoUsername = businessData.username || getNextConsecutiveUsername(businesses);
    const autoPassword = businessData.password || businessData.accessPassword || DEFAULT_PREDEFINED_PASSWORD;

    const baseHistory = initialPaymentHistory || businessData.paymentHistory || [];
    const finalHistory = paymentRecord ? [paymentRecord, ...baseHistory] : baseHistory;

    const newBiz: Business = {
      ...businessData,
      id: newId,
      slug: businessData.slug || businessData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      username: autoUsername,
      password: autoPassword,
      accessPassword: autoPassword,
      createdAt: new Date().toISOString(),
      metrics: {
        views: 0,
        whatsappClicks: 0,
        mapsClicks: 0,
        calls: 0,
        shares: 0,
      },
      billingInfo,
      paymentHistory: finalHistory,
    };

    setBusinesses((prev) => [newBiz, ...prev]);
    setAuthenticatedBusinessId(newId);
    setCurrentBusinessId(newId);
    setCurrentRole('business');

    simulatePushNotification(
      '🎉 ¡Nuevo negocio registrado en OleVeci!',
      `${newBiz.name} (Usuario: ${newBiz.username}) ha activado su suscripción en ${newBiz.city}.`
    );

    return newBiz;
  };

  const createBusinessDirect = (
    businessData: Omit<Business, 'id' | 'createdAt' | 'metrics'>
  ): Business => {
    const newId = `biz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const autoUsername = businessData.username || getNextConsecutiveUsername(businesses);
    const autoPassword = businessData.password || businessData.accessPassword || DEFAULT_PREDEFINED_PASSWORD;

    const newBiz: Business = {
      ...businessData,
      id: newId,
      slug: businessData.slug || businessData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      username: autoUsername,
      password: autoPassword,
      accessEmail: businessData.accessEmail || `${businessData.slug || newId}@oleveci.com`,
      accessPin: businessData.accessPin || '1234',
      accessPassword: autoPassword,
      ownerName: businessData.ownerName || 'Propietario / Gerente',
      ownerPhone: businessData.ownerPhone || businessData.phone || businessData.whatsapp,
      createdAt: new Date().toISOString(),
      metrics: {
        views: 0,
        whatsappClicks: 0,
        mapsClicks: 0,
        calls: 0,
        shares: 0,
      },
      billingInfo: businessData.billingInfo,
      paymentHistory: businessData.paymentHistory || [],
    };

    setBusinesses((prev) => [newBiz, ...prev]);
    if (isSupabaseConfigured) {
      saveBusinessToSupabase(newBiz).catch((err) => {
        console.warn('Error guardando comercio en Supabase:', err);
      });
    }
    return newBiz;
  };

  const deleteBusiness = (businessId: string) => {
    addDeletedBusinessId(businessId);
    if (isSupabaseConfigured) {
      deleteBusinessFromSupabase(businessId).catch((err) => {
        console.warn('Error eliminando comercio de Supabase:', err);
      });
    }
    setBusinesses((prev) => prev.filter((b) => b.id !== businessId));
    // CASCADE: Delete all posts belonging to this business and record their deletion
    posts.filter((p) => p.businessId === businessId).forEach((p) => addDeletedPostId(p.id));
    setPosts((prev) => prev.filter((p) => p.businessId !== businessId));

    if (authenticatedBusinessId === businessId) {
      setAuthenticatedBusinessId(null);
      setCurrentRole('explorer');
    }
    if (currentBusinessId === businessId) {
      const remaining = businesses.filter((b) => b.id !== businessId);
      setCurrentBusinessId(remaining[0]?.id || '');
    }
  };

  const updateBusinessCredentials = (
    businessId: string,
    credentials: {
      accessEmail?: string;
      accessPassword?: string;
      accessPin?: string;
      username?: string;
      password?: string;
      ownerName?: string;
      ownerPhone?: string;
    }
  ) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id !== businessId) return b;
        const finalPassword = credentials.password || credentials.accessPassword || b.password || DEFAULT_PREDEFINED_PASSWORD;
        return {
          ...b,
          ...credentials,
          password: finalPassword,
          accessPassword: finalPassword,
        };
      })
    );
  };

  const requestPasswordReset = (usernameOrEmail: string) => {
    const trimmed = usernameOrEmail.trim().toLowerCase();
    const found = businesses.find(
      (b) =>
        b.username?.toLowerCase() === trimmed ||
        b.email?.toLowerCase() === trimmed ||
        b.billingInfo?.email?.toLowerCase() === trimmed ||
        b.accessEmail?.toLowerCase() === trimmed
    );

    if (!found) {
      return {
        success: false,
        message: 'No se encontró ningún comercio con ese usuario o correo registrado.',
      };
    }

    const destinationEmail =
      found.email ||
      found.billingInfo?.email ||
      (found.id === 'biz_barber_camilo'
        ? 'contacto@doncamilobarber.com'
        : found.id === 'biz_brasa_burger'
        ? 'contacto@labrasaburger.com'
        : `${found.slug || found.id}@oleveci.com`);

    // Notificación en panel
    const newNotif: BusinessNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      businessId: found.id,
      title: '🔐 Solicitud de Restitución de Contraseña',
      message: `Se han generado y enviado las instrucciones de restitución para el usuario ${found.username || 'comercial'} al correo ${destinationEmail}.`,
      type: 'general',
      createdAt: new Date().toISOString(),
      read: false,
    };
    setBusinessNotifications((prev) => [newNotif, ...prev]);

    simulatePushNotification(
      '📧 Instrucciones de Restitución Enviadas',
      `Se enviaron instrucciones para ${found.username} a ${destinationEmail}.`
    );

    return {
      success: true,
      message: `Instrucciones enviadas con éxito a ${destinationEmail}.`,
      email: destinationEmail,
      username: found.username,
    };
  };

  // --- MUNICIPALITIES CRUD WITH CASCADE ---
  const addMunicipality = (muniData: Omit<Municipality, 'id'>): Municipality => {
    const id = `muni_${muniData.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;
    const newMuni: Municipality = { ...muniData, id };
    setMunicipalities((prev) => sortMunicipalities([...prev, newMuni]));
    return newMuni;
  };

  const updateMunicipality = (id: string, data: Partial<Municipality>) => {
    const oldMuni = municipalities.find((m) => m.id === id);
    if (!oldMuni) return;

    setMunicipalities((prev) =>
      sortMunicipalities(prev.map((m) => (m.id === id ? { ...m, ...data } : m)))
    );

    // CASCADE: If the municipality name changes, propagate everywhere
    if (data.name && data.name !== oldMuni.name) {
      const oldName = oldMuni.name;
      const newName = data.name;

      // 1. Update sectors
      setSectors((prev) =>
        prev.map((s) => (s.cityName.toLowerCase() === oldName.toLowerCase() ? { ...s, cityName: newName } : s))
      );

      // 2. Update businesses
      setBusinesses((prev) =>
        prev.map((b) => (b.city.toLowerCase() === oldName.toLowerCase() ? { ...b, city: newName } : b))
      );

      // 3. Update posts
      setPosts((prev) =>
        prev.map((p) => (p.businessCity?.toLowerCase() === oldName.toLowerCase() ? { ...p, businessCity: newName } : p))
      );

      // 4. Update current active city if it was this one
      if (currentCity.toLowerCase() === oldName.toLowerCase()) {
        setCurrentCityState(newName);
      }
    }
  };

  const deleteMunicipality = (id: string) => {
    const target = municipalities.find((m) => m.id === id);
    if (!target) return;
    const targetName = target.name;

    setMunicipalities((prev) => prev.filter((m) => m.id !== id));

    // Cascade delete sectors of this city
    setSectors((prev) => prev.filter((s) => s.cityName.toLowerCase() !== targetName.toLowerCase()));

    // Fallback current city if necessary
    if (currentCity.toLowerCase() === targetName.toLowerCase()) {
      const remaining = municipalities.filter((m) => m.id !== id);
      if (remaining.length > 0) {
        setCurrentCity(remaining[0].name);
      }
    }
  };

  // --- SECTORS CRUD WITH CASCADE ---
  const addSector = (sectorData: Omit<CitySector, 'id'>): CitySector => {
    const id = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newSector: CitySector = { ...sectorData, id };
    setSectors((prev) => sortSectors([...prev, newSector]));
    return newSector;
  };

  const updateSector = (id: string, data: Partial<CitySector>) => {
    const oldSector = sectors.find((s) => s.id === id);
    if (!oldSector) return;

    setSectors((prev) =>
      sortSectors(prev.map((s) => (s.id === id ? { ...s, ...data } : s)))
    );

    // CASCADE: If sector name changes, propagate to businesses and posts
    if (data.name && data.name !== oldSector.name) {
      const oldName = oldSector.name;
      const newName = data.name;
      const city = oldSector.cityName;

      setBusinesses((prev) =>
        prev.map((b) =>
          b.city.toLowerCase() === city.toLowerCase() && b.sector.toLowerCase() === oldName.toLowerCase()
            ? { ...b, sector: newName }
            : b
        )
      );

      setPosts((prev) =>
        prev.map((p) =>
          p.businessCity?.toLowerCase() === city.toLowerCase() && p.businessSector?.toLowerCase() === oldName.toLowerCase()
            ? { ...p, businessSector: newName }
            : p
        )
      );

      if (currentSector.toLowerCase() === oldName.toLowerCase()) {
        setCurrentSector(newName);
      }
    }
  };

  const deleteSector = (id: string) => {
    const target = sectors.find((s) => s.id === id);
    if (!target) return;
    setSectors((prev) => prev.filter((s) => s.id !== id));
    if (currentSector.toLowerCase() === target.name.toLowerCase()) {
      setCurrentSector('all');
    }
  };

  // --- CATEGORIES CRUD WITH CASCADE ---
  const addCategory = (catData: Omit<Category, 'id'>): Category => {
    const id = `cat_${catData.slug || catData.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;
    const newCat: Category = { ...catData, id };
    setCategories((prev) => sortCategories([...prev, newCat]));
    return newCat;
  };

  const updateCategory = (id: string, data: Partial<Category>) => {
    setCategories((prev) =>
      sortCategories(prev.map((c) => (c.id === id ? { ...c, ...data } : c)))
    );
  };

  const deleteCategory = (id: string) => {
    const remaining = categories.filter((c) => c.id !== id);
    const fallbackId = remaining[0]?.id || 'cat_otros';

    setCategories(remaining);

    // CASCADE: Update posts that had this category to fallback
    setPosts((prev) =>
      prev.map((p) => (p.categoryId === id ? { ...p, categoryId: fallbackId } : p))
    );

    // CASCADE: Update businesses that had this category to fallback
    setBusinesses((prev) =>
      prev.map((b) => (b.categoryId === id ? { ...b, categoryId: fallbackId } : b))
    );

    if (selectedCategory === id) {
      setSelectedCategory('all');
    }

    // CASCADE: remove category from planCategories allowedCategoryIds
    setPlanCategories((prev) =>
      prev.map((pc) => ({
        ...pc,
        allowedCategoryIds: pc.allowedCategoryIds.filter((cid) => cid !== id),
      }))
    );
  };

  // --- PLAN CATEGORIES CRUD (Tipos de Planes / Salidas) ---
  const addPlanCategory = (planCatData: Omit<PlanCategory, 'id'>): PlanCategory => {
    const id = `plan_${planCatData.slug || planCatData.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;
    const newPlanCat: PlanCategory = {
      ...planCatData,
      id,
      order: planCatData.order ?? (planCategories.length + 1),
      isActive: planCatData.isActive ?? true,
      maxMainDishes: planCatData.maxMainDishes ?? 1,
      preventDuplicateCategories: planCatData.preventDuplicateCategories ?? true,
    };
    setPlanCategories((prev) => sortPlanCategories([...prev, newPlanCat]));
    return newPlanCat;
  };

  const updatePlanCategory = (id: string, data: Partial<PlanCategory>) => {
    setPlanCategories((prev) =>
      sortPlanCategories(prev.map((pc) => (pc.id === id ? { ...pc, ...data } : pc)))
    );
  };

  const deletePlanCategory = (id: string) => {
    setPlanCategories((prev) => prev.filter((pc) => pc.id !== id));
  };

  const resetPlanCategoriesToDefault = () => {
    setPlanCategories(sortPlanCategories(INITIAL_PLAN_CATEGORIES));
    localStorage.removeItem(STORAGE_KEYS.PLAN_CATEGORIES);
  };

  // --- READY PLANS (ITINERARIOS LISTOS) CRUD ---
  const addReadyPlan = (plan: SimulatedReadyPlan) => {
    setReadyPlans((prev) => {
      const exists = prev.some((p) => p.id === plan.id);
      if (exists) {
        return prev.map((p) => (p.id === plan.id ? { ...p, ...plan } : p));
      }
      return [plan, ...prev];
    });

    if (isSupabaseConfigured) {
      saveReadyPlanToSupabase(plan).catch((err) => {
        console.warn('Error guardando itinerario en Supabase:', err);
      });
    }

    // Also persist plan to server for instant cross-device sharing via deep link
    fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    }).catch(() => {});
  };

  const updateReadyPlan = (id: string, data: Partial<SimulatedReadyPlan>) => {
    let updatedPlanToSave: SimulatedReadyPlan | null = null;
    setReadyPlans((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...data };
          updatedPlanToSave = updated;
          return updated;
        }
        return p;
      })
    );
    if (updatedPlanToSave && isSupabaseConfigured) {
      saveReadyPlanToSupabase(updatedPlanToSave).catch((err) => {
        console.warn('Error actualizando itinerario en Supabase:', err);
      });
    }
  };

  const deleteReadyPlan = (id: string) => {
    if (isSupabaseConfigured) {
      deleteReadyPlanFromSupabase(id).catch((err) => {
        console.warn('Error eliminando itinerario de Supabase:', err);
      });
    }
    setReadyPlans((prev) => prev.filter((p) => p.id !== id));
  };

  const resetReadyPlansToDefault = () => {
    setReadyPlans(READY_PLANS_SEED);
    localStorage.removeItem(STORAGE_KEYS.READY_PLANS);
  };

  // --- POST TYPES CRUD WITH CASCADE ---
  const addPostType = (ptData: Omit<PostTypeConfig, 'id'>): PostTypeConfig => {
    const id = ptData.slug || `type_${Date.now().toString(36)}`;
    const newPt: PostTypeConfig = { ...ptData, id };
    setPostTypes((prev) => sortPostTypes([...prev, newPt]));
    return newPt;
  };

  const updatePostType = (id: string, data: Partial<PostTypeConfig>) => {
    setPostTypes((prev) =>
      sortPostTypes(prev.map((pt) => (pt.id === id ? { ...pt, ...data } : pt)))
    );
  };

  const deletePostType = (id: string) => {
    const remaining = postTypes.filter((pt) => pt.id !== id);
    const fallback = remaining[0]?.id || 'promotion';

    setPostTypes(remaining);

    // CASCADE: Update posts of this type to fallback
    setPosts((prev) =>
      prev.map((p) => (p.type === id ? { ...p, type: fallback } : p))
    );

    if (activeFeedFilter === id) {
      setActiveFeedFilter('today');
    }
  };

  // --- PLAN ROLES (MOMENTOS DEL PLAN) CRUD ---
  const addPlanRole = (itemData: Omit<PlanRoleMaster, 'id'>): PlanRoleMaster => {
    const id = `role_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem: PlanRoleMaster = { ...itemData, id };
    setPlanRoles((prev) => [...prev, newItem]);
    return newItem;
  };

  const updatePlanRole = (id: string, data: Partial<PlanRoleMaster>) => {
    setPlanRoles((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
  };

  const deletePlanRole = (id: string) => {
    setPlanRoles((prev) => prev.filter((item) => item.id !== id));
  };

  const resetPlanRolesToDefault = () => {
    setPlanRoles(INITIAL_PLAN_ROLES);
    localStorage.removeItem(STORAGE_KEYS.PLAN_ROLES);
  };

  // --- TARGET AUDIENCES (PÚBLICO OBJETIVO) CRUD ---
  const addTargetAudience = (itemData: Omit<TargetAudienceMaster, 'id'>): TargetAudienceMaster => {
    const id = `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem: TargetAudienceMaster = { ...itemData, id };
    setTargetAudiences((prev) => [...prev, newItem]);
    return newItem;
  };

  const updateTargetAudience = (id: string, data: Partial<TargetAudienceMaster>) => {
    setTargetAudiences((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
  };

  const deleteTargetAudience = (id: string) => {
    setTargetAudiences((prev) => prev.filter((item) => item.id !== id));
  };

  const resetTargetAudiencesToDefault = () => {
    setTargetAudiences(INITIAL_TARGET_AUDIENCES);
    localStorage.removeItem(STORAGE_KEYS.TARGET_AUDIENCES);
  };

  // --- PRICE SCOPES (COBERTURA Y MODALIDAD DE PRECIO) CRUD ---
  const addPriceScope = (itemData: Omit<PriceScopeMaster, 'id'>): PriceScopeMaster => {
    const id = `scope_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem: PriceScopeMaster = { ...itemData, id };
    setPriceScopes((prev) => [...prev, newItem]);
    return newItem;
  };

  const updatePriceScope = (id: string, data: Partial<PriceScopeMaster>) => {
    setPriceScopes((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
  };

  const deletePriceScope = (id: string) => {
    setPriceScopes((prev) => prev.filter((item) => item.id !== id));
  };

  const resetPriceScopesToDefault = () => {
    setPriceScopes(INITIAL_PRICE_SCOPES);
    localStorage.removeItem(STORAGE_KEYS.PRICE_SCOPES);
  };

  const resetToInitialData = () => {
    setBusinesses(INITIAL_BUSINESSES.map(normalizeBusiness));
    setPosts(INITIAL_POSTS);
    setCategories(sortCategories(INITIAL_CATEGORIES));
    setMunicipalities(sortMunicipalities(INITIAL_MUNICIPALITIES));
    setSectors(sortSectors(INITIAL_SECTORS));
    setPostTypes(sortPostTypes(INITIAL_POST_TYPES));
    setPlanCategories(sortPlanCategories(INITIAL_PLAN_CATEGORIES));
    setPlanRoles(INITIAL_PLAN_ROLES);
    setTargetAudiences(INITIAL_TARGET_AUDIENCES);
    setPriceScopes(INITIAL_PRICE_SCOPES);
    setReadyPlans(READY_PLANS_SEED);
    setFavorites([]);
    setSelectedPlanType('all');
    setMaxPlanBudget(null);
    setAuthenticatedBusinessId(null);
    localStorage.removeItem(STORAGE_KEYS.BUSINESSES);
    localStorage.removeItem(STORAGE_KEYS.POSTS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.PLAN_CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.PLAN_ROLES);
    localStorage.removeItem(STORAGE_KEYS.TARGET_AUDIENCES);
    localStorage.removeItem(STORAGE_KEYS.PRICE_SCOPES);
    localStorage.removeItem(STORAGE_KEYS.READY_PLANS);
    localStorage.removeItem(STORAGE_KEYS.MUNICIPALITIES);
    localStorage.removeItem(STORAGE_KEYS.SECTORS);
    localStorage.removeItem(STORAGE_KEYS.POST_TYPES);
    localStorage.removeItem(STORAGE_KEYS.FAVORITES);
    localStorage.removeItem(STORAGE_KEYS.DELETED_BUSINESS_IDS);
    localStorage.removeItem(STORAGE_KEYS.DELETED_POST_IDS);
    localStorage.removeItem('oleveci_auth_biz_id');
  };

  // Filtered posts for the main feed according to all active criteria
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // 1. Post must be active (not expired & parent business must be active)
      if (!isPostActive(post)) {
        return false;
      }

      // 2. City filter
      if (currentCity && currentCity !== 'all') {
        if (post.businessCity && post.businessCity.toLowerCase() !== currentCity.toLowerCase()) {
          return false;
        }
      }

      // 3. Sector filter
      if (currentSector && currentSector !== 'all') {
        if (post.businessSector && post.businessSector.toLowerCase() !== currentSector.toLowerCase()) {
          return false;
        }
      }

      // 4. Category filter
      if (selectedCategory && selectedCategory !== 'all') {
        if (post.categoryId !== selectedCategory) {
          return false;
        }
      }

      // 5. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = post.title?.toLowerCase().includes(q);
        const matchesDesc = post.description?.toLowerCase().includes(q);
        const matchesBiz = post.businessName?.toLowerCase().includes(q);
        const matchesTags = post.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesBiz && !matchesTags) {
          return false;
        }
      }

      // 6. Feed tab sub-filter
      if (activeFeedFilter === 'all' || activeFeedFilter === 'today') {
        // show all active
      } else if (activeFeedFilter === 'favorites') {
        if (!favorites.includes(post.id)) return false;
      } else if (activeFeedFilter === 'nearby' || activeFeedFilter === 'near_me') {
        if (!post.coordinates) return false;
      } else if (activeFeedFilter === 'plans' || activeFeedFilter === 'itineraries') {
        const matchingPlans = filterReadyPlans(readyPlans, {
          selectedCategory,
          selectedPlanType,
          selectedCity: currentCity,
          selectedSector: currentSector,
          searchQuery,
          maxPlanBudget,
          posts,
        });
        const planPostIds = new Set(matchingPlans.flatMap((p) => p.postIds));
        const inPlan = planPostIds.has(post.id);
        const hasPlanTag = post.tags?.some((t) => t.toLowerCase().includes('plan') || t.toLowerCase().includes('ruta'));
        if (!inPlan && !hasPlanTag && post.type !== 'event') {
          return false;
        }
      } else {
        const normFilter = activeFeedFilter.endsWith('s') ? activeFeedFilter.slice(0, -1) : activeFeedFilter;
        const normPostType = post.type.endsWith('s') ? post.type.slice(0, -1) : post.type;
        if (
          post.type !== activeFeedFilter &&
          normPostType !== normFilter &&
          post.type !== normFilter
        ) {
          return false;
        }
      }

      // 7. Max budget filter for individual post
      if (maxPlanBudget !== null && maxPlanBudget > 0) {
        const price = post.promotionalPrice || post.originalPrice;
        if (price && price > maxPlanBudget) {
          return false;
        }
      }

      return true;
    });
  }, [
    posts,
    readyPlans,
    businesses,
    currentCity,
    currentSector,
    selectedCategory,
    searchQuery,
    selectedPlanType,
    maxPlanBudget,
    activeFeedFilter,
    favorites,
  ]);

  const contextValue = useMemo(() => ({
    businesses,
    posts,
    filteredPosts,
    categories,
    planCategories,
    sectors,
    municipalities,
    postTypes,
    planRoles,
    targetAudiences,
    priceScopes,
    currentCity,
    currentSector,
    selectedCategory,
    searchQuery,
    selectedPlanType,
    maxPlanBudget,
    feedFilter: activeFeedFilter,
    activeFeedFilter,
    currentRole,
    currentBusinessId,
    authenticatedBusinessId,
    userLocation,
    locationError,
    isLocationLoading,
    favorites,
    notificationPrefs,
    businessNotifications,
    activeToast,
    activeNotificationToast: activeToast,
    setCurrentCity,
    setCurrentSector,
    setSelectedCategory,
    setSearchQuery,
    setSelectedPlanType,
    setMaxPlanBudget,
    setFeedFilter: setActiveFeedFilter,
    setActiveFeedFilter,
    setCurrentRole,
    setCurrentBusinessId,
    setUserLocation,
    setNotificationPrefs,
    dismissToast,
    dismissNotificationToast: dismissToast,
    requestUserLocation,
    getDistanceKm,
    isPostActive,
    trackInteraction,
    trackBusinessInteraction,
    redeemPostQR,
    toggleFavorite,
    isFavorite,
    togglePostFeatured,
    createPost,
    updatePost,
    deletePost,
    suspendPost,
    reactivatePost,
    submitPostCorrection,
    approvePostReview,
    rejectPostReview,
    markBusinessNotificationAsRead,
    deleteBusinessNotification,
    clearBusinessNotifications,
    addBusiness,
    addBusinessPaymentRecord,
    createBusinessDirect,
    loginAsBusiness,
    logoutBusiness,
    updateBusiness,
    suspendBusiness,
    reactivateBusiness,
    submitBusinessCorrection,
    approveBusinessReview,
    rejectBusinessReview,
    updateBusinessCredentials,
    requestPasswordReset,
    deleteBusiness,
    renewBusinessSubscription,
    addMunicipality,
    updateMunicipality,
    deleteMunicipality,
    addSector,
    updateSector,
    deleteSector,
    addCategory,
    updateCategory,
    deleteCategory,
    addPlanCategory,
    updatePlanCategory,
    deletePlanCategory,
    resetPlanCategoriesToDefault,
    readyPlans,
    addReadyPlan,
    updateReadyPlan,
    deleteReadyPlan,
    resetReadyPlansToDefault,
    addPostType,
    updatePostType,
    deletePostType,
    addPlanRole,
    updatePlanRole,
    deletePlanRole,
    resetPlanRolesToDefault,
    addTargetAudience,
    updateTargetAudience,
    deleteTargetAudience,
    resetTargetAudiencesToDefault,
    addPriceScope,
    updatePriceScope,
    deletePriceScope,
    resetPriceScopesToDefault,
    simulatePushNotification,
    resetToInitialData,
    isAdminAuthenticated,
    adminProfile,
    loginAsAdmin,
    logoutAdmin,
    updateAdminProfile,
    resetAdminProfileToDefault,
  }), [
    businesses,
    posts,
    filteredPosts,
    categories,
    planCategories,
    sectors,
    municipalities,
    postTypes,
    planRoles,
    targetAudiences,
    priceScopes,
    currentCity,
    currentSector,
    selectedCategory,
    searchQuery,
    selectedPlanType,
    maxPlanBudget,
    activeFeedFilter,
    currentRole,
    currentBusinessId,
    authenticatedBusinessId,
    userLocation,
    locationError,
    isLocationLoading,
    favorites,
    notificationPrefs,
    businessNotifications,
    activeToast,
    readyPlans,
    isAdminAuthenticated,
    adminProfile,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
