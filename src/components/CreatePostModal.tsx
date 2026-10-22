import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Post, PostType, ValiditySchedule } from '../types';
import { useApp } from '../context/AppContext';
import { APP_CONFIG } from '../config/brand';
import {
  INITIAL_SCHEDULE_TABLE,
  getDefaultScheduleForBusiness,
  parseBusinessSchedule,
  computeValidityData,
  formatTime12h,
} from '../utils/validityHelper';
import {
  X,
  Image as ImageIcon,
  Tag,
  Clock,
  Sparkles,
  AlertCircle,
  Lock,
  Camera,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Upload,
  Eye,
  Loader2,
  Wand2,
  SlidersHorizontal,
  RotateCcw,
  Ban,
  Move,
  Crosshair,
  Crop,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Store,
  Compass,
  Video,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Film,
  Link2,
  MapPin,
  Phone,
  Share2,
  QrCode,
  Edit3,
  Users,
  Bot,
  Calendar,
  DollarSign,
  Utensils,
  Coffee,
  Wine,
  Heart,
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { PostDetailModal } from './PostDetailModal';
import { parseVideoUrl, VideoAspectRatio } from '../utils/videoHelper';
import { ValidityEngineControl } from './ValidityEngineControl';
import { PostTypeIconDisplay, isEmoji } from '../utils/postTypeIcons';
import { ICON_MAP } from './CategoryChips';
import { generateCommercialAiImage } from '../utils/aiImageGenerator';
import {
  enhanceImageQuality,
  readUploadedImageFile,
  readUploadedMediaFile,
  EnhancementMode,
  ENHANCE_STEPS,
} from '../utils/imageEnhancer';
import {
  PHOTO_FILTERS,
  buildFilterCss,
  ManualAdjustments,
  DEFAULT_MANUAL_ADJUSTMENTS,
} from '../utils/imageFilters';

export const OLI_PLAN_ROLES = [
  { id: 'desayuno_brunch', label: 'Desayuno / Brunch', subtitle: 'Mañanas (07:00 - 11:30 am)', icon: Utensils, iconColor: 'text-amber-600', emoji: '🍳' },
  { id: 'almuerzo_fuerte', label: 'Almuerzo / Plato Fuerte', subtitle: 'Mediodía (12:00 - 03:30 pm)', icon: Utensils, iconColor: 'text-orange-600', emoji: '🍽️' },
  { id: 'cafe_postres', label: 'Café, Onces y Postres', subtitle: 'Tardes (03:00 - 07:00 pm)', icon: Coffee, iconColor: 'text-amber-700', emoji: '☕' },
  { id: 'cena_copas', label: 'Cena, Tardeo o Copas', subtitle: 'Noches (07:00 - 11:59 pm)', icon: Wine, iconColor: 'text-purple-600', emoji: '🍷' },
  { id: 'actividad_servicio', label: 'Actividad o Servicio', subtitle: 'Cualquier momento del día', icon: Compass, iconColor: 'text-emerald-600', emoji: '🎯' },
  { id: 'todo_momento', label: 'Todo momento / Flexible', subtitle: 'Disponible en cualquier horario', icon: Sparkles, iconColor: 'text-sky-600', emoji: '⚡' },
];

export const OLI_TARGET_AUDIENCES = [
  { id: 'parejas', label: 'En pareja', subtitle: 'Citas, aniversarios, salidas románticas', emoji: '💑' },
  { id: 'familias', label: 'Familiar con niños', subtitle: 'Ambiente familiar, infantil y recreativo', emoji: '👨‍👩‍👧‍👦' },
  { id: 'amigos', label: 'Amigos / Grupos', subtitle: 'Reuniones, parches, salidas grupales', emoji: '👥' },
  { id: 'pet_friendly', label: 'Pet Friendly', subtitle: 'Espacios y servicios que admiten mascotas', emoji: '🐾' },
  { id: 'trabajo', label: 'Trabajo / Estudio', subtitle: 'Ambiente tranquilo, tomas, buen wifi', emoji: '💻' },
  { id: 'celebraciones', label: 'Celebraciones / Cumpleaños', subtitle: 'Eventos, reservas y fechas especiales', emoji: '🎉' },
  { id: 'todo_publico', label: 'Todo público', subtitle: 'Apto para cualquier visitante o vecino', emoji: '🌟' },
];

export const OLI_PRICE_SCOPES = [
  { id: 'individual', label: 'Individual (Por persona)', subtitle: 'Precio o consumo estimado por cada persona', badge: '1 persona', emoji: '👤' },
  { id: 'pareja', label: 'Por pareja (2 personas)', subtitle: 'Combo o experiencia para 2 personas', badge: '2 personas', emoji: '💑' },
  { id: 'familiar_grupo', label: 'Combo Familiar / Grupal', subtitle: 'Plato o paquete para compartir (3 o más personas)', badge: '3+ personas', emoji: '👨‍👩‍👧‍👦' },
  { id: 'por_mesa', label: 'Por mesa / Reserva', subtitle: 'Consumo mínimo o tarifa fija por mesa', badge: 'Por mesa', emoji: '🍽️' },
  { id: 'por_hora', label: 'Por hora / Fracción', subtitle: 'Alquiler de espacios, canchas o tiempo', badge: 'Por hora', emoji: '⏱️' },
  { id: 'por_servicio', label: 'Por servicio / Paquete', subtitle: 'Tarifa completa por el trabajo o servicio', badge: 'Paquete', emoji: '📦' },
  { id: 'entrada_libre', label: 'Entrada libre / Gratuito', subtitle: 'Acceso o consulta sin costo obligatorio', badge: 'Gratis', emoji: '🎁' },
];

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPost?: Post | null;
  onPostCreated?: (post: Post) => void;
  initialBusinessId?: string;
}

const SUGGESTED_TAGS = [
  'cajicá',
  'oferta',
  'hamburguesas',
  'almuerzo',
  'domicilio',
  'artesanal',
  'combo',
  'hoy',
  'amigos',
  'familia',
  'descuento',
];

