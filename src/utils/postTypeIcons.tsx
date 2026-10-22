import React from 'react';
import {
  Tag,
  ShoppingBag,
  Zap,
  Calendar,
  Sparkles,
  Utensils,
  Coffee,
  Megaphone,
  Gift,
  Ticket,
  Flame,
  Star,
  Package,
  Scissors,
  Wrench,
  Car,
  Dumbbell,
  HeartPulse,
  Briefcase,
  Music,
  Clock,
  Dog,
  Home,
  Smile,
  BadgePercent,
  Layers,
  Store,
  Compass,
  Pizza,
  Smartphone,
  Heart,
  Wine,
  CheckSquare,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Camera,
  Film,
  Bike,
  GraduationCap,
  Hammer,
  PawPrint,
  User,
  Users,
  DollarSign,
  Coins,
  CreditCard,
  Receipt,
  ShieldCheck,
  PartyPopper,
  Laptop,
  MapPin,
  Activity,
  Award,
  Globe,
} from 'lucide-react';

export const POST_TYPE_LUCIDE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  // Principales
  Tag,
  ShoppingBag,
  Zap,
  Calendar,
  Sparkles,
  Star,
  Flame,
  // Gastronomía & Salidas
  Utensils,
  Coffee,
  Wine,
  Pizza,
  // Momentos & Horarios
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Clock,
  Compass,
  // Personas & Audiencias
  User,
  Users,
  Heart,
  Smile,
  Home,
  PawPrint,
  Dog,
  PartyPopper,
  GraduationCap,
  // Negocios, Precios & Finanzas
  Store,
  Package,
  BadgePercent,
  DollarSign,
  Coins,
  CreditCard,
  Ticket,
  Receipt,
  Gift,
  Briefcase,
  Laptop,
  // Servicios & Actividades
  Wrench,
  Hammer,
  Scissors,
  Car,
  Bike,
  Dumbbell,
  HeartPulse,
  Music,
  Camera,
  Film,
  Smartphone,
  Layers,
  MapPin,
  ShieldCheck,
  CheckSquare,
  Activity,
  Award,
  Globe,
  Megaphone,
};

export const EMOJI_TO_LUCIDE_MAP: Record<string, string> = {
  // Momentos del plan
  '🍳': 'Sun',
  '🍽️': 'Utensils',
  '☕': 'Coffee',
  '🍷': 'Wine',
  '🎯': 'Compass',
  '⚡': 'Zap',
  '⏰': 'Clock',
  '🥐': 'Coffee',
  '🥞': 'Sun',
  '🍔': 'Utensils',
  '🍕': 'Pizza',
  '🥗': 'Utensils',
  '🥩': 'Utensils',
  '🍰': 'Coffee',
  '🍦': 'Coffee',
  '🍸': 'Wine',
  '🍺': 'Wine',
  '🍻': 'Wine',
  '🌅': 'Sunrise',
  '☀️': 'Sun',
  '🌆': 'Sunset',
  '🌙': 'Moon',
  '🚲': 'Bike',
  '🎬': 'Film',
  '🛍️': 'ShoppingBag',
  '✨': 'Sparkles',

  // Público objetivo
  '👥': 'Users',
  '💑': 'Heart',
  '👨‍👩‍👧‍👦': 'Home',
  '🐾': 'PawPrint',
  '🐶': 'Dog',
  '🐱': 'PawPrint',
  '💻': 'Laptop',
  '🎉': 'PartyPopper',
  '🌟': 'Star',
  '👶': 'Smile',
  '🧑‍🤝‍🧑': 'Users',
  '👵': 'Heart',
  '🧳': 'Briefcase',
  '💼': 'Briefcase',
  '🎓': 'GraduationCap',
  '🚴': 'Bike',
  '🎨': 'Sparkles',
  '❤️': 'Heart',
  '🔥': 'Flame',

  // Modalidad de precio
  '🏷️': 'Tag',
  '👤': 'User',
  '⏱️': 'Clock',
  '📦': 'Package',
  '🎁': 'Gift',
  '💰': 'DollarSign',
  '🎫': 'Ticket',
  '💳': 'CreditCard',
  '⭐': 'Star',
};

export const POST_TYPE_EMOJI_PRESETS = [
  // Comercios, Compras & Promociones
  '🏷️', '🛍️', '📦', '🎁', '🎟️', '💰', '💳', '⭐', '✨', '🔥', '🚀',
  // Gastronomía & Salidas
  '🍽️', '🍔', '🍕', '☕', '🥐', '🍰', '🍷', '🍸', '🍺', '🍻', '🥗', '🥩',
  // Momentos del día & Horarios
  '🍳', '🥞', '🌅', '☀️', '🌆', '🌙', '⏰', '⏱️', '⚡', '🎯',
  // Servicios, Oficios & Cuidado
  '🛠️', '💼', '💻', '🚗', '🏍️', '🚲', '💅', '🩺', '🏋️', '🔨', '📱', '🎓', '🏡', '🐾', '🎈', '🎪',
  // Audiencias & Personas
  '👤', '👫', '💑', '👨‍👩‍👧‍👦', '👥', '🎉', '🌟', '👶', '🧑‍🤝‍🧑',
  // Territorio & Municipios
  '📍', '🏰', '🌙', '⛰️', '🌄', '🏺', '💧', '🥛', '♨️', '🧗', '🏎️', '⛪', '🏙️', '🏞️', '🌿',
];

export const isEmoji = (str?: string): boolean => {
  if (!str) return false;
  return /\p{Extended_Pictographic}/u.test(str);
};

export const resolveIconOrEmoji = (
  iconNameOrEmoji?: string,
  forceVectorIcon = false
): { isVector: boolean; iconName?: string; emoji?: string } => {
  if (!iconNameOrEmoji) {
    return { isVector: true, iconName: 'Tag' };
  }
  if (!forceVectorIcon && isEmoji(iconNameOrEmoji)) {
    return { isVector: false, emoji: iconNameOrEmoji };
  }
  if (POST_TYPE_LUCIDE_ICONS[iconNameOrEmoji]) {
    return { isVector: true, iconName: iconNameOrEmoji };
  }
  if (forceVectorIcon && EMOJI_TO_LUCIDE_MAP[iconNameOrEmoji]) {
    return { isVector: true, iconName: EMOJI_TO_LUCIDE_MAP[iconNameOrEmoji] };
  }
  if (isEmoji(iconNameOrEmoji)) {
    return { isVector: false, emoji: iconNameOrEmoji };
  }
  return { isVector: true, iconName: iconNameOrEmoji };
};

export const getPostTypeIconComponent = (
  iconName?: string,
  fallbackId?: string
): React.FC<{ className?: string }> => {
  if (iconName && isEmoji(iconName)) {
    const EmojiIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
      <span className={`inline-flex items-center justify-center leading-none select-none ${className}`}>
        {iconName}
      </span>
    );
    return EmojiIcon;
  }

  if (iconName && POST_TYPE_LUCIDE_ICONS[iconName]) {
    return POST_TYPE_LUCIDE_ICONS[iconName];
  }

  if (iconName && EMOJI_TO_LUCIDE_MAP[iconName]) {
    const mapped = EMOJI_TO_LUCIDE_MAP[iconName];
    if (POST_TYPE_LUCIDE_ICONS[mapped]) {
      return POST_TYPE_LUCIDE_ICONS[mapped];
    }
  }

  // Fallbacks by ID
  switch (fallbackId) {
    case 'promotion':
      return Tag;
    case 'product':
      return ShoppingBag;
    case 'service':
      return Zap;
    case 'event':
      return Calendar;
    case 'other':
    default:
      return Sparkles;
  }
};

interface PostTypeIconProps {
  iconName?: string;
  fallbackId?: string;
  className?: string;
  emojiClassName?: string;
  forceVector?: boolean;
}