// Helper to capitalize the first letter of each word (Title Case)
const capitalizeTitleWords = (str: string): string => {
  return str.replace(/(^|[\s\-_.,;:/()"'¿¡«»]+)(\p{L})/gu, (_, prefix, char) => `${prefix}${char.toUpperCase()}`);
};

const getPostTypeEmoji = (typeIdOrIcon?: string): string => {
  if (!typeIdOrIcon) return '🏷️';
  if (isEmoji(typeIdOrIcon)) return typeIdOrIcon;
  switch (typeIdOrIcon) {
    case 'promotion':
      return '🏷️';
    case 'event':
      return '📅';
    case 'product':
      return '🛍️';
    case 'service':
      return '🛠️';
    default:
      return '⚡';
  }
};

const getCategoryEmoji = (cat?: { id?: string; name?: string; iconName?: string; emoji?: string }): string => {
  if (!cat) return '🏷️';
  if (cat.emoji && isEmoji(cat.emoji)) return cat.emoji;
  if (cat.iconName && isEmoji(cat.iconName)) return cat.iconName;
  const key = `${cat.id || ''} ${cat.name || ''} ${cat.iconName || ''}`.toLowerCase();
  if (key.includes('auto') || key.includes('moto') || key.includes('car')) return '🚗';
  if (key.includes('belleza') || key.includes('cuidado') || key.includes('estetica') || key.includes('spa')) return '💅';
  if (key.includes('cafe') || key.includes('panaderia') || key.includes('coffee')) return '☕';
  if (key.includes('rapida') || key.includes('pizza') || key.includes('burger') || key.includes('hamburguesa')) return '🍔';
  if (key.includes('fitness') || key.includes('deporte') || key.includes('gimnasio') || key.includes('gym')) return '🏋️';
  if (key.includes('hogar') || key.includes('decoracion') || key.includes('mueble')) return '🏡';
  if (key.includes('mascota') || key.includes('veterinaria') || key.includes('dog') || key.includes('pet')) return '🐾';
  if (key.includes('moda') || key.includes('ropa') || key.includes('calzado') || key.includes('accesorio')) return '👗';
  if (key.includes('nino') || key.includes('familia') || key.includes('infantil')) return '🎈';
  if (key.includes('regalo') || key.includes('flor') || key.includes('gift')) return '🎁';
  if (key.includes('planes') || key.includes('evento') || key.includes('experiencia') || key.includes('ocio')) return '🎉';
  if (key.includes('restaurante') || key.includes('comida') || key.includes('gastronomia')) return '🍽️';
  if (key.includes('salud') || key.includes('bienestar') || key.includes('medico') || key.includes('odontolog')) return '🩺';
  if (key.includes('servicio') || key.includes('profesional') || key.includes('tecnico') || key.includes('asesor')) return '💼';
  if (key.includes('tecnologia') || key.includes('electronica') || key.includes('celular') || key.includes('computador')) return '📱';
  if (key.includes('educacion') || key.includes('curso') || key.includes('colegio') || key.includes('idioma')) return '🎓';
  if (key.includes('ferreteria') || key.includes('construccion') || key.includes('herramienta')) return '🔨';
  if (key.includes('tienda') || key.includes('comercio') || key.includes('mercado') || key.includes('super')) return '🏪';
  return '✨';
};

const getPlanCategoryEmoji = (plan?: { id?: string; name?: string; iconName?: string; emoji?: string }): string => {
  if (!plan) return '🧭';
  if (plan.emoji && isEmoji(plan.emoji)) return plan.emoji;
  if (plan.iconName && isEmoji(plan.iconName)) return plan.iconName;
  const key = `${plan.id || ''} ${plan.name || ''} ${plan.iconName || ''}`.toLowerCase();
  if (key.includes('cita') || key.includes('romance') || key.includes('pareja') || key.includes('amor')) return '🍷';
  if (key.includes('mascota') || key.includes('pet') || key.includes('perro')) return '🐾';
  if (key.includes('comer') || key.includes('antojo') || key.includes('almuerzo') || key.includes('plato')) return '🍽️';
  if (key.includes('cafe') || key.includes('tomar') || key.includes('bebida') || key.includes('postre')) return '☕';
  if (key.includes('rumba') || key.includes('nocturna') || key.includes('fiesta') || key.includes('bar') || key.includes('coctel')) return '🍸';
  if (key.includes('tramite') || key.includes('diligencia') || key.includes('servicio')) return '📋';
  if (key.includes('evento') || key.includes('actividad') || key.includes('cultura')) return '🎪';
  if (key.includes('nave') || key.includes('vehiculo') || key.includes('auto') || key.includes('taller')) return '🚗';
  if (key.includes('amigo') || key.includes('parche') || key.includes('grupo')) return '👥';
  if (key.includes('compra') || key.includes('vitrineo') || key.includes('shopping')) return '🛍️';
  if (key.includes('nino') || key.includes('familia') || key.includes('infantil')) return '🎈';
  return '✨';
};

const getRoleEmoji = (role?: { id?: string; label?: string; emoji?: string; iconName?: string }): string => {
  if (!role) return '⏰';
  if (role.emoji && isEmoji(role.emoji)) return role.emoji;
  if (role.iconName && isEmoji(role.iconName)) return role.iconName;
  const key = `${role.id || ''} ${role.label || ''} ${role.iconName || ''}`.toLowerCase();
  if (key.includes('desayun') || key.includes('manana')) return '🍳';
  if (key.includes('almuerz') || key.includes('mediodia')) return '🍽️';
  if (key.includes('cafe') || key.includes('tarde')) return '☕';
  if (key.includes('cena') || key.includes('copa') || key.includes('noche')) return '🍷';
  if (key.includes('actividad') || key.includes('finde') || key.includes('ocio')) return '🎯';
  if (key.includes('todo') || key.includes('siempre')) return '⚡';
  return '⏰';
};

const getAudienceEmoji = (audience?: { id?: string; label?: string; emoji?: string; iconName?: string }): string => {
  if (!audience) return '👥';
  if (audience.emoji && isEmoji(audience.emoji)) return audience.emoji;
  if (audience.iconName && isEmoji(audience.iconName)) return audience.iconName;
  const key = `${audience.id || ''} ${audience.label || ''} ${audience.iconName || ''}`.toLowerCase();
  if (key.includes('pareja') || key.includes('romance') || key.includes('cita')) return '💑';
  if (key.includes('familia') || key.includes('hijo') || key.includes('nino')) return '👨‍👩‍👧‍👦';
  if (key.includes('amigo') || key.includes('parche') || key.includes('grupo')) return '👥';
  if (key.includes('pet') || key.includes('mascota') || key.includes('perro')) return '🐾';
  if (key.includes('trabaj') || key.includes('cowork') || key.includes('estudio')) return '💻';
  if (key.includes('celebr') || key.includes('cumple') || key.includes('fiesta')) return '🎉';
  if (key.includes('todo') || key.includes('general')) return '🌟';
  return '👥';
};

const getPriceScopeEmoji = (scope?: { id?: string; label?: string; emoji?: string; iconName?: string }): string => {
  if (!scope) return '🏷️';
  if (scope.emoji && isEmoji(scope.emoji)) return scope.emoji;
  if (scope.iconName && isEmoji(scope.iconName)) return scope.iconName;
  const key = `${scope.id || ''} ${scope.label || ''} ${scope.iconName || ''}`.toLowerCase();
  if (key.includes('individual') || key.includes('persona')) return '👤';
  if (key.includes('pareja') || key.includes('duo')) return '👫';
  if (key.includes('familiar') || key.includes('familia')) return '👨‍👩‍👧‍👦';
  if (key.includes('mesa') || key.includes('reserva')) return '🪑';
  if (key.includes('hora') || key.includes('tiempo')) return '⏱️';
  if (key.includes('servicio') || key.includes('paquete')) return '📦';
  if (key.includes('libre') || key.includes('gratis') || key.includes('gratuito')) return '🎁';
  return '🏷️';
};

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  editingPost,
  onPostCreated,
  initialBusinessId,
}) => {
  const {
    businesses,
    currentBusinessId,
    currentRole,
    categories,
    postTypes,
    planCategories,
    planRoles: masterPlanRoles,
    targetAudiences: masterTargetAudiences,
    priceScopes: masterPriceScopes,
    createPost,
    updatePost,
    submitPostCorrection,
    simulatePushNotification,
  } = useApp();

  const effectivePlanRoles = useMemo(() => {
    return masterPlanRoles && masterPlanRoles.length > 0 ? masterPlanRoles : OLI_PLAN_ROLES;
  }, [masterPlanRoles]);

  const effectiveTargetAudiences = useMemo(() => {
    return masterTargetAudiences && masterTargetAudiences.length > 0 ? masterTargetAudiences : OLI_TARGET_AUDIENCES;
  }, [masterTargetAudiences]);

  const effectivePriceScopes = useMemo(() => {
    return masterPriceScopes && masterPriceScopes.length > 0 ? masterPriceScopes : OLI_PRICE_SCOPES;
  }, [masterPriceScopes]);

  const [selectedAdminBusinessId, setSelectedAdminBusinessId] = useState<string>(
    editingPost ? editingPost.businessId : initialBusinessId || currentBusinessId || businesses[0]?.id || ''
  );

  useEffect(() => {
    if (editingPost) {
      setSelectedAdminBusinessId(editingPost.businessId);
    } else if (initialBusinessId) {
      setSelectedAdminBusinessId(initialBusinessId);
    } else if (currentBusinessId && currentRole !== 'admin') {
      setSelectedAdminBusinessId(currentBusinessId);
    }
  }, [editingPost, initialBusinessId, currentBusinessId, currentRole]);

  const currentBiz =
    businesses.find(
      (b) => b.id === (editingPost ? editingPost.businessId : (currentRole === 'admin' ? selectedAdminBusinessId : currentBusinessId))
    ) || businesses[0];

  // Post fields state (all editable directly in this view!)
  const [type, setType] = useState<PostType>(
    editingPost ? editingPost.type : 'promotion'
  );

  const activePostTypeConfig = postTypes.find((pt) => pt.id === type) || postTypes[0] || {
    id: 'promotion',
    label: 'Promoción & Oferta',
    description: 'Descuento, 2x1 o precio especial',
    iconName: 'Tag',
    color: '#f97316',
  };
  const [title, setTitle] = useState(editingPost ? capitalizeTitleWords(editingPost.title) : '');
  const [description, setDescription] = useState(editingPost ? editingPost.description : '');
  const [correctionNote, setCorrectionNote] = useState(editingPost?.correctionNote || '');
  const [imageUrl, setImageUrl] = useState(
    editingPost ? editingPost.imageUrl : currentBiz?.banner || ''
  );
  const [videoUrl, setVideoUrl] = useState<string>(editingPost?.videoUrl || '');
  const [streamFailed, setStreamFailed] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video'>(editingPost?.videoUrl ? 'video' : 'image');
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setStreamFailed(false);
  }, [videoUrl]);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(
    editingPost ? editingPost.imageUrl : currentBiz?.banner || null
  );
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancingStep, setEnhancingStep] = useState('');
  const [enhancementMode, setEnhancementMode] = useState<EnhancementMode>('sharpness');
  const [activeToolbarTool, setActiveToolbarTool] = useState<'resize' | 'enhance' | 'createAi' | 'filters' | 'crop' | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string>(
    editingPost?.imageFilter && editingPost.imageFilter !== 'none' ? 'custom' : 'none'
  );
  const [filterIntensity, setFilterIntensity] = useState<number>(100);
  const [filterAdjustments, setFilterAdjustments] = useState<ManualAdjustments>(DEFAULT_MANUAL_ADJUSTMENTS);
  const [imageFilterCss, setImageFilterCss] = useState<string>(
    editingPost?.imageFilter || 'none'
  );
  const [showAdvancedAdjustments, setShowAdvancedAdjustments] = useState<boolean>(false);
  const [resizeScale, setResizeScale] = useState<number>(editingPost?.imageScale || 1);
  const [imageFit, setImageFit] = useState<'cover' | 'contain'>(editingPost?.imageFit || 'cover');
  const [aiCreatePrompt, setAiCreatePrompt] = useState<string>('');
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState<boolean>(false);
  const [aiVariationIndex, setAiVariationIndex] = useState<number>(0);
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string>('');
  const [aiGeneratedCategory, setAiGeneratedCategory] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showValidityModal, setShowValidityModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [showVideoUrlModal, setShowVideoUrlModal] = useState<boolean>(false);
  const [showThumbnailModal, setShowThumbnailModal] = useState<boolean>(false);
  const [videoUrlInputText, setVideoUrlInputText] = useState<string>('');
  const [videoPreviewMode, setVideoPreviewMode] = useState<'thumbnail' | 'player'>('thumbnail');
  const [postAspectRatio, setPostAspectRatio] = useState<VideoAspectRatio>(
    editingPost?.aspectRatio || '9:16'
  );
  const [mediaBgFill, setMediaBgFill] = useState<'blur' | 'fixed'>(
    editingPost?.mediaBgFill || 'blur'
  );

  // Custom modern dropdowns state & refs
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [isPlanCategoryDropdownOpen, setIsPlanCategoryDropdownOpen] = useState(false);
  const [planCategorySearchQuery, setPlanCategorySearchQuery] = useState('');
  const planCategoryDropdownRef = useRef<HTMLDivElement>(null);

  const [isPlanRoleDropdownOpen, setIsPlanRoleDropdownOpen] = useState(false);
  const [planRoleSearchQuery, setPlanRoleSearchQuery] = useState('');
  const planRoleDropdownRef = useRef<HTMLDivElement>(null);

  const [isTargetAudienceDropdownOpen, setIsTargetAudienceDropdownOpen] = useState(false);
  const [targetAudienceSearchQuery, setTargetAudienceSearchQuery] = useState('');
  const targetAudienceDropdownRef = useRef<HTMLDivElement>(null);

  const [isPriceScopeDropdownOpen, setIsPriceScopeDropdownOpen] = useState(false);
  const [priceScopeSearchQuery, setPriceScopeSearchQuery] = useState('');
  const priceScopeDropdownRef = useRef<HTMLDivElement>(null);

  // Submodule accordion state for "Configuración adicional" (starts reduced/collapsed by default)
  const [isConfigAdicionalOpen, setIsConfigAdicionalOpen] = useState<boolean>(false);

  // Scroll container ref to automatically adjust the view when dropdowns open
  const modalScrollRef = useRef<HTMLDivElement>(null);

  const adjustViewForDropdown = (targetRef: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      if (!targetRef.current || !modalScrollRef.current) return;
      const container = modalScrollRef.current;
      const targetEl = targetRef.current;
      const targetRect = targetEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Ensure space below target element (at least 320px for dropdown menu)
      const spaceBelow = containerRect.bottom - targetRect.bottom;
      if (spaceBelow < 320) {
        const neededScroll = 320 - spaceBelow + 40;
        container.scrollBy({ top: neededScroll, behavior: 'smooth' });
      }
    }, 60);
  };

  useEffect(() => {
    if (isPlanCategoryDropdownOpen) {
      adjustViewForDropdown(planCategoryDropdownRef);
    }
  }, [isPlanCategoryDropdownOpen]);

  useEffect(() => {
    if (isCategoryDropdownOpen) {
      adjustViewForDropdown(categoryDropdownRef);
    }
  }, [isCategoryDropdownOpen]);

  useEffect(() => {
    if (isTypeDropdownOpen) {
      adjustViewForDropdown(typeDropdownRef);
    }
  }, [isTypeDropdownOpen]);

  useEffect(() => {
    if (isPlanRoleDropdownOpen) {
      adjustViewForDropdown(planRoleDropdownRef);
    }
  }, [isPlanRoleDropdownOpen]);

  useEffect(() => {
    if (isTargetAudienceDropdownOpen) {
      adjustViewForDropdown(targetAudienceDropdownRef);
    }
  }, [isTargetAudienceDropdownOpen]);

  useEffect(() => {
    if (isPriceScopeDropdownOpen) {
      adjustViewForDropdown(priceScopeDropdownRef);
    }
  }, [isPriceScopeDropdownOpen]);

  // Close custom dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
      if (planCategoryDropdownRef.current && !planCategoryDropdownRef.current.contains(e.target as Node)) {
        setIsPlanCategoryDropdownOpen(false);
      }
      if (planRoleDropdownRef.current && !planRoleDropdownRef.current.contains(e.target as Node)) {
        setIsPlanRoleDropdownOpen(false);
      }
      if (targetAudienceDropdownRef.current && !targetAudienceDropdownRef.current.contains(e.target as Node)) {
        setIsTargetAudienceDropdownOpen(false);
      }
      if (priceScopeDropdownRef.current && !priceScopeDropdownRef.current.contains(e.target as Node)) {
        setIsPriceScopeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Image / Thumbnail re-framing & repositioning state (mouse drag & mobile touch)
  const [imagePosition, setImagePosition] = useState<{ x: number; y: number }>(
    editingPost?.imagePosition || { x: 50, y: 50 }
  );

  // Video-specific re-framing, zoom and fit (completely independent from thumbnail/cover image)
  const [videoPosition, setVideoPosition] = useState<{ x: number; y: number }>(
    editingPost?.videoPosition || { x: 50, y: 50 }
  );
  const [videoScale, setVideoScale] = useState<number>(editingPost?.videoScale || 1);
  const [videoFit, setVideoFit] = useState<'cover' | 'contain'>(editingPost?.videoFit || 'cover');
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [autoAdjustToast, setAutoAdjustToast] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 380, height: 238 });

  useEffect(() => {
    if (!imageContainerRef.current) return;
    const updateDims = () => {
      if (imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        if (rect.height > 50 && rect.width > 50) {
          setContainerDimensions({ width: rect.width, height: rect.height });
        }
      }
    };
    updateDims();
    const observer = new ResizeObserver(updateDims);
    observer.observe(imageContainerRef.current);
    return () => observer.disconnect();
  }, [imageUrl, videoUrl, postAspectRatio]);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  // High-performance miniature thumbnail cache for filter presets
  // Generating a small 96px thumbnail prevents rendering 11 multi-megabyte images in DOM simultaneously, eliminating browser freezes
  const [filterThumbnailUrl, setFilterThumbnailUrl] = useState<string | null>(null);
  const filterCarouselRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafFilterRef = useRef<number | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setFilterThumbnailUrl(null);
      return;
    }

    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      if (isCancelled) return;
      try {
        const canvas = document.createElement('canvas');
        const maxThumb = 96;
        let w = img.naturalWidth || 96;
        let h = img.naturalHeight || 96;
        if (w > h) {
          h = Math.max(1, Math.round((h * maxThumb) / w));
          w = maxThumb;
        } else {
          w = Math.max(1, Math.round((w * maxThumb) / h));
          h = maxThumb;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const thumb = canvas.toDataURL('image/jpeg', 0.75);
          if (!isCancelled) {
            setFilterThumbnailUrl(thumb);
          }
        }
      } catch {
        if (!isCancelled) setFilterThumbnailUrl(imageUrl);
      }
    };

    img.onerror = () => {
      if (!isCancelled) setFilterThumbnailUrl(imageUrl);
    };

    img.src = imageUrl;

    return () => {
      isCancelled = true;
    };
  }, [imageUrl]);

  const showFilterToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setAutoAdjustToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setAutoAdjustToast(null);
      toastTimeoutRef.current = null;
    }, 1800);
  };

  const scrollFilterCarousel = (direction: 'left' | 'right') => {
    if (filterCarouselRef.current) {
      const offset = direction === 'left' ? -160 : 160;
      filterCarouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const [promotionalPrice, setPromotionalPrice] = useState<string>(
    editingPost?.promotionalPrice ? String(editingPost.promotionalPrice) : ''
  );
  const [originalPrice, setOriginalPrice] = useState<string>(
    editingPost?.originalPrice ? String(editingPost.originalPrice) : ''
  );
  const [categoryId, setCategoryId] = useState<string>(
    editingPost ? editingPost.categoryId : currentBiz?.categoryId || categories[0]?.id || ''
  );
  const [planCategoryIds, setPlanCategoryIds] = useState<string[]>(
    editingPost?.planCategoryIds && Array.isArray(editingPost.planCategoryIds)
      ? editingPost.planCategoryIds
      : editingPost?.planCategoryId
      ? [editingPost.planCategoryId]
      : []
  );
  // Derived primary plan category id for single-select backwards compatibility
  const planCategoryId = planCategoryIds[0] || '';

  const handleTogglePlanCategory = (id: string) => {
    setPlanCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPlanCategories = () => {
    setPlanCategoryIds(planCategories.map((p) => p.id));
  };

  const handleClearPlanCategories = () => {
    setPlanCategoryIds([]);
  };
  const [validitySchedule, setValiditySchedule] = useState<ValiditySchedule>(() => {
    return {
      mode: 'table',
      scheduleTable: getDefaultScheduleForBusiness(currentBiz, editingPost?.validitySchedule?.scheduleTable),
    };
  });
  const [customExpiryLabel, setCustomExpiryLabel] = useState<string>(
    editingPost?.expiryLabel || '¡Aplica según horario!'
  );
  const [computedExpiresAt, setComputedExpiresAt] = useState<string | undefined>(
    editingPost?.expiresAt
  );

  // Oli Agent optimization fields (multi-select arrays)
  const [planRoles, setPlanRoles] = useState<string[]>(() => {
    if (editingPost?.planRoles && editingPost.planRoles.length > 0) return editingPost.planRoles;
    if (editingPost?.planRole && editingPost.planRole !== 'auto') return [editingPost.planRole];
    return [];
  });
  const [targetAudience, setTargetAudience] = useState<string[]>(() => {
    if (editingPost?.targetAudience && editingPost.targetAudience.length > 0) return editingPost.targetAudience;
    return ['todo_publico'];
  });
  const [priceScopes, setPriceScopes] = useState<string[]>(() => {
    if (editingPost?.priceScopes && editingPost.priceScopes.length > 0) return editingPost.priceScopes;
    if (editingPost?.priceScope) return [editingPost.priceScope];
    return ['individual'];
  });
  const [priceType, setPriceType] = useState<'exact' | 'starting_at' | 'average' | 'free'>(
    editingPost?.priceType || (editingPost?.promotionalPrice || editingPost?.originalPrice ? 'exact' : 'average')
  );
  const [approximatePrice, setApproximatePrice] = useState<string>(
    editingPost?.approximatePrice ? String(editingPost.approximatePrice) : ''
  );

  const handleTogglePlanRole = (id: string) => {
    setPlanRoles((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };
  const handleSelectAllPlanRoles = () => {
    setPlanRoles(OLI_PLAN_ROLES.map((r) => r.id));
  };
  const handleClearPlanRoles = () => {
    setPlanRoles([]);
  };

  const handleToggleTargetAudience = (id: string) => {
    setTargetAudience((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };
  const handleSelectAllTargetAudience = () => {
    setTargetAudience(OLI_TARGET_AUDIENCES.map((a) => a.id));
  };
  const handleClearTargetAudience = () => {
    setTargetAudience([]);
  };

  const handleTogglePriceScope = (id: string) => {
    setPriceScopes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };
  const handleSelectAllPriceScopes = () => {
    setPriceScopes(OLI_PRICE_SCOPES.map((p) => p.id));
  };
  const handleClearPriceScopes = () => {
    setPriceScopes([]);
  };

  const handleValidityChange = (
    schedule: ValiditySchedule,
    expiryLabel: string,
    expiresAt?: string
  ) => {
    setValiditySchedule(schedule);
    setCustomExpiryLabel(expiryLabel);
    setComputedExpiresAt(expiresAt);
  };

  // Tags chip state: only preconfigured tags for this post, or empty if none
  const [tagChips, setTagChips] = useState<string[]>(
    editingPost && editingPost.tags && Array.isArray(editingPost.tags)
      ? editingPost.tags
      : []
  );
  const [tagInputValue, setTagInputValue] = useState('');

  // Keep modal fields cleanly synchronized whenever editingPost or isOpen changes
  const lastLoadedPostIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) {
      lastLoadedPostIdRef.current = undefined;
      return;
    }
    const currentId = editingPost ? editingPost.id : '__new__';
    if (lastLoadedPostIdRef.current !== currentId) {
      lastLoadedPostIdRef.current = currentId;
      if (editingPost) {
        setType(editingPost.type);
        setTitle(capitalizeTitleWords(editingPost.title));
        setDescription(editingPost.description);
        setImageUrl(editingPost.imageUrl);
        setVideoUrl(editingPost.videoUrl || '');
        setMediaType(editingPost.videoUrl ? 'video' : 'image');
        setIsVideoPlaying(true);
        setIsVideoMuted(true);
        setOriginalImageUrl(editingPost.imageUrl);
        setImagePosition(editingPost.imagePosition || { x: 50, y: 50 });
        setResizeScale(editingPost.imageScale || 1);
        setImageFit(editingPost.imageFit || 'cover');
        setVideoPosition(editingPost.videoPosition || { x: 50, y: 50 });
        setVideoScale(editingPost.videoScale || 1);
        setVideoFit(editingPost.videoFit || 'cover');
        setImageFilterCss(editingPost.imageFilter || 'none');
        setActiveFilterId(editingPost.imageFilter && editingPost.imageFilter !== 'none' ? 'custom' : 'none');
        setPromotionalPrice(editingPost.promotionalPrice ? String(editingPost.promotionalPrice) : '');
        setOriginalPrice(editingPost.originalPrice ? String(editingPost.originalPrice) : '');
        setCategoryId(editingPost.categoryId);
        setPlanCategoryIds(
          editingPost.planCategoryIds && Array.isArray(editingPost.planCategoryIds)
            ? [...editingPost.planCategoryIds]
            : editingPost.planCategoryId
            ? [editingPost.planCategoryId]
            : []
        );
        const filledTable = getDefaultScheduleForBusiness(currentBiz, editingPost.validitySchedule?.scheduleTable);
        const syncedSchedule: ValiditySchedule = {
          mode: 'table',
          ...(editingPost.validitySchedule || {}),
          scheduleTable: filledTable,
        };
        setValiditySchedule(syncedSchedule);
        const { suggestedLabel: computedLbl } = computeValidityData(syncedSchedule);
        setCustomExpiryLabel(editingPost.expiryLabel || computedLbl || '¡Aplica según horario!');
        setComputedExpiresAt(editingPost.expiresAt);
        setPlanRoles(
          editingPost.planRoles && editingPost.planRoles.length > 0
            ? [...editingPost.planRoles]
            : editingPost.planRole && editingPost.planRole !== 'auto'
            ? [editingPost.planRole]
            : []
        );
        setTargetAudience(
          editingPost.targetAudience && editingPost.targetAudience.length > 0
            ? [...editingPost.targetAudience]
            : ['todo_publico']
        );
        setPriceScopes(
          editingPost.priceScopes && editingPost.priceScopes.length > 0
            ? [...editingPost.priceScopes]
            : editingPost.priceScope
            ? [editingPost.priceScope]
            : ['individual']
        );
        setPriceType(
          editingPost.priceType || (editingPost.promotionalPrice || editingPost.originalPrice ? 'exact' : 'average')
        );
        setApproximatePrice(editingPost.approximatePrice ? String(editingPost.approximatePrice) : '');
        setTagChips(editingPost.tags && Array.isArray(editingPost.tags) ? [...editingPost.tags] : []);
        setTagInputValue('');
        const parsedVid = editingPost.videoUrl ? parseVideoUrl(editingPost.videoUrl) : null;
        setPostAspectRatio(editingPost.aspectRatio || parsedVid?.aspectRatio || '9:16');
        setMediaBgFill(editingPost.mediaBgFill || 'blur');
      } else {
        setType('promotion');
        setTitle('');
        setDescription('');
        setImageUrl(currentBiz?.banner || '');
        setVideoUrl('');
        setMediaType('image');
        setIsVideoPlaying(true);
        setIsVideoMuted(true);
        setOriginalImageUrl(currentBiz?.banner || null);
        setImagePosition({ x: 50, y: 50 });
        setResizeScale(1);
        setImageFit('cover');
        setVideoPosition({ x: 50, y: 50 });
        setVideoScale(1);
        setVideoFit('cover');
        setImageFilterCss('none');
        setActiveFilterId('none');
        setPostAspectRatio('9:16');
        setMediaBgFill('blur');
        setPromotionalPrice('');
        setOriginalPrice('');
        setCategoryId(currentBiz?.categoryId || categories[0]?.id || '');
        setPlanCategoryIds([]);
        const defaultTable = getDefaultScheduleForBusiness(currentBiz);
        const newSched: ValiditySchedule = {
          mode: 'table',
          scheduleTable: defaultTable,
        };
        setValiditySchedule(newSched);
        const { suggestedLabel: computedLbl } = computeValidityData(newSched);
        setCustomExpiryLabel(computedLbl || '¡Aplica según horario!');
        setComputedExpiresAt(undefined);
        setPlanRoles([]);
        setTargetAudience(['todo_publico']);
        setPriceScopes(['individual']);
        setPriceType('exact');
        setApproximatePrice('');
        setTagChips([]);
        setTagInputValue('');
        setPostAspectRatio('9:16');
      }
    }
  }, [isOpen, editingPost, currentBiz, categories]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate discount percent dynamically
  const promoNum = promotionalPrice ? Number(promotionalPrice) : undefined;
  const origNum = originalPrice ? Number(originalPrice) : undefined;
  const discountPercent =
    origNum && promoNum && origNum > promoNum
      ? Math.round(((origNum - promoNum) / origNum) * 100)
      : null;

  // Compute expiry timestamp and effective label
  const computeExpiry = () => {
    return {
      expiresAt: computedExpiresAt,
      label: customExpiryLabel,
      schedule: validitySchedule,
    };
  };

  // Add tag cleanly without leading '#'
  const handleAddTag = (tagToAdd: string) => {
    const parts = tagToAdd
      .split(/[\s,]+/)
      .map((t) => t.trim().toLowerCase().replace(/^#+/, ''))
      .filter(Boolean);
    if (parts.length === 0) return;
    setTagChips((prev) => {
      const next = [...prev];
      for (const part of parts) {
        if (!next.includes(part)) {
          next.push(part);
        }
      }
      return next;
    });
    setTagInputValue('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTagChips(tagChips.filter((t) => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInputValue);
    }
  };

  // Process selected media file (image or video) with validation and thumbnail extraction
  const processMediaFile = async (file: File) => {
    setErrorMsg(null);
    const { dataUrl, mediaType: detectedType, thumbnailUrl, error } = await readUploadedMediaFile(file);
    if (error) {
      setErrorMsg(error);
      return;
    }

    if (detectedType === 'video') {
      setMediaType('video');
      setVideoUrl(dataUrl);
      setIsVideoPlaying(true);
      setIsVideoMuted(true);
      if (thumbnailUrl) {
        setImageUrl(thumbnailUrl);
        setOriginalImageUrl(thumbnailUrl);
      } else {
        setImageUrl(dataUrl);
      }
      setIsEnhanced(false);
      setImageFilterCss('none');
      setActiveFilterId('none');
      setFilterIntensity(100);
      setFilterAdjustments(DEFAULT_MANUAL_ADJUSTMENTS);
      setAutoAdjustToast('¡Video cargado con éxito!');
      setTimeout(() => setAutoAdjustToast(null), 2500);
    } else {
      setMediaType('image');
      setVideoUrl('');
      setImageUrl(dataUrl);
      setOriginalImageUrl(dataUrl);
      setIsEnhanced(false);
      setImageFilterCss('none');
      setActiveFilterId('none');
      setFilterIntensity(100);
      setFilterAdjustments(DEFAULT_MANUAL_ADJUSTMENTS);

      // Automatically inspect image aspect ratio and optimize framing
      const img = new Image();
      img.onload = () => {
        if (img.naturalHeight > img.naturalWidth * 1.05) {
          setImagePosition({ x: 50, y: 18 });
        } else {
          setImagePosition({ x: 50, y: 50 });
        }
      };
      img.src = dataUrl;
      setAutoAdjustToast('¡Foto cargada con éxito!');
      setTimeout(() => setAutoAdjustToast(null), 2000);
    }
  };

  // Optimized filter manipulation handlers
  const handleSelectFilterPreset = (presetId: string) => {
    setActiveFilterId(presetId);
    const newCss = buildFilterCss(presetId, filterIntensity, filterAdjustments);
    setImageFilterCss(newCss);
    const preset = PHOTO_FILTERS.find((f) => f.id === presetId);
    if (preset && preset.id !== 'none') {
      showFilterToast(`Filtro "${preset.name}" aplicado`);
    } else if (presetId === 'none') {
      showFilterToast('Filtro desactivado (Original)');
    }
  };

  const handleIntensityChange = (newIntensity: number) => {
    setFilterIntensity(newIntensity);
    if (rafFilterRef.current) cancelAnimationFrame(rafFilterRef.current);
    rafFilterRef.current = requestAnimationFrame(() => {
      const newCss = buildFilterCss(activeFilterId, newIntensity, filterAdjustments);
      setImageFilterCss(newCss);
    });
  };

  const handleAdjustmentChange = (key: keyof ManualAdjustments, value: number) => {
    const updated = { ...filterAdjustments, [key]: value };
    setFilterAdjustments(updated);
    if (rafFilterRef.current) cancelAnimationFrame(rafFilterRef.current);
    rafFilterRef.current = requestAnimationFrame(() => {
      const newCss = buildFilterCss(activeFilterId, filterIntensity, updated);
      setImageFilterCss(newCss);
    });
  };

  const handleResetFilters = () => {
    if (rafFilterRef.current) cancelAnimationFrame(rafFilterRef.current);
    setActiveFilterId('none');
    setFilterIntensity(100);
    setFilterAdjustments(DEFAULT_MANUAL_ADJUSTMENTS);
    setImageFilterCss('none');
    showFilterToast('Filtros restablecidos');
  };

  // Pointer drag & touch re-framing handlers (supports desktop mouse and mobile finger touch)
  const isVideoTarget = Boolean(videoUrl && videoPreviewMode === 'player');

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imageUrl && !videoUrl) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const currentTargetPos = isVideoTarget ? videoPosition : imagePosition;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentTargetPos.x,
      initialY: currentTargetPos.y,
      containerWidth: rect.width,
      containerHeight: rect.height,
    };
    setIsDraggingImage(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingImage || !dragStartRef.current) return;

    const { startX, startY, initialX, initialY, containerWidth, containerHeight } = dragStartRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Direct manipulation panning: dragging in a direction moves the image/video in that exact direction
    const percentDeltaX = (deltaX / Math.max(containerWidth, 1)) * 100;
    const percentDeltaY = (deltaY / Math.max(containerHeight, 1)) * 100;

    const nextX = Math.round(Math.max(0, Math.min(100, initialX + percentDeltaX)));
    const nextY = Math.round(Math.max(0, Math.min(100, initialY + percentDeltaY)));

    if (isVideoTarget) {
      setVideoPosition({ x: nextX, y: nextY });
    } else {
      setImagePosition({ x: nextX, y: nextY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingImage) {
      const isTap =
        dragStartRef.current &&
        Math.hypot(e.clientX - dragStartRef.current.startX, e.clientY - dragStartRef.current.startY) < 6;

      setIsDraggingImage(false);
      dragStartRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      // If user tapped on video without dragging, toggle play/pause smoothly
      if (isTap && isVideoTarget && videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
          setIsVideoPlaying(true);
        } else {
          videoRef.current.pause();
          setIsVideoPlaying(false);
        }
      }
    }
  };

  // Smart Auto-Adjust Framing function: adjusts image or video size to fit the space independently
  const handleAutoAdjustFraming = async () => {
    if (!imageUrl && !videoUrl) return;
    try {
      if (isVideoTarget) {
        if (videoFit === 'cover') {
          setVideoFit('contain');
          setVideoScale(1);
          setVideoPosition({ x: 50, y: 50 });
          setAutoAdjustToast('¡Video ajustado al espacio (ver completo con fondo ambiental)!');
        } else {
          setVideoFit('cover');
          setVideoScale(1);
          setVideoPosition({ x: 50, y: 50 });
          setAutoAdjustToast('¡Video expandido para llenar todo el marco!');
        }
      } else {
        if (imageFit === 'cover') {
          setImageFit('contain');
          setResizeScale(1);
          setImagePosition({ x: 50, y: 50 });
          setAutoAdjustToast(
            videoUrl
              ? '¡Portada ajustada al espacio (ver completa)!'
              : '¡Imagen ajustada al espacio (ver completa sin cortes)!'
          );
        } else {
          setImageFit('cover');
          setResizeScale(1);
          setImagePosition({ x: 50, y: 50 });
          setAutoAdjustToast(
            videoUrl
              ? '¡Portada expandida para llenar todo el marco!'
              : '¡Imagen expandida para llenar todo el espacio!'
          );
        }
      }
      setTimeout(() => setAutoAdjustToast(null), 2400);
    } catch {
      if (isVideoTarget) {
        setVideoFit('contain');
        setVideoScale(1);
        setVideoPosition({ x: 50, y: 50 });
      } else {
        setImageFit('contain');
        setResizeScale(1);
        setImagePosition({ x: 50, y: 50 });
      }
      setAutoAdjustToast('¡Ajustado al espacio!');
      setTimeout(() => setAutoAdjustToast(null), 2400);
    }
  };

  // Handle local media (image or video) file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processMediaFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  // Handle video thumbnail / poster image file upload
  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Por favor selecciona un archivo de imagen válido para la miniatura (JPG, PNG, WEBP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImageUrl(result);
        setOriginalImageUrl(result);
        setVideoPreviewMode('thumbnail');
        setShowThumbnailModal(false);
        setAutoAdjustToast('¡Miniatura de portada actualizada con éxito!');
        setTimeout(() => setAutoAdjustToast(null), 2500);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleSaveVideoUrl = () => {
    const trimmed = videoUrlInputText.trim();
    if (!trimmed) {
      setErrorMsg('Por favor ingresa una URL de video válida (ej: TikTok, Instagram, YouTube, Vimeo o MP4).');
      return;
    }
    const parsed = parseVideoUrl(trimmed);
    setVideoUrl(trimmed);
    setMediaType('video');
    setIsVideoPlaying(true);
    setIsVideoMuted(false);
    setVideoPreviewMode('player');
    setPostAspectRatio(parsed.aspectRatio);
    setImagePosition({ x: 50, y: 50 });
    setResizeScale(1);
    setImageFit('cover');
    setVideoPosition({ x: 50, y: 50 });
    setVideoScale(1);
    setVideoFit('cover');
    if (!imageUrl && parsed.defaultThumbnail) {
      setImageUrl(parsed.defaultThumbnail);
      setOriginalImageUrl(parsed.defaultThumbnail);
    }
    setShowVideoUrlModal(false);
    const aspectName =
      parsed.aspectRatio === '9:16'
        ? 'Vertical 9:16 (Reels/TikTok/Shorts)'
        : parsed.aspectRatio === '16:9'
        ? 'Panorámico 16:9'
        : '1:1';
    setAutoAdjustToast(`¡Video (${parsed.platformName}) adaptado a formato ${aspectName}!`);
    setTimeout(() => setAutoAdjustToast(null), 3000);
  };

  const handleRemoveCustomThumbnail = () => {
    setImageUrl('');
    setOriginalImageUrl(null);
    setShowThumbnailModal(false);
    setAutoAdjustToast('Miniatura personalizada quitada');
    setTimeout(() => setAutoAdjustToast(null), 2000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processMediaFile(file);
    }
  };

  // Enhance image quality with AI (Super-Resolution, unsharp masking, contrast, vibrant colors)
  const handleEnhanceWithAi = async () => {
    if (!imageUrl) {
      setErrorMsg('Primero debes subir una imagen para poder mejorarla con IA.');
      return;
    }
    setErrorMsg(null);
    setIsEnhancing(true);

    if (!originalImageUrl) {
      setOriginalImageUrl(imageUrl);
    }

    try {
      for (const step of ENHANCE_STEPS) {
        setEnhancingStep(step.label);
        await new Promise((r) => setTimeout(r, step.durationMs));
      }
      const enhanced = await enhanceImageQuality(imageUrl, enhancementMode);
      setImageUrl(enhanced);
      setIsEnhanced(true);
    } catch {
      setErrorMsg('No se pudo procesar la mejora automática de la imagen.');
    } finally {
      setIsEnhancing(false);
      setEnhancingStep('');
    }
  };

  const handleRevertToOriginal = () => {
    if (originalImageUrl) {
      setImageUrl(originalImageUrl);
      setIsEnhanced(false);
    }
  };

  // 4. Crop Callback
  const handleApplyCrop = (croppedDataUrl: string) => {
    setImageUrl(croppedDataUrl);
    setOriginalImageUrl(croppedDataUrl);
    setImagePosition({ x: 50, y: 50 });
    setResizeScale(1);
    setAutoAdjustToast('¡Recorte aplicado!');
    setTimeout(() => setAutoAdjustToast(null), 2500);
  };

  // 6. Generate Image with AI from user prompt
  const handleGenerateAiImage = async (isRegeneration = false) => {
    const prompt = aiCreatePrompt.trim();
    if (!prompt) {
      setErrorMsg('Por favor escribe brevemente qué imagen deseas que la IA cree.');
      return;
    }
    setErrorMsg(null);
    setIsGeneratingAiImage(true);

    const isSamePrompt = lastGeneratedPrompt.trim().toLowerCase() === prompt.toLowerCase();
    const nextIndex = isRegeneration || isSamePrompt ? aiVariationIndex + 1 : 0;

    try {
      const result = await generateCommercialAiImage(prompt, {
        variationIndex: nextIndex,
        isBanner: true,
      });

      setAiVariationIndex(nextIndex);
      setLastGeneratedPrompt(prompt);
      setAiGeneratedCategory(result.categoryLabel);
      setImageUrl(result.url);
      setOriginalImageUrl(result.url);
      setImagePosition({ x: 50, y: 50 });
      setIsEnhanced(false);
      setImageFilterCss('none');
      setActiveFilterId('none');
      setFilterIntensity(100);
      setFilterAdjustments(DEFAULT_MANUAL_ADJUSTMENTS);
      setResizeScale(1);
      setImageFit('cover');
      setAutoAdjustToast(`¡Versión ${result.variationNumber} de ${result.totalVariations} lista!`);
      setTimeout(() => setAutoAdjustToast(null), 2500);
    } catch {
      setErrorMsg('Ocurrió un inconveniente al generar la imagen con IA.');
    } finally {
      setIsGeneratingAiImage(false);
    }
  };

  // 7. Delete Photo / Video Handler (confirmed)
  const handleConfirmDeletePhoto = () => {
    setImageUrl('');
    setVideoUrl('');
    setMediaType('image');
    setOriginalImageUrl(null);
    setIsEnhanced(false);
    setImageFilterCss('none');
    setActiveFilterId('none');
    setFilterIntensity(100);
    setFilterAdjustments(DEFAULT_MANUAL_ADJUSTMENTS);
    setActiveToolbarTool(null);
    setShowDeleteConfirm(false);
    setImagePosition({ x: 50, y: 50 });
    setResizeScale(1);
    setImageFit('cover');
    setVideoPosition({ x: 50, y: 50 });
    setVideoScale(1);
    setVideoFit('cover');
    setAutoAdjustToast('Elemento multimedia eliminado');
    setTimeout(() => setAutoAdjustToast(null), 2500);
  };

  // Submit handler
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Por favor escribe un título para la publicación.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Por favor incluye una breve descripción de tu publicación.');
      return;
    }
    if (!imageUrl.trim() && !videoUrl.trim()) {
      setErrorMsg('Por favor asigna una imagen o video a la publicación.');
      return;
    }
    if (!categoryId) {
      setIsConfigAdicionalOpen(true);
      setErrorMsg('Por favor selecciona la categoría en explorar para la publicación (Campo obligatorio).');
      return;
    }

    // Plan category is now optional and supports multiple selections
    const selectedPlanCategoryObjs = planCategories.filter((p) => planCategoryIds.includes(p.id));
    const planCategoryName = selectedPlanCategoryObjs.map((p) => p.name).join(', ') || undefined;
    const primaryPlanCategoryId = planCategoryIds[0] || undefined;

    const { expiresAt, label, schedule } = computeExpiry();
    const cleanTags = tagChips.map((t) => t.trim().toLowerCase().replace(/^#+/, '')).filter(Boolean);

    if (editingPost) {
      if (editingPost.status === 'pending_review' || editingPost.reviewStatus === 'pending') {
        setErrorMsg('Esta publicación ya tiene una corrección en revisión enviada al administrador. Solo se permite una corrección por publicación y no se pueden realizar cambios hasta su evaluación.');
        return;
      }

      const wasSuspended = Boolean(
        editingPost.suspended ||
        editingPost.status === 'suspended'
      );

      const postPayload: Partial<Post> = {
        type,
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || videoUrl.trim(),
        videoUrl: videoUrl ? videoUrl.trim() : undefined,
        mediaType: videoUrl ? 'video' : 'image',
        aspectRatio: postAspectRatio,
        mediaBgFill,
        imagePosition,
        imageScale: resizeScale,
        imageFit,
        videoPosition: videoUrl ? videoPosition : undefined,
        videoScale: videoUrl ? videoScale : undefined,
        videoFit: videoUrl ? videoFit : undefined,
        imageFilter: imageFilterCss !== 'none' ? imageFilterCss : undefined,
        promotionalPrice: promoNum,
        originalPrice: origNum,
        categoryId,
        planCategoryId: primaryPlanCategoryId,
        planCategoryIds,
        planCategoryName,
        expiresAt,
        expiryLabel: label,
        validitySchedule: schedule,
        tags: cleanTags,
        planRole: planRoles[0] || undefined,
        planRoles,
        targetAudience: targetAudience.length > 0 ? targetAudience : ['todo_publico'],
        priceScope: priceScopes[0] || 'individual',
        priceScopes,
        priceType,
        approximatePrice: approximatePrice ? Number(approximatePrice) : undefined,
      };

      if (wasSuspended) {
        submitPostCorrection(editingPost.id, postPayload, correctionNote);

        const updatedPost: Post = {
          ...editingPost,
          ...postPayload,
          status: 'pending_review',
          suspended: false,
          reviewStatus: 'pending',
          reviewRequestedAt: new Date().toISOString(),
          correctionNote: correctionNote.trim() || undefined,
        };

        if (onPostCreated) {
          onPostCreated(updatedPost);
        }
      } else {
        updatePost(editingPost.id, postPayload);

        const updatedPost: Post = {
          ...editingPost,
          ...postPayload,
        };

        if (onPostCreated) {
          onPostCreated(updatedPost);
        }
      }

      onClose();
    } else {
      const res = createPost({
        businessId: currentBiz.id,
        businessName: currentBiz.name,
        businessLogo: currentBiz.logo,
        businessCity: currentBiz.city,
        businessSector: currentBiz.sector,
        businessWhatsapp: currentBiz.whatsapp,
        businessPhone: currentBiz.phone,
        businessAddress: currentBiz.address,
        coordinates: currentBiz.coordinates,
        type,
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || videoUrl.trim(),
        videoUrl: videoUrl ? videoUrl.trim() : undefined,
        mediaType: videoUrl ? 'video' : 'image',
        aspectRatio: postAspectRatio,
        mediaBgFill,
        imagePosition,
        imageScale: resizeScale,
        imageFit,
        videoPosition: videoUrl ? videoPosition : undefined,
        videoScale: videoUrl ? videoScale : undefined,
        videoFit: videoUrl ? videoFit : undefined,
        imageFilter: imageFilterCss !== 'none' ? imageFilterCss : undefined,
        promotionalPrice: promoNum,
        originalPrice: origNum,
        startsAt: new Date().toISOString(),
        expiresAt,
        expiryLabel: label,
        validitySchedule: schedule,
        categoryId,
        planCategoryId: primaryPlanCategoryId,
        planCategoryIds,
        planCategoryName,
        featured: false,
        tags: cleanTags,
        planRole: planRoles[0] || undefined,
        planRoles,
        targetAudience: targetAudience.length > 0 ? targetAudience : ['todo_publico'],
        priceScope: priceScopes[0] || 'individual',
        priceScopes,
        priceType,
        approximatePrice: approximatePrice ? Number(approximatePrice) : undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'No se pudo publicar.');
        return;
      }

      if (res.post && onPostCreated) {
        onPostCreated(res.post);
      }

      onClose();
    }
  };

  const currentBusinessLogo = currentBiz.logo;

  const getPreviewPost = (): Post => {
    const { expiresAt, label, schedule } = computeExpiry();
    const cleanTags = tagChips.map((t) => t.trim().toLowerCase().replace(/^#+/, '')).filter(Boolean);
    return {
      id: editingPost?.id || 'temp_preview_post',
      businessId: currentBiz.id,
      businessName: currentBiz.name,
      businessLogo: currentBiz.logo,
      businessCity: currentBiz.city,
      businessSector: currentBiz.sector,
      businessWhatsapp: currentBiz.whatsapp,
      businessPhone: currentBiz.phone,
      businessAddress: currentBiz.address,
      coordinates: currentBiz.coordinates,
      type,
      title: title.trim() || 'Título de la publicación',
      description: description.trim() || 'Descripción detallada de la publicación...',
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
      videoUrl: videoUrl ? videoUrl.trim() : undefined,
      mediaType: videoUrl ? 'video' : 'image',
      imagePosition,
      imageScale: resizeScale,
      imageFit,
      videoPosition: videoUrl ? videoPosition : undefined,
      videoScale: videoUrl ? videoScale : undefined,
      videoFit: videoUrl ? videoFit : undefined,
      aspectRatio: postAspectRatio,
      mediaBgFill,
      imageFilter: imageFilterCss !== 'none' ? imageFilterCss : undefined,
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      promotionalPrice: promotionalPrice ? Number(promotionalPrice) : undefined,
      startsAt: new Date().toISOString(),
      expiresAt,
      expiryLabel: label?.trim() || undefined,
      validitySchedule: schedule,
      categoryId,
      planCategoryId: planCategoryIds[0] || undefined,
      planCategoryIds,
      planCategoryName: planCategories.filter((p) => planCategoryIds.includes(p.id)).map((p) => p.name).join(', ') || undefined,
      featured: false,
      tags: cleanTags,
      planRole: planRoles[0] || undefined,
      planRoles,
      targetAudience: targetAudience.length > 0 ? targetAudience : ['todo_publico'],
      priceScope: priceScopes[0] || 'individual',
      priceScopes,
      priceType,
      approximatePrice: approximatePrice ? Number(approximatePrice) : undefined,
      createdAt: editingPost?.createdAt || new Date().toISOString(),
      metrics: editingPost?.metrics || {
        views: 0,
        whatsappClicks: 0,
        mapsClicks: 0,
        calls: 0,
        shares: 0,
      },
    };
  };

  const getCroppedBoxClass = (ratio: VideoAspectRatio) => {
    switch (ratio) {
      case '1:1':
        return 'w-full aspect-[1/1] max-h-full shrink-0 shadow-lg';
      case '4:5':
        return 'w-full aspect-[4/5] max-h-full shrink-0 shadow-lg';
      case '2:3':
        return 'w-full aspect-[2/3] max-h-full shrink-0 shadow-lg';
      case '16:9':
        return 'w-full aspect-[16/9] max-h-full shrink-0 shadow-lg';
      case '9:16':
      default:
        return 'w-full h-full';
    }
  };

  const getMediaContainerStyle = (): React.CSSProperties => {
    return {
      aspectRatio: postAspectRatio === '1:1' ? '1 / 1' : postAspectRatio === '16:9' ? '16 / 9' : '9 / 16',
      width: '100%',
      height: '100%',
    };
  };

  return (
    <div
      id="create-post-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs sm:p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl md:max-w-3xl rounded-t-[28px] sm:rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden max-h-[96vh] sm:max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between border-b border-slate-100 bg-slate-50/80">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              {editingPost ? 'Editar Publicación' : 'Crear Publicación'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Editor Body */}
        <div ref={modalScrollRef} className="overflow-y-auto flex-1 p-3 sm:p-5 space-y-4 sm:space-y-5 bg-slate-100/60">
          {editingPost && (editingPost.status === 'pending_review' || editingPost.reviewStatus === 'pending') && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs flex flex-col gap-2 shadow-xs animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-amber-950 text-xs">
                    Publicación en cola de revisión del administrador
                  </p>
                  <p className="text-amber-900 mt-0.5">
                    Ya has enviado una corrección para esta publicación. Para garantizar un proceso ordenado de moderación, solo se puede enviar <strong>una corrección por publicación</strong> y no se admiten modificaciones adicionales hasta recibir la decisión del administrador.
                  </p>
                  {editingPost.correctionNote && (
                    <div className="mt-2 p-2 rounded-xl bg-white border border-amber-200 text-[11px] text-amber-900">
                      <strong>Tu aclaración enviada:</strong> "{editingPost.correctionNote}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {editingPost && (editingPost.status === 'suspended' || Boolean(editingPost.suspended)) && editingPost.status !== 'pending_review' && editingPost.reviewStatus !== 'pending' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs flex flex-col gap-2.5 shadow-xs animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-amber-950 text-xs">
                    Corrigiendo publicación suspendida por políticas
                  </p>
                  <p className="text-amber-900 mt-0.5">
                    <strong>Motivo de moderación:</strong> "{editingPost.suspensionReason || 'No cumple con las normas de publicación de la plataforma.'}"
                  </p>
                  <p className="text-amber-800 font-medium mt-1">
                    Corrige los datos señalados (texto, foto, precio o términos). <strong>Al enviar, la solicitud llegará al administrador para su revisión y aprobación</strong> antes de quedar activa en el feed. Solo se puede enviar una corrección por publicación.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-amber-200">
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Nota o aclaración para el administrador (opcional):
                </label>
                <input
                  type="text"
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="Ej: He actualizado la foto sin marcas de agua y verificado el precio..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs text-slate-800 focus:border-amber-600 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Selector de Comercio para Administrador */}
          {currentRole === 'admin' && !editingPost && (
            <div className="max-w-[420px] mx-auto w-full p-3 bg-blue-50/90 border border-blue-200 rounded-2xl flex flex-col gap-1.5 shadow-2xs">
              <label htmlFor="select-admin-post-business" className="text-xs font-extrabold text-[#041f5e] flex items-center gap-1.5">
                <Store className="w-4 h-4 text-[#007af7]" />
                <span>Publicar a nombre del comercio:</span>
              </label>
              <select
                id="select-admin-post-business"
                value={selectedAdminBusinessId}
                onChange={(e) => {
                  const newBizId = e.target.value;
                  setSelectedAdminBusinessId(newBizId);
                  const b = businesses.find((biz) => biz.id === newBizId);
                  if (b) {
                    setCategoryId(b.categoryId || categories[0]?.id || '');
                    if (!imageUrl || imageUrl === currentBiz?.banner) {
                      setImageUrl(b.banner || '');
                      setOriginalImageUrl(b.banner || null);
                    }
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden shadow-2xs cursor-pointer"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city} - {b.sector})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ======================================================== */}
          {/* THE EXPLORAR CARD (INTERACTIVE WYSIWYG EDITOR)            */}
          {/* ======================================================== */}
          {/* ======================================================== */}
          {/* REEL AD CREATOR (9:16 LIVE INTERACTIVE REEL STAGE)       */}
          {/* ======================================================== */}
          <div className="flex flex-col items-center justify-center w-full">
            {/* 1. THE 9:16 REEL STAGE */}
            <div
              className="w-full max-w-[380px] sm:max-w-[420px] aspect-[9/16] bg-black rounded-[32px] sm:rounded-[36px] shadow-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden select-none transition"
            >
              {/* Hidden file input supporting image and video files */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg,video/mp4,video/webm,video/quicktime,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Hidden file input specifically for video thumbnail / poster image */}
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleThumbnailUpload}
                className="hidden"
              />

              {/* TOP BAR OVERLAY */}
              <div className="relative z-30 pt-3.5 sm:pt-4 px-3.5 sm:px-4 flex items-center justify-between gap-2 pointer-events-auto">
                {/* Top-Left: Dynamic Discount Badge */}
                <div className="shrink-0">
                  {discountPercent ? (
                    <div
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-white font-black text-xs sm:text-sm tracking-tight shadow-xl border border-white/30 backdrop-blur-md animate-in zoom-in-95 duration-200"
                      style={{
                        background: 'linear-gradient(135deg, #ff3366 0%, #ff5e36 100%)',
                        boxShadow: '0 4px 15px rgba(255, 51, 102, 0.45), inset 0 1px 1.5px rgba(255, 255, 255, 0.6)',
                      }}
                    >
                      <span>-{discountPercent}% OFF</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white/70 text-[11px] font-bold border border-white/15 bg-black/40 backdrop-blur-md">
                      <span>Sin descuento</span>
                    </div>
                  )}
                </div>

                {/* Top-Center: Video/Portada Switcher (Centrado) */}
                {videoUrl ? (
                  <div className="absolute left-1/2 -translate-x-1/2 top-3.5 sm:top-4 h-8 flex items-center pointer-events-auto">
                    <div className="inline-flex items-center p-0.5 rounded-lg bg-black/50 border border-white/20 text-xs shrink-0 shadow-2xs backdrop-blur-md">
                      <button
                        type="button"
                        id="btn-toolbar-mode-video"
                        onClick={() => {
                          setVideoPreviewMode('player');
                          setIsVideoPlaying(true);
                          if (videoRef.current) videoRef.current.play().catch(() => {});
                        }}
                        className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                          videoPreviewMode === 'player'
                            ? 'bg-[#007af7] text-white shadow-xs'
                            : 'text-white/75 hover:text-white hover:bg-white/10'
                        }`}
                        title="Ver video"
                      >
                        <Play className="w-3 h-3 fill-current shrink-0" />
                        <span>Video</span>
                      </button>
                      <button
                        type="button"
                        id="btn-toolbar-mode-thumbnail"
                        onClick={() => {
                          setVideoPreviewMode('thumbnail');
                          if (videoRef.current) videoRef.current.pause();
                          setIsVideoPlaying(false);
                        }}
                        className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                          videoPreviewMode === 'thumbnail'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-white/75 hover:text-white hover:bg-white/10'
                        }`}
                        title="Ver portada"
                      >
                        <ImageIcon className="w-3 h-3 shrink-0" />
                        <span>Portada</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Top-Right: Sound Button (Borde derecho respetando margen) */}
                <div className="shrink-0 flex items-center justify-end">
                  {videoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextMuted = !isVideoMuted;
                        setIsVideoMuted(nextMuted);
                        if (videoRef.current) videoRef.current.muted = nextMuted;
                      }}
                      className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition cursor-pointer shadow-md"
                      title={isVideoMuted ? 'Activar sonido' : 'Silenciar'}
                    >
                      {isVideoMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                    </button>
                  )}
                </div>
              </div>

              {/* BACKGROUND MEDIA WITH TOUCH/MOUSE REFRAMING */}
              <div
                ref={imageContainerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`absolute inset-0 z-0 overflow-hidden flex flex-col items-center justify-center touch-none ${
                  isDraggingImage ? 'cursor-grabbing ring-2 ring-[#007af7]' : imageUrl || videoUrl ? 'cursor-grab hover:ring-1 hover:ring-blue-300' : ''
                }`}
                style={
                  mediaBgFill === 'fixed'
                    ? {
                        background: 'linear-gradient(180deg, #00163A 0%, #001D4A 50%, #001026 100%)',
                      }
                    : {
                        background: '#020617',
                      }
                }
                title={imageUrl || videoUrl ? 'Haz clic o toca para reencuadrar arrastrándola' : 'Subir foto o video'}
              >
                {!imageUrl && !videoUrl ? (
                  isGeneratingAiImage ? (
                    <div className="w-full h-full flex flex-col items-center justify-center pb-28 sm:pb-32 p-3 bg-purple-950 text-white text-center animate-in fade-in">
                      <Loader2 className="w-7 h-7 animate-spin text-purple-400 mb-2" />
                      <span className="text-xs font-black text-white">Generando con IA...</span>
                      <span className="text-[10px] text-purple-200 mt-1 line-clamp-2">"{aiCreatePrompt || 'Creando imagen...'}"</span>
                    </div>
                  ) : (
                    <div
                      id="dropzone-upload-post-image"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`w-full h-full flex flex-col items-center justify-center pb-32 sm:pb-36 p-4 cursor-pointer border-2 border-dashed transition-all duration-300 text-center ${
                        isDragging
                          ? 'border-[#007af7] bg-blue-100/70 scale-[0.99]'
                          : 'border-white/20 hover:border-cyan-400 bg-slate-950/60 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#007af7] to-cyan-400 text-white flex items-center justify-center shadow-lg mb-2">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-black text-white drop-shadow-md">Sube tu Video o Foto</span>
                      <span className="text-xs text-white/70 mt-0.5 leading-tight">Formato vertical 9:16 (Reel)</span>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold backdrop-blur-md shadow-xs">
                          <Camera className="w-3.5 h-3.5 text-cyan-300" />
                          <span>Archivo</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoUrlInputText(videoUrl || '');
                            setShowVideoUrlModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-sky-500/30 hover:bg-sky-500/40 text-sky-200 border border-sky-400/40 text-xs font-bold backdrop-blur-md shadow-xs cursor-pointer"
                          title="Pegar enlace de video"
                        >
                          <Link2 className="w-3.5 h-3.5 text-sky-300" />
                          <span>URL Video</span>
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <>
                    {videoUrl ? (
                      videoPreviewMode === 'thumbnail' && imageUrl ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                          {mediaBgFill === 'blur' && (postAspectRatio !== '9:16' || imageFit === 'contain' || resizeScale < 1) && imageUrl && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                              <img
                                src={imageUrl}
                                alt=""
                                className="w-full h-full object-cover blur-2xl scale-120 opacity-40"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-black/40" />
                            </div>
                          )}
                          <div
                            className={`relative z-1 overflow-hidden flex items-center justify-center transition-all ${getCroppedBoxClass(postAspectRatio)}`}
                          >
                            <img
                              src={imageUrl}
                              alt="Miniatura de portada"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                              className={`w-full h-full select-none relative z-10 transition-transform ${
                                imageFit === 'contain' ? 'object-contain' : 'object-cover'
                              }`}
                              style={{
                                objectPosition: `${imagePosition.x}% ${imagePosition.y}%`,
                                transform: resizeScale !== 1 ? `scale(${resizeScale})` : undefined,
                                transformOrigin: `${imagePosition.x}% ${imagePosition.y}%`,
                                filter: imageFilterCss !== 'none' ? imageFilterCss : undefined,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${mediaBgFill === 'fixed' ? 'bg-transparent' : 'bg-black'}`}>
                          {(() => {
                            const parsed = parseVideoUrl(videoUrl);
                            const canUseNativeStream = Boolean(parsed.streamUrl && !streamFailed);
                            const isNativePlayer = canUseNativeStream || !parsed.isIframe;

                            if (isNativePlayer) {
                              return (
                                <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                                  {mediaBgFill === 'blur' && (postAspectRatio !== '9:16' || videoFit === 'contain' || videoScale < 1) && (
                                    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt=""
                                          className="w-full h-full object-cover blur-xl scale-135 opacity-75"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <video
                                          src={canUseNativeStream ? parsed.streamUrl : (videoUrl || '')}
                                          muted
                                          autoPlay
                                          loop
                                          playsInline
                                          className="w-full h-full object-cover blur-xl scale-135 opacity-70"
                                        />
                                      )}
                                      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
                                    </div>
                                  )}
                                  <div
                                    className={`relative z-1 overflow-hidden flex items-center justify-center transition-all ${getCroppedBoxClass(postAspectRatio)}`}
                                  >
                                    <video
                                      ref={videoRef}
                                      src={canUseNativeStream ? parsed.streamUrl : (videoUrl || '')}
                                      poster={imageUrl}
                                      autoPlay
                                      loop
                                      muted={isVideoMuted}
                                      playsInline
                                      onPlay={() => setIsVideoPlaying(true)}
                                      onPause={() => setIsVideoPlaying(false)}
                                      onError={() => {
                                        if (canUseNativeStream) {
                                          setStreamFailed(true);
                                        }
                                      }}
                                      className={`w-full h-full select-none relative z-10 cursor-pointer ${
                                        videoFit === 'contain' ? 'object-contain' : 'object-cover'
                                      }`}
                                      style={{
                                        objectPosition: `${videoPosition.x}% ${videoPosition.y}%`,
                                        transform: videoScale !== 1 ? `scale(${videoScale})` : undefined,
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (videoRef.current) {
                                          if (videoRef.current.paused) {
                                            videoRef.current.play().catch(() => {});
                                            setIsVideoPlaying(true);
                                          } else {
                                            videoRef.current.pause();
                                            setIsVideoPlaying(false);
                                          }
                                        }
                                      }}
                                    />
                                    {!isVideoPlaying && (
                                      <div
                                        className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[1px] cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (videoRef.current) {
                                            videoRef.current.play().catch(() => {});
                                            setIsVideoPlaying(true);
                                          }
                                        }}
                                      >
                                        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/75 border-2 border-white/85 shadow-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform">
                                          <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white ml-0.5" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            const isTikTok = parsed.platform === 'tiktok';
                            const isInstagram = parsed.platform === 'instagram';
                            const isShorts = parsed.platform === 'youtube' && parsed.isVertical;
                            const isFacebookReel = parsed.platform === 'facebook' && parsed.isVertical;
                            const isVerticalEmbed = isTikTok || isInstagram || isShorts || isFacebookReel;

                            const nativeW = isTikTok ? 325 : isInstagram ? 270 : isShorts ? 315 : 320;
                            const nativeH = isTikTok ? 575 : isInstagram ? 480 : isShorts ? 560 : 540;

                            const fitScale = containerDimensions.height / nativeH;
                            const coverScale = containerDimensions.width / nativeW;
                            const baseScale = videoFit === 'contain' ? Math.min(coverScale, fitScale) : Math.max(coverScale, fitScale);
                            const finalScale = baseScale * videoScale;

                            return isVerticalEmbed ? (
                              <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                                {mediaBgFill === 'blur' && (imageUrl || parsed.defaultThumbnail) && (
                                  <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                                    <img
                                      src={imageUrl || parsed.defaultThumbnail}
                                      alt=""
                                      className="w-full h-full object-cover blur-xl scale-135 opacity-75"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
                                  </div>
                                )}
                                <div
                                  className={`relative z-1 overflow-hidden flex items-center justify-center transition-all ${getCroppedBoxClass(postAspectRatio)}`}
                                >
                                  <div
                                    className="relative flex items-center justify-center select-none shadow-2xl rounded-xl overflow-hidden z-10"
                                    style={{
                                      width: `${nativeW}px`,
                                      height: `${nativeH}px`,
                                      transform: `scale(${finalScale}) translate(${(videoPosition.x - 50) * 0.4}%, ${(videoPosition.y - 50) * 0.4}%)`,
                                      transformOrigin: 'center center',
                                    }}
                                  >
                                    <iframe
                                      src={parsed.embedUrl}
                                      scrolling="no"
                                      sandbox="allow-scripts allow-same-origin allow-presentation"
                                      className={`border-0 select-none pointer-events-auto ${
                                        isInstagram
                                          ? 'absolute left-1/2 -translate-x-1/2 w-[480px] h-[640px] -top-[54px]'
                                          : isTikTok
                                          ? 'absolute left-1/2 -translate-x-1/2 w-[340px] h-[660px] -top-[48px]'
                                          : isFacebookReel
                                          ? 'absolute left-1/2 -translate-x-1/2 w-[340px] h-[640px] -top-[46px]'
                                          : isShorts
                                          ? 'absolute left-1/2 -translate-x-1/2 w-[340px] h-[620px] -top-[48px]'
                                          : 'w-full h-full'
                                      }`}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                      allowFullScreen
                                      title="Vista previa del video"
                                    />
                                    <div
                                      className="absolute inset-x-0 top-0 h-14 z-20 pointer-events-auto"
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    />
                                    <div
                                      className="absolute inset-x-0 bottom-0 h-16 z-20 pointer-events-auto"
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                                {mediaBgFill === 'blur' && (imageUrl || parsed.defaultThumbnail) && (
                                  <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                                    <img
                                      src={imageUrl || parsed.defaultThumbnail}
                                      alt=""
                                      className="w-full h-full object-cover blur-xl scale-135 opacity-75"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
                                  </div>
                                )}
                                <div
                                  className={`relative z-1 overflow-hidden flex items-center justify-center transition-all ${getCroppedBoxClass(postAspectRatio)}`}
                                >
                                  <iframe
                                    src={parsed.embedUrl}
                                    scrolling="no"
                                    sandbox="allow-scripts allow-same-origin allow-presentation"
                                    className="w-full h-full border-0 pointer-events-auto relative z-10"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    title="Vista previa del video"
                                  />
                                  <div
                                    className="absolute inset-x-0 top-0 h-14 z-20 pointer-events-auto"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                  />
                                  <div
                                    className="absolute inset-x-0 bottom-0 h-16 z-20 pointer-events-auto"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )
                    ) : imageUrl ? (
                      <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                        {mediaBgFill === 'blur' && (postAspectRatio !== '9:16' || imageFit === 'contain' || resizeScale < 1) && (
                          <div className="absolute inset-0 overflow-hidden pointer-events-none bg-slate-950">
                            <img
                              alt=""
                              className="w-full h-full object-cover blur-xl scale-135 opacity-75"
                              style={{
                                objectPosition: `${imagePosition.x}% ${imagePosition.y}%`,
                                filter: imageFilterCss && imageFilterCss !== 'none' ? `${imageFilterCss} blur(20px)` : 'blur(20px)',
                              }}
                              src={imageUrl}
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
                          </div>
                        )}

                        <div
                          className={`relative z-1 overflow-hidden flex items-center justify-center transition-all ${getCroppedBoxClass(postAspectRatio)}`}
                        >
                          <img
                            alt={title || 'Publicación'}
                            className={`w-full h-full select-none pointer-events-none relative z-1 will-change-transform ${
                              imageFit === 'contain' ? 'object-contain' : 'object-cover'
                            }`}
                            style={{
                              objectPosition: `${imagePosition.x}% ${imagePosition.y}%`,
                              transform: resizeScale !== 1 ? `scale(${resizeScale})` : undefined,
                              transformOrigin: `${imagePosition.x}% ${imagePosition.y}%`,
                              filter: imageFilterCss && imageFilterCss !== 'none' ? imageFilterCss : undefined,
                            }}
                            src={imageUrl}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    ) : null}

                    {/* Rule of thirds framing grid when dragging */}
                    {isDraggingImage && (
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10 border border-white/20">
                        <div className="border-r border-b border-white/25" />
                        <div className="border-r border-b border-white/25" />
                        <div className="border-b border-white/25" />
                        <div className="border-r border-b border-white/25" />
                        <div className="border-r border-b border-white/25" />
                        <div className="border-b border-white/25" />
                        <div className="border-r border-b border-white/25" />
                        <div className="border-r border-b border-white/25" />
                        <div />
                      </div>
                    )}

                    {/* AI Enhanced Super HD Badge */}
                    {isEnhanced && (
                      <div className="absolute top-16 left-3 z-20 px-2 py-0.5 rounded-full bg-emerald-600/95 text-white text-[10px] font-extrabold backdrop-blur-xs flex items-center gap-1 shadow-md border border-white/25">
                        <Sparkles className="w-3 h-3 text-emerald-200" />
                        <span>HD 2X</span>
                      </div>
                    )}

                    {/* AI Image Generation Progress Overlay */}
                    {isGeneratingAiImage && (
                      <div className="absolute inset-0 z-30 bg-purple-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white p-3 text-center animate-in fade-in">
                        <Loader2 className="w-7 h-7 animate-spin text-purple-400 mb-2" />
                        <span className="text-xs font-black text-white">Generando con IA...</span>
                      </div>
                    )}

                    {/* Enhancing Progress Overlay */}
                    {isEnhancing && (
                      <div className="absolute inset-0 z-30 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-3 text-center animate-in fade-in">
                        <Loader2 className="w-7 h-7 animate-spin text-sky-400 mb-2" />
                        <span className="text-xs font-black text-white">Mejorando imagen...</span>
                      </div>
                    )}
                  </>
                )}

                {/* Cinematic Top and Bottom Vignettes for perfect text legibility */}
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/85 via-black/35 to-transparent pointer-events-none z-10" />
                <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-black/95 via-black/75 to-transparent pointer-events-none z-10" />
              </div>

              {/* CENTER AREA (Reel view unobstructed - no contact buttons during creation) */}
              <div className="relative z-20 flex-1 pointer-events-none" />

              {/* ======================================================== */}
              {/* BOTTOM-LEFT OVERLAY (DIRECTLY EDITABLE OVER THE REEL)     */}
              {/* ======================================================== */}
              <div className="relative z-30 pb-4 sm:pb-5 px-3.5 sm:px-4 pointer-events-auto flex flex-col gap-2">
                {/* Business Name with Verified Checkmark */}
                <div className="inline-flex items-center gap-1.5 text-white font-extrabold text-xs sm:text-sm tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  <span>{currentBiz.name}</span>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 fill-cyan-400/20 shrink-0" />
                </div>

                {/* Title Input Directly on Video */}
                <div className="relative group">
                  <input
                    id="post-title-input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(capitalizeTitleWords(e.target.value))}
                    placeholder="Escribe el título de tu anuncio..."
                    required
                    className="w-full text-white font-black text-base sm:text-lg md:text-xl placeholder:text-white/55 placeholder:font-bold bg-black/40 hover:bg-black/55 focus:bg-black/75 border border-white/25 hover:border-white/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 rounded-xl px-2.5 py-1.5 outline-none transition drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] leading-tight"
                  />
                </div>

                {/* Pricing Controls Directly on Video (Updates Discount Badge) */}
                <div className="p-1.5 sm:p-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-between gap-1.5 shadow-xl">
                  {/* Controles de precios */}
                  <div className="flex items-center justify-end gap-1.5 w-full">
                    {/* Original Price (Strikethrough Antes) */}
                    <div className="flex items-center gap-0.5 sm:gap-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg px-1.5 py-0.5 transition">
                      <span className="text-[10px] sm:text-xs text-white/70 font-semibold select-none">Antes: $</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={originalPrice}
                        onChange={(e) => {
                          const cleanDigits = e.target.value.replace(/[^\d]/g, '');
                          setOriginalPrice(cleanDigits);
                        }}
                        placeholder="36000"
                        className="bg-transparent text-white/80 line-through decoration-white/70 font-bold text-xs sm:text-sm outline-none transition-all w-14 xs:w-16 sm:w-20 text-center placeholder:text-white/40 placeholder:no-underline"
                      />
                    </div>

                    {/* Promotional Price inside Bright Pill */}
                    <div
                      className="text-white font-extrabold px-2.5 sm:px-3 py-1 rounded-full inline-flex items-center gap-0.5 sm:gap-1 shadow-md transition-all duration-150 shrink-0 border border-white/30"
                      style={{
                        background: 'linear-gradient(135deg, #0070f3 0%, #0056d6 100%)',
                      }}
                    >
                      <span className="shrink-0 select-none text-xs sm:text-sm">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={promotionalPrice}
                        onChange={(e) => {
                          const cleanDigits = e.target.value.replace(/[^\d]/g, '');
                          setPromotionalPrice(cleanDigits);
                        }}
                        placeholder="24900"
                        className="bg-transparent text-white font-black text-xs sm:text-sm md:text-base placeholder-white/70 outline-none transition-all w-15 xs:w-18 sm:w-20 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Etiqueta de Vigencia Pulsable (Abre el Modal de Configuración) */}
                <button
                  type="button"
                  onClick={() => setShowValidityModal(true)}
                  className="w-full inline-flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-[#1e293b]/90 hover:bg-[#1e293b] active:scale-[0.99] backdrop-blur-md border border-sky-400/40 hover:border-sky-300 text-sky-200 text-xs font-bold shadow-lg transition cursor-pointer group"
                  title="Pulsa para configurar días en que aplica, vigencia y tipo de texto"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span className="truncate">{customExpiryLabel || 'Toca para configurar vigencia y días'}</span>
                  </div>
                  <span className="text-[10px] text-sky-300 font-extrabold uppercase tracking-wide bg-sky-950/80 px-2 py-0.5 rounded-md border border-sky-400/30 group-hover:bg-sky-900 transition shrink-0 flex items-center gap-1">
                    <Edit3 className="w-3 h-3" /> Configurar
                  </span>
                </button>

                {/* Description Textarea Directly on Video */}
                <div className="relative group">
                  <textarea
                    id="post-description-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe qué incluye la oferta, ingredientes o condiciones..."
                    rows={2}
                    required
                    className="w-full text-white/95 text-xs sm:text-[13px] placeholder:text-white/50 bg-black/40 hover:bg-black/55 focus:bg-black/75 border border-white/25 hover:border-white/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 rounded-xl px-2.5 py-1.5 outline-none resize-none transition leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                  />
                </div>
              </div>
            </div>

            {/* CONTROLES Y HERRAMIENTAS DEBAJO DEL REEL */}
            <div className="w-full max-w-[380px] sm:max-w-[420px] mx-auto mt-3.5 space-y-3">
              {/* Opciones de edición de imagen y video */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#007af7]" />
                    <span>Opciones de edición de imagen y video</span>
                  </span>
                </div>

                {showDeleteConfirm ? (
                  <div className="flex items-center justify-between w-full p-2.5 rounded-2xl bg-rose-50 border border-rose-200 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{videoUrl ? '¿Eliminar el video actual?' : '¿Eliminar la foto actual?'}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        id="btn-confirm-delete-photo"
                        onClick={handleConfirmDeletePhoto}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer flex items-center gap-1 active:scale-95 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Sí, eliminar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1 bg-slate-50 border border-slate-200/90 rounded-2xl">
                    {/* 1. Subir foto o video */}
                    <button
                      type="button"
                      id="btn-upload-photo"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-sky-700 shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer"
                      title="Subir foto o video desde tu dispositivo"
                      aria-label="Subir foto o video"
                    >
                      <Upload className="w-4.5 h-4.5 text-sky-600" />
                    </button>

                    {/* 1b. URL de video */}
                    <button
                      type="button"
                      id="btn-toolbar-video-url"
                      onClick={() => {
                        setVideoUrlInputText(videoUrl.startsWith('data:') ? '' : videoUrl);
                        setShowVideoUrlModal(true);
                      }}
                      className={`w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center border shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer ${
                        videoUrl
                          ? 'bg-sky-100 border-sky-400 text-sky-800 ring-1 ring-sky-300'
                          : 'bg-white hover:bg-sky-50 border-slate-200 hover:border-sky-300 text-sky-700'
                      }`}
                      title="Pegar o editar enlace de video"
                      aria-label="Pegar enlace de video"
                    >
                      <Link2 className="w-4.5 h-4.5 text-sky-600" />
                    </button>

                    {/* 1c. Portada si hay video */}
                    {videoUrl ? (
                      <button
                        type="button"
                        id="btn-toolbar-thumbnail"
                        onClick={() => setShowThumbnailModal(true)}
                        className={`w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center border shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer ${
                          imageUrl && imageUrl !== videoUrl
                            ? 'bg-emerald-100 border-emerald-400 text-emerald-800 ring-1 ring-emerald-300'
                            : 'bg-white hover:bg-emerald-50 border-slate-200 hover:border-emerald-300 text-emerald-700'
                        }`}
                        title="Elegir o cambiar miniatura de portada fija del video"
                        aria-label="Elegir portada del video"
                      >
                        <ImageIcon className="w-4.5 h-4.5 text-emerald-600" />
                      </button>
                    ) : null}

                    {/* 2. Auto ajustar */}
                    <button
                      type="button"
                      id="btn-auto-adjust-framing"
                      onClick={() => {
                        if (!imageUrl && !videoUrl) {
                          setAutoAdjustToast('Sube una foto o video primero');
                          setTimeout(() => setAutoAdjustToast(null), 2500);
                          return;
                        }
                        handleAutoAdjustFraming();
                      }}
                      className={`w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center border shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer ${
                        (isVideoTarget ? videoFit === 'contain' : imageFit === 'contain')
                          ? 'bg-indigo-600 border-indigo-700 text-white shadow-xs'
                          : 'bg-white hover:bg-indigo-50 border-slate-200 hover:border-indigo-300 text-indigo-700'
                      }`}
                      title={
                        (isVideoTarget ? videoFit === 'contain' : imageFit === 'contain')
                          ? 'Ajustado (clic para llenar marco)'
                          : 'Auto-ajustar encuadre al marco'
                      }
                      aria-label="Auto ajustar encuadre"
                    >
                      <Crosshair className="w-4.5 h-4.5" />
                    </button>

                    {/* 3. Escala / Zoom */}
                    <button
                      type="button"
                      id="btn-resize-photo"
                      onClick={() => {
                        if (!imageUrl && !videoUrl) {
                          setAutoAdjustToast('Sube una foto o video primero');
                          setTimeout(() => setAutoAdjustToast(null), 2500);
                          return;
                        }
                        setActiveToolbarTool(activeToolbarTool === 'resize' ? null : 'resize');
                      }}
                      className={`w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center border shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer ${
                        activeToolbarTool === 'resize'
                          ? 'bg-blue-600 border-blue-700 text-white shadow-xs ring-2 ring-blue-300'
                          : 'bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-blue-700'
                      }`}
                      title="Ampliar o reducir escala (Zoom)"
                      aria-label="Escala y zoom"
                    >
                      <Maximize2 className="w-4.5 h-4.5" />
                    </button>

                    {/* 4. Recorte / Encuadre */}
                    <button
                      type="button"
                      id="btn-crop-photo"
                      onClick={() => {
                        if (!imageUrl && !videoUrl) {
                          setAutoAdjustToast('Sube una foto o video primero');
                          setTimeout(() => setAutoAdjustToast(null), 2500);
                          return;
                        }
                        setActiveToolbarTool(activeToolbarTool === 'crop' ? null : 'crop');
                      }}
                      className={`w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center border shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer ${
                        activeToolbarTool === 'crop'
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs ring-2 ring-emerald-300'
                          : 'bg-white hover:bg-emerald-50 border-slate-200 hover:border-emerald-300 text-emerald-700'
                      }`}
                      title="Proporción y formato de encuadre"
                      aria-label="Recorte y proporción"
                    >
                      <Crop className="w-4.5 h-4.5" />
                    </button>

                    {/* 5. Mejorar con IA */}
                    <button
                      type="button"
                      id="btn-enhance-ai"
                      onClick={() => {
                        if (!imageUrl) {
                          setAutoAdjustToast('Sube una foto primero para mejorar');
                          setTimeout(() => setAutoAdjustToast(null), 2500);
                          return;
                        }
                        setActiveToolbarTool(activeToolbarTool === 'enhance' ? null : 'enhance');
                      }}
                      className={`w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center border shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer ${
                        activeToolbarTool === 'enhance'
                          ? 'bg-amber-500 border-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                          : isEnhanced
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                          : 'bg-white hover:bg-amber-50 border-slate-200 hover:border-amber-300 text-amber-700'
                      }`}
                      title="Mejorar calidad y nitidez con IA"
                      aria-label="Mejorar calidad con IA"
                    >
                      <Wand2 className="w-4.5 h-4.5" />
                    </button>

                    {/* 6. Filtros */}
                    <button
                      type="button"
                      id="btn-photo-filters"
                      onClick={() => {
                        if (!imageUrl) {
                          setAutoAdjustToast('Sube una foto primero para aplicar filtros');
                          setTimeout(() => setAutoAdjustToast(null), 2500);
                          return;
                        }
                        setActiveToolbarTool(activeToolbarTool === 'filters' ? null : 'filters');
                      }}
                      className={`w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center border shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer ${
                        activeToolbarTool === 'filters'
                          ? 'bg-violet-600 border-violet-700 text-white shadow-xs ring-2 ring-violet-300'
                          : (imageFilterCss && imageFilterCss !== 'none')
                          ? 'bg-violet-100 border-violet-400 text-violet-800 font-bold'
                          : 'bg-white hover:bg-violet-50 border-slate-200 hover:border-violet-300 text-violet-700'
                      }`}
                      title="Filtros y efectos de color"
                      aria-label="Filtros de color"
                    >
                      <SlidersHorizontal className="w-4.5 h-4.5" />
                    </button>

                    {/* 7. Crear con IA */}
                    <button
                      type="button"
                      id="btn-create-ai"
                      onClick={() => setActiveToolbarTool(activeToolbarTool === 'createAi' ? null : 'createAi')}
                      className={`w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center border shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer ${
                        activeToolbarTool === 'createAi'
                          ? 'bg-purple-600 border-purple-700 text-white shadow-xs ring-2 ring-purple-300'
                          : 'bg-white hover:bg-purple-50 border-slate-200 hover:border-purple-300 text-purple-700'
                      }`}
                      title="Crear imagen con IA automáticamente"
                      aria-label="Crear imagen con IA"
                    >
                      <Sparkles className="w-4.5 h-4.5 text-purple-600" />
                    </button>

                    {/* 8. Eliminar foto */}
                    <div className="shrink-0 pl-1 border-l border-slate-200 ml-auto">
                      <button
                        type="button"
                        id="btn-delete-photo"
                        onClick={() => {
                          if (!imageUrl && !videoUrl) {
                            setAutoAdjustToast('No hay archivo para eliminar');
                            setTimeout(() => setAutoAdjustToast(null), 2500);
                            return;
                          }
                          setShowDeleteConfirm(true);
                        }}
                        className="w-9 h-9 sm:w-9.5 sm:h-9.5 shrink-0 rounded-xl flex items-center justify-center bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-600 shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer"
                        title="Eliminar foto o video"
                        aria-label="Eliminar foto o video"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Resize / Zoom Slider Drawer */}
              {activeToolbarTool === 'resize' && (
                <div className="mt-3 p-3 rounded-2xl bg-gradient-to-b from-blue-50/80 to-slate-50 border border-blue-200/90 shadow-2xs space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Maximize2 className="w-4 h-4 text-[#007af7] shrink-0" />
                      <span className="text-xs font-bold text-slate-800">Escala y zoom</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveToolbarTool(null)}
                      className="text-xs text-slate-400 hover:text-slate-700 font-bold p-1 rounded-md cursor-pointer"
                      title="Cerrar"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-xs px-0.5">
                      <span className="text-slate-600 font-semibold text-[11px] flex items-center gap-1.5">
                        <span>
                          {isVideoTarget
                            ? 'Escala del video:'
                            : videoUrl
                            ? 'Escala de la portada fija:'
                            : 'Escala de imagen:'}
                        </span>
                        <span className="text-slate-400 font-normal">
                          {(isVideoTarget ? videoScale : resizeScale) > 1.01
                            ? 'Aumento'
                            : (isVideoTarget ? videoScale : resizeScale) < 0.99
                            ? 'Reducción'
                            : 'Original'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (isVideoTarget) {
                            if (videoScale !== 1) {
                              setVideoScale(1);
                              setAutoAdjustToast('Tamaño de video restablecido al 100%');
                              setTimeout(() => setAutoAdjustToast(null), 2000);
                            }
                          } else {
                            if (resizeScale !== 1) {
                              setResizeScale(1);
                              setAutoAdjustToast('Tamaño de portada restablecido al 100%');
                              setTimeout(() => setAutoAdjustToast(null), 2000);
                            }
                          }
                        }}
                        className={`text-xs font-black text-[#007af7] bg-blue-50 border border-blue-200/90 px-2.5 py-0.5 rounded-full tabular-nums shadow-2xs transition cursor-pointer`}
                      >
                        {Math.round((isVideoTarget ? videoScale : resizeScale) * 100)}%
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (isVideoTarget) {
                            setVideoScale((prev) => Math.max(0.4, parseFloat((prev - 0.05).toFixed(2))));
                          } else {
                            setResizeScale((prev) => Math.max(0.4, parseFloat((prev - 0.05).toFixed(2))));
                          }
                        }}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
                        title="Reducir tamaño (-5%)"
                        aria-label="Reducir"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>

                      <div className="flex-1 relative flex items-center">
                        <input
                          type="range"
                          id="input-resize-scale-slider"
                          min="0.4"
                          max="2.5"
                          step="0.01"
                          value={isVideoTarget ? videoScale : resizeScale}
                          onInput={(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            if (isVideoTarget) {
                              setVideoScale(val);
                            } else {
                              setResizeScale(val);
                            }
                          }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isVideoTarget) {
                              setVideoScale(val);
                            } else {
                              setResizeScale(val);
                            }
                          }}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#007af7]"
                          aria-label="Barra para ampliar o reducir"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isVideoTarget) {
                            setVideoScale((prev) => Math.min(2.5, parseFloat((prev + 0.05).toFixed(2))));
                          } else {
                            setResizeScale((prev) => Math.min(2.5, parseFloat((prev + 0.05).toFixed(2))));
                          }
                        }}
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
                        title="Ampliar tamaño (+5%)"
                        aria-label="Ampliar"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Media Framing & Crop Drawer */}
              {activeToolbarTool === 'crop' && (imageUrl || videoUrl) && (
                <div className="mt-3 p-3 rounded-2xl bg-gradient-to-b from-emerald-50/90 to-slate-50 border border-emerald-200/90 shadow-2xs space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Crop className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-800">
                        Encuadre y Proporción
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveToolbarTool(null)}
                      className="text-xs text-slate-400 hover:text-slate-700 font-bold p-1 rounded-md cursor-pointer"
                      title="Cerrar"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Fila 1: Opciones de formato 1:1, 4:5, 2:3, 9:16, 16:9 en una sola fila */}
                  <div className="grid grid-cols-5 gap-1 xs:gap-1.5 w-full">
                    {/* 1:1 */}
                    <button
                      type="button"
                      onClick={() => setPostAspectRatio('1:1')}
                      className={`py-1.5 px-1 rounded-xl text-center border transition cursor-pointer active:scale-95 flex flex-col items-center justify-center gap-1 ${
                        postAspectRatio === '1:1'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-1 ring-emerald-300'
                          : 'bg-white hover:bg-emerald-50/70 border-slate-200 text-slate-700'
                      }`}
                      title="1:1"
                    >
                      <div className={`w-4.5 h-4.5 rounded-[3px] border flex items-center justify-center shrink-0 ${
                        postAspectRatio === '1:1' ? 'border-white bg-white/25' : 'border-slate-400 bg-slate-100'
                      }`} />
                      <span className="text-[11px] font-black leading-none">1:1</span>
                    </button>

                    {/* 4:5 */}
                    <button
                      type="button"
                      onClick={() => setPostAspectRatio('4:5')}
                      className={`py-1.5 px-1 rounded-xl text-center border transition cursor-pointer active:scale-95 flex flex-col items-center justify-center gap-1 ${
                        postAspectRatio === '4:5'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-1 ring-emerald-300'
                          : 'bg-white hover:bg-emerald-50/70 border-slate-200 text-slate-700'
                      }`}
                      title="4:5"
                    >
                      <div className={`w-3.5 h-4.5 rounded-[3px] border flex items-center justify-center shrink-0 ${
                        postAspectRatio === '4:5' ? 'border-white bg-white/25' : 'border-slate-400 bg-slate-100'
                      }`} />
                      <span className="text-[11px] font-black leading-none">4:5</span>
                    </button>

                    {/* 2:3 */}
                    <button
                      type="button"
                      onClick={() => setPostAspectRatio('2:3')}
                      className={`py-1.5 px-1 rounded-xl text-center border transition cursor-pointer active:scale-95 flex flex-col items-center justify-center gap-1 ${
                        postAspectRatio === '2:3'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-1 ring-emerald-300'
                          : 'bg-white hover:bg-emerald-50/70 border-slate-200 text-slate-700'
                      }`}
                      title="2:3"
                    >
                      <div className={`w-3.5 h-5 rounded-[3px] border flex items-center justify-center shrink-0 ${
                        postAspectRatio === '2:3' ? 'border-white bg-white/25' : 'border-slate-400 bg-slate-100'
                      }`} />
                      <span className="text-[11px] font-black leading-none">2:3</span>
                    </button>

                    {/* 9:16 */}
                    <button
                      type="button"
                      onClick={() => {
                        setPostAspectRatio('9:16');
                        setImageFit('cover');
                        setVideoFit('cover');
                      }}
                      className={`py-1.5 px-1 rounded-xl text-center border transition cursor-pointer active:scale-95 flex flex-col items-center justify-center gap-1 ${
                        postAspectRatio === '9:16'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-1 ring-emerald-300'
                          : 'bg-white hover:bg-emerald-50/70 border-slate-200 text-slate-700'
                      }`}
                      title="9:16"
                    >
                      <div className={`w-3 h-5.5 rounded-[3px] border flex items-center justify-center shrink-0 ${
                        postAspectRatio === '9:16' ? 'border-white bg-white/25' : 'border-slate-400 bg-slate-100'
                      }`} />
                      <span className="text-[11px] font-black leading-none">9:16</span>
                    </button>

                    {/* 16:9 */}
                    <button
                      type="button"
                      onClick={() => setPostAspectRatio('16:9')}
                      className={`py-1.5 px-1 rounded-xl text-center border transition cursor-pointer active:scale-95 flex flex-col items-center justify-center gap-1 ${
                        postAspectRatio === '16:9'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-1 ring-emerald-300'
                          : 'bg-white hover:bg-emerald-50/70 border-slate-200 text-slate-700'
                      }`}
                      title="16:9"
                    >
                      <div className={`w-5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 ${
                        postAspectRatio === '16:9' ? 'border-white bg-white/25' : 'border-slate-400 bg-slate-100'
                      }`} />
                      <span className="text-[11px] font-black leading-none">16:9</span>
                    </button>
                  </div>

                  {/* Fila 2: En la parte de abajo en una segunda fila las opciones de difuminado y fondo fijo */}
                  <div className="grid grid-cols-2 gap-1.5 xs:gap-2 w-full pt-1 border-t border-emerald-200/50">
                    {/* Difuminado */}
                    <button
                      type="button"
                      onClick={() => setMediaBgFill('blur')}
                      className={`p-2 xs:p-2.5 rounded-xl border transition cursor-pointer active:scale-95 flex items-center gap-2 ${
                        mediaBgFill === 'blur'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-1 ring-emerald-300'
                          : 'bg-white hover:bg-emerald-50/60 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        mediaBgFill === 'blur' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-bold text-[11px] xs:text-xs leading-tight truncate">Difuminado</div>
                        <div className={`text-[9.5px] leading-tight truncate ${
                          mediaBgFill === 'blur' ? 'text-emerald-100' : 'text-slate-400'
                        }`}>Bordes suaves</div>
                      </div>
                    </button>

                    {/* Fondo Fijo */}
                    <button
                      type="button"
                      onClick={() => setMediaBgFill('fixed')}
                      className={`p-2 xs:p-2.5 rounded-xl border transition cursor-pointer active:scale-95 flex items-center gap-2 ${
                        mediaBgFill === 'fixed'
                          ? 'bg-[#001D4A] text-white border-blue-400 shadow-sm ring-1 ring-blue-300'
                          : 'bg-white hover:bg-blue-50/60 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        mediaBgFill === 'fixed' ? 'bg-blue-600/40 text-blue-200' : 'bg-slate-100 text-[#001D4A]'
                      }`}>
                        <span className="w-3 h-3 rounded-full bg-[#001D4A] border border-white/60 shadow-2xs inline-block" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-bold text-[11px] xs:text-xs leading-tight truncate">Fondo Fijo</div>
                        <div className={`text-[9.5px] leading-tight truncate ${
                          mediaBgFill === 'fixed' ? 'text-blue-200' : 'text-slate-400'
                        }`}>Azul OleVeci</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* 5. Compact AI Enhancer Drawer */}
              {activeToolbarTool === 'enhance' && (
                <div className="mt-3 p-3 rounded-2xl bg-gradient-to-b from-amber-50/60 to-slate-50 border border-amber-200/90 shadow-2xs space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Wand2 className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-900">
                        Mejora con Inteligencia Artificial
                      </span>
                      <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        Super HD 2X
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveToolbarTool(null)}
                      className="text-xs text-slate-400 hover:text-slate-700 font-bold p-1 rounded-md cursor-pointer"
                      title="Cerrar opciones"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEnhancementMode('sharpness')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition text-center cursor-pointer border ${
                        enhancementMode === 'sharpness'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs font-bold'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      Super Nitidez
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnhancementMode('vivid')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition text-center cursor-pointer border ${
                        enhancementMode === 'vivid'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs font-bold'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      Color & Gourmet
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnhancementMode('contrast')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition text-center cursor-pointer border ${
                        enhancementMode === 'contrast'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs font-bold'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      Contraste Pro
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-apply-ai-enhance-post"
                      disabled={isEnhancing || !imageUrl}
                      onClick={handleEnhanceWithAi}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                        isEnhancing || !imageUrl
                          ? 'bg-amber-200 text-slate-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white active:scale-99'
                      }`}
                    >
                      {isEnhancing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{enhancingStep || 'Mejorando imagen...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                          <span>{isEnhanced ? 'Re-aplicar mejora con IA' : '✨ Mejorar foto con IA'}</span>
                        </>
                      )}
                    </button>

                    {isEnhanced && originalImageUrl && (
                      <button
                        type="button"
                        onClick={handleRevertToOriginal}
                        className="py-2 px-3 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1 cursor-pointer shrink-0"
                        title="Restaurar foto original sin modificaciones"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Original</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 6. Photo Filters Drawer */}
              {activeToolbarTool === 'filters' && (
                <div className="mt-3 p-3 rounded-2xl bg-gradient-to-b from-violet-50/90 to-slate-50 border border-violet-200/90 shadow-2xs space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <SlidersHorizontal className="w-4 h-4 text-violet-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-900 truncate">
                        Filtros y Efectos
                      </span>
                      {activeFilterId !== 'none' && (
                        <span className="text-[10px] font-extrabold text-violet-800 bg-violet-100/90 px-2 py-0.5 rounded-full border border-violet-200 shrink-0">
                          {PHOTO_FILTERS.find((f) => f.id === activeFilterId)?.name || 'Activo'}
                          {filterIntensity < 100 ? ` (${filterIntensity}%)` : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {(activeFilterId !== 'none' ||
                        filterAdjustments.brightness !== 100 ||
                        filterAdjustments.contrast !== 100 ||
                        filterAdjustments.saturation !== 100 ||
                        filterAdjustments.warmth !== 0) && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          title="Restablecer a colores originales"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-400" />
                          <span>Original</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveToolbarTool(null)}
                        className="text-xs text-slate-400 hover:text-slate-700 font-bold p-1 rounded-md cursor-pointer"
                        title="Cerrar filtros"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Presets Horizontal Scrollable Carousel */}
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => scrollFilterCarousel('left')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 z-10 w-6 h-6 rounded-full bg-white/95 hover:bg-white text-slate-700 shadow-md border border-slate-200 flex items-center justify-center transition cursor-pointer hover:scale-110 active:scale-95"
                      title="Desplazar a la izquierda"
                      aria-label="Ver filtros anteriores"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => scrollFilterCarousel('right')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1.5 z-10 w-6 h-6 rounded-full bg-white/95 hover:bg-white text-slate-700 shadow-md border border-slate-200 flex items-center justify-center transition cursor-pointer hover:scale-110 active:scale-95"
                      title="Desplazar a la derecha"
                      aria-label="Ver más filtros"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div
                      ref={filterCarouselRef}
                      className="flex items-center gap-2 overflow-x-auto px-2 pb-1.5 pt-0.5 scroll-smooth touch-pan-x scrollbar-thin scrollbar-thumb-violet-300 scrollbar-track-transparent"
                    >
                      {PHOTO_FILTERS.map((preset) => {
                        const isSelected = activeFilterId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelectFilterPreset(preset.id)}
                            className={`flex flex-col items-center gap-1 p-1 rounded-xl transition-transform duration-100 cursor-pointer shrink-0 select-none ${
                              isSelected
                                ? 'bg-white shadow-xs ring-2 ring-violet-500 scale-102'
                                : 'hover:bg-white/70 opacity-85 hover:opacity-100'
                            }`}
                          >
                            <div
                              className={`w-11 h-11 rounded-lg overflow-hidden border relative bg-slate-200 shadow-2xs ${
                                isSelected ? 'border-violet-500' : 'border-slate-300'
                              }`}
                            >
                              {filterThumbnailUrl || imageUrl ? (
                                <img
                                  src={filterThumbnailUrl || imageUrl}
                                  alt={preset.name}
                                  loading="lazy"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover pointer-events-none"
                                  style={{
                                    filter: preset.filter !== 'none' ? preset.filter : undefined,
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-slate-400">
                                  Aa
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute inset-0 bg-violet-600/15 flex items-center justify-center">
                                  <div className="w-3.5 h-3.5 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-xs">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[10px] leading-none text-center truncate max-w-[54px] ${
                                isSelected ? 'font-black text-violet-900' : 'font-medium text-slate-700'
                              }`}
                            >
                              {preset.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Intensity Slider */}
                  {activeFilterId !== 'none' && (
                    <div className="p-2 rounded-xl bg-white border border-violet-100 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-700">Intensidad del filtro:</span>
                        <span className="font-bold text-violet-700">{filterIntensity}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={filterIntensity}
                        onChange={(e) => handleIntensityChange(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        aria-label="Intensidad del filtro"
                      />
                    </div>
                  )}

                  {/* Toggleable Advanced Light & Color Adjustments */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedAdjustments(!showAdvancedAdjustments)}
                      className="w-full py-1 px-2 rounded-lg bg-white/80 hover:bg-white border border-slate-200/90 text-slate-700 hover:text-slate-900 text-[11px] font-bold flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3 h-3 text-violet-600" />
                        <span>Ajustes finos (Brillo, Contraste, Saturación, Calidez)</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {showAdvancedAdjustments ? 'Ocultar ▲' : 'Ajustar ▼'}
                      </span>
                    </button>

                    {showAdvancedAdjustments && (
                      <div className="mt-2 p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-2 animate-in fade-in">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                            <span>Brillo</span>
                            <span className="font-bold text-slate-800">
                              {filterAdjustments.brightness > 100
                                ? `+${filterAdjustments.brightness - 100}%`
                                : `${filterAdjustments.brightness - 100}%`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="70"
                            max="130"
                            step="2"
                            value={filterAdjustments.brightness}
                            onChange={(e) => handleAdjustmentChange('brightness', parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                            <span>Contraste</span>
                            <span className="font-bold text-slate-800">
                              {filterAdjustments.contrast > 100
                                ? `+${filterAdjustments.contrast - 100}%`
                                : `${filterAdjustments.contrast - 100}%`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="70"
                            max="130"
                            step="2"
                            value={filterAdjustments.contrast}
                            onChange={(e) => handleAdjustmentChange('contrast', parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                            <span>Saturación de color</span>
                            <span className="font-bold text-slate-800">
                              {filterAdjustments.saturation > 100
                                ? `+${filterAdjustments.saturation - 100}%`
                                : `${filterAdjustments.saturation - 100}%`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="170"
                            step="5"
                            value={filterAdjustments.saturation}
                            onChange={(e) => handleAdjustmentChange('saturation', parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                            <span>Calidez dorada</span>
                            <span className="font-bold text-slate-800">
                              {filterAdjustments.warmth > 0 ? `+${filterAdjustments.warmth}%` : '0%'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            step="5"
                            value={filterAdjustments.warmth}
                            onChange={(e) => handleAdjustmentChange('warmth', parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 7. Create with AI Drawer */}
              {activeToolbarTool === 'createAi' && (
                <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-b from-purple-50/90 to-slate-50 border border-purple-200/90 shadow-2xs space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-900">
                        Crear imagen con Inteligencia Artificial
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveToolbarTool(null)}
                      className="text-xs text-slate-400 hover:text-slate-700 font-bold p-1 rounded-md cursor-pointer"
                      title="Cerrar"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-tight">
                    Escribe brevemente qué imagen quieres para tu publicación y se creará automáticamente:
                  </p>

                  <div className="space-y-2">
                    <div className="relative">
                      <textarea
                        rows={2}
                        value={aiCreatePrompt}
                        onChange={(e) => setAiCreatePrompt(e.target.value)}
                        placeholder="Ej: Deliciosa hamburguesa artesanal con queso derretido, papas rústicas y gaseosa bien fría..."
                        className="w-full text-xs px-3 py-2 rounded-xl border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800 placeholder:text-slate-400 resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-purple-700 block">Ideas rápidas:</span>
                      <div className="flex flex-wrap gap-1">
                        {[
                          'Hamburguesa artesanal con papas',
                          'Pizza crocante a la leña con queso',
                          'Plato del día con ensalada fresca',
                          'Café espresso y postre de chocolate',
                          'Corte de cabello moderno en barbería',
                          'Ropa de moda y accesorios en tienda',
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              setAiCreatePrompt(suggestion);
                              if (lastGeneratedPrompt !== suggestion) {
                                setAiVariationIndex(0);
                              }
                            }}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white hover:bg-purple-100 text-purple-800 border border-purple-200 transition cursor-pointer"
                          >
                            + {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>

                    {aiGeneratedCategory && lastGeneratedPrompt && lastGeneratedPrompt.toLowerCase() === aiCreatePrompt.trim().toLowerCase() && (
                      <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-purple-100/80 border border-purple-200 text-purple-950">
                        <span className="font-semibold truncate">
                          ✨ {aiGeneratedCategory}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-200/90 text-purple-900 shrink-0 ml-2">
                          Versión {aiVariationIndex + 1}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      id="btn-generate-ai-image-submit"
                      disabled={isGeneratingAiImage || !aiCreatePrompt.trim()}
                      onClick={() => handleGenerateAiImage(lastGeneratedPrompt.trim().toLowerCase() === aiCreatePrompt.trim().toLowerCase())}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                        isGeneratingAiImage || !aiCreatePrompt.trim()
                          ? 'bg-purple-200 text-slate-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white active:scale-99'
                      }`}
                    >
                      {isGeneratingAiImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generando con IA...</span>
                        </>
                      ) : lastGeneratedPrompt && lastGeneratedPrompt.trim().toLowerCase() === aiCreatePrompt.trim().toLowerCase() ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Regenerar otra versión con IA</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Crear imagen con IA automáticamente</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}


            </div>
          </div>

          {/* ======================================================== */}
          {/* CONFIGURACIÓN ADICIONAL DE LA PUBLICACIÓN (AL FINAL)     */}
          {/* ======================================================== */}
          {/* ======================================================== */}
          {/* CONFIGURACIÓN ADICIONAL DE LA PUBLICACIÓN (AL FINAL)     */}
          {/* ======================================================== */}
          <div className={`bg-white rounded-3xl border border-slate-200 shadow-xs transition-all ${
            isConfigAdicionalOpen
              ? (isTypeDropdownOpen || isCategoryDropdownOpen || isPlanCategoryDropdownOpen
                  ? 'p-4 sm:p-5 space-y-4 pb-64 sm:pb-72'
                  : 'p-4 sm:p-5 space-y-4 pb-6')
              : 'p-3.5 sm:p-4'
          }`}>
            <button
              type="button"
              onClick={() => setIsConfigAdicionalOpen((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group select-none"
              aria-expanded={isConfigAdicionalOpen}
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-900">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#007af7] to-[#041f5e] text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <span className="text-[#041f5e]">Configuración adicional de la publicación</span>
              </div>
              <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-blue-50 text-slate-500 group-hover:text-[#007af7] flex items-center justify-center transition-colors shrink-0">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isConfigAdicionalOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isConfigAdicionalOpen && (
              <div className="space-y-4 pt-0.5">
                {/* 1. Tipo de Publicación */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                    Tipo de publicación
                  </label>
                  <div ref={typeDropdownRef} className="relative">
                    <button
                      type="button"
                      id="post-type-dropdown-trigger"
                      onClick={() => {
                        setIsTypeDropdownOpen((prev) => !prev);
                        setIsCategoryDropdownOpen(false);
                        setIsPlanCategoryDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all shadow-2xs cursor-pointer ${
                        isTypeDropdownOpen
                          ? 'border-[#007af7] ring-2 ring-[#007af7]/20 bg-white'
                          : 'border-slate-300 hover:border-[#007af7]/60 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                          {getPostTypeEmoji(type)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {activePostTypeConfig.label}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {activePostTypeConfig.description}
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                          isTypeDropdownOpen ? 'rotate-180 text-[#007af7]' : ''
                        }`}
                      />
                    </button>

                    {isTypeDropdownOpen && (
                      <div
                        id="post-type-menu"
                        className="absolute left-0 right-0 top-full mt-2 z-60 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-2 space-y-1 max-h-64 sm:max-h-72 overflow-y-auto"
                      >
                        {postTypes.map((item) => {
                          const isSelected = type === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setType(item.id as PostType);
                                setIsTypeDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.99] group ${
                                isSelected
                                  ? 'bg-blue-50/80 text-blue-900 border border-blue-200/80 font-medium'
                                  : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                {/* Indicator at the beginning of the option */}
                                <div
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected
                                      ? 'bg-[#007af7] border-[#007af7] text-white shadow-2xs'
                                      : 'border-slate-300 bg-white group-hover:border-[#007af7]/60'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>

                                <div className="w-7 h-7 rounded-lg bg-slate-50 text-base flex items-center justify-center shrink-0">
                                  {getPostTypeEmoji(item.id)}
                                </div>
                                <div className="truncate">
                                  <span className="text-xs font-bold block text-slate-800">
                                    {item.label}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    {item.description}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Categoría en Explorar */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                    Categoría en explorar
                  </label>
                  <div ref={categoryDropdownRef} className="relative">
                    <button
                      type="button"
                      id="category-dropdown-trigger"
                      onClick={() => {
                        setIsCategoryDropdownOpen((prev) => !prev);
                        setCategorySearchQuery('');
                        setIsTypeDropdownOpen(false);
                        setIsPlanCategoryDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all shadow-2xs cursor-pointer ${
                        isCategoryDropdownOpen
                          ? 'border-[#007af7] ring-2 ring-[#007af7]/20 bg-white'
                          : 'border-slate-300 hover:border-[#007af7]/60 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                          {getCategoryEmoji(categories.find((c) => c.id === categoryId))}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {categories.find((c) => c.id === categoryId)?.name || 'Selecciona categoría'}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            Categoría pública para clientes
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                          isCategoryDropdownOpen ? 'rotate-180 text-[#007af7]' : ''
                        }`}
                      />
                    </button>

                    {isCategoryDropdownOpen && (
                      <div
                        id="category-menu"
                        className="absolute left-0 right-0 top-full mt-2 z-60 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                      >
                        {/* Quick Search */}
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={categorySearchQuery}
                              onChange={(e) => setCategorySearchQuery(e.target.value)}
                              placeholder="Buscar categoría..."
                              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#007af7] focus:ring-2 focus:ring-[#007af7]/15"
                              autoFocus
                            />
                            {categorySearchQuery && (
                              <button
                                type="button"
                                onClick={() => setCategorySearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Scrollable list */}
                        <div className="max-h-64 sm:max-h-72 overflow-y-auto p-2 space-y-1">
                          {categories
                            .filter((c) =>
                              c.name.toLowerCase().includes(categorySearchQuery.trim().toLowerCase())
                            )
                            .map((c) => {
                              const isSelected = categoryId === c.id;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setCategoryId(c.id);
                                    setIsCategoryDropdownOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.99] group ${
                                    isSelected
                                      ? 'bg-blue-50/90 text-blue-900 border border-blue-200/90 font-medium'
                                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    {/* Indicator at the beginning of the option */}
                                    <div
                                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected
                                          ? 'bg-[#007af7] border-[#007af7] text-white shadow-2xs'
                                          : 'border-slate-300 bg-white group-hover:border-[#007af7]/60'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>

                                    <div className="w-7 h-7 rounded-lg bg-slate-50 text-base flex items-center justify-center shrink-0">
                                      {getCategoryEmoji(c)}
                                    </div>
                                    <span className="text-xs font-bold text-slate-800 truncate">
                                      {c.name}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          {categories.filter((c) =>
                            c.name.toLowerCase().includes(categorySearchQuery.trim().toLowerCase())
                          ).length === 0 && (
                            <div className="py-6 text-center text-xs text-slate-400">
                              No se encontraron categorías
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Tipos de Plan */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-900">
                      Tipos de Plan
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {planCategoryIds.length === 0
                        ? 'Puedes seleccionar uno o varios tipos de plan'
                        : `${planCategoryIds.length} seleccionado${planCategoryIds.length === 1 ? '' : 's'}`}
                    </span>
                  </div>

                  <div ref={planCategoryDropdownRef} className="relative">
                    <button
                      type="button"
                      id="plan-category-dropdown-trigger"
                      onClick={() => {
                        setIsPlanCategoryDropdownOpen((prev) => !prev);
                        setIsTypeDropdownOpen(false);
                        setIsCategoryDropdownOpen(false);
                        setIsPlanRoleDropdownOpen(false);
                        setIsTargetAudienceDropdownOpen(false);
                        setIsPriceScopeDropdownOpen(false);
                        setPlanCategorySearchQuery('');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all shadow-2xs cursor-pointer ${
                        isPlanCategoryDropdownOpen
                          ? 'border-[#007af7] ring-2 ring-[#007af7]/20 bg-white'
                          : planCategoryIds.length > 0
                          ? 'border-[#007af7]/50 bg-blue-50/30 hover:bg-blue-50/50'
                          : 'border-slate-300 hover:border-[#007af7]/60 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                        {(() => {
                          if (planCategoryIds.length === 0) {
                            return (
                              <>
                                <div className="w-7 h-7 rounded-lg bg-slate-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                                  🧭
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-700 truncate">
                                    Seleccionar Tipos de Plan
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    Elige una o más experiencias para este plan o salida
                                  </div>
                                </div>
                              </>
                            );
                          }

                          if (planCategoryIds.length === 1) {
                            const selPlan = planCategories.find((p) => p.id === planCategoryIds[0]);
                            return (
                              <>
                                <div className="w-7 h-7 rounded-lg bg-slate-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                                  {getPlanCategoryEmoji(selPlan)}
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-800 truncate">
                                    {selPlan?.name || 'Tipo de plan asignado'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    1 tipo de plan seleccionado (puedes agregar más)
                                  </div>
                                </div>
                              </>
                            );
                          }

                          const selectedNames = planCategories
                            .filter((p) => planCategoryIds.includes(p.id))
                            .map((p) => p.name);

                          return (
                            <>
                              <div className="w-7 h-7 rounded-lg bg-[#007af7] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                                {planCategoryIds.length}
                              </div>
                              <div className="truncate">
                                <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                                  <span>{planCategoryIds.length} tipos de plan asignados</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {selectedNames.join(', ')}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {planCategoryIds.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007af7] text-white">
                            {planCategoryIds.length}
                          </span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                            isPlanCategoryDropdownOpen ? 'rotate-180 text-[#007af7]' : ''
                          }`}
                        />
                      </div>
                    </button>


                    {/* Modern Elevated Dropdown with Search, Actions & Checkboxes */}
                    {isPlanCategoryDropdownOpen && (
                      <div
                        id="plan-category-menu"
                        className="absolute left-0 right-0 top-full mt-2 z-60 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                      >
                        {/* Quick Search */}
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={planCategorySearchQuery}
                              onChange={(e) => setPlanCategorySearchQuery(e.target.value)}
                              placeholder="Buscar tipo de plan..."
                              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#007af7] focus:ring-2 focus:ring-[#007af7]/15"
                              autoFocus
                            />
                            {planCategorySearchQuery && (
                              <button
                                type="button"
                                onClick={() => setPlanCategorySearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Fast selection helpers */}
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60 text-[11px]">
                            <span className="font-bold text-slate-600">
                              {planCategoryIds.length === 0
                                ? 'Ninguno seleccionado'
                                : `${planCategoryIds.length} seleccionado${planCategoryIds.length === 1 ? '' : 's'}`}
                            </span>
                            <div className="flex items-center gap-2">
                              {planCategoryIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleClearPlanCategories}
                                  className="font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                                >
                                  Deseleccionar todos
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={handleSelectAllPlanCategories}
                                className="font-bold text-[#007af7] hover:text-blue-700 hover:underline cursor-pointer"
                              >
                                Seleccionar todos
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Scrollable list with multi-select checkboxes */}
                        <div className="max-h-64 sm:max-h-72 overflow-y-auto p-2 space-y-1">
                          {planCategories
                            .filter((p) =>
                              p.name.toLowerCase().includes(planCategorySearchQuery.trim().toLowerCase()) ||
                              (p.subtitle && p.subtitle.toLowerCase().includes(planCategorySearchQuery.trim().toLowerCase()))
                            )
                            .map((p) => {
                              const isSelected = planCategoryIds.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleTogglePlanCategory(p.id)}
                                  className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.99] group ${
                                    isSelected
                                      ? 'bg-blue-50/90 text-blue-900 border border-blue-200/90 font-medium'
                                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    {/* Checkbox indicator */}
                                    <div
                                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected
                                          ? 'bg-[#007af7] border-[#007af7] text-white shadow-2xs'
                                          : 'border-slate-300 bg-white group-hover:border-[#007af7]/60'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>

                                    <div className="w-7 h-7 rounded-lg bg-slate-50 text-base flex items-center justify-center shrink-0">
                                      {getPlanCategoryEmoji(p)}
                                    </div>
                                    <div className="truncate">
                                      <span className="text-xs font-bold text-slate-800 block truncate">
                                        {p.name}
                                      </span>
                                      {p.subtitle && (
                                        <span className="text-[10px] text-slate-400 block truncate">
                                          {p.subtitle}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          {planCategories.filter((p) =>
                            p.name.toLowerCase().includes(planCategorySearchQuery.trim().toLowerCase()) ||
                            (p.subtitle && p.subtitle.toLowerCase().includes(planCategorySearchQuery.trim().toLowerCase()))
                          ).length === 0 && (
                            <div className="py-6 text-center text-xs text-slate-400">
                              No se encontraron tipos de planes
                            </div>
                          )}
                        </div>

                        {/* Bottom Action Bar inside Dropdown */}
                        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {planCategoryIds.length === 0
                              ? 'Sin selección (Opcional)'
                              : `${planCategoryIds.length} seleccionado${planCategoryIds.length === 1 ? '' : 's'}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsPlanCategoryDropdownOpen(false)}
                            className="px-4 py-1.5 rounded-xl bg-[#007af7] hover:bg-blue-600 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98"
                          >
                            Listo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Momento del Plan sugerido (Agente Oli) - Multi-select Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-900">
                      Momento del Plan
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {planRoles.length === 0
                        ? 'Puedes seleccionar uno o varios momentos'
                        : `${planRoles.length} seleccionado${planRoles.length === 1 ? '' : 's'}`}
                    </span>
                  </div>

                  <div ref={planRoleDropdownRef} className="relative">
                    <button
                      type="button"
                      id="plan-role-dropdown-trigger"
                      onClick={() => {
                        setIsPlanRoleDropdownOpen((prev) => !prev);
                        setIsTypeDropdownOpen(false);
                        setIsCategoryDropdownOpen(false);
                        setIsPlanCategoryDropdownOpen(false);
                        setIsTargetAudienceDropdownOpen(false);
                        setIsPriceScopeDropdownOpen(false);
                        setPlanRoleSearchQuery('');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all shadow-2xs cursor-pointer ${
                        isPlanRoleDropdownOpen
                          ? 'border-[#007af7] ring-2 ring-[#007af7]/20 bg-white'
                          : planRoles.length > 0
                          ? 'border-[#007af7]/50 bg-blue-50/30 hover:bg-blue-50/50'
                          : 'border-slate-300 hover:border-[#007af7]/60 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                        {(() => {
                          if (planRoles.length === 0) {
                            return (
                              <>
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                                  ⏰
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-700 truncate">
                                    Seleccionar Momento del Plan
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    Elige en qué horarios o momentos recomendar este anuncio
                                  </div>
                                </div>
                              </>
                            );
                          }

                          if (planRoles.length === 1) {
                            const selRole = effectivePlanRoles.find((r) => r.id === planRoles[0]);
                            return (
                              <>
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                                  {getRoleEmoji(selRole)}
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-800 truncate">
                                    {selRole?.label || 'Momento asignado'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    1 momento seleccionado (puedes agregar más)
                                  </div>
                                </div>
                              </>
                            );
                          }

                          const selectedNames = effectivePlanRoles
                            .filter((r) => planRoles.includes(r.id))
                            .map((r) => r.label);

                          return (
                            <>
                              <div className="w-7 h-7 rounded-lg bg-[#007af7] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                                {planRoles.length}
                              </div>
                              <div className="truncate">
                                <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                                  <span>{planRoles.length} momentos del plan asignados</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {selectedNames.join(', ')}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {planRoles.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007af7] text-white">
                            {planRoles.length}
                          </span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                            isPlanRoleDropdownOpen ? 'rotate-180 text-[#007af7]' : ''
                          }`}
                        />
                      </div>
                    </button>


                    {/* Modern Elevated Dropdown with Search, Actions & Checkboxes */}
                    {isPlanRoleDropdownOpen && (
                      <div
                        id="plan-role-menu"
                        className="absolute left-0 right-0 top-full mt-2 z-60 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                      >
                        {/* Quick Search */}
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={planRoleSearchQuery}
                              onChange={(e) => setPlanRoleSearchQuery(e.target.value)}
                              placeholder="Buscar momento del plan..."
                              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#007af7] focus:ring-2 focus:ring-[#007af7]/15"
                              autoFocus
                            />
                            {planRoleSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setPlanRoleSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Fast selection helpers */}
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60 text-[11px]">
                            <span className="font-bold text-slate-600">
                              {planRoles.length === 0
                                ? 'Ninguno seleccionado (Auto)'
                                : `${planRoles.length} seleccionado${planRoles.length === 1 ? '' : 's'}`}
                            </span>
                            <div className="flex items-center gap-2">
                              {planRoles.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleClearPlanRoles}
                                  className="font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                                >
                                  Deseleccionar todos
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={handleSelectAllPlanRoles}
                                className="font-bold text-[#007af7] hover:text-blue-700 hover:underline cursor-pointer"
                              >
                                Seleccionar todos
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Scrollable list with multi-select checkboxes */}
                        <div className="max-h-64 sm:max-h-72 overflow-y-auto p-2 space-y-1">
                          {effectivePlanRoles
                            .filter((r) =>
                              r.label.toLowerCase().includes(planRoleSearchQuery.trim().toLowerCase()) ||
                              r.subtitle.toLowerCase().includes(planRoleSearchQuery.trim().toLowerCase())
                            )
                            .map((r) => {
                              const isSelected = planRoles.includes(r.id);
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => handleTogglePlanRole(r.id)}
                                  className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.99] group ${
                                    isSelected
                                      ? 'bg-blue-50/90 text-blue-900 border border-blue-200/90 font-medium'
                                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    {/* Checkbox indicator */}
                                    <div
                                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected
                                          ? 'bg-[#007af7] border-[#007af7] text-white shadow-2xs'
                                          : 'border-slate-300 bg-white group-hover:border-[#007af7]/60'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>

                                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-base flex items-center justify-center shrink-0">
                                      {getRoleEmoji(r)}
                                    </div>
                                    <div className="truncate">
                                      <span className="text-xs font-bold text-slate-800 block truncate">
                                        {r.label}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block truncate">
                                        {r.subtitle}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          {effectivePlanRoles.filter((r) =>
                            r.label.toLowerCase().includes(planRoleSearchQuery.trim().toLowerCase()) ||
                            r.subtitle.toLowerCase().includes(planRoleSearchQuery.trim().toLowerCase())
                          ).length === 0 && (
                            <div className="py-6 text-center text-xs text-slate-400">
                              No se encontraron momentos
                            </div>
                          )}
                        </div>

                        {/* Bottom Action Bar inside Dropdown */}
                        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {planRoles.length === 0
                              ? 'Sin selección (Auto por Oli)'
                              : `${planRoles.length} seleccionado${planRoles.length === 1 ? '' : 's'}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsPlanRoleDropdownOpen(false)}
                            className="px-4 py-1.5 rounded-xl bg-[#007af7] hover:bg-blue-600 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98"
                          >
                            Listo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Público Objetivo para Oli - Multi-select Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-900">
                      Público Objetivo
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {targetAudience.length === 0
                        ? 'Puedes seleccionar uno o varios públicos'
                        : `${targetAudience.length} seleccionado${targetAudience.length === 1 ? '' : 's'}`}
                    </span>
                  </div>

                  <div ref={targetAudienceDropdownRef} className="relative">
                    <button
                      type="button"
                      id="target-audience-dropdown-trigger"
                      onClick={() => {
                        setIsTargetAudienceDropdownOpen((prev) => !prev);
                        setIsTypeDropdownOpen(false);
                        setIsCategoryDropdownOpen(false);
                        setIsPlanCategoryDropdownOpen(false);
                        setIsPlanRoleDropdownOpen(false);
                        setIsPriceScopeDropdownOpen(false);
                        setTargetAudienceSearchQuery('');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all shadow-2xs cursor-pointer ${
                        isTargetAudienceDropdownOpen
                          ? 'border-[#007af7] ring-2 ring-[#007af7]/20 bg-white'
                          : targetAudience.length > 0
                          ? 'border-[#007af7]/50 bg-blue-50/30 hover:bg-blue-50/50'
                          : 'border-slate-300 hover:border-[#007af7]/60 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                        {(() => {
                          if (targetAudience.length === 0) {
                            return (
                              <>
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                                  👥
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-700 truncate">
                                    Seleccionar Público Objetivo
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    Elige a quién o qué tipo de grupo está dirigida la experiencia
                                  </div>
                                </div>
                              </>
                            );
                          }

                          if (targetAudience.length === 1) {
                            const selAud = effectiveTargetAudiences.find((a) => a.id === targetAudience[0]);
                            return (
                              <>
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                                  {getAudienceEmoji(selAud)}
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-800 truncate">
                                    {selAud?.label || 'Público asignado'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    1 público seleccionado (puedes agregar más)
                                  </div>
                                </div>
                              </>
                            );
                          }

                          const selectedNames = effectiveTargetAudiences
                            .filter((a) => targetAudience.includes(a.id))
                            .map((a) => a.label);

                          return (
                            <>
                              <div className="w-7 h-7 rounded-lg bg-[#007af7] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                                {targetAudience.length}
                              </div>
                              <div className="truncate">
                                <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                                  <span>{targetAudience.length} públicos asignados</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {selectedNames.join(', ')}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {targetAudience.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007af7] text-white">
                            {targetAudience.length}
                          </span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                            isTargetAudienceDropdownOpen ? 'rotate-180 text-[#007af7]' : ''
                          }`}
                        />
                      </div>
                    </button>


                    {/* Modern Elevated Dropdown with Search, Actions & Checkboxes */}
                    {isTargetAudienceDropdownOpen && (
                      <div
                        id="target-audience-menu"
                        className="absolute left-0 right-0 top-full mt-2 z-60 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                      >
                        {/* Quick Search */}
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={targetAudienceSearchQuery}
                              onChange={(e) => setTargetAudienceSearchQuery(e.target.value)}
                              placeholder="Buscar público objetivo..."
                              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#007af7] focus:ring-2 focus:ring-[#007af7]/15"
                              autoFocus
                            />
                            {targetAudienceSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setTargetAudienceSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Fast selection helpers */}
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60 text-[11px]">
                            <span className="font-bold text-slate-600">
                              {targetAudience.length === 0
                                ? 'Ninguno seleccionado'
                                : `${targetAudience.length} seleccionado${targetAudience.length === 1 ? '' : 's'}`}
                            </span>
                            <div className="flex items-center gap-2">
                              {targetAudience.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleClearTargetAudience}
                                  className="font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                                >
                                  Deseleccionar todos
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={handleSelectAllTargetAudience}
                                className="font-bold text-[#007af7] hover:text-blue-700 hover:underline cursor-pointer"
                              >
                                Seleccionar todos
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Scrollable list with multi-select checkboxes */}
                        <div className="max-h-64 sm:max-h-72 overflow-y-auto p-2 space-y-1">
                          {effectiveTargetAudiences
                            .filter((a) =>
                              a.label.toLowerCase().includes(targetAudienceSearchQuery.trim().toLowerCase()) ||
                              a.subtitle.toLowerCase().includes(targetAudienceSearchQuery.trim().toLowerCase())
                            )
                            .map((a) => {
                              const isSelected = targetAudience.includes(a.id);
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => handleToggleTargetAudience(a.id)}
                                  className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.99] group ${
                                    isSelected
                                      ? 'bg-blue-50/90 text-blue-900 border border-blue-200/90 font-medium'
                                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    {/* Checkbox indicator */}
                                    <div
                                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected
                                          ? 'bg-[#007af7] border-[#007af7] text-white shadow-2xs'
                                          : 'border-slate-300 bg-white group-hover:border-[#007af7]/60'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>

                                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-base flex items-center justify-center shrink-0">
                                      {getAudienceEmoji(a)}
                                    </div>
                                    <div className="truncate">
                                      <span className="text-xs font-bold text-slate-800 block truncate">
                                        {a.label}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block truncate">
                                        {a.subtitle}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          {effectiveTargetAudiences.filter((a) =>
                            a.label.toLowerCase().includes(targetAudienceSearchQuery.trim().toLowerCase()) ||
                            a.subtitle.toLowerCase().includes(targetAudienceSearchQuery.trim().toLowerCase())
                          ).length === 0 && (
                            <div className="py-6 text-center text-xs text-slate-400">
                              No se encontraron públicos
                            </div>
                          )}
                        </div>

                        {/* Bottom Action Bar inside Dropdown */}
                        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {targetAudience.length === 0
                              ? 'Sin selección'
                              : `${targetAudience.length} seleccionado${targetAudience.length === 1 ? '' : 's'}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsTargetAudienceDropdownOpen(false)}
                            className="px-4 py-1.5 rounded-xl bg-[#007af7] hover:bg-blue-600 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98"
                          >
                            Listo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Cobertura y Modalidad de Precio - Multi-select Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-900">
                      Cobertura y Modalidad de Precio
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {priceScopes.length === 0
                        ? 'Puedes seleccionar una o varias modalidades'
                        : `${priceScopes.length} seleccionada${priceScopes.length === 1 ? '' : 's'}`}
                    </span>
                  </div>

                  {/* Multi-select Dropdown for Price Coverage / Scope */}
                  <div ref={priceScopeDropdownRef} className="relative">
                    <button
                      type="button"
                      id="price-scope-dropdown-trigger"
                      onClick={() => {
                        setIsPriceScopeDropdownOpen((prev) => !prev);
                        setIsTypeDropdownOpen(false);
                        setIsCategoryDropdownOpen(false);
                        setIsPlanCategoryDropdownOpen(false);
                        setIsPlanRoleDropdownOpen(false);
                        setIsTargetAudienceDropdownOpen(false);
                        setPriceScopeSearchQuery('');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all shadow-2xs cursor-pointer ${
                        isPriceScopeDropdownOpen
                          ? 'border-[#007af7] ring-2 ring-[#007af7]/20 bg-white'
                          : priceScopes.length > 0
                          ? 'border-[#007af7]/50 bg-blue-50/30 hover:bg-blue-50/50'
                          : 'border-slate-300 hover:border-[#007af7]/60 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                        {(() => {
                          if (priceScopes.length === 0) {
                            return (
                              <>
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                                  🏷️
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-700 truncate">
                                    Seleccionar Cobertura de Precio
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    Aclara si es individual, pareja, grupo, mesa o servicio
                                  </div>
                                </div>
                              </>
                            );
                          }

                          if (priceScopes.length === 1) {
                            const selScope = effectivePriceScopes.find((p) => p.id === priceScopes[0]);
                            return (
                              <>
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-base flex items-center justify-center shrink-0 shadow-2xs">
                                  {getPriceScopeEmoji(selScope)}
                                </div>
                                <div className="truncate">
                                  <div className="text-xs font-bold text-slate-800 truncate">
                                    {selScope?.label || 'Modalidad de precio'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    1 modalidad seleccionada (puedes agregar más)
                                  </div>
                                </div>
                              </>
                            );
                          }

                          const selectedNames = effectivePriceScopes
                            .filter((p) => priceScopes.includes(p.id))
                            .map((p) => p.label);

                          return (
                            <>
                              <div className="w-7 h-7 rounded-lg bg-[#007af7] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                                {priceScopes.length}
                              </div>
                              <div className="truncate">
                                <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                                  <span>{priceScopes.length} modalidades de precio asignadas</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {selectedNames.join(', ')}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {priceScopes.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007af7] text-white">
                            {priceScopes.length}
                          </span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                            isPriceScopeDropdownOpen ? 'rotate-180 text-[#007af7]' : ''
                          }`}
                        />
                      </div>
                    </button>


                    {/* Modern Elevated Dropdown with Search, Actions & Checkboxes */}
                    {isPriceScopeDropdownOpen && (
                      <div
                        id="price-scope-menu"
                        className="absolute left-0 right-0 top-full mt-2 z-60 bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                      >
                        {/* Quick Search */}
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={priceScopeSearchQuery}
                              onChange={(e) => setPriceScopeSearchQuery(e.target.value)}
                              placeholder="Buscar cobertura de precio..."
                              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#007af7] focus:ring-2 focus:ring-[#007af7]/15"
                              autoFocus
                            />
                            {priceScopeSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setPriceScopeSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Fast selection helpers */}
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60 text-[11px]">
                            <span className="font-bold text-slate-600">
                              {priceScopes.length === 0
                                ? 'Ninguna seleccionada (Individual)'
                                : `${priceScopes.length} seleccionada${priceScopes.length === 1 ? '' : 's'}`}
                            </span>
                            <div className="flex items-center gap-2">
                              {priceScopes.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleClearPriceScopes}
                                  className="font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                                >
                                  Deseleccionar todas
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={handleSelectAllPriceScopes}
                                className="font-bold text-[#007af7] hover:text-blue-700 hover:underline cursor-pointer"
                              >
                                Seleccionar todas
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Scrollable list with multi-select checkboxes */}
                        <div className="max-h-64 sm:max-h-72 overflow-y-auto p-2 space-y-1">
                          {effectivePriceScopes
                            .filter((p) =>
                              p.label.toLowerCase().includes(priceScopeSearchQuery.trim().toLowerCase()) ||
                              p.subtitle.toLowerCase().includes(priceScopeSearchQuery.trim().toLowerCase()) ||
                              (p.badge && p.badge.toLowerCase().includes(priceScopeSearchQuery.trim().toLowerCase()))
                            )
                            .map((p) => {
                              const isSelected = priceScopes.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleTogglePriceScope(p.id)}
                                  className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2.5 transition cursor-pointer active:scale-[0.99] group ${
                                    isSelected
                                      ? 'bg-blue-50/90 text-blue-900 border border-blue-200/90 font-medium'
                                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    {/* Checkbox indicator */}
                                    <div
                                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected
                                          ? 'bg-[#007af7] border-[#007af7] text-white shadow-2xs'
                                          : 'border-slate-300 bg-white group-hover:border-[#007af7]/60'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>

                                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-base flex items-center justify-center shrink-0">
                                      {getPriceScopeEmoji(p)}
                                    </div>
                                    <div className="truncate">
                                      <span className="text-xs font-bold text-slate-800 block truncate">
                                        {p.label}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block truncate">
                                        {p.subtitle}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          {effectivePriceScopes.filter((p) =>
                            p.label.toLowerCase().includes(priceScopeSearchQuery.trim().toLowerCase()) ||
                            p.subtitle.toLowerCase().includes(priceScopeSearchQuery.trim().toLowerCase()) ||
                            (p.badge && p.badge.toLowerCase().includes(priceScopeSearchQuery.trim().toLowerCase()))
                          ).length === 0 && (
                            <div className="py-6 text-center text-xs text-slate-400">
                              No se encontraron modalidades de precio
                            </div>
                          )}
                        </div>

                        {/* Bottom Action Bar inside Dropdown */}
                        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {priceScopes.length === 0
                              ? 'Sin selección (Individual)'
                              : `${priceScopes.length} seleccionada${priceScopes.length === 1 ? '' : 's'}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsPriceScopeDropdownOpen(false)}
                            className="px-4 py-1.5 rounded-xl bg-[#007af7] hover:bg-blue-600 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98"
                          >
                            Listo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 8. Palabras Clave y Características (Tags) */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#007af7] flex items-center justify-center shrink-0">
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-900">
                        Características y Palabras Clave (Tags)
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Etiquetas que Oli y el buscador utilizan para recomendar este anuncio
                      </p>
                    </div>
                  </div>

                  {/* Fast chip toggles */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2 mt-2">
                    {[
                      'Pet Friendly',
                      'Wifi',
                      'Parqueadero',
                      'Terraza',
                      'Música en vivo',
                      'Domicilios',
                      'Aire libre',
                      'Vegetariano',
                      'Reserva previa',
                    ].map((presetTag) => {
                      const cleanNorm = presetTag.toLowerCase().replace(/\s+/g, '_');
                      const isSelected = tagChips.some(
                        (t) => t.toLowerCase() === presetTag.toLowerCase() || t.toLowerCase() === cleanNorm
                      );
                      return (
                        <button
                          key={presetTag}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setTagChips((prev) =>
                                prev.filter(
                                  (t) =>
                                    t.toLowerCase() !== presetTag.toLowerCase() &&
                                    t.toLowerCase() !== cleanNorm
                                )
                              );
                            } else {
                              setTagChips((prev) => [...prev, presetTag]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'bg-blue-100/80 border-blue-300 text-blue-900'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          #{presetTag} {isSelected && '✓'}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom tag input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tagInputValue}
                      onChange={(e) => setTagInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = tagInputValue.trim().replace(/^#+/, '');
                          if (val && !tagChips.includes(val)) {
                            setTagChips((prev) => [...prev, val]);
                            setTagInputValue('');
                          }
                        }
                      }}
                      placeholder="Escribe otra etiqueta y pulsa Enter (ej: coctelería, postres)..."
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#007af7] focus:ring-2 focus:ring-[#007af7]/15"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = tagInputValue.trim().replace(/^#+/, '');
                        if (val && !tagChips.includes(val)) {
                          setTagChips((prev) => [...prev, val]);
                          setTagInputValue('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#007af7] hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      Agregar
                    </button>
                  </div>

                  {/* Active tags chips list */}
                  {tagChips.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {tagChips.map((tagItem) => (
                        <span
                          key={tagItem}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200"
                        >
                          <span>#{tagItem}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setTagChips((prev) => prev.filter((t) => t !== tagItem))
                            }
                            className="w-3.5 h-3.5 rounded-full hover:bg-blue-200 text-blue-600 flex items-center justify-center cursor-pointer transition ml-0.5"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Sticky Bottom Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#007af7] text-xs sm:text-sm font-bold transition flex items-center gap-1 sm:gap-1.5 cursor-pointer active:scale-98 whitespace-nowrap"
              title="Ver cómo quedará la publicación para los clientes"
            >
              <Eye className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#007af7] shrink-0" />
              <span className="hidden xs:inline">Vista previa</span>
              <span className="xs:hidden">Previa</span>
            </button>

            {editingPost && (editingPost.status === 'pending_review' || editingPost.reviewStatus === 'pending') ? (
              <div
                className="px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 cursor-not-allowed opacity-90 select-none whitespace-nowrap shadow-2xs"
                title="Esta publicación ya tiene una corrección en revisión enviada al administrador."
              >
                <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0 text-amber-700 animate-pulse" />
                <span>En Revisión (Enviada)</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                className={`px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold transition shadow-md flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-98 whitespace-nowrap ${
                  editingPost && (editingPost.suspended || editingPost.status === 'suspended')
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                    : 'bg-[#007af7] hover:bg-[#0068d6] shadow-[#007af7]/25'
                }`}
              >
                {editingPost && (editingPost.suspended || editingPost.status === 'suspended') ? (
                  <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />
                )}
                <span className="hidden sm:inline">
                  {editingPost && (editingPost.suspended || editingPost.status === 'suspended')
                    ? 'Enviar '
                    : 'Confirmar y '}
                </span>
                <span>
                  {editingPost
                    ? editingPost.suspended || editingPost.status === 'suspended'
                      ? 'Corrección a Revisión'
                      : 'Guardar'
                    : 'Publicar'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Customer Preview Modal */}
      {showPreviewModal && (
        <PostDetailModal
          post={getPreviewPost()}
          onClose={() => setShowPreviewModal(false)}
          isPreview={true}
          actionsLayout="bottom"
        />
      )}

      {/* Modal de Configuración de Vigencia y Días */}
      {showValidityModal && (
        <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-[#041f5e] text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center shadow-xs">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">Configuración de Vigencia, Días y Horarios</h3>
                  <p className="text-[11px] text-sky-200">Personaliza los días en que aplica tu anuncio, fechas y texto</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowValidityModal(false)}
                className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              <ValidityEngineControl
                initialSchedule={validitySchedule}
                initialExpiryLabel={customExpiryLabel}
                previewImageUrl={imageUrl}
                businessHours={currentBiz?.hours}
                onChange={handleValidityChange}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowValidityModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#007af7] hover:bg-blue-600 text-white shadow-sm transition cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Aplicar Vigencia</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Video URL Modal */}
      {showVideoUrlModal && (
        <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-2xs">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">URL del Video</h3>
                  <p className="text-[11px] text-slate-500">Ingresa el enlace directo a tu video</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVideoUrlModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Enlace o URL del video (TikTok, Instagram, YouTube, Facebook, Vimeo o MP4)
                </label>
                <div className="relative flex items-center">
                  <Link2 className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="url"
                    value={videoUrlInputText}
                    onChange={(e) => setVideoUrlInputText(e.target.value)}
                    placeholder="https://www.tiktok.com/@usuario/video/... o https://youtube.com/shorts/..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                    autoFocus
                  />
                </div>
                {(() => {
                  const currentTrimmed = videoUrlInputText.trim();
                  if (!currentTrimmed) {
                    return (
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Compatibilidad directa: TikTok, Instagram Reels, YouTube Shorts / videos, Facebook Reels, Vimeo o MP4.
                      </p>
                    );
                  }
                  const detected = parseVideoUrl(currentTrimmed);
                  return (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-sky-50 border border-sky-200/90 flex items-center justify-between text-xs animate-in fade-in">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#007af7] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                          {detected.platform === 'tiktok'
                            ? 'TT'
                            : detected.platform === 'instagram'
                            ? 'IG'
                            : detected.platform === 'youtube'
                            ? 'YT'
                            : detected.platform === 'facebook'
                            ? 'FB'
                            : '▶'}
                        </div>
                        <div className="truncate">
                          <p className="font-extrabold text-slate-800 leading-tight truncate">
                            {detected.platformName}
                          </p>
                          <p className="text-[11px] text-sky-700">
                            Recomendado: <span className="font-bold">{detected.aspectRatio === '9:16' ? 'Vertical 9:16 (Reel / TikTok)' : '16:9 Panorámico'}</span>
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-md bg-white border border-sky-200 text-[#007af7] font-extrabold text-xs shrink-0 shadow-2xs">
                        {detected.aspectRatio}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVideoUrlModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveVideoUrl}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#007af7] hover:bg-blue-600 text-white shadow-sm transition cursor-pointer active:scale-95"
              >
                Cargar Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Video Thumbnail Modal */}
      {showThumbnailModal && (
        <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-2xs">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">Miniatura de Portada del Video</h3>
                  <p className="text-[11px] text-slate-500">Imagen que se mostrará antes de que inicie el video</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowThumbnailModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Preview of current thumbnail if set */}
              {imageUrl && imageUrl !== videoUrl ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <img
                    src={imageUrl}
                    alt="Miniatura actual"
                    className="w-16 h-10 object-cover rounded-lg shadow-xs border border-emerald-300 shrink-0"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-emerald-900">Miniatura actual activa</span>
                    <span className="text-[11px] text-emerald-700 truncate">Se mostrará en el feed y portada</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCustomThumbnail}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                    title="Quitar miniatura personalizada"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center">
                  <span className="text-xs text-slate-500">
                    Actualmente no hay miniatura personalizada. El navegador mostrará el primer fotograma del video.
                  </span>
                </div>
              )}

              {/* Subir imagen desde tu dispositivo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Subir imagen desde tu dispositivo
                </label>
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 text-xs font-bold transition cursor-pointer shadow-2xs active:scale-[0.99]"
                >
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>Seleccionar imagen (JPG, PNG, WEBP)</span>
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowThumbnailModal(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-800 text-white shadow-2xs transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