export const PostTypeIconDisplay: React.FC<PostTypeIconProps> = ({
  iconName,
  fallbackId,
  className = 'w-5 h-5',
  emojiClassName = 'text-xl',
  forceVector = false,
}) => {
  // If not explicitly forcing vector and the icon is an emoji, render the emoji!
  if (!forceVector && iconName && isEmoji(iconName)) {
    return (
      <span className={`inline-flex items-center justify-center leading-none select-none ${emojiClassName}`}>
        {iconName}
      </span>
    );
  }

  // If forcing vector and there is an emoji-to-lucide mapping
  if (forceVector && iconName && EMOJI_TO_LUCIDE_MAP[iconName]) {
    const mapped = EMOJI_TO_LUCIDE_MAP[iconName];
    if (mapped && POST_TYPE_LUCIDE_ICONS[mapped]) {
      const Icon = POST_TYPE_LUCIDE_ICONS[mapped];
      return <Icon className={className} />;
    }
  }

  // If it's a known Lucide vector icon
  if (iconName && POST_TYPE_LUCIDE_ICONS[iconName]) {
    const Icon = POST_TYPE_LUCIDE_ICONS[iconName];
    return <Icon className={className} />;
  }

  // If it's an emoji (fallback when forceVector had no mapping)
  if (iconName && isEmoji(iconName)) {
    return (
      <span className={`inline-flex items-center justify-center leading-none select-none ${emojiClassName}`}>
        {iconName}
      </span>
    );
  }

  // Default emojis for base IDs if no lucide icon assigned
  if (fallbackId === 'promotion') {
    return <span className={`inline-flex items-center justify-center leading-none select-none ${emojiClassName}`}>🏷️</span>;
  }
  if (fallbackId === 'product') {
    return <span className={`inline-flex items-center justify-center leading-none select-none ${emojiClassName}`}>🛍️</span>;
  }
  if (fallbackId === 'service') {
    return <span className={`inline-flex items-center justify-center leading-none select-none ${emojiClassName}`}>🛠️</span>;
  }
  if (fallbackId === 'event') {
    return <span className={`inline-flex items-center justify-center leading-none select-none ${emojiClassName}`}>📅</span>;
  }

  return <Sparkles className={className} />;
};


export interface PostTypeLabelConfig {
  id: string;
  label: string;
  slug?: string;
  badgeBg?: string;
}

export const getPostTypeLabel = (
  type?: string,
  postTypes?: PostTypeLabelConfig[]
): string => {
  if (!type) return 'Publicación';
  const norm = type.toLowerCase().trim();
  const found = postTypes?.find(
    (pt) => pt.id.toLowerCase() === norm || pt.slug?.toLowerCase() === norm
  );
  if (found?.label) return found.label;

  switch (norm) {
    case 'promotion':
    case 'promocion':
    case 'promociones':
      return 'Promoción & Oferta';
    case 'event':
    case 'evento':
    case 'eventos':
    case 'plan':
      return 'Plan o Evento';
    case 'product':
    case 'producto':
    case 'productos':
      return 'Producto Destacado';
    case 'service':
    case 'servicio':
    case 'servicios':
      return 'Servicios & Trámites';
    case 'other':
      return 'Novedad';
    default:
      return type;
  }
};

export const getPostTypeBadgeStyle = (
  type?: string,
  postTypes?: PostTypeLabelConfig[]
): string => {
  if (!type) return 'bg-slate-100 text-slate-800 border border-slate-200';
  const norm = type.toLowerCase().trim();
  const found = postTypes?.find(
    (pt) => pt.id.toLowerCase() === norm || pt.slug?.toLowerCase() === norm
  );
  if (found?.badgeBg) return found.badgeBg;

  switch (norm) {
    case 'promotion':
    case 'promocion':
    case 'promociones':
      return 'bg-orange-100 text-orange-800 border border-orange-200';
    case 'event':
    case 'evento':
    case 'eventos':
    case 'plan':
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    case 'product':
    case 'producto':
    case 'productos':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'service':
    case 'servicio':
    case 'servicios':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
};

